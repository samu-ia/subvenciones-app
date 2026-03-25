/**
 * lib/matching/deep-validator.ts
 *
 * Fase 2 del matching: validación profunda de elegibilidad.
 *
 * Se ejecuta SOLO cuando:
 *   · El cliente ha mostrado interés en una subvención (score >= umbral)
 *   · Ha respondido el cuestionario de encaje
 *
 * La IA recibe:
 *   · Datos normalizados de la subvención (requisitos, gastos, beneficiarios, etc.)
 *   · Perfil completo del cliente
 *   · Respuestas al cuestionario
 *
 * La IA devuelve un veredicto estructurado con evidencias del documento.
 * El sistema nunca inventa: si no hay datos suficientes → resultado "revisar".
 *
 * Filosofía: IA interpreta → SISTEMA decide si ejecutar la solicitud.
 */

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type VeredictoFase2 = 'elegible' | 'revisar' | 'no_elegible';

export interface EvidenciaValidacion {
  campo: string;         // requisito o campo de la convocatoria
  texto: string;         // fragmento del PDF o descripción del requisito
  cumple: boolean | null; // null = no determinable
  nota: string;          // explicación corta
}

export interface RiesgoDetectado {
  nivel: 'bajo' | 'medio' | 'alto';
  descripcion: string;
  mitigacion?: string;
}

export interface ResultadoFase2 {
  veredicto: VeredictoFase2;
  confianza: number;           // 0-1
  motivo_principal: string;    // 1 frase resumen
  evidencias: EvidenciaValidacion[];
  riesgos: RiesgoDetectado[];
  pasos_siguientes: string[];
  requiere_revision_manual: boolean;
  modelo_usado: string;
  procesado_at: string;
}

