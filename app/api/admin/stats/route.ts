import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  if (!user.email?.endsWith('@ayudapyme.es')) return NextResponse.json({ error: 'Solo admins' }, { status: 403 });

  const sb = createServiceClient();

  const [
    { count: subvenciones },
    { count: clientes },
    { count: matches },
    { count: solicitudesTotal },
    { count: expTotal },
    { count: expActivos },
    { count: expConcedidos },
    { count: matchesNuevos },
    { count: solicitudesPendientes },
  ] = await Promise.all([
    sb.from('subvenciones').select('*', { count: 'exact', head: true }),
    sb.from('cliente').select('*', { count: 'exact', head: true }),
    sb.from('cliente_subvencion_match').select('*', { count: 'exact', head: true }).eq('es_hard_exclude', false),
    sb.from('solicitudes').select('*', { count: 'exact', head: true }),
    sb.from('expediente').select('*', { count: 'exact', head: true }),
    sb.from('expediente').select('*', { count: 'exact', head: true })
      .not('estado', 'in', '("denegado","cerrado","cancelado","descartado")'),
    sb.from('expediente').select('*', { count: 'exact', head: true })
      .eq('estado', 'concedido'),
    sb.from('cliente_subvencion_match').select('*', { count: 'exact', head: true })
      .eq('estado', 'nuevo').gte('score', 0.5).eq('es_hard_exclude', false),
    sb.from('solicitudes').select('*', { count: 'exact', head: true })
      .in('estado', ['contrato_pendiente', 'pago_pendiente', 'encaje_confirmado']),
  ]);

  return NextResponse.json({
    subvenciones: subvenciones ?? 0,
    clientes: clientes ?? 0,
    matches: matches ?? 0,
    solicitudes: solicitudesTotal ?? 0,
    expedientes: {
      total: expTotal ?? 0,
      activos: expActivos ?? 0,
      concedidos: expConcedidos ?? 0,
    },
    matches_nuevos: matchesNuevos ?? 0,
    solicitudes_pendientes: solicitudesPendientes ?? 0,
  });
}
