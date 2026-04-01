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
import FinalCTA from '@/components/landing/FinalCTA';

export default function LandingClient() {
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  function openLogin() { setAuthMode('login'); setAuthOpen(true); }
  function openRegister() { setAuthMode('register'); setAuthOpen(true); }
  const router = useRouter();
  const supabase = createClient();

  // Redirigir silenciosamente si el usuario ya está autenticado
  // Sin bloquear el render de la landing
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: perfil } = await supabase
            .from('perfiles').select('rol').eq('id', user.id).maybeSingle();
          const rol = perfil?.rol ?? user.user_metadata?.rol ?? 'cliente';
          router.replace(rol === 'admin' ? '/dashboard' : rol === 'proveedor' ? '/proveedor' : '/portal');
        }
      } catch { /* ignora errores de red */ }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="landing min-h-screen bg-background overflow-x-hidden" style={{ overflowX: 'hidden' }}>
      <LandingHeader onAuthClick={openLogin} />
      <main>
        <Hero onAuthClick={openRegister} />
        <BenefitsTicker />
        <AboutUs />
        <HowItWorks />
        <Testimonials onAuthClick={openRegister} />
        <Pricing onAuthClick={openRegister} />
        <FAQ />
        <FinalCTA onAuthClick={openRegister} />
        <ContactSection />
      </main>
      <LandingFooter />
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} initialMode={authMode} />}
    </div>
  );
}
