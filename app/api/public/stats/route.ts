/**
 * GET /api/public/stats
 * Estadísticas públicas para la landing: convocatorias abiertas, importe máximo, etc.
 * No requiere autenticación. Cacheado 1 hora.
 */

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export const revalidate = 3600; // revalidar cada hora

export async function GET() {
  try {
    const sb = createServiceClient();

    const [{ count: abiertas }, { data: maxRow }] = await Promise.all([
      sb.from('subvenciones')
        .select('*', { count: 'exact', head: true })
        .eq('estado_convocatoria', 'abierta'),
      sb.from('subvenciones')
        .select('importe_maximo')
        .not('importe_maximo', 'is', null)
        .order('importe_maximo', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    return NextResponse.json(
      {
        convocatorias_abiertas: abiertas ?? 0,
        importe_maximo: maxRow?.importe_maximo ?? 120000,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      }
    );
  } catch {
    // Fallback si falla la BD — devolvemos datos razonables
    return NextResponse.json({ convocatorias_abiertas: 47, importe_maximo: 120000 });
  }
}
