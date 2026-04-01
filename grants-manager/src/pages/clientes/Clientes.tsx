import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Navbar } from '../../components/layout/Navbar'
import { Button } from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/Input'
import { useAppStore } from '../../store'
import { Plus, Search, AlertTriangle, X } from 'lucide-react'
import { clsx } from 'clsx'
import type { Cliente } from '../../types'

const NOW = Date.now()

const TAMANO_LABELS = {
  micropyme: 'Micropyme',
  pyme: 'PYME',
  gran_empresa: 'Gran empresa',
  ong: 'ONG',
  autonomo: 'Autónomo',
}

const SECTORES_COMUNES = [
  'Hostelería', 'Comercio Minorista', 'Industria Manufacturera', 'Tecnología',
  'Agricultura', 'Construcción', 'Turismo', 'Educación', 'Servicios Sociales',
  'Transporte y Logística', 'Sanidad', 'Otros',
]

const CCAA_LISTA = [
  'Andalucía', 'Aragón', 'Asturias', 'Baleares', 'Canarias', 'Cantabria',
  'Castilla-La Mancha', 'Castilla y León', 'Cataluña', 'Extremadura', 'Galicia',
  'La Rioja', 'Madrid', 'Murcia', 'Navarra', 'País Vasco', 'Valencia',
]

