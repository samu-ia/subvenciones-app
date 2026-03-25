import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email?.toLowerCase().endsWith('@ayudapyme.es')) return null;
  return user;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ canal: string }> }
) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const { canal } = await params;
  const body = await request.json().catch(() => ({}));
  const sb = createServiceClient();

  // Read existing config to merge (don't overwrite keys not sent)
  const { data: existing } = await sb.from('notif_channels').select('config').eq('canal', canal).maybeSingle();
  const existingConfig = (existing?.config ?? {}) as Record<string, string>;

  // Merge new config values (skip empty string values = keep existing)
  const newConfig = (body.config ?? {}) as Record<string, string>;
  const mergedConfig: Record<string, string> = { ...existingConfig };
  for (const [k, v] of Object.entries(newConfig)) {
    if (v !== '' && !String(v).includes('•')) {  // skip masked/empty values
      mergedConfig[k] = v;
    }
  }

  const update: Record<string, unknown> = {
    config: mergedConfig,
    updated_at: new Date().toISOString(),
  };
  if (body.enabled !== undefined) update.enabled = body.enabled;
  if (body.from_name !== undefined) update.from_name = body.from_name;
  if (body.from_address !== undefined) update.from_address = body.from_address;
  if (body.provider !== undefined) update.provider = body.provider;

  const { error } = await sb.from('notif_channels')
    .upsert({ canal, ...update }, { onConflict: 'canal' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
