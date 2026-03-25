/**
 * GET  /api/expedientes/[id] — detalle de un expediente
 * PATCH /api/expedientes/[id] — actualizar fase, fechas, estado, notas
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email?.toLowerCase().endsWith('@ayudapyme.es')) return null;
  return user;
}

const FASES_VALIDAS = [
  'preparacion', 'presentada', 'instruccion', 'resolucion_provisional',
  'alegaciones', 'resolucion_definitiva', 'aceptacion', 'ejecucion',
  'justificacion', 'cobro', 'denegada', 'desistida',
];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { id } = await params;
  const sb = createServiceClient();

  const { data, error } = await sb
    .from('expediente')
    .select(`
      *,
      cliente:nif(*),
      subvencion:subvencion_id(id, titulo, organismo, plazo_fin, importe_maximo, porcentaje_financiacion, url_oficial)
    `)
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  return NextResponse.json(data);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Body requerido' }, { status: 400 });

  // Campos permitidos para actualizar
  const campos: Record<string, unknown> = {};

  if (body.fase !== undefined) {
    if (!FASES_VALIDAS.includes(body.fase)) {
      return NextResponse.json({ error: `Fase inválida: ${body.fase}` }, { status: 400 });
    }
    campos.fase = body.fase;
    campos.fase_updated_at = new Date().toISOString();
  }
  if (body.estado !== undefined) campos.estado = body.estado;
  if (body.notas !== undefined) campos.notas = body.notas;
  if (body.titulo !== undefined) campos.titulo = body.titulo;
  if (body.plazo_solicitud !== undefined) campos.plazo_solicitud = body.plazo_solicitud;
  if (body.fecha_presentacion !== undefined) campos.fecha_presentacion = body.fecha_presentacion;
  if (body.fecha_resolucion_provisional !== undefined) campos.fecha_resolucion_provisional = body.fecha_resolucion_provisional;
  if (body.fecha_alegaciones_fin !== undefined) campos.fecha_alegaciones_fin = body.fecha_alegaciones_fin;
  if (body.fecha_resolucion_definitiva !== undefined) campos.fecha_resolucion_definitiva = body.fecha_resolucion_definitiva;
  if (body.plazo_aceptacion !== undefined) campos.plazo_aceptacion = body.plazo_aceptacion;
  if (body.fecha_inicio_ejecucion !== undefined) campos.fecha_inicio_ejecucion = body.fecha_inicio_ejecucion;
  if (body.fecha_fin_ejecucion !== undefined) campos.fecha_fin_ejecucion = body.fecha_fin_ejecucion;
  if (body.plazo_justificacion !== undefined) campos.plazo_justificacion = body.plazo_justificacion;
  if (body.fecha_cobro !== undefined) campos.fecha_cobro = body.fecha_cobro;
  if (body.importe_solicitado !== undefined) campos.importe_solicitado = body.importe_solicitado;
  if (body.importe_concedido !== undefined) campos.importe_concedido = body.importe_concedido;

  if (Object.keys(campos).length === 0) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
  }

  campos.updated_at = new Date().toISOString();

  const sb = createServiceClient();
  const { error } = await sb.from('expediente').update(campos).eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
