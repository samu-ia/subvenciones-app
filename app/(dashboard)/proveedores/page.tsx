'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Store, Plus, Edit2, X, Check, Loader2,
  Globe, Mail, Phone, Tag, ChevronDown, ToggleLeft, ToggleRight,
} from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Proveedor {
  id: string;
  nombre: string;
  categoria: string;
  descripcion?: string;
  servicios?: string[];
  web?: string;
  contacto_email?: string;
  contacto_nombre?: string;
  precio_referencia?: string;
  activo: boolean;
  created_at: string;
}

const CATEGORIAS: Record<string, { label: string; color: string; bg: string }> = {
  tecnologia:   { label: 'Tecnología',   color: '#1d4ed8', bg: '#eff6ff' },
  consultoria:  { label: 'Consultoría',  color: '#7c3aed', bg: '#f5f3ff' },
  formacion:    { label: 'Formación',    color: '#0891b2', bg: '#ecfeff' },
  equipamiento: { label: 'Equipamiento', color: '#d97706', bg: '#fffbeb' },
  marketing:    { label: 'Marketing',    color: '#db2777', bg: '#fdf2f8' },
  juridico:     { label: 'Jurídico',     color: '#374151', bg: '#f9fafb' },
  financiero:   { label: 'Financiero',   color: '#059669', bg: '#ecfdf5' },
  construccion: { label: 'Construcción', color: '#92400e', bg: '#fffbeb' },
  otros:        { label: 'Otros',        color: '#6b7280', bg: '#f3f4f6' },
};

// ─── Modal edición ─────────────────────────────────────────────────────────────

const FORM_VACIO = {
  nombre: '', categoria: 'tecnologia', descripcion: '',
  servicios: '', web: '', contacto_email: '',
  contacto_nombre: '', precio_referencia: '', activo: true,
};

