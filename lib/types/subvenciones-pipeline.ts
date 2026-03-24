/**
 * lib/types/subvenciones-pipeline.ts
 *
 * Tipos del sistema de ingestión y normalización de subvenciones BDNS.
 * Cubre todo el flujo: raw → pdf → texto → IA → normalizado
 */

// ─── BDNS API raw ─────────────────────────────────────────────────────────────

/**
 * Convocatoria tal cual devuelve la API BDNS /convocatorias/busqueda.
 * Campos reales confirmados: id, numeroConvocatoria, descripcion, nivel1-3, fechaRecepcion.
 * La URL del PDF se construye como:
 *   https://www.infosubvenciones.es/bdnstrans/GE/es/convocatorias/{numeroConvocatoria}/extracto
 */
export interface BdnsConvocatoria {
  // ── Campos reales de la API BDNS ──────────────────────────────────────────
  id?: number;                     // ID interno BDNS (numérico)
  numeroConvocatoria: number | string;  // ID público (ej: "893737")
  descripcion?: string;            // Título/descripción de la convocatoria
  descripcionLeng?: string;        // Descripción en lengua cooficial
  fechaRecepcion?: string;         // Fecha de publicación (YYYY-MM-DD)
  nivel1?: string;                 // Ámbito: ESTATAL / AUTONOMICA / LOCAL
  nivel2?: string;                 // Comunidad autónoma o ministerio
  nivel3?: string;                 // Organismo convocante
  codigoInvente?: string | null;
  mrr?: boolean;                   // ¿Es fondo MRR/NextGen?

  // ── Campos legacy / compatibilidad (pueden venir vacíos) ─────────────────
  titulo?: string;
  organo?: string;
  descripcionObjetivo?: string;
  fechaPublicacion?: string;
  fechaInicioSolicitud?: string;
  fechaFinSolicitud?: string;
  importeTotal?: number;
  importeMaximo?: number;
  porcentajeCofinanciacion?: number;
  urlConvocatoria?: string;
  urlPdf?: string;
  estadoConvocatoria?: string;
  ambitoGeografico?: string;
  descripcionBeneficiarios?: string;

  [key: string]: unknown;
}

/** Respuesta paginada de la API BDNS */
export interface BdnsListResponse {
  content: BdnsConvocatoria[];
  totalElements: number;
  totalPages: number;
  number: number;      // página actual (0-indexed)
  size: number;
}

// ─── REGISTROS BD ─────────────────────────────────────────────────────────────

export interface SubvencionRaw {
  id: string;
  bdns_id: string;
  fuente: 'bdns' | 'boe' | 'mcp' | 'manual';
  raw_json: BdnsConvocatoria;
  url_fuente?: string;
  hash_raw: string;
  fecha_ingesta: string;
  created_at: string;
}

export interface SubvencionPdf {
  id: string;
  raw_id: string;
  bdns_id: string;
  url_pdf: string;
  storage_path?: string;
  hash_pdf?: string;
  tamanio_bytes?: number;
  num_paginas?: number;
  estado: 'pendiente' | 'descargado' | 'error_descarga' | 'no_disponible';
  error_msg?: string;
  intentos: number;
  descargado_at?: string;
  created_at: string;
  updated_at: string;
}

export interface SubvencionTexto {
  id: string;
  pdf_id: string;
  raw_id: string;
  bdns_id: string;
  texto_bruto?: string;
  texto_limpio?: string;
  hash_texto?: string;
  num_caracteres?: number;
  num_palabras?: number;
  necesita_ocr: boolean;
  estado: 'pendiente' | 'extraido' | 'error_extraccion' | 'necesita_ocr';
  error_msg?: string;
  extraido_at?: string;
  created_at: string;
}

export type PipelineEstado = 'raw' | 'pdf_descargado' | 'texto_extraido' | 'ia_procesado' | 'normalizado' | 'error';
export type EstadoConvocatoria = 'abierta' | 'cerrada' | 'proxima' | 'suspendida' | 'resuelta' | 'desconocido';

export interface Subvencion {
  id: string;
  raw_id?: string;
  bdns_id: string;
  fuente: string;

  titulo: string;
  organismo?: string;
  departamento?: string;
  ambito_geografico?: string;
  comunidad_autonoma?: string;
  provincia?: string;

