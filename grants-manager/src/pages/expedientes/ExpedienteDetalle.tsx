import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Navbar } from '../../components/layout/Navbar'
import { Card } from '../../components/ui/Card'
import { EstadoBadge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { useAppStore } from '../../store'
import {
  ArrowLeft, FileText, MessageSquare, Clock, Upload,
  CheckCircle, XCircle, AlertTriangle, ChevronRight, ChevronDown
} from 'lucide-react'
import { clsx } from 'clsx'
import { ESTADO_COLORS, ESTADO_LABELS, type EstadoExpediente } from '../../types'

const TODOS_ESTADOS: EstadoExpediente[] = [
  'DETECCION', 'EVALUACION', 'PREPARACION', 'PRESENTADA',
  'SUBSANACION', 'CONCEDIDA', 'JUSTIFICACION', 'CERRADA', 'DENEGADA',
]

const TABS = ['Datos generales', 'Documentos', 'Notas', 'Historial'] as const

// A14 — descripciones llanas de estado para el historial
const ESTADO_DESC: Record<string, string> = {
  DETECCION: 'Expediente identificado',
  EVALUACION: 'En evaluación de viabilidad',
  PREPARACION: 'Recopilando documentación',
  PRESENTADA: 'Solicitud presentada a la administración',
  SUBSANACION: 'Pendiente de subsanación',
  CONCEDIDA: '¡Subvención concedida!',
  JUSTIFICACION: 'Presentando justificación del gasto',
  CERRADA: 'Expediente cerrado',
  DENEGADA: 'Solicitud denegada',
}

// D16 — filtros de documentos
const DOC_FILTROS = ['Todos', 'Pendientes', 'Subidos', 'Validados'] as const
type DocFiltro = typeof DOC_FILTROS[number]

export function ExpedienteDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { expedientes, clientes, convocatorias, gestores, addHistorialEntry, updateExpedienteEstado, addNota } = useAppStore()
  const [tab, setTab] = useState<typeof TABS[number]>('Datos generales')
  const [nota, setNota] = useState('')
  const [docFiltro, setDocFiltro] = useState<DocFiltro>('Todos') // D16
  const [showEstadoMenu, setShowEstadoMenu] = useState(false)

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

  // D16 — filtro de documentos
  const docsFiltrados = exp.documentos.filter((d) => {
    if (docFiltro === 'Todos') return true
    if (docFiltro === 'Pendientes') return d.estado === 'pendiente'
    if (docFiltro === 'Subidos') return d.estado === 'subido'
    if (docFiltro === 'Validados') return d.estado === 'validado'
    return true
  })

  // C04 — documentos pendientes
  const docsPendientes = exp.documentos.filter((d) => d.estado === 'pendiente').length

  // D24 — registrar revisión
  const handleRegistrarRevision = () => {
    addHistorialEntry(exp.id, 'Revisado por Gestor', 'Gestor')
  }

  // Estado change
  const handleCambioEstado = (nuevoEstado: EstadoExpediente) => {
    if (nuevoEstado !== exp.estado) {
      updateExpedienteEstado(exp.id, nuevoEstado, 'Laura Martínez')
    }
    setShowEstadoMenu(false)
  }

  // Añadir nota
  const handleAddNota = () => {
    if (!nota.trim()) return
    addNota(exp.id, nota.trim(), 'Laura Martínez')
    setNota('')
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
        {/* C04 — banner documentos pendientes */}
        {docsPendientes > 0 && (
          <div className="bg-yellow-50 border-b border-yellow-200 px-6 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-base">📋</span>
              <p className="text-sm font-medium text-yellow-800">
                Acción requerida: hay {docsPendientes} {docsPendientes === 1 ? 'documento pendiente' : 'documentos pendientes'} de subir
              </p>
            </div>
            <button
              onClick={() => setTab('Documentos')}
              className="text-xs font-semibold text-yellow-700 hover:text-yellow-900 whitespace-nowrap border border-yellow-300 rounded-lg px-3 py-1.5 hover:bg-yellow-100 transition-colors"
            >
              Ver documentos
            </button>
          </div>
        )}

        {/* Header band */}
        <div className="bg-white border-b border-slate-100 px-6 py-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Estado con dropdown para cambiar */}
            <div className="relative">
              <button
                onClick={() => setShowEstadoMenu((v) => !v)}
                className="flex items-center gap-1.5 group"
                title="Cambiar estado"
              >
                <EstadoBadge estado={exp.estado} />
                <ChevronDown size={12} className="text-slate-400 group-hover:text-slate-700 transition-colors" />
              </button>
              {showEstadoMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowEstadoMenu(false)}
                  />
                  <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1 min-w-44">
                    <p className="text-xs text-slate-400 px-3 py-1.5 font-medium">Cambiar estado a:</p>
                    {TODOS_ESTADOS.filter((s) => s !== exp.estado).map((s) => (
                      <button
                        key={s}
                        onClick={() => handleCambioEstado(s)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 transition-colors"
                      >
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: ESTADO_COLORS[s] }}
                        />
                        <span className="text-sm text-slate-700">{ESTADO_LABELS[s]}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            {exp.numeroOficial && (
              <span className="text-xs text-slate-500 font-mono bg-slate-100 px-2 py-1 rounded">{exp.numeroOficial}</span>
            )}
            <span className="text-xs text-slate-500">
              Gestor: <span className="font-medium text-slate-700">{gestor?.nombre}</span>
            </span>
            {/* D07 — NIF del cliente */}
            {cliente?.nif && (
              <span className="text-xs text-slate-500">
                NIF: <span className="font-mono font-medium text-slate-700">{cliente.nif}</span>
              </span>
            )}
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
              <div className="space-y-5">
                {/* A08-A09 — tarjeta grande importe concedido */}
                {exp.importeConcedido > 0 && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 flex items-center gap-4">
                    <CheckCircle size={32} className="text-emerald-500 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-700">✓ Subvención concedida</p>
                      <p className="text-3xl font-bold text-emerald-800 mt-1">{formatEur(exp.importeConcedido)}</p>
                    </div>
                  </div>
                )}

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
                        // A10 — label completa
                        { label: 'Fecha límite para justificar el gasto', value: conv?.fechaJustificacion.toLocaleDateString('es-ES') },
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

                  <div className="space-y-5">
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
                    </Card>

                    {/* D23 — resumen financiero */}
                    {conv && (
                      <Card padding="lg">
                        <h3 className="text-sm font-semibold text-slate-900 mb-3">Resumen financiero</h3>
                        <dl className="space-y-2">
                          <div className="flex justify-between gap-4">
                            <dt className="text-xs text-slate-400">Importe máx. convocatoria</dt>
                            <dd className="text-xs font-medium text-slate-800">{formatEur(conv.importeMax)}</dd>
                          </div>
                          <div className="flex justify-between gap-4">
                            <dt className="text-xs text-slate-400">Solicitado</dt>
                            <dd className="text-xs font-medium text-slate-800">{formatEur(exp.importeSolicitado)}</dd>
                          </div>
                          <div className="flex justify-between gap-4">
                            <dt className="text-xs text-slate-400">Concedido</dt>
                            <dd className={clsx('text-xs font-medium', exp.importeConcedido > 0 ? 'text-emerald-600' : 'text-slate-400')}>
                              {exp.importeConcedido > 0 ? formatEur(exp.importeConcedido) : 'Pendiente'}
                            </dd>
                          </div>
                          {exp.importeConcedido > 0 && conv.importeMax > 0 && (
                            <div className="flex justify-between gap-4 pt-1 border-t border-slate-100">
                              <dt className="text-xs text-slate-400">% sobre el máximo</dt>
                              <dd className="text-xs font-semibold text-emerald-600">
                                {Math.round((exp.importeConcedido / conv.importeMax) * 100)}%
                              </dd>
                            </div>
                          )}
                        </dl>
                      </Card>
                    )}
                  </div>
                </div>

                {/* C16 — requisitos en posición destacada */}
                {conv?.requisitos && conv.requisitos.length > 0 && (
                  <Card padding="lg">
                    <h3 className="text-sm font-semibold text-slate-900 mb-3">✅ Requisitos que debes cumplir</h3>
                    <ul className="space-y-1.5">
                      {conv.requisitos.map((r, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                          <ChevronRight size={11} className="text-slate-400 mt-0.5 flex-shrink-0" />
                          {r}
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}

                {/* C20 — nota fee proveedor */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                  <p className="text-xs text-slate-500">
                    💡 <strong>Tu participación es gratuita actualmente.</strong> En el futuro: 3% del contrato (mín. 150€)
                  </p>
                </div>
              </div>
            )}

            {tab === 'Documentos' && (
              <Card padding="none">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Documentos</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {exp.documentos.filter((d) => d.estado === 'validado').length} validados ·{' '}
                      {exp.documentos.filter((d) => d.estado === 'pendiente').length} pendientes
                    </p>
                  </div>
                  {/* D16 — filtros de estado de documentos */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {DOC_FILTROS.map((f) => (
                      <button
                        key={f}
                        onClick={() => setDocFiltro(f)}
                        className={clsx(
                          'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                          docFiltro === f ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        )}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                  <Button size="sm" icon={<Upload size={14} />}>Subir documento</Button>
                </div>
                {docsFiltrados.length === 0 ? (
                  <div className="text-center py-12 text-sm text-slate-400">
                    {docFiltro === 'Todos' ? 'No hay documentos adjuntos' : `No hay documentos en estado "${docFiltro}"`}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {docsFiltrados.map((doc) => {
                      const st = DOC_ESTADO[doc.estado]
                      return (
                        <div
                          key={doc.id}
                          className={clsx(
                            'flex items-center gap-4 px-5 py-3 hover:bg-slate-50 transition-colors border-l-4',
                            // D16 — borde color según estado
                            doc.estado === 'pendiente' ? 'border-l-red-400' :
                            doc.estado === 'validado' ? 'border-l-emerald-400' :
                            doc.estado === 'rechazado' ? 'border-l-red-600' :
                            'border-l-transparent'
                          )}
                        >
                          <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500 flex-shrink-0">
                            <FileText size={15} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900">{doc.tipo}</p>
                            <p className="text-xs text-slate-400 truncate">
                              {doc.nombreArchivo || 'Sin archivo'}{doc.tamanio ? ` · ${doc.tamanio}` : ''}
                            </p>
                            {/* D16 — label pendiente en rojo */}
                            {doc.estado === 'pendiente' && (
                              <p className="text-xs text-red-600 font-medium mt-0.5">⚠️ Pendiente</p>
                            )}
                            {/* A11-A12 — rechazado: instrucción */}
                            {doc.estado === 'rechazado' && (
                              <p className="text-xs text-red-600 mt-0.5">
                                ⚠️ Este documento fue rechazado. Por favor sube una versión corregida.
                              </p>
                            )}
                          </div>
                          {doc.fechaSubida.getFullYear() > 1970 && (
                            <p className="text-xs text-slate-400 flex-shrink-0">
                              {doc.fechaSubida.toLocaleDateString('es-ES')}
                            </p>
                          )}
                          <span className={clsx('flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium flex-shrink-0', st.color)}>
                            {st.icon} {st.label}
                          </span>
                          {(doc.estado === 'pendiente' || doc.estado === 'rechazado') && (
                            <Button size="sm" variant="secondary" icon={<Upload size={12} />}>
                              {doc.estado === 'rechazado' ? 'Subir nuevo' : 'Subir'}
                            </Button>
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
                  {/* A13 — placeholder invitador */}
                  <textarea
                    className="w-full text-sm text-slate-800 border border-slate-200 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 placeholder:text-slate-400"
                    rows={3}
                    placeholder="Escribe aquí tu mensaje para el gestor. Ej: Ya tengo los documentos listos, ¿qué hago ahora?"
                    value={nota}
                    onChange={(e) => setNota(e.target.value)}
                  />
                  <div className="flex justify-end mt-2">
                    <Button size="sm" disabled={!nota.trim()} icon={<MessageSquare size={13} />} onClick={handleAddNota}>
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
                                {h.estadoAnterior && h.estadoAnterior !== h.estadoNuevo && (
                                  <>
                                    <EstadoBadge estado={h.estadoAnterior} size="sm" />
                                    <span className="text-slate-300">→</span>
                                  </>
                                )}
                                <EstadoBadge estado={h.estadoNuevo} size="sm" />
                              </div>
                              {/* A14 — descripción llana del estado */}
                              <p className="text-xs text-slate-500 mt-0.5">{ESTADO_DESC[h.estadoNuevo]}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-slate-500">{h.usuario}</span>
                                <span className="text-slate-300">·</span>
                                {/* D04 — fecha + hora */}
                                <span className="text-xs text-slate-400">
                                  {h.fecha.toLocaleDateString('es-ES')} a las {h.fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                </span>
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
                {/* D24 — botón registrar revisión */}
                <div className="mt-5 pt-4 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={handleRegistrarRevision}
                    className="text-xs text-slate-500 hover:text-slate-900 font-medium border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors"
                  >
                    Registrar revisión
                  </button>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
