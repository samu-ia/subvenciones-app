'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Phone, Mail, Globe, MapPin, ChevronDown, X, Check } from 'lucide-react';

interface Prospecto {
  id: string;
  nombre_empresa: string;
  nif?: string;
  sector?: string;
  ciudad?: string;
  provincia?: string;
  telefono?: string;
  email?: string;
  web?: string;
  contacto_nombre?: string;
  estado: string;
  notas?: string;
  fecha_contacto?: string;
  proxima_accion?: string;
  fecha_proxima?: string;
  potencial_eur?: number;
  origen?: string;
  created_at: string;
  updated_at: string;
}

const ESTADOS: Record<string, { label: string; color: string; bg: string }> = {
  nuevo:       { label: 'Nuevo',        color: '#64748b', bg: '#f1f5f9' },
  contactado:  { label: 'Contactado',   color: '#2563eb', bg: '#eff6ff' },
  interesado:  { label: 'Interesado',   color: '#d97706', bg: '#fffbeb' },
  reunion:     { label: 'Reunión',      color: '#7c3aed', bg: '#f5f3ff' },
  cliente:     { label: 'Cliente',      color: '#059669', bg: '#f0fdf4' },
  descartado:  { label: 'Descartado',   color: '#dc2626', bg: '#fef2f2' },
};

const EMPTY_FORM = {
  nombre_empresa: '', nif: '', sector: '', ciudad: '', provincia: '',
  telefono: '', email: '', web: '', contacto_nombre: '',
  estado: 'nuevo', notas: '', proxima_accion: '', fecha_proxima: '', potencial_eur: '',
};

