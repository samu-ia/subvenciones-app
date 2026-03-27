/**
 * GET  /api/admin/prospectos — lista prospectos con filtros
 * POST /api/admin/prospectos — crear nuevo prospecto
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireAdminOrTramitador } from '@/lib/auth/helpers';

export async function GET(request: NextRequest) {
  const auth = await requireAdminOrTramitador();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const estado = searchParams.get('estado');
  const sector = searchParams.get('sector');
  const q = searchParams.get('q');

  const sb = createServiceClient();
  let query = sb
    .from('prospectos')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(200);

  if (estado) query = query.eq('estado', estado);
  if (sector) query = query.eq('sector', sector);
  if (q) query = query.or(`nombre_empresa.ilike.%${q}%,contacto_nombre.ilike.%${q}%,ciudad.ilike.%${q}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ prospectos: data ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminOrTramitador();
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  if (!body?.nombre_empresa) return NextResponse.json({ error: 'nombre_empresa requerido' }, { status: 400 });

  const sb = createServiceClient();
  const { data, error } = await sb.from('prospectos').insert({
    nombre_empresa: body.nombre_empresa,
    nif: body.nif ?? null,
    sector: body.sector ?? null,
    ciudad: body.ciudad ?? null,
    provincia: body.provincia ?? null,
    telefono: body.telefono ?? null,
    email: body.email ?? null,
    web: body.web ?? null,
    contacto_nombre: body.contacto_nombre ?? null,
    estado: body.estado ?? 'nuevo',
    notas: body.notas ?? null,
    fecha_contacto: body.fecha_contacto ?? null,
    proxima_accion: body.proxima_accion ?? null,
    fecha_proxima: body.fecha_proxima ?? null,
    potencial_eur: body.potencial_eur ?? null,
    origen: body.origen ?? 'manual',
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ prospecto: data }, { status: 201 });
}
