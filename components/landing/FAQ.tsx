'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const faqs = [
  {
    question: '¿Es esto legal?',
    answer:
      'Completamente. Son subvenciones públicas convocadas por administraciones españolas y europeas. El proceso de solicitud es el mismo que cualquier empresa haría — nosotros simplemente lo hacemos por ti mejor y más rápido.',
  },
  {
    question: '¿Por qué no lo hago yo solo?',
    answer:
      'Puedes. Pero requiere saber qué convocatorias existen, cuáles aplican a tu empresa, qué documentación piden cada una, cómo redactar la memoria, cómo presentarlo en cada plataforma... La mayoría de empresas que lo intentan solas lo dejan a medias o presentan expedientes incompletos que se deniegan.',
  },
  {
    question: '¿De verdad no pago nada si no conseguís la subvención?',
    answer:
      'Absolutamente nada. Ni análisis, ni gestión, ni comisión. El 15% solo se aplica sobre el importe que efectivamente se concede y se cobra. Si no hay subvención, no hay factura. Es así de simple.',
  },
  {
    question: '¿Cuánto tiempo tarda?',
    answer:
      'El análisis inicial lo tenemos en 24h. La tramitación depende de cada convocatoria — puede ser de semanas a meses. Te informamos del plazo exacto antes de firmar nada. Y te avisamos en cada paso.',
  },
  {
    question: '¿Qué documentación me vais a pedir?',
    answer:
      'Para empezar, solo el NIF y dos minutos de tu tiempo. Si decidimos tramitar una subvención concreta, te diremos exactamente qué necesitamos para ese expediente — nada más.',
  },
  {
    question: '¿Cómo sé que sois de fiar?',
    answer:
      'Firmamos un contrato antes de empezar donde quedan claras las condiciones, el porcentaje y lo que nos comprometemos a hacer. Puedes leerlo entero antes de firmar. No cobramos nada por adelantado — eso es la mejor garantía.',
  },
  {
    question: '¿Trabajáis con cualquier tipo de empresa?',
    answer:
      'Con autónomos, microempresas, pymes y medianas. El análisis es completamente gratuito — en 24h sabes si hay subvenciones para ti y cuánto representan. Sin compromiso.',
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
