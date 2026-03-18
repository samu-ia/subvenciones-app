/**
 * lib/subvenciones/bdns-client.ts
 *
 * Cliente para la API pública de BDNS (Base de Datos Nacional de Subvenciones).
 * Endpoint oficial: https://www.infosubvenciones.es/bdnstrans/api
 *
 * Arquitectura intercambiable: todos los fetchers implementan SubvencionFuente,
 * de modo que en el futuro se puede añadir MCP, BOE, o scraping sin cambiar el pipeline.
 */

import type { BdnsConvocatoria, BdnsListResponse } from '@/lib/types/subvenciones-pipeline';

// ─── Interfaz base (intercambiable) ──────────────────────────────────────────

export interface FuenteSubvenciones {
  /**
   * Obtiene convocatorias publicadas en un rango de fechas.
   * Devuelve páginas de convocatorias para no sobrecargar la memoria.
   */
  listarConvocatorias(params: {
    fechaDesde: string;   // YYYY-MM-DD
    fechaHasta: string;   // YYYY-MM-DD
    pagina?: number;
    tamanio?: number;
    organo?: string;
  }): Promise<{ items: BdnsConvocatoria[]; totalPaginas: number; totalItems: number }>;

  /** Obtiene el detalle de una convocatoria por su ID */
  obtenerDetalle(bdnsId: string): Promise<BdnsConvocatoria | null>;

  /** Nombre legible de la fuente */
  readonly nombre: string;
}

// ─── Cliente BDNS directo ─────────────────────────────────────────────────────

const BDNS_BASE_URL = 'https://www.infosubvenciones.es/bdnstrans/api';

/**
 * Implementación contra la API REST oficial de BDNS.
 * Documentación: https://www.infosubvenciones.es/bdnstrans/api/swagger-ui.html
 *
 * Sin necesidad de API key. Rate limit suave (~1 req/s recomendado).
 */
export class BdnsClient implements FuenteSubvenciones {
  readonly nombre = 'BDNS';

  private async fetchJson<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${BDNS_BASE_URL}${path}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
      });
    }

    const res = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'SubvencionesApp/1.0',
      },
      // Railway tiene timeout de 30s — le damos 20s por llamada
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      throw new Error(`BDNS API error ${res.status}: ${url.toString()}`);
    }

    return res.json() as Promise<T>;
  }

  async listarConvocatorias(params: {
    fechaDesde: string;
    fechaHasta: string;
    pagina?: number;
    tamanio?: number;
    organo?: string;
  }): Promise<{ items: BdnsConvocatoria[]; totalPaginas: number; totalItems: number }> {
    const pagina = params.pagina ?? 0;
    const tamanio = params.tamanio ?? 50;

    // ── Estrategia 1: /convocatorias/busqueda (Swagger oficial BDNS) ─────────
    try {
      return await this.buscarPorBusqueda(params, pagina, tamanio);
    } catch (err1) {
      console.warn('[BdnsClient] /convocatorias/busqueda falló:', (err1 as Error).message);
    }

    // ── Estrategia 2: /convocatorias con page/size Spring ────────────────────
    try {
      return await this.buscarPorConvocatoriasSpring(params, pagina, tamanio);
    } catch (err2) {
      console.warn('[BdnsClient] /convocatorias Spring falló:', (err2 as Error).message);
    }

    // ── Estrategia 3: /convocatorias/ultimas (sin filtros de fecha) ──────────
    try {
      return await this.buscarUltimas(tamanio);
    } catch (err3) {
      console.warn('[BdnsClient] /convocatorias/ultimas falló:', (err3 as Error).message);
    }

    // Sin datos — devolver vacío para no bloquear el pipeline
    console.error('[BdnsClient] Todos los endpoints BDNS fallaron. Devolviendo resultado vacío.');
    return { items: [], totalPaginas: 0, totalItems: 0 };
  }

  /**
   * /convocatorias/busqueda — endpoint documentado en Swagger BDNS
   * GET https://www.infosubvenciones.es/bdnstrans/api/convocatorias/busqueda
   * Parámetros: vpd, anunciadaDesde, anunciadaHasta, page, pageSize
   */
  private async buscarPorBusqueda(
    params: { fechaDesde: string; fechaHasta: string; organo?: string },
    pagina: number,
    tamanio: number
  ): Promise<{ items: BdnsConvocatoria[]; totalPaginas: number; totalItems: number }> {
    const queryParams: Record<string, string> = {
      'vpd': 'GE',                       // Gobierno de España
      'anunciadaDesde': params.fechaDesde,
      'anunciadaHasta': params.fechaHasta,
      'page': String(pagina),
      'pageSize': String(tamanio),
    };
    if (params.organo) queryParams['codigoOrgano'] = params.organo;

    const data = await this.fetchJson<{
      listaConvocatorias?: BdnsConvocatoria[];
      numTotalConvocatorias?: number;
      content?: BdnsConvocatoria[];
      totalElements?: number;
      totalPages?: number;
    }>('/convocatorias/busqueda', queryParams);

    const items = data.listaConvocatorias ?? data.content ?? [];
    const total = data.numTotalConvocatorias ?? data.totalElements ?? items.length;

    return {
      items,
      totalPaginas: data.totalPages ?? Math.ceil(total / tamanio),
      totalItems: total,
    };
  }

  /**
   * /convocatorias — paginación estilo Spring (page/size/sort)
   */
  private async buscarPorConvocatoriasSpring(
    params: { fechaDesde: string; fechaHasta: string; organo?: string },
    pagina: number,
    tamanio: number
  ): Promise<{ items: BdnsConvocatoria[]; totalPaginas: number; totalItems: number }> {
    const queryParams: Record<string, string> = {
      'vpd': 'GE',
      'anunciadaDesde': params.fechaDesde,
      'anunciadaHasta': params.fechaHasta,
      'page': String(pagina),
      'size': String(tamanio),
    };
    if (params.organo) queryParams['organo'] = params.organo;

    const data = await this.fetchJson<BdnsListResponse>('/convocatorias', queryParams);

    return {
      items: data.content ?? [],
      totalPaginas: data.totalPages ?? 1,
      totalItems: data.totalElements ?? 0,
    };
  }

  /**
   * /convocatorias/ultimas — últimas publicadas, sin filtros
   */
  private async buscarUltimas(
    tamanio: number
  ): Promise<{ items: BdnsConvocatoria[]; totalPaginas: number; totalItems: number }> {
    const data = await this.fetchJson<{
      listaConvocatorias?: BdnsConvocatoria[];
      content?: BdnsConvocatoria[];
    }>('/convocatorias/ultimas', {
      'vpd': 'GE',
      'pageSize': String(tamanio),
    });

    const items = data.listaConvocatorias ?? data.content ?? [];
    return { items, totalPaginas: 1, totalItems: items.length };
  }

  async obtenerDetalle(bdnsId: string): Promise<BdnsConvocatoria | null> {
    try {
      const data = await this.fetchJson<BdnsConvocatoria>(`/convocatorias/${bdnsId}`);
      return data;
    } catch {
      return null;
    }
  }
}

