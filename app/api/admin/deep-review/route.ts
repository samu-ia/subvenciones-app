/**
 * POST /api/admin/deep-review
 * GET  /api/admin/deep-review?nif=B12345678
 *
 * POST: Lanza deep review en background para los top matches de un cliente.
 * GET:  Devuelve los deep reviews ya calculados para un cliente.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireAdminOrTramitador } from '@/lib/auth/helpers';

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const MODELO = 'gemini-2.5-flash';
const BDNS_BASE = 'https://www.infosubvenciones.es/bdnstrans/api';

function buildPrompt(cliente: Record<string, unknown>, subv: Record<string, unknown>): string {
  return `Analiza si esta empresa cumple los requisitos de esta convocatoria. Basa el análisis SOLO en el PDF adjunto.

EMPRESA:
- Nombre: ${cliente.nombre_empresa ?? cliente.nif}
- CNAE: ${cliente.cnae_codigo ?? 'N/D'} — ${cliente.cnae_descripcion ?? 'N/D'}
- Comunidad: ${cliente.comunidad_autonoma ?? 'N/D'} | Provincia: ${cliente.provincia ?? 'N/D'}
- Tamaño: ${cliente.tamano_empresa ?? 'N/D'} (${cliente.num_empleados ?? '?'} empleados)
- Facturación: ${cliente.facturacion_anual ? `${Number(cliente.facturacion_anual).toLocaleString('es-ES')} €` : 'N/D'}
- Antigüedad: ${cliente.anos_antiguedad ?? 'N/D'} años | Forma: ${cliente.forma_juridica ?? 'N/D'}

CONVOCATORIA: ${subv.titulo}
Organismo: ${subv.organismo ?? 'N/D'} | Importe: ${subv.importe_maximo ? `${Number(subv.importe_maximo).toLocaleString('es-ES')} €` : 'N/D'}

Devuelve SOLO JSON:
{
  "elegible": true|false|"parcial",
  "probabilidad": "alta"|"media"|"baja",
  "resumen": "2-3 frases clave",
  "requisitos": [{"requisito":"texto del PDF","cumple":true|false|"parcial"|"desconocido","nota":"breve"}],
  "documentacion_necesaria": ["doc 1"],
  "preguntas_para_cliente": ["pregunta concreta para la llamada"],
  "riesgos": ["riesgo o incompatibilidad"],
  "importe_estimado": number_o_null,
  "recomendacion": "proceder"|"verificar"|"descartar",
  "fuente_pdf": "fragmento textual clave del PDF"
}`;
}

async function descargarPdf(bdnsId: string, pdfUrl: string | null): Promise<Buffer | null> {
  const urls = [
    pdfUrl,
    `${BDNS_BASE}/convocatorias/pdf?id=${bdnsId}&vpd=GE`,
  ].filter(Boolean) as string[];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'AyudaPyme/2.0' },
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) continue;
      const ct = res.headers.get('content-type') ?? '';
      if (ct.includes('html') || ct.includes('text/')) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 500) continue;
      return buf;
    } catch { /* siguiente */ }
  }
  return null;
}

