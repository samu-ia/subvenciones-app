/**
 * lib/subvenciones/normalizer.ts
 *
 * Toma el resultado de IaExtraccionResult + datos del raw BDNS
 * y lo escribe de forma normalizada en todas las tablas de la BD:
 *   - subvenciones (tabla principal)
 *   - subvencion_requisitos
 *   - subvencion_gastos
 *   - subvencion_documentacion
 *   - subvencion_sectores
 *   - subvencion_tipos_empresa
 *   - subvencion_actualizaciones (si hay cambios)
 *
 * Deduplicación:
 *  1. Si bdns_id ya existe → comparar hash_contenido
 *  2. Si hash cambió → actualizar + registrar en subvencion_actualizaciones
 *  3. Si hash igual → no hacer nada
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  BdnsConvocatoria,
  IaExtraccionResult,
  EstadoConvocatoria,
  EtapaPipelineResult,
} from '@/lib/types/subvenciones-pipeline';

// ─── Utilidades ───────────────────────────────────────────────────────────────

async function sha256(text: string): Promise<string> {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Normaliza fecha de string a ISO YYYY-MM-DD o null */
function parseDate(val: string | null | undefined): string | null {
  if (!val) return null;
  // Si ya es YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  // Si es DD/MM/YYYY
  const slashMatch = val.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slashMatch) return `${slashMatch[3]}-${slashMatch[2]}-${slashMatch[1]}`;
  // Intentar Date nativo
  try {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  } catch { /* ignore */ }
  return null;
}

/** Mapea estado del raw BDNS a nuestro enum normalizado */
function normalizarEstado(estadoRaw?: string): EstadoConvocatoria {
  const v = (estadoRaw ?? '').toLowerCase().trim();
  if (v.includes('abierta') || v.includes('activ') || v.includes('vigente')) return 'abierta';
  if (v.includes('cerrada') || v.includes('finalizada') || v.includes('plazo')) return 'cerrada';
  if (v.includes('próxima') || v.includes('proxima') || v.includes('pendiente')) return 'proxima';
  if (v.includes('suspendida') || v.includes('anulada')) return 'suspendida';
  if (v.includes('resuelta') || v.includes('concedida')) return 'resuelta';
  return 'desconocido';
}

// ─── Construir payload principal ──────────────────────────────────────────────

interface NormalizarInput {
  rawId: string;
  bdns_id: string;
  raw: BdnsConvocatoria;
  ia: IaExtraccionResult;
  iaModelo: string;
  fuente?: string;
}

function construirPayloadPrincipal(input: NormalizarInput) {
  const { rawId, bdns_id, raw, ia, iaModelo, fuente = 'bdns' } = input;

  // Los datos de IA tienen preferencia sobre los del raw (más precisos)
  // pero el raw se usa como fallback

  const plazoInicio = parseDate(ia.plazo_inicio ?? raw.fechaInicioSolicitud);
  const plazoFin = parseDate(ia.plazo_fin ?? raw.fechaFinSolicitud);
  // fechaRecepcion es el campo real de BDNS, fechaPublicacion es legacy
  const fechaPublicacion = parseDate(raw.fechaRecepcion ?? raw.fechaPublicacion);
  // URL del PDF: construida a partir del numeroConvocatoria si no viene explícita
  const numConv = String(raw.numeroConvocatoria);
  const urlPdfFinal = raw.urlPdf
    ?? `https://www.infosubvenciones.es/bdnstrans/GE/es/convocatorias/${numConv}/extracto`;
  const urlConvFinal = raw.urlConvocatoria
    ?? `https://www.infosubvenciones.es/bdnstrans/GE/es/convocatorias/${numConv}`;

  const estadoConvocatoria = ia.estado_convocatoria
    ? ia.estado_convocatoria
    : normalizarEstado(raw.estadoConvocatoria);

  return {
    raw_id: rawId,
    bdns_id,
    fuente,

    // Mapeo campos reales BDNS: descripcion=titulo, nivel3=organismo
    titulo: raw.descripcion ?? raw.titulo ?? `Convocatoria ${bdns_id}`,
    organismo: raw.nivel3 ?? raw.organo ?? null,
    departamento: raw.nivel2 ?? null,
    ambito_geografico: ia.ambito_geografico ?? raw.nivel1 ?? null,
    comunidad_autonoma: ia.comunidad_autonoma ?? raw.nivel2 ?? null,
    provincia: ia.provincia ?? null,

    objeto: ia.objeto ?? raw.descripcionObjetivo ?? raw.descripcion ?? null,
    resumen_ia: ia.resumen_ia ?? null,
    puntos_clave: ia.puntos_clave ?? null,
    para_quien: ia.para_quien ?? null,

    fecha_publicacion: fechaPublicacion,
    plazo_inicio: plazoInicio,
    plazo_fin: plazoFin,
    plazo_presentacion: ia.plazo_presentacion_texto ?? null,

    importe_maximo: ia.importe_maximo ?? raw.importeMaximo ?? null,
    importe_minimo: ia.importe_minimo ?? null,
    porcentaje_financiacion: ia.porcentaje_financiacion ?? raw.porcentajeCofinanciacion ?? null,
    presupuesto_total: ia.presupuesto_total ?? raw.importeTotal ?? null,

    url_oficial: urlConvFinal,
    url_pdf: urlPdfFinal,

    estado_convocatoria: estadoConvocatoria,
    pipeline_estado: 'normalizado',
    pipeline_error: null,
    ia_procesado_at: new Date().toISOString(),
    ia_modelo: iaModelo,
    ia_confidence: ia.confidence_score,

    updated_at: new Date().toISOString(),
  };
}

