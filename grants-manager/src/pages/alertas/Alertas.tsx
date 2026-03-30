import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Navbar } from '../../components/layout/Navbar'
import { AlertaTipoBadge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Input'
import { useAppStore } from '../../store'
import { Bell, CheckCheck, ExternalLink } from 'lucide-react'
import { clsx } from 'clsx'

export function Alertas() {
  const { alertas, expedientes, clientes, convocatorias, marcarAlertaVista } = useAppStore()
  const navigate = useNavigate()
  const [filterTipo, setFilterTipo] = useState('')
  const [filterEstado, setFilterEstado] = useState('')

  const filtered = alertas
    .filter((a) => {
      const matchTipo = !filterTipo || a.tipo === filterTipo
      const matchEstado = !filterEstado || a.estado === filterEstado
      return matchTipo && matchEstado
    })
    .sort((a, b) => a.diasRestantes - b.diasRestantes)

  const pending = alertas.filter((a) => a.estado === 'pendiente').length

  const getUrgencyColor = (dias: number) => {
    if (dias < 0) return 'bg-slate-100 border-slate-200'
    if (dias <= 5) return 'bg-red-50 border-red-200'
    if (dias <= 14) return 'bg-orange-50 border-orange-200'
    return 'bg-white border-slate-200'
  }

  const getDiaLabel = (dias: number) => {
    if (dias < 0) return `Vencido hace ${Math.abs(dias)} días`
    if (dias === 0) return 'Vence hoy'
    if (dias === 1) return 'Vence mañana'
    return `Vence en ${dias} días`
  }

  const getDiaColor = (dias: number) => {
    if (dias < 0) return 'text-slate-400'
    if (dias <= 5) return 'text-red-600 font-bold'
    if (dias <= 14) return 'text-orange-600 font-semibold'
    return 'text-slate-600'
  }

  return (
    <>
      <Navbar
        title="Alertas"
        subtitle={pending > 0 ? `${pending} alertas pendientes` : 'Sin alertas pendientes'}
        actions={
          pending > 0 ? (
            <Button
              variant="secondary"
              size="sm"
              icon={<CheckCheck size={14} />}
              onClick={() => alertas.filter((a) => a.estado === 'pendiente').forEach((a) => marcarAlertaVista(a.id))}
            >
              Marcar todas vistas
            </Button>
          ) : undefined
        }
      />
      <div className="flex-1 overflow-y-auto p-6">
        {/* Filters */}
        <div className="flex items-center gap-3 mb-5">
          <Select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)} className="w-52">
            <option value="">Todos los tipos</option>
            <option value="vencimiento_convocatoria">Venc. Convocatoria</option>
            <option value="vencimiento_justificacion">Venc. Justificación</option>
            <option value="certificado_caducado">Certificado caducado</option>
            <option value="subsanacion">Subsanación</option>
          </Select>
          <Select value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)} className="w-40">
            <option value="">Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="enviada">Enviada</option>
            <option value="vista">Vista</option>
          </Select>
          {(filterTipo || filterEstado) && (
            <Button variant="ghost" size="sm" onClick={() => { setFilterTipo(''); setFilterEstado('') }}>
              Limpiar
            </Button>
          )}
          <span className="ml-auto text-xs text-slate-400">{filtered.length} alertas</span>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Bell size={40} className="mb-3 opacity-30" />
            <p className="text-sm font-medium">No hay alertas</p>
            <p className="text-xs mt-1">Ajusta los filtros o espera a nuevas alertas</p>
          </div>
        ) : (
          <div className="space-y-2.5 max-w-3xl">
            {filtered.map((alerta) => {
              const exp = expedientes.find((e) => e.id === alerta.expedienteId)
              const cli = clientes.find((c) => c.id === exp?.clienteId)
              const conv = convocatorias.find((c) => c.idBdns === exp?.convocatoriaId)
              const isVista = alerta.estado === 'vista'

              return (
                <div
                  key={alerta.id}
                  className={clsx(
                    'rounded-xl border p-4 flex items-start gap-4 transition-all',
                    getUrgencyColor(alerta.diasRestantes),
                    isVista && 'opacity-60'
                  )}
                >
                  {/* Urgency dot */}
                  <div className={clsx(
                    'w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1',
                    alerta.diasRestantes < 0 ? 'bg-slate-400' :
                    alerta.diasRestantes <= 5 ? 'bg-red-500' :
                    alerta.diasRestantes <= 14 ? 'bg-orange-400' : 'bg-slate-300'
                  )} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <AlertaTipoBadge tipo={alerta.tipo} />
                        <span className={clsx('text-xs', getDiaColor(alerta.diasRestantes))}>
                          {getDiaLabel(alerta.diasRestantes)}
                        </span>
                      </div>
                      <span className={clsx(
                        'text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium',
                        alerta.estado === 'pendiente' ? 'bg-red-100 text-red-700' :
                        alerta.estado === 'enviada' ? 'bg-blue-100 text-blue-700' :
                        'bg-slate-100 text-slate-500'
                      )}>
                        {alerta.estado.charAt(0).toUpperCase() + alerta.estado.slice(1)}
                      </span>
                    </div>

                    <p className="text-sm text-slate-800 leading-snug">{alerta.mensaje}</p>

                    <div className="flex items-center gap-3 mt-2">
                      {cli && <span className="text-xs text-slate-500">{cli.nombre}</span>}
                      {conv && (
                        <span className="text-xs text-slate-400 truncate max-w-xs">{conv.nombre}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {exp && (
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<ExternalLink size={12} />}
                        onClick={() => navigate(`/expedientes/${exp.id}`)}
                      >
                        Ver
                      </Button>
                    )}
                    {!isVista && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => marcarAlertaVista(alerta.id)}
                      >
                        Marcar vista
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
