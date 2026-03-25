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
import type { IaExtraccionResult, IaExtraccionConGrounding } from '@/lib/types/subvenciones-pipeline';

// ─── Configuración ────────────────────────────────────────────────────────────

// Máx caracteres de texto que enviamos al LLM por petición
// Distribución del contexto: cabecera del doc (intro/objeto) + cola (requisitos/plazos/docs)
const MAX_CABECERA_CHARS = 8_000;
const MAX_COLA_CHARS = 4_000;
const MAX_TEXTO_LLM = MAX_CABECERA_CHARS + MAX_COLA_CHARS; // 12K total

/**
 * Extrae el fragmento más informativo del texto para no desperdiciar contexto.
 * - Los primeros 8K suelen tener: objeto, beneficiarios, importes.
 * - Los últimos 4K suelen tener: requisitos, documentación, plazos finales.
 * Si el texto cabe completo, lo devuelve tal cual.
 */
function smartChunk(texto: string): string {
  if (texto.length <= MAX_TEXTO_LLM) return texto;
  const cabecera = texto.slice(0, MAX_CABECERA_CHARS);
  const cola = texto.slice(-MAX_COLA_CHARS);
  // Evitar cortar a mitad de palabra
  const corteCabecera = cabecera.lastIndexOf(' ');
  const corteCola = cola.indexOf(' ');
  return (
    cabecera.slice(0, corteCabecera > MAX_CABECERA_CHARS - 200 ? corteCabecera : MAX_CABECERA_CHARS) +
    '\n\n[... TEXTO OMITIDO ...]\n\n' +
    cola.slice(corteCola > 0 && corteCola < 200 ? corteCola : 0)
  );
}

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

  // Extraer fragmento más informativo: cabecera (objeto/importes) + cola (requisitos/plazos)
  const textoTruncado = smartChunk(texto);

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

// ─── Prompt con grounding ─────────────────────────────────────────────────────

const SYSTEM_PROMPT_GROUNDING = `Eres un extractor de datos especializado en convocatorias de subvenciones españolas.
Tu tarea: analizar el texto y extraer datos estructurados CON TRAZABILIDAD.
Para cada campo debes indicar:
  · "valor": el dato extraído (null si no aparece)
  · "fragmento": cita textual EXACTA del documento (máx 200 caracteres) de donde sacaste el dato
  · "pagina": número de página estimado (1-based), o null si no es identificable
  · "confidence": 0.0-1.0 (0 = inventado/dudoso, 1 = cita directa)

REGLAS:
1. Nunca inventes. Si no está en el texto, "valor": null, "fragmento": null, "confidence": 0.
2. Las fechas en formato YYYY-MM-DD.
3. Importes como número sin formato (ej: 50000).
4. El resumen_ia máximo 3 frases, claro y útil para un gestor.
5. fragmento debe ser copia literal del texto, no parafraseo.`;

