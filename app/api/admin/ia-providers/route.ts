import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireRole } from '@/lib/auth/helpers';

export async function GET() {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

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
