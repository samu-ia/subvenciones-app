import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOrCreateToolConfig, getProviderConfig } from '@/lib/db/ia-config';
import { createProvider } from '@/lib/ai/providers/factory';
import type { ClienteSnapshot, SubvencionDetectada } from '@/lib/types/notebook';

/**
 * POST /api/ia/deep-search
 *
 * Lanza una investigación de subvenciones para un cliente.
 * Flujo:
 *  1. Recoger datos del cliente y contexto de la reunión
 *  2. Llamar a la IA con un prompt especializado de investigación
 *  3. Parsear la respuesta (JSON con lista de subvenciones)
 *  4. Guardar las subvenciones_detectadas en Supabase
 *  5. Crear documento investigacion_subvenciones.md
 *  6. Actualizar investigaciones log
 *  7. Devolver el resultado
 */

interface DeepSearchRequest {
  reunionId: string;
  contextoTipo?: 'reunion' | 'expediente';
  clienteSnapshot: ClienteSnapshot;
  contextoAdicional?: string;  // notas de reunión u otros docs disponibles
}

const DEEP_SEARCH_SYSTEM_PROMPT = [
  'Eres un especialista en subvenciones y ayudas públicas para empresas en España.',
  'Tu tarea es analizar el perfil de una empresa y detectar todas las subvenciones, ayudas y financiación pública relevantes para ella.',
  '',
  'Debes buscar en:',
  '- Convocatorias estatales (CDTI, ENISA, ICO, Ministerios)',
  '- Convocatorias autonómicas según la comunidad autónoma de la empresa',
  '- Fondos europeos (FEDER, FSE, Horizonte Europa, etc.)',
  '- Ayudas sectoriales según el CNAE',
  '- Programa Kit Digital (si aplica)',
  '- Ayudas para I+D+i, digitalización, eficiencia energética',
  '- Ayudas para creación de empleo, formación',
  '- Ayudas por tamaño de empresa (pyme, microempresa)',
  '',
  'Para cada subvención encontrada, proporciona información detallada y real.',
  '',
  'RESPONDE EXCLUSIVAMENTE con un JSON válido con esta estructura exacta, sin texto adicional:',
  '',
  '{"resumen":"Resumen ejecutivo de 2-3 frases","subvenciones":[{"titulo":"Nombre oficial","organismo":"Organismo convocante","descripcion":"2-3 frases","importe_max":150000,"plazo_fin":"2025-12-31","estado_conv":"abierta","url_oficial":"https://...","numero_bdns":"123456","resumen_ia":"Por qué encaja","motivo_match":"Criterios cumplidos","puntuacion":8,"encaja":true,"docs_faltantes":["Memoria técnica"],"checklist":[{"texto":"Verificar CNAE elegible","obligatorio":true}]}]}',
  '',
  'Si una subvención no encaja, incluye "encaja": false y "motivo_rechazo": "razón".',
  'Prioriza calidad sobre cantidad. Detecta entre 3 y 8 subvenciones relevantes.',
  'Sé específico con nombres, organismos y plazos reales.',
].join('\n');

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body: DeepSearchRequest = await request.json();
    const { reunionId, clienteSnapshot, contextoAdicional } = body;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // ── 1. Crear registro de investigación ────────────────────────────────
    const { data: invRec, error: invErr } = await supabase
      .from('investigaciones')
      .insert({
        reunion_id: reunionId,
        nif: clienteSnapshot.nif,
        datos_cliente: clienteSnapshot,
        estado: 'ejecutando',
      })
      .select()
      .single();

    if (invErr || !invRec) {
      console.error('Error creando investigacion:', invErr);
      return NextResponse.json({ error: 'Error iniciando investigación' }, { status: 500 });
    }

    const investigacionId = invRec.id;

    try {
      // ── 2. Obtener config de la herramienta deep-search ─────────────────
      const toolConfig = await getOrCreateToolConfig(user.id, 'deep-search', 'reunion');
      const providerConfig = await getProviderConfig(user.id, toolConfig.provider);

      if (!providerConfig?.enabled) {
        throw new Error(`Proveedor ${toolConfig.provider} no configurado`);
      }

      const provider = createProvider({
        provider: toolConfig.provider,
        apiKey: providerConfig.api_key,
        baseUrl: providerConfig.base_url,
        organization: providerConfig.organization,
        enabled: true,
      });

      // ── 3. Construir prompt con datos del cliente ──────────────────────
      const clienteDesc = buildClienteDescription(clienteSnapshot);
      const userMessage = `Analiza el siguiente perfil de empresa y detecta subvenciones relevantes:

${clienteDesc}

${contextoAdicional ? `CONTEXTO ADICIONAL:\n${contextoAdicional}` : ''}

Proporciona una investigación completa de subvenciones actuales para esta empresa.`;

      // ── 4. Llamar a la IA ──────────────────────────────────────────────
      const aiResponse = await provider.complete(
        [{ role: 'user', content: userMessage }],
        {
          model: toolConfig.model,
          systemPrompt: DEEP_SEARCH_SYSTEM_PROMPT,
          temperature: 0.3,
          maxTokens: toolConfig.maxTokens || 4000,
        }
      );

      const rawContent = aiResponse.content;

      // ── 5. Parsear JSON de la respuesta ────────────────────────────────
      let parsed: {
        resumen: string;
        subvenciones: Array<{
          titulo: string;
          organismo?: string;
          descripcion?: string;
          importe_max?: number;
          plazo_fin?: string;
          estado_conv?: string;
          url_oficial?: string;
          numero_bdns?: string;
          resumen_ia?: string;
          motivo_match?: string;
          puntuacion?: number;
          encaja?: boolean;
          motivo_rechazo?: string;
          docs_faltantes?: string[];
          checklist?: Array<{ texto: string; obligatorio?: boolean }>;
        }>;
      };

      try {
        // Intentar extraer JSON si viene envuelto en markdown
        const jsonMatch = rawContent.match(/```json\s*([\s\S]+?)\s*```/) ||
                          rawContent.match(/```\s*([\s\S]+?)\s*```/) ||
                          rawContent.match(/(\{[\s\S]+\})/);
        const jsonStr = jsonMatch ? jsonMatch[1] : rawContent;
        parsed = JSON.parse(jsonStr);
      } catch {
        throw new Error(`La IA no devolvió JSON válido: ${rawContent.substring(0, 200)}`);
      }

      const duracionMs = Date.now() - startTime;

      // ── 6. Guardar subvenciones en Supabase ────────────────────────────
      const subvencionesGuardadas: SubvencionDetectada[] = [];

      for (const sv of (parsed.subvenciones || [])) {
        const { data: subvRec } = await supabase
          .from('subvenciones_detectadas')
          .insert({
            reunion_id: reunionId,
            nif: clienteSnapshot.nif,
            titulo: sv.titulo,
            organismo: sv.organismo,
            descripcion: sv.descripcion,
            importe_max: sv.importe_max,
            plazo_fin: sv.plazo_fin,
            estado_conv: sv.estado_conv || 'por_confirmar',
            url_oficial: sv.url_oficial,
            numero_bdns: sv.numero_bdns,
            resumen_ia: sv.resumen_ia,
            motivo_match: sv.motivo_match,
            puntuacion: sv.puntuacion,
            encaja: sv.encaja !== false,
            motivo_rechazo: sv.motivo_rechazo,
            docs_faltantes: sv.docs_faltantes || [],
            estado_expediente: 'detectada',
          })
          .select()
          .single();

        if (subvRec) {
          // Insertar checklist items
          if (sv.checklist && sv.checklist.length > 0) {
            await supabase.from('subvenciones_checklist').insert(
              sv.checklist.map((item, idx) => ({
                subvencion_id: subvRec.id,
                orden: idx,
                texto: item.texto,
                obligatorio: item.obligatorio !== false,
              }))
            );
            // Recargar con checklist
            const { data: checkItems } = await supabase
              .from('subvenciones_checklist')
              .select('*')
              .eq('subvencion_id', subvRec.id)
              .order('orden');
            subvencionesGuardadas.push({ ...subvRec, checklist: checkItems || [] });
          } else {
            subvencionesGuardadas.push({ ...subvRec, checklist: [] });
          }
        }
      }

      // ── 7. Crear documento investigacion_subvenciones.md ──────────────
      const docContenido = buildInvestigacionMarkdown(
        clienteSnapshot,
        parsed.resumen,
        subvencionesGuardadas
      );

      const { data: docRec } = await supabase
        .from('documentos')
        .insert({
          nombre: '🔎 Investigación de Subvenciones',
          contenido: docContenido,
          reunion_id: reunionId,
          nif: clienteSnapshot.nif,
          generado_por_ia: true,
          tipo_documento: 'investigacion',

          orden: 999,
        })
        .select()
        .single();

      // ── 8. Actualizar investigación y reunión ────────────────────────
      await supabase.from('investigaciones').update({
        estado: 'completada',
        num_subvenciones_encontradas: subvencionesGuardadas.length,
        documento_id: docRec?.id,
        resumen: parsed.resumen,
        proveedor: toolConfig.provider,
        modelo: toolConfig.model,
        duracion_ms: duracionMs,
        completed_at: new Date().toISOString(),
      }).eq('id', investigacionId);

      await supabase.from('reuniones').update({
        investigacion_estado: 'completada',
        num_subvenciones: subvencionesGuardadas.length,
      }).eq('id', reunionId);

      return NextResponse.json({
        investigacion_id: investigacionId,
        documento_id: docRec?.id,
        documento: docRec,
        subvenciones: subvencionesGuardadas,
        resumen: parsed.resumen,
        num_encontradas: subvencionesGuardadas.length,
        duracion_ms: duracionMs,
      });

    } catch (innerError) {
      const msg = innerError instanceof Error ? innerError.message : 'Error desconocido';
      await supabase.from('investigaciones').update({
        estado: 'error',
        error_msg: msg,
        completed_at: new Date().toISOString(),
      }).eq('id', investigacionId);

      return NextResponse.json({ error: msg }, { status: 500 });
    }

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildClienteDescription(c: ClienteSnapshot): string {
  const lines: string[] = ['DATOS DE LA EMPRESA:'];
  if (c.nombre)           lines.push(`- Nombre: ${c.nombre}`);
  if (c.nif)              lines.push(`- NIF: ${c.nif}`);
  if (c.cnae)             lines.push(`- CNAE: ${c.cnae}`);
  if (c.actividad)        lines.push(`- Actividad: ${c.actividad}`);
  if (c.sector)           lines.push(`- Sector: ${c.sector}`);
  if (c.ciudad)           lines.push(`- Ciudad: ${c.ciudad}`);
  if (c.comunidad_autonoma) lines.push(`- Comunidad Autónoma: ${c.comunidad_autonoma}`);
  if (c.tamano_empresa)   lines.push(`- Tamaño: ${c.tamano_empresa}`);
  if (c.empleados)        lines.push(`- Empleados: ${c.empleados}`);
  if (c.ventas)           lines.push(`- Facturación: ${c.ventas.toLocaleString('es-ES')} €`);
  if (c.forma_juridica)   lines.push(`- Forma jurídica: ${c.forma_juridica}`);
  if (c.fecha_constitucion) lines.push(`- Fundada: ${c.fecha_constitucion}`);
  if (c.observaciones_adicionales) lines.push(`- Observaciones: ${c.observaciones_adicionales}`);
  return lines.join('\n');
}

