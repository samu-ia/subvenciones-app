/**
 * lib/subvenciones/grounding-writer.ts
 *
 * Persiste los resultados de IaExtraccionConGrounding en la BD:
 *   · subvencion_campos_extraidos — un registro por campo con fragmento + confidence
 *   · subvencion_eventos         — eventos detectados en el análisis
 *   · subvencion_conflictos      — inconsistencias entre fuentes
 *
 * Siempre crea versión nueva (incrementa version) y marca la anterior como supersedida.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  IaExtraccionConGrounding,
  IaFieldResult,
  SubvencionEvento,
  TipoConflicto,
} from '@/lib/types/subvenciones-pipeline';

// ─── Guardar campos con grounding ─────────────────────────────────────────────

type FieldEntry = {
  nombre_campo: string;
  field: IaFieldResult<unknown>;
};

function buildFieldEntries(g: IaExtraccionConGrounding): FieldEntry[] {
  return [
    { nombre_campo: 'objeto', field: g.objeto },
    { nombre_campo: 'beneficiarios', field: g.beneficiarios },
    { nombre_campo: 'importe_maximo', field: g.importe_maximo },
    { nombre_campo: 'importe_minimo', field: g.importe_minimo },
    { nombre_campo: 'porcentaje_financiacion', field: g.porcentaje_financiacion },
    { nombre_campo: 'presupuesto_total', field: g.presupuesto_total },
    { nombre_campo: 'plazo_inicio', field: g.plazo_inicio },
    { nombre_campo: 'plazo_fin', field: g.plazo_fin },
    { nombre_campo: 'plazo_presentacion_texto', field: g.plazo_presentacion_texto },
    { nombre_campo: 'ambito_geografico', field: g.ambito_geografico },
    { nombre_campo: 'comunidad_autonoma', field: g.comunidad_autonoma },
    { nombre_campo: 'provincia', field: g.provincia },
    { nombre_campo: 'estado_convocatoria', field: g.estado_convocatoria },
    { nombre_campo: 'resumen_ia', field: g.resumen_ia },
    { nombre_campo: 'puntos_clave', field: g.puntos_clave },
    { nombre_campo: 'para_quien', field: g.para_quien },
    { nombre_campo: 'requisitos', field: g.requisitos },
    { nombre_campo: 'gastos_subvencionables', field: g.gastos_subvencionables },
    { nombre_campo: 'documentacion_exigida', field: g.documentacion_exigida },
    { nombre_campo: 'sectores', field: g.sectores },
    { nombre_campo: 'tipos_empresa', field: g.tipos_empresa },
    { nombre_campo: 'observaciones', field: g.observaciones },
  ];
}

/** Convierte un valor a string para display */
function valorATexto(valor: unknown): string | undefined {
  if (valor === null || valor === undefined) return undefined;
  if (typeof valor === 'string') return valor;
  if (typeof valor === 'number') return String(valor);
  return JSON.stringify(valor);
}

/** Determina si el valor es complejo (array u objeto) */
function esComplejo(valor: unknown): boolean {
  return Array.isArray(valor) || (typeof valor === 'object' && valor !== null);
}

/**
 * Persiste todos los campos con grounding.
 * Invalida versiones anteriores del mismo campo y crea registros nuevos.
 */
export async function guardarCamposConGrounding(
  supabase: SupabaseClient,
  subvencionId: string,
  bdnsId: string,
  documentoId: string | null,
  g: IaExtraccionConGrounding,
): Promise<void> {
  const entries = buildFieldEntries(g);

  for (const { nombre_campo, field } of entries) {
    if (field.valor === null || field.valor === undefined) continue;

    // Obtener versión actual (si existe)
    const { data: anterior } = await supabase
      .from('subvencion_campos_extraidos')
      .select('id, version')
      .eq('subvencion_id', subvencionId)
      .eq('nombre_campo', nombre_campo)
      .eq('override_manual', false)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nuevaVersion = (anterior?.version ?? 0) + 1;

    // Insertar nuevo campo
    const { data: nuevoCampo } = await supabase
      .from('subvencion_campos_extraidos')
      .insert({
        subvencion_id: subvencionId,
        documento_id: documentoId,
        bdns_id: bdnsId,
        nombre_campo,
        valor_texto: valorATexto(field.valor),
        valor_json: esComplejo(field.valor) ? field.valor : null,
        fragmento_texto: field.fragmento_texto ?? null,
        pagina_estimada: field.pagina_estimada ?? null,
        metodo: 'ia',
        modelo_ia: g.modelo,
        confidence: field.confidence,
        version: nuevaVersion,
      })
      .select('id')
      .single();

    // Marcar el anterior como supersedido
    if (anterior && nuevoCampo) {
      await supabase
        .from('subvencion_campos_extraidos')
        .update({ supersedido_por: nuevoCampo.id })
        .eq('id', anterior.id);
    }
  }
}

