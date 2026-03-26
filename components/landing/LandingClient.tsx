'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import LandingHeader from '@/components/landing/LandingHeader';
import Hero from '@/components/landing/Hero';
import AboutUs from '@/components/landing/AboutUs';
import FAQ from '@/components/landing/FAQ';
import ContactSection from '@/components/landing/ContactSection';
import LandingFooter from '@/components/landing/LandingFooter';
import AuthModal from '@/components/landing/AuthModal';

export default function LandingClient() {
  const [authOpen, setAuthOpen] = useState(false);
  const [checking, setChecking] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: perfil } = await supabase
          .from('perfiles').select('rol').eq('id', user.id).maybeSingle();
        const rol = perfil?.rol ?? user.user_metadata?.rol ?? 'cliente';
        router.replace(rol === 'admin' ? '/clientes' : '/portal');
        return;
      }
      setChecking(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (checking) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f0f4fa' }}>
        <div style={{ width: 40, height: 40, border: '4px solid #e2e8f0', borderTopColor: '#1a3561', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div className="landing min-h-screen bg-background">
      <LandingHeader onAuthClick={() => setAuthOpen(true)} />
      <main>
        <Hero onAuthClick={() => setAuthOpen(true)} />
        <AboutUs />

        {/* CTA intermedio */}
        <section style={{ background: '#0d1f3c', padding: '80px 24px', textAlign: 'center' }}>
          <div style={{ maxWidth: 620, margin: '0 auto' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(13,148,136,0.18)', border: '1px solid rgba(13,148,136,0.35)',
              borderRadius: 100, padding: '5px 16px',
              fontSize: '0.78rem', color: '#5eead4', fontWeight: 700, marginBottom: 24,
              letterSpacing: '0.01em',
            }}>
              Sin riesgo · Sin coste inicial · Solo pagas si hay éxito
            </div>
            <h2 style={{
              fontSize: 'clamp(1.7rem, 4vw, 2.5rem)', fontWeight: 900,
              color: '#fff', lineHeight: 1.15, marginBottom: 18, letterSpacing: '-0.03em',
            }}>
              ¿Tu empresa está dejando pasar<br />dinero público?
            </h2>
            <p style={{ fontSize: '1.05rem', color: 'rgba(255,255,255,0.6)', marginBottom: 36, lineHeight: 1.65, maxWidth: 480, margin: '0 auto 36px' }}>
              Regístrate gratis, analizamos tu empresa y te decimos exactamente qué subvenciones puedes conseguir.
              Si las tramitamos y no se conceden, <strong style={{ color: 'rgba(255,255,255,0.85)' }}>no te cobramos nada</strong>.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <button
                onClick={() => setAuthOpen(true)}
                style={{
                  background: '#0d9488', color: '#fff', border: 'none', borderRadius: 14,
                  padding: '17px 40px', fontSize: '1.05rem', fontWeight: 800, cursor: 'pointer',
                  fontFamily: 'inherit', letterSpacing: '-0.01em',
                  boxShadow: '0 4px 24px rgba(13,148,136,0.4)',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 32px rgba(13,148,136,0.5)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 24px rgba(13,148,136,0.4)';
                }}
              >
                Ver mis subvenciones gratis
              </button>
              <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.28)' }}>
                Gratuito · Sin tarjeta · Sin compromiso
              </p>
            </div>
          </div>
        </section>

        <FAQ />
        <ContactSection />
      </main>
      <LandingFooter />
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    </div>
  );
}
