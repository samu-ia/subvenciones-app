/**
 * GET /api/admin/novedades
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email?.toLowerCase().endsWith('@ayudapyme.es')) return null;
  return user;
}

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const sb = createServiceClient();

  const [{ data: solicitudesRaw }, { data: matchesRaw }] = await Promise.all([
    sb
      .from('solicitudes')
      .select('id, nif, estado, encaje_score, contrato_firmado, metodo_pago_ok, informe_viabilidad, created_at, updated_at, subvencion:subvenciones(id, titulo, organismo, importe_maximo, estado_convocatoria)')
      .gte('created_at', new Date(Date.now() - 7 * 86_400_000).toISOString())
      .order('created_at', { ascending: false })
      .limit(50),

    sb
      .from('cliente_subvencion_match')
      .select('id, nif, score, motivos, estado, notificado_cliente, created_at, subvencion:subvenciones(id, titulo, organismo, importe_maximo, plazo_fin, estado_convocatoria)')
      .gte('score', 0.5)
      .not('estado', 'in', '("descartado","excluido")')
      .is('notificado_cliente', false)
      .order('score', { ascending: false })
      .limit(50),
  ]);

  // Fetch client names manually (no FK from solicitudes/match -> cliente)
  const allNifs = [...new Set([
    ...(solicitudesRaw ?? []).map((s: Record<string, unknown>) => s.nif as string),
    ...(matchesRaw ?? []).map((m: Record<string, unknown>) => m.nif as string),
  ])];

  let clienteMap: Record<string, Record<string, unknown>> = {};
  if (allNifs.length > 0) {
    const { data: clientes } = await sb
      .from('cliente')
      .select('nif, nombre_empresa, nombre_normalizado, ciudad, comunidad_autonoma')
      .in('nif', allNifs);
    clienteMap = Object.fromEntries(
      (clientes ?? []).map((c: Record<string, unknown>) => [c.nif as string, c])
    );
  }

  const solicitudesRecientes = (solicitudesRaw ?? []).map((s: Record<string, unknown>) => ({
    ...s, cliente: clienteMap[s.nif as string] ?? null,
  }));

  const matchesSinSolicitud = (matchesRaw ?? []).map((m: Record<string, unknown>) => ({
    ...m, cliente: clienteMap[m.nif as string] ?? null,
  }));

  const nifSubvIds = new Set(
    solicitudesRecientes.map((s: Record<string, unknown>) =>
      `${s.nif}::${(s.subvencion as Record<string, unknown>)?.id}`)
  );
  const matchesFiltrados = matchesSinSolicitud.filter((m: Record<string, unknown>) =>
    !nifSubvIds.has(`${m.nif}::${(m.subvencion as Record<string, unknown>)?.id}`)
  );

  return NextResponse.json({ solicitudes: solicitudesRecientes, matches_pendientes: matchesFiltrados });
}
