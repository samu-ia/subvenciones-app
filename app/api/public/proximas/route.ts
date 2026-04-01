/**
 * GET /api/public/proximas
 * Convocatorias abiertas que cierran en los próximos 30 días.
 * No requiere autenticación. Cacheado 1 hora.
 */

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export const revalidate = 3600;

export async function GET() {
  try {
    const sb = createServiceClient();
    const hoy = new Date().toISOString().slice(0, 10);
    const en30dias = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

    const { data } = await sb
      .from('subvenciones')
      .select('titulo_comercial, titulo, plazo_fin, organismo')
      .eq('estado_convocatoria', 'abierta')
      .gte('plazo_fin', hoy)
      .lte('plazo_fin', en30dias)
      .not('plazo_fin', 'is', null)
      .order('plazo_fin', { ascending: true })
      .limit(5);

    return NextResponse.json(data ?? [], {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
    });
  } catch {
    return NextResponse.json([]);
  }
}
