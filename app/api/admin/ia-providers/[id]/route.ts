import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  if (!user.email?.endsWith('@ayudapyme.es')) return null;
  return user;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const sb = createServiceClient();

  const update: Record<string, unknown> = {};
  if ('api_key' in body) update.api_key = body.api_key;
  if ('enabled' in body) update.enabled = body.enabled;
  if ('base_url' in body) update.base_url = body.base_url;

  const { error } = await sb.from('ia_providers').update(update).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
