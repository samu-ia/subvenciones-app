import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireRole } from '@/lib/auth/helpers';

export async function GET() {
  const authGet = await requireRole('admin');
  if (authGet instanceof NextResponse) return authGet;

  const sb = createServiceClient();
  const { data, error } = await sb
    .from('cliente')
    .select('nif, nombre_empresa, nombre_normalizado, email_normalizado, telefono, actividad, tamano_empresa, ciudad, comunidad_autonoma, cnae_codigo, num_empleados, facturacion_anual, created_at')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const authPost = await requireRole('admin');
  if (authPost instanceof NextResponse) return authPost;

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
      cnae_codigo: body.cnae_codigo?.trim() || null,
      cnae_descripcion: body.cnae_descripcion?.trim() || null,
      num_empleados: body.num_empleados ? Number(body.num_empleados) : null,
      facturacion_anual: body.facturacion_anual ? Number(body.facturacion_anual) : null,
    })
    .select('nif')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, nif: data.nif });
}
