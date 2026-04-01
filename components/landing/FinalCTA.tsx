'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

// Computed at module load time (once per page load), not during render
const PAGE_LOAD_TIME = Date.now();

interface ProximaConvocatoria {
  titulo_comercial?: string;
  titulo?: string;
  plazo_fin?: string;
  organismo?: string;
}

export default function FinalCTA({ onAuthClick }: { onAuthClick?: () => void }) {
  const [proximas, setProximas] = useState<ProximaConvocatoria[]>([]);

  useEffect(() => {
    fetch('/api/public/proximas')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setProximas(d.slice(0, 2)); })
      .catch(() => {/* ignore */});
  }, []);

  const now = PAGE_LOAD_TIME;
  const fmtFecha = (s?: string) => s ? new Date(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }) : '';
  const diasHasta = (s?: string) => s ? Math.ceil((new Date(s).getTime() - now) / 86_400_000) : null;

  return (
    <section style={{ background: 'linear-gradient(135deg, #0d1f3c 0%, #0d4a45 100%)', padding: '80px 24px' }}>
      <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>

        {/* Urgency: próximas convocatorias cerrando */}
        {proximas.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            {proximas.map((p, i) => {
              const dias = diasHasta(p.plazo_fin);
              if (!dias || dias < 0 || dias > 30) return null;
              return (
                <div key={i} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  background: dias <= 7 ? 'rgba(220,38,38,0.15)' : 'rgba(245,158,11,0.12)',
                  border: `1px solid ${dias <= 7 ? 'rgba(220,38,38,0.3)' : 'rgba(245,158,11,0.25)'}`,
                  borderRadius: 100, padding: '6px 16px', marginBottom: 8, marginRight: 8,
                }}>
                  <AlertTriangle size={13} style={{ color: dias <= 7 ? '#f87171' : '#fbbf24', flexShrink: 0 }} />
                  <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.78rem', fontWeight: 600 }}>
                    {p.titulo_comercial ?? p.titulo?.slice(0, 40)} — cierra en {dias}d ({fmtFecha(p.plazo_fin)})
                  </span>
                </div>
              );
            }).filter(Boolean)}
          </div>
        )}

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 100, padding: '6px 16px', marginBottom: 24,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px #4ade80', display: 'inline-block' }} />
          <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.8rem', fontWeight: 600 }}>
            Análisis disponible ahora mismo
          </span>
        </div>
        <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 900, color: '#fff', lineHeight: 1.1, marginBottom: 16, letterSpacing: '-0.03em' }}>
          ¿Y si tu empresa tiene<br />
          <span style={{ color: '#5eead4' }}>dinero esperando</span> ahora mismo?
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '1.05rem', lineHeight: 1.7, maxWidth: 520, margin: '0 auto 36px' }}>
          En 24 horas sabes cuánto puedes conseguir y de dónde.
          Completamente gratis. Sin compromiso. Solo firmas si quieres seguir.
        </p>
        <button
          onClick={onAuthClick}
          className="w-full sm:w-auto"
          style={{
            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10,
            background: '#0d9488', color: '#fff', border: 'none',
            borderRadius: 14, padding: '18px 36px',
            fontSize: '1.05rem', fontWeight: 800, cursor: 'pointer',
            fontFamily: 'inherit', letterSpacing: '-0.01em',
            boxShadow: '0 4px 24px rgba(13,148,136,0.45)',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 32px rgba(13,148,136,0.55)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 24px rgba(13,148,136,0.45)';
          }}
        >
          Ver cuánto me corresponde →
        </button>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.78rem', marginTop: 14 }}>
          Gratuito · Sin tarjeta · Sin compromiso
        </p>
      </div>
    </section>
  );
}
