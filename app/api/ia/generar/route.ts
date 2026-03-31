import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOrCreateToolConfig, getProviderConfig } from '@/lib/db/ia-config';
import { createProvider } from '@/lib/ai/providers/factory';
import { withRetry } from '@/lib/utils/ai-retry';
import type { AIProvider } from '@/lib/types/ai-config';

const DEFAULT_MODEL: Record<AIProvider, string> = {
  anthropic: 'claude-sonnet-4-6',
  google: 'gemini-2.5-flash',
  openai: 'gpt-4o',
  openrouter: 'auto',
  azure: 'gpt-4o',
  custom: 'gpt-4o',
};

// ─── Seleccionar proveedor con fallback env-vars ──────────────────────────────

async function resolveProvider(userId: string, tool: 'summary' | 'checklist' | 'email' | 'notebook') {
  const toolConfig = await getOrCreateToolConfig(userId, tool);

  // 1. Proveedor del tool config si está en DB
  const dbConfig = await getProviderConfig(userId, toolConfig.provider);
  if (dbConfig?.enabled && dbConfig.api_key) {
    return { provider: createProvider({ provider: toolConfig.provider, apiKey: dbConfig.api_key, enabled: true }), toolConfig, providerName: toolConfig.provider };
  }

  // 2. Cualquier proveedor configurado en DB (prioridad: google → anthropic)
  for (const prov of ['google', 'anthropic', 'openai'] as const) {
    const cfg = await getProviderConfig(userId, prov);
    if (cfg?.enabled && cfg.api_key) {
      return { provider: createProvider({ provider: prov, apiKey: cfg.api_key, enabled: true }), toolConfig, providerName: prov as AIProvider };
    }
  }

  // 3. Fallback env vars
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
    const key = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)!;
    return { provider: createProvider({ provider: 'google', apiKey: key, enabled: true }), toolConfig, providerName: 'google' as AIProvider };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return { provider: createProvider({ provider: 'anthropic', apiKey: process.env.ANTHROPIC_API_KEY, enabled: true }), toolConfig, providerName: 'anthropic' as AIProvider };
  }

  return null;
}

// ─── Prompts por tipo de documento ───────────────────────────────────────────

function detectarTipoSubvencion(organismo: string, titulo: string): 'energia' | 'digitalizacion' | 'id' | 'empleo' | 'internacional' | 'general' {
  const o = organismo.toLowerCase();
  const t = titulo.toLowerCase();
  if (o.includes('inega') || o.includes('idae') || t.includes('energi') || t.includes('fotovolt') || t.includes('eficiencia') || t.includes('renovable') || t.includes('autoconsumo')) return 'energia';
  if (t.includes('digital') || t.includes('kit digital') || o.includes('red.es') || t.includes('digitaliz')) return 'digitalizacion';
  if (t.includes('i+d') || t.includes('investigac') || t.includes('innovac') || o.includes('cdti') || o.includes('horizon')) return 'id';
  if (t.includes('empleo') || t.includes('contratac') || t.includes('autoempleo') || o.includes('sepe')) return 'empleo';
  if (t.includes('export') || t.includes('internac') || o.includes('icex')) return 'internacional';
  return 'general';
}

