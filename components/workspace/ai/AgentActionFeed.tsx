'use client';

import {
  FolderPlus, FilePlus, FileEdit, CheckCircle2, XCircle,
  Loader2, Bot, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useState } from 'react';
import type { AgentActionResult } from '@/lib/types/agent-actions';

// ─── Labels y colores por tipo de acción ────────────────────────────────────

const ACTION_META: Record<string, { label: (r: AgentActionResult) => string; icon: React.ReactNode; color: string }> = {
  create_folder: {
    label: (r) => `Carpeta creada: "${(r.action as any).folder_name}"`,
    icon: <FolderPlus size={13} />,
    color: '#f59e0b',
  },
  create_document: {
    label: (r) => `Documento creado: "${r.documentName ?? (r.action as any).nombre}"`,
    icon: <FilePlus size={13} />,
    color: '#6366f1',
  },
  edit_document: {
    label: (r) => `Documento editado: "${r.documentName ?? (r.action as any).nombre}"`,
    icon: <FileEdit size={13} />,
    color: '#0ea5e9',
  },
  respond: {
    label: () => 'Respuesta generada',
    icon: <Bot size={13} />,
    color: '#10b981',
  },
};

// ─── Componente individual de una acción ────────────────────────────────────

function ActionItem({ result }: { result: AgentActionResult }) {
  if (result.action.type === 'respond') return null; // El respond se muestra como chat normal

  const meta = ACTION_META[result.action.type];
  if (!meta) return null;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 8px',
      borderRadius: 6,
      background: result.success
        ? `${meta.color}18`
        : 'rgba(239,68,68,0.1)',
      border: `1px solid ${result.success ? `${meta.color}35` : 'rgba(239,68,68,0.3)'}`,
      fontSize: 12,
    }}>
      <span style={{ color: result.success ? meta.color : '#ef4444', flexShrink: 0 }}>
        {result.success
          ? <span style={{ color: meta.color }}>{meta.icon}</span>
          : <XCircle size={13} />}
      </span>
      <span style={{ color: 'var(--foreground)', opacity: 0.85, flex: 1 }}>
        {result.success ? meta.label(result) : `Error: ${result.error}`}
      </span>
      {result.success && (
        <CheckCircle2 size={11} style={{ color: meta.color, flexShrink: 0, opacity: 0.7 }} />
      )}
    </div>
  );
}

// ─── Feed principal ──────────────────────────────────────────────────────────

interface AgentActionFeedProps {
  actions: AgentActionResult[];
  loading?: boolean;
}

export default function AgentActionFeed({ actions, loading }: AgentActionFeedProps) {
  const [collapsed, setCollapsed] = useState(false);

  // Filtrar el respond para no mostrarlo como acción
  const visibleActions = actions.filter(r => r.action.type !== 'respond');

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 10px',
        borderRadius: 8,
        background: 'rgba(99,102,241,0.08)',
        border: '1px solid rgba(99,102,241,0.2)',
        fontSize: 12,
        color: 'var(--foreground)',
        opacity: 0.8,
        marginBottom: 4,
      }}>
        <Loader2 size={13} style={{ animation: 'spin 1s linear infinite', color: '#6366f1' }} />
        <span>El agente está trabajando…</span>
      </div>
    );
  }

  if (visibleActions.length === 0) return null;

  const successCount = visibleActions.filter(a => a.success).length;
  const total = visibleActions.length;

  return (
    <div style={{
      borderRadius: 8,
      border: '1px solid rgba(99,102,241,0.2)',
      background: 'rgba(99,102,241,0.05)',
      overflow: 'hidden',
      marginBottom: 4,
      fontSize: 12,
    }}>
      {/* Header colapsable */}
      <button
        onClick={() => setCollapsed(c => !c)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '7px 10px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--foreground)',
          opacity: 0.75,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
          <Bot size={13} style={{ color: '#6366f1' }} />
          {successCount}/{total} acciones ejecutadas
        </span>
        {collapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
      </button>

      {/* Lista de acciones */}
      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0 8px 8px' }}>
          {visibleActions.map((result, i) => (
            <ActionItem key={i} result={result} />
          ))}
        </div>
      )}
    </div>
  );
}
