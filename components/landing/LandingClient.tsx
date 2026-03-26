'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import LandingHeader from '@/components/landing/LandingHeader';
import Hero from '@/components/landing/Hero';
import AboutUs from '@/components/landing/AboutUs';
import HowItWorks from '@/components/landing/HowItWorks';
import Testimonials from '@/components/landing/Testimonials';
import Pricing from '@/components/landing/Pricing';
import FAQ from '@/components/landing/FAQ';
import ContactSection from '@/components/landing/ContactSection';
import LandingFooter from '@/components/landing/LandingFooter';
import AuthModal from '@/components/landing/AuthModal';
import BenefitsTicker from '@/components/landing/BenefitsTicker';

export default function LandingClient() {
  const [authOpen, setAuthOpen] = useState(false);
  const [checking, setChecking] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const timeout = setTimeout(() => setChecking(false), 3000);
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: perfil } = await supabase
            .from('perfiles').select('rol').eq('id', user.id).maybeSingle();
          const rol = perfil?.rol ?? user.user_metadata?.rol ?? 'cliente';
          router.replace(rol === 'admin' ? '/dashboard' : '/portal');
          return;
        }
      } catch { /* ignora errores de red — muestra landing */ }
      clearTimeout(timeout);
      setChecking(false);
    })();
    return () => clearTimeout(timeout);
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
    <div className="landing min-h-screen bg-background overflow-x-hidden" style={{ overflowX: 'hidden' }}>
      <LandingHeader onAuthClick={() => setAuthOpen(true)} />
      <main>
        <Hero onAuthClick={() => setAuthOpen(true)} />
        <BenefitsTicker />
        <AboutUs />
        <HowItWorks />
        <Testimonials />
        <Pricing onAuthClick={() => setAuthOpen(true)} />
        <FAQ />
        <ContactSection />
      </main>
      <LandingFooter />
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    </div>
  );
}
