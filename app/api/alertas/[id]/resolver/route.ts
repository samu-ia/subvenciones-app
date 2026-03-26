/**
 * PATCH /api/alertas/[id]/resolver
 * Marca una alerta como resuelta. Requiere admin o tramitador.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireAdminOrTramitador } from '@/lib/auth/helpers';

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminOrTramitador();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const sb = createServiceClient();

  const { error } = await sb
    .from('alertas')
    .update({ resuelta: true, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
