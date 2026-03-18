import { CheckCircle } from 'lucide-react';

const benefits = ['Sin riesgo', 'Hacemos todo por ti', 'Solo pagas si ganamos'];

export default function Hero() {
  return (
    <section id="inicio" className="relative min-h-screen flex items-center hero-gradient overflow-hidden">
      {/* Background blobs */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-10 w-72 h-72 bg-background rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-background rounded-full blur-3xl" />
      </div>

      <div className="container-custom relative z-10 pt-20">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold text-primary-foreground mb-6 animate-slide-up text-balance">
            No pierdas más oportunidades para tu negocio
          </h1>

          <p
            className="text-lg md:text-xl text-primary-foreground/80 mb-8 animate-slide-up"
            style={{ animationDelay: '0.1s' }}
          >
            Te ayudaremos a encontrar todas las subvenciones disponibles para tu empresa sin que tengas que hacer prácticamente nada.
          </p>

          <div
            className="flex flex-wrap justify-center gap-4 mb-10 animate-slide-up"
            style={{ animationDelay: '0.2s' }}
          >
            {benefits.map((b) => (
              <div key={b} className="flex items-center gap-2 text-primary-foreground/90">
                <CheckCircle className="w-5 h-5 text-accent" />
                <span className="text-sm font-medium">{b}</span>
              </div>
            ))}
          </div>

          <div className="animate-slide-up mb-6 md:mb-0" style={{ animationDelay: '0.3s' }}>
            <a href="#formulario" className="btn-hero group">
              Solicitar sin compromiso
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
