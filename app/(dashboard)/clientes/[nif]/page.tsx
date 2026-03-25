import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { notFound, redirect } from 'next/navigation';

interface Cliente {
  nif: string;
  nombre_empresa: string | null;
  nombre_normalizado: string | null;
  email_normalizado: string | null;
  tamano_empresa: string | null;
  actividad: string | null;
  domicilio_fiscal: string | null;
  codigo_postal: string | null;
  ciudad: string | null;
  comunidad_autonoma: string | null;
  telefono: string | null;
  cnae_codigo: string | null;
  cnae_descripcion: string | null;
  num_empleados: number | null;
  facturacion_anual: number | null;
  created_at: string;
}

interface Einforma {
  denominacion: string | null;
  forma_juridica: string | null;
  cnae: string | null;
  situacion: string | null;
  capital_social: number | null;
  ventas: number | null;
  anio_ventas: number | null;
  empleados: number | null;
  fecha_constitucion: string | null;
  cargo_principal: string | null;
  cargo_principal_puesto: string | null;
  domicilio_social: string | null;
  localidad: string | null;
  telefono: string[] | null;
  web: string[] | null;
  email: string | null;
}

interface Expediente {
  id: string;
  titulo: string | null;
  estado: string;
  created_at: string;
}

interface Solicitud {
  id: string;
  estado: string;
  created_at: string;
  expediente_id: string | null;
  subvencion: { titulo: string; importe_maximo: number | null } | null;
}

interface Reunion {
  id: string;
  titulo: string | null;
  tipo: string | null;
  estado: string | null;
  fecha_programada: string | null;
  created_at: string;
}

const expedienteBadge: Record<string, { bg: string; color: string; label: string }> = {
  en_tramitacion: { bg: 'var(--blue-bg)', color: 'var(--blue)', label: 'En tramitación' },
  concedido:      { bg: 'var(--green-bg)', color: 'var(--green)', label: 'Concedido' },
  denegado:       { bg: 'var(--red-bg)', color: 'var(--red)', label: 'Denegado' },
  cerrado:        { bg: 'var(--bg)', color: 'var(--muted)', label: 'Cerrado' },
};

const solicitudBadge: Record<string, { bg: string; color: string; label: string }> = {
  pendiente_encaje:   { bg: '#fffbeb', color: '#92400e', label: 'Pendiente encaje' },
  encaje_confirmado:  { bg: '#eff6ff', color: '#1d4ed8', label: 'Encaje OK' },
  contrato_pendiente: { bg: '#f5f3ff', color: '#6d28d9', label: 'Contrato pendiente' },
  contrato_firmado:   { bg: '#ecfdf5', color: '#065f46', label: 'Contrato firmado' },
  pago_pendiente:     { bg: '#fff7ed', color: '#9a3412', label: 'Pago pendiente' },
  activo:             { bg: '#ecfdf5', color: '#065f46', label: 'Activo' },
  rechazado:          { bg: '#fef2f2', color: '#991b1b', label: 'Rechazado' },
  cancelado:          { bg: '#f9fafb', color: '#374151', label: 'Cancelado' },
};

