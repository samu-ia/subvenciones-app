import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOrCreateToolConfig, getProviderConfig } from '@/lib/db/ia-config';
import { createProvider } from '@/lib/ai/providers/factory';
import { withRetry } from '@/lib/utils/ai-retry';

// ─── Seleccionar proveedor con fallback env-vars ──────────────────────────────

async function resolveProvider(userId: string, tool: 'summary' | 'checklist' | 'email' | 'notebook') {
  const toolConfig = await getOrCreateToolConfig(userId, tool);

  const dbConfig = await getProviderConfig(userId, toolConfig.provider);
  if (dbConfig?.enabled && dbConfig.api_key) {
    return { provider: createProvider({ provider: toolConfig.provider, apiKey: dbConfig.api_key, enabled: true }), toolConfig };
  }

  // Fallback env vars
  for (const [prov, key] of [
    ['anthropic', process.env.ANTHROPIC_API_KEY],
    ['google', process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY],
    ['openai', process.env.OPENAI_API_KEY],
  ] as const) {
    if (key && !key.includes('tu_openai') && !key.includes('aqui')) {
      return { provider: createProvider({ provider: prov, apiKey: key, enabled: true }), toolConfig };
    }
  }

  return null;
}

// ─── Prompts por tipo de documento ───────────────────────────────────────────

function buildPrompt(tipo: string, contexto: Record<string, unknown>, promptCustom?: string) {
  const clienteArr = contexto.cliente as Record<string, unknown>[] | undefined;
  const cliente = clienteArr?.[0];
  const clienteInfo = cliente
    ? [
        `Cliente: ${cliente.nombre_normalizado} (NIF: ${cliente.nif})`,
        cliente.actividad ? `Actividad: ${cliente.actividad}` : '',
        cliente.tamano_empresa ? `Tamaño: ${cliente.tamano_empresa}` : '',
        cliente.ciudad ? `Ubicación: ${cliente.ciudad}` : '',
      ].filter(Boolean).join('\n')
    : '';

  const docsInfo = (contexto.documentos as Array<Record<string, unknown>> | undefined)
    ?.map((d) => `- ${d.nombre}: ${String(d.contenido ?? '').substring(0, 300)}`)
    .join('\n') ?? '';

  const base = [clienteInfo, docsInfo ? `\nDOCUMENTOS:\n${docsInfo}` : ''].join('\n').trim();

  const configs: Record<string, { system: string; user: string; nombre: string }> = {
    resumen: {
      system: `Eres un experto en gestión de subvenciones que crea resúmenes ejecutivos.\n${base}`,
      user: 'Crea un resumen ejecutivo con: estado actual, importes, plazos clave, documentación pendiente y próximos pasos. Usa Markdown.',
      nombre: 'Resumen Ejecutivo',
    },
    checklist: {
      system: `Eres un experto en tramitación de subvenciones.\n${base}`,
      user: 'Genera un checklist exhaustivo organizado por fases: Preparación → Presentación → Seguimiento → Justificación. Usa checkboxes [ ] en Markdown.',
      nombre: 'Checklist de Tramitación',
    },
    email: {
      system: `Eres redactor profesional de comunicaciones sobre subvenciones.\n${base}`,
      user: 'Redacta un email profesional de seguimiento al cliente: estado del expediente y próximos pasos. Tono formal pero cercano.',
      nombre: 'Email de Seguimiento',
    },
    memoria: {
      system: `Eres experto en redacción de memorias técnicas para subvenciones públicas españolas.\n${base}`,
      user: promptCustom || 'Redacta una memoria técnica completa: descripción del proyecto, objetivos, metodología, presupuesto estimado y resultados esperados.',
      nombre: 'Memoria Técnica',
    },
    busqueda_profunda: {
      system: `Eres investigador especializado en subvenciones y ayudas públicas para empresas españolas.\n${base}`,
      user: promptCustom || 'Analiza todas las subvenciones disponibles para este cliente (estatales, autonómicas, europeas). Para cada una: nombre, organismo, importe máximo, plazo y encaje con el cliente.',
      nombre: `Búsqueda de Subvenciones — ${new Date().toLocaleDateString('es-ES')}`,
    },
  };

  return configs[tipo] ?? configs.resumen;
}