  objeto?: string;
  resumen_ia?: string;
  puntos_clave?: string[];
  para_quien?: string;

  fecha_publicacion?: string;
  plazo_inicio?: string;
  plazo_fin?: string;
  plazo_presentacion?: string;
  importe_maximo?: number;
  importe_minimo?: number;
  porcentaje_financiacion?: number;
  presupuesto_total?: number;

  url_oficial?: string;
  url_pdf?: string;
  url_bases_reguladoras?: string;

  estado_convocatoria: EstadoConvocatoria;
  pipeline_estado: PipelineEstado;
  pipeline_error?: string;
  ia_procesado_at?: string;
  ia_modelo?: string;
  ia_confidence?: number;

  hash_contenido?: string;
  version: number;

  created_at: string;
  updated_at: string;
}

export interface SubvencionRequisito {
  id: string;
  subvencion_id: string;
  tipo?: string;
  descripcion: string;
  obligatorio: boolean;
  orden: number;
}

export interface SubvencionGasto {
  id: string;
  subvencion_id: string;
  categoria?: string;
  descripcion: string;
  porcentaje_max?: number;
  notas?: string;
  orden: number;
}

export interface SubvencionDocumentacion {
  id: string;
  subvencion_id: string;
  nombre: string;
  descripcion?: string;
  obligatorio: boolean;
  orden: number;
}

export interface SubvencionSector {
  id: string;
  subvencion_id: string;
  cnae_codigo?: string;
  nombre_sector: string;
  excluido: boolean;
}

export interface SubvencionTipoEmpresa {
  id: string;
  subvencion_id: string;
  tipo: string;
  descripcion?: string;
  excluido: boolean;
}

export interface SubvencionActualizacion {
  id: string;
  subvencion_id: string;
  bdns_id: string;
  tipo_cambio: string;
  resumen_cambio?: string;
  campos_cambiados?: string[];
  raw_before?: Record<string, unknown>;
  raw_after?: Record<string, unknown>;
  hash_antes?: string;
  hash_despues?: string;
  detectada_at: string;
}

export interface SubvencionIngestaLog {
  id: string;
  fecha_ingesta: string;
  fuente: string;
  estado: 'running' | 'completado' | 'error' | 'parcial';
  total_consultadas: number;
  nuevas: number;
  actualizadas: number;
  sin_cambios: number;
  errores: number;
  duracion_ms?: number;
  parametros?: Record<string, unknown>;
  error_msg?: string;
  iniciado_at: string;
  completado_at?: string;
}

// ─── RESULTADO DE IA ─────────────────────────────────────────────────────────

/** JSON estructurado que extrae la IA del texto del PDF */
export interface IaExtraccionResult {
  objeto: string | null;
  beneficiarios: string[] | null;
  requisitos: Array<{
    tipo: 'juridico' | 'economico' | 'sector' | 'otro';
    descripcion: string;
    obligatorio: boolean;
  }> | null;
  gastos_subvencionables: Array<{
    categoria: string;
    descripcion: string;
    porcentaje_max?: number;
  }> | null;
  documentacion_exigida: Array<{
    nombre: string;
    descripcion?: string;
    obligatorio: boolean;
  }> | null;
  importe_maximo: number | null;
  importe_minimo: number | null;
  porcentaje_financiacion: number | null;
  presupuesto_total: number | null;
  plazo_inicio: string | null;       // ISO date o null
  plazo_fin: string | null;
  plazo_presentacion_texto: string | null;
  ambito_geografico: 'nacional' | 'autonomico' | 'local' | null;
  comunidad_autonoma: string | null;
  provincia: string | null;
  sectores: Array<{
    cnae_codigo?: string;
    nombre_sector: string;
    excluido: boolean;
  }> | null;
  tipos_empresa: Array<{
    tipo: 'pyme' | 'micropyme' | 'grande' | 'autonomo' | 'startup' | 'otro';
    descripcion?: string;
    excluido: boolean;
  }> | null;
  estado_convocatoria: 'abierta' | 'cerrada' | 'proxima' | 'suspendida' | 'resuelta' | null;
  resumen_ia: string | null;
  puntos_clave: string[] | null;
  para_quien: string | null;
  observaciones: string | null;
  confidence_score: number;          // 0-1 confianza general del análisis
}

