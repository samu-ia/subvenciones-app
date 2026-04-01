'use client';

/**
 * /sector-scan — Radar de oportunidades por CNAE + zona
 *
 * Herramienta de ventas: antes de hablar con un prospecto,
 * detecta qué subvenciones activas hay para su sector y comunidad.
 * No necesita NIF.
 */

import { useState } from 'react';
import Link from 'next/link';

const CNAES_COMUNES = [
  { codigo: '5610', nombre: 'Restaurantes y puestos de comida' },
  { codigo: '5630', nombre: 'Establecimientos de bebidas (bares)' },
  { codigo: '5510', nombre: 'Hoteles y alojamientos similares' },
  { codigo: '4711', nombre: 'Comercio al por menor (alimentación)' },
  { codigo: '4759', nombre: 'Comercio al por menor (equipamiento hogar)' },
  { codigo: '4532', nombre: 'Comercio recambios y accesorios vehículos' },
  { codigo: '6201', nombre: 'Programación informática' },
  { codigo: '7010', nombre: 'Actividades de las sedes centrales' },
  { codigo: '4110', nombre: 'Promoción inmobiliaria' },
  { codigo: '4120', nombre: 'Construcción de edificios' },
  { codigo: '4321', nombre: 'Instalaciones eléctricas' },
  { codigo: '4941', nombre: 'Transporte de mercancías por carretera' },
  { codigo: '8621', nombre: 'Consultas médicas generales' },
  { codigo: '9602', nombre: 'Peluquería y otros tratamientos de belleza' },
  { codigo: '0111', nombre: 'Cultivos no perennes (agricultura)' },
  { codigo: '0311', nombre: 'Pesca marina' },
];

const CAS = [
  'Galicia', 'Madrid', 'Cataluña', 'Andalucía', 'Valencia',
  'Castilla y León', 'País Vasco', 'Canarias', 'Aragón', 'Murcia',
  'Extremadura', 'Asturias', 'Baleares', 'Navarra', 'Cantabria',
  'La Rioja', 'Castilla-La Mancha',
];

interface Resultado {
  id: string;
  titulo: string;
  organismo: string | null;
  ambito: string | null;
  importe_maximo: number | null;
  porcentaje_financiacion: number | null;
  plazo_fin: string | null;
  estado_convocatoria: string | null;
  encaje: 'directo' | 'probable' | 'posible';
  encaje_razon: string;
  dias_plazo: number | null;
  objeto: string | null;
}

interface ScanResult {
  query: { cnae: string; ca: string; tamano: string };
  resumen: {
    total_encontradas: number;
    directas: number;
    probables: number;
    importe_maximo_total: number;
    mensaje_ventas: string;
  };
  resultados: Resultado[];
}

function fmtImporte(n: number | null) {
  if (!n) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M €`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K €`;
  return `${n} €`;
}

