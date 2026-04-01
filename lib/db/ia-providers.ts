/**
 * Database Functions - IA Providers
 *
 * CRUD para configuración de proveedores de IA (OpenAI, Anthropic, Google, etc.)
 */

import { createClient } from '@/lib/supabase/server';
import { AIProvider } from '@/lib/types/ai-config';

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

// Mapa de proveedores a variables de entorno (fallback cuando no hay config en BD)
const ENV_KEY_MAP: Partial<Record<AIProvider, string>> = {
  anthropic: process.env.ANTHROPIC_API_KEY,
  google:    process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
  openai:    process.env.OPENAI_API_KEY,
  openrouter: process.env.OPENROUTER_API_KEY,
};

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
    .maybeSingle();

  // Si hay config en BD con API key → usarla
  if (!error && data?.api_key) return data;

  // Fallback a variables de entorno del servidor
  const envKey = ENV_KEY_MAP[provider];
  if (envKey) {
    return {
      user_id: userId,
      provider,
      api_key: envKey,
      enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as ProviderConfigDB;
  }

  if (error) console.error('Error obteniendo config de proveedor:', error);
  return data ?? null;
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
    apiKey?: string;
    baseUrl?: string;
    organization?: string;
    enabled: boolean;
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // Si no se proporciona apiKey, solo actualizar metadata sin sobrescribir la key
  if (!config.apiKey) {
    const { data: existing } = await supabase
      .from('ia_providers')
      .select('id')
      .eq('user_id', userId)
      .eq('provider', config.provider)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('ia_providers')
        .update({
          base_url: config.baseUrl,
          organization: config.organization,
          enabled: config.enabled,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('provider', config.provider);
      if (error) return { success: false, error: error.message };
    }
    return { success: true };
  }

  console.log('[saveProviderConfig] saving provider:', config.provider, 'for user:', userId);

  const { data: existing } = await supabase
    .from('ia_providers')
    .select('id')
    .eq('user_id', userId)
    .eq('provider', config.provider)
    .maybeSingle();

  let error;
  if (existing) {
    const result = await supabase
      .from('ia_providers')
      .update({
        api_key: config.apiKey,
        base_url: config.baseUrl,
        organization: config.organization,
        enabled: config.enabled,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('provider', config.provider);
    error = result.error;
  } else {
    const result = await supabase
      .from('ia_providers')
      .insert({
        user_id: userId,
        provider: config.provider,
        api_key: config.apiKey,
        base_url: config.baseUrl,
        organization: config.organization,
        enabled: config.enabled,
      });
    error = result.error;
  }

  if (error) {
    console.error('[saveProviderConfig] error:', JSON.stringify(error));
    return { success: false, error: error.message };
  }

  console.log('[saveProviderConfig] OK for provider:', config.provider);
  return { success: true };
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
