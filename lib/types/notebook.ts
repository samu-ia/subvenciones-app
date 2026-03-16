/**
 * Tipos compartidos para el sistema Notebook Inteligente de Subvenciones
 */

// ─── Subvención detectada ─────────────────────────────────────────────────────

export type EstadoConvocatoria = 'abierta' | 'cerrada' | 'proxima' | 'por_confirmar';
export type EstadoExpediente =
  | 'detectada' | 'revisando' | 'viable'
  | 'preparando' | 'presentada' | 'concedida' | 'denegada' | 'descartada';

export interface SubvencionDetectada {
  id: string;
  reunion_id?: string | null;
  expediente_id?: string | null;
  nif?: string | null;

  titulo: string;
  organismo?: string | null;
  descripcion?: string | null;
  importe_max?: number | null;
  plazo_inicio?: string | null;   // ISO date
  plazo_fin?: string | null;
  estado_conv: EstadoConvocatoria;
  url_oficial?: string | null;
  numero_bdns?: string | null;

  // IA
  resumen_ia?: string | null;
  motivo_match?: string | null;
  puntuacion?: number | null;
  encaja: boolean;
  motivo_rechazo?: string | null;
  docs_faltantes?: string[] | null;

  // Expediente
  estado_expediente: EstadoExpediente;
  presentada?: boolean | null;
  concedida?: boolean | null;
  importe_concedido?: number | null;

  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;

  // Relaciones cargadas
  checklist?: SubvencionChecklistItem[];
  documentos?: SubvencionDocumento[];
}

export interface SubvencionChecklistItem {
  id: string;
  subvencion_id: string;
  orden: number;
  texto: string;
  completado: boolean;
  obligatorio: boolean;
  notas?: string | null;
}

export interface SubvencionDocumento {
  id: string;
  subvencion_id: string;
  documento_id?: string | null;
  archivo_id?: string | null;
  tipo: 'bases_oficiales' | 'analisis' | 'documentacion_cliente' | 'generado_ia' | 'otro';
}

// ─── Investigación / Deep Search ──────────────────────────────────────────────

export type EstadoInvestigacion = 'pendiente' | 'ejecutando' | 'completada' | 'error';

export interface Investigacion {
  id: string;
  reunion_id?: string | null;
  expediente_id?: string | null;
  nif?: string | null;
  datos_cliente: ClienteSnapshot;
  estado: EstadoInvestigacion;
  num_subvenciones_encontradas: number;
  documento_id?: string | null;
  resumen?: string | null;
  error_msg?: string | null;
  proveedor?: string | null;
  modelo?: string | null;
  tokens_usados?: number | null;
  duracion_ms?: number | null;
  created_at: string;
  completed_at?: string | null;
}

// ─── Snapshot de cliente para la investigación ────────────────────────────────

export interface ClienteSnapshot {
  nif?: string;
  nombre?: string;
  cnae?: string;
  actividad?: string;
  sector?: string;
  ciudad?: string;
  comunidad_autonoma?: string;
  tamano_empresa?: string;    // 'micro' | 'pequeña' | 'mediana' | 'grande'
  empleados?: number;
  ventas?: number;
  forma_juridica?: string;
  fecha_constitucion?: string;
  observaciones_adicionales?: string;
}

// ─── Resultado de deep search (lo que devuelve la API) ───────────────────────

export interface DeepSearchResult {
  investigacion_id: string;
  documento_id: string;        // ID del doc investigacion_subvenciones.md
  subvenciones: SubvencionDetectada[];
  resumen: string;
  num_encontradas: number;
}

// ─── Estado del notebook (lado cliente) ──────────────────────────────────────

export type PanelNotebookTab = 'chat' | 'tools' | 'settings';

export interface NotebookState {
  investigacionEstado: EstadoInvestigacion;
  subvenciones: SubvencionDetectada[];
  subvencionActivaId: string | null;
  searchProgress: DeepSearchProgressStep[];
}

export interface DeepSearchProgressStep {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'error';
  detail?: string;
}

// ─── Constantes de UI ─────────────────────────────────────────────────────────

export const ESTADO_EXPEDIENTE_LABELS: Record<EstadoExpediente, string> = {
  detectada:   'Detectada',
  revisando:   'Revisando',
  viable:      'Viable',
  preparando:  'Preparando',
  presentada:  'Presentada',
  concedida:   '✅ Concedida',
  denegada:    '❌ Denegada',
  descartada:  'Descartada',
};

export const ESTADO_EXPEDIENTE_COLOR: Record<EstadoExpediente, string> = {
  detectada:   '#6b7280',
  revisando:   '#2563eb',
  viable:      '#16a34a',
  preparando:  '#d97706',
  presentada:  '#7c3aed',
  concedida:   '#15803d',
  denegada:    '#dc2626',
  descartada:  '#9ca3af',
};

export const ESTADO_CONV_LABELS: Record<EstadoConvocatoria, string> = {
  abierta:       '🟢 Abierta',
  cerrada:       '🔴 Cerrada',
  proxima:       '🟡 Próxima',
  por_confirmar: '⚪ Por confirmar',
};
