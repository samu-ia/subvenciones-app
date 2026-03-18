/**
 * lib/subvenciones/ai-extractor.ts
 *
 * Usa IA para extraer datos estructurados del texto de una convocatoria BDNS.
 * Reutiliza el factory de providers ya existente en el proyecto.
 *
 * El output es un JSON tipado (IaExtraccionResult) que el normalizador
 * luego escribe en las tablas de la BD.
 *
 * Estrategia anti-alucinaciones:
 *  - El prompt insiste en null si no hay dato claro
 *  - Se valida el JSON resultante antes de devolverlo
 *  - Se incluye confidence_score global
 */

import { createProvider } from '@/lib/ai/providers/factory';
import type { CompletionOptions } from '@/lib/ai/providers/base';
import type { IaExtraccionResult } from '@/lib/types/subvenciones-pipeline';

// ─── Configuración ────────────────────────────────────────────────────────────

// Máx caracteres de texto que enviamos al LLM por petición
const MAX_TEXTO_LLM = 12_000;

// Modelos por defecto por proveedor (preferir modelos baratos para extracción masiva)
const MODELOS_DEFAULT: Record<string, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-haiku-20240307',
  google: 'gemini-1.5-flash',
  openrouter: 'openai/gpt-4o-mini',
};

// ─── Prompts ──────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Eres un extractor de datos especializado en convocatorias de subvenciones y ayudas públicas españolas.
Tu tarea es analizar el texto de una convocatoria oficial y extraer datos estructurados en formato JSON.

REGLAS CRÍTICAS:
1. Nunca inventes datos. Si algo no está claro o no aparece en el texto, usa null.
2. Las fechas deben estar en formato ISO YYYY-MM-DD. Si hay rango de texto tipo "hasta el 30 de abril de 2026", conviértelo.
3. Los importes deben ser números sin formato (ej: 50000, no "50.000 €").
4. Si el PDF está mal estructurado o hay poca información, baja el confidence_score.
5. El resumen_ia debe ser claro, útil para un gestor, en español neutro, máximo 3 frases.
6. Los puntos_clave deben ser bullets accionables (ej: "Pymes de menos de 50 empleados", "Plazo hasta mayo 2026").
7. El campo para_quien describe en una frase quién puede beneficiarse de esta ayuda (sin matching específico).`;

const USER_PROMPT_TEMPLATE = (titulo: string, organismo: string, texto: string): string => `
Analiza esta convocatoria de subvención y extrae los datos estructurados.

TÍTULO: ${titulo}
ORGANISMO: ${organismo}

TEXTO DE LA CONVOCATORIA:
${texto}

Devuelve ÚNICAMENTE un JSON válido con esta estructura exacta (sin texto antes ni después):

{
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

// ─── Parser / validador del JSON ──────────────────────────────────────────────

function parsearResultadoIa(raw: string): IaExtraccionResult {
  // Intentar extraer JSON del bloque ```json ... ``` o directo
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenceMatch ? fenceMatch[1] : raw).trim();

  // Buscar el objeto JSON
  const jsonMatch = candidate.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No se encontró JSON en la respuesta de IA');

  const parsed = JSON.parse(jsonMatch[0]);

  // Validación y defaults para campos obligatorios
  return {
    objeto: parsed.objeto ?? null,
    beneficiarios: Array.isArray(parsed.beneficiarios) ? parsed.beneficiarios : null,
    requisitos: Array.isArray(parsed.requisitos) ? parsed.requisitos : null,
    gastos_subvencionables: Array.isArray(parsed.gastos_subvencionables) ? parsed.gastos_subvencionables : null,
    documentacion_exigida: Array.isArray(parsed.documentacion_exigida) ? parsed.documentacion_exigida : null,
    importe_maximo: typeof parsed.importe_maximo === 'number' ? parsed.importe_maximo : null,
    importe_minimo: typeof parsed.importe_minimo === 'number' ? parsed.importe_minimo : null,
    porcentaje_financiacion: typeof parsed.porcentaje_financiacion === 'number' ? parsed.porcentaje_financiacion : null,
    presupuesto_total: typeof parsed.presupuesto_total === 'number' ? parsed.presupuesto_total : null,
    plazo_inicio: parsed.plazo_inicio ?? null,
    plazo_fin: parsed.plazo_fin ?? null,
    plazo_presentacion_texto: parsed.plazo_presentacion_texto ?? null,
    ambito_geografico: parsed.ambito_geografico ?? null,
    comunidad_autonoma: parsed.comunidad_autonoma ?? null,
    provincia: parsed.provincia ?? null,
    sectores: Array.isArray(parsed.sectores) ? parsed.sectores : null,
    tipos_empresa: Array.isArray(parsed.tipos_empresa) ? parsed.tipos_empresa : null,
    estado_convocatoria: parsed.estado_convocatoria ?? null,
    resumen_ia: parsed.resumen_ia ?? null,
    puntos_clave: Array.isArray(parsed.puntos_clave) ? parsed.puntos_clave : null,
    para_quien: parsed.para_quien ?? null,
    observaciones: parsed.observaciones ?? null,
    confidence_score: typeof parsed.confidence_score === 'number'
      ? Math.max(0, Math.min(1, parsed.confidence_score))
      : 0.5,
  };
}

