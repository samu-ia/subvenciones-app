export type EstadoExpediente =
  | 'DETECCION'
  | 'EVALUACION'
  | 'PREPARACION'
  | 'PRESENTADA'
  | 'SUBSANACION'
  | 'CONCEDIDA'
  | 'JUSTIFICACION'
  | 'CERRADA'
  | 'DENEGADA'

export const ESTADO_COLORS: Record<EstadoExpediente, string> = {
  DETECCION: '#94A3B8',
  EVALUACION: '#FBBF24',
  PREPARACION: '#60A5FA',
  PRESENTADA: '#A78BFA',
  SUBSANACION: '#FB923C',
  CONCEDIDA: '#34D399',
  JUSTIFICACION: '#22D3EE',
  CERRADA: '#6B7280',
  DENEGADA: '#F87171',
}

export const ESTADO_LABELS: Record<EstadoExpediente, string> = {
  DETECCION: 'Detección',
  EVALUACION: 'Evaluación',
  PREPARACION: 'Preparación',
  PRESENTADA: 'Presentada',
  SUBSANACION: 'Subsanación',
  CONCEDIDA: 'Concedida',
  JUSTIFICACION: 'Justificación',
  CERRADA: 'Cerrada',
  DENEGADA: 'Denegada',
}

export interface Cliente {
  id: string
  nombre: string
  nif: string
  sector: string
  cnae: string
  comunidadAutonoma: string
  tamano: 'micropyme' | 'pyme' | 'gran_empresa' | 'ong' | 'autonomo'
  certificadoDigital: string
  caducidadCertificado: Date
  contacto: string
  email: string
  telefono: string
  fechaAlta: Date
}

export interface Convocatoria {
  idBdns: string
  nombre: string
  organismo: string
  tipo: 'estatal' | 'autonomica' | 'europea' | 'local'
  fechaApertura: Date
  fechaCierre: Date
  fechaJustificacion: Date
  importeMax: number
  porcentajeSubvencionable: number
  urlSede: string
  requisitos: string[]
  descripcion: string
}

export interface Nota {
  id: string
  texto: string
  fecha: Date
  autor: string
}

export interface Documento {
  id: string
  expedienteId: string
  tipo: string
  nombreArchivo: string
  fechaSubida: Date
  fechaCaducidad?: Date
  estado: 'pendiente' | 'subido' | 'validado' | 'rechazado'
  tamanio?: string
}

export interface CambioEstado {
  id: string
  estadoAnterior: EstadoExpediente | null
  estadoNuevo: EstadoExpediente
  fecha: Date
  usuario: string
  comentario?: string
}

export interface Expediente {
  id: string
  clienteId: string
  convocatoriaId: string
  estado: EstadoExpediente
  fechaSolicitud: Date
  numeroOficial: string
  importeSolicitado: number
  importeConcedido: number
  gestorId: string
  notas: Nota[]
  documentos: Documento[]
  historial: CambioEstado[]
  fechaVencimiento?: Date
}

export interface Alerta {
  id: string
  expedienteId: string
  tipo:
    | 'vencimiento_convocatoria'
    | 'vencimiento_justificacion'
    | 'certificado_caducado'
    | 'subsanacion'
  fechaDisparo: Date
  mensaje: string
  estado: 'pendiente' | 'enviada' | 'vista'
  diasRestantes: number
}

export interface Gestor {
  id: string
  nombre: string
  email: string
  avatar?: string
}
