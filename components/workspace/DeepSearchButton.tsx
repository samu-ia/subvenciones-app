'use client';

import { useState } from 'react';
import { Search, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Loader2, RefreshCw } from 'lucide-react';
import type { DeepSearchProgressStep, EstadoInvestigacion } from '@/lib/types/notebook';

interface DeepSearchButtonProps {
  estado: EstadoInvestigacion;
  numSubvenciones?: number;
  onLanzar: () => Promise<void>;
  /** Si hay un error previo, mostrarlo */
  errorMsg?: string | null;
}

const PROGRESS_STEPS_LABELS: { id: DeepSearchProgressStep['id']; label: string }[] = [
  { id: 'recopilando', label: 'Recopilando datos del cliente' },
  { id: 'investigando', label: 'Investigando convocatorias' },
  { id: 'analizando',  label: 'Analizando encaje' },
  { id: 'generando',  label: 'Generando fichas de subvención' },
  { id: 'guardando',  label: 'Guardando resultados' },
];

export default function DeepSearchButton({
  estado,
  numSubvenciones,
  onLanzar,
  errorMsg,
}: DeepSearchButtonProps) {
  const [expanded, setExpanded] = useState(false);
  const [running, setRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);

  const handleLanzar = async () => {
    if (running) return;
    setRunning(true);
    setExpanded(true);
    setCurrentStep(0);

    // Simular progreso visual durante la llamada real
    const stepInterval = setInterval(() => {
      setCurrentStep(s => {
        if (s < PROGRESS_STEPS_LABELS.length - 2) return s + 1;
        clearInterval(stepInterval);
        return s;
      });
    }, 2200);

    try {
      await onLanzar();
      clearInterval(stepInterval);
      setCurrentStep(PROGRESS_STEPS_LABELS.length - 1);
    } finally {
      clearInterval(stepInterval);
      setRunning(false);
    }
  };

  // ── Estado: pendiente (botón principal) ────────────────────────────────
  if (estado === 'pendiente' || estado === 'error') {
    return (
      <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)' }}>
        {errorMsg && (
          <div style={{ display: 'flex', gap: '6px', padding: '7px 10px', borderRadius: '7px', background: '#fef2f2', border: '1px solid #fecaca', marginBottom: '8px' }}>
            <AlertCircle size={12} style={{ color: '#dc2626', flexShrink: 0, marginTop: '1px' }} />
            <span style={{ fontSize: '11px', color: '#dc2626' }}>{errorMsg}</span>
          </div>
        )}
        <button
          onClick={handleLanzar}
          disabled={running}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '8px', padding: '10px 16px', borderRadius: '9px',
            background: 'var(--primary)', color: 'white', border: 'none',
            fontSize: '13px', fontWeight: '700', cursor: running ? 'wait' : 'pointer',
            opacity: running ? 0.8 : 1, transition: 'opacity 0.15s, transform 0.1s',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          }}
          onMouseEnter={e => { if (!running) e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          {running
            ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
            : <Search size={15} />
          }
          {running ? 'Investigando...' : estado === 'error' ? '🔁 Reintentar búsqueda' : '🔎 Búsqueda profunda de subvenciones'}
        </button>
        <p style={{ fontSize: '10px', color: 'var(--muted-foreground)', textAlign: 'center', marginTop: '5px', margin: '5px 0 0 0' }}>
          IA analizará el perfil del cliente y buscará subvenciones relevantes
        </p>

        {/* Pasos del progreso */}
        {running && expanded && (
          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {PROGRESS_STEPS_LABELS.map((step, idx) => (
              <ProgressStepRow
                key={step.id}
                label={step.label}
                status={idx < currentStep ? 'done' : idx === currentStep ? 'running' : 'pending'}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Estado: ejecutando ─────────────────────────────────────────────────
  if (estado === 'ejecutando') {
    return (
      <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '9px', background: 'var(--muted)', border: '1px solid var(--border)' }}>
          <Loader2 size={15} style={{ animation: 'spin 1s linear infinite', color: 'var(--primary)', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--foreground)' }}>Investigando subvenciones...</div>
            <div style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>Esto puede tardar 15-30 segundos</div>
          </div>
        </div>
      </div>
    );
  }

  // ── Estado: completada ─────────────────────────────────────────────────
  return (
    <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)' }}>
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
          padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)',
          background: 'var(--background)', cursor: 'pointer', textAlign: 'left',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--background)')}
      >
        <CheckCircle2 size={14} style={{ color: '#22c55e', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--foreground)' }}>
            Investigación completada
          </div>
          {numSubvenciones !== undefined && (
            <div style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>
              {numSubvenciones} subvenci{numSubvenciones !== 1 ? 'ones' : 'ón'} detectada{numSubvenciones !== 1 ? 's' : ''}
            </div>
          )}
        </div>
        {expanded ? <ChevronUp size={12} style={{ color: 'var(--muted-foreground)' }} /> : <ChevronDown size={12} style={{ color: 'var(--muted-foreground)' }} />}
      </button>

      {expanded && (
        <div style={{ marginTop: '8px' }}>
          <button
            onClick={handleLanzar}
            disabled={running}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: '6px', padding: '7px 12px', borderRadius: '7px',
              background: 'none', color: 'var(--muted-foreground)', border: '1px solid var(--border)',
              fontSize: '12px', fontWeight: '500', cursor: running ? 'wait' : 'pointer',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            <RefreshCw size={12} /> Volver a investigar
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Fila de paso del progreso ────────────────────────────────────────────────

function ProgressStepRow({ label, status }: { label: string; status: 'pending' | 'running' | 'done' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ width: '16px', height: '16px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {status === 'done' && <CheckCircle2 size={14} style={{ color: '#22c55e' }} />}
        {status === 'running' && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: 'var(--primary)' }} />}
        {status === 'pending' && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--border)' }} />}
      </div>
      <span style={{
        fontSize: '11px',
        color: status === 'pending' ? 'var(--muted-foreground)' : status === 'running' ? 'var(--foreground)' : 'var(--muted-foreground)',
        fontWeight: status === 'running' ? '600' : '400',
        textDecoration: status === 'done' ? 'none' : 'none',
      }}>
        {label}
      </span>
    </div>
  );
}
