'use client';

import { MessageCircle, Phone, Mail } from 'lucide-react';
import { useMediaQuery } from '@/lib/hooks/use-media-query';

export default function ContactSection() {
  const isMobile = useMediaQuery('(max-width: 768px)');

  return (
    <section 
      id="contacto" 
      style={{ 
        padding: isMobile ? '64px 24px' : '100px 48px', 
        background: '#fff',
      }}
    >
      <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>

        {/* Header */}
        <p 
          style={{ 
            fontSize: '0.8rem', 
            fontWeight: 600, 
            color: '#0d7377', 
            textTransform: 'uppercase', 
            letterSpacing: '0.15em',
            marginBottom: 12,
          }}
        >
          Contacto
        </p>
        <h2
          style={{ 
            fontSize: isMobile ? '1.75rem' : '2.5rem', 
            fontWeight: 800, 
            color: '#1a1a1a',
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            marginBottom: 12,
          }}
        >
          Hablamos?
        </h2>
        <p
          style={{ 
            fontSize: '1rem', 
            color: '#6b6b6b',
            marginBottom: 48,
          }}
        >
          Te decimos en el dia si hay subvenciones para tu empresa.
        </p>

        {/* Contact options */}
        <div 
          style={{ 
            display: 'grid', 
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', 
            gap: 16,
          }}
        >
          {/* WhatsApp */}
          <a
            href="https://wa.me/34601646362?text=Hola%2C%20quiero%20saber%20qu%C3%A9%20subvenciones%20puedo%20conseguir"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: 32,
              background: '#1a1a1a',
              borderRadius: 16,
              textDecoration: 'none',
              transition: 'transform 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <MessageCircle size={28} color="#fff" style={{ marginBottom: 16 }} />
            <span style={{ fontSize: '1rem', fontWeight: 600, color: '#fff', marginBottom: 4 }}>
              WhatsApp
            </span>
            <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>
              Respuesta inmediata
            </span>
          </a>

          {/* Telefono */}
          <a
            href="tel:+34601646362"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: 32,
              background: '#f5f3ef',
              border: '1px solid #e0ddd8',
              borderRadius: 16,
              textDecoration: 'none',
              transition: 'transform 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <Phone size={28} color="#1a1a1a" style={{ marginBottom: 16 }} />
            <span style={{ fontSize: '1rem', fontWeight: 600, color: '#1a1a1a', marginBottom: 4 }}>
              Llamanos
            </span>
            <span style={{ fontSize: '0.85rem', color: '#6b6b6b' }}>
              601 64 63 62
            </span>
          </a>

          {/* Email */}
          <a
            href="mailto:admin@ayudapyme.es"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: 32,
              background: '#f5f3ef',
              border: '1px solid #e0ddd8',
              borderRadius: 16,
              textDecoration: 'none',
              transition: 'transform 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <Mail size={28} color="#1a1a1a" style={{ marginBottom: 16 }} />
            <span style={{ fontSize: '1rem', fontWeight: 600, color: '#1a1a1a', marginBottom: 4 }}>
              Email
            </span>
            <span style={{ fontSize: '0.85rem', color: '#6b6b6b' }}>
              admin@ayudapyme.es
            </span>
          </a>
        </div>

        <p style={{ fontSize: '0.8rem', color: '#9b9b9b', marginTop: 32 }}>
          Lunes a viernes, 10:00 - 19:00
        </p>

      </div>
    </section>
  );
}
