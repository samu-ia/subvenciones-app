/**
 * POST /api/admin/notificaciones/digest
 *
 * Genera y envía un email de resumen de alertas críticas/altas al admin autenticado.
 * Requiere rol admin.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireRole } from '@/lib/auth/helpers';
import { sendTransactionalEmail } from '@/lib/email';
import type { Alerta } from '@/app/api/alertas/route';

// ─── Template HTML del digest ─────────────────────────────────────────────────

function buildDigestEmailHtml(alertas: Alerta[]): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ayudapyme.es';

  const badgeColor: Record<string, string> = {
    critica: '#dc2626',
    alta: '#f97316',
    media: '#eab308',
    baja: '#64748b',
  };

  const badgeBg: Record<string, string> = {
    critica: '#fef2f2',
    alta: '#fff7ed',
    media: '#fefce8',
    baja: '#f8fafc',
  };

  const alertasRows = alertas
    .map((a) => {
      const color = badgeColor[a.prioridad] ?? '#64748b';
      const bg = badgeBg[a.prioridad] ?? '#f8fafc';
      const dias = a.dias_restantes !== null && a.dias_restantes !== undefined
        ? `${a.dias_restantes} día${a.dias_restantes !== 1 ? 's' : ''}`
        : '—';
      return `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;vertical-align:top">
          <span style="display:inline-block;background:${bg};color:${color};border:1px solid ${color};border-radius:6px;padding:2px 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em">${a.prioridad}</span>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;vertical-align:top">
          <p style="margin:0 0 2px;font-size:13px;font-weight:600;color:#0d1f3c">${a.titulo}</p>
          <p style="margin:0;font-size:12px;color:#64748b">${a.descripcion}</p>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;vertical-align:top;text-align:right;white-space:nowrap">
          <span style="font-size:13px;font-weight:600;color:${a.dias_restantes !== null && a.dias_restantes !== undefined && a.dias_restantes <= 7 ? '#dc2626' : '#475569'}">${dias}</span>
        </td>
      </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:640px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
    <!-- Header -->
    <div style="background:#0d1f3c;padding:28px 32px">
      <div style="display:inline-flex;align-items:center;gap:10px">
        <div style="width:36px;height:36px;background:#f97316;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:14px">AP</div>
        <span style="color:#fff;font-weight:700;font-size:17px">AyudaPyme</span>
      </div>
      <p style="margin:12px 0 0;color:#94a3b8;font-size:13px">Panel de administración — Resumen de alertas</p>
    </div>

    <!-- Body -->
    <div style="padding:32px">
      <p style="margin:0 0 8px;font-size:14px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Digest de alertas</p>
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0d1f3c;line-height:1.3">
        ${alertas.length} alerta${alertas.length !== 1 ? 's' : ''} activa${alertas.length !== 1 ? 's' : ''}
      </h1>
      <p style="margin:0 0 24px;font-size:14px;color:#475569">
        ${new Date().toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
      </p>

      <!-- Resumen de prioridades -->
      <div style="display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap">
        ${(['critica', 'alta', 'media'] as const)
          .map((p) => {
            const count = alertas.filter((a) => a.prioridad === p).length;
            if (count === 0) return '';
            return `<div style="background:${badgeBg[p]};border:1px solid ${badgeColor[p]};border-radius:10px;padding:10px 16px;text-align:center">
              <p style="margin:0;font-size:20px;font-weight:800;color:${badgeColor[p]}">${count}</p>
              <p style="margin:0;font-size:11px;font-weight:700;color:${badgeColor[p]};text-transform:uppercase">${p}</p>
            </div>`;
          })
          .join('')}
      </div>

      <!-- Tabla de alertas -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
        <thead>
          <tr style="background:#f8fafc">
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid #e2e8f0">Prioridad</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid #e2e8f0">Alerta</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid #e2e8f0">Tiempo</th>
          </tr>
        </thead>
        <tbody>
          ${alertasRows || '<tr><td colspan="3" style="padding:16px 12px;text-align:center;font-size:14px;color:#94a3b8">Sin alertas activas</td></tr>'}
        </tbody>
      </table>

      <!-- CTA -->
      <a href="${siteUrl}/admin/alertas" style="display:block;text-align:center;background:#0d1f3c;color:#fff;text-decoration:none;padding:14px 24px;border-radius:10px;font-size:15px;font-weight:700;margin-bottom:24px">
        Ver alertas en el panel →
      </a>

      <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center">
        AyudaPyme · Panel de administración
      </p>
    </div>
  </div>
</body>
</html>`;
}

// ─── Helper: obtener alertas críticas/altas ───────────────────────────────────

function diasHasta(fecha: string | null | undefined): number | null {
  if (!fecha) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const limite = new Date(fecha);
  limite.setHours(0, 0, 0, 0);
  return Math.ceil((limite.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
}

function prioridadPorDias(
  dias: number | null,
  critica: number,
  alta: number,
  media: number,
): 'critica' | 'alta' | 'media' | 'baja' {
  if (dias === null) return 'media';
  if (dias <= critica) return 'critica';
  if (dias <= alta) return 'alta';
  if (dias <= media) return 'media';
  return 'baja';
}

async function getAlertasCriticasAltas(sb: ReturnType<typeof createServiceClient>): Promise<Alerta[]> {
  const alertas: Alerta[] = [];

  // Expedientes con plazos próximos (≤ 7 días)
  const { data: expedientes } = await sb
    .from('expediente')
    .select(`
      id, nif, titulo, fase, estado,
      plazo_solicitud, plazo_aceptacion, fecha_alegaciones_fin,
      plazo_justificacion, fecha_fin_ejecucion,
      subvencion:subvencion_id(titulo, plazo_fin),
      cliente:nif(nombre_empresa, nombre_normalizado)
    `)
    .not('fase', 'in', '("denegada","desistida","cobro")')
    .not('estado', 'in', '("denegado","cerrado","cancelado","descartado")');

  if (expedientes) {
    for (const exp of expedientes) {
      const cliente = exp.cliente as { nombre_empresa?: string; nombre_normalizado?: string } | null;
      const subv = exp.subvencion as { titulo?: string; plazo_fin?: string } | null;
      const clienteNombre = cliente?.nombre_empresa || cliente?.nombre_normalizado || exp.nif;
      const expTitulo = exp.titulo || subv?.titulo || `Expediente ${exp.id.slice(0, 8)}`;

      const fechas: Array<{ fecha: string | null | undefined; tipo: string; params: [number, number, number] }> = [
        { fecha: exp.plazo_solicitud || subv?.plazo_fin, tipo: 'plazo_solicitud', params: [3, 7, 14] },
        { fecha: exp.plazo_aceptacion, tipo: 'plazo_aceptacion', params: [3, 7, 15] },
        { fecha: exp.fecha_alegaciones_fin, tipo: 'plazo_alegaciones', params: [3, 7, 15] },
        { fecha: exp.plazo_justificacion, tipo: 'plazo_justificacion', params: [7, 21, 60] },
        { fecha: exp.fecha_fin_ejecucion, tipo: 'plazo_ejecucion', params: [7, 21, 45] },
      ];

      for (const { fecha, tipo, params } of fechas) {
        if (!fecha) continue;
        const dias = diasHasta(fecha);
        if (dias === null || dias > 7) continue;

        const prioridad = prioridadPorDias(dias, ...params);
        if (prioridad !== 'critica' && prioridad !== 'alta') continue;

        alertas.push({
          id: `dyn-${tipo}-${exp.id}`,
          tipo,
          prioridad,
          titulo: `${tipo.replace(/_/g, ' ')}: ${dias} día${dias !== 1 ? 's' : ''}`,
          descripcion: `${clienteNombre} — ${expTitulo}`,
          expediente_id: exp.id,
          nif: exp.nif,
          fecha_limite: fecha ?? null,
          dias_restantes: dias,
          cliente_nombre: clienteNombre,
          expediente_titulo: expTitulo,
          resuelta: false,
          auto_generada: true,
          created_at: new Date().toISOString(),
        });
      }
    }
  }

  // Solicitudes pendientes de acción (alta prioridad)
  const { data: solicitudesPendientes } = await sb
    .from('solicitudes')
    .select('id, nif, estado, created_at, subvencion:subvencion_id(titulo), cliente:nif(nombre_empresa, nombre_normalizado)')
    .in('estado', ['contrato_pendiente', 'pago_pendiente', 'encaje_confirmado'])
    .is('expediente_id', null);

  if (solicitudesPendientes) {
    for (const sol of solicitudesPendientes) {
      const cliente = sol.cliente as { nombre_empresa?: string; nombre_normalizado?: string } | null;
      const subv = sol.subvencion as { titulo?: string } | null;
      const clienteNombre = cliente?.nombre_empresa || cliente?.nombre_normalizado || sol.nif;
      const diasEspera = diasHasta(sol.created_at?.slice(0, 10));
      const diasAntiguedad = diasEspera !== null ? Math.abs(diasEspera) : 0;

      if (diasAntiguedad <= 7) continue; // solo las que llevan más de 7 días esperando

      alertas.push({
        id: `dyn-sol-${sol.id}`,
        tipo: 'solicitud_pendiente',
        prioridad: 'alta',
        titulo: `Solicitud pendiente ${diasAntiguedad} días`,
        descripcion: `${clienteNombre} — ${subv?.titulo || 'Subvención'}. Estado: ${sol.estado}`,
        expediente_id: null,
        nif: sol.nif,
        fecha_limite: null,
        dias_restantes: null,
        cliente_nombre: clienteNombre,
        expediente_titulo: subv?.titulo || null,
        resuelta: false,
        auto_generada: true,
        created_at: sol.created_at || new Date().toISOString(),
      });
    }
  }

  // Ordenar: críticas primero
  const orden: Record<string, number> = { critica: 0, alta: 1, media: 2, baja: 3 };
  alertas.sort((a, b) => {
    const po = orden[a.prioridad] - orden[b.prioridad];
    if (po !== 0) return po;
    const da = a.dias_restantes ?? null;
    const db = b.dias_restantes ?? null;
    if (da !== null && db !== null) return da - db;
    if (da !== null) return -1;
    if (db !== null) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return alertas;
}

// ─── POST /api/admin/notificaciones/digest ────────────────────────────────────

export async function POST(_req: NextRequest) {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

  const { user: adminUser } = auth;

  if (!adminUser.email) {
    return NextResponse.json({ ok: false, error: 'Admin sin email' }, { status: 400 });
  }

  const sb = createServiceClient();
  const alertas = await getAlertasCriticasAltas(sb);

  if (alertas.length === 0) {
    return NextResponse.json({
      ok: true,
      message: 'Sin alertas críticas/altas — no se envió digest',
      total: 0,
    });
  }

  const result = await sendTransactionalEmail({
    to: adminUser.email,
    subject: `[AyudaPyme] Digest de alertas: ${alertas.length} alerta${alertas.length !== 1 ? 's' : ''} activa${alertas.length !== 1 ? 's' : ''}`,
    html: buildDigestEmailHtml(alertas),
    fromName: 'AyudaPyme Admin',
  });

  if (!result.ok) {
    console.error('[digest] Error enviando digest:', result.error);
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: `Digest enviado a ${adminUser.email} con ${alertas.length} alertas`,
    total: alertas.length,
  });
}
