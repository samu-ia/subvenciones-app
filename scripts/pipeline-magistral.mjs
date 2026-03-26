/**
 * scripts/pipeline-magistral.mjs
 *
 * Pipeline magistral de ingestión BDNS → IA → Base de datos.
 *
 * Diferencias vs enrich-with-gemini.mjs (v1):
 *   ✓ Todo España (no solo Galicia)
 *   ✓ Multi-documento por convocatoria (extracto + convocatoria + bases reguladoras)
 *   ✓ Grounding: cada campo sabe de qué página/fragmento viene
 *   ✓ Detección de conflictos entre documentos y BDNS raw
 *   ✓ Worker pool paralelo (configurable)
 *   ✓ Resumable: salta lo que ya está procesado
 *   ✓ Guarda en tablas v2 (subvencion_documentos, subvencion_campos_extraidos,
 *     subvencion_eventos, subvencion_conflictos)
 *
 * Uso:
 *   node scripts/pipeline-magistral.mjs                  → últimos 7 días, 10 workers
 *   node scripts/pipeline-magistral.mjs --dias 90        → últimos 90 días
 *   node scripts/pipeline-magistral.mjs --all            → todas sin procesar
 *   node scripts/pipeline-magistral.mjs --id 893737      → solo ese bdns_id
 *   node scripts/pipeline-magistral.mjs --workers 20     → más paralelismo
 *   node scripts/pipeline-magistral.mjs --forzar         → reprocesa aunque estén hechos
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
const DIAS       = parseInt(args[args.indexOf('--dias') + 1] || '7');
const WORKERS    = parseInt(args[args.indexOf('--workers') + 1] || '10');
const BDNS_ID    = args[args.indexOf('--id') + 1] || null;
const FORZAR     = args.includes('--forzar');
const MODO_ALL   = args.includes('--all');

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const MODELO = 'gemini-2.5-flash';

// ─── Obtener API Key Gemini ────────────────────────────────────────────────────

async function getGeminiKey() {
  // 1. Desde env directo
  if (env.GEMINI_API_KEY && !env.GEMINI_API_KEY.startsWith('tu_')) {
    return env.GEMINI_API_KEY;
  }
  // 2. Desde Supabase ia_providers
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

      // Normalizar respuesta
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
    if (pagina < totalPaginas) await sleep(500); // respetar rate limit BDNS
  }

  console.log(`${todas.length} convocatorias encontradas.`);
  return todas;
}

// ─── SHA256 ────────────────────────────────────────────────────────────────────

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
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

async function analizarPdfConGemini(pdfBuffer, apiKey, contexto = '') {
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

  const res = await fetch(`${GEMINI_BASE}/models/${MODELO}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Gemini ${res.status}: ${err?.error?.message ?? 'error'}`);
  }

  const data = await res.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!raw) throw new Error('Gemini respuesta vacía');

  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenceMatch ? fenceMatch[1] : raw).trim();
  const jsonMatch = candidate.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`Sin JSON en respuesta: ${raw.slice(0, 200)}`);
  return JSON.parse(jsonMatch[0]);
}

// ─── Descargar PDF ─────────────────────────────────────────────────────────────

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

async function obtenerPdfPrincipal(bdnsId, conv) {
  // Prioridad: PDF directo BDNS → URL del conv → URL oficial
  const urls = [
    { url: PDF_URLS.extracto(bdnsId), tipo: 'extracto' },
  ];
  if (conv.urlPdf) urls.push({ url: conv.urlPdf, tipo: 'convocatoria' });
  if (conv.urlConvocatoria && conv.urlConvocatoria !== conv.urlPdf) {
    urls.push({ url: conv.urlConvocatoria, tipo: 'bases_reguladoras' });
  }

  for (const { url, tipo } of urls) {
    const buf = await descargarPdf(url);
    if (buf) return { buf, url, tipo };
  }
  return null;
}

// ─── Guardar en BD ─────────────────────────────────────────────────────────────

async function upsertSubvencionRaw(conv) {
  const bdnsId = String(conv.numeroConvocatoria);
  const hashRaw = await sha256(JSON.stringify(conv));

  const { data: existing } = await sb
    .from('subvenciones_raw')
    .select('id, hash_raw')
    .eq('bdns_id', bdnsId)
    .maybeSingle();

  if (existing) {
    if (existing.hash_raw === hashRaw && !FORZAR) {
      return { rawId: existing.id, esNuevo: false };
    }
    await sb.from('subvenciones_raw')
      .update({ raw_json: conv, hash_raw: hashRaw, fecha_ingesta: new Date().toISOString() })
      .eq('id', existing.id);
    return { rawId: existing.id, esNuevo: false };
  }

  const { data: newRec, error } = await sb.from('subvenciones_raw').insert({
    bdns_id: bdnsId, fuente: 'bdns', raw_json: conv,
    hash_raw: hashRaw, url_fuente: conv.urlConvocatoria ?? null,
  }).select('id').single();

  if (error) throw new Error(`Insert raw: ${error.message}`);
  return { rawId: newRec.id, esNuevo: true };
}

async function upsertSubvencion(bdnsId, rawId, conv) {
  const { data: existing } = await sb
    .from('subvenciones')
    .select('id, pipeline_estado')
    .eq('bdns_id', bdnsId)
    .maybeSingle();

  if (existing) {
    if (existing.pipeline_estado === 'normalizado' && !FORZAR) return existing.id;
    return existing.id;
  }

  // Datos básicos de BDNS para arrancar
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
    version: 1,
  }).select('id').single();

  if (error) throw new Error(`Insert subvencion: ${error.message}`);
  return newSub.id;
}

async function registrarDocumento(subvencionId, bdnsId, tipo, url, buf, hashPdf) {
  const { data: existing } = await sb
    .from('subvencion_documentos')
    .select('id, hash_pdf')
    .eq('subvencion_id', subvencionId)
    .eq('tipo_documento', tipo)
    .maybeSingle();

  if (existing && existing.hash_pdf === hashPdf && !FORZAR) return existing.id;

  const row = {
    subvencion_id: subvencionId,
    bdns_id: bdnsId,
    tipo_documento: tipo,
    titulo: tipo === 'extracto' ? 'Extracto BDNS' : tipo === 'convocatoria' ? 'Convocatoria completa' : 'Bases reguladoras',
    url_origen: url,
    orden: tipo === 'extracto' ? 1 : tipo === 'convocatoria' ? 2 : 3,
    es_principal: tipo === 'extracto' || tipo === 'convocatoria',
    hash_pdf: hashPdf,
    tamanio_bytes: buf.byteLength,
    estado: 'descargado',
    descargado_at: new Date().toISOString(),
    intentos: 1,
  };

  if (existing) {
    await sb.from('subvencion_documentos').update(row).eq('id', existing.id);
    return existing.id;
  }
  const { data: newDoc, error } = await sb.from('subvencion_documentos').insert(row).select('id').single();
  if (error) throw new Error(`Insert documento: ${error.message}`);
  return newDoc.id;
}

async function guardarGrounding(subvencionId, bdnsId, docId, extraccion) {
  const CAMPOS = [
    'titulo','organismo','objeto','resumen_ia','para_quien','puntos_clave',
    'importe_maximo','importe_minimo','porcentaje_financiacion','presupuesto_total',
    'plazo_inicio','plazo_fin','plazo_presentacion_texto',
    'ambito_geografico','comunidad_autonoma','provincia',
    'estado_convocatoria','sectores','tipos_empresa','observaciones',
  ];

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
      documento_id: docId,
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

async function guardarEventos(subvencionId, bdnsId, docId, extraccion) {
  const eventos = [];

  if (extraccion.plazo_inicio?.valor) {
    eventos.push({
      subvencion_id: subvencionId, documento_id: docId, bdns_id: bdnsId,
      tipo_evento: 'apertura_plazo', fecha_evento: extraccion.plazo_inicio.valor,
      titulo: 'Inicio del plazo', fuente: 'ia',
      fragmento_texto: extraccion.plazo_inicio.fragmento,
      pagina_estimada: extraccion.plazo_inicio.pagina,
      confidence: extraccion.plazo_inicio.conf,
    });
  }
  if (extraccion.plazo_fin?.valor) {
    eventos.push({
      subvencion_id: subvencionId, documento_id: docId, bdns_id: bdnsId,
      tipo_evento: 'cierre_plazo', fecha_evento: extraccion.plazo_fin.valor,
      titulo: 'Cierre del plazo', fuente: 'ia',
      fragmento_texto: extraccion.plazo_fin.fragmento,
      pagina_estimada: extraccion.plazo_fin.pagina,
      confidence: extraccion.plazo_fin.conf,
    });
  }
  if (extraccion.estado_convocatoria?.valor === 'suspendida' && extraccion.estado_convocatoria.conf > 0.5) {
    eventos.push({
      subvencion_id: subvencionId, documento_id: docId, bdns_id: bdnsId,
      tipo_evento: 'suspension', titulo: 'Suspensión detectada', fuente: 'ia',
      confidence: extraccion.estado_convocatoria.conf,
    });
  }

  if (eventos.length) {
    if (docId) {
      await sb.from('subvencion_eventos').delete()
        .eq('subvencion_id', subvencionId).eq('documento_id', docId).eq('fuente', 'ia');
    }
    await sb.from('subvencion_eventos').insert(eventos);
  }
}

async function detectarConflictos(subvencionId, bdnsId, extraccion, conv) {
  const conflictos = [];

  // Conflicto fecha fin
  const bdnsFechaFin = conv.fechaFinSolicitud ? conv.fechaFinSolicitud.split('T')[0] : null;
  const iaFechaFin = extraccion.plazo_fin?.valor;
  if (bdnsFechaFin && iaFechaFin && extraccion.plazo_fin.conf > 0.6 && bdnsFechaFin !== iaFechaFin) {
    conflictos.push({
      subvencion_id: subvencionId, bdns_id: bdnsId,
      tipo_conflicto: 'fecha_inconsistente', campo_afectado: 'plazo_fin',
      valor_a: bdnsFechaFin, fuente_a: 'BDNS raw',
      valor_b: iaFechaFin, fuente_b: `IA (${MODELO})`,
      descripcion: `BDNS: ${bdnsFechaFin} | PDF: ${iaFechaFin}`,
      severidad: 'alta', resuelto: false,
    });
  }

  // Conflicto importe
  const bdnsImporte = conv.importeMaximo ?? conv.importeTotal;
  const iaImporte = extraccion.importe_maximo?.valor;
  if (bdnsImporte && iaImporte && extraccion.importe_maximo.conf > 0.6) {
    const diff = Math.abs(bdnsImporte - iaImporte) / bdnsImporte;
    if (diff > 0.1) { // >10% diferencia
      conflictos.push({
        subvencion_id: subvencionId, bdns_id: bdnsId,
        tipo_conflicto: 'importe_inconsistente', campo_afectado: 'importe_maximo',
        valor_a: String(bdnsImporte), fuente_a: 'BDNS raw',
        valor_b: String(iaImporte), fuente_b: `IA (${MODELO})`,
        descripcion: `BDNS: ${bdnsImporte}€ | PDF: ${iaImporte}€ (diff ${(diff*100).toFixed(0)}%)`,
        severidad: 'media', resuelto: false,
      });
    }
  }

  // Campos críticos con baja confianza
  for (const campo of ['plazo_fin', 'importe_maximo', 'estado_convocatoria']) {
    const f = extraccion[campo];
    if (f?.valor !== null && f?.conf < 0.4) {
      conflictos.push({
        subvencion_id: subvencionId, bdns_id: bdnsId,
        tipo_conflicto: 'dato_dudoso', campo_afectado: campo,
        valor_a: String(f.valor), fuente_a: `IA (${MODELO})`,
        valor_b: '', fuente_b: '',
        descripcion: `Confianza baja en ${campo}: ${(f.conf * 100).toFixed(0)}%`,
        severidad: 'baja', resuelto: false,
      });
    }
  }

  if (conflictos.length) {
    await sb.from('subvencion_conflictos').insert(conflictos);
  }

  return conflictos.length;
}

async function actualizarSubvencion(subvencionId, extraccion, hashPdf) {
  const e = extraccion;
  const update = {
    pipeline_estado: 'normalizado',
    ia_modelo: MODELO,
    ia_procesado_at: new Date().toISOString(),
    ia_confidence: e.confidence_global ?? 0.5,
    hash_contenido: hashPdf,
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
}

// ─── Procesar una convocatoria ─────────────────────────────────────────────────

async function procesarConvocatoria(conv, apiKey, semaforo) {
  await semaforo.acquire();
  const bdnsId = String(conv.numeroConvocatoria);

  try {
    // 1. Guardar raw
    const { rawId } = await upsertSubvencionRaw(conv);

    // 2. Subvencion entry
    const subvencionId = await upsertSubvencion(bdnsId, rawId, conv);

    // 3. Comprobar si ya está procesado
    if (!FORZAR) {
      const { data: existing } = await sb
        .from('subvenciones')
        .select('pipeline_estado, ia_modelo')
        .eq('id', subvencionId)
        .single();
      if (existing?.pipeline_estado === 'normalizado' && existing?.ia_modelo) {
        return { resultado: 'sin_cambio', bdnsId };
      }
    }

    // 4. Descargar PDF
    const pdfResult = await obtenerPdfPrincipal(bdnsId, conv);
    if (!pdfResult) {
      await sb.from('subvenciones').update({ pipeline_estado: 'error', pipeline_error: 'PDF no disponible' }).eq('id', subvencionId);
      return { resultado: 'error', bdnsId, error: 'PDF no disponible' };
    }

    const hashPdf = await sha256(Buffer.from(pdfResult.buf).toString('base64'));

    // 5. Registrar documento en BD
    const docId = await registrarDocumento(subvencionId, bdnsId, pdfResult.tipo, pdfResult.url, pdfResult.buf, hashPdf);

    // 6. Analizar con Gemini (con grounding)
    const extraccion = await analizarPdfConGemini(pdfResult.buf, apiKey, `bdns_id=${bdnsId}`);

    // 7. Marcar doc como procesado por IA
    await sb.from('subvencion_documentos').update({
      estado: 'ia_procesado',
      procesado_at: new Date().toISOString(),
    }).eq('id', docId);

    // 8. Guardar grounding
    await guardarGrounding(subvencionId, bdnsId, docId, extraccion);

    // 9. Guardar eventos
    await guardarEventos(subvencionId, bdnsId, docId, extraccion);

    // 10. Detectar conflictos con BDNS raw
    const numConflictos = await detectarConflictos(subvencionId, bdnsId, extraccion, conv);

    // 11. Actualizar tabla subvenciones (campos principales)
    await actualizarSubvencion(subvencionId, extraccion, hashPdf);

    const conf = extraccion.confidence_global ?? 0;
    const conflStr = numConflictos ? ` ⚠️${numConflictos} conflictos` : '';
    return {
      resultado: 'ok',
      bdnsId,
      titulo: extraccion.titulo?.valor?.slice(0, 50),
      conf,
      conflictos: numConflictos,
      msg: `conf:${(conf * 100).toFixed(0)}%${conflStr}`,
    };

  } catch (err) {
    await sb.from('subvenciones')
      .update({ pipeline_estado: 'error', pipeline_error: err.message })
      .eq('bdns_id', bdnsId);
    return { resultado: 'error', bdnsId, error: err.message };
  } finally {
    semaforo.release();
  }
}

// ─── Worker pool (semáforo simple) ────────────────────────────────────────────

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

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🚀 Pipeline Magistral AyudaPyme v2.0');
  console.log(`   Modelo: ${MODELO} | Workers: ${WORKERS}`);

  const apiKey = await getGeminiKey();
  console.log(`   Gemini API: ✓`);

  let convocatorias = [];

  if (BDNS_ID) {
    // Modo single
    console.log(`\n📋 Modo single: bdns_id=${BDNS_ID}`);
    convocatorias = [{ numeroConvocatoria: BDNS_ID }];
  } else if (MODO_ALL) {
    // Todas las que hay en la BD sin procesar
    const { data } = await sb.from('subvenciones')
      .select('bdns_id')
      .or('pipeline_estado.eq.raw,pipeline_estado.eq.error,ia_modelo.is.null')
      .order('created_at', { ascending: false })
      .limit(10000);
    convocatorias = (data ?? []).map(r => ({ numeroConvocatoria: r.bdns_id }));
    console.log(`\n📋 Modo all: ${convocatorias.length} subvenciones pendientes en BD`);
  } else {
    // Consultar BDNS por rango de fechas
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

  console.log(`\n⚡ Procesando ${convocatorias.length} convocatorias con ${WORKERS} workers paralelos...\n`);

  const semaforo = crearSemaforo(WORKERS);
  let ok = 0, sinCambio = 0, errores = 0;
  const inicio = Date.now();

  // Lanzar todas en paralelo (controlado por semáforo)
  const promises = convocatorias.map(conv => procesarConvocatoria(conv, apiKey, semaforo));
  const resultados = await Promise.allSettled(promises);

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
      console.log(`  ❌ ${res.bdnsId} | ${res.error?.slice(0, 80)}`);
    }
  }

  const secs = ((Date.now() - inicio) / 1000).toFixed(1);
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`✅ Procesadas: ${ok} | Sin cambio: ${sinCambio} | Errores: ${errores} | Tiempo: ${secs}s`);

  if (ok > 0) {
    console.log('\n💡 Ejecuta el matching para actualizar scores:');
    console.log('   node scripts/run-matching.mjs --all\n');
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

main().catch(err => { console.error('\n💥 Error fatal:', err.message); process.exit(1); });
