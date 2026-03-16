import { NextRequest, NextResponse } from 'next/server';
import { AITool } from '@/lib/types/ai-config';
import { getOrCreateToolConfig } from '@/lib/db/ia-config';
import { getProviderConfig, logToolExecution } from '@/lib/db/ia-config';
import { createProvider } from '@/lib/ai/providers/factory';
import { Message } from '@/lib/ai/providers/base';
import { createClient } from '@/lib/supabase/server';

/**
 * API Endpoint: Herramientas de IA
 * 
 * Este endpoint ejecuta herramientas especializadas de IA:
 * - summary: Resumen del expediente
 * - missing-info: Información faltante
 * - checklist: Lista de tareas
 * - email: Generación de emails
 * - deep-search: Búsqueda profunda
 */

interface ToolRequest {
  tool: AITool;
  input?: string;
  context: string;
  contextoId: string;
  contextoTipo: 'expediente' | 'reunion';
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body: ToolRequest = await request.json();
    const { tool, input, context, contextoId, contextoTipo } = body;

    if (!['summary', 'missing-info', 'checklist', 'email', 'deep-search'].includes(tool)) {
      return NextResponse.json(
        { error: 'Herramienta no válida' },
        { status: 400 }
      );
    }

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

    // Obtener configuración de la herramienta
    const toolConfig = await getOrCreateToolConfig(userId, tool, contextoTipo);

    if (!toolConfig.enabled) {
      return NextResponse.json(
        { error: `La herramienta ${tool} está deshabilitada` },
        { status: 403 }
      );
    }

    // Obtener configuración del proveedor
    const providerConfig = await getProviderConfig(userId, toolConfig.provider);

    if (!providerConfig || !providerConfig.enabled) {
      return NextResponse.json(
        { error: `El proveedor ${toolConfig.provider} no está configurado` },
        { status: 400 }
      );
    }

    // Construir system prompt con contexto
    const systemPrompt = toolConfig.systemPrompt + (context ? `\n\nCONTEXTO:\n${context}` : '');

    // Construir mensaje del usuario
    const userMessage = input || `Ejecuta la herramienta ${tool} con el contexto proporcionado.`;

    const messages: Message[] = [
      { role: 'user', content: userMessage }
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
      tool,
      provider: response.provider,
      model: response.model,
      inputText: userMessage,
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
        tool,
        model: response.model,
        provider: response.provider,
        tokensUsed: response.tokensUsed,
        executionTime
      }
    });

  } catch (error) {
    console.error('Error en /api/ia/tool:', error);
    
    const executionTime = Date.now() - startTime;
    
    // Log error de ejecución
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      await logToolExecution({
        userId: user?.id || 'unknown',
        workspaceId: 'unknown',
        workspaceType: 'expediente',
        tool: 'summary',
        provider: 'openai',
        model: 'unknown',
        inputText: '',
        outputText: '',
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Error desconocido',
        tokensUsed: 0,
        executionTimeMs: executionTime
      });
    } catch (logError) {
      console.error('Error logging failed execution:', logError);
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error ejecutando la herramienta' },
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

