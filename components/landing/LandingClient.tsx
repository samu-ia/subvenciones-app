'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import LandingHeader from '@/components/landing/LandingHeader';
import Hero from '@/components/landing/Hero';
import AboutUs from '@/components/landing/AboutUs';
import FAQ from '@/components/landing/FAQ';
import ContactSection from '@/components/landing/ContactSection';
import MultiStepForm from '@/components/landing/MultiStepForm';
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
        <FAQ />
        <ContactSection />
        <MultiStepForm />
      </main>
      <LandingFooter />
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    </div>
  );
}
