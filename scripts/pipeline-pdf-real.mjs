/**
 * scripts/pipeline-pdf-real.mjs
 *
 * Pipeline PDF Real: descarga y parsea convocatorias desde BDNS.
 *
 * Flujo:
 *   1. Llamar a BDNS API → obtener bdns_id y datos básicos
 *   2. Buscar PDF real: bases_reguladoras → convocatoria_url → scrape infosubvenciones.es
 *   3. Descargar el PDF
 *   4. Enviar a Gemini (base64 inline) con prompt estructurado → 15 campos JSON
 *   5. Si no hay PDF: marcar pdf_disponible=false, extraer lo que se pueda del HTML
 *   6. Guardar PDF en Supabase Storage bucket 'convocatorias-pdf'
 *   7. Actualizar subvenciones: pdf_url, pdf_procesado, campos_extraidos (JSONB)
 *
 * Uso:
 *   node scripts/pipeline-pdf-real.mjs                    → últimos 7 días
 *   node scripts/pipeline-pdf-real.mjs --dias 30          → últimos 30 días
 *   node scripts/pipeline-pdf-real.mjs --id 893737        → solo ese bdns_id
 *   node scripts/pipeline-pdf-real.mjs --all              → todas sin pdf_procesado
 *   node scripts/pipeline-pdf-real.mjs --workers 5        → paralelismo
 *   node scripts/pipeline-pdf-real.mjs --forzar           → reprocesar todo
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { createHash } from 'crypto';

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
const DIAS       = _dias_idx    !== -1 ? parseInt(args[_dias_idx + 1])    : 7;
const WORKERS    = _workers_idx !== -1 ? parseInt(args[_workers_idx + 1]) : 5;
const BDNS_ID    = _id_idx      !== -1 ? args[_id_idx + 1]                : null;
const FORZAR     = args.includes('--forzar');
const MODO_ALL   = args.includes('--all');

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const MODELO = 'gemini-2.5-flash';
const BDNS_BASE = 'https://www.infosubvenciones.es/bdnstrans/api';
const BDNS_WEB = 'https://www.infosubvenciones.es/bdnstrans/GE/es/convocatoria';
const STORAGE_BUCKET = 'convocatorias-pdf';

const sleep = ms => new Promise(r => setTimeout(r, ms));

function log(fase, bdnsId, msg, level = 'info') {
  const icons = { info: '  ', ok: '✅', warn: '⚠️', error: '❌', fase: '🔄', pdf: '📄' };
  console.log(`${icons[level] || '  '} [${fase.padEnd(14)}] ${bdnsId ? `#${bdnsId} ` : ''}${msg}`);
}

function sha256hex(buffer) {
  return createHash('sha256').update(Buffer.from(buffer)).digest('hex');
}

function extraerJSON(raw) {
  const t = raw.trim();
  try { return JSON.parse(t); } catch {}
  // Buscar el objeto JSON usando índice directo — más robusto que regex con multiline
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    try { return JSON.parse(t.slice(start, end + 1)); } catch {}
    // Intento limpiando trailing commas
    const limpio = t.slice(start, end + 1).replace(/,\s*([}\]])/g, '$1').replace(/\/\/[^\n]*/g, '');
    try { return JSON.parse(limpio); } catch {}
  }
  // Fallback: extraer objeto balanceado
  const obj = extraerBalanceado(t, '{', '}');
  if (obj) { try { return JSON.parse(obj); } catch {} }
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
  throw new Error('No hay API key de Google/Gemini. Añádela en .env.local o en ia_providers.');
}

// ─── BDNS API ──────────────────────────────────────────────────────────────────

async function fetchBdnsPagina(fechaDesde, fechaHasta, pagina = 0, tamanio = 50) {
  const strategies = [
    // Endpoint oficial con filtros PYME (tipo 3=PYME+autónomos, 5=sin info) + solo subvenciones
    () => fetch(`${BDNS_BASE}/convocatorias/busqueda?` + new URLSearchParams({
      vpd: 'GE', page: pagina, pageSize: tamanio,
      fechaDesde, fechaHasta,
      tiposBeneficiario: '3,5',
      instrumentos: '1',
    }), { headers: { Accept: 'application/json', 'User-Agent': 'AyudaPyme/2.0' }, signal: AbortSignal.timeout(20000) }),
    // Fallback sin filtros
    () => fetch(`${BDNS_BASE}/convocatorias/busqueda?` + new URLSearchParams({
      vpd: 'GE', page: pagina, pageSize: tamanio,
      fechaDesde, fechaHasta,
    }), { headers: { Accept: 'application/json', 'User-Agent': 'AyudaPyme/2.0' }, signal: AbortSignal.timeout(20000) }),
  ];

  for (const strategy of strategies) {
    try {
      const res = await strategy();
      if (!res.ok) continue;
      const data = await res.json();
      if (Array.isArray(data)) return { items: data, totalPaginas: 1 };
      if (data.content) return { items: data.content, totalPaginas: data.totalPages ?? 1 };
      if (data.convocatorias || data.data) {
        const items = data.convocatorias ?? data.data;
        return { items, totalPaginas: data.totalPaginas ?? 1 };
      }
    } catch { /* siguiente estrategia */ }
  }
  return { items: [], totalPaginas: 0 };
}

