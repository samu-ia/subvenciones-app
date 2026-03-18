import type { Metadata } from 'next';
import LandingClient from '@/components/landing/LandingClient';

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
  return <LandingClient />;
}
