import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { enviarNotificacion } from '@/lib/notifications';
import type { NotifChannel } from '@/lib/notifications';
import { requireRole } from '@/lib/auth/helpers';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

  const { matchId } = await params;
  const sb = createServiceClient();

  // Cargar el match con datos del cliente y la subvención
  const { data: match, error: matchErr } = await sb
    .from('cliente_subvencion_match')
    .select(`
      id, nif, score,
      subvencion:subvencion_id (titulo, organismo, importe_maximo, plazo_fin)
    `)
    .eq('id', matchId)
    .maybeSingle();

  if (matchErr || !match) return NextResponse.json({ error: 'Match no encontrado' }, { status: 404 });

  // Cargar datos del cliente
  const { data: cliente } = await sb
    .from('cliente')
    .select('nombre_empresa, nombre_normalizado, email_normalizado, telefono')
    .eq('nif', match.nif)
    .maybeSingle();

  // Cargar canales de notificación activos
  const { data: channelsRaw } = await sb.from('notif_channels').select('*').eq('enabled', true);
  const channels: NotifChannel[] = (channelsRaw ?? []).map((c: Record<string, unknown>) => ({
    canal: c.canal as 'email' | 'whatsapp',
    provider: c.provider as string | null,
    enabled: Boolean(c.enabled),
    from_name: c.from_name as string | null,
    from_address: c.from_address as string | null,
    config: (c.config ?? {}) as Record<string, string>,
  }));

  // Intentar envío si hay canales configurados
  let notifResults: Record<string, unknown> = {};
  if (channels.length > 0 && cliente) {
    const subv = Array.isArray(match.subvencion) ? match.subvencion[0] : match.subvencion as Record<string, unknown> | null;
    const portalUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ayudapyme.es'}/portal`;

    // Normalizar teléfono a formato internacional
    let telefono = (cliente.telefono as string | null) ?? null;
    if (telefono) {
      telefono = telefono.replace(/\s/g, '');
      if (!telefono.startsWith('+')) telefono = `+34${telefono}`;
    }

    notifResults = await enviarNotificacion(channels, {
      to_email: (cliente.email_normalizado as string | null) ?? null,
      to_phone: telefono,
      cliente_nombre: (cliente.nombre_empresa as string | null) ?? (cliente.nombre_normalizado as string | null) ?? match.nif,
      subvencion_titulo: (subv?.titulo as string) ?? 'Subvención relevante',
      subvencion_organismo: (subv?.organismo as string | null) ?? null,
      importe_maximo: (subv?.importe_maximo as number | null) ?? null,
      plazo_fin: (subv?.plazo_fin as string | null) ?? null,
      score_pct: Math.round((match.score as number) * 100),
      portal_url: portalUrl,
    });
  }

  // Marcar como notificado y visto
  const { error } = await sb
    .from('cliente_subvencion_match')
    .update({
      notificado_cliente: true,
      notificado_cliente_at: new Date().toISOString(),
      estado: 'visto',
    })
    .eq('id', matchId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    canales_activos: channels.length,
    resultados: notifResults,
  });
}
