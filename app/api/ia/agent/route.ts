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

const AGENT_SYSTEM_PROMPT = `Eres un agente IA especializado en gestión de expedientes y subvenciones públicas españolas.
Tu función principal es ACTUAR sobre los documentos del notebook, no solo responder por chat.

## REGLA FUNDAMENTAL
Siempre que el usuario pida generar, redactar, preparar, escribir, crear, completar o borrar cualquier contenido o documento, debes ejecutar la acción correspondiente en el notebook. Nunca respondas ese contenido solo en el chat.

## CUÁNDO USAR EL JSON DE ACCIONES
USA EL JSON (obligatorio) cuando el usuario:
- Pida redactar, escribir, generar, preparar, crear o completar cualquier documento
- Pida notas de reunión, actas, resúmenes, informes, borradores, emails, checklists, memorias
- Pida actualizar, corregir, ampliar o reemplazar un documento existente
- Pida BORRAR o ELIMINAR un documento
- Cualquier solicitud que modifique el notebook

SOLO usa texto plano (sin JSON) para:
- Preguntas cortas de consulta ("¿cuándo vence el plazo?", "¿qué documentos hacen falta?")
- Conversación casual sin modificación de documentos

## FORMATO DE RESPUESTA CON ACCIONES

Responde ÚNICAMENTE con este JSON (sin texto antes ni después, sin bloques de código markdown):

{
  "actions": [
    { "type": "create_document", "nombre": "Título", "contenido": "## Título\\n\\nContenido...", "tipo_documento": "memoria" },
    { "type": "respond", "content": "He creado el documento Título con la memoria del proyecto." }
  ]
}

REGLAS CRÍTICAS DEL JSON:
- El campo "respond" va SIEMPRE al final y es OBLIGATORIO
- El contenido de los documentos debe estar en Markdown bien formateado:
  - Usa ## para secciones principales, ### para subsecciones
  - Usa **negrita** para términos clave
  - Usa listas - para enumeraciones
  - Usa > para notas o advertencias importantes
  - Separa secciones con líneas en blanco (\\n\\n)
- Usa \\n para saltos de línea dentro de las strings JSON
- No pongas NINGÚN texto fuera del JSON cuando uses acciones
- Para borrar un documento, usa su ID exacto del campo [ID: ...] del contexto

## TIPOS DE DOCUMENTO VÁLIDOS
notas, memoria, checklist, email, informe, proyecto_tecnico, memoria_economica, cronograma, acta, otro

## ACCIONES DISPONIBLES

### Crear documento nuevo
{ "type": "create_document", "nombre": "Nombre del doc", "contenido": "## Título\\n\\nContenido en Markdown", "tipo_documento": "memoria" }

### Editar documento completo (reemplaza todo el contenido)
{ "type": "edit_document", "document_id": "uuid-del-documento", "nombre": "nombre exacto", "contenido": "## Nuevo contenido completo", "append": false }

### Añadir al final de un documento existente
{ "type": "edit_document", "document_id": "uuid-del-documento", "nombre": "nombre exacto", "contenido": "\\n\\n## Nueva sección\\n\\nContenido adicional", "append": true }

### Editar una sección concreta (busca y reemplaza un fragmento)
{ "type": "edit_section", "document_id": "uuid-del-documento", "nombre": "nombre exacto", "buscar": "texto exacto a reemplazar", "reemplazar": "texto nuevo" }

### Borrar un documento
{ "type": "delete_document", "document_id": "uuid-del-documento", "nombre": "nombre del doc a confirmar" }

### Responder al usuario (siempre al final)
{ "type": "respond", "content": "Descripción de lo que has hecho" }
`;

// ─── Parser de la respuesta del LLM ──────────────────────────────────────────

