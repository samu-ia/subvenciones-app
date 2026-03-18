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
      'Una vez recibida toda la documentación necesaria, nuestro equipo procesa las solicitudes en un plazo máximo de 24-48 horas laborables. Para trámites más complejos, te informaremos del plazo estimado de forma personalizada.',
  },
  {
    question: '¿Qué documentación necesito aportar?',
    answer:
      'La documentación varía según el trámite. Como mínimo necesitaremos tu identificación (NIF/CIF/NIE) y los datos de tu actividad. Para trámites específicos, te indicaremos exactamente qué documentos son necesarios una vez inicies el proceso.',
  },
  {
    question: '¿Cómo se realiza el pago?',
    answer:
      'Trabajamos con domiciliación bancaria SEPA, lo que garantiza la máxima seguridad en tus transacciones. Solo necesitas proporcionarnos tu IBAN y autorizar el cargo. Recibirás un desglose detallado de los servicios antes de cualquier cobro.',
  },
  {
    question: '¿Puedo hacer seguimiento de mi trámite?',
    answer:
      'Por supuesto. Una vez iniciado el proceso, recibirás actualizaciones por email en cada etapa. Además, puedes contactarnos en cualquier momento para consultar el estado de tu gestión.',
  },
  {
    question: '¿Qué tipo de empresas pueden utilizar vuestros servicios?',
    answer:
      'Atendemos a todo tipo de empresas: autónomos, microempresas, pymes y grandes empresas. Nuestros servicios se adaptan a las necesidades específicas de cada tipo de negocio.',
  },
  {
    question: '¿Ofrecéis asesoramiento fiscal?',
    answer: 'No, nosotros nos centramos en darte la mejor experiencia para la localización y gestión de subvenciones.',
  },
  {
    question: '¿Qué garantías ofrecéis?',
    answer:
      'Garantizamos la confidencialidad de tus datos, el cumplimiento de todas las normativas vigentes y la máxima profesionalidad en cada gestión. Si no quedas satisfecho con nuestro servicio, te devolvemos el importe.',
  },
  {
    question: '¿Es una suscripción? ¿Tiene algún coste oculto?',
    answer:
      'No, es un servicio 100% a éxito. Solo pagas si conseguimos la subvención para ti. No hay costes iniciales ni cuotas mensuales. Solo se cobra si firmaste el contrato para tramitar una subvención en particular y se concede la misma.',
  },
];

export default function FAQ() {
  return (
    <section id="faq" className="section-padding bg-muted">
      <div className="container-custom">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="inline-block text-accent font-semibold text-sm uppercase tracking-wider mb-4">FAQ</span>
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-6">Preguntas frecuentes</h2>
          <p className="text-muted-foreground text-lg">
            Resolvemos las dudas más comunes sobre nuestros servicios. Si no encuentras lo que buscas, no dudes en
            contactarnos.
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`item-${i}`}
                className="bg-card rounded-xl px-6 border-none card-elevated"
              >
                <AccordionTrigger className="text-left font-heading font-semibold text-foreground hover:text-primary hover:no-underline py-5">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-5 leading-relaxed">
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
