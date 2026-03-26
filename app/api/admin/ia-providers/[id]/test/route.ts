import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { createProvider } from '@/lib/ai/providers/factory';
import { requireRole } from '@/lib/auth/helpers';

const CHEAP_MODELS: Record<string, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-haiku-20240307',
  google: 'gemini-2.0-flash',
  openrouter: 'openai/gpt-4o-mini',
};

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole('admin');
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const sb = createServiceClient();

  const { data: row } = await sb
    .from('ia_providers')
    .select('provider, api_key, base_url, enabled')
    .eq('id', id)
    .maybeSingle();

  if (!row?.api_key) return NextResponse.json({ error: 'Sin API key configurada' }, { status: 400 });

  try {
    const provider = createProvider({
      provider: row.provider,
      apiKey: row.api_key,
      baseUrl: row.base_url ?? undefined,
      enabled: true,
    });
    const model = CHEAP_MODELS[row.provider] ?? 'gpt-4o-mini';
    const res = await provider.complete(
      [{ role: 'user', content: 'Di solo: ok' }],
      { model, temperature: 0, maxTokens: 5, stream: false }
    );
    return NextResponse.json({ ok: true, response: res.content });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
