'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Send, Settings, Sparkles, FileText, Save, FilePlus, Replace, CheckCircle2, X, AtSign, BookOpen, ExternalLink, AlertCircle } from 'lucide-react';
import { useMentions } from './useMentions';
import { ContextIndicator } from './ContextIndicator';
import AIToolsGrid from './AIToolsGrid';
import AIConfigPanel from './AIConfigPanel';
import type { ContextMode } from './ContextToggle';
import type { AITool } from '@/lib/types/ai-config';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// ─── Herramientas que generan contenido guardable ─────────────────────────
const SAVEABLE_TOOLS: AITool[] = ['summary', 'missing-info', 'checklist', 'email', 'deep-search'];

const TOOL_DEFAULT_NAMES: Record<AITool, string> = {
  summary: 'Resumen',
  'missing-info': 'Información faltante',
  checklist: 'Checklist',
  email: 'Borrador de email',
  'deep-search': 'Búsqueda profunda',
  notebook: 'Nota',
};

// ─── tipos ────────────────────────────────────────────────────────────────
interface SourceRef {
  id: string;
  name: string;
  /** true = vino de @mención explícita, false = estaba en contexto general */
  mentioned: boolean;
}

interface Mensaje {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** Usado para el bloque de fuentes del asistente */
  sourceRefs?: SourceRef[];
  /** IDs de docs @mencionados en el mensaje de usuario que originó esta respuesta */
  mentionedDocIds?: string[];
  tool?: AITool;
  timestamp: Date;
  saved?: boolean;
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
  documentos: Array<{ id: string; nombre: string; generado_por_ia?: boolean; contenido?: string | null }>;
  contextSelections?: Record<string, ContextMode>;
  clienteNombre?: string;
  onGenerarDocumento?: (nombre: string, contenido: string, prompt: string) => void;
  selectedDocId?: string | null;
  onSelectDoc?: (docId: string) => void;
  collapseButton?: React.ReactNode;
}

