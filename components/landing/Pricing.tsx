'use client';

import { Check, ArrowRight, ShieldCheck, Zap, Clock } from 'lucide-react';
import { useMediaQuery } from '@/lib/hooks/use-media-query';

const included = [
  'Análisis de tu empresa y perfil de subvenciones',
  'Monitorización continua de convocatorias',
  'Notificaciones de nuevas ayudas compatibles',
  'Preparación completa del expediente',
  'Presentación de la solicitud en tu nombre',
  'Seguimiento hasta resolución',
];

const guarantees = [
  { icon: ShieldCheck, text: 'Sin coste si no se concede', detail: 'Si la subvención no se aprueba, no pagas absolutamente nada.' },
  { icon: Zap,         text: 'Sin cuotas ni suscripciones', detail: 'No hay pagos mensuales, solo un porcentaje sobre el éxito.' },
  { icon: Clock,       text: 'Sin permanencia', detail: 'Puedes dejar de usar el servicio cuando quieras, sin penalización.' },
];

export default function Pricing({ onAuthClick }: { onAuthClick?: () => void }) {
  const isMobile = useMediaQuery('(max-width: 768px)');

  return (
    <section id="pricing" style={{ padding: isMobile ? '48px 16px' : '80px 24px', background: '#fff' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* Header */}
        <div className="text-center" style={{ marginBottom: 56 }}>
          <span
            className="inline-block text-accent font-semibold text-sm uppercase tracking-wider"
            style={{ marginBottom: 12, display: 'block' }}
          >
            Modelo transparente
          </span>
          <h2
            className="font-heading font-bold text-foreground"
            style={{ fontSize: 'clamp(1.75rem, 3vw, 2.25rem)', marginBottom: 12, lineHeight: 1.2 }}
          >
            El trato más justo que vas a encontrar
          </h2>
          <p className="text-muted-foreground" style={{ fontSize: '1.05rem', lineHeight: 1.7, maxWidth: 520, margin: '0 auto' }}>
            Solo ganamos si tú ganas. Y eso nos obliga a hacerlo bien.
          </p>
        </div>

        {/* Main pricing card */}
        <div
          style={{
            background: 'linear-gradient(135deg, hsl(210 100% 5%) 0%, hsl(215 60% 12%) 50%, hsl(210 45% 18%) 100%)',
            borderRadius: '1.25rem',
            padding: isMobile ? '1.5rem' : '3rem',
            marginBottom: 40,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Decorative glow */}
          <div
            style={{
              position: 'absolute',
              top: -60,
              right: -60,
              width: 200,
              height: 200,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(13,148,136,0.15) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '2rem' : '3rem', alignItems: 'center' }}>
            {/* Left: pricing info */}
            <div>
              <div
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  background: 'rgba(13,148,136,0.18)',
                  border: '1px solid rgba(13,148,136,0.35)',
                  borderRadius: 100,
                  padding: '5px 14px',
                  marginBottom: 24,
                }}
              >
                <span style={{ fontSize: '0.75rem', color: '#5eead4', fontWeight: 700 }}>
                  SUCCESS FEE
                </span>
              </div>

              <div style={{ marginBottom: 8 }}>
                <span
                  style={{
                    fontSize: '3.5rem',
                    fontWeight: 900,
                    color: '#fff',
                    lineHeight: 1,
                    letterSpacing: '-0.04em',
                  }}
                >
                  0€
                </span>
                <span style={{ fontSize: '1.1rem', color: 'rgba(255,255,255,0.5)', marginLeft: 8 }}>
                  coste inicial
                </span>
              </div>

              <p style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, marginBottom: 20 }}>
                Analizamos tu empresa gratis. Solo cobramos un porcentaje si conseguimos que te concedan la subvención.
              </p>

              {/* Ejemplo de cálculo */}
              <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: '16px 20px', marginBottom: 28, border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: 8, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>EJEMPLO REAL</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.85rem' }}>Subvención conseguida</span>
                  <span style={{ color: '#5eead4', fontWeight: 700 }}>40.000€</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                  <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.85rem' }}>Nuestra comisión (15%)</span>
                  <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>6.000€</span>
                </div>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 10, paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#fff', fontWeight: 700 }}>Lo que te quedas</span>
                  <span style={{ color: '#4ade80', fontWeight: 900, fontSize: '1.1rem' }}>34.000€ netos</span>
                </div>
              </div>

              <button
                onClick={onAuthClick}
                className="w-full sm:w-auto"
                style={{
                  display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10,
                  background: '#0d9488', color: '#fff',
                  border: 'none', borderRadius: 14,
                  padding: '15px 32px', fontSize: '0.98rem', fontWeight: 800,
                  cursor: 'pointer', fontFamily: 'inherit',
                  boxShadow: '0 4px 24px rgba(13,148,136,0.4)',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 32px rgba(13,148,136,0.5)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 24px rgba(13,148,136,0.4)';
                }}
              >
                Empezar gratis
                <ArrowRight size={18} />
              </button>
            </div>

            {/* Right: what's included */}
            <div>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#5eead4', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 20 }}>
                Qué incluye
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {included.map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%',
                      background: 'rgba(13,148,136,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, marginTop: 1,
                    }}>
                      <Check size={13} color="#5eead4" strokeWidth={2.5} />
                    </div>
                    <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.5 }}>
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Guarantees */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '1.25rem' }}>
          {guarantees.map((g) => (
            <div
              key={g.text}
              style={{
                background: 'hsl(210 20% 97%)',
                border: '1px solid hsl(210 20% 90%)',
                borderRadius: '0.875rem',
                padding: '1.5rem',
                textAlign: 'center',
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 10,
                background: 'hsl(215 70% 35% / 0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 12px',
              }}>
                <g.icon size={20} color="hsl(215, 70%, 35%)" />
              </div>
              <h4 className="font-heading font-semibold text-foreground" style={{ fontSize: '0.92rem', marginBottom: 6 }}>
                {g.text}
              </h4>
              <p className="text-muted-foreground" style={{ fontSize: '0.82rem', lineHeight: 1.6 }}>
                {g.detail}
              </p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
