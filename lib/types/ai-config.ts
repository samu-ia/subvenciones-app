/**
 * Sistema de configuración multi-modelo y multi-proveedor para IA
 */

// Proveedores de IA soportados
export type AIProvider = 
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'openrouter'
  | 'azure'
  | 'custom';

// Herramientas/funciones de IA disponibles
export type AITool = 
  | 'notebook'        // Chat contextual principal (RAG)
  | 'summary'         // Resumen de expediente/reunión
  | 'missing-info'    // Detectar información faltante
  | 'checklist'       // Generar checklist
  | 'email'           // Generar emails
  | 'deep-search';    // Búsqueda profunda

// Modelos disponibles por proveedor
export interface AIModel {
  id: string;
  name: string;
  provider: AIProvider;
  contextWindow: number;
  costPer1kTokens: number;
  capabilities: {
    streaming?: boolean;
    functionCalling?: boolean;
    vision?: boolean;
  };
}

// Configuración de un proveedor específico
export interface ProviderConfig {
  provider: AIProvider;
  apiKey?: string;
  baseUrl?: string;
  organization?: string;
  enabled: boolean;
}

// Configuración específica de una herramienta
export interface ToolConfig {
  tool: AITool;
  enabled: boolean;
  provider: AIProvider;
  model: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  streamEnabled?: boolean;
  
  // Configuración específica del notebook
  notebookConfig?: {
    useDocuments: boolean;
    useFiles: boolean;
    useNotes: boolean;
    maxContextDocuments: number;
    citeSources: boolean;
    autoSaveResults: boolean;
  };
  
  // Configuración de búsqueda profunda
  deepSearchConfig?: {
    maxDepth: number;
    includeExternal: boolean;
    externalSources?: string[];
  };
}

// Configuración completa de IA para un usuario/workspace
export interface AIConfiguration {
  id: string;
  user_id: string;
  workspace_type: 'expediente' | 'reunion';
  
  // Proveedores configurados
  providers: ProviderConfig[];
  
  // Configuración por herramienta
  tools: ToolConfig[];
  
  // Configuración global
  globalConfig: {
    defaultProvider: AIProvider;
    defaultModel: string;
    enableAnalytics: boolean;
    maxConcurrentRequests: number;
  };
  
  created_at: string;
  updated_at: string;
}

// Resultado de una ejecución de herramienta
export interface ToolExecutionResult {
  tool: AITool;
  success: boolean;
  content: string;
  sourcesUsed?: Array<{
    type: 'document' | 'file' | 'note';
    id: string;
    name: string;
    excerpt?: string;
  }>;
  metadata: {
    model: string;
    provider: AIProvider;
    tokensUsed: number;
    executionTime: number;
    timestamp: string;
  };
  error?: string;
}

// Request para ejecutar una herramienta
export interface ToolExecutionRequest {
  tool: AITool;
  input: string;
  context?: {
    documentIds?: string[];
    fileIds?: string[];
    noteIds?: string[];
  };
  options?: {
    saveAsDocument?: boolean;
    documentName?: string;
    streaming?: boolean;
  };
}

// Modelos predefinidos por proveedor — actualizado a modelos actuales (2025-2026)
export const AVAILABLE_MODELS: Record<AIProvider, AIModel[]> = {
  openai: [
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      provider: 'openai',
      contextWindow: 128000,
      costPer1kTokens: 0.005,
      capabilities: { streaming: true, functionCalling: true, vision: true }
    },
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      provider: 'openai',
      contextWindow: 128000,
      costPer1kTokens: 0.00015,
      capabilities: { streaming: true, functionCalling: true, vision: true }
    },
    {
      id: 'gpt-4-turbo',
      name: 'GPT-4 Turbo (legacy)',
      provider: 'openai',
      contextWindow: 128000,
      costPer1kTokens: 0.01,
      capabilities: { streaming: true, functionCalling: true, vision: true }
    }
  ],
  anthropic: [
    {
      id: 'claude-sonnet-4-6',
      name: 'Claude Sonnet 4.6',
      provider: 'anthropic',
      contextWindow: 200000,
      costPer1kTokens: 0.003,
      capabilities: { streaming: true, functionCalling: true, vision: true }
    },
    {
      id: 'claude-opus-4-6',
      name: 'Claude Opus 4.6',
      provider: 'anthropic',
      contextWindow: 200000,
      costPer1kTokens: 0.015,
      capabilities: { streaming: true, functionCalling: true, vision: true }
    },
    {
      id: 'claude-haiku-4-5-20251001',
      name: 'Claude Haiku 4.5',
      provider: 'anthropic',
      contextWindow: 200000,
      costPer1kTokens: 0.00025,
      capabilities: { streaming: true, functionCalling: true, vision: true }
    }
  ],
  google: [
    {
      id: 'gemini-2.5-flash',
      name: 'Gemini 2.5 Flash',
      provider: 'google',
      contextWindow: 1000000,
      costPer1kTokens: 0.0001,
      capabilities: { streaming: true, functionCalling: true, vision: true }
    },
    {
      id: 'gemini-1.5-pro',
      name: 'Gemini 1.5 Pro',
      provider: 'google',
      contextWindow: 2000000,
      costPer1kTokens: 0.00125,
      capabilities: { streaming: true, functionCalling: true, vision: true }
    },
    {
      id: 'gemini-1.5-flash',
      name: 'Gemini 1.5 Flash',
      provider: 'google',
      contextWindow: 1000000,
      costPer1kTokens: 0.000075,
      capabilities: { streaming: true, functionCalling: true, vision: true }
    }
  ],
  openrouter: [
    {
      id: 'auto',
      name: 'Auto (Best Available)',
      provider: 'openrouter',
      contextWindow: 128000,
      costPer1kTokens: 0.01,
      capabilities: { streaming: true, functionCalling: true }
    }
  ],
  azure: [],
  custom: []
};

