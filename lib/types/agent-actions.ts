/**
 * lib/types/agent-actions.ts
 *
 * Define las acciones que el Agente IA puede ejecutar sobre
 * el notebook (documentos, carpetas) además de responder por chat.
 */

// ─── Tipos de acción ──────────────────────────────────────────────────────────

/** Crear una carpeta/grupo de documentos */
export interface AgentActionCreateFolder {
  type: 'create_folder';
  folder_name: string;
}

/** Crear un documento nuevo (opcionalmente dentro de una carpeta) */
export interface AgentActionCreateDocument {
  type: 'create_document';
  nombre: string;
  contenido: string;
  tipo_documento?: string;
  folder_name?: string;   // si se indica, asocia al folder (campo grupo)
}

/** Editar/reemplazar el contenido de un documento existente */
export interface AgentActionEditDocument {
  type: 'edit_document';
  document_id?: string;   // si se conoce el ID
  nombre?: string;        // alternativa: buscar por nombre
  contenido: string;
  append?: boolean;       // si true → añadir al final en vez de reemplazar
}

/**
 * Edición quirúrgica: busca `buscar` en el documento y lo reemplaza con `reemplazar`.
 * Útil para modificar solo una sección sin tocar el resto del contenido.
 */
export interface AgentActionEditSection {
  type: 'edit_section';
  document_id?: string;
  nombre?: string;         // buscar doc por nombre si no hay ID
  buscar: string;          // fragmento exacto a reemplazar (puede ser un título de sección)
  reemplazar: string;      // nuevo contenido para ese fragmento
}

/** Respuesta pura de chat (sin acciones sobre documentos) */
export interface AgentActionRespond {
  type: 'respond';
  content: string;
}

export type AgentAction =
  | AgentActionCreateFolder
  | AgentActionCreateDocument
  | AgentActionEditDocument
  | AgentActionEditSection
  | AgentActionRespond;

// ─── Resultado de ejecutar una acción ─────────────────────────────────────────

export interface AgentActionResult {
  action: AgentAction;
  success: boolean;
  error?: string;
  /** ID del documento creado/editado (si aplica) */
  documentId?: string;
  /** Nombre del documento creado/editado (si aplica) */
  documentName?: string;
}

// ─── Request / Response del endpoint /api/ia/agent ───────────────────────────

export interface AgentRequest {
  message: string;
  context: string;
  contextoId: string;
  contextoTipo: 'expediente' | 'reunion';
  /** Documentos actuales del notebook para que el agente los conozca */
  documentos: Array<{
    id: string;
    nombre: string;
    tipo_documento?: string | null;
    grupo?: string | null;
    /** Contenido actual del documento (para que el agente pueda editarlo parcialmente) */
    contenido?: string | null;
  }>;
  history: Array<{ role: string; content: string }>;
}

export interface AgentResponse {
  /** Texto final de chat (explicación del agente) */
  chatMessage: string;
  /** Lista de acciones ejecutadas */
  actions: AgentActionResult[];
  metadata: {
    model: string;
    provider: string;
    tokensUsed: number;
  };
}
