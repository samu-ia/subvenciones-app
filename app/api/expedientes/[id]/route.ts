/**
 * GET  /api/expedientes/[id] — detalle de un expediente
 * PATCH /api/expedientes/[id] — actualizar fase, fechas, estado, notas
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireRole, requireAdminOrTramitador } from '@/lib/auth/helpers';
import { sendTransactionalEmail } from '@/lib/email';
import { generateInvoice } from '@/lib/billing/generate-invoice';

const FASES_VALIDAS = [
  'preparacion', 'presentada', 'instruccion', 'resolucion_provisional',
  'alegaciones', 'resolucion_definitiva', 'aceptacion', 'ejecucion',
  'justificacion', 'cobro', 'denegada', 'desistida',
];

// Orden lineal de fases (excluyendo estados terminales denegada/desistida)
const FASES_ORDEN: string[] = [
  'preparacion', 'presentada', 'instruccion', 'resolucion_provisional',
  'alegaciones', 'resolucion_definitiva', 'aceptacion', 'ejecucion',
  'justificacion', 'cobro',
];

/**
 * Auto-transición de fases en expediente_fases:
 * - Marca la fase anterior como completada (fecha_completada = now)
 * - Crea registro de la nueva fase si no existe
 * - Completa todas las fases anteriores a la nueva que no estén completadas
 */
