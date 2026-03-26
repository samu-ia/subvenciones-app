/**
 * Genera titulo_comercial para todas las subvenciones usando Claude Haiku.
 * Convierte nombres burocráticos del BOE en títulos atractivos para PYMEs.
 *
 * Uso: npx dotenvx run -f .env.local -- node scripts/generate-titulos-comerciales.mjs
 */

import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function callClaude(prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.content[0]?.type === 'text' ? data.content[0].text.trim() : null;
}

function fmtImporte(importe_maximo, presupuesto_total) {
  const n = importe_maximo ?? presupuesto_total;
  if (!n) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M€`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k€`;
  return `${n}€`;
}

async function generarTitulo(sub) {
  const importe = fmtImporte(sub.importe_maximo, sub.presupuesto_total);

  const prompt = `Eres un copywriter experto en ayudas a PYMEs españolas.
Tu tarea: convertir el nombre burocrático de una subvención en un título comercial atractivo.

Reglas:
- Máximo 65 caracteres
- Lenguaje directo, de la calle — como diría un empresario a otro
- Enfócate en el BENEFICIO concreto para la empresa, no en el proceso
- Si hay importe, inclúyelo de forma llamativa (ej: "hasta 40k€", "el 80% financiado")
- Estilo: "Moderniza tu maquinaria — hasta 40k€" / "Digitaliza tu negocio, el Estado paga el 80%" / "Contrata jóvenes con el sueldo bonificado"
- NUNCA uses palabras como: subvención, convocatoria, resolución, expediente, BDNS, BOE, régimen, concurrencia
- Responde SOLO con el título, sin explicaciones ni comillas

Datos de la subvención:
Título oficial: ${sub.titulo?.slice(0, 100) ?? ''}
Objeto: ${sub.objeto?.slice(0, 150) ?? ''}
Organismo: ${sub.organismo?.slice(0, 80) ?? ''}
${importe ? `Importe disponible: ${importe}` : ''}`;

  const titulo = await callClaude(prompt);
  return titulo ? titulo.replace(/^["']|["']$/g, '') : null;
}

async function main() {
  // Intentar añadir la columna si no existe (ignorar errores)
  try {
    await sb.rpc('exec_sql', {
      sql: 'ALTER TABLE public.subvenciones ADD COLUMN IF NOT EXISTS titulo_comercial TEXT'
    });
  } catch (_) { /* ignora si no existe la función o ya existe la columna */ }

  // Obtener subvenciones sin titulo_comercial
  const { data: subvenciones, error } = await sb
    .from('subvenciones')
    .select('id, titulo, objeto, organismo, importe_maximo, presupuesto_total')
    .is('titulo_comercial', null)
    .order('id')
    .limit(200);

  if (error) {
    console.error('Error obteniendo subvenciones:', error.message);
    // Si falla por columna inexistente, aplicar alter table directamente
    if (error.message.includes('titulo_comercial')) {
      console.log('La columna no existe aún — aplica la migración en Supabase primero.');
    }
    process.exit(1);
  }

  console.log(`Generando títulos para ${subvenciones.length} subvenciones...`);

  let ok = 0;
  let errores = 0;

  for (const sub of subvenciones) {
    try {
      const titulo = await generarTitulo(sub);
      if (!titulo) { errores++; continue; }

      await sb.from('subvenciones').update({ titulo_comercial: titulo }).eq('id', sub.id);
      ok++;

      console.log(`✓ [${ok}/${subvenciones.length}] ${titulo}`);
    } catch (e) {
      errores++;
      console.error(`✗ ${sub.id.slice(0, 8)}: ${e.message}`);
    }

    // Pequeña pausa para no saturar la API
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\nListo: ${ok} generados, ${errores} errores.`);
  process.exit(0);
}

main();
