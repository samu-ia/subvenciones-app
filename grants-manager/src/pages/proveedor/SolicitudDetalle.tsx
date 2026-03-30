import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import {
  ArrowLeft, CheckCircle, FileText, Euro, Clock,
  AlertTriangle, ChevronRight, Download, Info,
} from 'lucide-react'
import { clsx } from 'clsx'
import { ESTADO_LABELS } from '../../types'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)

function diasHasta(fecha: Date): number {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const target = new Date(fecha)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
}

const GRANT_CONTEXT: Record<string, {
  necesidad: string
  subvencionable: string[]
  noSubvencionable: string[]
  docsRequeridos: string[]
  tipoPlantilla: 'digitalizacion' | 'formacion' | 'general'
  partidas: Array<{ partida: string; descripcion: string }>
}> = {
  '731245': {
    necesidad: 'Digitalización del sistema de gestión de stock y punto de venta. Incluye formación al personal.',
    subvencionable: ['Software de gestión de inventario', 'Terminal POS y hardware asociado', 'Formación al personal hasta 40 horas', 'Integración con sistemas existentes'],
    noSubvencionable: ['Mantenimiento posterior al período de ejecución', 'Consultoría estratégica no vinculada', 'Gastos de desplazamiento'],
    docsRequeridos: [
      'Presupuesto detallado por partidas (OBLIGATORIO)',
      'Declaración responsable de capacidad técnica',
      'Certificado estar al corriente de pagos SS y AEAT',
      'Referencias de proyectos similares (recomendado)',
    ],
    tipoPlantilla: 'digitalizacion',
    partidas: [
      { partida: 'Software', descripcion: 'Licencia software gestión stock (1 año)' },
      { partida: 'Hardware', descripcion: 'Terminal POS + lector códigos de barras' },
      { partida: 'Instalación', descripcion: 'Configuración e instalación del sistema' },
      { partida: 'Formación', descripcion: 'Formación a usuarios (horas)' },
    ],
  },
  '731890': {
    necesidad: 'Implementación de soluciones digitales certificadas AceleraPyme: presencia en internet, CRM y factura electrónica.',
    subvencionable: ['Software/SaaS certificado AceleraPyme (licencia mínima 12 meses)', 'Página web + posicionamiento SEO básico', 'Formación incluida en la solución digital'],
    noSubvencionable: ['Hardware no vinculado a la solución', 'Desarrollo a medida no certificado', 'Consultoría estratégica externa'],
    docsRequeridos: [
      'Propuesta técnica con soluciones certificadas AceleraPyme',
      'Presupuesto desglosado por solución digital',
      'Acreditación como Agente Digitalizador Red.es',
    ],
    tipoPlantilla: 'digitalizacion',
    partidas: [
      { partida: 'Presencia en internet', descripcion: 'Página web + SEO básico (12 meses)' },
      { partida: 'CRM', descripcion: 'Software CRM (licencia 12 meses)' },
      { partida: 'Factura electrónica', descripcion: 'Solución factura electrónica (12 meses)' },
      { partida: 'Formación', descripcion: 'Sesiones de formación incluidas' },
    ],
  },
}

function getGrantContext(convocatoriaId: string) {
  return GRANT_CONTEXT[convocatoriaId] ?? {
    necesidad: 'Proveedor de servicios necesarios para la ejecución del proyecto subvencionado.',
    subvencionable: ['Servicios directamente relacionados con el objeto de la subvención'],
    noSubvencionable: ['Gastos generales no imputables', 'IVA (salvo casos especiales)'],
    docsRequeridos: [
      'Presupuesto detallado por partidas (obligatorio)',
      'Declaración responsable',
      'Certificado corriente de pago AEAT y SS',
    ],
    tipoPlantilla: 'general' as const,
    partidas: [
      { partida: 'Servicio principal', descripcion: 'Descripción del servicio principal' },
      { partida: 'Materiales', descripcion: 'Materiales necesarios' },
      { partida: 'Otros', descripcion: 'Otros gastos imputables' },
    ],
  }
}

interface BudgetLine {
  partida: string
  descripcion: string
  unidades: string
  precioUnitario: string
}