export default function ProspectosPage() {
  const [prospectos, setProspectos] = useState<Prospecto[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filtroEstado) params.set('estado', filtroEstado);
    if (q) params.set('q', q);
    const res = await fetch(`/api/admin/prospectos?${params}`);
    if (res.ok) {
      const data = await res.json();
      setProspectos(data.prospectos ?? []);
    }
    setLoading(false);
  }, [filtroEstado, q]);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setForm(EMPTY_FORM);
    setEditId(null);
    setShowForm(true);
  }

  function openEdit(p: Prospecto) {
    setForm({
      nombre_empresa: p.nombre_empresa ?? '',
      nif: p.nif ?? '',
      sector: p.sector ?? '',
      ciudad: p.ciudad ?? '',
      provincia: p.provincia ?? '',
      telefono: p.telefono ?? '',
      email: p.email ?? '',
      web: p.web ?? '',
      contacto_nombre: p.contacto_nombre ?? '',
      estado: p.estado ?? 'nuevo',
      notas: p.notas ?? '',
      proxima_accion: p.proxima_accion ?? '',
      fecha_proxima: p.fecha_proxima ?? '',
      potencial_eur: p.potencial_eur ? String(p.potencial_eur) : '',
    });
    setEditId(p.id);
    setShowForm(true);
    setSelected(p.id);
  }

  async function save() {
    if (!form.nombre_empresa.trim()) return;
    setSaving(true);
    const payload = { ...form, potencial_eur: form.potencial_eur ? Number(form.potencial_eur) : null };
    const res = editId
      ? await fetch(`/api/admin/prospectos/${editId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      : await fetch('/api/admin/prospectos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (res.ok) {
      setShowForm(false);
      load();
    }
    setSaving(false);
  }

  async function cambiarEstado(id: string, nuevoEstado: string) {
    await fetch(`/api/admin/prospectos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: nuevoEstado, fecha_contacto: new Date().toISOString() }),
    });
    load();
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar este prospecto?')) return;
    await fetch(`/api/admin/prospectos/${id}`, { method: 'DELETE' });
    load();
  }

  const counts = Object.fromEntries(
    Object.keys(ESTADOS).map(e => [e, prospectos.filter(p => p.estado === e).length])
  );
  const totalPotencial = prospectos.reduce((s, p) => s + (p.potencial_eur ?? 0), 0);

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0d1f3c', margin: 0 }}>CRM Prospectos</h1>
          <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '4px 0 0' }}>
            {prospectos.length} empresas · Potencial total: {totalPotencial > 0 ? `${totalPotencial.toLocaleString('es-ES')} €` : 'sin calcular'}
          </p>
        </div>
        <button
          onClick={openNew}
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#0d9488', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem' }}
        >
          <Plus size={16} /> Nuevo prospecto
        </button>
      </div>

      {/* Stats por estado */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10, marginBottom: 24 }}>
        {Object.entries(ESTADOS).map(([k, v]) => (
          <button
            key={k}
            onClick={() => setFiltroEstado(filtroEstado === k ? '' : k)}
            style={{
              padding: '10px 12px', borderRadius: 12, border: `2px solid ${filtroEstado === k ? v.color : '#e2e8f0'}`,
              background: filtroEstado === k ? v.bg : '#fff', cursor: 'pointer', textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: v.color }}>{counts[k] ?? 0}</div>
            <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b' }}>{v.label}</div>
          </button>
        ))}
      </div>

      {/* Búsqueda */}
      <div style={{ position: 'relative', marginBottom: 20 }}>
        <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Buscar por empresa, contacto, ciudad..."
          style={{ width: '100%', padding: '10px 12px 10px 34px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box' }}
        />
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>Cargando...</div>
      ) : prospectos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>No hay prospectos{filtroEstado ? ` en estado "${ESTADOS[filtroEstado]?.label}"` : ''}.</p>
          <button onClick={openNew} style={{ marginTop: 12, background: '#0d9488', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 700 }}>
            Añadir primer prospecto
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {prospectos.map(p => {
            const est = ESTADOS[p.estado] ?? ESTADOS.nuevo;
            return (
              <div
                key={p.id}
                style={{ background: '#fff', borderRadius: 14, border: `1px solid ${selected === p.id ? '#0d9488' : '#e2e8f0'}`, padding: '16px 20px', boxShadow: '0 1px 4px rgba(13,31,60,0.06)' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                  {/* Info principal */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0d1f3c' }}>{p.nombre_empresa}</span>
                      {p.nif && <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{p.nif}</span>}
                      <span style={{ background: est.bg, color: est.color, borderRadius: 20, padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700 }}>{est.label}</span>
                      {p.potencial_eur && p.potencial_eur > 0 && (
                        <span style={{ background: '#f0fdf4', color: '#059669', borderRadius: 20, padding: '2px 8px', fontSize: '0.72rem', fontWeight: 700 }}>
                          ~{p.potencial_eur.toLocaleString('es-ES')} €
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: '0.78rem', color: '#64748b' }}>
                      {p.sector && <span>{p.sector}</span>}
                      {p.ciudad && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={11} />{p.ciudad}{p.provincia ? `, ${p.provincia}` : ''}</span>}
                      {p.contacto_nombre && <span>👤 {p.contacto_nombre}</span>}
                      {p.telefono && <a href={`tel:${p.telefono}`} style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#2563eb', textDecoration: 'none' }}><Phone size={11} />{p.telefono}</a>}
                      {p.email && <a href={`mailto:${p.email}`} style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#2563eb', textDecoration: 'none' }}><Mail size={11} />{p.email}</a>}
                      {p.web && <a href={p.web} target="_blank" rel="noopener" style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#2563eb', textDecoration: 'none' }}><Globe size={11} />web</a>}
                    </div>
                    {p.proxima_accion && (
                      <div style={{ marginTop: 6, fontSize: '0.78rem', color: '#7c3aed', background: '#f5f3ff', borderRadius: 6, padding: '4px 10px', display: 'inline-block' }}>
                        → {p.proxima_accion}{p.fecha_proxima ? ` · ${new Date(p.fecha_proxima).toLocaleDateString('es-ES')}` : ''}
                      </div>
                    )}
                    {p.notas && <p style={{ marginTop: 8, fontSize: '0.78rem', color: '#475569', fontStyle: 'italic' }}>{p.notas}</p>}
                  </div>

                  {/* Acciones rápidas */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                    {/* Cambiar estado */}
                    <select
                      value={p.estado}
                      onChange={e => cambiarEstado(p.id, e.target.value)}
                      style={{ fontSize: '0.75rem', border: '1px solid #e2e8f0', borderRadius: 8, padding: '5px 8px', cursor: 'pointer', background: '#f8fafc' }}
                    >
                      {Object.entries(ESTADOS).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => openEdit(p)}
                        style={{ flex: 1, padding: '5px 10px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.75rem', cursor: 'pointer', color: '#475569', fontWeight: 600 }}
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => eliminar(p.id)}
                        style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', fontSize: '0.75rem', cursor: 'pointer', color: '#dc2626' }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Formulario modal */}
      {showForm && (
        <div
          onClick={() => setShowForm(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(13,31,60,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 560, maxHeight: '90vh', overflow: 'auto', padding: '28px 32px', boxShadow: '0 24px 80px rgba(13,31,60,0.2)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0d1f3c' }}>
                {editId ? 'Editar prospecto' : 'Nuevo prospecto'}
              </h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { key: 'nombre_empresa', label: 'Empresa *', placeholder: 'Razón social', required: true },
                { key: 'nif', label: 'NIF/CIF', placeholder: 'B12345678' },
                { key: 'sector', label: 'Sector', placeholder: 'Hostelería, Industria, etc.' },
                { key: 'contacto_nombre', label: 'Contacto', placeholder: 'Nombre del responsable' },
                { key: 'telefono', label: 'Teléfono', placeholder: '600 123 456' },
                { key: 'email', label: 'Email', placeholder: 'contacto@empresa.com' },
                { key: 'web', label: 'Web', placeholder: 'https://empresa.com' },
                { key: 'ciudad', label: 'Ciudad', placeholder: 'Madrid' },
                { key: 'provincia', label: 'Provincia', placeholder: 'Madrid' },
                { key: 'potencial_eur', label: 'Potencial estimado (€)', placeholder: '50000' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</label>
                  <input
                    value={(form as Record<string, string>)[key] ?? ''}
                    onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                    placeholder={placeholder}
                    style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              ))}

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: 5, textTransform: 'uppercase' }}>Estado</label>
                <select
                  value={form.estado}
                  onChange={e => setForm(p => ({ ...p, estado: e.target.value }))}
                  style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: '0.88rem', background: '#fff' }}
                >
                  {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: 5, textTransform: 'uppercase' }}>Próxima acción</label>
                <input
                  value={form.proxima_accion}
                  onChange={e => setForm(p => ({ ...p, proxima_accion: e.target.value }))}
                  placeholder="Llamar para seguimiento"
                  style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: 5, textTransform: 'uppercase' }}>Fecha próxima acción</label>
                <input
                  type="date"
                  value={form.fecha_proxima}
                  onChange={e => setForm(p => ({ ...p, fecha_proxima: e.target.value }))}
                  style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: 5, textTransform: 'uppercase' }}>Notas</label>
                <textarea
                  value={form.notas}
                  onChange={e => setForm(p => ({ ...p, notas: e.target.value }))}
                  placeholder="Observaciones, necesidades, intereses..."
                  rows={3}
                  style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>

              <button
                onClick={save}
                disabled={saving || !form.nombre_empresa.trim()}
                style={{
                  padding: '13px', borderRadius: 10, border: 'none',
                  background: form.nombre_empresa.trim() ? '#0d9488' : '#e2e8f0',
                  color: form.nombre_empresa.trim() ? '#fff' : '#94a3b8',
                  fontWeight: 700, fontSize: '0.9rem', cursor: form.nombre_empresa.trim() ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {saving ? 'Guardando...' : <><Check size={16} /> {editId ? 'Actualizar' : 'Crear prospecto'}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
