/**
 * scripts/pipeline-magistral.mjs
 *
 * Pipeline de ingestión viva — sistema por fases con 5 ciclos.
 *
 * Arquitectura:
 *   El pipeline ya NO es lineal. Cada convocatoria pasa por 5 fases
 *   independientes, con estados explícitos y persistencia entre fases.
 *   Esto permite:
 *     · Reanudar desde cualquier fase (crash-safe)
 *     · Reprocesar solo la fase que falló
 *     · Procesamiento por oleadas (BDNS API → descargas → IA → normalizar → validar)
 *     · Detección de cambios entre versiones (grant_versions + grant_change_events)
 *
 * Las 5 fases (ciclos):
 *   1. INGESTA     — Fetch BDNS API, upsert raw, crear subvención, detectar cambios
 *   2. DESCARGA    — Descargar PDFs, registrar grant_documents, hash change detection
 *   3. EXTRACCIÓN  — Enviar PDFs a Gemini, extraer campos con grounding
 *   4. NORMALIZACIÓN — Aplicar campos a tabla principal, sectores, tipos empresa
 *   5. VALIDACIÓN  — Calcular estado, detectar conflictos, registrar change events
 *
 * Tablas nuevas (arquitectura v3):
 *   · grant_documents     — documentos con estado por fase
 *   · grant_versions      — snapshot de cada análisis
 *   · grant_field_values  — campos con grounding vinculados a versión
 *   · grant_change_events — log de cambios y conflictos
 *
 * Uso:
 *   node scripts/pipeline-magistral.mjs                       → últimos 7 días, 10 workers
 *   node scripts/pipeline-magistral.mjs --dias 90             → últimos 90 días
 *   node scripts/pipeline-magistral.mjs --all                 → todas sin procesar
 *   node scripts/pipeline-magistral.mjs --id 893737           → solo ese bdns_id
 *   node scripts/pipeline-magistral.mjs --workers 20          → más paralelismo
 *   node scripts/pipeline-magistral.mjs --forzar              → reprocesa todo
 *   node scripts/pipeline-magistral.mjs --fase ingesta        → solo ejecutar fase 1
 *   node scripts/pipeline-magistral.mjs --fase descarga       → solo ejecutar fase 2
 *   node scripts/pipeline-magistral.mjs --fase extraccion_ia  → solo ejecutar fase 3
 *   node scripts/pipeline-magistral.mjs --fase normalizacion  → solo ejecutar fase 4
 *   node scripts/pipeline-magistral.mjs --fase validacion     → solo ejecutar fase 5
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// ─── Config ────────────────────────────────────────────────────────────────────

const envFile = readFileSync('.env.local', 'utf-8');
const env = Object.fromEntries(
  envFile.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const args = process.argv.slice(2);
const _dias_idx    = args.indexOf('--dias');
const _workers_idx = args.indexOf('--workers');
const _id_idx      = args.indexOf('--id');
const _fase_idx    = args.indexOf('--fase');
const DIAS       = _dias_idx    !== -1 ? parseInt(args[_dias_idx + 1])    : 7;
const WORKERS    = _workers_idx !== -1 ? parseInt(args[_workers_idx + 1]) : 10;
const BDNS_ID    = _id_idx      !== -1 ? args[_id_idx + 1]                : null;
const FORZAR     = args.includes('--forzar');
const MODO_ALL   = args.includes('--all');
const FASE_UNICA = _fase_idx    !== -1 ? args[_fase_idx + 1]              : null;

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const MODELO = 'gemini-2.5-flash';

const FASES_ORDEN = ['ingesta', 'descarga', 'extraccion_ia', 'normalizacion', 'validacion'];

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── Utilidades ────────────────────────────────────────────────────────────────

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function now() { return new Date().toISOString(); }

function log(fase, bdnsId, msg, level = 'info') {
  const icons = { info: '  ', ok: '✅', warn: '⚠️', error: '❌', fase: '🔄' };
  const icon = icons[level] || '  ';
  console.log(`${icon} [${fase.padEnd(16)}] ${bdnsId ? `#${bdnsId} ` : ''}${msg}`);
}

// ─── Obtener API Key Gemini ────────────────────────────────────────────────────

async function getGeminiKey() {
  if (env.GEMINI_API_KEY && !env.GEMINI_API_KEY.startsWith('tu_')) {
    return env.GEMINI_API_KEY;
  }
  const { data } = await sb
    .from('ia_providers')
    .select('api_key')
    .eq('provider', 'google')
    .eq('enabled', true)
    .not('api_key', 'is', null)
    .limit(1)
    .maybeSingle();
  if (data?.api_key) return data.api_key;
  throw new Error('No hay API key de Google/Gemini configurada. Añádela en .env.local o en la tabla ia_providers.');
}

// ─── BDNS API ──────────────────────────────────────────────────────────────────

const BDNS_BASE = 'https://www.infosubvenciones.es/bdnstrans/api';

async function fetchBdnsPagina(fechaDesde, fechaHasta, pagina = 0, tamanio = 50) {
  const strategies = [
    () => fetch(`${BDNS_BASE}/convocatorias/busqueda?` + new URLSearchParams({
      pageNumber: pagina, pageSize: tamanio,
      fechaConvocatoria: `${fechaDesde}:${fechaHasta}`,
    }), { headers: { Accept: 'application/json', 'User-Agent': 'AyudaPyme/2.0' }, signal: AbortSignal.timeout(20000) }),
    () => fetch(`${BDNS_BASE}/convocatorias?` + new URLSearchParams({
      page: pagina, size: tamanio,
      fechaDesde, fechaHasta,
    }), { headers: { Accept: 'application/json', 'User-Agent': 'AyudaPyme/2.0' }, signal: AbortSignal.timeout(20000) }),
    () => fetch(`${BDNS_BASE}/convocatorias/ultimas?` + new URLSearchParams({
      numero: tamanio, pagina,
    }), { headers: { Accept: 'application/json', 'User-Agent': 'AyudaPyme/2.0' }, signal: AbortSignal.timeout(20000) }),
  ];

  for (const strategy of strategies) {
    try {
      const res = await strategy();
      if (!res.ok) continue;
      const data = await res.json();
      if (Array.isArray(data)) {
        return { items: data, totalPaginas: 1, totalItems: data.length };
      }
      if (data.content) {
        return { items: data.content, totalPaginas: data.totalPages ?? 1, totalItems: data.totalElements ?? data.content.length };
      }
      if (data.convocatorias || data.data) {
        const items = data.convocatorias ?? data.data;
        return { items, totalPaginas: data.totalPaginas ?? 1, totalItems: data.total ?? items.length };
      }
    } catch { /* siguiente estrategia */ }
  }
  return { items: [], totalPaginas: 0, totalItems: 0 };
}

async function listarTodasConvocatorias(fechaDesde, fechaHasta) {
  const todas = [];
  let pagina = 0;
  let totalPaginas = 1;

  process.stdout.write(`Consultando BDNS (${fechaDesde} → ${fechaHasta})... `);

  while (pagina < totalPaginas) {
    const { items, totalPaginas: tp } = await fetchBdnsPagina(fechaDesde, fechaHasta, pagina, 100);
    todas.push(...items);
    totalPaginas = tp;
    pagina++;
    if (pagina < totalPaginas) await sleep(500);
  }

  console.log(`${todas.length} convocatorias encontradas.`);
  return todas;
}

