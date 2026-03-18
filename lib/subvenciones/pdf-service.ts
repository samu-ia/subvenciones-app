/**
 * lib/subvenciones/pdf-service.ts
 *
 * Descarga PDFs de convocatorias BDNS, los guarda en Supabase Storage
 * y extrae su texto usando pdfjs-dist (ya instalado en el proyecto).
 *
 * Diseño:
 *  - Descarga → Storage → subvenciones_pdf (registro)
 *  - Extracción texto → subvenciones_texto (texto bruto + limpio)
 *  - Si PDF escaneado (texto < umbral mínimo) → marca necesita_ocr
 *  - Si error de descarga → incrementa intentos, máx 3
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { EtapaPipelineResult } from '@/lib/types/subvenciones-pipeline';

const MAX_INTENTOS = 3;
const MIN_CHARS_PDF_LEGIBLE = 200;     // menos de esto = probablemente escaneado
const MAX_TEXTO_CHARS = 100_000;       // truncar textos muy largos para no saturar BD

// ─── Utilidades ───────────────────────────────────────────────────────────────

/** SHA256 simple con WebCrypto (disponible en Node 18+) */
async function sha256(data: Uint8Array | string): Promise<string> {
  const input = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const hashBuffer = await crypto.subtle.digest('SHA-256', input as BufferSource);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Limpieza básica del texto extraído */
function limpiarTexto(texto: string): string {
  return texto
    .replace(/\s{3,}/g, '  ')          // colapsar espacios múltiples
    .replace(/\n{4,}/g, '\n\n\n')       // máximo 3 saltos de línea consecutivos
    .replace(/[^\S\n]+/g, ' ')          // normalizar espacios (no newlines)
    .trim();
}

/** Extrae texto de un buffer PDF usando pdfjs-dist (legacy build para Node) */
async function extraerTextoPdf(buffer: Buffer): Promise<{
  texto: string;
  numPaginas: number;
  necesitaOcr: boolean;
}> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const uint8 = new Uint8Array(buffer);
  const pdf = await pdfjsLib.getDocument({ data: uint8 }).promise;
  const numPaginas = pdf.numPages;

  const paginas: string[] = [];
  for (let i = 1; i <= numPaginas; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .filter((item: unknown) => typeof item === 'object' && item !== null && 'str' in item)
      .map((item: unknown) => (item as { str: string }).str)
      .join(' ');
    paginas.push(pageText);
  }

  const textoCompleto = paginas.join('\n');
  const necesitaOcr = textoCompleto.replace(/\s/g, '').length < MIN_CHARS_PDF_LEGIBLE;

  return { texto: textoCompleto, numPaginas, necesitaOcr };
}

// ─── Descarga y registro en Storage ──────────────────────────────────────────

/**
 * Descarga un PDF desde una URL y lo guarda en Supabase Storage.
 * Registra el resultado en subvenciones_pdf.
 *
 * @returns id del registro en subvenciones_pdf
 */
export async function descargarYRegistrarPdf(
  supabase: SupabaseClient,
  params: {
    rawId: string;
    bdnsId: string;
    urlPdf: string;
    pdfId?: string;    // si ya existe el registro, actualizar en vez de insertar
  }
): Promise<{ pdfId: string } & EtapaPipelineResult> {
  const { rawId, bdnsId, urlPdf, pdfId: existingPdfId } = params;

  // Verificar intentos previos
  if (existingPdfId) {
    const { data: existing } = await supabase
      .from('subvenciones_pdf')
      .select('intentos, estado')
      .eq('id', existingPdfId)
      .single();

    if (existing?.estado === 'descargado') {
      return { ok: true, skip: true, pdfId: existingPdfId };
    }
    if ((existing?.intentos ?? 0) >= MAX_INTENTOS) {
      return { ok: false, error: 'Máximo de intentos alcanzado', pdfId: existingPdfId };
    }
  }

  // Crear registro pendiente si no existe
  let pdfId = existingPdfId;
  if (!pdfId) {
    const { data: newRecord, error: insertErr } = await supabase
      .from('subvenciones_pdf')
      .insert({ raw_id: rawId, bdns_id: bdnsId, url_pdf: urlPdf, estado: 'pendiente', intentos: 0 })
      .select('id')
      .single();

    if (insertErr || !newRecord) {
      return { ok: false, error: `No se pudo crear registro PDF: ${insertErr?.message}`, pdfId: '' };
    }
    pdfId = newRecord.id;
  }

  try {
    // Descargar PDF
    const response = await fetch(urlPdf, {
      headers: { 'User-Agent': 'SubvencionesApp/1.0' },
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} al descargar PDF`);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('pdf') && !contentType.includes('octet-stream')) {
      // Podría ser HTML de error o redirect — marcamos como no disponible
      await supabase.from('subvenciones_pdf').update({
        estado: 'no_disponible',
        error_msg: `Content-type inesperado: ${contentType}`,
        updated_at: new Date().toISOString(),
      }).eq('id', pdfId);
      return { ok: false, error: 'PDF no disponible (content-type inesperado)', pdfId: pdfId! };
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const hashPdf = await sha256(new Uint8Array(buffer));
    const storagePath = `subvenciones-pdfs/${bdnsId}/${hashPdf}.pdf`;

    // Subir a Storage
    const { error: uploadErr } = await supabase.storage
      .from('subvenciones')
      .upload(storagePath, buffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadErr) throw new Error(`Storage upload: ${uploadErr.message}`);

    // Actualizar registro
    await supabase.from('subvenciones_pdf').update({
      storage_path: storagePath,
      hash_pdf: hashPdf,
      tamanio_bytes: buffer.length,
      estado: 'descargado',
      descargado_at: new Date().toISOString(),
      error_msg: null,
      updated_at: new Date().toISOString(),
    }).eq('id', pdfId);

    return { ok: true, pdfId: pdfId! };

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[PdfService] Error descargando ${urlPdf}:`, msg);

    // Incrementar intentos y marcar error
    await supabase.from('subvenciones_pdf').update({
      estado: 'error_descarga',
      error_msg: msg,
      updated_at: new Date().toISOString(),
    }).eq('id', pdfId!);

    return { ok: false, error: msg, pdfId: pdfId! };
  }
}

