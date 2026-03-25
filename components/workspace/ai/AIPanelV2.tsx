'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Send, Sparkles, FileText, Save, FilePlus, Replace,
  CheckCircle2, X, AtSign, BookOpen, ExternalLink, AlertCircle,
  Loader2, ChevronDown, ChevronUp, Zap,
} from 'lucide-react';
import { useMentions } from './useMentions';
import AIConfigPanel from './AIConfigPanel';
import AgentActionFeed from './AgentActionFeed';
import type { ContextMode } from './ContextToggle';
import type { AITool } from '@/lib/types/ai-config';
import type { AgentActionResult } from '@/lib/types/agent-actions';

// ─── Metadata de herramientas ───────────────────────────────────────────────
const SAVEABLE_TOOLS: AITool[] = ['summary', 'missing-info', 'checklist', 'email', 'deep-search'];
const SAVEABLE_TOOLS_SET = new Set<AITool>(SAVEABLE_TOOLS);

const TOOL_META: Record<AITool, { label: string; desc: string; emoji: string }> = {
  summary:        { label: 'Resumen',           desc: 'Resumen estructurado del expediente',     emoji: '📋' },
  'missing-info': { label: 'Info faltante',      desc: 'Qué información o documentos faltan',    emoji: '🔍' },
  checklist:      { label: 'Checklist',          desc: 'Lista de pasos y documentos necesarios',  emoji: '✅' },
  email:          { label: 'Redactar email',     desc: 'Borrador de email profesional',           emoji: '✉️' },
  'deep-search':  { label: 'Búsqueda profunda',  desc: 'Análisis exhaustivo del contexto',        emoji: '🔎' },
  notebook:       { label: 'Chat',               desc: 'Chat contextual',                         emoji: '💬' },
};

// ─── Tipos ──────────────────────────────────────────────────────────────────
interface SourceRef {
  id: string;
  name: string;
  mentioned: boolean;
}

interface Mensaje {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sourceRefs?: SourceRef[];
  mentionedDocIds?: string[];
  tool?: AITool;
  timestamp: Date;
  saved?: boolean;
  /** Acciones ejecutadas por el agente (solo en modo agente) */
  agentActions?: AgentActionResult[];
  isAgentMessage?: boolean;
}

interface SaveModalState {
  open: boolean;
  messageId: string;
  content: string;
  tool: AITool;
  titulo: string;
}

interface AIPanelProps {
  userId: string;
  contextoId: string;
  contextoTipo: 'reunion' | 'expediente';
  documentos: Array<{ id: string; nombre: string; generado_por_ia?: boolean; contenido?: string | null; tipo_documento?: string | null }>;
  contextSelections?: Record<string, ContextMode>;
  clienteNombre?: string;
  onGenerarDocumento?: (nombre: string, contenido: string, prompt: string) => void;
  selectedDocId?: string | null;
  onSelectDoc?: (docId: string) => void;
  collapseButton?: React.ReactNode;
  /** Acción rápida externa: cambia `key` para re-disparar el mismo texto */
  quickAction?: { text: string; key: number } | null;
}

type Tab = 'chat' | 'tools' | 'settings';