async function listarConvocatorias(fechaDesde, fechaHasta) {
  const todas = [];
  let pagina = 0, totalPaginas = 1;
  process.stdout.write(`Consultando BDNS (${fechaDesde} → ${fechaHasta})... `);

  while (pagina < totalPaginas && pagina < 20) {
    const { items, totalPaginas: tp } = await fetchBdnsPagina(fechaDesde, fechaHasta, pagina, 100);
    todas.push(...items);
    totalPaginas = tp;
    pagina++;
    if (pagina < totalPaginas) await sleep(500);
  }

  console.log(`${todas.length} convocatorias.`);
  return todas;
}

// ─── Detalle completo BDNS (endpoint oficial descubierto en el bundle Angular) ──
//
// Endpoint real: GET /api/convocatorias?numConv={bdns_id}&vpd=GE
// Devuelve: { id, codigoBDNS, documentos[], urlBasesReguladoras, presupuestoTotal,
//             fechaInicioSolicitud, fechaFinSolicitud, tiposBeneficiarios[], sectores[], ... }
// Los documentos tienen: { id, descripcion, nombreFic, long, datMod }
// Para descargar un doc: GET /api/convocatorias/documentos?idDocumento={doc.id}&vpd=GE
// Para el extracto PDF: GET /api/convocatorias/pdf?id={conv.id}&vpd=GE  ← id INTERNO, no bdns_id

async function fetchBdnsDetalle(bdnsId) {
  // 1. Endpoint principal: GET /convocatorias?numConv={bdnsId}  (necesita codigoBDNS/numeroConvocatoria)
  try {
    const res = await fetch(
      `${BDNS_BASE}/convocatorias?numConv=${bdnsId}&vpd=GE`,
      { headers: { Accept: 'application/json', 'User-Agent': 'AyudaPyme/2.0' }, signal: AbortSignal.timeout(15000) }
    );
    if (res.ok) {
      const data = await res.json();
      if (data && data.id) return data; // tiene id interno → detalle válido
    }
  } catch { /* fallback */ }

  // 2. Si el ID parece ser un id INTERNO (>900000 y falló el numConv), buscar su numeroConvocatoria
  //    El seed script almacenó el id interno en bdns_id por error — aquí lo corregimos
  const numericId = parseInt(bdnsId, 10);
  if (numericId > 900000) {
    try {
      // Buscar en paginas recientes de busqueda hasta encontrar este id interno
      for (let page = 0; page < 20; page++) {
        const res = await fetch(
          `${BDNS_BASE}/convocatorias/busqueda?vpd=GE&pageSize=200&page=${page}`,
          { headers: { Accept: 'application/json', 'User-Agent': 'AyudaPyme/2.0' }, signal: AbortSignal.timeout(15000) }
        );
        if (!res.ok) break;
        const data = await res.json();
        const items = data.content ?? [];
        if (items.length === 0) break;

        const match = items.find(i => i.id === numericId);
        if (match) {
          // Encontramos el numeroConvocatoria real — ahora obtener el detalle completo
          const detRes = await fetch(
            `${BDNS_BASE}/convocatorias?numConv=${match.numeroConvocatoria}&vpd=GE`,
            { headers: { Accept: 'application/json', 'User-Agent': 'AyudaPyme/2.0' }, signal: AbortSignal.timeout(15000) }
          );
          if (detRes.ok) {
            const det = await detRes.json();
            if (det?.id) return det;
          }
          // Si falla el detalle, devolver el item de busqueda con el id interno asignado
          return { ...match, id: numericId };
        }

        // Optimización: si los IDs del bloque ya son menores que nuestro objetivo, parar
        const minId = Math.min(...items.map(i => i.id));
        if (minId < numericId - 2000) break;
      }
    } catch { /* siguiente */ }
  }

  return null;
}

// ─── Búsqueda inteligente del PDF real ─────────────────────────────────────────
//
// Estrategia (en orden de prioridad):
//   1. Documentos adjuntos en el detalle BDNS — el texto oficial de la convocatoria
//      (usando /api/convocatorias/documentos?idDocumento={doc.id}&vpd=GE)
//   2. urlBasesReguladoras del detalle BDNS (PDF externo de bases reguladoras)
//   3. Extracto BDNS con el id INTERNO correcto (/api/convocatorias/pdf?id={conv.id}&vpd=GE)
//   4. Scrape de la página web de infosubvenciones como último recurso

