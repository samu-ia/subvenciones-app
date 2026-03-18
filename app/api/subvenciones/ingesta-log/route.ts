/**
 * GET /api/subvenciones/ingesta-log
 *
 * Devuelve el historial de ejecuciones del pipeline.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data, error } = await supabase
      .from('subvenciones_ingesta_log')
      .select('*')
      .order('iniciado_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    return NextResponse.json({ data: data ?? [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
