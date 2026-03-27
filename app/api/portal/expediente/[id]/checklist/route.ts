/**
 * PATCH /api/portal/expediente/[id]/checklist
 * Marca un item del checklist como completado.
 * Usa service_role para evitar problemas de RLS.
 * Solo el cliente propietario del expediente puede llamar esto.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: expedienteId } = await params;

  // Auth: verificar cliente autenticado
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const sb = createServiceClient();

  // Verificar que el cliente es propietario del expediente
  const { data: perfil } = await sb.from('perfiles').select('nif, rol').eq('id', user.id).maybeSingle();
  if (!perfil?.nif || perfil.rol !== 'cliente') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { data: expediente } = await sb
    .from('expediente')
    .select('id, nif')
    .eq('id', expedienteId)
    .eq('nif', perfil.nif)
    .maybeSingle();

  if (!expediente) return NextResponse.json({ error: 'Expediente no encontrado' }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body?.item_id) return NextResponse.json({ error: 'item_id requerido' }, { status: 400 });

  // Verificar que el item pertenece al expediente
  const { data: item } = await sb
    .from('checklist_items')
    .select('id, expediente_id')
    .eq('id', body.item_id)
    .eq('expediente_id', expedienteId)
    .maybeSingle();

  if (!item) return NextResponse.json({ error: 'Item no encontrado' }, { status: 404 });

  // Actualizar con service_role (evita bloqueos RLS)
  const updateData: Record<string, unknown> = {
    completado: body.completado ?? true,
  };
  if (body.storage_path) updateData.notas = `Archivo: ${body.storage_path}`;

  const { error } = await sb
    .from('checklist_items')
    .update(updateData)
    .eq('id', body.item_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
