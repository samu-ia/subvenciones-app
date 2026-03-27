/**
 * GET /api/portal/expediente/[id] — detalle completo de un expediente para el cliente propietario
 * Solo accesible por el cliente dueño del expediente (verificación por NIF)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // 1. Auth: verificar usuario autenticado
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const sb = createServiceClient();

  // 2. Obtener perfil y NIF del cliente
  const { data: perfil } = await sb
    .from('perfiles')
    .select('rol, nif')
    .eq('id', user.id)
    .maybeSingle();

  if (!perfil?.nif || perfil.rol !== 'cliente') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  // 3. Cargar expediente verificando propiedad por NIF
  const { data: expediente, error: expError } = await sb
    .from('expediente')
    .select(`
      id, nif, numero_bdns, estado, fase, fase_updated_at,
      titulo, organismo, notas,
      subvencion_id,
      plazo_solicitud, fecha_presentacion,
      fecha_resolucion_provisional, fecha_resolucion_definitiva,
      plazo_aceptacion, fecha_inicio_ejecucion, fecha_fin_ejecucion,
      plazo_justificacion, fecha_cobro,
      importe_solicitado, importe_concedido,
      fee_amount, fee_estado,
      contrato_firmado,
      created_at, updated_at
    `)
    .eq('id', id)
    .eq('nif', perfil.nif)
    .maybeSingle();

  if (expError) return NextResponse.json({ error: expError.message }, { status: 500 });
  if (!expediente) return NextResponse.json({ error: 'Expediente no encontrado' }, { status: 404 });

  // 4. Cargar datos relacionados en paralelo
  const [
    { data: subvencion },
    { data: fases },
    { data: checklistItems },
    { data: mensajes },
  ] = await Promise.all([
    // Datos de la subvención vinculada
    expediente.subvencion_id
      ? sb.from('subvenciones')
          .select('id, bdns_id, titulo, titulo_comercial, organismo, importe_maximo, presupuesto_total, porcentaje_financiacion, plazo_fin, objeto, resumen_ia, para_quien, url_oficial, estado_convocatoria')
          .eq('id', expediente.subvencion_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),

    // Timeline de fases
    sb.from('expediente_fases')
      .select('id, fase, orden, fecha_inicio, fecha_completada')
      .eq('expediente_id', id)
      .order('orden', { ascending: true }),

    // Checklist / documentos requeridos
    sb.from('checklist_items')
      .select('id, nombre, descripcion, categoria, obligatorio, completado, orden')
      .eq('expediente_id', id)
      .order('orden', { ascending: true }),

    // Últimos mensajes del chat con gestor
    sb.from('mensajes_gestor')
      .select('id, remitente, contenido, leido, created_at')
      .eq('nif', perfil.nif)
      .order('created_at', { ascending: true })
      .limit(50),
  ]);

  return NextResponse.json({
    expediente,
    subvencion: subvencion ?? null,
    fases: fases ?? [],
    checklist: checklistItems ?? [],
    mensajes: mensajes ?? [],
  });
}
