import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Navbar } from '../../components/layout/Navbar'
import { AlertaTipoBadge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Input'
import { useAppStore } from '../../store'
import { Bell, CheckCheck, ExternalLink, Plus, X } from 'lucide-react'
import { clsx } from 'clsx'
import type { Alerta } from '../../types'

export function Alertas() {
  const { alertas, expedientes, clientes, convocatorias, marcarAlertaVista, addAlerta } = useAppStore()
  const navigate = useNavigate()
  const [filterTipo, setFilterTipo] = useState('')
  const [filterEstado, setFilterEstado] = useState('')
  const [filterEstaSemana, setFilterEstaSemana] = useState(false) // L5
  const [showNuevaAlerta, setShowNuevaAlerta] = useState(false) // B22

  // B22 — estado formulario nueva alerta
  const [nuevaTipo, setNuevaTipo] = useState<Alerta['tipo']>('vencimiento_convocatoria')
  const [nuevaMensaje, setNuevaMensaje] = useState('')
  const [nuevaDias, setNuevaDias] = useState('7')
  const [nuevaExpId, setNuevaExpId] = useState('')

  // Compute live diasRestantes from fechaDisparo so urgency is always current
  const getDiasRestantes = (a: Alerta) =>
    Math.ceil((a.fechaDisparo.getTime() - Date.now()) / (1000 * 60 * 60 * 24))

  const filtered = alertas
    .filter((a) => {
      const matchTipo = !filterTipo || a.tipo === filterTipo
      const matchEstado = !filterEstado || a.estado === filterEstado
      const matchEstaSemana = !filterEstaSemana || getDiasRestantes(a) <= 7
      return matchTipo && matchEstado && matchEstaSemana
    })
    .sort((a, b) => getDiasRestantes(a) - getDiasRestantes(b))

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

  const handleCrearAlerta = () => {
    if (!nuevaMensaje.trim() || !nuevaExpId) return
    const nueva: Alerta = {
      id: `a_manual_${Date.now()}`,
      expedienteId: nuevaExpId,
      tipo: nuevaTipo,
      fechaDisparo: new Date(),
      mensaje: nuevaMensaje.trim(),
      estado: 'pendiente',
      diasRestantes: parseInt(nuevaDias, 10) || 7,
    }
    addAlerta(nueva)
    setShowNuevaAlerta(false)
    setNuevaMensaje('')
    setNuevaDias('7')
    setNuevaExpId('')
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
        {/* Filters + nueva alerta */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <Select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)} className="w-52">
            <option value="">Todos los tipos</option>
            {/* A15-A16 — etiquetas sin abreviaturas */}
            <option value="vencimiento_convocatoria">Cierre de Convocatoria</option>
            <option value="vencimiento_justificacion">Plazo de Justificación</option>
            <option value="certificado_caducado">Certificado caducado</option>
            <option value="subsanacion">Subsanación</option>
          </Select>
          <Select value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)} className="w-40">
            <option value="">Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="enviada">Enviada</option>
            <option value="vista">Vista</option>
          </Select>
          {/* L5 — filtro "Esta semana" */}
          <button
            onClick={() => setFilterEstaSemana((v) => !v)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5',
              filterEstaSemana
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            )}
          >
            ⚡ Esta semana
          </button>
          {(filterTipo || filterEstado || filterEstaSemana) && (
            <Button variant="ghost" size="sm" onClick={() => { setFilterTipo(''); setFilterEstado(''); setFilterEstaSemana(false) }}>
              Limpiar
            </Button>
          )}
          <span className="ml-auto text-xs text-slate-400">{filtered.length} alertas</span>
          {/* B22 — botón nueva alerta */}
          <Button
            size="sm"
            icon={<Plus size={13} />}
            onClick={() => setShowNuevaAlerta(true)}
          >
            Nueva alerta
          </Button>
        </div>

        {/* B22 — formulario nueva alerta */}
        {showNuevaAlerta && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 mb-5 max-w-xl shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-900">Nueva alerta manual</h3>
              <button onClick={() => setShowNuevaAlerta(false)} className="text-slate-400 hover:text-slate-700">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Expediente</label>
                <select
                  value={nuevaExpId}
                  onChange={(e) => setNuevaExpId(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                >
                  <option value="">Seleccionar expediente...</option>
                  {expedientes.map((e) => {
                    const cli = clientes.find((c) => c.id === e.clienteId)
                    return <option key={e.id} value={e.id}>{cli?.nombre} — {e.numeroOficial || e.id}</option>
                  })}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Tipo</label>
                <select
                  value={nuevaTipo}
                  onChange={(e) => setNuevaTipo(e.target.value as Alerta['tipo'])}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                >
                  <option value="vencimiento_convocatoria">Cierre de Convocatoria</option>
                  <option value="vencimiento_justificacion">Plazo de Justificación</option>
                  <option value="certificado_caducado">Certificado caducado</option>
                  <option value="subsanacion">Subsanación</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Mensaje</label>
                <input
                  type="text"
                  value={nuevaMensaje}
                  onChange={(e) => setNuevaMensaje(e.target.value)}
                  placeholder="Describe la alerta..."
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Días restantes</label>
                <input
                  type="number"
                  value={nuevaDias}
                  onChange={(e) => setNuevaDias(e.target.value)}
                  min="0"
                  className="w-32 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="ghost" size="sm" onClick={() => setShowNuevaAlerta(false)}>Cancelar</Button>
                <Button size="sm" disabled={!nuevaMensaje.trim() || !nuevaExpId} onClick={handleCrearAlerta}>
                  Crear alerta
                </Button>
              </div>
            </div>
          </div>
        )}

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
              const dias = getDiasRestantes(alerta)

              return (
                <div
                  key={alerta.id}
                  className={clsx(
                    'rounded-xl border p-4 flex items-start gap-4 transition-all',
                    getUrgencyColor(dias),
                    isVista && 'opacity-60'
                  )}
                >
                  {/* Urgency dot */}
                  <div className={clsx(
                    'w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1',
                    dias < 0 ? 'bg-slate-400' :
                    dias <= 5 ? 'bg-red-500' :
                    dias <= 14 ? 'bg-orange-400' : 'bg-slate-300'
                  )} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <AlertaTipoBadge tipo={alerta.tipo} />
                        <span className={clsx('text-xs', getDiaColor(dias))}>
                          {getDiaLabel(dias)}
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
                    {/* A15-A16 — botón "Entendido ✓" en lugar de "Marcar vista" */}
                    {!isVista && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => marcarAlertaVista(alerta.id)}
                      >
                        Entendido ✓
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
