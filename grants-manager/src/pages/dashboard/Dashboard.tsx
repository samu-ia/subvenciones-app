import { Navbar } from '../../components/layout/Navbar'
import { Card, StatCard } from '../../components/ui/Card'
import { EstadoBadge } from '../../components/ui/Badge'
import { useAppStore } from '../../store'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import { FileText, AlertTriangle, TrendingUp } from 'lucide-react'
import { ESTADO_COLORS, ESTADO_LABELS, type EstadoExpediente } from '../../types'
import { clsx } from 'clsx'

const ESTADO_ORDER: EstadoExpediente[] = [
  'DETECCION', 'EVALUACION', 'PREPARACION', 'PRESENTADA',
  'SUBSANACION', 'CONCEDIDA', 'JUSTIFICACION', 'CERRADA', 'DENEGADA',
]

export function Dashboard() {
  const { expedientes, alertas, clientes, convocatorias } = useAppStore()
  const navigate = useNavigate()

  const activos = expedientes.filter((e) =>
    !['CERRADA', 'DENEGADA'].includes(e.estado)
  )
  const porJustificar = expedientes.filter((e) => e.estado === 'JUSTIFICACION')
  const alertasPendientes = alertas.filter((a) => a.estado === 'pendiente')
  const importeTotal = expedientes
    .filter((e) => e.importeConcedido > 0)
    .reduce((sum, e) => sum + e.importeConcedido, 0)

  const porEstado = ESTADO_ORDER.map((estado) => ({
    name: ESTADO_LABELS[estado].substring(0, 6),
    fullName: ESTADO_LABELS[estado],
    count: expedientes.filter((e) => e.estado === estado).length,
    color: ESTADO_COLORS[estado],
  })).filter((d) => d.count > 0)

  const proximosVencimientos = expedientes
    .filter((e) => e.fechaVencimiento && !['CERRADA', 'DENEGADA'].includes(e.estado))
    .sort((a, b) => (a.fechaVencimiento!.getTime() - b.fechaVencimiento!.getTime()))
    .slice(0, 5)

  const formatEur = (n: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

  const diffDays = (date: Date) => {
    const diff = date.getTime() - Date.now()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  return (
    <>
      <Navbar title="Panel de control" subtitle={`${new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`} />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Expedientes activos"
              value={activos.length}
              subtitle={`de ${expedientes.length} total`}
              icon={<FileText size={18} />}
              color="#60A5FA"
              trend={{ value: 12, label: 'este mes' }}
            />
            <StatCard
              title="Por justificar"
              value={porJustificar.length}
              subtitle="requieren atención"
              icon={<AlertTriangle size={18} />}
              color="#FB923C"
            />
            <StatCard
              title="Alertas hoy"
              value={alertasPendientes.length}
              subtitle="pendientes de resolver"
              icon={<AlertTriangle size={18} />}
              color="#F87171"
            />
            <StatCard
              title="Importe concedido"
              value={formatEur(importeTotal)}
              subtitle="total acumulado"
              icon={<TrendingUp size={18} />}
              color="#34D399"
              trend={{ value: 8, label: 'vs mes anterior' }}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart */}
            <Card className="lg:col-span-2" padding="md">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Expedientes por estado</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={porEstado} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    formatter={(value, _name, props) => [value, props.payload.fullName]}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: 12 }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {porEstado.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Recent alerts */}
            <Card padding="md">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Alertas recientes</h3>
              <div className="space-y-3">
                {alertas.slice(0, 5).map((alerta) => {
                  const exp = expedientes.find((e) => e.id === alerta.expedienteId)
                  const cli = clientes.find((c) => c.id === exp?.clienteId)
                  const urgency = alerta.diasRestantes <= 5 ? 'red' : alerta.diasRestantes <= 14 ? 'orange' : 'slate'
                  return (
                    <div
                      key={alerta.id}
                      className="flex items-start gap-2.5 cursor-pointer hover:bg-slate-50 rounded-lg p-1.5 -mx-1.5 transition-colors"
                      onClick={() => navigate('/alertas')}
                    >
                      <div className={clsx(
                        'w-2 h-2 rounded-full mt-1.5 flex-shrink-0',
                        urgency === 'red' ? 'bg-red-500' : urgency === 'orange' ? 'bg-orange-400' : 'bg-slate-300'
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-700 leading-snug line-clamp-2">{alerta.mensaje}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{cli?.nombre ?? '—'}</p>
                      </div>
                      {alerta.diasRestantes > 0 && (
                        <span className={clsx(
                          'text-xs font-medium flex-shrink-0',
                          urgency === 'red' ? 'text-red-500' : urgency === 'orange' ? 'text-orange-500' : 'text-slate-500'
                        )}>
                          {alerta.diasRestantes}d
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </Card>
          </div>

          {/* Próximos vencimientos */}
          <Card padding="none">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Próximos vencimientos</h3>
              <button
                className="text-xs text-slate-500 hover:text-slate-900 font-medium"
                onClick={() => navigate('/expedientes')}
              >
                Ver todos →
              </button>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Cliente', 'Convocatoria', 'Estado', 'Importe', 'Vencimiento'].map((h) => (
                    <th key={h} className="text-left text-xs font-medium text-slate-500 px-5 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {proximosVencimientos.map((exp) => {
                  const cli = clientes.find((c) => c.id === exp.clienteId)
                  const conv = convocatorias.find((c) => c.idBdns === exp.convocatoriaId)
                  const dias = diffDays(exp.fechaVencimiento!)
                  return (
                    <tr
                      key={exp.id}
                      className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/expedientes/${exp.id}`)}
                    >
                      <td className="px-5 py-3 text-sm font-medium text-slate-900">{cli?.nombre}</td>
                      <td className="px-5 py-3 text-sm text-slate-600 max-w-xs truncate">{conv?.nombre}</td>
                      <td className="px-5 py-3"><EstadoBadge estado={exp.estado} size="sm" /></td>
                      <td className="px-5 py-3 text-sm text-slate-700 tabular-nums">
                        {formatEur(exp.importeSolicitado)}
                      </td>
                      <td className="px-5 py-3">
                        <span className={clsx(
                          'text-sm font-medium',
                          dias <= 7 ? 'text-red-600' : dias <= 14 ? 'text-orange-500' : 'text-slate-600'
                        )}>
                          {dias <= 0 ? `Hace ${Math.abs(dias)}d` : `${dias} días`}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>

        </div>
      </div>
    </>
  )
}