// ─── PIPELINE ─────────────────────────────────────────────────────────────────

export interface PipelineOptions {
  fechaDesde?: string;               // ISO date, por defecto ayer
  fechaHasta?: string;               // ISO date, por defecto hoy
  limite?: number;                   // max convocatorias a procesar
  soloNuevas?: boolean;              // si true, salta las que ya existen sin cambios
  forzarReextraccion?: boolean;      // si true, reprocesa aunque ya tenga texto
  forzarReanalisis?: boolean;        // si true, reprocesa con IA aunque ya esté normalizado
  organo?: string;                   // filtrar por organismo
}

export interface PipelineResultado {
  logId: string;
  nuevas: number;
  actualizadas: number;
  sin_cambios: number;
  errores: number;
  duracion_ms: number;
  errores_detalle: Array<{ bdns_id: string; etapa: string; error: string }>;
}

export interface EtapaPipelineResult {
  ok: boolean;
  error?: string;
  skip?: boolean;    // si se saltó porque ya estaba procesado
}

// ─── V2: MULTI-DOCUMENTO ──────────────────────────────────────────────────────

export type TipoDocumento =
  | 'extracto' | 'convocatoria' | 'bases_reguladoras'
  | 'correccion' | 'ampliacion' | 'resolucion' | 'otro';

export type EstadoDocumento =
  | 'pendiente' | 'descargado' | 'texto_extraido'
  | 'ia_procesado' | 'error' | 'no_disponible';

export interface SubvencionDocumento {
  id: string;
  subvencion_id: string;
  bdns_id: string;
  tipo_documento: TipoDocumento;
  titulo?: string;
  url_origen: string;
  storage_path?: string;
  hash_pdf?: string;
  tamanio_bytes?: number;
  num_paginas?: number;
  texto_extraido?: string;
  hash_texto?: string;
  estado: EstadoDocumento;
  error_msg?: string;
  intentos: number;
  es_principal: boolean;
  fecha_documento?: string;
  orden: number;
  descargado_at?: string;
  procesado_at?: string;
  created_at: string;
  updated_at: string;
}

// ─── V2: GROUNDING ────────────────────────────────────────────────────────────

export type MetodoExtraccion = 'ia' | 'regex' | 'bdns_raw' | 'manual' | 'calculado';

/** Un campo extraído con trazabilidad completa */
export interface SubvencionCampoExtraido {
  id: string;
  subvencion_id: string;
  documento_id?: string;
  bdns_id: string;
  nombre_campo: string;
  valor_texto?: string;
  valor_json?: unknown;
  fragmento_texto?: string;
  pagina_estimada?: number;
  metodo: MetodoExtraccion;
  modelo_ia?: string;
  confidence?: number;
  revisado: boolean;
  revisado_at?: string;
  override_manual: boolean;
  version: number;
  supersedido_por?: string;
  created_at: string;
}

/** Resultado de un campo individual en la extracción con grounding */
export interface IaFieldResult<T = string | number | null> {
  valor: T;
  fragmento_texto?: string;
  pagina_estimada?: number;
  confidence: number;
}

/** Resultado completo de IA con grounding por campo */
export interface IaExtraccionConGrounding {
  objeto: IaFieldResult<string | null>;
  beneficiarios: IaFieldResult<string[] | null>;
  importe_maximo: IaFieldResult<number | null>;
  importe_minimo: IaFieldResult<number | null>;
  porcentaje_financiacion: IaFieldResult<number | null>;
  presupuesto_total: IaFieldResult<number | null>;
  plazo_inicio: IaFieldResult<string | null>;
  plazo_fin: IaFieldResult<string | null>;
  plazo_presentacion_texto: IaFieldResult<string | null>;
  ambito_geografico: IaFieldResult<'nacional' | 'autonomico' | 'local' | null>;
  comunidad_autonoma: IaFieldResult<string | null>;
  provincia: IaFieldResult<string | null>;
  estado_convocatoria: IaFieldResult<'abierta' | 'cerrada' | 'proxima' | 'suspendida' | 'resuelta' | null>;
  resumen_ia: IaFieldResult<string | null>;
  puntos_clave: IaFieldResult<string[] | null>;
  para_quien: IaFieldResult<string | null>;
  // Estos campos se guardan como valor_json
  requisitos: IaFieldResult<IaExtraccionResult['requisitos']>;
  gastos_subvencionables: IaFieldResult<IaExtraccionResult['gastos_subvencionables']>;
  documentacion_exigida: IaFieldResult<IaExtraccionResult['documentacion_exigida']>;
  sectores: IaFieldResult<IaExtraccionResult['sectores']>;
  tipos_empresa: IaFieldResult<IaExtraccionResult['tipos_empresa']>;
  observaciones: IaFieldResult<string | null>;
  confidence_score: number;          // confianza global del análisis
  modelo: string;
  tokens_usados: number;
}

