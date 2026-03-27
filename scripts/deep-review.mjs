#!/usr/bin/env node
/**
 * scripts/deep-review.mjs
 *
 * Deep Review — Análisis profundo de los top matches de un cliente.
 *
 * Para cada match relevante (score >= 0.4), descarga el PDF real de la
 * convocatoria y lo envía a Gemini junto con el perfil del cliente.
 * Gemini hace un análisis legal/técnico real: requisitos, documentación,
 * probabilidad, preguntas para la llamada de ventas.
 *
 * El resultado se guarda en cliente_subvencion_match.deep_review (JSONB).
 *
 * Uso:
 *   node scripts/deep-review.mjs --nif B12345678   # un cliente
 *   node scripts/deep-review.mjs --all              # todos con matches relevantes
 *   node scripts/deep-review.mjs --limit 5          # máx 5 subvenciones por cliente
 *
 * Requisitos:
 *   - GEMINI_API_KEY en .env.local
 *   - columna deep_review JSONB en cliente_subvencion_match (migración incluida abajo)
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// ─── Config ───────────────────────────────────────────────────────────────────

const envFile = readFileSync('.env.local', 'utf-8');
const env = Object.fromEntries(
  envFile.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const GEMINI_KEY = env.GEMINI_API_KEY;
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const MODELO = 'gemini-2.5-flash';
const BDNS_BASE = 'https://www.infosubvenciones.es/bdnstrans/api';

const args = process.argv.slice(2);
const filtroNif = args.find((a, i) => args[i - 1] === '--nif') ?? null;
const forceAll = args.includes('--all');
const limit = parseInt(args.find((a, i) => args[i - 1] === '--limit') ?? '5', 10);
const MIN_SCORE = 0.4;

// ─── Prompt para Gemini ──────────────────────────────────────────────────────

function buildPrompt(cliente, subvencion) {
  return `Analiza en profundidad si esta empresa cumple los requisitos para solicitar esta subvención.

EMPRESA:
- Nombre: ${cliente.nombre_empresa ?? cliente.nif}
- NIF: ${cliente.nif}
- Sector/CNAE: ${cliente.cnae_codigo ?? 'N/D'} — ${cliente.cnae_descripcion ?? 'N/D'}
- Comunidad autónoma: ${cliente.comunidad_autonoma ?? 'N/D'}
- Provincia: ${cliente.provincia ?? 'N/D'}
- Tamaño: ${cliente.tamano_empresa ?? 'N/D'} (${cliente.num_empleados ?? '?'} empleados)
- Facturación: ${cliente.facturacion_anual ? `${Number(cliente.facturacion_anual).toLocaleString('es-ES')} €` : 'N/D'}
- Antigüedad: ${cliente.anos_antiguedad ?? 'N/D'} años
- Forma jurídica: ${cliente.forma_juridica ?? 'N/D'}

CONVOCATORIA:
- Título: ${subvencion.titulo}
- Organismo: ${subvencion.organismo ?? 'N/D'}
- Importe máximo: ${subvencion.importe_maximo ? `${Number(subvencion.importe_maximo).toLocaleString('es-ES')} €` : 'N/D'}
- Estado: ${subvencion.estado_convocatoria ?? 'N/D'}
- Plazo fin: ${subvencion.plazo_fin ?? 'N/D'}

Lee el PDF adjunto (bases reguladoras / convocatoria oficial) y responde en JSON exactamente con esta estructura:

{
  "elegible": true|false|"parcial",
  "probabilidad": "alta"|"media"|"baja",
  "resumen": "2-3 frases: encaje, puntos críticos, recomendación",
  "requisitos": [
    { "requisito": "descripción del requisito del PDF", "cumple": true|false|"parcial"|"desconocido", "nota": "explicación" }
  ],
  "documentacion_necesaria": ["documento 1", "documento 2"],
  "preguntas_para_cliente": ["pregunta concreta que debes hacer en la llamada"],
  "riesgos": ["riesgo o incompatibilidad detectada"],
  "importe_estimado": number_o_null,
  "recomendacion": "proceder"|"verificar"|"descartar",
  "fuente_pdf": "fragmento textual clave del PDF que justifica tu análisis"
}

IMPORTANTE: Basa tu análisis EXCLUSIVAMENTE en el texto del PDF. No inventes requisitos.`;
}

// ─── Descargar PDF desde BDNS ─────────────────────────────────────────────────

async function descargarPdf(bdnsId, pdfUrlDirecta = null) {
  const urls = [
    pdfUrlDirecta,
    `${BDNS_BASE}/convocatorias/pdf?id=${bdnsId}&vpd=GE`,
    `${BDNS_BASE}/convocatorias/${bdnsId}/pdf`,
  ].filter(Boolean);

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'AyudaPyme/2.0' },
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) continue;
      const ct = res.headers.get('content-type') ?? '';
      if (ct.includes('html') || ct.includes('text/')) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 500) continue;
      return buf;
    } catch { /* siguiente */ }
  }
  return null;
}