// ─── Función principal ────────────────────────────────────────────────────────

export interface ExtractorConfig {
  provider: string;
  apiKey: string;
  baseUrl?: string;
  organization?: string;
  model?: string;
}

/**
 * Extrae datos estructurados de una convocatoria usando IA.
 *
 * @param texto - Texto limpio del PDF (ya procesado por pdf-service)
 * @param meta - Metadatos básicos de la convocatoria (título, organismo)
 * @param config - Configuración del proveedor de IA
 */
export async function extraerConIa(
  texto: string,
  meta: { titulo: string; organismo?: string },
  config: ExtractorConfig
): Promise<{ resultado: IaExtraccionResult; modelo: string; tokensUsados: number }> {

  // Truncar texto para no exceder contexto ni coste
  const textoTruncado = texto.length > MAX_TEXTO_LLM
    ? texto.slice(0, MAX_TEXTO_LLM) + '\n\n[TEXTO TRUNCADO...]'
    : texto;

  const provider = createProvider({
    provider: config.provider as Parameters<typeof createProvider>[0]['provider'],
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    organization: config.organization,
    enabled: true,
  });

  const modelo = config.model ?? MODELOS_DEFAULT[config.provider] ?? 'gpt-4o-mini';
  const userPrompt = USER_PROMPT_TEMPLATE(
    meta.titulo,
    meta.organismo ?? 'No especificado',
    textoTruncado
  );

  const options: CompletionOptions = {
    model: modelo,
    temperature: 0.1,      // muy bajo: queremos extracción determinista
    maxTokens: 3000,
    systemPrompt: SYSTEM_PROMPT,
  };

  const response = await provider.complete(
    [{ role: 'user', content: userPrompt }],
    options
  );

  const resultado = parsearResultadoIa(response.content);

  return {
    resultado,
    modelo,
    tokensUsados: response.tokensUsed,
  };
}

/**
 * Extrae solo un resumen rápido (más barato, para convocatorias que no tienen PDF).
 * Usa los datos del raw BDNS directamente.
 */
export async function extraerResumenRapido(
  meta: {
    titulo: string;
    organismo?: string;
    descripcion?: string;
    beneficiarios?: string;
    importeMaximo?: number;
    fechaFin?: string;
  },
  config: ExtractorConfig
): Promise<IaExtraccionResult> {
  const textoSintetico = `
Título: ${meta.titulo}
Organismo: ${meta.organismo ?? 'No especificado'}
Descripción/Objeto: ${meta.descripcion ?? 'No disponible'}
Beneficiarios: ${meta.beneficiarios ?? 'No especificado'}
Importe máximo: ${meta.importeMaximo ? `${meta.importeMaximo} €` : 'No especificado'}
Fecha fin: ${meta.fechaFin ?? 'No especificada'}
`.trim();

  const { resultado } = await extraerConIa(textoSintetico, meta, config);
  // Confidence baja porque no tenemos el texto completo del PDF
  return { ...resultado, confidence_score: Math.min(resultado.confidence_score, 0.5) };
}
