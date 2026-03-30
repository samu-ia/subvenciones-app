import { Bell } from 'lucide-react'
import { useAppStore } from '../../store'
import { useNavigate } from 'react-router-dom'

interface NavbarProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

export function Navbar({ title, subtitle, actions }: NavbarProps) {
  const { alertas } = useAppStore()
  const pending = alertas.filter((a) => a.estado === 'pendiente').length
  const navigate = useNavigate()

  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-slate-100 bg-white flex-shrink-0">
      <div>
        <h1 className="text-base font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        <button
          onClick={() => navigate('/alertas')}
          className="relative w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors"
        >
          <Bell size={16} />
          {pending > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
          )}
        </button>
        <div className="w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
          LM
        </div>
      </div>
    </header>
  )
}
