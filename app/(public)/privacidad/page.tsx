import type { Metadata } from 'next';
import LandingHeader from '@/components/landing/LandingHeader';
import LandingFooter from '@/components/landing/LandingFooter';

export const metadata: Metadata = {
  title: 'Política de Privacidad – AyudaPyme',
  description: 'Información sobre cómo gestionamos tus datos personales en AyudaPyme.',
};

export default function PrivacidadPage() {
  return (
    <div className="landing min-h-screen bg-background flex flex-col">
      <LandingHeader />

      <header className="hero-gradient py-16 md:py-24 text-center">
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold text-primary-foreground">
          Política de Privacidad
        </h1>
        <p className="text-primary-foreground/80 mt-4 max-w-2xl mx-auto text-lg">
          Información sobre cómo gestionamos tus datos personales en AyudaPyme.
        </p>
      </header>

      <main className="flex-1 py-12 md:py-20">
        <div className="container-custom max-w-3xl mx-auto space-y-8 text-foreground leading-relaxed">

          <p className="text-right text-sm text-muted-foreground">Última actualización: 20/01/26</p>

          <section>
            <h2 className="text-2xl font-heading font-semibold mb-3">1. Responsable del tratamiento</h2>
            <p>
              El responsable del tratamiento de los datos es AyudaPyme. Puedes contactar para cualquier
              cuestión relacionada con privacidad a través del email{' '}
              <a href="mailto:admin@ayudapyme.es" className="text-primary font-semibold hover:underline">
                info@ayudapyme.es
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-heading font-semibold mb-3">2. Datos que recogemos</h2>
            <p>Recopilamos los siguientes datos a través de los formularios de la web:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Nombre y apellidos</li>
              <li>Email</li>
              <li>Teléfono</li>
              <li>Identificación fiscal (NIF/CIF/NIE)</li>
              <li>Datos de empresa y actividad</li>
              <li>Ciudad y domicilio fiscal</li>
              <li>Cualquier información adicional que el usuario incluya en los formularios</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-heading font-semibold mb-3">3. Finalidad del tratamiento</h2>
            <p>Tratamos tus datos para:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Gestionar y responder solicitudes enviadas mediante los formularios</li>
              <li>Contactar contigo por email o teléfono para información sobre subvenciones, seguimiento o notificaciones relacionadas con el servicio</li>
              <li>Mejorar la experiencia de usuario y la calidad del servicio</li>
              <li>Cumplir obligaciones legales</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-heading font-semibold mb-3">4. Base legal del tratamiento</h2>
            <p>
              La base jurídica es tu consentimiento (al enviar el formulario), el cumplimiento de
              obligaciones legales y, en su caso, la ejecución de servicios solicitados.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-heading font-semibold mb-3">5. Conservación de los datos</h2>
            <p>
              Los datos se conservarán el tiempo necesario para cumplir con las finalidades descritas o
              mientras exista una relación activa con el usuario. Posteriormente, se bloquearán y
              conservarán solo para atender posibles responsabilidades legales.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-heading font-semibold mb-3">6. Destinatarios y subcontratación</h2>
            <p>
              Los datos podrán ser comunicados a gestorías, asesores o colaboradores externos para la
              gestión o análisis de subvenciones, siempre bajo acuerdos de confidencialidad y solo para
              la finalidad indicada. No se cederán datos a terceros salvo obligación legal.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-heading font-semibold mb-3">7. Derechos del usuario</h2>
            <p>Puedes ejercer los siguientes derechos sobre tus datos personales:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Acceso</li>
              <li>Rectificación</li>
              <li>Supresión</li>
              <li>Limitación</li>
              <li>Oposición</li>
              <li>Portabilidad</li>
              <li>Retirada del consentimiento en cualquier momento</li>
            </ul>
            <p className="mt-2">
              Para ejercer estos derechos, contacta en{' '}
              <a href="mailto:info@ayudapyme.es" className="text-primary font-semibold hover:underline">
                info@ayudapyme.es
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-heading font-semibold mb-3">8. Seguridad</h2>
            <p>
              Aplicamos medidas técnicas y organizativas para proteger tus datos personales y evitar el
              acceso no autorizado, pérdida o alteración.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-heading font-semibold mb-3">9. Cambios en la política</h2>
            <p>
              Podemos modificar esta política de privacidad en cualquier momento. La versión vigente
              estará siempre disponible en esta página.
            </p>
          </section>

        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
