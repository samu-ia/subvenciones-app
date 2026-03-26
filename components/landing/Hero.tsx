import { CheckCircle, LogIn, ArrowRight, Shield, Zap, TrendingUp } from 'lucide-react';

const trust = [
  { icon: Shield,     text: '0€ hasta que cobres la subvención' },
  { icon: CheckCircle,text: 'Gestionamos todo el papeleo por ti' },
  { icon: Zap,        text: 'Resultado en semanas, no en meses' },
];

const stats = [
  { value: '120.000€', label: 'media conseguida por empresa' },
  { value: '87%',      label: 'tasa de éxito en solicitudes' },
  { value: '0€',       label: 'si no conseguimos nada, no pagáis' },
];

export default function Hero({ onAuthClick }: { onAuthClick?: () => void }) {
  return (
    <section
      id="inicio"
      className="relative min-h-screen flex items-center hero-gradient overflow-hidden"
      style={{ overflowX: 'hidden' }}
    >
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-20 left-10 w-96 h-96 bg-white rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-[32rem] h-[32rem] bg-white rounded-full blur-3xl" />
      </div>

      <div className="container-custom relative z-10 pt-28 pb-20" style={{ paddingTop: '7rem', paddingBottom: '5rem' }}>
        <div className="max-w-4xl mx-auto text-center">

          {/* Live badge */}
          <div
            className="inline-flex items-center gap-2 mb-8 animate-slide-up"
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 100,
              padding: '6px 18px',
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', display: 'inline-block', boxShadow: '0 0 10px #4ade80' }} />
            <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.82rem', fontWeight: 600 }}>
              Análisis gratuito — sin compromiso — resultado en 24h
            </span>
          </div>

          {/* Headline */}
          <h1
            className="animate-slide-up"
            style={{
              fontSize: 'clamp(2.4rem, 6vw, 4rem)',
              fontWeight: 900,
              color: '#fff',
              lineHeight: 1.08,
              letterSpacing: '-0.04em',
              marginBottom: 24,
              animationDelay: '0.05s',
            }}
          >
            Tu empresa puede conseguir<br />
            <span style={{ color: '#5eead4' }}>hasta 120.000€ este año</span><br />
            en subvenciones que ya existen
          </h1>

          {/* Subtítulo */}
          <p
            className="animate-slide-up"
            style={{
              fontSize: '1.15rem',
              color: 'rgba(255,255,255,0.72)',
              lineHeight: 1.7,
              maxWidth: 560,
              margin: '0 auto 36px',
              animationDelay: '0.12s',
            }}
          >
            Introducimos el NIF de tu empresa y en menos de 24h sabes exactamente
            cuánto dinero puedes conseguir y de dónde. <strong style={{ color: 'rgba(255,255,255,0.92)' }}>Nosotros hacemos todo. Tú solo firmas si quieres seguir.</strong>
          </p>

          {/* Trust pills */}
          <div
            className="flex flex-wrap justify-center gap-3 mb-12 animate-slide-up"
            style={{ animationDelay: '0.18s' }}
          >
            {trust.map((t) => (
              <div
                key={t.text}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  borderRadius: 100, padding: '7px 14px',
                }}
              >
                <t.icon size={14} color="#5eead4" />
                <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.88)', fontWeight: 600 }}>
                  {t.text}
                </span>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div
            className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up"
            style={{ animationDelay: '0.25s' }}
          >
            {/* Primary: acceder / crear cuenta */}
            <button
              onClick={onAuthClick}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                background: '#0d9488',
                color: '#fff',
                border: 'none', borderRadius: 14,
                padding: '16px 32px',
                fontSize: '1.05rem', fontWeight: 800,
                cursor: 'pointer', fontFamily: 'inherit',
                boxShadow: '0 4px 24px rgba(13,148,136,0.45)',
                letterSpacing: '-0.01em',
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 30px rgba(13,148,136,0.55)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 24px rgba(13,148,136,0.45)';
              }}
            >
              Descubrir qué le corresponde a mi empresa
              <ArrowRight size={18} />
            </button>

            {/* Secondary: ya tengo cuenta */}
            <button
              onClick={onAuthClick}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'rgba(255,255,255,0.08)',
                border: '1.5px solid rgba(255,255,255,0.3)',
                color: 'rgba(255,255,255,0.88)',
                borderRadius: 14, padding: '16px 26px',
                fontFamily: 'inherit', fontWeight: 600, fontSize: '0.95rem',
                cursor: 'pointer', transition: 'all 0.2s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.16)';
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.5)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)';
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.3)';
              }}
            >
              <LogIn size={16} />
              Ya tengo cuenta
            </button>
          </div>

          <p
            className="animate-slide-up"
            style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.78rem', marginTop: 16, animationDelay: '0.3s' }}
          >
            Gratuito · Sin tarjeta · Sin compromiso
          </p>

          {/* Stats */}
          <div
            className="flex flex-wrap justify-center gap-10 mt-16 pt-12 animate-slide-up"
            style={{
              borderTop: '1px solid rgba(255,255,255,0.1)',
              animationDelay: '0.35s',
            }}
          >
            {stats.map((s, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.05em', lineHeight: 1 }}>
                  {s.value}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', marginTop: 5, fontWeight: 500 }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
