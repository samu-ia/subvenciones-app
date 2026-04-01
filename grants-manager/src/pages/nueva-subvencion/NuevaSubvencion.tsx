import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Navbar } from '../../components/layout/Navbar'
import { Button } from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/Input'
import { useAppStore } from '../../store'
import {
  Search, ChevronRight, CheckCircle, AlertTriangle, Sparkles,
  Building2, Calendar, Euro, ChevronDown, ChevronUp, User, Clock,
} from 'lucide-react'
import { clsx } from 'clsx'
import type { Expediente, Documento } from '../../types'

// ---- Types ----

interface BdnsConvocatoria {
  idBdns: string
  nombre: string
  organismo: string
  importeMax: number
  fechaCierre: string
  descripcion: string
}

interface AnalisisIA {
  resumen_ia: string
  para_quien: string
  puntos_clave: string[]
  documentos_requeridos: string[]
  gastos_elegibles: string[]
  gastos_no_elegibles: string[]
  plazo_ejecucion_meses: number
  porcentaje_subvencion: number
}

// ---- Mock BDNS results by sector ----

const MOCK_BDNS_RESULTS: Record<string, BdnsConvocatoria[]> = {
  default: [
    {
      idBdns: 'B-2026-00341',
      nombre: 'Ayudas a la digitalización de pymes del sector comercio minorista 2026',
      organismo: 'Ministerio de Industria y Turismo',
      importeMax: 12000,
      fechaCierre: '2026-05-31',
      descripcion: 'Subvenciones para digitalización de pymes mediante implantación de software de gestión, hardware y formación.',
    },
    {
      idBdns: 'B-2026-00298',
      nombre: 'Plan de modernización del comercio local — Convocatoria 2026',
      organismo: 'Cámara Oficial de Comercio',
      importeMax: 8000,
      fechaCierre: '2026-04-30',
      descripcion: 'Ayudas para modernización de establecimientos comerciales, mejora de imagen y digitalización.',
    },
    {
      idBdns: 'B-2026-00412',
      nombre: 'Incentivos Kit Digital — Segmento I (10-49 empleados) 2026',
      organismo: 'Red.es — Ministerio de Transformación Digital',
      importeMax: 25000,
      fechaCierre: '2026-06-15',
      descripcion: 'Digitalización de pymes mediante soluciones tecnológicas certificadas por el programa Kit Digital.',
    },
  ],
  hosteleria: [
    {
      idBdns: 'B-2026-00289',
      nombre: 'Ayudas a la modernización de establecimientos de hostelería 2026',
      organismo: 'Ministerio de Industria y Turismo',
      importeMax: 18000,
      fechaCierre: '2026-05-15',
      descripcion: 'Subvenciones para renovación de equipamientos, digitalización de reservas y mejora de eficiencia energética en hostelería.',
    },
    {
      idBdns: 'B-2026-00355',
      nombre: 'Plan de digitalización para el sector hostelero — 2026',
      organismo: 'Agencia de Promoción Turística',
      importeMax: 9500,
      fechaCierre: '2026-04-20',
      descripcion: 'Implantación de sistemas de gestión digital para hostelería: TPV, reservas online, gestión de turnos.',
    },
  ],
  industria: [
    {
      idBdns: 'B-2026-00201',
      nombre: 'Ayudas a la modernización industrial — Industria 4.0',
      organismo: 'Ministerio de Industria',
      importeMax: 150000,
      fechaCierre: '2026-06-30',
      descripcion: 'Financiación de proyectos de automatización, robótica y digitalización en el sector industrial.',
    },
    {
      idBdns: 'B-2026-00244',
      nombre: 'Subvenciones a la eficiencia energética en industria — IDAE 2026',
      organismo: 'IDAE',
      importeMax: 300000,
      fechaCierre: '2026-07-31',
      descripcion: 'Proyectos de mejora de eficiencia energética en el sector industrial.',
    },
  ],
  tecnologia: [
    {
      idBdns: 'B-2026-00102',
      nombre: 'Ayudas a proyectos de I+D empresarial — CDTI 2026',
      organismo: 'Centro para el Desarrollo Tecnológico Industrial (CDTI)',
      importeMax: 1500000,
      fechaCierre: '2026-08-30',
      descripcion: 'Financiación de proyectos de Investigación Industrial y Desarrollo Experimental en empresas tecnológicas.',
    },
    {
      idBdns: 'B-2026-00178',
      nombre: 'EIC Accelerator — Horizon Europe 2026',
      organismo: 'Comisión Europea — EIC',
      importeMax: 2500000,
      fechaCierre: '2026-10-01',
      descripcion: 'Financiación europea para start-ups y pymes con tecnologías disruptivas de alto impacto.',
    },
  ],
  agricultura: [
    {
      idBdns: 'B-2026-00389',
      nombre: 'Plan Renove Maquinaria Agrícola — MAPA 2026',
      organismo: 'Ministerio de Agricultura, Pesca y Alimentación',
      importeMax: 30000,
      fechaCierre: '2026-07-31',
      descripcion: 'Ayudas para renovación y modernización del parque de maquinaria agrícola.',
    },
  ],
  turismo: [
    {
      idBdns: 'B-2026-00322',
      nombre: 'Ayudas al turismo rural sostenible 2026',
      organismo: 'Ministerio de Industria y Turismo',
      importeMax: 50000,
      fechaCierre: '2026-05-31',
      descripcion: 'Financiación de proyectos de turismo rural con enfoque de sostenibilidad y digitalización.',
    },
  ],
}

