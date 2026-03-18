/**
 * lib/subvenciones/pipeline.ts
 *
 * Orquestador principal del pipeline de ingestión de subvenciones.
 *
 * Flujo completo por convocatoria:
 *   1. Fetch BDNS (o MCP) → guardar raw
 *   2. Descargar PDF → Storage
 *   3. Extraer texto del PDF
 *   4. Analizar con IA
 *   5. Normalizar y guardar en tablas finales
 *   6. Detectar cambios y registrar actualizaciones
 *
 * Diseñado para ejecutarse desde un cron diario (endpoint /api/subvenciones/ingest).
 * Procesa en serie para no sobrecargar la API BDNS ni el LLM.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { crearFuente } from './bdns-client';
import { descargarYRegistrarPdf, extraerYGuardarTexto } from './pdf-service';
import { extraerConIa, extraerResumenRapido } from './ai-extractor';
import { normalizarYGuardar, marcarPipelineError } from './normalizer';
import type {
  BdnsConvocatoria,
  PipelineOptions,
  PipelineResultado,
} from '@/lib/types/subvenciones-pipeline';

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Delay entre convocatorias para no saturar APIs externas */
const DELAY_ENTRE_ITEMS_MS = 1500;
/** Máx convocatorias por ejecución (seguro para timeout Railway ~5min) */
const LIMITE_DEFAULT = 30;
/** Esperar entre páginas BDNS */
const DELAY_ENTRE_PAGINAS_MS = 2000;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ─── Utilitarios ──────────────────────────────────────────────────────────────

