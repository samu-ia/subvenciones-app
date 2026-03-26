'use client';

import { CheckCircle, LogIn, ArrowRight, Shield, Zap, MessageCircle } from 'lucide-react';

const trust = [
  { icon: Shield,     text: '0 euros si no cobras' },
  { icon: CheckCircle,text: 'Nosotros hacemos todo' },
  { icon: Zap,        text: 'Respuesta en 24h' },
];

const stats = [
  { value: '120.000', label: 'euros de media' },
  { value: '87%',     label: 'tasa de exito' },
  { value: '0',       label: 'coste inicial' },
];

interface HeroProps {
  onAuthClick: () => void;
}

export default function Hero({ onAuthClick }: HeroProps) {
  return (
    <section
      className="hero-gradient"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle pattern overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(94,234,212,0.08) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(94,234,212,0.05) 0%, transparent 40%)',
          pointerEvents: 'none',
        }}
      />

      <div className="container-custom" style={{ position: 'relative', zIndex: 10, paddingTop: 100, paddingBottom: 60 }}>
        <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>

          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 mb-6 animate-slide-up"
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 100,
              padding: '6px 16px',
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', display: 'inline-block', boxShadow: '0 0 10px #4ade80' }} />
            <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.82rem', fontWeight: 600 }}>
              Gratis - Sin compromiso - 24h
            </span>
          </div>

          {/* Headline */}
          <h1
            className="animate-slide-up"
            style={{
              fontSize: 'clamp(2.2rem, 5.5vw, 3.5rem)',
              fontWeight: 800,
              color: '#fff',
              lineHeight: 1.1,
              letterSpacing: '-0.03em',
              marginBottom: 20,
              animationDelay: '0.05s',
            }}
          >
            Hay subvenciones para tu empresa.
            <br />
            <span style={{ color: '#5eead4' }}>Te las conseguimos gratis.</span>
          </h1>

          {/* Subtitle */}
          <p
            className="animate-slide-up"
            style={{
              fontSize: '1.1rem',
              color: 'rgba(255,255,255,0.75)',
              lineHeight: 1.6,
              maxWidth: 500,
              margin: '0 auto 28px',
              animationDelay: '0.12s',
            }}
          >
            Analizamos tu empresa en 24h y te decimos cuanto dinero puedes conseguir. Solo cobramos si tu cobras.
          </p>

          {/* Trust pills */}
          <div
            className="flex flex-wrap justify-center gap-4 mb-8 animate-slide-up"
            style={{ animationDelay: '0.18s' }}
          >
            {trust.map((t, i) => (
              <div
                key={i}
                className="flex items-center gap-2"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  borderRadius: 100,
                  padding: '8px 16px',
                }}
              >
                <t.icon size={16} style={{ color: '#5eead4' }} />
                <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.85rem', fontWeight: 500 }}>
                  {t.text}
                </span>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div
            className="flex flex-col sm:flex-row items-center justify-center gap-3 animate-slide-up"
            style={{ animationDelay: '0.25s' }}
          >
            {/* Primary CTA */}
            <button
              onClick={onAuthClick}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: '#0d9488',
                color: '#fff',
                border: 'none', borderRadius: 12,
                padding: '14px 28px',
                fontSize: '1rem', fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
                boxShadow: '0 4px 20px rgba(13,148,136,0.4)',
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
              }}
            >
              Ver mis subvenciones
              <ArrowRight size={16} />
            </button>

            {/* WhatsApp */}
            <a
              href="https://wa.me/34601646362?text=Hola%2C%20quiero%20saber%20qu%C3%A9%20subvenciones%20puedo%20conseguir"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: '#25D366',
                color: '#fff',
                border: 'none', borderRadius: 12,
                padding: '14px 24px',
                fontSize: '0.95rem', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
                textDecoration: 'none',
                transition: 'transform 0.15s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)';
              }}
            >
              <MessageCircle size={18} />
              WhatsApp
            </a>

            {/* Secondary */}
            <button
              onClick={onAuthClick}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'transparent',
                border: '1.5px solid rgba(255,255,255,0.25)',
                color: 'rgba(255,255,255,0.85)',
                borderRadius: 12, padding: '14px 20px',
                fontFamily: 'inherit', fontWeight: 600, fontSize: '0.9rem',
                cursor: 'pointer', transition: 'all 0.2s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.1)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              }}
            >
              <LogIn size={15} />
              Entrar
            </button>
          </div>

          <p
            className="animate-slide-up"
            style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', marginTop: 14, animationDelay: '0.3s' }}
          >
            Sin coste inicial - Sin compromiso - Respuesta en 24h
          </p>

          {/* Stats */}
          <div
            className="flex flex-wrap justify-center gap-10 mt-14 pt-10 animate-slide-up"
            style={{
              borderTop: '1px solid rgba(255,255,255,0.1)',
              animationDelay: '0.35s',
            }}
          >
            {stats.map((s, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1 }}>
                  {s.value}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: 4, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
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