// ─── Guardar eventos detectados ───────────────────────────────────────────────

/**
 * Genera eventos a partir del resultado de grounding.
 * El estado_convocatoria puede implicar eventos como cierre_plazo, apertura_plazo, etc.
 */
export function inferirEventos(
  subvencionId: string,
  bdnsId: string,
  documentoId: string | null,
  g: IaExtraccionConGrounding,
): Omit<SubvencionEvento, 'id' | 'created_at'>[] {
  const eventos: Omit<SubvencionEvento, 'id' | 'created_at'>[] = [];

  // Evento: apertura de plazo
  if (g.plazo_inicio.valor) {
    eventos.push({
      subvencion_id: subvencionId,
      documento_id: documentoId ?? undefined,
      bdns_id: bdnsId,
      tipo_evento: 'apertura_plazo',
      fecha_evento: g.plazo_inicio.valor as string,
      titulo: 'Inicio del plazo de presentación',
      descripcion: g.plazo_presentacion_texto.valor as string | undefined,
      fuente: 'ia',
      fragmento_texto: g.plazo_inicio.fragmento_texto,
      pagina_estimada: g.plazo_inicio.pagina_estimada,
      confidence: g.plazo_inicio.confidence,
    });
  }

  // Evento: cierre de plazo
  if (g.plazo_fin.valor) {
    eventos.push({
      subvencion_id: subvencionId,
      documento_id: documentoId ?? undefined,
      bdns_id: bdnsId,
      tipo_evento: 'cierre_plazo',
      fecha_evento: g.plazo_fin.valor as string,
      titulo: 'Cierre del plazo de presentación',
      descripcion: g.plazo_presentacion_texto.valor as string | undefined,
      fuente: 'ia',
      fragmento_texto: g.plazo_fin.fragmento_texto,
      pagina_estimada: g.plazo_fin.pagina_estimada,
      confidence: g.plazo_fin.confidence,
    });
  }

  // Evento: suspensión (si el estado detectado es suspended)
  if (g.estado_convocatoria.valor === 'suspendida' && g.estado_convocatoria.confidence > 0.5) {
    eventos.push({
      subvencion_id: subvencionId,
      documento_id: documentoId ?? undefined,
      bdns_id: bdnsId,
      tipo_evento: 'suspension',
      titulo: 'Suspensión detectada',
      descripcion: 'La IA ha detectado una suspensión de la convocatoria en el documento.',
      fuente: 'ia',
      fragmento_texto: g.estado_convocatoria.fragmento_texto,
      pagina_estimada: g.estado_convocatoria.pagina_estimada,
      confidence: g.estado_convocatoria.confidence,
    });
  }

  // Evento: resolución
  if (g.estado_convocatoria.valor === 'resuelta' && g.estado_convocatoria.confidence > 0.5) {
    eventos.push({
      subvencion_id: subvencionId,
      documento_id: documentoId ?? undefined,
      bdns_id: bdnsId,
      tipo_evento: 'resolucion',
      titulo: 'Resolución detectada',
      descripcion: 'La IA ha detectado una resolución de la convocatoria en el documento.',
      fuente: 'ia',
      fragmento_texto: g.estado_convocatoria.fragmento_texto,
      pagina_estimada: g.estado_convocatoria.pagina_estimada,
      confidence: g.estado_convocatoria.confidence,
    });
  }

  return eventos;
}

export async function guardarEventos(
  supabase: SupabaseClient,
  subvencionId: string,
  bdnsId: string,
  documentoId: string | null,
  g: IaExtraccionConGrounding,
): Promise<void> {
  const eventos = inferirEventos(subvencionId, bdnsId, documentoId, g);
  if (!eventos.length) return;

  // Evitar duplicados: borrar eventos previos del mismo documento y misma fuente 'ia'
  if (documentoId) {
    await supabase
      .from('subvencion_eventos')
      .delete()
      .eq('subvencion_id', subvencionId)
      .eq('documento_id', documentoId)
      .eq('fuente', 'ia');
  }

  await supabase.from('subvencion_eventos').insert(eventos);
}

// ─── Detectar conflictos ──────────────────────────────────────────────────────

