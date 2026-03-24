/**
 * lib/subvenciones/document-manager.ts
 *
 * Gestión multi-documento para una subvención.
 *
 * BDNS publica varios documentos por convocatoria:
 *   · extracto      — resumen en PDF (siempre disponible)
 *   · convocatoria  — texto completo de la convocatoria
 *   · bases_reguladoras — bases que rigen la convocatoria
 *   · correcciones, ampliaciones, resoluciones (se descubren del feed BDNS)
 *
 * Este módulo:
 *   1. Descubre las URLs de cada tipo de documento
 *   2. Descarga cada uno a Supabase Storage (bucket: subvenciones-docs)
 *   3. Extrae el texto con pdfjs-dist
 *   4. Registra todo en subvencion_documentos
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { BdnsConvocatoria, TipoDocumento } from '@/lib/types/subvenciones-pipeline';

// ─── Configuración ────────────────────────────────────────────────────────────

const BUCKET = 'subvenciones-docs';
const BASE_BDNS = 'https://www.infosubvenciones.es/bdnstrans/GE/es/convocatorias';
const MAX_INTENTOS = 3;
const TIMEOUT_DESCARGA_MS = 30_000;

// ─── URLs por tipo de documento ───────────────────────────────────────────────

interface DocumentoDescubierto {
  tipo: TipoDocumento;
  url: string;
  titulo: string;
  orden: number;
}

/**
 * Construye las URLs candidatas para los distintos tipos de documentos BDNS.
 * Solo devuelve URLs que son conocidas como válidas para el ID dado.
 */
export function descubrirUrlsDocumentos(conv: BdnsConvocatoria): DocumentoDescubierto[] {
  const bdnsId = String(conv.numeroConvocatoria);
  const docs: DocumentoDescubierto[] = [];

  // 1. Extracto (siempre presente en BDNS)
  docs.push({
    tipo: 'extracto',
    url: `${BASE_BDNS}/${bdnsId}/extracto`,
    titulo: 'Extracto BDNS',
    orden: 1,
  });

  // 2. Convocatoria completa (si BDNS la tiene como PDF directo)
  if (conv.urlPdf) {
    docs.push({
      tipo: 'convocatoria',
      url: conv.urlPdf,
      titulo: 'Convocatoria completa',
      orden: 2,
    });
  }

  // 3. Bases reguladoras
  if (conv.urlConvocatoria && conv.urlConvocatoria !== conv.urlPdf) {
    docs.push({
      tipo: 'bases_reguladoras',
      url: conv.urlConvocatoria,
      titulo: 'Bases reguladoras',
      orden: 3,
    });
  }

  // 4. URL oficial si difiere de las anteriores
  // (en BDNS algunos campos tienen la URL de la BOE u otros boletines)
  const urlsYa = new Set(docs.map(d => d.url));
  const urlOficial = (conv as Record<string, unknown>)['urlOficial'] as string | undefined;
  if (urlOficial && !urlsYa.has(urlOficial)) {
    docs.push({
      tipo: 'otro',
      url: urlOficial,
      titulo: 'Publicación oficial',
      orden: 10,
    });
  }

  return docs;
}

// ─── SHA256 ────────────────────────────────────────────────────────────────────

async function sha256Bytes(buffer: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Descarga y almacenamiento ────────────────────────────────────────────────

async function descargarPdf(url: string): Promise<{ buffer: ArrayBuffer; contentType: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_DESCARGA_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'AyudaPyme-Bot/1.0' },
    });
    clearTimeout(timer);
    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') ?? 'application/pdf';
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength < 100) return null; // PDF vacío
    return { buffer, contentType };
  } catch {
    clearTimeout(timer);
    return null;
  }
}

async function subirAStorage(
  supabase: SupabaseClient,
  buffer: ArrayBuffer,
  path: string,
  contentType: string
): Promise<string | null> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType, upsert: true });
  if (error) {
    console.error('[DocumentManager] Error subiendo a Storage:', error.message);
    return null;
  }
  return path;
}

// ─── Extracción de texto (pdfjs-dist) ────────────────────────────────────────

async function extraerTextoPdf(buffer: ArrayBuffer): Promise<string | null> {
  try {
    // Dynamic import para compatibilidad SSR/Edge
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
    const pdfDoc = await loadingTask.promise;

    const partes: string[] = [];
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const content = await page.getTextContent();
      const texto = content.items
        .filter((item) => 'str' in item)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((item: any) => item.str as string)
        .join(' ');
      partes.push(texto);
    }

    return partes.join('\n\n').replace(/\s{3,}/g, '  ').trim();
  } catch (err) {
    console.error('[DocumentManager] Error extrayendo texto PDF:', err);
    return null;
  }
}

// ─── Función principal ────────────────────────────────────────────────────────

export interface DocumentoProcesado {
  tipo: TipoDocumento;
  docId: string;
  ok: boolean;
  tieneTexto: boolean;
  error?: string;
}

/**
 * Descarga y registra todos los documentos de una convocatoria.
 *
 * @returns Lista de documentos procesados con su estado
 */
export async function procesarDocumentos(
  supabase: SupabaseClient,
  subvencionId: string,
  bdnsId: string,
  conv: BdnsConvocatoria,
  opciones: { forzarRedescarga?: boolean } = {}
): Promise<DocumentoProcesado[]> {
  const urls = descubrirUrlsDocumentos(conv);
  const resultados: DocumentoProcesado[] = [];

  for (const docDesc of urls) {
    const resultado = await procesarUnDocumento(
      supabase, subvencionId, bdnsId, docDesc, opciones
    );
    resultados.push(resultado);
  }

  return resultados;
}

