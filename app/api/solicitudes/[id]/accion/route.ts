/**
 * POST /api/solicitudes/[id]/accion
 *
 * Admin endpoint para gestionar solicitudes:
 * - activar_expediente: crea expediente y pone estado 'activo'
 * - rechazar: pone estado 'rechazado' con motivo
 * - cambiar_estado: cambio libre de estado (admin)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

type Accion =
  | { tipo: 'activar_expediente'; notas?: string }
  | { tipo: 'rechazar'; motivo: string }
  | { tipo: 'cambiar_estado'; estado: string; notas?: string };

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Solo admins
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('rol')
    .eq('id', user.id)
    .maybeSingle();
  if (perfil?.rol !== 'admin') return NextResponse.json({ error: 'Solo admins' }, { status: 403 });

  const body: Accion = await request.json().catch(() => null);
  if (!body?.tipo) return NextResponse.json({ error: 'Falta tipo de acción' }, { status: 400 });

  const sb = createServiceClient();
  const { id: solicitudId } = await params;

  // Obtener solicitud actual
  const { data: sol, error: errSol } = await sb
    .from('solicitudes')
    .select('id, nif, subvencion_id, estado, match_id, expediente_id')
    .eq('id', solicitudId)
    .maybeSingle();

  if (errSol || !sol) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });

  if (body.tipo === 'activar_expediente') {
    if (sol.expediente_id) {
      return NextResponse.json({ error: 'Ya tiene expediente asignado' }, { status: 400 });
    }

    // Obtener datos para crear expediente
    const { data: subv } = await sb
      .from('subvenciones')
      .select('titulo, bdns_id, organismo')
      .eq('id', sol.subvencion_id)
      .maybeSingle();

    const { data: cliente } = await sb
      .from('cliente')
      .select('nombre_empresa')
      .eq('nif', sol.nif)
      .maybeSingle();

    // Crear expediente
    const { data: exp, error: errExp } = await sb
      .from('expediente')
      .insert({
        nif: sol.nif,
        estado: 'en_tramitacion',
        titulo: subv?.titulo ?? 'Subvención',
        organismo: subv?.organismo ?? null,
        subvencion_id: sol.subvencion_id,
        notas: body.notas ?? null,
      })
      .select('id')
      .single();

    if (errExp) return NextResponse.json({ error: errExp.message }, { status: 500 });

    // Actualizar solicitud
    await sb
      .from('solicitudes')
      .update({
        estado: 'activo',
        expediente_id: exp.id,
        notas_admin: body.notas ?? null,
      })
      .eq('id', solicitudId);

    return NextResponse.json({ ok: true, expediente_id: exp.id });
  }

  if (body.tipo === 'rechazar') {
    await sb
      .from('solicitudes')
      .update({ estado: 'rechazado', rechazado_motivo: body.motivo })
      .eq('id', solicitudId);

    return NextResponse.json({ ok: true });
  }

  if (body.tipo === 'cambiar_estado') {
    await sb
      .from('solicitudes')
      .update({ estado: body.estado, notas_admin: body.notas ?? null })
      .eq('id', solicitudId);

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Acción desconocida' }, { status: 400 });
}