export default function AIPanelV2({
  userId,
  contextoId,
  contextoTipo,
  documentos,
  contextSelections,
  clienteNombre,
  onGenerarDocumento,
  selectedDocId,
  onSelectDoc,
  collapseButton
}: AIPanelProps) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [loading, setLoading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [saveModal, setSaveModal] = useState<SaveModalState>({
    open: false, messageId: '', content: '', tool: 'summary', titulo: ''
  });
  const [savingDoc, setSavingDoc] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const tituloRef = useRef<HTMLInputElement>(null);

  // ─── hook @mentions ──────────────────────────────────────────────────
  // Usamos un ref para que el callback sea estable sin crear dependencias circulares
  type DocRefMin = { id: string; nombre: string; contenido?: string | null };
  const submitRef = useRef<(text: string, mentions: DocRefMin[]) => void>(() => {});

  const mentionsHook = useMentions({
    documentos,
    onSubmit: useCallback((text: string, mentions: DocRefMin[]) => {
      submitRef.current(text, mentions);
    }, []),
  });

  // Calcular stats de contexto
  const contextStats = useMemo(() => {
    let docsInsights = 0;
    let docsFull = 0;

    if (contextSelections) {
      documentos.forEach(doc => {
        const mode = contextSelections[doc.id];
        if (mode === 'insights') docsInsights++;
        else if (mode === 'full') docsFull++;
      });
    }

    return { docsInsights, docsFull, notesCount: 0 };
  }, [documentos, contextSelections]);

  // Auto-scroll al final de mensajes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  // Preparar contexto de documentos para RAG
  // mentionedDocs: documentos @mencionados explícitamente → siempre en modo 'full' con prioridad
  const prepareContext = (mentionedDocs: Array<{ id: string; nombre: string; contenido?: string | null }> = []) => {
    const contextoTexto: string[] = [];

    // 1. Documentos @mencionados — contexto completo, prioritario
    if (mentionedDocs.length > 0) {
      contextoTexto.push('## Documentos mencionados explícitamente (contexto prioritario)\n');
      mentionedDocs.forEach(doc => {
        if (doc.contenido) {
          contextoTexto.push(`[📌 @${doc.nombre}]\n${doc.contenido}\n`);
        } else {
          contextoTexto.push(`[📌 @${doc.nombre}]\n(sin contenido aún)\n`);
        }
      });
      contextoTexto.push('---\n');
    }

    // 2. Resto del contexto seleccionado (contextSelections)
    if (contextSelections) {
      const mentionedIds = new Set(mentionedDocs.map(d => d.id));
      documentos.forEach(doc => {
        if (mentionedIds.has(doc.id)) return; // ya incluido arriba
        const mode = contextSelections[doc.id];
        if (mode === 'off' || !mode) return;

        if (mode === 'full' && doc.contenido) {
          contextoTexto.push(`[Documento: ${doc.nombre}]\n${doc.contenido}\n`);
        } else if (mode === 'insights' && doc.contenido) {
          const excerpt = doc.contenido.substring(0, 500);
          contextoTexto.push(`[Resumen de ${doc.nombre}]\n${excerpt}...\n`);
        }
      });
    }

    return contextoTexto.join('\n---\n\n');
  };

  // Función real de envío — llamada por el hook useMentions
  const submitMensaje = async (
    text: string,
    mentionedDocs: Array<{ id: string; nombre: string; contenido?: string | null }>
  ) => {
    if (loading) return;

    // Filtrar menciones a docs que todavía existen
    const validMentions = mentionedDocs.filter(m => documentos.some(d => d.id === m.id));

    const userMsg: Mensaje = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      mentionedDocIds: validMentions.map(m => m.id),
      timestamp: new Date(),
    };

    setMensajes(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const contexto = prepareContext(validMentions);

      const response = await fetch('/api/ia/notebook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          context: contexto,
          contextoId,
          contextoTipo,
          mentionedDocIds: validMentions.map(m => m.id),
          history: mensajes.slice(-5),
        }),
      });

      if (!response.ok) throw new Error('Error en la respuesta');

      const data = await response.json();

      // Calcular sourceRefs: menciones explícitas + docs en contexto activo
      const mentionedIds = new Set(validMentions.map(m => m.id));
      const sourceRefs: SourceRef[] = [
        // 1. Docs @mencionados — siempre primero, marcados como mentioned:true
        ...validMentions.map(m => ({ id: m.id, name: m.nombre, mentioned: true })),
        // 2. Docs del contexto general (insights o full), si los hay
        ...documentos
          .filter(d => {
            if (mentionedIds.has(d.id)) return false;
            const mode = contextSelections?.[d.id];
            return mode === 'full' || mode === 'insights';
          })
          .map(d => ({ id: d.id, name: d.nombre, mentioned: false })),
      ];

      const assistantMsg: Mensaje = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        sourceRefs: sourceRefs.length > 0 ? sourceRefs : undefined,
        mentionedDocIds: validMentions.map(m => m.id),
        tool: 'notebook',
        timestamp: new Date(),
      };

      setMensajes(prev => [...prev, assistantMsg]);
    } catch (error) {
      console.error('Error:', error);
      setMensajes(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Lo siento, hubo un error al procesar tu mensaje. Por favor intenta nuevamente.',
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  };
  // Enlazar el ref estable con la función actual
  submitRef.current = submitMensaje;

  // Ejecutar herramienta especializada
  const ejecutarHerramienta = async (tool: AITool, customInput?: string) => {
    setLoading(true);

    try {
      const contexto = prepareContext(); // sin menciones específicas
      
      const response = await fetch('/api/ia/tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool,
          input: customInput,
          context: contexto,
          contextoId,
          contextoTipo
        })
      });

      if (!response.ok) throw new Error('Error en la respuesta');

      const data = await response.json();
      const msgId = Date.now().toString();

      // Fuentes usadas: docs en contexto activo
      const toolSourceRefs: SourceRef[] = documentos
        .filter(d => {
          const mode = contextSelections?.[d.id];
          return mode === 'full' || mode === 'insights';
        })
        .map(d => ({ id: d.id, name: d.nombre, mentioned: false }));

      const toolMsg: Mensaje = {
        id: msgId,
        role: 'assistant',
        content: data.response,
        sourceRefs: toolSourceRefs.length > 0 ? toolSourceRefs : undefined,
        tool,
        timestamp: new Date()
      };

      setMensajes(prev => [...prev, toolMsg]);

      // Para herramientas que generan contenido guardable: abrir modal
      if (onGenerarDocumento && SAVEABLE_TOOLS.includes(tool)) {
        const fechaHoy = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
        const tituloSugerido = `${TOOL_DEFAULT_NAMES[tool]} — ${fechaHoy}`;
        setSaveModal({ open: true, messageId: msgId, content: data.response, tool, titulo: tituloSugerido });
      }
    } catch (error) {
      console.error('Error:', error);
      const errorMsg: Mensaje = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Lo siento, hubo un error al ejecutar la herramienta. Por favor intenta nuevamente.',
        timestamp: new Date()
      };
      setMensajes(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  // ─── abrir modal de guardado para un mensaje existente ─────────────────
  const abrirGuardarDesdeMsg = (msg: Mensaje) => {
    if (!msg.tool) return;
    const fechaHoy = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
    setSaveModal({
      open: true,
      messageId: msg.id,
      content: msg.content,
      tool: msg.tool,
      titulo: `${TOOL_DEFAULT_NAMES[msg.tool] ?? msg.tool} — ${fechaHoy}`,
    });
  };

  // ─── guardar como documento nuevo ──────────────────────────────────────
  const guardarComoDocumento = async () => {
    if (!onGenerarDocumento || !saveModal.titulo.trim()) return;
    setSavingDoc(true);
    try {
      await onGenerarDocumento(saveModal.titulo.trim(), saveModal.content, saveModal.tool);
      // marcar mensaje como guardado
      setMensajes(prev => prev.map(m => m.id === saveModal.messageId ? { ...m, saved: true } : m));
      setSaveModal(prev => ({ ...prev, open: false }));
      setSavedFeedback(`"${saveModal.titulo.trim()}" guardado`);
      setTimeout(() => setSavedFeedback(null), 3000);
    } finally {
      setSavingDoc(false);
    }
  };

  // ─── insertar en documento abierto ─────────────────────────────────────
  const insertarEnDocActual = async () => {
    if (!selectedDocId || !onGenerarDocumento) return;
    setSavingDoc(true);
    try {
      // Buscamos el doc actual para concatenar contenido
      const docActual = documentos.find(d => d.id === selectedDocId);
      const contenidoCombinado = docActual?.contenido
        ? `${docActual.contenido}\n\n---\n\n## ${saveModal.titulo}\n\n${saveModal.content}`
        : saveModal.content;
      // Llamamos onGenerarDocumento con el id del doc existente marcado en nombre
      await onGenerarDocumento(`__insert__${selectedDocId}`, contenidoCombinado, saveModal.tool);
      setMensajes(prev => prev.map(m => m.id === saveModal.messageId ? { ...m, saved: true } : m));
      setSaveModal(prev => ({ ...prev, open: false }));
      setSavedFeedback('Insertado en el documento abierto');
      setTimeout(() => setSavedFeedback(null), 3000);
    } finally {
      setSavingDoc(false);
    }
  };

  return (
    <>
      <div className="h-full flex flex-col bg-background">
        {/* Header */}
        <div className="flex-shrink-0 p-4 border-b">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Asistente IA</h2>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowConfig(true)}
                className="h-8 w-8"
              >
                <Settings className="h-4 w-4" />
              </Button>
              {collapseButton}
            </div>
          </div>

          {/* Context Indicator */}
          {contextSelections && (
            <ContextIndicator
              {...contextStats}
              className="mb-3"
            />
          )}
        </div>

        {/* Feedback de guardado */}
        {savedFeedback && (
          <div style={{
            flexShrink: 0, padding: '8px 16px', background: '#f0fdf4',
            borderBottom: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <CheckCircle2 size={14} style={{ color: '#16a34a' }} />
            <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: '500' }}>{savedFeedback}</span>
          </div>
        )}

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {mensajes.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Notebook Contextual</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Pregunta lo que necesites sobre este {contextoTipo}. 
                Tengo acceso a todos los documentos seleccionados.
              </p>
            </div>
          ) : (
            mensajes.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div style={{ maxWidth: '90%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div
                    className={`rounded-lg p-3 ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    {/* Tool badge */}
                    {msg.tool && msg.role === 'assistant' && msg.tool !== 'notebook' && (
                      <div style={{ marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Badge variant="outline" className="text-xs">
                          <FileText className="h-3 w-3 mr-1" />
                          {TOOL_DEFAULT_NAMES[msg.tool] ?? msg.tool}
                        </Badge>
                        {msg.saved && (
                          <span style={{ fontSize: '10px', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <CheckCircle2 size={10} /> guardado
                          </span>
                        )}
                      </div>
                    )}

                    <div className="text-sm whitespace-pre-wrap">{msg.content}</div>

                    {/* Menciones del usuario (@docs citados) */}
                    {msg.role === 'user' && msg.mentionedDocIds && msg.mentionedDocIds.length > 0 && (
                      <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {msg.mentionedDocIds.map((docId) => {
                          const doc = documentos.find(d => d.id === docId);
                          return (
                            <span
                              key={docId}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: '3px',
                                padding: '1px 6px', borderRadius: '9999px',
                                background: 'rgba(255,255,255,0.2)',
                                fontSize: '10px', fontWeight: '600',
                                opacity: doc ? 1 : 0.5,
                              }}
                            >
                              <AtSign size={8} />
                              {doc?.nombre ?? '(eliminado)'}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* ─── Fuentes del asistente ────────────────────────────── */}
                    {msg.role === 'assistant' && msg.sourceRefs && msg.sourceRefs.length > 0 && (
                      <div style={{
                        marginTop: '10px', paddingTop: '10px',
                        borderTop: '1px solid var(--border)',
                      }}>
                        {/* Cabecera */}
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: '5px',
                          marginBottom: '6px',
                        }}>
                          <BookOpen size={11} style={{ color: 'var(--muted-foreground)' }} />
                          <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Fuentes usadas
                          </span>
                          {msg.mentionedDocIds && msg.mentionedDocIds.length > 0 && (
                            <span style={{
                              fontSize: '9px', padding: '1px 5px', borderRadius: '9999px',
                              background: 'color-mix(in srgb, var(--primary) 12%, transparent)',
                              color: 'var(--primary)', fontWeight: '700',
                            }}>
                              {msg.mentionedDocIds.length} @mencionado{msg.mentionedDocIds.length > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>

                        {/* Lista de fuentes */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          {msg.sourceRefs.map((src) => {
                            const docExists = documentos.some(d => d.id === src.id);
                            const canOpen = docExists && !!onSelectDoc;

                            return (
                              <div
                                key={src.id}
                                onClick={() => {
                                  if (canOpen) onSelectDoc!(src.id);
                                }}
                                title={canOpen ? `Abrir "${src.name}"` : docExists ? src.name : 'Documento eliminado'}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: '6px',
                                  padding: '4px 8px', borderRadius: '6px',
                                  cursor: canOpen ? 'pointer' : 'default',
                                  background: src.mentioned
                                    ? 'color-mix(in srgb, var(--primary) 8%, transparent)'
                                    : 'transparent',
                                  border: src.mentioned
                                    ? '1px solid color-mix(in srgb, var(--primary) 20%, transparent)'
                                    : '1px solid transparent',
                                  opacity: docExists ? 1 : 0.5,
                                  transition: 'background 0.15s',
                                }}
                                onMouseEnter={e => {
                                  if (canOpen) e.currentTarget.style.background =
                                    src.mentioned
                                      ? 'color-mix(in srgb, var(--primary) 14%, transparent)'
                                      : 'var(--accent)';
                                }}
                                onMouseLeave={e => {
                                  e.currentTarget.style.background = src.mentioned
                                    ? 'color-mix(in srgb, var(--primary) 8%, transparent)'
                                    : 'transparent';
                                }}
                              >
                                {/* Icono estado */}
                                {!docExists ? (
                                  <AlertCircle size={11} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
                                ) : src.mentioned ? (
                                  <AtSign size={11} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                                ) : (
                                  <FileText size={11} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
                                )}

                                {/* Nombre */}
                                <span style={{
                                  fontSize: '11px',
                                  fontWeight: src.mentioned ? '600' : '400',
                                  color: !docExists
                                    ? 'var(--muted-foreground)'
                                    : src.mentioned
                                    ? 'var(--primary)'
                                    : 'var(--foreground)',
                                  flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                }}>
                                  {src.name}
                                  {!docExists && ' (eliminado)'}
                                </span>

                                {/* Icono abrir */}
                                {canOpen && (
                                  <ExternalLink size={10} style={{ color: 'var(--muted-foreground)', flexShrink: 0, opacity: 0.6 }} />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Botones de guardado para mensajes de herramientas */}
                  {msg.role === 'assistant' && msg.tool && SAVEABLE_TOOLS.includes(msg.tool) && onGenerarDocumento && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', paddingLeft: '2px' }}>
                      {!msg.saved ? (
                        <>
                          <button
                            onClick={() => abrirGuardarDesdeMsg(msg)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '4px',
                              padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border)',
                              background: 'white', cursor: 'pointer', fontSize: '11px', fontWeight: '600',
                              color: 'var(--foreground)', transition: 'background 0.15s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'white')}
                          >
                            <FilePlus size={11} />
                            Guardar como documento
                          </button>
                          {selectedDocId && (
                            <button
                              onClick={() => {
                                const fechaHoy = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
                                setSaveModal({
                                  open: true, messageId: msg.id, content: msg.content,
                                  tool: msg.tool!, titulo: `${TOOL_DEFAULT_NAMES[msg.tool!]} — ${fechaHoy}`,
                                });
                              }}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '4px',
                                padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border)',
                                background: 'white', cursor: 'pointer', fontSize: '11px', fontWeight: '600',
                                color: 'var(--foreground)', transition: 'background 0.15s',
                              }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'white')}
                            >
                              <Replace size={11} />
                              Insertar en abierto
                            </button>
                          )}
                        </>
                      ) : (
                        <span style={{ fontSize: '11px', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '4px', paddingLeft: '2px' }}>
                          <CheckCircle2 size={11} /> Guardado en documentos
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Tools Section */}
        <div className="flex-shrink-0 border-t p-4">
          <AIToolsGrid
            onExecuteTool={ejecutarHerramienta}
            disabled={loading}
          />
        </div>

        {/* Input Area */}
        <div className="flex-shrink-0 p-4 border-t bg-muted/30">
          {/* Chips de menciones activas */}
          {mentionsHook.mentions.length > 0 && (
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
              {mentionsHook.mentions.map(m => (
                <span
                  key={m.id}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '3px',
                    padding: '2px 8px', borderRadius: '9999px',
                    background: 'color-mix(in srgb, var(--primary) 12%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)',
                    fontSize: '11px', fontWeight: '600', color: 'var(--primary)',
                  }}
                >
                  <AtSign size={9} />
                  {m.nombre}
                </span>
              ))}
            </div>
          )}

          {/* Wrapper relativo para el dropdown */}
          <div style={{ position: 'relative' }}>
            {/* Dropdown de sugerencias */}
            {mentionsHook.suggestionsOpen && (
              <div style={{
                position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, right: 0,
                background: 'var(--popover)', border: '1px solid var(--border)',
                borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                zIndex: 50, overflow: 'hidden', maxHeight: '200px', overflowY: 'auto',
              }}>
                <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <AtSign size={11} style={{ color: 'var(--primary)' }} />
                  <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--muted-foreground)' }}>Mencionar documento</span>
                </div>
                {mentionsHook.suggestions.map((doc, idx) => (
                  <button
                    key={doc.id}
                    onMouseDown={e => { e.preventDefault(); mentionsHook.selectSuggestion(doc); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      width: '100%', padding: '8px 12px', border: 'none', textAlign: 'left',
                      background: idx === mentionsHook.activeIndex
                        ? 'color-mix(in srgb, var(--primary) 10%, transparent)'
                        : 'transparent',
                      cursor: 'pointer', fontSize: '13px',
                      borderLeft: idx === mentionsHook.activeIndex
                        ? '2px solid var(--primary)'
                        : '2px solid transparent',
                      transition: 'background 0.1s',
                    }}
                  >
                    <FileText size={13} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
                    <span style={{ fontWeight: '500', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {doc.nombre}
                    </span>
                    {doc.generado_por_ia && (
                      <span style={{ fontSize: '10px', color: 'var(--primary)', opacity: 0.7, flexShrink: 0 }}>IA</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  ref={mentionsHook.inputRef}
                  type="text"
                  value={mentionsHook.inputText}
                  onChange={e => mentionsHook.handleInputChange(e.target.value)}
                  onKeyDown={mentionsHook.handleKeyDown}
                  onBlur={mentionsHook.closeSuggestions}
                  placeholder={`Pregunta sobre este ${contextoTipo}… o escribe @ para citar un documento`}
                  disabled={loading}
                  style={{
                    width: '100%', padding: '9px 32px 9px 12px',
                    background: 'var(--background)', border: '1px solid var(--border)',
                    borderRadius: '8px', fontSize: '13px', outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--primary)'; }}
                  // No usamos onBlur para borderColor porque cierra el dropdown primero
                />
                {/* Icono @ en el input */}
                <AtSign
                  size={13}
                  style={{
                    position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                    color: mentionsHook.suggestionsOpen ? 'var(--primary)' : 'var(--muted-foreground)',
                    pointerEvents: 'none', transition: 'color 0.15s',
                  }}
                />
              </div>
              <Button
                onClick={mentionsHook.handleSubmit}
                disabled={loading || !mentionsHook.inputText.trim()}
                size="icon"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Config Panel */}
      <AIConfigPanel
        isOpen={showConfig}
        onClose={() => setShowConfig(false)}
        userId={userId}
        workspaceType={contextoTipo}
      />

      {/* ─── Modal Guardar Documento ────────────────────────────────────── */}
      {saveModal.open && (
        <>
          {/* Overlay */}
          <div
            onClick={() => !savingDoc && setSaveModal(prev => ({ ...prev, open: false }))}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 60 }}
          />

          {/* Modal */}
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            width: '440px', maxWidth: 'calc(100vw - 32px)',
            background: 'white', borderRadius: '12px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            zIndex: 61, overflow: 'hidden',
          }}>
            {/* Header modal */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FilePlus size={16} style={{ color: 'var(--primary)' }} />
                <span style={{ fontSize: '14px', fontWeight: '700' }}>Guardar como documento</span>
              </div>
              <button
                onClick={() => !savingDoc && setSaveModal(prev => ({ ...prev, open: false }))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', display: 'flex' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Body modal */}
            <div style={{ padding: '20px' }}>
              {/* Preview del contenido */}
              <div style={{
                padding: '10px 12px', borderRadius: '8px', background: 'var(--muted)',
                fontSize: '12px', color: 'var(--muted-foreground)', lineHeight: '1.5',
                maxHeight: '100px', overflow: 'hidden', position: 'relative',
                marginBottom: '16px',
              }}>
                <div style={{ overflow: 'hidden', maxHeight: '80px' }}>
                  {saveModal.content.substring(0, 300)}{saveModal.content.length > 300 ? '...' : ''}
                </div>
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '30px', background: 'linear-gradient(transparent, var(--muted))' }} />
              </div>

              {/* Título editable */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted-foreground)', display: 'block', marginBottom: '6px' }}>
                  Título del documento
                </label>
                <input
                  ref={tituloRef}
                  type="text"
                  value={saveModal.titulo}
                  onChange={e => setSaveModal(prev => ({ ...prev, titulo: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') guardarComoDocumento(); }}
                  autoFocus
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: '8px',
                    border: '1px solid var(--border)', fontSize: '13px', fontWeight: '600',
                    boxSizing: 'border-box', outline: 'none',
                  }}
                  onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 2px color-mix(in srgb, var(--primary) 20%, transparent)'; }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>

              {/* Acciones */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* Guardar como nuevo */}
                <button
                  onClick={guardarComoDocumento}
                  disabled={savingDoc || !saveModal.titulo.trim()}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    width: '100%', padding: '10px 16px', borderRadius: '8px',
                    background: 'var(--primary)', color: 'white', border: 'none',
                    fontSize: '13px', fontWeight: '600', cursor: savingDoc ? 'wait' : 'pointer',
                    opacity: (!saveModal.titulo.trim() || savingDoc) ? 0.6 : 1,
                    transition: 'opacity 0.15s',
                  }}
                >
                  <Save size={14} />
                  {savingDoc ? 'Guardando...' : 'Guardar como documento nuevo'}
                </button>

                {/* Insertar en doc actual */}
                {selectedDocId && documentos.find(d => d.id === selectedDocId) && (
                  <button
                    onClick={insertarEnDocActual}
                    disabled={savingDoc}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      width: '100%', padding: '10px 16px', borderRadius: '8px',
                      background: 'white', color: 'var(--foreground)',
                      border: '1px solid var(--border)',
                      fontSize: '13px', fontWeight: '500', cursor: savingDoc ? 'wait' : 'pointer',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'white')}
                  >
                    <Replace size={14} />
                    Insertar en "{documentos.find(d => d.id === selectedDocId)?.nombre}"
                  </button>
                )}

                {/* Cancelar */}
                <button
                  onClick={() => !savingDoc && setSaveModal(prev => ({ ...prev, open: false }))}
                  disabled={savingDoc}
                  style={{
                    width: '100%', padding: '8px', borderRadius: '8px',
                    background: 'none', color: 'var(--muted-foreground)', border: 'none',
                    fontSize: '12px', cursor: 'pointer',
                  }}
                >
                  Cancelar — no guardar
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
