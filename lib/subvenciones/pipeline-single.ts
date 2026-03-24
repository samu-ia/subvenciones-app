/**
 * lib/subvenciones/pipeline-single.ts
 *
 * Reprocesa una única subvención por su bdns_id.
 * Usado por el endpoint de reanálisis manual.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { extraerConIaConGrounding, groundingToLegacy } from './ai-extractor';
import { normalizarYGuardar } from './normalizer';
import { persistirGrounding } from './grounding-writer';
import { procesarDocumentos, obtenerMejorTexto } from './document-manager';
import { persistirEstadoCalculado } from './estado-calculator';

interface IaConfig {
  provider: string;
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

async function obtenerConfigIa(supabase: SupabaseClient): Promise<IaConfig | null> {
  const { data } = await supabase
    .from('ia_providers')
    .select('provider, api_key, base_url')
    .eq('enabled', true)
    .not('api_key', 'is', null)
    .limit(1)
    .maybeSingle();
  if (!data?.api_key) return null;
  return { provider: data.provider, apiKey: data.api_key, baseUrl: data.base_url };
}

export async function ejecutarPipelineSubvencion(
  supabase: SupabaseClient,
  bdnsId: string,
  opciones: { forzarReanalisis?: boolean; forzarRedescarga?: boolean } = {},
): Promise<{ ok: boolean; error?: string }> {
  try {
    // Obtener subvención y raw
    const { data: subv } = await supabase
      .from('subvenciones')
      .select('id, titulo, organismo, raw_id, plazo_inicio, plazo_fin, fecha_publicacion')
      .eq('bdns_id', bdnsId)
      .maybeSingle();

    if (!subv) return { ok: false, error: 'Subvención no encontrada' };

    const { data: raw } = await supabase
      .from('subvenciones_raw')
      .select('raw_json')
      .eq('id', subv.raw_id)
      .maybeSingle();

    const rawJson = (raw?.raw_json ?? {}) as Record<string, unknown>;

    // 1. Reprocesar documentos
    if (opciones.forzarRedescarga) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await procesarDocumentos(supabase, subv.id, bdnsId, rawJson as any, { forzarRedescarga: true });
    }

    // 2. Obtener mejor texto disponible
    const textoInfo = await obtenerMejorTexto(supabase, subv.id);

    // 3. Reanalizar con IA
    const iaConfig = await obtenerConfigIa(supabase);
    if (!iaConfig) return { ok: false, error: 'Sin proveedor IA configurado' };

    if (textoInfo && textoInfo.texto.trim().length > 100) {
      const grounding = await extraerConIaConGrounding(
        textoInfo.texto,
        { titulo: subv.titulo ?? '', organismo: subv.organismo ?? '' },
        iaConfig
      );

      // Guardar grounding
      await persistirGrounding(supabase, subv.id, bdnsId, textoInfo.docId, grounding, rawJson);

      // Normalizar con el resultado legacy
      const iaLegacy = groundingToLegacy(grounding);
      await normalizarYGuardar(supabase, {
        rawId: subv.raw_id,
        bdns_id: bdnsId,
        raw: rawJson as Parameters<typeof normalizarYGuardar>[1]['raw'],
        ia: iaLegacy,
        iaModelo: grounding.modelo,
        fuente: 'bdns',
      });

      // Recalcular estado basándonos en los eventos detectados
      const { data: eventos } = await supabase
        .from('subvencion_eventos')
        .select('tipo_evento, fecha_evento, fecha_evento_fin')
        .eq('subvencion_id', subv.id);

      await persistirEstadoCalculado(supabase, subv.id, bdnsId, {
        plazo_inicio: grounding.plazo_inicio.valor as string | null,
        plazo_fin: grounding.plazo_fin.valor as string | null,
        fecha_publicacion: subv.fecha_publicacion,
        eventos: eventos ?? [],
      });
    } else {
      // Sin texto: solo recalcular estado con lo que hay
      const { data: eventos } = await supabase
        .from('subvencion_eventos')
        .select('tipo_evento, fecha_evento, fecha_evento_fin')
        .eq('subvencion_id', subv.id);

      await persistirEstadoCalculado(supabase, subv.id, bdnsId, {
        plazo_inicio: subv.plazo_inicio,
        plazo_fin: subv.plazo_fin,
        fecha_publicacion: subv.fecha_publicacion,
        eventos: eventos ?? [],
      });
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
