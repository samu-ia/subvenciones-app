/**
 * Database Functions - IA Configuration
 * 
 * Funciones CRUD para configuración de IA (proveedores y herramientas)
 */

import { createClient } from '@/lib/supabase/server';
import {
  AIProvider,
  AITool,
  ToolConfig,
  ProviderConfig as TypeProviderConfig,
  DEFAULT_TOOL_CONFIGS
} from '@/lib/types/ai-config';

/**
 * Provider Configuration
 */

export interface ProviderConfigDB {
  user_id: string;
  provider: AIProvider;
  api_key: string;
  base_url?: string;
  organization?: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export async function getProviderConfig(
  userId: string,
  provider: AIProvider
): Promise<ProviderConfigDB | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('ia_providers')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', provider)
    .single();

  if (error) {
    console.error('Error obteniendo config de proveedor:', error);
    return null;
  }

  return data;
}

export async function getAllProviderConfigs(
  userId: string
): Promise<ProviderConfigDB[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('ia_providers')
    .select('*')
    .eq('user_id', userId)
    .order('provider');

  if (error) {
    console.error('Error obteniendo configs de proveedores:', error);
    return [];
  }

  return data || [];
}

export async function saveProviderConfig(
  userId: string,
  config: {
    provider: AIProvider;
    apiKey: string;
    baseUrl?: string;
    organization?: string;
    enabled: boolean;
  }
): Promise<boolean> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('ia_providers')
    .upsert({
      user_id: userId,
      provider: config.provider,
      api_key: config.apiKey,
      base_url: config.baseUrl,
      organization: config.organization,
      enabled: config.enabled,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id,provider'
    });

  if (error) {
    console.error('Error guardando config de proveedor:', error);
    return false;
  }

  return true;
}

export async function deleteProviderConfig(
  userId: string,
  provider: AIProvider
): Promise<boolean> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('ia_providers')
    .delete()
    .eq('user_id', userId)
    .eq('provider', provider);

  if (error) {
    console.error('Error eliminando config de proveedor:', error);
    return false;
  }

  return true;
}

/**
 * Tool Configuration
 */

export interface ToolConfigDB {
  user_id: string;
  workspace_type: 'expediente' | 'reunion' | 'global';
  tool: AITool;
  enabled: boolean;
  provider: AIProvider;
  model: string;
  system_prompt: string;
  temperature: number;
  max_tokens: number;
  stream_enabled: boolean;
  config: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export async function getToolConfig(
  userId: string,
  tool: AITool,
  workspaceType: 'expediente' | 'reunion' | 'global' = 'global'
): Promise<ToolConfigDB | null> {
  const supabase = await createClient();

  // Intentar obtener config específica del workspace
  let { data, error } = await supabase
    .from('ia_tool_configs')
    .select('*')
    .eq('user_id', userId)
    .eq('tool', tool)
    .eq('workspace_type', workspaceType)
    .single();

  // Si no existe config específica, intentar obtener global
  if (error && workspaceType !== 'global') {
    const globalResult = await supabase
      .from('ia_tool_configs')
      .select('*')
      .eq('user_id', userId)
      .eq('tool', tool)
      .eq('workspace_type', 'global')
      .single();

    data = globalResult.data;
    error = globalResult.error;
  }

  if (error) {
    console.error('Error obteniendo config de herramienta:', error);
    return null;
  }

  return data;
}

export async function getAllToolConfigs(
  userId: string,
  workspaceType: 'expediente' | 'reunion' | 'global' = 'global'
): Promise<ToolConfigDB[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('ia_tool_configs')
    .select('*')
    .eq('user_id', userId)
    .eq('workspace_type', workspaceType)
    .order('tool');

  if (error) {
    console.error('Error obteniendo configs de herramientas:', error);
    return [];
  }

  return data || [];
}

export async function saveToolConfig(
  userId: string,
  config: {
    tool: AITool;
    workspaceType: 'expediente' | 'reunion' | 'global';
    enabled: boolean;
    provider: AIProvider;
    model: string;
    systemPrompt: string;
    temperature: number;
    maxTokens: number;
    streamEnabled: boolean;
    config?: Record<string, any>;
  }
): Promise<boolean> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('ia_tool_configs')
    .upsert({
      user_id: userId,
      workspace_type: config.workspaceType,
      tool: config.tool,
      enabled: config.enabled,
      provider: config.provider,
      model: config.model,
      system_prompt: config.systemPrompt,
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      stream_enabled: config.streamEnabled,
      config: config.config || {},
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id,workspace_type,tool'
    });

