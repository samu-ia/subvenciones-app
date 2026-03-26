import { Search, FileCheck, BadgeCheck, Lock } from 'lucide-react';

const features = [
  {
    icon: Search,
    title: 'Búsqueda automática',
    description: 'Escaneamos miles de convocatorias públicas cada día y filtramos únicamente las que encajan con tu empresa.',
  },
  {
    icon: FileCheck,
    title: 'Gestión completa',
    description: 'Preparamos toda la documentación, coordinamos el proceso y lo presentamos en tu nombre. Sin burocracia para ti.',
  },
  {
    icon: BadgeCheck,
    title: 'Solo pagas si ganas',
    description: 'Honorarios únicamente si se concede la subvención. Sin cuotas mensuales, sin costes iniciales, sin sorpresas.',
  },
  {
    icon: Lock,
    title: 'Datos seguros',
    description: 'Tratamos tu información con total confidencialidad y pleno cumplimiento del RGPD. Nunca compartimos tus datos.',
  },
];

const stats = [
  { value: '+1.000', label: 'Subvenciones en base de datos' },
  { value: '24/7',   label: 'Monitorización de convocatorias' },
  { value: '0 €',    label: 'Coste si no hay subvención' },
  { value: '100%',   label: 'Gestionado por nosotros' },
];

export default function AboutUs() {
  return (
    <section id="quienes-somos" className="section-padding bg-background">
      <div className="container-custom">

        {/* Header */}
        <div className="text-center max-w-2xl mx-auto" style={{ marginBottom: '3rem' }}>
          <span className="inline-block text-accent font-semibold text-sm uppercase tracking-wider" style={{ marginBottom: '1rem', display: 'block' }}>
            Quiénes somos
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem', marginBottom: '2.5rem' }}>
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
        <div style={{ background: 'hsl(210 25% 93%)', borderRadius: '1.25rem', padding: '3rem 3.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', alignItems: 'center' }}>
            <div>
              <h3 className="font-heading font-bold text-foreground" style={{ fontSize: '1.6rem', marginBottom: '1rem' }}>
                Por qué existimos
              </h3>
              <p className="text-muted-foreground" style={{ lineHeight: 1.7, marginBottom: '1rem' }}>
                Cada año se convocan miles de millones en subvenciones públicas para empresas. La gran mayoría
                quedan sin solicitar porque los empresarios no tienen tiempo, no conocen los requisitos o se
                pierden en la burocracia.
              </p>
              <p className="text-muted-foreground" style={{ lineHeight: 1.7 }}>
                Nosotros detectamos las ayudas que encajan con tu negocio, preparamos el expediente completo
                y lo presentamos. Solo firmamos contrato cuando hay una subvención concreta lista para tramitar —
                y solo cobramos si se concede.
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
