/**
 * scripts/enrich-with-gemini.mjs
 *
 * Enriquece las subvenciones de la BD descargando su PDF de BDNS
 * y analizándolo con Gemini 2.0 Flash (nativo PDF, sin pdfjs).
 *
 * Actualiza: resumen_ia, objeto, para_quien, puntos_clave,
 *            importe_maximo, plazo_fin, estado_convocatoria,
 *            ambito_geografico, comunidad_autonoma
 * Inserta en: subvencion_sectores, subvencion_tipos_empresa
 *
 * Usage:
 *   node scripts/enrich-with-gemini.mjs           — procesa las 30 primeras sin enriquecer
 *   node scripts/enrich-with-gemini.mjs --all     — reprocesa todas
 *   node scripts/enrich-with-gemini.mjs 12345     — solo ese bdns_id
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// ── Env ────────────────────────────────────────────────────────────────────────
const envFile = readFileSync('.env.local', 'utf-8');
const env = Object.fromEntries(
  envFile.split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// ── Args ───────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const forzarTodas = args.includes('--all');
const filtroBdns = args.find(a => !a.startsWith('--')) || null;
const LIMITE = 30;

// ── Gemini config ──────────────────────────────────────────────────────────────
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const MODELO = 'gemini-2.5-flash';  // más reciente con soporte PDF nativo

const SYSTEM_PROMPT = `Eres un extractor de datos especializado en convocatorias de subvenciones y ayudas públicas españolas.
Analiza el PDF y extrae datos estructurados en JSON.

REGLAS:
1. Nunca inventes datos. Si algo no aparece claramente, usa null.
2. Fechas en formato YYYY-MM-DD.
3. Importes como número entero en euros (50000, no "50.000 €").
4. resumen_ia: máximo 3 frases, claro y útil para un gestor.
5. puntos_clave: bullets accionables (quién puede pedir, límites, plazos).
6. para_quien: 1 frase describiendo el beneficiario ideal.
7. confidence_score entre 0.0 y 1.0.`;

const USER_PROMPT = `Analiza esta convocatoria de subvención pública española y extrae los datos estructurados.
Devuelve ÚNICAMENTE un objeto JSON válido y completo sin texto antes ni después, sin comentarios:

{
  "titulo": "string o null",
  "organismo": "string o null",
  "objeto": "descripción del objeto/finalidad de la subvención, string o null",
  "resumen_ia": "máximo 3 frases claras y útiles para un gestor, string o null",
  "para_quien": "1 frase describiendo quién puede beneficiarse, string o null",
  "puntos_clave": ["bullet 1", "bullet 2"],
  "importe_maximo": 50000,
  "importe_minimo": null,
  "porcentaje_financiacion": null,
  "presupuesto_total": null,
  "plazo_inicio": "YYYY-MM-DD o null",
  "plazo_fin": "YYYY-MM-DD o null",
  "plazo_presentacion_texto": "descripción textual del plazo, string o null",
  "ambito_geografico": "nacional o autonomico o local o null",
  "comunidad_autonoma": "nombre de la CCAA o null",
  "provincia": "string o null",
  "sectores": [{"cnae_codigo": "6201", "nombre_sector": "Programación informática", "excluido": false}],
  "tipos_empresa": [{"tipo": "pyme", "descripcion": null, "excluido": false}],
  "estado_convocatoria": "abierta o cerrada o proxima o suspendida o resuelta o null",
  "confidence_score": 0.85
}`;

// ── JSON parser robusto ────────────────────────────────────────────────────────
function extraerJSON(raw) {
  const t = raw.trim();
  try { return JSON.parse(t); } catch {}
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) { try { return JSON.parse(fence[1].trim()); } catch {} }
  const obj = extraerBalanceado(t, '{', '}');
  if (obj) { try { return JSON.parse(obj); } catch {} }
  const limpio = t.replace(/,\s*([}\]])/g, '$1').replace(/\/\/[^\n]*/g, '').trim();
  const objL = extraerBalanceado(limpio, '{', '}');
  if (objL) { try { return JSON.parse(objL); } catch {} }
  throw new Error(`Sin JSON válido. Inicio: ${raw.slice(0, 200)}`);
}
function extraerBalanceado(text, open, close) {
  const start = text.indexOf(open);
  if (start === -1) return null;
  let depth = 0, inString = false, escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === open) depth++;
    else if (ch === close) { depth--; if (depth === 0) return text.slice(start, i + 1); }
  }
  return null;
}