function buildMemoriaUserPrompt(contexto: Record<string, unknown>): string {
  const organismo = String(contexto.organismo ?? '');
  const titulo = String(contexto.titulo ?? '');
  const tipo = detectarTipoSubvencion(organismo, titulo);

  const seccionEspecifica: Record<string, string> = {
    energia: `
## 3. SITUACIÓN ENERGÉTICA ACTUAL
- Consumo actual por fuente (electricidad, gas, gasoil) en kWh/año y €/año
- Descripción del sistema actual (marca, modelo, potencia, año de instalación)
- Rendimiento actual vs rendimiento óptimo del sector
- Principales ineficiencias identificadas y coste anual de las mismas

## 4. SOLUCIÓN PROPUESTA
- Descripción técnica del equipo/instalación propuesto: marca, modelo, potencia nominal, SCOP/COP
- Referencia a la oferta del instalador (nº oferta, fecha, empresa instaladora habilitada)
- Comparativa técnica: sistema actual vs sistema propuesto (tabla)
- Cumplimiento de los requisitos técnicos mínimos de la convocatoria

## 5. JUSTIFICACIÓN TÉCNICA Y AHORRO ESPERADO
Incluye obligatoriamente esta tabla mensual:

| Mes | Consumo actual (kWh) | Consumo previsto (kWh) | Ahorro energético (kWh) | Ahorro económico (€) | Reducción CO₂ (kg) |
|-----|---------------------|----------------------|------------------------|---------------------|-------------------|
| Enero | | | | | |
| Febrero | | | | | |
| Marzo | | | | | |
| Abril | | | | | |
| Mayo | | | | | |
| Junio | | | | | |
| Julio | | | | | |
| Agosto | | | | | |
| Septiembre | | | | | |
| Octubre | | | | | |
| Noviembre | | | | | |
| Diciembre | | | | | |
| **TOTAL** | | | | | |

Rellena con estimaciones razonables basadas en el tipo de instalación y el clima de la zona.
Conclusión: ahorro total X kWh/año (Y% sobre consumo actual), reducción Z kg CO₂/año.

## 6. PRESUPUESTO DESGLOSADO POR PARTIDAS
Tabla con: Partida | Descripción | Uds. | Precio unitario (€) | Total (€)
- Desglosa en: equipos, estructura/instalación hidráulica, sistema eléctrico, ingeniería/proyecto técnico, puesta en marcha
- Importe total inversión: X €
- Porcentaje subvencionable: Y%
- Subvención solicitada: Z €

## 7. ENCUADRE EN LOS OBJETIVOS DEL PROGRAMA
Justifica explícitamente cómo el proyecto cumple cada uno de los objetivos y criterios de valoración de la convocatoria. Cita requisitos específicos del programa.

## 8. CONCLUSIÓN
Síntesis del impacto ambiental y económico. Confirmación del cumplimiento de requisitos.`,

    digitalizacion: `
## 3. DIAGNÓSTICO DIGITAL ACTUAL
- Herramientas y software actuales (ERP, CRM, facturación, gestión de stock)
- Procesos manuales identificados y tiempo invertido (horas/semana)
- Carencias y fricciones detectadas en el flujo de trabajo actual
- Nivel de madurez digital actual (según estándar)

## 4. SOLUCIÓN DIGITAL PROPUESTA
- Descripción de cada módulo/solución a implantar
- Proveedor/Agente Digitalizador (acreditación AceleraPyme si aplica)
- Plan de implantación: fases, hitos y duración
- Plan de formación para el equipo (horas, metodología)

## 5. IMPACTO ESPERADO Y KPIs
- Reducción de tiempo en procesos (horas/semana ahorradas)
- Eliminación de errores manuales (% reducción)
- Mejora en tiempo de respuesta a cliente
- Estimación de incremento en ventas/eficiencia (%)
- Retorno de inversión estimado (payback)

## 6. PRESUPUESTO DESGLOSADO
Tabla: Módulo/Solución | Proveedor | Licencia (meses) | Importe (€) | % subvencionable
Importe total: X € | Subvención solicitada: Y €

## 7. ENCUADRE EN LA CONVOCATORIA

## 8. CONCLUSIÓN`,

    id: `
## 3. DESCRIPCIÓN TÉCNICA DEL PROYECTO
- Hipótesis científica o tecnológica que se va a demostrar
- Estado del arte: qué existe actualmente y qué vacío cubre este proyecto
- Novedad e innovación de la propuesta respecto al estado del arte
- Riesgo técnico y plan de contingencia

## 4. OBJETIVOS, RESULTADOS E INDICADORES
- Objetivo general
- Objetivos específicos (mínimo 3), cuantificables con indicador de éxito
- Resultados esperados: prototipos, publicaciones, patentes, productos

## 5. METODOLOGÍA Y PLAN DE TRABAJO
- Descripción de tareas (Work Packages)
- Cronograma tipo Gantt
- Equipo investigador: perfiles, dedicación (personas/mes)
- Subcontrataciones previstas

## 6. PRESUPUESTO DESGLOSADO
Tabla por partidas: Personal | Subcontratación | Materiales | Viajes | Auditoría | Indirectos
Importe total elegible: X € | Ayuda solicitada: Y € (intensidad Z%)

## 7. ENCUADRE EN LA CONVOCATORIA Y PLAN DE EXPLOTACIÓN

## 8. CONCLUSIÓN`,

    empleo: `
## 3. SITUACIÓN ACTUAL DE LA PLANTILLA
- Estructura de la plantilla (categorías, contratos)
- Necesidades de contratación identificadas
- Perfiles buscados y justificación de la necesidad

## 4. PLAN DE CONTRATACIÓN PROPUESTO
- Puestos a crear, categoría profesional, tipo de contrato
- Funciones y requisitos de cada puesto
- Cronograma de incorporaciones

## 5. IMPACTO EN EL EMPLEO
- Número de empleos creados (indefinidos / temporales)
- Colectivos prioritarios (jóvenes, desempleados larga duración, mayores de 45, etc.)
- Proyección de estabilidad del empleo creado

## 6. PRESUPUESTO Y COSTE LABORAL
Tabla: Puesto | Categoría | Salario bruto anual | Coste SS empresa | Coste total
Subvención solicitada: X €/trabajador × Y trabajadores = Z €

## 7. ENCUADRE EN LA CONVOCATORIA

## 8. CONCLUSIÓN`,

    internacional: `
## 3. SITUACIÓN EXPORTADORA ACTUAL
- Mercados actuales (países, % facturación export)
- Canales de distribución y estructura comercial internacional
- Barreras identificadas para la internacionalización

## 4. PLAN DE INTERNACIONALIZACIÓN PROPUESTO
- Mercados objetivo y criterios de selección
- Estrategia de entrada (agente, distribuidor, filial, e-commerce)
- Acciones previstas (ferias, misiones, adaptación producto, certificaciones)

## 5. ESTIMACIÓN DE IMPACTO
- Incremento de exportaciones previsto (€ y %)
- Nuevos mercados a alcanzar
- Empleos vinculados a la expansión internacional

## 6. PRESUPUESTO
Tabla de acciones: Acción | País/Mercado | Fecha | Coste (€)
Total: X € | Subvención solicitada: Y €

## 7. ENCUADRE EN LA CONVOCATORIA

## 8. CONCLUSIÓN`,

    general: `
## 3. DESCRIPCIÓN DETALLADA DEL PROYECTO
- Justificación de la necesidad o problema que resuelve
- Descripción técnica de la actuación propuesta
- Localización y alcance del proyecto

## 4. OBJETIVOS Y RESULTADOS ESPERADOS
- Objetivo general
- Objetivos específicos cuantificables
- Indicadores de seguimiento y evaluación

## 5. METODOLOGÍA Y PLAN DE EJECUCIÓN
- Fases del proyecto con descripción
- Cronograma estimado
- Recursos humanos y materiales implicados

## 6. PRESUPUESTO DESGLOSADO
Tabla de partidas con unidades, precios y totales
Importe total: X € | Subvención solicitada: Y €

## 7. ENCUADRE EN LOS OBJETIVOS DE LA CONVOCATORIA

## 8. CONCLUSIÓN`,
  };

  return `Redacta una **Memoria Técnica Justificativa** completa y detallada para la convocatoria "${titulo}" (${organismo}).

Usa exactamente esta estructura de 8 secciones en Markdown con encabezados ##:

## 1. DATOS GENERALES DEL SOLICITANTE
- Nombre/Razón social completa y NIF
- Actividad económica (código CNAE y descripción)
- Forma jurídica y año de constitución
- Número de empleados y facturación anual aproximada
- Domicilio fiscal y localización del proyecto

## 2. DESCRIPCIÓN DE LA EMPRESA Y CONTEXTO DEL PROYECTO
- Descripción de la actividad principal (párrafo detallado)
- Mercados en los que opera y clientes tipo
- Situación actual que motiva el proyecto
- Por qué es el momento adecuado para esta inversión
${seccionEspecifica[tipo] ?? seccionEspecifica.general}

INSTRUCCIONES CRÍTICAS:
- Usa los datos del cliente proporcionados en el contexto — no inventes información que no esté disponible
- Donde falten datos específicos escribe [COMPLETAR: dato necesario]
- El tono debe ser técnico-profesional, como redactaría un consultor especializado en subvenciones
- Longitud mínima: 900 palabras
- Todas las tablas deben estar en formato Markdown correcto`;
}