// ─── Análisis Gemini con PDF ──────────────────────────────────────────────────

async function analizarConGemini(pdfBuffer, prompt, intentos = 3) {
  const base64 = pdfBuffer.toString('base64');
  const body = {
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: 'application/pdf', data: base64 } },
        { text: prompt },
      ],
    }],
    systemInstruction: {
      parts: [{ text: 'Eres un consultor experto en subvenciones públicas españolas. Analizas la elegibilidad de empresas con rigor jurídico. Solo devuelves JSON válido sin texto adicional.' }],
    },
    generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
  };

  let lastErr;
  for (let i = 1; i <= intentos; i++) {
    try {
      const res = await fetch(`${GEMINI_BASE}/models/${MODELO}:generateContent?key=${GEMINI_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = `Gemini ${res.status}: ${err?.error?.message ?? 'error'}`;
        if (res.status === 429 || res.status >= 500) {
          lastErr = new Error(msg);
          await new Promise(r => setTimeout(r, i * 4000));
          continue;
        }
        throw new Error(msg);
      }
      const data = await res.json();
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      if (!raw) throw new Error('Gemini respuesta vacía');
      const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      const candidate = (fence ? fence[1] : raw).trim();
      const jsonMatch = candidate.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error(`Sin JSON: ${raw.slice(0, 200)}`);
      return JSON.parse(jsonMatch[0]);
    } catch (err) {
      lastErr = err;
      if (i < intentos && (err.name === 'TimeoutError' || err.message?.includes('fetch'))) {
        await new Promise(r => setTimeout(r, i * 4000));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!GEMINI_KEY) { console.error('GEMINI_API_KEY no configurada'); process.exit(1); }

  console.log(`\n🔬 Deep Review — Motor de análisis profundo`);
  console.log(`Límite: ${limit} subvenciones por cliente | Score mínimo: ${MIN_SCORE}\n`);

  // Verificar columna deep_review existe, si no, añadirla
  const { error: colErr } = await sb.rpc('exec_sql', {
    sql: `ALTER TABLE cliente_subvencion_match ADD COLUMN IF NOT EXISTS deep_review JSONB;
          ALTER TABLE cliente_subvencion_match ADD COLUMN IF NOT EXISTS deep_review_at TIMESTAMPTZ;`
  }).catch(() => ({ error: null }));
  // Si exec_sql no existe, intentar directamente — no critico
  if (colErr) {
    console.warn('Aviso: no se pudo verificar columna deep_review. Asegúrate de aplicar la migración.');
  }

  // Cargar clientes a procesar
  let nifs = [];
  if (filtroNif) {
    nifs = [filtroNif];
  } else if (forceAll) {
    const { data } = await sb.from('cliente_subvencion_match')
      .select('nif')
      .gte('score', MIN_SCORE)
      .is('deep_review', null)
      .limit(100);
    nifs = [...new Set((data ?? []).map(r => r.nif))];
  } else {
    console.error('Especifica --nif B12345678 o --all');
    process.exit(1);
  }

  console.log(`Clientes a procesar: ${nifs.length}\n`);

  let totalAnalizados = 0, totalErrores = 0;

  for (const nif of nifs) {
    // Cargar perfil del cliente
    const { data: cliente } = await sb.from('cliente')
      .select('nif,nombre_empresa,cnae_codigo,cnae_descripcion,comunidad_autonoma,provincia,tamano_empresa,forma_juridica,num_empleados,facturacion_anual,anos_antiguedad')
      .eq('nif', nif)
      .maybeSingle();

    if (!cliente) { console.warn(`Cliente ${nif} no encontrado`); continue; }

    console.log(`\n📋 ${cliente.nombre_empresa ?? nif} (${nif})`);

    // Cargar top matches sin deep_review
    const { data: matches } = await sb
      .from('cliente_subvencion_match')
      .select(`
        id, score, subvencion_id,
        subvencion:subvenciones(id, bdns_id, titulo, organismo, importe_maximo, estado_convocatoria, plazo_fin, pdf_url, campos_extraidos)
      `)
      .eq('nif', nif)
      .gte('score', MIN_SCORE)
      .eq('es_hard_exclude', false)
      .is('deep_review', null)
      .order('score', { ascending: false })
      .limit(limit);

    if (!matches?.length) {
      console.log(`  Sin matches pendientes de deep review`);
      continue;
    }

    console.log(`  Analizando ${matches.length} matches...`);

    for (const match of matches) {
      const subv = match.subvencion;
      if (!subv) continue;

      process.stdout.write(`  [${Math.round(match.score * 100)}%] ${subv.titulo?.slice(0, 50)}... `);

      try {
        // Intentar descargar PDF
        const pdfUrl = subv.pdf_url ?? null;
        const pdfBuffer = await descargarPdf(subv.bdns_id, pdfUrl);

        if (!pdfBuffer) {
          // Sin PDF → análisis limitado basado en campos_extraidos
          const ce = subv.campos_extraidos;
          const deepReview = {
            elegible: ce ? 'parcial' : 'desconocido',
            probabilidad: 'media',
            resumen: `Sin PDF disponible para análisis completo. ${ce ? 'Análisis basado en datos extraídos automáticamente.' : 'Sin datos suficientes para evaluar.'}`,
            requisitos: [],
            documentacion_necesaria: ce?.gastos_subvencionables ? ['Documentación acreditativa de gastos'] : [],
            preguntas_para_cliente: [
              '¿Tiene deudas pendientes con la Administración?',
              '¿Ha recibido otras ayudas de minimis en los últimos 3 años?',
              `¿Cumple los criterios de ${ce?.beneficiarios_tipo ?? 'beneficiario'}?`,
            ],
            riesgos: ['PDF no disponible — análisis incompleto'],
            importe_estimado: subv.importe_maximo ? Math.round(subv.importe_maximo * 0.5) : null,
            recomendacion: 'verificar',
            sin_pdf: true,
          };
          await sb.from('cliente_subvencion_match').update({
            deep_review: deepReview,
            deep_review_at: new Date().toISOString(),
          }).eq('id', match.id);
          console.log('⚠️  Sin PDF');
          totalAnalizados++;
          continue;
        }

        // Análisis completo con Gemini
        const prompt = buildPrompt(cliente, subv);
        const review = await analizarConGemini(pdfBuffer, prompt);

        await sb.from('cliente_subvencion_match').update({
          deep_review: { ...review, analizado_at: new Date().toISOString(), modelo: MODELO },
          deep_review_at: new Date().toISOString(),
        }).eq('id', match.id);

        const emoji = review.recomendacion === 'proceder' ? '✅' : review.recomendacion === 'descartar' ? '❌' : '🔍';
        console.log(`${emoji} ${review.probabilidad} | ${review.recomendacion}`);
        totalAnalizados++;

        // Pausa entre llamadas para no saturar rate limit
        await new Promise(r => setTimeout(r, 2000));

      } catch (err) {
        console.log(`❌ Error: ${err.message}`);
        totalErrores++;
      }
    }
  }

  console.log(`\n📊 Completado: ${totalAnalizados} analizados, ${totalErrores} errores`);
}

main().catch(err => { console.error('\n💥', err.message); process.exit(1); });
