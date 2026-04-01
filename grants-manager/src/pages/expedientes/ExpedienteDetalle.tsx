import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Navbar } from '../../components/layout/Navbar'
import { Card } from '../../components/ui/Card'
import { EstadoBadge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { useAppStore } from '../../store'
import {
  ArrowLeft, FileText, MessageSquare, Clock, Upload,
  CheckCircle, XCircle, AlertTriangle, AlertCircle, ChevronRight, ChevronDown,
  Plus, DollarSign, Printer, Info, Sparkles,
} from 'lucide-react'
import { clsx } from 'clsx'
import { ESTADO_COLORS, ESTADO_LABELS, type EstadoExpediente, type Presupuesto } from '../../types'

const NOW = Date.now()
const VERIFIED_DATE = new Date(NOW).toLocaleDateString('es-ES')
const VALID_UNTIL = new Date(NOW + 90 * 24 * 60 * 60 * 1000).toLocaleDateString('es-ES')
let presupuestoCounter = NOW

const TODOS_ESTADOS: EstadoExpediente[] = [
  'DETECCION', 'EVALUACION', 'PREPARACION', 'PRESENTADA',
  'SUBSANACION', 'CONCEDIDA', 'JUSTIFICACION', 'CERRADA', 'DENEGADA',
]


const TIMELINE_LABELS: Record<string, string> = {
  DETECCION: 'Detección',
  EVALUACION: 'Evaluación',
  PREPARACION: 'Preparación',
  PRESENTADA: 'Presentada',
  SUBSANACION: 'Subsanación',
  EVALUACION_ADMIN: 'Eval. Admin',
  CONCEDIDA: 'Concedida',
  JUSTIFICACION: 'Justificación',
  COBRO: 'Cobro',
}

const TABS = ['Datos generales', 'Documentos', 'Presupuestos', 'Notas', 'Historial'] as const

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

// Phase-aware document checklist
const DOCS_POR_FASE: Record<string, string[]> = {
  DETECCION: ['CIF empresa', 'Memoria descriptiva del proyecto', 'Presupuesto estimado'],
  EVALUACION: [
    'Certificado Hacienda corriente de pago',
    'Certificado Seguridad Social',
    'Cuentas anuales últimos 2 años',
    '3 presupuestos de proveedores',
  ],
  PREPARACION: [
    'Formulario oficial cumplimentado',
    'Memoria técnica completa',
    'Presupuesto desglosado por partidas',
  ],
  PRESENTADA: ['Justificante de presentación', 'Número de registro asignado'],
  SUBSANACION: [
    'Responder requerimiento en 10 días hábiles',
    'Documentos solicitados por la administración',
  ],
  EVALUACION_ADMIN: [],
  CONCEDIDA: ['Aceptar resolución de concesión', 'Iniciar ejecución del proyecto'],
  JUSTIFICACION: [
    'Facturas definitivas (no proforma)',
    'Justificantes de pago (extracto bancario)',
    'Acta de recepción del proveedor',
    'Informe final de ejecución',
    'Fotografías si aplica',
  ],
  COBRO: ['Datos bancarios IBAN actualizados'],
}

// Calculate business days remaining (exclude weekends)
function diasHabilesRestantes(fecha: Date): number {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const objetivo = new Date(fecha)
  objetivo.setHours(0, 0, 0, 0)

  let count = 0
  const current = new Date(hoy)
  const direction = objetivo >= hoy ? 1 : -1

  while (current.getTime() !== objetivo.getTime()) {
    current.setDate(current.getDate() + direction)
    const day = current.getDay()
    if (day !== 0 && day !== 6) count++
  }

  return direction > 0 ? count : -count
}

export function ExpedienteDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const {
    expedientes, clientes, convocatorias, gestores,
    addHistorialEntry, updateExpedienteEstado, addNota,
    presupuestos, addPresupuesto, updatePresupuestoEstado, updatePresupuestoDetalles,
    showToast, toastMessage, clearToast,
  } = useAppStore()
  const [tab, setTab] = useState<typeof TABS[number]>('Datos generales')
  const [nota, setNota] = useState('')
  const [docFiltro, setDocFiltro] = useState<DocFiltro>('Todos') // D16
  const [showEstadoMenu, setShowEstadoMenu] = useState(false)
  const [showAddPresupuesto, setShowAddPresupuesto] = useState(false)
  const [showComplianceTooltip, setShowComplianceTooltip] = useState(false)
  const [generandoMemoria, setGenerandoMemoria] = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [newPresupuesto, setNewPresupuesto] = useState({
    proveedorNombre: '',
    proveedorCif: '',
    email: '',
    telefono: '',
    descripcion: '',
  })

  // Auto-dismiss toast after 3 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => clearToast(), 3000)
      return () => clearTimeout(timer)
    }
  }, [toastMessage, clearToast])

  const exp = expedientes.find((e) => e.id === id)
  if (!exp) return (
    <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
      Expediente no encontrado
    </div>
  )

  const cliente = clientes.find((c) => c.id === exp.clienteId)
  const conv = convocatorias.find((c) => c.idBdns === exp.convocatoriaId)
  const gestor = gestores.find((g) => g.id === exp.gestorId)
  const expPresupuestos = presupuestos.filter((p) => p.expedienteId === exp.id)

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

  // Phase checklist — check which required docs might already be uploaded
  const docsRequeridos = DOCS_POR_FASE[exp.estado] ?? []
  const docsNombres = exp.documentos.map((d) => (d.tipo + ' ' + d.nombreArchivo).toLowerCase())
  const docsCheck = docsRequeridos.map((req) => {
    const keywords = req.toLowerCase().split(' ').filter((w) => w.length > 3)
    const matched = keywords.some((kw) => docsNombres.some((dn) => dn.includes(kw))) &&
      exp.documentos.some((d) => d.estado === 'validado' || d.estado === 'subido')
    return { texto: req, ok: matched }
  })
  const docsListos = docsCheck.filter((d) => d.ok).length

  // Generar memoria técnica con IA — plantillas por tipo de convocatoria
  const handleGenerarMemoria = () => {
    if (generandoMemoria) return
    setGenerandoMemoria(true)
    const empresa = cliente?.nombre || 'La empresa'
    const convNombre = conv?.nombre || 'la convocatoria seleccionada'
    const nombre = convNombre.toLowerCase()

    setTimeout(() => {
      let memoria: string

      if (nombre.includes('i+d') || nombre.includes('cdti') || nombre.includes('investigación') || nombre.includes('innovacion') || nombre.includes('innovación')) {
        // Plantilla I+D / Innovación
        memoria = `MEMORIA TÉCNICA — PROYECTO DE I+D E INNOVACIÓN

1. DESCRIPCIÓN DEL PROYECTO
${empresa} propone un proyecto de investigación aplicada orientado al desarrollo de nuevas soluciones tecnológicas en su sector. El proyecto se enmarca en ${convNombre} y tiene como objetivo generar nuevo conocimiento transferible al mercado.

2. JUSTIFICACIÓN CIENTÍFICO-TÉCNICA
La empresa ha identificado un gap tecnológico en su cadena de valor que impide competir en igualdad de condiciones con empresas europeas del sector. El proyecto aborda este reto mediante metodología científica validada e incorporación de talento investigador.

3. OBJETIVOS DEL PROYECTO
- OBJ-1: Desarrollar prototipo funcional validado en entorno relevante (TRL 5→7)
- OBJ-2: Publicar al menos 1 resultado científico en revista indexada
- OBJ-3: Proteger los resultados mediante patente o modelo de utilidad
- OBJ-4: Incorporar 2 nuevos perfiles técnicos especializados

4. PLAN DE TRABAJO (18 MESES)
WP1 (M1–M4): Revisión del estado del arte y diseño experimental
WP2 (M3–M10): Desarrollo y pruebas del prototipo
WP3 (M8–M14): Validación en entorno real con cliente piloto
WP4 (M12–M18): Explotación de resultados y diseminación

5. PRESUPUESTO ESTIMADO
Personal investigador (2 FTE × 18 meses): 72.000€
Subcontratación laboratorio externo: 18.000€
Material fungible y equipamiento: 12.000€
Difusión y protección de resultados: 5.000€
Gastos indirectos (15%): 16.050€
TOTAL: 123.050€

6. IMPACTO ESPERADO
El proyecto incrementará el TRL de la tecnología de 4 a 7, facilitando su transferencia al mercado. Se prevé generar 2 nuevos productos comercializables en los 24 meses posteriores a la finalización.

⚠️ Este es un borrador generado por IA. Revísalo y personalízalo antes de presentar.`

      } else if (nombre.includes('feder') || nombre.includes('cohesión') || nombre.includes('inversion') || nombre.includes('inversión') || nombre.includes('modernizacion') || nombre.includes('modernización')) {
        // Plantilla FEDER / Inversión productiva
        memoria = `MEMORIA TÉCNICA — PROYECTO DE INVERSIÓN PRODUCTIVA

1. DESCRIPCIÓN DEL PROYECTO
${empresa} solicita cofinanciación FEDER para la modernización de sus instalaciones productivas y la incorporación de maquinaria de última generación. La inversión se enmarca en ${convNombre} y contribuye a los objetivos de competitividad regional.

2. SITUACIÓN ACTUAL Y NECESIDAD DE INVERSIÓN
Las instalaciones actuales tienen una antigüedad media de 12 años y generan un coste energético un 35% superior a la media sectorial. La nueva maquinaria permitirá reducir el consumo energético, aumentar la capacidad productiva y mejorar las condiciones de trabajo.

3. OBJETIVOS
- Aumentar la capacidad productiva en un 40%
- Reducir el consumo energético en un 30% (≈ 45 tCO₂/año evitadas)
- Reducir el coste de producción por unidad en un 20%
- Mantener y consolidar 12 puestos de trabajo directos

4. DESCRIPCIÓN DE LA INVERSIÓN
Línea de producción automatizada (CNC): 280.000€
Sistema de gestión energética (ISO 50001): 45.000€
Adecuación nave y obra civil: 35.000€
Ingeniería y puesta en marcha: 22.000€
TOTAL INVERSIÓN ELEGIBLE: 382.000€

5. PLAN DE EJECUCIÓN
Fase 1 (M1–M3): Licitación y adjudicación de proveedores
Fase 2 (M3–M8): Instalación y puesta en marcha de equipamiento
Fase 3 (M7–M10): Formación y optimización de producción
Fase 4 (M10–M12): Seguimiento y medición de indicadores

6. IMPACTO SOCIOECONÓMICO
La inversión permitirá incrementar la facturación estimada en 850.000€/año adicionales, consolidar el empleo existente y generar 3 nuevas contrataciones en perfiles técnicos especializados.

⚠️ Este es un borrador generado por IA. Revísalo y personalízalo antes de presentar.`

      } else if (nombre.includes('digital') || nombre.includes('kit digital') || nombre.includes('tic') || nombre.includes('transformacion') || nombre.includes('transformación')) {
        // Plantilla Digitalización
        memoria = `MEMORIA TÉCNICA — PROYECTO DE TRANSFORMACIÓN DIGITAL

1. DESCRIPCIÓN DEL PROYECTO
${empresa} solicita financiación para la digitalización integral de sus procesos de negocio mediante la implantación de un ecosistema tecnológico integrado. El proyecto se desarrolla en el marco de ${convNombre}.

2. DIAGNÓSTICO DIGITAL ACTUAL
La empresa opera actualmente con herramientas no integradas (hojas de cálculo, email, procesos manuales), lo que genera duplicidades de información, demoras en la toma de decisiones y limitada trazabilidad de operaciones. El índice DESI interno se estima en 28/100.

3. SOLUCIÓN TECNOLÓGICA PROPUESTA
- ERP cloud (módulos: ventas, compras, almacén, finanzas)
- CRM para gestión comercial y seguimiento de clientes
- Business Intelligence y cuadro de mando ejecutivo
- Firma electrónica y digitalización documental
- Ciberseguridad: EDR + backup offsite + formación

4. OBJETIVOS MEDIBLES
- Reducir tiempo de cierre contable mensual: de 5 días a 1 día
- Eliminar el 90% de procesos manuales en logística
- Aumentar conversión comercial en un 25% con CRM
- Alcanzar índice DESI interno de 72/100 al finalizar

5. PLAN DE IMPLANTACIÓN (6 MESES)
Mes 1: Análisis de procesos y selección de proveedor tecnológico
Mes 2–3: Implantación ERP y migración de datos históricos
Mes 3–4: Implantación CRM y módulo BI
Mes 5: Formación a todo el equipo (24 horas por persona)
Mes 6: Go-live, soporte intensivo y ajuste de indicadores

6. PRESUPUESTO
ERP cloud (3 años): 12.600€
CRM (3 años): 4.200€
BI y reporting: 3.800€
Ciberseguridad: 2.900€
Formación y consultoría: 4.500€
TOTAL ELEGIBLE: 28.000€

⚠️ Este es un borrador generado por IA. Revísalo y personalízalo antes de presentar.`

      } else {
        // Plantilla genérica (exportación, turismo, medioambiente, etc.)
        memoria = `MEMORIA TÉCNICA DEL PROYECTO

1. DESCRIPCIÓN DEL PROYECTO
${empresa} presenta su candidatura a ${convNombre} con un proyecto orientado a reforzar su posición competitiva, mejorar su capacidad operativa y contribuir a los objetivos de desarrollo económico del programa.

2. JUSTIFICACIÓN DE LA NECESIDAD
La empresa ha identificado áreas de mejora estructurales que requieren inversión externa para ser abordadas en tiempo y forma. Sin esta financiación, el proyecto se pospondría un mínimo de 3 años, con el consiguiente coste de oportunidad frente a competidores que ya han realizado estas inversiones.

3. OBJETIVOS DEL PROYECTO
- Objetivo 1: Incrementar la competitividad y eficiencia operativa en un 25%
- Objetivo 2: Abrir nuevos mercados o canales de distribución
- Objetivo 3: Mejorar la cualificación del equipo humano
- Objetivo 4: Reducir el impacto medioambiental de la actividad

4. PLAN DE EJECUCIÓN (12 MESES)
Fase 1 (M1–M3): Preparación, contratación y arranque
Fase 2 (M3–M8): Ejecución de acciones principales
Fase 3 (M8–M11): Validación y ajuste de resultados
Fase 4 (M11–M12): Cierre, justificación y evaluación de impacto

5. PRESUPUESTO ESTIMADO
Consultoría y servicios externos: 15.000€
Inversión en activos / equipamiento: 40.000€
Formación y capacitación: 8.000€
Gastos de gestión y administración: 5.000€
TOTAL ELEGIBLE: 68.000€

6. IMPACTO ESPERADO
El proyecto aportará un incremento de facturación estimado en 120.000€ en los 24 meses posteriores a su finalización, consolidando el empleo existente y creando al menos 2 nuevos puestos de trabajo cualificados.

⚠️ Este es un borrador generado por IA. Revísalo y personalízalo antes de presentar.`
      }

      addNota(exp.id, memoria, 'IA — Gemini (borrador)')
      setGenerandoMemoria(false)
      showToast('Borrador de memoria técnica generado y añadido a las notas')
    }, 2000)
  }

  // Subir documento — abre selector de archivos del sistema
  const handleSubirDocumento = () => {
    fileInputRef.current?.click()
  }

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingDoc(file.name)
    // Simular subida con delay
    setTimeout(() => {
      setUploadingDoc(null)
      showToast(`Documento "${file.name}" subido correctamente`)
      e.target.value = '' // reset para poder subir el mismo archivo otra vez
    }, 1500)
  }

  // D24 — registrar revisión
  const handleRegistrarRevision = () => {
    addHistorialEntry(exp.id, 'Revisado por Gestor', 'Gestor')
    showToast('Revisión registrada en el historial')
  }

  // E2 — registrar revisión externa (funcionario)
  const handleRegistrarRevisionExterna = () => {
    const now = new Date()
    const texto = `Revisión por administración — ${now.toLocaleDateString('es-ES')} ${now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`
    addHistorialEntry(exp.id, texto, 'Administración')
    showToast('Revisión externa registrada')
  }

  // E1 — imprimir vista funcionario
  const handlePrintFuncionario = () => {
    window.print()
  }

  // Estado change
  const handleCambioEstado = (nuevoEstado: EstadoExpediente) => {
    if (nuevoEstado !== exp.estado) {
      updateExpedienteEstado(exp.id, nuevoEstado, 'Laura Martínez')
      showToast(`Estado actualizado a "${ESTADO_LABELS[nuevoEstado]}"`)
    }
    setShowEstadoMenu(false)
  }

  // Añadir nota
  const handleAddNota = () => {
    if (!nota.trim()) return
    addNota(exp.id, nota.trim(), 'Laura Martínez')
    setNota('')
  }

  // Add presupuesto
  const handleAddPresupuesto = () => {
    if (!newPresupuesto.proveedorNombre.trim()) return
    addPresupuesto({
      id: `p${++presupuestoCounter}`,
      expedienteId: exp.id,
      proveedorNombre: newPresupuesto.proveedorNombre.trim(),
      proveedorCif: newPresupuesto.proveedorCif.trim(),
      email: newPresupuesto.email.trim() || undefined,
      telefono: newPresupuesto.telefono.trim() || undefined,
      descripcion: newPresupuesto.descripcion.trim() || undefined,
      estado: 'pendiente',
      fechaSolicitud: new Date(),
    })
    setNewPresupuesto({ proveedorNombre: '', proveedorCif: '', email: '', telefono: '', descripcion: '' })
    setShowAddPresupuesto(false)
  }

  // Subsanación: días hábiles
  const diasHabiles = exp.fechaSubsanacion ? diasHabilesRestantes(exp.fechaSubsanacion) : null

  // Presupuestos stats
  const presupuestosRecibidos = expPresupuestos.filter((p) => p.estado === 'recibido' || p.estado === 'seleccionado')
  const presupuestoSeleccionado = expPresupuestos.find((p) => p.estado === 'seleccionado')

  // Compliance
  const haciendaOk = cliente?.cumplimientoHacienda === 'ok'
  const ssOk = cliente?.cumplimientoSS === 'ok'

  return (
    <>
      {/* Toast notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 max-w-sm bg-slate-900 text-white text-sm px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in">
          <CheckCircle size={15} className="text-emerald-400 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
      <Navbar
        title={conv?.nombre ?? 'Expediente'}
        subtitle={cliente?.nombre}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintFuncionario}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors print:hidden"
              title="Vista funcionario — imprimir resumen limpio"
            >
              <Printer size={13} />
              Vista funcionario
            </button>
            <Button variant="secondary" size="sm" icon={<ArrowLeft size={14} />} onClick={() => navigate('/expedientes')}>
              Volver
            </Button>
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto">
        {/* C — SUBSANACIÓN BANNER */}
        {exp.estado === 'SUBSANACION' && (
          <div className="bg-red-50 border-b-2 border-red-400 px-6 py-4">
            <div className="flex items-start gap-3">
              <span className="text-xl flex-shrink-0">⚠️</span>
              <div className="flex-1">
                <p className="text-sm font-bold text-red-800">
                  SUBSANACIÓN ACTIVA — Tienes {diasHabiles !== null ? `${diasHabiles} días hábiles` : '10 días hábiles'} para responder
                </p>
                <p className="text-xs text-red-700 mt-1">
                  La administración ha detectado deficiencias en tu solicitud.
                  Revisa los documentos requeridos y sube las correcciones antes del{' '}
                  {exp.fechaSubsanacion
                    ? exp.fechaSubsanacion.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
                    : 'plazo indicado'}.
                </p>
              </div>
              <button
                onClick={() => setTab('Documentos')}
                className="text-xs font-semibold text-red-700 hover:text-red-900 whitespace-nowrap border border-red-300 rounded-lg px-3 py-1.5 hover:bg-red-100 transition-colors flex-shrink-0"
              >
                Ver qué falta →
              </button>
            </div>
          </div>
        )}

        {/* C04 — banner documentos pendientes */}
        {docsPendientes > 0 && exp.estado !== 'SUBSANACION' && (
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
            {/* D — Compliance pill with tooltip */}
            {cliente && (
              <div className="relative">
                <button
                  onClick={() => setShowComplianceTooltip((v) => !v)}
                  className={clsx(
                    'text-xs px-2 py-1 rounded font-medium flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity',
                    haciendaOk && ssOk
                      ? 'text-emerald-700 bg-emerald-50'
                      : 'text-orange-700 bg-orange-50'
                  )}
                >
                  {haciendaOk ? '✓ Hacienda OK' : '⚠️ Revisar Hacienda'}
                  {' · '}
                  {ssOk ? '✓ SS OK' : '⚠️ Revisar SS'}
                  <Info size={11} className="ml-0.5" />
                </button>
                {showComplianceTooltip && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowComplianceTooltip(false)} />
                    <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 p-3 min-w-64 text-xs space-y-2">
                      <p className="font-semibold text-slate-800 text-xs">Cumplimiento fiscal</p>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-600">Hacienda (AEAT)</span>
                          <span className={clsx('font-medium', haciendaOk ? 'text-emerald-600' : 'text-orange-600')}>
                            {haciendaOk ? 'Verificado ✓' : 'Revisar ⚠️'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-600">Seguridad Social</span>
                          <span className={clsx('font-medium', ssOk ? 'text-emerald-600' : 'text-orange-600')}>
                            {ssOk ? 'Verificado ✓' : 'Revisar ⚠️'}
                          </span>
                        </div>
                      </div>
                      <p className="text-slate-400 text-xs border-t border-slate-100 pt-2">
                        Verificado el {VERIFIED_DATE} · Válido hasta {VALID_UNTIL}
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* A2 — Financial summary strip (always visible above tabs) */}
          <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-1.5">
              <DollarSign size={13} className="text-slate-400" />
              <span className="text-xs text-slate-500">Solicitado:</span>
              <span className="text-xs font-bold text-slate-900">{formatEur(exp.importeSolicitado)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <DollarSign size={13} className={exp.importeConcedido > 0 ? 'text-emerald-500' : 'text-slate-300'} />
              <span className="text-xs text-slate-500">Concedido:</span>
              <span className={clsx('text-xs font-bold', exp.importeConcedido > 0 ? 'text-emerald-600' : 'text-slate-400')}>
                {exp.importeConcedido > 0 ? formatEur(exp.importeConcedido) : 'Pendiente de resolución'}
              </span>
            </div>
            {exp.importeConcedido > 0 && (
              <div className="flex items-center gap-1.5">
                <DollarSign size={13} className="text-blue-400" />
                <span className="text-xs text-slate-500">Comisión gestión (15%):</span>
                <span className="text-xs font-bold text-blue-600">{formatEur(Math.max(300, exp.importeConcedido * 0.15))}</span>
              </div>
            )}
            {/* A3 — Next action indicator */}
            <div className="ml-auto flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-1.5">
              <ChevronRight size={13} className="text-blue-500 flex-shrink-0" />
              <span className="text-xs text-blue-700 font-medium">
                {exp.estado === 'DETECCION' && 'Siguiente: Analizar viabilidad y confirmar con el cliente'}
                {exp.estado === 'EVALUACION' && 'Siguiente: Recopilar documentación inicial'}
                {exp.estado === 'PREPARACION' && 'Siguiente: Completar y revisar toda la documentación'}
                {exp.estado === 'PRESENTADA' && 'Siguiente: Esperar resolución de la administración'}
                {exp.estado === 'SUBSANACION' && 'Acción urgente: Subir documentos corregidos antes del plazo'}
                {exp.estado === 'CONCEDIDA' && 'Siguiente: Aceptar la resolución e iniciar ejecución'}
                {exp.estado === 'JUSTIFICACION' && 'Siguiente: Presentar facturas y justificantes de gasto'}
                {exp.estado === 'CERRADA' && 'Expediente finalizado correctamente'}
                {exp.estado === 'DENEGADA' && 'Revisar alternativas de subvención para este cliente'}
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white border-b border-slate-100 px-6">
          <div className="flex">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={clsx(
                  'inline-flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                  tab === t
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                )}
              >
                {t}
                {t === 'Presupuestos' && expPresupuestos.length > 0 && (
                  <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">
                    {expPresupuestos.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          <div className="max-w-4xl mx-auto">

            {tab === 'Datos generales' && (
              <div className="space-y-5">
                {/* E — Timeline stepper */}
                <Card padding="md">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Progreso del expediente</h3>
                  <PhaseTimeline currentEstado={exp.estado} />
                </Card>

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
              <div className="space-y-4">
                {/* B — Phase-aware document checklist */}
                {docsRequeridos.length > 0 && (
                  <Card padding="md">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-slate-900">Documentos requeridos en esta fase</h3>
                      <span className={clsx(
                        'text-xs font-medium px-2 py-0.5 rounded-full',
                        docsListos === docsRequeridos.length
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-orange-100 text-orange-700'
                      )}>
                        {docsListos}/{docsRequeridos.length} documentos clave listos
                      </span>
                    </div>
                    <ul className="space-y-2">
                      {docsCheck.map(({ texto, ok }, i) => (
                        <li key={i} className="flex items-center gap-2.5">
                          <div className={clsx(
                            'w-4 h-4 rounded flex items-center justify-center flex-shrink-0',
                            ok ? 'bg-emerald-500' : 'bg-slate-200'
                          )}>
                            {ok && <CheckCircle size={11} className="text-white" />}
                          </div>
                          <span className={clsx('text-xs', ok ? 'text-slate-600 line-through' : 'text-slate-800')}>
                            {texto}
                          </span>
                          {!ok && (
                            <span className="text-xs text-orange-500 font-medium ml-auto">Pendiente</span>
                          )}
                        </li>
                      ))}
                    </ul>
                    {exp.estado === 'SUBSANACION' && (
                      <div className="mt-3 pt-3 border-t border-red-100 bg-red-50 -mx-4 -mb-4 px-4 pb-4 rounded-b-xl">
                        <p className="text-xs text-red-700 font-medium">
                          ⚠️ Tienes {diasHabiles !== null ? `${diasHabiles} días hábiles` : 'plazo limitado'} para responder. Sube los documentos corregidos.
                        </p>
                      </div>
                    )}
                  </Card>
                )}

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
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.png"
                      onChange={handleFileSelected}
                    />
                    <Button
                      size="sm"
                      icon={uploadingDoc ? <Clock size={14} className="animate-spin" /> : <Upload size={14} />}
                      onClick={handleSubirDocumento}
                      disabled={!!uploadingDoc}
                    >
                      {uploadingDoc ? 'Subiendo...' : 'Subir documento'}
                    </Button>
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
              </div>
            )}

            {tab === 'Presupuestos' && (
              <PresupuestosTab
                presupuestos={expPresupuestos}
                presupuestosRecibidos={presupuestosRecibidos}
                presupuestoSeleccionado={presupuestoSeleccionado}
                showAddPresupuesto={showAddPresupuesto}
                setShowAddPresupuesto={setShowAddPresupuesto}
                newPresupuesto={newPresupuesto}
                setNewPresupuesto={setNewPresupuesto}
                handleAddPresupuesto={handleAddPresupuesto}
                updatePresupuestoEstado={updatePresupuestoEstado}
                updatePresupuestoDetalles={updatePresupuestoDetalles}
                formatEur={formatEur}
              />
            )}

            {tab === 'Notas' && (
              <div className="space-y-4">
                {/* Generar memoria técnica con IA */}
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                      <Sparkles size={15} className="text-blue-600" />
                      Generar borrador de memoria técnica con IA
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Genera un borrador personalizado para {cliente?.nombre || 'este cliente'} basado en la convocatoria.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleGenerarMemoria}
                    disabled={generandoMemoria}
                    icon={generandoMemoria ? <Clock size={13} className="animate-spin" /> : <Sparkles size={13} />}
                    className="flex-shrink-0"
                  >
                    {generandoMemoria ? 'Generando...' : 'Generar memoria'}
                  </Button>
                </div>

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
                            {n.autor.includes('IA') || n.autor.includes('Gemini') ? (
                              <pre className="text-sm !text-slate-700 leading-relaxed whitespace-pre-wrap font-sans m-0 [&_*]:!text-slate-700">{n.texto}</pre>
                            ) : (
                              <p className="text-sm text-slate-700 leading-relaxed">{n.texto}</p>
                            )}
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
                {/* D24 — botones de registro */}
                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
                  <button
                    onClick={handleRegistrarRevisionExterna}
                    className="text-xs text-indigo-600 hover:text-indigo-900 font-medium border border-indigo-200 rounded-lg px-3 py-1.5 hover:bg-indigo-50 transition-colors flex items-center gap-1.5"
                  >
                    <Info size={12} />
                    Registrar revisión externa (Administración)
                  </button>
                  <button
                    onClick={handleRegistrarRevision}
                    className="text-xs text-slate-500 hover:text-slate-900 font-medium border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors"
                  >
                    Registrar revisión interna
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

// ===== E — Phase Timeline Component =====
function PhaseTimeline({ currentEstado }: { currentEstado: EstadoExpediente }) {
  const phases: EstadoExpediente[] = [
    'DETECCION', 'EVALUACION', 'PREPARACION', 'PRESENTADA',
    'CONCEDIDA', 'JUSTIFICACION',
  ]

  // Map SUBSANACION as overlapping PRESENTADA
  const subsanacionActive = currentEstado === 'SUBSANACION'
  const effectiveEstado = subsanacionActive ? 'PRESENTADA' : currentEstado

  const currentIdx = phases.indexOf(effectiveEstado)
  const isDenegada = currentEstado === 'DENEGADA'
  const isCerrada = currentEstado === 'CERRADA'

  return (
    <div className="w-full">
      {(isDenegada || isCerrada) && (
        <div className={clsx(
          'mb-3 px-3 py-2 rounded-lg text-xs font-medium',
          isDenegada ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'
        )}>
          {isDenegada ? '✗ Solicitud denegada' : '✓ Expediente cerrado'}
        </div>
      )}
      <div className="flex items-start gap-0 overflow-x-auto pb-2">
        {phases.map((phase, idx) => {
          const isCompleted = idx < currentIdx
          const isCurrent = idx === currentIdx && !isDenegada && !isCerrada
          const isFuture = idx > currentIdx || isDenegada || isCerrada

          const color = ESTADO_COLORS[phase] ?? '#94A3B8'

          return (
            <div key={phase} className="flex items-start flex-1 min-w-0">
              <div className="flex flex-col items-center flex-1 min-w-0">
                {/* connector line before */}
                <div className="flex items-center w-full">
                  {idx > 0 && (
                    <div
                      className="h-0.5 flex-1"
                      style={{ backgroundColor: isCompleted || isCurrent ? color : '#E2E8F0' }}
                    />
                  )}
                  {/* dot */}
                  <div
                    className={clsx(
                      'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-all',
                      isCompleted ? 'border-transparent' :
                      isCurrent ? 'border-transparent shadow-md' :
                      'border-slate-200 bg-white'
                    )}
                    style={{
                      backgroundColor: isCompleted ? color : isCurrent ? color : undefined,
                    }}
                  >
                    {isCompleted && <CheckCircle size={14} className="text-white" />}
                    {isCurrent && (
                      subsanacionActive && phase === 'PRESENTADA'
                        ? <span className="text-white text-xs font-bold">!</span>
                        : <div className="w-2.5 h-2.5 rounded-full bg-white" />
                    )}
                    {isFuture && <div className="w-2 h-2 rounded-full bg-slate-300" />}
                  </div>
                  {/* connector line after */}
                  {idx < phases.length - 1 && (
                    <div
                      className="h-0.5 flex-1"
                      style={{ backgroundColor: isCompleted ? color : '#E2E8F0' }}
                    />
                  )}
                </div>
                {/* label */}
                <p
                  className={clsx(
                    'text-center mt-1.5 px-0.5',
                    'text-xs leading-tight',
                    isCurrent ? 'font-semibold text-slate-900' :
                    isCompleted ? 'text-slate-400' :
                    'text-slate-300'
                  )}
                  style={{ fontSize: '10px', maxWidth: '64px' }}
                >
                  {TIMELINE_LABELS[phase]}
                  {subsanacionActive && phase === 'PRESENTADA' && (
                    <span className="block text-orange-500 font-bold" style={{ fontSize: '9px' }}>Subsanación</span>
                  )}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ===== A — Presupuestos Tab Component =====
interface PresupuestosTabProps {
  presupuestos: Presupuesto[]
  presupuestosRecibidos: Presupuesto[]
  presupuestoSeleccionado: Presupuesto | undefined
  showAddPresupuesto: boolean
  setShowAddPresupuesto: (v: boolean) => void
  newPresupuesto: { proveedorNombre: string; proveedorCif: string; email: string; telefono: string; descripcion: string }
  setNewPresupuesto: (v: { proveedorNombre: string; proveedorCif: string; email: string; telefono: string; descripcion: string }) => void
  handleAddPresupuesto: () => void
  updatePresupuestoEstado: (id: string, estado: Presupuesto['estado']) => void
  updatePresupuestoDetalles: (id: string, importe: number, plazoDias: number, notas: string) => void
  formatEur: (n: number) => string
}

function PresupuestosTab({
  presupuestos,
  presupuestosRecibidos,
  presupuestoSeleccionado,
  showAddPresupuesto,
  setShowAddPresupuesto,
  newPresupuesto,
  setNewPresupuesto,
  handleAddPresupuesto,
  updatePresupuestoEstado,
  updatePresupuestoDetalles,
  formatEur,
}: PresupuestosTabProps) {
  // Track which card is expanded for "marcar recibido" details form
  const [receivingId, setReceivingId] = useState<string | null>(null)
  const [receiveForm, setReceiveForm] = useState({ importe: '', plazoDias: '', notas: '' })

  const pendientes = presupuestos.filter((p) => p.estado === 'pendiente')
  const rechazados = presupuestos.filter((p) => p.estado === 'rechazado')

  // For comparison: sort received by price (cheapest first)
  const recibidosOrdenados = [...presupuestosRecibidos].sort((a, b) => {
    if (a.importe === undefined) return 1
    if (b.importe === undefined) return -1
    return a.importe - b.importe
  })
  const minImporte = recibidosOrdenados.find((p) => p.importe !== undefined)?.importe

  const inputCls = 'w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900/10'

  return (
    <div className="space-y-5">

      {/* ── Header: stats + action ── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="text-center px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-lg font-bold text-slate-800">{presupuestos.length}</p>
            <p className="text-xs text-slate-400">Solicitados</p>
          </div>
          <div className="text-center px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-lg font-bold text-blue-700">{presupuestosRecibidos.length}</p>
            <p className="text-xs text-blue-400">Recibidos</p>
          </div>
          <div className="text-center px-3 py-1.5 bg-orange-50 rounded-lg border border-orange-200">
            <p className="text-lg font-bold text-orange-600">{pendientes.length}</p>
            <p className="text-xs text-orange-400">Pendientes</p>
          </div>
          {presupuestoSeleccionado && (
            <div className="text-center px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-200">
              <p className="text-xs font-bold text-emerald-700 truncate max-w-28">{presupuestoSeleccionado.proveedorNombre}</p>
              <p className="text-xs text-emerald-400">Seleccionado</p>
            </div>
          )}
        </div>
        {!presupuestoSeleccionado && (
          <Button size="sm" onClick={() => setShowAddPresupuesto(true)} icon={<Plus size={13} />}>
            Solicitar presupuesto
          </Button>
        )}
      </div>

      {/* ── Compliance notice ── */}
      {!presupuestoSeleccionado && presupuestosRecibidos.length < 3 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
          <AlertCircle size={13} className="flex-shrink-0" />
          La mayoría de convocatorias exigen <strong className="mx-1">mínimo 3 presupuestos</strong> de proveedores distintos para justificar la elección.
          <span className="ml-auto font-semibold">{presupuestosRecibidos.length}/3 recibidos</span>
        </div>
      )}

      {/* ── Add presupuesto form ── */}
      {showAddPresupuesto && (
        <Card padding="md" className="border border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Plus size={14} className="text-slate-500" />
            Solicitar presupuesto a proveedor
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-slate-500 font-medium">Empresa proveedora *</label>
              <input type="text" className={clsx('mt-1', inputCls)} placeholder="Nombre empresa instaladora o consultora"
                value={newPresupuesto.proveedorNombre}
                onChange={(e) => setNewPresupuesto({ ...newPresupuesto, proveedorNombre: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">CIF / NIF</label>
              <input type="text" className={clsx('mt-1', inputCls)} placeholder="B12345678"
                value={newPresupuesto.proveedorCif}
                onChange={(e) => setNewPresupuesto({ ...newPresupuesto, proveedorCif: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">Teléfono de contacto</label>
              <input type="tel" className={clsx('mt-1', inputCls)} placeholder="600 000 000"
                value={newPresupuesto.telefono}
                onChange={(e) => setNewPresupuesto({ ...newPresupuesto, telefono: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-slate-500 font-medium">Email de contacto</label>
              <input type="email" className={clsx('mt-1', inputCls)} placeholder="comercial@empresa.es"
                value={newPresupuesto.email}
                onChange={(e) => setNewPresupuesto({ ...newPresupuesto, email: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-slate-500 font-medium">Descripción del trabajo a presupuestar</label>
              <textarea className={clsx('mt-1 resize-none', inputCls)} rows={2}
                placeholder="Describe el trabajo: tipo de instalación, superficie, potencia, modelo orientativo..."
                value={newPresupuesto.descripcion}
                onChange={(e) => setNewPresupuesto({ ...newPresupuesto, descripcion: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
            <Button variant="secondary" size="sm" onClick={() => setShowAddPresupuesto(false)}>Cancelar</Button>
            <Button size="sm" disabled={!newPresupuesto.proveedorNombre.trim()} onClick={handleAddPresupuesto}>
              Registrar solicitud
            </Button>
          </div>
        </Card>
      )}

      {/* ── Comparison table (≥2 received) ── */}
      {recibidosOrdenados.length >= 2 && (
        <div>
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-2">
            <DollarSign size={12} />
            Comparativa de presupuestos recibidos
          </h4>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Empresa</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500">Importe</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500">Plazo</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Notas</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recibidosOrdenados.map((p, idx) => {
                  const isCheapest = p.importe !== undefined && p.importe === minImporte && presupuestosRecibidos.filter(x => x.importe !== undefined).length > 1
                  const isSelected = p.estado === 'seleccionado'
                  return (
                    <tr key={p.id} className={clsx(
                      'transition-colors',
                      isSelected ? 'bg-emerald-50' : isCheapest ? 'bg-green-50/60' : 'bg-white hover:bg-slate-50'
                    )}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {idx === 0 && !isSelected && (
                            <span className="text-xs font-bold text-green-600 bg-green-100 px-1.5 py-0.5 rounded">↓ más bajo</span>
                          )}
                          {isSelected && (
                            <CheckCircle size={14} className="text-emerald-500 flex-shrink-0" />
                          )}
                          <div>
                            <p className="font-semibold text-slate-800">{p.proveedorNombre}</p>
                            {p.proveedorCif && <p className="text-xs text-slate-400 font-mono">{p.proveedorCif}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {p.importe !== undefined ? (
                          <span className={clsx('font-bold', isCheapest ? 'text-green-700 text-base' : 'text-slate-800')}>
                            {formatEur(p.importe)}
                          </span>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {p.plazoDias ? `${p.plazoDias} días` : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 max-w-40 truncate">{p.notas ?? '—'}</td>
                      <td className="px-4 py-3">
                        {!isSelected && !presupuestoSeleccionado && (
                          <button
                            onClick={() => updatePresupuestoEstado(p.id, 'seleccionado')}
                            className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 border border-emerald-200 rounded-lg px-2.5 py-1.5 hover:bg-emerald-50 transition-colors whitespace-nowrap"
                          >
                            Seleccionar
                          </button>
                        )}
                        {isSelected && (
                          <span className="text-xs font-semibold text-emerald-600">Seleccionado</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Pending list ── */}
      {pendientes.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Pendientes de respuesta</h4>
          <div className="space-y-2">
            {pendientes.map((p) => (
              <div key={p.id} className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-white">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-orange-600">{p.proveedorNombre.charAt(0)}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{p.proveedorNombre}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                        {p.proveedorCif && <span className="font-mono">{p.proveedorCif}</span>}
                        {p.email && <span>· {p.email}</span>}
                        {p.telefono && <span>· {p.telefono}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full font-medium">
                      Pendiente
                    </span>
                    <button
                      onClick={() => { setReceivingId(p.id === receivingId ? null : p.id); setReceiveForm({ importe: '', plazoDias: '', notas: '' }) }}
                      className="text-xs font-medium text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg px-2.5 py-1.5 hover:bg-blue-50 transition-colors"
                    >
                      Registrar recibido
                    </button>
                    <button
                      onClick={() => updatePresupuestoEstado(p.id, 'rechazado')}
                      className="text-xs text-slate-400 hover:text-red-500 transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Inline form to register received details */}
                {receivingId === p.id && (
                  <div className="px-4 py-3 bg-blue-50 border-t border-blue-100">
                    <p className="text-xs font-semibold text-blue-700 mb-2">Registrar datos del presupuesto recibido</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs text-slate-500">Importe total (€) *</label>
                        <input type="number" min="0" step="100" className={clsx('mt-1', inputCls)} placeholder="0"
                          value={receiveForm.importe}
                          onChange={(e) => setReceiveForm({ ...receiveForm, importe: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500">Plazo ejecución (días)</label>
                        <input type="number" min="1" className={clsx('mt-1', inputCls)} placeholder="30"
                          value={receiveForm.plazoDias}
                          onChange={(e) => setReceiveForm({ ...receiveForm, plazoDias: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500">Notas</label>
                        <input type="text" className={clsx('mt-1', inputCls)} placeholder="Observaciones..."
                          value={receiveForm.notas}
                          onChange={(e) => setReceiveForm({ ...receiveForm, notas: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-2">
                      <Button variant="secondary" size="sm" onClick={() => setReceivingId(null)}>Cancelar</Button>
                      <Button size="sm"
                        disabled={!receiveForm.importe || parseFloat(receiveForm.importe) <= 0}
                        onClick={() => {
                          updatePresupuestoDetalles(p.id, parseFloat(receiveForm.importe), parseInt(receiveForm.plazoDias) || 0, receiveForm.notas)
                          setReceivingId(null)
                        }}
                      >
                        Guardar
                      </Button>
                    </div>
                  </div>
                )}

                {p.descripcion && (
                  <div className="px-4 py-2 bg-slate-50 border-t border-slate-100">
                    <p className="text-xs text-slate-500">{p.descripcion}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Received (single, before comparison threshold) ── */}
      {recibidosOrdenados.length === 1 && (
        <div>
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Recibido</h4>
          {recibidosOrdenados.map((p) => (
            <Card key={p.id} padding="md" className={clsx('border', p.estado === 'seleccionado' ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200')}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    {p.estado === 'seleccionado' && <CheckCircle size={14} className="text-emerald-500" />}
                    <p className="text-sm font-semibold text-slate-800">{p.proveedorNombre}</p>
                    {p.importe !== undefined && (
                      <span className="text-base font-bold text-slate-900 ml-1">{formatEur(p.importe)}</span>
                    )}
                    {p.plazoDias && (
                      <span className="text-xs text-slate-500">· {p.plazoDias} días</span>
                    )}
                  </div>
                  {p.notas && <p className="text-xs text-slate-400">{p.notas}</p>}
                </div>
                {p.estado === 'recibido' && !presupuestoSeleccionado && (
                  <Button size="sm" onClick={() => updatePresupuestoEstado(p.id, 'seleccionado')}>
                    Seleccionar
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── Rejected ── */}
      {rechazados.length > 0 && (
        <details className="text-xs text-slate-400">
          <summary className="cursor-pointer hover:text-slate-600 select-none">
            {rechazados.length} descartado{rechazados.length !== 1 ? 's' : ''}
          </summary>
          <div className="mt-2 space-y-1">
            {rechazados.map((p) => (
              <div key={p.id} className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg">
                <span className="line-through text-slate-400">{p.proveedorNombre}</span>
                {p.importe !== undefined && <span>{formatEur(p.importe)}</span>}
              </div>
            ))}
          </div>
        </details>
      )}

      {/* ── Empty state ── */}
      {presupuestos.length === 0 && (
        <div className="text-center py-12 text-sm text-slate-400">
          No hay presupuestos solicitados aún. Usa el botón de arriba para solicitar el primero.
        </div>
      )}
    </div>
  )
}