function buildInvestigacionMarkdown(
  cliente: ClienteSnapshot,
  resumen: string,
  subvenciones: SubvencionDetectada[]
): string {
  const date = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  const lines: string[] = [
    `# 🔎 Investigación de Subvenciones`,
    `*Generado automáticamente el ${date}*`,
    '',
    `## Empresa analizada`,
    `**${cliente.nombre || 'N/A'}** · ${cliente.nif || ''} · ${cliente.cnae ? `CNAE ${cliente.cnae}` : ''} · ${cliente.ciudad || ''}`,
    '',
    `## Resumen ejecutivo`,
    resumen,
    '',
    `---`,
    '',
    `## Subvenciones detectadas (${subvenciones.length})`,
    '',
  ];

  subvenciones.forEach((sv, i) => {
    lines.push(`### ${i + 1}. ${sv.titulo}`);
    if (sv.organismo)   lines.push(`**Organismo:** ${sv.organismo}`);
    if (sv.estado_conv) lines.push(`**Estado:** ${sv.estado_conv}`);
    if (sv.importe_max) lines.push(`**Importe máximo:** ${sv.importe_max.toLocaleString('es-ES')} €`);
    if (sv.plazo_fin)   lines.push(`**Plazo:** ${sv.plazo_fin}`);
    if (sv.url_oficial) lines.push(`**Enlace oficial:** ${sv.url_oficial}`);
    if (sv.puntuacion)  lines.push(`**Puntuación de encaje:** ${sv.puntuacion}/10`);
    lines.push('');
    if (sv.descripcion) { lines.push(sv.descripcion); lines.push(''); }
    if (sv.resumen_ia)  { lines.push(`**Análisis IA:** ${sv.resumen_ia}`); lines.push(''); }
    if (sv.motivo_match) { lines.push(`**Por qué encaja:** ${sv.motivo_match}`); lines.push(''); }
    if (sv.checklist && sv.checklist.length > 0) {
      lines.push('**Checklist de requisitos:**');
      sv.checklist.forEach(item => lines.push(`- [ ] ${item.texto}`));
      lines.push('');
    }
    if (sv.docs_faltantes && sv.docs_faltantes.length > 0) {
      lines.push('**Documentos que puede necesitar:**');
      sv.docs_faltantes.forEach(doc => lines.push(`- ${doc}`));
      lines.push('');
    }
    lines.push('---');
    lines.push('');
  });

  lines.push(`*Investigación realizada con IA. Verifica siempre la información en las fuentes oficiales.*`);

  return lines.join('\n');
}
