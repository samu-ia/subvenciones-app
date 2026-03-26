import Link from 'next/link';

export default function LandingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer 
      style={{ 
        background: '#1a1a1a', 
        color: '#fff',
        padding: '64px 24px 32px',
      }}
    >
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        
        <div 
          style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: 48,
            marginBottom: 48,
          }}
        >
          {/* Brand */}
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.25rem', marginBottom: 16 }}>
              AyudaPyme
            </div>
            <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
              Tu agencia de subvenciones. Mas dinero, menos preocupaciones.
            </p>
          </div>

          {/* Legal */}
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 16, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Legal
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Link 
                href="/terminos" 
                style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)', textDecoration: 'none' }}
              >
                Terminos y condiciones
              </Link>
              <Link 
                href="/privacidad" 
                style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)', textDecoration: 'none' }}
              >
                Politica de privacidad
              </Link>
            </div>
          </div>

          {/* Contact */}
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 16, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Contacto
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>
              <span>admin@ayudapyme.es</span>
              <span>601 64 63 62</span>
              <span>A Coruna</span>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div 
          style={{ 
            borderTop: '1px solid rgba(255,255,255,0.1)', 
            paddingTop: 24,
          }}
        >
          <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>
            {year} AyudaPyme. Todos los derechos reservados.
          </p>
        </div>

      </div>
    </footer>
  );
}
