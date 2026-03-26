import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireRole, requireAdminOrTramitador } from '@/lib/auth/helpers';

export async function GET() {
  const authGet = await requireAdminOrTramitador();
  if (authGet instanceof NextResponse) return authGet;

  const sb = createServiceClient();
  const { data, error } = await sb
    .from('reuniones')
    .select('id, cliente_nif, titulo, tipo, estado, fecha_programada, cliente:cliente_nif(nombre_empresa, nombre_normalizado)')
    .order('fecha_programada', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const authPost = await requireRole('admin');
  if (authPost instanceof NextResponse) return authPost;

  const body = await request.json().catch(() => null);
  if (!body?.cliente_nif || !body?.titulo) {
    return NextResponse.json({ error: 'cliente_nif y titulo son obligatorios' }, { status: 400 });
  }

  const sb = createServiceClient();
  const { data, error } = await sb
    .from('reuniones')
    .insert({
      cliente_nif: body.cliente_nif,
      titulo: body.titulo,
      tipo: body.tipo ?? 'exploratoria',
      fecha_programada: body.fecha_programada ? new Date(body.fecha_programada).toISOString() : null,
      duracion_minutos: body.duracion_minutos ?? 60,
      objetivo: body.objetivo ?? null,
      estado: 'pendiente',
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
