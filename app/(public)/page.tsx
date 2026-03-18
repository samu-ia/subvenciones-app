import type { Metadata } from 'next';
import LandingHeader from '@/components/landing/LandingHeader';
import Hero from '@/components/landing/Hero';
import AboutUs from '@/components/landing/AboutUs';
import FAQ from '@/components/landing/FAQ';
import ContactSection from '@/components/landing/ContactSection';
import MultiStepForm from '@/components/landing/MultiStepForm';
import LandingFooter from '@/components/landing/LandingFooter';

export const metadata: Metadata = {
  title: 'AyudaPyme – Subvenciones para tu empresa',
  description:
    'Localizamos y tramitamos todas las subvenciones disponibles para tu empresa. Sin riesgo, hacemos todo por ti, solo pagas si ganamos.',
  openGraph: {
    title: 'AyudaPyme – Subvenciones para tu empresa',
    description: 'Localizamos y tramitamos subvenciones. Solo pagas si ganamos.',
    url: 'https://ayudapyme.es',
  },
};

export default function LandingPage() {
  return (
    <div className="landing min-h-screen bg-background">
      <LandingHeader />
      <main>
        <Hero />
        <AboutUs />
        <FAQ />
        <ContactSection />
        <MultiStepForm />
      </main>
      <LandingFooter />
    </div>
  );
}
