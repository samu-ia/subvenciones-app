/**
 * Base Provider Interface
 * 
 * Interfaz unificada para todos los proveedores de IA (OpenAI, Anthropic, Google, etc.)
 * Permite cambiar de proveedor sin modificar el código que usa la IA
 */

import { AIProvider } from '@/lib/types/ai-config';

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompletionOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  systemPrompt?: string;
}

export interface CompletionResponse {
  content: string;
  model: string;
  provider: AIProvider;
  tokensUsed: number;
  finishReason?: 'stop' | 'length' | 'error';
}

export interface StreamChunk {
  content: string;
  done: boolean;
}

/**
 * Interfaz base que todos los proveedores deben implementar
 */
export abstract class BaseAIProvider {
  protected apiKey: string;
  protected baseUrl?: string;
  protected organization?: string;

  constructor(config: { apiKey: string; baseUrl?: string; organization?: string }) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl;
    this.organization = config.organization;
  }

  /**
   * Nombre del proveedor
   */
  abstract get providerName(): AIProvider;

  /**
   * Verifica si el proveedor está correctamente configurado
   */
  abstract isConfigured(): boolean;

  /**
   * Obtiene los modelos disponibles para este proveedor
   */
  abstract getAvailableModels(): string[];

  /**
   * Genera una completion estándar
   */
  abstract complete(
    messages: Message[],
    options: CompletionOptions
  ): Promise<CompletionResponse>;

  /**
   * Genera una completion con streaming
   */
  abstract streamComplete(
    messages: Message[],
    options: CompletionOptions
  ): AsyncGenerator<StreamChunk, void, unknown>;

  /**
   * Estima el costo de una llamada
   */
  abstract estimateCost(tokensUsed: number, model: string): number;

  /**
   * Construye los mensajes incluyendo el system prompt si existe
   */
  protected buildMessages(messages: Message[], systemPrompt?: string): Message[] {
    const result: Message[] = [];
    
    if (systemPrompt) {
      result.push({ role: 'system', content: systemPrompt });
    }

    result.push(...messages);
    return result;
  }

  /**
   * Maneja errores comunes de APIs
   */
  protected handleAPIError(error: { response?: { status?: number; data?: { error?: { message?: string } } }; message?: string }): never {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.error?.message || 'Error desconocido';

      if (status === 401) {
        throw new Error(`API Key inválida para ${this.providerName}`);
      } else if (status === 429) {
        throw new Error(`Límite de rate excedido en ${this.providerName}`);
      } else if (status === 500) {
        throw new Error(`Error del servidor de ${this.providerName}`);
      } else {
        throw new Error(`Error de ${this.providerName}: ${message}`);
      }
    }

    throw new Error(`Error conectando con ${this.providerName}: ${error.message}`);
  }
}

/**
 * Configuración de proveedor desde la base de datos
 */
export interface ProviderConfig {
  provider: AIProvider;
  apiKey: string;
  baseUrl?: string;
  organization?: string;
  enabled: boolean;
}
