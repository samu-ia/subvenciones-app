/**
 * lib/matching/run-for-client.ts
 *
 * Lógica de matching extraída del route handler para poder
 * llamarla directamente sin HTTP (ej. desde /api/portal/setup).
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
      presupuesto_total, plazo_fin
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

  // Cargar sectores y tipos de empresa
  const subvIds = subvFiltradas.map(s => s.id);
  const [{ data: sectores }, { data: tipos }] = await Promise.all([
    sb.from('subvencion_sectores').select('subvencion_id,cnae_codigo,nombre_sector,excluido').in('subvencion_id', subvIds),
    sb.from('subvencion_tipos_empresa').select('subvencion_id,tipo,excluido').in('subvencion_id', subvIds),
  ]);

  const subvProfiles: SubvencionMatchProfile[] = subvFiltradas.map(s => ({
    ...s,
    sectores:      sectores?.filter(sec => sec.subvencion_id === s.id) ?? [],
    tipos_empresa: tipos?.filter(t => t.subvencion_id === s.id) ?? [],
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

  for (const subv of subvProfiles) {
    const scoreResult = calcularMatch(cliente, subv);

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

  return { nif, nuevos, actualizados, excluidos };
}
