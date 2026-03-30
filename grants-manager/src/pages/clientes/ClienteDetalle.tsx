import { useParams, useNavigate } from 'react-router-dom'
import { Navbar } from '../../components/layout/Navbar'
import { Card } from '../../components/ui/Card'
import { EstadoBadge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { useAppStore } from '../../store'
import { ArrowLeft, Mail, Phone, AlertTriangle, CheckCircle, User } from 'lucide-react'
import { clsx } from 'clsx'

const TAMANO_LABELS = {
  micropyme: 'Micropyme', pyme: 'PYME', gran_empresa: 'Gran empresa', ong: 'ONG', autonomo: 'Autónomo',
}

export function ClienteDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { clientes, expedientes, convocatorias } = useAppStore()

  const cliente = clientes.find((c) => c.id === id)
  if (!cliente) return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-slate-500">Cliente no encontrado</p>
    </div>
  )

  const clienteExpedientes = expedientes.filter((e) => e.clienteId === id)
  const formatEur = (n: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

  const certDays = Math.ceil((cliente.caducidadCertificado.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  const certOk = certDays > 30

  const importeConcedido = clienteExpedientes.reduce((s, e) => s + e.importeConcedido, 0)

  return (
    <>
      <Navbar
        title={cliente.nombre}
        subtitle={`NIF: ${cliente.nif}`}
        actions={
          <Button variant="secondary" size="sm" icon={<ArrowLeft size={14} />} onClick={() => navigate('/clientes')}>
            Volver
          </Button>
        }
      />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Ficha datos */}
            <Card className="md:col-span-2" padding="lg">
              <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <User size={15} className="text-slate-400" /> Datos del cliente
              </h2>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
                {[
                  { label: 'Nombre', value: cliente.nombre },
                  { label: 'NIF', value: cliente.nif },
                  { label: 'Sector', value: cliente.sector },
                  { label: 'CNAE', value: cliente.cnae },
                  { label: 'Tamaño', value: TAMANO_LABELS[cliente.tamano] },
                  { label: 'C.C.A.A.', value: cliente.comunidadAutonoma },
                  { label: 'Contacto', value: cliente.contacto },
                  { label: 'Fecha de alta', value: cliente.fechaAlta.toLocaleDateString('es-ES') },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <dt className="text-xs text-slate-400 font-medium">{label}</dt>
                    <dd className="text-sm text-slate-800 mt-0.5">{value}</dd>
                  </div>
                ))}
                <div>
                  <dt className="text-xs text-slate-400 font-medium">Email</dt>
                  <dd className="text-sm text-slate-800 mt-0.5 flex items-center gap-1">
                    <Mail size={12} className="text-slate-400" /> {cliente.email}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400 font-medium">Teléfono</dt>
                  <dd className="text-sm text-slate-800 mt-0.5 flex items-center gap-1">
                    <Phone size={12} className="text-slate-400" /> {cliente.telefono}
                  </dd>
                </div>
              </dl>
            </Card>

            {/* Certificado + stats */}
            <div className="space-y-4">
              <Card padding="md">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Certificado digital</h3>
                <div className={clsx(
                  'flex items-start gap-3 p-3 rounded-lg',
                  certOk ? 'bg-emerald-50' : 'bg-red-50'
                )}>
                  {certOk
                    ? <CheckCircle size={18} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                    : <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
                  }
                  <div>
                    <p className={clsx('text-sm font-medium', certOk ? 'text-emerald-700' : 'text-red-700')}>
                      {certOk ? 'Válido' : certDays > 0 ? `Caduca en ${certDays} días` : `Caducado hace ${Math.abs(certDays)} días`}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">{cliente.certificadoDigital}</p>
                    <p className="text-xs text-slate-500">Hasta {cliente.caducidadCertificado.toLocaleDateString('es-ES')}</p>
                  </div>
                </div>
              </Card>

              <Card padding="md">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Resumen</h3>
                <div className="space-y-2">
                  {[
                    { label: 'Expedientes totales', value: clienteExpedientes.length },
                    { label: 'Activos', value: clienteExpedientes.filter((e) => !['CERRADA', 'DENEGADA'].includes(e.estado)).length },
                    { label: 'Concedidos', value: clienteExpedientes.filter((e) => ['CONCEDIDA', 'JUSTIFICACION', 'CERRADA'].includes(e.estado)).length },
                    { label: 'Importe concedido', value: formatEur(importeConcedido) },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between items-center">
                      <span className="text-xs text-slate-500">{label}</span>
                      <span className="text-sm font-semibold text-slate-900">{value}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>

          {/* Expedientes */}
          <Card padding="none">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Historial de expedientes</h3>
              <Button size="sm" variant="secondary" onClick={() => navigate('/expedientes')}>
                Nuevo expediente
              </Button>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  {['Nº Expediente', 'Convocatoria', 'Estado', 'Solicitado', 'Concedido', 'Fecha'].map((h) => (
                    <th key={h} className="text-left text-xs font-medium text-slate-500 px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clienteExpedientes.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-sm text-slate-400">
                      No hay expedientes para este cliente
                    </td>
                  </tr>
                )}
                {clienteExpedientes.map((exp) => {
                  const conv = convocatorias.find((c) => c.idBdns === exp.convocatoriaId)
                  return (
                    <tr
                      key={exp.id}
                      className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/expedientes/${exp.id}`)}
                    >
                      <td className="px-4 py-3 text-sm font-mono text-slate-700">{exp.numeroOficial || `—`}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 max-w-xs truncate">{conv?.nombre}</td>
                      <td className="px-4 py-3"><EstadoBadge estado={exp.estado} size="sm" /></td>
                      <td className="px-4 py-3 text-sm text-slate-700 tabular-nums">{formatEur(exp.importeSolicitado)}</td>
                      <td className="px-4 py-3 text-sm font-medium tabular-nums">
                        {exp.importeConcedido > 0 ? (
                          <span className="text-emerald-600">{formatEur(exp.importeConcedido)}</span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {exp.fechaSolicitud.getFullYear() > 1970
                          ? exp.fechaSolicitud.toLocaleDateString('es-ES')
                          : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>
        </div>
      </div>
    </>
  )
}
