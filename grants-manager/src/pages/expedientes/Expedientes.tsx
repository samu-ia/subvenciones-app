import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Navbar } from '../../components/layout/Navbar'
import { EstadoBadge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/Input'
import { useAppStore } from '../../store'
import { LayoutGrid, List, Search, User, Calendar, Star, Sparkles } from 'lucide-react'
import { clsx } from 'clsx'
import { ESTADO_COLORS, ESTADO_LABELS, type EstadoExpediente } from '../../types'

const COLUMNAS: EstadoExpediente[] = [
  'DETECCION', 'EVALUACION', 'PREPARACION', 'PRESENTADA',
  'SUBSANACION', 'CONCEDIDA', 'JUSTIFICACION', 'CERRADA',
]

// A02-A05 — descripciones llanas de cada columna
const COLUMNA_DESC: Record<EstadoExpediente, string> = {
  DETECCION: 'Lo hemos identificado',
  EVALUACION: 'Comprobando si encaja',
  PREPARACION: 'Reuniendo documentos',
  PRESENTADA: 'Solicitud enviada',
  SUBSANACION: 'Piden más docs',
  CONCEDIDA: '¡Aprobada!',
  JUSTIFICACION: 'Justificando el gasto',
  CERRADA: 'Finalizada',
  DENEGADA: 'No aprobada',
}

export function Expedientes() {
  const { expedientes, clientes, convocatorias, gestores, urgentPinnedIds } = useAppStore()
  const navigate = useNavigate()
  const [vista, setVista] = useState<'kanban' | 'tabla'>('kanban')
  const [search, setSearch] = useState('')
  const [filterCliente, setFilterCliente] = useState('')
  const [filterGestor, setFilterGestor] = useState('')
  const [soloMios, setSoloMios] = useState(false) // B05

  const filtered = expedientes.filter((e) => {
    const cli = clientes.find((c) => c.id === e.clienteId)
    const conv = convocatorias.find((c) => c.idBdns === e.convocatoriaId)
    const q = search.toLowerCase()
    // B09 — buscar también en numeroOficial
    const matchSearch = !q ||
      cli?.nombre.toLowerCase().includes(q) ||
      conv?.nombre.toLowerCase().includes(q) ||
      e.numeroOficial?.toLowerCase().includes(q)
    const matchCliente = !filterCliente || e.clienteId === filterCliente
    const matchGestor = !filterGestor || e.gestorId === filterGestor
    const matchMios = !soloMios || e.gestorId === 'g1'
    return matchSearch && matchCliente && matchGestor && matchMios
  })

  const formatEur = (n: number) =>
    n > 0 ? new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n) : '—'

  const diffDays = (date?: Date) => {
    if (!date) return null
    return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  }

  // B06 — exportar CSV
  const exportCSV = () => {
    const headers = ['Nº Oficial', 'Cliente', 'Convocatoria', 'Estado', 'Gestor', 'Importe Solicitado', 'Importe Concedido', 'Vencimiento']
    const rows = filtered.map((e) => {
      const cli = clientes.find((c) => c.id === e.clienteId)
      const conv = convocatorias.find((c) => c.idBdns === e.convocatoriaId)
      const gestor = gestores.find((g) => g.id === e.gestorId)
      return [
        e.numeroOficial || '',
        cli?.nombre || '',
        conv?.nombre || '',
        ESTADO_LABELS[e.estado],
        gestor?.nombre || '',
        e.importeSolicitado.toString(),
        e.importeConcedido.toString(),
        e.fechaVencimiento ? e.fechaVencimiento.toLocaleDateString('es-ES') : '',
      ]
    })
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `expedientes_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <Navbar
        title="Expedientes"
        subtitle={`${expedientes.length} expedientes`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/nueva-subvencion')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 transition-colors"
            >
              <Sparkles size={13} />
              Nueva subvención
            </button>
            <button
              onClick={() => setVista('kanban')}
              className={clsx('w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
                vista === 'kanban' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-slate-100')}
            >
              <LayoutGrid size={15} />
            </button>
            <button
              onClick={() => setVista('tabla')}
              className={clsx('w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
                vista === 'tabla' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-slate-100')}
            >
              <List size={15} />
            </button>
          </div>
        }
      />

      <div className="flex items-center gap-3 px-6 py-3 border-b border-slate-100 bg-white flex-wrap">
        <div className="w-64">
          <Input
            placeholder="Buscar cliente, convocatoria o nº expediente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search size={14} />}
          />
        </div>
        <Select value={filterCliente} onChange={(e) => setFilterCliente(e.target.value)} className="w-44">
          <option value="">Todos los clientes</option>
          {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </Select>
        <Select value={filterGestor} onChange={(e) => setFilterGestor(e.target.value)} className="w-40">
          <option value="">Todos los gestores</option>
          {gestores.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
        </Select>
        {/* B05 — toggle "solo los míos" */}
        <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={soloMios}
            onChange={(e) => setSoloMios(e.target.checked)}
            className="w-3.5 h-3.5 rounded"
          />
          Solo los míos
        </label>
        {/* B06 — exportar CSV (solo en tabla) */}
        {vista === 'tabla' && (
          <button
            onClick={exportCSV}
            className="ml-auto text-xs text-slate-500 hover:text-slate-900 font-medium border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors"
          >
            Exportar CSV
          </button>
        )}
        {(search || filterCliente || filterGestor || soloMios) && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setFilterCliente(''); setFilterGestor(''); setSoloMios(false) }}>
            Limpiar
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-hidden">
        {vista === 'kanban' ? (
          <KanbanView
            expedientes={filtered}
            clientes={clientes}
            convocatorias={convocatorias}
            gestores={gestores}
            navigate={navigate}
            formatEur={formatEur}
            diffDays={diffDays}
            urgentPinnedIds={urgentPinnedIds}
          />
        ) : (
          <TablaView
            expedientes={filtered}
            clientes={clientes}
            convocatorias={convocatorias}
            gestores={gestores}
            navigate={navigate}
            formatEur={formatEur}
            diffDays={diffDays}
          />
        )}
      </div>
    </>
  )
}

function KanbanView({ expedientes, clientes, convocatorias, gestores, navigate, formatEur, diffDays, urgentPinnedIds }: any) {
  const { toggleUrgentPin } = useAppStore()

  return (
    <div className="h-full overflow-x-auto">
      <div className="flex gap-3 p-4 h-full" style={{ minWidth: `${COLUMNAS.length * 250}px` }}>
        {COLUMNAS.map((estado) => {
          const allItems = expedientes.filter((e: any) => e.estado === estado)
          // B18 — pinned al top
          const pinned = allItems.filter((e: any) => urgentPinnedIds.includes(e.id))
          const unpinned = allItems.filter((e: any) => !urgentPinnedIds.includes(e.id))
          const items = [...pinned, ...unpinned]

          return (
            <div key={estado} className="flex flex-col w-58 flex-shrink-0 h-full" style={{ width: '232px' }}>
              <div className="flex items-start gap-2 mb-2.5 px-1">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: ESTADO_COLORS[estado] }} />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide truncate block" title={ESTADO_LABELS[estado]}>{ESTADO_LABELS[estado]}</span>
                  {/* A02-A05 — descripción llana */}
                  <p className="text-xs text-slate-400 mt-0.5 font-normal normal-case tracking-normal">{COLUMNA_DESC[estado]}</p>
                </div>
                <span className="text-xs text-slate-400 font-medium flex-shrink-0">{items.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 pb-2">
                {items.map((exp: any) => {
                  const cli = clientes.find((c: any) => c.id === exp.clienteId)
                  const conv = convocatorias.find((c: any) => c.idBdns === exp.convocatoriaId)
                  const gestor = gestores.find((g: any) => g.id === exp.gestorId)
                  const dias = diffDays(exp.fechaVencimiento)
                  const isPinned = urgentPinnedIds.includes(exp.id)

                  // B10 — días en fase actual
                  const diasEnFase = exp.historial && exp.historial.length > 0
                    ? Math.ceil((Date.now() - [...exp.historial].sort((a: any, b: any) => b.fecha - a.fecha)[0].fecha.getTime()) / (1000 * 60 * 60 * 24))
                    : null

                  // B17 — edad del expediente
                  const primerEvento = exp.historial && exp.historial.length > 0
                    ? [...exp.historial].sort((a: any, b: any) => a.fecha.getTime() - b.fecha.getTime())[0]
                    : null
                  const edadDias = primerEvento
                    ? Math.ceil((Date.now() - primerEvento.fecha.getTime()) / (1000 * 60 * 60 * 24))
                    : null

                  // B13 — progreso documentos
                  const totalDocs = exp.documentos?.length || 0
                  const validadosDocs = exp.documentos?.filter((d: any) => d.estado === 'validado').length || 0
                  const progresoDocs = totalDocs > 0 ? Math.round((validadosDocs / totalDocs) * 100) : null

                  // Tooltip fecha exacta para "Xd"
                  const fechaExacta = exp.fechaVencimiento
                    ? exp.fechaVencimiento.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                    : null

                  return (
                    <div
                      key={exp.id}
                      className={clsx(
                        'bg-white rounded-xl border shadow-sm p-3 cursor-pointer hover:shadow-md transition-all',
                        isPinned ? 'border-yellow-300 bg-yellow-50' : 'border-slate-100 hover:border-slate-200'
                      )}
                      onClick={() => navigate(`/expedientes/${exp.id}`)}
                    >
                      {/* B18 — pin de urgente */}
                      <div className="flex items-start justify-between mb-1.5">
                        <p className="text-xs font-semibold text-slate-900 leading-snug line-clamp-2 flex-1 mr-1">{conv?.nombre}</p>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleUrgentPin(exp.id) }}
                          className={clsx('flex-shrink-0 transition-colors', isPinned ? 'text-yellow-500' : 'text-slate-200 hover:text-yellow-400')}
                          title={isPinned ? 'Quitar urgente' : 'Marcar urgente'}
                        >
                          <Star size={12} fill={isPinned ? 'currentColor' : 'none'} />
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5 mb-1">
                        <div className="w-4 h-4 bg-slate-100 rounded-full flex items-center justify-center text-slate-500">
                          <User size={9} />
                        </div>
                        <p className="text-xs text-slate-500 truncate">{cli?.nombre}</p>
                      </div>
                      {/* D — Compliance indicator */}
                      {cli && (
                        <div className="flex items-center gap-1 mb-1.5">
                          {cli.cumplimientoHacienda === 'ok' && cli.cumplimientoSS === 'ok' ? (
                            <span className="flex items-center gap-0.5 text-emerald-600 text-xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                              Cumplimiento OK
                            </span>
                          ) : (
                            <>
                              {cli.cumplimientoHacienda !== 'ok' && (
                                <span className="flex items-center gap-0.5 text-red-600 text-xs">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                                  Revisar Hacienda
                                </span>
                              )}
                              {cli.cumplimientoSS !== 'ok' && (
                                <span className="flex items-center gap-0.5 text-yellow-600 text-xs ml-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 inline-block" />
                                  Verificar SS
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-800">{formatEur(exp.importeSolicitado)}</span>
                        {dias !== null && (
                          <span
                            className={clsx(
                              'text-xs font-medium flex items-center gap-0.5',
                              dias <= 7 ? 'text-red-600' : dias <= 14 ? 'text-orange-500' : 'text-slate-400'
                            )}
                            title={fechaExacta ? `Fecha exacta: ${fechaExacta}` : undefined}
                          >
                            <Calendar size={10} />
                            {dias <= 0 ? `${Math.abs(dias)}d` : `${dias}d`}
                            {/* A06-A07 — urgente si ≤ 7 días */}
                            {dias <= 7 && dias >= 0 && (
                              <span className="ml-1 text-red-600 font-bold">⚠️ Urgente</span>
                            )}
                          </span>
                        )}
                      </div>

                      {/* B13 — barra de progreso de docs */}
                      {progresoDocs !== null && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs text-slate-400">Docs: {validadosDocs}/{totalDocs}</span>
                            <span className="text-xs text-slate-400">{progresoDocs}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={clsx('h-full rounded-full transition-all', progresoDocs === 100 ? 'bg-emerald-500' : 'bg-blue-400')}
                              style={{ width: `${progresoDocs}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {gestor && (
                        <p className="text-xs text-slate-400 mt-1.5 border-t border-slate-50 pt-1.5 truncate">
                          {gestor.nombre.split(' ')[0]}
                        </p>
                      )}

                      {/* B17 — edad del expediente */}
                      {edadDias !== null && (
                        <p className="text-xs text-slate-300 mt-0.5">Abierto hace {edadDias}d</p>
                      )}

                      {/* B10 — días en fase actual */}
                      {diasEnFase !== null && (
                        <p className={clsx('text-xs mt-0.5', diasEnFase > 30 ? 'text-orange-500 font-medium' : 'text-slate-300')}>
                          En esta fase: {diasEnFase}d
                        </p>
                      )}
                    </div>
                  )
                })}
                {items.length === 0 && (
                  <div className="flex items-center justify-center h-16 rounded-xl border-2 border-dashed border-slate-200 text-xs text-slate-400">
                    Sin expedientes
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TablaView({ expedientes, clientes, convocatorias, gestores, navigate, formatEur, diffDays }: any) {
  // B12 — columnas ordenables
  const [sortCol, setSortCol] = useState<'solicitado' | 'vencimiento' | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const toggleSort = (col: 'solicitado' | 'vencimiento') => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  const sorted = [...expedientes].sort((a: any, b: any) => {
    if (!sortCol) return 0
    let av: number, bv: number
    if (sortCol === 'solicitado') {
      av = a.importeSolicitado; bv = b.importeSolicitado
    } else {
      av = a.fechaVencimiento?.getTime() ?? 0
      bv = b.fechaVencimiento?.getTime() ?? 0
    }
    return sortDir === 'asc' ? av - bv : bv - av
  })

  const SortIcon = ({ col }: { col: 'solicitado' | 'vencimiento' }) => (
    <span className="ml-1 text-slate-400 text-xs">
      {sortCol === col ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
    </span>
  )

  return (
    <div className="overflow-y-auto h-full">
      <table className="w-full">
        <thead className="sticky top-0 bg-white z-10">
          <tr className="border-b border-slate-100">
            {[
              { label: 'Cliente', sortKey: null },
              { label: 'Convocatoria', sortKey: null },
              { label: 'Estado', sortKey: null },
              { label: 'Gestor', sortKey: null },
              { label: 'Solicitado', sortKey: 'solicitado' as const },
              { label: 'Concedido', sortKey: null },
              { label: 'Vencimiento', sortKey: 'vencimiento' as const },
            ].map(({ label, sortKey }) => (
              <th
                key={label}
                className={clsx(
                  'text-left text-xs font-medium text-slate-500 px-5 py-3 bg-slate-50/80',
                  sortKey && 'cursor-pointer hover:text-slate-900 select-none'
                )}
                onClick={sortKey ? () => toggleSort(sortKey) : undefined}
              >
                {label}
                {sortKey && <SortIcon col={sortKey} />}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((exp: any) => {
            const cli = clientes.find((c: any) => c.id === exp.clienteId)
            const conv = convocatorias.find((c: any) => c.idBdns === exp.convocatoriaId)
            const gestor = gestores.find((g: any) => g.id === exp.gestorId)
            const dias = diffDays(exp.fechaVencimiento)
            return (
              <tr
                key={exp.id}
                className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors"
                onClick={() => navigate(`/expedientes/${exp.id}`)}
              >
                <td className="px-5 py-3 text-sm font-medium text-slate-900 whitespace-nowrap">{cli?.nombre}</td>
                <td className="px-5 py-3 text-sm text-slate-600 max-w-xs truncate">{conv?.nombre}</td>
                <td className="px-5 py-3"><EstadoBadge estado={exp.estado} size="sm" /></td>
                <td className="px-5 py-3 text-sm text-slate-600">{gestor?.nombre.split(' ')[0]}</td>
                <td className="px-5 py-3 text-sm text-slate-700 tabular-nums">{formatEur(exp.importeSolicitado)}</td>
                <td className="px-5 py-3 text-sm font-medium tabular-nums">
                  {exp.importeConcedido > 0 ? <span className="text-emerald-600">{formatEur(exp.importeConcedido)}</span> : '—'}
                </td>
                <td className="px-5 py-3">
                  {dias !== null ? (
                    <span
                      className={clsx('text-sm font-medium', dias <= 7 ? 'text-red-600' : dias <= 14 ? 'text-orange-500' : 'text-slate-500')}
                      title={exp.fechaVencimiento ? exp.fechaVencimiento.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : undefined}
                    >
                      {dias <= 0 ? `Vencido` : `${dias}d`}
                    </span>
                  ) : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
