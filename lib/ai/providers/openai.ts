/**
 * OpenAI Provider
 * 
 * Implementación del proveedor para OpenAI (GPT-4, GPT-3.5)
 */

import {
  BaseAIProvider,
  Message,
  CompletionOptions,
  CompletionResponse,
  StreamChunk
} from './base';
import { AIProvider } from '@/lib/types/ai-config';

export class OpenAIProvider extends BaseAIProvider {
  get providerName(): AIProvider {
    return 'openai';
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  getAvailableModels(): string[] {
    return [
      'gpt-4-turbo-preview',
      'gpt-4',
      'gpt-4-32k',
      'gpt-3.5-turbo',
      'gpt-3.5-turbo-16k'
    ];
  }

  async complete(
    messages: Message[],
    options: CompletionOptions
  ): Promise<CompletionResponse> {
    try {
      const url = this.baseUrl || 'https://api.openai.com/v1';
      const fullMessages = this.buildMessages(messages, options.systemPrompt);

      const response = await fetch(`${url}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          ...(this.organization && { 'OpenAI-Organization': this.organization })
        },
        body: JSON.stringify({
          model: options.model,
          messages: fullMessages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens,
          stream: false
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw { response: { status: response.status, data: error } };
      }

      const data = await response.json();

      return {
        content: data.choices[0].message.content,
        model: data.model,
        provider: 'openai',
        tokensUsed: data.usage.total_tokens,
        finishReason: data.choices[0].finish_reason
      };

    } catch (error) {
      return this.handleAPIError(error);
    }
  }

  async *streamComplete(
    messages: Message[],
    options: CompletionOptions
  ): AsyncGenerator<StreamChunk, void, unknown> {
    try {
      const url = this.baseUrl || 'https://api.openai.com/v1';
      const fullMessages = this.buildMessages(messages, options.systemPrompt);

      const response = await fetch(`${url}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          ...(this.organization && { 'OpenAI-Organization': this.organization })
        },
        body: JSON.stringify({
          model: options.model,
          messages: fullMessages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens,
          stream: true
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw { response: { status: response.status, data: error } };
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No se pudo obtener el reader del stream');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (!trimmed.startsWith('data: ')) continue;

          try {
            const json = JSON.parse(trimmed.slice(6));
            const delta = json.choices[0]?.delta?.content;
            
            if (delta) {
              yield {
                content: delta,
                done: false
              };
            }
          } catch (e) {
            console.error('Error parsing SSE:', e);
          }
        }
      }

      yield { content: '', done: true };

    } catch (error) {
      this.handleAPIError(error);
    }
  }

  estimateCost(tokensUsed: number, model: string): number {
    // Precios aproximados por 1K tokens (input + output promediado)
    const prices: Record<string, number> = {
      'gpt-4-turbo-preview': 0.015,
      'gpt-4': 0.045,
      'gpt-4-32k': 0.09,
      'gpt-3.5-turbo': 0.0015,
      'gpt-3.5-turbo-16k': 0.003
    };

    const pricePerK = prices[model] || 0.015;
    return (tokensUsed / 1000) * pricePerK;
  }
}
