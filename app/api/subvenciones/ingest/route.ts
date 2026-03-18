/**
 * POST /api/subvenciones/ingest
 *
 * Endpoint que lanza el pipeline de ingestión BDNS.
 * Llamable desde:
 *  - Railway Cron Job:  POST https://app.railway.app/api/subvenciones/ingest
 *  - GitHub Actions scheduled workflow
 *  - Panel de administración (manualmente)
 *
 * Seguridad: requiere header Authorization: Bearer <INGEST_SECRET>
 * Configura INGEST_SECRET en las variables de entorno de Railway.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ejecutarPipeline } from '@/lib/subvenciones/pipeline';
import type { PipelineOptions } from '@/lib/types/subvenciones-pipeline';

export const maxDuration = 300; // 5 minutos (máximo Railway Pro)

export async function POST(request: NextRequest) {
  // ── Autenticación ─────────────────────────────────────────────────────────
  const authHeader = request.headers.get('authorization') ?? '';
  const secret = process.env.INGEST_SECRET;

  if (secret) {
    const token = authHeader.replace('Bearer ', '').trim();
    if (token !== secret) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
  } else {
    // Si no hay INGEST_SECRET, solo admins autenticados pueden lanzarlo
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
  }

  // ── Parámetros opcionales en body ─────────────────────────────────────────
  let opciones: PipelineOptions = {};
  try {
    const body = await request.json().catch(() => ({}));
    opciones = {
      fechaDesde: body.fechaDesde,
      fechaHasta: body.fechaHasta,
      limite: body.limite ? Number(body.limite) : undefined,
      soloNuevas: body.soloNuevas ?? false,
      forzarReextraccion: body.forzarReextraccion ?? false,
      forzarReanalisis: body.forzarReanalisis ?? false,
      organo: body.organo,
    };
  } catch { /* usar opciones por defecto */ }

  // ── Ejecutar pipeline ─────────────────────────────────────────────────────
  try {
    // Usar createClient con service_role para escritura sin restricciones RLS
    // En Next.js el server client usa las cookies del user. Para el cron,
    // necesitamos el service client.
    const { createClient: createServiceClient } = await import('@supabase/supabase-js');
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    console.log('[Ingest] Iniciando pipeline con opciones:', opciones);
    const resultado = await ejecutarPipeline(supabase, opciones);

    console.log('[Ingest] Pipeline completado:', resultado);

    return NextResponse.json({
      ok: true,
      resultado,
      mensaje: `Pipeline completado: ${resultado.nuevas} nuevas, ${resultado.actualizadas} actualizadas, ${resultado.errores} errores`,
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Ingest] Error fatal en pipeline:', err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// GET para verificar que el endpoint está vivo (Railway health checks)
export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: 'POST /api/subvenciones/ingest',
    descripcion: 'Lanza el pipeline de ingestión BDNS. Requiere Authorization: Bearer <INGEST_SECRET>',
  });
}
