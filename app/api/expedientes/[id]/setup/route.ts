/**
 * POST /api/expedientes/[id]/setup
 *
 * Setup automático de un expediente recién creado:
 * 1. Lee datos subvención + cliente + texto bases reguladoras
 * 2. Genera checklist de documentación requerida (IA)
 * 3. Rellena documento "Memoria" con datos del cliente y subvención
 * 4. Matchea 3 proveedores del catálogo y genera propuesta personalizada
 *
 * Solo accesible por admins o con INGEST_SECRET.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export const maxDuration = 60;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function callAI(prompt: string, system: string, apiKey: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      max_tokens: 2000,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI error: ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth: admin session o INGEST_SECRET
  const authHeader = request.headers.get('authorization') ?? '';
  const secret = process.env.INGEST_SECRET;
  const secretOk = secret && authHeader.replace('Bearer ', '').trim() === secret;

  if (!secretOk) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { data: perfil } = await supabase.from('perfiles').select('rol').eq('id', user.id).maybeSingle();
    if (perfil?.rol !== 'admin') return NextResponse.json({ error: 'Solo admins' }, { status: 403 });
  }

  const { id: expedienteId } = await params;
  const sb = createServiceClient();

  // ── Cargar expediente ──────────────────────────────────────────────────────
  const { data: exp } = await sb
    .from('expediente')
    .select('id, nif, titulo, organismo, subvencion_id')
    .eq('id', expedienteId)
    .maybeSingle();

  if (!exp) return NextResponse.json({ error: 'Expediente no encontrado' }, { status: 404 });

  // ── Cargar cliente ─────────────────────────────────────────────────────────
  const { data: cliente } = await sb
    .from('cliente')
    .select('nif, nombre_empresa, cnae_descripcion, comunidad_autonoma, ciudad, num_empleados, facturacion_anual, forma_juridica, anos_antiguedad, descripcion_actividad')
    .eq('nif', exp.nif)
    .maybeSingle();

  // ── Cargar subvención + texto bases reguladoras ───────────────────────────
  let subvTexto = '';
  let subvData: Record<string, unknown> = {};

  if (exp.subvencion_id) {
    const { data: subv } = await sb
      .from('subvenciones')
      .select('titulo, organismo, objeto, para_quien, ambito_geografico, importe_maximo, importe_minimo, plazo_fin, estado_convocatoria, comunidad_autonoma')
      .eq('id', exp.subvencion_id)
      .maybeSingle();

    if (subv) subvData = subv as Record<string, unknown>;

    // Intentar obtener texto del mejor documento disponible
    const { data: docs } = await sb
      .from('subvencion_documentos')
      .select('texto_extraido, tipo_documento')
      .eq('subvencion_id', exp.subvencion_id)
      .not('texto_extraido', 'is', null)
      .order('tipo_documento', { ascending: true })
      .limit(1);

    if (docs?.[0]?.texto_extraido) {
      subvTexto = (docs[0].texto_extraido as string).slice(0, 3000);
    }
  }

  // ── Obtener API key ────────────────────────────────────────────────────────
  const apiKey = process.env.OPENAI_API_KEY ?? '';
  const hasAI = apiKey && !apiKey.includes('placeholder') && apiKey.startsWith('sk-');

  // ── Generar checklist ──────────────────────────────────────────────────────
  const checklistItems: Array<{
    nombre: string; descripcion: string; tipo: string;
    categoria: string; obligatorio: boolean; orden: number;
  }> = [];

  if (hasAI) {
    const systemChecklist = `Eres un experto en subvenciones españolas. Genera una lista de documentos y acciones necesarios para tramitar una subvención. Responde SOLO con JSON válido, sin texto adicional.`;

    const promptChecklist = `Subvención: "${exp.titulo}"
Organismo: ${exp.organismo ?? 'Desconocido'}
${subvTexto ? `Texto bases (fragmento): ${subvTexto}` : ''}
Empresa solicitante: ${cliente?.nombre_empresa ?? exp.nif}
Actividad: ${cliente?.cnae_descripcion ?? 'no especificada'}
Forma jurídica: ${cliente?.forma_juridica ?? 'SL'}
Empleados: ${cliente?.num_empleados ?? 'desconocido'}

Genera un checklist JSON con los documentos obligatorios para esta solicitud.
Formato: [{"nombre":"...","descripcion":"...","tipo":"documento|accion|verificacion","categoria":"identidad|fiscal|laboral|tecnico|juridico|financiero","obligatorio":true|false}]
Incluye entre 10 y 15 elementos. Sé específico con la subvención.`;

    try {
      const raw = await callAI(promptChecklist, systemChecklist, apiKey);
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Array<Record<string, unknown>>;
        parsed.forEach((item, idx) => {
          checklistItems.push({
            nombre: String(item.nombre ?? ''),
            descripcion: String(item.descripcion ?? ''),
            tipo: String(item.tipo ?? 'documento'),
            categoria: String(item.categoria ?? 'tecnico'),
            obligatorio: item.obligatorio !== false,
            orden: idx,
          });
        });
      }
    } catch {
      // fallback: checklist genérico
    }
  }

  // Fallback: checklist genérico si no hay IA o falló
  if (checklistItems.length === 0) {
    const genericos = [
      { nombre: 'NIF/CIF de la empresa', categoria: 'identidad', descripcion: 'Copia del NIF o CIF actualizado de la empresa solicitante.' },
      { nombre: 'Escritura de constitución', categoria: 'juridico', descripcion: 'Escritura de constitución de la sociedad e inscripción en el Registro Mercantil.' },
      { nombre: 'Poderes de representación', categoria: 'juridico', descripcion: 'Documento acreditativo de los poderes del firmante.' },
      { nombre: 'Declaración responsable AEAT', categoria: 'fiscal', descripcion: 'Certificado de estar al corriente de obligaciones tributarias (máx. 6 meses).' },
      { nombre: 'Declaración responsable Seguridad Social', categoria: 'laboral', descripcion: 'Certificado de estar al corriente con la Seguridad Social.' },
      { nombre: 'Últimas cuentas anuales depositadas', categoria: 'financiero', descripcion: 'Cuentas anuales del último ejercicio cerrado depositadas en el RM.' },
      { nombre: 'Memoria técnica del proyecto', categoria: 'tecnico', descripcion: 'Descripción detallada del proyecto a financiar con la subvención.' },
      { nombre: 'Presupuesto detallado de gastos', categoria: 'financiero', descripcion: 'Desglose de los gastos elegibles con facturas pro forma o presupuestos.' },
      { nombre: 'Plan de viabilidad económica', categoria: 'financiero', descripcion: 'Proyecciones financieras demostrando la viabilidad del proyecto.' },
      { nombre: 'Formulario oficial de solicitud', categoria: 'tecnico', descripcion: 'Formulario de solicitud cumplimentado y firmado electrónicamente.', tipo: 'accion' },
      { nombre: 'Verificar plazo de presentación', categoria: 'tecnico', descripcion: 'Confirmar que la solicitud se presenta dentro del plazo oficial.', tipo: 'verificacion' },
    ];
    genericos.forEach((item, idx) => {
      checklistItems.push({ ...item, tipo: (item as any).tipo ?? 'documento', obligatorio: true, orden: idx });
    });
  }

  // Guardar checklist en DB
  if (checklistItems.length > 0) {
    await sb.from('checklist_items').delete().eq('expediente_id', expedienteId);
    await sb.from('checklist_items').insert(
      checklistItems.map(item => ({ ...item, expediente_id: expedienteId, generado_ia: hasAI }))
    );
  }

  // ── Generar / actualizar documento Memoria ────────────────────────────────
  let memoriaContenido = generarMemoriaBase(exp, cliente, subvData);

  if (hasAI && subvTexto) {
    const systemMemoria = `Eres un consultor de subvenciones. Genera una memoria de solicitud profesional en formato Markdown. Sé específico y usa los datos proporcionados.`;
    const promptMemoria = `Genera una memoria de solicitud para:
Subvención: "${exp.titulo}"
Organismo: ${exp.organismo}
Empresa: ${cliente?.nombre_empresa ?? exp.nif}
Actividad: ${cliente?.cnae_descripcion ?? 'no especificada'}
${cliente?.descripcion_actividad ? `Descripción: ${cliente.descripcion_actividad}` : ''}
Empleados: ${cliente?.num_empleados ?? 'N/D'}
Facturación: ${cliente?.facturacion_anual ? `${cliente.facturacion_anual} €` : 'N/D'}
Localización: ${cliente?.ciudad ?? ''}, ${cliente?.comunidad_autonoma ?? ''}

Información de la subvención: ${subvTexto.slice(0, 1500)}

La memoria debe incluir secciones: Datos del solicitante, Descripción del proyecto, Objetivos, Necesidad de la ayuda, Impacto esperado. En Markdown.`;
    try {
      const aiMemoria = await callAI(promptMemoria, systemMemoria, apiKey);
      if (aiMemoria.length > 200) memoriaContenido = aiMemoria;
    } catch {
      // usar fallback
    }
  }

  // Buscar o crear doc Memoria en el expediente
  const { data: docExistente } = await sb
    .from('documentos')
    .select('id')
    .eq('expediente_id', expedienteId)
    .eq('tipo_documento', 'memoria')
    .maybeSingle();

  if (docExistente) {
    await sb.from('documentos').update({ contenido: memoriaContenido, generado_por_ia: true }).eq('id', docExistente.id);
  } else {
    await sb.from('documentos').insert({
      nombre: 'Memoria de solicitud',
      tipo_documento: 'memoria',
      contenido: memoriaContenido,
      expediente_id: expedienteId,
      nif: exp.nif,
      orden: 0,
      generado_por_ia: true,
    });
  }

  // ── Matchear proveedores ───────────────────────────────────────────────────
  const { data: todosProveedores } = await sb
    .from('proveedores')
    .select('id, nombre, categoria, descripcion, servicios')
    .eq('activo', true);

  const proveedoresMatcheados: Array<{
    proveedor_id: string; relevancia_score: number;
    motivo_match: string; propuesta_texto: string;
  }> = [];

  if (todosProveedores && todosProveedores.length > 0) {
    if (hasAI) {
      const listaProvs = todosProveedores.map(p =>
        `ID:${p.id} | ${p.nombre} (${p.categoria}) - ${p.descripcion} - Servicios: ${(p.servicios ?? []).join(', ')}`
      ).join('\n');

      const systemProvs = `Eres experto en subvenciones. Elige los 3 proveedores más relevantes para esta subvención. Responde SOLO JSON.`;
      const promptProvs = `Subvención: "${exp.titulo}" - ${exp.organismo}
Empresa: ${cliente?.nombre_empresa}, sector: ${cliente?.cnae_descripcion ?? 'varios'}
${subvData.objeto ? `Objeto: ${subvData.objeto}` : ''}

Proveedores disponibles:
${listaProvs}

Responde con JSON exactamente así (array de 3):
[{"id":"UUID_DEL_PROVEEDOR","score":0.85,"motivo":"Por qué encaja en 1 frase","propuesta":"Propuesta personalizada de 2-3 frases para este cliente"}]`;

      try {
        const rawProvs = await callAI(promptProvs, systemProvs, apiKey);
        const jsonMatch = rawProvs.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as Array<Record<string, unknown>>;
          for (const p of parsed.slice(0, 3)) {
            const prov = todosProveedores.find(tp => tp.id === String(p.id));
            if (prov) {
              proveedoresMatcheados.push({
                proveedor_id: prov.id,
                relevancia_score: Number(p.score ?? 0.7),
                motivo_match: String(p.motivo ?? ''),
                propuesta_texto: String(p.propuesta ?? ''),
              });
            }
          }
        }
      } catch {
        // fallback
      }
    }

    // Fallback: elegir primeros 3 si no hay IA
    if (proveedoresMatcheados.length === 0) {
      const fallback = todosProveedores.slice(0, 3);
      fallback.forEach(p => {
        proveedoresMatcheados.push({
          proveedor_id: p.id,
          relevancia_score: 0.6,
          motivo_match: `${p.nombre} puede ser relevante para esta subvención`,
          propuesta_texto: `${p.nombre} ofrece servicios de ${(p.servicios ?? []).slice(0, 2).join(' y ')} que pueden ser necesarios para completar este proyecto.`,
        });
      });
    }

    // Guardar proveedores matcheados
    if (proveedoresMatcheados.length > 0) {
      await sb.from('expediente_proveedores').delete().eq('expediente_id', expedienteId);
      await sb.from('expediente_proveedores').insert(
        proveedoresMatcheados.map(p => ({ ...p, expediente_id: expedienteId }))
      );
    }
  }

  return NextResponse.json({
    ok: true,
    checklist_generado: checklistItems.length,
    proveedores_matcheados: proveedoresMatcheados.length,
    memoria_generada: true,
    usado_ia: hasAI,
  });
}

// ─── Memoria base (fallback sin IA) ───────────────────────────────────────────

function generarMemoriaBase(
  exp: { titulo: string | null; organismo: string | null; nif: string },
  cliente: Record<string, unknown> | null,
  subv: Record<string, unknown>
): string {
  const nombre = (cliente?.nombre_empresa as string) ?? exp.nif;
  const fecha = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });

  return `# Memoria de Solicitud

**Subvención:** ${exp.titulo ?? 'Pendiente'}
**Organismo convocante:** ${exp.organismo ?? 'Pendiente'}
**Fecha de elaboración:** ${fecha}

---

## 1. Datos del Solicitante

| Campo | Valor |
|---|---|
| **Razón social** | ${nombre} |
| **NIF/CIF** | ${exp.nif} |
| **Forma jurídica** | ${(cliente?.forma_juridica as string) ?? 'SL'} |
| **Actividad** | ${(cliente?.cnae_descripcion as string) ?? 'Por completar'} |
| **Localización** | ${[cliente?.ciudad, cliente?.comunidad_autonoma].filter(Boolean).join(', ') || 'Por completar'} |
| **Nº Empleados** | ${(cliente?.num_empleados as number) ?? 'Por completar'} |
| **Facturación anual** | ${cliente?.facturacion_anual ? `${Number(cliente.facturacion_anual).toLocaleString('es-ES')} €` : 'Por completar'} |
| **Antigüedad** | ${(cliente?.anos_antiguedad as number) ?? 'Por completar'} años |

---

## 2. Descripción del Proyecto

> **[Completar]** Describe aquí el proyecto o inversión que se financiará con esta subvención. Explica en qué consiste, qué se va a hacer y en qué plazo.

---

## 3. Objetivos

- **Objetivo principal:** [Completar]
- **Objetivos específicos:**
  - [Completar]
  - [Completar]

---

## 4. Justificación de la Necesidad

> **[Completar]** Explica por qué tu empresa necesita esta ayuda. ¿Qué problema resuelve? ¿Por qué no sería posible sin la subvención?

---

## 5. Impacto Esperado

- **Empleos creados/mantenidos:** [Completar]
- **Mejora en facturación estimada:** [Completar]
- **Impacto en el sector:** [Completar]

---

## 6. Presupuesto Resumen

| Concepto | Importe (€) |
|---|---|
| [Completar concepto 1] | [Importe] |
| [Completar concepto 2] | [Importe] |
| **TOTAL PROYECTO** | **[Total]** |
| **Subvención solicitada** | **[Importe solicitado]** |

---

*Documento generado automáticamente por AyudaPyme. Revisar y completar antes de presentar.*
`;
}