// Configuración por defecto — Anthropic Claude como proveedor principal
// (OpenAI es opcional; Gemini para deep-search con contexto PDF largo)
export const DEFAULT_TOOL_CONFIGS: Record<AITool, Partial<ToolConfig>> = {
  notebook: {
    tool: 'notebook',
    enabled: true,
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    temperature: 0.7,
    maxTokens: 4096,
    streamEnabled: true,
    notebookConfig: {
      useDocuments: true,
      useFiles: true,
      useNotes: true,
      maxContextDocuments: 10,
      citeSources: true,
      autoSaveResults: false
    },
    systemPrompt: `Eres un asistente especializado en gestión de expedientes y subvenciones públicas españolas.
Tienes acceso a documentos, archivos y notas del expediente actual.
Cuando respondas:
- Usa la información del contexto para dar respuestas precisas y accionables
- Cita el documento fuente cuando uses información específica (ej: "según la memoria técnica…")
- Sé conciso y directo. Si algo requiere acción, indícalo claramente
- Si falta información clave para responder, di exactamente qué información necesitas
- Para generar documentos, usa formato Markdown estructurado con secciones claras`
  },
  summary: {
    tool: 'summary',
    enabled: true,
    provider: 'anthropic',
    model: 'claude-haiku-4-5-20251001',
    temperature: 0.3,
    maxTokens: 2048,
    systemPrompt: `Crea resúmenes ejecutivos claros y estructurados de expedientes de subvenciones.
Estructura obligatoria:
## Resumen ejecutivo
## Estado actual
## Información clave (importe, plazos, organismo)
## Documentación pendiente
## Próximos pasos`
  },
  'missing-info': {
    tool: 'missing-info',
    enabled: true,
    provider: 'anthropic',
    model: 'claude-haiku-4-5-20251001',
    temperature: 0.3,
    maxTokens: 1024,
    systemPrompt: `Analiza el expediente e identifica exactamente qué información o documentación falta.
Para cada elemento faltante indica:
- Qué falta específicamente
- Por qué es necesario (para qué fase/requisito)
- Cómo obtenerlo (si es obvio)
Sé específico, no genérico.`
  },
  checklist: {
    tool: 'checklist',
    enabled: true,
    provider: 'anthropic',
    model: 'claude-haiku-4-5-20251001',
    temperature: 0.2,
    maxTokens: 2048,
    systemPrompt: `Genera un checklist accionable de todo lo necesario para tramitar la subvención.
Organiza por fases (Preparación → Presentación → Seguimiento → Justificación).
Incluye: documentos a recopilar, plazos críticos, acciones concretas.
Formato: lista de items con checkbox [ ] marcables.`
  },
  email: {
    tool: 'email',
    enabled: true,
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    temperature: 0.5,
    maxTokens: 1500,
    systemPrompt: `Redacta emails profesionales en nombre de la gestora de subvenciones.
Tono: formal pero cercano. Firma siempre con los datos de la gestora.
Estructura: saludo personalizado → cuerpo claro → llamada a la acción → despedida.
Adapta el nivel técnico al receptor (cliente PYME vs administración pública).`
  },
  'deep-search': {
    tool: 'deep-search',
    enabled: true,
    provider: 'google',
    model: 'gemini-2.5-flash',
    temperature: 0.3,
    maxTokens: 8192,
    deepSearchConfig: {
      maxDepth: 3,
      includeExternal: false,
      externalSources: []
    },
    systemPrompt: `Eres un especialista en subvenciones y ayudas públicas para empresas en España.
Analiza el perfil completo de la empresa y detecta todas las subvenciones relevantes.
Prioriza por probabilidad de éxito y urgencia de plazo.
Responde SIEMPRE con JSON válido sin texto adicional.`
  }
};

// Helper para obtener label amigable de herramienta
export function getToolLabel(tool: AITool): string {
  const labels: Record<AITool, string> = {
    notebook: 'Notebook Contextual',
    summary: 'Resumen',
    'missing-info': 'Info Faltante',
    checklist: 'Checklist',
    email: 'Generar Email',
    'deep-search': 'Búsqueda Profunda'
  };
  return labels[tool];
}

// Helper para obtener icono de herramienta
export function getToolIcon(tool: AITool): string {
  const icons: Record<AITool, string> = {
    notebook: 'BookOpen',
    summary: 'FileText',
    'missing-info': 'AlertCircle',
    checklist: 'CheckSquare',
    email: 'Mail',
    'deep-search': 'Search'
  };
  return icons[tool];
}

// Helper para obtener label de proveedor
export function getProviderLabel(provider: AIProvider): string {
  const labels: Record<AIProvider, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic (Claude)',
    google: 'Google (Gemini)',
    openrouter: 'OpenRouter',
    azure: 'Azure OpenAI',
    custom: 'Custom'
  };
  return labels[provider];
}
