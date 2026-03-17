import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAllProviderConfigs, saveProviderConfig, deleteProviderConfig } from '@/lib/db/ia-config';
import type { AIProvider } from '@/lib/types/ai-config';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const configs = await getAllProviderConfigs(user.id);
  
  // Enmascarar las API keys para el cliente
  const safeConfigs = configs.map(c => ({
    ...c,
    api_key: c.api_key ? `${c.api_key.slice(0, 4)}...${c.api_key.slice(-4)}` : '',
    has_key: !!c.api_key,
  }));

  return NextResponse.json({ providers: safeConfigs });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { provider, apiKey, baseUrl, organization, enabled } = body;

  if (!provider) {
    return NextResponse.json({ error: 'provider is required' }, { status: 400 });
  }

  const success = await saveProviderConfig(user.id, {
    provider: provider as AIProvider,
    apiKey: apiKey || undefined,   // undefined = no sobrescribir key existente
    baseUrl,
    organization,
    enabled: enabled ?? true,
  });

  if (!success) {
    return NextResponse.json({ error: 'Error saving provider config' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const provider = searchParams.get('provider') as AIProvider;
  if (!provider) return NextResponse.json({ error: 'provider is required' }, { status: 400 });

  const success = await deleteProviderConfig(user.id, provider);
  if (!success) return NextResponse.json({ error: 'Error deleting' }, { status: 500 });

  return NextResponse.json({ ok: true });
}