export function Clientes() {
  const { clientes, expedientes, addCliente } = useAppStore()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [filterSector, setFilterSector] = useState('')
  const [filterCCAA, setFilterCCAA] = useState('')
  const [showNuevoCliente, setShowNuevoCliente] = useState(false)
  const [nuevoForm, setNuevoForm] = useState({
    nombre: '', cif: '', sector: '', cnae: '', empleados: '', email: '', telefono: '',
    tamano: 'pyme' as Cliente['tamano'], comunidadAutonoma: '',
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  const handleNuevoClienteSubmit = () => {
    const errs: Record<string, string> = {}
    if (!nuevoForm.nombre.trim()) errs.nombre = 'Requerido'
    if (!nuevoForm.cif.trim()) errs.cif = 'Requerido'
    if (!nuevoForm.sector) errs.sector = 'Requerido'
    if (!nuevoForm.email.trim()) errs.email = 'Requerido'
    setFormErrors(errs)
    if (Object.keys(errs).length > 0) return

    const nuevo: Cliente = {
      id: `c${Date.now()}`,
      nombre: nuevoForm.nombre.trim(),
      nif: nuevoForm.cif.trim(),
      sector: nuevoForm.sector,
      cnae: nuevoForm.cnae.trim() || '0000',
      comunidadAutonoma: nuevoForm.comunidadAutonoma || 'Sin especificar',
      tamano: nuevoForm.tamano,
      certificadoDigital: 'Pendiente',
      caducidadCertificado: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      contacto: nuevoForm.nombre.trim(),
      email: nuevoForm.email.trim(),
      telefono: nuevoForm.telefono.trim() || '—',
      fechaAlta: new Date(),
      cumplimientoHacienda: 'pendiente' as const,
      cumplimientoSS: 'pendiente' as const,
    }
    addCliente(nuevo)
    setShowNuevoCliente(false)
    setNuevoForm({ nombre: '', cif: '', sector: '', cnae: '', empleados: '', email: '', telefono: '', tamano: 'pyme', comunidadAutonoma: '' })
    setFormErrors({})
    navigate(`/clientes/${nuevo.id}`)
  }

  const sectores = [...new Set(clientes.map((c) => c.sector))].sort()
  const ccaas = [...new Set(clientes.map((c) => c.comunidadAutonoma))].sort()

  const filtered = clientes.filter((c) => {
    const q = search.toLowerCase()
    const matchSearch = !q || c.nombre.toLowerCase().includes(q) || c.nif.toLowerCase().includes(q) || c.contacto.toLowerCase().includes(q)
    const matchSector = !filterSector || c.sector === filterSector
    const matchCCAA = !filterCCAA || c.comunidadAutonoma === filterCCAA
    return matchSearch && matchSector && matchCCAA
  })

  const getExpedientesActivos = (clienteId: string) =>
    expedientes.filter((e) => e.clienteId === clienteId && !['CERRADA', 'DENEGADA'].includes(e.estado)).length

  const getUltimoExpediente = (clienteId: string) => {
    const exps = expedientes.filter((e) => e.clienteId === clienteId)
    if (!exps.length) return null
    return exps.sort((a, b) => (b.historial[0]?.fecha?.getTime() ?? 0) - (a.historial[0]?.fecha?.getTime() ?? 0))[0]
  }

  const isCertificadoCaducando = (fecha: Date) => {
    const days = Math.ceil((fecha.getTime() - NOW) / (1000 * 60 * 60 * 24))
    return days <= 30
  }

  return (
    <>
      <Navbar
        title="Clientes"
        subtitle={`${clientes.length} clientes registrados`}
        actions={
          <Button icon={<Plus size={14} />} size="sm" onClick={() => setShowNuevoCliente(true)}>
            Nuevo cliente
          </Button>
        }
      />
      <div className="flex-1 overflow-y-auto p-6">
        {/* N1 — Formulario nuevo cliente */}
        {showNuevoCliente && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <h2 className="text-base font-semibold text-slate-900">Nuevo cliente</h2>
                <button onClick={() => setShowNuevoCliente(false)} className="text-slate-400 hover:text-slate-700">
                  <X size={18} />
                </button>
              </div>
              <div className="px-6 py-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-slate-600 block mb-1">Nombre de la empresa <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={nuevoForm.nombre}
                      onChange={(e) => setNuevoForm((f) => ({ ...f, nombre: e.target.value }))}
                      placeholder="Ej: Restaurante El Barco S.L."
                      className={clsx('w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10', formErrors.nombre ? 'border-red-300' : 'border-slate-200')}
                    />
                    {formErrors.nombre && <p className="text-xs text-red-500 mt-1">{formErrors.nombre}</p>}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1">CIF/NIF <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={nuevoForm.cif}
                      onChange={(e) => setNuevoForm((f) => ({ ...f, cif: e.target.value }))}
                      placeholder="B12345678"
                      className={clsx('w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10', formErrors.cif ? 'border-red-300' : 'border-slate-200')}
                    />
                    {formErrors.cif && <p className="text-xs text-red-500 mt-1">{formErrors.cif}</p>}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1">Tamaño empresa</label>
                    <select
                      value={nuevoForm.tamano}
                      onChange={(e) => setNuevoForm((f) => ({ ...f, tamano: e.target.value as Cliente['tamano'] }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                    >
                      {Object.entries(TAMANO_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1">Sector <span className="text-red-500">*</span></label>
                    <select
                      value={nuevoForm.sector}
                      onChange={(e) => setNuevoForm((f) => ({ ...f, sector: e.target.value }))}
                      className={clsx('w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10', formErrors.sector ? 'border-red-300' : 'border-slate-200')}
                    >
                      <option value="">Seleccionar sector...</option>
                      {SECTORES_COMUNES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    {formErrors.sector && <p className="text-xs text-red-500 mt-1">{formErrors.sector}</p>}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1">CNAE</label>
                    <input
                      type="text"
                      value={nuevoForm.cnae}
                      onChange={(e) => setNuevoForm((f) => ({ ...f, cnae: e.target.value }))}
                      placeholder="5610"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1">Comunidad Autónoma</label>
                    <select
                      value={nuevoForm.comunidadAutonoma}
                      onChange={(e) => setNuevoForm((f) => ({ ...f, comunidadAutonoma: e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                    >
                      <option value="">Seleccionar...</option>
                      {CCAA_LISTA.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1">Nº empleados</label>
                    <input
                      type="number"
                      value={nuevoForm.empleados}
                      onChange={(e) => setNuevoForm((f) => ({ ...f, empleados: e.target.value }))}
                      placeholder="5"
                      min="0"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-slate-600 block mb-1">Email de contacto <span className="text-red-500">*</span></label>
                    <input
                      type="email"
                      value={nuevoForm.email}
                      onChange={(e) => setNuevoForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="contacto@empresa.es"
                      className={clsx('w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10', formErrors.email ? 'border-red-300' : 'border-slate-200')}
                    />
                    {formErrors.email && <p className="text-xs text-red-500 mt-1">{formErrors.email}</p>}
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-slate-600 block mb-1">Teléfono</label>
                    <input
                      type="tel"
                      value={nuevoForm.telefono}
                      onChange={(e) => setNuevoForm((f) => ({ ...f, telefono: e.target.value }))}
                      placeholder="981 234 567"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                    />
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowNuevoCliente(false)}>Cancelar</Button>
                <Button size="sm" icon={<Plus size={13} />} onClick={handleNuevoClienteSubmit}>
                  Crear cliente y ver perfil
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <div className="flex-1 min-w-48">
            <Input
              placeholder="Buscar por nombre, NIF o contacto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search size={14} />}
            />
          </div>
          <Select value={filterSector} onChange={(e) => setFilterSector(e.target.value)} className="w-48">
            <option value="">Todos los sectores</option>
            {sectores.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
          <Select value={filterCCAA} onChange={(e) => setFilterCCAA(e.target.value)} className="w-48">
            <option value="">Todas las comunidades</option>
            {ccaas.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          {(search || filterSector || filterCCAA) && (
            <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setFilterSector(''); setFilterCCAA('') }}>
              Limpiar
            </Button>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                {['Cliente', 'NIF', 'Sector', 'Tamaño', 'C.C.A.A.', 'Exp. activos', 'Último expediente', 'Certificado'].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-slate-500 px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((cliente) => {
                const activos = getExpedientesActivos(cliente.id)
                const ultimo = getUltimoExpediente(cliente.id)
                const certCaducando = isCertificadoCaducando(cliente.caducidadCertificado)
                return (
                  <tr
                    key={cliente.id}
                    className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/clientes/${cliente.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0">
                          {cliente.nombre.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900 leading-tight">{cliente.nombre}</p>
                          <p className="text-xs text-slate-400">{cliente.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 font-mono">{cliente.nif}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{cliente.sector}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                        {TAMANO_LABELS[cliente.tamano]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{cliente.comunidadAutonoma}</td>
                    <td className="px-4 py-3">
                      <span className={clsx(
                        'text-sm font-semibold',
                        activos > 0 ? 'text-slate-900' : 'text-slate-400'
                      )}>
                        {activos}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {ultimo ? ultimo.numeroOficial || `ID: ${ultimo.id}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {certCaducando ? (
                        <div className="flex items-center gap-1.5 text-orange-600">
                          <AlertTriangle size={13} />
                          <span className="text-xs font-medium">
                            {cliente.caducidadCertificado.toLocaleDateString('es-ES')}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">
                          {cliente.caducidadCertificado.toLocaleDateString('es-ES')}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-sm text-slate-400">
                    No se encontraron clientes con los filtros seleccionados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-400">
            Mostrando {filtered.length} de {clientes.length} clientes
          </div>
        </div>
      </div>
    </>
  )
}
