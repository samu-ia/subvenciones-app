/**
 * lib/notifications.ts
 *
 * Envío de notificaciones reales a clientes: email (Resend) y WhatsApp (Twilio).
 * Se leen las credenciales de la tabla notif_channels.
 */

export interface NotifChannel {
  canal: 'email' | 'whatsapp';
  provider: string | null;
  enabled: boolean;
  from_name: string | null;
  from_address: string | null;
  config: Record<string, string>;
}

export interface NotifPayload {
  to_email?: string | null;
  to_phone?: string | null;          // formato internacional: +34612345678
  cliente_nombre: string;
  subvencion_titulo: string;
  subvencion_organismo?: string | null;
  importe_maximo?: number | null;
  plazo_fin?: string | null;
  score_pct: number;                 // 0-100
  portal_url: string;
}

// ─── Email (Resend) ────────────────────────────────────────────────────────────

function buildEmailHtml(p: NotifPayload): string {
  const importe = p.importe_maximo
    ? p.importe_maximo >= 1_000_000
      ? `${(p.importe_maximo / 1_000_000).toFixed(1)}M €`
      : `${(p.importe_maximo / 1_000).toFixed(0)}K €`
    : null;

  const plazo = p.plazo_fin
    ? new Date(p.plazo_fin).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
    : null;

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
    <!-- Header -->
    <div style="background:#0d1f3c;padding:28px 32px">
      <div style="display:inline-flex;align-items:center;gap:10px">
        <div style="width:36px;height:36px;background:#f97316;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:14px">AP</div>
        <span style="color:#fff;font-weight:700;font-size:17px">AyudaPyme</span>
      </div>
    </div>

    <!-- Body -->
    <div style="padding:32px">
      <p style="margin:0 0 8px;font-size:14px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Nueva oportunidad detectada</p>
      <h1 style="margin:0 0 20px;font-size:22px;font-weight:800;color:#0d1f3c;line-height:1.3">${p.subvencion_titulo}</h1>

      <!-- Score badge -->
      <div style="display:inline-flex;align-items:center;gap:8px;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:10px 16px;margin-bottom:24px">
        <span style="font-size:20px;font-weight:800;color:#f97316">${p.score_pct}%</span>
        <span style="font-size:14px;color:#f97316;font-weight:600">de encaje con tu empresa</span>
      </div>

      <!-- Datos subvención -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
        ${p.subvencion_organismo ? `<tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px;color:#94a3b8;width:130px">Organismo</td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#0d1f3c;font-weight:500">${p.subvencion_organismo}</td></tr>` : ''}
        ${importe ? `<tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px;color:#94a3b8">Importe máximo</td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#059669;font-weight:700">${importe}</td></tr>` : ''}
        ${plazo ? `<tr><td style="padding:8px 0;font-size:13px;color:#94a3b8">Plazo de solicitud</td><td style="padding:8px 0;font-size:14px;color:#0d1f3c;font-weight:500">${plazo}</td></tr>` : ''}
      </table>

      <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.6">
        Hola <strong>${p.cliente_nombre}</strong>, hemos identificado esta subvención que encaja con el perfil de tu empresa.
        Accede a tu portal para ver todos los detalles y decidir si quieres solicitarla.
      </p>

      <!-- CTA -->
      <a href="${p.portal_url}" style="display:block;text-align:center;background:#0d1f3c;color:#fff;text-decoration:none;padding:14px 24px;border-radius:10px;font-size:15px;font-weight:700;margin-bottom:24px">
        Ver subvención en mi portal →
      </a>

      <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center">
        AyudaPyme · Gestión de subvenciones para empresas
      </p>
    </div>
  </div>
</body>
</html>`;
}

async function sendEmail(channel: NotifChannel, p: NotifPayload): Promise<{ ok: boolean; error?: string }> {
  if (!p.to_email) return { ok: false, error: 'Cliente sin email' };
  const apiKey = channel.config.api_key;
  if (!apiKey) return { ok: false, error: 'Resend API key no configurada' };

  const fromName = channel.from_name || 'AyudaPyme';
  const fromAddr = channel.from_address || 'noreply@ayudapyme.es';

  const importe = p.importe_maximo
    ? (p.importe_maximo >= 1_000_000 ? `${(p.importe_maximo / 1_000_000).toFixed(1)}M €` : `${(p.importe_maximo / 1_000).toFixed(0)}K €`)
    : null;
  const subject = importe
    ? `Nueva subvención para ${p.cliente_nombre} — hasta ${importe}`
    : `Nueva subvención relevante para ${p.cliente_nombre}`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${fromName} <${fromAddr}>`,
        to: [p.to_email],
        subject,
        html: buildEmailHtml(p),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { message?: string };
      return { ok: false, error: `Resend ${res.status}: ${err?.message ?? 'error'}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `Email: ${(e as Error).message}` };
  }
}

// ─── WhatsApp (Twilio) ─────────────────────────────────────────────────────────

function buildWhatsAppText(p: NotifPayload): string {
  const importe = p.importe_maximo
    ? (p.importe_maximo >= 1_000_000 ? `${(p.importe_maximo / 1_000_000).toFixed(1)}M €` : `${(p.importe_maximo / 1_000).toFixed(0)}K €`)
    : null;

  let msg = `Hola ${p.cliente_nombre}! 👋\n\n`;
  msg += `Hemos encontrado una subvención con un *${p.score_pct}% de encaje* para tu empresa:\n\n`;
  msg += `📌 *${p.subvencion_titulo}*\n`;
  if (p.subvencion_organismo) msg += `🏛️ ${p.subvencion_organismo}\n`;
  if (importe) msg += `💰 Hasta *${importe}*\n`;
  if (p.plazo_fin) {
    const dias = Math.ceil((new Date(p.plazo_fin).getTime() - Date.now()) / 86_400_000);
    if (dias > 0) msg += `📅 Cierra en ${dias} días\n`;
  }
  msg += `\nAccede a tu portal para ver los detalles y solicitarla:\n${p.portal_url}`;
  return msg;
}

async function sendWhatsApp(channel: NotifChannel, p: NotifPayload): Promise<{ ok: boolean; error?: string }> {
  if (!p.to_phone) return { ok: false, error: 'Cliente sin teléfono' };
  const { account_sid, auth_token } = channel.config;
  if (!account_sid || !auth_token) return { ok: false, error: 'Twilio account_sid/auth_token no configurados' };

  const fromWA = channel.from_address
    ? (channel.from_address.startsWith('whatsapp:') ? channel.from_address : `whatsapp:${channel.from_address}`)
    : null;
  if (!fromWA) return { ok: false, error: 'Número WhatsApp remitente no configurado' };

  const toPhone = p.to_phone.startsWith('whatsapp:') ? p.to_phone : `whatsapp:${p.to_phone}`;

  const body = new URLSearchParams({
    From: fromWA,
    To: toPhone,
    Body: buildWhatsAppText(p),
  });

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${account_sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${account_sid}:${auth_token}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
        signal: AbortSignal.timeout(15_000),
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { message?: string };
      return { ok: false, error: `Twilio ${res.status}: ${err?.message ?? 'error'}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `WhatsApp: ${(e as Error).message}` };
  }
}

// ─── Función principal ─────────────────────────────────────────────────────────

export async function enviarNotificacion(
  channels: NotifChannel[],
  payload: NotifPayload,
): Promise<{ email?: { ok: boolean; error?: string }; whatsapp?: { ok: boolean; error?: string } }> {
  const results: { email?: { ok: boolean; error?: string }; whatsapp?: { ok: boolean; error?: string } } = {};

  const emailCh = channels.find(c => c.canal === 'email' && c.enabled);
  const waCh = channels.find(c => c.canal === 'whatsapp' && c.enabled);

  if (emailCh) results.email = await sendEmail(emailCh, payload);
  if (waCh) results.whatsapp = await sendWhatsApp(waCh, payload);

  return results;
}
