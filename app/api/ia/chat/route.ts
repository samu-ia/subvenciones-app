import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';

const getOpenAI = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
};

export async function POST(request: NextRequest) {
  try {
    const openai = getOpenAI();
    if (!openai) {
      return NextResponse.json(
        { error: 'API de OpenAI no configurada. Configura OPENAI_API_KEY en ajustes del expediente.' },
        { status: 503 }
      );
    }

    const { contextoId, contextoTipo, mensaje, documentosReferenciados, historial } = await request.json();

    if (!contextoId || !contextoTipo || !mensaje) {
      return NextResponse.json(
        { error: 'Faltan parámetros requeridos' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Recopilar contexto
    const contexto = await recopilarContexto(supabase, contextoId, contextoTipo, documentosReferenciados);

    // Construir prompt con contexto
    const systemPrompt = construirSystemPrompt(contexto, contextoTipo);
    
    // Construir historial de mensajes
    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...historial.map((h: any) => ({
        role: h.role,
        content: h.content
      })),
      { role: 'user', content: mensaje }
    ];

    // Llamar a OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages,
      temperature: 0.7,
      max_tokens: 1500
    });

    const respuesta = completion.choices[0]?.message?.content || 'No pude generar una respuesta.';

    // Guardar interacción en BD
    await supabase.from('ia_interacciones').insert({
      tipo: 'chat',
      contexto_id: contextoId,
      contexto_tipo: contextoTipo,
      prompt: mensaje,
      respuesta: respuesta,
      documentos_usados: documentosReferenciados || [],
      modelo: 'gpt-4-turbo-preview',
      tokens_usados: completion.usage?.total_tokens || 0
    });

    // Detectar si la respuesta es un documento largo
    const sugerirDocumento = respuesta.length > 500 && (
      mensaje.toLowerCase().includes('genera') ||
      mensaje.toLowerCase().includes('crea') ||
      mensaje.toLowerCase().includes('redacta')
    );

    return NextResponse.json({
      respuesta,
      sugerirDocumento,
      nombreSugerido: detectarNombreDocumento(mensaje),
      tokensUsados: completion.usage?.total_tokens || 0
    });

  } catch (error: any) {
    console.error('Error en /api/ia/chat:', error);
    return NextResponse.json(
      { error: error.message || 'Error al procesar la solicitud' },
      { status: 500 }
    );
  }
}

async function recopilarContexto(
  supabase: any,
  contextoId: string,
  contextoTipo: string,
  documentosReferenciados?: string[]
) {
  const contexto: any = {
    tipo: contextoTipo
  };

  if (contextoTipo === 'reunion') {
    // Obtener datos de la reunión
    const { data: reunion } = await supabase
      .from('reuniones')
      .select('*, cliente:cliente_nif(nombre_normalizado, nif, email_normalizado)')
      .eq('id', contextoId)
      .single();

    if (reunion) {
      contexto.reunion = {
        titulo: reunion.titulo,
        tipo: reunion.tipo,
        estado: reunion.estado,
        fecha: reunion.fecha_programada,
        objetivo: reunion.objetivo,
        notas: reunion.notas,
        cliente: reunion.cliente?.[0]
      };
    }
  } else if (contextoTipo === 'expediente') {
    // Obtener datos del expediente
    const { data: expediente } = await supabase
      .from('expediente')
      .select('*, cliente:nif(nombre_normalizado, nif, email_normalizado, actividad)')
      .eq('id', contextoId)
      .single();

    if (expediente) {
      contexto.expediente = {
        numero_bdns: expediente.numero_bdns,
        estado: expediente.estado,
        cliente: expediente.cliente?.[0]
      };
    }
  }

  // Obtener documentos
  let query = supabase
    .from('documentos')
    .select('id, nombre, contenido, tipo_documento');

  if (contextoTipo === 'reunion') {
    query = query.eq('reunion_id', contextoId);
  } else {
    query = query.eq('expediente_id', contextoId);
  }

  // Si hay documentos referenciados específicamente, filtrar
  if (documentosReferenciados && documentosReferenciados.length > 0) {
    query = query.in('id', documentosReferenciados);
  }

  const { data: documentos } = await query;
  contexto.documentos = documentos || [];

  // Obtener archivos (solo metadata, no contenido completo)
  const { data: archivos } = await supabase
    .from('archivos')
    .select('nombre, mime_type, texto_extraido')
    .eq(contextoTipo === 'reunion' ? 'reunion_id' : 'expediente_id', contextoId);

  contexto.archivos = archivos || [];

  return contexto;
}