// ---- Mock Gemini analysis by type ----

function generateAnalysis(conv: BdnsConvocatoria): AnalisisIA {
  const nombre = conv.nombre.toLowerCase()

  if (nombre.includes('hostel') || nombre.includes('turism')) {
    return {
      resumen_ia: `Ayuda para la modernización y digitalización de establecimientos de hostelería y turismo. Financia sistemas de gestión de reservas, digitalización de procesos, mejora de equipamiento y formación del personal. El solicitante debe ser una pyme o autónomo del sector con actividad ininterrumpida mínima de 2 años.`,
      para_quien: 'Pymes y autónomos del sector hostelería y turismo con mínimo 2 años de actividad y entre 1 y 49 trabajadores',
      puntos_clave: [
        `Importe máximo: ${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(conv.importeMax)} por establecimiento`,
        'Subvenciona hasta el 70% del coste elegible',
        `Plazo de solicitud: hasta ${new Date(conv.fechaCierre).toLocaleDateString('es-ES')}`,
        'Requiere 3 presupuestos comparativos para gastos > 3.000€',
        'Justificación en 9 meses tras resolución de concesión',
        'Compatible con otras ayudas siempre que no superen el coste total del proyecto',
      ],
      documentos_requeridos: [
        'Formulario de solicitud oficial',
        'Certificado corriente pago Hacienda',
        'Certificado corriente pago Seguridad Social',
        'Cuentas anuales últimos 2 ejercicios',
        'Memoria técnica del proyecto',
        'Presupuesto económico desglosado',
        '3 presupuestos de proveedor (si coste > 3.000€)',
        'CIF y escrituras de constitución',
        'Alta en el IAE del sector hostelería',
      ],
      gastos_elegibles: ['Sistemas de gestión de reservas', 'TPV digital', 'Equipamiento de cocina eficiente', 'Formación hasta 40h', 'Web y marketing digital'],
      gastos_no_elegibles: ['IVA recuperable', 'Gastos financieros', 'Terrenos y obras estructurales', 'Gastos de personal ordinario'],
      plazo_ejecucion_meses: 9,
      porcentaje_subvencion: 70,
    }
  }

  if (nombre.includes('industri') || nombre.includes('idae') || nombre.includes('energi')) {
    return {
      resumen_ia: `Financiación de proyectos de modernización industrial, automatización y eficiencia energética. Destinada a empresas del sector industrial con proyectos de inversión que generen o mantengan empleo. La inversión mínima elegible es de 50.000€.`,
      para_quien: 'Pymes y grandes empresas industriales con proyectos de inversión productiva o eficiencia energética',
      puntos_clave: [
        `Importe máximo: ${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(conv.importeMax)}`,
        'Subvenciona entre el 25% y el 55% según tamaño empresarial',
        'Inversión mínima elegible: 50.000€',
        `Plazo de solicitud: hasta ${new Date(conv.fechaCierre).toLocaleDateString('es-ES')}`,
        'El proyecto debe mantener o crear empleo',
        'Justificación en 18 meses tras concesión',
      ],
      documentos_requeridos: [
        'Formulario de solicitud',
        'Memoria técnica del proyecto',
        'Plan de inversiones detallado',
        'Estudio de viabilidad económica',
        'Cuentas anuales auditadas (3 años)',
        'Certificado Hacienda y SS',
        'Informe de empleados (TC2)',
        'Licencia de actividad',
        'Presupuestos de proveedores',
      ],
      gastos_elegibles: ['Maquinaria industrial', 'Automatización y robótica', 'Sistemas de control eficiencia energética', 'Software industrial', 'Ingeniería del proyecto'],
      gastos_no_elegibles: ['Terrenos', 'Edificios ya construidos', 'IVA', 'Gastos de constitución', 'Material fungible'],
      plazo_ejecucion_meses: 18,
      porcentaje_subvencion: 40,
    }
  }

  if (nombre.includes('i+d') || nombre.includes('cdti') || nombre.includes('horizont') || nombre.includes('eic')) {
    return {
      resumen_ia: `Financiación de proyectos de Investigación y Desarrollo Empresarial. Destinada a pymes y start-ups con proyectos tecnológicos innovadores de alto impacto. Requiere colaboración con centros de investigación o universidades.`,
      para_quien: 'Start-ups y pymes innovadoras con proyectos de I+D tecnológico y potencial de escalabilidad internacional',
      puntos_clave: [
        `Importe máximo: ${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(conv.importeMax)}`,
        'Subvenciona hasta el 70% (pymes) / 50% (grandes empresas)',
        'Presupuesto mínimo del proyecto: 175.000€',
        `Plazo de solicitud: hasta ${new Date(conv.fechaCierre).toLocaleDateString('es-ES')}`,
        'Evaluación científico-técnica obligatoria',
        'Justificación técnica y económica por hitos anuales',
      ],
      documentos_requeridos: [
        'Memoria científico-técnica del proyecto',
        'Plan de explotación comercial',
        'CVs del equipo investigador',
        'Acuerdo de colaboración con entidad de investigación',
        'Presupuesto detallado por partidas',
        'Cuentas anuales auditadas',
        'Certificado de no ser empresa en crisis',
        'Plan de negocio',
      ],
      gastos_elegibles: ['Personal investigador', 'Subcontratación de investigación', 'Material y equipos de investigación', 'Patentes y licencias', 'Gastos generales (20% overhead)'],
      gastos_no_elegibles: ['Gastos comerciales ordinarios', 'Marketing', 'Distribución', 'IVA', 'Activos no relacionados con I+D'],
      plazo_ejecucion_meses: 24,
      porcentaje_subvencion: 70,
    }
  }

  if (nombre.includes('agricultur') || nombre.includes('renove') || nombre.includes('mapa')) {
    return {
      resumen_ia: `Ayudas para la renovación y modernización del parque de maquinaria agrícola, promoviendo la adopción de equipos más eficientes y sostenibles. Requiere achatarrar la maquinaria antigua.`,
      para_quien: 'Agricultores profesionales, titulares de explotaciones agrícolas y comunidades de regantes',
      puntos_clave: [
        `Importe máximo: ${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(conv.importeMax)} por beneficiario`,
        'Subvenciona hasta el 30% del coste',
        'Obligatorio achatarrar maquinaria con más de 15 años',
        `Plazo de solicitud: hasta ${new Date(conv.fechaCierre).toLocaleDateString('es-ES')}`,
        'La maquinaria nueva debe ser de máxima eficiencia energética',
      ],
      documentos_requeridos: [
        'Solicitud oficial cumplimentada',
        'DNI/NIF del titular',
        'Inscripción en el Registro de Explotaciones Agrícolas',
        'Certificado de achatarrado de maquinaria antigua',
        'Factura pro-forma de la maquinaria nueva',
        'Declaración de la PAC último año',
        'Certificado Hacienda y SS',
      ],
      gastos_elegibles: ['Tractores nuevos categoría A o B', 'Maquinaria de recolección', 'Equipos de riego eficiente', 'Instalaciones de almacenamiento'],
      gastos_no_elegibles: ['Piezas de recambio', 'Mantenimiento', 'Maquinaria de segunda mano', 'IVA'],
      plazo_ejecucion_meses: 6,
      porcentaje_subvencion: 30,
    }
  }

  // Default: digitalización / comercio
  return {
    resumen_ia: `Ayuda para la digitalización de pymes del sector comercio minorista. Financia software de gestión, hardware asociado y formación. El solicitante debe tener entre 1 y 49 empleados y estar al corriente de pagos con Hacienda y SS.`,
    para_quien: 'Pymes y autónomos del comercio minorista con 1-49 empleados en activo',
    puntos_clave: [
      `Importe máximo: ${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(conv.importeMax)} por empresa`,
      'Subvenciona hasta el 80% del coste elegible',
      `Plazo de solicitud: hasta ${new Date(conv.fechaCierre).toLocaleDateString('es-ES')}`,
      'Requiere 3 presupuestos comparativos para gastos > 3.000€',
      'Justificación en 6 meses tras concesión',
    ],
    documentos_requeridos: [
      'Formulario de solicitud oficial',
      'Certificado corriente pago Hacienda',
      'Certificado corriente pago SS',
      'Cuentas anuales últimos 2 ejercicios',
      'Memoria técnica del proyecto',
      'Presupuesto económico desglosado',
      '3 presupuestos de proveedor (si coste > 3.000€)',
      'CIF y escrituras de constitución',
    ],
    gastos_elegibles: ['Software de gestión', 'Hardware asociado', 'Formación hasta 40h', 'Consultoría de implantación'],
    gastos_no_elegibles: ['Mantenimiento posterior', 'Gastos de desplazamiento', 'IVA recuperable'],
    plazo_ejecucion_meses: 6,
    porcentaje_subvencion: 80,
  }
}

