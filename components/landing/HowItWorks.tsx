import { Search, FileCheck, BadgeEuro, ArrowRight } from 'lucide-react';

const steps = [
  {
    number: '01',
    icon: Search,
    title: 'Analizamos tu empresa',
    description: 'Nos cuentas a qué te dedicas y nosotros cruzamos tu perfil con miles de convocatorias públicas activas.',
    accent: 'hsl(215 70% 35%)',
    accentBg: 'hsl(215 70% 35% / 0.1)',
  },
  {
    number: '02',
    icon: FileCheck,
    title: 'Gestionamos el expediente',
    description: 'Preparamos toda la documentación, la revisamos y presentamos la solicitud en tu nombre. Tú no tocas un papel.',
    accent: 'hsl(175 60% 35%)',
    accentBg: 'hsl(175 60% 35% / 0.12)',
  },
  {
    number: '03',
    icon: BadgeEuro,
    title: 'Cobras la subvención',
    description: 'Si se concede, recibes el dinero y solo entonces nos pagas un porcentaje. Si no se concede, coste cero.',
    accent: 'hsl(142 60% 38%)',
    accentBg: 'hsl(142 60% 38% / 0.12)',
  },
];

export default function HowItWorks() {
  return (
    <section id="como-funciona" style={{ padding: '80px 24px', background: '#fff' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* Header */}
        <div className="text-center" style={{ marginBottom: 56 }}>
          <span
            className="inline-block text-accent font-semibold text-sm uppercase tracking-wider"
            style={{ marginBottom: 12, display: 'block' }}
          >
            Cómo funciona
          </span>
          <h2
            className="font-heading font-bold text-foreground"
            style={{ fontSize: 'clamp(1.75rem, 3vw, 2.25rem)', marginBottom: 12, lineHeight: 1.2 }}
          >
            De cero a subvención en 3 pasos
          </h2>
          <p className="text-muted-foreground" style={{ fontSize: '1.05rem', lineHeight: 1.7, maxWidth: 540, margin: '0 auto' }}>
            Sin burocracia, sin complicaciones. Nosotros nos encargamos de todo el proceso.
          </p>
        </div>

        {/* Steps */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0, position: 'relative' }}>

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
