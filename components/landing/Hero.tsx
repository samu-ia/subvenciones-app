import { CheckCircle, ArrowRight, LogIn } from 'lucide-react';

const benefits = [
  { text: 'Sin riesgo ni coste inicial', icon: CheckCircle },
  { text: 'Hacemos todo por ti', icon: CheckCircle },
  { text: 'Solo pagas si conseguimos la subvención', icon: CheckCircle },
];

const stats = [
  { value: '+1.000', label: 'subvenciones monitorizadas' },
  { value: '24/7', label: 'detección automática' },
  { value: '0€', label: 'coste si no hay éxito' },
];

export default function Hero({ onAuthClick }: { onAuthClick?: () => void }) {
  return (
    <section id="inicio" className="relative min-h-screen flex items-center hero-gradient overflow-hidden">
      {/* Background blobs */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-10 w-96 h-96 bg-background rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-[32rem] h-[32rem] bg-background rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-background rounded-full blur-3xl" />
      </div>

      <div className="container-custom relative z-10 pt-24 pb-16">
        <div className="max-w-3xl mx-auto text-center">

          {/* Tag pill */}
          <div
            className="inline-flex items-center gap-2 mb-8 animate-slide-up"
            style={{
              background: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 100,
              padding: '6px 16px',
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', display: 'inline-block', boxShadow: '0 0 8px #4ade80' }} />
            <span className="text-primary-foreground/90 text-sm font-semibold">
              Detección automática de subvenciones para tu empresa
            </span>
          </div>

          <h1
            className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold text-primary-foreground mb-6 animate-slide-up"
            style={{ animationDelay: '0.05s', lineHeight: 1.1, letterSpacing: '-0.03em' }}
          >
            Las subvenciones que<br />
            <span style={{ color: '#5eead4' }}>encajan con tu empresa</span>,<br />
            sin que tengas que buscarlas
          </h1>

          <p
            className="text-lg md:text-xl text-primary-foreground/75 mb-8 animate-slide-up"
            style={{ animationDelay: '0.12s', lineHeight: 1.7 }}
          >
            Analizamos tu empresa, detectamos las ayudas que calificas y gestionamos todo el proceso.
            Tú no haces nada hasta cobrar.
          </p>

          {/* Benefits */}
          <div
            className="flex flex-wrap justify-center gap-x-6 gap-y-2 mb-10 animate-slide-up"
            style={{ animationDelay: '0.18s' }}
          >
            {benefits.map((b) => (
              <div key={b.text} className="flex items-center gap-2 text-primary-foreground/85">
                <b.icon className="w-4 h-4 text-accent flex-shrink-0" />
                <span className="text-sm font-medium">{b.text}</span>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div
            className="flex flex-col sm:flex-row items-center justify-center gap-3 animate-slide-up"
            style={{ animationDelay: '0.25s' }}
          >
            <a
              href="#formulario"
              className="btn-hero group"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
            >
              Quiero mis subvenciones
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </a>
            <button
              onClick={onAuthClick}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'rgba(255,255,255,0.08)',
                border: '1.5px solid rgba(255,255,255,0.25)',
                color: 'rgba(255,255,255,0.85)',
                borderRadius: '0.75rem', padding: '0.9rem 1.75rem',
                fontFamily: 'inherit', fontWeight: 600, fontSize: '1rem',
                cursor: 'pointer', transition: 'all .25s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.15)';
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.5)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)';
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.25)';
              }}
            >
              <LogIn className="w-4 h-4" />
              Ya tengo cuenta
            </button>
          </div>

          {/* Stats row */}
          <div
            className="flex flex-wrap justify-center gap-8 mt-16 animate-slide-up"
            style={{ animationDelay: '0.35s' }}
          >
            {stats.map((s, i) => (
              <div key={i} className="text-center">
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: 4, fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