function ModalProveedor({
  proveedor,
  onClose,
  onSaved,
}: {
  proveedor?: Proveedor | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    nombre: proveedor?.nombre ?? '',
    categoria: proveedor?.categoria ?? 'tecnologia',
    descripcion: proveedor?.descripcion ?? '',
    servicios: (proveedor?.servicios ?? []).join(', '),
    web: proveedor?.web ?? '',
    contacto_email: proveedor?.contacto_email ?? '',
    contacto_nombre: proveedor?.contacto_nombre ?? '',
    precio_referencia: proveedor?.precio_referencia ?? '',
    activo: proveedor?.activo ?? true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function set(k: string, v: string | boolean) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return; }
    setLoading(true); setError('');

    const supabase = createClient();
    const payload = {
      nombre: form.nombre.trim(),
      categoria: form.categoria,
      descripcion: form.descripcion.trim() || null,
      servicios: form.servicios ? form.servicios.split(',').map(s => s.trim()).filter(Boolean) : [],
      web: form.web.trim() || null,
      contacto_email: form.contacto_email.trim() || null,
      contacto_nombre: form.contacto_nombre.trim() || null,
      precio_referencia: form.precio_referencia.trim() || null,
      activo: form.activo,
    };

    const { error: err } = proveedor
      ? await supabase.from('proveedores').update(payload).eq('id', proveedor.id)
      : await supabase.from('proveedores').insert(payload);

    if (err) { setError(err.message); setLoading(false); return; }
    onSaved();
  }

  const field = (label: string, key: string, placeholder?: string, type = 'text') => (
    <div>
      <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>{label}</label>
      <input
        type={type}
        value={form[key as keyof typeof form] as string}
        onChange={e => set(key, e.target.value)}
        placeholder={placeholder}
        style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #e2e8f0', fontSize: '0.83rem', fontFamily: 'inherit', boxSizing: 'border-box' }}
      />
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 580, maxHeight: '90vh', overflowY: 'auto', padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0d1f3c' }}>
            {proveedor ? 'Editar proveedor' : 'Nuevo proveedor'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
        </div>

        <form onSubmit={guardar}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {field('Nombre *', 'nombre', 'Ej: DigitalBridge Solutions')}

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Categoría *</label>
              <select
                value={form.categoria}
                onChange={e => set('categoria', e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #e2e8f0', fontSize: '0.83rem', fontFamily: 'inherit', background: '#fff' }}
              >
                {Object.entries(CATEGORIAS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Descripción</label>
              <textarea
                value={form.descripcion}
                onChange={e => set('descripcion', e.target.value)}
                rows={3}
                placeholder="Describe los servicios principales..."
                style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #e2e8f0', fontSize: '0.83rem', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                Servicios <span style={{ fontWeight: 400, color: '#94a3b8' }}>(separados por comas)</span>
              </label>
              <input
                value={form.servicios}
                onChange={e => set('servicios', e.target.value)}
                placeholder="ERP, CRM, Automatización..."
                style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #e2e8f0', fontSize: '0.83rem', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {field('Contacto', 'contacto_nombre', 'Nombre del responsable')}
              {field('Email', 'contacto_email', 'contacto@empresa.es', 'email')}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {field('Web', 'web', 'https://empresa.es')}
              {field('Precio referencia', 'precio_referencia', 'Desde 500 €/mes')}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ fontSize: '0.83rem', fontWeight: 600, color: '#475569' }}>Activo</label>
              <button type="button" onClick={() => set('activo', !form.activo)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: form.activo ? '#059669' : '#94a3b8' }}>
                {form.activo ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
              </button>
            </div>

            {error && <div style={{ background: '#fef2f2', color: '#dc2626', padding: '8px 12px', borderRadius: 8, fontSize: '0.8rem' }}>{error}</div>}

            <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
              <button type="submit" disabled={loading} style={{ flex: 1, padding: '10px', borderRadius: 8, background: '#0d1f3c', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={14} />}
                Guardar
              </button>
              <button type="button" onClick={onClose} style={{ padding: '10px 18px', borderRadius: 8, background: '#f1f5f9', color: '#475569', border: 'none', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}>
                Cancelar
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Página ────────────────────────────────────────────────────────────────────

export default function ProveedoresPage() {
  const supabase = createClient();
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroCat, setFiltroCat] = useState('');
  const [filtroTexto, setFiltroTexto] = useState('');
  const [modal, setModal] = useState<{ open: boolean; proveedor?: Proveedor | null }>({ open: false });

  const cargar = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('proveedores')
      .select('*')
      .order('nombre');
    setProveedores(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function toggleActivo(p: Proveedor) {
    await supabase.from('proveedores').update({ activo: !p.activo }).eq('id', p.id);
    setProveedores(prev => prev.map(pp => pp.id === p.id ? { ...pp, activo: !pp.activo } : pp));
  }

  const visible = proveedores.filter(p => {
    if (filtroCat && p.categoria !== filtroCat) return false;
    if (filtroTexto) {
      const q = filtroTexto.toLowerCase();
      return p.nombre.toLowerCase().includes(q) || p.descripcion?.toLowerCase().includes(q);
    }
    return true;
  });

  const stats = Object.fromEntries(
    Object.keys(CATEGORIAS).map(k => [k, proveedores.filter(p => p.categoria === k).length])
  );

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#059669,#0d9488)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Store size={18} color="#fff" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: '#0d1f3c' }}>Proveedores</h1>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>Catálogo de colaboradores sugeridos automáticamente en expedientes</p>
            </div>
          </div>
          <button
            onClick={() => setModal({ open: true, proveedor: null })}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 10, background: '#0d1f3c', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem', fontFamily: 'inherit' }}
          >
            <Plus size={15} /> Nuevo proveedor
          </button>
        </div>
      </div>

      {/* Filtros por categoría */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button
          onClick={() => setFiltroCat('')}
          style={{ padding: '5px 14px', borderRadius: 20, border: `1px solid ${!filtroCat ? '#0d1f3c' : '#e2e8f0'}`, background: !filtroCat ? '#0d1f3c' : '#fff', color: !filtroCat ? '#fff' : '#475569', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Todos ({proveedores.length})
        </button>
        {Object.entries(CATEGORIAS).map(([k, v]) => stats[k] > 0 && (
          <button
            key={k}
            onClick={() => setFiltroCat(filtroCat === k ? '' : k)}
            style={{ padding: '5px 14px', borderRadius: 20, border: `1px solid ${filtroCat === k ? v.color : '#e2e8f0'}`, background: filtroCat === k ? v.bg : '#fff', color: filtroCat === k ? v.color : '#475569', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {v.label} ({stats[k]})
          </button>
        ))}
      </div>

      {/* Búsqueda */}
      <div style={{ marginBottom: 18 }}>
        <input
          value={filtroTexto}
          onChange={e => setFiltroTexto(e.target.value)}
          placeholder="Buscar proveedor..."
          style={{ width: 280, padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.83rem', fontFamily: 'inherit' }}
        />
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
          <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : visible.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', border: '2px dashed #e8ecf4', borderRadius: 16 }}>
          <Store size={40} color="#e2e8f0" />
          <p style={{ color: '#94a3b8', marginTop: 12 }}>No hay proveedores{filtroCat ? ' en esta categoría' : ''}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {visible.map(p => {
            const cat = CATEGORIAS[p.categoria] ?? CATEGORIAS.otros;
            return (
              <div
                key={p.id}
                style={{
                  background: '#fff', borderRadius: 14,
                  border: `1px solid ${p.activo ? '#e8ecf4' : '#f1f5f9'}`,
                  padding: '18px 20px',
                  opacity: p.activo ? 1 : 0.55,
                }}
              >
                {/* Header card */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <a href={`/proveedores/${p.id}`} style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0d1f3c', marginBottom: 4, display: 'block', textDecoration: 'none' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#1d4ed8')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#0d1f3c')}>
                      {p.nombre}
                    </a>
                    <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: 20, background: cat.bg, color: cat.color, fontSize: '0.7rem', fontWeight: 700 }}>
                      {cat.label}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => setModal({ open: true, proveedor: p })} style={{ background: '#f8fafc', border: 'none', borderRadius: 7, padding: '6px', cursor: 'pointer', color: '#475569' }}>
                      <Edit2 size={13} />
                    </button>
                    <button onClick={() => toggleActivo(p)} title={p.activo ? 'Desactivar' : 'Activar'} style={{ background: '#f8fafc', border: 'none', borderRadius: 7, padding: '6px', cursor: 'pointer', color: p.activo ? '#059669' : '#94a3b8' }}>
                      {p.activo ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                    </button>
                  </div>
                </div>

                {p.descripcion && (
                  <p style={{ fontSize: '0.78rem', color: '#475569', margin: '0 0 10px', lineHeight: 1.5 }}>
                    {p.descripcion.length > 100 ? p.descripcion.slice(0, 100) + '…' : p.descripcion}
                  </p>
                )}

                {/* Servicios */}
                {p.servicios && p.servicios.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
                    {p.servicios.slice(0, 4).map((s, i) => (
                      <span key={i} style={{ background: '#f8fafc', color: '#64748b', padding: '2px 8px', borderRadius: 6, fontSize: '0.68rem', fontWeight: 500 }}>
                        {s}
                      </span>
                    ))}
                    {p.servicios.length > 4 && (
                      <span style={{ color: '#94a3b8', fontSize: '0.68rem', alignSelf: 'center' }}>+{p.servicios.length - 4}</span>
                    )}
                  </div>
                )}

                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: 10, marginTop: 4 }}>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {p.contacto_nombre && <span>👤 {p.contacto_nombre}</span>}
                    {p.contacto_email && (
                      <a href={`mailto:${p.contacto_email}`} style={{ color: '#3b82f6', textDecoration: 'none' }}>
                        ✉ {p.contacto_email.split('@')[0]}
                      </a>
                    )}
                  </div>
                  {p.precio_referencia && (
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#059669' }}>{p.precio_referencia}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && visible.length > 0 && (
        <div style={{ marginTop: 14, fontSize: '0.78rem', color: '#94a3b8', textAlign: 'right' }}>
          {visible.length} proveedor{visible.length !== 1 ? 'es' : ''}
        </div>
      )}

      {modal.open && (
        <ModalProveedor
          proveedor={modal.proveedor}
          onClose={() => setModal({ open: false })}
          onSaved={() => { setModal({ open: false }); cargar(); }}
        />
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
