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
    // VULN-02: Verificar autenticación antes de procesar
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const openai = getOpenAI();
    if (!openai) {
      return NextResponse.json(
        { error: 'API de OpenAI no configurada. Configura OPENAI_API_KEY en ajustes del expediente.' },
        { status: 503 }
      );
    }

    const { contextoId, contextoTipo, tipo, prompt, nombreDocumento } = await request.json();

    if (!contextoId || !contextoTipo || !tipo) {
      return NextResponse.json(
        { error: 'Faltan parámetros requeridos' },
        { status: 400 }
      );
    }

    // Recopilar contexto completo
    const contexto = await recopilarContexto(supabase, contextoId, contextoTipo);

    // Construir prompt según el tipo
    const promptFinal = construirPrompt(tipo, contexto, prompt);

    // Generar con OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: promptFinal.system },
        { role: 'user', content: promptFinal.user }
      ],
      temperature: 0.7,
      max_tokens: 3000
    });

    const contenido = completion.choices[0]?.message?.content || '';

    // Guardar documento en BD
    const documentoData: any = {
      nombre: nombreDocumento || promptFinal.nombreDefault,
      contenido,
      tipo_documento: tipo,
      generado_por_ia: true,
      prompt_usado: prompt || promptFinal.user,
      orden: 999 // Al final de la lista
    };

    if (contextoTipo === 'reunion') {
      documentoData.reunion_id = contextoId;
    } else {
      documentoData.expediente_id = contextoId;
    }

    // Obtener NIF del contexto
    if (contextoTipo === 'reunion') {
      const { data: reunion } = await supabase
        .from('reuniones')
        .select('cliente_nif')
        .eq('id', contextoId)
        .single();
      documentoData.nif = reunion?.cliente_nif;
    } else {
      const { data: expediente } = await supabase
        .from('expediente')
        .select('nif')
        .eq('id', contextoId)
        .single();
      documentoData.nif = expediente?.nif;
    }

    const { data: nuevoDoc, error: docError } = await supabase
      .from('documentos')
      .insert(documentoData)
      .select()
      .single();

    if (docError) {
      throw new Error(`Error guardando documento: ${docError.message}`);
    }

    // Guardar interacción
    await supabase.from('ia_interacciones').insert({
      tipo: 'generacion',
      contexto_id: contextoId,
      contexto_tipo: contextoTipo,
      prompt: prompt || promptFinal.user,
      respuesta: contenido,
      modelo: 'gpt-4-turbo-preview',
      tokens_usados: completion.usage?.total_tokens || 0,
      metadata: { tipo_generacion: tipo, documento_id: nuevoDoc.id }
    });

    return NextResponse.json({
      success: true,
      documento: nuevoDoc,
      contenido,
      tokensUsados: completion.usage?.total_tokens || 0
    });

  } catch (error: any) {
    console.error('Error en /api/ia/generar:', error);
    return NextResponse.json(
      { error: error.message || 'Error al generar documento' },
      { status: 500 }
    );
  }
}

async function recopilarContexto(supabase: any, contextoId: string, contextoTipo: string) {
  const contexto: any = { tipo: contextoTipo };

  if (contextoTipo === 'reunion') {
    const { data: reunion } = await supabase
      .from('reuniones')
      .select(`
        *,
        cliente:cliente_nif(
          nombre_normalizado, nif, email_normalizado, actividad, 
          tamano_empresa, ciudad, telefono
        )
      `)
      .eq('id', contextoId)
      .single();

    if (reunion) {
      contexto.reunion = reunion;
      contexto.cliente = reunion.cliente?.[0];
    }
  } else {
    const { data: expediente } = await supabase
      .from('expediente')
      .select(`
        *,
        cliente:nif(
          nombre_normalizado, nif, email_normalizado, actividad,
          tamano_empresa, ciudad, telefono
        )
      `)
      .eq('id', contextoId)
      .single();

    if (expediente) {
      contexto.expediente = expediente;
      contexto.cliente = expediente.cliente?.[0];
    }
  }

  // Documentos existentes
  const { data: documentos } = await supabase
    .from('documentos')
    .select('nombre, contenido, tipo_documento')
    .eq(contextoTipo === 'reunion' ? 'reunion_id' : 'expediente_id', contextoId);

  contexto.documentos = documentos || [];

  // Notas del cliente
  const { data: notas } = await supabase
    .from('notas')
    .select('contenido, created_at')
    .eq(contextoTipo === 'expediente' ? 'expediente_id' : 'nif', contextoId)
    .order('created_at', { ascending: false })
    .limit(5);

  contexto.notas = notas || [];

  return contexto;
}

function construirPrompt(tipo: string, contexto: any, promptCustom?: string) {
  const cliente = contexto.cliente;
  const clienteInfo = cliente ? `
INFORMACIÓN DEL CLIENTE:
- Nombre: ${cliente.nombre_normalizado}
- NIF: ${cliente.nif}
- Actividad: ${cliente.actividad || 'No especificada'}
- Tamaño: ${cliente.tamano_empresa || 'No especificado'}
- Ubicación: ${cliente.ciudad || 'No especificada'}
` : '';

  const prompts: { [key: string]: { system: string; user: string; nombreDefault: string } } = {
    resumen: {
      system: `Eres un asistente que crea resúmenes ejecutivos claros y estructurados.

${clienteInfo}

DOCUMENTOS DISPONIBLES:
${contexto.documentos.map((d: any) => `- ${d.nombre}: ${d.contenido?.substring(0, 200) || 'Sin contenido'}...`).join('\n')}`,
      user: 'Crea un resumen ejecutivo completo y estructurado con todos los puntos clave.',
      nombreDefault: 'Resumen Ejecutivo'
    },

    checklist: {
      system: `Eres un experto en gestión de proyectos de subvenciones.

${clienteInfo}`,
      user: 'Genera un checklist detallado con todas las tareas pendientes, documentos necesarios y pasos a seguir. Organiza por prioridad.',
      nombreDefault: 'Checklist de Tareas'
    },

    busqueda_profunda: {
      system: `Eres un investigador especializado en subvenciones, ayudas públicas y financiación empresarial.

${clienteInfo}`,
      user: promptCustom || 'Realiza una búsqueda profunda sobre oportunidades de financiación relevantes para este cliente.',
      nombreDefault: `Búsqueda profunda - ${new Date().toISOString().split('T')[0]}`
    },

    email: {
      system: `Eres un redactor profesional de emails corporativos.

${clienteInfo}`,
      user: 'Redacta un email profesional de seguimiento al cliente con los próximos pasos y documentación necesaria.',
      nombreDefault: 'Email de Seguimiento'
    },

    memoria: {
      system: `Eres un experto en redacción de memorias de proyectos para solicitudes de subvenciones.

${clienteInfo}`,
      user: promptCustom || 'Redacta una memoria de proyecto profesional basada en la información disponible.',
      nombreDefault: 'Memoria del Proyecto'
    }
  };

  return prompts[tipo] || prompts.resumen;
}