function parseAgentResponse(raw: string): AgentAction[] {
  // 1. Intentar extraer bloque ```json ... ``` primero
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenceMatch ? fenceMatch[1].trim() : raw;

  // 2. Buscar el JSON con "actions"
  const jsonMatch = candidate.match(/\{[\s\S]*"actions"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed.actions) && parsed.actions.length > 0) {
        // Asegurar que hay un respond al final
        const actions = parsed.actions as AgentAction[];
        const hasRespond = actions.some(a => a.type === 'respond');
        if (!hasRespond) {
          actions.push({ type: 'respond', content: 'Hecho.' });
        }
        return actions;
      }
    } catch {
      // JSON malformado — caemos al fallback
    }
  }

  // 3. Fallback: respuesta pura de chat (sin acciones)
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
        console.error('[agent] create_document error:', JSON.stringify(err));
        const msg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? JSON.stringify(err);
        results.push({ action, success: false, error: msg });
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
        console.error('[agent] edit_document error:', JSON.stringify(err));
        const msg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? JSON.stringify(err);
        results.push({ action, success: false, error: msg });
      }
      continue;
    }

    if (action.type === 'edit_section') {
      try {
        let docId = action.document_id;
        let docNombre = action.nombre;
        if (!docId && action.nombre) {
          const match = documentos.find(
            d => d.nombre.toLowerCase() === action.nombre!.toLowerCase()
          );
          docId = match?.id;
          docNombre = match?.nombre ?? action.nombre;
        }
        if (!docId) {
          results.push({ action, success: false, error: `Documento "${action.nombre}" no encontrado` });
          continue;
        }

        const { data: existing, error: readError } = await supabase
          .from('documentos')
          .select('contenido')
          .eq('id', docId)
          .single();
        if (readError) throw readError;

        const contenidoActual = existing?.contenido ?? '';

        // Intentar match exacto primero, luego normalizado (espacios/saltos)
        let nuevoContenido: string;
        if (contenidoActual.includes(action.buscar)) {
          nuevoContenido = contenidoActual.replace(action.buscar, action.reemplazar);
        } else {
          // Normalizar: colapsar múltiples espacios/saltos a uno solo
          const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();
          const contenidoNorm = normalize(contenidoActual);
          const buscarNorm = normalize(action.buscar);
          if (contenidoNorm.includes(buscarNorm)) {
            nuevoContenido = contenidoActual.replace(
              new RegExp(action.buscar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'), 'g'),
              action.reemplazar,
            );
          } else {
            results.push({ action, success: false, error: `No se encontró el fragmento en "${docNombre}". Usa edit_document para reemplazar el documento completo.` });
            continue;
          }
        }

        const { error } = await supabase
          .from('documentos')
          .update({ contenido: nuevoContenido, updated_at: new Date().toISOString() })
          .eq('id', docId);

        if (error) throw error;
        results.push({ action, success: true, documentId: docId, documentName: docNombre });
      } catch (err) {
        console.error('[agent] edit_section error:', JSON.stringify(err));
        const msg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? JSON.stringify(err);
        results.push({ action, success: false, error: msg });
      }
      continue;
    }

    if (action.type === 'delete_document') {
      try {
        let docId = action.document_id;
        if (!docId && action.nombre) {
          const match = documentos.find(
            d => d.nombre.toLowerCase() === action.nombre!.toLowerCase()
          );
          docId = match?.id;
        }
        if (!docId) {
          results.push({ action, success: false, error: `Documento "${action.nombre}" no encontrado para borrar` });
          continue;
        }

        const { error } = await supabase
          .from('documentos')
          .delete()
          .eq('id', docId);

        if (error) throw error;
        results.push({ action, success: true, documentId: docId, documentName: action.nombre });
      } catch (err) {
        console.error('[agent] delete_document error:', JSON.stringify(err));
        const msg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? JSON.stringify(err);
        results.push({ action, success: false, error: msg });
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

    // Leer datos del expediente (NIF, subvención, cliente, solicitud)
    let nif: string | null = null;
    let expedienteContext = '';
    if (contextoTipo === 'expediente') {
      const { data: exp } = await supabase
        .from('expediente')
        .select('nif, titulo, organismo, subvencion_id, estado')
        .eq('id', contextoId)
        .single();
      nif = exp?.nif ?? null;

      if (nif) {
        // Cargar cliente, solicitud con respuestas y subvención en paralelo
        const [{ data: clienteDB }, { data: solDB }, { data: subvDB }] = await Promise.all([
          supabase.from('cliente').select('nombre_empresa,cnae_codigo,cnae_descripcion,comunidad_autonoma,ciudad,num_empleados,facturacion_anual,forma_juridica,anos_antiguedad,descripcion_actividad,tamano_empresa').eq('nif', nif).maybeSingle(),
          supabase.from('solicitudes').select('respuestas_ia,encaje_score,informe_viabilidad').eq('expediente_id', contextoId).maybeSingle(),
          exp?.subvencion_id ? supabase.from('subvenciones').select('titulo,organismo,objeto,para_quien,importe_maximo,plazo_fin,url_oficial,estado_convocatoria').eq('id', exp.subvencion_id).maybeSingle() : Promise.resolve({ data: null }),
        ]);

        // Construir sección de contexto estructurado
        const lines: string[] = ['\n\n## CONTEXTO DEL EXPEDIENTE'];

        lines.push('\n### SUBVENCIÓN');
        lines.push(`- Expediente: ${exp?.titulo ?? 'N/D'} | Estado: ${exp?.estado ?? 'N/D'}`);
        if (subvDB) {
          lines.push(`- Organismo: ${subvDB.organismo ?? 'N/D'}`);
          lines.push(`- Importe máximo: ${subvDB.importe_maximo ? Number(subvDB.importe_maximo).toLocaleString('es-ES') + ' €' : 'N/D'}`);
          lines.push(`- Plazo fin: ${subvDB.plazo_fin ?? 'N/D'}`);
          if (subvDB.objeto) lines.push(`- Objeto: ${subvDB.objeto}`);
          if (subvDB.para_quien) lines.push(`- Para quién: ${subvDB.para_quien}`);
        }

        lines.push('\n### CLIENTE');
        if (clienteDB) {
          lines.push(`- Empresa: ${clienteDB.nombre_empresa ?? nif} | NIF: ${nif}`);
          lines.push(`- Sector/CNAE: ${clienteDB.cnae_descripcion ?? 'N/D'} (${clienteDB.cnae_codigo ?? ''})`);
          lines.push(`- Tamaño: ${clienteDB.tamano_empresa ?? 'N/D'} | Empleados: ${clienteDB.num_empleados ?? 'N/D'}`);
          lines.push(`- Facturación anual: ${clienteDB.facturacion_anual ? Number(clienteDB.facturacion_anual).toLocaleString('es-ES') + ' €' : 'N/D'}`);
          lines.push(`- Forma jurídica: ${clienteDB.forma_juridica ?? 'N/D'} | Antigüedad: ${clienteDB.anos_antiguedad ?? 'N/D'} años`);
          lines.push(`- Localización: ${[clienteDB.ciudad, clienteDB.comunidad_autonoma].filter(Boolean).join(', ') || 'N/D'}`);
          if (clienteDB.descripcion_actividad) lines.push(`- Actividad: ${clienteDB.descripcion_actividad}`);
        }

        if (solDB?.respuestas_ia) {
          type RespIA = { pregunta: string; respuesta: unknown; tipo: string; categoria: string };
          const respuestas = solDB.respuestas_ia as RespIA[];
          const proyecto = respuestas.filter(r => r.categoria === 'proyecto');
          const encaje = respuestas.filter(r => r.categoria === 'encaje');
          if (proyecto.length > 0) {
            lines.push('\n### LO QUE EL CLIENTE QUIERE HACER CON LA AYUDA');
            proyecto.forEach(r => lines.push(`- ${r.pregunta}: ${r.respuesta}`));
          }
          if (encaje.length > 0) {
            lines.push('\n### CRITERIOS DE ENCAJE VERIFICADOS');
            encaje.forEach(r => lines.push(`- ${r.pregunta}: ${r.respuesta ? 'SÍ ✓' : 'NO ✗'}`));
          }
          if (solDB.encaje_score != null) {
            lines.push(`\n**Puntuación de encaje:** ${Math.round((solDB.encaje_score as number) * 100)}%`);
          }
        }

        expedienteContext = lines.join('\n');
      }
    }

    // ── RAG lite: puntuar documentos por relevancia a la query ────────────────
    function scoreDocRelevance(doc: { nombre: string; tipo_documento?: string | null; contenido?: string | null }, query: string): number {
      const q = query.toLowerCase();
      const words = q.split(/\s+/).filter(w => w.length > 3);
      let score = 0;
      const nombre = doc.nombre.toLowerCase();
      const contenido = (doc.contenido ?? '').toLowerCase();
      const tipo = (doc.tipo_documento ?? '').toLowerCase();

      // Coincidencia en nombre (peso alto)
      if (nombre.includes(q)) score += 10;
      words.forEach(w => { if (nombre.includes(w)) score += 3; });

      // Coincidencia en tipo
      if (tipo && q.includes(tipo)) score += 4;

      // Coincidencia en contenido (peso medio)
      words.forEach(w => {
        const count = (contenido.match(new RegExp(w, 'g')) ?? []).length;
        score += Math.min(count, 5); // cap para evitar docs muy largos que dominen
      });

      // Bonus si el doc tiene contenido
      if (contenido.length > 100) score += 1;

      return score;
    }

    // Construir system prompt con RAG: docs relevantes primero, resto solo metadatos
    const MAX_DOC_CHARS = 3000;   // chars por documento relevante
    const MAX_TOTAL_CHARS = 12000; // total contexto de docs

    let totalChars = 0;
    const docsConScore = documentos.map(d => ({
      doc: d,
      score: scoreDocRelevance(d, message),
    })).sort((a, b) => b.score - a.score);

    const docsIndex = documentos.length === 0
      ? '\n\n## DOCUMENTOS EXISTENTES EN EL NOTEBOOK\n(El notebook está vacío)'
      : '\n\n## DOCUMENTOS EXISTENTES EN EL NOTEBOOK\n' +
        docsConScore.map(({ doc: d }, i) => {
          const isRelevant = i < 4 && totalChars < MAX_TOTAL_CHARS; // top 4 con contenido
          const contenido = d.contenido ?? '';
          let preview = ' (sin contenido)';
          if (isRelevant && contenido.length > 0) {
            const chars = Math.min(contenido.length, MAX_DOC_CHARS, MAX_TOTAL_CHARS - totalChars);
            preview = `\n\`\`\`\n${contenido.slice(0, chars)}${contenido.length > chars ? '\n...[truncado]' : ''}\n\`\`\``;
            totalChars += chars;
          } else if (!isRelevant && contenido.length > 0) {
            preview = ` (${contenido.length} chars — no incluido en contexto)`;
          }
          return `[ID: ${d.id}] "${d.nombre}" (tipo: ${d.tipo_documento ?? 'nota'})${preview}`;
        }).join('\n\n');

    // Leer archivos adjuntos con texto extraído
    const { data: archivosData } = await supabase
      .from('archivos')
      .select('nombre, texto_extraido, mime_type')
      .eq(contextoTipo === 'reunion' ? 'reunion_id' : 'expediente_id', contextoId)
      .not('texto_extraido', 'is', null);

    const archivosContext = archivosData && archivosData.length > 0
      ? `\n\n## ARCHIVOS ADJUNTOS (contenido extraído)\n` +
        archivosData.map(a => `### 📎 ${a.nombre}\n${a.texto_extraido}`).join('\n\n')
      : '';

    const systemPrompt = AGENT_SYSTEM_PROMPT + expedienteContext + docsIndex + archivosContext + (context ? `\n\n## CONTEXTO DE DOCUMENTOS SELECCIONADOS\n${context}` : '');

    // Añadir hint si el mensaje parece pedir generación de contenido
    const contentKeywords = /redact|escrib|generat|prepar|crea|elabor|haz|hace|desarrolla|hace\s+un|resume|resume|acta|informe|nota|document/i;
    const needsActionHint = contentKeywords.test(message);
    const userContent = needsActionHint
      ? `${message}\n\n[SISTEMA: Esta petición requiere crear o editar un documento. Responde EXCLUSIVAMENTE con el JSON de acciones.]`
      : message;

    // Construir mensajes
    const messages: Message[] = [
      ...history.slice(-6).map(h => ({
        role: h.role as 'user' | 'assistant',
        content: h.content,
      })),
      { role: 'user', content: userContent },
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
    const anyErr = error as { response?: { data?: { error?: { message?: string } } } };
    if (anyErr?.response?.data?.error?.message) errorMessage = anyErr.response.data.error.message;

    return NextResponse.json({ error: errorMessage, error_code: 'unknown' }, { status: 500 });
  }
}
