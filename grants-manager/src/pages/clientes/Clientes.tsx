import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Navbar } from '../../components/layout/Navbar'
import { Button } from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/Input'
import { useAppStore } from '../../store'
import { Plus, Search, AlertTriangle } from 'lucide-react'
import { clsx } from 'clsx'

const TAMANO_LABELS = {
  micropyme: 'Micropyme',
  pyme: 'PYME',
  gran_empresa: 'Gran empresa',
  ong: 'ONG',
  autonomo: 'Autónomo',
}

export function Clientes() {
  const { clientes, expedientes } = useAppStore()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [filterSector, setFilterSector] = useState('')
  const [filterCCAA, setFilterCCAA] = useState('')

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
    const days = Math.ceil((fecha.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    return days <= 30
  }

  return (
    <>
      <Navbar
        title="Clientes"
        subtitle={`${clientes.length} clientes registrados`}
        actions={
          <Button icon={<Plus size={14} />} size="sm">
            Nuevo cliente
          </Button>
        }
      />
      <div className="flex-1 overflow-y-auto p-6">
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
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full">
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
