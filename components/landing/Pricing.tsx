'use client';

import { Check, ArrowRight } from 'lucide-react';
import { useMediaQuery } from '@/lib/hooks/use-media-query';

const included = [
  'Analisis de tu empresa',
  'Busqueda de subvenciones',
  'Preparacion del expediente',
  'Presentacion de solicitud',
  'Seguimiento hasta cobro',
];

export default function Pricing({ onAuthClick }: { onAuthClick?: () => void }) {
  const isMobile = useMediaQuery('(max-width: 768px)');

  return (
    <section 
      id="precios" 
      style={{ 
        padding: isMobile ? '64px 24px' : '100px 48px', 
        background: '#fff',
      }}
    >
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: isMobile ? 40 : 56 }}>
          <p 
            style={{ 
              fontSize: '0.8rem', 
              fontWeight: 600, 
              color: '#0d7377', 
              textTransform: 'uppercase', 
              letterSpacing: '0.15em',
              marginBottom: 12,
            }}
          >
            Precios
          </p>
          <h2
            style={{ 
              fontSize: isMobile ? '1.75rem' : '2.5rem', 
              fontWeight: 800, 
              color: '#1a1a1a',
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
            }}
          >
            Solo pagas si cobras.
          </h2>
        </div>

        {/* Main card */}
        <div
          style={{
            background: '#1a1a1a',
            borderRadius: 24,
            padding: isMobile ? 32 : 48,
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: isMobile ? 40 : 64,
            alignItems: 'center',
          }}
        >
          {/* Left: Price */}
          <div>
            <div 
              style={{ 
                display: 'inline-block',
                background: '#0d7377',
                color: '#fff',
                fontSize: '0.7rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                padding: '6px 12px',
                borderRadius: 50,
                marginBottom: 24,
              }}
            >
              Success fee
            </div>
            
            <div style={{ marginBottom: 24 }}>
              <span style={{ fontSize: '4rem', fontWeight: 800, color: '#fff', lineHeight: 1 }}>
                0
              </span>
              <span style={{ fontSize: '1.5rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginLeft: 4 }}>
                euros
              </span>
              <div style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.6)', marginTop: 8 }}>
                coste inicial
              </div>
            </div>

            <p style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.7, marginBottom: 32 }}>
              Analizamos tu empresa gratis. Solo cobramos un porcentaje si conseguimos que te aprueben la subvencion.
            </p>

            <button
              onClick={onAuthClick}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                background: '#fff',
                color: '#1a1a1a',
                border: 'none',
                borderRadius: 50,
                padding: '16px 32px',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'transform 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              Empezar gratis
              <ArrowRight size={18} />
            </button>
          </div>

          {/* Right: Included */}
          <div>
            <div 
              style={{ 
                fontSize: '0.75rem', 
                fontWeight: 600, 
                color: '#0d7377', 
                textTransform: 'uppercase', 
                letterSpacing: '0.1em',
                marginBottom: 20,
              }}
            >
              Que incluye
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {included.map((item) => (
                <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div 
                    style={{ 
                      width: 24, 
                      height: 24, 
                      borderRadius: '50%', 
                      background: 'rgba(13, 115, 119, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Check size={14} color="#0d7377" strokeWidth={2.5} />
                  </div>
                  <span style={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.85)' }}>
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Guarantees */}
        <div 
          style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: isMobile ? 24 : 48, 
            marginTop: 40,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1a1a1a' }}>Sin coste inicial</div>
            <div style={{ fontSize: '0.8rem', color: '#6b6b6b' }}>No pagas nada hasta cobrar</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1a1a1a' }}>Sin cuotas</div>
            <div style={{ fontSize: '0.8rem', color: '#6b6b6b' }}>Nada de pagos mensuales</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1a1a1a' }}>Sin permanencia</div>
            <div style={{ fontSize: '0.8rem', color: '#6b6b6b' }}>Te vas cuando quieras</div>
          </div>
        </div>

      </div>
    </section>
  );
}