async function buscarPdfReal(bdnsId, detalle) {
  const intentos = [];

  // 1. Documentos adjuntos — el más valioso: texto oficial de la convocatoria
  //    Elegir el doc en castellano (o el primero disponible) con mayor tamaño
  const docs = Array.isArray(detalle?.documentos) ? detalle.documentos : [];
  const docsCastellano = docs
    .filter(d => d.id && d.nombreFic)
    .sort((a, b) => {
      // Priorizar: texto en castellano > mayor tamaño
      const aCast = /castellan|español|texto/i.test(a.descripcion ?? '') ? 1 : 0;
      const bCast = /castellan|español|texto/i.test(b.descripcion ?? '') ? 1 : 0;
      if (bCast !== aCast) return bCast - aCast;
      return (b.long ?? 0) - (a.long ?? 0);
    });

  for (const doc of docsCastellano.slice(0, 3)) {
    intentos.push({
      url: `${BDNS_BASE}/convocatorias/documentos?idDocumento=${doc.id}&vpd=GE`,
      fuente: `doc_bdns:${doc.descripcion ?? doc.nombreFic}`,
      prioridad: 1,
    });
  }

  // 2. urlBasesReguladoras del detalle (PDF externo de las bases reguladoras)
  const basesUrl = detalle?.urlBasesReguladoras ?? detalle?.basesReguladoras
    ?? detalle?.bases_reguladoras ?? detalle?.urlBases;
  if (basesUrl && basesUrl.startsWith('http')) {
    intentos.push({ url: basesUrl, fuente: 'bases_reguladoras', prioridad: 2 });
  }

  // 3. Extracto BDNS con id INTERNO correcto (no usar bdns_id aquí)
  //    detalle.id es el id interno; si no lo tenemos, usar bdns_id como fallback
  const internalId = detalle?.id ?? bdnsId;
  intentos.push({
    url: `${BDNS_BASE}/convocatorias/pdf?id=${internalId}&vpd=GE`,
    fuente: 'extracto_bdns',
    prioridad: 3,
  });
  // Fallback con bdns_id si el id interno es diferente
  if (String(internalId) !== String(bdnsId)) {
    intentos.push({
      url: `${BDNS_BASE}/convocatorias/pdf?id=${bdnsId}&vpd=GE`,
      fuente: 'extracto_bdns_num',
      prioridad: 4,
    });
  }

  // Ordenar y probar
  intentos.sort((a, b) => a.prioridad - b.prioridad);

  for (const intento of intentos) {
    const resultado = await intentarDescargarPdf(intento.url, bdnsId);
    if (resultado) {
      return { ...resultado, fuente: intento.fuente, url: intento.url };
    }
  }

  // 4. Fallback: scrape de la página web de infosubvenciones
  const scrapedUrl = await scrapeInfosubvencionesPdf(bdnsId);
  if (scrapedUrl) {
    const resultado = await intentarDescargarPdf(scrapedUrl, bdnsId);
    if (resultado) {
      return { ...resultado, fuente: 'scrape_web', url: scrapedUrl };
    }
  }

  return null;
}

async function intentarDescargarPdf(url, _bdnsId) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'AyudaPyme-Bot/2.0' },
      signal: AbortSignal.timeout(30_000),
      redirect: 'follow',
    });

    if (!res.ok) return null;

    const ct = res.headers.get('content-type') ?? '';
    // Rechazar respuestas HTML (la web de BDNS a veces devuelve HTML en vez de PDF)
    if (ct.includes('text/html') || ct.includes('text/plain')) return null;

    const buffer = await res.arrayBuffer();
    // PDF mínimo viable: al menos 500 bytes y empieza con %PDF
    if (buffer.byteLength < 500) return null;

    const header = new Uint8Array(buffer.slice(0, 5));
    const isPdf = header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46; // %PDF
    if (!isPdf && !ct.includes('pdf') && !ct.includes('octet-stream')) return null;

    return { buffer, size: buffer.byteLength, contentType: ct };
  } catch {
    return null;
  }
}

async function scrapeInfosubvencionesPdf(bdnsId) {
  try {
    const pageUrl = `${BDNS_WEB}/${bdnsId}`;
    const res = await fetch(pageUrl, {
      headers: { 'User-Agent': 'AyudaPyme-Bot/2.0' },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) return null;
    const html = await res.text();

    // Buscar enlaces a PDF en el HTML
    const pdfPatterns = [
      // Enlace directo a PDF
      /href=["']([^"']*\.pdf[^"']*)/gi,
      // Enlace a descarga de documento BDNS
      /href=["']([^"']*convocatorias\/pdf[^"']*)/gi,
      // Enlace genérico con "documento" o "bases"
      /href=["']([^"']*(?:documento|bases|convocatoria)[^"']*\.pdf)/gi,
      // API de documentos
      /href=["']([^"']*api[^"']*pdf[^"']*)/gi,
    ];

    for (const pattern of pdfPatterns) {
      const match = pattern.exec(html);
      if (match && match[1]) {
        let url = match[1];
        if (url.startsWith('/')) {
          url = `https://www.infosubvenciones.es${url}`;
        }
        return url;
      }
    }

    return null;
  } catch {
    return null;
  }
}