// ---- Comunidades autónomas ----

const CCAA = [
  'Andalucía', 'Aragón', 'Asturias', 'Baleares', 'Canarias', 'Cantabria',
  'Castilla-La Mancha', 'Castilla y León', 'Cataluña', 'Extremadura',
  'Galicia', 'La Rioja', 'Madrid', 'Murcia', 'Navarra', 'País Vasco', 'Valencia',
]

const SECTORES = [
  'Hostelería', 'Industria', 'Comercio', 'Agricultura', 'Tecnología',
  'Construcción', 'Turismo', 'Otro',
]

// ---- Step indicator ----

function StepIndicator({ current }: { current: number }) {
  const steps = [
    { n: 1, label: 'Buscar convocatoria' },
    { n: 2, label: 'Analizar con IA' },
    { n: 3, label: 'Crear expediente' },
    { n: 4, label: 'Listo' },
  ]
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1">
            <div
              className={clsx(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all',
                s.n < current
                  ? 'bg-emerald-500 border-emerald-500 text-white'
                  : s.n === current
                  ? 'bg-slate-900 border-slate-900 text-white'
                  : 'bg-white border-slate-200 text-slate-400'
              )}
            >
              {s.n < current ? <CheckCircle size={16} /> : s.n}
            </div>
            <span className={clsx('text-xs font-medium whitespace-nowrap', s.n === current ? 'text-slate-900' : 'text-slate-400')}>
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={clsx('flex-1 h-0.5 mx-2 mb-4 rounded-full', s.n < current ? 'bg-emerald-400' : 'bg-slate-200')} />
          )}
        </div>
      ))}
    </div>
  )
}

