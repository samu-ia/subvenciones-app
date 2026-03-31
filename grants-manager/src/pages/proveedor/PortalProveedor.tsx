import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store'
import { mockProveedor } from '../../lib/mockData'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import {
  Bell, Briefcase, CheckCircle, Clock, Euro, Star,
  ChevronRight, AlertTriangle, FileText, Upload, Sparkles,
} from 'lucide-react'
import { clsx } from 'clsx'

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

// Per-grant contextual info for the portal cards
type TipoPlantilla = 'digitalizacion' | 'formacion' | 'general' | 'energia_calor' | 'energia_fv'

const GRANT_CONTEXT: Record<string, {
  necesidad: string
  subvencionable: string[]
  noSubvencionable: string[]
  docsRequeridos: string[]
  tipoPlantilla: TipoPlantilla
}> = {
  '731245': {
    necesidad: 'Digitalización del sistema de gestión de stock y punto de venta. Incluye formación al personal.',
    subvencionable: ['Software de gestión', 'Hardware asociado', 'Formación hasta 40h'],
    noSubvencionable: ['Mantenimiento posterior', 'Servicios no tecnológicos'],
    docsRequeridos: [
      'Presupuesto detallado por partidas (obligatorio)',
      'Declaración responsable capacidad técnica',
      'Certificado estar al corriente pagos SS',
    ],
    tipoPlantilla: 'digitalizacion' as TipoPlantilla,
  },
  '731890': {
    necesidad: 'Implementación de soluciones digitales: presencia en internet, gestión de clientes (CRM) y factura electrónica.',
    subvencionable: ['Software/SaaS con licencia mínima 12 meses', 'Página web + SEO básico', 'Formación incluida en solución'],
    noSubvencionable: ['Hardware no asociado a la solución', 'Consultoría estratégica', 'Desarrollo a medida no certificado'],
    docsRequeridos: [
      'Propuesta técnica con soluciones certificadas AceleraPyme',
      'Presupuesto desglosado por solución digital',
      'Acreditación como Agente Digitalizador',
    ],
    tipoPlantilla: 'digitalizacion' as TipoPlantilla,
  },

  '893737': {
    necesidad: 'Sustitución del sistema de climatización por bomba de calor aerotérmica de alta eficiencia (SCOP ≥ 3,5). Requiere memoria técnica justificativa INEGA con tabla mensual de ahorro energético (kWh/año) y reducción CO₂.',
    subvencionable: [
      'Bomba de calor aerotérmica de alta eficiencia (SCOP ≥ 3,5)',
      'Instalación y puesta en marcha certificada',
      'Proyecto técnico e ingeniería (visado colegial)',
    ],
    noSubvencionable: [
      'IVA (salvo entidades exentas)',
      'Gastos de mantenimiento posterior',
      'Obras civiles no vinculadas al equipo',
    ],
    docsRequeridos: [
      'Memoria técnica justificativa INEGA (obligatorio)',
      'Tabla mensual ahorro kWh/año + reducción kg CO₂/año',
      'Ficha técnica del equipo (fabricante)',
      'Presupuesto detallado por partidas (firmado)',
      'Informe técnico visado por técnico competente',
    ],
    tipoPlantilla: 'energia_calor' as TipoPlantilla,
  },
  '894201': {
    necesidad: 'Ampliación de instalación fotovoltaica de autoconsumo (≤100 kWp). Requiere proyecto técnico completo visado por ingeniero colegiado: memoria, cálculos, planos, fichas técnicas, plan de seguridad.',
    subvencionable: [
      'Módulos fotovoltaicos y estructura de soporte',
      'Inversor y protecciones CC/CA',
      'Cableado DC/AC y equipos de medida',
      'Proyecto técnico completo visado',
    ],
    noSubvencionable: [
      'Baterías de almacenamiento (línea diferente)',
      'IVA (salvo entidades exentas)',
      'Tasas de tramitación administrativa',
    ],
    docsRequeridos: [
      'Proyecto técnico visado: memoria + cálculos + planos (obligatorio)',
      'Fichas técnicas de módulos FV e inversor',
      'Plan de seguridad y salud (obligatorio)',
      'Presupuesto detallado por partidas (firmado)',
      'Estimación de producción anual (kWh/año)',
    ],
    tipoPlantilla: 'energia_fv' as TipoPlantilla,
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
    tipoPlantilla: 'general' as TipoPlantilla,
  }
}

