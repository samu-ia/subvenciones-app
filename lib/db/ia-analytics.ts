/**
 * Database Functions - IA Analytics
 *
 * Log de ejecuciones de herramientas IA y estadísticas de uso.
 */

import { createClient } from '@/lib/supabase/server';
import { AITool } from '@/lib/types/ai-config';
import { AIProvider } from '@/lib/types/ai-config';

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
  metadata?: Record<string, unknown>;
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
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.from('ia_tool_executions').insert({
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
    metadata: execution.metadata,
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

  if (tool) query = query.eq('tool', tool);
  if (workspaceId) query = query.eq('workspace_id', workspaceId);

  const { data, error } = await query;

  if (error || !data || data.length === 0) {
    return { totalExecutions: 0, successRate: 0, averageTokens: 0, averageExecutionTime: 0, totalCost: 0 };
  }

  const total = data.length;
  const successful = data.filter(e => e.success).length;
  const totalTokens = data.reduce((sum, e) => sum + (e.tokens_used ?? 0), 0);

  return {
    totalExecutions: total,
    successRate: (successful / total) * 100,
    averageTokens: totalTokens / total,
    averageExecutionTime: data.reduce((sum, e) => sum + (e.execution_time_ms ?? 0), 0) / total,
    totalCost: (totalTokens / 1000) * 0.002, // ~$0.002 por 1K tokens como estimación
  };
}
