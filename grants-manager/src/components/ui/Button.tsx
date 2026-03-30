import { clsx } from 'clsx'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  icon?: ReactNode
  children?: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  children,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={clsx(
        'inline-flex items-center gap-2 font-medium rounded-lg transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
        {
          'bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-950': variant === 'primary',
          'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 active:bg-slate-100': variant === 'secondary',
          'text-slate-600 hover:bg-slate-100 active:bg-slate-200': variant === 'ghost',
          'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100': variant === 'danger',
          'px-2.5 py-1.5 text-xs': size === 'sm',
          'px-3.5 py-2 text-sm': size === 'md',
          'px-5 py-2.5 text-base': size === 'lg',
        },
        className
      )}
    >
      {icon}
      {children}
    </button>
  )
}
