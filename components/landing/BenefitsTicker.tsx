'use client';

const benefits = [
  'Maquinaria hasta 40.000',
  'Digitalizacion 80%',
  'Contratar 12 meses',
  'Reformas 30.000',
  'Placas solares 60%',
  'Equipamiento 120.000',
  'I+D deducciones',
];

export default function BenefitsTicker() {
  const items = [...benefits, ...benefits, ...benefits];

  return (
    <div
      style={{
        background: '#1a1a1a',
        overflow: 'hidden',
        padding: '16px 0',
      }}
    >
      <style>{`
        @keyframes ticker {
          from { transform: translateX(0); }
          to { transform: translateX(-33.33%); }
        }
        .ticker-track {
          display: flex;
          gap: 0;
          width: max-content;
          animation: ticker 30s linear infinite;
        }
        .ticker-track:hover { animation-play-state: paused; }
      `}</style>

      <div className="ticker-track">
        {items.map((text, i) => (
          <div
            key={i}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0 40px',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', fontWeight: 500 }}>
              {text}
            </span>
            <span 
              style={{ 
                width: 4, 
                height: 4, 
                borderRadius: '50%', 
                background: '#0d7377', 
                marginLeft: 40,
              }} 
            />
          </div>
        ))}
      </div>
    </div>
  );
}