const USER_PROMPT_GROUNDING = (titulo: string, organismo: string, texto: string): string => `
Analiza esta convocatoria y extrae datos con trazabilidad.

TÍTULO: ${titulo}
ORGANISMO: ${organismo}

TEXTO:
${texto}

Devuelve ÚNICAMENTE un JSON válido (sin texto antes ni después):

{
  "objeto": { "valor": "string|null", "fragmento": "cita literal|null", "pagina": number|null, "confidence": 0.0 },
  "beneficiarios": { "valor": ["string"]|null, "fragmento": "cita|null", "pagina": number|null, "confidence": 0.0 },
  "importe_maximo": { "valor": number|null, "fragmento": "cita|null", "pagina": number|null, "confidence": 0.0 },
  "importe_minimo": { "valor": number|null, "fragmento": "cita|null", "pagina": number|null, "confidence": 0.0 },
  "porcentaje_financiacion": { "valor": number|null, "fragmento": "cita|null", "pagina": number|null, "confidence": 0.0 },
  "presupuesto_total": { "valor": number|null, "fragmento": "cita|null", "pagina": number|null, "confidence": 0.0 },
  "plazo_inicio": { "valor": "YYYY-MM-DD|null", "fragmento": "cita|null", "pagina": number|null, "confidence": 0.0 },
  "plazo_fin": { "valor": "YYYY-MM-DD|null", "fragmento": "cita|null", "pagina": number|null, "confidence": 0.0 },
  "plazo_presentacion_texto": { "valor": "string|null", "fragmento": "cita|null", "pagina": number|null, "confidence": 0.0 },
  "ambito_geografico": { "valor": "nacional|autonomico|local|null", "fragmento": "cita|null", "pagina": number|null, "confidence": 0.0 },
  "comunidad_autonoma": { "valor": "string|null", "fragmento": "cita|null", "pagina": number|null, "confidence": 0.0 },
  "provincia": { "valor": "string|null", "fragmento": "cita|null", "pagina": number|null, "confidence": 0.0 },
  "estado_convocatoria": { "valor": "abierta|cerrada|proxima|suspendida|resuelta|null", "fragmento": "cita|null", "pagina": number|null, "confidence": 0.0 },
  "resumen_ia": { "valor": "string (3 frases máx)|null", "fragmento": null, "pagina": null, "confidence": 0.0 },
  "puntos_clave": { "valor": ["bullet accionable"]|null, "fragmento": null, "pagina": null, "confidence": 0.0 },
  "para_quien": { "valor": "1 frase|null", "fragmento": "cita|null", "pagina": number|null, "confidence": 0.0 },
  "requisitos": { "valor": [{"tipo":"juridico|economico|sector|otro","descripcion":"string","obligatorio":true}]|null, "fragmento": "cita|null", "pagina": number|null, "confidence": 0.0 },
  "gastos_subvencionables": { "valor": [{"categoria":"string","descripcion":"string","porcentaje_max":number|null}]|null, "fragmento": "cita|null", "pagina": number|null, "confidence": 0.0 },
  "documentacion_exigida": { "valor": [{"nombre":"string","descripcion":"string|null","obligatorio":true}]|null, "fragmento": "cita|null", "pagina": number|null, "confidence": 0.0 },
  "sectores": { "valor": [{"cnae_codigo":"string|null","nombre_sector":"string","excluido":false}]|null, "fragmento": "cita|null", "pagina": number|null, "confidence": 0.0 },
  "tipos_empresa": { "valor": [{"tipo":"pyme|micropyme|grande|autonomo|startup|otro","descripcion":"string|null","excluido":false}]|null, "fragmento": "cita|null", "pagina": number|null, "confidence": 0.0 },
  "observaciones": { "valor": "string|null", "fragmento": null, "pagina": null, "confidence": 0.0 },
  "confidence_score": 0.0
}`;

function parsearResultadoGrounding(raw: string, modelo: string, tokensUsados: number): IaExtraccionConGrounding {
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenceMatch ? fenceMatch[1] : raw).trim();
  const jsonMatch = candidate.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No se encontró JSON con grounding en la respuesta de IA');

  const p = JSON.parse(jsonMatch[0]);

  function campo<T>(key: string, fallback: T) {
    const f = p[key];
    if (!f || typeof f !== 'object') return { valor: fallback, fragmento_texto: undefined, pagina_estimada: undefined, confidence: 0 };
    return {
      valor: f.valor ?? fallback,
      fragmento_texto: typeof f.fragmento === 'string' ? f.fragmento : undefined,
      pagina_estimada: typeof f.pagina === 'number' ? f.pagina : undefined,
      confidence: typeof f.confidence === 'number' ? Math.max(0, Math.min(1, f.confidence)) : 0,
    };
  }

  return {
    objeto: campo('objeto', null),
    beneficiarios: campo('beneficiarios', null),
    importe_maximo: campo('importe_maximo', null),
    importe_minimo: campo('importe_minimo', null),
    porcentaje_financiacion: campo('porcentaje_financiacion', null),
    presupuesto_total: campo('presupuesto_total', null),
    plazo_inicio: campo('plazo_inicio', null),
    plazo_fin: campo('plazo_fin', null),
    plazo_presentacion_texto: campo('plazo_presentacion_texto', null),
    ambito_geografico: campo('ambito_geografico', null),
    comunidad_autonoma: campo('comunidad_autonoma', null),
    provincia: campo('provincia', null),
    estado_convocatoria: campo('estado_convocatoria', null),
    resumen_ia: campo('resumen_ia', null),
    puntos_clave: campo('puntos_clave', null),
    para_quien: campo('para_quien', null),
    requisitos: campo('requisitos', null),
    gastos_subvencionables: campo('gastos_subvencionables', null),
    documentacion_exigida: campo('documentacion_exigida', null),
    sectores: campo('sectores', null),
    tipos_empresa: campo('tipos_empresa', null),
    observaciones: campo('observaciones', null),
    confidence_score: typeof p.confidence_score === 'number' ? Math.max(0, Math.min(1, p.confidence_score)) : 0.5,
    modelo,
    tokens_usados: tokensUsados,
  };
}