// ─── PDF Download ──────────────────────────────────────────────────────────────

const PDF_URLS = {
  extracto: (bdnsId) => `https://www.infosubvenciones.es/bdnstrans/api/convocatorias/pdf?id=${bdnsId}&vpd=GE`,
  web: (bdnsId) => `https://www.infosubvenciones.es/bdnstrans/GE/es/convocatorias/${bdnsId}/extracto`,
};

async function descargarPdf(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'AyudaPyme-Bot/2.0' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) return null;
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('html') || ct.includes('text/')) return null;
  const buf = await res.arrayBuffer();
  if (buf.byteLength < 500) return null;
  return buf;
}

// ─── Gemini con Grounding ─────────────────────────────────────────────────────

const PROMPT_GROUNDING = `Eres un extractor de datos especializado en convocatorias de subvenciones públicas españolas.
Analiza el PDF y extrae datos estructurados. Para CADA campo, indica además:
  - El fragmento textual exacto del documento del que lo extrajiste
  - La página estimada donde aparece (1 = primera página)
  - Tu nivel de confianza (0.0-1.0)

REGLAS:
1. NUNCA inventes datos. Si algo no está en el documento, usa null en valor.
2. Fechas en formato YYYY-MM-DD.
3. Importes como número entero en euros (50000, no "50.000 €").
4. Si el valor no aparece, pon valor: null, fragmento: null, pagina: null, conf: 0.0.
5. Los sectores CNAE: usa los códigos reales si los ves; si no, describe el sector con nombre_sector.
6. tipos_empresa: pyme, micropyme, grande, autonomo, startup, otro (exactamente esos valores).
7. estado_convocatoria: solo abierta, cerrada, proxima, suspendida, resuelta.

Devuelve ÚNICAMENTE JSON válido sin texto adicional:

{
  "titulo":               { "valor": "string|null", "fragmento": "string|null", "pagina": 1, "conf": 0.0 },
  "organismo":            { "valor": "string|null", "fragmento": "string|null", "pagina": 1, "conf": 0.0 },
  "objeto":               { "valor": "string|null", "fragmento": "string|null", "pagina": 1, "conf": 0.0 },
  "resumen_ia":           { "valor": "max 3 frases claras para un gestor|null", "fragmento": null, "pagina": null, "conf": 0.0 },
  "para_quien":           { "valor": "1 frase|null", "fragmento": "string|null", "pagina": 1, "conf": 0.0 },
  "puntos_clave":         { "valor": ["bullet1","bullet2"]|null, "fragmento": "string|null", "pagina": 1, "conf": 0.0 },
  "importe_maximo":       { "valor": 50000|null, "fragmento": "string|null", "pagina": 1, "conf": 0.0 },
  "importe_minimo":       { "valor": 5000|null, "fragmento": "string|null", "pagina": 1, "conf": 0.0 },
  "porcentaje_financiacion": { "valor": 80|null, "fragmento": "string|null", "pagina": 1, "conf": 0.0 },
  "presupuesto_total":    { "valor": 1000000|null, "fragmento": "string|null", "pagina": 1, "conf": 0.0 },
  "plazo_inicio":         { "valor": "YYYY-MM-DD|null", "fragmento": "string|null", "pagina": 1, "conf": 0.0 },
  "plazo_fin":            { "valor": "YYYY-MM-DD|null", "fragmento": "string|null", "pagina": 1, "conf": 0.0 },
  "plazo_presentacion_texto": { "valor": "string|null", "fragmento": "string|null", "pagina": 1, "conf": 0.0 },
  "ambito_geografico":    { "valor": "nacional|autonomico|local|null", "fragmento": "string|null", "pagina": 1, "conf": 0.0 },
  "comunidad_autonoma":   { "valor": "string|null", "fragmento": "string|null", "pagina": 1, "conf": 0.0 },
  "provincia":            { "valor": "string|null", "fragmento": "string|null", "pagina": 1, "conf": 0.0 },
  "estado_convocatoria":  { "valor": "abierta|cerrada|proxima|suspendida|resuelta|null", "fragmento": "string|null", "pagina": 1, "conf": 0.0 },
  "sectores":             { "valor": [{"cnae_codigo":"6201|null","nombre_sector":"string","excluido":false}]|null, "fragmento": "string|null", "pagina": 1, "conf": 0.0 },
  "tipos_empresa":        { "valor": [{"tipo":"pyme","descripcion":"string|null","excluido":false}]|null, "fragmento": "string|null", "pagina": 1, "conf": 0.0 },
  "observaciones":        { "valor": "string|null", "fragmento": null, "pagina": null, "conf": 0.0 },
  "confidence_global":    0.85
}`;

