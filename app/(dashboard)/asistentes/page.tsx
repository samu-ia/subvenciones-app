'use client';

import { useState, useEffect } from 'react';
import { Brain, Bot, Edit2, Play, Settings } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface Asistente {
  id: string;
  name: string;
  description: string;
  provider: string;
  model: string;
  temperature: number;
  sources: string[];
  actions: string[];
  icon_color: string;
}

const ASISTENTES_DEFAULT: Asistente[] = [
  {
    id: 'reuniones',
    name: 'Asistente de Reuniones',
    description: 'Prepara reuniones, genera guiones y resume contexto del cliente',
    provider: 'OpenAI',
    model: 'gpt-4o',
    temperature: 0.2,
    sources: ['cliente', 'reuniones_previas', 'notas', 'ayudas', 'documentos'],
    actions: ['preparar_reunion', 'resumir_cliente', 'generar_guion', 'sacar_checklist'],
    icon_color: '#667eea',
  },
  {
    id: 'busqueda_profunda',
    name: 'Búsqueda Profunda',
    description: 'Investiga empresas, analiza ayudas y detecta riesgos',
    provider: 'Google',
    model: 'gemini-2.5-pro',
    temperature: 0.1,
    sources: ['cliente', 'reuniones', 'ayudas', 'expedientes', 'documentos', 'web'],
    actions: ['investigar_empresa', 'analizar_ayuda', 'detectar_riesgos', 'preparar_estrategia'],
    icon_color: '#10b981',
  },
  {
    id: 'documentos',
    name: 'Asistente Documental',
    description: 'Genera presentaciones, emails, guiones y propuestas',
    provider: 'Anthropic',
    model: 'claude-sonnet-4',
    temperature: 0.4,
    sources: ['cliente', 'ayuda', 'expediente', 'reuniones'],
    actions: ['generar_presentacion', 'generar_email', 'generar_propuesta', 'generar_checklist'],
    icon_color: '#f59e0b',
  },
  {
    id: 'clientes',
    name: 'Asistente de Clientes',
    description: 'Analiza perfil, detecta oportunidades y sugiere ayudas',
    provider: 'OpenAI',
    model: 'gpt-4o',
    temperature: 0.2,
    sources: ['cliente', 'einforma', 'ayudas', 'expedientes', 'reuniones'],
    actions: ['analizar_perfil', 'detectar_oportunidades', 'sugerir_ayudas', 'evaluar_viabilidad'],
    icon_color: '#3b82f6',
  },
  {
    id: 'oportunidades',
    name: 'Asistente de Oportunidades',
    description: 'Analiza encaje, requisitos y probabilidad de éxito',
    provider: 'OpenAI',
    model: 'gpt-4o',
    temperature: 0.1,
    sources: ['cliente', 'ayuda', 'oportunidad', 'requisitos'],
    actions: ['analizar_encaje', 'revisar_requisitos', 'calcular_probabilidad', 'generar_resumen'],
    icon_color: '#8b5cf6',
  },
  {
    id: 'expedientes',
    name: 'Asistente de Expedientes',
    description: 'Revisa documentación, genera memorias y detecta incoherencias',
    provider: 'Anthropic',
    model: 'claude-sonnet-4',
    temperature: 0.3,
    sources: ['expediente', 'cliente', 'ayuda', 'documentos', 'requisitos'],
    actions: ['revisar_documentacion', 'generar_memoria', 'detectar_incoherencias', 'preparar_respuestas'],
    icon_color: '#ec4899',
  },
];

