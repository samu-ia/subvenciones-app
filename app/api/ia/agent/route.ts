import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateToolConfig, getProviderConfig, logToolExecution } from '@/lib/db/ia-config';
import { createProvider } from '@/lib/ai/providers/factory';
import { Message } from '@/lib/ai/providers/base';
import { createClient } from '@/lib/supabase/server';
import type {
  AgentRequest, AgentResponse,
  AgentAction, AgentActionResult,
} from '@/lib/types/agent-actions';

// ─── System prompt del agente ─────────────────────────────────────────────────

const AGENT_SYSTEM_PROMPT = `Eres un asistente experto en gestión de expedientes y subvenciones.
Tienes acceso a un notebook con documentos editables y puedes actuar sobre ellos.

Cuando el usuario te pida organizar, preparar o construir el expediente, debes responder con un JSON estructurado.
Cuando sea una pregunta simple o conversación, responde directamente en texto normal.

## REGLAS IMPORTANTES
- Solo crea/edita documentos cuando el usuario lo pida explícitamente o sea claramente necesario.
- Usa el contexto del expediente para rellenar documentos con contenido relevante.
- El contenido de documentos debe estar en formato Markdown.
- Para preguntas o consultas simples, usa solo respond_chat.

## FORMATO DE RESPUESTA

Cuando vayas a ejecutar acciones sobre documentos, responde ÚNICAMENTE con este JSON (sin texto adicional):

{
  "actions": [
    { "type": "create_folder", "folder_name": "Nombre Carpeta" },
    { "type": "create_document", "nombre": "Título", "contenido": "## Título\\n\\nContenido...", "tipo_documento": "memoria", "folder_name": "Nombre Carpeta" },
    { "type": "edit_document", "nombre": "Título existente", "contenido": "Nuevo contenido completo", "append": false },
    { "type": "respond", "content": "Explicación al usuario de lo que has hecho..." }
  ]
}

El campo "respond" con tu mensaje de chat SIEMPRE debe estar al final de las acciones.

## TIPOS DE DOCUMENTO VÁLIDOS
memoria, checklist, notas, email, informe, proyecto_tecnico, memoria_economica, cronograma, otro

## CUANDO SOLO RESPONDES POR CHAT (sin JSON):
- Preguntas sobre el contenido de documentos
- Consultas de información
- Conversación general
`;

// ─── Parser de la respuesta del LLM ──────────────────────────────────────────

function parseAgentResponse(raw: string): AgentAction[] {
  // Intentar extraer JSON del response (puede venir con texto antes/después)
  const jsonMatch = raw.match(/\{[\s\S]*"actions"[\s\S]*\}/);
  if (!jsonMatch) {
    // No hay JSON → es un respond puro
    return [{ type: 'respond', content: raw.trim() }];
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (Array.isArray(parsed.actions)) {
      return parsed.actions as AgentAction[];
    }
  } catch {
    // JSON malformado → respond con el texto
  }

  return [{ type: 'respond', content: raw.trim() }];
}

// ─── Ejecutar acciones en Supabase ────────────────────────────────────────────

async function executeActions(
  actions: AgentAction[],
  contextoId: string,
  contextoTipo: 'expediente' | 'reunion',
  nif: string | null,
  documentos: AgentRequest['documentos'],
  supabase: Awaited<ReturnType<typeof createClient>>,
  orden: number,
): Promise<AgentActionResult[]> {
  const results: AgentActionResult[] = [];

  for (const action of actions) {
    if (action.type === 'respond') {
      results.push({ action, success: true });
      continue;
    }

    if (action.type === 'create_folder') {
      // Las "carpetas" son el campo grupo en documentos — no tienen tabla propia.
      // Registramos como éxito directamente; los docs creados después llevarán el grupo.
      results.push({ action, success: true });
      continue;
    }

    if (action.type === 'create_document') {
      try {
        const docData: Record<string, unknown> = {
          nombre: action.nombre,
          contenido: action.contenido ?? '',
          tipo_documento: action.tipo_documento ?? 'nota',
          generado_por_ia: true,
          orden: orden++,
          grupo: action.folder_name ?? null,
        };
        if (contextoTipo === 'reunion') docData.reunion_id = contextoId;
        else {
          docData.expediente_id = contextoId;
          if (nif) docData.nif = nif;
        }

        const { data: newDoc, error } = await supabase
          .from('documentos')
          .insert(docData)
          .select()
          .single();

        if (error) throw error;
        results.push({ action, success: true, documentId: newDoc.id, documentName: newDoc.nombre });
      } catch (err) {
        results.push({ action, success: false, error: err instanceof Error ? err.message : String(err) });
      }
      continue;
    }

    if (action.type === 'edit_document') {
      try {
        // Buscar el documento por ID o por nombre
        let docId = action.document_id;
        if (!docId && action.nombre) {
          const match = documentos.find(
            d => d.nombre.toLowerCase() === action.nombre!.toLowerCase()
          );
          docId = match?.id;
        }
        if (!docId) {
          results.push({ action, success: false, error: `Documento "${action.nombre}" no encontrado` });
          continue;
        }

        let nuevoContenido = action.contenido;
        if (action.append) {
          // Leer contenido actual
          const { data: existing } = await supabase
            .from('documentos')
            .select('contenido')
            .eq('id', docId)
            .single();
          nuevoContenido = `${existing?.contenido ?? ''}\n\n${action.contenido}`;
        }

        const { error } = await supabase
          .from('documentos')
          .update({ contenido: nuevoContenido, updated_at: new Date().toISOString() })
          .eq('id', docId);

        if (error) throw error;
        results.push({ action, success: true, documentId: docId, documentName: action.nombre });
      } catch (err) {
        results.push({ action, success: false, error: err instanceof Error ? err.message : String(err) });
      }
      continue;
    }
  }

  return results;
}

