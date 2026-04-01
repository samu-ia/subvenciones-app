/**
 * GET|POST /api/expedientes/check-alertas
 *
 * Cron diario (08:00) que revisa todos los expedientes activos y crea alertas
 * cuando los plazos están próximos. También envía emails via Resend.
 *
 * Protegido por: Authorization: Bearer INGEST_SECRET  ó  sesión admin
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { sendTransactionalEmail } from '@/lib/email';

export const maxDuration = 300;

const FASES_ACTIVAS = [
  'preparacion', 'presentada', 'instruccion', 'resolucion_provisional',
  'alegaciones', 'resolucion_definitiva', 'aceptacion', 'ejecucion', 'justificacion',
];

function diasHasta(fecha: string | null): number | null {
  if (!fecha) return null;
  const diff = new Date(fecha).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function fmtFecha(fecha: string): string {
  return new Date(fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
}

function emailAlertaHtml(titulo: string, cuerpo: string): string {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:-apple-system,sans-serif">
<div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
  <div style="background:#0d1f3c;padding:24px 32px">
    <span style="color:#fff;font-weight:800;font-size:16px">AyudaPyme</span>
  </div>
  <div style="padding:32px">
    <h2 style="margin:0 0 16px;color:#0d1f3c;font-size:1.2rem">${titulo}</h2>
    <div style="color:#475569;line-height:1.7">${cuerpo}</div>
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e8ecf4;font-size:0.75rem;color:#94a3b8">
      AyudaPyme · Solo pagas si conseguimos la subvención
    </div>
  </div>
</div></body></html>`;
}

async function yaExisteAlerta(sb: ReturnType<typeof createServiceClient>, expedienteId: string, tipo: string): Promise<boolean> {
  const { data } = await sb
    .from('alertas')
    .select('id')
    .eq('expediente_id', expedienteId)
    .eq('tipo', tipo)
    .eq('resuelta', false)
    .maybeSingle();
  return !!data;
}

async function crearAlerta(
  sb: ReturnType<typeof createServiceClient>,
  expedienteId: string,
  nif: string | null,
  tipo: string,
  prioridad: string,
  mensaje: string,
  fechaLimite: string | null,
): Promise<void> {
  await sb.from('alertas').insert({
    expediente_id: expedienteId,
    nif,
    tipo,
    prioridad,
    descripcion: mensaje,
    titulo: mensaje.slice(0, 80),
    fecha_limite: fechaLimite,
    resuelta: false,
    auto_generada: true,
  });
}

export async function GET(request: NextRequest) {
  return handler(request);
}

export async function POST(request: NextRequest) {
  return handler(request);
}

async function handler(request: NextRequest) {
  // Auth: INGEST_SECRET o sesión admin
  const secret = request.headers.get('authorization')?.replace('Bearer ', '');
  const sb = createServiceClient();

  if (secret !== process.env.INGEST_SECRET) {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { data: perfil } = await sb.from('perfiles').select('rol').eq('id', user.id).maybeSingle();
    if (perfil?.rol !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { data: expedientes, error } = await sb
    .from('expediente')
    .select('id, nif, titulo, fase, fase_updated_at, plazo_solicitud, plazo_aceptacion, plazo_justificacion, fecha_alegaciones_fin, subvencion:subvencion_id(titulo, organismo)')
    .in('fase', FASES_ACTIVAS);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let alertasCreadas = 0;
  let emailsEnviados = 0;

  // Obtener emails de admin (para notificar al gestor)
  const { data: admins } = await sb.from('perfiles').select('id').eq('rol', 'admin');
  const { data: { users: allUsers } } = await sb.auth.admin.listUsers();
  const adminEmails = (admins ?? [])
    .map(a => allUsers.find(u => u.id === a.id)?.email)
    .filter(Boolean) as string[];

  for (const exp of expedientes ?? []) {
    const subv = exp.subvencion as { titulo?: string; organismo?: string } | null;
    const nombre = exp.titulo || subv?.titulo || `Expediente ${exp.id.slice(0, 8)}`;

    // Email del cliente
    const { data: clientePerfilData } = exp.nif
      ? await sb.from('perfiles').select('id').eq('nif', exp.nif).eq('rol', 'cliente').maybeSingle()
      : { data: null };
    const clienteEmail = clientePerfilData
      ? allUsers.find(u => u.id === clientePerfilData.id)?.email ?? null
      : null;

    const checks: Array<{
      condicion: boolean;
      tipo: string;
      prioridad: string;
      mensaje: string;
      fechaLimite: string | null;
      emailGestor?: string;
      emailCliente?: string;
    }> = [];

    // Plazo solicitud ≤ 7 días y aún en preparación
    const diasSolicitud = diasHasta(exp.plazo_solicitud);
    if (exp.fase === 'preparacion' && diasSolicitud !== null && diasSolicitud <= 7 && diasSolicitud >= 0) {
      checks.push({
        condicion: true,
        tipo: 'plazo_solicitud',
        prioridad: 'critica',
        mensaje: `URGENTE: "${nombre}" — plazo de solicitud en ${diasSolicitud} días (${fmtFecha(exp.plazo_solicitud!)})`,
        fechaLimite: exp.plazo_solicitud,
        emailGestor: `⚠️ <strong>${nombre}</strong> debe presentarse antes del ${fmtFecha(exp.plazo_solicitud!)} (en ${diasSolicitud} días). Por favor, presenta la documentación de inmediato.`,
        emailCliente: `Tu solicitud de subvención <strong>${nombre}</strong> debe presentarse antes del ${fmtFecha(exp.plazo_solicitud!)}. Nuestro equipo está trabajando en ello.`,
      });
    }

    // Plazo aceptación ≤ 5 días
    const diasAceptacion = diasHasta(exp.plazo_aceptacion);
    if (exp.fase === 'aceptacion' && diasAceptacion !== null && diasAceptacion <= 5 && diasAceptacion >= 0) {
      checks.push({
        condicion: true,
        tipo: 'plazo_aceptacion',
        prioridad: 'critica',
        mensaje: `CRÍTICO: "${nombre}" — debes aceptar la resolución en ${diasAceptacion} días o pierdes la subvención`,
        fechaLimite: exp.plazo_aceptacion,
        emailGestor: `🔴 <strong>ACCIÓN URGENTE</strong>: El expediente <strong>${nombre}</strong> requiere aceptar la resolución antes del ${fmtFecha(exp.plazo_aceptacion!)} (${diasAceptacion} días). Si no se acepta a tiempo, se pierde la subvención.`,
        emailCliente: `Tu subvención <strong>${nombre}</strong> ha sido resuelta favorablemente. Debes aceptar antes del ${fmtFecha(exp.plazo_aceptacion!)} para no perderla. Nos pondremos en contacto contigo.`,
      });
    }

    // Plazo alegaciones ≤ 3 días
    const diasAlegaciones = diasHasta(exp.fecha_alegaciones_fin);
    if (exp.fase === 'alegaciones' && diasAlegaciones !== null && diasAlegaciones <= 3 && diasAlegaciones >= 0) {
      checks.push({
        condicion: true,
        tipo: 'plazo_alegaciones',
        prioridad: 'critica',
        mensaje: `URGENTE: "${nombre}" — plazo de alegaciones en ${diasAlegaciones} días`,
        fechaLimite: exp.fecha_alegaciones_fin,
        emailGestor: `🔴 Quedan ${diasAlegaciones} días para presentar alegaciones de <strong>${nombre}</strong> (${fmtFecha(exp.fecha_alegaciones_fin!)}).`,
      });
    }

    // Plazo justificación ≤ 14 días
    const diasJustificacion = diasHasta(exp.plazo_justificacion);
    if (exp.fase === 'justificacion' && diasJustificacion !== null && diasJustificacion <= 14 && diasJustificacion >= 0) {
      checks.push({
        condicion: true,
        tipo: 'plazo_justificacion',
        prioridad: diasJustificacion <= 5 ? 'critica' : 'alta',
        mensaje: `"${nombre}" — justificación debe presentarse en ${diasJustificacion} días`,
        fechaLimite: exp.plazo_justificacion,
        emailGestor: `⚠️ La justificación de <strong>${nombre}</strong> vence el ${fmtFecha(exp.plazo_justificacion!)} (en ${diasJustificacion} días).`,
        emailCliente: `Recuerda que debes justificar los gastos de la subvención <strong>${nombre}</strong> antes del ${fmtFecha(exp.plazo_justificacion!)}. Nuestro equipo te ayudará con la documentación.`,
      });
    }

    // Sin actividad > 90 días en fase presentada
    if (exp.fase === 'presentada' && exp.fase_updated_at) {
      const diasSinActividad = Math.floor((Date.now() - new Date(exp.fase_updated_at).getTime()) / (1000 * 60 * 60 * 24));
      if (diasSinActividad > 90) {
        checks.push({
          condicion: true,
          tipo: 'sin_actividad',
          prioridad: 'media',
          mensaje: `"${nombre}" lleva ${diasSinActividad} días sin actividad — verificar estado con la administración`,
          fechaLimite: null,
          emailGestor: `ℹ️ El expediente <strong>${nombre}</strong> lleva ${diasSinActividad} días sin cambios desde que se presentó. Considera verificar el estado con la administración.`,
        });
      }
    }

    for (const check of checks) {
      if (!check.condicion) continue;
      const yaExiste = await yaExisteAlerta(sb, exp.id, check.tipo);
      if (yaExiste) continue;

      await crearAlerta(sb, exp.id, exp.nif ?? null, check.tipo, check.prioridad, check.mensaje, check.fechaLimite);
      alertasCreadas++;

      // Email gestor
      if (check.emailGestor) {
        for (const email of adminEmails) {
          const r = await sendTransactionalEmail({
            to: email,
            subject: `[AyudaPyme] ${check.prioridad === 'critica' ? '🔴 URGENTE' : '⚠️ Alerta'}: ${nombre}`,
            html: emailAlertaHtml(check.prioridad === 'critica' ? '🔴 Acción urgente requerida' : '⚠️ Alerta de expediente', check.emailGestor),
          });
          if (r.ok) emailsEnviados++;
        }
      }

      // Email cliente
      if (check.emailCliente && clienteEmail) {
        const r = await sendTransactionalEmail({
          to: clienteEmail,
          subject: `[AyudaPyme] Actualización sobre tu subvención: ${nombre}`,
          html: emailAlertaHtml('Actualización sobre tu subvención', check.emailCliente),
        });
        if (r.ok) emailsEnviados++;
      }
    }
  }

  // Log en ingesta_log (fire and forget — no bloquea la respuesta)
  void sb.from('ingesta_log').insert({
    pipeline: 'check-alertas',
    estado: 'ok',
    detalle: { procesados: expedientes?.length ?? 0, alertas_creadas: alertasCreadas, emails_enviados: emailsEnviados },
  });

  return NextResponse.json({
    ok: true,
    procesados: expedientes?.length ?? 0,
    alertas_creadas: alertasCreadas,
    emails_enviados: emailsEnviados,
  });
}
