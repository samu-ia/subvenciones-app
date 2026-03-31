/**
 * lib/matching/engine.ts
 *
 * Motor de matching DETERMINISTA cliente <-> subvención — v2.
 * No usa IA. Calcula un score 0-100 basado en reglas explícitas.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * v2: Usa campos_extraidos (JSONB del PDF) cuando están disponibles.
 *     Si campos_extraidos está vacío, usa los campos legacy (sectores_actividad,
 *     regiones, tipos_empresa).
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * HARD EXCLUDES (score = 0 automáticamente):
 *   1. Subvención cerrada/suspendida o plazo vencido
 *   2. Empresa no está en localización de la subvención (geografía)
 *   3. CNAE del cliente en cnae_excluidos de la subvención
 *   4. Tipo de empresa del cliente excluido explícitamente
 *   5. Empresa supera tamaño máximo de empleados (extraído de requisitos)
 *   6. Empresa no cumple antigüedad mínima (extraído de requisitos)
 *
 * SOFT SCORES (suman puntos, total 100):
 *   · CNAE incluidos        (40 pts) — CNAE del cliente en sectores permitidos
 *   · Tipo empresa          (30 pts) — tipo del cliente en beneficiarios_tipo
 *   · Importe               (20 pts) — importe razonable para tamaño de empresa
 *   · Gastos subvencionables(10 pts) — gastos coinciden con actividad empresa
 *
 * LEGACY (sin campos_extraidos) usa las 5 dimensiones originales:
 *   · Geografía (30) + Tipo empresa (25) + Sector CNAE (20) + Estado (15) + Importe (10)
 */

// ─── Tipos de entrada ─────────────────────────────────────────────────────────

export interface ClienteMatchProfile {
  nif: string;
  nombre_empresa?: string;
  cnae_codigo?: string;                // '6201', '4711', etc.
  cnae_descripcion?: string;
  comunidad_autonoma?: string;         // 'Madrid', 'Cataluña', 'Andalucía', etc.
  provincia?: string;
  ciudad?: string;
  tamano_empresa?: string;             // 'Micropyme', 'Pequeña', 'Mediana', 'Grande'
  forma_juridica?: string;             // 'SL', 'SA', 'autonomo', 'cooperativa', 'asociacion'
  num_empleados?: number;
  facturacion_anual?: number;          // en euros
  anos_antiguedad?: number;
}

export interface SubvencionMatchProfile {
  id: string;
  bdns_id: string;
  titulo: string;
  organismo?: string;
  ambito_geografico?: string;          // 'nacional', 'autonomico', 'local'
  comunidad_autonoma?: string;
  provincia?: string;
  estado_convocatoria: string;
  importe_maximo?: number;
  importe_minimo?: number;
  presupuesto_total?: number;
  plazo_fin?: string;
  // Tablas relacionadas (legacy + v2)
  sectores?: Array<{ cnae_codigo?: string; nombre_sector: string; excluido: boolean }>;
  tipos_empresa?: Array<{ tipo: string; excluido: boolean; descripcion?: string }>;
  requisitos?: Array<{ tipo: string; descripcion: string; obligatorio: boolean }>;
  // Campos v2 (del enriquecimiento IA / campos_extraidos)
  gastos?: Array<{ categoria: string; descripcion: string; porcentaje_max?: number }>;
  beneficiarios_texto?: string[];      // array de textos libres tipo ["Pymes", "Autónomos"]
  para_quien?: string;                 // frase resumen de beneficiarios
  ia_confidence?: number;              // 0-1 confianza de la extracción IA
  // JSONB del pipeline PDF real (15 campos estructurados)
  campos_extraidos?: Record<string, unknown> | null;
  // Internos calculados por enriquecerConCamposExtraidos
  _sectores_todos?: boolean;
  _localizacion_ce?: string[];
}

export interface MatchScoreDetalle {
  // v2 dimensions (cuando hay campos_extraidos)
  cnae: number;                        // 0-40
  tipo_empresa: number;                // 0-30
  importe: number;                     // 0-20
  gastos: number;                      // 0-10
  // Legacy dimensions (cuando NO hay campos_extraidos)
  geografia: number;                   // 0-30
  sector: number;                      // 0-20
  estado: number;                      // 0-15
}

export interface MatchScore {
  score: number;                       // 0-1 normalizado
  score_raw: number;                   // 0-100 puntos brutos
  hard_exclude: boolean;
  hard_exclude_razon?: string;
  razon_exclusion?: string;            // razón legible cuando score=0
  detalle: MatchScoreDetalle;
  motivos: string[];                   // frases positivas para mostrar al cliente
  alertas: string[];                   // posibles incompatibilidades
  version: 'v1' | 'v2' | 'v3';        // v3 = motor unificado con geoBonus + campos_extraidos
}

// ─── Mapas de normalización ───────────────────────────────────────────────────

const CA_ALIAS: Record<string, string[]> = {
  'Madrid':           ['madrid', 'comunidad de madrid', 'com. de madrid'],
  'Cataluña':         ['cataluña', 'cataluna', 'catalunya', 'catalonia'],
  'Andalucía':        ['andalucía', 'andalucia'],
  'Valencia':         ['valencia', 'comunitat valenciana', 'comunidad valenciana'],
  'Galicia':          ['galicia'],
  'Castilla y León':  ['castilla y leon', 'castilla y león'],
  'Castilla-La Mancha': ['castilla-la mancha', 'castilla la mancha'],
  'País Vasco':       ['país vasco', 'pais vasco', 'euskadi'],
  'Canarias':         ['canarias'],
  'Murcia':           ['murcia', 'región de murcia', 'region de murcia'],
  'Aragón':           ['aragón', 'aragon'],
  'Extremadura':      ['extremadura'],
  'Asturias':         ['asturias'],
  'Baleares':         ['baleares', 'illes balears', 'islas baleares'],
  'Navarra':          ['navarra'],
  'Cantabria':        ['cantabria'],
  'La Rioja':         ['la rioja', 'rioja'],
  'Ceuta':            ['ceuta'],
  'Melilla':          ['melilla'],
};

