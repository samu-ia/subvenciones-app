/**
 * Provider Factory
 * 
 * Factory para instanciar el proveedor de IA correcto según la configuración
 */

import { AIProvider } from '@/lib/types/ai-config';
import { BaseAIProvider, ProviderConfig } from './base';
import { OpenAIProvider } from './openai';
import { AnthropicProvider } from './anthropic';
import { GoogleProvider } from './google';

/**
 * Crea una instancia del proveedor correcto
 */
export function createProvider(config: ProviderConfig): BaseAIProvider {
  const providerConfig = {
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    organization: config.organization
  };

  switch (config.provider) {
    case 'openai':
      return new OpenAIProvider(providerConfig);
    
    case 'anthropic':
      return new AnthropicProvider(providerConfig);
    
    case 'google':
      return new GoogleProvider(providerConfig);
    
    case 'openrouter':
      // OpenRouter usa la misma API que OpenAI
      return new OpenAIProvider({
        ...providerConfig,
        baseUrl: config.baseUrl || 'https://openrouter.ai/api/v1'
      });
    
    case 'azure':
      // Azure OpenAI usa la misma interfaz con URL diferente
      if (!config.baseUrl) {
        throw new Error('Azure requiere baseUrl configurado');
      }
      return new OpenAIProvider(providerConfig);
    
    case 'custom':
      if (!config.baseUrl) {
        throw new Error('Proveedor custom requiere baseUrl configurado');
      }
      // Asumimos API compatible con OpenAI por defecto
      return new OpenAIProvider(providerConfig);
    
    default:
      throw new Error(`Proveedor no soportado: ${config.provider}`);
  }
}

/**
 * Verifica si un proveedor está disponible y configurado
 */
export function isProviderAvailable(provider: AIProvider, apiKey?: string): boolean {
  if (!apiKey) return false;
  
  try {
    const config: ProviderConfig = {
      provider,
      apiKey,
      enabled: true
    };
    const instance = createProvider(config);
    return instance.isConfigured();
  } catch {
    return false;
  }
}

/**
 * Obtiene el proveedor por defecto si ninguno está configurado
 */
export function getDefaultProvider(): AIProvider {
  return 'openai';
}

/**
 * Estima el costo total de una operación
 */
export function estimateOperationCost(
  provider: AIProvider,
  model: string,
  tokensUsed: number,
  config: ProviderConfig
): number {
  try {
    const instance = createProvider(config);
    return instance.estimateCost(tokensUsed, model);
  } catch {
    return 0;
  }
}
