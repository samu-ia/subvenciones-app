'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';

const navLinks = [
  { href: '#inicio', label: 'Inicio' },
  { href: '#quienes-somos', label: 'Quiénes somos' },
  { href: '#faq', label: 'Preguntas frecuentes' },
  { href: '#contacto', label: 'Contacto' },
];

export default function LandingHeader({ onAuthClick }: { onAuthClick?: () => void }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const linkClass = isScrolled
    ? 'font-semibold transition-colors text-foreground hover:text-primary'
    : 'font-semibold transition-colors text-white/90 hover:text-white';

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b ${
        isScrolled
          ? 'bg-card/95 backdrop-blur-md shadow-md border-border/30'
          : 'hero-gradient border-white/15'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={isScrolled ? '/logo-dark.png' : '/logo-light.png'}
              alt="AyudaPyme logo"
              className="w-10 h-10 object-contain transition-all duration-300"
            />
            {!isScrolled && (
              <span className="font-heading font-bold text-xl text-white">AyudaPyme</span>
            )}
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} className={linkClass}>
                {link.label}
              </a>
            ))}
            <button
              onClick={onAuthClick}
              className={`font-semibold px-4 py-2 rounded-full border transition-all text-sm cursor-pointer ${
                isScrolled
                  ? 'border-primary text-primary hover:bg-primary hover:text-primary-foreground'
                  : 'border-white/60 text-white hover:bg-white/15'
              }`}
            >
              Acceder
            </button>
          </nav>

          {/* Mobile toggle */}
          <button
            className={`md:hidden p-2 ${isScrolled ? 'text-foreground' : 'text-white'}`}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <nav className={`md:hidden py-4 border-t animate-fade-in ${isScrolled ? 'border-border' : 'border-white/15'}`}>
            <div className="flex flex-col gap-4">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`font-semibold py-2 transition-colors ${
                    isScrolled ? 'text-foreground hover:text-primary' : 'text-white hover:text-white/80'
                  }`}
                >
                  {link.label}
                </a>
              ))}
              <button
                onClick={() => { setIsMobileMenuOpen(false); onAuthClick?.(); }}
                className={`font-semibold py-2 transition-colors text-left cursor-pointer bg-transparent border-none ${
                  isScrolled ? 'text-primary' : 'text-white'
                }`}
              >
                Acceder →
              </button>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