const ENCAJE_COLORS = {
  directo: { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534', badge: '#dcfce7', badgeText: '#166534' },
  probable: { bg: '#fffbeb', border: '#fde68a', text: '#92400e', badge: '#fef3c7', badgeText: '#92400e' },
  posible: { bg: '#f8fafc', border: '#e2e8f0', text: '#475569', badge: '#f1f5f9', badgeText: '#64748b' },
};

export default function SectorScanPage() {
  const [cnae, setCnae] = useState('');
  const [ca, setCa] = useState('');
  const [tamano, setTamano] = useState('pyme');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState('');
  const [copiado, setCopiado] = useState(false);

  async function buscar() {
    if (!cnae.trim()) { setError('Introduce un código CNAE'); return; }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const params = new URLSearchParams({ cnae: cnae.trim(), tamano });
      if (ca) params.set('ca', ca);
      const res = await fetch(`/api/admin/sector-scan?${params}`);
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Error al buscar'); return; }
      setResult(await res.json());
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  }

  function copiarMensaje() {
    if (!result) return;
    navigator.clipboard.writeText(result.resumen.mensaje_ventas);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div style={{ padding: '32px', maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0d1f3c', margin: '0 0 8px' }}>
        Radar de oportunidades
      </h1>
      <p style={{ color: '#64748b', margin: '0 0 32px', fontSize: '0.9rem' }}>
        Detecta subvenciones activas para un sector y zona. Úsalo antes de llamar a un prospecto.
      </p>

      {/* Formulario */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              CNAE *
            </label>
            <input
              value={cnae}
              onChange={e => setCnae(e.target.value)}
              placeholder="ej: 5610"
              list="cnae-list"
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem', boxSizing: 'border-box' }}
              onKeyDown={e => e.key === 'Enter' && buscar()}
            />
            <datalist id="cnae-list">
              {CNAES_COMUNES.map(c => (
                <option key={c.codigo} value={c.codigo}>{c.nombre}</option>
              ))}
            </datalist>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Comunidad autónoma
            </label>
            <select
              value={ca}
              onChange={e => setCa(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem', boxSizing: 'border-box' }}
            >
              <option value="">Toda España</option>
              {CAS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Tamaño empresa
            </label>
            <select
              value={tamano}
              onChange={e => setTamano(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem', boxSizing: 'border-box' }}
            >
              <option value="micropyme">Micropyme (≤10 empl.)</option>
              <option value="pyme">PYME (≤250 empl.)</option>
              <option value="grande">Gran empresa</option>
              <option value="autonomo">Autónomo</option>
            </select>
          </div>

          <button
            onClick={buscar}
            disabled={loading}
            style={{ padding: '10px 24px', background: loading ? '#94a3b8' : '#0d1f3c', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.9rem', whiteSpace: 'nowrap' }}
          >
            {loading ? 'Buscando...' : 'Buscar'}
          </button>
        </div>

        {/* Accesos rápidos CNAE */}
        <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {CNAES_COMUNES.slice(0, 8).map(c => (
            <button
              key={c.codigo}
              onClick={() => setCnae(c.codigo)}
              style={{ padding: '4px 10px', background: cnae === c.codigo ? '#0d1f3c' : '#f1f5f9', color: cnae === c.codigo ? '#fff' : '#475569', border: 'none', borderRadius: 20, fontSize: '0.75rem', cursor: 'pointer', fontWeight: cnae === c.codigo ? 700 : 400 }}
            >
              {c.codigo} — {c.nombre.split(' ').slice(0, 2).join(' ')}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', color: '#dc2626', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {result && (
        <>
          {/* Resumen */}
          <div style={{ background: '#0d1f3c', borderRadius: 12, padding: 24, marginBottom: 20, color: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: 4 }}>CNAE {result.query.cnae} · {result.query.ca} · {result.query.tamano}</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 900 }}>{result.resumen.total_encontradas} subvenciones activas</div>
                <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                  <span style={{ fontSize: '0.85rem', color: '#86efac' }}>{result.resumen.directas} directas</span>
                  <span style={{ fontSize: '0.85rem', color: '#fde68a' }}>{result.resumen.probables} probables</span>
                  <span style={{ fontSize: '0.85rem', color: '#e2e8f0' }}>hasta {fmtImporte(result.resumen.importe_maximo_total)} acumulados</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  onClick={copiarMensaje}
                  style={{ padding: '10px 18px', background: copiado ? '#059669' : '#0d9488', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                >
                  {copiado ? '✓ Copiado' : 'Copiar mensaje ventas'}
                </button>
                <Link
                  href={`/prospectos?nuevo=1&sector=${encodeURIComponent(result.query.cnae)}&provincia=${encodeURIComponent(result.query.ca)}`}
                  style={{ padding: '10px 18px', background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                >
                  + Crear prospecto
                </Link>
              </div>
            </div>
            <div style={{ marginTop: 12, padding: '12px 16px', background: 'rgba(255,255,255,0.08)', borderRadius: 8, fontSize: '0.85rem', color: '#e2e8f0', fontStyle: 'italic' }}>
              &ldquo;{result.resumen.mensaje_ventas}&rdquo;
            </div>
          </div>

          {/* Resultados */}
          {result.resultados.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
              No se encontraron subvenciones activas para estos parámetros.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {result.resultados.map(r => {
                const colors = ENCAJE_COLORS[r.encaje];
                const urgente = r.dias_plazo !== null && r.dias_plazo <= 15;
                return (
                  <div
                    key={r.id}
                    style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 10, padding: '16px 20px' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
                          <span style={{ padding: '2px 10px', background: colors.badge, color: colors.badgeText, borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>
                            {r.encaje}
                          </span>
                          {urgente && (
                            <span style={{ padding: '2px 10px', background: '#fef2f2', color: '#dc2626', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700 }}>
                              ⚡ {r.dias_plazo} días
                            </span>
                          )}
                          {r.estado_convocatoria === 'abierta' && !urgente && (
                            <span style={{ padding: '2px 10px', background: '#f0fdf4', color: '#059669', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600 }}>
                              Abierta
                            </span>
                          )}
                        </div>
                        <div style={{ fontWeight: 700, color: '#0d1f3c', fontSize: '0.95rem', marginBottom: 4 }}>
                          {r.titulo}
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: r.objeto ? 6 : 0 }}>
                          {r.organismo} {r.ambito && `· ${r.ambito}`}
                        </div>
                        {r.objeto && (
                          <div style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.5, marginTop: 4 }}>
                            {r.objeto}
                          </div>
                        )}
                        <div style={{ marginTop: 6, fontSize: '0.78rem', color: colors.text }}>
                          {r.encaje_razon}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', minWidth: 100, flexShrink: 0 }}>
                        <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#0d1f3c' }}>
                          {fmtImporte(r.importe_maximo)}
                        </div>
                        {r.porcentaje_financiacion && (
                          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                            {r.porcentaje_financiacion}% financiación
                          </div>
                        )}
                        {r.plazo_fin && (
                          <div style={{ fontSize: '0.75rem', color: urgente ? '#dc2626' : '#94a3b8', marginTop: 4 }}>
                            Cierre: {new Date(r.plazo_fin).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
