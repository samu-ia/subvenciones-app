/**
 * GET  /api/admin/gestor/[nif]  — admin lee la conversación con un cliente
 * POST /api/admin/gestor/[nif]  — admin envía mensaje al cliente
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email?.toLowerCase().endsWith('@ayudapyme.es')) return null;
  return user;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ nif: string }> }
) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
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
  if (!await requireAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const { nif } = await params;

  const body = await request.json().catch(() => null);
  if (!body?.contenido?.trim()) {
    return NextResponse.json({ error: 'contenido requerido' }, { status: 400 });
  }

  const sb = createServiceClient();

  await sb.from('mensajes_gestor').insert({
    nif,
    remitente: 'gestor',
    contenido: body.contenido.trim(),
    leido: false,
  });

  const { data: mensajes } = await sb
    .from('mensajes_gestor')
    .select('id, remitente, contenido, leido, created_at')
    .eq('nif', nif)
    .order('created_at', { ascending: true })
    .limit(200);

  return NextResponse.json({ mensajes: mensajes ?? [] });
}
