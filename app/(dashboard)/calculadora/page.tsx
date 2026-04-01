'use client';

/**
 * /calculadora — Calculadora de potencial de subvenciones por NIF
 *
 * Herramienta de ventas: introduce el NIF de un cliente/prospecto
 * y obtén el potencial estimado y el fee esperado antes de la llamada.
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

interface CalcResult {
  empresa: {
    nif: string;
    nombre: string;
    sector?: string;
    tamano?: string;
    comunidad?: string;
  };
  resumen: {
    total_subvenciones_activas: number;
    importe_maximo_total: number;
    potencial_estimado: number;
    fee_estimado: number;
    mensaje_ventas: string;
  };
  top_subvenciones: {
    titulo: string;
    organismo: string;
    importe_maximo: number;
    importe_estimado: number;
    score: number;
    estado: string;
    plazo_fin: string | null;
  }[];
}

function fmtE(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M €`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K €`;
  return `${n.toLocaleString('es-ES')} €`;
}

function CalculadoraContent() {
  const searchParams = useSearchParams();
  const [nif, setNif] = useState(() => searchParams.get('nif') ?? '');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CalcResult | null>(null);
  const [error, setError] = useState('');
  const [copiado, setCopiado] = useState(false);

  // Auto-calcular si viene con NIF en la URL
  useEffect(() => {
    const nifParam = searchParams.get('nif');
    if (nifParam) {
      setNif(nifParam.toUpperCase());
      // Trigger calculation
      const nifClean = nifParam.trim().toUpperCase();
      setLoading(true);
      fetch(`/api/admin/calculadora?nif=${encodeURIComponent(nifClean)}`)
        .then(r => r.json())
        .then(data => { if (data.error) setError(data.error); else setResult(data); })
        .catch(() => setError('Error de conexión'))
        .finally(() => setLoading(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function calcular() {
    const nifClean = nif.trim().toUpperCase();
    if (!nifClean) { setError('Introduce un NIF'); return; }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch(`/api/admin/calculadora?nif=${encodeURIComponent(nifClean)}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Error al calcular'); return; }
      setResult(data);
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  }

  function copiar() {
    if (!result) return;
    navigator.clipboard.writeText(result.resumen.mensaje_ventas);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div style={{ padding: '32px', maxWidth: 860, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0d1f3c', margin: '0 0 6px' }}>
        Calculadora de potencial
      </h1>
      <p style={{ color: '#64748b', fontSize: '0.88rem', margin: '0 0 28px' }}>
        Introduce el NIF de un cliente para estimar su potencial de subvenciones y el fee esperado.
      </p>

      {/* Formulario */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <input
            value={nif}
            onChange={e => setNif(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && calcular()}
            placeholder="NIF de la empresa (ej: B12345678)"
            style={{
              flex: 1, padding: '10px 14px', border: '1px solid #d1d5db',
              borderRadius: 8, fontSize: '0.9rem', fontFamily: 'inherit',
              textTransform: 'uppercase',
            }}
          />
          <button
            onClick={calcular}
            disabled={loading}
            style={{
              padding: '10px 24px', background: loading ? '#94a3b8' : '#0d1f3c',
              color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.9rem', whiteSpace: 'nowrap',
            }}
          >
            {loading ? 'Calculando...' : 'Calcular'}
          </button>
        </div>

        {error && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: '#fef2f2', borderRadius: 8, color: '#dc2626', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}
      </div>

      {result && (
        <>
          {/* Empresa */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', marginBottom: 16, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 2 }}>Empresa</div>
              <div style={{ fontWeight: 700, color: '#0d1f3c' }}>{result.empresa.nombre || result.empresa.nif}</div>
            </div>
            {result.empresa.sector && (
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 2 }}>Sector</div>
                <div style={{ color: '#334155', fontSize: '0.88rem' }}>{result.empresa.sector}</div>
              </div>
            )}
            {result.empresa.comunidad && (
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 2 }}>Comunidad</div>
                <div style={{ color: '#334155', fontSize: '0.88rem' }}>{result.empresa.comunidad}</div>
              </div>
            )}
            {result.empresa.tamano && (
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 2 }}>Tamaño</div>
                <div style={{ color: '#334155', fontSize: '0.88rem' }}>{result.empresa.tamano}</div>
              </div>
            )}
          </div>

          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
            <div style={{ background: '#0d1f3c', borderRadius: 12, padding: '18px 20px', color: '#fff' }}>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase' }}>
                Subvenciones activas
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 900 }}>{result.resumen.total_subvenciones_activas}</div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2 }}>convocatorias con encaje ≥35%</div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '18px 20px' }}>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase' }}>
                Potencial estimado
              </div>
              <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#0d9488' }}>
                {fmtE(result.resumen.potencial_estimado)}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 2 }}>máximo: {fmtE(result.resumen.importe_maximo_total)}</div>
            </div>
            <div style={{ background: '#fff', border: '2px solid #0d9488', borderRadius: 12, padding: '18px 20px' }}>
              <div style={{ fontSize: '0.72rem', color: '#0d9488', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>
                Fee estimado (15%)
              </div>
              <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#0d9488' }}>
                {fmtE(result.resumen.fee_estimado)}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 2 }}>mín. 300 € por concesión</div>
            </div>
          </div>

          {/* Mensaje ventas */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Mensaje para la llamada
              </div>
              <button
                onClick={copiar}
                style={{
                  padding: '6px 14px', background: copiado ? '#059669' : '#0d9488',
                  color: '#fff', border: 'none', borderRadius: 6,
                  fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem',
                }}
              >
                {copiado ? '✓ Copiado' : 'Copiar'}
              </button>
            </div>
            <p style={{ fontSize: '0.9rem', color: '#334155', lineHeight: 1.6, margin: 0, fontStyle: 'italic' }}>
              &ldquo;{result.resumen.mensaje_ventas}&rdquo;
            </p>
          </div>

          {/* Top subvenciones */}
          {result.top_subvenciones.length > 0 && (
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                Top subvenciones con encaje
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {result.top_subvenciones.map((s, i) => (
                  <div key={i} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: '#0d1f3c', fontSize: '0.88rem', marginBottom: 3 }}>{s.titulo}</div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        {s.organismo}
                        {s.plazo_fin && (
                          <span style={{ marginLeft: 8, color: '#94a3b8' }}>
                            · Cierre: {new Date(s.plazo_fin).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0d9488' }}>{fmtE(s.importe_estimado)}</div>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>est. · máx. {fmtE(s.importe_maximo)}</div>
                      <div style={{ marginTop: 4, display: 'inline-block', padding: '2px 8px', background: '#f0fdf4', color: '#059669', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700 }}>
                        {Math.round(s.score * 100)}% encaje
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.top_subvenciones.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 20px', color: '#94a3b8', background: '#f8fafc', borderRadius: 12 }}>
              No se encontraron subvenciones con encaje suficiente para este NIF.
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function CalculadoraPage() {
  return (
    <Suspense fallback={<div style={{ padding: 32 }}>Cargando...</div>}>
      <CalculadoraContent />
    </Suspense>
  );
}
