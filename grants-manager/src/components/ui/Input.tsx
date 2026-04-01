import { clsx } from 'clsx'
import type { InputHTMLAttributes, ReactNode } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: ReactNode
}

export function Input({ label, error, icon, className, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-slate-700">{label}</label>}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4">
            {icon}
          </div>
        )}
        <input
          {...props}
          className={clsx(
            'w-full text-sm bg-white border rounded-lg text-slate-900 placeholder:text-slate-400',
            'focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400',
            'transition-colors duration-150',
            icon ? 'pl-9 pr-3 py-2' : 'px-3 py-2',
            error ? 'border-red-300' : 'border-slate-200',
            className
          )}
        />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

interface SelectProps extends InputHTMLAttributes<HTMLSelectElement> {
  label?: string
  children: ReactNode
}

export function Select({ label, children, className, ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-slate-700">{label}</label>}
      <select
        {...props}
        className={clsx(
          'w-full text-sm bg-white border border-slate-200 rounded-lg text-slate-900',
          'focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400',
          'px-3 py-2 transition-colors duration-150 cursor-pointer',
          className
        )}
      >
        {children}
      </select>
    </div>
  )
}
