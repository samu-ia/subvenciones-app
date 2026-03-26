'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const faqs = [
  {
    question: '¿Cuánto tiempo tarda el proceso?',
    answer:
      'Depende de la convocatoria, pero en general el análisis inicial lo hacemos en 24-48 horas. La tramitación completa del expediente varía según el organismo — puede ir de unas semanas a varios meses. Te informaremos del plazo concreto antes de empezar.',
  },
  {
    question: '¿Qué documentación necesito aportar?',
    answer:
      'Para el análisis inicial solo necesitamos el NIF/CIF y datos básicos de tu actividad (sector, tamaño, ubicación). Si decidimos tramitar una subvención concreta, te indicaremos exactamente qué documentos se necesitan para ese expediente.',
  },
  {
    question: '¿Cómo funciona el pago?',
    answer:
      'El servicio es 100% a éxito. No pagas nada hasta que la subvención se concede y cobras el dinero. Cuando identificamos una subvención concreta para tu empresa y decides tramitarla, firmamos un contrato de encargo donde se especifica el porcentaje de honorarios acordado. Si no hay subvención, no hay factura.',
  },
  {
    question: '¿Puedo hacer seguimiento de mi trámite?',
    answer:
      'Sí. Tienes acceso a tu panel donde puedes ver el estado de cada expediente en tiempo real. Además te avisamos por email en cada hito importante del proceso.',
  },
  {
    question: '¿Qué tipo de empresas pueden solicitar vuestros servicios?',
    answer:
      'Trabajamos con autónomos, microempresas, pymes y empresas medianas. El perfil de subvenciones disponibles varía según tu sector, comunidad autónoma y tamaño — por eso hacemos el análisis personalizado primero.',
  },
  {
    question: '¿Ofrecéis asesoramiento fiscal o contable?',
    answer:
      'No. Nos especializamos exclusivamente en detectar y gestionar subvenciones. Para asesoramiento fiscal o contable te recomendamos acudir a un gestor o asesor especializado.',
  },
  {
    question: '¿Qué garantías ofrecéis?',
    answer:
      'Garantizamos la confidencialidad total de tus datos, el cumplimiento de todas las normativas vigentes y máxima profesionalidad en cada expediente. Pero la garantía más importante es el propio modelo: si no conseguimos la subvención, no cobramos. Nuestros intereses están alineados con los tuyos.',
  },
  {
    question: '¿Es una suscripción? ¿Hay algún coste oculto?',
    answer:
      'No. No hay suscripción, ni cuota mensual, ni coste de análisis inicial. Solo firmamos contrato cuando hay una subvención concreta que tramitar, y solo facturamos si se concede. Sin letra pequeña.',
  },
];

export default function FAQ() {
  return (
    <section id="faq" className="section-padding bg-muted">
      <div className="container-custom">

        <div className="text-center max-w-2xl mx-auto mb-10" style={{ marginBottom: '2.5rem' }}>
          <span className="inline-block text-accent font-semibold text-sm uppercase tracking-wider mb-4" style={{ display: 'inline-block', marginBottom: '1rem' }}>
            FAQ
          </span>
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-5" style={{ marginBottom: '1.25rem' }}>
            Preguntas frecuentes
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed">
            Si tienes alguna duda que no aparece aquí, escríbenos directamente.
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`item-${i}`}
                className="bg-card rounded-xl px-7 border-none card-elevated"
              >
                <AccordionTrigger className="text-left font-heading font-semibold text-foreground hover:text-primary hover:no-underline py-6 text-base">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-7 leading-relaxed text-sm">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

      </div>
    </section>
  );
}
