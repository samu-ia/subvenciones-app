'use client';

import { useEffect, useState } from 'react';
import { Plus, Layers, Users, Trash2, ChevronDown, ChevronUp, Save, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Proveedor {
  id: string; nombre: string; categoria: string;
  servicios?: string[]; contacto_email?: string; precio_referencia?: string;
}

interface PlantillaProveedor {
  id: string; rol?: string; obligatorio: boolean; orden: number; notas?: string;
  proveedor: Proveedor;
}

interface Plantilla {
  id: string; nombre: string; descripcion?: string; organismo?: string;
  categoria?: string; notas_plantilla?: string; activa: boolean;
  subvencion?: { id: string; titulo: string; organismo: string } | null;
  plantilla_proveedores: PlantillaProveedor[];
  checklist_items?: { id: string; texto: string; completado: boolean }[];
  created_at: string;
}

const CATEGORIAS_PROVEEDOR = ['tecnologia', 'consultoria', 'formacion', 'equipamiento', 'marketing', 'juridico', 'financiero', 'construccion', 'otros'];

const ORGANISMO_SUGERIDOS = [
  'Red.es / Acelera PYME', 'IDAE', 'CDTI', 'ICEX', 'SEPE', 'IMSERSO',
  'Junta de Andalucía', 'Xunta de Galicia', 'Comunidad de Madrid', 'Generalitat Valenciana',
  'Comisión Europea (FEDER)', 'Comisión Europea (EIC/Horizon)',
];

export default function PlantillasPage() {
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({
    nombre: '', descripcion: '', organismo: '', categoria: '', notas_plantilla: '',
  });
  const [newProveedores, setNewProveedores] = useState<{ proveedor_id: string; rol: string; obligatorio: boolean }[]>([]);
  const [saving, setSaving] = useState(false);
  const [filterCat, setFilterCat] = useState('');

  const reload = async () => {
    const [pRes, provRes] = await Promise.all([
      fetch('/api/plantillas'),
      fetch('/api/plantillas').then(() => null), // dummy
    ]);
    setPlantillas(pRes.ok ? await pRes.json() : []);
    setLoading(false);
  };

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      fetch('/api/plantillas').then(r => r.json()),
      supabase.from('proveedores').select('id, nombre, categoria, servicios, contacto_email, precio_referencia').eq('activo', true).order('nombre'),
    ]).then(([plants, { data: provs }]) => {
      setPlantillas(plants ?? []);
      setProveedores(provs ?? []);
      setLoading(false);
    });
  }, []);

  const reloadPlantillas = () => {
    fetch('/api/plantillas').then(r => r.json()).then(setPlantillas);
  };

  const crearPlantilla = async () => {
    if (!newForm.nombre.trim()) return;
    setSaving(true);
    const body = { ...newForm, proveedores: newProveedores };
    const res = await fetch('/api/plantillas', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setShowNew(false);
      setNewForm({ nombre: '', descripcion: '', organismo: '', categoria: '', notas_plantilla: '' });
      setNewProveedores([]);
      reloadPlantillas();
    }
    setSaving(false);
  };

  const eliminarPlantilla = async (id: string) => {
    if (!confirm('¿Desactivar esta plantilla?')) return;
    await fetch(`/api/plantillas/${id}`, { method: 'DELETE' });
    reloadPlantillas();
  };

  const addProveedor = (proveedorId: string) => {
    if (newProveedores.find(p => p.proveedor_id === proveedorId)) return;
    setNewProveedores(prev => [...prev, { proveedor_id: proveedorId, rol: 'implementador', obligatorio: false }]);
  };

  const filtered = plantillas.filter(p => !filterCat || p.categoria === filterCat || p.organismo?.includes(filterCat));
  const cats = [...new Set(plantillas.map(p => p.categoria).filter(Boolean))];

  const CAT_COLORS: Record<string, string> = {
    digitalizacion: '#3b82f6', energia: '#059669', innovacion: '#8b5cf6',
    empleo: '#f59e0b', internacionalizacion: '#06b6d4', social: '#ec4899',
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#94a3b8' }}>
      Cargando plantillas...
    </div>
  );

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0d1f3c', marginBottom: 4 }}>
            Plantillas por subvención
          </h1>
          <p style={{ fontSize: '0.83rem', color: '#64748b', maxWidth: 520 }}>
            Configura para cada tipo de subvención qué proveedores recomendar. Cuando crees un expediente, se aplicarán automáticamente.
          </p>
        </div>
        <button
          onClick={() => setShowNew(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px',
            background: showNew ? '#f1f5f9' : '#0d1f3c', color: showNew ? '#475569' : '#fff',
            border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', fontFamily: 'inherit',
          }}
        >
          {showNew ? <X size={14} /> : <Plus size={14} />}
          {showNew ? 'Cancelar' : 'Nueva plantilla'}
        </button>
      </div>

      {/* Nuevo formulario */}
      {showNew && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 20, marginBottom: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0d1f3c', marginBottom: 14 }}>Nueva plantilla</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            {[
              { key: 'nombre', label: 'Nombre *', placeholder: 'Ej: Kit Digital — Segmento II' },
              { key: 'organismo', label: 'Organismo', placeholder: 'Ej: Red.es / Acelera PYME' },
              { key: 'categoria', label: 'Categoría', placeholder: 'digitalizacion, energia, innovacion...' },
              { key: 'descripcion', label: 'Descripción', placeholder: 'Para qué tipo de empresas aplica...' },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>{label}</label>
                <input
                  value={(newForm as Record<string, string>)[key]}
                  onChange={e => setNewForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  style={{ width: '100%', fontSize: '0.82rem', border: '1px solid #e2e8f0', borderRadius: 8, padding: '7px 10px', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              </div>
            ))}
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Notas para el gestor</label>
            <textarea
              value={newForm.notas_plantilla}
              onChange={e => setNewForm(f => ({ ...f, notas_plantilla: e.target.value }))}
              placeholder="Requisitos especiales, consejos, advertencias..."
              rows={2}
              style={{ width: '100%', fontSize: '0.82rem', border: '1px solid #e2e8f0', borderRadius: 8, padding: '7px 10px', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
          </div>

          {/* Seleccionar proveedores */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0d1f3c', marginBottom: 8 }}>
              Proveedores recomendados
            </div>
            {newProveedores.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                {newProveedores.map((np, i) => {
                  const prov = proveedores.find(p => p.id === np.proveedor_id);
                  return (
                    <div key={np.proveedor_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#f0fdf4', borderRadius: 8, marginBottom: 5 }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#065f46', flex: 1 }}>{prov?.nombre}</span>
                      <input
                        value={np.rol}
                        onChange={e => setNewProveedores(prev => prev.map((p, idx) => idx === i ? { ...p, rol: e.target.value } : p))}
                        placeholder="rol"
                        style={{ fontSize: '0.68rem', border: '1px solid #d1fae5', borderRadius: 6, padding: '2px 6px', width: 100, fontFamily: 'inherit' }}
                      />
                      <label style={{ fontSize: '0.68rem', color: '#475569', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                        <input type="checkbox" checked={np.obligatorio} onChange={e => setNewProveedores(prev => prev.map((p, idx) => idx === i ? { ...p, obligatorio: e.target.checked } : p))} />
                        Obligatorio
                      </label>
                      <button onClick={() => setNewProveedores(prev => prev.filter((_, idx) => idx !== i))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                        <X size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            <select
              onChange={e => { if (e.target.value) { addProveedor(e.target.value); e.target.value = ''; } }}
              style={{ fontSize: '0.78rem', border: '1px dashed #cbd5e1', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontFamily: 'inherit', background: '#fafbfc', color: '#475569' }}
            >
              <option value="">+ Añadir proveedor...</option>
              {CATEGORIAS_PROVEEDOR.map(cat => {
                const provsCat = proveedores.filter(p => p.categoria === cat && !newProveedores.find(np => np.proveedor_id === p.id));
                if (provsCat.length === 0) return null;
                return (
                  <optgroup key={cat} label={cat.charAt(0).toUpperCase() + cat.slice(1)}>
                    {provsCat.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </optgroup>
                );
              })}
            </select>
            {proveedores.length === 0 && (
              <p style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 6 }}>
                No hay proveedores activos. <a href="/dashboard/proveedores" style={{ color: '#3b82f6' }}>Añadir proveedores →</a>
              </p>
            )}
          </div>

          <button
            onClick={crearPlantilla}
            disabled={saving || !newForm.nombre.trim()}
            style={{
              padding: '9px 20px', background: '#0d1f3c', color: '#fff', border: 'none', borderRadius: 9,
              cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', fontFamily: 'inherit',
              opacity: saving || !newForm.nombre.trim() ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <Save size={14} /> {saving ? 'Guardando...' : 'Crear plantilla'}
          </button>
        </div>
      )}

      {/* Filtros */}
      {cats.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          <button onClick={() => setFilterCat('')} style={{
            fontSize: '0.72rem', padding: '4px 10px', borderRadius: 20, border: '1px solid #e2e8f0',
            background: !filterCat ? '#0d1f3c' : '#fff', color: !filterCat ? '#fff' : '#64748b',
            cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
          }}>Todas</button>
          {cats.map(cat => (
            <button key={cat} onClick={() => setFilterCat(cat === filterCat ? '' : cat!)} style={{
              fontSize: '0.72rem', padding: '4px 10px', borderRadius: 20, border: '1px solid #e2e8f0',
              background: filterCat === cat ? '#0d1f3c' : '#fff', color: filterCat === cat ? '#fff' : '#64748b',
              cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
            }}>{cat}</button>
          ))}
        </div>
      )}

      {/* Lista de plantillas */}
      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 24px', color: '#94a3b8' }}>
          <Layers size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
          <p style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 4 }}>Sin plantillas todavía</p>
          <p style={{ fontSize: '0.82rem' }}>Crea una plantilla para cada tipo de subvención que gestionas habitualmente.</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(plantilla => {
          const isExpanded = expanded === plantilla.id;
          return (
            <div key={plantilla.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 13, overflow: 'hidden', transition: 'box-shadow 0.15s', boxShadow: isExpanded ? '0 4px 16px rgba(0,0,0,0.08)' : '0 1px 4px rgba(0,0,0,0.04)' }}>
              {/* Header */}
              <div
                style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', cursor: 'pointer', gap: 12 }}
                onClick={() => setExpanded(isExpanded ? null : plantilla.id)}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0d1f3c' }}>{plantilla.nombre}</span>
                    {plantilla.categoria && (
                      <span style={{
                        fontSize: '0.63rem', fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                        background: (CAT_COLORS[plantilla.categoria] ?? '#94a3b8') + '18',
                        color: CAT_COLORS[plantilla.categoria] ?? '#94a3b8',
                      }}>
                        {plantilla.categoria}
                      </span>
                    )}
                    {plantilla.organismo && (
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{plantilla.organismo}</span>
                    )}
                  </div>
                  {plantilla.descripcion && (
                    <p style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 3 }}>{plantilla.descripcion}</p>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  {plantilla.plantilla_proveedores.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: '#64748b' }}>
                      <Users size={13} />
                      {plantilla.plantilla_proveedores.length} proveedor{plantilla.plantilla_proveedores.length !== 1 ? 'es' : ''}
                    </div>
                  )}
                  {isExpanded ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
                </div>
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <div style={{ borderTop: '1px solid #f1f5f9', padding: '14px 18px 18px' }}>
                  {plantilla.notas_plantilla && (
                    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: '0.78rem', color: '#92400e' }}>
                      💡 {plantilla.notas_plantilla}
                    </div>
                  )}

                  <div style={{ fontSize: '0.73rem', fontWeight: 700, color: '#0d1f3c', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Users size={13} /> Proveedores recomendados
                  </div>

                  {plantilla.plantilla_proveedores.length === 0 ? (
                    <p style={{ fontSize: '0.78rem', color: '#94a3b8', fontStyle: 'italic' }}>Sin proveedores configurados.</p>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
                      {plantilla.plantilla_proveedores
                        .sort((a, b) => a.orden - b.orden)
                        .map(pp => (
                          <div key={pp.id} style={{ background: '#f8fafc', border: '1px solid #e8ecf4', borderRadius: 10, padding: '10px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0d1f3c', flex: 1 }}>{pp.proveedor.nombre}</span>
                              {pp.obligatorio && (
                                <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#dc2626', background: '#fee2e2', padding: '1px 6px', borderRadius: 8 }}>Obligatorio</span>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.65rem', background: '#e0f2fe', color: '#0369a1', padding: '2px 7px', borderRadius: 8 }}>{pp.proveedor.categoria}</span>
                              {pp.rol && <span style={{ fontSize: '0.65rem', background: '#f0fdf4', color: '#065f46', padding: '2px 7px', borderRadius: 8 }}>{pp.rol}</span>}
                            </div>
                            {pp.proveedor.servicios && pp.proveedor.servicios.length > 0 && (
                              <p style={{ fontSize: '0.68rem', color: '#64748b', marginTop: 4 }}>
                                {pp.proveedor.servicios.slice(0, 2).join(', ')}
                              </p>
                            )}
                            {pp.proveedor.precio_referencia && (
                              <p style={{ fontSize: '0.68rem', color: '#059669', fontWeight: 600, marginTop: 3 }}>
                                {pp.proveedor.precio_referencia}
                              </p>
                            )}
                            {pp.proveedor.contacto_email && (
                              <a href={`mailto:${pp.proveedor.contacto_email}`} style={{ fontSize: '0.65rem', color: '#3b82f6', textDecoration: 'none', display: 'block', marginTop: 4 }}>
                                ✉ {pp.proveedor.contacto_email}
                              </a>
                            )}
                          </div>
                        ))}
                    </div>
                  )}

                  <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => eliminarPlantilla(plantilla.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', border: '1px solid #fecaca', borderRadius: 8, background: '#fff', color: '#dc2626', cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'inherit' }}
                    >
                      <Trash2 size={12} /> Desactivar
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
