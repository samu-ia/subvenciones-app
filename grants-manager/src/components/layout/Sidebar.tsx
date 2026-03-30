import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, FileText, Bell, Building2, ChevronLeft, ChevronRight, Store,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useAppStore } from '../../store'

const navItems = [
  { to: '/dashboard', label: 'Panel', icon: LayoutDashboard },
  { to: '/expedientes', label: 'Expedientes', icon: FileText },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/convocatorias', label: 'Convocatorias', icon: Building2 },
  { to: '/alertas', label: 'Alertas', icon: Bell },
]

export function Sidebar() {
  const { sidebarCollapsed, setSidebarCollapsed, alertas } = useAppStore()
  const pendingAlerts = alertas.filter((a) => a.estado === 'pendiente').length

  return (
    <aside
      className={clsx(
        'flex flex-col bg-slate-900 text-white transition-all duration-300 h-screen sticky top-0 flex-shrink-0',
        sidebarCollapsed ? 'w-16' : 'w-56'
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-slate-800">
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-emerald-400 rounded-lg flex items-center justify-center text-slate-900 font-bold text-xs">
              AP
            </div>
            <span className="font-semibold text-sm tracking-tight">AyudaPyme</span>
          </div>
        )}
        {sidebarCollapsed && (
          <div className="w-7 h-7 bg-emerald-400 rounded-lg flex items-center justify-center text-slate-900 font-bold text-xs mx-auto">
            AP
          </div>
        )}
        {!sidebarCollapsed && (
          <button
            onClick={() => setSidebarCollapsed(true)}
            className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 flex flex-col gap-0.5 px-2">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 rounded-lg transition-all duration-150 relative',
                sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5',
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              )
            }
            title={sidebarCollapsed ? label : undefined}
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-emerald-400 rounded-r-full" />
                )}
                <Icon size={18} className="flex-shrink-0" />
                {!sidebarCollapsed && <span className="text-sm font-medium">{label}</span>}
                {!sidebarCollapsed && to === '/alertas' && pendingAlerts > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-5 text-center">
                    {pendingAlerts}
                  </span>
                )}
                {sidebarCollapsed && to === '/alertas' && pendingAlerts > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Vista Proveedor */}
      <div className="px-2 py-3 border-t border-slate-800">
        {!sidebarCollapsed && (
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-1.5">
            Vista Proveedor
          </p>
        )}
        <NavLink
          to="/proveedor"
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-3 rounded-lg transition-all duration-150 relative',
              sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5',
              isActive
                ? 'bg-indigo-600/30 text-indigo-300'
                : 'text-slate-400 hover:bg-white/5 hover:text-indigo-300'
            )
          }
          title={sidebarCollapsed ? 'Portal Proveedor' : undefined}
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-indigo-400 rounded-r-full" />
              )}
              <Store size={18} className="flex-shrink-0" />
              {!sidebarCollapsed && <span className="text-sm font-medium">Portal Proveedor</span>}
            </>
          )}
        </NavLink>
      </div>

      {/* Collapse button at bottom when collapsed */}
      {sidebarCollapsed && (
        <div className="px-2 pb-4">
          <button
            onClick={() => setSidebarCollapsed(false)}
            className="w-full flex items-center justify-center py-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* User */}
      {!sidebarCollapsed && (
        <div className="px-4 py-4 border-t border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              LM
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">Laura Martínez</p>
              <p className="text-xs text-slate-500 truncate">Gestora</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
