import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireRole } from '@/lib/auth/helpers';

export async function GET() {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

  const sb = createServiceClient();
  const { data } = await sb
    .from('subvenciones_ingesta_log')
    .select('id, created_at, fuente, total_consultadas, nuevas, actualizadas, sin_cambios, errores, duracion_ms, estado, error_msg')
    .order('created_at', { ascending: false })
    .limit(20);

  return NextResponse.json(data ?? []);
}
