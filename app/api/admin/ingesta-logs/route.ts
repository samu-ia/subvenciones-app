import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireRole } from '@/lib/auth/helpers';

export async function GET() {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

  const sb = createServiceClient();
  const { data } = await sb
    .from('subvenciones_ingesta_log')
    .select('id, created_at, modo, total_procesadas, nuevas, actualizadas, matches_generados, estado, error_msg')
    .order('created_at', { ascending: false })
    .limit(20);

  return NextResponse.json(data ?? []);
}
