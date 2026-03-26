'use client';

import { useMediaQuery } from '@/lib/hooks/use-media-query';

const steps = [
  {
    number: '1',
    title: 'Analizamos',
    description: 'Nos dices tu sector y ubicacion. Cruzamos tu perfil con todas las convocatorias.',
  },
  {
    number: '2',
    title: 'Gestionamos',
    description: 'Preparamos el expediente completo y lo presentamos. Tu no tocas nada.',
  },
  {
    number: '3',
    title: 'Cobras',
    description: 'Recibes el dinero. Solo entonces nos pagas. Sin subvencion = sin coste.',
  },
];

export default function HowItWorks() {
  const isMobile = useMediaQuery('(max-width: 768px)');

  return (
    <section 
      id="como-funciona" 
      style={{ 
        padding: isMobile ? '64px 24px' : '100px 48px', 
        background: '#fff',
      }}
    >
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: isMobile ? 48 : 64 }}>
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
            Como funciona
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
            3 pasos.<br />
            Tu no haces nada.
          </h2>
        </div>

        {/* Steps */}
        <div 
          style={{ 
            display: 'grid', 
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', 
            gap: isMobile ? 40 : 48,
          }}
        >
          {steps.map((step) => (
            <div key={step.number}>
              {/* Number */}
              <div 
                style={{ 
                  fontSize: '4rem', 
                  fontWeight: 800, 
                  color: '#e0ddd8',
                  lineHeight: 1,
                  marginBottom: 16,
                }}
              >
                {step.number}
              </div>
              
              {/* Title */}
              <h3
                style={{ 
                  fontSize: '1.25rem', 
                  fontWeight: 700, 
                  color: '#1a1a1a',
                  marginBottom: 8,
                }}
              >
                {step.title}
              </h3>
              
              {/* Description */}
              <p
                style={{ 
                  fontSize: '0.95rem', 
                  color: '#6b6b6b',
                  lineHeight: 1.6,
                }}
              >
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
