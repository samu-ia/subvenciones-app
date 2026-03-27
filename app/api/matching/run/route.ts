/**
 * POST /api/matching/run
 *
 * Ejecuta el motor de matching para todos los clientes (o uno específico).
 * Calcula scores y guarda en cliente_subvencion_match.
 * Solo accesible por admins o con INGEST_SECRET.
 *
 * Body: { nif?: string }  — si se pasa nif, solo recalcula ese cliente
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { calcularMatch } from '@/lib/matching/engine';
import type { ClienteMatchProfile, SubvencionMatchProfile } from '@/lib/matching/engine';
import { requireRole } from '@/lib/auth/helpers';
import { sendMatchNotificationEmail } from '@/lib/notifications';

// Foco geográfico: false = toda España (por defecto)
// true solo si GALICIA_FOCUS=true está explícitamente en .env
const GALICIA_FOCUS = process.env.GALICIA_FOCUS === "true";


export const maxDuration = 60;

export async function POST(request: NextRequest) {
  // Auth
  const authHeader = request.headers.get('authorization') ?? '';
  const secret = process.env.INGEST_SECRET;
  const secretOk = secret && authHeader.replace('Bearer ', '').trim() === secret;

  if (!secretOk) {
    const authResult = await requireRole('admin');
    if (authResult instanceof NextResponse) return authResult;
  }

  const body = await request.json().catch(() => ({}));
  const filtroNif: string | undefined = body.nif;

  const sb = createServiceClient();

  // Cargar clientes
  const clientesQuery = sb
    .from('cliente')
    .select('nif,nombre_empresa,cnae_codigo,cnae_descripcion,comunidad_autonoma,provincia,ciudad,tamano_empresa,forma_juridica,num_empleados,facturacion_anual,anos_antiguedad,email_normalizado');
  if (filtroNif) clientesQuery.eq('nif', filtroNif);
  const { data: clientes, error: errC } = await clientesQuery;
  if (errC) return NextResponse.json({ error: errC.message }, { status: 500 });

  // Cargar subvenciones activas con sus tablas auxiliares
  const { data: subvenciones } = await sb
    .from('subvenciones')
    .select(`
      id, bdns_id, titulo, organismo,
      ambito_geografico, comunidad_autonoma, provincia,
      estado_convocatoria, importe_maximo, importe_minimo,
      presupuesto_total, plazo_fin
    `)
    .not('estado_convocatoria', 'in', '("cerrada","suspendida")');

  // Filtro Galicia: solo subvenciones de Galicia o ámbito nacional/estatal/europeo
  const subvFiltradas = GALICIA_FOCUS
    ? (subvenciones ?? []).filter(s => {
        const ca = (s.comunidad_autonoma ?? '').toLowerCase();
        const amb = (s.ambito_geografico ?? '').toLowerCase();
        const esGalicia = ca.includes('galicia');
        const esNacional = ['nacional', 'estatal', 'europeo', 'europe', 'ue'].some(k => amb.includes(k));
        const sinCA = !ca; // sin CA especificada = aplicable a todos
        return esGalicia || esNacional || sinCA;
      })
    : (subvenciones ?? []);

  if (!subvFiltradas.length) {
    return NextResponse.json({ ok: true, message: 'Sin subvenciones activas', matches: 0 });
  }

  // Cargar sectores y tipos por subvención
  const subvIds = subvFiltradas.map(s => s.id);
  const [{ data: sectores }, { data: tipos }] = await Promise.all([
    sb.from('subvencion_sectores').select('subvencion_id,cnae_codigo,nombre_sector,excluido').in('subvencion_id', subvIds),
    sb.from('subvencion_tipos_empresa').select('subvencion_id,tipo,excluido').in('subvencion_id', subvIds),
  ]);

  // Construir perfiles de subvenciones
  const subvProfiles: SubvencionMatchProfile[] = subvFiltradas.map(s => ({
    ...s,
    sectores: sectores?.filter(sec => sec.subvencion_id === s.id) ?? [],
    tipos_empresa: tipos?.filter(t => t.subvencion_id === s.id) ?? [],
  }));

  // Calcular matches
  let nuevos = 0, actualizados = 0, excluidos = 0;
  const erroresDetalle: string[] = [];
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ayudapyme.es';
  let emailsEnviados = 0;

  for (const clienteRaw of (clientes ?? [])) {
    const cliente: ClienteMatchProfile = {
      nif: clienteRaw.nif,
      nombre_empresa: clienteRaw.nombre_empresa,
      cnae_codigo: clienteRaw.cnae_codigo,
      cnae_descripcion: clienteRaw.cnae_descripcion,
      comunidad_autonoma: clienteRaw.comunidad_autonoma,
      provincia: clienteRaw.provincia,
      ciudad: clienteRaw.ciudad,
      tamano_empresa: clienteRaw.tamano_empresa,
      forma_juridica: clienteRaw.forma_juridica,
      num_empleados: clienteRaw.num_empleados,
      facturacion_anual: clienteRaw.facturacion_anual,
      anos_antiguedad: clienteRaw.anos_antiguedad,
    };

    let nuevosCliente = 0;

    for (const subv of subvProfiles) {
      const scoreResult = calcularMatch(cliente, subv);

      // Preparar fila para upsert
      const row = {
        nif: cliente.nif,
        subvencion_id: subv.id,
        score: scoreResult.score,
        motivos: scoreResult.motivos,
        estado: 'nuevo',
        calculado_at: new Date().toISOString(),
        detalle_scoring: scoreResult.detalle,
        es_hard_exclude: scoreResult.hard_exclude,
      };

      // Solo guardamos si score >= 35% o es hard_exclude (descartar mismatches confirmados <35%)
      if (scoreResult.score >= 0.35 || scoreResult.hard_exclude) {
        const { data: existente } = await sb
          .from('cliente_subvencion_match')
          .select('id, estado')
          .eq('nif', cliente.nif)
          .eq('subvencion_id', subv.id)
          .maybeSingle();

        if (existente) {
          // No sobrescribir si ya hay una solicitud en curso
          if (['interesado', 'descartado'].includes(existente.estado)) {
            actualizados++;
            continue;
          }
          await sb.from('cliente_subvencion_match')
            .update({ ...row, estado: existente.estado })
            .eq('id', existente.id);
          actualizados++;
        } else {
          const { error } = await sb.from('cliente_subvencion_match').insert(row);
          if (error) erroresDetalle.push(`${cliente.nif}/${subv.bdns_id}: ${error.message}`);
          else if (scoreResult.hard_exclude) excluidos++;
          else { nuevos++; nuevosCliente++; }
        }
      }
    }

    // Enviar email de notificación si se encontraron nuevos matches
    if (nuevosCliente > 0 && clienteRaw.email_normalizado) {
      try {
        const res = await sendMatchNotificationEmail(
          clienteRaw.email_normalizado,
          clienteRaw.nombre_empresa || clienteRaw.nif,
          clienteRaw.nif,
          `${siteUrl}/portal`,
        );
        if (res.ok) emailsEnviados++;
        else console.warn(`[matching/run] Email no enviado a ${clienteRaw.nif}: ${res.error}`);
      } catch (err) {
        console.error(`[matching/run] Error enviando email a ${clienteRaw.nif}:`, (err as Error).message);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    clientes_procesados: clientes?.length ?? 0,
    subvenciones_activas: subvFiltradas.length,
    nuevos,
    actualizados,
    excluidos,
    emails_enviados: emailsEnviados,
    errores: erroresDetalle.slice(0, 10),
  });
}

export async function GET() {
  return NextResponse.json({ endpoint: 'POST /api/matching/run', descripcion: 'Ejecuta el motor de matching' });
}
