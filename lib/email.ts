/**
 * lib/email.ts
 *
 * Helper de resolución de API key de Resend y envío de emails transaccionales.
 * Estrategia de resolución:
 *   1. process.env.RESEND_API_KEY
 *   2. tabla notif_channels (canal='email', provider='resend')
 *   3. null → falla silenciosamente
 */

import { createServiceClient } from '@/lib/supabase/service';

export interface TransactionalEmailParams {
  to: string;
  subject: string;
  html: string;
  fromName?: string;
  fromAddress?: string;
}

/**
 * Resuelve la API key de Resend desde env o DB.
 * Retorna null si no está configurada.
 */
export async function resolveResendKey(): Promise<string | null> {
  // 1. Variable de entorno (más rápido, no requiere DB)
  if (process.env.RESEND_API_KEY) {
    return process.env.RESEND_API_KEY;
  }

  // 2. Buscar en tabla notif_channels
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from('notif_channels')
      .select('config')
      .eq('canal', 'email')
      .eq('provider', 'resend')
      .eq('enabled', true)
      .maybeSingle();

    const apiKey = (data?.config as Record<string, string> | null)?.api_key ?? null;
    return apiKey || null;
  } catch {
    return null;
  }
}

/**
 * Envía un email transaccional usando la API de Resend.
 * Nunca lanza excepciones — siempre retorna { ok, error? }.
 */
export async function sendTransactionalEmail(
  params: TransactionalEmailParams,
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = await resolveResendKey();

  if (!apiKey) {
    console.log('[email] RESEND_API_KEY no configurada, saltando envío');
    return { ok: false, error: 'Email no configurado' };
  }

  const fromName = params.fromName ?? 'AyudaPyme';
  const fromAddress = params.fromAddress ?? 'noreply@ayudapyme.es';

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${fromName} <${fromAddress}>`,
        to: [params.to],
        subject: params.subject,
        html: params.html,
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