async function analizarConGemini(pdfBuffer: Buffer, prompt: string): Promise<Record<string, unknown>> {
  const base64 = pdfBuffer.toString('base64');
  const body = {
    contents: [{ role: 'user', parts: [
      { inlineData: { mimeType: 'application/pdf', data: base64 } },
      { text: prompt },
    ]}],
    systemInstruction: { parts: [{ text: 'Eres un consultor experto en subvenciones españolas. Solo devuelves JSON válido.' }] },
    generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
  };

  const res = await fetch(`${GEMINI_BASE}/models/${MODELO}:generateContent?key=${GEMINI_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error(`Gemini ${res.status}: ${(err?.error as Record<string,unknown>)?.message ?? 'error'}`);
  }
  const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!raw) throw new Error('Gemini vacío');
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fence ? fence[1] : raw).trim();
  const jsonMatch = candidate.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Sin JSON en respuesta');
  return JSON.parse(jsonMatch[0]);
}

// GET — devuelve deep reviews calculados para un cliente
export async function GET(request: NextRequest) {
  const auth = await requireAdminOrTramitador();
  if (auth instanceof NextResponse) return auth;

  const nif = new URL(request.url).searchParams.get('nif');
  if (!nif) return NextResponse.json({ error: 'nif requerido' }, { status: 400 });

  const sb = createServiceClient();
  const { data, error } = await sb
    .from('cliente_subvencion_match')
    .select(`
      id, score, deep_review, deep_review_at,
      subvencion:subvenciones(id, titulo, titulo_comercial, organismo, importe_maximo, plazo_fin, estado_convocatoria)
    `)
    .eq('nif', nif)
    .not('deep_review', 'is', null)
    .order('score', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ resultados: data ?? [] });
}

// POST — lanza deep review en background para top matches de un cliente
export async function POST(request: NextRequest) {
  const auth = await requireAdminOrTramitador();
  if (auth instanceof NextResponse) return auth;

  if (!GEMINI_KEY) return NextResponse.json({ error: 'GEMINI_API_KEY no configurada' }, { status: 500 });

  const body = await request.json().catch(() => null);
  const nif = body?.nif;
  const limitReq = Math.min(Number(body?.limit ?? 5), 10);
  const forzar = body?.forzar === true; // re-analizar aunque ya tenga deep_review

  if (!nif) return NextResponse.json({ error: 'nif requerido' }, { status: 400 });

  const sb = createServiceClient();

  // Cargar cliente
  const { data: cliente } = await sb.from('cliente')
    .select('nif,nombre_empresa,cnae_codigo,cnae_descripcion,comunidad_autonoma,provincia,tamano_empresa,forma_juridica,num_empleados,facturacion_anual,anos_antiguedad')
    .eq('nif', nif)
    .maybeSingle();

  if (!cliente) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });

  // Cargar matches pendientes
  let matchQuery = sb
    .from('cliente_subvencion_match')
    .select(`id, score, subvencion:subvenciones(id, bdns_id, titulo, organismo, importe_maximo, estado_convocatoria, plazo_fin, pdf_url)`)
    .eq('nif', nif)
    .gte('score', 0.4)
    .eq('es_hard_exclude', false)
    .order('score', { ascending: false })
    .limit(limitReq);

  if (!forzar) matchQuery = matchQuery.is('deep_review', null);

  const { data: matches } = await matchQuery;
  if (!matches?.length) {
    return NextResponse.json({ ok: true, procesados: 0, mensaje: 'Sin matches pendientes de deep review' });
  }

  // Procesar en background — respondemos inmediatamente
  (async () => {
    for (const match of matches) {
      const subv = match.subvencion as unknown as Record<string, unknown> | null;
      if (!subv) continue;
      try {
        const pdfUrl = subv.pdf_url as string | null;
        const bdnsId = String(subv.bdns_id ?? '');
        const pdfBuffer = await descargarPdf(bdnsId, pdfUrl);

        let review: Record<string, unknown>;
        if (!pdfBuffer) {
          review = {
            elegible: 'desconocido', probabilidad: 'media',
            resumen: 'PDF no disponible para análisis completo.',
            requisitos: [], documentacion_necesaria: [],
            preguntas_para_cliente: ['¿Tiene deudas con la Administración?', '¿Ha recibido ayudas de minimis en los últimos 3 años?'],
            riesgos: ['Sin PDF — análisis incompleto'],
            importe_estimado: null, recomendacion: 'verificar', sin_pdf: true,
          };
        } else {
          const prompt = buildPrompt(cliente as Record<string, unknown>, subv);
          review = await analizarConGemini(pdfBuffer, prompt);
        }

        await sb.from('cliente_subvencion_match').update({
          deep_review: { ...review, modelo: MODELO, analizado_at: new Date().toISOString() },
          deep_review_at: new Date().toISOString(),
        }).eq('id', match.id);

        await new Promise(r => setTimeout(r, 2000)); // rate limit
      } catch (err) {
        console.error(`[deep-review] Error match ${match.id}:`, err);
      }
    }
  })();

  return NextResponse.json({
    ok: true,
    procesados: matches.length,
    mensaje: `Analizando ${matches.length} matches en background. Consulta GET /api/admin/deep-review?nif=${nif} en unos minutos.`,
  });
}
