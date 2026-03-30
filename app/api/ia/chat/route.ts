import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOrCreateToolConfig, getProviderConfig } from '@/lib/db/ia-config';
import { createProvider } from '@/lib/ai/providers/factory';
import { withRetry } from '@/lib/utils/ai-retry';
import type { Message } from '@/lib/ai/providers/base';

// ─── Seleccionar proveedor con fallback a variables de entorno ────────────────

async function resolveProvider(userId: string) {
  // 1. Config en DB (prioridad: anthropic → google → openai)
  for (const prov of ['anthropic', 'google', 'openai'] as const) {
    const dbConfig = await getProviderConfig(userId, prov);
    if (dbConfig?.enabled && dbConfig.api_key) {
      return createProvider({ provider: prov, apiKey: dbConfig.api_key, enabled: true });
    }
  }

  // 2. Variables de entorno (fallback cuando no hay config en DB)
  if (process.env.ANTHROPIC_API_KEY) {
    return createProvider({ provider: 'anthropic', apiKey: process.env.ANTHROPIC_API_KEY, enabled: true });
  }
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
    return createProvider({
      provider: 'google',
      apiKey: (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)!,
      enabled: true,
    });
  }
  if (process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes('tu_openai')) {
    return createProvider({ provider: 'openai', apiKey: process.env.OPENAI_API_KEY, enabled: true });
  }

  return null;
}

