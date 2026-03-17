/**
 * Google AI Provider
 * 
 * Implementación del proveedor para Google (Gemini)
 */

import {
  BaseAIProvider,
  Message,
  CompletionOptions,
  CompletionResponse,
  StreamChunk
} from './base';
import { AIProvider } from '@/lib/types/ai-config';

export class GoogleProvider extends BaseAIProvider {
  get providerName(): AIProvider {
    return 'google';
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  getAvailableModels(): string[] {
    return [
      'gemini-1.5-pro-latest',
      'gemini-1.5-flash-latest',
      'gemini-pro',
      'gemini-pro-vision'
    ];
  }

  // Normaliza nombres de modelo: convierte display names y IDs antiguos a IDs correctos de la API
  private normalizeModel(model: string): string {
    const m = model.trim();
    const map: Record<string, string> = {
      // Display names que el usuario puede haber escrito
      'Gemini 2.5 Pro':        'gemini-2.5-pro-preview-03-25',
      'Gemini 2.0 Flash':      'gemini-2.0-flash',
      'Gemini 1.5 Pro':        'gemini-1.5-pro-latest',
      'Gemini 1.5 Flash':      'gemini-1.5-flash-latest',
      // IDs antiguos sin -latest
      'gemini-1.5-pro':        'gemini-1.5-pro-latest',
      'gemini-1.5-flash':      'gemini-1.5-flash-latest',
      'gemini-2.5-pro':        'gemini-2.5-pro-preview-03-25',
      // IDs obsoletos
      'gemini-pro':            'gemini-1.5-pro-latest',
      'gemini-pro-vision':     'gemini-1.5-pro-latest',
    };
    return map[m] ?? m;
  }

  async complete(
    messages: Message[],
    options: CompletionOptions
  ): Promise<CompletionResponse> {
    const model = this.normalizeModel(options.model || 'gemini-2.0-flash');
    try {
      const url = this.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
      const { contents, systemInstruction } = this.prepareMessages(messages, options.systemPrompt);

      const response = await fetch(
        `${url}/models/${model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents,
            systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
            generationConfig: {
              temperature: options.temperature ?? 0.7,
              maxOutputTokens: options.maxTokens,
              topK: 40,
              topP: 0.95
            },
            safetySettings: [
              { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
              { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
              { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
              { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }
            ]
          })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw { response: { status: response.status, data: error } };
      }

      const data = await response.json();

      if (!data.candidates || data.candidates.length === 0) {
        throw new Error('No se recibieron candidatos en la respuesta');
      }

      const candidate = data.candidates[0];
      const content = candidate.content.parts[0].text;

      // Estimar tokens (Gemini no devuelve uso de tokens directamente)
      const estimatedTokens = Math.ceil((content.length + messages.join(' ').length) / 4);

      return {
        content,
        model: options.model,
        provider: 'google',
        tokensUsed: estimatedTokens,
        finishReason: candidate.finishReason === 'STOP' ? 'stop' : 'length'
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
      const url = this.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
      const model = this.normalizeModel(options.model || 'gemini-2.0-flash');
      const { contents, systemInstruction } = this.prepareMessages(messages, options.systemPrompt);

      const response = await fetch(
        `${url}/models/${model}:streamGenerateContent?key=${this.apiKey}&alt=sse`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents,
            systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
            generationConfig: {
              temperature: options.temperature ?? 0.7,
              maxOutputTokens: options.maxTokens,
              topK: 40,
              topP: 0.95
            }
          })
        }
      );

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
            
            if (json.candidates && json.candidates[0]?.content?.parts?.[0]?.text) {
              const text = json.candidates[0].content.parts[0].text;
              yield {
                content: text,
                done: false
              };
            }

            if (json.candidates && json.candidates[0]?.finishReason) {
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
    // Precios aproximados por 1K tokens
    const prices: Record<string, number> = {
      'gemini-1.5-pro-latest': 0.0035,
      'gemini-1.5-flash-latest': 0.00035,
      'gemini-pro': 0.0005,
      'gemini-pro-vision': 0.00025
    };

    const pricePerK = prices[model] || 0.0005;
    return (tokensUsed / 1000) * pricePerK;
  }

  /**
   * Google requiere formato especial para mensajes
   */
  private prepareMessages(messages: Message[], systemPrompt?: string) {
    const systemMessages = messages.filter(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');

    // Combinar system prompts
    const allSystemPrompts = [
      systemPrompt,
      ...systemMessages.map(m => m.content)
    ].filter(Boolean).join('\n\n');

    // Convertir a formato Gemini
    const contents = conversationMessages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    return {
      contents,
      systemInstruction: allSystemPrompts || undefined
    };
  }
}
