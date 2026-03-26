'use client';

import { Search, FileCheck, BadgeEuro, ArrowRight } from 'lucide-react';
import { useMediaQuery } from '@/lib/hooks/use-media-query';

const steps = [
  {
    number: '1',
    icon: Search,
    title: 'Te analizamos',
    description: 'Dinos tu sector y ubicacion. Cruzamos tu perfil con todas las convocatorias activas.',
    accent: 'hsl(215 70% 35%)',
    accentBg: 'hsl(215 70% 35% / 0.1)',
  },
  {
    number: '2',
    icon: FileCheck,
    title: 'Lo gestionamos',
    description: 'Preparamos el expediente completo y lo presentamos. Tu no tocas ningun papel.',
    accent: 'hsl(175 60% 35%)',
    accentBg: 'hsl(175 60% 35% / 0.12)',
  },
  {
    number: '3',
    icon: BadgeEuro,
    title: 'Tu cobras',
    description: 'Recibes el dinero. Solo entonces nos pagas. Si no hay subvencion, no pagas nada.',
    accent: 'hsl(142 60% 38%)',
    accentBg: 'hsl(142 60% 38% / 0.12)',
  },
];

export default function HowItWorks() {
  const isMobile = useMediaQuery('(max-width: 768px)');

  return (
    <section id="como-funciona" style={{ padding: isMobile ? '48px 16px' : '80px 24px', background: '#fff' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* Header */}
        <div className="text-center" style={{ marginBottom: 48 }}>
          <h2
            className="font-heading font-bold text-foreground"
            style={{ fontSize: 'clamp(1.6rem, 3vw, 2rem)', marginBottom: 8, lineHeight: 1.2 }}
          >
            3 pasos. Tu no haces nada.
          </h2>
          <p className="text-muted-foreground" style={{ fontSize: '1rem', lineHeight: 1.6, maxWidth: 400, margin: '0 auto' }}>
            Nosotros nos encargamos de todo.
          </p>
        </div>

        {/* Steps */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: isMobile ? 40 : 0, position: 'relative' }}>

          {/* Connector line (desktop) */}
          <div
            className="hidden lg:block absolute"
            style={{
              top: 52,
              left: 'calc(16.66% + 22px)',
              right: 'calc(16.66% + 22px)',
              height: 2,
              background: 'linear-gradient(90deg, hsl(215 70% 35% / 0.3), hsl(175 60% 35% / 0.3), hsl(142 60% 38% / 0.3))',
              zIndex: 0,
            }}
          />

          {steps.map((step, i) => (
            <div
              key={step.number}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                padding: '0 24px',
                position: 'relative',
                zIndex: 1,
              }}
            >
              {/* Step icon circle */}
              <div
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: '50%',
                  background: step.accentBg,
                  border: `2.5px solid ${step.accent}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 24,
                  position: 'relative',
                  boxShadow: `0 4px 20px ${step.accent}22`,
                }}
              >
                <step.icon size={32} color={step.accent} strokeWidth={1.8} />
                {/* Step number badge */}
                <span
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: step.accent,
                    color: '#fff',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  }}
                >
                  {step.number}
                </span>
              </div>

              {/* Arrow between steps (desktop) */}
              {i < steps.length - 1 && (
                <div
                  className="hidden lg:flex absolute items-center justify-center"
                  style={{
                    top: 34,
                    right: -12,
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: '#fff',
                    border: '1.5px solid hsl(210 20% 88%)',
                    zIndex: 2,
                  }}
                >
                  <ArrowRight size={12} color="hsl(215 25% 50%)" />
                </div>
              )}

              <h3
                className="font-heading font-bold text-foreground"
                style={{ fontSize: '1.1rem', marginBottom: 8 }}
              >
                {step.title}
              </h3>
              <p
                className="text-muted-foreground"
                style={{ fontSize: '0.9rem', lineHeight: 1.65, maxWidth: 280, margin: '0 auto' }}
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
