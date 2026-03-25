import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email?.endsWith('@ayudapyme.es')) return null;
  return user;
}

export async function POST(request: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

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
