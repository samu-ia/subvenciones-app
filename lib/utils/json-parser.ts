/**
 * lib/utils/json-parser.ts
 *
 * Extracción segura de JSON desde respuestas de LLM.
 * Los modelos a veces envuelven JSON en markdown, añaden texto antes/después,
 * o generan JSON con trailing commas o comentarios.
 */

/**
 * Extrae y parsea JSON desde una respuesta raw de LLM.
 * Estrategias por orden de preferencia:
 *  1. Parse directo
 *  2. Extraer bloque ```json ... ```
 *  3. Extraer primer objeto { ... } completo con balance de llaves
 *  4. Extraer primer array [ ... ] completo con balance de corchetes
 */
export function safeParseJSON<T = unknown>(raw: string): T {
  const trimmed = raw.trim();

  // 1. Parse directo
  try {
    return JSON.parse(trimmed) as T;
  } catch { /* continúa */ }

  // 2. Bloque ```json ... ``` o ``` ... ```
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim()) as T;
    } catch { /* continúa */ }
  }

  // 3. Extraer objeto { ... } balanceando llaves
  const objResult = extractBalanced(trimmed, '{', '}');
  if (objResult) {
    try {
      return JSON.parse(objResult) as T;
    } catch { /* continúa */ }
  }

  // 4. Extraer array [ ... ] balanceando corchetes
  const arrResult = extractBalanced(trimmed, '[', ']');
  if (arrResult) {
    try {
      return JSON.parse(arrResult) as T;
    } catch { /* continúa */ }
  }

  // 5. Fallback: limpiar trailing commas e intentar de nuevo
  const cleaned = trimmed
    .replace(/,\s*([}\]])/g, '$1')  // trailing commas
    .replace(/\/\/[^\n]*/g, '')      // comentarios de línea
    .replace(/\/\*[\s\S]*?\*\//g, '') // comentarios de bloque
    .trim();

  const cleanedObj = extractBalanced(cleaned, '{', '}');
  if (cleanedObj) {
    try {
      return JSON.parse(cleanedObj) as T;
    } catch { /* continúa */ }
  }

  throw new Error(
    `No se pudo extraer JSON válido de la respuesta del LLM.\n` +
    `Primeros 200 chars: ${raw.substring(0, 200)}`
  );
}

/**
 * Como safeParseJSON pero devuelve null en lugar de lanzar error.
 */
export function tryParseJSON<T = unknown>(raw: string): T | null {
  try {
    return safeParseJSON<T>(raw);
  } catch {
    return null;
  }
}

/**
 * Extrae el primer bloque balanceado entre openChar y closeChar.
 * Maneja strings con comillas para no contar llaves dentro de strings.
 */
function extractBalanced(text: string, open: string, close: string): string | null {
  const start = text.indexOf(open);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  return null;
}
