/**
 * lib/utils/ai-retry.ts
 *
 * Retry con backoff exponencial para llamadas a APIs de IA.
 * Reintenta en: 429 (rate limit), 500/502/503/504 (errores servidor), timeouts de red.
 */

export interface RetryOptions {
  maxAttempts?: number;   // default: 3
  baseDelayMs?: number;   // default: 1000ms
  maxDelayMs?: number;    // default: 30000ms
  jitter?: boolean;       // default: true — evita thundering herd
}

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

/**
 * Ejecuta fn con retry automático.
 * Lanza el último error si se agotan los intentos.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 1000,
    maxDelayMs = 30000,
    jitter = true,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      const isLast = attempt === maxAttempts;

      if (isLast) break;

      // ¿Es un error que vale la pena reintentar?
      if (!isRetryable(err)) throw err;

      // Backoff exponencial: 1s, 2s, 4s… con jitter ±20%
      let delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
      if (jitter) delay = delay * (0.8 + Math.random() * 0.4);

      // Si la respuesta tiene Retry-After, respetarlo
      const retryAfter = getRetryAfter(err);
      if (retryAfter) delay = Math.max(delay, retryAfter * 1000);

      console.warn(
        `[ai-retry] Intento ${attempt}/${maxAttempts} fallido. ` +
        `Reintentando en ${Math.round(delay)}ms…`
      );

      await sleep(delay);
    }
  }

  throw lastError;
}

function isRetryable(err: unknown): boolean {
  if (err instanceof Error) {
    // Errores de red / timeout
    if (err.message.includes('ECONNRESET') || err.message.includes('ETIMEDOUT') ||
        err.message.includes('fetch failed') || err.message.includes('network') ||
        err.message.includes('timeout')) {
      return true;
    }
  }

  // Errores HTTP con status retryable
  const status = getStatusCode(err);
  if (status && RETRYABLE_STATUS.has(status)) return true;

  return false;
}

function getStatusCode(err: unknown): number | null {
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>;
    if (typeof e.status === 'number') return e.status;
    if (typeof e.statusCode === 'number') return e.statusCode;
    if (e.response && typeof (e.response as Record<string, unknown>).status === 'number') {
      return (e.response as Record<string, unknown>).status as number;
    }
  }
  return null;
}

function getRetryAfter(err: unknown): number | null {
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>;
    const headers = e.headers as Record<string, string> | undefined;
    if (headers?.['retry-after']) {
      const val = parseInt(headers['retry-after'], 10);
      if (!isNaN(val)) return val;
    }
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
