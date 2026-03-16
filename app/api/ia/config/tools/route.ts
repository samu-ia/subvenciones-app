import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAllToolConfigs, saveToolConfig } from '@/lib/db/ia-config';
import { DEFAULT_TOOL_CONFIGS } from '@/lib/types/ai-config';
import type { AITool, AIProvider } from '@/lib/types/ai-config';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const workspaceType = (searchParams.get('workspaceType') || 'global') as 'expediente' | 'reunion' | 'global';

  const dbConfigs = await getAllToolConfigs(user.id, workspaceType);

  // Combinar con defaults para herramientas sin config
  const tools: AITool[] = ['notebook', 'summary', 'missing-info', 'checklist', 'email', 'deep-search'];
  const configs = tools.map(tool => {
    const dbConfig = dbConfigs.find(c => c.tool === tool);
    if (dbConfig) return dbConfig;
    const def = DEFAULT_TOOL_CONFIGS[tool];
    return {
      user_id: user.id,
      workspace_type: workspaceType,
      tool,
      enabled: def.enabled ?? true,
      provider: def.provider ?? 'openai',
      model: def.model ?? 'gpt-4-turbo',
      system_prompt: def.systemPrompt ?? '',
      temperature: def.temperature ?? 0.7,
      max_tokens: def.maxTokens ?? 2000,
      stream_enabled: def.streamEnabled ?? true,
      config: {},
      created_at: '',
      updated_at: '',
    };
  });

  return NextResponse.json({ tools: configs });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { tool, workspaceType, enabled, provider, model, systemPrompt, temperature, maxTokens, streamEnabled, config } = body;

  if (!tool || !workspaceType) {
    return NextResponse.json({ error: 'tool and workspaceType are required' }, { status: 400 });
  }

  const success = await saveToolConfig(user.id, {
    tool: tool as AITool,
    workspaceType: workspaceType as 'expediente' | 'reunion' | 'global',
    enabled: enabled ?? true,
    provider: provider as AIProvider,
    model,
    systemPrompt,
    temperature: temperature ?? 0.7,
    maxTokens: maxTokens ?? 2000,
    streamEnabled: streamEnabled ?? true,
    config,
  });

  if (!success) {
    return NextResponse.json({ error: 'Error saving tool config' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
