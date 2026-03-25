/**
 * POST /api/portal/preguntas
 *
 * Genera un cuestionario de encaje personalizado para una subvención concreta.
 * Las preguntas son específicas al contenido de la convocatoria:
 *   - Preguntas de encaje (requisitos que la empresa debe cumplir)
 *   - Preguntas de proyecto (qué hará la empresa con el dinero)
 *   - Preguntas de documentación (qué tiene que preparar)
 *
 * Requiere usuario autenticado (cliente o admin).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

interface PreguntaIA {
  id: string;
  tipo: 'si_no' | 'texto_corto' | 'texto_largo' | 'numero';
  categoria: 'encaje' | 'proyecto' | 'empresa' | 'documentacion';
  pregunta: string;
  contexto: string | null;
  obligatoria: boolean;
}

const PROMPT_SISTEMA = `Eres un experto en subvenciones y ayudas públicas españolas. Tu tarea es generar preguntas específicas para evaluar si una empresa encaja con una convocatoria concreta y recopilar la información necesaria para preparar su solicitud.`;

function buildPrompt(subv: Record<string, unknown>): string {
  return `Analiza esta convocatoria y genera entre 6 y 9 preguntas para el solicitante.

CONVOCATORIA:
- Título: ${subv.titulo ?? 'N/D'}
- Organismo: ${subv.organismo ?? 'N/D'}
- Objeto: ${subv.objeto ?? 'N/D'}
- Beneficiarios: ${JSON.stringify(subv.beneficiarios ?? [])}
- Requisitos: ${JSON.stringify(subv.requisitos ?? [])}
- Gastos subvencionables: ${JSON.stringify(subv.gastos_subvencionables ?? [])}
- Documentación exigida: ${JSON.stringify(subv.documentacion_exigida ?? [])}
- Importe máximo: ${subv.importe_maximo ?? 'No especificado'} €
- Plazo fin: ${subv.plazo_fin ?? 'No especificado'}

TIPOS DE PREGUNTAS A GENERAR:
1. "encaje" (si_no): Verificar que la empresa cumple requisitos de la convocatoria. Basadas en los requisitos reales del documento.
2. "proyecto" (texto_largo): Qué proyecto concreto hará la empresa con esta ayuda. Mínimo 2 preguntas de este tipo.
3. "empresa" (texto_corto o numero): Datos de la empresa relevantes para esta convocatoria (empleados, facturación, sector si no está claro).
4. "documentacion" (si_no o texto_corto): Si tienen disponible documentación crítica de la convocatoria.

REGLAS:
- Las preguntas de "encaje" deben ser sobre requisitos REALES de esta convocatoria, no genéricas.
- Las preguntas de "proyecto" deben ser específicas: si es sobre digitalización, preguntar qué tecnología van a implementar. Si es construcción, qué obra. Si es I+D, qué investigación.
- El "contexto" debe explicar por qué se pregunta esto (para que el solicitante entienda la relevancia).
- Máximo 2 preguntas genéricas (Hacienda/SS al día, antigüedad empresa).

Devuelve SOLO el JSON array, sin texto antes ni después:

[
  {
    "id": "q1",
    "tipo": "si_no",
    "categoria": "encaje",
    "pregunta": "Texto de la pregunta",
    "contexto": "Por qué se pregunta esto",
    "obligatoria": true
  }
]`;
}

async function llamarIA(prompt: string, iaConfig: { provider: string; apiKey: string; baseUrl?: string }): Promise<string> {
  if (iaConfig.provider === 'google') {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${iaConfig.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          systemInstruction: { parts: [{ text: PROMPT_SISTEMA }] },
          generationConfig: { temperature: 0.3, maxOutputTokens: 2000 },
        }),
        signal: AbortSignal.timeout(30_000),
      }
    );
    const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  }

  // OpenAI-compatible (OpenAI, OpenRouter, etc.)
  const baseUrl = iaConfig.baseUrl ?? 'https://api.openai.com/v1';
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${iaConfig.apiKey}` },
    body: JSON.stringify({
      model: iaConfig.provider === 'anthropic' ? 'claude-haiku-4-5-20251001' : 'gpt-4o-mini',
      messages: [
        { role: 'system', content: PROMPT_SISTEMA },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? '';
}

function parsearPreguntas(raw: string): PreguntaIA[] {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fence ? fence[1] : raw).trim();
  const jsonMatch = candidate.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return preguntasFallback();
  try {
    const parsed = JSON.parse(jsonMatch[0]) as PreguntaIA[];
    if (!Array.isArray(parsed) || parsed.length === 0) return preguntasFallback();
    return parsed;
  } catch {
    return preguntasFallback();
  }
}

function preguntasFallback(): PreguntaIA[] {
  return [
    { id: 'q1', tipo: 'si_no', categoria: 'encaje', pregunta: '¿Tiene su empresa más de 1 año de actividad?', contexto: 'Requisito básico para la mayoría de convocatorias', obligatoria: true },
    { id: 'q2', tipo: 'si_no', categoria: 'encaje', pregunta: '¿Está al corriente de pago con Hacienda y Seguridad Social?', contexto: 'Obligatorio para obtener cualquier subvención pública', obligatoria: true },
    { id: 'q3', tipo: 'si_no', categoria: 'encaje', pregunta: '¿No tiene ninguna subvención de la misma convocatoria activa actualmente?', contexto: 'Incompatibilidad habitual en convocatorias públicas', obligatoria: true },
    { id: 'q4', tipo: 'texto_largo', categoria: 'proyecto', pregunta: '¿Para qué utilizaría exactamente esta subvención? Describe el proyecto o inversión que realizaría.', contexto: 'Esta información es clave para la memoria justificativa de la solicitud', obligatoria: true },
    { id: 'q5', tipo: 'texto_corto', categoria: 'proyecto', pregunta: '¿Qué resultado espera obtener con este proyecto?', contexto: 'Los resultados esperados deben incluirse en la solicitud', obligatoria: true },
    { id: 'q6', tipo: 'si_no', categoria: 'documentacion', pregunta: '¿Tiene capacidad para aportar toda la documentación requerida en los plazos indicados?', contexto: 'El incumplimiento de plazos causa la inadmisión de la solicitud', obligatoria: true },
  ];
}

export async function POST(request: NextRequest) {
  // Verificar autenticación básica
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.subvencion_id) return NextResponse.json({ error: 'subvencion_id requerido' }, { status: 400 });

  const sb = createServiceClient();

  // Obtener datos completos de la subvención
  const { data: subv } = await sb
    .from('subvenciones')
    .select('titulo, organismo, objeto, beneficiarios, requisitos, gastos_subvencionables, documentacion_exigida, importe_maximo, plazo_fin, resumen_ia, para_quien')
    .eq('id', body.subvencion_id)
    .maybeSingle();

  if (!subv) return NextResponse.json({ error: 'Subvención no encontrada' }, { status: 404 });

  // Si no hay datos IA (sin PDF procesado), devolver fallback directamente
  if (!subv.objeto && !subv.requisitos && !subv.documentacion_exigida) {
    return NextResponse.json({ preguntas: preguntasFallback(), fuente: 'fallback' });
  }

  // Obtener configuración IA
  const { data: iaProvider } = await sb
    .from('ia_providers')
    .select('provider, api_key, base_url')
    .eq('enabled', true)
    .not('api_key', 'is', null)
    .limit(1)
    .maybeSingle();

  if (!iaProvider?.api_key) {
    return NextResponse.json({ preguntas: preguntasFallback(), fuente: 'fallback_no_ia' });
  }

  try {
    const prompt = buildPrompt(subv as Record<string, unknown>);
    const rawResponse = await llamarIA(prompt, {
      provider: iaProvider.provider,
      apiKey: iaProvider.api_key,
      baseUrl: iaProvider.base_url ?? undefined,
    });
    const preguntas = parsearPreguntas(rawResponse);
    return NextResponse.json({ preguntas, fuente: 'ia' });
  } catch (err) {
    console.error('[preguntas] Error IA:', err);
    return NextResponse.json({ preguntas: preguntasFallback(), fuente: 'fallback_error' });
  }
}
