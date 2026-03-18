import type { Metadata } from 'next';
import Link from 'next/link';
import LandingHeader from '@/components/landing/LandingHeader';
import LandingFooter from '@/components/landing/LandingFooter';

export const metadata: Metadata = {
  title: 'Contacto – AyudaPyme',
  description: 'Contacta con AyudaPyme. Estamos para que no pierdas ninguna oportunidad de subvención para tu negocio.',
};

export default function ContactoPage() {
  return (
    <div className="landing min-h-screen flex flex-col bg-background text-foreground">
      <LandingHeader />

      <main className="flex-1 pt-24 md:pt-32">
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <div className="text-center mb-10">
            <h1 className="text-3xl md:text-4xl font-heading font-bold mb-4">
              Contacta con nosotros
            </h1>
            <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
              Si tienes dudas sobre las subvenciones, el proceso o quieres que revisemos tu caso,
              escríbenos o solicita una llamada. Estamos para que no pierdas ninguna oportunidad
              para tu negocio.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Horario de llamadas */}
            <div className="rounded-2xl bg-card/90 border border-border/40 shadow-md p-6">
              <h2 className="text-xl font-semibold mb-3">Horario de llamadas</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Podemos llamarte o atender tus llamadas en el siguiente horario (hora peninsular
                española):
              </p>
              <ul className="space-y-1 text-sm">
                <li>Lunes a viernes: 10:00 – 14:00</li>
                <li>Lunes a viernes: 16:00 – 19:00</li>
              </ul>
              <p className="mt-4 text-sm text-muted-foreground">
                Indica tu disponibilidad en el formulario y ajustaremos la llamada lo máximo posible.
              </p>
            </div>

            {/* Correo electrónico */}
            <div className="rounded-2xl bg-card/90 border border-border/40 shadow-md p-6 flex flex-col justify-between">
              <div>
                <h2 className="text-xl font-semibold mb-3">Correo electrónico</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Si lo prefieres, puedes escribirnos directamente. Te responderemos con una
                  valoración clara y sin compromiso.
                </p>
                <a
                  href="mailto:info@ayudapyme.es"
                  className="inline-flex items-center font-medium underline underline-offset-4 hover:no-underline"
                >
                  info@ayudapyme.es
                </a>
              </div>
              <div className="mt-6">
                <p className="text-xs text-muted-foreground">
                  Cuanta más información nos des sobre tu empresa (sector, tamaño, ubicación), más
                  precisa podrá ser nuestra respuesta.
                </p>
              </div>
            </div>
          </div>

          {/* CTA hacia el formulario */}
          <div className="mt-10 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              También puedes rellenar nuestro formulario para que estudiemos tu caso de forma
              detallada.
            </p>
            <Link
              href="/#formulario"
              className="btn-primary inline-flex items-center justify-center"
            >
              Ir al formulario
            </Link>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