function buildPrompt(tipo: string, contexto: Record<string, unknown>, promptCustom?: string) {
  const clienteArr = contexto.cliente as Record<string, unknown>[] | undefined;
  const cliente = clienteArr?.[0];

  const einforma = contexto.einforma as Record<string, unknown> | null | undefined;
  const subvencion = contexto.subvencion as Record<string, unknown> | null | undefined;
  const presupuestos = contexto.presupuestos as Array<Record<string, unknown>> | undefined;

  const clienteInfo = [
    cliente ? `EMPRESA: ${cliente.nombre_normalizado} (NIF: ${cliente.nif})` : '',
    einforma?.cnae
      ? `CNAE: ${einforma.cnae}`
      : (cliente?.cnae_codigo ? `CNAE: ${cliente.cnae_codigo}${cliente.cnae_descripcion ? ` — ${cliente.cnae_descripcion}` : ''}` : ''),
    einforma?.forma_juridica
      ? `Forma jurídica: ${einforma.forma_juridica}`
      : (cliente?.forma_juridica ? `Forma jurídica: ${cliente.forma_juridica}` : ''),
    einforma?.empleados
      ? `Empleados: ${einforma.empleados}`
      : (cliente?.num_empleados ? `Empleados: ${cliente.num_empleados}` : (cliente?.tamano_empresa ? `Tamaño: ${cliente.tamano_empresa}` : '')),
    einforma?.ventas
      ? `Facturación aprox.: ${Number(einforma.ventas).toLocaleString('es-ES')} €`
      : (cliente?.facturacion_anual ? `Facturación aprox.: ${Number(cliente.facturacion_anual).toLocaleString('es-ES')} €` : ''),
    einforma?.fecha_constitucion
      ? `Año constitución: ${new Date(einforma.fecha_constitucion as string).getFullYear()}`
      : (cliente?.anos_antiguedad ? `Antigüedad: ${cliente.anos_antiguedad} años` : ''),
    einforma?.localidad
      ? `Localización: ${einforma.localidad}`
      : (cliente?.comunidad_autonoma ? `Localización: ${cliente.comunidad_autonoma}${cliente.provincia ? `, ${cliente.provincia}` : ''}` : ''),
  ].filter(Boolean).join('\n');

  const subvencionInfo = subvencion ? [
    `CONVOCATORIA: ${subvencion.titulo ?? contexto.titulo}`,
    `Organismo: ${subvencion.organismo ?? contexto.organismo}`,
    subvencion.descripcion ? `Objeto: ${String(subvencion.descripcion).substring(0, 400)}` : '',
    subvencion.importe_maximo ? `Importe máximo: ${Number(subvencion.importe_maximo).toLocaleString('es-ES')} €` : '',
    subvencion.porcentaje_financiacion ? `% financiado: ${subvencion.porcentaje_financiacion}%` : '',
    contexto.importe_solicitado ? `Importe solicitado: ${Number(contexto.importe_solicitado).toLocaleString('es-ES')} €` : '',
  ].filter(Boolean).join('\n') : [
    contexto.titulo ? `CONVOCATORIA: ${contexto.titulo}` : '',
    contexto.organismo ? `Organismo: ${contexto.organismo}` : '',
    contexto.importe_solicitado ? `Importe solicitado: ${Number(contexto.importe_solicitado).toLocaleString('es-ES')} €` : '',
  ].filter(Boolean).join('\n');

  const presupuestosInfo = presupuestos?.length
    ? `PRESUPUESTOS RECIBIDOS:\n${presupuestos.map((p) => `- ${p.titulo ?? p.proveedor_nombre}: ${p.importe ? Number(p.importe).toLocaleString('es-ES') + ' €' : 'importe pendiente'}${p.plazo_dias ? ` (${p.plazo_dias} días)` : ''}`).join('\n')}`
    : '';

  const docsInfo = (contexto.documentos as Array<Record<string, unknown>> | undefined)
    ?.map((d) => `- ${d.nombre}: ${String(d.contenido ?? '').substring(0, 300)}`)
    .join('\n') ?? '';

  const notasInfo = (contexto.notas as Array<Record<string, unknown>> | undefined)
    ?.map((n) => `- ${String(n.contenido ?? '').substring(0, 200)}`)
    .join('\n') ?? '';

  const contextBlock = [
    clienteInfo,
    subvencionInfo ? `\n${subvencionInfo}` : '',
    presupuestosInfo ? `\n${presupuestosInfo}` : '',
    docsInfo ? `\nDOCUMENTOS ADJUNTOS:\n${docsInfo}` : '',
    notasInfo ? `\nNOTAS DEL GESTOR:\n${notasInfo}` : '',
  ].filter(Boolean).join('\n').trim();

  const configs: Record<string, { system: string; user: string; nombre: string }> = {
    resumen: {
      system: `Eres un experto en gestión de subvenciones que crea resúmenes ejecutivos.\n\n${contextBlock}`,
      user: 'Crea un resumen ejecutivo con: estado actual, importes, plazos clave, documentación pendiente y próximos pasos. Usa Markdown.',
      nombre: 'Resumen Ejecutivo',
    },
    checklist: {
      system: `Eres un experto en tramitación de subvenciones.\n\n${contextBlock}`,
      user: 'Genera un checklist exhaustivo organizado por fases: Preparación → Presentación → Seguimiento → Justificación. Usa checkboxes [ ] en Markdown.',
      nombre: 'Checklist de Tramitación',
    },
    email: {
      system: `Eres redactor profesional de comunicaciones sobre subvenciones.\n\n${contextBlock}`,
      user: 'Redacta un email profesional de seguimiento al cliente: estado del expediente y próximos pasos. Tono formal pero cercano.',
      nombre: 'Email de Seguimiento',
    },
    memoria: {
      system: `Eres experto en redacción de memorias técnicas justificativas para subvenciones públicas españolas. Conoces los formatos exigidos por INEGA, IDAE, CDTI, Red.es y fondos europeos. Tus memorias superan la revisión técnica de los organismos convocantes.\n\nCONTEXTO DEL EXPEDIENTE:\n${contextBlock}`,
      user: promptCustom || buildMemoriaUserPrompt({ ...contexto, organismo: (subvencion?.organismo ?? contexto.organismo ?? '') as string, titulo: (subvencion?.titulo ?? contexto.titulo ?? '') as string }),
      nombre: 'Memoria Técnica Justificativa',
    },
    busqueda_profunda: {
      system: `Eres investigador especializado en subvenciones y ayudas públicas para empresas españolas.\n\n${contextBlock}`,
      user: promptCustom || 'Analiza todas las subvenciones disponibles para este cliente (estatales, autonómicas, europeas). Para cada una: nombre, organismo, importe máximo, plazo y encaje con el cliente.',
      nombre: `Búsqueda de Subvenciones — ${new Date().toLocaleDateString('es-ES')}`,
    },
  };

  return configs[tipo] ?? configs.resumen;
}

