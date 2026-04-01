/**
 * lib/subvenciones/estado-calculator.ts
 *
 * Máquina de estados pura para calcular el estado de una convocatoria.
 * NO usa IA. Deriva el estado exclusivamente de:
 *   · Fechas (plazo_inicio, plazo_fin, fecha_publicacion)
 *   · Eventos detectados (suspension, resolucion, ampliacion_plazo, cierre_plazo)
 *
 * El estado calculado es autoritativo sobre la opinión de la IA.
 * Prioridad: suspension > resolucion > fechas > proximidad > desconocido
 */

import type {
  EstadoCalculatorInput,
  EstadoCalculatorOutput,
} from '@/lib/types/subvenciones-pipeline';

/** Días a partir del cierre en que consideramos urgente */
const DIAS_URGENTE = 15;

/** Parsea una fecha ISO a Date o null */
function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/** Diff en días enteros (positivo = fecha está en el futuro) */
function diasHasta(fecha: Date, ahora: Date): number {
  const diffMs = fecha.getTime() - ahora.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Calcula el estado de una convocatoria a partir de fechas y eventos.
 * Función pura — no hace llamadas a BD ni a IA.
 */
export function calcularEstado(input: EstadoCalculatorInput): EstadoCalculatorOutput {
  const ahora = input.ahora ?? new Date();

  // ── Analizar eventos ──────────────────────────────────────────────────────
  const eventos = input.eventos ?? [];

  const tieneSuspension = eventos.some(e => e.tipo_evento === 'suspension');
  const tieneResolucion = eventos.some(e => e.tipo_evento === 'resolucion');
  const tieneAmpliacion = eventos.some(e => e.tipo_evento === 'ampliacion_plazo');

  // Si hay evento de ampliación, tomar la fecha más reciente de cierre_plazo
  // o la fecha_evento_fin del evento de ampliacion como nuevo plazo_fin
  let plazoFinEfectivo = input.plazo_fin;
  if (tieneAmpliacion) {
    const eventosAmpliacion = eventos
      .filter(e => e.tipo_evento === 'ampliacion_plazo' && (e.fecha_evento_fin ?? e.fecha_evento))
      .map(e => e.fecha_evento_fin ?? e.fecha_evento ?? '')
      .filter(Boolean)
      .sort()
      .reverse();
    if (eventosAmpliacion.length > 0) {
      plazoFinEfectivo = eventosAmpliacion[0];
    }
  }

  const fechaInicio = parseDate(input.plazo_inicio);
  const fechaFin = parseDate(plazoFinEfectivo);

  // ── Estado por prioridad ───────────────────────────────────────────────────

  // 1. Suspendida — prevalece sobre todo
  if (tieneSuspension) {
    return {
      estado: 'suspendida',
      razon: 'Existe un evento de suspensión detectado en los documentos.',
      urgente: false,
      tiene_evento_suspension: true,
      tiene_evento_resolucion: tieneResolucion,
      tiene_evento_ampliacion: tieneAmpliacion,
    };
  }

  // 2. Resuelta — ya tiene resolución publicada
  if (tieneResolucion) {
    return {
      estado: 'resuelta',
      razon: 'Existe un evento de resolución detectado en los documentos.',
      urgente: false,
      tiene_evento_suspension: false,
      tiene_evento_resolucion: true,
      tiene_evento_ampliacion: tieneAmpliacion,
    };
  }

  // 3. Calcular por fechas
  if (fechaFin) {
    const dias = diasHasta(fechaFin, ahora);

    if (dias < 0) {
      // Plazo ya terminó
      return {
        estado: 'cerrada',
        razon: `El plazo de presentación finalizó hace ${Math.abs(dias)} día(s).`,
        urgente: false,
        tiene_evento_suspension: false,
        tiene_evento_resolucion: false,
        tiene_evento_ampliacion: tieneAmpliacion,
      };
    }

    // Plazo todavía abierto — ¿ha comenzado?
    if (fechaInicio) {
      const diasDesdeInicio = diasHasta(fechaInicio, ahora);
      if (diasDesdeInicio > 0) {
        // Todavía no ha abierto
        return {
          estado: 'proxima',
          razon: `El plazo aún no ha comenzado. Apertura en ${diasDesdeInicio} día(s).`,
          dias_para_cierre: dias,
          urgente: dias <= DIAS_URGENTE,
          tiene_evento_suspension: false,
          tiene_evento_resolucion: false,
          tiene_evento_ampliacion: tieneAmpliacion,
        };
      }
    }

    // Está abierta
    return {
      estado: 'abierta',
      razon: tieneAmpliacion
        ? `El plazo fue ampliado. Cierra en ${dias} día(s)${dias <= DIAS_URGENTE ? ' — URGENTE' : ''}.`
        : `El plazo de presentación está activo. Cierra en ${dias} día(s)${dias <= DIAS_URGENTE ? ' — URGENTE' : ''}.`,
      dias_para_cierre: dias,
      urgente: dias <= DIAS_URGENTE,
      tiene_evento_suspension: false,
      tiene_evento_resolucion: false,
      tiene_evento_ampliacion: tieneAmpliacion,
    };
  }

  // 4. Solo tenemos fecha de inicio, sin fin
  if (fechaInicio) {
    const dias = diasHasta(fechaInicio, ahora);
    if (dias > 0) {
      return {
        estado: 'proxima',
        razon: `Fecha de apertura conocida pero sin fecha de cierre. Apertura en ${dias} día(s).`,
        urgente: false,
        tiene_evento_suspension: false,
        tiene_evento_resolucion: false,
        tiene_evento_ampliacion: tieneAmpliacion,
      };
    }
    // Inicio ya pasó pero sin fin → asumimos abierta sin urgencia determinable
    return {
      estado: 'abierta',
      razon: 'El plazo parece abierto pero no se ha encontrado fecha de cierre.',
      urgente: false,
      tiene_evento_suspension: false,
      tiene_evento_resolucion: false,
      tiene_evento_ampliacion: tieneAmpliacion,
    };
  }

  // 5. Sin fechas suficientes
  return {
    estado: 'desconocido',
    razon: 'No se han encontrado fechas de plazo suficientes para determinar el estado.',
    urgente: false,
    tiene_evento_suspension: false,
    tiene_evento_resolucion: false,
    tiene_evento_ampliacion: tieneAmpliacion,
  };
}

/**
 * Persiste el estado calculado en la BD.
 * Hace upsert sobre subvencion_estado_calculado (unique en subvencion_id).
 */
export async function persistirEstadoCalculado(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  subvencionId: string,
  bdnsId: string,
  input: EstadoCalculatorInput,
): Promise<EstadoCalculatorOutput> {
  const resultado = calcularEstado(input);

  await supabase.from('subvencion_estado_calculado').upsert(
    {
      subvencion_id: subvencionId,
      bdns_id: bdnsId,
      estado: resultado.estado,
      razon: resultado.razon,
      dias_para_cierre: resultado.dias_para_cierre ?? null,
      urgente: resultado.urgente,
      calculado_at: new Date().toISOString(),
      plazo_inicio_usado: input.plazo_inicio ?? null,
      plazo_fin_usado: input.plazo_fin ?? null,
      tiene_evento_suspension: resultado.tiene_evento_suspension,
      tiene_evento_resolucion: resultado.tiene_evento_resolucion,
      tiene_evento_ampliacion: resultado.tiene_evento_ampliacion,
    },
    { onConflict: 'subvencion_id' }
  );

  // Sincronizar estado_convocatoria en la tabla principal
  await supabase.from('subvenciones')
    .update({ estado_convocatoria: resultado.estado, updated_at: new Date().toISOString() })
    .eq('id', subvencionId);

  return resultado;
}
