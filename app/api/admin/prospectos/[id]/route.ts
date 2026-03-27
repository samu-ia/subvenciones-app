/**
 * PATCH /api/admin/prospectos/[id] — actualizar prospecto
 * DELETE /api/admin/prospectos/[id] — eliminar prospecto
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireAdminOrTramitador } from '@/lib/auth/helpers';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminOrTramitador();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Body requerido' }, { status: 400 });

  const allowed = ['nombre_empresa', 'nif', 'sector', 'ciudad', 'provincia', 'telefono', 'email', 'web',
    'contacto_nombre', 'estado', 'notas', 'fecha_contacto', 'proxima_accion', 'fecha_proxima', 'potencial_eur'];

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }

  const sb = createServiceClient();
  const { data, error } = await sb.from('prospectos').update(update).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ prospecto: data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminOrTramitador();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const sb = createServiceClient();
  const { error } = await sb.from('prospectos').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