export default async function ClienteDetailPage({
  params
}: {
  params: Promise<{ nif: string }>
}) {
  const { nif } = await params;

  // Verificar que es admin
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email?.toLowerCase().endsWith('@ayudapyme.es')) redirect('/login');

  // Usar service client para evitar RLS
  const sb = createServiceClient();

  const { data: cliente, error: clienteError } = await sb
    .from('cliente')
    .select('nif, nombre_empresa, nombre_normalizado, email_normalizado, telefono, actividad, tamano_empresa, domicilio_fiscal, codigo_postal, ciudad, comunidad_autonoma, cnae_codigo, cnae_descripcion, num_empleados, facturacion_anual, created_at')
    .eq('nif', nif)
    .maybeSingle();

  if (clienteError || !cliente) notFound();

  const [
    { data: einforma },
    { data: expedientes },
    { data: reuniones },
    { data: solicitudes },
  ] = await Promise.all([
    sb.from('einforma').select('*').eq('nif', nif).maybeSingle(),
    sb.from('expediente').select('id, titulo, estado, created_at').eq('nif', nif).order('created_at', { ascending: false }),
    sb.from('reuniones').select('id, titulo, tipo, estado, fecha_programada, created_at').eq('cliente_nif', nif).order('fecha_programada', { ascending: false }),
    sb.from('solicitudes').select('id, estado, created_at, expediente_id, subvencion:subvenciones(titulo, importe_maximo)').eq('nif', nif).order('created_at', { ascending: false }),
  ]);

  const formatCurrency = (value: number | null) => {
    if (!value) return '—';
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <Link 
          href="/clientes"
          style={{
            color: 'var(--teal)',
            fontSize: '14px',
            fontWeight: '600',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            marginBottom: '16px'
          }}
        >
          ← Volver a clientes
        </Link>
        <h1 style={{
          fontSize: '32px',
          fontWeight: '700',
          color: 'var(--ink)',
          marginBottom: '4px'
        }}>
          {cliente.nombre_empresa || cliente.nombre_normalizado || cliente.nif}
        </h1>
        <p style={{ color: 'var(--ink2)', fontSize: '15px', fontFamily: 'monospace' }}>
          {cliente.nif}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
        {/* Datos del Cliente */}
        <div style={{
          backgroundColor: 'var(--surface)',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: 'var(--s1)',
          border: '1px solid var(--border)'
        }}>
          <h2 style={{
            fontSize: '18px',
            fontWeight: '700',
            color: 'var(--ink)',
            marginBottom: '20px'
          }}>
            Información del Cliente
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {cliente.email_normalizado && (
              <InfoRow label="Email" value={cliente.email_normalizado} />
            )}
            {cliente.telefono && (
              <InfoRow label="Teléfono" value={cliente.telefono} />
            )}
            {cliente.actividad && (
              <InfoRow label="Actividad" value={cliente.actividad} />
            )}
            {(cliente.cnae_codigo || cliente.cnae_descripcion) && (
              <InfoRow label="CNAE" value={[cliente.cnae_codigo, cliente.cnae_descripcion].filter(Boolean).join(' · ')} />
            )}
            {cliente.tamano_empresa && (
              <InfoRow label="Tamaño" value={cliente.tamano_empresa} />
            )}
            {cliente.num_empleados != null && (
              <InfoRow label="Empleados" value={String(cliente.num_empleados)} />
            )}
            {cliente.facturacion_anual != null && (
              <InfoRow label="Facturación" value={formatCurrency(cliente.facturacion_anual)} />
            )}
            {cliente.domicilio_fiscal && (
              <InfoRow label="Domicilio Fiscal" value={cliente.domicilio_fiscal} />
            )}
            {(cliente.ciudad || cliente.comunidad_autonoma) && (
              <InfoRow
                label="Ubicación"
                value={[cliente.codigo_postal, cliente.ciudad, cliente.comunidad_autonoma].filter(Boolean).join(' · ')}
              />
            )}
            <InfoRow label="Fecha registro" value={formatDate(cliente.created_at)} />
          </div>
        </div>

        {/* Datos Einforma */}
        <div style={{
          backgroundColor: 'var(--surface)',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: 'var(--s1)',
          border: '1px solid var(--border)'
        }}>
          <h2 style={{
            fontSize: '18px',
            fontWeight: '700',
            color: 'var(--ink)',
            marginBottom: '20px'
          }}>
            Datos Empresariales
          </h2>

          {einforma ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {einforma.denominacion && (
                <InfoRow label="Denominación" value={einforma.denominacion} />
              )}
              {einforma.forma_juridica && (
                <InfoRow label="Forma Jurídica" value={einforma.forma_juridica} />
              )}
              {einforma.cnae && (
                <InfoRow label="CNAE" value={einforma.cnae} />
              )}
              {einforma.situacion && (
                <InfoRow label="Situación" value={einforma.situacion} />
              )}
              {einforma.empleados && (
                <InfoRow label="Empleados" value={einforma.empleados.toString()} />
              )}
              {einforma.ventas && (
                <InfoRow 
                  label={`Ventas ${einforma.anio_ventas ? `(${einforma.anio_ventas})` : ''}`}
                  value={formatCurrency(einforma.ventas)} 
                />
              )}
              {einforma.capital_social && (
                <InfoRow label="Capital Social" value={formatCurrency(einforma.capital_social)} />
              )}
              {einforma.cargo_principal && (
                <InfoRow 
                  label="Cargo Principal" 
                  value={`${einforma.cargo_principal}${einforma.cargo_principal_puesto ? ` - ${einforma.cargo_principal_puesto}` : ''}`} 
                />
              )}
              {einforma.fecha_constitucion && (
                <InfoRow label="Fecha Constitución" value={formatDate(einforma.fecha_constitucion)} />
              )}
            </div>
          ) : (
            <p style={{ color: 'var(--muted)', fontSize: '14px' }}>
              No hay datos empresariales disponibles
            </p>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ 
        display: 'flex', 
        gap: '16px', 
        marginBottom: '32px' 
      }}>
        <Link href={`/reuniones/nueva?cliente=${nif}`}>
          <button style={{
            backgroundColor: 'var(--teal)',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '8px',
            border: 'none',
            fontSize: '15px',
            fontWeight: '600',
            cursor: 'pointer',
            boxShadow: 'var(--s1)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            📅 Nueva reunión
          </button>
        </Link>
        <Link href={`/expedientes/nuevo?cliente=${nif}`}>
          <button style={{
            backgroundColor: 'var(--blue)',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '8px',
            border: 'none',
            fontSize: '15px',
            fontWeight: '600',
            cursor: 'pointer',
            boxShadow: 'var(--s1)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            📁 Nuevo expediente
          </button>
        </Link>
      </div>

      {/* Reuniones */}
      <div style={{
        backgroundColor: 'var(--surface)',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: 'var(--s1)',
        border: '1px solid var(--border)',
        marginBottom: '24px'
      }}>
        <h2 style={{
          fontSize: '18px',
          fontWeight: '700',
          color: 'var(--ink)',
          marginBottom: '20px'
        }}>
          Reuniones
        </h2>

        {!reuniones || reuniones.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            color: 'var(--muted)'
          }}>
            <p>No hay reuniones programadas para este cliente</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {reuniones.map((reunion: Reunion) => (
              <Link 
                key={reunion.id}
                href={`/reuniones/${reunion.id}`}
                style={{ textDecoration: 'none' }}
              >
                <div 
                  className="table-row"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '16px',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--ink)' }}>
                      {reunion.titulo || 'Sin título'}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                      {reunion.fecha_programada 
                        ? `Programada: ${formatDate(reunion.fecha_programada)}`
                        : 'Fecha no programada'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {reunion.tipo && (
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: '500',
                        backgroundColor: 'var(--blue-bg)',
                        color: 'var(--blue)'
                      }}>
                        {reunion.tipo}
                      </span>
                    )}
                    {reunion.estado && (
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: '500',
                        backgroundColor: reunion.estado === 'realizada' ? 'var(--green-bg)' : 'var(--amber-bg)',
                        color: reunion.estado === 'realizada' ? 'var(--green)' : 'var(--amber)'
                      }}>
                        {reunion.estado}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Solicitudes */}
      {solicitudes && solicitudes.length > 0 && (
        <div style={{
          backgroundColor: 'var(--surface)', borderRadius: '12px', padding: '24px',
          boxShadow: 'var(--s1)', border: '1px solid var(--border)', marginBottom: '24px'
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--ink)', marginBottom: '20px' }}>
            Solicitudes ({solicitudes.length})
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(solicitudes as any[]).map((sol) => {
              const badge = solicitudBadge[sol.estado] ?? { bg: '#f3f4f6', color: '#374151', label: sol.estado };
              const sub = Array.isArray(sol.subvencion) ? sol.subvencion[0] : sol.subvencion;
              return (
                <div key={sol.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '14px 16px', border: '1px solid var(--border)', borderRadius: '8px',
                }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--ink)' }}>
                      {sub?.titulo ?? `Solicitud ${sol.id.slice(0, 8)}`}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                      {formatDate(sol.created_at)}
                      {sub?.importe_maximo ? ` · hasta ${formatCurrency(sub.importe_maximo)}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
                      backgroundColor: badge.bg, color: badge.color,
                    }}>{badge.label}</span>
                    {sol.expediente_id && (
                      <Link href={`/expedientes/${sol.expediente_id}`} style={{
                        fontSize: '12px', color: 'var(--teal)', textDecoration: 'none', fontWeight: '600'
                      }}>
                        Ver exp. →
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Expedientes */}
      <div style={{
        backgroundColor: 'var(--surface)',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: 'var(--s1)',
        border: '1px solid var(--border)'
      }}>
        <h2 style={{
          fontSize: '18px',
          fontWeight: '700',
          color: 'var(--ink)',
          marginBottom: '20px'
        }}>
          Expedientes
        </h2>

        {!expedientes || expedientes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
            <p>No hay expedientes para este cliente</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {expedientes.map((exp: Expediente) => {
              const badge = expedienteBadge[exp.estado] ?? { bg: 'var(--bg)', color: 'var(--ink2)', label: exp.estado };
              return (
                <Link
                  key={exp.id}
                  href={`/expedientes/${exp.id}`}
                  style={{ textDecoration: 'none' }}
                >
                  <div
                    className="table-row"
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '16px', border: '1px solid var(--border)',
                      borderRadius: '8px', cursor: 'pointer'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--ink)' }}>
                        {exp.titulo || `Expediente ${exp.id.slice(0, 8)}`}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                        Creado el {formatDate(exp.created_at)}
                      </div>
                    </div>
                    <span style={{
                      padding: '6px 12px', borderRadius: '6px',
                      fontSize: '13px', fontWeight: '600',
                      backgroundColor: badge.bg, color: badge.color
                    }}>
                      {badge.label}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ 
        fontSize: '13px', 
        fontWeight: '600', 
        color: 'var(--muted)',
        marginBottom: '4px',
        textTransform: 'uppercase',
        letterSpacing: '0.3px'
      }}>
        {label}
      </div>
      <div style={{ 
        fontSize: '15px', 
        color: 'var(--ink)' 
      }}>
        {value || '—'}
      </div>
    </div>
  );
}
