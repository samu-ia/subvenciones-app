/**
 * GET /api/subvenciones/catalogo/[id]
 *
 * Detalle completo de una subvención: datos normalizados + documentos + grounding
 * + eventos + estado calculado + conflictos + tablas auxiliares.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    // Tabla principal
    const { data: subv, error } = await supabase
      .from('subvenciones')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !subv) {
      return NextResponse.json({ error: 'Subvención no encontrada' }, { status: 404 });
    }

    // Todas las tablas auxiliares en paralelo (v1 + v2)
    const [
      requisitos,
      gastos,
      documentacion,
      sectores,
      tiposEmpresa,
      actualizaciones,
      documentos,
      camposExtraidos,
      eventos,
      estadoCalculado,
      conflictos,
      jobsPendientes,
    ] = await Promise.all([
      // v1
      supabase.from('subvencion_requisitos').select('*').eq('subvencion_id', id).order('orden'),
      supabase.from('subvencion_gastos').select('*').eq('subvencion_id', id).order('orden'),
      supabase.from('subvencion_documentacion').select('*').eq('subvencion_id', id).order('orden'),
      supabase.from('subvencion_sectores').select('*').eq('subvencion_id', id),
      supabase.from('subvencion_tipos_empresa').select('*').eq('subvencion_id', id),
      supabase.from('subvencion_actualizaciones')
        .select('*').eq('subvencion_id', id)
        .order('detectada_at', { ascending: false }).limit(20),
      // v2
      supabase.from('subvencion_documentos')
        .select('id,tipo_documento,titulo,url_origen,storage_path,estado,num_paginas,tamanio_bytes,es_principal,fecha_documento,orden,descargado_at,procesado_at,error_msg')
        .eq('subvencion_id', id)
        .order('orden'),
      supabase.from('subvencion_campos_extraidos')
        .select('*')
        .eq('subvencion_id', id)
        .is('supersedido_por', null)  // solo la versión más reciente de cada campo
        .order('nombre_campo'),
      supabase.from('subvencion_eventos')
        .select('*').eq('subvencion_id', id)
        .order('fecha_evento', { ascending: true }),
      supabase.from('subvencion_estado_calculado')
        .select('*').eq('subvencion_id', id).maybeSingle(),
      supabase.from('subvencion_conflictos')
        .select('*').eq('subvencion_id', id)
        .order('created_at', { ascending: false }),
      supabase.from('subvencion_reanalisis_jobs')
        .select('id,tipo_job,estado,motivo,created_at,iniciado_at')
        .eq('subvencion_id', id)
        .in('estado', ['pendiente', 'procesando'])
        .order('created_at', { ascending: false })
        .limit(3),
    ]);

    return NextResponse.json({
      ...subv,
      // v1
      requisitos_list: requisitos.data ?? [],
      gastos_list: gastos.data ?? [],
      documentacion_list: documentacion.data ?? [],
      sectores_list: sectores.data ?? [],
      tipos_empresa_list: tiposEmpresa.data ?? [],
      actualizaciones: actualizaciones.data ?? [],
      // v2
      documentos: documentos.data ?? [],
      campos_extraidos: camposExtraidos.data ?? [],
      eventos: eventos.data ?? [],
      estado_calculado: estadoCalculado.data ?? null,
      conflictos: conflictos.data ?? [],
      jobs_pendientes: jobsPendientes.data ?? [],
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
