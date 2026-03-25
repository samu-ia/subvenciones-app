import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  if (!user.email?.endsWith('@ayudapyme.es')) return NextResponse.json({ error: 'Solo admins' }, { status: 403 });

  const sb = createServiceClient();
  const { data } = await sb
    .from('subvenciones_ingesta_log')
    .select('id, created_at, modo, total_procesadas, nuevas, actualizadas, matches_generados, estado, error_msg')
    .order('created_at', { ascending: false })
    .limit(20);

  return NextResponse.json(data ?? []);
}