const HARDCODED_IDS = new Set(['731245', '731890', '893737', '894201'])

export function PortalProveedor() {
  const navigate = useNavigate()
  const { presupuestos, expedientes, convocatorias, clientes } = useAppStore()

  // Filter presupuestos for this provider
  const misSolicitudes = presupuestos.filter(
    (p) => p.proveedorCif === mockProveedor.cif
  )
  const pendientes = misSolicitudes.filter((p) => p.estado === 'pendiente')
  const enviados = misSolicitudes.filter((p) => p.estado === 'recibido')
  const enCurso = misSolicitudes.filter((p) => p.estado === 'seleccionado')
  const importeTotal = enCurso.reduce((acc, p) => acc + (p.importe ?? 0), 0)

  return (
    <div className="min-h-screen bg-indigo-50/40">
      {/* Header */}
      <header className="bg-indigo-700 text-white px-6 py-4 shadow-lg">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center font-bold text-sm">
              SD
            </div>
            <div>
              <p className="font-semibold text-base leading-tight">Portal Proveedor</p>
              <p className="text-indigo-200 text-xs">Bienvenido, {mockProveedor.contacto}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 text-indigo-200 text-xs">
              <Star size={13} className="fill-yellow-300 text-yellow-300" />
              <span className="text-white font-medium">{mockProveedor.valoracion}</span>
              <span>/ 5.0</span>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium">{mockProveedor.nombre}</p>
              <p className="text-indigo-200 text-xs">{mockProveedor.zona}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Stats row */}
        <div className="grid grid-cols-4 gap-4">
          {[
            {
              label: 'Solicitudes pendientes',
              value: pendientes.length,
              icon: Bell,
              color: 'text-amber-600',
              bg: 'bg-amber-50',
              border: 'border-amber-200',
            },
            {
              label: 'Presupuestos enviados',
              value: enviados.length,
              icon: FileText,
              color: 'text-indigo-600',
              bg: 'bg-indigo-50',
              border: 'border-indigo-200',
            },
            {
              label: 'Trabajos en curso',
              value: enCurso.length,
              icon: Briefcase,
              color: 'text-emerald-600',
              bg: 'bg-emerald-50',
              border: 'border-emerald-200',
            },
            {
              label: 'Importe total contratado',
              value: fmt(importeTotal),
              icon: Euro,
              color: 'text-blue-600',
              bg: 'bg-blue-50',
              border: 'border-blue-200',
            },
          ].map(({ label, value, icon: Icon, color, bg, border }) => (
            <Card key={label} className={clsx('p-4 border', border, bg)}>
              <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center mb-3', bg, 'border', border)}>
                <Icon size={16} className={color} />
              </div>
              <p className="text-2xl font-bold text-slate-900">{value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </Card>
          ))}
        </div>

        {/* Pending requests */}
        <section>
          <h2 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Bell size={16} className="text-amber-500" />
            Solicitudes de presupuesto pendientes
            {pendientes.length > 0 && (
              <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {pendientes.length}
              </span>
            )}
          </h2>

          {pendientes.length === 0 ? (
            <Card className="p-8 text-center text-slate-400">
              <CheckCircle size={32} className="mx-auto mb-2 text-slate-300" />
              <p className="text-sm">No hay solicitudes pendientes en este momento.</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {[...pendientes].sort((a, b) => {
                const deadlineA = new Date(a.fechaSolicitud); deadlineA.setDate(deadlineA.getDate() + 5)
                const deadlineB = new Date(b.fechaSolicitud); deadlineB.setDate(deadlineB.getDate() + 5)
                return diasHasta(deadlineA) - diasHasta(deadlineB)
              }).map((pres, index) => {
                const expediente = expedientes.find((e) => e.id === pres.expedienteId)
                if (!expediente) return null
                const convocatoria = convocatorias.find((c) => c.idBdns === expediente.convocatoriaId)
                const cliente = clientes.find((c) => c.id === expediente.clienteId)
                const ctx = getGrantContext(expediente.convocatoriaId)

                // Deadline: 5 days from solicitud
                const deadline = new Date(pres.fechaSolicitud)
                deadline.setDate(deadline.getDate() + 5)
                const dias = diasHasta(deadline)

                return (
                  <Card key={pres.id} className="border border-amber-200 bg-white overflow-hidden">
                    {/* Card header */}
                    <div className="flex items-center justify-between px-5 py-3 bg-amber-50 border-b border-amber-100">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                          <Bell size={11} />
                          NUEVA SOLICITUD
                        </span>
                        {/* C1 — badge MAS URGENTE en la primera */}
                        {index === 0 && pendientes.length > 1 && (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full animate-pulse">
                            🔴 MÁS URGENTE
                          </span>
                        )}
                        <AlertTriangle size={13} className={clsx(dias <= 2 ? 'text-red-500' : 'text-amber-500')} />
                        <span className={clsx('text-xs font-medium', dias <= 2 ? 'text-red-600' : 'text-amber-700')}>
                          Vence {dias <= 0 ? 'hoy' : `en ${dias} día${dias !== 1 ? 's' : ''}`}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-800">{cliente?.nombre}</p>
                        <p className="text-xs text-slate-500">{cliente?.comunidadAutonoma}</p>
                      </div>
                    </div>

                    <div className="px-5 py-4 grid grid-cols-2 gap-6">
                      {/* Left: grant & PYME info */}
                      <div className="space-y-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Subvención</p>
                            {convocatoria && !HARDCODED_IDS.has(convocatoria.idBdns) && (
                              <span className="flex items-center gap-1 text-xs font-medium text-violet-600 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded-full">
                                <Sparkles size={9} />
                                IA
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-semibold text-slate-800">{convocatoria?.nombre}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{convocatoria?.organismo}</p>
                          <div className="flex gap-4 mt-2">
                            <div>
                              <p className="text-xs text-slate-400">Importe máximo</p>
                              <p className="text-sm font-semibold text-emerald-600">{fmt(convocatoria?.importeMax ?? 0)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-400">Fecha límite ejecución</p>
                              <p className="text-sm font-medium text-slate-700">
                                {convocatoria ? fmtDate(convocatoria.fechaJustificacion) : '—'}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div>
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Qué necesita la PYME</p>
                          <p className="text-xs text-slate-700 leading-relaxed">{ctx.necesidad}</p>
                        </div>
                      </div>

                      {/* Right: eligible, docs */}
                      <div className="space-y-4">
                        <div>
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Lo que cubre la subvención</p>
                          <ul className="space-y-0.5">
                            {ctx.subvencionable.map((item) => (
                              <li key={item} className="flex items-center gap-1.5 text-xs text-slate-700">
                                <CheckCircle size={12} className="text-emerald-500 flex-shrink-0" />
                                {item}
                              </li>
                            ))}
                            {ctx.noSubvencionable.map((item) => (
                              <li key={item} className="flex items-center gap-1.5 text-xs text-slate-400">
                                <span className="w-3 h-3 flex-shrink-0 text-center leading-3 text-red-400 font-bold">✗</span>
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div>
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Documentos que debes aportar</p>
                          <ul className="space-y-0.5">
                            {ctx.docsRequeridos.map((doc) => (
                              <li key={doc} className="flex items-start gap-1.5 text-xs text-slate-700">
                                <span className="text-indigo-500 mt-px flex-shrink-0">•</span>
                                {doc}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="flex items-center gap-1 text-xs text-slate-500 border-t border-slate-100 pt-2">
                          <Clock size={11} />
                          <span>Plazo para responder: </span>
                          <span className={clsx('font-semibold', dias <= 2 ? 'text-red-600' : 'text-amber-700')}>
                            {dias <= 0 ? 'Hoy' : `${dias} días`} (antes del {fmtDate(deadline)})
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action footer */}
                    <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                      <button
                        onClick={() => {
                          const tipoPlantilla = ctx.tipoPlantilla
                          downloadPlantilla(tipoPlantilla, convocatoria?.nombre ?? 'subvencion')
                        }}
                        className="text-xs text-indigo-600 hover:text-indigo-800 underline flex items-center gap-1"
                      >
                        <FileText size={12} />
                        Descargar plantilla presupuesto
                      </button>
                      <Button
                        size="sm"
                        onClick={() => navigate(`/proveedor/solicitud/${pres.id}`)}
                        className="flex items-center gap-1.5"
                      >
                        Responder solicitud
                        <ChevronRight size={14} />
                      </Button>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </section>

        {/* Trabajos en curso */}
        <section>
          <h2 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Briefcase size={16} className="text-emerald-600" />
            Trabajos en curso
          </h2>

          {enCurso.length === 0 ? (
            <Card className="p-6 text-center text-slate-400 text-sm">
              No hay trabajos en curso actualmente.
            </Card>
          ) : (
            <Card className="divide-y divide-slate-100">
              {enCurso.map((pres) => {
                const expediente = expedientes.find((e) => e.id === pres.expedienteId)
                if (!expediente) return null
                const convocatoria = convocatorias.find((c) => c.idBdns === expediente.convocatoriaId)
                const cliente = clientes.find((c) => c.id === expediente.clienteId)
                const diasJustif = convocatoria ? diasHasta(convocatoria.fechaJustificacion) : 0
                const enJustificacion = expediente.estado === 'JUSTIFICACION'

                return (
                  <div key={pres.id} className="px-5 py-4 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold text-slate-800">{cliente?.nombre}</p>
                      <p className="text-xs text-slate-500">{convocatoria?.nombre}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={clsx(
                          'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium',
                          enJustificacion
                            ? 'bg-cyan-100 text-cyan-700'
                            : 'bg-emerald-100 text-emerald-700'
                        )}>
                          {enJustificacion ? 'Pendiente justificación' : 'En ejecución'}
                        </span>
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Clock size={11} />
                          Justif.: {diasJustif > 0 ? `${diasJustif} días` : 'Vencida'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-700">{fmt(pres.importe ?? 0)}</p>
                        <p className="text-xs text-slate-400">importe contratado</p>
                      </div>
                      {enJustificacion && (
                        <Button size="sm" variant="secondary" className="flex items-center gap-1.5 text-xs">
                          <Upload size={13} />
                          Subir documentación
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </Card>
          )}
        </section>

        {/* Historial */}
        <section>
          <h2 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Clock size={16} className="text-slate-500" />
            Historial
          </h2>
          <Card>
            <div className="px-5 py-3 border-b border-slate-100 grid grid-cols-4 gap-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">
              <span>Cliente</span>
              <span>Subvención</span>
              <span>Estado</span>
              <span>Importe</span>
            </div>
            {enviados.length === 0 && enCurso.length === 0 ? (
              <div className="px-5 py-6 text-center text-slate-400 text-sm">Sin historial disponible.</div>
            ) : (
              [...enviados, ...enCurso].map((pres) => {
                const expediente = expedientes.find((e) => e.id === pres.expedienteId)
                if (!expediente) return null
                const convocatoria = convocatorias.find((c) => c.idBdns === expediente.convocatoriaId)
                const cliente = clientes.find((c) => c.id === expediente.clienteId)
                return (
                  <div key={pres.id} className="px-5 py-3 grid grid-cols-4 gap-4 text-sm border-b border-slate-50 last:border-0">
                    <span className="text-slate-700 truncate">{cliente?.nombre}</span>
                    <span className="text-slate-500 truncate text-xs">{convocatoria?.nombre}</span>
                    <span>
                      {pres.estado === 'recibido' && (
                        <span className="inline-block bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium">Enviado</span>
                      )}
                      {pres.estado === 'seleccionado' && (
                        <span className="inline-block bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full font-medium">Seleccionado</span>
                      )}
                      {pres.estado === 'rechazado' && (
                        <span className="inline-block bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-medium">No seleccionado</span>
                      )}
                    </span>
                    <span className="text-slate-700 font-medium">
                      {pres.importe ? fmt(pres.importe) : '—'}
                    </span>
                  </div>
                )
              })
            )}
            <div className="px-5 py-4 border-t border-slate-100 bg-gradient-to-r from-emerald-50 to-white">
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                    <Star size={18} className="text-emerald-600 fill-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Tu tasa de éxito</p>
                    <p className="text-2xl font-bold text-emerald-600">{mockProveedor.tasaExito}%</p>
                  </div>
                </div>
                <div className="h-10 w-px bg-slate-200 hidden sm:block" />
                <div>
                  <p className="text-xs text-slate-500">Proyectos completados</p>
                  <p className="text-xl font-bold text-slate-800">{mockProveedor.expedientesCompletados}</p>
                </div>
                <div className="h-10 w-px bg-slate-200 hidden sm:block" />
                <div>
                  <p className="text-xs text-slate-500">Seleccionados de enviados</p>
                  <p className="text-sm font-semibold text-slate-700">
                    {enCurso.length} de {enCurso.length + enviados.length + misSolicitudes.filter((p) => p.estado === 'rechazado').length} solicitudes
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </section>
      </div>
    </div>
  )
}

// CSV download utility
function downloadPlantilla(tipo: TipoPlantilla, nombreSubvencion: string) {
  let csv = ''
  const header = 'Partida,Descripción,Unidades,Precio unitario,Total\n'

  if (tipo === 'digitalizacion') {
    csv = header +
      'Software,Licencia software gestión stock (1 año),,0,0\n' +
      'Hardware,Terminal POS + lector códigos,,0,0\n' +
      'Instalación,Configuración e instalación,,0,0\n' +
      'Formación,Formación usuarios (horas),,0,0\n'
  } else if (tipo === 'formacion') {
    csv = header +
      'Formación presencial,Horas de formación presencial,,0,0\n' +
      'Material didáctico,Materiales por alumno,,0,0\n' +
      'Certificación,Emisión certificados,,0,0\n'
  } else if (tipo === 'energia_calor') {
    csv = header +
      'Equipo,Bomba de calor aerotérmica (modelo + nº oferta),,0,0\n' +
      'Instalación hidráulica,Adaptación circuito hidráulico y conexiones,,0,0\n' +
      'Sistema eléctrico,Cuadro eléctrico y protecciones,,0,0\n' +
      'Ingeniería,Proyecto técnico y memoria justificativa INEGA,,0,0\n' +
      'Puesta en marcha,Configuración pruebas y certificación,,0,0\n'
  } else if (tipo === 'energia_fv') {
    csv = header +
      'Módulos FV,Paneles fotovoltaicos (ud × precio/panel),,0,0\n' +
      'Estructura soporte,Estructura de montaje coplanar/inclinada,,0,0\n' +
      'Inversor,Inversor trifásico + protecciones CC y CA,,0,0\n' +
      'Equipos de medida,Contador bidireccional y telegestión,,0,0\n' +
      'Protecciones eléctricas,Cuadro AC fusibles descargadores,,0,0\n' +
      'Cableado,Conductor DC y AC bandejas tubería protectora,,0,0\n' +
      'Instalación,Montaje conexionado y puesta en marcha,,0,0\n'
  } else {
    csv = header +
      'Servicio principal,Descripción detallada del servicio,,0,0\n' +
      'Materiales,Materiales y suministros necesarios,,0,0\n' +
      'Otros gastos,Otros gastos imputables,,0,0\n'
  }

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `plantilla_presupuesto_${nombreSubvencion.replace(/\s+/g, '_').slice(0, 30)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