// ─── POST /api/ia/generar ─────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { contextoId, contextoTipo, tipo, prompt, nombreDocumento } = await request.json();

    if (!contextoId || !contextoTipo || !tipo) {
      return NextResponse.json({ error: 'Faltan parámetros: contextoId, contextoTipo, tipo' }, { status: 400 });
    }

    const toolMap: Record<string, 'summary' | 'checklist' | 'email' | 'notebook'> = {
      resumen: 'summary',
      checklist: 'checklist',
      email: 'email',
    };
    const tool = toolMap[tipo] ?? 'notebook';

    const resolved = await resolveProvider(user.id, tool);
    if (!resolved) {
      return NextResponse.json(
        { error: 'No hay proveedor de IA configurado. Ve a Ajustes → IA y añade una API key.' },
        { status: 503 }
      );
    }
    const { provider, toolConfig } = resolved;

    const contexto = await recopilarContexto(supabase, contextoId, contextoTipo);
    const prompts = buildPrompt(tipo, contexto, prompt);

    const result = await withRetry(() =>
      provider.complete(
        [{ role: 'user', content: prompts.user }],
        {
          model: toolConfig.model || 'claude-sonnet-4-6',
          temperature: Math.min(toolConfig.temperature ?? 0.5, 0.6),
          maxTokens: toolConfig.maxTokens ?? 4096,
          systemPrompt: prompts.system,
        }
      )
    );

    const contenido = result.content;

    // Guardar documento
    const documentoData: Record<string, unknown> = {
      nombre: nombreDocumento || prompts.nombre,
      contenido,
      tipo_documento: tipo,
      generado_por_ia: true,
      orden: 999,
      [contextoTipo === 'reunion' ? 'reunion_id' : 'expediente_id']: contextoId,
    };

    // NIF del contexto
    const nifQuery = contextoTipo === 'reunion'
      ? supabase.from('reuniones').select('cliente_nif').eq('id', contextoId).single()
      : supabase.from('expediente').select('nif').eq('id', contextoId).single();
    const { data: nifData } = await nifQuery;
    if (nifData) {
      documentoData.nif = (nifData as Record<string, string>).cliente_nif
        ?? (nifData as Record<string, string>).nif;
    }

    const { data: nuevoDoc, error: docError } = await supabase
      .from('documentos')
      .insert(documentoData)
      .select()
      .single();

    if (docError) throw new Error(`Error guardando documento: ${docError.message}`);

    supabase.from('ia_interacciones').insert({
      tipo: 'generacion',
      contexto_id: contextoId,
      contexto_tipo: contextoTipo,
      prompt: prompt || prompts.user,
      respuesta: contenido,
      modelo: result.model,
      tokens_usados: result.tokensUsed,
      metadata: { tipo_generacion: tipo, documento_id: nuevoDoc.id },
    }).then();

    return NextResponse.json({
      success: true,
      documento: nuevoDoc,
      contenido,
      tokensUsados: result.tokensUsed,
      modelo: result.model,
      proveedor: result.provider,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error al generar documento';
    console.error('[/api/ia/generar]', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function recopilarContexto(
  supabase: Awaited<ReturnType<typeof createClient>>,
  contextoId: string,
  contextoTipo: string
) {
  const contexto: Record<string, unknown> = {};

  const table = contextoTipo === 'reunion' ? 'reuniones' : 'expediente';
  const clienteJoin = contextoTipo === 'reunion'
    ? 'cliente:cliente_nif(nombre_normalizado, nif, actividad, tamano_empresa, ciudad)'
    : 'cliente:nif(nombre_normalizado, nif, actividad, tamano_empresa, ciudad)';

  const { data } = await supabase
    .from(table)
    .select(`*, ${clienteJoin}`)
    .eq('id', contextoId)
    .single();

  if (data) {
    Object.assign(contexto, data);
    contexto.cliente = data.cliente;
  }

  const docsCol = contextoTipo === 'reunion' ? 'reunion_id' : 'expediente_id';
  const { data: documentos } = await supabase
    .from('documentos')
    .select('nombre, contenido, tipo_documento')
    .eq(docsCol, contextoId)
    .order('orden')
    .limit(10);
  contexto.documentos = documentos || [];

  const { data: notas } = await supabase
    .from('notas')
    .select('contenido, created_at')
    .eq(contextoTipo === 'expediente' ? 'expediente_id' : 'nif', contextoId)
    .order('created_at', { ascending: false })
    .limit(5);
  contexto.notas = notas || [];

  return contexto;
}
