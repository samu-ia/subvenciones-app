'use client';

import { TrendingUp, FileCheck, BadgeCheck, Shield } from 'lucide-react';
import { useMediaQuery } from '@/lib/hooks/use-media-query';

const features = [
  {
    icon: TrendingUp,
    title: 'El dinero ya está aprobado',
    description: 'No inventamos nada. Son convocatorias públicas reales, ya publicadas, con presupuesto asignado. Solo hay que solicitarlas.',
  },
  {
    icon: FileCheck,
    title: 'Hacemos el 100% del trabajo',
    description: 'Tú nos das 4 datos. Nosotros buscamos, preparamos, presentamos y hacemos el seguimiento. Sin que toques un papel.',
  },
  {
    icon: BadgeCheck,
    title: 'Solo cobras tú primero',
    description: 'Recibes la subvención. Luego nos pagas el 15%. Si no hay subvención, no hay factura. Sin letra pequeña.',
  },
  {
    icon: Shield,
    title: 'Llevamos años en esto',
    description: 'Conocemos cada convocatoria, cada requisito, cada plazo. El expediente que presentamos es el que se aprueba.',
  },
];

const stats = [
  { value: '4.000M€', label: 'sin pedir cada año en España' },
  { value: '87%',     label: 'de nuestras solicitudes se aprueban' },
  { value: '15%',     label: 'solo si conseguimos la subvención' },
  { value: '24h',     label: 'para tu análisis personalizado' },
];

export default function AboutUs() {
  const isMobile = useMediaQuery('(max-width: 768px)');

  return (
    <section id="quienes-somos" className="section-padding bg-background">
      <div className="container-custom">

        {/* Header */}
        <div className="text-center max-w-2xl mx-auto" style={{ marginBottom: '3rem' }}>
          <span className="inline-block text-accent font-semibold text-sm uppercase tracking-wider" style={{ marginBottom: '1rem', display: 'block' }}>
            Por qué funciona
          </span>
          <h2 className="font-heading font-bold text-foreground" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.25rem)', marginBottom: '1rem', lineHeight: 1.2 }}>
            Hacemos el trabajo duro.<br />Tú recibes el dinero.
          </h2>
          <p className="text-muted-foreground" style={{ fontSize: '1.05rem', lineHeight: 1.7 }}>
            La mayoría de pymes pierden subvenciones por no enterarse a tiempo o no saber cómo pedirlas.
            En AyudaPyme lo gestionamos todo — desde detectar la ayuda hasta presentar el expediente.
          </p>
        </div>

        {/* Feature cards */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: '1.25rem', marginBottom: '2.5rem' }}>
          {features.map((f) => (
            <div
              key={f.title}
              style={{
                background: '#fff',
                border: '1px solid hsl(210 20% 88%)',
                borderRadius: '0.875rem',
                padding: '1.75rem',
                boxShadow: '0 2px 12px rgba(13,31,60,0.07)',
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 10,
                background: 'hsl(215 70% 35% / 0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: '1rem',
              }}>
                <f.icon size={20} color="hsl(215, 70%, 35%)" />
              </div>
              <h3 className="font-heading font-semibold text-foreground" style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>{f.title}</h3>
              <p className="text-muted-foreground" style={{ fontSize: '0.85rem', lineHeight: 1.6 }}>{f.description}</p>
            </div>
          ))}
        </div>

        {/* Mission + stats */}
        <div style={{ background: 'hsl(210 25% 93%)', borderRadius: '1.25rem', padding: isMobile ? '1.5rem 1.25rem' : '3rem 3.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '1.5rem' : '3rem', alignItems: 'center' }}>
            <div>
              <h3 className="font-heading font-bold text-foreground" style={{ fontSize: '1.6rem', marginBottom: '1rem' }}>
                El problema que resolvemos
              </h3>
              <p className="text-muted-foreground" style={{ lineHeight: 1.7, marginBottom: '1rem' }}>
                Cada año se quedan sin pedir más de 4.000 millones en subvenciones. No porque las empresas
                no cumplan los requisitos. Sino porque no se enteran a tiempo, no saben cómo pedirlas
                o se pierden en el papeleo. Nosotros existimos para que ese dinero llegue a quien le corresponde.
              </p>
              <p className="text-muted-foreground" style={{ lineHeight: 1.7 }}>
                Tú pones la empresa. Nosotros ponemos el resto.
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {stats.map((s) => (
                <div key={s.label} style={{ background: '#fff', borderRadius: '0.875rem', padding: '1.5rem', textAlign: 'center', boxShadow: '0 2px 8px rgba(13,31,60,0.06)' }}>
                  <div className="font-heading font-bold text-primary" style={{ fontSize: '1.75rem', lineHeight: 1, marginBottom: '0.4rem' }}>
                    {s.value}
                  </div>
                  <div className="text-muted-foreground" style={{ fontSize: '0.8rem', lineHeight: 1.4 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
