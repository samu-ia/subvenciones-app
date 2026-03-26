'use client';

import { Star } from 'lucide-react';
import { useMediaQuery } from '@/lib/hooks/use-media-query';

const testimonials = [
  {
    name: 'Maria G.',
    company: 'Tecnologia',
    text: 'Nos encontraron una ayuda de 25.000 euros que no sabiamos que existia. Lo gestionaron todo ellos.',
    amount: '25.000',
    rating: 5,
  },
  {
    name: 'Carlos R.',
    company: 'Agroalimentario',
    text: 'Les di cuatro datos y en dos semanas tenia subvencion aprobada. Sin papeleo, sin estres.',
    amount: '40.000',
    rating: 5,
  },
  {
    name: 'Laura M.',
    company: 'Textil',
    text: 'Solo cobran si consiguen la subvencion. Eso me dio confianza. Ya llevamos dos ayudas tramitadas.',
    amount: '18.500',
    rating: 5,
  },
];

function StarRating({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <Star key={i} size={14} fill="#f59e0b" color="#f59e0b" />
      ))}
    </div>
  );
}



export default function Testimonials() {
  const isMobile = useMediaQuery('(max-width: 768px)');

  return (
    <section style={{ padding: isMobile ? '48px 16px' : '80px 24px', background: 'hsl(210 20% 97%)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* Header */}
        <div className="text-center" style={{ marginBottom: 40 }}>
          <h2
            className="font-heading font-bold text-foreground"
            style={{ fontSize: 'clamp(1.6rem, 3vw, 2rem)', marginBottom: 8, lineHeight: 1.2 }}
          >
            Empresas como la tuya
          </h2>
          <p className="text-muted-foreground" style={{ fontSize: '1rem', lineHeight: 1.6 }}>
            Ya han conseguido subvenciones con nosotros.
          </p>
        </div>

        {/* Testimonial cards */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '1rem' }}>
          {testimonials.map((t) => (
            <div
              key={t.name}
              style={{
                background: '#fff',
                border: '1px solid hsl(210 20% 88%)',
                borderRadius: '0.875rem',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              {/* Amount badge */}
              <div className="flex items-center justify-between">
                <StarRating count={t.rating} />
                <span
                  style={{
                    background: 'hsl(142 60% 38%)',
                    color: '#fff',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: 100,
                  }}
                >
                  +{t.amount} euros
                </span>
              </div>

              {/* Quote text */}
              <p
                className="text-foreground"
                style={{
                  fontSize: '0.88rem',
                  lineHeight: 1.6,
                  flex: 1,
                }}
              >
                {t.text}
              </p>

              {/* Author */}
              <div style={{ borderTop: '1px solid hsl(210 20% 92%)', paddingTop: 12 }}>
                <div className="font-semibold text-foreground" style={{ fontSize: '0.85rem' }}>
                  {t.name}
                </div>
                <div className="text-muted-foreground" style={{ fontSize: '0.75rem' }}>
                  {t.company}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Social proof footer */}
        <div className="text-center" style={{ marginTop: 32 }}>
          <p className="text-muted-foreground" style={{ fontSize: '0.82rem' }}>
            <span style={{ fontWeight: 700, color: 'hsl(215 70% 35%)' }}>+50 empresas</span> ya han conseguido subvenciones con nosotros
          </p>
        </div>

      </div>
    </section>
  );
}
