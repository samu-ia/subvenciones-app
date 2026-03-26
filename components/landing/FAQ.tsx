'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useMediaQuery } from '@/lib/hooks/use-media-query';

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
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const isMobile = useMediaQuery('(max-width: 768px)');

  return (
    <section 
      id="faq" 
      style={{ 
        padding: isMobile ? '64px 24px' : '100px 48px', 
        background: '#f5f3ef',
      }}
    >
      <div style={{ maxWidth: 700, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: isMobile ? 40 : 56 }}>
          <p 
            style={{ 
              fontSize: '0.8rem', 
              fontWeight: 600, 
              color: '#0d7377', 
              textTransform: 'uppercase', 
              letterSpacing: '0.15em',
              marginBottom: 12,
            }}
          >
            FAQ
          </p>
          <h2
            style={{ 
              fontSize: isMobile ? '1.75rem' : '2.25rem', 
              fontWeight: 800, 
              color: '#1a1a1a',
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
            }}
          >
            Preguntas frecuentes
          </h2>
        </div>

        {/* Accordion */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {faqs.map((faq, i) => (
            <div 
              key={i}
              style={{ 
                borderBottom: '1px solid #e0ddd8',
              }}
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '20px 0',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                }}
              >
                <span style={{ fontSize: '1rem', fontWeight: 600, color: '#1a1a1a' }}>
                  {faq.question}
                </span>
                <ChevronDown 
                  size={20} 
                  color="#6b6b6b"
                  style={{ 
                    transform: openIndex === i ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s',
                    flexShrink: 0,
                  }}
                />
              </button>
              {openIndex === i && (
                <div style={{ paddingBottom: 20 }}>
                  <p style={{ fontSize: '0.95rem', color: '#6b6b6b', lineHeight: 1.6 }}>
                    {faq.answer}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
