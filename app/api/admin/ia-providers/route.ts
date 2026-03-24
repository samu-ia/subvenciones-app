import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: perfil } = await supabase.from('perfiles').select('rol').eq('id', user.id).maybeSingle();
  if (perfil?.rol !== 'admin') return NextResponse.json({ error: 'Solo admins' }, { status: 403 });

  const sb = createServiceClient();
  const { data } = await sb
    .from('ia_providers')
    .select('id, provider, api_key, base_url, enabled')
    .order('provider');

  return NextResponse.json(data ?? []);
}
