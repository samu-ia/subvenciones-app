'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const CCAA = [
  'Andalucía','Aragón','Asturias','Baleares','Canarias','Cantabria',
  'Castilla-La Mancha','Castilla y León','Cataluña','Extremadura',
  'Galicia','La Rioja','Madrid','Murcia','Navarra','País Vasco','Valencia',
  'Ceuta','Melilla',
];

export default function NuevoClientePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    nif: '',
    nombre_empresa: '',
    email_normalizado: '',
    telefono: '',
    tamano_empresa: '',
    actividad: '',
    cnae_codigo: '',
    cnae_descripcion: '',
    num_empleados: '',
    facturacion_anual: '',
    domicilio_fiscal: '',
    codigo_postal: '',
    ciudad: '',
    comunidad_autonoma: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!formData.nif.trim()) {
      setError('El NIF es obligatorio');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          num_empleados:     formData.num_empleados     ? Number(formData.num_empleados)     : undefined,
          facturacion_anual: formData.facturacion_anual ? Number(formData.facturacion_anual) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al crear el cliente');
      router.push(`/clientes/${formData.nif.toUpperCase().trim()}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error creando el cliente');
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '10px 14px', borderRadius: '8px',
    border: '1px solid var(--border)', fontSize: '14px',
    color: 'var(--ink)', backgroundColor: 'var(--surface)',
    outline: 'none', boxSizing: 'border-box' as const,
  };
  const labelStyle = {
    display: 'block', fontSize: '12px', fontWeight: '600' as const,
    color: 'var(--ink2)', marginBottom: '6px', textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
  };

  return (
    <div style={{ padding: '32px', maxWidth: '720px', margin: '0 auto' }}>
      <div style={{ marginBottom: '28px' }}>
        <Link href="/clientes" style={{ color: 'var(--teal)', fontSize: '13px', fontWeight: '600', textDecoration: 'none' }}>
          ← Volver a clientes
        </Link>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--ink)', marginTop: '12px', marginBottom: '4px' }}>
          Nuevo Cliente
        </h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '28px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {error && (
            <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red)', color: 'var(--red)', padding: '12px 16px', borderRadius: '8px', fontSize: '14px' }}>
              {error}
            </div>
          )}

          {/* NIF */}
          <div>
            <label style={labelStyle}>NIF / CIF *</label>
            <input
              type="text"
              name="nif"
              required
              value={formData.nif}
              onChange={handleChange}
              placeholder="B12345678"
              style={{ ...inputStyle, textTransform: 'uppercase' }}
            />
          </div>

          {/* Nombre */}
          <div>
            <label style={labelStyle}>Nombre / Razón Social</label>
            <input type="text" name="nombre_empresa" value={formData.nombre_empresa}
              onChange={handleChange} placeholder="Nombre completo o razón social" style={inputStyle} />
          </div>

          {/* Email y Teléfono */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Email</label>
              <input type="email" name="email_normalizado" value={formData.email_normalizado}
                onChange={handleChange} placeholder="email@empresa.com" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Teléfono</label>
              <input type="tel" name="telefono" value={formData.telefono}
                onChange={handleChange} placeholder="600 123 456" style={inputStyle} />
            </div>
          </div>

          {/* Actividad y Tamaño */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Actividad / Sector</label>
              <input type="text" name="actividad" value={formData.actividad}
                onChange={handleChange} placeholder="Sector o actividad principal" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Tamaño Empresa</label>
              <select name="tamano_empresa" value={formData.tamano_empresa} onChange={handleChange} style={inputStyle}>
                <option value="">Seleccionar...</option>
                <option value="Microempresa">Microempresa (&lt; 10 empleados)</option>
                <option value="Pequeña">Pequeña (10–49)</option>
                <option value="Mediana">Mediana (50–249)</option>
                <option value="Grande">Grande (250+)</option>
              </select>
            </div>
          </div>

          {/* CNAE */}
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Código CNAE</label>
              <input type="text" name="cnae_codigo" value={formData.cnae_codigo}
                onChange={handleChange} placeholder="6201" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Descripción CNAE</label>
              <input type="text" name="cnae_descripcion" value={formData.cnae_descripcion}
                onChange={handleChange} placeholder="Ej: Actividades de programación informática" style={inputStyle} />
            </div>
          </div>

          {/* Empleados y Facturación */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Empleados</label>
              <input type="number" name="num_empleados" value={formData.num_empleados}
                onChange={handleChange} placeholder="0" min="0" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Facturación anual (€)</label>
              <input type="number" name="facturacion_anual" value={formData.facturacion_anual}
                onChange={handleChange} placeholder="0" min="0" style={inputStyle} />
            </div>
          </div>

          {/* Dirección */}
          <div>
            <label style={labelStyle}>Domicilio Fiscal</label>
            <input type="text" name="domicilio_fiscal" value={formData.domicilio_fiscal}
              onChange={handleChange} placeholder="Calle, número..." style={inputStyle} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>C.P.</label>
              <input type="text" name="codigo_postal" value={formData.codigo_postal}
                onChange={handleChange} placeholder="28001" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Ciudad</label>
              <input type="text" name="ciudad" value={formData.ciudad}
                onChange={handleChange} placeholder="Madrid" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Comunidad Autónoma</label>
              <select name="comunidad_autonoma" value={formData.comunidad_autonoma} onChange={handleChange} style={inputStyle}>
                <option value="">Seleccionar...</option>
                {CCAA.map(cc => <option key={cc} value={cc}>{cc}</option>)}
              </select>
            </div>
          </div>

          {/* Botones */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
            <Link href="/clientes">
              <button type="button" style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px', fontWeight: '600', cursor: 'pointer', background: 'var(--surface)', color: 'var(--ink2)' }}>
                Cancelar
              </button>
            </Link>
            <button type="submit" disabled={loading} style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', fontSize: '14px', fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer', background: loading ? 'var(--muted)' : 'var(--teal)', color: '#fff' }}>
              {loading ? 'Guardando...' : 'Crear Cliente'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