// ─── Escritura en tablas auxiliares ──────────────────────────────────────────

async function escribirTablaAuxiliar(
  supabase: SupabaseClient,
  tabla: string,
  subvencionId: string,
  filas: Array<Record<string, unknown>>
): Promise<void> {
  if (!filas.length) return;

  // Borrar existentes (upsert completo en cada normalización)
  await supabase.from(tabla).delete().eq('subvencion_id', subvencionId);

  const rows = filas.map((f, i) => ({ ...f, subvencion_id: subvencionId, orden: i }));
  await supabase.from(tabla).insert(rows);
}

// ─── Función principal ────────────────────────────────────────────────────────

export interface NormalizarResult {
  subvencionId: string;
  esNueva: boolean;
  haCambiado: boolean;
}

/**
 * Normaliza el resultado de IA y lo persiste en la BD.
 * Maneja deduplicación y registro de cambios automáticamente.
 */
export async function normalizarYGuardar(
  supabase: SupabaseClient,
  input: NormalizarInput
): Promise<NormalizarResult & EtapaPipelineResult> {
  const { rawId, bdns_id, raw, ia, iaModelo, fuente } = input;

  try {
    const payload = construirPayloadPrincipal(input);

    // Hash del contenido normalizado para detectar cambios futuros
    const hashContenido = await sha256(JSON.stringify({
      titulo: payload.titulo,
      objeto: payload.objeto,
      plazo_fin: payload.plazo_fin,
      importe_maximo: payload.importe_maximo,
      estado_convocatoria: payload.estado_convocatoria,
    }));

    // ─ Verificar si ya existe ─────────────────────────────────────────────────
    const { data: existente } = await supabase
      .from('subvenciones')
      .select('id, hash_contenido, version, raw_id')
      .eq('bdns_id', bdns_id)
      .maybeSingle();

    if (existente) {
      // ─ Ya existe: ¿ha cambiado? ──────────────────────────────────────────
      if (existente.hash_contenido === hashContenido) {
        // Sin cambios: solo actualizar pipeline_estado si hace falta
        await supabase.from('subvenciones')
          .update({ pipeline_estado: 'normalizado', pipeline_error: null, updated_at: new Date().toISOString() })
          .eq('id', existente.id);

        return { ok: true, skip: true, subvencionId: existente.id, esNueva: false, haCambiado: false };
      }

      // ─ Ha cambiado: actualizar ───────────────────────────────────────────
      const rawAntes = existente.raw_id
        ? (await supabase.from('subvenciones_raw').select('raw_json').eq('id', existente.raw_id).single()).data?.raw_json
        : null;

      const cambiosCampos = detectarCamposModificados(existente as Record<string, unknown>, {
        ...payload,
        hash_contenido: hashContenido,
      });

      const { error: updateErr } = await supabase.from('subvenciones')
        .update({
          ...payload,
          hash_contenido: hashContenido,
          version: (existente.version ?? 1) + 1,
        })
        .eq('id', existente.id);

      if (updateErr) throw new Error(`Update subvención: ${updateErr.message}`);

      // Actualizar tablas auxiliares
      await Promise.all([
        escribirTablaAuxiliar(supabase, 'subvencion_requisitos', existente.id,
          (ia.requisitos ?? []).map(r => ({ tipo: r.tipo, descripcion: r.descripcion, obligatorio: r.obligatorio }))),
        escribirTablaAuxiliar(supabase, 'subvencion_gastos', existente.id,
          (ia.gastos_subvencionables ?? []).map(g => ({ categoria: g.categoria, descripcion: g.descripcion, porcentaje_max: g.porcentaje_max ?? null }))),
        escribirTablaAuxiliar(supabase, 'subvencion_documentacion', existente.id,
          (ia.documentacion_exigida ?? []).map(d => ({ nombre: d.nombre, descripcion: d.descripcion ?? null, obligatorio: d.obligatorio }))),
        escribirTablaAuxiliar(supabase, 'subvencion_sectores', existente.id,
          (ia.sectores ?? []).map(s => ({ cnae_codigo: s.cnae_codigo ?? null, nombre_sector: s.nombre_sector, excluido: s.excluido }))),
        escribirTablaAuxiliar(supabase, 'subvencion_tipos_empresa', existente.id,
          (ia.tipos_empresa ?? []).map(t => ({ tipo: t.tipo, descripcion: t.descripcion ?? null, excluido: t.excluido }))),
      ]);

      // Registrar actualización en historial
      await supabase.from('subvencion_actualizaciones').insert({
        subvencion_id: existente.id,
        bdns_id,
        tipo_cambio: 'datos_actualizados',
        resumen_cambio: `Actualización detectada. Campos cambiados: ${cambiosCampos.join(', ')}`,
        campos_cambiados: cambiosCampos,
        raw_before: rawAntes as Record<string, unknown>,
        raw_after: raw as Record<string, unknown>,
        hash_antes: existente.hash_contenido,
        hash_despues: hashContenido,
      });

      // Encolar re-matching para clientes afectados
      try {
        await supabase.from('subvencion_reanalisis_jobs').insert({
          subvencion_id: existente.id,
          bdns_id,
          tipo_job: 'reanalisis_completo',
          prioridad: 3,
          motivo: `Hash change detectado. Campos: ${cambiosCampos.join(', ')}`,
        });
      } catch { /* non-fatal */ }

      return { ok: true, subvencionId: existente.id, esNueva: false, haCambiado: true };

    } else {
      // ─ Nueva subvención: insertar ─────────────────────────────────────────
      const { data: newRec, error: insertErr } = await supabase
        .from('subvenciones')
        .insert({ ...payload, hash_contenido: hashContenido, version: 1 })
        .select('id')
        .single();

      if (insertErr || !newRec) throw new Error(`Insert subvención: ${insertErr?.message}`);

      const subvencionId = newRec.id;

      // Insertar tablas auxiliares
      await Promise.all([
        escribirTablaAuxiliar(supabase, 'subvencion_requisitos', subvencionId,
          (ia.requisitos ?? []).map(r => ({ tipo: r.tipo, descripcion: r.descripcion, obligatorio: r.obligatorio }))),
        escribirTablaAuxiliar(supabase, 'subvencion_gastos', subvencionId,
          (ia.gastos_subvencionables ?? []).map(g => ({ categoria: g.categoria, descripcion: g.descripcion, porcentaje_max: g.porcentaje_max ?? null }))),
        escribirTablaAuxiliar(supabase, 'subvencion_documentacion', subvencionId,
          (ia.documentacion_exigida ?? []).map(d => ({ nombre: d.nombre, descripcion: d.descripcion ?? null, obligatorio: d.obligatorio }))),
        escribirTablaAuxiliar(supabase, 'subvencion_sectores', subvencionId,
          (ia.sectores ?? []).map(s => ({ cnae_codigo: s.cnae_codigo ?? null, nombre_sector: s.nombre_sector, excluido: s.excluido }))),
        escribirTablaAuxiliar(supabase, 'subvencion_tipos_empresa', subvencionId,
          (ia.tipos_empresa ?? []).map(t => ({ tipo: t.tipo, descripcion: t.descripcion ?? null, excluido: t.excluido }))),
      ]);

      return { ok: true, subvencionId, esNueva: true, haCambiado: false };
    }

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Normalizer] Error normalizando ${bdns_id}:`, msg);

    // Marcar pipeline como error
    await supabase.from('subvenciones')
      .update({ pipeline_estado: 'error', pipeline_error: msg, updated_at: new Date().toISOString() })
      .eq('bdns_id', bdns_id);

    return { ok: false, error: msg, subvencionId: '', esNueva: false, haCambiado: false };
  }
}

/** Detecta qué campos han cambiado entre dos objetos */
function detectarCamposModificados(
  antes: Record<string, unknown>,
  despues: Record<string, unknown>
): string[] {
  const campos = ['titulo', 'objeto', 'plazo_fin', 'plazo_inicio', 'importe_maximo', 'estado_convocatoria', 'organismo'];
  return campos.filter(c => String(antes[c] ?? '') !== String(despues[c] ?? ''));
}

/**
 * Marca una subvención existente como error en el pipeline.
 * Útil cuando el PDF no se pudo descargar o la IA falló.
 */
export async function marcarPipelineError(
  supabase: SupabaseClient,
  bdnsId: string,
  etapa: string,
  error: string,
  rawId?: string
): Promise<void> {
  // Actualizar si ya existe
  await supabase.from('subvenciones')
    .update({
      pipeline_estado: 'error',
      pipeline_error: `[${etapa}] ${error}`,
      updated_at: new Date().toISOString(),
    })
    .eq('bdns_id', bdnsId);

  // Si no existe aún, insertar registro mínimo con estado error
  const { data: existente } = await supabase
    .from('subvenciones')
    .select('id')
    .eq('bdns_id', bdnsId)
    .maybeSingle();

  if (!existente && rawId) {
    await supabase.from('subvenciones').insert({
      bdns_id: bdnsId,
      raw_id: rawId,
      titulo: `[Error] ${bdnsId}`,
      pipeline_estado: 'error',
      pipeline_error: `[${etapa}] ${error}`,
      estado_convocatoria: 'desconocido',
      fuente: 'bdns',
      version: 1,
    });
  }
}
