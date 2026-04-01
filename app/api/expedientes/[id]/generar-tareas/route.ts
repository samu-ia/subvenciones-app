/**
 * POST /api/expedientes/[id]/generar-tareas
 *
 * Usa Claude para analizar los requisitos de la subvención y generar
 * una lista de tareas/documentos que el cliente debe aportar.
 * Las tareas se guardan en checklist_items con generado_ia=true.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireAdminOrTramitador } from '@/lib/auth/helpers';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminOrTramitador();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const sb = createServiceClient();

  // Cargar expediente con subvención
  const { data: exp, error: expErr } = await sb
    .from('expediente')
    .select(`
      id, fase,
      subvencion:subvenciones(
        titulo, titulo_comercial, organismo, objeto, descripcion,
        beneficiarios, requisitos, gastos_elegibles, documentacion_requerida,
        sectores_actividad, para_quien, puntos_clave, resumen_ia
      ),
      cliente:perfiles!expediente_cliente_id_fkey(nombre_empresa, cnae_descripcion, tamano_empresa, descripcion_actividad)
    `)
    .eq('id', id)
    .maybeSingle();

  if (expErr || !exp) {
    return NextResponse.json({ error: 'Expediente no encontrado' }, { status: 404 });
  }

  // Checklist actual para no duplicar
  const { data: existing } = await sb
    .from('checklist_items')
    .select('nombre')
    .eq('expediente_id', id);

  const existingNames = new Set((existing ?? []).map(i => i.nombre.toLowerCase().trim()));

  // Construir prompt con datos de la subvención
  const sub = Array.isArray(exp.subvencion) ? exp.subvencion[0] : exp.subvencion;
  const cli = Array.isArray(exp.cliente) ? exp.cliente[0] : exp.cliente;

  const subInfo = [
    sub?.titulo_comercial || sub?.titulo ? `Subvención: ${sub.titulo_comercial || sub.titulo}` : '',
    sub?.organismo ? `Organismo: ${sub.organismo}` : '',
    sub?.objeto ? `Objeto: ${sub.objeto}` : '',
    sub?.descripcion ? `Descripción: ${sub.descripcion?.slice(0, 600)}` : '',
    sub?.beneficiarios ? `Beneficiarios: ${sub.beneficiarios?.slice(0, 400)}` : '',
    sub?.requisitos ? `Requisitos: ${sub.requisitos?.slice(0, 600)}` : '',
    sub?.gastos_elegibles ? `Gastos elegibles: ${sub.gastos_elegibles?.slice(0, 400)}` : '',
    sub?.documentacion_requerida ? `Documentación requerida: ${sub.documentacion_requerida?.slice(0, 600)}` : '',
    sub?.puntos_clave?.length ? `Puntos clave: ${(sub.puntos_clave as string[]).join('; ')}` : '',
    cli?.nombre_empresa ? `Empresa: ${cli.nombre_empresa}` : '',
    cli?.cnae_descripcion ? `Actividad: ${cli.cnae_descripcion}` : '',
    cli?.tamano_empresa ? `Tamaño: ${cli.tamano_empresa}` : '',
  ].filter(Boolean).join('\n');

  const systemPrompt = `Eres un experto en tramitación de subvenciones públicas en España.
Tu tarea es analizar los datos de una convocatoria de subvención y generar una lista de documentos y acciones
que el cliente (empresa solicitante) debe aportar o completar para tramitar la solicitud.

Responde ÚNICAMENTE con un array JSON. Cada elemento debe tener:
- "nombre": string corto y claro (máx. 80 chars) — el nombre del documento o tarea
- "descripcion": string explicativo breve (máx. 200 chars) — qué es exactamente y por qué se necesita
- "categoria": una de estas categorías: "identidad", "fiscal", "laboral", "tecnico", "juridico", "financiero", "otro"
- "obligatorio": boolean — true si es imprescindible para presentar la solicitud
- "tipo": uno de: "documento", "accion", "verificacion"

Genera entre 6 y 15 tareas específicas y prácticas. No inventes requisitos que no sean razonables para este tipo de subvención.`;

  const userPrompt = `Datos de la subvención:\n${subInfo}\n\nGenera la lista de tareas para el cliente.`;

  let tareas: { nombre: string; descripcion: string; categoria: string; obligatorio: boolean; tipo: string }[] = [];

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
    // Extraer JSON del texto (puede venir con markdown code block)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      tareas = JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('[generar-tareas] Error llamando Claude:', e);
    return NextResponse.json({ error: 'Error generando tareas con IA' }, { status: 500 });
  }

  if (!Array.isArray(tareas) || tareas.length === 0) {
    return NextResponse.json({ error: 'La IA no pudo generar tareas' }, { status: 500 });
  }

  // Filtrar duplicados respecto al checklist actual
  const nuevas = tareas.filter(t => !existingNames.has(t.nombre.toLowerCase().trim()));

  if (nuevas.length === 0) {
    return NextResponse.json({ count: 0, message: 'Todas las tareas ya existen en el checklist' });
  }

  // Insertar en checklist_items
  const rows = nuevas.map((t, i) => ({
    expediente_id: id,
    nombre: t.nombre,
    descripcion: t.descripcion ?? null,
    categoria: t.categoria ?? 'otro',
    obligatorio: t.obligatorio ?? true,
    tipo: ['documento', 'accion', 'verificacion'].includes(t.tipo) ? t.tipo : 'documento',
    generado_ia: true,
    completado: false,
    orden: (existing?.length ?? 0) + i,
  }));

  const { data: inserted, error: insertErr } = await sb
    .from('checklist_items')
    .insert(rows)
    .select('id, nombre, categoria, obligatorio, tipo');

  if (insertErr) {
    console.error('[generar-tareas] Error insertando:', insertErr);
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ count: inserted?.length ?? 0, items: inserted });
}