export default function AsistentesPage() {
  const [asistentes, setAsistentes] = useState<Asistente[]>(ASISTENTES_DEFAULT);

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 'var(--s2)',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s1)', marginBottom: '8px' }}>
            <Brain size={32} style={{ color: 'var(--teal)' }} />
            <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 600 }}>Asistentes IA</h1>
          </div>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '15px' }}>
            Configura los bots que usarás en tu operativa diaria. Cada asistente tiene su propia configuración y funciones específicas.
          </p>
        </div>
      </div>

      {/* Grid de asistentes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 'var(--s2)' }}>
        {asistentes.map((asistente) => (
          <div
            key={asistente.id}
            style={{
              padding: 'var(--s2)',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              transition: 'all 0.2s',
            }}
          >
            {/* Header del card */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--s1)', marginBottom: 'var(--s1)' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '12px',
                background: `linear-gradient(135deg, ${asistente.icon_color} 0%, ${asistente.icon_color}dd 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Bot size={28} style={{ color: 'white' }} />
              </div>

              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 600 }}>{asistente.name}</h3>
                <p style={{ margin: 0, color: 'var(--muted)', fontSize: '13px', lineHeight: 1.5 }}>
                  {asistente.description}
                </p>
              </div>
            </div>

            {/* Configuración */}
            <div style={{
              padding: 'var(--s1)',
              background: 'var(--bg)',
              borderRadius: '8px',
              marginBottom: 'var(--s1)',
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s1)', fontSize: '13px' }}>
                <div>
                  <span style={{ color: 'var(--muted)' }}>Proveedor:</span>
                  <div style={{ fontWeight: 600, marginTop: '2px' }}>{asistente.provider}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)' }}>Modelo:</span>
                  <div style={{ fontWeight: 600, marginTop: '2px', fontFamily: 'monospace', fontSize: '12px' }}>
                    {asistente.model}
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)' }}>Temperatura:</span>
                  <div style={{ fontWeight: 600, marginTop: '2px' }}>{asistente.temperature}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)' }}>Fuentes:</span>
                  <div style={{ fontWeight: 600, marginTop: '2px' }}>{asistente.sources.length}</div>
                </div>
              </div>
            </div>

            {/* Fuentes */}
            <div style={{ marginBottom: 'var(--s1)' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', marginBottom: '6px' }}>
                FUENTES QUE CONSULTA:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {asistente.sources.map((source) => (
                  <span
                    key={source}
                    style={{
                      padding: '4px 8px',
                      background: 'var(--blue-bg)',
                      color: 'var(--teal)',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 500,
                    }}
                  >
                    {source}
                  </span>
                ))}
              </div>
            </div>

            {/* Acciones */}
            <div style={{ marginBottom: 'var(--s1)' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', marginBottom: '6px' }}>
                ACCIONES DISPONIBLES:
              </div>
              <div style={{ fontSize: '13px', color: 'var(--ink2)', lineHeight: 1.6 }}>
                {asistente.actions.map((action, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Play size={12} style={{ color: 'var(--teal)' }} />
                    <span>{action.replace(/_/g, ' ')}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Botones */}
            <div style={{ display: 'flex', gap: 'var(--s1)' }}>
              <Link
                href={`/asistentes/${asistente.id}`}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: 'var(--teal)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  textDecoration: 'none',
                }}
              >
                <Settings size={16} />
                Configurar
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Info */}
      <div style={{
        marginTop: 'var(--s2)',
        padding: 'var(--s2)',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
      }}>
        <h3 style={{ margin: '0 0 var(--s1) 0', fontSize: '16px', fontWeight: 600 }}>¿Cómo funcionan los asistentes?</h3>
        <div style={{ color: 'var(--ink2)', fontSize: '14px', lineHeight: 1.7 }}>
          <p style={{ margin: '0 0 12px 0' }}>
            Cada asistente es un <strong>bot especializado</strong> que se ejecuta en módulos específicos de la aplicación.
          </p>
          <p style={{ margin: '0 0 12px 0' }}>
            Por ejemplo, el <strong>Asistente de Reuniones</strong> aparece dentro del módulo Reuniones y puede preparar
            el contexto del cliente, generar guiones y resumir información relevante.
          </p>
          <p style={{ margin: 0 }}>
            Puedes configurar qué <strong>proveedor</strong>, <strong>modelo</strong> y <strong>fuentes de datos</strong> usa
            cada asistente según tus necesidades de coste, calidad y velocidad.
          </p>
        </div>
      </div>
    </div>
  );
}
