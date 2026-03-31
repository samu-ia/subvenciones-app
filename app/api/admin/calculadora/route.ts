/**
 * GET /api/admin/calculadora?nif=B12345678
 * Calcula el potencial de subvenciones para una empresa.
 * Útil para la llamada de ventas: "puedes conseguir hasta X€ en subvenciones".
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireAdminOrTramitador } from '@/lib/auth/helpers';

export async function GET(request: NextRequest) {
  const auth = await requireAdminOrTramitador();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const nif = searchParams.get('nif')?.toUpperCase().trim();

  if (!nif) return NextResponse.json({ error: 'nif requerido' }, { status: 400 });

  const sb = createServiceClient();

  // Datos de la empresa
  const { data: cliente } = await sb
    .from('cliente')
    .select('nombre_empresa, actividad, cnae_descripcion, tamano_empresa, comunidad_autonoma, num_empleados, facturacion_anual, anos_antiguedad')
    .eq('nif', nif)
    .maybeSingle();

  if (!cliente) return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 });

  // Matches existentes
  const { data: matches } = await sb
    .from('cliente_subvencion_match')
    .select('score, subvencion:subvenciones(titulo, titulo_comercial, organismo, importe_maximo, presupuesto_total, porcentaje_financiacion, estado_convocatoria, plazo_fin)')
    .eq('cliente_id', nif)
    .not('es_hard_exclude', 'is', null)
    .order('score', { ascending: false })
    .limit(50);

  const ahora = new Date();

  // Filtrar convocatorias abiertas o próximas
  const activas = (matches ?? []).filter(m => {
    const s = (Array.isArray(m.subvencion) ? m.subvencion[0] : m.subvencion) as Record<string, unknown> | null;
    if (!s) return false;
    const estado = s.estado_convocatoria as string | null;
    const plazo = s.plazo_fin ? new Date(s.plazo_fin as string) : null;
    const abierta = estado === 'abierta' || (plazo && plazo > ahora);
    return abierta && (m.score ?? 0) >= 0.35;
  });

  // Cálculos de potencial
  const importes = activas.map(m => {
    const s = (Array.isArray(m.subvencion) ? m.subvencion[0] : m.subvencion) as Record<string, unknown> | null;
    const importe = Number(s?.importe_maximo ?? 0);
    const pct = Number(s?.porcentaje_financiacion ?? 50) / 100;
    // Estimación conservadora: 30% probabilidad de concesión × importe máximo × porcentaje financiación
    return {
      titulo: (s?.titulo_comercial || s?.titulo || 'Subvención') as string,
      organismo: (s?.organismo ?? '') as string,
      importe_maximo: importe,
      importe_estimado: Math.round(importe * pct * m.score * 0.3),
      score: m.score,
      estado: (s?.estado_convocatoria ?? '') as string,
      plazo_fin: s?.plazo_fin as string | null,
    };
  });

  const totalPotencial = importes.reduce((s, i) => s + i.importe_estimado, 0);
  const totalMaximo = importes.reduce((s, i) => s + i.importe_maximo, 0);
  const feeEstimado = Math.max(totalPotencial * 0.15, activas.length > 0 ? 300 : 0);

  // Top 5 subvenciones por importe estimado
  const top5 = [...importes].sort((a, b) => b.importe_estimado - a.importe_estimado).slice(0, 5);

  return NextResponse.json({
    empresa: {
      nif,
      nombre: cliente.nombre_empresa,
      sector: cliente.actividad ?? cliente.cnae_descripcion,
      tamano: cliente.tamano_empresa,
      comunidad: cliente.comunidad_autonoma,
    },
    resumen: {
      total_subvenciones_activas: activas.length,
      importe_maximo_total: totalMaximo,
      potencial_estimado: totalPotencial, // Estimación conservadora
      fee_estimado: feeEstimado,
      // Para la llamada de ventas:
      mensaje_ventas: activas.length > 0
        ? `Hemos detectado ${activas.length} subvenciones activas para ${cliente.nombre_empresa ?? nif}, con un importe máximo total de ${totalMaximo.toLocaleString('es-ES')} €. Nuestro potencial estimado de captación ronda los ${totalPotencial.toLocaleString('es-ES')} €, con una comisión de éxito de aproximadamente ${feeEstimado.toLocaleString('es-ES')} €.`
        : `No se han detectado subvenciones activas para ${cliente.nombre_empresa ?? nif} con los datos actuales. Se recomienda ampliar el perfil de la empresa.`,
    },
    top_subvenciones: top5,
  });
}
