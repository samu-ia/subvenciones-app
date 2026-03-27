/**
 * lib/matching/run-for-client.ts
 *
 * Lógica de matching extraída del route handler para poder
 * llamarla directamente sin HTTP (ej. desde /api/portal/setup).
 *
 * v2: Carga datos enriquecidos (requisitos, gastos, beneficiarios)
 *     cuando están disponibles para el motor v2.
 */

import { createServiceClient } from '@/lib/supabase/service';
import { calcularMatch } from '@/lib/matching/engine';
import type { ClienteMatchProfile, SubvencionMatchProfile } from '@/lib/matching/engine';

const GALICIA_FOCUS = process.env.GALICIA_FOCUS === 'true';

export interface MatchRunResult {
  nif: string;
  nuevos: number;
  actualizados: number;
  excluidos: number;
  version_stats?: { v1: number; v2: number };
}

/**
 * Calcula y persiste los matches para un cliente específico.
 * Solo recalcula — no borra registros existentes con estado interesado/descartado.
 */
export async function runMatchingForClient(nif: string): Promise<MatchRunResult> {
  const sb = createServiceClient();

  // Cargar datos del cliente
  const { data: clienteRaw } = await sb
    .from('cliente')
    .select('nif,nombre_empresa,cnae_codigo,cnae_descripcion,comunidad_autonoma,provincia,ciudad,tamano_empresa,forma_juridica,num_empleados,facturacion_anual,anos_antiguedad')
    .eq('nif', nif)
    .single();

  if (!clienteRaw) throw new Error(`Cliente no encontrado: ${nif}`);

  // Cargar subvenciones activas
  const { data: subvenciones } = await sb
    .from('subvenciones')
    .select(`
      id, bdns_id, titulo, organismo,
      ambito_geografico, comunidad_autonoma, provincia,
      estado_convocatoria, importe_maximo, importe_minimo,
      presupuesto_total, plazo_fin, para_quien
    `)
    .not('estado_convocatoria', 'in', '("cerrada","suspendida")');

  const subvFiltradas = GALICIA_FOCUS
    ? (subvenciones ?? []).filter(s => {
        const ca  = (s.comunidad_autonoma ?? '').toLowerCase();
        const amb = (s.ambito_geografico  ?? '').toLowerCase();
        return ca.includes('galicia')
          || ['nacional', 'estatal', 'europeo', 'europe', 'ue'].some(k => amb.includes(k))
          || !ca;
      })
    : (subvenciones ?? []);

  if (!subvFiltradas.length) return { nif, nuevos: 0, actualizados: 0, excluidos: 0 };

  // Cargar sectores, tipos, requisitos y gastos
  const subvIds = subvFiltradas.map(s => s.id);
  const [
    { data: sectores },
    { data: tipos },
    { data: requisitos },
    { data: gastos },
    { data: camposBeneficiarios },
  ] = await Promise.all([
    sb.from('subvencion_sectores')
      .select('subvencion_id,cnae_codigo,nombre_sector,excluido')
      .in('subvencion_id', subvIds),
    sb.from('subvencion_tipos_empresa')
      .select('subvencion_id,tipo,excluido')
      .in('subvencion_id', subvIds),
    sb.from('subvencion_requisitos')
      .select('subvencion_id,tipo,descripcion,obligatorio')
      .in('subvencion_id', subvIds),
    sb.from('subvencion_gastos')
      .select('subvencion_id,categoria,descripcion,porcentaje_max')
      .in('subvencion_id', subvIds),
    // Cargar beneficiarios desde campos_extraidos
    sb.from('subvencion_campos_extraidos')
      .select('subvencion_id,nombre_campo,valor_texto,valor_json')
      .in('subvencion_id', subvIds)
      .in('nombre_campo', ['beneficiarios', 'para_quien']),
  ]);

  // Construir mapa de beneficiarios desde campos_extraidos
  const beneficiariosMap = new Map<string, string[]>();
  const paraQuienMap = new Map<string, string>();
  for (const campo of camposBeneficiarios ?? []) {
    if (campo.nombre_campo === 'beneficiarios' && campo.valor_json) {
      const arr = Array.isArray(campo.valor_json)
        ? campo.valor_json as string[]
        : typeof campo.valor_json === 'string' ? [campo.valor_json] : [];
      if (arr.length > 0) beneficiariosMap.set(campo.subvencion_id, arr);
    } else if (campo.nombre_campo === 'para_quien' && campo.valor_texto) {
      paraQuienMap.set(campo.subvencion_id, campo.valor_texto);
    }
  }

  const subvProfiles: SubvencionMatchProfile[] = subvFiltradas.map(s => ({
    ...s,
    sectores:            sectores?.filter(sec => sec.subvencion_id === s.id) ?? [],
    tipos_empresa:       tipos?.filter(t => t.subvencion_id === s.id) ?? [],
    requisitos:          requisitos?.filter(r => r.subvencion_id === s.id) ?? [],
    gastos:              gastos?.filter(g => g.subvencion_id === s.id) ?? [],
    beneficiarios_texto: beneficiariosMap.get(s.id),
    para_quien:          paraQuienMap.get(s.id) ?? (s as Record<string, unknown>).para_quien as string | undefined,
  }));

  const cliente: ClienteMatchProfile = {
    nif:               clienteRaw.nif,
    nombre_empresa:    clienteRaw.nombre_empresa,
    cnae_codigo:       clienteRaw.cnae_codigo,
    cnae_descripcion:  clienteRaw.cnae_descripcion,
    comunidad_autonoma: clienteRaw.comunidad_autonoma,
    provincia:         clienteRaw.provincia,
    ciudad:            clienteRaw.ciudad,
    tamano_empresa:    clienteRaw.tamano_empresa,
    forma_juridica:    clienteRaw.forma_juridica,
    num_empleados:     clienteRaw.num_empleados,
    facturacion_anual: clienteRaw.facturacion_anual,
    anos_antiguedad:   clienteRaw.anos_antiguedad,
  };

  let nuevos = 0, actualizados = 0, excluidos = 0;
  let v1Count = 0, v2Count = 0;

  for (const subv of subvProfiles) {
    const scoreResult = calcularMatch(cliente, subv);

    // Track version stats
    if (scoreResult.version === 'v2') v2Count++;
    else v1Count++;

    if (scoreResult.score < 0.35 && !scoreResult.hard_exclude) continue;

    const row = {
      nif:             cliente.nif,
      subvencion_id:   subv.id,
      score:           scoreResult.score,
      motivos:         scoreResult.motivos,
      estado:          'nuevo',
      calculado_at:    new Date().toISOString(),
      detalle_scoring: scoreResult.detalle,
      es_hard_exclude: scoreResult.hard_exclude,
    };

    const { data: existente } = await sb
      .from('cliente_subvencion_match')
      .select('id, estado')
      .eq('nif', cliente.nif)
      .eq('subvencion_id', subv.id)
      .maybeSingle();

    if (existente) {
      if (['interesado', 'descartado'].includes(existente.estado)) {
        actualizados++;
        continue;
      }
      await sb.from('cliente_subvencion_match')
        .update({ ...row, estado: existente.estado })
        .eq('id', existente.id);
      actualizados++;
    } else {
      await sb.from('cliente_subvencion_match').insert(row);
      if (scoreResult.hard_exclude) excluidos++;
      else nuevos++;
    }
  }

  return {
    nif,
    nuevos,
    actualizados,
    excluidos,
    version_stats: { v1: v1Count, v2: v2Count },
  };
}
