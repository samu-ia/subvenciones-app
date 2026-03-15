import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';

interface Cliente {
  nif: string;
  nombre_normalizado: string | null;
  email_normalizado: string | null;
  tamano_empresa: string | null;
  actividad: string | null;
  domicilio_fiscal: string | null;
  codigo_postal: string | null;
  ciudad: string | null;
  telefono: string | null;
  origen: string | null;
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
  numero_bdns: number | null;
  estado: string;
  created_at: string;
  updated_at: string;
}

const estadoBadgeStyles: Record<string, { bg: string; color: string }> = {
  lead_caliente: { bg: 'var(--amber-bg)', color: 'var(--amber)' },
  en_proceso: { bg: 'var(--blue-bg)', color: 'var(--blue)' },
  presentado: { bg: 'var(--blue-bg)', color: 'var(--blue)' },
  resuelto: { bg: 'var(--green-bg)', color: 'var(--green)' },
  descartado: { bg: 'var(--red-bg)', color: 'var(--red)' }
};

const estadoLabels: Record<string, string> = {
  lead_caliente: 'Lead Caliente',
  en_proceso: 'En Proceso',
  presentado: 'Presentado',
  resuelto: 'Resuelto',
  descartado: 'Descartado'
};

export default async function ClienteDetailPage({
  params
}: {
  params: Promise<{ nif: string }>
}) {
  const { nif } = await params;
  const supabase = await createClient();

  // Obtener datos del cliente
  const { data: cliente, error: clienteError } = await supabase
    .from('cliente')
    .select('*')
    .eq('nif', nif)
    .single();

  if (clienteError || !cliente) {
    notFound();
  }

  // Obtener datos de einforma
  const { data: einforma } = await supabase
    .from('einforma')
    .select('*')
    .eq('nif', nif)
    .single();

  // Obtener expedientes del cliente
  const { data: expedientes } = await supabase
    .from('expediente')
    .select('id, numero_bdns, estado, created_at, updated_at')
    .eq('nif', nif)
    .order('created_at', { ascending: false });

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
          {cliente.nombre_normalizado || cliente.nif}
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
            {cliente.tamano_empresa && (
              <InfoRow label="Tamaño" value={cliente.tamano_empresa} />
            )}
            {cliente.domicilio_fiscal && (
              <InfoRow label="Domicilio Fiscal" value={cliente.domicilio_fiscal} />
            )}
            {(cliente.codigo_postal || cliente.ciudad) && (
              <InfoRow 
                label="Ubicación" 
                value={`${cliente.codigo_postal || ''} ${cliente.ciudad || ''}`.trim()} 
              />
            )}
            {cliente.origen && (
              <InfoRow label="Origen" value={cliente.origen} />
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

      {/* Expedientes */}
      <div style={{
        backgroundColor: 'var(--surface)',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: 'var(--s1)',
        border: '1px solid var(--border)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h2 style={{
            fontSize: '18px',
            fontWeight: '700',
            color: 'var(--ink)'
          }}>
            Expedientes
          </h2>
          <button style={{
            backgroundColor: 'var(--teal)',
            color: 'white',
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            boxShadow: 'var(--s1)'
          }}>
            + Nuevo expediente
          </button>
        </div>

        {!expedientes || expedientes.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            color: 'var(--muted)'
          }}>
            <p>No hay expedientes para este cliente</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {expedientes.map((exp: Expediente) => {
              const style = estadoBadgeStyles[exp.estado] || { bg: 'var(--bg)', color: 'var(--ink2)' };
              return (
                <div 
                  key={exp.id}
                  className="table-row"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '16px',
                    border: '1px solid var(--border)',
                    borderRadius: '8px'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--ink)' }}>
                      {exp.numero_bdns ? `BDNS ${exp.numero_bdns}` : `Expediente ${exp.id.slice(0, 8)}`}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                      Creado el {formatDate(exp.created_at)}
                    </div>
                  </div>
                  <span style={{
                    display: 'inline-block',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '600',
                    backgroundColor: style.bg,
                    color: style.color
                  }}>
                    {estadoLabels[exp.estado] || exp.estado}
                  </span>
                </div>
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
