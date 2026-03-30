import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Navbar } from '../../components/layout/Navbar'
import { EstadoBadge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/Input'
import { useAppStore } from '../../store'
import { LayoutGrid, List, Search, User, Calendar } from 'lucide-react'
import { clsx } from 'clsx'
import { ESTADO_COLORS, ESTADO_LABELS, type EstadoExpediente } from '../../types'

const COLUMNAS: EstadoExpediente[] = [
  'DETECCION', 'EVALUACION', 'PREPARACION', 'PRESENTADA',
  'SUBSANACION', 'CONCEDIDA', 'JUSTIFICACION', 'CERRADA',
]

export function Expedientes() {
  const { expedientes, clientes, convocatorias, gestores } = useAppStore()
  const navigate = useNavigate()
  const [vista, setVista] = useState<'kanban' | 'tabla'>('kanban')
  const [search, setSearch] = useState('')
  const [filterCliente, setFilterCliente] = useState('')
  const [filterGestor, setFilterGestor] = useState('')

  const filtered = expedientes.filter((e) => {
    const cli = clientes.find((c) => c.id === e.clienteId)
    const conv = convocatorias.find((c) => c.idBdns === e.convocatoriaId)
    const q = search.toLowerCase()
    const matchSearch = !q || cli?.nombre.toLowerCase().includes(q) || conv?.nombre.toLowerCase().includes(q)
    const matchCliente = !filterCliente || e.clienteId === filterCliente
    const matchGestor = !filterGestor || e.gestorId === filterGestor
    return matchSearch && matchCliente && matchGestor
  })

  const formatEur = (n: number) =>
    n > 0 ? new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n) : '—'

  const diffDays = (date?: Date) => {
    if (!date) return null
    return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  }

  return (
    <>
      <Navbar
        title="Expedientes"
        subtitle={`${expedientes.length} expedientes`}
        actions={
          <div className="flex items-center gap-2">
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
            placeholder="Buscar cliente o convocatoria..."
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
        {(search || filterCliente || filterGestor) && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setFilterCliente(''); setFilterGestor('') }}>
            Limpiar
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-hidden">
        {vista === 'kanban' ? (
          <KanbanView expedientes={filtered} clientes={clientes} convocatorias={convocatorias} gestores={gestores} navigate={navigate} formatEur={formatEur} diffDays={diffDays} />
        ) : (
          <TablaView expedientes={filtered} clientes={clientes} convocatorias={convocatorias} gestores={gestores} navigate={navigate} formatEur={formatEur} diffDays={diffDays} />
        )}
      </div>
    </>
  )
}

function KanbanView({ expedientes, clientes, convocatorias, gestores, navigate, formatEur, diffDays }: any) {
  return (
    <div className="h-full overflow-x-auto">
      <div className="flex gap-3 p-4 h-full" style={{ minWidth: `${COLUMNAS.length * 240}px` }}>
        {COLUMNAS.map((estado) => {
          const items = expedientes.filter((e: any) => e.estado === estado)
          return (
            <div key={estado} className="flex flex-col w-56 flex-shrink-0 h-full">
              <div className="flex items-center gap-2 mb-2.5 px-1">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: ESTADO_COLORS[estado] }} />
                <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">{ESTADO_LABELS[estado]}</span>
                <span className="ml-auto text-xs text-slate-400 font-medium">{items.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 pb-2">
                {items.map((exp: any) => {
                  const cli = clientes.find((c: any) => c.id === exp.clienteId)
                  const conv = convocatorias.find((c: any) => c.idBdns === exp.convocatoriaId)
                  const gestor = gestores.find((g: any) => g.id === exp.gestorId)
                  const dias = diffDays(exp.fechaVencimiento)
                  return (
                    <div
                      key={exp.id}
                      className="bg-white rounded-xl border border-slate-100 shadow-sm p-3 cursor-pointer hover:shadow-md hover:border-slate-200 transition-all"
                      onClick={() => navigate(`/expedientes/${exp.id}`)}
                    >
                      <p className="text-xs font-semibold text-slate-900 leading-snug line-clamp-2 mb-1.5">{conv?.nombre}</p>
                      <div className="flex items-center gap-1.5 mb-2">
                        <div className="w-4 h-4 bg-slate-100 rounded-full flex items-center justify-center text-slate-500">
                          <User size={9} />
                        </div>
                        <p className="text-xs text-slate-500 truncate">{cli?.nombre}</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-800">{formatEur(exp.importeSolicitado)}</span>
                        {dias !== null && (
                          <span className={clsx(
                            'text-xs font-medium flex items-center gap-0.5',
                            dias <= 7 ? 'text-red-600' : dias <= 14 ? 'text-orange-500' : 'text-slate-400'
                          )}>
                            <Calendar size={10} />
                            {dias <= 0 ? `${Math.abs(dias)}d` : `${dias}d`}
                          </span>
                        )}
                      </div>
                      {gestor && (
                        <p className="text-xs text-slate-400 mt-1.5 border-t border-slate-50 pt-1.5 truncate">
                          {gestor.nombre.split(' ')[0]}
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
  return (
    <div className="overflow-y-auto h-full">
      <table className="w-full">
        <thead className="sticky top-0 bg-white z-10">
          <tr className="border-b border-slate-100">
            {['Cliente', 'Convocatoria', 'Estado', 'Gestor', 'Solicitado', 'Concedido', 'Vencimiento'].map((h) => (
              <th key={h} className="text-left text-xs font-medium text-slate-500 px-5 py-3 bg-slate-50/80">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {expedientes.map((exp: any) => {
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
                    <span className={clsx('text-sm font-medium', dias <= 7 ? 'text-red-600' : dias <= 14 ? 'text-orange-500' : 'text-slate-500')}>
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
