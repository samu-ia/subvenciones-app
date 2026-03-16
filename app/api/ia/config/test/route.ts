import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getProviderConfig } from '@/lib/db/ia-config';
import type { AIProvider } from '@/lib/types/ai-config';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { provider, apiKey } = await req.json();
  if (!provider) return NextResponse.json({ error: 'provider is required' }, { status: 400 });

  // Usar la apiKey del body si se está probando antes de guardar,
  // o la key guardada en DB si no se pasa una nueva
  let keyToTest = apiKey;
  if (!keyToTest) {
    const config = await getProviderConfig(user.id, provider as AIProvider);
    keyToTest = config?.api_key;
  }

  if (!keyToTest) {
    return NextResponse.json({ ok: false, error: 'No API key available to test' });
  }

  try {
    switch (provider as AIProvider) {
      case 'openai': {
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${keyToTest}` },
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) return NextResponse.json({ ok: true, message: 'Conexión exitosa con OpenAI' });
        const err = await res.json().catch(() => ({}));
        return NextResponse.json({ ok: false, error: err.error?.message || `HTTP ${res.status}` });
      }

      case 'anthropic': {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': keyToTest,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 5,
            messages: [{ role: 'user', content: 'hi' }],
          }),
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok || res.status === 200) return NextResponse.json({ ok: true, message: 'Conexión exitosa con Anthropic' });
        const err = await res.json().catch(() => ({}));
        return NextResponse.json({ ok: false, error: err.error?.message || `HTTP ${res.status}` });
      }

      case 'google': {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1/models?key=${keyToTest}`,
          { signal: AbortSignal.timeout(8000) }
        );
        if (res.ok) return NextResponse.json({ ok: true, message: 'Conexión exitosa con Google AI' });
        const err = await res.json().catch(() => ({}));
        return NextResponse.json({ ok: false, error: err.error?.message || `HTTP ${res.status}` });
      }

      case 'openrouter': {
        const res = await fetch('https://openrouter.ai/api/v1/models', {
          headers: { Authorization: `Bearer ${keyToTest}` },
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) return NextResponse.json({ ok: true, message: 'Conexión exitosa con OpenRouter' });
        return NextResponse.json({ ok: false, error: `HTTP ${res.status}` });
      }

      default:
        return NextResponse.json({ ok: false, error: 'Test no disponible para este proveedor' });
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message || 'Timeout o error de red' });
  }
}
