/**
 * Anthropic Provider
 * 
 * Implementación del proveedor para Anthropic (Claude 3)
 */

import {
  BaseAIProvider,
  Message,
  CompletionOptions,
  CompletionResponse,
  StreamChunk
} from './base';
import { AIProvider } from '@/lib/types/ai-config';

export class AnthropicProvider extends BaseAIProvider {
  get providerName(): AIProvider {
    return 'anthropic';
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  getAvailableModels(): string[] {
    return [
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
      'claude-2.1',
      'claude-2.0'
    ];
  }

  async complete(
    messages: Message[],
    options: CompletionOptions
  ): Promise<CompletionResponse> {
    try {
      const url = this.baseUrl || 'https://api.anthropic.com/v1';
      
      // Anthropic requiere separar el system prompt
      const { systemPrompt, userMessages } = this.prepareMessages(messages, options.systemPrompt);

      const response = await fetch(`${url}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: options.model,
          system: systemPrompt,
          messages: userMessages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens || 4096,
          stream: false
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw { response: { status: response.status, data: error } };
      }

      const data = await response.json();

      return {
        content: data.content[0].text,
        model: data.model,
        provider: 'anthropic',
        tokensUsed: data.usage.input_tokens + data.usage.output_tokens,
        finishReason: data.stop_reason === 'end_turn' ? 'stop' : 'length'
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
      const url = this.baseUrl || 'https://api.anthropic.com/v1';
      const { systemPrompt, userMessages } = this.prepareMessages(messages, options.systemPrompt);

      const response = await fetch(`${url}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: options.model,
          system: systemPrompt,
          messages: userMessages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens || 4096,
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
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          try {
            const json = JSON.parse(trimmed.slice(6));
            
            if (json.type === 'content_block_delta' && json.delta?.text) {
              yield {
                content: json.delta.text,
                done: false
              };
            } else if (json.type === 'message_stop') {
              yield { content: '', done: true };
              return;
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
      'claude-3-opus-20240229': 0.0375,
      'claude-3-sonnet-20240229': 0.006,
      'claude-3-haiku-20240307': 0.0005,
      'claude-2.1': 0.012,
      'claude-2.0': 0.012
    };

    const pricePerK = prices[model] || 0.012;
    return (tokensUsed / 1000) * pricePerK;
  }

  /**
   * Anthropic requiere formato especial para mensajes
   */
  private prepareMessages(messages: Message[], systemPrompt?: string) {
    const systemMessages = messages.filter(m => m.role === 'system');
    const userMessages = messages.filter(m => m.role !== 'system');

    // Combinar todos los system prompts
    const allSystemPrompts = [
      systemPrompt,
      ...systemMessages.map(m => m.content)
    ].filter(Boolean).join('\n\n');

    // Convertir formato de mensajes
    const anthropicMessages = userMessages.map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    }));

    return {
      systemPrompt: allSystemPrompts || undefined,
      userMessages: anthropicMessages
    };
  }
}
