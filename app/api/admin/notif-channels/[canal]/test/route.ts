import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { enviarNotificacion } from '@/lib/notifications';
import type { NotifChannel } from '@/lib/notifications';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email?.toLowerCase().endsWith('@ayudapyme.es')) return null;
  return user;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ canal: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { canal } = await params;
  const body = await request.json().catch(() => ({}));
  const sb = createServiceClient();

  // Load channel config
  const { data: ch } = await sb.from('notif_channels').select('*').eq('canal', canal).maybeSingle();
  if (!ch) return NextResponse.json({ error: 'Canal no encontrado' }, { status: 404 });

  const channel: NotifChannel = {
    canal: ch.canal,
    provider: ch.provider,
    enabled: true, // force enabled for test
    from_name: ch.from_name,
    from_address: ch.from_address,
    config: ch.config ?? {},
  };

  const portalUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/portal`;

  // Test payload usando la dirección del admin o la que venga en el body
  const payload = {
    to_email: canal === 'email' ? (body.to ?? admin.email) : undefined,
    to_phone: canal === 'whatsapp' ? body.to : undefined,
    cliente_nombre: 'Empresa Demo SL',
    subvencion_titulo: 'Ayudas para la digitalización de PYMEs 2025',
    subvencion_organismo: 'Ministerio de Asuntos Económicos',
    importe_maximo: 12000,
    plazo_fin: new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10),
    score_pct: 78,
    portal_url: portalUrl,
  };

  const result = await enviarNotificacion([channel], payload);
  const r = canal === 'email' ? result.email : result.whatsapp;

  if (r?.ok) return NextResponse.json({ ok: true });
  return NextResponse.json({ ok: false, error: r?.error ?? 'Canal no activo' }, { status: 400 });
}
