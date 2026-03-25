import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email?.toLowerCase().endsWith('@ayudapyme.es')) return null;
  return user;
}

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const sb = createServiceClient();
  const { data, error } = await sb.from('notif_channels').select('*').order('canal');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Mask config keys for display (replace with •••)
  const masked = (data ?? []).map((r: Record<string, unknown>) => {
    const cfg = (r.config ?? {}) as Record<string, string>;
    const maskedCfg: Record<string, string> = {};
    for (const [k, v] of Object.entries(cfg)) {
      maskedCfg[k] = v ? '•'.repeat(Math.min(v.length, 8)) : '';
    }
    return { ...r, config_masked: maskedCfg };
  });
  return NextResponse.json(masked);
}