export function normCA(s?: string): string {
  if (!s) return '';
  const lower = s.toLowerCase().trim();
  for (const [key, aliases] of Object.entries(CA_ALIAS)) {
    if (aliases.some(a => lower.includes(a))) return key;
  }
  return s;
}

// Mapa tamaño → tipos compatibles
const TAMANO_A_TIPO: Record<string, string[]> = {
  'micropyme':  ['micropyme', 'pyme', 'autonomo'],
  'microempresa': ['micropyme', 'pyme'],
  'pequeña':    ['pequeña', 'pyme'],
  'mediana':    ['pyme'],
  'pyme':       ['pyme', 'micropyme'],
  'grande':     ['grande'],
  'autónomo':   ['autonomo'],
  'autonomo':   ['autonomo'],
  'sl':         ['pyme', 'micropyme'],
  'sa':         ['pyme', 'grande'],
  'cooperativa':['otro'],
  'asociacion': ['otro'],
};

export function tiposCliente(cliente: ClienteMatchProfile): string[] {
  const tipos = new Set<string>();

  const tamano = (cliente.tamano_empresa ?? '').toLowerCase();
  const forma = (cliente.forma_juridica ?? '').toLowerCase();

  // Por tamaño
  const emp = cliente.num_empleados ?? 0;
  const fac = cliente.facturacion_anual ?? 0;
  if (emp <= 10 && fac <= 2_000_000) tipos.add('micropyme');
  if (emp <= 50 && fac <= 10_000_000) tipos.add('pequeña');
  if (emp <= 250 && fac <= 50_000_000) tipos.add('pyme');
  if (emp > 250 || fac > 50_000_000) tipos.add('grande');

  // Por forma jurídica
  if (forma.includes('autón') || forma === 'autonomo') tipos.add('autonomo');
  if (forma.includes('startup') || (cliente.anos_antiguedad ?? 99) <= 5) tipos.add('startup');
  if (forma.includes('cooperat') || forma.includes('asocia') || forma.includes('fundac')) tipos.add('otro');

  // Por campo tamano_empresa
  for (const [key, vals] of Object.entries(TAMANO_A_TIPO)) {
    if (tamano.includes(key)) vals.forEach(v => tipos.add(v));
  }

  if (tipos.size === 0) tipos.add('pyme'); // default
  return [...tipos];
}

// ─── Utilidades ──────────────────────────────────────────────────────────────

function fmtImporte(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M€`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K€`;
  return `${n}€`;
}

const DETALLE_ZERO: MatchScoreDetalle = {
  cnae: 0, tipo_empresa: 0, importe: 0, gastos: 0,
  geografia: 0, sector: 0, estado: 0,
};

function hardExclude(razon: string, version: 'v1' | 'v2'): MatchScore {
  return {
    score: 0,
    score_raw: 0,
    hard_exclude: true,
    hard_exclude_razon: razon,
    razon_exclusion: razon,
    detalle: { ...DETALLE_ZERO },
    motivos: [],
    alertas: [razon],
    version,
  };
}

// ─── Detectar si la subvención tiene datos v2 ────────────────────────────────

function tieneDataV2(subvencion: SubvencionMatchProfile): boolean {
  return !!(
    (subvencion.requisitos && subvencion.requisitos.length > 0) ||
    (subvencion.gastos && subvencion.gastos.length > 0) ||
    (subvencion.beneficiarios_texto && subvencion.beneficiarios_texto.length > 0) ||
    subvencion.para_quien ||
    subvencion.campos_extraidos
  );
}

/**
 * Enriquece el perfil de la subvención con datos de campos_extraidos (pipeline PDF).
 * Fusiona cnae_incluidos/excluidos → sectores, beneficiarios_tipo → tipos_empresa,
 * gastos_subvencionables → gastos, y extrae localizacion para geo checks.
 */
