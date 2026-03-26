'use client';

import { ArrowRight, MessageCircle } from 'lucide-react';
import Image from 'next/image';

export default function Hero({ onAuthClick }: { onAuthClick?: () => void }) {
  return (
    <section
      id="inicio"
      className="relative min-h-[90vh] flex items-center"
      style={{ 
        background: '#f5f3ef',
        overflow: 'hidden',
      }}
    >
      <div className="w-full max-w-7xl mx-auto px-6 lg:px-12 py-20 lg:py-0">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          
          {/* Left: Content */}
          <div className="order-2 lg:order-1">
            {/* Eyebrow */}
            <p 
              className="text-sm font-medium tracking-wide uppercase mb-6"
              style={{ color: '#0d7377', letterSpacing: '0.15em' }}
            >
              Subvenciones para tu empresa
            </p>

            {/* Headline */}
            <h1
              style={{
                fontSize: 'clamp(2.5rem, 5vw, 3.75rem)',
                fontWeight: 800,
                color: '#1a1a1a',
                lineHeight: 1.05,
                letterSpacing: '-0.03em',
                marginBottom: 24,
              }}
            >
              Dinero publico<br />
              que ya es tuyo.
            </h1>

            {/* Subtitle */}
            <p
              style={{
                fontSize: '1.125rem',
                color: '#4a4a4a',
                lineHeight: 1.7,
                maxWidth: 440,
                marginBottom: 40,
              }}
            >
              Buscamos las subvenciones que encajan con tu negocio, 
              preparamos el expediente y lo presentamos. 
              <strong style={{ color: '#1a1a1a' }}> Solo cobramos si tu cobras.</strong>
            </p>

            {/* Stats inline */}
            <div 
              className="flex gap-8 mb-10 pb-10"
              style={{ borderBottom: '1px solid #e0ddd8' }}
            >
              <div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#1a1a1a', letterSpacing: '-0.03em' }}>
                  120k
                </div>
                <div style={{ fontSize: '0.8rem', color: '#6b6b6b', marginTop: 2 }}>
                  euros de media
                </div>
              </div>
              <div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#1a1a1a', letterSpacing: '-0.03em' }}>
                  87%
                </div>
                <div style={{ fontSize: '0.8rem', color: '#6b6b6b', marginTop: 2 }}>
                  tasa de exito
                </div>
              </div>
              <div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0d7377', letterSpacing: '-0.03em' }}>
                  0
                </div>
                <div style={{ fontSize: '0.8rem', color: '#6b6b6b', marginTop: 2 }}>
                  coste inicial
                </div>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={onAuthClick}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  background: '#1a1a1a',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 50,
                  padding: '16px 32px',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'transform 0.2s, background 0.2s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#333';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = '#1a1a1a';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                Ver mis subvenciones
                <ArrowRight size={18} />
              </button>

              <a
                href="https://wa.me/34601646362?text=Hola%2C%20quiero%20saber%20qu%C3%A9%20subvenciones%20puedo%20conseguir"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  background: 'transparent',
                  color: '#1a1a1a',
                  border: '2px solid #1a1a1a',
                  borderRadius: 50,
                  padding: '14px 28px',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#1a1a1a';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#1a1a1a';
                }}
              >
                <MessageCircle size={18} />
                Hablar por WhatsApp
              </a>
            </div>
          </div>

          {/* Right: Image */}
          <div className="order-1 lg:order-2 relative">
            <div 
              className="relative aspect-[4/5] lg:aspect-[3/4] rounded-3xl overflow-hidden"
              style={{ 
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)',
              }}
            >
              <Image
                src="/images/hero-pyme.jpg"
                alt="Empresario PYME"
                fill
                className="object-cover"
                priority
              />
              {/* Overlay badge */}
              <div 
                className="absolute bottom-6 left-6 right-6"
                style={{
                  background: 'rgba(255,255,255,0.95)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: 16,
                  padding: '16px 20px',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: '#6b6b6b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Lo que incluye
                </div>
                <div style={{ fontSize: '0.9rem', color: '#1a1a1a', fontWeight: 500, lineHeight: 1.5 }}>
                  Busqueda + Expediente + Presentacion + Seguimiento
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
