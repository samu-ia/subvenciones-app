'use client';

import { useState } from 'react';
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