/** SHA256 del raw JSON para detectar cambios en la fuente */
async function sha256(text: string): Promise<string> {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Fechas por defecto: ayer y hoy */
function fechasDefault(): { desde: string; hasta: string } {
  const hoy = new Date();
  const ayer = new Date(hoy);
  ayer.setDate(ayer.getDate() - 1);
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  return { desde: fmt(ayer), hasta: fmt(hoy) };
}

// ─── Obtener configuración IA del sistema ─────────────────────────────────────

interface IaConfig {
  provider: string;
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

async function obtenerConfigIa(supabase: SupabaseClient): Promise<IaConfig | null> {
  // Buscar configuración del primer proveedor habilitado con api_key
  const { data } = await supabase
    .from('ia_proveedores')
    .select('proveedor, api_key, base_url, modelo_default')
    .eq('habilitado', true)
    .not('api_key', 'is', null)
    .order('proveedor', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!data?.api_key) return null;

  return {
    provider: data.proveedor,
    apiKey: data.api_key,
    baseUrl: data.base_url,
    model: data.modelo_default,
  };
}

// ─── Guardar raw ──────────────────────────────────────────────────────────────

async function guardarRaw(
  supabase: SupabaseClient,
  conv: BdnsConvocatoria,
  fuente: string
): Promise<{ rawId: string; esNuevo: boolean; hashCambio: boolean }> {
  const bdnsId = String(conv.numeroConvocatoria);
  const hashRaw = await sha256(JSON.stringify(conv));
  const urlFuente = conv.urlConvocatoria ?? null;

  // ¿Ya existe este raw?
  const { data: existente } = await supabase
    .from('subvenciones_raw')
    .select('id, hash_raw')
    .eq('bdns_id', bdnsId)
    .maybeSingle();

  if (existente) {
    if (existente.hash_raw === hashRaw) {
      return { rawId: existente.id, esNuevo: false, hashCambio: false };
    }
    // Hash diferente → actualizar (aunque guardamos el raw original)
    // En realidad el raw no cambia — sólo registramos el último
    await supabase.from('subvenciones_raw')
      .update({ raw_json: conv as Record<string, unknown>, hash_raw: hashRaw, fecha_ingesta: new Date().toISOString() })
      .eq('id', existente.id);
    return { rawId: existente.id, esNuevo: false, hashCambio: true };
  }

  const { data: newRec, error } = await supabase
    .from('subvenciones_raw')
    .insert({ bdns_id: bdnsId, fuente, raw_json: conv as Record<string, unknown>, hash_raw: hashRaw, url_fuente: urlFuente })
    .select('id')
    .single();

  if (error || !newRec) throw new Error(`Insert raw: ${error?.message}`);
  return { rawId: newRec.id, esNuevo: true, hashCambio: true };
}

// ─── Procesar una convocatoria ────────────────────────────────────────────────

async function procesarConvocatoria(
  supabase: SupabaseClient,
  conv: BdnsConvocatoria,
  iaConfig: IaConfig | null,
  opciones: PipelineOptions,
  logId: string,
): Promise<{ resultado: 'nueva' | 'actualizada' | 'sin_cambio' | 'error'; bdnsId: string; error?: string }> {
  const bdnsId = String(conv.numeroConvocatoria);

  try {
    // ── PASO 1: Guardar raw ───────────────────────────────────────────────────
    const { rawId, esNuevo, hashCambio } = await guardarRaw(supabase, conv, 'bdns');

    // Actualizar pipeline_estado en subvenciones si ya existe
    if (!esNuevo && !hashCambio && !opciones.forzarReextraccion && !opciones.forzarReanalisis) {
      return { resultado: 'sin_cambio', bdnsId };
    }

    // ── PASO 2: PDF ───────────────────────────────────────────────────────────
    let textoParaIa: string | null = null;
    const urlPdf = conv.urlPdf ?? null;

    if (urlPdf) {
      // Buscar pdf existente
      const { data: pdfExistente } = await supabase
        .from('subvenciones_pdf')
        .select('id, storage_path, estado')
        .eq('raw_id', rawId)
        .maybeSingle();

      const { ok: pdfOk, pdfId, skip: pdfSkip } = await descargarYRegistrarPdf(supabase, {
        rawId,
        bdnsId,
        urlPdf,
        pdfId: pdfExistente?.id,
      });

      // Actualizar estado pipeline
      await supabase.from('subvenciones')
        .update({ pipeline_estado: 'pdf_descargado' })
        .eq('bdns_id', bdnsId);

      if (pdfOk) {
        // Buscar storage_path actualizado
        const { data: pdfRec } = await supabase
          .from('subvenciones_pdf')
          .select('storage_path, id')
          .eq('id', pdfId)
          .single();

        if (pdfRec?.storage_path) {
          // Buscar texto existente
          const { data: textoExistente } = await supabase
            .from('subvenciones_texto')
            .select('id, texto_limpio, estado')
            .eq('pdf_id', pdfId)
            .maybeSingle();

          const { ok: textoOk, texto } = await extraerYGuardarTexto(supabase, {
            pdfId,
            rawId,
            bdnsId,
            storagePath: pdfRec.storage_path,
            textoId: textoExistente?.id,
          });

          if (textoOk && texto) {
            textoParaIa = texto;
            await supabase.from('subvenciones')
              .update({ pipeline_estado: 'texto_extraido' })
              .eq('bdns_id', bdnsId);
          }
        }
      } else if (!pdfSkip) {
        console.warn(`[Pipeline] PDF no disponible para ${bdnsId}: ${urlPdf}`);
      }
    }

    // ── PASO 3: IA (opcional) ────────────────────────────────────────────────
    let iaResult;
    let iaModelo = 'sin-ia';

    if (iaConfig) {
      iaModelo = iaConfig.model ?? 'gpt-4o-mini';
      if (textoParaIa && textoParaIa.trim().length > 100) {
        const { resultado, modelo, tokensUsados: _ } = await extraerConIa(
          textoParaIa,
          { titulo: conv.titulo, organismo: conv.organo },
          iaConfig
        );
        iaResult = resultado;
        iaModelo = modelo;
      } else {
        iaResult = await extraerResumenRapido({
          titulo: conv.titulo,
          organismo: conv.organo,
          descripcion: conv.descripcionObjetivo,
          beneficiarios: conv.descripcionBeneficiarios,
          importeMaximo: conv.importeMaximo,
          fechaFin: conv.fechaFinSolicitud,
        }, iaConfig);
      }
    } else {
      // Modo básico sin IA: rellenar con datos directos de BDNS
      iaResult = {
        objeto: conv.descripcionObjetivo ?? null,
        beneficiarios: conv.descripcionBeneficiarios ? [conv.descripcionBeneficiarios] : null,
        requisitos: null,
        gastos_subvencionables: null,
        documentacion_exigida: null,
        importe_maximo: typeof conv.importeMaximo === 'number' ? conv.importeMaximo : null,
        importe_minimo: null,
        porcentaje_financiacion: typeof conv.porcentajeCofinanciacion === 'number' ? conv.porcentajeCofinanciacion : null,
        presupuesto_total: typeof conv.importeTotal === 'number' ? conv.importeTotal : null,
        plazo_inicio: conv.fechaInicioSolicitud ?? null,
        plazo_fin: conv.fechaFinSolicitud ?? null,
        plazo_presentacion_texto: null,
        ambito_geografico: null,
        comunidad_autonoma: null,
        provincia: null,
        sectores: null,
        tipos_empresa: null,
        estado_convocatoria: null,
        resumen_ia: conv.descripcionObjetivo ?? null,
        puntos_clave: null,
        para_quien: conv.descripcionBeneficiarios ?? null,
        observaciones: null,
        confidence_score: 0,
      };
    }

    await supabase.from('subvenciones')
      .update({ pipeline_estado: 'ia_procesado' })
      .eq('bdns_id', bdnsId);

    // ── PASO 4: Normalizar ────────────────────────────────────────────────────
    const { ok, subvencionId, esNueva, haCambiado, error } = await normalizarYGuardar(supabase, {
      rawId,
      bdns_id: bdnsId,
      raw: conv,
      ia: iaResult,
      iaModelo,
      fuente: 'bdns',
    });

    if (!ok) {
      return { resultado: 'error', bdnsId, error };
    }

    if (esNueva) return { resultado: 'nueva', bdnsId };
    if (haCambiado) return { resultado: 'actualizada', bdnsId };
    return { resultado: 'sin_cambio', bdnsId };

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Pipeline] Error en ${bdnsId}:`, msg);

    await marcarPipelineError(supabase, bdnsId, 'pipeline', msg).catch(() => {});
    return { resultado: 'error', bdnsId, error: msg };
  }
}

// ─── Pipeline principal ───────────────────────────────────────────────────────

/**
 * Ejecuta el pipeline completo de ingestión.
 *
 * @param supabase - Cliente Supabase con service_role (para escritura sin RLS)
 * @param opciones - Parámetros de la ejecución
 */
export async function ejecutarPipeline(
  supabase: SupabaseClient,
  opciones: PipelineOptions = {}
): Promise<PipelineResultado> {
  const inicio = Date.now();

  const { desde, hasta } = fechasDefault();
  const fechaDesde = opciones.fechaDesde ?? desde;
  const fechaHasta = opciones.fechaHasta ?? hasta;
  const limite = opciones.limite ?? LIMITE_DEFAULT;

  // Crear log de ingesta
  const { data: logRec } = await supabase
    .from('subvenciones_ingesta_log')
    .insert({
      fecha_ingesta: new Date().toISOString().split('T')[0],
      fuente: process.env.BDNS_FUENTE ?? 'bdns',
      estado: 'running',
      parametros: { fechaDesde, fechaHasta, limite, ...opciones },
    })
    .select('id')
    .single();

  const logId = logRec?.id ?? 'unknown';

  const erroresDetalle: PipelineResultado['errores_detalle'] = [];
  let nuevas = 0, actualizadas = 0, sinCambios = 0, errores = 0, totalConsultadas = 0;

  try {
    // Obtener config IA (opcional — si no hay, se guarda solo con datos BDNS)
    const iaConfig = await obtenerConfigIa(supabase);
    const modoBasico = !iaConfig;
    if (modoBasico) {
      console.warn('[Pipeline] Sin proveedor IA — modo básico (solo datos BDNS, sin análisis IA)');
    }

    // Inicializar fuente
    const fuente = crearFuente();
    let pagina = 0;
    let continuar = true;

    while (continuar && totalConsultadas < limite) {
      const { items, totalPaginas } = await fuente.listarConvocatorias({
        fechaDesde,
        fechaHasta,
        pagina,
        tamanio: Math.min(50, limite - totalConsultadas),
        organo: opciones.organo,
      });

      if (!items.length) break;

      for (const conv of items) {
        if (totalConsultadas >= limite) { continuar = false; break; }
        totalConsultadas++;

        const { resultado, bdnsId, error } = await procesarConvocatoria(
          supabase, conv, iaConfig, opciones, logId
        );

        if (resultado === 'nueva') nuevas++;
        else if (resultado === 'actualizada') actualizadas++;
        else if (resultado === 'sin_cambio') sinCambios++;
        else {
          errores++;
          erroresDetalle.push({ bdns_id: bdnsId, etapa: 'pipeline', error: error ?? 'Error desconocido' });
        }

        // Rate limiting
        await sleep(DELAY_ENTRE_ITEMS_MS);
      }

      pagina++;
      if (pagina >= totalPaginas) break;
      await sleep(DELAY_ENTRE_PAGINAS_MS);
    }

    const duracion = Date.now() - inicio;

    // Actualizar log como completado
    await supabase.from('subvenciones_ingesta_log').update({
      estado: errores > 0 && nuevas + actualizadas === 0 ? 'error' : errores > 0 ? 'parcial' : 'completado',
      total_consultadas: totalConsultadas,
      nuevas,
      actualizadas,
      sin_cambios: sinCambios,
      errores,
      duracion_ms: duracion,
      completado_at: new Date().toISOString(),
    }).eq('id', logId);

    return { logId, nuevas, actualizadas, sin_cambios: sinCambios, errores, duracion_ms: duracion, errores_detalle: erroresDetalle };

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const duracion = Date.now() - inicio;

    await supabase.from('subvenciones_ingesta_log').update({
      estado: 'error',
      error_msg: msg,
      duracion_ms: duracion,
      completado_at: new Date().toISOString(),
    }).eq('id', logId);

    throw err;
  }
}
