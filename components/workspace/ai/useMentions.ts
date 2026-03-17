'use client';

import { useState, useRef, useCallback, useEffect, type Dispatch, type SetStateAction } from 'react';

export interface DocRef {
  id: string;
  nombre: string;
  contenido?: string | null;
  generado_por_ia?: boolean;
}

export interface MentionState {
  /** Texto actual del input incluyendo los @tokens */
  inputText: string;
  /** Setter directo del texto del input */
  setInputText: Dispatch<SetStateAction<string>>;
  /** Docs mencionados confirmados (sin duplicados) */
  mentions: DocRef[];
  /** Si el dropdown de sugerencias está abierto */
  suggestionsOpen: boolean;
  /** Lista de sugerencias filtradas */
  suggestions: DocRef[];
  /** Índice activo en el dropdown (para teclado) */
  activeIndex: number;
}

interface UseMentionsOptions {
  documentos: DocRef[];
  onSubmit: (text: string, mentions: DocRef[]) => void;
}

/**
 * Detecta si el cursor está justo después de un @ incompleto y extrae la query.
 * Ej: "Resume @Mem" → "Mem"
 * Ej: "hola @"    → ""
 * Devuelve null si no hay mención activa.
 */
function getActiveMentionQuery(text: string, cursorPos: number): string | null {
  const before = text.slice(0, cursorPos);
  // Busca el último @ que no esté seguido de espacio ya completado
  const match = before.match(/@([^\s@]*)$/);
  if (!match) return null;
  return match[1]; // puede ser "" si solo escribió @
}

/**
 * Reemplaza el token @query en el texto por @NombreDoc (nombre con espacios protegidos)
 * y devuelve el texto actualizado + la nueva posición del cursor.
 */
function replaceActiveMention(
  text: string,
  cursorPos: number,
  doc: DocRef
): { newText: string; newCursorPos: number } {
  const before = text.slice(0, cursorPos);
  const after = text.slice(cursorPos);
  // Reemplaza el @query por @NombreDoc seguido de espacio
  const replaced = before.replace(/@([^\s@]*)$/, `@${doc.nombre} `);
  return {
    newText: replaced + after,
    newCursorPos: replaced.length,
  };
}

/**
 * Extrae todos los @tokens del texto y los resuelve a DocRef.
 * Devuelve los documentos encontrados (sin duplicados).
 */
function resolveMentions(text: string, documentos: DocRef[]): DocRef[] {
  const tokens = [...text.matchAll(/@([\w\u00C0-\u024F\s.-]+?)(?=\s@|\s*$|[^[\w\u00C0-\u024F\s.-])/g)];
  const found: DocRef[] = [];
  const seen = new Set<string>();

  for (const match of tokens) {
    const rawName = match[1].trim();
    const doc = documentos.find(
      d => d.nombre.toLowerCase() === rawName.toLowerCase()
    );
    if (doc && !seen.has(doc.id)) {
      seen.add(doc.id);
      found.push(doc);
    }
  }
  return found;
}

export function useMentions({ documentos, onSubmit }: UseMentionsOptions) {
  const [inputText, setInputText] = useState('');
  const [mentions, setMentions] = useState<DocRef[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<DocRef[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  // Guardamos la query activa para no recalcularla en handlers
  const activeMentionQueryRef = useRef<string | null>(null);

  // ── Actualizar sugerencias cuando cambia el texto ──────────────────────
  const handleInputChange = useCallback((value: string) => {
    setInputText(value);

    const cursor = inputRef.current?.selectionStart ?? value.length;
    const query = getActiveMentionQuery(value, cursor);

    if (query === null) {
      setSuggestionsOpen(false);
      activeMentionQueryRef.current = null;
      return;
    }

    activeMentionQueryRef.current = query;
    const filtered = documentos.filter(d =>
      d.nombre.toLowerCase().includes(query.toLowerCase())
    );
    setSuggestions(filtered);
    setSuggestionsOpen(filtered.length > 0);
    setActiveIndex(0);

    // Actualizar menciones resueltas del texto completo
    setMentions(resolveMentions(value, documentos));
  }, [documentos]);

  // También recalcular menciones si cambia el listado de documentos
  useEffect(() => {
    setMentions(resolveMentions(inputText, documentos));
  }, [documentos]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Seleccionar una sugerencia ─────────────────────────────────────────
  const selectSuggestion = useCallback((doc: DocRef) => {
    const cursor = inputRef.current?.selectionStart ?? inputText.length;
    const { newText, newCursorPos } = replaceActiveMention(inputText, cursor, doc);

    setInputText(newText);
    setSuggestionsOpen(false);
    activeMentionQueryRef.current = null;

    // Actualizar menciones
    setMentions(resolveMentions(newText, documentos));

    // Restaurar foco y cursor
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    });
  }, [inputText, documentos]);

  // ── Navegación por teclado ─────────────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!suggestionsOpen) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (suggestions[activeIndex]) selectSuggestion(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setSuggestionsOpen(false);
    }
  }, [suggestionsOpen, suggestions, activeIndex, selectSuggestion]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Submit ─────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(() => {
    const text = inputText.trim();
    if (!text) return;
    const resolvedMentions = resolveMentions(text, documentos);
    onSubmit(text, resolvedMentions);
    setInputText('');
    setMentions([]);
    setSuggestionsOpen(false);
  }, [inputText, documentos, onSubmit]);

  // ── Cerrar dropdown al hacer clic fuera ───────────────────────────────
  const closeSuggestions = useCallback(() => setSuggestionsOpen(false), []);

  return {
    inputText,
    setInputText,
    mentions,
    suggestionsOpen,
    suggestions,
    activeIndex,
    inputRef,
    handleInputChange,
    handleKeyDown,
    handleSubmit,
    selectSuggestion,
    closeSuggestions,
  };
}
