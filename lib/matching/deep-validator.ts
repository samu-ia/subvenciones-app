/**
 * lib/matching/deep-validator.ts
 *
 * Fase 2 del matching: validación profunda de elegibilidad.
 *
 * Usa SIEMPRE las 4 fuentes de datos juntas:
 *   1. Datos normalizados de la subvención (requisitos, sectores, tipos empresa, etc.)
 *   2. Grounding documental por campo (fragmentos exactos del PDF)
 *   3. Perfil completo del cliente
 *   4. Respuestas al cuestionario dinámico
 *
 * Hard checks deterministas ANTES de llamar a la IA:
 *   · Respuesta "No" a encaje obligatorio
 *   · Geografía incompatible (CA exigida ≠ CA cliente)
 *   · Tipo empresa excluido explícitamente
 *   · Sector CNAE excluido explícitamente
 *   · Convocatoria cerrada o suspendida
 *
 * Output separado en:
 *   · bloqueantes  — impiden continuar (hard stops)
 *   · riesgos      — clasificados bajo/medio/alto (no bloquean pero alertan)
 *   · puntos_pendientes — información que falta para confirmar
 *   · documentos_a_verificar — documentación a preparar/comprobar
 *
 * Trazabilidad:
 *   · version_motor — versión del motor de validación
 *   · version_prompt — versión del prompt usado
 *   · validated_at  — timestamp ISO
 *
 * Filosofía: IA interpreta → SISTEMA decide si ejecutar la solicitud.
 */

// ─── Versiones para trazabilidad ─────────────────────────────────────────────

export const VERSION_MOTOR = '2.1.0';
export const VERSION_PROMPT = '2024-03-v2';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type VeredictoFase2 = 'elegible' | 'revisar' | 'no_elegible';

export interface FuenteEvidencia {
  documento?: string;
  pagina?: number | null;
  texto: string;           // fragmento exacto del PDF o descripción del requisito
}

export interface EvidenciaRequisito {
  requisito: string;       // nombre del requisito evaluado
  cumple: true | false | null;  // null = no hay info suficiente
  tipo: 'hard_requirement' | 'soft_requirement' | 'documentacion' | 'recomendacion';
  justificacion: string;   // por qué cumple / no cumple / no se puede determinar
  fuentes: FuenteEvidencia[];  // fragmentos del documento que soportan la evaluación
}

export interface BloqueanteFase2 {
  requisito: string;       // qué requisito bloquea
  motivo: string;          // por qué bloquea
  fuente?: string;         // de dónde viene este requisito (PDF, cuestionario, etc.)
}

export interface RiesgoFase2 {
  nivel: 'bajo' | 'medio' | 'alto';
  descripcion: string;
  mitigacion?: string;
}

export interface ResultadoFase2 {
  veredicto: VeredictoFase2;
  confianza: number;              // 0-1
  motivo_principal: string;       // 1 frase clara del veredicto
  evidencias: EvidenciaRequisito[];
  bloqueantes: BloqueanteFase2[];       // impiden continuar
  riesgos: RiesgoFase2[];               // alertas sin bloqueo
  puntos_pendientes: string[];          // info que falta para confirmar
  documentos_a_verificar: string[];     // documentación a preparar/comprobar
  pasos_siguientes: string[];
  requiere_revision_manual: boolean;
  // Trazabilidad
  version_motor: string;
  version_prompt: string;
  validated_at: string;
  modelo_usado: string;
}

export interface GroundingCampo {
  nombre_campo: string;
  valor_texto?: string | null;
  fragmento_texto?: string | null;
  pagina_estimada?: number | null;
  confidence?: number;
}

