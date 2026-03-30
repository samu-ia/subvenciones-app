// Cliente para la API pública BDNS del Ministerio de Hacienda
const BDNS_BASE = 'https://www.pap.hacienda.gob.es/bdnstrans/GE/es/api'

export interface BdnsConvocatoria {
  idConvocatoria: string
  organo: string
  descripcion: string
  fechaRegistro: string
  fechaCierre: string
  importeTotal?: number
  urlBdns: string
}

export interface BdnsSearchParams {
  descripcion?: string
  organo?: string
  fechaDesde?: string
  fechaHasta?: string
  page?: number
  pageSize?: number
}

export async function searchConvocatorias(params: BdnsSearchParams = {}): Promise<BdnsConvocatoria[]> {
  const query = new URLSearchParams()
  if (params.descripcion) query.set('descripcion', params.descripcion)
  if (params.organo) query.set('organo', params.organo)
  if (params.fechaDesde) query.set('fechaDesde', params.fechaDesde)
  if (params.fechaHasta) query.set('fechaHasta', params.fechaHasta)
  query.set('page', String(params.page ?? 0))
  query.set('pageSize', String(params.pageSize ?? 20))

  const url = `${BDNS_BASE}/convocatorias?${query}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`BDNS API error: ${res.status}`)
  const data = await res.json()
  return data?.content ?? data ?? []
}
