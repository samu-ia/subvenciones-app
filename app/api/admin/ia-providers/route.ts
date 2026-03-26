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
    .from('ia_providers')
    .select('id, provider, api_key, base_url, enabled')
    .order('provider');

  // VULN-08: Enmascarar API keys — solo mostrar últimos 4 caracteres
  const masked = (data ?? []).map((row: { id: string; provider: string; api_key: string | null; base_url: string | null; enabled: boolean }) => ({
    ...row,
    api_key: row.api_key
      ? `${'•'.repeat(Math.max(0, row.api_key.length - 4))}${row.api_key.slice(-4)}`
      : null,
  }));

  return NextResponse.json(masked);
}
