import { useState } from 'react'
import { Navbar } from '../../components/layout/Navbar'
import { Card, StatCard } from '../../components/ui/Card'
import { EstadoBadge } from '../../components/ui/Badge'
import { useAppStore } from '../../store'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import { FileText, AlertTriangle, TrendingUp, CheckCircle, User, Mail } from 'lucide-react'
import { ESTADO_COLORS, ESTADO_LABELS, type EstadoExpediente } from '../../types'
import { clsx } from 'clsx'

const ESTADO_ORDER: EstadoExpediente[] = [
  'DETECCION', 'EVALUACION', 'PREPARACION', 'PRESENTADA',
  'SUBSANACION', 'CONCEDIDA', 'JUSTIFICACION', 'CERRADA', 'DENEGADA',
]

const ESTADO_SHORT: Record<EstadoExpediente, string> = {
  DETECCION: 'Detec.',
  EVALUACION: 'Eval.',
  PREPARACION: 'Prep.',
  PRESENTADA: 'Present.',
  SUBSANACION: 'Subsan.',
  CONCEDIDA: 'Concedida',
  JUSTIFICACION: 'Justif.',
  CERRADA: 'Cerrada',
  DENEGADA: 'Denega.',
}

export function Dashboard() {
  const { expedientes, alertas, clientes, convocatorias } = useAppStore()
  const navigate = useNavigate()
  const [isProviderMode, setIsProviderMode] = useState(false)

  const activos = expedientes.filter((e) =>
    !['CERRADA', 'DENEGADA'].includes(e.estado)
  )
  const porJustificar = expedientes.filter((e) => e.estado === 'JUSTIFICACION')
  const alertasPendientes = alertas.filter((a) => a.estado === 'pendiente')
  const importeTotal = expedientes
    .filter((e) => e.importeConcedido > 0)
    .reduce((sum, e) => sum + e.importeConcedido, 0)

  // B23 — tasa de éxito
  const cerradas = expedientes.filter((e) => ['CERRADA', 'DENEGADA', 'CONCEDIDA', 'JUSTIFICACION'].includes(e.estado))
  const concedidas = expedientes.filter((e) => ['CONCEDIDA', 'JUSTIFICACION', 'CERRADA'].includes(e.estado) && e.importeConcedido > 0)
  const tasaExito = cerradas.length > 0 ? Math.round((concedidas.length / cerradas.length) * 100) : 0

  const porEstado = ESTADO_ORDER.map((estado) => ({
    name: ESTADO_SHORT[estado],
    fullName: ESTADO_LABELS[estado],
    count: expedientes.filter((e) => e.estado === estado).length,
    color: ESTADO_COLORS[estado],
  })).filter((d) => d.count > 0)

  const proximosVencimientos = expedientes
    .filter((e) => e.fechaVencimiento && !['CERRADA', 'DENEGADA'].includes(e.estado))
    .sort((a, b) => (a.fechaVencimiento!.getTime() - b.fechaVencimiento!.getTime()))
    .slice(0, 5)

  // F — subsanaciones activas
  const subsanacionesActivas = expedientes.filter((e) => e.estado === 'SUBSANACION')

  // Derive vencimiento tipo
  const getVencimientoTipo = (exp: typeof expedientes[0]): { label: string; color: string } => {
    if (exp.estado === 'SUBSANACION') return { label: 'Subsanación', color: 'text-red-600 bg-red-50' }
    if (exp.estado === 'JUSTIFICACION') return { label: 'Justificación', color: 'text-orange-600 bg-orange-50' }
    if (exp.estado === 'CONCEDIDA') return { label: 'Aceptación', color: 'text-blue-600 bg-blue-50' }
    return { label: 'Convocatoria', color: 'text-yellow-700 bg-yellow-50' }
  }

  // B01 — urgentes (≤ 14 días)
  const urgentes = expedientes
    .filter((e) => e.fechaVencimiento && !['CERRADA', 'DENEGADA'].includes(e.estado) && diffDays(e.fechaVencimiento) <= 14)
    .sort((a, b) => diffDays(a.fechaVencimiento!) - diffDays(b.fechaVencimiento!))
    .slice(0, 5)

  const getAlertaDias = (a: typeof alertas[number]) =>
    Math.ceil((a.fechaDisparo.getTime() - Date.now()) / (1000 * 60 * 60 * 24))

  // A22 — acción prioritaria: alerta más urgente
  const alertaMasUrgente = alertasPendientes.length > 0
    ? [...alertasPendientes].sort((a, b) => getAlertaDias(a) - getAlertaDias(b))[0]
    : null

  const formatEur = (n: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

  function diffDays(date: Date) {
    const diff = date.getTime() - Date.now()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  // C25 — proveedor: métricas
  const expedientesAsignados = expedientes.filter((e) => e.gestorId === 'g1' && !['CERRADA', 'DENEGADA'].includes(e.estado))
  const importeContratado = expedientesAsignados.reduce((s, e) => s + e.importeSolicitado, 0)

  return (
    <>
      <Navbar title="Panel de control" subtitle={`${new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`} />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* C01 — toggle vista Proveedor / Gestor */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsProviderMode(false)}
              className={clsx(
                'px-4 py-1.5 rounded-full text-xs font-medium transition-colors',
                !isProviderMode ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              Soy Gestor
            </button>
            <button
              onClick={() => setIsProviderMode(true)}
              className={clsx(
                'px-4 py-1.5 rounded-full text-xs font-medium transition-colors',
                isProviderMode ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              Soy Proveedor
            </button>
          </div>

          {/* A20 — nota discreta success fee */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 flex items-center gap-2">
            <CheckCircle size={14} className="text-blue-500 flex-shrink-0" />
            <p className="text-xs text-blue-700">
              Recuerda: <strong>solo pagas si obtienes la subvención</strong> (15% del importe concedido)
            </p>
          </div>

          {isProviderMode ? (
            /* ===== VISTA PROVEEDOR ===== */
            <div className="space-y-6">
              {/* C25 — métricas proveedor */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard
                  title="Expedientes activos asignados"
                  value={expedientesAsignados.length}
                  subtitle="en trámite ahora mismo"
                  icon={<FileText size={18} />}
                  color="#60A5FA"
                />
                <StatCard
                  title="Presupuestos aprobados"
                  value={concedidas.filter((e) => e.gestorId === 'g1').length}
                  subtitle="este mes"
                  icon={<CheckCircle size={18} />}
                  color="#34D399"
                />
                <StatCard
                  title="Importe total contratado"
                  value={formatEur(importeContratado)}
                  subtitle="suma de importes solicitados"
                  icon={<TrendingUp size={18} />}
                  color="#A78BFA"
                />
              </div>

              {/* C01 — mis expedientes asignados */}
              <Card padding="none">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-900">Mis expedientes asignados</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Filtrado por tu gestor (Laura Martínez)</p>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {['Cliente', 'Convocatoria', 'Estado', 'Solicitado', 'Vencimiento'].map((h) => (
                        <th key={h} className="text-left text-xs font-medium text-slate-500 px-5 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {expedientesAsignados.slice(0, 5).map((exp) => {
                      const cli = clientes.find((c) => c.id === exp.clienteId)
                      const conv = convocatorias.find((c) => c.idBdns === exp.convocatoriaId)
                      const dias = exp.fechaVencimiento ? diffDays(exp.fechaVencimiento) : null
                      return (
                        <tr
                          key={exp.id}
                          className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors"
                          onClick={() => navigate(`/expedientes/${exp.id}`)}
                        >
                          <td className="px-5 py-3 text-sm font-medium text-slate-900">{cli?.nombre}</td>
                          <td className="px-5 py-3 text-sm text-slate-600 max-w-xs truncate">{conv?.nombre}</td>
                          <td className="px-5 py-3"><EstadoBadge estado={exp.estado} size="sm" /></td>
                          <td className="px-5 py-3 text-sm text-slate-700 tabular-nums">{formatEur(exp.importeSolicitado)}</td>
                          <td className="px-5 py-3">
                            {dias !== null ? (
                              <span className={clsx('text-sm font-medium', dias <= 7 ? 'text-red-600' : dias <= 14 ? 'text-orange-500' : 'text-slate-600')}>
                                {dias <= 0 ? `Hace ${Math.abs(dias)}d` : `${dias} días`}
                              </span>
                            ) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </Card>

              {/* C05 — contratos recientes */}
              <Card padding="md">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Contratos recientes</h3>
                <div className="space-y-2">
                  {[
                    { empresa: 'Hostelería Atlántica S.L.', contrato: 'Contrato de gestión #2024-001', importe: '6.000 €', fecha: '15/01/2024' },
                    { empresa: 'Tech Innovate BCN S.L.', contrato: 'Contrato de gestión #2024-002', importe: '12.000 €', fecha: '22/02/2024' },
                    { empresa: 'Agro Extremadura Bio S.C.', contrato: 'Contrato de gestión #2024-003', importe: '4.500 €', fecha: '10/03/2024' },
                  ].map((c, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                      <div>
                        <p className="text-xs font-medium text-slate-900">{c.empresa}</p>
                        <p className="text-xs text-slate-400">{c.contrato} · {c.fecha}</p>
                      </div>
                      <span className="text-xs font-semibold text-emerald-600">{c.importe}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          ) : (
            /* ===== VISTA GESTOR ===== */
            <>
              {/* A22 — acción prioritaria de hoy */}
              <Card padding="md">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Acción prioritaria de hoy</h3>
                {alertaMasUrgente ? (
                  <div className="flex items-center justify-between gap-4 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                    <div className="flex items-start gap-3">
                      <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-slate-900">{alertaMasUrgente.mensaje}</p>
                        <p className="text-xs text-red-600 mt-0.5">
                          {(() => { const d = getAlertaDias(alertaMasUrgente); return d <= 0 ? 'Vencido' : d === 1 ? 'Vence mañana' : `Vence en ${d} días` })()}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => navigate('/alertas')}
                      className="text-xs font-semibold text-red-600 hover:text-red-800 whitespace-nowrap"
                    >
                      Ver ahora →
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
                    <CheckCircle size={16} className="text-emerald-500 flex-shrink-0" />
                    <p className="text-sm text-emerald-700 font-medium">Todo en orden 🎉 No hay alertas urgentes</p>
                  </div>
                )}
              </Card>

              {/* Stats — A01 subtítulo llano */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <StatCard
                  title="Expedientes activos"
                  value={activos.length}
                  subtitle="trámites de subvención en curso"
                  icon={<FileText size={18} />}
                  color="#60A5FA"
                  trend={{ value: 12, label: 'este mes' }}
                />
                <StatCard
                  title="Por justificar"
                  value={porJustificar.length}
                  subtitle="subvenciones concedidas pendientes"
                  icon={<AlertTriangle size={18} />}
                  color="#FB923C"
                />
                <StatCard
                  title="Alertas pendientes"
                  value={alertasPendientes.length}
                  subtitle="requieren tu atención hoy"
                  icon={<AlertTriangle size={18} />}
                  color="#F87171"
                />
                <StatCard
                  title="Importe concedido"
                  value={formatEur(importeTotal)}
                  subtitle="total acumulado obtenido"
                  icon={<TrendingUp size={18} />}
                  color="#34D399"
                  trend={{ value: 8, label: 'vs mes anterior' }}
                />
                {/* B23 — tasa de éxito */}
                <StatCard
                  title="Tasa de éxito"
                  value={`${tasaExito}%`}
                  subtitle="subvenciones obtenidas"
                  icon={<CheckCircle size={18} />}
                  color="#A78BFA"
                />
              </div>

              {/* A17 — tarjeta gestor */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Chart */}
                    <Card padding="md">
                      <h3 className="text-sm font-semibold text-slate-900 mb-4">Expedientes por estado</h3>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={porEstado} barSize={22}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
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

                    {/* B01 — mis expedientes urgentes */}
                    <Card padding="md">
                      <h3 className="text-sm font-semibold text-slate-900 mb-3">Mis expedientes urgentes</h3>
                      {urgentes.length === 0 ? (
                        <p className="text-xs text-slate-400 py-4 text-center">Sin urgencias esta semana</p>
                      ) : (
                        <div className="space-y-2">
                          {urgentes.map((exp, idx) => {
                            const cli = clientes.find((c) => c.id === exp.clienteId)
                            const dias = diffDays(exp.fechaVencimiento!)
                            const isTop = idx === 0
                            return (
                              <div
                                key={exp.id}
                                className={clsx(
                                  'flex items-center justify-between gap-2 cursor-pointer rounded-lg p-1.5 -mx-1.5 transition-colors',
                                  isTop ? 'bg-red-50 hover:bg-red-100 border border-red-100' : 'hover:bg-slate-50'
                                )}
                                onClick={() => navigate(`/expedientes/${exp.id}`)}
                              >
                                <div className="min-w-0 flex items-center gap-2">
                                  {isTop && (
                                    <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                                    </span>
                                  )}
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium text-slate-900 truncate">{cli?.nombre}</p>
                                    <EstadoBadge estado={exp.estado} size="sm" />
                                  </div>
                                </div>
                                <span className={clsx(
                                  'text-xs font-bold flex-shrink-0',
                                  dias <= 0 ? 'text-red-700' : dias <= 7 ? 'text-red-600' : 'text-orange-500'
                                )}>
                                  {dias <= 0 ? 'Vencido' : `${dias}d`}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </Card>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* A17 — tarjeta gestor */}
                  <Card padding="md">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 bg-emerald-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                        LM
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Tu gestor</p>
                        <p className="text-xs text-slate-500">Laura Martínez</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <a
                        href="mailto:laura@ayudapyme.es"
                        className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-800"
                      >
                        <Mail size={12} />
                        Enviar mensaje
                      </a>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <User size={12} />
                        900 123 456
                      </div>
                    </div>
                  </Card>

                  {/* Recent alerts */}
                  <Card padding="md">
                    <h3 className="text-sm font-semibold text-slate-900 mb-3">Alertas recientes</h3>
                    <div className="space-y-3">
                      {alertas.slice(0, 4).map((alerta) => {
                        const exp = expedientes.find((e) => e.id === alerta.expedienteId)
                        const cli = clientes.find((c) => c.id === exp?.clienteId)
                        const alertaDias = getAlertaDias(alerta)
                        const urgency = alertaDias <= 5 ? 'red' : alertaDias <= 14 ? 'orange' : 'slate'
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
                            {alertaDias > 0 && (
                              <span className={clsx(
                                'text-xs font-medium flex-shrink-0',
                                urgency === 'red' ? 'text-red-500' : urgency === 'orange' ? 'text-orange-500' : 'text-slate-500'
                              )}>
                                {alertaDias}d
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </Card>
                </div>
              </div>

              {/* F — Subsanaciones activas */}
              {subsanacionesActivas.length > 0 && (
                <Card padding="none">
                  <div className="px-5 py-4 border-b border-red-100 bg-red-50 flex items-center justify-between rounded-t-2xl">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
                      <h3 className="text-sm font-semibold text-red-900">Subsanaciones activas</h3>
                      <span className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full font-semibold">
                        {subsanacionesActivas.length}
                      </span>
                    </div>
                    <p className="text-xs text-red-700">10 días hábiles para responder</p>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {subsanacionesActivas.map((exp) => {
                      const cli = clientes.find((c) => c.id === exp.clienteId)
                      const conv = convocatorias.find((c) => c.idBdns === exp.convocatoriaId)
                      const diasRestantes = exp.fechaVencimiento ? diffDays(exp.fechaVencimiento) : null
                      return (
                        <div
                          key={exp.id}
                          className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 cursor-pointer transition-colors"
                          onClick={() => navigate(`/expedientes/${exp.id}`)}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900">{cli?.nombre}</p>
                            <p className="text-xs text-slate-500 truncate">{conv?.nombre}</p>
                          </div>
                          {diasRestantes !== null && (
                            <span className={clsx(
                              'text-xs font-bold flex-shrink-0 px-2 py-1 rounded',
                              diasRestantes <= 5 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                            )}>
                              {diasRestantes <= 0 ? 'Vencido' : `${diasRestantes}d restantes`}
                            </span>
                          )}
                          <span className="text-xs text-red-600 font-medium flex-shrink-0">Ver →</span>
                        </div>
                      )
                    })}
                  </div>
                </Card>
              )}

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
                      {['Cliente', 'Convocatoria', 'Estado', 'Tipo', 'Importe', 'Vencimiento'].map((h) => (
                        <th key={h} className="text-left text-xs font-medium text-slate-500 px-5 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {proximosVencimientos.map((exp) => {
                      const cli = clientes.find((c) => c.id === exp.clienteId)
                      const conv = convocatorias.find((c) => c.idBdns === exp.convocatoriaId)
                      const dias = diffDays(exp.fechaVencimiento!)
                      const tipo = getVencimientoTipo(exp)
                      return (
                        <tr
                          key={exp.id}
                          className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors"
                          onClick={() => navigate(`/expedientes/${exp.id}`)}
                        >
                          <td className="px-5 py-3 text-sm font-medium text-slate-900">{cli?.nombre}</td>
                          <td className="px-5 py-3 text-sm text-slate-600 max-w-xs truncate">{conv?.nombre}</td>
                          <td className="px-5 py-3"><EstadoBadge estado={exp.estado} size="sm" /></td>
                          <td className="px-5 py-3">
                            <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', tipo.color)}>
                              {tipo.label}
                            </span>
                          </td>
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
            </>
          )}
        </div>
      </div>
    </>
  )
}
