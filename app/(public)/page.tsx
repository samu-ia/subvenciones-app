import type { Metadata } from 'next';
import LandingClient from '@/components/landing/LandingClient';

export const metadata: Metadata = {
  title: 'AyudaPyme – Subvenciones para tu empresa | 0€ hasta que cobres',
  description:
    'Detectamos y tramitamos todas las subvenciones disponibles para tu PYME. Sin riesgo: solo pagas el 15% si conseguimos la subvención. Análisis gratuito en 24h.',
  keywords: 'subvenciones pymes, ayudas empresas, subvenciones españa, tramitación subvenciones, ayudas digitalización, subvenciones kit digital',
  openGraph: {
    type: 'website',
    title: 'AyudaPyme – Subvenciones para tu empresa | 0€ hasta que cobres',
    description: 'Detectamos y tramitamos subvenciones para tu PYME. Solo pagas si ganamos. Análisis gratuito en 24h.',
    url: 'https://ayudapyme.es',
    siteName: 'AyudaPyme',
    locale: 'es_ES',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AyudaPyme – Subvenciones para tu empresa',
    description: 'Solo pagas si conseguimos la subvención. Análisis gratuito en 24h.',
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: 'https://ayudapyme.es',
  },
};

export default function LandingPage() {
  return <LandingClient />;
}