// ─── Handler principal ────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body: AgentRequest = await request.json();
    const { message, context, contextoId, contextoTipo, documentos, history } = body;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }
    const userId = user.id;

    // Configuración de la herramienta notebook (reutilizamos la misma config)
    const toolConfig = await getOrCreateToolConfig(userId, 'notebook', contextoTipo);
    if (!toolConfig.enabled) {
      return NextResponse.json({ error: 'La herramienta notebook está deshabilitada', error_code: 'tool_disabled' }, { status: 403 });
    }

    const providerConfig = await getProviderConfig(userId, toolConfig.provider);
    if (!providerConfig?.api_key) {
      return NextResponse.json({
        error: `No hay API key para ${toolConfig.provider}. Ve a Ajustes.`,
        error_code: 'no_api_key',
        provider: toolConfig.provider,
      }, { status: 400 });
    }

    // Leer NIF del expediente si aplica (para asociar documentos)
    let nif: string | null = null;
    if (contextoTipo === 'expediente') {
      const { data: exp } = await supabase
        .from('expediente')
        .select('nif')
        .eq('id', contextoId)
        .single();
      nif = exp?.nif ?? null;
    }

    // Construir system prompt con lista de documentos actuales
    const docsIndex = documentos.length > 0
      ? `\n\n## DOCUMENTOS EXISTENTES EN EL NOTEBOOK\n${documentos.map((d, i) => `${i + 1}. [ID: ${d.id}] "${d.nombre}" (tipo: ${d.tipo_documento ?? 'nota'}${d.grupo ? `, carpeta: ${d.grupo}` : ''})`).join('\n')}`
      : '\n\n## DOCUMENTOS EXISTENTES EN EL NOTEBOOK\n(El notebook está vacío)';

    const systemPrompt = AGENT_SYSTEM_PROMPT + docsIndex + (context ? `\n\n## CONTEXTO DE DOCUMENTOS\n${context}` : '');

    // Construir mensajes
    const messages: Message[] = [
      ...history.slice(-6).map(h => ({
        role: h.role as 'user' | 'assistant',
        content: h.content,
      })),
      { role: 'user', content: message },
    ];

    // Llamar al LLM
    const provider = createProvider({
      provider: toolConfig.provider,
      apiKey: providerConfig.api_key,
      baseUrl: providerConfig.base_url,
      organization: providerConfig.organization,
      enabled: true,
    });

    const llmResponse = await provider.complete(messages, {
      model: toolConfig.model,
      temperature: 0.4,   // más determinista para acciones
      maxTokens: toolConfig.maxTokens,
      systemPrompt,
    });

    const executionTime = Date.now() - startTime;

    // Parsear acciones
    const actions = parseAgentResponse(llmResponse.content);

    // Obtener orden actual para nuevos docs
    const { count: docsCount } = await supabase
      .from('documentos')
      .select('id', { count: 'exact', head: true })
      .eq(contextoTipo === 'reunion' ? 'reunion_id' : 'expediente_id', contextoId);
    const startOrden = docsCount ?? documentos.length;

    // Ejecutar acciones en Supabase
    const actionResults = await executeActions(
      actions,
      contextoId,
      contextoTipo,
      nif,
      documentos,
      supabase,
      startOrden,
    );

    // Extraer mensaje de chat del respond action
    const respondAction = actions.find(a => a.type === 'respond');
    const chatMessage = respondAction?.type === 'respond'
      ? respondAction.content
      : 'Listo. He ejecutado las acciones solicitadas.';

    // Log analytics
    await logToolExecution({
      userId,
      workspaceId: contextoId,
      workspaceType: contextoTipo,
      tool: 'notebook',
      provider: llmResponse.provider,
      model: llmResponse.model,
      inputText: message,
      outputText: chatMessage,
      success: true,
      tokensUsed: llmResponse.tokensUsed,
      executionTimeMs: executionTime,
    });

    const response: AgentResponse = {
      chatMessage,
      actions: actionResults,
      metadata: {
        model: llmResponse.model,
        provider: llmResponse.provider,
        tokensUsed: llmResponse.tokensUsed,
      },
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error en /api/ia/agent:', error);
    let errorMessage = 'Error procesando el agente';
    if (error instanceof Error) errorMessage = error.message;
    const anyErr = error as any;
    if (anyErr?.response?.data?.error?.message) errorMessage = anyErr.response.data.error.message;

    return NextResponse.json({ error: errorMessage, error_code: 'unknown' }, { status: 500 });
  }
}
