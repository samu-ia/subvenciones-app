/**
 * POST /api/subvenciones/catalogo/[id]/reprocesar
 *
 * Encola un job de reanálisis para la subvención indicada.
 * Solo admins. El pipeline lo procesa en el siguiente run o bajo demanda.
 *
 * Body (opcional):
 *   { tipo_job?: 'reanalisis_completo' | 'solo_ia' | 'solo_estado' | 'solo_documentos', motivo?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    // Solo admins
    const { data: perfil } = await supabase
      .from('perfiles').select('rol').eq('id', user.id).maybeSingle();
    if (perfil?.rol !== 'admin') {
      return NextResponse.json({ error: 'Solo administradores' }, { status: 403 });
    }

    // Verificar que existe la subvención
    const { data: subv } = await supabase
      .from('subvenciones').select('id, bdns_id, titulo').eq('id', id).maybeSingle();
    if (!subv) return NextResponse.json({ error: 'Subvención no encontrada' }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const tipo_job = body.tipo_job ?? 'reanalisis_completo';
    const motivo = body.motivo ?? 'Solicitado manualmente desde el panel';

    // Verificar si ya hay un job pendiente del mismo tipo
    const { data: jobExistente } = await supabase
      .from('subvencion_reanalisis_jobs')
      .select('id')
      .eq('subvencion_id', id)
      .eq('tipo_job', tipo_job)
      .in('estado', ['pendiente', 'procesando'])
      .maybeSingle();

    if (jobExistente) {
      return NextResponse.json({
        ok: false,
        message: 'Ya existe un job pendiente de este tipo para esta subvención.',
        job_id: jobExistente.id,
      });
    }

    // Crear job
    const serviceSupabase = createServiceClient();
    const { data: job, error } = await serviceSupabase
      .from('subvencion_reanalisis_jobs')
      .insert({
        subvencion_id: id,
        bdns_id: subv.bdns_id,
        tipo_job,
        motivo,
        solicitado_por: user.id,
        estado: 'pendiente',
        prioridad: 2, // alta prioridad para solicitudes manuales
      })
      .select('id')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Si se pide inmediato, disparar el reprocesado ahora mismo
    // (solo disponible cuando el servidor lo permite)
    if (body.inmediato === true) {
      // Importar y ejecutar el pipeline de reprocesado en background
      // sin bloquear la respuesta
      procesarJobEnBackground(id, subv.bdns_id, tipo_job, serviceSupabase).catch(console.error);
    }

    return NextResponse.json({
      ok: true,
      job_id: job.id,
      tipo_job,
      message: `Job de reanálisis creado para "${subv.titulo}".`,
      inmediato: body.inmediato === true,
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── Procesado inmediato en background ───────────────────────────────────────

async function procesarJobEnBackground(
  subvencionId: string,
  bdnsId: string,
  tipoJob: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<void> {
  try {
    // Marcar como procesando
    await supabase
      .from('subvencion_reanalisis_jobs')
      .update({ estado: 'procesando', iniciado_at: new Date().toISOString() })
      .eq('subvencion_id', subvencionId)
      .eq('tipo_job', tipoJob)
      .eq('estado', 'pendiente');

    if (tipoJob === 'solo_estado') {
      // Recalcular solo el estado
      const { persistirEstadoCalculado } = await import('@/lib/subvenciones/estado-calculator');
      const { data: subv } = await supabase
        .from('subvenciones')
        .select('plazo_inicio, plazo_fin, fecha_publicacion')
        .eq('id', subvencionId)
        .single();

      const { data: eventos } = await supabase
        .from('subvencion_eventos')
        .select('tipo_evento, fecha_evento, fecha_evento_fin')
        .eq('subvencion_id', subvencionId);

      if (subv) {
        await persistirEstadoCalculado(supabase, subvencionId, bdnsId, {
          plazo_inicio: subv.plazo_inicio,
          plazo_fin: subv.plazo_fin,
          fecha_publicacion: subv.fecha_publicacion,
          eventos: eventos ?? [],
        });
      }
    } else {
      // Para jobs más complejos (reanalisis_completo, solo_ia, solo_documentos)
      // simplemente llamamos al pipeline con forzarReanalisis=true para esa subvención
      const { ejecutarPipelineSubvencion } = await import('@/lib/subvenciones/pipeline-single');
      await ejecutarPipelineSubvencion(supabase, bdnsId, { forzarReanalisis: true });
    }

    // Marcar completado
    await supabase
      .from('subvencion_reanalisis_jobs')
      .update({ estado: 'completado', completado_at: new Date().toISOString() })
      .eq('subvencion_id', subvencionId)
      .eq('tipo_job', tipoJob)
      .eq('estado', 'procesando');

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabase
      .from('subvencion_reanalisis_jobs')
      .update({ estado: 'error', error_msg: msg })
      .eq('subvencion_id', subvencionId)
      .eq('tipo_job', tipoJob)
      .eq('estado', 'procesando');
  }
}