  if (error) {
    console.error('Error guardando config de herramienta:', error);
    return false;
  }

  return true;
}

export async function getOrCreateToolConfig(
  userId: string,
  tool: AITool,
  workspaceType: 'expediente' | 'reunion' | 'global' = 'global'
): Promise<ToolConfig> {
  // Intentar obtener config existente
  const existing = await getToolConfig(userId, tool, workspaceType);
  
  if (existing) {
    return {
      tool: existing.tool,
      enabled: existing.enabled,
      provider: existing.provider,
      model: existing.model,
      systemPrompt: existing.system_prompt,
      temperature: existing.temperature,
      maxTokens: existing.max_tokens,
      streamEnabled: existing.stream_enabled
    };
  }

  // Si no existe, devolver configuración por defecto
  const defaultConfig = DEFAULT_TOOL_CONFIGS[tool];
  return {
    tool: defaultConfig.tool!,
    enabled: defaultConfig.enabled!,
    provider: defaultConfig.provider!,
    model: defaultConfig.model!,
    systemPrompt: defaultConfig.systemPrompt,
    temperature: defaultConfig.temperature,
    maxTokens: defaultConfig.maxTokens,
    streamEnabled: defaultConfig.streamEnabled
  };
}

/**
 * Tool Execution Analytics
 */

export interface ToolExecutionDB {
  user_id: string;
  workspace_id: string;
  workspace_type: 'expediente' | 'reunion';
  tool: AITool;
  provider: AIProvider;
  model: string;
  input_text: string;
  output_text: string;
  success: boolean;
  error_message?: string;
  tokens_used: number;
  execution_time_ms: number;
  sources_used?: Array<{ type: string; id: string; name: string }>;
  metadata?: Record<string, any>;
  created_at: string;
}

export async function logToolExecution(execution: {
  userId: string;
  workspaceId: string;
  workspaceType: 'expediente' | 'reunion';
  tool: AITool;
  provider: AIProvider;
  model: string;
  inputText: string;
  outputText: string;
  success: boolean;
  errorMessage?: string;
  tokensUsed: number;
  executionTimeMs: number;
  sourcesUsed?: Array<{ type: string; id: string; name: string }>;
  metadata?: Record<string, any>;
}): Promise<boolean> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('ia_tool_executions')
    .insert({
      user_id: execution.userId,
      workspace_id: execution.workspaceId,
      workspace_type: execution.workspaceType,
      tool: execution.tool,
      provider: execution.provider,
      model: execution.model,
      input_text: execution.inputText,
      output_text: execution.outputText,
      success: execution.success,
      error_message: execution.errorMessage,
      tokens_used: execution.tokensUsed,
      execution_time_ms: execution.executionTimeMs,
      sources_used: execution.sourcesUsed,
      metadata: execution.metadata
    });

  if (error) {
    console.error('Error logging tool execution:', error);
    return false;
  }

  return true;
}

export async function getToolExecutionStats(
  userId: string,
  tool?: AITool,
  workspaceId?: string
): Promise<{
  totalExecutions: number;
  successRate: number;
  averageTokens: number;
  averageExecutionTime: number;
  totalCost: number;
}> {
  const supabase = await createClient();

  let query = supabase
    .from('ia_tool_executions')
    .select('*')
    .eq('user_id', userId);

  if (tool) {
    query = query.eq('tool', tool);
  }

  if (workspaceId) {
    query = query.eq('workspace_id', workspaceId);
  }

  const { data, error } = await query;

  if (error || !data || data.length === 0) {
    return {
      totalExecutions: 0,
      successRate: 0,
      averageTokens: 0,
      averageExecutionTime: 0,
      totalCost: 0
    };
  }

  const totalExecutions = data.length;
  const successfulExecutions = data.filter(e => e.success).length;
  const successRate = (successfulExecutions / totalExecutions) * 100;
  const averageTokens = data.reduce((sum, e) => sum + e.tokens_used, 0) / totalExecutions;
  const averageExecutionTime = data.reduce((sum, e) => sum + e.execution_time_ms, 0) / totalExecutions;
  
  // Estimar costo aproximado ($0.002 por 1K tokens como promedio)
  const totalTokens = data.reduce((sum, e) => sum + e.tokens_used, 0);
  const totalCost = (totalTokens / 1000) * 0.002;

  return {
    totalExecutions,
    successRate,
    averageTokens,
    averageExecutionTime,
    totalCost
  };
}
