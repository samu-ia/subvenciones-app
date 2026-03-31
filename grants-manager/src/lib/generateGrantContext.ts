/**
 * generateGrantContext.ts
 *
 * Llama a Claude para generar contexto de subvención (docs requeridos, partidas,
 * gastos subvencionables) cuando no hay plantilla hardcodeada.
 *
 * Usa claude-haiku-4-5 para velocidad. El resultado se cachea en localStorage.
 */

export interface GeneratedGrantContext {
  necesidad: string
  subvencionable: string[]
  noSubvencionable: string[]
  docsRequeridos: string[]
  partidas: Array<{ partida: string; descripcion: string }>
  tipoPlantilla: 'general'
  generadoPorIA: true
}

interface ConvocatoriaInfo {
  idBdns: string
  nombre: string
  organismo: string
  tipo: string
  importeMax: number
  porcentajeSubvencionable: number
  descripcion: string
}

const CACHE_KEY_PREFIX = 'grant_ctx_v1_'
const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY as string

// Ejemplos reales del Balneario Río Pambre como few-shot
const FEW_SHOT_EXAMPLES = `
EJEMPLO 1 — Subvención de eficiencia energética (INEGA IN417Y, bomba de calor):
Entrada: {"nombre":"IN417Y — Ahorro y eficiencia energética en hostelería","organismo":"INEGA","importeMax":80000,"porcentajeSubvencionable":60,"descripcion":"Ayudas para mejora de eficiencia energética en establecimientos hosteleros. Incluye bombas de calor de alta eficiencia."}
Salida:
{
  "necesidad": "Sustitución del sistema de climatización por bomba de calor aerotérmica de alta eficiencia (SCOP ≥ 3,5). Requiere memoria técnica justificativa con tabla mensual de ahorro energético (kWh/año) y reducción de emisiones CO₂ (kg/año).",
  "subvencionable": ["Bomba de calor aerotérmica de alta eficiencia (SCOP ≥ 3,5)","Instalación y puesta en marcha certificada","Proyecto técnico e ingeniería (visado colegial)","Adaptaciones del sistema de distribución calor/frío"],
  "noSubvencionable": ["IVA (salvo entidades exentas)","Gastos de mantenimiento posterior a la instalación","Obras civiles no vinculadas directamente al equipo"],
  "docsRequeridos": ["Memoria técnica justificativa (obligatorio)","Tabla mensual ahorro kWh/año + reducción kg CO₂/año","Ficha técnica del equipo (fabricante, con SCOP y modelo)","Presupuesto detallado por partidas (firmado)","Informe técnico firmado por técnico competente","Oferta del instalador con nº de oferta y fecha"],
  "partidas": [{"partida":"Equipo","descripcion":"Bomba de calor aerotérmica (modelo + nº oferta instalador)"},{"partida":"Instalación hidráulica","descripcion":"Adaptación circuito hidráulico y conexiones"},{"partida":"Sistema eléctrico","descripcion":"Cuadro eléctrico y protecciones"},{"partida":"Ingeniería","descripcion":"Proyecto técnico y memoria justificativa"},{"partida":"Puesta en marcha","descripcion":"Configuración, pruebas y certificación"}]
}

EJEMPLO 2 — Subvención de digitalización (Kit Digital):
Entrada: {"nombre":"Kit Digital — Segmento II (3-9 empleados)","organismo":"Red.es","importeMax":6000,"porcentajeSubvencionable":100,"descripcion":"Digitalización de pequeñas empresas mediante soluciones tecnológicas certificadas AceleraPyme."}
Salida:
{
  "necesidad": "Implementación de soluciones digitales certificadas AceleraPyme: presencia en internet, gestión de clientes (CRM) y factura electrónica. El proveedor debe ser Agente Digitalizador acreditado.",
  "subvencionable": ["Software/SaaS certificado AceleraPyme (licencia mínima 12 meses)","Página web + posicionamiento SEO básico","CRM y gestión de clientes","Factura electrónica","Formación incluida en la solución"],
  "noSubvencionable": ["Hardware no vinculado a la solución digital","Desarrollo a medida no certificado","Consultoría estratégica externa"],
  "docsRequeridos": ["Acreditación como Agente Digitalizador Red.es (obligatorio)","Propuesta técnica con soluciones certificadas AceleraPyme","Presupuesto desglosado por solución digital","Declaración responsable de la empresa","Contrato de servicio firmado"],
  "partidas": [{"partida":"Presencia en internet","descripcion":"Página web + SEO básico (12 meses)"},{"partida":"CRM","descripcion":"Software gestión de clientes (licencia 12 meses)"},{"partida":"Factura electrónica","descripcion":"Solución factura electrónica (12 meses)"},{"partida":"Formación","descripcion":"Sesiones de formación incluidas en la solución"}]
}

EJEMPLO 3 — FV autoconsumo (INEGA IN421T):
Entrada: {"nombre":"IN421T — Autoconsumo fotovoltaico para PYME (Galicia)","organismo":"INEGA","importeMax":100000,"porcentajeSubvencionable":40,"descripcion":"Subvenciones para instalaciones de autoconsumo fotovoltaico en PYMEs gallegas. Requiere proyecto técnico completo visado."}
Salida:
{
  "necesidad": "Ampliación de instalación fotovoltaica de autoconsumo (≤100 kWp). Requiere proyecto técnico completo visado por ingeniero colegiado: memoria, cálculos, planos, fichas técnicas, plan de seguridad y presupuesto detallado.",
  "subvencionable": ["Módulos fotovoltaicos y estructura de soporte","Inversor trifásico y protecciones CC/CA","Cableado DC/AC y equipos de medida","Ingeniería: proyecto técnico completo visado"],
  "noSubvencionable": ["Baterías de almacenamiento (línea de convocatoria diferente)","IVA (salvo entidades exentas)","Tramitación administrativa y tasas de licencias"],
  "docsRequeridos": ["Proyecto técnico visado: memoria + cálculos + planos (obligatorio)","Fichas técnicas de módulos FV e inversor","Plan de seguridad y salud (obligatorio)","Plan de gestión de residuos","Presupuesto detallado por partidas (firmado)","Estimación de producción anual (kWh/año)"],
  "partidas": [{"partida":"Módulos FV","descripcion":"Paneles fotovoltaicos (ud × precio/panel)"},{"partida":"Estructura soporte","descripcion":"Estructura de montaje coplanar/inclinada"},{"partida":"Inversor","descripcion":"Inversor trifásico + protecciones CC y CA"},{"partida":"Equipos de medida","descripcion":"Contador bidireccional y telegestión"},{"partida":"Protecciones eléctricas","descripcion":"Cuadro AC, fusibles, descargadores sobretensión"},{"partida":"Cableado","descripcion":"Conductor DC y AC, bandejas, tubería protectora"},{"partida":"Instalación","descripcion":"Montaje, conexionado y puesta en marcha"}]
}
`

