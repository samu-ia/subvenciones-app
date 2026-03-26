'use client';

// Franja de beneficios concretos — estilo "Tractor al 60% de descuento"
// Muestra ejemplos reales de lo que pueden conseguir, en lenguaje de la calle.

const benefits = [
  { emoji: '🚜', text: 'Maquinaria agrícola nueva', highlight: 'hasta 40.000€' },
  { emoji: '💻', text: 'Digitalización de tu negocio', highlight: 'el Estado paga hasta el 80%' },
  { emoji: '👷', text: 'Contratar 2 empleados', highlight: 'sueldo subvencionado 12 meses' },
  { emoji: '🏭', text: 'Reformar tu local o nave', highlight: 'hasta 30.000€ sin devolver' },
  { emoji: '⚡', text: 'Paneles solares para tu empresa', highlight: 'hasta el 60% del coste' },
  { emoji: '🌱', text: 'Certificado medioambiental', highlight: 'tramitación 100% subvencionada' },
  { emoji: '📦', text: 'Nuevo almacén o equipamiento', highlight: 'hasta 120.000€ disponibles' },
  { emoji: '🔬', text: 'Invertir en I+D o innovación', highlight: 'deducciones + subvención directa' },
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
              gap: 8,
              padding: '0 32px',
              borderRight: '1px solid rgba(255,255,255,0.1)',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: '1rem' }}>{b.emoji}</span>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', fontWeight: 500 }}>
              {b.text}
            </span>
            <span style={{ color: '#5eead4', fontSize: '0.82rem', fontWeight: 700 }}>
              — {b.highlight}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
