'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Send, Settings, Sparkles, FileText } from 'lucide-react';
import { ContextIndicator } from './ContextIndicator';
import AIToolsGrid from './AIToolsGrid';
import AIConfigPanel from './AIConfigPanel';
import type { ContextMode } from './ContextToggle';
import type { AITool } from '@/lib/types/ai-config';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Mensaje {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{
    type: 'document' | 'file' | 'note';
    id: string;
    name: string;
  }>;
  tool?: AITool;
  timestamp: Date;
}

interface AIPanelProps {
  contextoId: string;
  contextoTipo: 'reunion' | 'expediente';
  documentos: Array<{ id: string; nombre: string; generado_por_ia?: boolean; contenido?: string | null }>;
  contextSelections?: Record<string, ContextMode>;
  clienteNombre?: string;
  onGenerarDocumento?: (nombre: string, contenido: string, prompt: string) => void;
  collapseButton?: React.ReactNode;
}

export default function AIPanelV2({
  contextoId,
  contextoTipo,
  documentos,
  contextSelections,
  clienteNombre,
  onGenerarDocumento,
  collapseButton
}: AIPanelProps) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [userId] = useState('user-temp-id'); // En producción vendría del auth

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
  const prepareContext = () => {
    if (!contextSelections) return '';

    const contextoTexto: string[] = [];
    
    documentos.forEach(doc => {
      const mode = contextSelections[doc.id];
      if (mode === 'off' || !mode) return;

      if (mode === 'full' && doc.contenido) {
        contextoTexto.push(`[Documento: ${doc.nombre}]\n${doc.contenido}\n`);
      } else if (mode === 'insights' && doc.contenido) {
        // En modo insights, solo primeros 500 caracteres
        const excerpt = doc.contenido.substring(0, 500);
        contextoTexto.push(`[Resumen de ${doc.nombre}]\n${excerpt}...\n`);
      }
    });

    return contextoTexto.join('\n---\n\n');
  };

  // Enviar mensaje del notebook principal
  const enviarMensaje = async () => {
    if (!input.trim() || loading) return;

    const userMsg: Mensaje = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMensajes(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const contexto = prepareContext();
      
      const response = await fetch('/api/ia/notebook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          context: contexto,
          contextoId,
          contextoTipo,
          history: mensajes.slice(-5) // Últimos 5 mensajes para contexto
        })
      });

      if (!response.ok) throw new Error('Error en la respuesta');

      const data = await response.json();

      const assistantMsg: Mensaje = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        sources: data.sources,
        tool: 'notebook',
        timestamp: new Date()
      };

      setMensajes(prev => [...prev, assistantMsg]);
    } catch (error) {
      console.error('Error:', error);
      const errorMsg: Mensaje = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Lo siento, hubo un error al procesar tu mensaje. Por favor intenta nuevamente.',
        timestamp: new Date()
      };
      setMensajes(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  // Ejecutar herramienta especializada
  const ejecutarHerramienta = async (tool: AITool, customInput?: string) => {
    setLoading(true);

    try {
      const contexto = prepareContext();
      
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

      const toolMsg: Mensaje = {
        id: Date.now().toString(),
        role: 'assistant',
        content: data.response,
        sources: data.sources,
        tool,
        timestamp: new Date()
      };

      setMensajes(prev => [...prev, toolMsg]);

      // Si es una herramienta que genera documento, preguntar si quiere guardarlo
      if (onGenerarDocumento && ['summary', 'checklist', 'email'].includes(tool)) {
        // TODO: Mostrar diálogo para guardar
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
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
                <div
                  className={`max-w-[85%] rounded-lg p-3 ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  {/* Tool badge */}
                  {msg.tool && msg.role === 'assistant' && (
                    <Badge variant="outline" className="mb-2 text-xs">
                      <FileText className="h-3 w-3 mr-1" />
                      {msg.tool}
                    </Badge>
                  )}

                  <div className="text-sm whitespace-pre-wrap">{msg.content}</div>

                  {/* Sources */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border/50">
                      <div className="text-xs text-muted-foreground mb-1">Fuentes:</div>
                      <div className="flex flex-wrap gap-1">
                        {msg.sources.map((source, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {source.name}
                          </Badge>
                        ))}
                      </div>
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
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  enviarMensaje();
                }
              }}
              placeholder="Pregunta algo sobre este expediente..."
              disabled={loading}
              className="flex-1 px-3 py-2 bg-background border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <Button
              onClick={enviarMensaje}
              disabled={loading || !input.trim()}
              size="icon"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Usa @ para mencionar documentos específicos
          </p>
        </div>
      </div>

      {/* Config Panel */}
      <AIConfigPanel
        isOpen={showConfig}
        onClose={() => setShowConfig(false)}
        userId={userId}
        workspaceType={contextoTipo}
      />
    </>
  );
}
