/**
 * GET|POST /api/subvenciones/refresh-estados
 *
 * Recorre todas las subvenciones con estado abierta/proxima/desconocido
 * y recalcula su estado usando el estado-calculator (basado en fechas y eventos).
 *
 * Llamable desde:
 *  - Vercel Cron Job (GET con Authorization: Bearer <INGEST_SECRET>)
 *  - Panel de administración (POST con sesión admin)
 *
 * Seguridad: requiere header Authorization: Bearer <INGEST_SECRET> o sesión admin.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/helpers';
import { persistirEstadoCalculado } from '@/lib/subvenciones/estado-calculator';
import type { SupabaseClient } from '@supabase/supabase-js';

export const maxDuration = 300; // 5 minutos

const BATCH_SIZE = 50;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ejecutarRefresh(supabase: SupabaseClient<any>) {
  const inicio = Date.now();

  // Obtener todas las subvenciones con estado que puede cambiar
  const { data: subvenciones, error } = await supabase
    .from('subvenciones')
    .select('id, bdns_id, plazo_inicio, plazo_fin, fecha_publicacion')
    .in('estado_convocatoria', ['abierta', 'proxima', 'desconocido']);

  if (error) throw new Error(`Error consultando subvenciones: ${error.message}`);

  const total = subvenciones?.length ?? 0;
  let actualizadas = 0;

  // Procesar en lotes de BATCH_SIZE
  for (let i = 0; i < total; i += BATCH_SIZE) {
    const lote = (subvenciones ?? []).slice(i, i + BATCH_SIZE);

    await Promise.all(
      lote.map(async (sub) => {
        try {
          // Obtener eventos para esta subvención
          const { data: eventos } = await supabase
            .from('subvencion_eventos')
            .select('tipo_evento, fecha_evento, fecha_evento_fin')
            .eq('bdns_id', sub.bdns_id);

          // Obtener estado anterior para detectar si cambia
          const { data: estadoAnterior } = await supabase
            .from('subvencion_estado_calculado')
            .select('estado')
            .eq('subvencion_id', sub.id)
            .maybeSingle();

          const resultado = await persistirEstadoCalculado(supabase, sub.id, sub.bdns_id, {
            plazo_inicio: sub.plazo_inicio ?? null,
            plazo_fin: sub.plazo_fin ?? null,
            fecha_publicacion: sub.fecha_publicacion ?? null,
            eventos: eventos ?? [],
          });

          // Contar como actualizada si el estado calculado difiere del anterior
          if (!estadoAnterior || estadoAnterior.estado !== resultado.estado) {
            actualizadas++;
          }
        } catch (err) {
          console.warn(`[RefreshEstados] Error procesando ${sub.bdns_id}:`, err);
        }
      })
    );
  }

  const duracion_ms = Date.now() - inicio;
  return { total, actualizadas, duracion_ms };
}

export async function POST(request: NextRequest) {
  // Autenticación: Bearer INGEST_SECRET o sesión admin
  const authHeader = request.headers.get('authorization') ?? '';
  const secret = process.env.INGEST_SECRET;
  const token = authHeader.replace('Bearer ', '').trim();
  const secretOk = secret && token === secret;

  if (!secretOk) {
    const authResult = await requireRole('admin');
    if (authResult instanceof NextResponse) return authResult;
  }

  try {
    const { createClient: createServiceClient } = await import('@supabase/supabase-js');
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    console.log('[RefreshEstados] Iniciando refresh de estados...');
    const { total, actualizadas, duracion_ms } = await ejecutarRefresh(supabase);
    console.log(`[RefreshEstados] Completado: ${total} procesadas, ${actualizadas} actualizadas en ${duracion_ms}ms`);

    return NextResponse.json({ ok: true, total, actualizadas, duracion_ms });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[RefreshEstados] Error fatal:', err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// GET para Vercel Cron Jobs (llaman GET con Authorization: Bearer <CRON_SECRET>)
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization') ?? '';
  const secret = process.env.INGEST_SECRET;
  const token = authHeader.replace('Bearer ', '').trim();
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';

  if (!isVercelCron && (!secret || token !== secret)) {
    return NextResponse.json({
      ok: true,
      endpoint: 'POST /api/subvenciones/refresh-estados',
      descripcion: 'Recalcula el estado de todas las subvenciones abiertas/proximas/desconocidas. Requiere Authorization: Bearer <INGEST_SECRET>',
    });
  }

  try {
    const { createClient: createServiceClient } = await import('@supabase/supabase-js');
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    console.log('[RefreshEstados] Cron: iniciando refresh de estados...');
    const { total, actualizadas, duracion_ms } = await ejecutarRefresh(supabase);
    console.log(`[RefreshEstados] Cron completado: ${total} procesadas, ${actualizadas} actualizadas en ${duracion_ms}ms`);

    return NextResponse.json({ ok: true, total, actualizadas, duracion_ms });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
