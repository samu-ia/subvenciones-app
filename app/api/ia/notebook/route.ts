import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateToolConfig } from '@/lib/db/ia-config';
import { getProviderConfig, logToolExecution } from '@/lib/db/ia-config';
import { createProvider } from '@/lib/ai/providers/factory';
import { Message } from '@/lib/ai/providers/base';
import { createClient } from '@/lib/supabase/server';

/**
 * API Endpoint: Notebook Contextual
 * 
 * Este endpoint maneja las conversaciones del notebook principal.
 * Implementa RAG (Retrieval Augmented Generation) usando el contexto
 * de documentos seleccionados.
 */

interface NotebookRequest {
  message: string;
  context: string;
  contextoId: string;
  contextoTipo: 'expediente' | 'reunion';
  history: Array<{ role: string; content: string }>;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body: NotebookRequest = await request.json();
    const { message, context, contextoId, contextoTipo, history } = body;

    // Obtener userId de la sesión
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Usuario no autenticado' },
        { status: 401 }
      );
    }
    
    const userId = user.id;

    // Obtener configuración de la herramienta notebook
    const toolConfig = await getOrCreateToolConfig(userId, 'notebook', contextoTipo);

    if (!toolConfig.enabled) {
      return NextResponse.json(
        { error: 'La herramienta notebook está deshabilitada', error_code: 'tool_disabled' },
        { status: 403 }
      );
    }

    // Obtener configuración del proveedor
    const providerConfig = await getProviderConfig(userId, toolConfig.provider);

    if (!providerConfig || !providerConfig.enabled) {
      return NextResponse.json(
        { error: `No hay API key configurada para ${toolConfig.provider}. Ve a Ajustes para añadirla.`, error_code: 'no_provider', provider: toolConfig.provider },
        { status: 400 }
      );
    }

    if (!providerConfig.api_key) {
      return NextResponse.json(
        { error: `La API key de ${toolConfig.provider} está vacía. Ve a Ajustes para configurarla.`, error_code: 'no_api_key', provider: toolConfig.provider },
        { status: 400 }
      );
    }

    // Construir system prompt con contexto
    const systemPrompt = toolConfig.systemPrompt + (context ? `\n\nCONTEXTO DE DOCUMENTOS:\n${context}` : '');

    // Construir mensajes
    const messages: Message[] = [
      ...history.slice(-5).map(h => ({ 
        role: h.role as 'user' | 'assistant', 
        content: h.content 
      })),
      { role: 'user', content: message }
    ];

    // Crear instancia del proveedor y llamar
    const provider = createProvider({
      provider: toolConfig.provider,
      apiKey: providerConfig.api_key,
      baseUrl: providerConfig.base_url,
      organization: providerConfig.organization,
      enabled: true
    });

    const response = await provider.complete(messages, {
      model: toolConfig.model,
      temperature: toolConfig.temperature,
      maxTokens: toolConfig.maxTokens,
      systemPrompt
    });

    const executionTime = Date.now() - startTime;

    // Extraer fuentes del contexto
    const sources = extractSources(context);

    // Log de ejecución para analytics
    await logToolExecution({
      userId,
      workspaceId: contextoId,
      workspaceType: contextoTipo,
      tool: 'notebook',
      provider: response.provider,
      model: response.model,
      inputText: message,
      outputText: response.content,
      success: true,
      tokensUsed: response.tokensUsed,
      executionTimeMs: executionTime,
      sourcesUsed: sources
    });

    return NextResponse.json({
      response: response.content,
      sources,
      metadata: {
        model: response.model,
        provider: response.provider,
        tokensUsed: response.tokensUsed
      }
    });

  } catch (error) {
    console.error('Error en /api/ia/notebook:', error);
    const executionTime = Date.now() - startTime;

    // Extraer mensaje de error real del proveedor si está disponible
    let errorMessage = 'Error procesando el mensaje';
    let errorCode = 'unknown';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    // Errores de API externa con formato { response: { status, data } }
    const anyErr = error as { response?: { data?: { error?: { message?: string; code?: string } } } };
    if (anyErr?.response?.data?.error?.message) {
      errorMessage = anyErr.response.data.error.message;
      errorCode = anyErr.response.data.error.code || 'api_error';
    } else if (anyErr?.response?.status === 401) {
      errorMessage = 'API key inválida o sin permisos. Revisa los Ajustes.';
      errorCode = 'invalid_api_key';
    } else if (anyErr?.response?.status === 429) {
      errorMessage = 'Límite de peticiones alcanzado. Espera un momento o revisa tu plan.';
      errorCode = 'rate_limit';
    } else if (anyErr?.response?.status === 402) {
      errorMessage = 'Sin crédito en la cuenta del proveedor. Revisa tu saldo.';
      errorCode = 'insufficient_quota';
    }

    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      await logToolExecution({
        userId: user?.id || 'unknown',
        workspaceId: 'unknown',
        workspaceType: 'expediente',
        tool: 'notebook',
        provider: 'openai',
        model: 'unknown',
        inputText: '',
        outputText: '',
        success: false,
        errorMessage,
        tokensUsed: 0,
        executionTimeMs: executionTime
      });
    } catch (logError) {
      console.error('Error logging failed execution:', logError);
    }

    return NextResponse.json(
      { error: errorMessage, error_code: errorCode },
      { status: 500 }
    );
  }
}

/**
 * Extrae fuentes de documentos del contexto
 */
function extractSources(context: string): Array<{ type: string; id: string; name: string }> {
  const documentMatches = context.match(/\[Documento: ([^\]]+)\]/g);
  if (!documentMatches) return [];

  return documentMatches.map((match, i) => ({
    type: 'document',
    id: `doc-${i + 1}`,
    name: match.replace(/\[Documento: |\]/g, '')
  }));
}