function construirSystemPrompt(contexto: any, contextoTipo: string) {
  const tipo = contextoTipo === 'reunion' ? 'reunión' : 'expediente';
  
  let prompt = `Eres un asistente IA especializado en gestión de subvenciones y ayudas públicas.
Estás ayudando con una ${tipo}.

`;

  if (contexto.reunion) {
    prompt += `CONTEXTO DE LA REUNIÓN:
- Título: ${contexto.reunion.titulo || 'Sin título'}
- Tipo: ${contexto.reunion.tipo || 'No especificado'}
- Estado: ${contexto.reunion.estado || 'pendiente'}
- Cliente: ${contexto.reunion.cliente?.nombre_normalizado || 'Sin cliente'}
- Objetivo: ${contexto.reunion.objetivo || 'No definido'}
`;
    if (contexto.reunion.notas) {
      prompt += `- Notas actuales: ${contexto.reunion.notas.substring(0, 500)}...\n`;
    }
  }

  if (contexto.expediente) {
    prompt += `CONTEXTO DEL EXPEDIENTE:
- BDNS: ${contexto.expediente.numero_bdns || 'Sin número'}
- Estado: ${contexto.expediente.estado}
- Cliente: ${contexto.expediente.cliente?.nombre_normalizado || 'Sin cliente'}
- Actividad: ${contexto.expediente.cliente?.actividad || 'No especificada'}
`;
  }

  if (contexto.documentos && contexto.documentos.length > 0) {
    prompt += `\nDOCUMENTOS DISPONIBLES:\n`;
    contexto.documentos.forEach((doc: any) => {
      prompt += `- ${doc.nombre} (${doc.tipo_documento || 'sin tipo'})\n`;
      if (doc.contenido) {
        prompt += `  Contenido: ${doc.contenido.substring(0, 300)}...\n`;
      }
    });
  }

  if (contexto.archivos && contexto.archivos.length > 0) {
    prompt += `\nARCHIVOS ADJUNTOS:\n`;
    contexto.archivos.forEach((archivo: any) => {
      prompt += `- ${archivo.nombre}\n`;
      if (archivo.texto_extraido) {
        prompt += `  Contenido:\n${archivo.texto_extraido}\n`;
      } else {
        prompt += `  (sin texto extraído aún)\n`;
      }
    });
  }

  prompt += `\nINSTRUCCIONES:
- Responde de forma clara, concisa y profesional
- Usa la información del contexto para dar respuestas precisas
- Si no tienes información suficiente, dilo claramente
- Sugiere próximos pasos o acciones cuando sea relevante
- Si te piden generar documentos, crea contenido estructurado y profesional
`;

  return prompt;
}

function detectarNombreDocumento(mensaje: string): string {
  const palabrasClave: { [key: string]: string } = {
    'resumen': 'Resumen',
    'checklist': 'Checklist',
    'email': 'Email',
    'memoria': 'Memoria',
    'informe': 'Informe',
    'análisis': 'Análisis',
    'búsqueda': 'Búsqueda profunda'
  };

  for (const [palabra, nombre] of Object.entries(palabrasClave)) {
    if (mensaje.toLowerCase().includes(palabra)) {
      return nombre;
    }
  }

  return 'Documento IA';
}
