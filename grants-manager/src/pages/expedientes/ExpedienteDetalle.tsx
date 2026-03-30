import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Navbar } from '../../components/layout/Navbar'
import { Card } from '../../components/ui/Card'
import { EstadoBadge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { useAppStore } from '../../store'
import {
  ArrowLeft, FileText, MessageSquare, Clock, Upload,
  CheckCircle, XCircle, AlertTriangle, ChevronRight
} from 'lucide-react'
import { clsx } from 'clsx'
import { ESTADO_COLORS, ESTADO_LABELS } from '../../types'

const TABS = ['Datos generales', 'Documentos', 'Notas', 'Historial'] as const

export function ExpedienteDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { expedientes, clientes, convocatorias, gestores } = useAppStore()
  const [tab, setTab] = useState<typeof TABS[number]>('Datos generales')
  const [nota, setNota] = useState('')

  const exp = expedientes.find((e) => e.id === id)
  if (!exp) return (
    <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
      Expediente no encontrado
    </div>
  )

  const cliente = clientes.find((c) => c.id === exp.clienteId)
  const conv = convocatorias.find((c) => c.idBdns === exp.convocatoriaId)
  const gestor = gestores.find((g) => g.id === exp.gestorId)

  const formatEur = (n: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

  const DOC_ESTADO = {
    pendiente: { label: 'Pendiente', icon: <AlertTriangle size={13} />, color: 'text-orange-500 bg-orange-50' },
    subido: { label: 'Subido', icon: <Clock size={13} />, color: 'text-blue-600 bg-blue-50' },
    validado: { label: 'Validado', icon: <CheckCircle size={13} />, color: 'text-emerald-600 bg-emerald-50' },
    rechazado: { label: 'Rechazado', icon: <XCircle size={13} />, color: 'text-red-600 bg-red-50' },
  }

  return (
    <>
      <Navbar
        title={conv?.nombre ?? 'Expediente'}
        subtitle={cliente?.nombre}
        actions={
          <Button variant="secondary" size="sm" icon={<ArrowLeft size={14} />} onClick={() => navigate('/expedientes')}>
            Volver
          </Button>
        }
      />
      <div className="flex-1 overflow-y-auto">
        {/* Header band */}
        <div className="bg-white border-b border-slate-100 px-6 py-4">
          <div className="flex flex-wrap items-center gap-4">
            <EstadoBadge estado={exp.estado} />
            {exp.numeroOficial && (
              <span className="text-xs text-slate-500 font-mono bg-slate-100 px-2 py-1 rounded">{exp.numeroOficial}</span>
            )}
            <span className="text-xs text-slate-500">
              Gestor: <span className="font-medium text-slate-700">{gestor?.nombre}</span>
            </span>
            {exp.importeSolicitado > 0 && (
              <span className="text-xs text-slate-500">
                Solicitado: <span className="font-semibold text-slate-900">{formatEur(exp.importeSolicitado)}</span>
              </span>
            )}
            {exp.importeConcedido > 0 && (
              <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded font-medium">
                Concedido: {formatEur(exp.importeConcedido)}
              </span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white border-b border-slate-100 px-6">
          <div className="flex gap-0">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={clsx(
                  'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                  tab === t
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          <div className="max-w-4xl mx-auto">

            {tab === 'Datos generales' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Card padding="lg">
                  <h3 className="text-sm font-semibold text-slate-900 mb-4">Convocatoria</h3>
                  <dl className="space-y-3">
                    {[
                      { label: 'Nombre', value: conv?.nombre },
                      { label: 'Organismo', value: conv?.organismo },
                      { label: 'Tipo', value: conv?.tipo },
                      { label: 'ID BDNS', value: conv?.idBdns },
                      { label: 'Fecha cierre', value: conv?.fechaCierre.toLocaleDateString('es-ES') },
                      { label: 'Fecha justificación', value: conv?.fechaJustificacion.toLocaleDateString('es-ES') },
                      { label: 'Importe máximo', value: conv ? formatEur(conv.importeMax) : '—' },
                      { label: '% subvencionable', value: conv ? `${conv.porcentajeSubvencionable}%` : '—' },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex justify-between gap-4">
                        <dt className="text-xs text-slate-400 flex-shrink-0">{label}</dt>
                        <dd className="text-xs font-medium text-slate-800 text-right">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </Card>

                <Card padding="lg">
                  <h3 className="text-sm font-semibold text-slate-900 mb-4">Expediente</h3>
                  <dl className="space-y-3">
                    {[
                      { label: 'Nº Oficial', value: exp.numeroOficial || 'Sin asignar' },
                      { label: 'Estado', value: ESTADO_LABELS[exp.estado] },
                      { label: 'Fecha solicitud', value: exp.fechaSolicitud.getFullYear() > 1970 ? exp.fechaSolicitud.toLocaleDateString('es-ES') : 'No presentado' },
                      { label: 'Importe solicitado', value: formatEur(exp.importeSolicitado) },
                      { label: 'Importe concedido', value: exp.importeConcedido > 0 ? formatEur(exp.importeConcedido) : 'Pendiente' },
                      { label: 'Gestor', value: gestor?.nombre ?? '—' },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex justify-between gap-4">
                        <dt className="text-xs text-slate-400 flex-shrink-0">{label}</dt>
                        <dd className="text-xs font-medium text-slate-800 text-right">{value}</dd>
                      </div>
                    ))}
                  </dl>

                  {conv?.requisitos && conv.requisitos.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <p className="text-xs font-medium text-slate-500 mb-2">Requisitos</p>
                      <ul className="space-y-1">
                        {conv.requisitos.map((r, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600">
                            <ChevronRight size={11} className="text-slate-400 mt-0.5 flex-shrink-0" />
                            {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Card>
              </div>
            )}

            {tab === 'Documentos' && (
              <Card padding="none">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Documentos</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {exp.documentos.filter((d) => d.estado === 'validado').length} validados ·{' '}
                      {exp.documentos.filter((d) => d.estado === 'pendiente').length} pendientes
                    </p>
                  </div>
                  <Button size="sm" icon={<Upload size={14} />}>Subir documento</Button>
                </div>
                {exp.documentos.length === 0 ? (
                  <div className="text-center py-12 text-sm text-slate-400">
                    No hay documentos adjuntos
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {exp.documentos.map((doc) => {
                      const st = DOC_ESTADO[doc.estado]
                      return (
                        <div key={doc.id} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 transition-colors">
                          <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500 flex-shrink-0">
                            <FileText size={15} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900">{doc.tipo}</p>
                            <p className="text-xs text-slate-400 truncate">
                              {doc.nombreArchivo || 'Sin archivo'}{doc.tamanio ? ` · ${doc.tamanio}` : ''}
                            </p>
                          </div>
                          {doc.fechaSubida.getFullYear() > 1970 && (
                            <p className="text-xs text-slate-400 flex-shrink-0">
                              {doc.fechaSubida.toLocaleDateString('es-ES')}
                            </p>
                          )}
                          <span className={clsx('flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium flex-shrink-0', st.color)}>
                            {st.icon} {st.label}
                          </span>
                          {doc.estado === 'pendiente' && (
                            <Button size="sm" variant="secondary" icon={<Upload size={12} />}>Subir</Button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </Card>
            )}

            {tab === 'Notas' && (
              <div className="space-y-4">
                <Card padding="md">
                  <textarea
                    className="w-full text-sm text-slate-800 border border-slate-200 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 placeholder:text-slate-400"
                    rows={3}
                    placeholder="Añadir nota..."
                    value={nota}
                    onChange={(e) => setNota(e.target.value)}
                  />
                  <div className="flex justify-end mt-2">
                    <Button size="sm" disabled={!nota.trim()} icon={<MessageSquare size={13} />}>
                      Añadir nota
                    </Button>
                  </div>
                </Card>

                {exp.notas.length === 0 ? (
                  <p className="text-center text-sm text-slate-400 py-8">No hay notas en este expediente</p>
                ) : (
                  <div className="space-y-3">
                    {[...exp.notas].reverse().map((n) => (
                      <Card key={n.id} padding="md">
                        <div className="flex items-start gap-3">
                          <div className="w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {n.autor.charAt(0)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold text-slate-900">{n.autor}</span>
                              <span className="text-xs text-slate-400">
                                {n.fecha.toLocaleDateString('es-ES')} {n.fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-sm text-slate-700 leading-relaxed">{n.texto}</p>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'Historial' && (
              <Card padding="md">
                <h3 className="text-sm font-semibold text-slate-900 mb-4">Historial de cambios</h3>
                {exp.historial.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-6">Sin historial</p>
                ) : (
                  <div className="relative pl-6">
                    <div className="absolute left-2.5 top-0 bottom-0 w-px bg-slate-200" />
                    <div className="space-y-4">
                      {[...exp.historial].reverse().map((h) => (
                        <div key={h.id} className="relative">
                          <div
                            className="absolute -left-6 top-0.5 w-3 h-3 rounded-full border-2 border-white"
                            style={{ backgroundColor: ESTADO_COLORS[h.estadoNuevo] }}
                          />
                          <div className="flex items-start gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                {h.estadoAnterior && (
                                  <>
                                    <EstadoBadge estado={h.estadoAnterior} size="sm" />
                                    <span className="text-slate-300">→</span>
                                  </>
                                )}
                                <EstadoBadge estado={h.estadoNuevo} size="sm" />
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-slate-500">{h.usuario}</span>
                                <span className="text-slate-300">·</span>
                                <span className="text-xs text-slate-400">{h.fecha.toLocaleDateString('es-ES')}</span>
                              </div>
                              {h.comentario && (
                                <p className="text-xs text-slate-600 mt-1 italic">{h.comentario}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
