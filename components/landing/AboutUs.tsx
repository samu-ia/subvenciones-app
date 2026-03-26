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
        <div className="text-center max-w-2xl mx-auto mb-20">
          <span className="inline-block text-accent font-semibold text-sm uppercase tracking-wider mb-4">
            Quiénes somos
          </span>
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-6">
            Hacemos el trabajo duro.<br />Tú recibes el dinero.
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed">
            La mayoría de pymes pierden subvenciones por no enterarse a tiempo o no saber cómo pedirlas.
            En AyudaPyme lo gestionamos todo — desde detectar la ayuda hasta presentar el expediente.
          </p>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-20">
          {features.map((f) => (
            <div key={f.title} className="bg-card p-7 rounded-xl card-elevated group">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary group-hover:scale-110 transition-all duration-300">
                <f.icon className="w-6 h-6 text-primary group-hover:text-primary-foreground transition-colors" />
              </div>
              <h3 className="font-heading font-semibold text-foreground mb-2 text-base">{f.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>

        {/* Mission + stats */}
        <div className="bg-secondary rounded-2xl p-10 md:p-14">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h3 className="text-2xl md:text-3xl font-heading font-bold text-foreground mb-5">
                Por qué existimos
              </h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Cada año se convocan miles de millones en subvenciones públicas para empresas. La gran mayoría
                quedan sin solicitar porque los empresarios no tienen tiempo, no conocen los requisitos o se
                pierden en la burocracia.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Nosotros detectamos las ayudas que encajan con tu negocio, preparamos el expediente completo
                y lo presentamos. Solo firmamos contrato cuando hay una subvención concreta lista para tramitar —
                y solo cobramos si se concede.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-5">
              {stats.map((s) => (
                <div key={s.label} className="bg-card p-6 rounded-xl text-center">
                  <div className="text-2xl md:text-3xl font-heading font-bold text-primary mb-2 leading-tight">
                    {s.value}
                  </div>
                  <div className="text-muted-foreground text-sm leading-snug">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