export function SolicitudDetalle() {
  const { presupuestoId } = useParams<{ presupuestoId: string }>()
  const navigate = useNavigate()
  const { presupuestos, expedientes, convocatorias, clientes, submitPresupuestoProveedor } = useAppStore()

  const pres = presupuestos.find((p) => p.id === presupuestoId)
  const expediente = pres ? expedientes.find((e) => e.id === pres.expedienteId) : undefined
  const convocatoria = expediente ? convocatorias.find((c) => c.idBdns === expediente.convocatoriaId) : undefined
  const cliente = expediente ? clientes.find((c) => c.id === expediente.clienteId) : undefined

  const ctx = expediente ? getGrantContext(expediente.convocatoriaId) : undefined

  // Form state
  const [importe, setImporte] = useState('')
  const [plazo, setPlazo] = useState('')
  const [notasForm, setNotasForm] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [errors, setErrors] = useState<{ importe?: string; plazo?: string }>({})

  // Budget lines state
  const [lines, setLines] = useState<BudgetLine[]>(
    ctx?.partidas.map((p) => ({ ...p, unidades: '', precioUnitario: '' })) ?? []
  )

  const totalLines = lines.reduce((acc, l) => {
    const u = parseFloat(l.unidades) || 0
    const p = parseFloat(l.precioUnitario) || 0
    return acc + u * p
  }, 0)

  if (!pres || !expediente || !convocatoria || !cliente || !ctx) {
    return (
      <div className="min-h-screen bg-indigo-50/40 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 mb-4">Solicitud no encontrada.</p>
          <Button onClick={() => navigate('/proveedor')}>Volver al portal</Button>
        </div>
      </div>
    )
  }

  const deadline = new Date(pres.fechaSolicitud)
  deadline.setDate(deadline.getDate() + 5)
  const dias = diasHasta(deadline)

  function validate() {
    const errs: { importe?: string; plazo?: string } = {}
    if (!importe || isNaN(parseFloat(importe)) || parseFloat(importe) <= 0) {
      errs.importe = 'Introduce un importe válido'
    }
    if (!plazo || isNaN(parseInt(plazo)) || parseInt(plazo) <= 0) {
      errs.plazo = 'Introduce un plazo en días válido'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleSubmit() {
    if (!validate()) return
    // pres/ctx/convocatoria are guaranteed non-null here (guarded above)
    submitPresupuestoProveedor(pres!.id, parseFloat(importe), parseInt(plazo), notasForm)
    setSubmitted(true)
  }

  function downloadPlantilla() {
    const tipo = ctx!.tipoPlantilla
    let csv = 'Partida,Descripción,Unidades,Precio unitario,Total\n'

    if (tipo === 'digitalizacion') {
      csv +=
        'Software,Licencia software gestión stock (1 año),,0,0\n' +
        'Hardware,Terminal POS + lector códigos,,0,0\n' +
        'Instalación,Configuración e instalación,,0,0\n' +
        'Formación,Formación usuarios (horas),,0,0\n'
    } else if (tipo === 'formacion') {
      csv +=
        'Formación presencial,Horas de formación presencial,,0,0\n' +
        'Material didáctico,Materiales por alumno,,0,0\n' +
        'Certificación,Emisión certificados,,0,0\n'
    } else {
      csv +=
        'Servicio principal,Descripción detallada del servicio,,0,0\n' +
        'Materiales,Materiales y suministros necesarios,,0,0\n' +
        'Otros gastos,Otros gastos imputables,,0,0\n'
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `plantilla_presupuesto_${convocatoria!.nombre.replace(/\s+/g, '_').slice(0, 30)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Submitted confirmation screen
  if (submitted) {
    return (
      <div className="min-h-screen bg-indigo-50/40 flex items-center justify-center p-6">
        <Card className="max-w-lg w-full p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle size={32} className="text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Presupuesto enviado correctamente</h2>
          <p className="text-slate-500 text-sm">
            El gestor lo revisará en las próximas 24–48 horas.
          </p>

          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-left space-y-2 text-sm">
            <p className="font-semibold text-indigo-800 text-xs uppercase tracking-wide">¿Qué pasa ahora?</p>
            <div className="flex items-start gap-2 text-slate-700">
              <span className="text-indigo-500 font-bold flex-shrink-0">1.</span>
              <span>El gestor compara tu oferta con las de otros proveedores.</span>
            </div>
            <div className="flex items-start gap-2 text-slate-700">
              <span className="text-indigo-500 font-bold flex-shrink-0">2.</span>
              <span>Si eres seleccionado, recibirás una notificación y el contrato para firmar.</span>
            </div>
            <div className="flex items-start gap-2 text-slate-700">
              <span className="text-indigo-500 font-bold flex-shrink-0">3.</span>
              <span>Una vez firmado el contrato, comenzarás la ejecución del trabajo.</span>
            </div>
          </div>

          <div className="pt-2">
            <p className="text-xs text-slate-400 mb-4">Resumen de tu oferta:</p>
            <div className="flex justify-center gap-8 text-sm">
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-600">{fmt(parseFloat(importe))}</p>
                <p className="text-xs text-slate-400">Importe ofertado</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-700">{plazo} días</p>
                <p className="text-xs text-slate-400">Plazo ejecución</p>
              </div>
            </div>
          </div>

          <Button onClick={() => navigate('/proveedor')} className="w-full mt-2">
            Volver al portal proveedor
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-indigo-50/40">
      {/* Header */}
      <header className="bg-indigo-700 text-white px-6 py-4 shadow-lg">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <button
            onClick={() => navigate('/proveedor')}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <p className="font-semibold">Solicitud de presupuesto</p>
            <p className="text-indigo-200 text-xs">{cliente.nombre} · {convocatoria.nombre}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <AlertTriangle size={14} className={dias <= 2 ? 'text-red-300' : 'text-amber-300'} />
            <span className={clsx('text-sm font-medium', dias <= 2 ? 'text-red-200' : 'text-amber-200')}>
              Vence {dias <= 0 ? 'hoy' : `en ${dias} días`} ({fmtDate(deadline)})
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-5 gap-6">
        {/* Left column: context info (3 cols) */}
        <div className="col-span-3 space-y-5">
          {/* Grant info */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Info size={14} className="text-indigo-500" />
              Información de la subvención
            </h3>
            <div className="space-y-2">
              <p className="text-base font-bold text-slate-900">{convocatoria.nombre}</p>
              <p className="text-xs text-slate-500">{convocatoria.organismo}</p>
              <div className="grid grid-cols-3 gap-4 mt-3">
                <div>
                  <p className="text-xs text-slate-400">Importe máximo</p>
                  <p className="text-sm font-semibold text-emerald-600">{fmt(convocatoria.importeMax)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">% subvencionable</p>
                  <p className="text-sm font-semibold text-slate-700">{convocatoria.porcentajeSubvencionable}%</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Límite ejecución</p>
                  <p className="text-sm font-semibold text-slate-700">{fmtDate(convocatoria.fechaJustificacion)}</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Expediente context */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <FileText size={14} className="text-indigo-500" />
              Contexto del expediente
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-400">Cliente (PYME)</p>
                <p className="text-sm font-semibold text-slate-800">{cliente.nombre}</p>
                <p className="text-xs text-slate-500">{cliente.sector} · {cliente.comunidadAutonoma}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Fase del expediente</p>
                <p className="text-sm font-semibold text-slate-800">{ESTADO_LABELS[expediente.estado]}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-slate-400 mb-1">¿Qué necesita la PYME?</p>
                <p className="text-sm text-slate-700 leading-relaxed">{ctx.necesidad}</p>
              </div>
            </div>
          </Card>

          {/* Eligible expenses */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <CheckCircle size={14} className="text-emerald-500" />
              Gastos subvencionables vs no subvencionables
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-emerald-700 mb-2">Cubierto por la subvención</p>
                <ul className="space-y-1.5">
                  {ctx.subvencionable.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs text-slate-700">
                      <CheckCircle size={12} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-medium text-red-600 mb-2">No subvencionable</p>
                <ul className="space-y-1.5">
                  {ctx.noSubvencionable.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs text-slate-500">
                      <span className="text-red-400 font-bold flex-shrink-0">✗</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>

          {/* Compliance checklist */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <AlertTriangle size={14} className="text-amber-500" />
              Documentos que debes incluir en tu oferta
            </h3>
            <ul className="space-y-2">
              {ctx.docsRequeridos.map((doc, i) => (
                <li key={doc} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <div className={clsx(
                    'w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5',
                    i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                  )}>
                    {i + 1}
                  </div>
                  {doc}
                </li>
              ))}
            </ul>
            <button
              onClick={downloadPlantilla}
              className="mt-4 flex items-center gap-2 text-xs text-indigo-600 hover:text-indigo-800 underline"
            >
              <Download size={12} />
              Descargar plantilla de presupuesto (.csv)
            </button>
          </Card>

          {/* Budget template */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Euro size={14} className="text-indigo-500" />
              Plantilla de presupuesto (rellena los precios)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 pr-3 text-slate-400 font-semibold">Partida</th>
                    <th className="text-left py-2 pr-3 text-slate-400 font-semibold">Descripción</th>
                    <th className="text-right py-2 pr-3 text-slate-400 font-semibold w-20">Uds.</th>
                    <th className="text-right py-2 pr-3 text-slate-400 font-semibold w-24">Precio/ud</th>
                    <th className="text-right py-2 text-slate-400 font-semibold w-24">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, i) => {
                    const total = (parseFloat(line.unidades) || 0) * (parseFloat(line.precioUnitario) || 0)
                    return (
                      <tr key={i} className="border-b border-slate-50">
                        <td className="py-2 pr-3 font-medium text-slate-700">{line.partida}</td>
                        <td className="py-2 pr-3 text-slate-500">{line.descripcion}</td>
                        <td className="py-2 pr-3">
                          <input
                            type="number"
                            min="0"
                            className="w-full text-right border border-slate-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:border-indigo-400"
                            value={line.unidades}
                            onChange={(e) => {
                              const updated = [...lines]
                              updated[i] = { ...updated[i], unidades: e.target.value }
                              setLines(updated)
                            }}
                            placeholder="0"
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <input
                            type="number"
                            min="0"
                            className="w-full text-right border border-slate-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:border-indigo-400"
                            value={line.precioUnitario}
                            onChange={(e) => {
                              const updated = [...lines]
                              updated[i] = { ...updated[i], precioUnitario: e.target.value }
                              setLines(updated)
                            }}
                            placeholder="0,00"
                          />
                        </td>
                        <td className="py-2 text-right font-medium text-slate-700">
                          {total > 0 ? fmt(total) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200">
                    <td colSpan={4} className="py-2 pr-3 font-semibold text-slate-700 text-right">TOTAL</td>
                    <td className="py-2 text-right font-bold text-emerald-600">
                      {totalLines > 0 ? fmt(totalLines) : '—'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {totalLines > 0 && (
              <button
                className="mt-3 text-xs text-indigo-600 hover:text-indigo-800 underline"
                onClick={() => setImporte(totalLines.toString())}
              >
                Usar este total como importe del presupuesto ({fmt(totalLines)})
              </button>
            )}
          </Card>
        </div>

        {/* Right column: submit form (2 cols) */}
        <div className="col-span-2">
          <div className="sticky top-6 space-y-4">
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Tu oferta</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">
                    Importe total (€) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Euro size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="number"
                      min="0"
                      step="100"
                      className={clsx(
                        'w-full border rounded-lg px-3 py-2.5 pl-9 text-sm focus:outline-none focus:ring-2',
                        errors.importe
                          ? 'border-red-300 focus:ring-red-200'
                          : 'border-slate-300 focus:ring-indigo-200 focus:border-indigo-400'
                      )}
                      placeholder="0"
                      value={importe}
                      onChange={(e) => {
                        setImporte(e.target.value)
                        if (errors.importe) setErrors((prev) => ({ ...prev, importe: undefined }))
                      }}
                    />
                  </div>
                  {errors.importe && <p className="text-xs text-red-500 mt-1">{errors.importe}</p>}
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">
                    Plazo de ejecución (días) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="number"
                      min="1"
                      className={clsx(
                        'w-full border rounded-lg px-3 py-2.5 pl-9 text-sm focus:outline-none focus:ring-2',
                        errors.plazo
                          ? 'border-red-300 focus:ring-red-200'
                          : 'border-slate-300 focus:ring-indigo-200 focus:border-indigo-400'
                      )}
                      placeholder="30"
                      value={plazo}
                      onChange={(e) => {
                        setPlazo(e.target.value)
                        if (errors.plazo) setErrors((prev) => ({ ...prev, plazo: undefined }))
                      }}
                    />
                  </div>
                  {errors.plazo && <p className="text-xs text-red-500 mt-1">{errors.plazo}</p>}
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">
                    Notas adicionales (opcional)
                  </label>
                  <textarea
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 resize-none"
                    rows={3}
                    placeholder="Condiciones especiales, materiales incluidos, garantías..."
                    value={notasForm}
                    onChange={(e) => setNotasForm(e.target.value)}
                  />
                </div>

                <Button
                  className="w-full flex items-center justify-center gap-2 py-3"
                  onClick={handleSubmit}
                >
                  Enviar presupuesto
                  <ChevronRight size={16} />
                </Button>
              </div>
            </Card>

            {/* Quick summary */}
            <Card className="p-4 bg-indigo-50 border border-indigo-100">
              <p className="text-xs font-semibold text-indigo-700 mb-2">Resumen de la solicitud</p>
              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Cliente</span>
                  <span className="font-medium text-slate-800 truncate max-w-32">{cliente.nombre}</span>
                </div>
                <div className="flex justify-between">
                  <span>Subvención máx.</span>
                  <span className="font-medium text-emerald-600">{fmt(convocatoria.importeMax)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Vence el</span>
                  <span className={clsx('font-medium', dias <= 2 ? 'text-red-600' : 'text-amber-700')}>
                    {fmtDate(deadline)}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