// ─── Extracción de texto ──────────────────────────────────────────────────────

/**
 * Lee el PDF de Storage, extrae el texto y guarda en subvenciones_texto.
 */
export async function extraerYGuardarTexto(
  supabase: SupabaseClient,
  params: {
    pdfId: string;
    rawId: string;
    bdnsId: string;
    storagePath: string;
    textoId?: string;   // si ya existe el registro de texto
  }
): Promise<{ textoId: string; texto: string } & EtapaPipelineResult> {
  const { pdfId, rawId, bdnsId, storagePath, textoId: existingTextoId } = params;

  // Si ya está extraído, devolver directamente
  if (existingTextoId) {
    const { data: existing } = await supabase
      .from('subvenciones_texto')
      .select('id, texto_limpio, estado')
      .eq('id', existingTextoId)
      .single();

    if (existing?.estado === 'extraido' && existing.texto_limpio) {
      return { ok: true, skip: true, textoId: existingTextoId, texto: existing.texto_limpio };
    }
  }

  try {
    // Descargar de Storage
    const { data: fileData, error: dlErr } = await supabase.storage
      .from('subvenciones')
      .download(storagePath);

    if (dlErr || !fileData) throw new Error(`Storage download: ${dlErr?.message}`);

    const buffer = Buffer.from(await fileData.arrayBuffer());

    // Extraer texto
    const { texto, numPaginas, necesitaOcr } = await extraerTextoPdf(buffer);

    const textoBruto = texto.slice(0, MAX_TEXTO_CHARS);
    const textoLimpio = limpiarTexto(textoBruto);
    const hashTexto = await sha256(textoLimpio);

    const payload = {
      pdf_id: pdfId,
      raw_id: rawId,
      bdns_id: bdnsId,
      texto_bruto: textoBruto,
      texto_limpio: textoLimpio,
      hash_texto: hashTexto,
      num_caracteres: textoLimpio.length,
      num_palabras: textoLimpio.split(/\s+/).filter(Boolean).length,
      necesita_ocr: necesitaOcr,
      estado: necesitaOcr ? 'necesita_ocr' : 'extraido',
      extraido_at: new Date().toISOString(),
    };

    let textoId: string;

    if (existingTextoId) {
      await supabase.from('subvenciones_texto').update(payload).eq('id', existingTextoId);
      textoId = existingTextoId;
    } else {
      const { data: newRec, error: insertErr } = await supabase
        .from('subvenciones_texto')
        .insert(payload)
        .select('id')
        .single();

      if (insertErr || !newRec) throw new Error(`Insert texto: ${insertErr?.message}`);
      textoId = newRec.id;
    }

    // Actualizar num_paginas en subvenciones_pdf
    await supabase.from('subvenciones_pdf').update({ num_paginas: numPaginas }).eq('id', pdfId);

    return { ok: true, textoId, texto: textoLimpio };

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[PdfService] Error extrayendo texto de ${storagePath}:`, msg);

    // Registrar error en subvenciones_texto
    const errorPayload = {
      pdf_id: pdfId, raw_id: rawId, bdns_id: bdnsId,
      estado: 'error_extraccion', error_msg: msg,
    };

    if (existingTextoId) {
      await supabase.from('subvenciones_texto').update(errorPayload).eq('id', existingTextoId);
      return { ok: false, error: msg, textoId: existingTextoId, texto: '' };
    } else {
      const { data: newRec } = await supabase
        .from('subvenciones_texto').insert(errorPayload).select('id').single();
      return { ok: false, error: msg, textoId: newRec?.id ?? '', texto: '' };
    }
  }
}
