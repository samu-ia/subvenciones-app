import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireRole } from '@/lib/auth/helpers';

export async function GET() {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

  const sb = createServiceClient();

  // ── KPIs principales ──────────────────────────────────────────────────────
  const [
    { count: clientesActivos },
    { count: expTotal },
    { count: expActivos },
    { count: expConcedidos },
    { data: importeData },
    { data: feeData },
  ] = await Promise.all([
    // Clientes activos (con al menos 1 match o expediente)
    sb.from('cliente').select('*', { count: 'exact', head: true }),
    // Total expedientes
    sb.from('expediente').select('*', { count: 'exact', head: true }),
    // Expedientes en curso (no cerrados/denegados/desistidos)
    sb.from('expediente').select('*', { count: 'exact', head: true })
      .not('fase', 'in', '("denegada","desistida","cobro")')
      .not('estado', 'in', '("denegado","cerrado","cancelado","descartado")'),
    // Expedientes concedidos (fases post-resolución)
    sb.from('expediente').select('*', { count: 'exact', head: true })
      .in('fase', ['resolucion_definitiva', 'aceptacion', 'ejecucion', 'justificacion', 'cobro']),
    // Importe total gestionado (suma importe_solicitado de expedientes activos)
    sb.from('expediente')
      .select('importe_solicitado, importe_concedido')
      .not('estado', 'in', '("denegado","cerrado","cancelado","descartado")'),
    // Ingresos (fee_amount donde fee_estado=cobrado)
    sb.from('expediente')
      .select('fee_amount, fee_estado'),
  ]);

  // Calcular importe total gestionado
  let importeGestionado = 0;
  if (importeData) {
    for (const exp of importeData) {
      importeGestionado += (exp.importe_concedido || exp.importe_solicitado || 0);
    }
  }

  // Calcular ingresos (fees cobrados) y fees pendientes
  let ingresosCobrados = 0;
  let feesPendientes = 0;
  if (feeData) {
    for (const exp of feeData) {
      if (exp.fee_estado === 'cobrado' && exp.fee_amount) {
        ingresosCobrados += exp.fee_amount;
      } else if (exp.fee_estado === 'pendiente' && exp.fee_amount) {
        feesPendientes += exp.fee_amount;
      }
    }
  }

  // Tasa de conversión
  const tasaConversion = (expTotal ?? 0) > 0
    ? ((expConcedidos ?? 0) / (expTotal ?? 1)) * 100
    : 0;

  // ── Embudo: matches → interesados → solicitando → concedidos → cobrados ──
  const [
    { count: matchesTotal },
    { count: matchesInteresados },
    { count: expSolicitando },
    // expConcedidos ya lo tenemos
    { count: expCobrados },
  ] = await Promise.all([
    sb.from('cliente_subvencion_match').select('*', { count: 'exact', head: true })
      .eq('es_hard_exclude', false),
    sb.from('cliente_subvencion_match').select('*', { count: 'exact', head: true })
      .eq('estado', 'interesado'),
    sb.from('expediente').select('*', { count: 'exact', head: true })
      .in('fase', ['preparacion', 'presentada', 'instruccion', 'resolucion_provisional', 'alegaciones']),
    sb.from('expediente').select('*', { count: 'exact', head: true })
      .eq('fase', 'cobro'),
  ]);

  // ── Expedientes urgentes: plazo < 7 días ──────────────────────────────────
  const { data: expedientesUrgentes } = await sb
    .from('expediente')
    .select(`
      id, nif, titulo, fase, estado,
      plazo_solicitud, plazo_aceptacion, fecha_alegaciones_fin,
      plazo_justificacion, fecha_fin_ejecucion,
      subvencion_id,
      cliente:nif(nombre_empresa, nombre_normalizado),
      subvencion:subvencion_id(titulo, plazo_fin)
    `)
    .not('fase', 'in', '("denegada","desistida","cobro")')
    .not('estado', 'in', '("denegado","cerrado","cancelado","descartado")');

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const en7dias = new Date(hoy);
  en7dias.setDate(en7dias.getDate() + 7);

  interface ExpedienteUrgente {
    id: string;
    cliente_nombre: string;
    titulo: string;
    fase: string;
    fecha_limite: string;
    dias_restantes: number;
  }

  const urgentes: ExpedienteUrgente[] = [];

  if (expedientesUrgentes) {
    for (const exp of expedientesUrgentes) {
      const cliente = exp.cliente as any;
      const subv = exp.subvencion as any;
      const clienteNombre = cliente?.nombre_empresa || cliente?.nombre_normalizado || exp.nif;
      const expTitulo = exp.titulo || subv?.titulo || `Expediente ${exp.id.slice(0, 8)}`;

      // Determinar la fecha límite según la fase
      let fechaLimite: string | null = null;
      if (exp.fase === 'preparacion') {
        fechaLimite = exp.plazo_solicitud || subv?.plazo_fin;
      } else if (exp.fase === 'aceptacion') {
        fechaLimite = exp.plazo_aceptacion;
      } else if (exp.fase === 'resolucion_provisional') {
        fechaLimite = exp.fecha_alegaciones_fin;
      } else if (exp.fase === 'justificacion') {
        fechaLimite = exp.plazo_justificacion;
      } else if (exp.fase === 'ejecucion') {
        fechaLimite = exp.fecha_fin_ejecucion;
      }

      if (fechaLimite) {
        const limite = new Date(fechaLimite);
        limite.setHours(0, 0, 0, 0);
        const dias = Math.ceil((limite.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
        if (dias >= 0 && dias <= 7) {
          urgentes.push({
            id: exp.id,
            cliente_nombre: clienteNombre,
            titulo: expTitulo,
            fase: exp.fase || 'preparacion',
            fecha_limite: fechaLimite,
            dias_restantes: dias,
          });
        }
      }
    }
  }

  urgentes.sort((a, b) => a.dias_restantes - b.dias_restantes);

  // ── Últimas 5 actividades ─────────────────────────────────────────────────
  interface Actividad {
    tipo: 'mensaje' | 'fase_cambio' | 'expediente_nuevo';
    descripcion: string;
    fecha: string;
    nif?: string;
    expediente_id?: string;
  }

  const actividades: Actividad[] = [];

  // Últimos mensajes del gestor
  const { data: mensajesRecientes } = await sb
    .from('mensajes_gestor')
    .select('id, nif, contenido, autor, created_at, cliente:nif(nombre_empresa, nombre_normalizado)')
    .order('created_at', { ascending: false })
    .limit(5);

  if (mensajesRecientes) {
    for (const msg of mensajesRecientes) {
      const cliente = msg.cliente as any;
      const nombre = cliente?.nombre_empresa || cliente?.nombre_normalizado || msg.nif;
      actividades.push({
        tipo: 'mensaje',
        descripcion: `${msg.autor === 'admin' ? 'Mensaje enviado a' : 'Mensaje de'} ${nombre}: "${(msg.contenido || '').slice(0, 60)}${(msg.contenido || '').length > 60 ? '…' : ''}"`,
        fecha: msg.created_at,
        nif: msg.nif,
      });
    }
  }

  // Últimos cambios de fase
  const { data: fasesRecientes } = await sb
    .from('expediente_fases')
    .select('id, expediente_id, fase, fecha_inicio, expediente:expediente_id(titulo, nif, cliente:nif(nombre_empresa, nombre_normalizado))')
    .order('fecha_inicio', { ascending: false })
    .limit(5);

  if (fasesRecientes) {
    for (const f of fasesRecientes) {
      const exp = f.expediente as any;
      const cliente = exp?.cliente as any;
      const nombre = cliente?.nombre_empresa || cliente?.nombre_normalizado || exp?.nif || '';
      actividades.push({
        tipo: 'fase_cambio',
        descripcion: `${nombre} → fase "${f.fase}" en ${exp?.titulo || 'expediente'}`,
        fecha: f.fecha_inicio,
        expediente_id: f.expediente_id,
      });
    }
  }

  // Últimos expedientes creados
  const { data: expRecientes } = await sb
    .from('expediente')
    .select('id, titulo, nif, created_at, cliente:nif(nombre_empresa, nombre_normalizado)')
    .order('created_at', { ascending: false })
    .limit(3);

  if (expRecientes) {
    for (const exp of expRecientes) {
      const cliente = exp.cliente as any;
      const nombre = cliente?.nombre_empresa || cliente?.nombre_normalizado || exp.nif;
      actividades.push({
        tipo: 'expediente_nuevo',
        descripcion: `Nuevo expediente: "${exp.titulo || 'Sin título'}" para ${nombre}`,
        fecha: exp.created_at,
        expediente_id: exp.id,
      });
    }
  }

  // Ordenar por fecha y tomar las 5 más recientes
  actividades.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  const ultimas5 = actividades.slice(0, 5);

  return NextResponse.json({
    kpis: {
      clientes_activos: clientesActivos ?? 0,
      expedientes_en_curso: expActivos ?? 0,
      expedientes_total: expTotal ?? 0,
      importe_gestionado: importeGestionado,
      tasa_conversion: Math.round(tasaConversion * 10) / 10,
      ingresos_cobrados: ingresosCobrados,
      fees_pendientes: feesPendientes,
    },
    embudo: {
      matches: matchesTotal ?? 0,
      interesados: matchesInteresados ?? 0,
      solicitando: expSolicitando ?? 0,
      concedidos: expConcedidos ?? 0,
      cobrados: expCobrados ?? 0,
    },
    expedientes_urgentes: urgentes,
    actividades: ultimas5,
  });
}