// ═══════════════════════════════════════════════════════════════════════════
// PANEL PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════
export default function AIPanelV2({
  userId,
  contextoId,
  contextoTipo,
  documentos,
  contextSelections,
  onGenerarDocumento,
  selectedDocId,
  onSelectDoc,
  collapseButton,
  quickAction,
}: AIPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastError, setLastError] = useState<{ message: string; code?: string } | null>(null);
  const [saveModal, setSaveModal] = useState<SaveModalState>({
    open: false, messageId: '', content: '', tool: 'summary', titulo: ''
  });
  const [savingDoc, setSavingDoc] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);
  const [executingTool, setExecutingTool] = useState<AITool | null>(null);
  const [agentMode, setAgentMode] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const tituloRef = useRef<HTMLInputElement>(null);

  type DocRefMin = { id: string; nombre: string; contenido?: string | null };
  const submitRef = useRef<(text: string, mentions: DocRefMin[]) => void>(() => {});

  const mentionsHook = useMentions({
    documentos,
    onSubmit: useCallback((text: string, mentions: DocRefMin[]) => {
      submitRef.current(text, mentions);
    }, []),
  });

  const contextCount = useMemo(() => {
    if (!contextSelections) return 0;
    return documentos.filter(d => {
      const m = contextSelections[d.id];
      return m === 'full' || m === 'insights';
    }).length;
  }, [documentos, contextSelections]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  // ─── RAG context ────────────────────────────────────────────────────────
  const prepareContext = (mentionedDocs: DocRefMin[] = []) => {
    const parts: string[] = [];
    if (mentionedDocs.length > 0) {
      parts.push('## Documentos mencionados (contexto prioritario)\n');
      mentionedDocs.forEach(doc => {
        parts.push(`[@${doc.nombre}]\n${doc.contenido ?? '(sin contenido)'}\n`);
      });
      parts.push('---\n');
    }
    if (contextSelections) {
      const mentionedIds = new Set(mentionedDocs.map(d => d.id));
      documentos.forEach(doc => {
        if (mentionedIds.has(doc.id)) return;
        const mode = contextSelections[doc.id];
        if (!mode || mode === 'off') return;
        if (mode === 'full' && doc.contenido)
          parts.push(`[${doc.nombre}]\n${doc.contenido}\n`);
        else if (mode === 'insights' && doc.contenido)
          parts.push(`[${doc.nombre} — extracto]\n${doc.contenido.substring(0, 500)}...\n`);
      });
    }
    return parts.join('\n---\n\n');
  };

  // ─── Enviar mensaje ──────────────────────────────────────────────────────
  const submitMensaje = async (text: string, mentionedDocs: DocRefMin[]) => {
    if (loading) return;
    const validMentions = mentionedDocs.filter(m => documentos.some(d => d.id === m.id));

    setMensajes(prev => [...prev, {
      id: Date.now().toString(), role: 'user', content: text,
      mentionedDocIds: validMentions.map(m => m.id), timestamp: new Date(),
    }]);
    setLoading(true);

    try {
      const contexto = prepareContext(validMentions);
      const response = await fetch('/api/ia/notebook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text, context: contexto, contextoId, contextoTipo,
          mentionedDocIds: validMentions.map(m => m.id),
          history: mensajes.slice(-5),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setLastError({ message: data.error || `Error ${response.status}`, code: data.error_code });
        setMensajes(prev => [...prev, {
          id: (Date.now() + 1).toString(), role: 'assistant',
          content: `⚠️ ${data.error || 'Error al procesar el mensaje'}`,
          timestamp: new Date(),
        }]);
        return;
      }
      setLastError(null);

      const mentionedIds = new Set(validMentions.map(m => m.id));
      const sourceRefs: SourceRef[] = [
        ...validMentions.map(m => ({ id: m.id, name: m.nombre, mentioned: true })),
        ...documentos
          .filter(d => !mentionedIds.has(d.id) && (contextSelections?.[d.id] === 'full' || contextSelections?.[d.id] === 'insights'))
          .map(d => ({ id: d.id, name: d.nombre, mentioned: false })),
      ];

      setMensajes(prev => [...prev, {
        id: (Date.now() + 1).toString(), role: 'assistant', content: data.response,
        sourceRefs: sourceRefs.length > 0 ? sourceRefs : undefined,
        mentionedDocIds: validMentions.map(m => m.id),
        tool: 'notebook', timestamp: new Date(),
      }]);
    } catch {
      setMensajes(prev => [...prev, {
        id: (Date.now() + 1).toString(), role: 'assistant',
        content: 'Error al procesar el mensaje. Por favor inténtalo de nuevo.',
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  // ─── Enviar mensaje al AGENTE ────────────────────────────────────────────
  const submitAgente = async (text: string, mentionedDocs: DocRefMin[]) => {
    if (loading) return;
    const validMentions = mentionedDocs.filter(m => documentos.some(d => d.id === m.id));

    setMensajes(prev => [...prev, {
      id: Date.now().toString(), role: 'user', content: text,
      mentionedDocIds: validMentions.map(m => m.id), timestamp: new Date(),
    }]);
    setLoading(true);

    try {
      const contexto = prepareContext(validMentions);
      const response = await fetch('/api/ia/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          context: contexto,
          contextoId,
          contextoTipo,
          documentos: documentos.map(d => ({
            id: d.id,
            nombre: d.nombre,
            tipo_documento: d.tipo_documento,
            contenido: d.contenido,
          })),
          history: mensajes.slice(-6),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setLastError({ message: data.error || `Error ${response.status}`, code: data.error_code });
        setMensajes(prev => [...prev, {
          id: (Date.now() + 1).toString(), role: 'assistant',
          content: `⚠️ ${data.error || 'Error al procesar el mensaje'}`,
          timestamp: new Date(),
        }]);
        return;
      }
      setLastError(null);

      // Notificar al workspace de los docs creados/editados/borrados
      data.actions
        .filter((r: AgentActionResult) => r.success && r.documentId)
        .forEach((r: AgentActionResult) => {
          window.dispatchEvent(new CustomEvent('agent-doc-action', {
            detail: {
              type: r.action.type,
              documentId: r.documentId,
              documentName: r.documentName,
              contenido: (r.action as any).contenido,
            },
          }));
        });

      setMensajes(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.chatMessage,
        tool: 'notebook',
        timestamp: new Date(),
        isAgentMessage: true,
        agentActions: data.actions,
      }]);
    } catch {
      setMensajes(prev => [...prev, {
        id: (Date.now() + 1).toString(), role: 'assistant',
        content: 'Error al procesar el mensaje. Por favor inténtalo de nuevo.',
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  // Asignar la función correcta al ref según el modo activo
  submitRef.current = agentMode ? submitAgente : submitMensaje;

  // Disparar mensaje externo (quick actions desde panel Ficha)
  useEffect(() => {
    if (!quickAction?.text) return;
    setAgentMode(true);
    setTimeout(() => submitRef.current(quickAction.text, []), 50);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickAction?.key]);

  // ─── Ejecutar herramienta ────────────────────────────────────────────────
  const ejecutarHerramienta = async (tool: AITool) => {
    setExecutingTool(tool);
    setLoading(true);
    setActiveTab('chat');

    try {
      const contexto = prepareContext();
      const response = await fetch('/api/ia/tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool, context: contexto, contextoId, contextoTipo }),
      });
      const data = await response.json();
      if (!response.ok) {
        const errMsg = data.error || 'Error ejecutando la herramienta';
        setLastError({ message: errMsg, code: data.error_code });
        setMensajes(prev => [...prev, {
          id: (Date.now() + 1).toString(), role: 'assistant',
          content: `⚠️ ${errMsg}`,
          timestamp: new Date(),
        }]);
        return;
      }
      setLastError(null);
      const msgId = Date.now().toString();

      const toolSourceRefs: SourceRef[] = documentos
        .filter(d => contextSelections?.[d.id] === 'full' || contextSelections?.[d.id] === 'insights')
        .map(d => ({ id: d.id, name: d.nombre, mentioned: false }));

      setMensajes(prev => [...prev, {
        id: msgId, role: 'assistant', content: data.response,
        sourceRefs: toolSourceRefs.length > 0 ? toolSourceRefs : undefined,
        tool, timestamp: new Date(),
      }]);

      if (onGenerarDocumento && SAVEABLE_TOOLS.includes(tool)) {
        const fechaHoy = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
        setSaveModal({ open: true, messageId: msgId, content: data.response, tool, titulo: `${TOOL_META[tool].label} — ${fechaHoy}` });
      }
    } catch {
      const msg = 'Error de red. Comprueba tu conexión e inténtalo de nuevo.';
      setLastError({ message: msg, code: 'network_error' });
      setMensajes(prev => [...prev, {
        id: (Date.now() + 1).toString(), role: 'assistant',
        content: `⚠️ ${msg}`,
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
      setExecutingTool(null);
    }
  };

  // ─── Guardar documento ───────────────────────────────────────────────────
  const guardarComoDocumento = async () => {
    if (!onGenerarDocumento || !saveModal.titulo.trim()) return;
    setSavingDoc(true);
    try {
      await onGenerarDocumento(saveModal.titulo.trim(), saveModal.content, saveModal.tool);
      setMensajes(prev => prev.map(m => m.id === saveModal.messageId ? { ...m, saved: true } : m));
      setSaveModal(prev => ({ ...prev, open: false }));
      setSavedFeedback(`"${saveModal.titulo.trim()}" guardado`);
      setTimeout(() => setSavedFeedback(null), 3000);
    } finally {
      setSavingDoc(false);
    }
  };

  const insertarEnDocActual = async () => {
    if (!selectedDocId || !onGenerarDocumento) return;
    setSavingDoc(true);
    try {
      const docActual = documentos.find(d => d.id === selectedDocId);
      const contenidoCombinado = docActual?.contenido
        ? `${docActual.contenido}\n\n---\n\n## ${saveModal.titulo}\n\n${saveModal.content}`
        : saveModal.content;
      await onGenerarDocumento(`__insert__${selectedDocId}`, contenidoCombinado, saveModal.tool);
      setMensajes(prev => prev.map(m => m.id === saveModal.messageId ? { ...m, saved: true } : m));
      setSaveModal(prev => ({ ...prev, open: false }));
      setSavedFeedback('Insertado en el documento abierto');
      setTimeout(() => setSavedFeedback(null), 3000);
    } finally {
      setSavingDoc(false);
    }
  };

  const openSaveModal = (msg: Mensaje) => {
    if (!msg.tool) return;
    const fechaHoy = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
    setSaveModal({ open: true, messageId: msg.id, content: msg.content, tool: msg.tool, titulo: `${TOOL_META[msg.tool]?.label ?? msg.tool} — ${fechaHoy}` });
  };

  // ═══════════════════════════════════════════════════════════════════════
  return (
    <>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--background)' }}>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div style={{ flexShrink: 0, padding: '14px 16px 0', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <Sparkles size={14} style={{ color: 'var(--primary)', opacity: 0.75 }} />
              <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--foreground)' }}>Asistente IA</span>
              {contextCount > 0 && (
                <span style={{
                  fontSize: '10px', fontWeight: '600', padding: '1px 7px', borderRadius: '9999px',
                  background: 'color-mix(in srgb, var(--primary) 10%, transparent)',
                  color: 'var(--primary)', letterSpacing: '0.01em',
                }}>
                  {contextCount} doc{contextCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {/* Toggle Modo Agente */}
              <button
                onClick={() => setAgentMode(v => !v)}
                title={agentMode ? 'Modo Agente activo — click para desactivar' : 'Activar Modo Agente'}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '3px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontSize: 11, fontWeight: 600,
                  background: agentMode
                    ? 'color-mix(in srgb, #6366f1 15%, transparent)'
                    : 'var(--muted)',
                  color: agentMode ? '#6366f1' : 'var(--muted-foreground)',
                  transition: 'all 0.15s',
                }}
              >
                <Zap size={11} style={{ fill: agentMode ? '#6366f1' : 'none', stroke: agentMode ? '#6366f1' : 'currentColor' }} />
                Agente
              </button>
              {collapseButton}
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex' }}>
            {(['chat', 'tools', 'settings'] as Tab[]).map(tab => {
              const labels: Record<Tab, string> = { chat: 'Chat', tools: 'Herramientas', settings: 'Ajustes' };
              const active = activeTab === tab;
              return (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{
                  padding: '6px 14px', border: 'none', background: 'transparent',
                  borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
                  fontSize: '12px', fontWeight: active ? '600' : '400',
                  color: active ? 'var(--foreground)' : 'var(--muted-foreground)',
                  cursor: 'pointer', transition: 'all 0.15s', letterSpacing: '0.01em',
                }}>
                  {labels[tab]}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Feedback ──────────────────────────────────────────── */}
        {savedFeedback && (
          <div style={{
            flexShrink: 0, padding: '7px 16px', background: '#f0fdf4',
            borderBottom: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <CheckCircle2 size={13} style={{ color: '#16a34a' }} />
            <span style={{ fontSize: '12px', color: '#16a34a' }}>{savedFeedback}</span>
          </div>
        )}

        {/* ── Error banner ────────────────────────────────────── */}
        {lastError && (
          <div style={{
            flexShrink: 0, padding: '8px 14px',
            background: 'color-mix(in srgb, #ef4444 8%, transparent)',
            borderBottom: '1px solid color-mix(in srgb, #ef4444 20%, transparent)',
            display: 'flex', alignItems: 'flex-start', gap: '8px',
          }}>
            <AlertCircle size={13} style={{ color: '#dc2626', flexShrink: 0, marginTop: '1px' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '11.5px', color: '#991b1b', margin: '0 0 4px 0', lineHeight: '1.4' }}>
                {lastError.message}
              </p>
              {(lastError.code === 'no_provider' || lastError.code === 'no_api_key' || lastError.code === 'invalid_api_key') && (
                <button
                  onClick={() => { setActiveTab('settings'); setLastError(null); }}
                  style={{
                    fontSize: '11px', fontWeight: '600', color: '#dc2626',
                    background: 'none', border: '1px solid color-mix(in srgb, #ef4444 35%, transparent)',
                    borderRadius: '5px', padding: '2px 8px', cursor: 'pointer',
                  }}
                >
                  Ir a Ajustes →
                </button>
              )}
            </div>
            <button onClick={() => setLastError(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: '1px', flexShrink: 0 }}>
              <X size={12} />
            </button>
          </div>
        )}

        {/* ════ TAB CHAT ══════════════════════════════════════════════════ */}
        {activeTab === 'chat' && (
          <>
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {mensajes.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '32px 16px' }}>
                  <div style={{
                    width: '38px', height: '38px', borderRadius: '50%',
                    background: agentMode
                      ? 'color-mix(in srgb, #6366f1 12%, transparent)'
                      : 'color-mix(in srgb, var(--primary) 10%, transparent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px',
                  }}>
                    {agentMode
                      ? <Zap size={16} style={{ color: '#6366f1', fill: '#6366f1' }} />
                      : <Sparkles size={16} style={{ color: 'var(--primary)', opacity: 0.7 }} />}
                  </div>
                  <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--foreground)', margin: '0 0 5px 0' }}>
                    {agentMode ? 'Agente IA' : 'Notebook contextual'}
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', lineHeight: '1.6', maxWidth: '210px', margin: '0 0 16px 0' }}>
                    {agentMode
                      ? <>Puede <strong>crear y editar documentos</strong> directamente en el notebook.<br />Escríbele lo que necesitas.</>
                      : <>Pregunta sobre este {contextoTipo}. Escribe <strong>@</strong> para citar un documento.</>
                    }
                  </p>
                  {agentMode && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', maxWidth: '220px' }}>
                      {[
                        { emoji: '📝', label: 'Crear notas de reunión' },
                        { emoji: '✅', label: 'Hacer checklist de tareas' },
                        { emoji: '📄', label: 'Redactar informe' },
                        { emoji: '📋', label: 'Preparar acta' },
                      ].map(({ emoji, label }) => (
                        <button
                          key={label}
                          onClick={() => {
                            mentionsHook.setInputText(label);
                            setTimeout(() => mentionsHook.handleSubmit(), 50);
                          }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '8px 12px', borderRadius: '8px',
                            border: '1px solid var(--border)', background: 'var(--background)',
                            cursor: 'pointer', fontSize: '12px', color: 'var(--foreground)',
                            textAlign: 'left', transition: 'background 0.12s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'var(--background)'; }}
                        >
                          <span style={{ fontSize: '15px' }}>{emoji}</span>
                          <span>{label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                mensajes.map(msg => (
                  <MensajeRow
                    key={msg.id}
                    msg={msg}
                    documentos={documentos}
                    onSelectDoc={onSelectDoc}
                    onGuardar={onGenerarDocumento ? openSaveModal : undefined}
                    onInsertar={onGenerarDocumento && selectedDocId ? openSaveModal : undefined}
                  />
                ))
              )}
              {loading && (
                <div style={{ display: 'flex' }}>
                  <div style={{
                    padding: '9px 13px', borderRadius: '10px', background: 'var(--muted)',
                    display: 'flex', alignItems: 'center', gap: '7px',
                  }}>
                    <Loader2 size={12} style={{ animation: 'spin 1s linear infinite', color: 'var(--muted-foreground)' }} />
                    <span style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>
                      {agentMode ? 'Agente trabajando…' : executingTool ? `Ejecutando ${TOOL_META[executingTool]?.label}...` : 'Pensando...'}
                    </span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div style={{ flexShrink: 0, padding: '10px 14px 12px', borderTop: '1px solid var(--border)' }}>
              {mentionsHook.mentions.length > 0 && (
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '7px' }}>
                  {mentionsHook.mentions.map(m => (
                    <span key={m.id} style={{
                      display: 'inline-flex', alignItems: 'center', gap: '3px',
                      padding: '2px 8px', borderRadius: '9999px',
                      background: 'color-mix(in srgb, var(--primary) 10%, transparent)',
                      border: '1px solid color-mix(in srgb, var(--primary) 22%, transparent)',
                      fontSize: '11px', fontWeight: '600', color: 'var(--primary)',
                    }}>
                      <AtSign size={9} />{m.nombre}
                    </span>
                  ))}
                </div>
              )}

              <div style={{ position: 'relative' }}>
                {mentionsHook.suggestionsOpen && (
                  <div style={{
                    position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, right: 0,
                    background: 'var(--popover)', border: '1px solid var(--border)',
                    borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.09)',
                    zIndex: 50, overflow: 'hidden', maxHeight: '200px', overflowY: 'auto',
                  }}>
                    <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <AtSign size={11} style={{ color: 'var(--primary)' }} />
                      <span style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>Mencionar documento</span>
                    </div>
                    {mentionsHook.suggestions.map((doc, idx) => (
                      <button key={doc.id} onMouseDown={e => { e.preventDefault(); mentionsHook.selectSuggestion(doc); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          width: '100%', padding: '8px 12px', border: 'none', textAlign: 'left',
                          background: idx === mentionsHook.activeIndex ? 'color-mix(in srgb, var(--primary) 8%, transparent)' : 'transparent',
                          borderLeft: idx === mentionsHook.activeIndex ? '2px solid var(--primary)' : '2px solid transparent',
                          cursor: 'pointer', fontSize: '13px',
                        }}
                      >
                        <FileText size={13} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
                        <span style={{ fontWeight: '500', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {doc.nombre}
                        </span>
                        {doc.generado_por_ia && (
                          <span style={{ fontSize: '10px', color: 'var(--primary)', opacity: 0.6, flexShrink: 0 }}>IA</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <input
                      ref={mentionsHook.inputRef}
                      type="text"
                      value={mentionsHook.inputText}
                      onChange={e => mentionsHook.handleInputChange(e.target.value)}
                      onKeyDown={mentionsHook.handleKeyDown}
                      onBlur={mentionsHook.closeSuggestions}
                      placeholder={agentMode ? `Pide al agente que organice el ${contextoTipo}…` : `Pregunta sobre este ${contextoTipo}…`}
                      disabled={loading}
                      style={{
                        width: '100%', padding: '9px 32px 9px 12px',
                        background: 'var(--background)', border: '1px solid var(--border)',
                        borderRadius: '8px', fontSize: '13px', outline: 'none',
                        boxSizing: 'border-box', color: 'var(--foreground)',
                        transition: 'border-color 0.15s',
                      }}
                      onFocus={e => { e.currentTarget.style.borderColor = 'var(--primary)'; }}
                    />
                    <AtSign size={12} style={{
                      position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                      color: 'var(--muted-foreground)', pointerEvents: 'none', opacity: 0.4,
                    }} />
                  </div>
                  <button
                    onClick={mentionsHook.handleSubmit}
                    disabled={loading || !mentionsHook.inputText.trim()}
                    style={{
                      flexShrink: 0, width: '34px', height: '34px', borderRadius: '8px',
                      background: loading || !mentionsHook.inputText.trim() ? 'var(--muted)' : 'var(--primary)',
                      color: loading || !mentionsHook.inputText.trim() ? 'var(--muted-foreground)' : 'white',
                      border: 'none', cursor: loading || !mentionsHook.inputText.trim() ? 'default' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
                    }}
                  >
                    <Send size={14} />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ════ TAB HERRAMIENTAS ══════════════════════════════════════════ */}
        {activeTab === 'tools' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', marginBottom: '14px', lineHeight: '1.5', margin: '0 0 14px 0' }}>
              Ejecuta una herramienta sobre los documentos en contexto. El resultado aparece en el Chat.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {(['summary', 'missing-info', 'checklist', 'email', 'deep-search'] as AITool[]).map(tool => {
                const meta = TOOL_META[tool];
                const isRunning = executingTool === tool;
                return (
                  <button key={tool} onClick={() => ejecutarHerramienta(tool)} disabled={loading}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '11px 13px', borderRadius: '8px',
                      border: '1px solid var(--border)', background: 'var(--background)',
                      cursor: loading ? 'default' : 'pointer', textAlign: 'left',
                      opacity: loading && !isRunning ? 0.45 : 1, transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'var(--accent)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--background)'; }}
                  >
                    <span style={{ fontSize: '17px', flexShrink: 0, lineHeight: 1 }}>{meta.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--foreground)' }}>{meta.label}</div>
                      <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginTop: '1px' }}>{meta.desc}</div>
                    </div>
                    {isRunning && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite', color: 'var(--muted-foreground)', flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
            {contextCount === 0 && (
              <div style={{
                marginTop: '14px', padding: '11px 13px', borderRadius: '8px',
                background: 'color-mix(in srgb, #f59e0b 7%, transparent)',
                border: '1px solid color-mix(in srgb, #f59e0b 20%, transparent)',
              }}>
                <p style={{ fontSize: '12px', color: '#92400e', lineHeight: '1.5', margin: 0 }}>
                  <strong>Sin contexto activo.</strong> Activa documentos desde la lista de la izquierda.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ════ TAB AJUSTES ═══════════════════════════════════════════════ */}
        {activeTab === 'settings' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <AIConfigPanel userId={userId} workspaceType={contextoTipo} inline />
          </div>
        )}
      </div>

      {/* ═══ Modal Guardar Documento ════════════════════════════════════════ */}
      {saveModal.open && (
        <>
          <div
            onClick={() => !savingDoc && setSaveModal(prev => ({ ...prev, open: false }))}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 60 }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            width: '420px', maxWidth: 'calc(100vw - 32px)',
            background: 'var(--background)', borderRadius: '12px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)', border: '1px solid var(--border)',
            zIndex: 61, overflow: 'hidden',
          }}>
            <div style={{ padding: '15px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FilePlus size={14} style={{ color: 'var(--primary)' }} />
                <span style={{ fontSize: '13px', fontWeight: '600' }}>Guardar como documento</span>
              </div>
              <button onClick={() => !savingDoc && setSaveModal(prev => ({ ...prev, open: false }))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', display: 'flex', padding: '2px' }}>
                <X size={15} />
              </button>
            </div>

            <div style={{ padding: '18px' }}>
              <div style={{
                padding: '9px 12px', borderRadius: '8px', background: 'var(--muted)',
                fontSize: '12px', color: 'var(--muted-foreground)', lineHeight: '1.5',
                maxHeight: '72px', overflow: 'hidden', position: 'relative', marginBottom: '14px',
              }}>
                {saveModal.content.substring(0, 220)}{saveModal.content.length > 220 ? '...' : ''}
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '22px', background: 'linear-gradient(transparent, var(--muted))' }} />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted-foreground)', display: 'block', marginBottom: '5px' }}>
                  Nombre del documento
                </label>
                <input ref={tituloRef} type="text" value={saveModal.titulo}
                  onChange={e => setSaveModal(prev => ({ ...prev, titulo: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') guardarComoDocumento(); }}
                  autoFocus
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: '8px',
                    border: '1px solid var(--border)', fontSize: '13px', fontWeight: '500',
                    background: 'var(--background)', color: 'var(--foreground)',
                    boxSizing: 'border-box', outline: 'none',
                  }}
                  onFocus={e => { e.target.style.borderColor = 'var(--primary)'; }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)'; }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <button onClick={guardarComoDocumento} disabled={savingDoc || !saveModal.titulo.trim()}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    width: '100%', padding: '9px', borderRadius: '8px',
                    background: 'var(--primary)', color: 'white', border: 'none',
                    fontSize: '13px', fontWeight: '600',
                    cursor: savingDoc || !saveModal.titulo.trim() ? 'default' : 'pointer',
                    opacity: !saveModal.titulo.trim() || savingDoc ? 0.55 : 1,
                  }}>
                  {savingDoc ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={13} />}
                  {savingDoc ? 'Guardando...' : 'Guardar como nuevo documento'}
                </button>

                {selectedDocId && documentos.find(d => d.id === selectedDocId) && (
                  <button onClick={insertarEnDocActual} disabled={savingDoc}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      width: '100%', padding: '9px', borderRadius: '8px',
                      background: 'var(--background)', color: 'var(--foreground)',
                      border: '1px solid var(--border)', fontSize: '13px', fontWeight: '400',
                      cursor: savingDoc ? 'default' : 'pointer', transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--background)')}
                  >
                    <Replace size={13} />
                    Insertar en "{documentos.find(d => d.id === selectedDocId)?.nombre}"
                  </button>
                )}

                <button onClick={() => !savingDoc && setSaveModal(prev => ({ ...prev, open: false }))} disabled={savingDoc}
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', background: 'none', color: 'var(--muted-foreground)', border: 'none', fontSize: '12px', cursor: 'pointer' }}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE: MensajeRow
// ═══════════════════════════════════════════════════════════════════════════
interface MensajeRowProps {
  msg: Mensaje;
  documentos: Array<{ id: string; nombre: string; generado_por_ia?: boolean; contenido?: string | null; tipo_documento?: string | null }>;
  onSelectDoc?: (id: string) => void;
  onGuardar?: (msg: Mensaje) => void;
  onInsertar?: (msg: Mensaje) => void;
}

function MensajeRow({ msg, documentos, onSelectDoc, onGuardar, onInsertar }: MensajeRowProps) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const isUser = msg.role === 'user';
  const isTool = msg.tool && msg.tool !== 'notebook';
  const toolMeta = msg.tool ? TOOL_META[msg.tool] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
      {/* Etiqueta herramienta */}
      {isTool && toolMeta && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--muted-foreground)', paddingLeft: '2px' }}>
          <span>{toolMeta.emoji}</span>
          <span style={{ fontWeight: '600' }}>{toolMeta.label}</span>
          {msg.saved && (
            <span style={{ color: '#16a34a', display: 'flex', alignItems: 'center', gap: '3px', marginLeft: '2px' }}>
              · <CheckCircle2 size={10} /> guardado
            </span>
          )}
        </div>
      )}

      {/* Etiqueta agente */}
      {msg.isAgentMessage && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#6366f1', paddingLeft: 2 }}>
          <Zap size={10} style={{ fill: '#6366f1' }} />
          <span style={{ fontWeight: 600 }}>Agente</span>
        </div>
      )}

      {/* Feed de acciones del agente */}
      {msg.isAgentMessage && msg.agentActions && msg.agentActions.length > 0 && (
        <div style={{ width: '100%', maxWidth: '92%' }}>
          <AgentActionFeed actions={msg.agentActions} />
        </div>
      )}

      {/* Burbuja */}
      <div style={{
        maxWidth: '92%', padding: '10px 13px',
        borderRadius: isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
        background: isUser ? 'var(--primary)' : 'var(--muted)',
        color: isUser ? 'white' : 'var(--foreground)',
      }}>
        {/* Menciones del usuario */}
        {isUser && msg.mentionedDocIds && msg.mentionedDocIds.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginBottom: '6px' }}>
            {msg.mentionedDocIds.map(docId => {
              const doc = documentos.find(d => d.id === docId);
              return (
                <span key={docId} style={{
                  display: 'inline-flex', alignItems: 'center', gap: '2px',
                  padding: '1px 5px', borderRadius: '9999px',
                  background: 'rgba(255,255,255,0.2)',
                  fontSize: '10px', fontWeight: '600', opacity: doc ? 1 : 0.5,
                }}>
                  <AtSign size={8} />{doc?.nombre ?? '(eliminado)'}
                </span>
              );
            })}
          </div>
        )}

        <div style={{ fontSize: '13px', lineHeight: '1.65', whiteSpace: 'pre-wrap' }}>{msg.content}</div>

        {/* Fuentes colapsables */}
        {!isUser && msg.sourceRefs && msg.sourceRefs.length > 0 && (
          <div style={{ marginTop: '9px', borderTop: '1px solid var(--border)', paddingTop: '7px' }}>
            <button onClick={() => setSourcesOpen(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--muted-foreground)' }}>
              <BookOpen size={10} />
              <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Fuentes ({msg.sourceRefs.length})
              </span>
              {sourcesOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </button>

            {sourcesOpen && (
              <div style={{ marginTop: '5px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {msg.sourceRefs.map(src => {
                  const docExists = documentos.some(d => d.id === src.id);
                  const canOpen = docExists && !!onSelectDoc;
                  return (
                    <div key={src.id} onClick={() => canOpen && onSelectDoc!(src.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '4px 8px', borderRadius: '5px',
                        cursor: canOpen ? 'pointer' : 'default',
                        background: src.mentioned ? 'color-mix(in srgb, var(--primary) 8%, transparent)' : 'transparent',
                        border: src.mentioned ? '1px solid color-mix(in srgb, var(--primary) 15%, transparent)' : '1px solid transparent',
                        opacity: docExists ? 1 : 0.5, transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => { if (canOpen) e.currentTarget.style.background = 'color-mix(in srgb, var(--primary) 12%, transparent)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = src.mentioned ? 'color-mix(in srgb, var(--primary) 8%, transparent)' : 'transparent'; }}
                    >
                      {!docExists
                        ? <AlertCircle size={10} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
                        : src.mentioned
                          ? <AtSign size={10} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                          : <FileText size={10} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
                      }
                      <span style={{
                        fontSize: '11px', fontWeight: src.mentioned ? '600' : '400',
                        color: !docExists ? 'var(--muted-foreground)' : src.mentioned ? 'var(--primary)' : 'var(--foreground)',
                        flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {src.name}{!docExists ? ' (eliminado)' : ''}
                      </span>
                      {canOpen && <ExternalLink size={9} style={{ color: 'var(--muted-foreground)', flexShrink: 0, opacity: 0.4 }} />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Acciones guardar */}
      {!isUser && msg.tool && SAVEABLE_TOOLS_SET.has(msg.tool) && (onGuardar || onInsertar) && (
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', paddingLeft: '2px' }}>
          {!msg.saved ? (
            <>
              {onGuardar && (
                <button onClick={() => onGuardar(msg)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '4px',
                    padding: '3px 9px', borderRadius: '6px', border: '1px solid var(--border)',
                    background: 'var(--background)', cursor: 'pointer', fontSize: '11px',
                    fontWeight: '500', color: 'var(--foreground)', transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--background)')}
                >
                  <FilePlus size={11} />Guardar doc
                </button>
              )}
              {onInsertar && (
                <button onClick={() => onInsertar(msg)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '4px',
                    padding: '3px 9px', borderRadius: '6px', border: '1px solid var(--border)',
                    background: 'var(--background)', cursor: 'pointer', fontSize: '11px',
                    fontWeight: '400', color: 'var(--foreground)', transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--background)')}
                >
                  <Replace size={11} />Insertar
                </button>
              )}
            </>
          ) : (
            <span style={{ fontSize: '11px', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <CheckCircle2 size={10} /> Guardado
            </span>
          )}
        </div>
      )}
    </div>
  );
}
