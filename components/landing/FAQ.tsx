'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const faqs = [
  {
    question: 'Cuanto tarda?',
    answer: 'Analisis en 24h. Tramitacion depende del organismo, de semanas a meses. Te decimos el plazo antes de empezar.',
  },
  {
    question: 'Que documentos necesito?',
    answer: 'Para el analisis solo NIF y datos basicos. Si tramitamos, te decimos exactamente que hace falta.',
  },
  {
    question: 'Como funciona el pago?',
    answer: 'Solo pagas si cobras la subvencion. Sin subvencion = sin factura.',
  },
  {
    question: 'Puedo ver el estado?',
    answer: 'Si, tienes panel con seguimiento en tiempo real.',
  },
  {
    question: 'Que empresas podeis ayudar?',
    answer: 'Autonomos, micro, pymes y medianas. Cualquier sector y comunidad.',
  },
  {
    question: 'Hay cuotas o costes ocultos?',
    answer: 'No. Sin suscripcion, sin cuotas, sin letra pequena. Solo cobramos si tu cobras.',
  },
];

export default function FAQ() {
  return (
    <section id="faq" className="section-padding bg-muted">
      <div className="container-custom">

        <div className="text-center max-w-xl mx-auto" style={{ marginBottom: '2rem' }}>
          <h2 className="text-2xl md:text-3xl font-heading font-bold text-foreground" style={{ marginBottom: '0.5rem' }}>
            Dudas?
          </h2>
          <p className="text-muted-foreground text-base">
            Las respuestas rapidas.
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
