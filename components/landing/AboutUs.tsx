'use client';

import { useMediaQuery } from '@/lib/hooks/use-media-query';

const features = [
  {
    title: 'Buscamos',
    description: 'Escaneamos todas las convocatorias y te avisamos.',
  },
  {
    title: 'Gestionamos',
    description: 'Preparamos expediente y presentamos. Tu no haces nada.',
  },
  {
    title: 'Solo si ganas',
    description: 'Sin cuotas. Sin coste inicial. Solo pagas si cobras.',
  },
  {
    title: 'Seguros',
    description: 'RGPD completo. Nunca compartimos tu informacion.',
  },
];

export default function AboutUs() {
  const isMobile = useMediaQuery('(max-width: 768px)');

  return (
    <section 
      id="quienes-somos" 
      style={{ 
        padding: isMobile ? '64px 24px' : '100px 48px', 
        background: '#f5f3ef',
      }}
    >
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 48 : 80, alignItems: 'center' }}>
          
          {/* Left: Text */}
          <div>
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
              Quienes somos
            </p>
            <h2
              style={{ 
                fontSize: isMobile ? '1.75rem' : '2.25rem', 
                fontWeight: 800, 
                color: '#1a1a1a',
                lineHeight: 1.15,
                letterSpacing: '-0.02em',
                marginBottom: 20,
              }}
            >
              La mayoria de pymes pierden subvenciones por no enterarse.
            </h2>
            <p
              style={{ 
                fontSize: '1rem', 
                color: '#6b6b6b',
                lineHeight: 1.7,
                marginBottom: 32,
              }}
            >
              Buscamos las ayudas que encajan con tu negocio, preparamos el expediente 
              y lo presentamos. Tu solo firmas si quieres seguir adelante.
            </p>
            
            {/* Stats */}
            <div style={{ display: 'flex', gap: 32 }}>
              <div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#1a1a1a' }}>1.000+</div>
                <div style={{ fontSize: '0.8rem', color: '#6b6b6b' }}>subvenciones</div>
              </div>
              <div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#1a1a1a' }}>24/7</div>
                <div style={{ fontSize: '0.8rem', color: '#6b6b6b' }}>monitorizacion</div>
              </div>
            </div>
          </div>

          {/* Right: Feature grid */}
          <div 
            style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(2, 1fr)', 
              gap: 16,
            }}
          >
            {features.map((f) => (
              <div
                key={f.title}
                style={{
                  background: '#fff',
                  border: '1px solid #e0ddd8',
                  borderRadius: 16,
                  padding: 24,
                }}
              >
                <h3
                  style={{ 
                    fontSize: '1rem', 
                    fontWeight: 700, 
                    color: '#1a1a1a',
                    marginBottom: 8,
                  }}
                >
                  {f.title}
                </h3>
                <p
                  style={{ 
                    fontSize: '0.875rem', 
                    color: '#6b6b6b',
                    lineHeight: 1.5,
                  }}
                >
                  {f.description}
                </p>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}
