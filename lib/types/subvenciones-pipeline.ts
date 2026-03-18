/**
 * lib/types/subvenciones-pipeline.ts
 *
 * Tipos del sistema de ingestión y normalización de subvenciones BDNS.
 * Cubre todo el flujo: raw → pdf → texto → IA → normalizado
 */

// ─── BDNS API raw ─────────────────────────────────────────────────────────────

/** Convocatoria tal cual devuelve la API BDNS */
export interface BdnsConvocatoria {
  numeroConvocatoria: number | string;
  titulo: string;
  organo?: string;
  descripcionObjetivo?: string;
  fechaPublicacion?: string;       // ISO date string
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
  // campos extra que pueden venir
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