async function procesarUnDocumento(
  supabase: SupabaseClient,
  subvencionId: string,
  bdnsId: string,
  docDesc: DocumentoDescubierto,
  opciones: { forzarRedescarga?: boolean }
): Promise<DocumentoProcesado> {
  // Verificar si ya existe
  const { data: existente } = await supabase
    .from('subvencion_documentos')
    .select('id, estado, storage_path')
    .eq('subvencion_id', subvencionId)
    .eq('tipo_documento', docDesc.tipo)
    .maybeSingle();

  if (existente && !opciones.forzarRedescarga && existente.estado === 'texto_extraido') {
    return { tipo: docDesc.tipo, docId: existente.id, ok: true, tieneTexto: true };
  }

  // Crear o obtener registro
  let docId: string;
  if (existente) {
    docId = existente.id;
    await supabase.from('subvencion_documentos')
      .update({ estado: 'pendiente', intentos: 0, error_msg: null })
      .eq('id', docId);
  } else {
    const { data: newDoc, error } = await supabase
      .from('subvencion_documentos')
      .insert({
        subvencion_id: subvencionId,
        bdns_id: bdnsId,
        tipo_documento: docDesc.tipo,
        titulo: docDesc.titulo,
        url_origen: docDesc.url,
        orden: docDesc.orden,
        es_principal: docDesc.tipo === 'convocatoria' || docDesc.tipo === 'extracto',
        estado: 'pendiente',
        intentos: 0,
      })
      .select('id')
      .single();
    if (error || !newDoc) {
      return { tipo: docDesc.tipo, docId: '', ok: false, tieneTexto: false, error: error?.message };
    }
    docId = newDoc.id;
  }

  // Intentar descarga
  let intentos = 0;
  let pdfData: { buffer: ArrayBuffer; contentType: string } | null = null;

  while (intentos < MAX_INTENTOS && !pdfData) {
    intentos++;
    pdfData = await descargarPdf(docDesc.url);
    if (!pdfData && intentos < MAX_INTENTOS) await sleep(2000 * intentos);
  }

  await supabase.from('subvencion_documentos')
    .update({ intentos })
    .eq('id', docId);

  if (!pdfData) {
    await supabase.from('subvencion_documentos')
      .update({ estado: 'no_disponible', error_msg: `No se pudo descargar tras ${MAX_INTENTOS} intentos` })
      .eq('id', docId);
    return { tipo: docDesc.tipo, docId, ok: false, tieneTexto: false, error: 'descarga_fallida' };
  }

  // Hash y subida a Storage
  const hashPdf = await sha256Bytes(pdfData.buffer);
  const storagePath = `${bdnsId}/${docDesc.tipo}_${hashPdf.slice(0, 12)}.pdf`;

  const pathSubido = await subirAStorage(supabase, pdfData.buffer, storagePath, pdfData.contentType);

  await supabase.from('subvencion_documentos').update({
    storage_path: pathSubido,
    hash_pdf: hashPdf,
    tamanio_bytes: pdfData.buffer.byteLength,
    estado: 'descargado',
    descargado_at: new Date().toISOString(),
  }).eq('id', docId);

  // Extraer texto
  const texto = await extraerTextoPdf(pdfData.buffer);
  if (!texto || texto.length < 50) {
    await supabase.from('subvencion_documentos')
      .update({ estado: 'descargado', error_msg: 'Texto muy corto o no extraíble' })
      .eq('id', docId);
    return { tipo: docDesc.tipo, docId, ok: true, tieneTexto: false };
  }

  const hashTexto = await sha256Bytes(new TextEncoder().encode(texto).buffer);
  const numPaginas = Math.ceil(texto.length / 2000); // estimación

  await supabase.from('subvencion_documentos').update({
    texto_extraido: texto.slice(0, 50_000), // máx 50K chars en BD
    hash_texto: hashTexto,
    num_paginas: numPaginas,
    estado: 'texto_extraido',
    procesado_at: new Date().toISOString(),
  }).eq('id', docId);

  return { tipo: docDesc.tipo, docId, ok: true, tieneTexto: true };
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ─── Obtener texto del mejor documento ───────────────────────────────────────

/**
 * Devuelve el texto del mejor documento disponible para análisis IA.
 * Prioridad: convocatoria > bases_reguladoras > extracto > otro
 */
export async function obtenerMejorTexto(
  supabase: SupabaseClient,
  subvencionId: string
): Promise<{ texto: string; docId: string; tipo: TipoDocumento } | null> {
  const prioridad: TipoDocumento[] = ['convocatoria', 'bases_reguladoras', 'extracto', 'otro'];

  const { data: docs } = await supabase
    .from('subvencion_documentos')
    .select('id, tipo_documento, texto_extraido')
    .eq('subvencion_id', subvencionId)
    .eq('estado', 'texto_extraido')
    .not('texto_extraido', 'is', null);

  if (!docs?.length) return null;

  for (const tipo of prioridad) {
    const doc = docs.find(d => d.tipo_documento === tipo && d.texto_extraido?.length > 100);
    if (doc) return { texto: doc.texto_extraido, docId: doc.id, tipo: doc.tipo_documento };
  }

  return null;
}