// ─── V2: EVENTOS ──────────────────────────────────────────────────────────────

export type TipoEvento =
  | 'publicacion' | 'apertura_plazo' | 'cierre_plazo'
  | 'correccion' | 'ampliacion_plazo' | 'suspension'
  | 'resolucion' | 'pago' | 'otro';

export interface SubvencionEvento {
  id: string;
  subvencion_id: string;
  documento_id?: string;
  bdns_id: string;
  tipo_evento: TipoEvento;
  fecha_evento?: string;
  fecha_evento_fin?: string;
  titulo?: string;
  descripcion?: string;
  fuente: 'ia' | 'bdns' | 'sistema' | 'manual';
  fragmento_texto?: string;
  pagina_estimada?: number;
  confidence?: number;
  created_at: string;
}

// ─── V2: ESTADO CALCULADO ────────────────────────────────────────────────────

export interface SubvencionEstadoCalculado {
  id: string;
  subvencion_id: string;
  bdns_id: string;
  estado: EstadoConvocatoria;
  razon?: string;
  dias_para_cierre?: number;
  urgente: boolean;
  calculado_at: string;
  plazo_inicio_usado?: string;
  plazo_fin_usado?: string;
  tiene_evento_suspension: boolean;
  tiene_evento_resolucion: boolean;
  tiene_evento_ampliacion: boolean;
  created_at: string;
  updated_at: string;
}

/** Input para la máquina de estados */
export interface EstadoCalculatorInput {
  plazo_inicio?: string | null;
  plazo_fin?: string | null;
  fecha_publicacion?: string | null;
  eventos: Pick<SubvencionEvento, 'tipo_evento' | 'fecha_evento' | 'fecha_evento_fin'>[];
  ahora?: Date;
}

/** Output de la máquina de estados */
export interface EstadoCalculatorOutput {
  estado: EstadoConvocatoria;
  razon: string;
  dias_para_cierre?: number;
  urgente: boolean;
  tiene_evento_suspension: boolean;
  tiene_evento_resolucion: boolean;
  tiene_evento_ampliacion: boolean;
}

// ─── V2: CONFLICTOS ───────────────────────────────────────────────────────────

export type TipoConflicto =
  | 'fecha_inconsistente' | 'importe_inconsistente'
  | 'estado_inconsistente' | 'documento_contradice_bdns'
  | 'documento_contradice_documento' | 'dato_dudoso' | 'otro';

export interface SubvencionConflicto {
  id: string;
  subvencion_id: string;
  bdns_id: string;
  tipo_conflicto: TipoConflicto;
  campo_afectado?: string;
  valor_a?: string;
  fuente_a?: string;
  valor_b?: string;
  fuente_b?: string;
  descripcion?: string;
  severidad: 'baja' | 'media' | 'alta';
  resuelto: boolean;
  resolucion?: string;
  resuelto_at?: string;
  created_at: string;
}

// ─── V2: DETALLE COMPLETO (API response) ─────────────────────────────────────

/** Respuesta completa del endpoint GET /api/subvenciones/[id] */
export interface SubvencionDetalle extends Subvencion {
  documentos: SubvencionDocumento[];
  campos_extraidos: SubvencionCampoExtraido[];
  eventos: SubvencionEvento[];
  estado_calculado?: SubvencionEstadoCalculado;
  conflictos: SubvencionConflicto[];
  requisitos_list: SubvencionRequisito[];
  gastos_list: SubvencionGasto[];
  documentacion_list: SubvencionDocumentacion[];
  sectores_list: SubvencionSector[];
  tipos_empresa_list: SubvencionTipoEmpresa[];
  actualizaciones: SubvencionActualizacion[];
}
