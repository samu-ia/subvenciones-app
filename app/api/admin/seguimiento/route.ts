/**
 * POST /api/admin/seguimiento
 * Envía email de seguimiento a clientes sin actividad en N días.
 * Uso: llamar desde un cron job o manualmente desde el dashboard.
 *
 * Body: { dias?: number } — por defecto 3 días
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireAdminOrTramitador } from '@/lib/auth/helpers';
import { sendTransactionalEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  const auth = await requireAdminOrTramitador();
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  const dias = Number(body.dias ?? 3);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ayudapyme.es';

  const sb = createServiceClient();

  // Fecha límite: hace N días
  const fechaLimite = new Date();
  fechaLimite.setDate(fechaLimite.getDate() - dias);
  const fechaLimiteStr = fechaLimite.toISOString();

  // Buscar perfiles de clientes que no han enviado mensajes en N días
  // y que tienen matches pero no han iniciado ningún expediente
  const { data: perfiles } = await sb
    .from('perfiles')
    .select('id, nif')
    .eq('rol', 'cliente')
    .not('nif', 'is', null);

  if (!perfiles || perfiles.length === 0) {
    return NextResponse.json({ enviados: 0, mensaje: 'No hay clientes' });
  }

  // Filtrar: clientes con matches pero sin expediente activo y sin mensajes recientes
  const { data: { users } } = await sb.auth.admin.listUsers();
  const userMap = Object.fromEntries(users.map(u => [u.id, u.email]));

  let enviados = 0;
  const errores: string[] = [];

  for (const perfil of perfiles) {
    if (!perfil.nif) continue;

    // ¿Tiene expediente activo?
    const { count: expCount } = await sb
      .from('expediente')
      .select('id', { count: 'exact', head: true })
      .eq('nif', perfil.nif)
      .not('fase', 'in', '("denegada","desistida","cobro")');

    if (expCount && expCount > 0) continue; // Ya tiene expediente activo, no molestar

    // ¿Ha enviado mensajes recientemente?
    const { count: msgCount } = await sb
      .from('mensajes_gestor')
      .select('id', { count: 'exact', head: true })
      .eq('nif', perfil.nif)
      .eq('remitente', 'cliente')
      .gte('created_at', fechaLimiteStr);

    if (msgCount && msgCount > 0) continue; // Activo recientemente

    // ¿Tiene matches para mostrar?
    const { data: matches } = await sb
      .from('cliente_subvencion_match')
      .select('score, subvencion:subvenciones(titulo, importe_maximo)')
      .eq('cliente_id', perfil.nif)
      .gte('score', 0.4)
      .order('score', { ascending: false })
      .limit(3);

    if (!matches || matches.length === 0) continue;

    // ¿Cuándo fue creado el perfil? Si tiene menos de 1 día, skip
    const { data: clienteData } = await sb
      .from('cliente')
      .select('nombre_empresa, created_at')
      .eq('nif', perfil.nif)
      .maybeSingle();

    if (!clienteData) continue;

    const createdAt = new Date(clienteData.created_at ?? 0);
    const diasDesdeRegistro = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (diasDesdeRegistro < 1) continue; // Muy nuevo, no spam

    // Obtener email del usuario
    const email = userMap[perfil.id];
    if (!email) continue;

    const nombre = clienteData.nombre_empresa ?? perfil.nif;
    const mejorMatch = matches[0];
    const subv = mejorMatch?.subvencion as { titulo?: string; importe_maximo?: number } | null;
    const importe = subv?.importe_maximo
      ? subv.importe_maximo >= 1_000_000
        ? `${(subv.importe_maximo / 1_000_000).toFixed(1)}M €`
        : `${(subv.importe_maximo / 1_000).toFixed(0)}K €`
      : null;

    const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden">
  <div style="background:#0d1f3c;padding:28px 32px">
    <span style="color:#fff;font-weight:800;font-size:17px">AyudaPyme</span>
  </div>
  <div style="padding:32px">
    <h2 style="color:#0d1f3c;font-size:1.3rem;margin:0 0 16px">Hola${nombre ? `, ${nombre}` : ''} 👋</h2>
    <p style="color:#475569;line-height:1.7;margin:0 0 20px">
      Llevamos ${dias} días sin saber de ti. ¿Todo bien con tu solicitud?
    </p>
    <p style="color:#475569;line-height:1.7;margin:0 0 20px">
      Recuerda que tienes <strong>${matches.length} subvenciones detectadas</strong> para tu empresa${subv?.titulo ? `, incluyendo <em>${subv.titulo}</em>${importe ? ` (hasta ${importe})` : ''}` : ''}.
    </p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin:0 0 28px;text-align:center">
      <p style="color:#166534;font-size:0.9rem;margin:0 0 16px;font-weight:600">
        ¿Necesitas ayuda? Nuestro equipo está a tu disposición.
      </p>
      <a href="${siteUrl}/portal" style="display:inline-block;background:#059669;color:#fff;padding:12px 28px;border-radius:10px;font-weight:700;text-decoration:none;font-size:0.9rem">
        Ver mis subvenciones →
      </a>
    </div>
    <p style="color:#94a3b8;font-size:0.8rem;margin:0">
      Tu equipo de AyudaPyme · Trabajamos solo si consigues la subvención (éxito fee).
    </p>
  </div>
</div>
</body></html>`;

    try {
      await sendTransactionalEmail({
        to: email,
        subject: `¿Seguimos? Tienes ${matches.length} subvenciones pendientes de revisar`,
        html,
      });
      enviados++;
    } catch (e) {
      errores.push(`${email}: ${(e as Error).message}`);
    }
  }

  return NextResponse.json({
    enviados,
    errores: errores.length > 0 ? errores : undefined,
    mensaje: `${enviados} emails de seguimiento enviados (clientes sin actividad en ${dias} días)`,
  });
}

/**
 * GET /api/admin/seguimiento — clientes candidatos para seguimiento (previsualización sin enviar)
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdminOrTramitador();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const dias = Number(searchParams.get('dias') ?? 3);

  const sb = createServiceClient();
  const fechaLimite = new Date();
  fechaLimite.setDate(fechaLimite.getDate() - dias);

  // Clientes con matches pero sin mensajes recientes
  const { data: perfiles } = await sb
    .from('perfiles')
    .select('id, nif')
    .eq('rol', 'cliente')
    .not('nif', 'is', null);

  const candidatos: Array<{ nif: string; nombre: string; matches: number; diasDesdeRegistro: number }> = [];

  for (const perfil of perfiles ?? []) {
    if (!perfil.nif) continue;

    const { count: expCount } = await sb.from('expediente').select('id', { count: 'exact', head: true }).eq('nif', perfil.nif);
    if (expCount && expCount > 0) continue;

    const { count: msgCount } = await sb.from('mensajes_gestor').select('id', { count: 'exact', head: true })
      .eq('nif', perfil.nif).eq('remitente', 'cliente').gte('created_at', fechaLimite.toISOString());
    if (msgCount && msgCount > 0) continue;

    const { count: matchCount } = await sb.from('cliente_subvencion_match').select('id', { count: 'exact', head: true })
      .eq('cliente_id', perfil.nif).gte('score', 0.4);
    if (!matchCount || matchCount === 0) continue;

    const { data: c } = await sb.from('cliente').select('nombre_empresa, created_at').eq('nif', perfil.nif).maybeSingle();
    const dias2 = c?.created_at ? (Date.now() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24) : 0;
    if (dias2 < 1) continue;

    candidatos.push({ nif: perfil.nif, nombre: c?.nombre_empresa ?? perfil.nif, matches: matchCount, diasDesdeRegistro: Math.round(dias2) });
  }

  return NextResponse.json({ candidatos, total: candidatos.length });
}