// ─── POST /api/ia/chat ────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const provider = await resolveProvider(user.id);
    if (!provider) {
      return NextResponse.json(
        { error: 'No hay proveedor de IA configurado. Ve a Ajustes → IA y añade una API key de Anthropic o Google.' },
        { status: 503 }
      );
    }

    const { contextoId, contextoTipo, mensaje, documentosReferenciados, historial } = await request.json();

    if (!contextoId || !contextoTipo || !mensaje) {
      return NextResponse.json(
        { error: 'Faltan parámetros: contextoId, contextoTipo, mensaje' },
        { status: 400 }
      );
    }

    // Config de herramienta (modelo, temperatura, system prompt personalizado)
    const toolConfig = await getOrCreateToolConfig(user.id, 'notebook');

    // Contexto del expediente/reunión
    const contexto = await recopilarContexto(supabase, contextoId, contextoTipo, documentosReferenciados);

    // System prompt: config del usuario + contexto dinámico del expediente
    const systemPrompt = (toolConfig.systemPrompt ?? '') + '\n\n' + buildContextSection(contexto);

    // Historial de mensajes
    const messages: Message[] = [
      ...(historial ?? []).map((h: { role: string; content: string }) => ({
        role: h.role as 'user' | 'assistant',
        content: h.content,
      })),
      { role: 'user', content: mensaje },
    ];

    // Llamada con retry automático ante errores transitorios
    const result = await withRetry(() =>
      provider.complete(messages, {
        model: toolConfig.model || 'claude-sonnet-4-6',
        temperature: toolConfig.temperature ?? 0.7,
        maxTokens: toolConfig.maxTokens ?? 2048,
        systemPrompt,
      })
    );

    // Guardar interacción (no bloqueante)
    supabase.from('ia_interacciones').insert({
      tipo: 'chat',
      contexto_id: contextoId,
      contexto_tipo: contextoTipo,
      prompt: mensaje,
      respuesta: result.content,
      documentos_usados: documentosReferenciados || [],
      modelo: result.model,
      tokens_usados: result.tokensUsed,
    }).then();

    const sugerirDocumento =
      result.content.length > 500 &&
      /genera|crea|redacta|elabora|prepara/i.test(mensaje);

    return NextResponse.json({
      respuesta: result.content,
      sugerirDocumento,
      nombreSugerido: detectarNombreDocumento(mensaje),
      tokensUsados: result.tokensUsed,
      modelo: result.model,
      proveedor: result.provider,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error al procesar la solicitud';
    console.error('[/api/ia/chat]', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function recopilarContexto(
  supabase: Awaited<ReturnType<typeof createClient>>,
  contextoId: string,
  contextoTipo: string,
  documentosReferenciados?: string[]
) {
  const contexto: Record<string, unknown> = { tipo: contextoTipo };

  if (contextoTipo === 'reunion') {
    const { data: reunion } = await supabase
      .from('reuniones')
      .select('titulo, tipo, estado, objetivo, notas, cliente:cliente_nif(nombre_normalizado, nif, actividad)')
      .eq('id', contextoId)
      .single();
    if (reunion) contexto.reunion = reunion;
  } else {
    const { data: expediente } = await supabase
      .from('expediente')
      .select('numero_bdns, estado, cliente:nif(nombre_normalizado, nif, actividad, tamano_empresa, ciudad)')
      .eq('id', contextoId)
      .single();
    if (expediente) contexto.expediente = expediente;
  }

  let docsQuery = supabase
    .from('documentos')
    .select('id, nombre, contenido, tipo_documento')
    .eq(contextoTipo === 'reunion' ? 'reunion_id' : 'expediente_id', contextoId)
    .order('orden');

  if (documentosReferenciados?.length) {
    docsQuery = docsQuery.in('id', documentosReferenciados);
  }

  const { data: documentos } = await docsQuery;
  contexto.documentos = documentos || [];

  const { data: archivos } = await supabase
    .from('archivos')
    .select('nombre, texto_extraido')
    .eq(contextoTipo === 'reunion' ? 'reunion_id' : 'expediente_id', contextoId)
    .not('texto_extraido', 'is', null)
    .limit(5);
  contexto.archivos = archivos || [];

  return contexto;
}

function buildContextSection(contexto: Record<string, unknown>): string {
  const lines: string[] = ['---', 'CONTEXTO:'];

  const exp = contexto.expediente as Record<string, unknown> | undefined;
  const reunion = contexto.reunion as Record<string, unknown> | undefined;
  const clienteArr = (exp?.cliente ?? reunion?.cliente) as Record<string, unknown>[] | undefined;
  const cliente = clienteArr?.[0];

  if (cliente) {
    lines.push(`Cliente: ${cliente.nombre_normalizado} (NIF: ${cliente.nif})`);
    if (cliente.actividad) lines.push(`Actividad: ${cliente.actividad}`);
    if (cliente.tamano_empresa) lines.push(`Tamaño empresa: ${cliente.tamano_empresa}`);
    if (cliente.ciudad) lines.push(`Ubicación: ${cliente.ciudad}`);
  }

  if (exp?.numero_bdns) lines.push(`BDNS: ${exp.numero_bdns}`);
  if (exp?.estado) lines.push(`Estado: ${exp.estado}`);

  if (reunion) {
    const r = reunion as Record<string, unknown>;
    if (r.titulo) lines.push(`Reunión: ${r.titulo}`);
    if (r.objetivo) lines.push(`Objetivo: ${r.objetivo}`);
    if (r.notas) lines.push(`Notas: ${String(r.notas).substring(0, 300)}`);
  }

  const docs = contexto.documentos as Array<Record<string, unknown>>;
  if (docs?.length) {
    lines.push('', 'DOCUMENTOS:');
    for (const doc of docs) {
      lines.push(`[${doc.id}] ${doc.nombre} (${doc.tipo_documento ?? 'sin tipo'})`);
      if (doc.contenido) {
        lines.push(String(doc.contenido).substring(0, 500) + '…');
      }
    }
  }

  const archivos = contexto.archivos as Array<Record<string, unknown>>;
  if (archivos?.length) {
    lines.push('', 'ARCHIVOS:');
    for (const arch of archivos) {
      lines.push(`${arch.nombre}: ${String(arch.texto_extraido ?? '').substring(0, 600)}…`);
    }
  }

  lines.push('---');
  return lines.join('\n');
}

function detectarNombreDocumento(mensaje: string): string {
  const kw: Record<string, string> = {
    resumen: 'Resumen ejecutivo',
    checklist: 'Checklist',
    email: 'Email',
    memoria: 'Memoria del proyecto',
    informe: 'Informe',
    análisis: 'Análisis',
    análisi: 'Análisis',
    búsqueda: 'Búsqueda profunda',
    cronograma: 'Cronograma',
    presupuesto: 'Presupuesto desglosado',
  };
  const lower = mensaje.toLowerCase();
  for (const [palabra, nombre] of Object.entries(kw)) {
    if (lower.includes(palabra)) return nombre;
  }
  return 'Documento IA';
}
