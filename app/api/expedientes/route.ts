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
    .from('expediente')
    .select('id, nif, numero_bdns, estado, titulo, fase, plazo_solicitud, plazo_aceptacion, plazo_justificacion, created_at, cliente:nif(nombre_empresa, nombre_normalizado)')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body?.nif) return NextResponse.json({ error: 'nif es obligatorio' }, { status: 400 });

  const sb = createServiceClient();
  const { data, error } = await sb
    .from('expediente')
    .insert({
      nif: body.nif,
      estado: body.estado ?? 'en_tramitacion',
      titulo: body.titulo ?? null,
      organismo: body.organismo ?? null,
      notas: body.notas ?? null,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
