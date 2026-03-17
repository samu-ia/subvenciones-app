/**
 * Database Functions - IA Tool Configs
 *
 * CRUD para configuración de herramientas de IA (notebook, summary, checklist, etc.)
 */

import { createClient } from '@/lib/supabase/server';
import {
  AITool,
  ToolConfig,
  DEFAULT_TOOL_CONFIGS,
} from '@/lib/types/ai-config';
import { AIProvider } from '@/lib/types/ai-config';

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
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export async function getToolConfig(
  userId: string,
  tool: AITool,
  workspaceType: 'expediente' | 'reunion' | 'global' = 'global'
): Promise<ToolConfigDB | null> {
  const supabase = await createClient();

  let { data, error } = await supabase
    .from('ia_tool_configs')
    .select('*')
    .eq('user_id', userId)
    .eq('tool', tool)
    .eq('workspace_type', workspaceType)
    .single();

  // Fallback a global si no hay config específica
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

  if (error) return null;
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
    config?: Record<string, unknown>;
  }
): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('ia_tool_configs')
    .upsert(
      {
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
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,workspace_type,tool' }
    );

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
      streamEnabled: existing.stream_enabled,
    };
  }

  // Devolver configuración por defecto sin guardar en DB
  const defaultConfig = DEFAULT_TOOL_CONFIGS[tool];
  return {
    tool: defaultConfig.tool!,
    enabled: defaultConfig.enabled!,
    provider: defaultConfig.provider!,
    model: defaultConfig.model!,
    systemPrompt: defaultConfig.systemPrompt,
    temperature: defaultConfig.temperature,
    maxTokens: defaultConfig.maxTokens,
    streamEnabled: defaultConfig.streamEnabled,
  };
}
