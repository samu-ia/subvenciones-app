import { NextRequest, NextResponse } from 'next/server';
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
  const { data, error } = await sb
    .from('reuniones')
    .select('id, cliente_nif, titulo, tipo, estado, fecha_programada, cliente:cliente_nif(nombre_empresa, nombre_normalizado)')
    .order('fecha_programada', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

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
