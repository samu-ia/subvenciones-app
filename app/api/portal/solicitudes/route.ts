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
import { sendTransactionalEmail } from '@/lib/email';

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
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${iaConfig.apiKey}`,
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
  if (!body?.subvencion_id) {
    return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 });
  }

  const sb = createServiceClient();

  // VULN-05: Obtener NIF del perfil del usuario (no del body) para prevenir IDOR
  const { data: perfil } = await sb
    .from('perfiles')
    .select('nif')
    .eq('id', user.id)
    .maybeSingle();

  if (!perfil?.nif) {
    return NextResponse.json({ error: 'Perfil sin NIF vinculado. Completa el setup primero.' }, { status: 400 });
  }

  const nif = perfil.nif;

  // Preparar datos de la solicitud
  const solicitudData = {
    nif,
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

  // Enviar emails de confirmación al cliente y notificación al admin (en background, no bloquea)
  (async () => {
    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ayudapyme.es';
      const [{ data: subv }, { data: cliente }, { data: perfilData }] = await Promise.all([
        sb.from('subvenciones').select('titulo, titulo_comercial, organismo, importe_maximo').eq('id', body.subvencion_id).maybeSingle(),
        sb.from('cliente').select('nombre_empresa').eq('nif', nif).maybeSingle(),
        sb.from('perfiles').select('id').eq('nif', nif).eq('rol', 'cliente').maybeSingle(),
      ]);

      const tituloSub = (subv as Record<string,unknown> | null)?.titulo_comercial as string
        ?? (subv as Record<string,unknown> | null)?.titulo as string
        ?? 'tu subvención';
      const nombreEmpresa = (cliente as Record<string,unknown> | null)?.nombre_empresa as string ?? nif;
      const organismo = (subv as Record<string,unknown> | null)?.organismo as string | undefined;
      const importe = (subv as Record<string,unknown> | null)?.importe_maximo as number | null;
      const importeStr = importe ? (importe >= 1_000_000 ? `${(importe/1_000_000).toFixed(1)}M €` : `${(importe/1_000).toFixed(0)}K €`) : null;

      // Email al cliente
      if (perfilData?.id) {
        const { data: { users } } = await sb.auth.admin.listUsers();
        const emailCliente = users.find(u => u.id === perfilData.id)?.email;
        if (emailCliente) {
          await sendTransactionalEmail({
            to: emailCliente,
            subject: `✅ Solicitud confirmada: ${tituloSub}`,
            html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f6fb;font-family:sans-serif">
<div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden">
<div style="background:#0d1f3c;padding:28px 32px"><span style="color:#fff;font-weight:800;font-size:17px">AyudaPyme</span></div>
<div style="padding:32px">
<h2 style="color:#059669;margin:0 0 16px">✅ ¡Solicitud confirmada!</h2>
<p style="color:#475569;line-height:1.7">Hola <strong>${nombreEmpresa}</strong>,</p>
<p style="color:#475569;line-height:1.7">Hemos registrado tu interés en la subvención:</p>
<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin:20px 0">
  <div style="font-weight:700;color:#0d1f3c;margin-bottom:6px">${tituloSub}</div>
  ${organismo ? `<div style="font-size:0.85rem;color:#64748b">${organismo}</div>` : ''}
  ${importeStr ? `<div style="font-size:0.85rem;color:#059669;margin-top:8px">Hasta ${importeStr}</div>` : ''}
</div>
<p style="color:#475569;line-height:1.7"><strong>¿Qué pasa ahora?</strong><br>
1. Nuestro gestor revisará tu caso en las próximas 24-48 horas.<br>
2. Te contactaremos para preparar la documentación.<br>
3. Presentamos la solicitud — tú no tienes que hacer nada.<br>
4. Solo pagas si consigues la subvención (15% de lo concedido).</p>
<a href="${siteUrl}/portal" style="display:inline-block;background:#0d9488;color:#fff;padding:12px 28px;border-radius:10px;font-weight:700;text-decoration:none;margin-top:8px">Ver estado de mi solicitud →</a>
</div></div></body></html>`,
          }).catch(() => {});
        }
      }

      // Notificación al admin
      const { data: admins } = await sb.from('perfiles').select('id').eq('rol', 'admin');
      const { data: { users: allUsers } } = await sb.auth.admin.listUsers();
      const adminEmails = (admins ?? []).map(a => allUsers.find(u => u.id === a.id)?.email).filter(Boolean) as string[];
      for (const email of adminEmails) {
        await sendTransactionalEmail({
          to: email,
          subject: `🆕 Nueva solicitud: ${nombreEmpresa} → ${tituloSub}`,
          html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f6fb;font-family:sans-serif">
<div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden">
<div style="background:#0d1f3c;padding:28px 32px"><span style="color:#fff;font-weight:800;font-size:17px">AyudaPyme — Nueva solicitud</span></div>
<div style="padding:32px">
<p style="color:#475569"><strong>${nombreEmpresa}</strong> (${nif}) ha mostrado interés en:</p>
<p style="font-size:1rem;font-weight:700;color:#0d1f3c">${tituloSub}</p>
${organismo ? `<p style="color:#64748b;font-size:0.9rem">${organismo}${importeStr ? ` · hasta ${importeStr}` : ''}</p>` : ''}
<a href="${siteUrl}/expedientes" style="display:inline-block;background:#0d1f3c;color:#fff;padding:12px 28px;border-radius:10px;font-weight:700;text-decoration:none;margin-top:16px">Gestionar solicitud →</a>
</div></div></body></html>`,
        }).catch(() => {});
      }
    } catch {
      // Los emails no son críticos, no rompen el flujo
    }
  })();

  // Generar informe en background si hay respuestas
  if (body.respuestas_ia?.length) {
    const [{ data: subv }, { data: cliente }, { data: iaProvider }] = await Promise.all([
      sb.from('subvenciones').select('titulo, organismo, objeto, para_quien, importe_maximo').eq('id', body.subvencion_id).maybeSingle(),
      sb.from('cliente').select('nombre_empresa, actividad, tamano_empresa, comunidad_autonoma, num_empleados, facturacion_anual').eq('nif', nif).maybeSingle(),
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
