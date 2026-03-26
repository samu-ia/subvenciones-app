'use client';

import { Star, Quote } from 'lucide-react';
import { useMediaQuery } from '@/lib/hooks/use-media-query';

const testimonials = [
  {
    name: 'María García',
    role: 'CEO',
    company: 'Innova Soluciones SL',
    sector: 'Tecnología',
    text: 'Llevábamos años dejando pasar subvenciones porque no teníamos tiempo de buscarlas. AyudaPyme nos encontró una ayuda de digitalización de 25.000€ que ni sabíamos que existía. La gestionaron entera.',
    amount: '25.000€',
    rating: 5,
  },
  {
    name: 'Carlos Ruiz',
    role: 'Director General',
    company: 'Alimentación Ruiz e Hijos',
    sector: 'Agroalimentario',
    text: 'El proceso fue increíblemente sencillo. Me llamaron, les di cuatro datos de mi empresa y en dos semanas tenía una subvención aprobada para modernizar la maquinaria. Sin papeleo, sin estrés.',
    amount: '40.000€',
    rating: 5,
  },
  {
    name: 'Laura Martínez',
    role: 'Fundadora',
    company: 'EcoTextil',
    sector: 'Textil sostenible',
    text: 'Lo que más me gustó es que solo cobran si consiguen la subvención. Eso me dio confianza desde el primer día. Ya nos han tramitado dos ayudas y estamos esperando una tercera.',
    amount: '18.500€',
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

function Initials({ name }: { name: string }) {
  const parts = name.split(' ');
  const initials = parts.map(p => p[0]).join('').slice(0, 2);
  return (
    <div
      style={{
        width: 48,
        height: 48,
        borderRadius: '50%',
        background: 'hsl(215 70% 35% / 0.12)',
        color: 'hsl(215 70% 35%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.95rem',
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

export default function Testimonials() {
  const isMobile = useMediaQuery('(max-width: 768px)');

  return (
    <section style={{ padding: isMobile ? '48px 16px' : '80px 24px', background: 'hsl(210 20% 97%)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* Header */}
        <div className="text-center" style={{ marginBottom: 56 }}>
          <span
            className="inline-block text-accent font-semibold text-sm uppercase tracking-wider"
            style={{ marginBottom: 12, display: 'block' }}
          >
            Casos de éxito
          </span>
          <h2
            className="font-heading font-bold text-foreground"
            style={{ fontSize: 'clamp(1.75rem, 3vw, 2.25rem)', marginBottom: 12, lineHeight: 1.2 }}
          >
            Empresas que ya confían en nosotros
          </h2>
          <p className="text-muted-foreground" style={{ fontSize: '1.05rem', lineHeight: 1.7, maxWidth: 540, margin: '0 auto' }}>
            PYMEs reales que han conseguido financiación pública sin complicaciones.
          </p>
        </div>

        {/* Testimonial cards */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '1.25rem' }}>
          {testimonials.map((t) => (
            <div
              key={t.name}
              style={{
                background: '#fff',
                border: '1px solid hsl(210 20% 88%)',
                borderRadius: '1rem',
                padding: '2rem',
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
                boxShadow: '0 2px 12px rgba(13,31,60,0.06)',
                transition: 'box-shadow 0.2s, transform 0.2s',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Quote icon decorative */}
              <Quote
                size={40}
                style={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  opacity: 0.06,
                  color: 'hsl(215 70% 35%)',
                }}
                strokeWidth={1.5}
              />

              {/* Rating + amount badge */}
              <div className="flex items-center justify-between">
                <StarRating count={t.rating} />
                <span
                  style={{
                    background: 'hsl(142 60% 38% / 0.1)',
                    color: 'hsl(142 60% 38%)',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    padding: '4px 12px',
                    borderRadius: 100,
                    border: '1px solid hsl(142 60% 38% / 0.2)',
                  }}
                >
                  +{t.amount} conseguidos
                </span>
              </div>

              {/* Quote text */}
              <p
                className="text-foreground"
                style={{
                  fontSize: '0.92rem',
                  lineHeight: 1.7,
                  flex: 1,
                  fontStyle: 'italic',
                  opacity: 0.85,
                }}
              >
                &ldquo;{t.text}&rdquo;
              </p>

              {/* Author */}
              <div className="flex items-center gap-3" style={{ borderTop: '1px solid hsl(210 20% 92%)', paddingTop: 16 }}>
                <Initials name={t.name} />
                <div>
                  <div className="font-semibold text-foreground" style={{ fontSize: '0.88rem', lineHeight: 1.3 }}>
                    {t.name}
                  </div>
                  <div className="text-muted-foreground" style={{ fontSize: '0.78rem', lineHeight: 1.4 }}>
                    {t.role} · {t.company}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'hsl(215 25% 55%)', marginTop: 2 }}>
                    {t.sector}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Social proof footer */}
        <div className="text-center" style={{ marginTop: 40 }}>
          <p className="text-muted-foreground" style={{ fontSize: '0.85rem' }}>
            <span style={{ fontWeight: 700, color: 'hsl(215 70% 35%)' }}>+50 empresas</span> ya gestionan sus subvenciones con AyudaPyme
          </p>
        </div>

      </div>
    </section>
  );
}