export async function generateGrantContext(
  conv: ConvocatoriaInfo
): Promise<GeneratedGrantContext> {
  // Check cache first
  const cacheKey = CACHE_KEY_PREFIX + conv.idBdns
  const cached = localStorage.getItem(cacheKey)
  if (cached) {
    try {
      return JSON.parse(cached) as GeneratedGrantContext
    } catch {
      // corrupt cache, regenerate
    }
  }

  const prompt = `Eres un experto en subvenciones públicas españolas para PYMEs. Dado el siguiente JSON de una convocatoria, genera el contexto que necesita un instalador/proveedor para preparar su presupuesto correctamente.

Los ejemplos reales a continuación muestran el nivel de detalle y formato esperado:
${FEW_SHOT_EXAMPLES}

Ahora genera el contexto para esta convocatoria:
${JSON.stringify({
  nombre: conv.nombre,
  organismo: conv.organismo,
  importeMax: conv.importeMax,
  porcentajeSubvencionable: conv.porcentajeSubvencionable,
  descripcion: conv.descripcion,
})}

Responde SOLO con JSON válido (sin markdown, sin explicaciones). El JSON debe tener exactamente estas claves:
- necesidad: string — qué necesita hacer la PYME y qué rol tiene el proveedor
- subvencionable: string[] — lista de gastos cubiertos por la subvención (3-6 items)
- noSubvencionable: string[] — gastos excluidos importantes (2-4 items)
- docsRequeridos: string[] — documentos que debe aportar el proveedor (4-7 items, el primero marcado como obligatorio)
- partidas: Array<{partida: string, descripcion: string}> — líneas del presupuesto (3-8 items)

Responde en español. Sé específico y práctico, no genérico.`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`)
  }

  const data = await response.json()
  const text = data.content?.[0]?.text ?? ''

  // Parse JSON — strip any markdown fences just in case
  const jsonStr = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
  const parsed = JSON.parse(jsonStr) as Omit<GeneratedGrantContext, 'generadoPorIA'>

  const result: GeneratedGrantContext = { ...parsed, tipoPlantilla: 'general', generadoPorIA: true }

  // Cache for 7 days
  localStorage.setItem(cacheKey, JSON.stringify(result))

  return result
}
