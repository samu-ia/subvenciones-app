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

        {/* Sección de registro destacada */}
        <section style={{ background: '#0d1f3c', padding: '64px 24px', textAlign: 'center' }}>
          <div style={{ maxWidth: 580, margin: '0 auto' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(13,148,136,0.2)', border: '1px solid rgba(13,148,136,0.4)', borderRadius: 20, padding: '4px 14px', fontSize: '0.78rem', color: '#5eead4', fontWeight: 700, marginBottom: 20 }}>
              ✓ Sin riesgo · Solo pagas si ganamos
            </div>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', lineHeight: 1.2, marginBottom: 16 }}>
              Consigue subvenciones a éxito
            </h2>
            <p style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.65)', marginBottom: 32, lineHeight: 1.6 }}>
              Crea tu cuenta gratuita y descubre en minutos qué subvenciones están disponibles para tu empresa.
              Nuestro equipo tramita todo — tú solo recibes el dinero.
            </p>
            <button
              onClick={() => setAuthOpen(true)}
              style={{
                background: '#0d9488', color: '#fff', border: 'none', borderRadius: 12,
                padding: '16px 36px', fontSize: '1rem', fontWeight: 800, cursor: 'pointer',
                fontFamily: 'inherit', letterSpacing: '-0.01em',
              }}
            >
              Crear cuenta gratuita →
            </button>
            <p style={{ marginTop: 14, fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)' }}>
              ¿Ya tienes cuenta?{' '}
              <button onClick={() => setAuthOpen(true)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.55)', cursor: 'pointer', fontSize: '0.78rem', textDecoration: 'underline', fontFamily: 'inherit' }}>
                Iniciar sesión
              </button>
            </p>
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
