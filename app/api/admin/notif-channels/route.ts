import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireRole } from '@/lib/auth/helpers';

export async function GET() {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;
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
    return { ...r, config: undefined, config_masked: maskedCfg };
  });
  return NextResponse.json(masked);
}