// ---- Main component ----

export function NuevaSubvencion() {
  const navigate = useNavigate()
  const { clientes, gestores, addExpediente, convocatorias, showToast } = useAppStore()

  const [step, setStep] = useState(1)

  // Step 1
  const [keywords, setKeywords] = useState('')
  const [sector, setSector] = useState('')
  const [ccaa, setCcaa] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState(false)
  const [results, setResults] = useState<BdnsConvocatoria[]>([])
  const [selected, setSelected] = useState<BdnsConvocatoria | null>(null)

  // Step 2
  const [analysisStep, setAnalysisStep] = useState(0)
  const [analysis, setAnalysis] = useState<AnalisisIA | null>(null)
  const [showRoles, setShowRoles] = useState(false)

  // Step 3
  const [clienteId, setClienteId] = useState('')
  const [gestorId, setGestorId] = useState('g1')
  const [importe, setImporte] = useState('')
  const [fechaInicio, setFechaInicio] = useState('')
  const [notas, setNotas] = useState('')

  // Step 4
  const [newExpId, setNewExpId] = useState('')

  // Demo shortcut: expose state setter for testing
  if (typeof window !== 'undefined') {
    (window as any).__wizardDemo = () => {
      setSelected({ idBdns: '763201', nombre: 'Incentivos Kit Digital — Segmento I (10-49 empleados) 2026', organismo: 'Red.es — Ministerio de Transformación Digital', importeMax: 25000, fechaCierre: '2026-06-15', descripcion: 'Digitalización de pymes' })
      setAnalysis(generateAnalysis({ idBdns: '763201', nombre: 'Incentivos Kit Digital', organismo: 'Red.es', importeMax: 25000, fechaCierre: '2026-06-15', descripcion: 'Digitalización' }))
      setClienteId('c1')
      setImporte('18000')
      setNewExpId('exp_demo_' + Date.now())
      setStep(4)
    }
  }

  const formatEur = (n: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

  // ---- Step 1: BDNS search ----

  const handleSearch = async (overrideKeywords?: string) => {
    const effectiveKeywords = overrideKeywords ?? keywords
    if (!effectiveKeywords.trim() && !sector) {
      // Show all defaults when no input
    }
    setSearching(true)
    setSearchError(false)
    setResults([])
    setSelected(null)

    try {
      const query = encodeURIComponent(effectiveKeywords.trim() || sector)
      const url = `https://www.pap.hacienda.gob.es/bdnstrans/GE/es/convocatorias?tipo=C&estado=V&texto=${query}`
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
      if (!res.ok) throw new Error('BDNS error')
      // BDNS returns HTML — use mock fallback
      throw new Error('Use mock')
    } catch {
      setSearchError(true)
      // Fallback: use mock data (normalize accents for key lookup)
      const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      const kwNorm = normalize(effectiveKeywords)
      const secNorm = normalize(sector)
      const mockKey = Object.keys(MOCK_BDNS_RESULTS).find(k => kwNorm.includes(normalize(k)) || secNorm.includes(normalize(k))) || 'default'
      const mock = MOCK_BDNS_RESULTS[mockKey]
      // Also include matching from store convocatorias
      const fromStore: BdnsConvocatoria[] = convocatorias
        .filter((c) => {
          const q = (effectiveKeywords + ' ' + sector).toLowerCase()
          return c.nombre.toLowerCase().includes(q.split(' ')[0] || '') ||
            c.descripcion.toLowerCase().includes(q.split(' ')[0] || '')
        })
        .slice(0, 2)
        .map((c) => ({
          idBdns: c.idBdns,
          nombre: c.nombre,
          organismo: c.organismo,
          importeMax: c.importeMax,
          fechaCierre: c.fechaCierre.toISOString().slice(0, 10),
          descripcion: c.descripcion,
        }))
      setResults([...mock, ...fromStore].slice(0, 5))
    } finally {
      setSearching(false)
    }
  }

  // ---- Step 2: Gemini analysis ----

  useEffect(() => {
    if (step !== 2 || !selected) return
    setAnalysisStep(0)
    setAnalysis(null)

    const t1 = setTimeout(() => setAnalysisStep(1), 1000)
    const t2 = setTimeout(() => setAnalysisStep(2), 3000)
    const t3 = setTimeout(() => setAnalysisStep(3), 4500)
    const t4 = setTimeout(() => {
      setAnalysisStep(4)
      setAnalysis(generateAnalysis(selected))
    }, 5500)

    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4)
    }
  }, [step, selected])

  // ---- Step 3: Create expediente ----

  const selectedCliente = clientes.find((c) => c.id === clienteId)
  const clienteCumple = selectedCliente
    ? (selectedCliente.tamano === 'pyme' || selectedCliente.tamano === 'micropyme' || selectedCliente.tamano === 'autonomo')
    : null

  const handleCrear = () => {
    if (!clienteId || !importe || !selected || !analysis) return

    const expId = `exp-${Date.now()}`
    const numOficial = `EXP-2026-${String(Math.floor(Math.random() * 900) + 100)}`

    // Build documents from Gemini analysis
    const documentos: Documento[] = analysis.documentos_requeridos.map((nombre, i) => ({
      id: `doc-${Date.now()}-${i}`,
      expedienteId: expId,
      tipo: 'requerido',
      nombreArchivo: nombre,
      fechaSubida: new Date(),
      estado: 'pendiente' as const,
    }))

    const newExp: Expediente = {
      id: expId,
      clienteId,
      convocatoriaId: selected.idBdns,
      estado: 'DETECCION',
      fechaSolicitud: new Date(),
      numeroOficial: numOficial,
      importeSolicitado: parseInt(importe) || 0,
      importeConcedido: 0,
      gestorId: gestorId || 'g1',
      notas: notas.trim()
        ? [{ id: `n${Date.now()}`, texto: notas.trim(), fecha: new Date(), autor: 'Laura Martínez' }]
        : [],
      documentos,
      historial: [
        {
          id: `h${Date.now()}`,
          estadoAnterior: null,
          estadoNuevo: 'DETECCION',
          fecha: new Date(),
          usuario: 'Laura Martínez',
          comentario: 'Expediente creado desde el wizard Nueva Subvención',
        },
      ],
      fechaVencimiento: selected.fechaCierre ? new Date(selected.fechaCierre) : undefined,
    }

    // Add a convocatoria to store if not already there
    addExpediente(newExp)
    setNewExpId(expId)
    showToast(`Expediente ${numOficial} creado correctamente`)
    setStep(4)
  }

  const diasRestantes = selected?.fechaCierre
    ? Math.ceil((new Date(selected.fechaCierre).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  const ANALYSIS_STEPS = [
    { label: 'Descargando convocatoria...', done: analysisStep > 0 },
    { label: 'Leyendo el PDF con IA...', done: analysisStep > 1 },
    { label: 'Extrayendo requisitos...', done: analysisStep > 2 },
    { label: 'Análisis completado', done: analysisStep >= 4 },
  ]

  return (
    <>
      <Navbar
        title="Nueva subvención"
        subtitle="Wizard de creación de expediente"
      />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          <StepIndicator current={step} />

          {/* ================== PASO 1 ================== */}
          {step === 1 && (
            <div className="grid grid-cols-5 gap-6">
              {/* Left: search panel */}
              <div className="col-span-2 space-y-4">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                  <h2 className="text-base font-semibold text-slate-900 mb-1">Buscar una subvención</h2>
                  <p className="text-xs text-slate-500 mb-4">Busca en la Base de Datos Nacional de Subvenciones</p>

                  <div className="space-y-3">
                    <Input
                      placeholder="digitalización hostelería..."
                      value={keywords}
                      onChange={(e) => setKeywords(e.target.value)}
                      icon={<Search size={14} />}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <Select value={sector} onChange={(e) => setSector(e.target.value)}>
                      <option value="">Sector (opcional)</option>
                      {SECTORES.map((s) => <option key={s} value={s.toLowerCase()}>{s}</option>)}
                    </Select>
                    <Select value={ccaa} onChange={(e) => setCcaa(e.target.value)}>
                      <option value="">Comunidad Autónoma (opcional)</option>
                      {CCAA.map((c) => <option key={c} value={c}>{c}</option>)}
                    </Select>
                    <Button
                      className="w-full justify-center"
                      onClick={() => handleSearch()}
                      disabled={searching}
                      icon={searching ? <Clock size={14} className="animate-spin" /> : <Search size={14} />}
                    >
                      {searching ? 'Buscando...' : 'Buscar en BDNS'}
                    </Button>
                  </div>

                  {searchError && (
                    <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-700">
                      <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
                      BDNS no responde — mostrando convocatorias del sistema
                    </div>
                  )}
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
                  <p className="font-semibold mb-1">Consejo</p>
                  <p>Prueba con palabras clave del sector del cliente: &ldquo;digitalización&rdquo;, &ldquo;eficiencia energética&rdquo;, &ldquo;I+D&rdquo;, etc.</p>
                </div>
              </div>

              {/* Right: results */}
              <div className="col-span-3">
                {results.length === 0 && !searching && (
                  <div className="py-6">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Búsquedas frecuentes</p>
                    <div className="flex flex-wrap gap-2 mb-6">
                      {['digitalización', 'eficiencia energética', 'I+D', 'internacionalización', 'hostelería', 'agricultura', 'turismo rural', 'contratación'].map((kw) => (
                        <button
                          key={kw}
                          onClick={() => handleSearch(kw)}
                          className="px-3 py-1.5 rounded-full text-xs border border-slate-200 text-slate-600 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-colors"
                        >
                          {kw}
                        </button>
                      ))}
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                      <p className="text-xs font-semibold text-emerald-800 mb-1">💡 Consejo</p>
                      <p className="text-xs text-emerald-700">Usa palabras clave del sector del cliente. La IA analizará cada convocatoria y te dirá exactamente qué porcentaje cubre y qué documentos necesitas.</p>
                    </div>
                  </div>
                )}
                {searching && (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 py-16">
                    <Clock size={32} className="mb-3 opacity-40 animate-spin" />
                    <p className="text-sm">Consultando BDNS...</p>
                  </div>
                )}
                {results.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-500 font-medium">{results.length} convocatorias encontradas</p>
                    {results.map((r) => (
                      <div
                        key={r.idBdns}
                        onClick={() => setSelected(selected?.idBdns === r.idBdns ? null : r)}
                        className={clsx(
                          'bg-white rounded-xl border shadow-sm p-4 cursor-pointer transition-all',
                          selected?.idBdns === r.idBdns
                            ? 'border-slate-900 ring-2 ring-slate-900/10'
                            : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
                        )}
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <p className="text-sm font-semibold text-slate-900 leading-snug flex-1">{r.nombre}</p>
                          {selected?.idBdns === r.idBdns && (
                            <CheckCircle size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Building2 size={11} />
                            {r.organismo}
                          </span>
                          <span className="flex items-center gap-1">
                            <Euro size={11} />
                            {formatEur(r.importeMax)} máx.
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar size={11} />
                            Cierre: {new Date(r.fechaCierre).toLocaleDateString('es-ES')}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1.5 line-clamp-2">{r.descripcion}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 1 && selected && (
            <div className="mt-4 flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              <div className="flex items-center gap-2">
                <CheckCircle size={16} className="text-emerald-600" />
                <span className="text-sm font-medium text-emerald-800 truncate max-w-xs">{selected.nombre}</span>
              </div>
              <Button
                onClick={() => setStep(2)}
                icon={<ChevronRight size={15} />}
                className="flex-shrink-0"
              >
                Continuar
              </Button>
            </div>
          )}

          {/* ================== PASO 2 ================== */}
          {step === 2 && selected && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h2 className="text-base font-semibold text-slate-900 mb-1">Analizando la convocatoria con IA</h2>
                <p className="text-sm text-slate-500 mb-4">{selected.nombre}</p>

                {/* Progress steps */}
                <div className="space-y-2 mb-6">
                  {ANALYSIS_STEPS.map((s, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className={clsx(
                        'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all',
                        s.done ? 'bg-emerald-500' : analysisStep === i ? 'bg-blue-500 animate-pulse' : 'bg-slate-200'
                      )}>
                        {s.done
                          ? <CheckCircle size={12} className="text-white" />
                          : analysisStep === i
                          ? <Clock size={10} className="text-white" />
                          : null
                        }
                      </div>
                      <span className={clsx(
                        'text-sm transition-colors',
                        s.done ? 'text-slate-700 font-medium' : analysisStep === i ? 'text-blue-600 font-medium' : 'text-slate-400'
                      )}>
                        {s.done && i === 3 ? '✓ ' : ''}{s.label}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Analysis results */}
                {analysis && (
                  <div className="space-y-5 border-t border-slate-100 pt-5">
                    {/* Resumen IA */}
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles size={14} className="text-blue-600" />
                        <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Resumen generado por IA</span>
                      </div>
                      <p className="text-sm text-blue-900 leading-relaxed">{analysis.resumen_ia}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                      {/* Para quién */}
                      <div>
                        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Para quién</h3>
                        <p className="text-sm text-slate-700 leading-relaxed">{analysis.para_quien}</p>
                      </div>

                      {/* Puntos clave */}
                      <div>
                        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Puntos clave</h3>
                        <ul className="space-y-1">
                          {analysis.puntos_clave.map((p, i) => (
                            <li key={i} className="flex items-start gap-1.5 text-sm text-slate-700">
                              <span className="text-slate-400 flex-shrink-0 mt-0.5">•</span>
                              {p}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Documentos requeridos */}
                    <div>
                      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                        Documentos requeridos ({analysis.documentos_requeridos.length})
                      </h3>
                      <div className="grid grid-cols-2 gap-1.5">
                        {analysis.documentos_requeridos.map((d, i) => (
                          <label key={i} className="flex items-center gap-2 text-sm text-slate-700 cursor-default">
                            <span className="w-4 h-4 rounded border border-slate-300 flex-shrink-0 bg-white" />
                            {d}
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Gastos elegibles vs no elegibles */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h3 className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2">Gastos elegibles</h3>
                        <ul className="space-y-1">
                          {analysis.gastos_elegibles.map((g, i) => (
                            <li key={i} className="flex items-center gap-1.5 text-sm text-slate-700">
                              <CheckCircle size={12} className="text-emerald-500 flex-shrink-0" />
                              {g}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h3 className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">No elegibles</h3>
                        <ul className="space-y-1">
                          {analysis.gastos_no_elegibles.map((g, i) => (
                            <li key={i} className="flex items-center gap-1.5 text-sm text-slate-500">
                              <span className="text-red-400 flex-shrink-0">✗</span>
                              {g}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Role simulation */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <button
                        onClick={() => setShowRoles((v) => !v)}
                        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <span>Cómo lo ve cada perfil</span>
                        {showRoles ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                      {showRoles && (
                        <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">
                          {[
                            {
                              role: 'Gestor (Laura)',
                              color: 'bg-blue-50 border-blue-100 text-blue-800',
                              icon: '🧑‍💼',
                              text: 'Revisa que los requisitos encajan con el cliente. Si hay dudas, consulta la convocatoria original antes de continuar.',
                            },
                            {
                              role: 'Cliente (Antonio)',
                              color: 'bg-emerald-50 border-emerald-100 text-emerald-800',
                              icon: '🏪',
                              text: 'No necesita ver este análisis técnico. El gestor se lo explica en una llamada de 10 minutos con lenguaje sencillo.',
                            },
                            {
                              role: 'Proveedor (Carlos)',
                              color: 'bg-purple-50 border-purple-100 text-purple-800',
                              icon: '🔧',
                              text: `Recibirá una solicitud de presupuesto con los gastos elegibles ya marcados: ${analysis.gastos_elegibles.slice(0, 2).join(', ')}...`,
                            },
                          ].map(({ role, color, icon, text }) => (
                            <div key={role} className={clsx('border rounded-lg p-3 text-xs', color)}>
                              <span className="font-semibold">{icon} {role}:</span> {text}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {analysis && (
                <div className="flex justify-between items-center">
                  <Button variant="ghost" onClick={() => setStep(1)}>
                    Volver
                  </Button>
                  <Button onClick={() => setStep(3)} icon={<ChevronRight size={15} />}>
                    Continuar
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* ================== PASO 3 ================== */}
          {step === 3 && selected && analysis && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h2 className="text-base font-semibold text-slate-900 mb-1">Crear el expediente</h2>
                <p className="text-sm text-slate-500 mb-5">{selected.nombre}</p>

                <div className="space-y-5">
                  {/* Cliente */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Cliente <span className="text-red-500">*</span>
                    </label>
                    <Select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
                      <option value="">Seleccionar cliente...</option>
                      {clientes.map((c) => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                      ))}
                    </Select>

                    {selectedCliente && (
                      <div className="mt-2 space-y-1">
                        <div className={clsx(
                          'inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg font-medium',
                          selectedCliente.cumplimientoHacienda === 'ok' && selectedCliente.cumplimientoSS === 'ok'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-700'
                        )}>
                          {selectedCliente.cumplimientoHacienda === 'ok' ? '✓ Hacienda OK' : '⚠️ Revisar Hacienda'}
                          {' · '}
                          {selectedCliente.cumplimientoSS === 'ok' ? '✓ SS OK' : '⚠️ Revisar SS'}
                        </div>
                        <div className={clsx(
                          'inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg font-medium ml-2',
                          clienteCumple ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                        )}>
                          {clienteCumple
                            ? '✓ Cumple requisito: pyme o autónomo'
                            : '⚠️ Gran empresa: verificar elegibilidad'}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Sector: {selectedCliente.sector} · {selectedCliente.comunidadAutonoma}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Importe */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Importe a solicitar (€) <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="number"
                      placeholder="Ej: 10000"
                      value={importe}
                      onChange={(e) => setImporte(e.target.value)}
                      max={selected.importeMax}
                    />
                    <p className="text-xs text-slate-400 mt-1">
                      Máximo: {formatEur(selected.importeMax)} según convocatoria ({analysis.porcentaje_subvencion}% subvencionable)
                    </p>
                  </div>

                  {/* Gestor */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Gestor asignado
                    </label>
                    <Select value={gestorId} onChange={(e) => setGestorId(e.target.value)}>
                      {gestores.map((g) => (
                        <option key={g.id} value={g.id}>{g.nombre}</option>
                      ))}
                    </Select>
                  </div>

                  {/* Proveedores hint */}
                  <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 text-xs text-purple-700">
                    <p className="font-semibold mb-0.5">Proveedores y presupuestos</p>
                    <p>
                      Necesitarás {analysis.gastos_elegibles.length > 2 ? '3 presupuestos comparativos' : 'al menos 1 presupuesto'} para los gastos elegibles.
                      Puedes solicitarlos desde la pestaña &ldquo;Presupuestos&rdquo; del expediente.
                    </p>
                    {selectedCliente?.sector && (
                      <p className="mt-1 text-purple-600">
                        Sugerencia: Sistemas Digitales Norte S.L. ha trabajado con subvenciones similares.
                      </p>
                    )}
                  </div>

                  {/* Fecha inicio */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Fecha estimada de inicio
                    </label>
                    <Input
                      type="date"
                      value={fechaInicio}
                      onChange={(e) => setFechaInicio(e.target.value)}
                    />
                  </div>

                  {/* Notas */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Notas iniciales
                    </label>
                    <textarea
                      className="w-full text-sm text-slate-800 border border-slate-200 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 placeholder:text-slate-400"
                      rows={3}
                      placeholder="Observaciones iniciales sobre el expediente..."
                      value={notas}
                      onChange={(e) => setNotas(e.target.value)}
                    />
                  </div>

                  {/* Documentos que se crearán */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <h3 className="text-xs font-semibold text-slate-700 mb-2">
                      Se crearán {analysis.documentos_requeridos.length} documentos en el checklist
                    </h3>
                    <div className="grid grid-cols-2 gap-1">
                      {analysis.documentos_requeridos.map((d, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs text-slate-500">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0" />
                          {d}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <Button variant="ghost" onClick={() => setStep(2)}>
                  Volver
                </Button>
                <Button
                  onClick={handleCrear}
                  disabled={!clienteId || !importe}
                  icon={<CheckCircle size={15} />}
                >
                  Crear expediente
                </Button>
              </div>
            </div>
          )}

          {/* ================== PASO 4 ================== */}
          {step === 4 && selected && analysis && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-8 text-center">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={32} className="text-emerald-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-1">Expediente creado correctamente</h2>
                <p className="text-slate-500 text-sm">
                  {clientes.find((c) => c.id === clienteId)?.nombre} — {selected.nombre}
                </p>
                <p className="text-xs text-slate-400 mt-1 font-mono">
                  Nº provisional: {useAppStore.getState().expedientes.find((e) => e.id === newExpId)?.numeroOficial || `EXP-2026-XXX`}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-lg">📋</span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {analysis.documentos_requeridos.length} documentos en checklist
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">Todos pendientes de adjuntar. Puedes subir desde la pestaña &ldquo;Documentos&rdquo;.</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-lg">🏢</span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Proveedores y presupuestos</p>
                      <p className="text-xs text-slate-500 mt-0.5">Solicita los presupuestos desde la pestaña &ldquo;Presupuestos&rdquo; del expediente.</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-lg">📅</span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Plazo de solicitud:{' '}
                        <span className={clsx(diasRestantes !== null && diasRestantes > 0 && diasRestantes <= 30 ? 'text-red-600' : 'text-slate-900')}>
                          {selected.fechaCierre
                            ? new Date(selected.fechaCierre).toLocaleDateString('es-ES')
                            : 'Ver convocatoria'}
                        </span>
                      </p>
                      {diasRestantes !== null && diasRestantes > 0 && (
                        <p className={clsx('text-xs mt-0.5', diasRestantes <= 30 ? 'text-red-600 font-medium' : 'text-slate-500')}>
                          Quedan {diasRestantes} días
                        </p>
                      )}
                      {diasRestantes !== null && diasRestantes <= 0 && (
                        <p className="text-xs mt-0.5 text-slate-400">Verifica la fecha en la sede electrónica</p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-lg">⚠️</span>
                    <div>
                      <p className="text-sm font-semibold text-amber-800">Solo pagas el 15% si se concede</p>
                      <p className="text-xs text-amber-700 mt-0.5">
                        Si se concede {formatEur(parseInt(importe) || 0)} → comisión:{' '}
                        {formatEur(Math.max(300, (parseInt(importe) || 0) * 0.15))}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-2">
                <Button
                  className="flex-1 justify-center"
                  onClick={() => {
                    try {
                      setTimeout(() => navigate(`/expedientes/${newExpId}`), 50)
                    } catch (e) {
                      console.error('Navigation error:', e)
                    }
                  }}
                  icon={<ChevronRight size={15} />}
                >
                  Ver expediente
                </Button>
                <Button
                  variant="secondary"
                  className="flex-1 justify-center"
                  onClick={() => {
                    try {
                      setTimeout(() => navigate(`/expedientes/${newExpId}`), 50)
                    } catch (e) {
                      console.error('Navigation error:', e)
                    }
                  }}
                  icon={<User size={15} />}
                >
                  Solicitar presupuestos
                </Button>
                <Button
                  variant="ghost"
                  className="flex-1 justify-center"
                  onClick={() => {
                    setStep(1)
                    setKeywords('')
                    setSector('')
                    setCcaa('')
                    setResults([])
                    setSelected(null)
                    setAnalysis(null)
                    setAnalysisStep(0)
                    setClienteId('')
                    setImporte('')
                    setFechaInicio('')
                    setNotas('')
                    setNewExpId('')
                  }}
                >
                  Crear otra subvención
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