// ─── Extraer datos del HTML cuando no hay PDF ──────────────────────────────────

async function extraerDatosDesdeHtml(bdnsId, detalle) {
  // Intentar obtener la página web y extraer lo que se pueda
  // Construir campos básicos desde detalle BDNS
  const campos = {
    beneficiarios_tipo: null,
    cnae_incluidos: null,
    cnae_excluidos: null,
    tamano_max_empleados: null,
    antiguedad_min_anos: null,
    localizacion: null,
    inversion_minima: null,
    importe_maximo: detalle?.importeMaximo ?? detalle?.importeTotal ?? null,
    porcentaje_ayuda: null,
    gastos_subvencionables: null,
    gastos_excluidos: null,
    fecha_fin_solicitud: detalle?.fechaFinSolicitud
      ? detalle.fechaFinSolicitud.split('T')[0]
      : null,
    plazo_ejecucion_meses: null,
    criterios_concesion: null,
    incompatibilidades: null,
  };

  // Intentar extraer del detalle BDNS lo que haya
  if (detalle?.descripcion) {
    const desc = detalle.descripcion.toLowerCase();
    if (desc.includes('autónom') || desc.includes('autonomo')) campos.beneficiarios_tipo = 'autónomos';
    else if (desc.includes('micropyme')) campos.beneficiarios_tipo = 'micropyme';
    else if (desc.includes('pyme') || desc.includes('pequeña')) campos.beneficiarios_tipo = 'pyme';
    else if (desc.includes('empresa')) campos.beneficiarios_tipo = 'pyme';
  }

  if (detalle?.nivel2) {
    campos.localizacion = [detalle.nivel2];
  } else if (detalle?.nivel1?.toUpperCase().includes('ESTATAL')) {
    campos.localizacion = ['Nacional'];
  }

  return campos;
}

// ─── Supabase Storage: subir PDF ───────────────────────────────────────────────

