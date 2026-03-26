'use client';

// Franja de beneficios concretos — estilo "Tractor al 60% de descuento"
// Muestra ejemplos reales de lo que pueden conseguir, en lenguaje de la calle.

const benefits = [
  { text: 'Maquinaria', highlight: '40.000' },
  { text: 'Digitalizacion', highlight: '80%' },
  { text: 'Contratar', highlight: '12 meses' },
  { text: 'Reformas', highlight: '30.000' },
  { text: 'Placas solares', highlight: '60%' },
  { text: 'Equipamiento', highlight: '120.000' },
  { text: 'I+D', highlight: 'deducciones' },
];

export default function BenefitsTicker() {
  // Duplicamos el array para el efecto scroll infinito
  const items = [...benefits, ...benefits];

  return (
    <div
      style={{
        background: '#0d1f3c',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        overflow: 'hidden',
        padding: '14px 0',
      }}
    >
      <style>{`
        @keyframes ticker {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .ticker-track {
          display: flex;
          gap: 0;
          width: max-content;
          animation: ticker 40s linear infinite;
        }
        .ticker-track:hover { animation-play-state: paused; }
      `}</style>

      <div className="ticker-track">
        {items.map((b, i) => (
          <div
            key={i}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '0 24px',
              borderRight: '1px solid rgba(255,255,255,0.08)',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem', fontWeight: 500 }}>
              {b.text}
            </span>
            <span style={{ color: '#5eead4', fontSize: '0.78rem', fontWeight: 700 }}>
              {b.highlight}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