export interface InputFase2 {
  // Subvención normalizada
  subvencion: {
    titulo: string;
    organismo?: string | null;
    objeto?: string | null;
    para_quien?: string | null;
    beneficiarios?: string[] | null;
    requisitos?: Array<{ tipo: string; descripcion: string; obligatorio: boolean }> | null;
    gastos_subvencionables?: Array<{ categoria: string; descripcion: string; porcentaje_max?: number | null }> | null;
    documentacion_exigida?: Array<{ nombre: string; descripcion?: string | null; obligatorio: boolean }> | null;
    importe_maximo?: number | null;
    plazo_fin?: string | null;
    ambito_geografico?: string | null;
    comunidad_autonoma?: string | null;
    tipos_empresa?: Array<{ tipo: string; excluido: boolean }> | null;
    sectores?: Array<{ cnae_codigo?: string | null; nombre_sector: string; excluido: boolean }> | null;
  };
  // Perfil del cliente
  cliente: {
    nombre_empresa?: string | null;
    nif: string;
    cnae_codigo?: string | null;
    cnae_descripcion?: string | null;
    comunidad_autonoma?: string | null;
    tamano_empresa?: string | null;
    num_empleados?: number | null;
    facturacion_anual?: number | null;
    anos_antiguedad?: number | null;
    forma_juridica?: string | null;
    descripcion_actividad?: string | null;
  };
  // Respuestas al cuestionario (Fase 1.5 — formulario dinámico)
  respuestas?: Array<{
    pregunta: string;
    respuesta: unknown;
    tipo: 'si_no' | 'texto_corto' | 'texto_largo' | 'numero';
    categoria: 'encaje' | 'proyecto' | 'empresa' | 'documentacion';
  }> | null;
  // Config IA
  iaProvider: {
    provider: string;
    api_key: string;
    base_url?: string | null;
  };
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Eres un experto validador de elegibilidad para subvenciones públicas españolas.
Tu tarea es analizar si una empresa concreta es elegible para una convocatoria específica, basándote en los datos del documento normalizado y las respuestas del cuestionario.

REGLAS CRÍTICAS:
1. Nunca inventes requisitos que no estén en los datos de la convocatoria.
2. Si no tienes información suficiente para determinar un requisito → cumple: null.
3. El veredicto debe ser conservador: si hay duda razonable → "revisar", no "elegible".
4. Las evidencias deben referenciar datos reales de la convocatoria, no suposiciones.
5. Los riesgos deben ser concretos y accionables.
6. Si el cliente ha respondido "No" a una pregunta de encaje obligatoria → no_elegible directo.`;

function buildPrompt(input: InputFase2): string {
  const { subvencion: s, cliente: c, respuestas } = input;

  const reqTexto = (s.requisitos ?? [])
    .map(r => `· [${r.obligatorio ? 'OBLIGATORIO' : 'recomendado'}] ${r.descripcion}`)
    .join('\n') || 'No especificados';

  const tiposTexto = (s.tipos_empresa ?? [])
    .map(t => `· ${t.tipo}${t.excluido ? ' (EXCLUIDO)' : ''}`)
    .join('\n') || 'Sin restricción';

  const sectoresTexto = (s.sectores ?? [])
    .map(t => `· ${t.nombre_sector}${t.cnae_codigo ? ` (CNAE ${t.cnae_codigo})` : ''}${t.excluido ? ' (EXCLUIDO)' : ''}`)
    .join('\n') || 'Sin restricción';

  const respuestasTexto = (respuestas ?? [])
    .map(r => {
      const val = r.tipo === 'si_no'
        ? (r.respuesta ? 'SÍ' : 'NO')
        : String(r.respuesta ?? '');
      return `· [${r.categoria.toUpperCase()}] ${r.pregunta}\n  → Respuesta: ${val}`;
    })
    .join('\n') || 'Sin respuestas al cuestionario';

  return `Valida la elegibilidad de esta empresa para esta subvención.

═══ CONVOCATORIA ═══
Título: ${s.titulo}
Organismo: ${s.organismo ?? 'No especificado'}
Objeto: ${s.objeto ?? 'No especificado'}
Para quién: ${s.para_quien ?? 'No especificado'}
Ámbito: ${s.ambito_geografico ?? 'desconocido'}${s.comunidad_autonoma ? ` — ${s.comunidad_autonoma}` : ''}
Importe máximo: ${s.importe_maximo ? `${s.importe_maximo.toLocaleString('es-ES')} €` : 'No especificado'}
Plazo fin: ${s.plazo_fin ?? 'No especificado'}

Tipos de empresa admitidos:
${tiposTexto}

Sectores:
${sectoresTexto}

Requisitos:
${reqTexto}

Gastos subvencionables: ${(s.gastos_subvencionables ?? []).map(g => g.descripcion).join(', ') || 'No especificados'}

Documentación exigida: ${(s.documentacion_exigida ?? []).filter(d => d.obligatorio).map(d => d.nombre).join(', ') || 'No especificada'}

═══ EMPRESA ═══
Nombre: ${c.nombre_empresa ?? 'No disponible'}
NIF: ${c.nif}
CNAE: ${c.cnae_codigo ?? 'No disponible'}${c.cnae_descripcion ? ` — ${c.cnae_descripcion}` : ''}
Comunidad autónoma: ${c.comunidad_autonoma ?? 'No disponible'}
Tamaño: ${c.tamano_empresa ?? 'No disponible'}
Empleados: ${c.num_empleados ?? 'No disponible'}
Facturación anual: ${c.facturacion_anual ? `${c.facturacion_anual.toLocaleString('es-ES')} €` : 'No disponible'}
Antigüedad: ${c.anos_antiguedad != null ? `${c.anos_antiguedad} años` : 'No disponible'}
Forma jurídica: ${c.forma_juridica ?? 'No disponible'}
Actividad: ${c.descripcion_actividad ?? 'No disponible'}

═══ RESPUESTAS AL CUESTIONARIO ═══
${respuestasTexto}

═══ INSTRUCCIÓN ═══
Devuelve ÚNICAMENTE este JSON (sin texto antes ni después):

{
  "veredicto": "elegible|revisar|no_elegible",
  "confianza": 0.0,
  "motivo_principal": "Una frase clara resumiendo el veredicto",
  "evidencias": [
    {
      "campo": "nombre del requisito o campo",
      "texto": "texto del requisito tal como aparece en la convocatoria",
      "cumple": true|false|null,
      "nota": "explicación corta de por qué cumple o no"
    }
  ],
  "riesgos": [
    {
      "nivel": "bajo|medio|alto",
      "descripcion": "descripción del riesgo",
      "mitigacion": "cómo reducirlo (opcional)"
    }
  ],
  "pasos_siguientes": ["paso concreto 1", "paso concreto 2"],
  "requiere_revision_manual": false
}

CRITERIOS PARA EL VEREDICTO:
- "elegible": Todos los requisitos obligatorios claramente cumplidos, sin riesgos altos, confianza >= 0.7
- "revisar": Requisitos incompletos o respuestas insuficientes para confirmar, OR hay riesgos medios/altos
- "no_elegible": Un requisito obligatorio claramente NO cumplido, OR cliente en sector/tipo excluido, OR respuesta "No" a pregunta obligatoria de encaje`;
}

// ─── Llamada IA ───────────────────────────────────────────────────────────────

async function llamarIA(
  prompt: string,
  provider: string,
  apiKey: string,
  baseUrl?: string | null,
): Promise<string> {
  if (provider === 'google') {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          generationConfig: { temperature: 0.1, maxOutputTokens: 2500 },
        }),
        signal: AbortSignal.timeout(30_000),
      }
    );
    const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  }

  const url = `${baseUrl ?? 'https://api.openai.com/v1'}/chat/completions`;
  const model = provider === 'anthropic' ? 'claude-haiku-4-5-20251001' : 'gpt-4o-mini';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 2500,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? '';
}

// ─── Parser ───────────────────────────────────────────────────────────────────

function parsearResultado(raw: string, modelo: string): ResultadoFase2 {
  const fallback: ResultadoFase2 = {
    veredicto: 'revisar',
    confianza: 0.3,
    motivo_principal: 'No se pudo generar validación automática. Revisión manual requerida.',
    evidencias: [],
    riesgos: [{ nivel: 'medio', descripcion: 'Validación automática no disponible', mitigacion: 'Revisar manualmente los requisitos de la convocatoria' }],
    pasos_siguientes: ['Revisar manualmente los requisitos de la convocatoria', 'Contactar con el gestor para confirmar elegibilidad'],
    requiere_revision_manual: true,
    modelo_usado: modelo,
    procesado_at: new Date().toISOString(),
  };

  try {
    const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    const candidate = (fence ? fence[1] : raw).trim();
    const jsonMatch = candidate.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallback;

    const p = JSON.parse(jsonMatch[0]);

    const veredictos = ['elegible', 'revisar', 'no_elegible'];
    if (!veredictos.includes(p.veredicto)) return fallback;

    return {
      veredicto: p.veredicto,
      confianza: typeof p.confianza === 'number' ? Math.max(0, Math.min(1, p.confianza)) : 0.5,
      motivo_principal: typeof p.motivo_principal === 'string' ? p.motivo_principal : fallback.motivo_principal,
      evidencias: Array.isArray(p.evidencias) ? p.evidencias.map((e: Record<string, unknown>) => ({
        campo: String(e.campo ?? ''),
        texto: String(e.texto ?? ''),
        cumple: e.cumple === true ? true : e.cumple === false ? false : null,
        nota: String(e.nota ?? ''),
      })) : [],
      riesgos: Array.isArray(p.riesgos) ? p.riesgos.map((r: Record<string, unknown>) => ({
        nivel: ['bajo', 'medio', 'alto'].includes(String(r.nivel)) ? r.nivel as 'bajo' | 'medio' | 'alto' : 'medio',
        descripcion: String(r.descripcion ?? ''),
        mitigacion: r.mitigacion ? String(r.mitigacion) : undefined,
      })) : [],
      pasos_siguientes: Array.isArray(p.pasos_siguientes) ? p.pasos_siguientes.map(String) : fallback.pasos_siguientes,
      requiere_revision_manual: !!p.requiere_revision_manual,
      modelo_usado: modelo,
      procesado_at: new Date().toISOString(),
    };
  } catch {
    return fallback;
  }
}

// ─── Función principal ────────────────────────────────────────────────────────

/**
 * Ejecuta la validación profunda Fase 2.
 * Devuelve el resultado estructurado listo para guardar en BD o mostrar al usuario.
 */
export async function validarElegibilidadFase2(input: InputFase2): Promise<ResultadoFase2> {
  const modelo = input.iaProvider.provider === 'google'
    ? 'gemini-2.0-flash'
    : input.iaProvider.provider === 'anthropic'
    ? 'claude-haiku-4-5-20251001'
    : 'gpt-4o-mini';

  // Hard check antes de llamar a la IA: respuesta "No" en pregunta de encaje obligatoria
  const respuestas = input.respuestas ?? [];
  const bloqueante = respuestas.find(r =>
    r.categoria === 'encaje' && r.respuesta === false
  );
  if (bloqueante) {
    return {
      veredicto: 'no_elegible',
      confianza: 0.95,
      motivo_principal: `Requisito de encaje no cumplido: "${bloqueante.pregunta}"`,
      evidencias: [{
        campo: 'Cuestionario de encaje',
        texto: bloqueante.pregunta,
        cumple: false,
        nota: 'El cliente respondió No a un requisito obligatorio',
      }],
      riesgos: [{ nivel: 'alto', descripcion: bloqueante.pregunta }],
      pasos_siguientes: ['Esta convocatoria no aplica para tu empresa en este momento'],
      requiere_revision_manual: false,
      modelo_usado: 'determinista',
      procesado_at: new Date().toISOString(),
    };
  }

  const prompt = buildPrompt(input);
  const raw = await llamarIA(
    prompt,
    input.iaProvider.provider,
    input.iaProvider.api_key,
    input.iaProvider.base_url,
  ).catch(() => '');

  return parsearResultado(raw, modelo);
}
