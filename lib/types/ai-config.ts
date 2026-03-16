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

// Modelos predefinidos por proveedor
export const AVAILABLE_MODELS: Record<AIProvider, AIModel[]> = {
  openai: [
    {
      id: 'gpt-4-turbo',
      name: 'GPT-4 Turbo',
      provider: 'openai',
      contextWindow: 128000,
      costPer1kTokens: 0.01,
      capabilities: { streaming: true, functionCalling: true, vision: true }
    },
    {
      id: 'gpt-4',
      name: 'GPT-4',
      provider: 'openai',
      contextWindow: 8192,
      costPer1kTokens: 0.03,
      capabilities: { streaming: true, functionCalling: true }
    },
    {
      id: 'gpt-3.5-turbo',
      name: 'GPT-3.5 Turbo',
      provider: 'openai',
      contextWindow: 16384,
      costPer1kTokens: 0.0015,
      capabilities: { streaming: true, functionCalling: true }
    }
  ],
  anthropic: [
    {
      id: 'claude-3-opus',
      name: 'Claude 3 Opus',
      provider: 'anthropic',
      contextWindow: 200000,
      costPer1kTokens: 0.015,
      capabilities: { streaming: true, vision: true }
    },
    {
      id: 'claude-3-sonnet',
      name: 'Claude 3 Sonnet',
      provider: 'anthropic',
      contextWindow: 200000,
      costPer1kTokens: 0.003,
      capabilities: { streaming: true, vision: true }
    },
    {
      id: 'claude-3-haiku',
      name: 'Claude 3 Haiku',
      provider: 'anthropic',
      contextWindow: 200000,
      costPer1kTokens: 0.00025,
      capabilities: { streaming: true, vision: true }
    }
  ],
  google: [
    {
      id: 'gemini-pro',
      name: 'Gemini Pro',
      provider: 'google',
      contextWindow: 32768,
      costPer1kTokens: 0.0005,
      capabilities: { streaming: true }
    },
    {
      id: 'gemini-pro-vision',
      name: 'Gemini Pro Vision',
      provider: 'google',
      contextWindow: 16384,
      costPer1kTokens: 0.0025,
      capabilities: { streaming: true, vision: true }
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

// Configuración por defecto para cada herramienta
export const DEFAULT_TOOL_CONFIGS: Record<AITool, Partial<ToolConfig>> = {
  notebook: {
    tool: 'notebook',
    enabled: true,
    provider: 'openai',
    model: 'gpt-4-turbo',
    temperature: 0.7,
    streamEnabled: true,
    notebookConfig: {
      useDocuments: true,
      useFiles: true,
      useNotes: true,
      maxContextDocuments: 10,
      citeSources: true,
      autoSaveResults: false
    },
    systemPrompt: `Eres un asistente especializado en gestión de expedientes y subvenciones. 
Tienes acceso a documentos, archivos y notas del expediente actual. 
Cuando respondas, cita las fuentes que uses. 
Sé preciso, profesional y útil.`
  },
  summary: {
    tool: 'summary',
    enabled: true,
    provider: 'openai',
    model: 'gpt-3.5-turbo',
    temperature: 0.3,
    systemPrompt: `Resume de forma estructurada toda la información del expediente/reunión.
Organiza por secciones: objetivos, estado actual, siguiente pasos, información clave.`
  },
  'missing-info': {
    tool: 'missing-info',
    enabled: true,
    provider: 'openai',
    model: 'gpt-3.5-turbo',
    temperature: 0.4,
    systemPrompt: `Analiza qué información o documentación importante falta en el expediente.
Lista específicamente qué documentos, datos o aclaraciones se necesitan para completarlo.`
  },
  checklist: {
    tool: 'checklist',
    enabled: true,
    provider: 'openai',
    model: 'gpt-3.5-turbo',
    temperature: 0.2,
    systemPrompt: `Genera un checklist detallado de todos los pasos y documentos necesarios.
Organiza por fases, incluye deadlines estimados cuando sea relevante.`
  },
  email: {
    tool: 'email',
    enabled: true,
    provider: 'anthropic',
    model: 'claude-3-sonnet',
    temperature: 0.5,
    systemPrompt: `Redacta emails profesionales basados en la información del expediente.
Mantén un tono formal pero cercano. Estructura clara con introducción, cuerpo y cierre.`
  },
  'deep-search': {
    tool: 'deep-search',
    enabled: true,
    provider: 'google',
    model: 'gemini-pro',
    temperature: 0.3,
    deepSearchConfig: {
      maxDepth: 3,
      includeExternal: false,
      externalSources: []
    },
    systemPrompt: `Realiza búsquedas profundas y exhaustivas sobre el tema solicitado.
Analiza múltiples fuentes, contrasta información y proporciona resumen completo.`
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