/**
 * Versión con grounding: extrae datos con trazabilidad por campo.
 * Devuelve IaExtraccionConGrounding donde cada campo tiene fragmento + página + confidence.
 */
export async function extraerConIaConGrounding(
  texto: string,
  meta: { titulo: string; organismo?: string },
  config: ExtractorConfig
): Promise<IaExtraccionConGrounding> {
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

  const options: CompletionOptions = {
    model: modelo,
    temperature: 0.1,
    maxTokens: 4000,
    systemPrompt: SYSTEM_PROMPT_GROUNDING,
  };

  const userPrompt = USER_PROMPT_GROUNDING(
    meta.titulo,
    meta.organismo ?? 'No especificado',
    textoTruncado
  );

  const response = await provider.complete(
    [{ role: 'user', content: userPrompt }],
    options
  );

  return parsearResultadoGrounding(response.content, modelo, response.tokensUsed);
}

/**
 * Convierte IaExtraccionConGrounding al formato IaExtraccionResult clásico
 * (para mantener compatibilidad con el normalizador existente).
 */
export function groundingToLegacy(g: IaExtraccionConGrounding): IaExtraccionResult {
  return {
    objeto: g.objeto.valor as string | null,
    beneficiarios: g.beneficiarios.valor as string[] | null,
    requisitos: g.requisitos.valor as IaExtraccionResult['requisitos'],
    gastos_subvencionables: g.gastos_subvencionables.valor as IaExtraccionResult['gastos_subvencionables'],
    documentacion_exigida: g.documentacion_exigida.valor as IaExtraccionResult['documentacion_exigida'],
    importe_maximo: g.importe_maximo.valor as number | null,
    importe_minimo: g.importe_minimo.valor as number | null,
    porcentaje_financiacion: g.porcentaje_financiacion.valor as number | null,
    presupuesto_total: g.presupuesto_total.valor as number | null,
    plazo_inicio: g.plazo_inicio.valor as string | null,
    plazo_fin: g.plazo_fin.valor as string | null,
    plazo_presentacion_texto: g.plazo_presentacion_texto.valor as string | null,
    ambito_geografico: g.ambito_geografico.valor as IaExtraccionResult['ambito_geografico'],
    comunidad_autonoma: g.comunidad_autonoma.valor as string | null,
    provincia: g.provincia.valor as string | null,
    sectores: g.sectores.valor as IaExtraccionResult['sectores'],
    tipos_empresa: g.tipos_empresa.valor as IaExtraccionResult['tipos_empresa'],
    estado_convocatoria: g.estado_convocatoria.valor as IaExtraccionResult['estado_convocatoria'],
    resumen_ia: g.resumen_ia.valor as string | null,
    puntos_clave: g.puntos_clave.valor as string[] | null,
    para_quien: g.para_quien.valor as string | null,
    observaciones: g.observaciones.valor as string | null,
    confidence_score: g.confidence_score,
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