// ── Obtener detalle BDNS con documentos adjuntos ──────────────────────────────
//
// Endpoint real descubierto en el bundle Angular:
//   GET /api/convocatorias?numConv={bdns_id}&vpd=GE
//   → { id (interno), documentos[], urlBasesReguladoras, ... }
//   GET /api/convocatorias/documentos?idDocumento={doc.id}&vpd=GE
//   → descarga doc individual
//   GET /api/convocatorias/pdf?id={id_interno}&vpd=GE   ← id INTERNO, no bdns_id

async function fetchDetalleBdns(bdnsId) {
  const BDNS_BASE = 'https://www.infosubvenciones.es/bdnstrans/api';
  try {
    const res = await fetch(`${BDNS_BASE}/convocatorias?numConv=${bdnsId}&vpd=GE`, {
      headers: { Accept: 'application/json', 'User-Agent': 'SubvencionesApp/1.0' },
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.id) return data;
    }
  } catch { /* fallback silencioso */ }
  return null;
}

// ── Gemini PDF call ─────────────────────────────────────────────────────────────
async function analizarPdfConGemini(bdnsId, apiKey) {
  const BDNS_BASE = 'https://www.infosubvenciones.es/bdnstrans/api';

  // 1. Obtener detalle completo con documentos adjuntos e id interno
  const detalle = await fetchDetalleBdns(bdnsId);
  const internalId = detalle?.id ?? bdnsId;

  // 2. Seleccionar mejor PDF: docs adjuntos → bases reguladoras → extracto
  const sources = [];

  // Documentos adjuntos (texto en castellano primero)
  const docs = (detalle?.documentos ?? [])
    .filter(d => d.id && d.nombreFic)
    .sort((a, b) => {
      const ac = /castellan|español|texto/i.test(a.descripcion ?? '') ? 1 : 0;
      const bc = /castellan|español|texto/i.test(b.descripcion ?? '') ? 1 : 0;
      return bc !== ac ? bc - ac : (b.long ?? 0) - (a.long ?? 0);
    });
  for (const doc of docs.slice(0, 2)) {
    sources.push(`${BDNS_BASE}/convocatorias/documentos?idDocumento=${doc.id}&vpd=GE`);
  }
  if (detalle?.urlBasesReguladoras?.startsWith('http')) {
    sources.push(detalle.urlBasesReguladoras);
  }
  // Extracto con id interno correcto
  sources.push(`${BDNS_BASE}/convocatorias/pdf?id=${internalId}&vpd=GE`);
  // Fallback con bdns_id numérico si distinto
  if (String(internalId) !== String(bdnsId)) {
    sources.push(`${BDNS_BASE}/convocatorias/pdf?id=${bdnsId}&vpd=GE`);
  }

  // 3. Descargar el primer PDF válido
  let pdfBuffer = null;
  let usedSource = '';
  for (const url of sources) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'SubvencionesApp/1.0' },
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) continue;
      const ct = res.headers.get('content-type') ?? '';
      if (ct.includes('html') || ct.includes('text/plain')) continue;
      const buf = await res.arrayBuffer();
      if (buf.byteLength < 500) continue;
      pdfBuffer = buf;
      usedSource = url;
      break;
    } catch { /* siguiente */ }
  }

  if (!pdfBuffer) return { ok: false, error: 'No se encontró PDF en ninguna fuente' };
  if (pdfBuffer.byteLength < 500) return { ok: false, error: 'PDF demasiado pequeño' };
  console.log(`  PDF: ${(pdfBuffer.byteLength/1024).toFixed(0)}KB desde ${usedSource.split('/api/')[1]?.slice(0,50) ?? usedSource.slice(-40)}`);

  // Gemini con PDF inline
  const base64 = Buffer.from(pdfBuffer).toString('base64');
  const body = {
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: 'application/pdf', data: base64 } },
        { text: USER_PROMPT },
      ],
    }],
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
  };

  let raw;
  try {
    const res = await fetch(`${GEMINI_BASE}/models/${MODELO}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, error: `Gemini ${res.status}: ${err?.error?.message ?? 'error'}` };
    }
    const data = await res.json();
    raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    if (!raw) return { ok: false, error: 'Gemini respuesta vacía' };
  } catch (e) {
    return { ok: false, error: `Gemini request: ${e.message}` };
  }

  // Parsear JSON
  try {
    return { ok: true, data: extraerJSON(raw) };
  } catch (e) {
    return { ok: false, error: `Parse JSON: ${e.message}` };
  }
}

// ── Guardar resultado en BD ────────────────────────────────────────────────────
async function guardarEnriquecimiento(subvencionId, bdnsId, p) {
  // 1. Actualizar tabla subvenciones
  const update = {
    pipeline_estado: 'normalizado',
    ia_modelo: MODELO,
    ia_confidence: p.confidence_score ?? null,
  };
  // Only update columns that exist in the subvenciones table
  if (p.titulo) update.titulo = p.titulo;
  if (p.organismo) update.organismo = p.organismo;
  if (p.objeto) update.objeto = p.objeto;
  if (p.resumen_ia) update.resumen_ia = p.resumen_ia;
  if (p.para_quien) update.para_quien = p.para_quien;
  if (Array.isArray(p.puntos_clave) && p.puntos_clave.length) update.puntos_clave = p.puntos_clave;
  if (p.importe_maximo != null) update.importe_maximo = p.importe_maximo;
  if (p.importe_minimo != null) update.importe_minimo = p.importe_minimo;
  if (p.presupuesto_total != null) update.presupuesto_total = p.presupuesto_total;
  if (p.porcentaje_financiacion != null) update.porcentaje_financiacion = p.porcentaje_financiacion;
  if (p.plazo_fin) update.plazo_fin = p.plazo_fin;
  if (p.plazo_inicio) update.plazo_inicio = p.plazo_inicio;
  if (p.plazo_presentacion_texto) update.plazo_presentacion = p.plazo_presentacion_texto;
  if (p.estado_convocatoria) update.estado_convocatoria = p.estado_convocatoria;
  if (p.ambito_geografico) update.ambito_geografico = p.ambito_geografico;
  if (p.comunidad_autonoma) update.comunidad_autonoma = p.comunidad_autonoma;
  if (p.provincia) update.provincia = p.provincia;

  const { error: errUpd } = await sb.from('subvenciones').update(update).eq('id', subvencionId);
  if (errUpd) return { ok: false, error: errUpd.message };

  // 2. Sectores CNAE
  if (p.sectores?.length) {
    await sb.from('subvencion_sectores').delete().eq('subvencion_id', subvencionId);
    const sectores = p.sectores.map(s => ({
      subvencion_id: subvencionId,
      cnae_codigo: s.cnae_codigo ?? null,
      nombre_sector: s.nombre_sector,
      excluido: s.excluido ?? false,
    }));
    const { error: errSec } = await sb.from('subvencion_sectores').insert(sectores);
    if (errSec) console.warn(`  Sectores error:`, errSec.message);
  }

  // 3. Tipos empresa (filter out null tipos — Gemini sometimes returns null)
  if (p.tipos_empresa?.length) {
    const TIPOS_VALIDOS = ['pyme', 'micropyme', 'grande', 'autonomo', 'startup', 'otro'];
    const tipos = p.tipos_empresa
      .filter(t => t.tipo && TIPOS_VALIDOS.includes(t.tipo))
      .map(t => ({
        subvencion_id: subvencionId,
        tipo: t.tipo,
        descripcion: t.descripcion ?? null,
        excluido: t.excluido ?? false,
      }));
    if (tipos.length > 0) {
      await sb.from('subvencion_tipos_empresa').delete().eq('subvencion_id', subvencionId);
      const { error: errTip } = await sb.from('subvencion_tipos_empresa').insert(tipos);
      if (errTip) console.warn(`  Tipos empresa error:`, errTip.message);
    }
  }

  return { ok: true };
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  // Obtener API key de Google
  const { data: provRec } = await sb
    .from('ia_providers')
    .select('api_key')
    .eq('provider', 'google')
    .eq('enabled', true)
    .single();

  if (!provRec?.api_key) {
    console.error('No hay API key de Google configurada en ia_providers.');
    process.exit(1);
  }
  const apiKey = provRec.api_key;
  console.log(`Usando Gemini ${MODELO} para enriquecimiento de PDFs BDNS\n`);

  // Cargar subvenciones a procesar
  let query = sb.from('subvenciones').select('id,bdns_id,titulo,pipeline_estado').order('created_at', { ascending: false });
  if (filtroBdns) {
    query = query.eq('bdns_id', filtroBdns);
  } else if (!forzarTodas) {
    // Procesar las que no tienen análisis IA real (ia_modelo null)
    query = query.is('ia_modelo', null).limit(LIMITE);
  } else {
    query = query.limit(LIMITE);
  }

  const { data: subvenciones, error } = await query;
  if (error) { console.error('Error cargando subvenciones:', error.message); process.exit(1); }

  console.log(`Subvenciones a enriquecer: ${subvenciones.length}\n`);

  let ok = 0, errores = 0;

  for (const subv of subvenciones) {
    process.stdout.write(`[${subv.bdns_id}] ${subv.titulo?.slice(0, 55) ?? ''}... `);

    const geminiRes = await analizarPdfConGemini(subv.bdns_id, apiKey);

    if (!geminiRes.ok) {
      console.log(`ERROR PDF: ${geminiRes.error}`);
      errores++;
      await new Promise(r => setTimeout(r, 1000));
      continue;
    }

    const saveRes = await guardarEnriquecimiento(subv.id, subv.bdns_id, geminiRes.data);
    if (!saveRes.ok) {
      console.log(`ERROR BD: ${saveRes.error}`);
      errores++;
    } else {
      const p = geminiRes.data;
      const importe = p.importe_maximo ? ` | ${(p.importe_maximo/1000).toFixed(0)}K€` : '';
      const plazo = p.plazo_fin ? ` | hasta ${p.plazo_fin}` : '';
      const conf = p.confidence_score ? ` | conf:${(p.confidence_score*100).toFixed(0)}%` : '';
      console.log(`OK${importe}${plazo}${conf}`);
      ok++;
    }

    // Pausa respetuosa entre llamadas
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log(`\nResumen: ${ok} enriquecidas, ${errores} errores`);

  if (ok > 0) {
    console.log('\nRelanzando matching con datos enriquecidos...');
    // Reimportar matching inline (simplificado — solo actualiza scores existentes)
    const { data: updated } = await sb
      .from('subvenciones')
      .select('id,comunidad_autonoma,ambito_geografico,estado_convocatoria')
      .eq('pipeline_estado', 'normalizado');
    console.log(`  ${updated?.length ?? 0} subvenciones con pipeline completo.`);
    console.log('  Ejecuta: node scripts/run-matching.mjs --all para actualizar scores.');
  }
}

main().catch(console.error);
