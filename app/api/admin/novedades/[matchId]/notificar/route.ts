import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email?.toLowerCase().endsWith('@ayudapyme.es')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { matchId } = await params;
  const sb = createServiceClient();

  const { error } = await sb
    .from('cliente_subvencion_match')
    .update({ notificado_cliente: true, notificado_cliente_at: new Date().toISOString() })
    .eq('id', matchId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
