/**
 * generate-titulos-gemini.mjs
 *
 * Genera titulo_comercial para subvenciones sin título usando Gemini Flash.
 * Alternativa a generate-titulos-comerciales.mjs (que usa Claude Haiku).
 *
 * Uso: node scripts/generate-titulos-gemini.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envFile = readFileSync('.env.local', 'utf-8');
const env = Object.fromEntries(
  envFile.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const MODELO = 'gemini-2.5-flash';
const BATCH = 15; // subvenciones por llamada a Gemini
const _WORKERS = 3;

async function getGeminiKey() {
  if (env.GEMINI_API_KEY) return env.GEMINI_API_KEY;
  const { data } = await sb.from('ia_providers').select('api_key').eq('provider','google').eq('enabled',true).maybeSingle();
  if (data?.api_key) return data.api_key;
  throw new Error('No hay GEMINI_API_KEY');
}

async function generarTitulosBatch(subvenciones, apiKey) {
  const lista = subvenciones.map((s, i) =>
    `${i+1}. [${s.bdns_id}] "${s.titulo?.slice(0,120)}" | Org: ${s.organismo ?? '-'} | ${s.importe_maximo ? s.importe_maximo+'€ máx' : ''}`
  ).join('\n');

  const prompt = `Convierte estos ${subvenciones.length} nombres de subvenciones públicas españolas en títulos comerciales atractivos para PYMEs.

REGLAS:
- Máximo 8 palabras por título
- Tono positivo y directo: "Financia X", "Ayuda para Y", "Hasta Nk€ para Z"
- NO uses jerga burocrática ni siglas desconocidas
- Menciona el beneficio principal o el importe si es relevante
- En español

SUBVENCIONES:
${lista}

Responde SOLO con JSON válido: {"titulos": ["título1", "título2", ...]} en el mismo orden.`;

  const res = await fetch(`${GEMINI_BASE}/models/${MODELO}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  // Find the JSON object — works whether it's wrapped in fences or not
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON found in: ' + raw.slice(0, 100));
  const parsed = JSON.parse(raw.slice(start, end + 1));
  return parsed.titulos ?? [];
}

async function main() {
  const apiKey = await getGeminiKey();
  console.log('🔤 Generando titulo_comercial con Gemini Flash...\n');

  const { data: subs } = await sb
    .from('subvenciones')
    .select('id, bdns_id, titulo, organismo, importe_maximo')
    .is('titulo_comercial', null)
    .not('titulo', 'is', null)
    .limit(500);

  if (!subs?.length) { console.log('✅ Todas las subvenciones ya tienen título comercial.'); return; }
  console.log(`📋 ${subs.length} subvenciones sin título\n`);

  let generados = 0, errores = 0;

  // Procesar en batches
  for (let i = 0; i < subs.length; i += BATCH) {
    const batch = subs.slice(i, i + BATCH);
    try {
      const titulos = await generarTitulosBatch(batch, apiKey);
      for (let j = 0; j < batch.length; j++) {
        const titulo = titulos[j];
        if (!titulo) continue;
        const { error } = await sb.from('subvenciones').update({ titulo_comercial: titulo }).eq('id', batch[j].id);
        if (error) { errores++; } else { generados++; }
      }
      process.stdout.write(`✅ ${Math.min(i + BATCH, subs.length)}/${subs.length}\r`);
      if (i + BATCH < subs.length) await new Promise(r => setTimeout(r, 800));
    } catch (e) {
      console.error(`\n❌ Batch ${i}-${i+BATCH}: ${e.message}`);
      errores += batch.length;
    }
  }

  console.log(`\n\n📊 ${generados} títulos generados, ${errores} errores`);
}

main().catch(console.error);
