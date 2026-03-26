/**
 * POST /api/matching/validar
 *
 * Fase 2 del matching: validación profunda de elegibilidad.
 *
 * Se llama cuando el cliente ha mostrado interés y respondido el cuestionario.
 * Devuelve veredicto: "elegible" | "revisar" | "no_elegible"
 *
 * Body:
 *   - subvencion_id: string   (obligatorio)
 *   - nif: string             (obligatorio — NIF del cliente)
 *   - respuestas: array       (respuestas al cuestionario, opcional)
 *
 * El resultado se guarda en cliente_subvencion_match.detalle_scoring
 * como campo "fase2" para trazabilidad.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { validarElegibilidadFase2 } from '@/lib/matching/deep-validator';
import type { InputFase2 } from '@/lib/matching/deep-validator';

export async function POST(request: NextRequest) {
  // Auth: cliente autenticado o admin
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.subvencion_id || !body?.nif) {
    return NextResponse.json({ error: 'subvencion_id y nif son obligatorios' }, { status: 400 });
  }

  const { subvencion_id, nif, respuestas } = body as {
    subvencion_id: string;
    nif: string;
    respuestas?: InputFase2['respuestas'];
  };

  // Verificar rol desde la tabla perfiles (no por email)
  const sb = createServiceClient();
  const { data: perfilUsuario } = await sb.from('perfiles').select('rol, nif').eq('id', user.id).maybeSingle();
  const esAdmin = perfilUsuario?.rol === 'admin';

  // Clientes solo pueden validar su propio NIF
  if (!esAdmin) {
    if (perfilUsuario?.nif !== nif) {
      return NextResponse.json({ error: 'No autorizado para este NIF' }, { status: 403 });
    }
  }

  // Cargar subvención con todas las tablas auxiliares
  const [
    { data: subv },
    { data: sectores },
    { data: tipos },
    { data: cliente },
    { data: iaProvider },
  ] = await Promise.all([
    sb.from('subvenciones')
      .select('titulo,organismo,objeto,para_quien,importe_maximo,plazo_fin,ambito_geografico,comunidad_autonoma')
      .eq('id', subvencion_id)
      .maybeSingle(),
    sb.from('subvencion_sectores')
      .select('cnae_codigo,nombre_sector,excluido')
      .eq('subvencion_id', subvencion_id),
    sb.from('subvencion_tipos_empresa')
      .select('tipo,excluido')
      .eq('subvencion_id', subvencion_id),
    sb.from('cliente')
      .select('nif,nombre_empresa,cnae_codigo,cnae_descripcion,comunidad_autonoma,tamano_empresa,num_empleados,facturacion_anual,anos_antiguedad,forma_juridica,descripcion_actividad')
      .eq('nif', nif)
      .maybeSingle(),
    sb.from('ia_providers')
      .select('provider,api_key,base_url')
      .eq('enabled', true)
      .not('api_key', 'is', null)
      .limit(1)
      .maybeSingle(),
  ]);

  if (!subv) return NextResponse.json({ error: 'Subvención no encontrada' }, { status: 404 });
  if (!cliente) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
  if (!iaProvider?.api_key) {
    return NextResponse.json({ error: 'No hay proveedor IA configurado' }, { status: 503 });
  }

  // Ejecutar Fase 2
  const resultado = await validarElegibilidadFase2({
    subvencion: {
      ...subv,
      sectores: sectores ?? [],
      tipos_empresa: tipos ?? [],
    },
    cliente,
    respuestas,
    iaProvider: {
      provider: iaProvider.provider,
      api_key: iaProvider.api_key,
      base_url: iaProvider.base_url,
    },
  });

  // Guardar resultado en cliente_subvencion_match para trazabilidad
  const { data: matchExistente } = await sb
    .from('cliente_subvencion_match')
    .select('id, detalle_scoring')
    .eq('nif', nif)
    .eq('subvencion_id', subvencion_id)
    .maybeSingle();

  if (matchExistente) {
    const detalleActualizado = {
      ...(matchExistente.detalle_scoring ?? {}),
      fase2: {
        veredicto: resultado.veredicto,
        confianza: resultado.confianza,
        motivo_principal: resultado.motivo_principal,
        validated_at: resultado.validated_at,
        requiere_revision_manual: resultado.requiere_revision_manual,
      },
    };
    await sb.from('cliente_subvencion_match')
      .update({ detalle_scoring: detalleActualizado })
      .eq('id', matchExistente.id);
  }

  return NextResponse.json({ ok: true, resultado });
}
