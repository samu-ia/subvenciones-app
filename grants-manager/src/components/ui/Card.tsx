import { clsx } from 'clsx'
import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
  hoverable?: boolean
}

export function Card({ children, className, padding = 'md', hoverable = false }: CardProps) {
  return (
    <div
      className={clsx(
        'bg-white rounded-xl border border-slate-100 shadow-sm',
        hoverable && 'hover:shadow-md hover:border-slate-200 transition-all duration-200 cursor-pointer',
        {
          '': padding === 'none',
          'p-4': padding === 'sm',
          'p-5': padding === 'md',
          'p-6': padding === 'lg',
        },
        className
      )}
    >
      {children}
    </div>
  )
}

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: ReactNode
  color?: string
  trend?: { value: number; label: string }
}

export function StatCard({ title, value, subtitle, icon, color = '#60A5FA', trend }: StatCardProps) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
          {trend && (
            <p className={clsx('text-xs font-medium mt-2', trend.value >= 0 ? 'text-emerald-600' : 'text-red-500')}>
              {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
            </p>
          )}
        </div>
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: color + '15', color }}
        >
          {icon}
        </div>
      </div>
    </Card>
  )
}
