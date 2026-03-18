/**
 * GET /api/subvenciones/catalogo
 *
 * Lista subvenciones de la BD normalizada (pipeline BDNS).
 * Diferente de /api/subvenciones que sirve subvenciones_detectadas por reunión/expediente.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { searchParams } = new URL(request.url);

    const pagina = Math.max(1, parseInt(searchParams.get('pagina') ?? '1', 10));
    const tamanio = Math.min(100, Math.max(1, parseInt(searchParams.get('tamanio') ?? '20', 10)));
    const offset = (pagina - 1) * tamanio;

    const estado = searchParams.get('estado');
    const organismo = searchParams.get('organismo');
    const ambito = searchParams.get('ambito');
    const pipeline = searchParams.get('pipeline');
    const busqueda = searchParams.get('q');
    const soloAbiertas = searchParams.get('soloAbiertas') === 'true';

    let query = supabase
      .from('subvenciones')
      .select(`
        id, bdns_id, titulo, organismo, departamento,
        ambito_geografico, comunidad_autonoma,
        estado_convocatoria, pipeline_estado, ia_confidence,
        fecha_publicacion, plazo_inicio, plazo_fin, plazo_presentacion,
        importe_maximo, importe_minimo, porcentaje_financiacion, presupuesto_total,
        resumen_ia, puntos_clave, para_quien,
        url_oficial, url_pdf, fuente, version, ia_modelo,
        created_at, updated_at
      `, { count: 'exact' });

    if (estado) query = query.eq('estado_convocatoria', estado);
    if (soloAbiertas) query = query.eq('estado_convocatoria', 'abierta');
    if (organismo) query = query.ilike('organismo', `%${organismo}%`);
    if (ambito) query = query.eq('ambito_geografico', ambito);
    if (pipeline) query = query.eq('pipeline_estado', pipeline);
    if (busqueda) {
      query = query.or(`titulo.ilike.%${busqueda}%,objeto.ilike.%${busqueda}%,resumen_ia.ilike.%${busqueda}%,organismo.ilike.%${busqueda}%`);
    }

    const { data, error, count } = await query
      .order('updated_at', { ascending: false })
      .range(offset, offset + tamanio - 1);

    if (error) throw error;

    return NextResponse.json({
      data: data ?? [],
      total: count ?? 0,
      pagina,
      tamanio,
      totalPaginas: Math.ceil((count ?? 0) / tamanio),
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
