/**
 * lib/subvenciones/pdf-gemini.ts
 *
 * Extracción de datos de PDFs de convocatorias BDNS usando Gemini nativo.
 *
 * En vez de:
 *   PDF → pdfjs (extrae texto) → LLM (analiza texto)
 *
 * Hace:
 *   PDF bytes → Gemini inline PDF → JSON estructurado
 *
 * Ventajas:
 *  - Funciona con PDFs escaneados (Gemini tiene visión)
 *  - Sin pdfjs, sin truncado de texto, sin encoding problems
 *  - Un solo API call en vez de dos pasos
 *  - PDFs BDNS son siempre < 20MB (límite inline Gemini)
 */

import type { IaExtraccionResult } from '@/lib/types/subvenciones-pipeline';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const MODELO = 'gemini-2.5-flash';

// URL patrón extracto BDNS
export function urlExtractoPdf(bdnsId: string): string {
  return `https://www.infosubvenciones.es/bdnstrans/api/convocatorias/pdf?id=${bdnsId}&vpd=GE`;
}

const SYSTEM_PROMPT = `Eres un extractor de datos especializado en convocatorias de subvenciones y ayudas públicas españolas.
Analiza el PDF de la convocatoria y extrae datos estructurados en formato JSON.

REGLAS:
1. Nunca inventes datos. Si algo no está claro o no aparece en el documento, usa null.
2. Las fechas deben estar en formato ISO YYYY-MM-DD.
3. Los importes deben ser números sin formato (ej: 50000, no "50.000 €").
4. El resumen_ia debe ser claro y útil para un gestor, en español neutro, máximo 3 frases.
5. Los puntos_clave deben ser bullets accionables.
6. el campo para_quien describe en una frase quién puede beneficiarse.
7. Si el documento tiene poca información relevante, baja el confidence_score.`;

const USER_PROMPT = `Analiza esta convocatoria de subvención y extrae los datos estructurados.

Devuelve ÚNICAMENTE un JSON válido con esta estructura exacta (sin texto antes ni después):

{
  "titulo": "string o null",
  "organismo": "string o null",
  "objeto": "string o null",
  "beneficiarios": ["string"] o null,
  "requisitos": [
    { "tipo": "juridico|economico|sector|otro", "descripcion": "string", "obligatorio": true }
  ] o null,
  "gastos_subvencionables": [
    { "categoria": "personal|equipamiento|servicios|otros", "descripcion": "string", "porcentaje_max": number o null }
  ] o null,
  "documentacion_exigida": [
    { "nombre": "string", "descripcion": "string o null", "obligatorio": true }
  ] o null,
  "importe_maximo": number o null,
  "importe_minimo": number o null,
  "porcentaje_financiacion": number o null,
  "presupuesto_total": number o null,
  "plazo_inicio": "YYYY-MM-DD o null",
  "plazo_fin": "YYYY-MM-DD o null",
  "plazo_presentacion_texto": "string o null",
  "ambito_geografico": "nacional|autonomico|local|null",
  "comunidad_autonoma": "string o null",
  "provincia": "string o null",
  "sectores": [
    { "cnae_codigo": "string o null", "nombre_sector": "string", "excluido": false }
  ] o null,
  "tipos_empresa": [
    { "tipo": "pyme|micropyme|grande|autonomo|startup|otro", "descripcion": "string o null", "excluido": false }
  ] o null,
  "estado_convocatoria": "abierta|cerrada|proxima|suspendida|resuelta|null",
  "resumen_ia": "string o null (máx 3 frases, claro y útil para gestor)",
  "puntos_clave": ["string"] o null,
  "para_quien": "string o null (1 frase)",
  "observaciones": "string o null",
  "confidence_score": 0.0
}`;

export interface GeminiPdfResult {
  ok: boolean;
  resultado?: IaExtraccionResult & { titulo?: string; organismo?: string };
  error?: string;
  modelo: string;
}

/**
 * Descarga el PDF de una convocatoria BDNS y lo analiza con Gemini nativo.
 * No usa pdfjs — manda el PDF binario directamente como inlineData.
 */
