import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email?.endsWith('@ayudapyme.es')) return null;
  return user;
}

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const sb = createServiceClient();
  const { data, error } = await sb
    .from('cliente')
    .select('nif, nombre_empresa, nombre_normalizado, email_normalizado, telefono, actividad, tamano_empresa, ciudad, comunidad_autonoma, cnae_codigo, num_empleados, facturacion_anual, origen, created_at')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body?.nif) return NextResponse.json({ error: 'NIF requerido' }, { status: 400 });

  const nombre = (body.nombre_empresa ?? '').trim() || null;
  const sb = createServiceClient();

  const { data, error } = await sb
    .from('cliente')
    .insert({
      nif: body.nif.toUpperCase().trim(),
      nombre_empresa: nombre,
      nombre_normalizado: nombre,
      email_normalizado: body.email_normalizado?.trim() || null,
      telefono: body.telefono?.trim() || null,
      tamano_empresa: body.tamano_empresa || null,
      actividad: body.actividad?.trim() || null,
      domicilio_fiscal: body.domicilio_fiscal?.trim() || null,
      codigo_postal: body.codigo_postal?.trim() || null,
      ciudad: body.ciudad?.trim() || null,
      comunidad_autonoma: body.comunidad_autonoma?.trim() || null,
      origen: body.origen?.trim() || null,
      acepta_terminos: body.acepta_terminos ?? false,
    })
    .select('nif')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, nif: data.nif });
}