interface ConflictoDetectado {
  tipo_conflicto: TipoConflicto;
  campo_afectado: string;
  valor_a: string;
  fuente_a: string;
  valor_b: string;
  fuente_b: string;
  descripcion: string;
  severidad: 'baja' | 'media' | 'alta';
}

/**
 * Detecta conflictos entre el resultado de IA y datos del raw BDNS.
 */
export function detectarConflictos(
  g: IaExtraccionConGrounding,
  bdnsRaw: Record<string, unknown>,
): ConflictoDetectado[] {
  const conflictos: ConflictoDetectado[] = [];

  // Conflicto de fecha fin
  const bdnsFechaFin = (bdnsRaw.fechaFinSolicitud ?? bdnsRaw.plazo_fin) as string | undefined;
  const iaFechaFin = g.plazo_fin.valor as string | null;
  if (bdnsFechaFin && iaFechaFin && g.plazo_fin.confidence > 0.6) {
    const bdnsNorm = bdnsFechaFin.split('T')[0];
    if (bdnsNorm !== iaFechaFin) {
      conflictos.push({
        tipo_conflicto: 'fecha_inconsistente',
        campo_afectado: 'plazo_fin',
        valor_a: bdnsNorm,
        fuente_a: 'BDNS raw',
        valor_b: iaFechaFin,
        fuente_b: `IA (${g.modelo})`,
        descripcion: `La fecha de cierre del plazo difiere: BDNS dice ${bdnsNorm}, el documento dice ${iaFechaFin}.`,
        severidad: 'alta',
      });
    }
  }

  // Conflicto de importe máximo
  const bdnsImporte = bdnsRaw.importeMaximo as number | undefined;
  const iaImporte = g.importe_maximo.valor as number | null;
  if (bdnsImporte && iaImporte && g.importe_maximo.confidence > 0.6) {
    const diff = Math.abs(bdnsImporte - iaImporte) / bdnsImporte;
    if (diff > 0.05) { // >5% diferencia
      conflictos.push({
        tipo_conflicto: 'importe_inconsistente',
        campo_afectado: 'importe_maximo',
        valor_a: String(bdnsImporte),
        fuente_a: 'BDNS raw',
        valor_b: String(iaImporte),
        fuente_b: `IA (${g.modelo})`,
        descripcion: `El importe máximo difiere más de un 5%: BDNS ${bdnsImporte}€ vs PDF ${iaImporte}€.`,
        severidad: 'media',
      });
    }
  }

  // Dato dudoso: confidence muy baja en campo crítico
  const camposCriticos: Array<keyof IaExtraccionConGrounding> = ['plazo_fin', 'importe_maximo', 'estado_convocatoria'];
  for (const campo of camposCriticos) {
    const f = g[campo] as IaFieldResult<unknown>;
    if (f.valor !== null && f.confidence < 0.4) {
      conflictos.push({
        tipo_conflicto: 'dato_dudoso',
        campo_afectado: campo,
        valor_a: String(f.valor),
        fuente_a: `IA (${g.modelo})`,
        valor_b: '',
        fuente_b: '',
        descripcion: `El campo ${campo} tiene confidence baja (${f.confidence.toFixed(2)}). Requiere revisión manual.`,
        severidad: 'baja',
      });
    }
  }

  return conflictos;
}

export async function guardarConflictos(
  supabase: SupabaseClient,
  subvencionId: string,
  bdnsId: string,
  conflictos: ConflictoDetectado[],
): Promise<void> {
  if (!conflictos.length) return;

  const rows = conflictos.map(c => ({
    subvencion_id: subvencionId,
    bdns_id: bdnsId,
    ...c,
    resuelto: false,
  }));

  await supabase.from('subvencion_conflictos').insert(rows);
}

// ─── Función orquestadora ─────────────────────────────────────────────────────

/**
 * Persiste el resultado completo de una extracción con grounding:
 *   · Campos extraídos
 *   · Eventos detectados
 *   · Conflictos con datos BDNS
 */
export async function persistirGrounding(
  supabase: SupabaseClient,
  subvencionId: string,
  bdnsId: string,
  documentoId: string | null,
  g: IaExtraccionConGrounding,
  bdnsRaw: Record<string, unknown> = {},
): Promise<void> {
  await Promise.all([
    guardarCamposConGrounding(supabase, subvencionId, bdnsId, documentoId, g),
    guardarEventos(supabase, subvencionId, bdnsId, documentoId, g),
  ]);

  const conflictos = detectarConflictos(g, bdnsRaw);
  await guardarConflictos(supabase, subvencionId, bdnsId, conflictos);
}