// ─── POST /api/ia/generar ─────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { contextoId, contextoTipo, tipo, prompt, nombreDocumento } = await request.json();

    if (!contextoId || !contextoTipo || !tipo) {
      return NextResponse.json({ error: 'Faltan parámetros: contextoId, contextoTipo, tipo' }, { status: 400 });
    }

    const toolMap: Record<string, 'summary' | 'checklist' | 'email' | 'notebook'> = {
      resumen: 'summary',
      checklist: 'checklist',
      email: 'email',
    };
    const tool = toolMap[tipo] ?? 'notebook';

    const resolved = await resolveProvider(user.id, tool);
    if (!resolved) {
      return NextResponse.json(
        { error: 'No hay proveedor de IA configurado. Ve a Ajustes → IA y añade una API key.' },
        { status: 503 }
      );
    }
    const { provider, toolConfig, providerName } = resolved;
    // Modelo compatible con el proveedor real (evita usar claude-* con Google o gpt-* con Anthropic)
    const modeloEfectivo = toolConfig.provider === providerName
      ? (toolConfig.model || DEFAULT_MODEL[providerName])
      : DEFAULT_MODEL[providerName];

    const contexto = await recopilarContexto(supabase, contextoId, contextoTipo);
    const prompts = buildPrompt(tipo, contexto, prompt);

    const result = await withRetry(() =>
      provider.complete(
        [{ role: 'user', content: prompts.user }],
        {
          model: modeloEfectivo,
          temperature: Math.min(toolConfig.temperature ?? 0.5, 0.6),
          maxTokens: toolConfig.maxTokens ?? 4096,
          systemPrompt: prompts.system,
        }
      )
    );

    const contenido = result.content;

    // Guardar documento
    const documentoData: Record<string, unknown> = {
      nombre: nombreDocumento || prompts.nombre,
      contenido,
      tipo_documento: tipo,
      generado_por_ia: true,
      orden: 999,
      [contextoTipo === 'reunion' ? 'reunion_id' : 'expediente_id']: contextoId,
    };

    // NIF del contexto
    const nifQuery = contextoTipo === 'reunion'
      ? supabase.from('reuniones').select('cliente_nif').eq('id', contextoId).single()
      : supabase.from('expediente').select('nif').eq('id', contextoId).single();
    const { data: nifData } = await nifQuery;
    if (nifData) {
      documentoData.nif = (nifData as Record<string, string>).cliente_nif
        ?? (nifData as Record<string, string>).nif;
    }

    const { data: nuevoDoc, error: docError } = await supabase
      .from('documentos')
      .insert(documentoData)
      .select()
      .single();

    if (docError) throw new Error(`Error guardando documento: ${docError.message}`);

    supabase.from('ia_interacciones').insert({
      tipo: 'generacion',
      contexto_id: contextoId,
      contexto_tipo: contextoTipo,
      prompt: prompt || prompts.user,
      respuesta: contenido,
      modelo: result.model,
      tokens_usados: result.tokensUsed,
      metadata: { tipo_generacion: tipo, documento_id: nuevoDoc.id },
    }).then();

    return NextResponse.json({
      success: true,
      documento: nuevoDoc,
      contenido,
      tokensUsados: result.tokensUsed,
      modelo: result.model,
      proveedor: result.provider,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error al generar documento';
    console.error('[/api/ia/generar]', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function recopilarContexto(
  supabase: Awaited<ReturnType<typeof createClient>>,
  contextoId: string,
  contextoTipo: string
) {
  const contexto: Record<string, unknown> = {};

  const table = contextoTipo === 'reunion' ? 'reuniones' : 'expediente';
  const clienteJoin = contextoTipo === 'reunion'
    ? 'cliente:cliente_nif(nombre_normalizado, nif, actividad, tamano_empresa, ciudad, cnae_codigo, cnae_descripcion, num_empleados, facturacion_anual, anos_antiguedad, forma_juridica, comunidad_autonoma, provincia)'
    : 'cliente:nif(nombre_normalizado, nif, actividad, tamano_empresa, ciudad, cnae_codigo, cnae_descripcion, num_empleados, facturacion_anual, anos_antiguedad, forma_juridica, comunidad_autonoma, provincia)';

  const { data } = await supabase
    .from(table)
    .select(`*, ${clienteJoin}`)
    .eq('id', contextoId)
    .single();

  if (data) {
    Object.assign(contexto, data);
    contexto.cliente = data.cliente;
  }

  const docsCol = contextoTipo === 'reunion' ? 'reunion_id' : 'expediente_id';
  const { data: documentos } = await supabase
    .from('documentos')
    .select('nombre, contenido, tipo_documento')
    .eq(docsCol, contextoId)
    .order('orden')
    .limit(10);
  contexto.documentos = documentos || [];

  const { data: notas } = await supabase
    .from('notas')
    .select('contenido, created_at')
    .eq(contextoTipo === 'expediente' ? 'expediente_id' : 'nif', contextoId)
    .order('created_at', { ascending: false })
    .limit(5);
  contexto.notas = notas || [];

  if (contextoTipo === 'expediente' && data) {
    const expedienteData = data as Record<string, unknown>;

    if (expedienteData.nif) {
      const { data: einformaData } = await supabase
        .from('einforma')
        .select('cnae, forma_juridica, empleados, ventas, fecha_constitucion, localidad')
        .eq('nif', expedienteData.nif as string)
        .maybeSingle();
      contexto.einforma = einformaData;
    }

    if (expedienteData.subvencion_id) {
      const { data: subvencion } = await supabase
        .from('subvenciones')
        .select('titulo, organismo, descripcion, importe_maximo, porcentaje_financiacion')
        .eq('id', expedienteData.subvencion_id as string)
        .maybeSingle();
      contexto.subvencion = subvencion;
    }

    const { data: presupuestos } = await supabase
      .from('presupuestos')
      .select('titulo, proveedor_nombre, importe, plazo_dias, estado')
      .eq('expediente_id', contextoId)
      .limit(5);
    contexto.presupuestos = presupuestos || [];
  }

  return contexto;
}
