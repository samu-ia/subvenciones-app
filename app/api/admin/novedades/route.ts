/**
 * GET /api/admin/novedades
 *
 * Panel de novedades para admins:
 * - Solicitudes recientes (últimas 48h o sin revisar)
 * - Matches de alto score sin solicitud (oportunidades por activar)
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

  const [
    { data: solicitudesRecientes },
    { data: matchesSinSolicitud },
  ] = await Promise.all([
    // Solicitudes de los últimos 7 días, con datos relacionados
    sb
      .from('solicitudes')
      .select(`
        id, nif, estado, encaje_score, contrato_firmado, metodo_pago_ok,
        informe_viabilidad, created_at, updated_at,
        subvencion:subvenciones(id, titulo, organismo, importe_maximo, estado_convocatoria),
        cliente:cliente(nombre_empresa, nombre_normalizado, ciudad, comunidad_autonoma)
      `)
      .gte('created_at', new Date(Date.now() - 7 * 86_400_000).toISOString())
      .order('created_at', { ascending: false })
      .limit(50),

    // Matches de alto score sin solicitud todavía
    sb
      .from('cliente_subvencion_match')
      .select(`
        id, nif, score, motivos, estado, notificado_cliente, created_at,
        subvencion:subvenciones(id, titulo, organismo, importe_maximo, plazo_fin, estado_convocatoria),
        cliente:cliente(nombre_empresa, nombre_normalizado, ciudad, comunidad_autonoma)
      `)
      .gte('score', 0.5)
      .not('estado', 'in', '("descartado","excluido")')
      .is('notificado_cliente', false)
      .order('score', { ascending: false })
      .limit(50),
  ]);

  // Filtrar matches que ya tienen solicitud activa
  const nifSubvIds = new Set(
    (solicitudesRecientes ?? []).map((s: Record<string, unknown>) => `${s.nif}::${(s.subvencion as Record<string, unknown>)?.id}`)
  );
  const matchesFiltrados = (matchesSinSolicitud ?? []).filter((m: Record<string, unknown>) => {
    const key = `${m.nif}::${(m.subvencion as Record<string, unknown>)?.id}`;
    return !nifSubvIds.has(key);
  });

  return NextResponse.json({
    solicitudes: solicitudesRecientes ?? [],
    matches_pendientes: matchesFiltrados,
  });
}