export interface InputFase2 {
  // 1. Subvención normalizada
  subvencion: {
    id?: string;
    titulo: string;
    organismo?: string | null;
    objeto?: string | null;
    para_quien?: string | null;
    beneficiarios?: string[] | null;
    requisitos?: Array<{ tipo: string; descripcion: string; obligatorio: boolean }> | null;
    gastos_subvencionables?: Array<{ categoria: string; descripcion: string; porcentaje_max?: number | null }> | null;
    documentacion_exigida?: Array<{ nombre: string; descripcion?: string | null; obligatorio: boolean }> | null;
    importe_maximo?: number | null;
    importe_minimo?: number | null;
    plazo_fin?: string | null;
    ambito_geografico?: string | null;
    comunidad_autonoma?: string | null;
    provincia?: string | null;
    estado_convocatoria?: string | null;
    tipos_empresa?: Array<{ tipo: string; excluido: boolean }> | null;
    sectores?: Array<{ cnae_codigo?: string | null; nombre_sector: string; excluido: boolean }> | null;
  };
  // 2. Grounding documental (campos extraídos con fragmento del PDF)
  grounding?: GroundingCampo[] | null;
  // 3. Perfil del cliente
  cliente: {
    nombre_empresa?: string | null;
    nif: string;
    cnae_codigo?: string | null;
    cnae_descripcion?: string | null;
    comunidad_autonoma?: string | null;
    provincia?: string | null;
    tamano_empresa?: string | null;
    num_empleados?: number | null;
    facturacion_anual?: number | null;
    anos_antiguedad?: number | null;
    forma_juridica?: string | null;
    descripcion_actividad?: string | null;
  };
  // 4. Respuestas al cuestionario dinámico
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

// ─── Hard checks deterministas ────────────────────────────────────────────────

interface HardCheckResult {
  bloqueado: boolean;
  bloqueante?: BloqueanteFase2;
}

function normCA(s?: string | null): string {
  return (s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function runHardChecks(input: InputFase2): HardCheckResult {
  const { subvencion: s, cliente: c, respuestas = [] } = input;

  // 1. Convocatoria cerrada o suspendida
  if (s.estado_convocatoria === 'cerrada') {
    return { bloqueado: true, bloqueante: { requisito: 'Estado convocatoria', motivo: 'La convocatoria está cerrada', fuente: 'BDNS' } };
  }
  if (s.estado_convocatoria === 'suspendida') {
    return { bloqueado: true, bloqueante: { requisito: 'Estado convocatoria', motivo: 'La convocatoria está suspendida', fuente: 'BDNS' } };
  }

  // 2. Geografía incompatible
  if (s.ambito_geografico === 'autonomico' && s.comunidad_autonoma && c.comunidad_autonoma) {
    if (normCA(s.comunidad_autonoma) !== normCA(c.comunidad_autonoma)) {
      return {
        bloqueado: true,
        bloqueante: {
          requisito: 'Ámbito geográfico',
          motivo: `Esta convocatoria es exclusiva para ${s.comunidad_autonoma}. Tu empresa está en ${c.comunidad_autonoma}.`,
          fuente: 'Datos normalizados',
        },
      };
    }
  }

  // 3. Tipo de empresa excluido
  if (s.tipos_empresa?.length) {
    const tiposCliente = derivarTiposCliente(c);
    const excluidos = s.tipos_empresa.filter(t => t.excluido);
    for (const exc of excluidos) {
      if (tiposCliente.includes(exc.tipo)) {
        return {
          bloqueado: true,
          bloqueante: {
            requisito: 'Tipo de empresa',
            motivo: `Tu tipo de empresa (${exc.tipo}) está explícitamente excluido en esta convocatoria.`,
            fuente: 'Tablas auxiliares normalizadas',
          },
        };
      }
    }
  }

  // 4. Sector CNAE excluido
  if (s.sectores?.length && c.cnae_codigo) {
    const clienteCnae = c.cnae_codigo.slice(0, 4);
    const excluidos = s.sectores.filter(sec => sec.excluido);
    for (const exc of excluidos) {
      if (exc.cnae_codigo && exc.cnae_codigo.slice(0, 4) === clienteCnae) {
        return {
          bloqueado: true,
          bloqueante: {
            requisito: 'Sector CNAE',
            motivo: `Tu sector (CNAE ${clienteCnae}) está excluido en esta convocatoria.`,
            fuente: 'Tablas auxiliares normalizadas',
          },
        };
      }
    }
  }

  // 5. Respuesta "No" a pregunta de encaje obligatoria
  for (const r of respuestas) {
    if (r.categoria === 'encaje' && r.respuesta === false) {
      return {
        bloqueado: true,
        bloqueante: {
          requisito: 'Cuestionario de encaje',
          motivo: `Requisito obligatorio no cumplido: "${r.pregunta}"`,
          fuente: 'Cuestionario dinámico',
        },
      };
    }
  }

  return { bloqueado: false };
}

function derivarTiposCliente(c: InputFase2['cliente']): string[] {
  const tipos = new Set<string>();
  const emp = c.num_empleados ?? 0;
  const fac = c.facturacion_anual ?? 0;
  const forma = (c.forma_juridica ?? '').toLowerCase();
  const tamano = (c.tamano_empresa ?? '').toLowerCase();

  if (emp <= 10 || fac <= 2_000_000) tipos.add('micropyme');
  if (emp <= 250 || fac <= 50_000_000) tipos.add('pyme');
  if (emp > 250) tipos.add('grande');
  if (forma.includes('autón') || forma === 'autonomo' || tamano.includes('autón')) tipos.add('autonomo');
  if ((c.anos_antiguedad ?? 99) <= 5) tipos.add('startup');
  if (forma.includes('cooperat') || forma.includes('asocia') || forma.includes('fundac')) tipos.add('otro');
  if (tipos.size === 0) tipos.add('pyme');
  return [...tipos];
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Eres un experto validador de elegibilidad para subvenciones públicas españolas.
Tienes acceso a los datos normalizados de la convocatoria, los fragmentos exactos del PDF (grounding), el perfil de la empresa y las respuestas al cuestionario.

REGLAS CRÍTICAS:
1. Nunca inventes requisitos. Solo evalúa lo que aparece en los datos.
2. cumple: null significa "no hay información suficiente" — no es neutral, dispara revisar.
3. Sé conservador: si hay duda razonable → "revisar", nunca "elegible".
4. Separa claramente bloqueantes (impiden continuar) de riesgos (alertan pero no bloquean).
5. Las fuentes de cada evidencia deben ser fragmentos reales del grounding o descripción del requisito.
6. documentos_a_verificar son documentos ESPECÍFICOS de esta convocatoria, no genéricos.`;

function buildPrompt(input: InputFase2): string {
  const { subvencion: s, cliente: c, grounding, respuestas } = input;

  // Formatear grounding como contexto documental
  const groundingTexto = (grounding ?? [])
    .filter(g => g.fragmento_texto || g.valor_texto)
    .map(g => `· [${g.nombre_campo}] "${g.fragmento_texto ?? g.valor_texto}"${g.pagina_estimada ? ` (pág. ${g.pagina_estimada})` : ''}${g.confidence != null ? ` [confidence: ${g.confidence.toFixed(2)}]` : ''}`)
    .join('\n') || 'Sin grounding documental disponible';

  const reqTexto = (s.requisitos ?? [])
    .map(r => `· [${r.obligatorio ? 'OBLIGATORIO' : 'opcional'}][${r.tipo}] ${r.descripcion}`)
    .join('\n') || 'No especificados';

  const docTexto = (s.documentacion_exigida ?? [])
    .map(d => `· [${d.obligatorio ? 'OBLIGATORIO' : 'opcional'}] ${d.nombre}${d.descripcion ? `: ${d.descripcion}` : ''}`)
    .join('\n') || 'No especificada';

  const tiposTexto = (s.tipos_empresa ?? [])
    .map(t => `· ${t.tipo}${t.excluido ? ' (EXCLUIDO)' : ' (permitido)'}`)
    .join('\n') || 'Sin restricción de tipo';

  const sectoresTexto = (s.sectores ?? [])
    .map(t => `· ${t.nombre_sector}${t.cnae_codigo ? ` (CNAE ${t.cnae_codigo})` : ''}${t.excluido ? ' (EXCLUIDO)' : ' (permitido)'}`)
    .join('\n') || 'Sin restricción sectorial';

  const respuestasTexto = (respuestas ?? [])
    .map(r => {
      const val = r.tipo === 'si_no' ? (r.respuesta ? 'SÍ' : 'NO') : String(r.respuesta ?? '(sin respuesta)');
      return `· [${r.categoria.toUpperCase()}] ${r.pregunta}\n  → ${val}`;
    })
    .join('\n') || 'Sin respuestas al cuestionario';

  return `Valida la elegibilidad de esta empresa para esta convocatoria de subvención.

═══ CONVOCATORIA ═══
Título: ${s.titulo}
Organismo: ${s.organismo ?? 'No especificado'}
Objeto: ${s.objeto ?? 'No especificado'}
Para quién: ${s.para_quien ?? 'No especificado'}
Ámbito: ${s.ambito_geografico ?? 'desconocido'}${s.comunidad_autonoma ? ` — ${s.comunidad_autonoma}` : ''}
Importe máximo: ${s.importe_maximo ? `${s.importe_maximo.toLocaleString('es-ES')} €` : 'No especificado'}
Plazo fin: ${s.plazo_fin ?? 'No especificado'}

Tipos de empresa:
${tiposTexto}

Sectores:
${sectoresTexto}

Requisitos:
${reqTexto}

Gastos subvencionables: ${(s.gastos_subvencionables ?? []).map(g => `${g.descripcion}${g.porcentaje_max ? ` (máx. ${g.porcentaje_max}%)` : ''}`).join(', ') || 'No especificados'}

Documentación exigida:
${docTexto}

═══ GROUNDING DOCUMENTAL (fragmentos exactos del PDF) ═══
${groundingTexto}

═══ EMPRESA ═══
Nombre: ${c.nombre_empresa ?? 'No disponible'}
NIF: ${c.nif}
CNAE: ${c.cnae_codigo ?? 'N/D'}${c.cnae_descripcion ? ` — ${c.cnae_descripcion}` : ''}
Comunidad autónoma: ${c.comunidad_autonoma ?? 'No disponible'}
Provincia: ${c.provincia ?? 'No disponible'}
Tamaño: ${c.tamano_empresa ?? 'No disponible'}
Empleados: ${c.num_empleados ?? 'N/D'}
Facturación anual: ${c.facturacion_anual ? `${c.facturacion_anual.toLocaleString('es-ES')} €` : 'N/D'}
Antigüedad: ${c.anos_antiguedad != null ? `${c.anos_antiguedad} años` : 'N/D'}
Forma jurídica: ${c.forma_juridica ?? 'N/D'}
Actividad: ${c.descripcion_actividad ?? 'N/D'}

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
      "requisito": "nombre del requisito",
      "cumple": true|false|null,
      "tipo": "hard_requirement|soft_requirement|documentacion|recomendacion",
      "justificacion": "por qué cumple o no cumple o no se puede determinar",
      "fuentes": [
        {
          "texto": "fragmento exacto del grounding o descripción del requisito",
          "pagina": null
        }
      ]
    }
  ],
  "bloqueantes": [
    {
      "requisito": "qué requisito bloquea",
      "motivo": "por qué impide continuar",
      "fuente": "de dónde viene"
    }
  ],
  "riesgos": [
    {
      "nivel": "bajo|medio|alto",
      "descripcion": "descripción del riesgo",
      "mitigacion": "cómo reducirlo"
    }
  ],
  "puntos_pendientes": ["información que falta para confirmar elegibilidad"],
  "documentos_a_verificar": ["documento específico de esta convocatoria a preparar"],
  "pasos_siguientes": ["paso concreto y accionable"]
}

CRITERIOS:
- "elegible": Todos los hard_requirement cumplidos, confianza >= 0.70, sin bloqueantes, sin riesgos altos
- "revisar": Algún cumple=null en hard_requirement, riesgos medios/altos, info insuficiente
- "no_elegible": Algún hard_requirement con cumple=false, o bloqueante confirmado

IMPORTANTE: Si hay cumple=null en un requisito obligatorio → veredicto mínimo "revisar", nunca "elegible".`;
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
          generationConfig: { temperature: 0.1, maxOutputTokens: 3000 },
        }),
        signal: AbortSignal.timeout(35_000),
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
      max_tokens: 3000,
    }),
    signal: AbortSignal.timeout(35_000),
  });
  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? '';
}

// ─── Parser ───────────────────────────────────────────────────────────────────

function fallback(modelo: string, motivo: string): ResultadoFase2 {
  return {
    veredicto: 'revisar',
    confianza: 0.2,
    motivo_principal: motivo,
    evidencias: [],
    bloqueantes: [],
    riesgos: [{ nivel: 'medio', descripcion: 'Validación automática no disponible', mitigacion: 'Revisión manual por gestor' }],
    puntos_pendientes: ['Revisión manual de requisitos requerida'],
    documentos_a_verificar: [],
    pasos_siguientes: ['El gestor revisará manualmente la elegibilidad'],
    requiere_revision_manual: true,
    version_motor: VERSION_MOTOR,
    version_prompt: VERSION_PROMPT,
    validated_at: new Date().toISOString(),
    modelo_usado: modelo,
  };
}

function parsearResultado(raw: string, modelo: string): ResultadoFase2 {
  if (!raw) return fallback(modelo, 'La IA no devolvió respuesta');

  try {
    const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    const candidate = (fence ? fence[1] : raw).trim();
    const jsonMatch = candidate.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallback(modelo, 'No se pudo parsear el resultado de la IA');

    const p = JSON.parse(jsonMatch[0]);
    const veredictos = ['elegible', 'revisar', 'no_elegible'];
    if (!veredictos.includes(p.veredicto)) return fallback(modelo, 'Veredicto inválido devuelto por la IA');

    // Si hay cumple=null en un hard_requirement → mínimo "revisar"
    const evidencias: EvidenciaRequisito[] = Array.isArray(p.evidencias)
      ? p.evidencias.map((e: Record<string, unknown>) => ({
          requisito: String(e.requisito ?? ''),
          cumple: e.cumple === true ? true : e.cumple === false ? false : null,
          tipo: ['hard_requirement', 'soft_requirement', 'documentacion', 'recomendacion'].includes(String(e.tipo))
            ? e.tipo as EvidenciaRequisito['tipo'] : 'soft_requirement',
          justificacion: String(e.justificacion ?? ''),
          fuentes: Array.isArray(e.fuentes)
            ? (e.fuentes as Array<Record<string, unknown>>).map(f => ({
                texto: String(f.texto ?? ''),
                pagina: typeof f.pagina === 'number' ? f.pagina : null,
              }))
            : [],
        }))
      : [];

    const tieneNullEnHard = evidencias.some(e => e.tipo === 'hard_requirement' && e.cumple === null);
    const veredictoFinal: VeredictoFase2 =
      tieneNullEnHard && p.veredicto === 'elegible' ? 'revisar' : p.veredicto;

    return {
      veredicto: veredictoFinal,
      confianza: typeof p.confianza === 'number' ? Math.max(0, Math.min(1, p.confianza)) : 0.5,
      motivo_principal: typeof p.motivo_principal === 'string' ? p.motivo_principal : 'Ver evidencias',
      evidencias,
      bloqueantes: Array.isArray(p.bloqueantes)
        ? p.bloqueantes.map((b: Record<string, unknown>) => ({
            requisito: String(b.requisito ?? ''),
            motivo: String(b.motivo ?? ''),
            fuente: b.fuente ? String(b.fuente) : undefined,
          }))
        : [],
      riesgos: Array.isArray(p.riesgos)
        ? p.riesgos.map((r: Record<string, unknown>) => ({
            nivel: ['bajo', 'medio', 'alto'].includes(String(r.nivel)) ? r.nivel as RiesgoFase2['nivel'] : 'medio',
            descripcion: String(r.descripcion ?? ''),
            mitigacion: r.mitigacion ? String(r.mitigacion) : undefined,
          }))
        : [],
      puntos_pendientes: Array.isArray(p.puntos_pendientes) ? p.puntos_pendientes.map(String) : [],
      documentos_a_verificar: Array.isArray(p.documentos_a_verificar) ? p.documentos_a_verificar.map(String) : [],
      pasos_siguientes: Array.isArray(p.pasos_siguientes) ? p.pasos_siguientes.map(String) : [],
      requiere_revision_manual: !!p.requiere_revision_manual || veredictoFinal === 'revisar',
      version_motor: VERSION_MOTOR,
      version_prompt: VERSION_PROMPT,
      validated_at: new Date().toISOString(),
      modelo_usado: modelo,
    };
  } catch {
    return fallback(modelo, 'Error parseando resultado de la IA');
  }
}

// ─── Función principal ────────────────────────────────────────────────────────

/**
 * Ejecuta la validación profunda Fase 2.
 *
 * Orden de ejecución:
 *   1. Hard checks deterministas (sin IA) → resultado inmediato si bloquea
 *   2. Si pasa hard checks → llama a IA con las 4 fuentes de datos
 *   3. Parsea y valida el resultado
 *   4. Aplica regla de seguridad: null en hard_requirement → mínimo "revisar"
 */
export async function validarElegibilidadFase2(input: InputFase2): Promise<ResultadoFase2> {
  const modelo = input.iaProvider.provider === 'google'
    ? 'gemini-2.0-flash'
    : input.iaProvider.provider === 'anthropic'
    ? 'claude-haiku-4-5-20251001'
    : 'gpt-4o-mini';

  // 1. Hard checks deterministas
  const hardCheck = runHardChecks(input);
  if (hardCheck.bloqueado && hardCheck.bloqueante) {
    return {
      veredicto: 'no_elegible',
      confianza: 0.97,
      motivo_principal: hardCheck.bloqueante.motivo,
      evidencias: [{
        requisito: hardCheck.bloqueante.requisito,
        cumple: false,
        tipo: 'hard_requirement',
        justificacion: hardCheck.bloqueante.motivo,
        fuentes: [{ texto: hardCheck.bloqueante.fuente ?? 'Validación automática' }],
      }],
      bloqueantes: [hardCheck.bloqueante],
      riesgos: [],
      puntos_pendientes: [],
      documentos_a_verificar: [],
      pasos_siguientes: ['Esta convocatoria no aplica para tu empresa. El gestor puede orientarte hacia otras opciones.'],
      requiere_revision_manual: false,
      version_motor: VERSION_MOTOR,
      version_prompt: VERSION_PROMPT,
      validated_at: new Date().toISOString(),
      modelo_usado: 'determinista',
    };
  }

  // 2. Validación profunda con IA
  const prompt = buildPrompt(input);
  const raw = await llamarIA(
    prompt,
    input.iaProvider.provider,
    input.iaProvider.api_key,
    input.iaProvider.base_url,
  ).catch(() => '');

  return parsearResultado(raw, modelo);
}