async function subirPdfAStorage(bdnsId, pdfBuffer) {
  const hash = sha256hex(pdfBuffer).slice(0, 12);
  const path = `${bdnsId}/convocatoria_${hash}.pdf`;

  const { error } = await sb.storage
    .from(STORAGE_BUCKET)
    .upload(path, Buffer.from(pdfBuffer), {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (error) {
    log('storage', bdnsId, `Error subiendo PDF: ${error.message}`, 'warn');
    return null;
  }

  return path;
}

// ─── Prompt Gemini: extracción de 15 campos estructurados ─────────────────────

const SYSTEM_PROMPT_15 = `Eres un extractor de datos especializado en convocatorias de subvenciones y ayudas públicas españolas.
Tu trabajo es analizar el PDF de una convocatoria y extraer EXACTAMENTE 15 campos estructurados.

REGLAS ESTRICTAS:
1. NUNCA inventes datos. Si algo no aparece en el documento, usa null.
2. Las fechas deben estar en formato ISO YYYY-MM-DD.
3. Los importes deben ser números en euros (50000, no "50.000 €").
4. Los arrays vacíos deben ser [] si el campo aplica pero no hay datos, o null si no aplica.
5. Lee el documento completo antes de responder — muchos datos están al final.
6. Si el documento menciona "todos los sectores" o similar, pon cnae_incluidos: "todos".
7. Para porcentaje_ayuda, extrae el porcentaje principal (ej: "hasta el 80%" → 80).
8. Para gastos_subvencionables y gastos_excluidos, sé específico y conciso.`;

const USER_PROMPT_15 = `Analiza esta convocatoria de subvención pública española y extrae EXACTAMENTE estos 15 campos.
Devuelve ÚNICAMENTE un objeto JSON válido sin texto adicional, sin markdown, sin comentarios:

{
  "beneficiarios_tipo": "autónomos | micropyme | pyme | gran_empresa | null (quién puede pedir la ayuda)",
  "cnae_incluidos": ["6201", "4321"] | "todos" | null,
  "cnae_excluidos": ["9200"] | null,
  "tamano_max_empleados": 250 | null,
  "antiguedad_min_anos": 2 | null,
  "localizacion": ["Galicia", "Pontevedra"] | ["Nacional"] | null,
  "inversion_minima": 10000 | null,
  "importe_maximo": 50000 | null,
  "porcentaje_ayuda": 80 | null,
  "gastos_subvencionables": ["Personal técnico", "Equipamiento", "Consultoría externa"] | null,
  "gastos_excluidos": ["IVA recuperable", "Gastos financieros"] | null,
  "fecha_fin_solicitud": "2026-06-30" | null,
  "plazo_ejecucion_meses": 18 | null,
  "criterios_concesion": ["Viabilidad técnica (30 puntos)", "Impacto empleo (20 puntos)"] | null,
  "incompatibilidades": ["No compatible con ayuda X del mismo organismo"] | null
}

IMPORTANTE:
- beneficiarios_tipo: usa exactamente uno de: autónomos, micropyme, pyme, gran_empresa. Si aplica a varios, usa el más amplio.
- cnae_incluidos: si dice "todos los sectores" o no restringe, pon "todos". Si lista CNAEs específicos, ponlos como array.
- localizacion: CCAA o provincias donde debe estar domiciliada la empresa. Si es nacional, pon ["Nacional"].
- gastos_subvencionables/excluidos: array de strings cortos y descriptivos.
- criterios_concesion: incluye los puntos/porcentajes si aparecen (ej: "Innovación (40 pts)").
- fecha_fin_solicitud: la fecha límite para presentar solicitudes.`;

// ─── Gemini: análisis del PDF ─────────────────────────────────────────────────

async function analizarPdfConGemini(pdfBuffer, apiKey, bdnsId, intentos = 3) {
  const base64 = Buffer.from(pdfBuffer).toString('base64');

  const body = {
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: 'application/pdf', data: base64 } },
        { text: USER_PROMPT_15 },
      ],
    }],
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT_15 }] },
    generationConfig: {
      temperature: 0.05,
      maxOutputTokens: 16384,
      topP: 0.95,
      responseMimeType: 'application/json',
    },
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
        const msg = `Gemini ${res.status}: ${err?.error?.message ?? 'error desconocido'}`;
        if (res.status === 429 || res.status >= 500) {
          lastErr = new Error(msg);
          const wait = intento * 3000;
          console.warn(`  ⚠️ [${bdnsId}] Gemini intento ${intento}/${intentos}: ${msg} — reintentando en ${wait/1000}s`);
          await new Promise(r => setTimeout(r, wait));
          continue;
        }
        throw new Error(msg);
      }

      const data = await res.json();
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      if (!raw) throw new Error('Gemini devolvió respuesta vacía');

      const parsed = extraerJSON(raw);
      return normalizarCampos(parsed);
    } catch (err) {
      lastErr = err;
      if (intento < intentos && (err.name === 'TimeoutError' || err.message?.includes('fetch'))) {
        const wait = intento * 3000;
        console.warn(`  ⚠️ [${bdnsId}] Gemini intento ${intento}/${intentos}: ${err.message} — reintentando en ${wait/1000}s`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

function normalizarCampos(p) {
  return {
    beneficiarios_tipo: normalizarBeneficiarioTipo(p.beneficiarios_tipo),
    cnae_incluidos: p.cnae_incluidos === 'todos' ? 'todos'
      : Array.isArray(p.cnae_incluidos) ? p.cnae_incluidos.map(String)
      : null,
    cnae_excluidos: Array.isArray(p.cnae_excluidos) ? p.cnae_excluidos.map(String) : null,
    tamano_max_empleados: typeof p.tamano_max_empleados === 'number' ? p.tamano_max_empleados : null,
    antiguedad_min_anos: typeof p.antiguedad_min_anos === 'number' ? p.antiguedad_min_anos
      : typeof p.antiguedad_min_años === 'number' ? p.antiguedad_min_años
      : null,
    localizacion: Array.isArray(p.localizacion) ? p.localizacion : null,
    inversion_minima: typeof p.inversion_minima === 'number' ? p.inversion_minima : null,
    importe_maximo: typeof p.importe_maximo === 'number' ? p.importe_maximo : null,
    porcentaje_ayuda: typeof p.porcentaje_ayuda === 'number' ? p.porcentaje_ayuda : null,
    gastos_subvencionables: Array.isArray(p.gastos_subvencionables) ? p.gastos_subvencionables : null,
    gastos_excluidos: Array.isArray(p.gastos_excluidos) ? p.gastos_excluidos : null,
    fecha_fin_solicitud: normalizarFecha(p.fecha_fin_solicitud),
    plazo_ejecucion_meses: typeof p.plazo_ejecucion_meses === 'number' ? p.plazo_ejecucion_meses : null,
    criterios_concesion: Array.isArray(p.criterios_concesion) ? p.criterios_concesion : null,
    incompatibilidades: Array.isArray(p.incompatibilidades) ? p.incompatibilidades : null,
  };
}

function normalizarBeneficiarioTipo(val) {
  if (!val || typeof val !== 'string') return null;
  const v = val.toLowerCase().replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e')
    .replace(/[íìï]/g, 'i').replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u');
  if (v.includes('autonom')) return 'autónomos';
  if (v.includes('micropyme') || v.includes('micro')) return 'micropyme';
  if (v.includes('gran')) return 'gran_empresa';
  if (v.includes('pyme') || v.includes('pequeñ') || v.includes('median')) return 'pyme';
  return val; // devolver tal cual si no matchea
}

// Mapea el array tipos_beneficiario_api del BDNS a nuestro enum de beneficiarios_tipo
function normalizarBeneficiarioTipoDesdeApi(bens) {
  const joined = bens.join(' ').toLowerCase();
  // Orden: más restrictivo primero
  if (joined.includes('microempresa') || joined.includes('micro')) return 'micropyme';
  if (joined.includes('pyme') || joined.includes('pequeña') || joined.includes('mediana') || joined.includes('personas físicas que desarrollan')) return 'pyme';
  if (joined.includes('gran empresa') || joined.includes('grandes empresas')) return 'gran_empresa';
  if (joined.includes('autónom') || joined.includes('autonomo') || joined.includes('personas físicas que no desarrollan')) return 'autónomos';
  // Mezclas: si hay PYME + gran empresa, usar 'pyme' (más restrictivo como target)
  if (joined.includes('empresa')) return 'pyme';
  return null;
}

function normalizarFecha(val) {
  if (!val) return null;
  // Ya en formato ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  // Intentar parsear
  try {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  } catch { /* */ }
  return null;
}

// ─── Worker pool ───────────────────────────────────────────────────────────────

function crearSemaforo(max) {
  let activos = 0;
  const cola = [];
  return {
    acquire() {
      if (activos < max) { activos++; return Promise.resolve(); }
      return new Promise(resolve => cola.push(resolve));
    },
    release() {
      activos--;
      if (cola.length) { activos++; cola.shift()(); }
    },
  };
}

// ─── Procesamiento de una convocatoria ─────────────────────────────────────────

async function procesarConvocatoria(conv, apiKey, semaforo) {
  await semaforo.acquire();
  const bdnsId = String(conv.numeroConvocatoria ?? conv.bdns_id ?? conv);

  try {
    // 1. Verificar si ya está procesada (salvo --forzar)
    const { data: sub } = await sb.from('subvenciones')
      .select('id, pdf_procesado, pdf_disponible, titulo')
      .eq('bdns_id', bdnsId)
      .maybeSingle();

    if (sub?.pdf_procesado && !FORZAR) {
      return { resultado: 'skip', bdnsId, razon: 'ya_procesado' };
    }

    // 2. Si no existe en BD, crear entrada básica
    let subvencionId = sub?.id;
    if (!subvencionId) {
      // Obtener datos básicos de BDNS
      const detalle = await fetchBdnsDetalle(bdnsId);
      const { data: newSub, error } = await sb.from('subvenciones').insert({
        bdns_id: bdnsId,
        fuente: 'bdns',
        titulo: detalle?.descripcion ?? conv.descripcion ?? `Convocatoria ${bdnsId}`,
        organismo: detalle?.nivel3 ?? detalle?.nivel2 ?? conv.nivel3 ?? null,
        fecha_publicacion: detalle?.fechaRecepcion ? detalle.fechaRecepcion.split('T')[0] : null,
        estado_convocatoria: 'desconocido',
        pipeline_estado: 'raw',
        pipeline_fase: 'pendiente',
        pdf_procesado: false,
        pdf_disponible: true,
      }).select('id').single();

      if (error) throw new Error(`Insert subvencion: ${error.message}`);
      subvencionId = newSub.id;
    }

    // 3. Obtener detalle de BDNS para buscar URLs de PDF
    log('detalle', bdnsId, 'Obteniendo detalle BDNS...', 'info');
    const detalle = await fetchBdnsDetalle(bdnsId);

    // 4. Buscar y descargar el PDF real
    log('pdf', bdnsId, 'Buscando PDF real...', 'pdf');
    const pdfResult = await buscarPdfReal(bdnsId, detalle);

    if (!pdfResult) {
      // Sin PDF disponible — extraer lo que se pueda del HTML/detalle
      log('pdf', bdnsId, 'PDF no disponible — extrayendo desde HTML/detalle', 'warn');

      const camposHtml = await extraerDatosDesdeHtml(bdnsId, detalle);

      await sb.from('subvenciones').update({
        pdf_disponible: false,
        pdf_procesado: false,
        campos_extraidos: camposHtml,
        pipeline_estado: 'sin_pdf',
        pipeline_error: 'PDF no disponible en ninguna fuente',
        updated_at: new Date().toISOString(),
      }).eq('id', subvencionId);

      return { resultado: 'sin_pdf', bdnsId, campos: Object.keys(camposHtml).filter(k => camposHtml[k] != null).length };
    }

    log('pdf', bdnsId, `PDF encontrado: ${pdfResult.fuente} (${(pdfResult.size / 1024).toFixed(0)}KB)`, 'ok');

    // 5. Subir PDF a Supabase Storage
    const storagePath = await subirPdfAStorage(bdnsId, pdfResult.buffer);
    if (storagePath) {
      log('storage', bdnsId, `Almacenado: ${storagePath}`, 'ok');
    }

    // 6. Enviar a Gemini para extracción de 15 campos
    log('gemini', bdnsId, 'Enviando a Gemini...', 'fase');
    const campos = await analizarPdfConGemini(pdfResult.buffer, apiKey, bdnsId);

    // 7. Guardar resultados en BD
    const update = {
      pdf_url: pdfResult.url,
      pdf_procesado: true,
      pdf_disponible: true,
      campos_extraidos: campos,
      ia_modelo: MODELO,
      ia_procesado_at: new Date().toISOString(),
      pipeline_estado: 'normalizado',
      pipeline_fase: 'completado',
      pipeline_error: null,
      updated_at: new Date().toISOString(),
    };

    // Campos desde Gemini PDF
    if (campos.importe_maximo != null) update.importe_maximo = campos.importe_maximo;
    if (campos.fecha_fin_solicitud) update.plazo_fin = campos.fecha_fin_solicitud;
    if (campos.porcentaje_ayuda != null) update.porcentaje_financiacion = campos.porcentaje_ayuda;
    if (campos.localizacion?.length) {
      const loc = campos.localizacion[0];
      if (loc === 'Nacional') {
        update.ambito_geografico = 'nacional';
      } else {
        update.ambito_geografico = 'autonomico';
        update.comunidad_autonoma = loc;
      }
    }

    // Enriquecer con campos del API oficial BDNS (más fiables que el PDF para estos campos)
    if (detalle) {
      // presupuestoTotal si Gemini no extrajo importe
      if (update.importe_maximo == null && detalle.presupuestoTotal) {
        update.presupuesto_total = detalle.presupuestoTotal;
      }
      // Fechas de solicitud desde el API (más fiables que PDF)
      if (detalle.fechaFinSolicitud && !update.plazo_fin) {
        update.plazo_fin = detalle.fechaFinSolicitud.split('T')[0];
      }
      if (detalle.fechaInicioSolicitud && !update.plazo_inicio) {
        update.plazo_inicio = detalle.fechaInicioSolicitud.split('T')[0];
      }
      // URL oficial (sede electrónica)
      if (detalle.sedeElectronica) {
        update.url_oficial = detalle.sedeElectronica;
      }
      // Tipos de beneficiario y sectores van en campos_extraidos (JSONB)
      const bens = (detalle.tiposBeneficiarios ?? []).map(b => b.descripcion).filter(Boolean);
      const sects = (detalle.sectores ?? []).map(s => s.descripcion ?? s.codigo).filter(Boolean);
      if (bens.length || sects.length) {
        const camposExistentes = update.campos_extraidos ?? {};
        if (bens.length) camposExistentes.tipos_beneficiario_api = bens;
        if (sects.length) camposExistentes.sectores_api = sects;
        // Si Gemini no extrajo beneficiarios_tipo, derivarlo desde el API
        if (!camposExistentes.beneficiarios_tipo && bens.length) {
          camposExistentes.beneficiarios_tipo = normalizarBeneficiarioTipoDesdeApi(bens);
        }
        update.campos_extraidos = camposExistentes;
      }
      // Regiones desde el API → comunidad_autonoma
      if (!update.comunidad_autonoma) {
        const regNames = (detalle.regiones ?? []).map(r => r.descripcion).filter(Boolean);
        if (regNames.length && !regNames.some(r => r.includes('ES - ESPAÑA'))) {
          update.comunidad_autonoma = regNames[0];
          update.ambito_geografico = 'autonomico';
        } else if (regNames.some(r => r.includes('ES - ESPAÑA'))) {
          update.ambito_geografico = 'nacional';
        }
      }
    }

    const { error: updateErr } = await sb.from('subvenciones')
      .update(update)
      .eq('id', subvencionId);

    if (updateErr) throw new Error(`Update subvenciones: ${updateErr.message}`);

    // Resumen
    const camposNoNull = Object.entries(campos).filter(([, v]) => v != null).length;
    const importe = campos.importe_maximo ? ` | ${(campos.importe_maximo / 1000).toFixed(0)}K€` : '';
    const plazo = campos.fecha_fin_solicitud ? ` | hasta ${campos.fecha_fin_solicitud}` : '';

    log('completo', bdnsId, `${camposNoNull}/15 campos${importe}${plazo}`, 'ok');

    return {
      resultado: 'ok',
      bdnsId,
      camposExtraidos: camposNoNull,
      fuente: pdfResult.fuente,
      importe: campos.importe_maximo,
      fechaFin: campos.fecha_fin_solicitud,
    };

  } catch (err) {
    // Si el PDF existe pero está vacío, marcarlo como procesado para no reintentar
    const esPdfVacio = err.message?.includes('no pages') || err.message?.includes('no tiene páginas');
    await sb.from('subvenciones')
      .update({
        pipeline_estado: 'error',
        pipeline_error: err.message?.slice(0, 500),
        // Marcar como procesado si el PDF está vacío (evita reintentos infinitos)
        ...(esPdfVacio ? { pdf_procesado: true } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('bdns_id', bdnsId);

    log('error', bdnsId, err.message?.slice(0, 100), 'error');
    return { resultado: 'error', bdnsId, error: err.message };

  } finally {
    semaforo.release();
  }
}

// ─── MAIN ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n📄 Pipeline PDF Real v1.0 — Extracción de 15 campos desde PDF oficial');
  console.log(`   Modelo: ${MODELO} | Workers: ${WORKERS} | Storage: ${STORAGE_BUCKET}`);

  const apiKey = await getGeminiKey();
  console.log('   Gemini API: ✓\n');

  let convocatorias = [];

  if (BDNS_ID) {
    // Modo single
    console.log(`📋 Modo single: bdns_id=${BDNS_ID}`);
    convocatorias = [{ bdns_id: BDNS_ID }];

  } else if (MODO_ALL) {
    // Buscar todas sin procesar (o todas si --forzar)
    let q = sb.from('subvenciones').select('bdns_id').not('bdns_id', 'is', null).order('created_at', { ascending: false }).limit(10000);
    if (!FORZAR) q = q.or('pdf_procesado.eq.false,pdf_procesado.is.null');
    const { data } = await q;

    convocatorias = data ?? [];
    console.log(`📋 Modo all${FORZAR ? ' (forzar todos)' : ''}: ${convocatorias.length} subvenciones`);

  } else {
    // Modo por fechas: fetch de BDNS API
    const hasta = new Date();
    const desde = new Date();
    desde.setDate(desde.getDate() - DIAS);
    // BDNS API requires DD/MM/YYYY format (ISO YYYY-MM-DD returns 400)
    const fmt = d => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;

    const raw = await listarConvocatorias(fmt(desde), fmt(hasta));
    convocatorias = raw.map(c => ({
      ...c,
      bdns_id: String(c.numeroConvocatoria ?? c.id),
      numeroConvocatoria: c.numeroConvocatoria ?? c.id,
    }));
  }

  if (!convocatorias.length) {
    console.log('\nNo hay convocatorias que procesar.');
    return;
  }

  console.log(`\n⚡ Procesando ${convocatorias.length} convocatorias con ${WORKERS} workers\n`);
  console.log('   Flujo: BDNS detalle → Buscar PDF → Descargar → Gemini 15 campos → Storage → BD\n');

  const semaforo = crearSemaforo(WORKERS);
  const inicio = Date.now();
  let ok = 0, sinPdf = 0, skip = 0, errores = 0;

  const promises = convocatorias.map(conv =>
    procesarConvocatoria(conv, apiKey, semaforo)
  );

  const resultados = await Promise.allSettled(promises);

  // ─── Resumen ─────────────────────────────────────────────────────────────────

  console.log(`\n${'─'.repeat(70)}`);

  for (const r of resultados) {
    if (r.status === 'rejected') { errores++; continue; }
    const res = r.value;
    switch (res.resultado) {
      case 'ok': ok++; break;
      case 'sin_pdf': sinPdf++; break;
      case 'skip': skip++; break;
      default: errores++;
    }
  }

  const secs = ((Date.now() - inicio) / 1000).toFixed(1);
  console.log(`\n📊 Resumen Pipeline PDF Real:`);
  console.log(`   ✅ Procesadas: ${ok}`);
  console.log(`   📄 Sin PDF:    ${sinPdf}`);
  console.log(`   ⏭️  Skip:      ${skip}`);
  console.log(`   ❌ Errores:    ${errores}`);
  console.log(`   ⏱️  Tiempo:    ${secs}s`);
  console.log(`   🤖 Modelo:    ${MODELO}`);

  if (ok > 0) {
    console.log('\n💡 Próximos pasos:');
    console.log('   node scripts/run-matching.mjs --all     # Recalcular matches con datos nuevos');
    console.log('   node scripts/pipeline-pdf-real.mjs --all  # Procesar el resto');
  }

  if (sinPdf > 0) {
    console.log(`\n⚠️  ${sinPdf} convocatorias sin PDF. Consulta:`);
    console.log(`   SELECT bdns_id, titulo FROM subvenciones WHERE pdf_disponible = false;`);
  }
}

main().catch(err => {
  console.error('\n💥 Error fatal:', err.message);
  process.exit(1);
});