export async function extraerPdfConGemini(
  bdnsId: string,
  apiKey: string,
  urlPdf?: string,
): Promise<GeminiPdfResult> {
  const pdfUrl = urlPdf ?? urlExtractoPdf(bdnsId);

  // 1. Descargar PDF
  let pdfBuffer: ArrayBuffer;
  try {
    const res = await fetch(pdfUrl, {
      headers: { 'User-Agent': 'SubvencionesApp/1.0' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      return { ok: false, error: `PDF HTTP ${res.status}: ${pdfUrl}`, modelo: MODELO };
    }
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('pdf') && !ct.includes('octet-stream') && !ct.includes('application')) {
      return { ok: false, error: `Content-type inesperado: ${ct}`, modelo: MODELO };
    }
    pdfBuffer = await res.arrayBuffer();
  } catch (err) {
    return { ok: false, error: `Descarga PDF: ${err instanceof Error ? err.message : String(err)}`, modelo: MODELO };
  }

  // 2. Convertir a base64
  const base64 = Buffer.from(pdfBuffer).toString('base64');

  // 3. Llamar a Gemini con PDF inline
  const body = {
    contents: [{
      role: 'user',
      parts: [
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: base64,
          },
        },
        { text: USER_PROMPT },
      ],
    }],
    systemInstruction: {
      parts: [{ text: SYSTEM_PROMPT }],
    },
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 3000,
      topK: 40,
      topP: 0.95,
    },
  };

  let geminiRaw: string;
  try {
    const res = await fetch(
      `${GEMINI_BASE}/models/${MODELO}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
      },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        ok: false,
        error: `Gemini API ${res.status}: ${(err as { error?: { message?: string } }).error?.message ?? 'error'}`,
        modelo: MODELO,
      };
    }
    const data = await res.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    geminiRaw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    if (!geminiRaw) {
      return { ok: false, error: 'Gemini devolvió respuesta vacía', modelo: MODELO };
    }
  } catch (err) {
    return { ok: false, error: `Gemini request: ${err instanceof Error ? err.message : String(err)}`, modelo: MODELO };
  }

  // 4. Parsear JSON
  try {
    const fenceMatch = geminiRaw.match(/```(?:json)?\s*([\s\S]*?)```/);
    const candidate = (fenceMatch ? fenceMatch[1] : geminiRaw).trim();
    const jsonMatch = candidate.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in response');

    const p = JSON.parse(jsonMatch[0]);

    const resultado: IaExtraccionResult & { titulo?: string; organismo?: string } = {
      titulo: typeof p.titulo === 'string' ? p.titulo : undefined,
      organismo: typeof p.organismo === 'string' ? p.organismo : undefined,
      objeto: p.objeto ?? null,
      beneficiarios: Array.isArray(p.beneficiarios) ? p.beneficiarios : null,
      requisitos: Array.isArray(p.requisitos) ? p.requisitos : null,
      gastos_subvencionables: Array.isArray(p.gastos_subvencionables) ? p.gastos_subvencionables : null,
      documentacion_exigida: Array.isArray(p.documentacion_exigida) ? p.documentacion_exigida : null,
      importe_maximo: typeof p.importe_maximo === 'number' ? p.importe_maximo : null,
      importe_minimo: typeof p.importe_minimo === 'number' ? p.importe_minimo : null,
      porcentaje_financiacion: typeof p.porcentaje_financiacion === 'number' ? p.porcentaje_financiacion : null,
      presupuesto_total: typeof p.presupuesto_total === 'number' ? p.presupuesto_total : null,
      plazo_inicio: p.plazo_inicio ?? null,
      plazo_fin: p.plazo_fin ?? null,
      plazo_presentacion_texto: p.plazo_presentacion_texto ?? null,
      ambito_geografico: p.ambito_geografico ?? null,
      comunidad_autonoma: p.comunidad_autonoma ?? null,
      provincia: p.provincia ?? null,
      sectores: Array.isArray(p.sectores) ? p.sectores : null,
      tipos_empresa: Array.isArray(p.tipos_empresa) ? p.tipos_empresa : null,
      estado_convocatoria: p.estado_convocatoria ?? null,
      resumen_ia: p.resumen_ia ?? null,
      puntos_clave: Array.isArray(p.puntos_clave) ? p.puntos_clave : null,
      para_quien: p.para_quien ?? null,
      observaciones: p.observaciones ?? null,
      confidence_score: typeof p.confidence_score === 'number'
        ? Math.max(0, Math.min(1, p.confidence_score))
        : 0.7,
    };

    return { ok: true, resultado, modelo: MODELO };
  } catch (err) {
    return {
      ok: false,
      error: `Parse JSON: ${err instanceof Error ? err.message : String(err)}. Raw: ${geminiRaw.slice(0, 200)}`,
      modelo: MODELO,
    };
  }
}
