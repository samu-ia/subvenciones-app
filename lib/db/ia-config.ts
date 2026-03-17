/**
 * lib/db/ia-config.ts — Barrel re-export
 *
 * Mantiene compatibilidad con imports existentes.
 * Los módulos reales están en:
 *   ia-providers.ts  -> CRUD de proveedores (OpenAI, Anthropic, Google...)
 *   ia-tools.ts      -> CRUD de configuracion de herramientas
 *   ia-analytics.ts  -> Log de ejecuciones y estadisticas
 */

export * from './ia-providers';
export * from './ia-tools';
export * from './ia-analytics';
