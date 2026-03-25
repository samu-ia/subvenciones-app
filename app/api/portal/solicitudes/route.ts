/**
 * POST /api/portal/solicitudes
 *
 * Crea una solicitud desde el portal del cliente con:
 *   - Respuestas al cuestionario IA
 *   - Datos del contrato (firmante, aceptación)
 *   - Método de pago
 *
 * Genera el informe de viabilidad en background.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

const PROMPT_INFORME = `Eres un consultor experto en subvenciones públicas españolas.
Genera un informe de viabilidad claro, práctico y profesional para una empresa que quiere solicitar una subvención.
El tono debe ser directo y útil para el gestor y para el cliente.`;

function buildInformePrompt(subv: Record<string, unknown>, cliente: Record<string, unknown>, respuestas: Array<{pregunta: string; respuesta: unknown; tipo: string}>): string {
  const respuestasTexto = respuestas
    .map(r => `- ${r.pregunta}: ${r.tipo === 'si_no' ? (r.respuesta ? 'Sí' : 'No') : r.respuesta}`)
    .join('\n');

  return `Genera un informe de viabilidad para la siguiente solicitud de subvención.

CONVOCATORIA:
- Título: ${subv.titulo}
- Organismo: ${subv.organismo ?? 'N/D'}
- Importe máximo: ${subv.importe_maximo ? `${Number(subv.importe_maximo).toLocaleString('es-ES')} €` : 'No especificado'}
- Objeto: ${subv.objeto ?? 'No disponible'}
- Para quién: ${subv.para_quien ?? 'No especificado'}
- Requisitos: ${JSON.stringify(subv.requisitos ?? [])}
- Documentación exigida: ${JSON.stringify(subv.documentacion_exigida ?? [])}

EMPRESA SOLICITANTE:
- Nombre: ${cliente.nombre_empresa ?? 'No disponible'}
- Sector/Actividad: ${cliente.actividad ?? 'N/D'}
- Tamaño: ${cliente.tamano_empresa ?? 'N/D'}
- Comunidad Autónoma: ${cliente.comunidad_autonoma ?? 'N/D'}
- Empleados: ${cliente.num_empleados ?? 'N/D'}
- Facturación: ${cliente.facturacion_anual ? `${Number(cliente.facturacion_anual).toLocaleString('es-ES')} €` : 'N/D'}

RESPUESTAS AL CUESTIONARIO:
${respuestasTexto}

Genera el informe en formato JSON con esta estructura exacta:
{
  "puntuacion_encaje": 0-100,
  "resumen_ejecutivo": "2-3 frases resumiendo la oportunidad y su viabilidad",
  "puntos_fuertes": ["punto 1", "punto 2", "punto 3"],
  "puntos_atencion": ["riesgo o dificultad 1", "riesgo 2"],
  "documentacion_personalizada": [
    {"documento": "nombre", "estado": "disponible|pendiente|critico", "nota": "comentario"}
  ],
  "pasos_siguientes": ["paso 1 concreto", "paso 2", "paso 3"],
  "importe_estimado": number_o_null,
  "recomendacion": "proceder|revisar|desestimar",
  "recomendacion_motivo": "una frase"
}`;
}

async function generarInforme(
  solicitudId: string,
  subv: Record<string, unknown>,
  cliente: Record<string, unknown>,
  respuestas: Array<{pregunta: string; respuesta: unknown; tipo: string}>,
  iaConfig: { provider: string; apiKey: string; baseUrl?: string }
): Promise<void> {
  const sb = createServiceClient();
  try {
    const prompt = buildInformePrompt(subv, cliente, respuestas);

    let raw = '';
    if (iaConfig.provider === 'google') {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${iaConfig.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            systemInstruction: { parts: [{ text: PROMPT_INFORME }] },
            generationConfig: { temperature: 0.2, maxOutputTokens: 2000 },
          }),
          signal: AbortSignal.timeout(45_000),
        }
      );
      const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    } else {
      const baseUrl = iaConfig.baseUrl ?? 'https://api.openai.com/v1';
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${iaConfig.apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'system', content: PROMPT_INFORME }, { role: 'user', content: prompt }],
          temperature: 0.2, max_tokens: 2000,
        }),
        signal: AbortSignal.timeout(45_000),
      });
      const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
      raw = data.choices?.[0]?.message?.content ?? '';
    }

    const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = (fence ? fence[1] : raw).trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const informe = JSON.parse(jsonMatch[0]);
      await sb.from('solicitudes').update({ informe_viabilidad: JSON.stringify(informe) }).eq('id', solicitudId);
    }
  } catch (err) {
    console.error('[informe] Error generando informe:', err);
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.nif || !body?.subvencion_id) {
    return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 });
  }

  const sb = createServiceClient();

  // Preparar datos de la solicitud
  const solicitudData = {
    nif: body.nif,
    subvencion_id: body.subvencion_id,
    user_id: user.id,
    match_id: body.match_id ?? null,
    estado: 'activo',
    preguntas_ia: body.preguntas_ia ?? null,
    respuestas_ia: body.respuestas_ia ?? null,
    respuestas_encaje: body.respuestas_encaje ?? null,
    encaje_score: body.encaje_score ?? null,
    encaje_confirmado_at: new Date().toISOString(),
    porcentaje_exito: 15,
    nombre_firmante: body.nombre_firmante ?? null,
    dni_firmante: body.dni_firmante ?? null,
    contrato_firmado: body.contrato_firmado ?? false,
    contrato_firmado_at: body.contrato_firmado ? new Date().toISOString() : null,
    metodo_pago: body.metodo_pago ?? null,
    metodo_pago_ok: !!body.metodo_pago,
    metodo_pago_ok_at: body.metodo_pago ? new Date().toISOString() : null,
  };

  const { data: sol, error } = await sb
    .from('solicitudes')
    .upsert(solicitudData, { onConflict: 'nif,subvencion_id' })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Marcar match como interesado
  if (body.match_id) {
    await sb.from('cliente_subvencion_match').update({ estado: 'interesado' }).eq('id', body.match_id);
  }

  // Generar informe en background si hay respuestas
  if (body.respuestas_ia?.length) {
    const [{ data: subv }, { data: cliente }, { data: iaProvider }] = await Promise.all([
      sb.from('subvenciones').select('titulo, organismo, objeto, para_quien, requisitos, documentacion_exigida, importe_maximo').eq('id', body.subvencion_id).maybeSingle(),
      sb.from('cliente').select('nombre_empresa, actividad, tamano_empresa, comunidad_autonoma, num_empleados, facturacion_anual').eq('nif', body.nif).maybeSingle(),
      sb.from('ia_providers').select('provider, api_key, base_url').eq('enabled', true).not('api_key', 'is', null).limit(1).maybeSingle(),
    ]);

    if (subv && cliente && iaProvider?.api_key) {
      // Fire and forget
      generarInforme(
        sol.id,
        subv as Record<string, unknown>,
        cliente as Record<string, unknown>,
        body.respuestas_ia,
        { provider: iaProvider.provider, apiKey: iaProvider.api_key, baseUrl: iaProvider.base_url ?? undefined }
      ).catch(console.error);
    }
  }

  return NextResponse.json({ ok: true, id: sol.id });
}
