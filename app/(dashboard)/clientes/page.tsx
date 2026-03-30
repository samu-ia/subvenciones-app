'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Search, Plus } from 'lucide-react';

interface Cliente {
  nif: string;
  nombre_empresa: string | null;
  nombre_normalizado: string | null;
  email_normalizado: string | null;
  actividad: string | null;
  cnae_codigo: string | null;
  cnae_descripcion: string | null;
  tamano_empresa: string | null;
  ciudad: string | null;
  comunidad_autonoma: string | null;
  num_empleados: number | null;
  created_at: string;
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [filteredClientes, setFilteredClientes] = useState<Cliente[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/clientes')
      .then(r => r.json())
      .then((data: Cliente[]) => {
        const lista = Array.isArray(data) ? data : [];
        setClientes(lista);
        setFilteredClientes(lista);
      })
      .catch(e => console.error('Error cargando clientes:', e))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!searchTerm) {
      setFilteredClientes(clientes);
    } else {
      const q = searchTerm.toLowerCase();
      const filtered = clientes.filter(c =>
        c.nombre_empresa?.toLowerCase().includes(q) ||
        c.nombre_normalizado?.toLowerCase().includes(q) ||
        c.nif?.toLowerCase().includes(q) ||
        c.actividad?.toLowerCase().includes(q) ||
        c.cnae_descripcion?.toLowerCase().includes(q) ||
        c.ciudad?.toLowerCase().includes(q) ||
        c.comunidad_autonoma?.toLowerCase().includes(q)
      );
      setFilteredClientes(filtered);
    }
  }, [searchTerm, clientes]);

  const tamanoBadge = (t: string | null) => {
    const map: Record<string, { color: string; bg: string; label: string }> = {
      micro:   { color: '#6366f1', bg: '#eef2ff', label: 'Micro' },
      pequena: { color: '#0891b2', bg: '#e0f2fe', label: 'Pequeña' },
      mediana: { color: '#0d9488', bg: '#ccfbf1', label: 'Mediana' },
      grande:  { color: '#7c3aed', bg: '#f5f3ff', label: 'Grande' },
    };
    const s = map[t ?? ''];
    if (!s) return null;
    return (
      <span style={{
        display: 'inline-block', padding: '3px 10px', borderRadius: 20,
        fontSize: 11, fontWeight: 600, color: s.color, background: s.bg,
      }}>{s.label}</span>
    );
  };

  if (loading) {
    return (
      <div style={{ padding: 40, display: 'flex', alignItems: 'center', gap: 12, color: '#64748b' }}>
        <div style={{ width: 20, height: 20, border: '2px solid #e2e8f0', borderTopColor: '#0d9488', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        Cargando clientes...
      </div>
    );
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', marginBottom: 2, letterSpacing: '-0.02em' }}>
            Clientes
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>
            {clientes.length} empresa{clientes.length !== 1 ? 's' : ''} en cartera
          </p>
        </div>
        <Link href="/clientes/nuevo">
          <button style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: '#0d9488', color: 'white',
            padding: '8px 16px', borderRadius: 8, border: 'none',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            <Plus size={14} /> Nuevo cliente
          </button>
        </Link>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: 460, marginBottom: 24 }}>
        <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
        <input
          type="text"
          placeholder="Buscar por nombre, NIF, sector, ciudad..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{
            width: '100%', padding: '10px 14px 10px 40px',
            fontSize: 14, border: '1px solid #e2e8f0', borderRadius: 8,
            background: '#fff', color: '#1e293b', outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Table */}
      {filteredClientes.length === 0 ? (
        <div style={{
          background: '#fff', borderRadius: 12, padding: '64px 32px',
          textAlign: 'center', border: '1px solid #e2e8f0',
        }}>
          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>📋</div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#0d1f3c', marginBottom: 6 }}>
            {searchTerm ? 'Sin resultados' : 'Sin clientes registrados'}
          </h3>
          <p style={{ color: '#94a3b8', fontSize: 14 }}>
            {searchTerm ? 'Prueba otro término' : 'Añade tu primer cliente para empezar'}
          </p>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          {/* Header row */}
          <div style={{
            display: 'grid', gridTemplateColumns: '2fr 0.8fr 1.5fr 0.8fr 1.2fr',
            padding: '10px 20px', background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            fontSize: 11, fontWeight: 700, color: '#94a3b8',
            textTransform: 'uppercase', letterSpacing: '0.5px',
            gap: 16,
          }}>
            <div>Empresa</div>
            <div>NIF</div>
            <div>Sector / CNAE</div>
            <div>Tamaño</div>
            <div>Ubicación</div>
          </div>

          {filteredClientes.map((c, i) => {
            const sector = c.cnae_descripcion || c.actividad;
            const loc = c.ciudad
              ? `${c.ciudad}${c.comunidad_autonoma ? ` · ${c.comunidad_autonoma}` : ''}`
              : c.comunidad_autonoma || '—';

            return (
              <Link key={c.nif} href={`/clientes/${c.nif}`} style={{ textDecoration: 'none' }}>
                <div style={{
                  display: 'grid', gridTemplateColumns: '2fr 0.8fr 1.5fr 0.8fr 1.2fr',
                  padding: '16px 20px', gap: 16, alignItems: 'center',
                  borderBottom: i < filteredClientes.length - 1 ? '1px solid #f1f5f9' : 'none',
                  cursor: 'pointer', transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Empresa */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                      background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, fontWeight: 800, color: '#0891b2',
                    }}>
                      {(c.nombre_empresa || c.nif)[0].toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#0d1f3c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.nombre_empresa || c.nombre_normalizado || c.nif}
                      </div>
                      {c.email_normalizado && (
                        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>{c.email_normalizado}</div>
                      )}
                    </div>
                  </div>

                  {/* NIF */}
                  <div style={{ fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>{c.nif}</div>

                  {/* Sector */}
                  <div style={{ minWidth: 0 }}>
                    {sector ? (
                      <div style={{ fontSize: 13, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.cnae_codigo ? <span style={{ color: '#0891b2', fontWeight: 600 }}>{c.cnae_codigo} · </span> : null}
                        {sector}
                      </div>
                    ) : <span style={{ color: '#cbd5e1', fontSize: 13 }}>—</span>}
                  </div>

                  {/* Tamaño */}
                  <div>{tamanoBadge(c.tamano_empresa)}</div>

                  {/* Ubicación */}
                  <div style={{ fontSize: 13, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {loc}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
