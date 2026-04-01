/**
 * GET  /api/alertas  — devuelve alertas dinámicas + manuales sin resolver
 * POST /api/alertas  — crea alerta manual
 * PATCH /api/alertas?id=xxx — marca como resuelta
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireRole, requireAdminOrTramitador } from '@/lib/auth/helpers';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface Alerta {
  id: string;
  tipo: string;
  prioridad: 'critica' | 'alta' | 'media' | 'baja';
  titulo: string;
  descripcion: string;
  expediente_id?: string | null;
  nif?: string | null;
  fecha_limite?: string | null;
  dias_restantes?: number | null;
  cliente_nombre?: string | null;
  expediente_titulo?: string | null;
  resuelta: boolean;
  auto_generada: boolean;
  created_at: string;
}

function diasHasta(fecha: string | null | undefined): number | null {
  if (!fecha) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const limite = new Date(fecha);
  limite.setHours(0, 0, 0, 0);
  return Math.ceil((limite.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
}

function prioridadPorDias(dias: number | null, critica: number, alta: number, media: number): 'critica' | 'alta' | 'media' | 'baja' {
  if (dias === null) return 'media';
  if (dias <= critica) return 'critica';
  if (dias <= alta) return 'alta';
  if (dias <= media) return 'media';
  return 'baja';
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  const authGet = await requireAdminOrTramitador();
  if (authGet instanceof NextResponse) return authGet;

  const sb = createServiceClient();
  const alertas: Alerta[] = [];

  // ── 1. Expedientes activos con fechas próximas ─────────────────────────────
  const { data: expedientes } = await sb
    .from('expediente')
    .select(`
      id, nif, titulo, fase, estado,
      plazo_solicitud, plazo_aceptacion, fecha_alegaciones_fin,
      plazo_justificacion, fecha_fin_ejecucion, updated_at,
      subvencion_id,
      cliente:nif(nombre_empresa, nombre_normalizado),
      subvencion:subvencion_id(titulo, plazo_fin)
    `)
    .not('fase', 'in', '("denegada","desistida","cobro")')
    .not('estado', 'in', '("denegado","cerrado","cancelado","descartado")');

  type NamedEntity = { nombre_empresa?: string; nombre_normalizado?: string };
  type SubvEntity = { titulo?: string; fecha_fin_solicitud?: string };
  if (expedientes) {
    for (const exp of expedientes) {
      const cliente = exp.cliente as NamedEntity | null;
      const subv = exp.subvencion as SubvEntity | null;
      const clienteNombre = cliente?.nombre_empresa || cliente?.nombre_normalizado || exp.nif;
      const expTitulo = exp.titulo || subv?.titulo || `Expediente ${exp.id.slice(0, 8)}`;

      // Plazo de solicitud (desde subvención o campo propio)
      const plazoSolicitud = exp.plazo_solicitud || subv?.plazo_fin;
      if (plazoSolicitud && ['preparacion'].includes(exp.fase || '')) {
        const dias = diasHasta(plazoSolicitud);
        if (dias !== null && dias <= 14) {
          alertas.push({
            id: `dyn-plazo-sol-${exp.id}`,
            tipo: 'plazo_solicitud',
            prioridad: prioridadPorDias(dias, 3, 7, 14),
            titulo: `Plazo de presentación: ${dias} día${dias !== 1 ? 's' : ''}`,
            descripcion: `${clienteNombre} — ${expTitulo}`,
            expediente_id: exp.id,
            nif: exp.nif,
            fecha_limite: plazoSolicitud,
            dias_restantes: dias,
            cliente_nombre: clienteNombre,
            expediente_titulo: expTitulo,
            resuelta: false,
            auto_generada: true,
            created_at: new Date().toISOString(),
          });
        }
      }

      // Plazo de aceptación (CRÍTICO — pierden la subvención si no aceptan)
      if (exp.plazo_aceptacion && exp.fase === 'aceptacion') {
        const dias = diasHasta(exp.plazo_aceptacion);
        if (dias !== null && dias <= 15) {
          alertas.push({
            id: `dyn-aceptacion-${exp.id}`,
            tipo: 'plazo_aceptacion',
            prioridad: prioridadPorDias(dias, 3, 7, 15),
            titulo: `ACEPTAR RESOLUCION: ${dias} día${dias !== 1 ? 's' : ''} restantes`,
            descripcion: `${clienteNombre} — ${expTitulo}. Si no se acepta en plazo se pierde la subvención.`,
            expediente_id: exp.id,
            nif: exp.nif,
            fecha_limite: exp.plazo_aceptacion,
            dias_restantes: dias,
            cliente_nombre: clienteNombre,
            expediente_titulo: expTitulo,
            resuelta: false,
            auto_generada: true,
            created_at: new Date().toISOString(),
          });
        }
      }

      // Plazo de alegaciones (15 días desde resolución provisional)
      if (exp.fecha_alegaciones_fin && exp.fase === 'resolucion_provisional') {
        const dias = diasHasta(exp.fecha_alegaciones_fin);
        if (dias !== null && dias <= 15) {
          alertas.push({
            id: `dyn-alegaciones-${exp.id}`,
            tipo: 'plazo_alegaciones',
            prioridad: prioridadPorDias(dias, 3, 7, 15),
            titulo: `Plazo alegaciones resolución provisional: ${dias} día${dias !== 1 ? 's' : ''}`,
            descripcion: `${clienteNombre} — ${expTitulo}`,
            expediente_id: exp.id,
            nif: exp.nif,
            fecha_limite: exp.fecha_alegaciones_fin,
            dias_restantes: dias,
            cliente_nombre: clienteNombre,
            expediente_titulo: expTitulo,
            resuelta: false,
            auto_generada: true,
            created_at: new Date().toISOString(),
          });
        }
      }

      // Plazo de justificación
      if (exp.plazo_justificacion && exp.fase === 'justificacion') {
        const dias = diasHasta(exp.plazo_justificacion);
        if (dias !== null && dias <= 60) {
          alertas.push({
            id: `dyn-justificacion-${exp.id}`,
            tipo: 'plazo_justificacion',
            prioridad: prioridadPorDias(dias, 7, 21, 60),
            titulo: `Plazo justificación: ${dias} día${dias !== 1 ? 's' : ''}`,
            descripcion: `${clienteNombre} — ${expTitulo}`,
            expediente_id: exp.id,
            nif: exp.nif,
            fecha_limite: exp.plazo_justificacion,
            dias_restantes: dias,
            cliente_nombre: clienteNombre,
            expediente_titulo: expTitulo,
            resuelta: false,
            auto_generada: true,
            created_at: new Date().toISOString(),
          });
        }
      }

      // Fin de ejecución
      if (exp.fecha_fin_ejecucion && exp.fase === 'ejecucion') {
        const dias = diasHasta(exp.fecha_fin_ejecucion);
        if (dias !== null && dias <= 45) {
          alertas.push({
            id: `dyn-ejecucion-${exp.id}`,
            tipo: 'plazo_ejecucion',
            prioridad: prioridadPorDias(dias, 7, 21, 45),
            titulo: `Fin período ejecución: ${dias} día${dias !== 1 ? 's' : ''}`,
            descripcion: `${clienteNombre} — ${expTitulo}. Preparar justificación de gastos.`,
            expediente_id: exp.id,
            nif: exp.nif,
            fecha_limite: exp.fecha_fin_ejecucion,
            dias_restantes: dias,
            cliente_nombre: clienteNombre,
            expediente_titulo: expTitulo,
            resuelta: false,
            auto_generada: true,
            created_at: new Date().toISOString(),
          });
        }
      }

      // Expediente parado (sin actividad > 30 días en fases activas)
      const fasesActivas = ['preparacion', 'presentada', 'instruccion', 'ejecucion'];
      if (fasesActivas.includes(exp.fase || '')) {
        const diasSinActividad = diasHasta(exp.updated_at?.slice(0, 10));
        if (diasSinActividad !== null && diasSinActividad < -30) {
          alertas.push({
            id: `dyn-parado-${exp.id}`,
            tipo: 'expediente_parado',
            prioridad: 'baja',
            titulo: `Sin actividad ${Math.abs(diasSinActividad)} días`,
            descripcion: `${clienteNombre} — ${expTitulo} (fase: ${exp.fase})`,
            expediente_id: exp.id,
            nif: exp.nif,
            fecha_limite: null,
            dias_restantes: null,
            cliente_nombre: clienteNombre,
            expediente_titulo: expTitulo,
            resuelta: false,
            auto_generada: true,
            created_at: new Date().toISOString(),
          });
        }
      }
    }
  }

  // ── 2. Solicitudes pendientes de acción admin ──────────────────────────────
  const { data: solicitudesPendientes } = await sb
    .from('solicitudes')
    .select('id, nif, subvencion_id, estado, created_at, subvencion:subvencion_id(titulo), cliente:nif(nombre_empresa, nombre_normalizado)')
    .in('estado', ['contrato_pendiente', 'pago_pendiente', 'encaje_confirmado'])
    .is('expediente_id', null);

  if (solicitudesPendientes) {
    for (const sol of solicitudesPendientes) {
      const cliente = sol.cliente as NamedEntity | null;
      const subv = sol.subvencion as SubvEntity | null;
      const clienteNombre = cliente?.nombre_empresa || cliente?.nombre_normalizado || sol.nif;
      const diasEspera = diasHasta(sol.created_at?.slice(0, 10));
      const diasAntiguedad = diasEspera !== null ? Math.abs(diasEspera) : 0;

      alertas.push({
        id: `dyn-sol-${sol.id}`,
        tipo: 'solicitud_pendiente',
        prioridad: diasAntiguedad > 7 ? 'alta' : 'media',
        titulo: `Solicitud ${sol.estado === 'contrato_pendiente' ? 'con contrato pendiente' : sol.estado === 'pago_pendiente' ? 'con pago pendiente' : 'encaje confirmado — crear expediente'}`,
        descripcion: `${clienteNombre} — ${subv?.titulo || 'Subvención'}. Espera ${diasAntiguedad} día${diasAntiguedad !== 1 ? 's' : ''}.`,
        expediente_id: null,
        nif: sol.nif,
        fecha_limite: null,
        dias_restantes: null,
        cliente_nombre: clienteNombre,
        expediente_titulo: subv?.titulo || null,
        resuelta: false,
        auto_generada: true,
        created_at: sol.created_at || new Date().toISOString(),
      });
    }
  }

  // ── 3. Matches de alta puntuación sin notificar ─────────────────────────────
  const { data: matchesNuevos } = await sb
    .from('cliente_subvencion_match')
    .select('id, nif, score, subvencion_id, created_at, cliente:nif(nombre_empresa, nombre_normalizado), subvencion:subvencion_id(titulo)')
    .eq('notificado_admin', false)
    .gte('score', 0.70)
    .order('score', { ascending: false })
    .limit(10);

  if (matchesNuevos) {
    for (const m of matchesNuevos) {
      const cliente = m.cliente as NamedEntity | null;
      const subv = m.subvencion as SubvEntity | null;
      const clienteNombre = cliente?.nombre_empresa || cliente?.nombre_normalizado || m.nif;
      alertas.push({
        id: `dyn-match-${m.id}`,
        tipo: 'match_nuevo',
        prioridad: m.score >= 0.85 ? 'alta' : 'media',
        titulo: `Nuevo match ${m.score}% — ${clienteNombre}`,
        descripcion: `${subv?.titulo || 'Subvención'} — Pendiente de notificar al cliente.`,
        expediente_id: null,
        nif: m.nif,
        fecha_limite: null,
        dias_restantes: null,
        cliente_nombre: clienteNombre,
        expediente_titulo: subv?.titulo || null,
        resuelta: false,
        auto_generada: true,
        created_at: m.created_at || new Date().toISOString(),
      });
    }
  }

  // ── 4. Alertas manuales sin resolver ──────────────────────────────────────
  const { data: alertasManuales } = await sb
    .from('alertas')
    .select('*, cliente:nif(nombre_empresa, nombre_normalizado), expediente:expediente_id(titulo)')
    .eq('resuelta', false)
    .order('created_at', { ascending: false });

  if (alertasManuales) {
    for (const a of alertasManuales) {
      const cliente = a.cliente as NamedEntity | null;
      const exp = a.expediente as { titulo?: string; nif?: string } | null;
      alertas.push({
        id: a.id,
        tipo: a.tipo,
        prioridad: a.prioridad,
        titulo: a.titulo,
        descripcion: a.descripcion || '',
        expediente_id: a.expediente_id,
        nif: a.nif,
        fecha_limite: a.fecha_limite,
        dias_restantes: diasHasta(a.fecha_limite),
        cliente_nombre: cliente?.nombre_empresa || cliente?.nombre_normalizado || a.nif,
        expediente_titulo: exp?.titulo || null,
        resuelta: false,
        auto_generada: false,
        created_at: a.created_at,
      });
    }
  }

  // Ordenar: críticas primero, luego por días restantes
  const orden: Record<string, number> = { critica: 0, alta: 1, media: 2, baja: 3 };
  alertas.sort((a, b) => {
    const po = orden[a.prioridad] - orden[b.prioridad];
    if (po !== 0) return po;
    const da = a.dias_restantes ?? null;
    const db = b.dias_restantes ?? null;
    if (da !== null && db !== null) return da - db;
    if (da !== null) return -1;
    if (db !== null) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return NextResponse.json({ alertas, total: alertas.length });
}

// ─── POST — crear alerta manual ───────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const authPost = await requireRole('admin');
  if (authPost instanceof NextResponse) return authPost;

  const body = await request.json().catch(() => null);
  if (!body?.titulo || !body?.tipo) return NextResponse.json({ error: 'titulo y tipo son obligatorios' }, { status: 400 });

  const sb = createServiceClient();
  const { data, error } = await sb
    .from('alertas')
    .insert({
      tipo: body.tipo || 'custom',
      prioridad: body.prioridad || 'media',
      titulo: body.titulo,
      descripcion: body.descripcion || null,
      expediente_id: body.expediente_id || null,
      nif: body.nif || null,
      fecha_limite: body.fecha_limite || null,
      auto_generada: false,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}

// ─── PATCH — resolver alerta manual ───────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  const authPatch = await requireRole('admin');
  if (authPatch instanceof NextResponse) return authPatch;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id es obligatorio' }, { status: 400 });

  const sb = createServiceClient();
  const { error } = await sb
    .from('alertas')
    .update({ resuelta: true, resuelta_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
