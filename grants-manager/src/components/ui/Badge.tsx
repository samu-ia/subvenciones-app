import { clsx } from 'clsx'
import type { EstadoExpediente } from '../../types'
import { ESTADO_COLORS, ESTADO_LABELS } from '../../types'

interface BadgeProps {
  label: string
  color?: string
  size?: 'sm' | 'md'
  className?: string
}

export function Badge({ label, color = '#94A3B8', size = 'md', className }: BadgeProps) {
  return (
    <span
      className={clsx('inline-flex items-center font-medium rounded-full', className,
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
      )}
      style={{
        backgroundColor: color + '20',
        color: color,
        border: `1px solid ${color}40`,
      }}
    >
      {label}
    </span>
  )
}

interface EstadoBadgeProps {
  estado: EstadoExpediente
  size?: 'sm' | 'md'
}

export function EstadoBadge({ estado, size = 'md' }: EstadoBadgeProps) {
  return <Badge label={ESTADO_LABELS[estado]} color={ESTADO_COLORS[estado]} size={size} />
}

interface TipoBadgeProps {
  tipo: 'estatal' | 'autonomica' | 'europea' | 'local'
}

const TIPO_COLORS = {
  estatal: '#60A5FA',
  autonomica: '#34D399',
  europea: '#A78BFA',
  local: '#FBBF24',
}

const TIPO_LABELS = {
  estatal: 'Estatal',
  autonomica: 'Autonómica',
  europea: 'Europea',
  local: 'Local',
}

export function TipoBadge({ tipo }: TipoBadgeProps) {
  return <Badge label={TIPO_LABELS[tipo]} color={TIPO_COLORS[tipo]} />
}

interface AlertaTipoBadgeProps {
  tipo: 'vencimiento_convocatoria' | 'vencimiento_justificacion' | 'certificado_caducado' | 'subsanacion'
}

const ALERTA_COLORS = {
  vencimiento_convocatoria: '#FBBF24',
  vencimiento_justificacion: '#FB923C',
  certificado_caducado: '#F87171',
  subsanacion: '#A78BFA',
}

const ALERTA_LABELS = {
  vencimiento_convocatoria: 'Venc. Convocatoria',
  vencimiento_justificacion: 'Venc. Justificación',
  certificado_caducado: 'Certificado',
  subsanacion: 'Subsanación',
}

export function AlertaTipoBadge({ tipo }: AlertaTipoBadgeProps) {
  return <Badge label={ALERTA_LABELS[tipo]} color={ALERTA_COLORS[tipo]} />
}
