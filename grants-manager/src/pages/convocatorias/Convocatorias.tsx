import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Navbar } from '../../components/layout/Navbar'
import { Card } from '../../components/ui/Card'
import { TipoBadge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/Input'
import { useAppStore } from '../../store'
import { Search, ExternalLink, Calendar, Plus } from 'lucide-react'
import { clsx } from 'clsx'

export function Convocatorias() {
  const { convocatorias } = useAppStore()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [filterTipo, setFilterTipo] = useState('')

  // N2 — pre-filter by sector/ccaa from URL params (set by ClienteDetalle button)
  const paramSector = searchParams.get('sector') ?? ''
  const paramCCAA = searchParams.get('ccaa') ?? ''

  const filtered = convocatorias.filter((c) => {
    const q = search.toLowerCase()
    const matchSearch = !q || c.nombre.toLowerCase().includes(q) || c.organismo.toLowerCase().includes(q) ||
      c.descripcion?.toLowerCase().includes(q)
    const matchTipo = !filterTipo || c.tipo === filterTipo
    // N2 — apply client sector/ccaa hint as text search in nombre/descripcion/requisitos
    const matchSectorHint = !paramSector || c.nombre.toLowerCase().includes(paramSector.toLowerCase()) ||
      c.descripcion?.toLowerCase().includes(paramSector.toLowerCase()) ||
      c.requisitos?.some((r) => r.toLowerCase().includes(paramSector.toLowerCase()))
    return matchSearch && matchTipo && matchSectorHint
  })

  const formatEur = (n: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

  const diffDays = (date: Date) => Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24))

  return (
    <>
      <Navbar
        title="Convocatorias"
        subtitle="Convocatorias activas y recientes"
        actions={
          <Button size="sm" variant="secondary" icon={<ExternalLink size={14} />}
            onClick={() => { const w = window.open('https://www.pap.hacienda.gob.es/bdnstrans/GE/es/convocatorias', '_blank', 'noopener,noreferrer'); if (w) w.opener = null }}>
            Abrir BDNS
          </Button>
        }
      />
      <div className="flex-1 overflow-y-auto p-6">
        {/* N2 — banner contexto cliente */}
        {(paramSector || paramCCAA) && (
          <div className="mb-4 flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
            <Search size={15} className="text-blue-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-blue-800">
                Mostrando subvenciones para cliente del sector <strong>{paramSector}</strong>
                {paramCCAA && <> en <strong>{paramCCAA}</strong></>}
              </p>
              <p className="text-xs text-blue-600 mt-0.5">{filtered.length} convocatorias encontradas</p>
            </div>
            <button
              onClick={() => navigate('/convocatorias')}
              className="text-xs text-blue-600 hover:text-blue-900 font-medium"
            >
              Ver todas →
            </button>
          </div>
        )}
        {/* Filters */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <div className="flex-1 min-w-52">
            <Input
              placeholder="Buscar convocatoria u organismo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search size={14} />}
            />
          </div>
          <Select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)} className="w-44">
            <option value="">Todos los tipos</option>
            <option value="estatal">Estatal</option>
            <option value="autonomica">Autonómica</option>
            <option value="europea">Europea</option>
            <option value="local">Local</option>
          </Select>
          {(search || filterTipo) && (
            <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setFilterTipo('') }}>
              Limpiar
            </Button>
          )}
          <span className="text-xs text-slate-400 ml-auto">{filtered.length} convocatorias</span>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((conv) => {
            const dias = diffDays(conv.fechaCierre)
            const urgente = dias <= 7 && dias > 0
            const cerrada = dias < 0
            return (
              <Card key={conv.idBdns} hoverable className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-400 mb-1 truncate">{conv.organismo}</p>
                    <h3 className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2">
                      {conv.nombre}
                    </h3>
                  </div>
                  <TipoBadge tipo={conv.tipo} />
                </div>

                <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{conv.descripcion}</p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-slate-400">Importe máximo</p>
                    <p className="text-sm font-semibold text-slate-900">{formatEur(conv.importeMax)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Subvencionable</p>
                    <p className="text-sm font-semibold text-slate-900">{conv.porcentajeSubvencionable}%</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <Calendar size={12} className="text-slate-400" />
                    <span className={clsx(
                      'text-xs font-medium',
                      cerrada ? 'text-slate-400' : urgente ? 'text-red-600' : 'text-slate-700'
                    )}>
                      {cerrada ? 'Cerrada' : urgente ? `¡Cierra en ${dias}d!` : `Cierra en ${dias} días`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<ExternalLink size={12} />}
                      onClick={(e) => { e.stopPropagation(); const w = window.open(conv.urlSede, '_blank', 'noopener,noreferrer'); if (w) w.opener = null }}
                    >
                      Sede
                    </Button>
                    <Button
                      size="sm"
                      icon={<Plus size={12} />}
                      onClick={() => navigate('/expedientes')}
                    >
                      Expediente
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      </div>
    </>
  )
}