// ─── Cliente MCP (microservicio HTTP) ─────────────────────────────────────────

/**
 * Implementación que consume el MCP de datos españoles como microservicio HTTP.
 * Configura MCP_URL como variable de entorno apuntando al servicio desplegado en Railway.
 *
 * Uso:
 *   MCP_URL=https://spanish-public-data-mcp.up.railway.app
 *
 * El MCP expone: POST /tools/search_grants con body { date_from, date_to, limit }
 */
export class McpFuenteClient implements FuenteSubvenciones {
  readonly nombre = 'MCP';
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? process.env.MCP_URL ?? 'http://localhost:8080';
  }

  async listarConvocatorias(params: {
    fechaDesde: string;
    fechaHasta: string;
    pagina?: number;
    tamanio?: number;
    organo?: string;
  }): Promise<{ items: BdnsConvocatoria[]; totalPaginas: number; totalItems: number }> {
    const res = await fetch(`${this.baseUrl}/tools/search_grants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date_from: params.fechaDesde,
        date_to: params.fechaHasta,
        limit: params.tamanio ?? 50,
        granting_body: params.organo,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) throw new Error(`MCP error ${res.status}`);

    const data = await res.json();
    // Normalizar respuesta MCP al formato BdnsConvocatoria
    const items: BdnsConvocatoria[] = (data.grants ?? data.results ?? data ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (g: any) => this.normalizarMcpGrant(g)
    );

    return { items, totalPaginas: 1, totalItems: items.length };
  }

  async obtenerDetalle(bdnsId: string): Promise<BdnsConvocatoria | null> {
    try {
      const res = await fetch(`${this.baseUrl}/tools/get_grant_details`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grant_id: bdnsId }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return this.normalizarMcpGrant(data);
    } catch {
      return null;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private normalizarMcpGrant(g: any): BdnsConvocatoria {
    return {
      numeroConvocatoria: g.grant_id ?? g.id ?? g.bdns_id ?? '',
      titulo: g.title ?? g.titulo ?? '',
      organo: g.granting_body ?? g.organismo ?? g.organ ?? '',
      descripcionObjetivo: g.description ?? g.objeto ?? '',
      fechaPublicacion: g.publication_date ?? g.fecha_publicacion ?? '',
      fechaInicioSolicitud: g.start_date ?? g.fecha_inicio ?? '',
      fechaFinSolicitud: g.end_date ?? g.fecha_fin ?? '',
      importeTotal: g.total_amount ?? g.importe_total,
      importeMaximo: g.max_amount ?? g.importe_maximo,
      urlConvocatoria: g.url ?? g.url_oficial ?? '',
      urlPdf: g.pdf_url ?? g.url_pdf ?? '',
      estadoConvocatoria: g.status ?? g.estado ?? '',
      ...g,
    };
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export type FuenteNombre = 'bdns' | 'mcp';

/**
 * Devuelve la fuente configurada según variables de entorno.
 * Por defecto usa BDNS directo. Si MCP_URL está configurado y BDNS_FUENTE=mcp, usa MCP.
 */
export function crearFuente(fuente?: FuenteNombre): FuenteSubvenciones {
  const fuenteEfectiva = fuente ?? (process.env.BDNS_FUENTE as FuenteNombre) ?? 'bdns';

  switch (fuenteEfectiva) {
    case 'mcp':
      return new McpFuenteClient();
    case 'bdns':
    default:
      return new BdnsClient();
  }
}