async function analizarPdfConGemini(pdfBuffer, apiKey, contexto = '', intentos = 3) {
  const base64 = Buffer.from(pdfBuffer).toString('base64');
  const body = {
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: 'application/pdf', data: base64 } },
        { text: contexto ? `Documento: ${contexto}\n\n${PROMPT_GROUNDING}` : PROMPT_GROUNDING },
      ],
    }],
    systemInstruction: { parts: [{ text: 'Eres un extractor de datos especializado en subvenciones públicas españolas. Solo devuelves JSON válido.' }] },
    generationConfig: { temperature: 0.05, maxOutputTokens: 16384 },
  };

  let lastErr;
  for (let intento = 1; intento <= intentos; intento++) {
    try {
      const res = await fetch(`${GEMINI_BASE}/models/${MODELO}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = `Gemini ${res.status}: ${err?.error?.message ?? 'error'}`;
        // 429 (rate limit) y 5xx → retry; 4xx → no retry
        if (res.status === 429 || res.status >= 500) {
          lastErr = new Error(msg);
          const wait = intento * 3000;
          console.warn(`  ⚠️ Gemini intento ${intento}/${intentos}: ${msg} — reintentando en ${wait / 1000}s`);
          await new Promise(r => setTimeout(r, wait));
          continue;
        }
        throw new Error(msg);
      }

      const data = await res.json();
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      if (!raw) throw new Error('Gemini respuesta vacía');

      const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      const candidate = (fenceMatch ? fenceMatch[1] : raw).trim();
      const jsonMatch = candidate.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error(`Sin JSON en respuesta: ${raw.slice(0, 200)}`);
      return JSON.parse(jsonMatch[0]);
    } catch (err) {
      lastErr = err;
      if (intento < intentos && (err.name === 'TimeoutError' || err.message?.includes('fetch'))) {
        const wait = intento * 3000;
        console.warn(`  ⚠️ Gemini intento ${intento}/${intentos}: ${err.message} — reintentando en ${wait / 1000}s`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

// ─── Worker pool (semáforo simple) ─────────────────────────────────────────────

function crearSemaforo(max) {
  let activos = 0;
  const cola = [];

  return {
    acquire() {
      if (activos < max) {
        activos++;
        return Promise.resolve();
      }
      return new Promise(resolve => cola.push(resolve));
    },
    release() {
      activos--;
      if (cola.length) {
        activos++;
        cola.shift()();
      }
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// FASE 1: INGESTA — Fetch BDNS, upsert raw, crear/actualizar subvención
// ═══════════════════════════════════════════════════════════════════════════════

async function faseIngesta(conv) {
  const bdnsId = String(conv.numeroConvocatoria);

  // 1. Upsert raw
  const hashRaw = await sha256(JSON.stringify(conv));

  const { data: existingRaw } = await sb
    .from('subvenciones_raw')
    .select('id, hash_raw')
    .eq('bdns_id', bdnsId)
    .maybeSingle();

  let rawId;
  let rawCambio = false;

  if (existingRaw) {
    rawId = existingRaw.id;
    if (existingRaw.hash_raw !== hashRaw) {
      rawCambio = true;
      await sb.from('subvenciones_raw')
        .update({ raw_json: conv, hash_raw: hashRaw, fecha_ingesta: now() })
        .eq('id', existingRaw.id);
    } else if (!FORZAR) {
      // Sin cambios en raw — comprobar si ya completado
      const { data: sub } = await sb
        .from('subvenciones')
        .select('id, pipeline_fase, pipeline_ciclo')
        .eq('bdns_id', bdnsId)
        .maybeSingle();
      if (sub?.pipeline_fase === 'completado') {
        return { bdnsId, subvencionId: sub.id, rawId, skip: true, razon: 'sin_cambio' };
      }
    }
  } else {
    const { data: newRec, error } = await sb.from('subvenciones_raw').insert({
      bdns_id: bdnsId, fuente: 'bdns', raw_json: conv,
      hash_raw: hashRaw, url_fuente: conv.urlConvocatoria ?? null,
    }).select('id').single();
    if (error) throw new Error(`Insert raw: ${error.message}`);
    rawId = newRec.id;
    rawCambio = true;
  }

  // 2. Upsert subvención
  const { data: existingSub } = await sb
    .from('subvenciones')
    .select('id, pipeline_fase')
    .eq('bdns_id', bdnsId)
    .maybeSingle();

  let subvencionId;

  if (existingSub) {
    subvencionId = existingSub.id;
    // Actualizar fase si está atrasada o si hay cambios raw
    if (rawCambio || FORZAR || existingSub.pipeline_fase === 'error') {
      await sb.from('subvenciones').update({
        pipeline_fase: 'ingesta',
        pipeline_error: null,
        updated_at: now(),
      }).eq('id', subvencionId);
    }
  } else {
    // Crear nueva subvención
    const nivel1 = (conv.nivel1 ?? '').toUpperCase();
    let ambito = 'desconocido';
    if (nivel1.includes('ESTATAL') || nivel1.includes('ESTADO')) ambito = 'nacional';
    else if (nivel1.includes('AUTON')) ambito = 'autonomico';
    else if (nivel1.includes('LOCAL')) ambito = 'local';

    const { data: newSub, error } = await sb.from('subvenciones').insert({
      bdns_id: bdnsId,
      raw_id: rawId,
      fuente: 'bdns',
      titulo: conv.descripcion ?? conv.titulo ?? `Convocatoria ${bdnsId}`,
      organismo: conv.nivel3 ?? conv.nivel2 ?? conv.organo ?? null,
      fecha_publicacion: conv.fechaRecepcion ? conv.fechaRecepcion.split('T')[0] : null,
      ambito_geografico: ambito,
      estado_convocatoria: 'desconocido',
      pipeline_estado: 'raw',
      pipeline_fase: 'ingesta',
      pipeline_ciclo: 1,
      version: 1,
    }).select('id').single();

    if (error) throw new Error(`Insert subvencion: ${error.message}`);
    subvencionId = newSub.id;
  }

  // 3. Registrar evento de ingesta
  if (rawCambio) {
    await sb.from('grant_change_events').insert({
      subvencion_id: subvencionId,
      bdns_id: bdnsId,
      tipo_evento: rawId && existingRaw ? 'campo_actualizado' : 'version_creada',
      descripcion: existingRaw ? 'Raw BDNS actualizado (hash cambió)' : 'Primera ingesta desde BDNS',
      fuente: 'bdns',
      severidad: 'info',
    });
  }

  log('ingesta', bdnsId, rawCambio ? 'raw actualizado' : 'sin cambios en raw', rawCambio ? 'ok' : 'info');

  return { bdnsId, subvencionId, rawId, rawCambio, conv, skip: false };
}

// ═══════════════════════════════════════════════════════════════════════════════
// FASE 2: DESCARGA — Descargar PDFs, registrar grant_documents
// ═══════════════════════════════════════════════════════════════════════════════

async function faseDescarga(ctx) {
  if (ctx.skip) return ctx;

  const { bdnsId, subvencionId, conv } = ctx;

  // Construir lista de URLs a intentar
  const urls = [
    { url: PDF_URLS.extracto(bdnsId), tipo: 'extracto' },
  ];
  if (conv?.urlPdf) urls.push({ url: conv.urlPdf, tipo: 'convocatoria' });
  if (conv?.urlConvocatoria && conv.urlConvocatoria !== conv?.urlPdf) {
    urls.push({ url: conv.urlConvocatoria, tipo: 'bases_reguladoras' });
  }

  let pdfBuf = null;
  let pdfUrl = null;
  let pdfTipo = null;

  for (const { url, tipo } of urls) {
    const buf = await descargarPdf(url);
    if (buf) {
      pdfBuf = buf;
      pdfUrl = url;
      pdfTipo = tipo;
      break;
    }
  }

  if (!pdfBuf) {
    await sb.from('subvenciones').update({
      pipeline_fase: 'error',
      pipeline_estado: 'error',
      pipeline_error: 'PDF no disponible en ninguna fuente',
    }).eq('id', subvencionId);

    await sb.from('grant_change_events').insert({
      subvencion_id: subvencionId,
      bdns_id: bdnsId,
      tipo_evento: 'error_fase',
      descripcion: 'PDF no disponible en ninguna fuente',
      fuente: 'sistema',
      severidad: 'alta',
    });

    log('descarga', bdnsId, 'PDF no disponible', 'error');
    return { ...ctx, skip: true, razon: 'pdf_no_disponible' };
  }

  const hashPdf = await sha256(Buffer.from(pdfBuf).toString('base64'));

  // Comprobar si ya tenemos este documento con el mismo hash
  const { data: existingDoc } = await sb
    .from('grant_documents')
    .select('id, hash_pdf, fase_estado')
    .eq('subvencion_id', subvencionId)
    .eq('tipo', pdfTipo)
    .maybeSingle();

  let docId;
  let docCambio = false;

  if (existingDoc) {
    docId = existingDoc.id;
    if (existingDoc.hash_pdf === hashPdf && !FORZAR && existingDoc.fase_estado === 'ia_procesado') {
      log('descarga', bdnsId, 'PDF sin cambios (hash match)', 'info');
      // Aún así avanzar si la subvención no está completada
      return { ...ctx, docId, hashPdf, pdfBuf, pdfTipo, docCambio: false };
    }
    docCambio = existingDoc.hash_pdf !== hashPdf;

    await sb.from('grant_documents').update({
      url_origen: pdfUrl,
      hash_pdf: hashPdf,
      tamanio_bytes: pdfBuf.byteLength,
      fase_estado: 'descargado',
      error_msg: null,
      intentos: (existingDoc.intentos ?? 0) + 1,
      descargado_at: now(),
    }).eq('id', docId);
  } else {
    const { data: newDoc, error } = await sb.from('grant_documents').insert({
      subvencion_id: subvencionId,
      bdns_id: bdnsId,
      tipo: pdfTipo,
      titulo: pdfTipo === 'extracto' ? 'Extracto BDNS' : pdfTipo === 'convocatoria' ? 'Convocatoria completa' : 'Bases reguladoras',
      url_origen: pdfUrl,
      hash_pdf: hashPdf,
      tamanio_bytes: pdfBuf.byteLength,
      orden: pdfTipo === 'extracto' ? 1 : pdfTipo === 'convocatoria' ? 2 : 3,
      es_principal: true,
      fase_estado: 'descargado',
      intentos: 1,
      descargado_at: now(),
    }).select('id').single();

    if (error) throw new Error(`Insert grant_document: ${error.message}`);
    docId = newDoc.id;
    docCambio = true;
  }

  // Actualizar fase
  await sb.from('subvenciones').update({
    pipeline_fase: 'descarga',
    pipeline_estado: 'pdf_descargado',
    updated_at: now(),
  }).eq('id', subvencionId);

  if (docCambio) {
    await sb.from('grant_change_events').insert({
      subvencion_id: subvencionId,
      bdns_id: bdnsId,
      tipo_evento: 'fase_completada',
      descripcion: `PDF ${pdfTipo} descargado (${(pdfBuf.byteLength / 1024).toFixed(0)}KB)${existingDoc ? ' — hash cambió' : ''}`,
      fuente: 'sistema',
      severidad: 'info',
    });
  }

  log('descarga', bdnsId, `${pdfTipo} ${(pdfBuf.byteLength / 1024).toFixed(0)}KB${docCambio ? ' (nuevo)' : ''}`, 'ok');

  return { ...ctx, docId, hashPdf, pdfBuf, pdfTipo, docCambio };
}

// ═══════════════════════════════════════════════════════════════════════════════
// FASE 3: EXTRACCIÓN IA — Enviar PDF a Gemini, guardar field_values
// ═══════════════════════════════════════════════════════════════════════════════

async function faseExtraccionIa(ctx, apiKey) {
  if (ctx.skip) return ctx;

  const { bdnsId, subvencionId, docId, pdfBuf, hashPdf } = ctx;

  // Marcar documento como enviado a IA
  await sb.from('grant_documents').update({
    fase_estado: 'ia_enviado',
  }).eq('id', docId);

  // Analizar con Gemini
  const extraccion = await analizarPdfConGemini(pdfBuf, apiKey, `bdns_id=${bdnsId}`);

  // Marcar documento como procesado
  await sb.from('grant_documents').update({
    fase_estado: 'ia_procesado',
    ia_procesado_at: now(),
  }).eq('id', docId);

  // Crear nueva versión
  const { data: prevVersion } = await sb
    .from('grant_versions')
    .select('version_number')
    .eq('subvencion_id', subvencionId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const versionNumber = (prevVersion?.version_number ?? 0) + 1;

  // Obtener valores anteriores para detección de cambios
  const { data: prevFields } = prevVersion
    ? await sb
        .from('grant_field_values')
        .select('nombre_campo, valor_texto, valor_json')
        .eq('version_id', prevVersion.id)
      : { data: [] };

  const prevFieldMap = new Map((prevFields ?? []).map(f => [f.nombre_campo, f.valor_texto ?? JSON.stringify(f.valor_json)]));

  const { data: newVersion, error: verError } = await sb.from('grant_versions').insert({
    subvencion_id: subvencionId,
    bdns_id: bdnsId,
    version_number: versionNumber,
    ciclo: ctx.ciclo ?? 1,
    fase_alcanzada: 'extraccion_ia',
    ia_modelo: MODELO,
    ia_confidence: extraccion.confidence_global ?? 0.5,
    estado: 'en_progreso',
    documento_ids: [docId],
  }).select('id').single();

  if (verError) throw new Error(`Insert grant_version: ${verError.message}`);

  // Guardar field_values con detección de cambios
  const CAMPOS = [
    'titulo', 'organismo', 'objeto', 'resumen_ia', 'para_quien', 'puntos_clave',
    'importe_maximo', 'importe_minimo', 'porcentaje_financiacion', 'presupuesto_total',
    'plazo_inicio', 'plazo_fin', 'plazo_presentacion_texto',
    'ambito_geografico', 'comunidad_autonoma', 'provincia',
    'estado_convocatoria', 'sectores', 'tipos_empresa', 'observaciones',
  ];

  const fieldRows = [];
  const changeEvents = [];
  let numCampos = 0;

  for (const campo of CAMPOS) {
    const f = extraccion[campo];
    if (!f || f.valor === null || f.valor === undefined) continue;

    const esComplejo = Array.isArray(f.valor) || (typeof f.valor === 'object' && f.valor !== null);
    const valorTexto = esComplejo ? null : String(f.valor);
    const valorActual = valorTexto ?? JSON.stringify(f.valor);
    const valorAnterior = prevFieldMap.get(campo);
    const esCambio = valorAnterior !== undefined && valorAnterior !== valorActual;

    fieldRows.push({
      version_id: newVersion.id,
      documento_id: docId,
      subvencion_id: subvencionId,
      bdns_id: bdnsId,
      nombre_campo: campo,
      valor_texto: valorTexto,
      valor_json: esComplejo ? f.valor : null,
      fragmento_texto: f.fragmento ?? null,
      pagina_estimada: f.pagina ?? null,
      metodo: 'ia',
      modelo_ia: MODELO,
      confidence: f.conf ?? 0.5,
      es_cambio: esCambio,
      valor_anterior: esCambio ? valorAnterior : null,
    });

    numCampos++;

    if (esCambio) {
      changeEvents.push({
        subvencion_id: subvencionId,
        version_id: newVersion.id,
        bdns_id: bdnsId,
        tipo_evento: 'campo_actualizado',
        campo_afectado: campo,
        valor_anterior: valorAnterior,
        valor_nuevo: valorActual,
        fuente_anterior: `IA v${versionNumber - 1}`,
        fuente_nueva: `IA v${versionNumber} (${MODELO})`,
        descripcion: `Campo ${campo} cambió entre versiones`,
        confidence: f.conf ?? 0.5,
        fuente: 'ia',
        severidad: ['plazo_fin', 'importe_maximo', 'estado_convocatoria'].includes(campo) ? 'media' : 'baja',
      });
    }
  }

  // Batch insert field values
  if (fieldRows.length) {
    const { error: fvError } = await sb.from('grant_field_values').insert(fieldRows);
    if (fvError) throw new Error(`Insert field_values: ${fvError.message}`);
  }

  // Registrar cambios detectados
  if (changeEvents.length) {
    await sb.from('grant_change_events').insert(changeEvents);
  }

  // Actualizar versión con contadores
  const hashSnapshot = await sha256(JSON.stringify(fieldRows.map(r => [r.nombre_campo, r.valor_texto ?? r.valor_json])));
  await sb.from('grant_versions').update({
    num_campos: numCampos,
    hash_snapshot: hashSnapshot,
  }).eq('id', newVersion.id);

  // También guardar en tablas v2 legacy para compatibilidad
  await guardarGroundingLegacy(subvencionId, bdnsId, docId, extraccion);
  await guardarEventosLegacy(subvencionId, bdnsId, docId, extraccion);

  // Actualizar fase
  await sb.from('subvenciones').update({
    pipeline_fase: 'extraccion_ia',
    pipeline_estado: 'ia_procesado',
    ia_modelo: MODELO,
    ia_procesado_at: now(),
    ia_confidence: extraccion.confidence_global ?? 0.5,
    hash_contenido: hashPdf,
    updated_at: now(),
  }).eq('id', subvencionId);

  const conf = extraccion.confidence_global ?? 0;
  log('extraccion_ia', bdnsId, `${numCampos} campos, conf:${(conf * 100).toFixed(0)}%, ${changeEvents.length} cambios`, 'ok');

  return { ...ctx, extraccion, versionId: newVersion.id, versionNumber, numCampos };
}

// ─── Legacy grounding (compatibilidad con tablas v2) ───────────────────────────

async function guardarGroundingLegacy(subvencionId, bdnsId, docId, extraccion) {
  const CAMPOS = [
    'titulo', 'organismo', 'objeto', 'resumen_ia', 'para_quien', 'puntos_clave',
    'importe_maximo', 'importe_minimo', 'porcentaje_financiacion', 'presupuesto_total',
    'plazo_inicio', 'plazo_fin', 'plazo_presentacion_texto',
    'ambito_geografico', 'comunidad_autonoma', 'provincia',
    'estado_convocatoria', 'sectores', 'tipos_empresa', 'observaciones',
  ];

  // Buscar doc_id compatible en subvencion_documentos
  const { data: legacyDoc } = await sb
    .from('subvencion_documentos')
    .select('id')
    .eq('subvencion_id', subvencionId)
    .limit(1)
    .maybeSingle();

  const legacyDocId = legacyDoc?.id ?? null;

  for (const campo of CAMPOS) {
    const f = extraccion[campo];
    if (!f || f.valor === null || f.valor === undefined) continue;

    const { data: anterior } = await sb
      .from('subvencion_campos_extraidos')
      .select('id, version')
      .eq('subvencion_id', subvencionId)
      .eq('nombre_campo', campo)
      .eq('override_manual', false)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    const version = (anterior?.version ?? 0) + 1;
    const esComplejo = Array.isArray(f.valor) || (typeof f.valor === 'object' && f.valor !== null);

    const { data: nuevo } = await sb.from('subvencion_campos_extraidos').insert({
      subvencion_id: subvencionId,
      documento_id: legacyDocId,
      bdns_id: bdnsId,
      nombre_campo: campo,
      valor_texto: esComplejo ? null : String(f.valor),
      valor_json: esComplejo ? f.valor : null,
      fragmento_texto: f.fragmento ?? null,
      pagina_estimada: f.pagina ?? null,
      metodo: 'ia',
      modelo_ia: MODELO,
      confidence: f.conf ?? 0.5,
      version,
      override_manual: false,
    }).select('id').single();

    if (anterior && nuevo) {
      await sb.from('subvencion_campos_extraidos')
        .update({ supersedido_por: nuevo.id }).eq('id', anterior.id);
    }
  }
}

async function guardarEventosLegacy(subvencionId, bdnsId, docId, extraccion) {
  const { data: legacyDoc } = await sb
    .from('subvencion_documentos')
    .select('id')
    .eq('subvencion_id', subvencionId)
    .limit(1)
    .maybeSingle();

  const legacyDocId = legacyDoc?.id ?? null;
  const eventos = [];

  if (extraccion.plazo_inicio?.valor) {
    eventos.push({
      subvencion_id: subvencionId, documento_id: legacyDocId, bdns_id: bdnsId,
      tipo_evento: 'apertura_plazo', fecha_evento: extraccion.plazo_inicio.valor,
      titulo: 'Inicio del plazo', fuente: 'ia',
      fragmento_texto: extraccion.plazo_inicio.fragmento,
      pagina_estimada: extraccion.plazo_inicio.pagina,
      confidence: extraccion.plazo_inicio.conf,
    });
  }
  if (extraccion.plazo_fin?.valor) {
    eventos.push({
      subvencion_id: subvencionId, documento_id: legacyDocId, bdns_id: bdnsId,
      tipo_evento: 'cierre_plazo', fecha_evento: extraccion.plazo_fin.valor,
      titulo: 'Cierre del plazo', fuente: 'ia',
      fragmento_texto: extraccion.plazo_fin.fragmento,
      pagina_estimada: extraccion.plazo_fin.pagina,
      confidence: extraccion.plazo_fin.conf,
    });
  }
  if (extraccion.estado_convocatoria?.valor === 'suspendida' && extraccion.estado_convocatoria.conf > 0.5) {
    eventos.push({
      subvencion_id: subvencionId, documento_id: legacyDocId, bdns_id: bdnsId,
      tipo_evento: 'suspension', titulo: 'Suspensión detectada', fuente: 'ia',
      confidence: extraccion.estado_convocatoria.conf,
    });
  }

  if (eventos.length) {
    if (legacyDocId) {
      await sb.from('subvencion_eventos').delete()
        .eq('subvencion_id', subvencionId).eq('documento_id', legacyDocId).eq('fuente', 'ia');
    }
    await sb.from('subvencion_eventos').insert(eventos);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FASE 4: NORMALIZACIÓN — Aplicar campos a tabla principal
// ═══════════════════════════════════════════════════════════════════════════════

async function faseNormalizacion(ctx) {
  if (ctx.skip) return ctx;

  const { bdnsId, subvencionId, extraccion, hashPdf } = ctx;
  const e = extraccion;

  const update = {
    pipeline_fase: 'normalizacion',
    pipeline_estado: 'normalizado',
    updated_at: now(),
  };

  const campoDirecto = (campo) => {
    const f = e[campo];
    if (f?.valor !== null && f?.valor !== undefined && f?.conf > 0.3) {
      update[campo] = f.valor;
    }
  };

  campoDirecto('titulo'); campoDirecto('organismo'); campoDirecto('objeto');
  campoDirecto('resumen_ia'); campoDirecto('para_quien');
  campoDirecto('importe_maximo'); campoDirecto('importe_minimo');
  campoDirecto('porcentaje_financiacion'); campoDirecto('presupuesto_total');
  campoDirecto('plazo_inicio'); campoDirecto('plazo_fin');
  campoDirecto('ambito_geografico'); campoDirecto('comunidad_autonoma'); campoDirecto('provincia');
  campoDirecto('estado_convocatoria');

  if (e.plazo_presentacion_texto?.valor && e.plazo_presentacion_texto.conf > 0.3) {
    update.plazo_presentacion = e.plazo_presentacion_texto.valor;
  }
  if (Array.isArray(e.puntos_clave?.valor) && e.puntos_clave.conf > 0.3) {
    update.puntos_clave = e.puntos_clave.valor;
  }

  await sb.from('subvenciones').update(update).eq('id', subvencionId);

  // Sectores
  const sectores = e.sectores?.valor;
  if (Array.isArray(sectores) && sectores.length && e.sectores.conf > 0.4) {
    await sb.from('subvencion_sectores').delete().eq('subvencion_id', subvencionId);
    await sb.from('subvencion_sectores').insert(
      sectores.filter(s => s.nombre_sector).map(s => ({
        subvencion_id: subvencionId,
        cnae_codigo: s.cnae_codigo ?? null,
        nombre_sector: s.nombre_sector,
        excluido: s.excluido ?? false,
      }))
    );
  }

  // Tipos empresa
  const TIPOS_VALIDOS = ['pyme', 'micropyme', 'grande', 'autonomo', 'startup', 'otro'];
  const tipos = e.tipos_empresa?.valor;
  if (Array.isArray(tipos) && tipos.length && e.tipos_empresa.conf > 0.4) {
    const validos = tipos.filter(t => t.tipo && TIPOS_VALIDOS.includes(t.tipo));
    if (validos.length) {
      await sb.from('subvencion_tipos_empresa').delete().eq('subvencion_id', subvencionId);
      await sb.from('subvencion_tipos_empresa').insert(
        validos.map(t => ({
          subvencion_id: subvencionId,
          tipo: t.tipo,
          descripcion: t.descripcion ?? null,
          excluido: t.excluido ?? false,
        }))
      );
    }
  }

  log('normalizacion', bdnsId, 'campos aplicados a tabla principal', 'ok');

  return ctx;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FASE 5: VALIDACIÓN — Estado calculado, conflictos, cierre de versión
// ═══════════════════════════════════════════════════════════════════════════════

async function faseValidacion(ctx) {
  if (ctx.skip) return ctx;

  const { bdnsId, subvencionId, extraccion, versionId, conv } = ctx;

  // 1. Detectar conflictos con BDNS raw
  const conflictos = [];
  const e = extraccion;

  const bdnsFechaFin = conv?.fechaFinSolicitud ? conv.fechaFinSolicitud.split('T')[0] : null;
  const iaFechaFin = e.plazo_fin?.valor;
  if (bdnsFechaFin && iaFechaFin && e.plazo_fin.conf > 0.6 && bdnsFechaFin !== iaFechaFin) {
    conflictos.push({
      subvencion_id: subvencionId, version_id: versionId, bdns_id: bdnsId,
      tipo_evento: 'conflicto_fecha', campo_afectado: 'plazo_fin',
      valor_anterior: bdnsFechaFin, fuente_anterior: 'BDNS raw',
      valor_nuevo: iaFechaFin, fuente_nueva: `IA (${MODELO})`,
      descripcion: `BDNS: ${bdnsFechaFin} | PDF: ${iaFechaFin}`,
      fuente: 'sistema', severidad: 'alta',
    });
  }

  const bdnsImporte = conv?.importeMaximo ?? conv?.importeTotal;
  const iaImporte = e.importe_maximo?.valor;
  if (bdnsImporte && iaImporte && e.importe_maximo.conf > 0.6) {
    const diff = Math.abs(bdnsImporte - iaImporte) / bdnsImporte;
    if (diff > 0.1) {
      conflictos.push({
        subvencion_id: subvencionId, version_id: versionId, bdns_id: bdnsId,
        tipo_evento: 'conflicto_importe', campo_afectado: 'importe_maximo',
        valor_anterior: String(bdnsImporte), fuente_anterior: 'BDNS raw',
        valor_nuevo: String(iaImporte), fuente_nueva: `IA (${MODELO})`,
        descripcion: `BDNS: ${bdnsImporte}€ | PDF: ${iaImporte}€ (diff ${(diff * 100).toFixed(0)}%)`,
        fuente: 'sistema', severidad: 'media',
      });
    }
  }

  // Campos con baja confianza
  for (const campo of ['plazo_fin', 'importe_maximo', 'estado_convocatoria']) {
    const f = e[campo];
    if (f?.valor !== null && f?.conf < 0.4) {
      conflictos.push({
        subvencion_id: subvencionId, version_id: versionId, bdns_id: bdnsId,
        tipo_evento: 'dato_dudoso', campo_afectado: campo,
        valor_nuevo: String(f.valor), fuente_nueva: `IA (${MODELO})`,
        descripcion: `Confianza baja en ${campo}: ${(f.conf * 100).toFixed(0)}%`,
        confidence: f.conf,
        fuente: 'ia', severidad: 'baja',
      });
    }
  }

  // También guardar en tabla legacy subvencion_conflictos
  if (conflictos.length) {
    await sb.from('grant_change_events').insert(conflictos);

    // Legacy compatibility
    const legacyConflictos = conflictos
      .filter(c => ['conflicto_fecha', 'conflicto_importe', 'dato_dudoso'].includes(c.tipo_evento))
      .map(c => ({
        subvencion_id: subvencionId, bdns_id: bdnsId,
        tipo_conflicto: c.tipo_evento === 'conflicto_fecha' ? 'fecha_inconsistente'
          : c.tipo_evento === 'conflicto_importe' ? 'importe_inconsistente'
          : 'dato_dudoso',
        campo_afectado: c.campo_afectado,
        valor_a: c.valor_anterior ?? c.valor_nuevo, fuente_a: c.fuente_anterior ?? c.fuente_nueva,
        valor_b: c.valor_nuevo ?? '', fuente_b: c.fuente_nueva ?? '',
        descripcion: c.descripcion,
        severidad: c.severidad === 'critica' ? 'alta' : c.severidad,
        resuelto: false,
      }));
    if (legacyConflictos.length) {
      await sb.from('subvencion_conflictos').insert(legacyConflictos);
    }
  }

  // 2. Calcular estado (máquina de estados determinista)
  const eventos = [];
  if (e.plazo_inicio?.valor) eventos.push({ tipo_evento: 'apertura_plazo', fecha_evento: e.plazo_inicio.valor });
  if (e.plazo_fin?.valor) eventos.push({ tipo_evento: 'cierre_plazo', fecha_evento: e.plazo_fin.valor });
  if (e.estado_convocatoria?.valor === 'suspendida' && e.estado_convocatoria.conf > 0.5) {
    eventos.push({ tipo_evento: 'suspension' });
  }

  // Calcular estado simplificado (inline, sin importar TS)
  const estadoCalc = calcularEstadoInline(e.plazo_inicio?.valor, e.plazo_fin?.valor, eventos);

  await sb.from('subvencion_estado_calculado').upsert({
    subvencion_id: subvencionId,
    bdns_id: bdnsId,
    estado: estadoCalc.estado,
    razon: estadoCalc.razon,
    dias_para_cierre: estadoCalc.dias_para_cierre ?? null,
    urgente: estadoCalc.urgente,
    calculado_at: now(),
    plazo_inicio_usado: e.plazo_inicio?.valor ?? null,
    plazo_fin_usado: e.plazo_fin?.valor ?? null,
    tiene_evento_suspension: estadoCalc.tiene_suspension,
    tiene_evento_resolucion: false,
    tiene_evento_ampliacion: false,
  }, { onConflict: 'subvencion_id' });

  // 3. Cerrar versión
  await sb.from('grant_versions').update({
    fase_alcanzada: 'validacion',
    estado: 'completada',
    num_conflictos: conflictos.length,
    completada_at: now(),
  }).eq('id', versionId);

  // 4. Marcar subvención como completada
  await sb.from('subvenciones').update({
    pipeline_fase: 'completado',
    pipeline_estado: 'normalizado',
    estado_convocatoria: estadoCalc.estado !== 'desconocido' ? estadoCalc.estado : undefined,
    version_actual_id: versionId,
    pipeline_ciclo: ctx.ciclo ?? 1,
    updated_at: now(),
  }).eq('id', subvencionId);

  // Registrar fase completada
  await sb.from('grant_change_events').insert({
    subvencion_id: subvencionId,
    version_id: versionId,
    bdns_id: bdnsId,
    tipo_evento: 'fase_completada',
    descripcion: `Pipeline completado: v${ctx.versionNumber}, ${ctx.numCampos} campos, ${conflictos.length} conflictos, estado=${estadoCalc.estado}`,
    fuente: 'sistema',
    severidad: 'info',
  });

  const conflStr = conflictos.length ? ` ⚠️${conflictos.length} conflictos` : '';
  log('validacion', bdnsId, `estado=${estadoCalc.estado}${estadoCalc.urgente ? ' URGENTE' : ''}${conflStr}`, 'ok');

  return { ...ctx, estado: estadoCalc, numConflictos: conflictos.length };
}

// ─── Estado calculator inline (no importa TS) ─────────────────────────────────

function calcularEstadoInline(plazoInicio, plazoFin, eventos) {
  const ahora = new Date();
  const tieneSuspension = eventos.some(e => e.tipo_evento === 'suspension');

  if (tieneSuspension) {
    return { estado: 'suspendida', razon: 'Suspensión detectada.', urgente: false, tiene_suspension: true };
  }

  const fechaFin = plazoFin ? new Date(plazoFin) : null;
  const fechaInicio = plazoInicio ? new Date(plazoInicio) : null;

  if (fechaFin && !isNaN(fechaFin.getTime())) {
    const diasHastaFin = Math.ceil((fechaFin.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24));

    if (diasHastaFin < 0) {
      return { estado: 'cerrada', razon: `Plazo finalizó hace ${Math.abs(diasHastaFin)} día(s).`, urgente: false, tiene_suspension: false };
    }

    if (fechaInicio && !isNaN(fechaInicio.getTime())) {
      const diasDesdeInicio = Math.ceil((fechaInicio.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24));
      if (diasDesdeInicio > 0) {
        return { estado: 'proxima', razon: `Apertura en ${diasDesdeInicio} día(s).`, dias_para_cierre: diasHastaFin, urgente: diasHastaFin <= 15, tiene_suspension: false };
      }
    }

    return { estado: 'abierta', razon: `Cierra en ${diasHastaFin} día(s).`, dias_para_cierre: diasHastaFin, urgente: diasHastaFin <= 15, tiene_suspension: false };
  }

  if (fechaInicio && !isNaN(fechaInicio.getTime())) {
    const dias = Math.ceil((fechaInicio.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24));
    if (dias > 0) return { estado: 'proxima', razon: `Apertura en ${dias} día(s), sin fecha de cierre.`, urgente: false, tiene_suspension: false };
    return { estado: 'abierta', razon: 'Parece abierto, sin fecha de cierre.', urgente: false, tiene_suspension: false };
  }

  return { estado: 'desconocido', razon: 'Sin fechas suficientes.', urgente: false, tiene_suspension: false };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORQUESTADOR: Ejecuta las 5 fases en secuencia para una convocatoria
// ═══════════════════════════════════════════════════════════════════════════════

async function procesarConvocatoria(conv, apiKey, semaforo, ciclo = 1) {
  await semaforo.acquire();
  const bdnsId = String(conv.numeroConvocatoria);

  try {
    // Determinar desde qué fase empezar
    let faseInicial = 0; // ingesta
    if (FASE_UNICA) {
      faseInicial = FASES_ORDEN.indexOf(FASE_UNICA);
      if (faseInicial === -1) throw new Error(`Fase desconocida: ${FASE_UNICA}`);
    }

    let ctx = { bdnsId, conv, ciclo, skip: false };

    // FASE 1: INGESTA
    if (faseInicial <= 0) {
      ctx = await faseIngesta(conv);
      ctx.conv = conv;
      ctx.ciclo = ciclo;
      if (ctx.skip) return { resultado: ctx.razon ?? 'sin_cambio', bdnsId };
    } else {
      // Cargar contexto de BD para fases posteriores
      const { data: sub } = await sb.from('subvenciones')
        .select('id').eq('bdns_id', bdnsId).maybeSingle();
      if (!sub) return { resultado: 'error', bdnsId, error: 'No encontrado en BD' };
      ctx.subvencionId = sub.id;
    }

    // FASE 2: DESCARGA
    if (faseInicial <= 1 && (!FASE_UNICA || FASE_UNICA === 'descarga' || faseInicial < 1)) {
      ctx = await faseDescarga(ctx);
      if (ctx.skip) return { resultado: ctx.razon ?? 'sin_pdf', bdnsId };
    } else if (faseInicial > 1) {
      // Cargar doc y PDF de BD
      const { data: doc } = await sb.from('grant_documents')
        .select('id, hash_pdf')
        .eq('subvencion_id', ctx.subvencionId)
        .eq('es_principal', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (doc) {
        ctx.docId = doc.id;
        ctx.hashPdf = doc.hash_pdf;
      }
    }

    // FASE 3: EXTRACCIÓN IA
    if (faseInicial <= 2 && (!FASE_UNICA || FASE_UNICA === 'extraccion_ia' || faseInicial < 2)) {
      if (!ctx.pdfBuf && ctx.docId) {
        // Si no tenemos el buffer (viene de fase > descarga), necesitamos re-descargar
        // o cargar de la fase de descarga previa
        ctx = await faseDescarga(ctx);
        if (ctx.skip) return { resultado: ctx.razon ?? 'sin_pdf', bdnsId };
      }
      ctx = await faseExtraccionIa(ctx, apiKey);
    } else if (faseInicial > 2) {
      // Cargar extracción de la última versión
      const { data: ver } = await sb.from('grant_versions')
        .select('id, version_number')
        .eq('subvencion_id', ctx.subvencionId)
        .order('version_number', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (ver) {
        ctx.versionId = ver.id;
        ctx.versionNumber = ver.version_number;
        // Reconstruir extracción desde field_values
        const { data: fields } = await sb.from('grant_field_values')
          .select('nombre_campo, valor_texto, valor_json, fragmento_texto, pagina_estimada, confidence')
          .eq('version_id', ver.id);
        ctx.extraccion = {};
        for (const f of (fields ?? [])) {
          ctx.extraccion[f.nombre_campo] = {
            valor: f.valor_json ?? f.valor_texto,
            fragmento: f.fragmento_texto,
            pagina: f.pagina_estimada,
            conf: f.confidence ?? 0.5,
          };
        }
        ctx.numCampos = (fields ?? []).length;
      }
    }

    // FASE 4: NORMALIZACIÓN
    if (faseInicial <= 3 && (!FASE_UNICA || FASE_UNICA === 'normalizacion' || faseInicial < 3)) {
      ctx = await faseNormalizacion(ctx);
    }

    // FASE 5: VALIDACIÓN
    if (faseInicial <= 4 && (!FASE_UNICA || FASE_UNICA === 'validacion' || faseInicial < 4)) {
      ctx = await faseValidacion(ctx);
    }

    const conf = ctx.extraccion?.confidence_global ?? ctx.extraccion?.titulo?.conf ?? 0;
    const conflStr = ctx.numConflictos ? ` ⚠️${ctx.numConflictos}` : '';
    return {
      resultado: 'ok',
      bdnsId,
      titulo: ctx.extraccion?.titulo?.valor?.slice(0, 50),
      conf,
      conflictos: ctx.numConflictos ?? 0,
      estado: ctx.estado?.estado,
      msg: `conf:${(conf * 100).toFixed(0)}%${conflStr} estado:${ctx.estado?.estado ?? '?'}`,
    };

  } catch (err) {
    // Registrar error en BD
    await sb.from('subvenciones')
      .update({ pipeline_fase: 'error', pipeline_estado: 'error', pipeline_error: err.message })
      .eq('bdns_id', bdnsId);

    // Registrar change event de error
    const { data: sub } = await sb.from('subvenciones')
      .select('id').eq('bdns_id', bdnsId).maybeSingle();
    if (sub) {
      await sb.from('grant_change_events').insert({
        subvencion_id: sub.id,
        bdns_id: bdnsId,
        tipo_evento: 'error_fase',
        descripcion: err.message?.slice(0, 500),
        fuente: 'sistema',
        severidad: 'alta',
      }).catch(() => {}); // no fallar por log
    }

    return { resultado: 'error', bdnsId, error: err.message };
  } finally {
    semaforo.release();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN — Orquestación general del pipeline
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('\n🚀 Pipeline de Ingestión Viva v3.0 — Sistema por Fases');
  console.log(`   Modelo: ${MODELO} | Workers: ${WORKERS} | Fase: ${FASE_UNICA ?? 'todas'}`);

  const apiKey = await getGeminiKey();
  console.log(`   Gemini API: ✓`);

  let convocatorias = [];

  if (BDNS_ID) {
    console.log(`\n📋 Modo single: bdns_id=${BDNS_ID}`);
    convocatorias = [{ numeroConvocatoria: BDNS_ID }];
  } else if (MODO_ALL) {
    // Buscar según la fase solicitada
    let filter = 'pipeline_estado.eq.raw,pipeline_estado.eq.error,ia_modelo.is.null';

    if (FASE_UNICA) {
      const faseIdx = FASES_ORDEN.indexOf(FASE_UNICA);
      if (faseIdx === 0) {
        // Ingesta: buscar pendientes
        filter = 'pipeline_fase.eq.pendiente,pipeline_fase.eq.error,pipeline_fase.is.null';
      } else if (faseIdx === 1) {
        // Descarga: buscar los que completaron ingesta
        filter = 'pipeline_fase.eq.ingesta';
      } else if (faseIdx === 2) {
        // Extracción: buscar los que completaron descarga
        filter = 'pipeline_fase.eq.descarga';
      } else if (faseIdx === 3) {
        // Normalización: buscar los que completaron extracción
        filter = 'pipeline_fase.eq.extraccion_ia';
      } else if (faseIdx === 4) {
        // Validación: buscar los que completaron normalización
        filter = 'pipeline_fase.eq.normalizacion';
      }
    }

    const { data } = await sb.from('subvenciones')
      .select('bdns_id')
      .or(filter)
      .order('created_at', { ascending: false })
      .limit(10000);
    convocatorias = (data ?? []).map(r => ({ numeroConvocatoria: r.bdns_id }));
    console.log(`\n📋 Modo all: ${convocatorias.length} subvenciones pendientes`);
  } else {
    const hasta = new Date();
    const desde = new Date();
    desde.setDate(desde.getDate() - DIAS);
    const fmt = d => d.toISOString().split('T')[0];
    convocatorias = await listarTodasConvocatorias(fmt(desde), fmt(hasta));
  }

  if (!convocatorias.length) {
    console.log('\nNo hay convocatorias que procesar.');
    return;
  }

  // ─── Ejecutar por fases ──────────────────────────────────────────────────────

  if (FASE_UNICA) {
    console.log(`\n🔄 Ejecutando solo fase: ${FASE_UNICA}`);
    console.log(`   ${convocatorias.length} convocatorias con ${WORKERS} workers paralelos\n`);
  } else {
    console.log(`\n⚡ Pipeline completo (5 fases) para ${convocatorias.length} convocatorias\n`);
    console.log('   Fases: ingesta → descarga → extracción_ia → normalización → validación\n');
  }

  const semaforo = crearSemaforo(WORKERS);
  let ok = 0, sinCambio = 0, errores = 0;
  const inicio = Date.now();

  const promises = convocatorias.map((conv, i) =>
    procesarConvocatoria(conv, apiKey, semaforo, 1)
  );
  const resultados = await Promise.allSettled(promises);

  // ─── Resumen ─────────────────────────────────────────────────────────────────

  for (const r of resultados) {
    if (r.status === 'rejected') { errores++; continue; }
    const res = r.value;
    if (res.resultado === 'ok') {
      ok++;
      console.log(`  ✅ ${res.bdnsId} | ${res.titulo ?? ''} | ${res.msg}`);
    } else if (res.resultado === 'sin_cambio') {
      sinCambio++;
    } else {
      errores++;
      if (res.error) console.log(`  ❌ ${res.bdnsId} | ${res.error?.slice(0, 80)}`);
    }
  }

  const secs = ((Date.now() - inicio) / 1000).toFixed(1);
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`✅ OK: ${ok} | Sin cambio: ${sinCambio} | Errores: ${errores} | Tiempo: ${secs}s`);
  console.log(`   Fase: ${FASE_UNICA ?? 'completo'} | Modelo: ${MODELO} | Workers: ${WORKERS}`);

  if (ok > 0) {
    console.log('\n💡 Próximos pasos:');
    if (!FASE_UNICA || FASE_UNICA === 'validacion') {
      console.log('   node scripts/run-matching.mjs --all     # Recalcular matches');
    }
    console.log('   node scripts/pipeline-magistral.mjs --fase descarga --all   # Reprocesar descargas');
    console.log('   node scripts/pipeline-magistral.mjs --fase validacion --all  # Re-validar todo\n');
  }
}

main().catch(err => { console.error('\n💥 Error fatal:', err.message); process.exit(1); });
