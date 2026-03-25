/**
 * GET /api/admin/gestor
 * Lista todas las conversaciones con clientes, con conteo de no leídos.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email?.toLowerCase().endsWith('@ayudapyme.es')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const sb = createServiceClient();

  // Obtener todos los mensajes agrupados por nif
  const { data: mensajes, error } = await sb
    .from('mensajes_gestor')
    .select('nif, remitente, contenido, leido, created_at')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Obtener nombres de clientes con mensajes
  const nifs = [...new Set((mensajes ?? []).map((m: Record<string, unknown>) => m.nif as string))];

  if (nifs.length === 0) return NextResponse.json({ conversaciones: [] });

  const { data: clientes } = await sb
    .from('cliente')
    .select('nif, nombre_empresa, nombre_normalizado, ciudad')
    .in('nif', nifs);

  const clienteMap = Object.fromEntries(
    (clientes ?? []).map((c: Record<string, unknown>) => [c.nif, c])
  );

  // Agrupar por nif
  type ConvMap = Record<string, { nif: string; ultimo: string; preview: string; no_leidos: number }>;
  const convMap: ConvMap = {};
  for (const m of (mensajes ?? []) as Array<Record<string, unknown>>) {
    const nif = m.nif as string;
    if (!convMap[nif]) {
      convMap[nif] = { nif, ultimo: m.created_at as string, preview: m.contenido as string, no_leidos: 0 };
    }
    // No leídos: mensajes del cliente que el admin no ha leído
    if (m.remitente === 'cliente' && !m.leido) {
      convMap[nif].no_leidos++;
    }
  }

  const conversaciones = Object.values(convMap).map(c => ({
    ...c,
    cliente: clienteMap[c.nif] ?? { nif: c.nif },
  })).sort((a, b) => new Date(b.ultimo).getTime() - new Date(a.ultimo).getTime());

  return NextResponse.json({ conversaciones });
}
