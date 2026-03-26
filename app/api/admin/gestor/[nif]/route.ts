/**
 * GET  /api/admin/gestor/[nif]  — admin lee la conversación con un cliente
 * POST /api/admin/gestor/[nif]  — admin envía mensaje al cliente
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireRole } from '@/lib/auth/helpers';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ nif: string }> }
) {
  const authGet = await requireRole('admin');
  if (authGet instanceof NextResponse) return authGet;
  const { nif } = await params;

  const sb = createServiceClient();

  const { data: mensajes, error } = await sb
    .from('mensajes_gestor')
    .select('id, remitente, contenido, leido, created_at')
    .eq('nif', nif)
    .order('created_at', { ascending: true })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Marcar mensajes del cliente como leídos por el admin
  await sb.from('mensajes_gestor')
    .update({ leido: true })
    .eq('nif', nif)
    .eq('remitente', 'cliente')
    .eq('leido', false);

  return NextResponse.json({ mensajes: mensajes ?? [] });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ nif: string }> }
) {
  const authPost = await requireRole('admin');
  if (authPost instanceof NextResponse) return authPost;
  const { nif } = await params;

  const contentType = request.headers.get('content-type') ?? '';
  let contenido = '';
  let adjuntoNombre: string | null = null;

  if (contentType.includes('multipart/form-data')) {
    const fd = await request.formData().catch(() => null);
    contenido = (fd?.get('contenido') as string | null)?.trim() ?? '';
    const adjunto = fd?.get('adjunto') as File | null;
    if (adjunto) adjuntoNombre = adjunto.name;
    if (!contenido && adjuntoNombre) contenido = `[Archivo adjunto: ${adjuntoNombre}]`;
  } else {
    const body = await request.json().catch(() => null);
    contenido = body?.contenido?.trim() ?? '';
  }

  if (!contenido) {
    return NextResponse.json({ error: 'contenido requerido' }, { status: 400 });
  }

  const sb = createServiceClient();

  await sb.from('mensajes_gestor').insert({
    nif,
    remitente: 'gestor',
    contenido,
    leido: false,
    ...(adjuntoNombre ? { metadata: { adjunto_nombre: adjuntoNombre } } : {}),
  });

  const { data: mensajes } = await sb
    .from('mensajes_gestor')
    .select('id, remitente, contenido, leido, created_at')
    .eq('nif', nif)
    .order('created_at', { ascending: true })
    .limit(200);

  return NextResponse.json({ mensajes: mensajes ?? [] });
}