function enriquecerConCamposExtraidos(subvencion: SubvencionMatchProfile): SubvencionMatchProfile {
  const ce = subvencion.campos_extraidos;
  if (!ce) return subvencion;

  const enriq = { ...subvencion };

  // Sectores desde cnae_incluidos / cnae_excluidos
  const sectoresActuales = [...(enriq.sectores ?? [])];
  if (ce.cnae_incluidos === 'todos') {
    enriq._sectores_todos = true;
  } else if (Array.isArray(ce.cnae_incluidos)) {
    const cnaesYa = new Set(sectoresActuales.filter(s => !s.excluido).map(s => (s.cnae_codigo ?? '').slice(0, 4)));
    for (const cnae of ce.cnae_incluidos as string[]) {
      const c4 = String(cnae).slice(0, 4);
      if (!cnaesYa.has(c4)) sectoresActuales.push({ cnae_codigo: c4, nombre_sector: '', excluido: false });
    }
  }
  if (Array.isArray(ce.cnae_excluidos)) {
    const cnaesExclYa = new Set(sectoresActuales.filter(s => s.excluido).map(s => (s.cnae_codigo ?? '').slice(0, 4)));
    for (const cnae of ce.cnae_excluidos as string[]) {
      const c4 = String(cnae).slice(0, 4);
      if (!cnaesExclYa.has(c4)) sectoresActuales.push({ cnae_codigo: c4, nombre_sector: '', excluido: true });
    }
  }
  enriq.sectores = sectoresActuales;

  // Tipo empresa desde tipos_beneficiario_api (API oficial BDNS — más fiable que PDF)
  if (Array.isArray(ce.tipos_beneficiario_api) && !(enriq.tipos_empresa?.length)) {
    const tiposApi = ce.tipos_beneficiario_api as string[];
    const tipos: Array<{ tipo: string; excluido: boolean }> = [];
    for (const t of tiposApi) {
      const tu = t.toUpperCase();
      if (tu.includes('PYME') || tu.includes('PERSONAS FÍSICAS QUE DESARROLLAN')) {
        tipos.push({ tipo: 'pyme', excluido: false });
        tipos.push({ tipo: 'autonomo', excluido: false });
      } else if (tu.includes('GRAN EMPRESA')) {
        tipos.push({ tipo: 'grande', excluido: false });
      } else if (tu.includes('PERSONAS JURÍDICAS QUE NO DESARROLLAN')) {
        tipos.push({ tipo: 'asociacion', excluido: false });
      }
      // SIN INFORMACION ESPECIFICA (id=5) → no añadir restricción
    }
    if (tipos.length) enriq.tipos_empresa = tipos;
  } else if (ce.beneficiarios_tipo && !(enriq.tipos_empresa?.length)) {
    // Fallback: beneficiarios_tipo del PDF
    const TIPO_MAP: Record<string, string> = {
      'autónomos': 'autonomo', 'autonomos': 'autonomo', 'autónomo': 'autonomo',
      'micropyme': 'micropyme', 'microempresa': 'micropyme',
      'pyme': 'pyme', 'pequeña': 'pyme', 'mediana': 'pyme',
      'gran_empresa': 'grande', 'grande': 'grande',
    };
    const tipo = TIPO_MAP[(ce.beneficiarios_tipo as string).toLowerCase()] ?? 'pyme';
    enriq.tipos_empresa = [{ tipo, excluido: false }];
  }

  // Gastos subvencionables
  if (Array.isArray(ce.gastos_subvencionables) && (ce.gastos_subvencionables as unknown[]).length > 0 && !(enriq.gastos?.length)) {
    enriq.gastos = (ce.gastos_subvencionables as string[]).map(g => ({ categoria: g, descripcion: g, porcentaje_max: undefined }));
  }

  // Requisitos de tamaño / antigüedad (añade si no ya presentes)
  const requisitosExtra = [...(enriq.requisitos ?? [])];
  if (ce.tamano_max_empleados && !requisitosExtra.some(r => /empleados?/i.test(r.descripcion))) {
    requisitosExtra.push({ tipo: 'empresa', descripcion: `Máximo ${ce.tamano_max_empleados} empleados`, obligatorio: true });
  }
  if (ce.antiguedad_min_anos && !requisitosExtra.some(r => /antigüedad|antiguedad/i.test(r.descripcion))) {
    requisitosExtra.push({ tipo: 'empresa', descripcion: `Antigüedad mínima de ${ce.antiguedad_min_anos} años`, obligatorio: true });
  }
  enriq.requisitos = requisitosExtra;

  // Localización desde campos_extraidos
  if (Array.isArray(ce.localizacion) && (ce.localizacion as unknown[]).length > 0) {
    enriq._localizacion_ce = ce.localizacion as string[];
  }

  return enriq;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HARD EXCLUDES — comunes a v1 y v2
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Evalúa los hard excludes comunes. Devuelve string con razón si se excluye,
 * o null si pasa todos los filtros.
 */
function evaluarHardExcludes(
  cliente: ClienteMatchProfile,
  subvencion: SubvencionMatchProfile,
): string | null {
  // 1. Convocatoria cerrada o suspendida
  if (subvencion.estado_convocatoria === 'cerrada') {
    return 'Convocatoria cerrada.';
  }
  if (subvencion.estado_convocatoria === 'suspendida') {
    return 'Convocatoria suspendida.';
  }

  // 2. Plazo vencido
  if (subvencion.plazo_fin) {
    const diasCierre = Math.ceil(
      (new Date(subvencion.plazo_fin).getTime() - Date.now()) / 86_400_000,
    );
    if (diasCierre < 0) {
      return 'El plazo de presentación ha vencido.';
    }
  }

  // 3. Exclusión geográfica (empresa no está en localización)
  const ambito = subvencion.ambito_geografico ?? 'desconocido';
  const clienteCA = normCA(cliente.comunidad_autonoma);
  const subvCA = normCA(subvencion.comunidad_autonoma);
  const subvProv = (subvencion.provincia ?? '').toLowerCase();
  const clienteProv = (cliente.provincia ?? '').toLowerCase();

  if (ambito === 'autonomico') {
    if (clienteCA && subvCA && clienteCA !== subvCA) {
      return `Esta convocatoria es solo para ${subvCA} y tu empresa está en ${clienteCA}.`;
    }
  } else if (ambito === 'local') {
    if (subvProv && clienteProv && !subvProv.includes(clienteProv.slice(0, 5))) {
      return `Convocatoria local para ${subvProv}, tu empresa está en ${clienteProv || 'otra provincia'}.`;
    }
    if (!subvProv && subvCA && clienteCA && subvCA !== clienteCA) {
      return `Convocatoria local para ${subvCA}, tu empresa está en ${clienteCA}.`;
    }
  }

  // 4. CNAE del cliente en cnae_excluidos
  if (subvencion.sectores?.length) {
    const clienteCnae = (cliente.cnae_codigo ?? '').slice(0, 4);
    const excluidos = subvencion.sectores.filter(s => s.excluido);
    for (const exc of excluidos) {
      const cnaeExc = (exc.cnae_codigo ?? '').slice(0, 4);
      if (cnaeExc && clienteCnae && (clienteCnae === cnaeExc || clienteCnae.startsWith(cnaeExc))) {
        return `Tu sector (CNAE ${clienteCnae}) está excluido en esta convocatoria.`;
      }
    }
  }

  // 5. Tipo de empresa excluido
  if (subvencion.tipos_empresa?.length) {
    const tiposClienteList = tiposCliente(cliente);
    const excluidos = subvencion.tipos_empresa.filter(t => t.excluido);
    for (const exc of excluidos) {
      if (tiposClienteList.includes(exc.tipo)) {
        return `Tu tipo de empresa (${exc.tipo}) está excluido.`;
      }
    }
  }

  // 6. Tamaño máximo de empleados (directo de campos_extraidos o regex de requisitos)
  const ce = subvencion.campos_extraidos;
  const limiteEmpleados =
    (ce?.tamano_max_empleados as number | null | undefined) ??
    extraerLimiteEmpleados(subvencion.requisitos);
  if (limiteEmpleados !== null && cliente.num_empleados != null) {
    if (cliente.num_empleados > limiteEmpleados) {
      return `Tu empresa tiene ${cliente.num_empleados} empleados pero el máximo es ${limiteEmpleados}.`;
    }
  }

  // 7. Antigüedad mínima (directo de campos_extraidos o regex de requisitos)
  const antiguedadMin =
    (ce?.antiguedad_min_anos as number | null | undefined) ??
    extraerAntiguedadMinima(subvencion.requisitos);
  if (antiguedadMin !== null && cliente.anos_antiguedad != null) {
    if (cliente.anos_antiguedad < antiguedadMin) {
      return `Tu empresa tiene ${cliente.anos_antiguedad} años de antigüedad pero se requieren al menos ${antiguedadMin}.`;
    }
  }

  // 8. Localización de campos_extraidos — solo si TAMBIÉN ambito='autonomico'
  // (datos IA del PDF pueden tener errores; no excluir solo por este campo)
  if (subvencion._localizacion_ce?.length && ambito === 'autonomico' && clienteCA) {
    const esNacional = subvencion._localizacion_ce.some(l => /nacional|estatal/i.test(l));
    if (!esNacional) {
      const locNorm = subvencion._localizacion_ce.map(l => normCA(l));
      if (locNorm.some(l => l) && !locNorm.some(l => l === clienteCA)) {
        return `Convocatoria para ${subvencion._localizacion_ce.join(', ')}, tu empresa está en ${clienteCA}.`;
      }
    }
  }

  return null; // No excluida
}

// ═══════════════════════════════════════════════════════════════════════════════
// PARSERS de requisitos → límites numéricos
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Busca en requisitos un límite de empleados.
 * Patrones: "máximo 250 empleados", "hasta 50 trabajadores", "menos de 10 empleados"
 */
function extraerLimiteEmpleados(
  requisitos?: Array<{ tipo: string; descripcion: string; obligatorio: boolean }>,
): number | null {
  if (!requisitos?.length) return null;
  for (const req of requisitos) {
    const desc = req.descripcion.toLowerCase();
    // Patrones: "máximo/hasta/menos de X empleados/trabajadores/personas"
    const match = desc.match(
      /(?:máximo|maximo|hasta|menos\s+de|no\s+(?:más|mas)\s+de|no\s+superar?)\s*(?:de\s+)?(\d+)\s*(?:empleados?|trabajador(?:es|as)?|personas?\s+emplead)/,
    );
    if (match) return parseInt(match[1], 10);

    // Patrón "X empleados como máximo"
    const match2 = desc.match(
      /(\d+)\s*(?:empleados?|trabajador(?:es|as)?)\s*(?:como\s+)?(?:máximo|maximo|o\s+menos)/,
    );
    if (match2) return parseInt(match2[1], 10);

    // Clasificaciones EU estándar
    if (desc.includes('micropyme') || desc.includes('microempresa')) {
      if (!desc.includes('pyme') || desc.includes('micro')) return 10;
    }
    if (desc.includes('pequeña empresa') && !desc.includes('mediana')) return 50;
  }
  return null;
}

/**
 * Busca en requisitos una antigüedad mínima.
 * Patrones: "antigüedad mínima de 2 años", "al menos 3 años de actividad"
 */
function extraerAntiguedadMinima(
  requisitos?: Array<{ tipo: string; descripcion: string; obligatorio: boolean }>,
): number | null {
  if (!requisitos?.length) return null;
  for (const req of requisitos) {
    const desc = req.descripcion.toLowerCase();
    // Patrones: "antigüedad mínima/mínimo de X años"
    const match = desc.match(
      /(?:antigüedad|antiguedad|actividad)\s*(?:mínima?|minima?|de\s+al\s+menos)\s*(?:de\s+)?(\d+)\s*años?/,
    );
    if (match) return parseInt(match[1], 10);

    // Patrón "al menos X años de antigüedad/actividad"
    const match2 = desc.match(
      /(?:al\s+menos|mínimo|minimo|como\s+mínimo)\s+(\d+)\s*años?\s*(?:de\s+)?(?:antigüedad|antiguedad|actividad|constitución|constitucion)/,
    );
    if (match2) return parseInt(match2[1], 10);

    // Patrón "constituida hace más de X años"
    const match3 = desc.match(
      /(?:constituida?|creada?|inscrita?)\s*(?:hace|con)\s*(?:más|mas)\s*de\s*(\d+)\s*años?/,
    );
    if (match3) return parseInt(match3[1], 10);
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MOTOR v2 — scoring basado en campos_extraidos del PDF
// ═══════════════════════════════════════════════════════════════════════════════

function calcularMatchV2(
  cliente: ClienteMatchProfile,
  subvencion: SubvencionMatchProfile,
): MatchScore {
  const motivos: string[] = [];
  const alertas: string[] = [];

  // ── HARD EXCLUDES ─────────────────────────────────────────────────────────
  const hardRazon = evaluarHardExcludes(cliente, subvencion);
  if (hardRazon) return hardExclude(hardRazon, 'v2');

  // ── Alerta de plazo corto (no es hard exclude, pero avisa) ────────────────
  if (subvencion.plazo_fin) {
    const diasCierre = Math.ceil(
      (new Date(subvencion.plazo_fin).getTime() - Date.now()) / 86_400_000,
    );
    if (diasCierre <= 15 && diasCierre >= 0) {
      alertas.push(`Quedan solo ${diasCierre} días para el cierre del plazo`);
    }
  }

  // ── GEO BONUS (0-15 pts) — bonus por coincidencia CA cuando supera hard exclude ─
  let geoBonus = 0;
  const ambitoGeo = subvencion.ambito_geografico ?? 'desconocido';
  const clienteCA = normCA(cliente.comunidad_autonoma);
  const subvCA = normCA(subvencion.comunidad_autonoma);
  const locCE = subvencion._localizacion_ce ?? [];
  const esNacionalGeo = ambitoGeo === 'nacional' || locCE.some(l => /nacional|estatal/i.test(l));

  if (!esNacionalGeo && clienteCA) {
    if (ambitoGeo === 'autonomico') {
      const locNorm = locCE.map(l => normCA(l));
      const coincide = (subvCA && subvCA === clienteCA) || locNorm.some(l => l === clienteCA);
      if (coincide) { geoBonus = 15; motivos.push(`Convocatoria de tu comunidad (${clienteCA})`); }
    } else if (ambitoGeo === 'local') {
      geoBonus = 5; // pasó el hard exclude de provincia, bonus pequeño
    }
  }

  // ── SOFT SCORE 1: CNAE incluidos (0-40 pts) ──────────────────────────────
  let cnae = 0;
  const clienteCnae = (cliente.cnae_codigo ?? '').slice(0, 4);
  const clienteCnae2 = clienteCnae.slice(0, 2);
  const clienteDesc = (cliente.cnae_descripcion ?? '').toLowerCase();
  let sectorMismatch = false;
  let confirmedCnaeMismatch = false;

  if (!subvencion.sectores?.length) {
    cnae = 25; // sin restricción de sector → genérica, puntuación parcial
    motivos.push('Convocatoria abierta a todos los sectores');
  } else {
    const permitidos = subvencion.sectores.filter(s => !s.excluido);
    if (!permitidos.length) {
      cnae = 25; // solo hay excluidos, sin incluidos → genérica
    } else {
      const exactMatch = permitidos.some(
        s => s.cnae_codigo?.slice(0, 4) === clienteCnae && clienteCnae,
      );
      const divMatch = permitidos.some(
        s => s.cnae_codigo?.slice(0, 2) === clienteCnae2 && clienteCnae2,
      );
      const permitidosConCnae = permitidos.filter(s => s.cnae_codigo);

      // Keyword bidireccional: solo cuando los sectores NO tienen CNAE
      const STOP = new Set([
        'actividades', 'actividad', 'empresa', 'empresas',
        'servicio', 'servicios', 'sector', 'sectores',
      ]);
      const keyword = permitidosConCnae.length === 0 && permitidos.some(s => {
        if (!s.nombre_sector) return false;
        const sectorLower = s.nombre_sector.toLowerCase();
        const sectorEnCliente = sectorLower.split(/\s+/)
          .some(w => w.length > 5 && !STOP.has(w) && clienteDesc.includes(w));
        const clienteEnSector = clienteDesc.split(/\s+/)
          .some(w => w.length > 5 && !STOP.has(w) && sectorLower.includes(w));
        return sectorEnCliente || clienteEnSector;
      });

      if (exactMatch) {
        cnae = 40;
        motivos.push(`Tu sector CNAE ${clienteCnae} encaja directamente con la convocatoria`);
      } else if (divMatch) {
        cnae = 28;
        motivos.push('Tu sector está dentro del ámbito de la convocatoria');
      } else if (keyword) {
        cnae = 28;
        motivos.push('Tu actividad está relacionada con los sectores de la convocatoria');
      } else {
        cnae = 0;
        sectorMismatch = true;
        // Mismatch confirmado por CNAE explícito o sector primario exclusivo
        const EXCLUSIVE = [
          'agricultur', 'ganadería', 'ganaderia', 'silvicultur', 'forestal',
          'pesca', 'acuicultur', 'minería', 'mineria', 'alimentación',
          'alimentacion', 'agroaliment',
        ];
        const CNAE_PRIMARIO = ['01', '02', '03', '05', '06', '07', '08', '09', '10', '11', '12'];
        const esExclusivo = permitidos.some(s =>
          EXCLUSIVE.some(ex => (s.nombre_sector ?? '').toLowerCase().includes(ex)),
        );
        const clienteEsPrimario = clienteCnae2 && CNAE_PRIMARIO.includes(clienteCnae2);
        if (permitidosConCnae.length > 0 || (esExclusivo && !clienteEsPrimario)) {
          confirmedCnaeMismatch = true;
        }
        alertas.push(
          `La convocatoria está orientada a sectores distintos al tuyo (${clienteDesc || `CNAE ${clienteCnae}`})`,
        );
      }
    }
  }

  // ── SOFT SCORE 2: Tipo empresa / beneficiarios (0-30 pts) ─────────────────
  let tipo_empresa = 0;
  const tiposClienteList = tiposCliente(cliente);

  // Primero: match por tipos_empresa estructurado (más preciso)
  if (subvencion.tipos_empresa?.length) {
    const permitidos = subvencion.tipos_empresa.filter(t => !t.excluido);
    const match = permitidos.filter(t => tiposClienteList.includes(t.tipo));
    if (match.length > 0) {
      tipo_empresa = 30;
      motivos.push(`Tu tipo de empresa (${tiposClienteList.join('/')}) encaja con los beneficiarios`);
    } else if (permitidos.length === 0) {
      tipo_empresa = 22; // sin permitidos explícitos → genérica
    } else {
      tipo_empresa = 5;
      alertas.push(`La subvención está orientada a: ${permitidos.map(t => t.tipo).join(', ')}`);
    }
  } else if (subvencion.beneficiarios_texto?.length || subvencion.para_quien) {
    // Fallback: match por texto libre de beneficiarios
    tipo_empresa = matchBeneficiariosTexto(tiposClienteList, cliente, subvencion);
    if (tipo_empresa >= 20) {
      motivos.push('Tu perfil de empresa encaja con los beneficiarios de la convocatoria');
    }
  } else {
    tipo_empresa = 22; // sin restricción de tipo → genérica
    motivos.push('Sin restricción de tipo de empresa');
  }

  // ── SOFT SCORE 3: Importe razonable (0-20 pts) ────────────────────────────
  let importe = 0;
  const maxSubv = subvencion.importe_maximo ?? subvencion.presupuesto_total;
  const fac = cliente.facturacion_anual ?? 0;

  if (!maxSubv) {
    importe = 10; // sin dato de importe → puntuación parcial
  } else if (fac <= 0) {
    importe = 10; // sin facturación del cliente → parcial
  } else {
    const ratio = maxSubv / fac;
    if (ratio >= 0.02 && ratio <= 2) {
      importe = 20;
      if (maxSubv >= 50_000) {
        motivos.push(`Importe potencial de hasta ${fmtImporte(maxSubv)} para tu empresa`);
      }
    } else if (ratio < 0.02) {
      importe = 8;
      alertas.push('El importe es pequeño en relación a tu facturación');
    } else {
      importe = 14; // importe alto → posiblemente aplica a proyectos grandes
    }
  }

  // ── SOFT SCORE 4: Gastos subvencionables (0-10 pts) ───────────────────────
  let gastos = 0;
  if (subvencion.gastos?.length) {
    gastos = matchGastosConActividad(cliente, subvencion.gastos);
    if (gastos >= 7) {
      motivos.push('Los gastos subvencionables encajan con tu tipo de actividad');
    }
  } else {
    gastos = 5; // sin datos de gastos → puntuación parcial
  }

  // ── Bonus por convocatoria abierta ────────────────────────────────────────
  if (subvencion.estado_convocatoria === 'abierta') {
    motivos.push('Convocatoria actualmente abierta');
  } else if (subvencion.estado_convocatoria === 'proxima') {
    motivos.push('Convocatoria próxima — podrás presentarla pronto');
  } else if (subvencion.estado_convocatoria === 'resuelta') {
    alertas.push('Convocatoria ya resuelta — posiblemente habrá nueva edición');
  }

  // ── SCORE FINAL ────────────────────────────────────────────────────────────
  const detalle: MatchScoreDetalle = {
    cnae,
    tipo_empresa,
    importe,
    gastos,
    geografia: geoBonus, // geo bonus ahora en campo geografia
    sector: 0,
    estado: 0,
  };

  let score_raw = cnae + tipo_empresa + importe + gastos + geoBonus;

  // Cap por sector mismatch
  if (confirmedCnaeMismatch) {
    score_raw = Math.min(score_raw, 35);
  } else if (sectorMismatch) {
    score_raw = Math.min(score_raw, 50);
  }

  // Normalizar sobre 115 (100 base + 15 geo bonus máximo)
  const score = Math.min(1, score_raw / 115);

  return {
    score: Math.round(score * 100) / 100,
    score_raw,
    hard_exclude: false,
    detalle,
    motivos,
    alertas,
    version: 'v3',
  };
}

// ─── Match beneficiarios por texto libre ────────────────────────────────────

/** Palabras clave que mapean a tipos de empresa */
const BENEFICIARIO_KEYWORDS: Record<string, string[]> = {
  'pyme':       ['pyme', 'pymes', 'pequeña', 'mediana', 'pequeñas', 'medianas'],
  'micropyme':  ['micropyme', 'micropymes', 'microempresa', 'microempresas'],
  'autonomo':   ['autónomo', 'autónomos', 'autonomo', 'autonomos', 'trabajador por cuenta propia'],
  'grande':     ['gran empresa', 'grandes empresas'],
  'startup':    ['startup', 'startups', 'empresa emergente', 'emprendedor', 'emprendedores', 'nueva empresa'],
  'otro':       ['cooperativa', 'asociación', 'asociacion', 'fundación', 'fundacion', 'entidad sin ánimo'],
};

function matchBeneficiariosTexto(
  tiposClienteList: string[],
  cliente: ClienteMatchProfile,
  subvencion: SubvencionMatchProfile,
): number {
  const textos = [
    ...(subvencion.beneficiarios_texto ?? []),
    subvencion.para_quien ?? '',
  ].join(' ').toLowerCase();

  if (!textos.trim()) return 22; // sin info → puntuación parcial

  // Buscar tipos del cliente en el texto
  for (const tipoCliente of tiposClienteList) {
    const keywords = BENEFICIARIO_KEYWORDS[tipoCliente] ?? [tipoCliente];
    for (const kw of keywords) {
      if (textos.includes(kw)) return 28; // match por keyword
    }
  }

  // Si el texto menciona tipos específicos pero el cliente no encaja
  const todosKeywords = Object.values(BENEFICIARIO_KEYWORDS).flat();
  const mencionaAlgunTipo = todosKeywords.some(kw => textos.includes(kw));
  if (mencionaAlgunTipo) return 5; // menciona tipos pero no el del cliente

  return 18; // texto genérico, no menciona tipos específicos
}

// ─── Match gastos subvencionables con actividad del cliente ────────────────

/** Mapa CNAE división → categorías de gasto relevantes */
const CNAE_GASTOS_MAP: Record<string, string[]> = {
  // Tecnología / Informática (62xx, 63xx)
  '62': ['personal', 'equipamiento', 'servicios', 'software', 'tecnología', 'digital', 'informátic'],
  '63': ['personal', 'equipamiento', 'servicios', 'software', 'tecnología', 'digital'],
  // Construcción (41xx-43xx)
  '41': ['equipamiento', 'materiales', 'maquinaria', 'obra', 'construcción'],
  '42': ['equipamiento', 'materiales', 'maquinaria', 'obra', 'infraestructura'],
  '43': ['equipamiento', 'materiales', 'maquinaria', 'instalación'],
  // Comercio (45xx-47xx)
  '45': ['equipamiento', 'stock', 'marketing', 'publicidad', 'local'],
  '46': ['equipamiento', 'stock', 'logística', 'transporte'],
  '47': ['equipamiento', 'stock', 'marketing', 'local', 'reforma'],
  // Hostelería (55xx-56xx)
  '55': ['equipamiento', 'reforma', 'marketing', 'personal'],
  '56': ['equipamiento', 'reforma', 'marketing', 'personal', 'maquinaria'],
  // Industria (10xx-33xx)
  '10': ['equipamiento', 'maquinaria', 'materiales', 'personal', 'instalación'],
  '25': ['equipamiento', 'maquinaria', 'materiales', 'personal'],
  '28': ['equipamiento', 'maquinaria', 'i+d', 'investigación'],
  // Transporte (49xx-53xx)
  '49': ['vehículos', 'flota', 'equipamiento', 'combustible'],
  '52': ['equipamiento', 'logística', 'almacén'],
  // Servicios profesionales (69xx-75xx)
  '69': ['personal', 'servicios', 'formación'],
  '70': ['personal', 'servicios', 'consultoría'],
  '71': ['personal', 'equipamiento', 'software'],
  '72': ['personal', 'equipamiento', 'i+d', 'investigación'],
  '73': ['personal', 'marketing', 'publicidad', 'servicios'],
  // Agricultura (01xx-03xx)
  '01': ['equipamiento', 'maquinaria', 'semillas', 'ganado', 'tierras'],
  '02': ['equipamiento', 'maquinaria', 'forestal'],
  '03': ['equipamiento', 'embarcación', 'pesca'],
};

function matchGastosConActividad(
  cliente: ClienteMatchProfile,
  gastos: Array<{ categoria: string; descripcion: string; porcentaje_max?: number }>,
): number {
  const clienteCnae2 = (cliente.cnae_codigo ?? '').slice(0, 2);
  const clienteDesc = (cliente.cnae_descripcion ?? '').toLowerCase();
  const gastosRelevantes = CNAE_GASTOS_MAP[clienteCnae2] ?? [];

  if (!gastosRelevantes.length && !clienteDesc) return 5; // sin info para comparar

  let matches = 0;
  let total = gastos.length;

  for (const gasto of gastos) {
    const gastoCat = gasto.categoria.toLowerCase();
    const gastoDesc = gasto.descripcion.toLowerCase();
    const gastoTexto = `${gastoCat} ${gastoDesc}`;

    // Match por categoría genérica
    if (gastoTexto.includes('personal') || gastoTexto.includes('formación') || gastoTexto.includes('formacion')) {
      matches++; // personal y formación son genéricos, aplican a casi todas
      continue;
    }

    // Match por palabras clave del CNAE
    if (gastosRelevantes.some(kw => gastoTexto.includes(kw))) {
      matches++;
      continue;
    }

    // Match por descripción CNAE del cliente
    if (clienteDesc) {
      const palabrasGasto = gastoDesc.split(/\s+/).filter(w => w.length > 5);
      const palabrasCliente = clienteDesc.split(/\s+/).filter(w => w.length > 5);
      const overlap = palabrasGasto.some(w => palabrasCliente.includes(w))
        || palabrasCliente.some(w => gastoDesc.includes(w));
      if (overlap) {
        matches++;
      }
    }
  }

  if (total === 0) return 5;
  const ratio = matches / total;
  if (ratio >= 0.5) return 10;  // buen match
  if (ratio >= 0.25) return 7;  // match parcial
  if (matches > 0) return 4;    // algo coincide
  return 2;                     // nada coincide
}

// ═══════════════════════════════════════════════════════════════════════════════
// MOTOR v1 LEGACY — scoring original con 5 dimensiones
// ═══════════════════════════════════════════════════════════════════════════════

function calcularMatchV1(
  cliente: ClienteMatchProfile,
  subvencion: SubvencionMatchProfile,
): MatchScore {
  const motivos: string[] = [];
  const alertas: string[] = [];

  // ── HARD EXCLUDES ─────────────────────────────────────────────────────────
  const hardRazon = evaluarHardExcludes(cliente, subvencion);
  if (hardRazon) return hardExclude(hardRazon, 'v1');

  // ── DIMENSIÓN GEOGRAFÍA (0-30) ────────────────────────────────────────────
  let geo = 0;
  const ambito = subvencion.ambito_geografico ?? 'desconocido';
  const clienteCA = normCA(cliente.comunidad_autonoma);
  const subvCA = normCA(subvencion.comunidad_autonoma);
  const subvProv = (subvencion.provincia ?? '').toLowerCase();
  const clienteProv = (cliente.provincia ?? '').toLowerCase();

  if (ambito === 'nacional') {
    geo = 30;
    motivos.push('Convocatoria de ámbito nacional — aplica para tu empresa');
  } else if (ambito === 'autonomico') {
    if (!clienteCA) {
      geo = 10;
      alertas.push('No tenemos tu comunidad autónoma registrada para verificar ámbito autonómico');
    } else if (subvCA && clienteCA === subvCA) {
      geo = 28;
      motivos.push(`Tu empresa está en ${clienteCA}, igual que la convocatoria`);
    } else {
      geo = 15; // CA de la subvención desconocida
    }
  } else if (ambito === 'local') {
    if (subvProv && clienteProv && subvProv.includes(clienteProv.slice(0, 5))) {
      geo = 20;
      motivos.push('Convocatoria local y tu empresa está en la misma provincia');
    } else {
      geo = 8;
      alertas.push('Convocatoria local — verifica si aplica a tu municipio');
    }
  } else {
    geo = 15; // ámbito desconocido
  }

  // ── DIMENSIÓN TIPO EMPRESA (0-25) ─────────────────────────────────────────
  let tipo = 0;
  const tiposClienteList = tiposCliente(cliente);
  if (!subvencion.tipos_empresa?.length) {
    tipo = 18;
    motivos.push('Sin restricción de tipo de empresa');
  } else {
    const permitidos = subvencion.tipos_empresa.filter(t => !t.excluido);
    const match = permitidos.filter(t => tiposClienteList.includes(t.tipo));
    if (match.length > 0) {
      tipo = 25;
      motivos.push(`Tu tipo de empresa (${tiposClienteList.join('/')}) encaja con los beneficiarios`);
    } else if (permitidos.length === 0) {
      tipo = 18;
    } else {
      tipo = 5;
      alertas.push(`La subvención está orientada a: ${permitidos.map(t => t.tipo).join(', ')}`);
    }
  }

  // ── DIMENSIÓN SECTOR CNAE (0-20) ──────────────────────────────────────────
  let sector = 0;
  let sectorMismatch = false;
  let confirmedCnaeMismatch = false;
  const clienteCnae = (cliente.cnae_codigo ?? '').slice(0, 4);
  const clienteCnae2 = clienteCnae.slice(0, 2);

  if (!subvencion.sectores?.length) {
    sector = 12;
  } else {
    const permitidos = subvencion.sectores.filter(s => !s.excluido);
    if (!permitidos.length) {
      sector = 12;
    } else {
      const clienteDesc = (cliente.cnae_descripcion ?? '').toLowerCase();
      const exactMatch = permitidos.some(s => s.cnae_codigo?.slice(0, 4) === clienteCnae && clienteCnae);
      const divMatch = permitidos.some(s => s.cnae_codigo?.slice(0, 2) === clienteCnae2 && clienteCnae2);
      const permitidosConCnae = permitidos.filter(s => s.cnae_codigo);
      const STOP = new Set(['actividades', 'actividad', 'empresa', 'empresas', 'servicio', 'servicios', 'sector', 'sectores']);
      const keyword = permitidosConCnae.length === 0 && permitidos.some(s => {
        if (!s.nombre_sector) return false;
        const sectorLower = s.nombre_sector.toLowerCase();
        const sectorEnCliente = sectorLower.split(/\s+/).some(w => w.length > 5 && !STOP.has(w) && clienteDesc.includes(w));
        const clienteEnSector = clienteDesc.split(/\s+/).some(w => w.length > 5 && !STOP.has(w) && sectorLower.includes(w));
        return sectorEnCliente || clienteEnSector;
      });

      if (exactMatch) {
        sector = 20;
        motivos.push(`Tu sector CNAE ${clienteCnae} encaja directamente con la convocatoria`);
      } else if (divMatch) {
        sector = 14;
        motivos.push('Tu sector está dentro del ámbito de la convocatoria');
      } else if (keyword) {
        sector = 14;
        motivos.push('Tu sector está dentro del ámbito de la convocatoria');
      } else {
        sector = 0;
        sectorMismatch = true;
        const EXCLUSIVE = ['agricultur', 'ganadería', 'ganaderia', 'silvicultur', 'forestal', 'pesca', 'acuicultur', 'minería', 'mineria', 'alimentación', 'alimentacion', 'agroaliment'];
        const CNAE_PRIMARIO = ['01', '02', '03', '05', '06', '07', '08', '09', '10', '11', '12'];
        const esExclusivo = permitidos.some(s => EXCLUSIVE.some(ex => (s.nombre_sector ?? '').toLowerCase().includes(ex)));
        const clienteEsPrimario = clienteCnae2 && CNAE_PRIMARIO.includes(clienteCnae2);
        if (permitidosConCnae.length > 0 || (esExclusivo && !clienteEsPrimario)) confirmedCnaeMismatch = true;
        alertas.push(`La convocatoria está orientada a sectores distintos al tuyo (${(cliente.cnae_descripcion ?? '').toLowerCase() || `CNAE ${clienteCnae}`})`);
      }
    }
  }

  // ── DIMENSIÓN ESTADO (0-15) ───────────────────────────────────────────────
  let estado = 0;
  const diasCierre = subvencion.plazo_fin
    ? Math.ceil((new Date(subvencion.plazo_fin).getTime() - Date.now()) / 86_400_000)
    : null;

  switch (subvencion.estado_convocatoria) {
    case 'abierta':
      estado = 15;
      if (diasCierre !== null && diasCierre <= 15 && diasCierre >= 0) {
        alertas.push(`Quedan solo ${diasCierre} días para el cierre del plazo`);
      }
      motivos.push('Convocatoria actualmente abierta');
      break;
    case 'proxima':
      estado = 11;
      motivos.push('Convocatoria próxima — podrás presentarla pronto');
      break;
    case 'resuelta':
      estado = 3;
      alertas.push('Convocatoria ya resuelta — posiblemente habrá nueva edición');
      break;
    default:
      estado = 7;
  }

  // ── DIMENSIÓN IMPORTE (0-10) ──────────────────────────────────────────────
  let importe = 0;
  const maxSubv = subvencion.importe_maximo ?? subvencion.presupuesto_total;
  const fac = cliente.facturacion_anual ?? 0;

  if (!maxSubv) {
    importe = 5;
  } else if (fac <= 0) {
    importe = 5;
  } else {
    const ratio = maxSubv / fac;
    if (ratio >= 0.02 && ratio <= 2) {
      importe = 10;
      if (maxSubv >= 50_000) {
        motivos.push(`Importe potencial de hasta ${fmtImporte(maxSubv)} para tu empresa`);
      }
    } else if (ratio < 0.02) {
      importe = 4;
      alertas.push('El importe de la subvención es pequeño en relación a tu facturación');
    } else {
      importe = 7;
    }
  }

  // ── SCORE FINAL ───────────────────────────────────────────────────────────
  const detalle: MatchScoreDetalle = {
    geografia: geo,
    tipo_empresa: tipo,
    sector,
    estado,
    importe,
    // v2 fields a 0 en legacy
    cnae: 0,
    gastos: 0,
  };
  let score_raw = geo + tipo + sector + estado + importe;

  if (confirmedCnaeMismatch) {
    score_raw = Math.min(score_raw, 35);
  } else if (sectorMismatch) {
    score_raw = Math.min(score_raw, 50);
  }

  const score = Math.min(1, score_raw / 100);

  return {
    score: Math.round(score * 100) / 100,
    score_raw,
    hard_exclude: false,
    detalle,
    motivos,
    alertas,
    version: 'v1',
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENTRY POINT PÚBLICO — elige v1 o v2 automáticamente
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calcula el match entre un cliente y una subvención.
 * v3: Motor unificado — enriquece con campos_extraidos (PDF) y aplica geoBonus.
 */
export function calcularMatch(
  cliente: ClienteMatchProfile,
  subvencion: SubvencionMatchProfile,
): MatchScore {
  return calcularMatchV2(cliente, enriquecerConCamposExtraidos(subvencion));
}

// ─── Motor masivo ────────────────────────────────────────────────────────────

export interface MatchResult {
  clienteNif: string;
  subvencionId: string;
  score: MatchScore;
}

/**
 * Calcula todos los matches posibles entre una lista de clientes y subvenciones.
 * Devuelve solo los que tienen score > 0 (no excluidos).
 */
export function calcularMatchesMasivos(
  clientes: ClienteMatchProfile[],
  subvenciones: SubvencionMatchProfile[],
  minScore = 0.05,
): MatchResult[] {
  const resultados: MatchResult[] = [];
  for (const cliente of clientes) {
    for (const subv of subvenciones) {
      const score = calcularMatch(cliente, subv);
      if (!score.hard_exclude && score.score >= minScore) {
        resultados.push({ clienteNif: cliente.nif, subvencionId: subv.id, score });
      }
    }
  }
  return resultados.sort((a, b) => b.score.score - a.score.score);
}

// ─── Exportar utilidades para tests y scripts ────────────────────────────────

export {
  extraerLimiteEmpleados,
  extraerAntiguedadMinima,
  tieneDataV2,
  matchGastosConActividad,
  matchBeneficiariosTexto,
  calcularMatchV1,
  calcularMatchV2,
  BENEFICIARIO_KEYWORDS,
};
