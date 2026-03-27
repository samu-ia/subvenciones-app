/**
 * GET /api/portal/matches
 * Devuelve los matches del cliente autenticado usando service client (sin RLS).
 * Si no hay matches, lanza el cálculo automáticamente.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { runMatchingForClient } from '@/lib/matching/run-for-client';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const sb = createServiceClient();

  // Obtener NIF del perfil
  const { data: perfil } = await sb
    .from('perfiles')
    .select('nif')
    .eq('id', user.id)
    .maybeSingle();

  if (!perfil?.nif) return NextResponse.json({ matches: [], calculando: false });

  const nif = perfil.nif;

  // Contar matches existentes
  const { count } = await sb
    .from('cliente_subvencion_match')
    .select('id', { count: 'exact', head: true })
    .eq('nif', nif)
    .eq('es_hard_exclude', false)
    .gte('score', 0.1);

  // Si no hay matches, calcular ahora (bloqueante para este request)
  let calculado = false;
  if (!count || count === 0) {
    try {
      await runMatchingForClient(nif);
      calculado = true;
    } catch (err) {
      console.error('[portal/matches] Error calculando matches:', (err as Error).message);
    }
  }

  // Cargar matches con subvenciones
  const { data: matchData, error } = await sb
    .from('cliente_subvencion_match')
    .select(`
      id, score, motivos, estado, es_hard_exclude, detalle_scoring,
      subvenciones!inner(
        id, bdns_id, titulo, titulo_comercial, organismo, objeto, resumen_ia, para_quien,
        importe_maximo, presupuesto_total, porcentaje_financiacion, plazo_fin, plazo_inicio,
        estado_convocatoria, ambito_geografico, url_oficial
      )
    `)
    .eq('nif', nif)
    .eq('es_hard_exclude', false)
    .gte('score', 0.1)
    .order('score', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[portal/matches] Error cargando matches:', error.message);
    return NextResponse.json({ matches: [], calculando: false });
  }

  return NextResponse.json({ matches: matchData ?? [], calculando: false, recalculado: calculado });
}
