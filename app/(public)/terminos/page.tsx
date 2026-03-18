import type { Metadata } from 'next';
import LandingHeader from '@/components/landing/LandingHeader';
import LandingFooter from '@/components/landing/LandingFooter';

export const metadata: Metadata = {
  title: 'Términos y Condiciones – AyudaPyme',
  description: 'Información legal y condiciones de uso del servicio AyudaPyme.',
};

export default function TerminosPage() {
  return (
    <div className="landing min-h-screen bg-background flex flex-col">
      <LandingHeader />

      <header className="hero-gradient py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold text-primary-foreground mb-4">
            Términos y Condiciones
          </h1>
          <p className="text-lg text-primary-foreground/80 max-w-2xl mx-auto">
            Información legal y condiciones de uso del servicio.
          </p>
        </div>
      </header>

      <section className="py-12 md:py-20 flex-1">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-foreground leading-relaxed space-y-6 text-base">

          <p className="text-right text-sm text-muted-foreground">Última actualización: 20/1/26</p>

          <h2 className="text-2xl font-heading font-semibold">1. Objeto del servicio</h2>
          <p>
            La plataforma ofrece un servicio de búsqueda, análisis y notificación de subvenciones
            públicas que puedan ser de interés para empresas, autónomos o emprendedores, así como
            orientación general sobre los requisitos de cada convocatoria.<br />
            El servicio no garantiza la concesión de ninguna ayuda ni sustituye el asesoramiento
            legal, fiscal o administrativo profesional.
          </p>

          <h2 className="text-2xl font-heading font-semibold">2. Naturaleza informativa</h2>
          <p>
            La información proporcionada se basa en fuentes públicas (BOE, DOG, BDNS, etc.) y puede:<br />
            - Estar incompleta<br />
            - Contener errores<br />
            - Quedar desactualizada<br />
            El usuario es responsable de verificar siempre la información en fuentes oficiales antes
            de tomar decisiones.
          </p>

          <h2 className="text-2xl font-heading font-semibold">3. Limitación de responsabilidad</h2>
          <p>
            La plataforma no se hace responsable de:<br />
            - Denegaciones de subvenciones<br />
            - Pérdida de plazos<br />
            - Errores en solicitudes<br />
            - Cambios normativos<br />
            - Interpretaciones incorrectas por parte del usuario<br />
            La decisión final de solicitar una ayuda es exclusiva del usuario.
          </p>

          <h2 className="text-2xl font-heading font-semibold">4. No existe relación contractual con la administración</h2>
          <p>
            El servicio no representa a ninguna administración pública ni tiene vínculo con organismos
            oficiales.<br />
            La plataforma actúa como intermediario informativo, no como autoridad competente.
          </p>

          <h2 className="text-2xl font-heading font-semibold">5. Uso permitido</h2>
          <p>
            El usuario se compromete a:<br />
            - Usar el servicio de forma legal<br />
            - No manipular datos<br />
            - No suplantar identidades<br />
            - No usar la plataforma para fines fraudulentos<br />
            El incumplimiento puede implicar la suspensión del acceso.
          </p>

          <h2 className="text-2xl font-heading font-semibold">6. Exactitud de los datos del usuario</h2>
          <p>
            El usuario es responsable de:<br />
            - Facilitar datos veraces<br />
            - Mantenerlos actualizados<br />
            - Asegurarse de que la información de su empresa es correcta<br />
            Errores en los datos pueden afectar a los resultados del servicio.
          </p>

          <h2 className="text-2xl font-heading font-semibold">7. Subcontratación</h2>
          <p>
            La plataforma puede colaborar con gestorías, asesores o terceros para la tramitación o
            análisis de subvenciones.<br />
            Estos terceros actúan de forma independiente y bajo sus propios términos.
          </p>

          <h2 className="text-2xl font-heading font-semibold">8. Propiedad intelectual</h2>
          <p>
            Todos los contenidos, textos, informes, estructuras y sistemas de la plataforma son
            propiedad del titular del servicio.<br />
            No se permite:<br />
            - Copiar<br />
            - Revender<br />
            - Reutilizar<br />
            - Automatizar<br />
            sin autorización expresa.
          </p>

          <h2 className="text-2xl font-heading font-semibold">9. Protección de datos</h2>
          <p>
            Los datos personales se tratarán conforme al RGPD y la normativa española vigente.<br />
            El usuario puede ejercer sus derechos de:<br />
            - Acceso<br />
            - Rectificación<br />
            - Supresión<br />
            - Limitación<br />
            - Portabilidad<br />
            (Ver nuestra Política de Privacidad para más detalles.)
          </p>

          <h2 className="text-2xl font-heading font-semibold">10. Comunicaciones</h2>
          <p>
            El usuario acepta que la plataforma pueda ponerse en contacto con él por teléfono y/o
            correo electrónico (incluyendo servicios como Gmail) para la gestión, información o
            notificación relacionada con el servicio.
          </p>

          <h2 className="text-2xl font-heading font-semibold">11. Modificaciones</h2>
          <p>
            Los términos pueden cambiar en cualquier momento.<br />
            El uso continuado del servicio implica la aceptación de las nuevas condiciones.
          </p>

          <h2 className="text-2xl font-heading font-semibold">12. Legislación aplicable</h2>
          <p>
            Se aplicará la legislación española.<br />
            Cualquier conflicto se resolverá en los tribunales de España.
          </p>

        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
