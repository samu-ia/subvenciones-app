/**
 * GET|POST /api/subvenciones/process-jobs
 *
 * Procesa la cola `subvencion_reanalisis_jobs` (hasta 10 jobs pendientes).
 * Llamado desde Vercel Cron (0 7 * * * — configurado en vercel.json).
 *
 * Autenticación: header `x-vercel-cron: 1` O `Authorization: Bearer <INGEST_SECRET>`
 */

import { NextRequest, NextResponse } from 'next/server';
import { persistirEstadoCalculado } from '@/lib/subvenciones/estado-calculator';

export const maxDuration = 60;

const MAX_JOBS = 10;

async function procesarJobs(request: NextRequest): Promise<NextResponse> {
  // ── Autenticación ────────────────────────────────────────────────────────
  const authHeader = request.headers.get('authorization') ?? '';
  const secret = process.env.INGEST_SECRET;
  const token = authHeader.replace('Bearer ', '').trim();
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';

  if (!isVercelCron && (!secret || token !== secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Cliente Supabase ─────────────────────────────────────────────────────
  const { createClient: createServiceClient } = await import('@supabase/supabase-js');
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // ── Obtener jobs pendientes ──────────────────────────────────────────────
  const { data: jobs, error: fetchError } = await supabase
    .from('subvencion_reanalisis_jobs')
    .select('*')
    .eq('estado', 'pendiente')
    .order('prioridad', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(MAX_JOBS);

  if (fetchError) {
    console.error('[process-jobs] Error al obtener jobs:', fetchError);
    return NextResponse.json({ ok: false, error: fetchError.message }, { status: 500 });
  }

  const totalJobs = jobs?.length ?? 0;
  console.log(`[process-jobs] Procesando ${totalJobs} jobs pendientes`);

  if (totalJobs === 0) {
    return NextResponse.json({
      ok: true,
      procesados: 0,
      completados: 0,
      errores: 0,
      mensaje: 'No hay jobs pendientes',
    });
  }

  let completados = 0;
  let errores = 0;

  for (const job of jobs!) {
    // Marcar como procesando
    await supabase
      .from('subvencion_reanalisis_jobs')
      .update({ estado: 'procesando', iniciado_at: new Date().toISOString() })
      .eq('id', job.id);

    let nuevoEstado: 'completado' | 'error' = 'completado';
    let errorMsg: string | null = null;

    try {
      if (job.tipo_job === 'solo_estado') {
        // Obtener datos actuales de la subvención
        const { data: sub, error: subError } = await supabase
          .from('subvenciones')
          .select('id, bdns_id, plazo_inicio, plazo_fin, fecha_publicacion')
          .eq('id', job.subvencion_id)
          .single();

        if (subError || !sub) {
          throw new Error(`Subvención no encontrada: ${job.subvencion_id}`);
        }

        // Obtener eventos
        const { data: eventos } = await supabase
          .from('subvencion_eventos')
          .select('tipo_evento, fecha_evento, fecha_evento_fin')
          .eq('subvencion_id', job.subvencion_id);

        await persistirEstadoCalculado(
          supabase,
          sub.id,
          sub.bdns_id,
          {
            plazo_inicio: sub.plazo_inicio ?? null,
            plazo_fin: sub.plazo_fin ?? null,
            fecha_publicacion: sub.fecha_publicacion ?? null,
            eventos: (eventos ?? []).map((e) => ({
              tipo_evento: e.tipo_evento,
              fecha_evento: e.fecha_evento,
              fecha_evento_fin: e.fecha_evento_fin,
            })),
          },
        );

        console.log(`[process-jobs] Job ${job.id} (solo_estado) completado para ${job.bdns_id}`);
        completados++;
      } else {
        // reanalisis_completo | solo_ia | solo_documentos — requieren pipeline completo
        throw new Error(
          'Reprocesado completo requiere ejecución manual vía POST /api/subvenciones/ingest con forzarReanalisis=true'
        );
      }
    } catch (err) {
      nuevoEstado = 'error';
      errorMsg = err instanceof Error ? err.message : String(err);
      errores++;
      console.error(`[process-jobs] Error en job ${job.id} (${job.tipo_job}):`, errorMsg);
    }

    // Actualizar el job con el resultado
    await supabase
      .from('subvencion_reanalisis_jobs')
      .update({
        estado: nuevoEstado,
        completado_at: new Date().toISOString(),
        intentos: (job.intentos ?? 0) + 1,
        ...(errorMsg ? { error_msg: errorMsg } : {}),
      })
      .eq('id', job.id);
  }

  console.log(
    `[process-jobs] Finalizado — procesados: ${totalJobs}, completados: ${completados}, errores: ${errores}`
  );

  return NextResponse.json({ ok: true, procesados: totalJobs, completados, errores });
}

export async function GET(request: NextRequest) {
  return procesarJobs(request);
}

export async function POST(request: NextRequest) {
  return procesarJobs(request);
}
