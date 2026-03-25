/**
 * GET  /api/portal/gestor  — carga mensajes del cliente autenticado
 * POST /api/portal/gestor  — envía mensaje y genera respuesta IA contextual
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

async function getClienteNif(): Promise<{ user: { id: string; email?: string | null }; nif: string } | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const sb = createServiceClient();
  const { data: perfil } = await sb
    .from('perfiles').select('nif').eq('id', user.id).maybeSingle();

  if (!perfil?.nif) return null;
  return { user, nif: perfil.nif };
}

async function generarRespuestaIA(
  nif: string,
  mensajeCliente: string,
  historial: Array<{ remitente: string; contenido: string }>,
  iaProvider: { provider: string; api_key: string; base_url?: string | null }
): Promise<string> {
  const sb = createServiceClient();

  // Cargar contexto del cliente
  const [{ data: cliente }, { data: matches }, { data: solicitudes }] = await Promise.all([
    sb.from('cliente')
      .select('nombre_empresa, actividad, cnae_descripcion, tamano_empresa, comunidad_autonoma, num_empleados')
      .eq('nif', nif).maybeSingle(),
    sb.from('cliente_subvencion_match')
      .select('score, motivos, estado, subvencion:subvenciones(titulo, organismo, importe_maximo, plazo_fin, estado_convocatoria)')
      .eq('nif', nif).eq('es_hard_exclude', false).gte('score', 0.3)
      .order('score', { ascending: false }).limit(5),
    sb.from('solicitudes')
      .select('estado, created_at, subvencion:subvenciones(titulo)')
      .eq('nif', nif).order('created_at', { ascending: false }).limit(5),
  ]);

  const contextoEmpresa = cliente
    ? `Empresa: ${cliente.nombre_empresa ?? 'N/D'}, Sector: ${cliente.actividad ?? cliente.cnae_descripcion ?? 'N/D'}, CCAA: ${cliente.comunidad_autonoma ?? 'N/D'}, Tamaño: ${cliente.tamano_empresa ?? 'N/D'}`
    : 'Datos de empresa no disponibles';

  const subvencionesTexto = (matches ?? []).map((m: Record<string, unknown>) => {
    const s = m.subvencion as Record<string, unknown> | null;
    return `- ${s?.titulo ?? 'N/D'} (${s?.organismo ?? ''}) — ${s?.estado_convocatoria ?? ''}, hasta ${s?.importe_maximo ? `${Number(s.importe_maximo).toLocaleString('es-ES')} €` : 'importe no definido'}`;
  }).join('\n') || 'No hay subvenciones disponibles actualmente';

  const solicitudesTexto = (solicitudes ?? []).map((s: Record<string, unknown>) => {
    const sv = s.subvencion as Record<string, unknown> | null;
    return `- ${sv?.titulo ?? 'N/D'}: estado "${s.estado}"`;
  }).join('\n') || 'Sin solicitudes activas';

  const historialTexto = historial.slice(-6).map(m =>
    `${m.remitente === 'cliente' ? 'Cliente' : 'Gestor'}: ${m.contenido}`
  ).join('\n');

  const sistemPrompt = `Eres el gestor virtual de AyudaPyme, empresa especializada en conseguir subvenciones para pymes españolas. Ayudas al cliente de forma amigable, cercana y directa.

DATOS DEL CLIENTE:
${contextoEmpresa}

SUBVENCIONES DETECTADAS PARA SU EMPRESA:
${subvencionesTexto}

SOLICITUDES ACTIVAS:
${solicitudesTexto}

INSTRUCCIONES:
- Responde en español, de forma breve y útil (máximo 3-4 frases)
- Si el cliente pregunta por el estado de algo, usa los datos anteriores
- Si preguntan algo muy técnico o jurídico específico, di que un gestor humano le contactará pronto
- Sé proactivo: si hay subvenciones buenas detectadas, mencionarlas si viene al caso
- Nunca inventes datos concretos (cifras, fechas) que no tengas
- Firma siempre como "Tu equipo de AyudaPyme"`;

  const prompt = historialTexto
    ? `Historial previo:\n${historialTexto}\n\nNuevo mensaje del cliente: ${mensajeCliente}`
    : mensajeCliente;

  try {
    if (iaProvider.provider === 'google') {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${iaProvider.api_key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            systemInstruction: { parts: [{ text: sistemPrompt }] },
            generationConfig: { temperature: 0.7, maxOutputTokens: 500 },
          }),
          signal: AbortSignal.timeout(20_000),
        }
      );
      const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    } else {
      const baseUrl = iaProvider.base_url ?? 'https://api.openai.com/v1';
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${iaProvider.api_key}` },
        body: JSON.stringify({
          model: iaProvider.provider === 'anthropic' ? 'claude-haiku-4-5-20251001' : 'gpt-4o-mini',
          messages: [
            { role: 'system', content: sistemPrompt },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7, max_tokens: 400,
        }),
        signal: AbortSignal.timeout(20_000),
      });
      const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
      return data.choices?.[0]?.message?.content?.trim() ?? '';
    }
  } catch {
    return 'Gracias por tu mensaje. Un gestor de nuestro equipo te responderá en breve. Tu equipo de AyudaPyme';
  }
}

export async function GET() {
  const auth = await getClienteNif();
  if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const sb = createServiceClient();
  const { data: mensajes, error } = await sb
    .from('mensajes_gestor')
    .select('id, remitente, contenido, leido, created_at')
    .eq('nif', auth.nif)
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Marcar como leídos los mensajes del gestor/IA que el cliente no ha visto
  await sb.from('mensajes_gestor')
    .update({ leido: true })
    .eq('nif', auth.nif)
    .in('remitente', ['gestor', 'ia'])
    .eq('leido', false);

  return NextResponse.json({ mensajes: mensajes ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await getClienteNif();
  if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const contentType = request.headers.get('content-type') ?? '';
  let contenido = '';
  let adjuntoNombre: string | null = null;

  if (contentType.includes('multipart/form-data')) {
    const fd = await request.formData().catch(() => null);
    contenido = (fd?.get('contenido') as string | null)?.trim() ?? '';
    const adjunto = fd?.get('adjunto') as File | null;
    if (adjunto) adjuntoNombre = adjunto.name;
    if (!contenido && adjuntoNombre) contenido = `[Archivo adjunto: ${adjuntoNombre}]`;
  } else {
    const body = await request.json().catch(() => null);
    contenido = body?.contenido?.trim() ?? '';
  }

  if (!contenido) {
    return NextResponse.json({ error: 'contenido requerido' }, { status: 400 });
  }

  const sb = createServiceClient();

  // Guardar mensaje del cliente
  await sb.from('mensajes_gestor').insert({
    nif: auth.nif,
    remitente: 'cliente',
    contenido,
    leido: false,
    ...(adjuntoNombre ? { metadata: { adjunto_nombre: adjuntoNombre } } : {}),
  });

  // Cargar historial para contexto IA
  const { data: historial } = await sb
    .from('mensajes_gestor')
    .select('remitente, contenido')
    .eq('nif', auth.nif)
    .order('created_at', { ascending: false })
    .limit(10);

  // Generar respuesta IA en background si hay proveedor configurado
  const { data: iaProvider } = await sb
    .from('ia_providers')
    .select('provider, api_key, base_url')
    .eq('enabled', true)
    .not('api_key', 'is', null)
    .limit(1)
    .maybeSingle();

  if (iaProvider?.api_key) {
    const historialOrdenado = [...(historial ?? [])].reverse();
    const respuesta = await generarRespuestaIA(
      auth.nif,
      contenido,
      historialOrdenado,
      { provider: iaProvider.provider, api_key: iaProvider.api_key, base_url: iaProvider.base_url }
    );
    if (respuesta) {
      await sb.from('mensajes_gestor').insert({
        nif: auth.nif,
        remitente: 'ia',
        contenido: respuesta,
        leido: false,
      });
    }
  }

  // Devolver todos los mensajes actualizados
  const { data: mensajes } = await sb
    .from('mensajes_gestor')
    .select('id, remitente, contenido, leido, created_at')
    .eq('nif', auth.nif)
    .order('created_at', { ascending: true })
    .limit(100);

  return NextResponse.json({ mensajes: mensajes ?? [] });
}