async function transicionarFases(
  sb: ReturnType<typeof createServiceClient>,
  expedienteId: string,
  faseAnterior: string | null,
  faseNueva: string,
) {
  const now = new Date().toISOString();
  const idxNueva = FASES_ORDEN.indexOf(faseNueva);

  // Si la fase nueva no está en el orden lineal (denegada/desistida), no hacer nada
  if (idxNueva < 0) return;

  // 1. Marcar como completadas TODAS las fases anteriores a la nueva
  for (let i = 0; i < idxNueva; i++) {
    const fase = FASES_ORDEN[i];
    // Upsert: crear si no existe, marcar como completada
    await sb.from('expediente_fases').upsert(
      {
        expediente_id: expedienteId,
        fase,
        orden: i,
        fecha_inicio: now,
        fecha_completada: now,
      },
      { onConflict: 'expediente_id,fase' }
    );
    // Si ya existía, solo actualizar fecha_completada si aún no la tiene
    await sb.from('expediente_fases')
      .update({ fecha_completada: now })
      .eq('expediente_id', expedienteId)
      .eq('fase', fase)
      .is('fecha_completada', null);
  }

  // 2. Crear registro de la fase nueva (en curso, sin fecha_completada)
  const { data: existente } = await sb.from('expediente_fases')
    .select('id, fecha_completada')
    .eq('expediente_id', expedienteId)
    .eq('fase', faseNueva)
    .maybeSingle();

  if (!existente) {
    await sb.from('expediente_fases').insert({
      expediente_id: expedienteId,
      fase: faseNueva,
      orden: idxNueva,
      fecha_inicio: now,
      fecha_completada: null,
    });
  } else if (existente.fecha_completada) {
    // Si estaba completada (raro, pero posible), reabrirla
    await sb.from('expediente_fases')
      .update({ fecha_completada: null })
      .eq('id', existente.id);
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authGet = await requireAdminOrTramitador();
  if (authGet instanceof NextResponse) return authGet;

  const { id } = await params;
  const sb = createServiceClient();

  const { data, error } = await sb
    .from('expediente')
    .select(`
      *,
      cliente:nif(*),
      subvencion:subvencion_id(id, titulo, organismo, plazo_fin, importe_maximo, porcentaje_financiacion, url_oficial)
    `)
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  return NextResponse.json(data);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authPatch = await requireAdminOrTramitador();
  if (authPatch instanceof NextResponse) return authPatch;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Body requerido' }, { status: 400 });

  // Campos permitidos para actualizar
  const campos: Record<string, unknown> = {};

  if (body.fase !== undefined) {
    if (!FASES_VALIDAS.includes(body.fase)) {
      return NextResponse.json({ error: `Fase inválida: ${body.fase}` }, { status: 400 });
    }
    // Validar importe_concedido antes de pasar a cobro
    if (body.fase === 'cobro') {
      const importe = body.importe_concedido ?? null;
      if (!importe || Number(importe) <= 0) {
        // Verificar si ya tiene importe en BD
        const sbCheck2 = createServiceClient();
        const { data: expCheck } = await sbCheck2.from('expediente').select('importe_concedido').eq('id', id).maybeSingle();
        if (!expCheck?.importe_concedido || Number(expCheck.importe_concedido) <= 0) {
          return NextResponse.json(
            { error: 'Debes indicar el importe_concedido antes de marcar como cobrado' },
            { status: 400 },
          );
        }
      }
    }
    campos.fase = body.fase;
    campos.fase_updated_at = new Date().toISOString();
  }
  if (body.estado !== undefined) campos.estado = body.estado;
  if (body.notas !== undefined) campos.notas = body.notas;
  if (body.titulo !== undefined) campos.titulo = body.titulo;
  if (body.plazo_solicitud !== undefined) campos.plazo_solicitud = body.plazo_solicitud;
  if (body.fecha_presentacion !== undefined) campos.fecha_presentacion = body.fecha_presentacion;
  if (body.fecha_resolucion_provisional !== undefined) campos.fecha_resolucion_provisional = body.fecha_resolucion_provisional;
  if (body.fecha_alegaciones_fin !== undefined) campos.fecha_alegaciones_fin = body.fecha_alegaciones_fin;
  if (body.fecha_resolucion_definitiva !== undefined) campos.fecha_resolucion_definitiva = body.fecha_resolucion_definitiva;
  if (body.plazo_aceptacion !== undefined) campos.plazo_aceptacion = body.plazo_aceptacion;
  if (body.fecha_inicio_ejecucion !== undefined) campos.fecha_inicio_ejecucion = body.fecha_inicio_ejecucion;
  if (body.fecha_fin_ejecucion !== undefined) campos.fecha_fin_ejecucion = body.fecha_fin_ejecucion;
  if (body.plazo_justificacion !== undefined) campos.plazo_justificacion = body.plazo_justificacion;
  if (body.fecha_cobro !== undefined) campos.fecha_cobro = body.fecha_cobro;
  if (body.importe_solicitado !== undefined) campos.importe_solicitado = body.importe_solicitado;
  if (body.importe_concedido !== undefined) campos.importe_concedido = body.importe_concedido;

  // ── Transición de fee_estado ──────────────────────────────────────────────
  if (body.fee_estado !== undefined) {
    const TRANSICIONES_FEE: Record<string, string[]> = {
      pendiente: ['facturado'],
      facturado: ['cobrado'],
    };
    const sbCheck = createServiceClient();
    const { data: expFee } = await sbCheck
      .from('expediente')
      .select('fee_estado, fee_amount, nif, titulo')
      .eq('id', id)
      .maybeSingle();

    const estadoActual = expFee?.fee_estado;
    if (!estadoActual || estadoActual === 'no_aplica') {
      return NextResponse.json({ error: 'El expediente no tiene fee pendiente' }, { status: 400 });
    }
    const permitidos = TRANSICIONES_FEE[estadoActual] ?? [];
    if (!permitidos.includes(body.fee_estado)) {
      return NextResponse.json(
        { error: `Transición inválida: ${estadoActual} → ${body.fee_estado}. Permitidas: ${permitidos.join(', ')}` },
        { status: 400 },
      );
    }
    campos.fee_estado = body.fee_estado;
  }

  if (Object.keys(campos).length === 0) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
  }

  campos.updated_at = new Date().toISOString();

  const sb = createServiceClient();

  // Leer expediente actual antes de actualizar (siempre que hay cambio de fase)
  const nuevaFase: string | undefined = campos.fase as string | undefined;
  let expedienteActual: Record<string, unknown> | null = null;
  if (nuevaFase) {
    const { data: expData } = await sb
      .from('expediente')
      .select('id, nif, titulo, importe_concedido, fase, subvencion:subvencion_id(titulo, organismo), cliente:nif(nombre_empresa, domicilio_fiscal, codigo_postal, ciudad)')
      .eq('id', id)
      .maybeSingle();
    expedienteActual = expData as Record<string, unknown> | null;
  }

  const { error } = await sb.from('expediente').update(campos).eq('id', id);

  // ── Auto-transición de fases en expediente_fases ──────────────────────────
  if (!error && nuevaFase && expedienteActual && expedienteActual.fase !== nuevaFase) {
    await transicionarFases(sb, id, expedienteActual.fase as string | null, nuevaFase);
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Obtener emails admin para notificaciones
  async function getAdminEmails(): Promise<string[]> {
    const { data: admins } = await sb.from('perfiles').select('id').eq('rol', 'admin');
    const { data: { users } } = await sb.auth.admin.listUsers();
    return (admins ?? []).map(a => users.find(u => u.id === a.id)?.email).filter(Boolean) as string[];
  }

  async function getClienteEmail(nif: string): Promise<string | null> {
    const { data } = await sb.from('perfiles').select('id').eq('nif', nif).eq('rol', 'cliente').maybeSingle();
    if (!data) return null;
    const { data: { users } } = await sb.auth.admin.listUsers();
    return users.find(u => u.id === data.id)?.email ?? null;
  }

  function fmtE(n: number) { return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }); }

  // ── Fase COBRO: calcular fee, guardar en BD, enviar emails ─────────────────
  if (
    nuevaFase === 'cobro' &&
    expedienteActual &&
    expedienteActual.fase !== 'cobro'
  ) {
    const importeConcedido = (campos.importe_concedido as number | undefined) ?? (expedienteActual.importe_concedido as number | null) ?? 0;
    const subv = expedienteActual.subvencion as Record<string, unknown> | null;
    const titulo = (expedienteActual.titulo || subv?.titulo || `Expediente ${id.slice(0, 8)}`) as string;
    const nif = expedienteActual.nif as string | null;

    if (importeConcedido > 0) {
      const feeAmount = Math.max(importeConcedido * 0.15, 300);

      // Guardar fee en BD
      await sb.from('expediente').update({
        fee_amount: feeAmount,
        fee_estado: 'pendiente',
      }).eq('id', id);

      // Alerta en bandeja gestor
      await sb.from('alertas').insert({
        tipo: 'custom',
        titulo: `💰 Emitir factura ${fmtE(feeAmount)}`,
        descripcion: `"${titulo}" cobrada por ${fmtE(importeConcedido)}. Comisión del 15%: ${fmtE(feeAmount)}. Enviar factura al cliente y esperar transferencia.`,
        prioridad: 'critica',
        expediente_id: id,
        nif,
        resuelta: false,
        auto_generada: true,
      });

      // Emails
      const adminEmails = await getAdminEmails();
      for (const email of adminEmails) {
        await sendTransactionalEmail({
          to: email,
          subject: `💰 Subvención cobrada — emitir factura ${fmtE(feeAmount)}`,
          html: `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f4f6fb;margin:0;padding:40px 0">
<div style="max-width:540px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden">
<div style="background:#0d1f3c;padding:24px 32px"><span style="color:#fff;font-weight:800;font-size:16px">AyudaPyme</span></div>
<div style="padding:32px">
<h2 style="color:#059669;margin:0 0 16px">💰 Subvención cobrada</h2>
<p style="color:#475569"><strong>${titulo}</strong></p>
<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin:20px 0">
  <div style="font-size:0.85rem;color:#059669;font-weight:600">IMPORTE CONCEDIDO</div>
  <div style="font-size:2rem;font-weight:900;color:#0d1f3c">${fmtE(importeConcedido)}</div>
  <div style="font-size:0.85rem;color:#059669;font-weight:600;margin-top:12px">COMISIÓN A COBRAR (15%)</div>
  <div style="font-size:1.5rem;font-weight:800;color:#0d9488">${fmtE(feeAmount)}</div>
</div>
<p style="color:#475569">Acción requerida: emitir factura al cliente${nif ? ` (${nif})` : ''} por <strong>${fmtE(feeAmount)}</strong> e indicar datos bancarios para transferencia.</p>
</div></div></body></html>`,
        }).catch(() => {});
      }

      if (nif) {
        const clienteEmail = await getClienteEmail(nif);
        if (clienteEmail) {
          await sendTransactionalEmail({
            to: clienteEmail,
            subject: `🎉 ¡Subvención cobrada! — ${titulo}`,
            html: `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f4f6fb;margin:0;padding:40px 0">
<div style="max-width:540px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden">
<div style="background:#0d1f3c;padding:24px 32px"><span style="color:#fff;font-weight:800;font-size:16px">AyudaPyme</span></div>
<div style="padding:32px">
<h2 style="color:#059669;margin:0 0 8px">🎉 ¡Enhorabuena!</h2>
<p style="color:#475569;margin:0 0 20px">La subvención <strong>${titulo}</strong> ha sido concedida y el importe está en camino.</p>
<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin:20px 0;text-align:center">
  <div style="font-size:0.85rem;color:#059669;font-weight:600">IMPORTE CONSEGUIDO</div>
  <div style="font-size:2.5rem;font-weight:900;color:#0d1f3c">${fmtE(importeConcedido)}</div>
</div>
<p style="color:#475569">Según nuestro acuerdo, la comisión por éxito es del 15%: <strong>${fmtE(feeAmount)}</strong>. En los próximos días recibirás una factura con los datos para la transferencia bancaria.</p>
<p style="color:#94a3b8;font-size:0.85rem">Gracias por confiar en AyudaPyme. Ha sido un placer trabajar contigo.</p>
</div></div></body></html>`,
          }).catch(() => {});
        }
      }
    }
  }

  // ── Fase RESOLUCIÓN DEFINITIVA: email de enhorabuena ──────────────────────
  if (
    nuevaFase === 'resolucion_definitiva' &&
    expedienteActual &&
    expedienteActual.fase !== 'resolucion_definitiva'
  ) {
    const subv = expedienteActual.subvencion as Record<string, unknown> | null;
    const titulo = (expedienteActual.titulo || subv?.titulo || `Expediente ${id.slice(0, 8)}`) as string;
    const nif = expedienteActual.nif as string | null;
    const importeConcedido = (campos.importe_concedido as number | undefined) ?? (expedienteActual.importe_concedido as number | null);

    if (nif) {
      const clienteEmail = await getClienteEmail(nif);
      if (clienteEmail) {
        await sendTransactionalEmail({
          to: clienteEmail,
          subject: `✅ Resolución favorable — ${titulo}`,
          html: `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f4f6fb;margin:0;padding:40px 0">
<div style="max-width:540px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden">
<div style="background:#0d1f3c;padding:24px 32px"><span style="color:#fff;font-weight:800;font-size:16px">AyudaPyme</span></div>
<div style="padding:32px">
<h2 style="color:#059669;margin:0 0 8px">✅ ¡Resolución favorable!</h2>
<p style="color:#475569">La administración ha resuelto favorablemente la solicitud de <strong>${titulo}</strong>${importeConcedido ? ` por un importe de <strong>${fmtE(importeConcedido)}</strong>` : ''}.</p>
<p style="color:#475569">Los siguientes pasos son la aceptación formal y la fase de ejecución del proyecto. Nos pondremos en contacto contigo con los detalles.</p>
</div></div></body></html>`,
        }).catch(() => {});
      }
    }
  }

  // ── Fee cobrado: crear alerta de confirmación de cierre ───────────────────
  if (campos.fee_estado === 'cobrado') {
    const { data: expCobrado } = await sb
      .from('expediente')
      .select('fee_amount, nif, titulo')
      .eq('id', id)
      .maybeSingle();

    const feeAmt = expCobrado?.fee_amount;
    const tituloExp = expCobrado?.titulo || `Expediente ${id.slice(0, 8)}`;

    await sb.from('alertas').insert({
      tipo: 'custom',
      titulo: `✅ Fee cobrado — ${tituloExp}`,
      descripcion: `Se ha confirmado el cobro del fee${feeAmt ? ` de ${feeAmt.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}` : ''}. Expediente cerrado económicamente.`,
      prioridad: 'normal',
      expediente_id: id,
      nif: expCobrado?.nif ?? null,
      resuelta: false,
      auto_generada: true,
    });
  }

  return NextResponse.json({ ok: true });
}
