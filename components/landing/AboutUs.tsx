'use client';

import { Search, FileCheck, BadgeCheck, Lock } from 'lucide-react';
import { useMediaQuery } from '@/lib/hooks/use-media-query';

const features = [
  {
    icon: Search,
    title: 'Buscamos por ti',
    description: 'Escaneamos todas las convocatorias y te avisamos de las que encajan.',
  },
  {
    icon: FileCheck,
    title: 'Gestionamos todo',
    description: 'Preparamos el expediente y lo presentamos. Tu no haces nada.',
  },
  {
    icon: BadgeCheck,
    title: 'Solo si ganas',
    description: 'Sin cuotas. Sin coste inicial. Solo pagas si cobras.',
  },
  {
    icon: Lock,
    title: 'Datos seguros',
    description: 'RGPD completo. Nunca compartimos tu informacion.',
  },
];

const stats = [
  { value: '1.000+', label: 'Subvenciones' },
  { value: '24/7',   label: 'Monitorizacion' },
  { value: '0',      label: 'Coste inicial' },
  { value: '100%',   label: 'Gestionado' },
];

export default function AboutUs() {
  const isMobile = useMediaQuery('(max-width: 768px)');

  return (
    <section id="quienes-somos" className="section-padding bg-background">
      <div className="container-custom">

        {/* Header */}
        <div className="text-center max-w-xl mx-auto" style={{ marginBottom: '2.5rem' }}>
          <h2 className="font-heading font-bold text-foreground" style={{ fontSize: 'clamp(1.6rem, 3vw, 2rem)', marginBottom: '0.75rem', lineHeight: 1.2 }}>
            Tu no haces nada. Nosotros todo.
          </h2>
          <p className="text-muted-foreground" style={{ fontSize: '1rem', lineHeight: 1.6 }}>
            La mayoria de pymes pierden subvenciones por no enterarse o no saber pedirlas. Nosotros lo solucionamos.
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

        {/* Stats bar */}
        <div style={{ background: 'hsl(210 25% 93%)', borderRadius: '1rem', padding: isMobile ? '1.25rem' : '1.5rem 2rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '1rem' }}>
            {stats.map((s) => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div className="font-heading font-bold text-primary" style={{ fontSize: '1.5rem', lineHeight: 1, marginBottom: '0.25rem' }}>
                  {s.value}
                </div>
                <div className="text-muted-foreground" style={{ fontSize: '0.75rem' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
