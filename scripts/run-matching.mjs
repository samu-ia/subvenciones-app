/**
 * scripts/run-matching.mjs
 *
 * Runs the full matching engine v2 (same logic as /api/matching/run) directly
 * without needing the Next.js server running.
 *
 * v2: Carga requisitos, gastos y beneficiarios para el motor v2.
 *     Fallback automático a v1 para subvenciones sin datos enriquecidos.
 *
 * Usage: node scripts/run-matching.mjs [--all] [nif]
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load env
const envFile = readFileSync('.env.local', 'utf-8');
const env = Object.fromEntries(
  envFile.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
// CLI: node run-matching.mjs [--all] [nif]
const args = process.argv.slice(2);
const forceAll = args.includes('--all');
const filtroNif = args.find(a => !a.startsWith('--')) || null;
// false por defecto = toda España. Solo true si se pasa explícitamente en .env
const GALICIA_FOCUS = env.GALICIA_FOCUS === 'true';

// ─── Engine v2 (ported from lib/matching/engine.ts) ──────────────────────────

const CA_ALIAS = {
  'Madrid':          ['madrid', 'comunidad de madrid', 'com. de madrid'],
  'Cataluña':        ['cataluña', 'cataluna', 'catalunya', 'catalonia'],
  'Andalucía':       ['andalucía', 'andalucia'],
  'Valencia':        ['valencia', 'comunitat valenciana', 'comunidad valenciana'],
  'Galicia':         ['galicia'],
  'Castilla y León': ['castilla y leon', 'castilla y león'],
  'Castilla-La Mancha': ['castilla-la mancha', 'castilla la mancha'],
  'País Vasco':      ['país vasco', 'pais vasco', 'euskadi'],
  'Canarias':        ['canarias'],
  'Murcia':          ['murcia', 'región de murcia', 'region de murcia'],
  'Aragón':          ['aragón', 'aragon'],
  'Extremadura':     ['extremadura'],
  'Asturias':        ['asturias'],
  'Baleares':        ['baleares', 'illes balears', 'islas baleares'],
  'Navarra':         ['navarra'],
  'Cantabria':       ['cantabria'],
  'La Rioja':        ['la rioja', 'rioja'],
};

function normCA(s) {
  if (!s) return '';
  const lower = s.toLowerCase().trim();
  for (const [key, aliases] of Object.entries(CA_ALIAS)) {
    if (aliases.some(a => lower.includes(a))) return key;
  }
  return s;
}

const TAMANO_A_TIPO = {
  'micropyme':    ['micropyme', 'pyme', 'autonomo'],
  'microempresa': ['micropyme', 'pyme'],
  'pequeña':      ['pyme'],
  'mediana':      ['pyme'],
  'pyme':         ['pyme', 'micropyme'],
  'grande':       ['grande'],
  'autónomo':     ['autonomo'],
  'autonomo':     ['autonomo'],
  'sl':           ['pyme', 'micropyme'],
  'sa':           ['pyme', 'grande'],
  'cooperativa':  ['otro'],
  'asociacion':   ['otro'],
};

function tiposCliente(cliente) {
  const tipos = new Set();
  const tamano = (cliente.tamano_empresa ?? '').toLowerCase();
  const forma = (cliente.forma_juridica ?? '').toLowerCase();
  const emp = cliente.num_empleados ?? 0;
  const fac = cliente.facturacion_anual ?? 0;
  if (emp <= 10 && fac <= 2_000_000) tipos.add('micropyme');
  if (emp <= 50 && fac <= 10_000_000) tipos.add('pequeña');
  if (emp <= 250 && fac <= 50_000_000) tipos.add('pyme');
  if (emp > 250 || fac > 50_000_000) tipos.add('grande');
  if (forma.includes('autón') || forma === 'autonomo') tipos.add('autonomo');
  if (forma.includes('startup') || (cliente.anos_antiguedad ?? 99) <= 5) tipos.add('startup');
  if (forma.includes('cooperat') || forma.includes('asocia') || forma.includes('fundac')) tipos.add('otro');
  for (const [key, vals] of Object.entries(TAMANO_A_TIPO)) {
    if (tamano.includes(key)) vals.forEach(v => tipos.add(v));
  }
  if (tipos.size === 0) tipos.add('pyme');
  return [...tipos];
}

function hard(razon, version = 'v1') {
  return {
    score: 0, score_raw: 0, hard_exclude: true, hard_exclude_razon: razon, razon_exclusion: razon,
    detalle: { cnae: 0, tipo_empresa: 0, importe: 0, gastos: 0, geografia: 0, sector: 0, estado: 0 },
    motivos: [], alertas: [razon], version,
  };
}

function fmtImporte(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M€`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K€`;
  return `${n}€`;
}

// ─── Parsers de requisitos ───────────────────────────────────────────────────

function extraerLimiteEmpleados(requisitos) {
  if (!requisitos?.length) return null;
  for (const req of requisitos) {
    const desc = req.descripcion.toLowerCase();
    const match = desc.match(
      /(?:máximo|maximo|hasta|menos\s+de|no\s+(?:más|mas)\s+de|no\s+superar?)\s*(?:de\s+)?(\d+)\s*(?:empleados?|trabajador(?:es|as)?|personas?\s+emplead)/
    );
    if (match) return parseInt(match[1], 10);
    const match2 = desc.match(
      /(\d+)\s*(?:empleados?|trabajador(?:es|as)?)\s*(?:como\s+)?(?:máximo|maximo|o\s+menos)/
    );
    if (match2) return parseInt(match2[1], 10);
    if (desc.includes('micropyme') || desc.includes('microempresa')) {
      if (!desc.includes('pyme') || desc.includes('micro')) return 10;
    }
    if (desc.includes('pequeña empresa') && !desc.includes('mediana')) return 50;
  }
  return null;
}

function extraerAntiguedadMinima(requisitos) {
  if (!requisitos?.length) return null;
  for (const req of requisitos) {
    const desc = req.descripcion.toLowerCase();
    const match = desc.match(
      /(?:antigüedad|antiguedad|actividad)\s*(?:mínima?|minima?|de\s+al\s+menos)\s*(?:de\s+)?(\d+)\s*años?/
    );
    if (match) return parseInt(match[1], 10);
    const match2 = desc.match(
      /(?:al\s+menos|mínimo|minimo|como\s+mínimo)\s+(\d+)\s*años?\s*(?:de\s+)?(?:antigüedad|antiguedad|actividad|constitución|constitucion)/
    );
    if (match2) return parseInt(match2[1], 10);
    const match3 = desc.match(
      /(?:constituida?|creada?|inscrita?)\s*(?:hace|con)\s*(?:más|mas)\s*de\s*(\d+)\s*años?/
    );
    if (match3) return parseInt(match3[1], 10);
  }
  return null;
}

// ─── Hard excludes comunes ───────────────────────────────────────────────────

function evaluarHardExcludes(cliente, subvencion) {
  if (subvencion.estado_convocatoria === 'cerrada') return 'Convocatoria cerrada.';
  if (subvencion.estado_convocatoria === 'suspendida') return 'Convocatoria suspendida.';

  if (subvencion.plazo_fin) {
    const diasCierre = Math.ceil((new Date(subvencion.plazo_fin).getTime() - Date.now()) / 86_400_000);
    if (diasCierre < 0) return 'El plazo de presentación ha vencido.';
  }

  const ambito = subvencion.ambito_geografico ?? 'desconocido';
  const clienteCA = normCA(cliente.comunidad_autonoma);
  const subvCA = normCA(subvencion.comunidad_autonoma);
  const subvProv = (subvencion.provincia ?? '').toLowerCase();
  const clienteProv = (cliente.provincia ?? '').toLowerCase();

  if (ambito === 'autonomico' && clienteCA && subvCA && clienteCA !== subvCA) {
    return `Esta convocatoria es solo para ${subvCA} y tu empresa está en ${clienteCA}.`;
  }
  if (ambito === 'local') {
    if (subvProv && clienteProv && !subvProv.includes(clienteProv.slice(0, 5))) {
      return `Convocatoria local para ${subvProv}, tu empresa está en ${clienteProv || 'otra provincia'}.`;
    }
    if (!subvProv && subvCA && clienteCA && subvCA !== clienteCA) {
      return `Convocatoria local para ${subvCA}, tu empresa está en ${clienteCA}.`;
    }
  }

  if (subvencion.sectores?.length) {
    const clienteCnae = (cliente.cnae_codigo ?? '').slice(0, 4);
    for (const exc of subvencion.sectores.filter(s => s.excluido)) {
      const cnaeExc = (exc.cnae_codigo ?? '').slice(0, 4);
      if (cnaeExc && clienteCnae && (clienteCnae === cnaeExc || clienteCnae.startsWith(cnaeExc))) {
        return `Tu sector (CNAE ${clienteCnae}) está excluido en esta convocatoria.`;
      }
    }
  }

  if (subvencion.tipos_empresa?.length) {
    const tiposClienteList = tiposCliente(cliente);
    for (const exc of subvencion.tipos_empresa.filter(t => t.excluido)) {
      if (tiposClienteList.includes(exc.tipo)) return `Tu tipo de empresa (${exc.tipo}) está excluido.`;
    }
  }

  const limiteEmpleados = extraerLimiteEmpleados(subvencion.requisitos);
  if (limiteEmpleados !== null && cliente.num_empleados != null) {
    if (cliente.num_empleados > limiteEmpleados) {
      return `Tu empresa tiene ${cliente.num_empleados} empleados pero el máximo es ${limiteEmpleados}.`;
    }
  }

  const antiguedadMin = extraerAntiguedadMinima(subvencion.requisitos);
  if (antiguedadMin !== null && cliente.anos_antiguedad != null) {
    if (cliente.anos_antiguedad < antiguedadMin) {
      return `Tu empresa tiene ${cliente.anos_antiguedad} años de antigüedad pero se requieren al menos ${antiguedadMin}.`;
    }
  }

  return null;
}

// ─── Detect v2 data ──────────────────────────────────────────────────────────

function tieneDataV2(subvencion) {
  return !!(
    (subvencion.requisitos && subvencion.requisitos.length > 0) ||
    (subvencion.gastos && subvencion.gastos.length > 0) ||
    (subvencion.beneficiarios_texto && subvencion.beneficiarios_texto.length > 0) ||
    subvencion.para_quien
  );
}

// ─── Gastos matching ─────────────────────────────────────────────────────────

const CNAE_GASTOS_MAP = {
  '62': ['personal', 'equipamiento', 'servicios', 'software', 'tecnología', 'digital', 'informátic'],
  '63': ['personal', 'equipamiento', 'servicios', 'software', 'tecnología', 'digital'],
  '41': ['equipamiento', 'materiales', 'maquinaria', 'obra', 'construcción'],
  '42': ['equipamiento', 'materiales', 'maquinaria', 'obra', 'infraestructura'],
  '43': ['equipamiento', 'materiales', 'maquinaria', 'instalación'],
  '45': ['equipamiento', 'stock', 'marketing', 'publicidad', 'local'],
  '46': ['equipamiento', 'stock', 'logística', 'transporte'],
  '47': ['equipamiento', 'stock', 'marketing', 'local', 'reforma'],
  '55': ['equipamiento', 'reforma', 'marketing', 'personal'],
  '56': ['equipamiento', 'reforma', 'marketing', 'personal', 'maquinaria'],
  '10': ['equipamiento', 'maquinaria', 'materiales', 'personal', 'instalación'],
  '25': ['equipamiento', 'maquinaria', 'materiales', 'personal'],
  '28': ['equipamiento', 'maquinaria', 'i+d', 'investigación'],
  '49': ['vehículos', 'flota', 'equipamiento', 'combustible'],
  '52': ['equipamiento', 'logística', 'almacén'],
  '69': ['personal', 'servicios', 'formación'],
  '70': ['personal', 'servicios', 'consultoría'],
  '71': ['personal', 'equipamiento', 'software'],
  '72': ['personal', 'equipamiento', 'i+d', 'investigación'],
  '73': ['personal', 'marketing', 'publicidad', 'servicios'],
  '01': ['equipamiento', 'maquinaria', 'semillas', 'ganado', 'tierras'],
  '02': ['equipamiento', 'maquinaria', 'forestal'],
  '03': ['equipamiento', 'embarcación', 'pesca'],
};

function matchGastosConActividad(cliente, gastos) {
  const clienteCnae2 = (cliente.cnae_codigo ?? '').slice(0, 2);
  const clienteDesc = (cliente.cnae_descripcion ?? '').toLowerCase();
  const gastosRelevantes = CNAE_GASTOS_MAP[clienteCnae2] ?? [];
  if (!gastosRelevantes.length && !clienteDesc) return 5;

  let matches = 0;
  const total = gastos.length;
  for (const gasto of gastos) {
    const gastoTexto = `${gasto.categoria} ${gasto.descripcion}`.toLowerCase();
    if (gastoTexto.includes('personal') || gastoTexto.includes('formación') || gastoTexto.includes('formacion')) {
      matches++; continue;
    }
    if (gastosRelevantes.some(kw => gastoTexto.includes(kw))) { matches++; continue; }
    if (clienteDesc) {
      const palabrasGasto = gasto.descripcion.toLowerCase().split(/\s+/).filter(w => w.length > 5);
      const palabrasCliente = clienteDesc.split(/\s+/).filter(w => w.length > 5);
      if (palabrasGasto.some(w => palabrasCliente.includes(w)) || palabrasCliente.some(w => gasto.descripcion.toLowerCase().includes(w))) {
        matches++;
      }
    }
  }
  if (total === 0) return 5;
  const ratio = matches / total;
  if (ratio >= 0.5) return 10;
  if (ratio >= 0.25) return 7;
  if (matches > 0) return 4;
  return 2;
}

// ─── Beneficiarios matching ──────────────────────────────────────────────────

const BENEFICIARIO_KEYWORDS = {
  'pyme':       ['pyme', 'pymes', 'pequeña', 'mediana', 'pequeñas', 'medianas'],
  'micropyme':  ['micropyme', 'micropymes', 'microempresa', 'microempresas'],
  'autonomo':   ['autónomo', 'autónomos', 'autonomo', 'autonomos', 'trabajador por cuenta propia'],
  'grande':     ['gran empresa', 'grandes empresas'],
  'startup':    ['startup', 'startups', 'empresa emergente', 'emprendedor', 'emprendedores', 'nueva empresa'],
  'otro':       ['cooperativa', 'asociación', 'asociacion', 'fundación', 'fundacion', 'entidad sin ánimo'],
};

function matchBeneficiariosTexto(tiposClienteList, cliente, subvencion) {
  const textos = [
    ...(subvencion.beneficiarios_texto ?? []),
    subvencion.para_quien ?? '',
  ].join(' ').toLowerCase();
  if (!textos.trim()) return 22;
  for (const tipoCliente of tiposClienteList) {
    const keywords = BENEFICIARIO_KEYWORDS[tipoCliente] ?? [tipoCliente];
    for (const kw of keywords) {
      if (textos.includes(kw)) return 28;
    }
  }
  const todosKeywords = Object.values(BENEFICIARIO_KEYWORDS).flat();
  if (todosKeywords.some(kw => textos.includes(kw))) return 5;
  return 18;
}

// ─── Motor v2 ────────────────────────────────────────────────────────────────

function calcularMatchV2(cliente, subvencion) {
  const motivos = [];
  const alertas = [];

  const hardRazon = evaluarHardExcludes(cliente, subvencion);
  if (hardRazon) return hard(hardRazon, 'v2');

  if (subvencion.plazo_fin) {
    const diasCierre = Math.ceil((new Date(subvencion.plazo_fin).getTime() - Date.now()) / 86_400_000);
    if (diasCierre <= 15 && diasCierre >= 0) alertas.push(`Quedan solo ${diasCierre} días para el cierre`);
  }

  // CNAE (0-40)
  let cnae = 0;
  const clienteCnae = (cliente.cnae_codigo ?? '').slice(0, 4);
  const clienteCnae2 = clienteCnae.slice(0, 2);
  const clienteDesc = (cliente.cnae_descripcion ?? '').toLowerCase();
  let sectorMismatch = false;
  let confirmedCnaeMismatch = false;

  if (!subvencion.sectores?.length) {
    cnae = 25;
    motivos.push('Convocatoria abierta a todos los sectores');
  } else {
    const permitidos = subvencion.sectores.filter(s => !s.excluido);
    if (!permitidos.length) { cnae = 25; }
    else {
      const exactMatch = permitidos.some(s => s.cnae_codigo?.slice(0, 4) === clienteCnae && clienteCnae);
      const divMatch = permitidos.some(s => s.cnae_codigo?.slice(0, 2) === clienteCnae2 && clienteCnae2);
      const permitidosConCnae = permitidos.filter(s => s.cnae_codigo);
      const STOP = new Set(['actividades', 'actividad', 'empresa', 'empresas', 'servicio', 'servicios', 'sector', 'sectores']);
      const keyword = permitidosConCnae.length === 0 && permitidos.some(s => {
        if (!s.nombre_sector) return false;
        const sl = s.nombre_sector.toLowerCase();
        return sl.split(/\s+/).some(w => w.length > 5 && !STOP.has(w) && clienteDesc.includes(w))
          || clienteDesc.split(/\s+/).some(w => w.length > 5 && !STOP.has(w) && sl.includes(w));
      });
      if (exactMatch) { cnae = 40; motivos.push(`CNAE ${clienteCnae} encaja directamente`); }
      else if (divMatch) { cnae = 28; motivos.push('Sector dentro del ámbito'); }
      else if (keyword) { cnae = 28; motivos.push('Actividad relacionada con la convocatoria'); }
      else {
        cnae = 0; sectorMismatch = true;
        const EXCLUSIVE = ['agricultur', 'ganadería', 'ganaderia', 'silvicultur', 'forestal', 'pesca', 'acuicultur', 'minería', 'mineria', 'alimentación', 'alimentacion', 'agroaliment'];
        const CNAE_PRIMARIO = ['01', '02', '03', '05', '06', '07', '08', '09', '10', '11', '12'];
        const esExclusivo = permitidos.some(s => EXCLUSIVE.some(ex => (s.nombre_sector ?? '').toLowerCase().includes(ex)));
        const clienteEsPrimario = clienteCnae2 && CNAE_PRIMARIO.includes(clienteCnae2);
        if (permitidosConCnae.length > 0 || (esExclusivo && !clienteEsPrimario)) confirmedCnaeMismatch = true;
        alertas.push('Sectores específicos distintos al tuyo');
      }
    }
  }

  // Tipo empresa (0-30)
  let tipo_empresa = 0;
  const tiposClienteList = tiposCliente(cliente);
  if (subvencion.tipos_empresa?.length) {
    const permitidos = subvencion.tipos_empresa.filter(t => !t.excluido);
    const match = permitidos.filter(t => tiposClienteList.includes(t.tipo));
    if (match.length > 0) { tipo_empresa = 30; motivos.push(`Tipo de empresa encaja`); }
    else if (permitidos.length === 0) { tipo_empresa = 22; }
    else { tipo_empresa = 5; alertas.push(`Orientada a: ${permitidos.map(t => t.tipo).join(', ')}`); }
  } else if (subvencion.beneficiarios_texto?.length || subvencion.para_quien) {
    tipo_empresa = matchBeneficiariosTexto(tiposClienteList, cliente, subvencion);
    if (tipo_empresa >= 20) motivos.push('Perfil de empresa encaja con beneficiarios');
  } else {
    tipo_empresa = 22;
    motivos.push('Sin restricción de tipo de empresa');
  }

  // Importe (0-20)
  let importe = 0;
  const maxSubv = subvencion.importe_maximo ?? subvencion.presupuesto_total;
  const fac = cliente.facturacion_anual ?? 0;
  if (!maxSubv || fac <= 0) { importe = 10; }
  else {
    const ratio = maxSubv / fac;
    if (ratio >= 0.02 && ratio <= 2) { importe = 20; if (maxSubv >= 50_000) motivos.push(`Hasta ${fmtImporte(maxSubv)}`); }
    else if (ratio < 0.02) { importe = 8; }
    else { importe = 14; }
  }

  // Gastos (0-10)
  let gastos = 0;
  if (subvencion.gastos?.length) {
    gastos = matchGastosConActividad(cliente, subvencion.gastos);
    if (gastos >= 7) motivos.push('Gastos subvencionables encajan con tu actividad');
  } else { gastos = 5; }

  if (subvencion.estado_convocatoria === 'abierta') motivos.push('Convocatoria abierta');
  else if (subvencion.estado_convocatoria === 'proxima') motivos.push('Próxima convocatoria');
  else if (subvencion.estado_convocatoria === 'resuelta') alertas.push('Convocatoria resuelta');

  const detalle = { cnae, tipo_empresa, importe, gastos, geografia: 0, sector: 0, estado: 0 };
  let score_raw = cnae + tipo_empresa + importe + gastos;
  if (confirmedCnaeMismatch) score_raw = Math.min(score_raw, 25);
  else if (sectorMismatch) score_raw = Math.min(score_raw, 39);
  const score = Math.min(1, score_raw / 100);
  return { score: Math.round(score * 100) / 100, score_raw, hard_exclude: false, detalle, motivos, alertas, version: 'v2' };
}

// ─── Motor v1 legacy ─────────────────────────────────────────────────────────

function calcularMatchV1(cliente, subvencion) {
  const motivos = [];
  const alertas = [];

  const hardRazon = evaluarHardExcludes(cliente, subvencion);
  if (hardRazon) return hard(hardRazon, 'v1');

  // Geografía (0-30)
  let geo = 0;
  const ambito = subvencion.ambito_geografico ?? 'desconocido';
  const clienteCA = normCA(cliente.comunidad_autonoma);
  const subvCA = normCA(subvencion.comunidad_autonoma);
  const subvProv = (subvencion.provincia ?? '').toLowerCase();
  const clienteProv = (cliente.provincia ?? '').toLowerCase();

  if (ambito === 'nacional') { geo = 30; motivos.push('Convocatoria nacional'); }
  else if (ambito === 'autonomico') {
    if (!clienteCA) { geo = 10; }
    else if (subvCA && clienteCA === subvCA) { geo = 28; motivos.push(`Tu empresa está en ${clienteCA}`); }
    else { geo = 15; }
  } else if (ambito === 'local') {
    if (subvProv && clienteProv && subvProv.includes(clienteProv.slice(0, 5))) { geo = 20; }
    else { geo = 8; }
  } else { geo = 15; }

  // Tipo empresa (0-25)
  let tipo = 0;
  const tiposClienteList = tiposCliente(cliente);
  if (!subvencion.tipos_empresa?.length) { tipo = 18; }
  else {
    const permitidos = subvencion.tipos_empresa.filter(t => !t.excluido);
    const match = permitidos.filter(t => tiposClienteList.includes(t.tipo));
    if (match.length > 0) { tipo = 25; motivos.push(`Tipo de empresa encaja`); }
    else if (permitidos.length === 0) { tipo = 18; }
    else { tipo = 5; alertas.push(`Orientada a: ${permitidos.map(t => t.tipo).join(', ')}`); }
  }

  // Sector CNAE (0-20)
  let sector = 0;
  let sectorMismatch = false;
  let confirmedCnaeMismatch = false;
  const clienteCnae = (cliente.cnae_codigo ?? '').slice(0, 4);
  const clienteCnae2 = clienteCnae.slice(0, 2);
  if (!subvencion.sectores?.length) { sector = 12; }
  else {
    const permitidos = subvencion.sectores.filter(s => !s.excluido);
    if (!permitidos.length) { sector = 12; }
    else {
      const exactMatch = permitidos.some(s => s.cnae_codigo?.slice(0, 4) === clienteCnae && clienteCnae);
      const divMatch = permitidos.some(s => s.cnae_codigo?.slice(0, 2) === clienteCnae2 && clienteCnae2);
      const permitidosConCnae = permitidos.filter(s => s.cnae_codigo);
      const clienteDesc = (cliente.cnae_descripcion ?? '').toLowerCase();
      const STOP = new Set(['actividades', 'actividad', 'empresa', 'empresas', 'servicio', 'servicios', 'sector', 'sectores']);
      const keyword = permitidosConCnae.length === 0 && permitidos.some(s => {
        if (!s.nombre_sector) return false;
        const sl = s.nombre_sector.toLowerCase();
        return sl.split(/\s+/).some(w => w.length > 5 && !STOP.has(w) && clienteDesc.includes(w))
          || clienteDesc.split(/\s+/).some(w => w.length > 5 && !STOP.has(w) && sl.includes(w));
      });
      if (exactMatch) { sector = 20; motivos.push(`CNAE ${clienteCnae} encaja`); }
      else if (divMatch) { sector = 14; motivos.push('Sector dentro del ámbito'); }
      else if (keyword) { sector = 14; motivos.push('Sector dentro del ámbito'); }
      else {
        sector = 0; sectorMismatch = true;
        const EXCLUSIVE = ['agricultur', 'ganadería', 'ganaderia', 'silvicultur', 'forestal', 'pesca', 'acuicultur', 'minería', 'mineria', 'alimentación', 'alimentacion', 'agroaliment'];
        const CNAE_PRIMARIO = ['01', '02', '03', '05', '06', '07', '08', '09', '10', '11', '12'];
        const esExclusivo = permitidos.some(s => EXCLUSIVE.some(ex => (s.nombre_sector ?? '').toLowerCase().includes(ex)));
        const clienteEsPrimario = clienteCnae2 && CNAE_PRIMARIO.includes(clienteCnae2);
        if (permitidosConCnae.length > 0 || (esExclusivo && !clienteEsPrimario)) confirmedCnaeMismatch = true;
        alertas.push('Sectores específicos distintos al tuyo');
      }
    }
  }

  // Estado (0-15)
  let estado = 0;
  const diasCierre = subvencion.plazo_fin
    ? Math.ceil((new Date(subvencion.plazo_fin).getTime() - Date.now()) / 86_400_000)
    : null;
  switch (subvencion.estado_convocatoria) {
    case 'abierta':
      estado = diasCierre !== null && diasCierre <= 15 ? 12 : 15;
      if (diasCierre !== null && diasCierre <= 15) alertas.push(`Solo ${diasCierre} días para el cierre`);
      else motivos.push('Convocatoria abierta');
      break;
    case 'proxima': estado = 11; motivos.push('Próxima convocatoria'); break;
    case 'resuelta': estado = 3; break;
    default: estado = 7;
  }

  // Importe (0-10)
  let importe = 0;
  const maxSubv = subvencion.importe_maximo ?? subvencion.presupuesto_total;
  const fac = cliente.facturacion_anual ?? 0;
  if (!maxSubv || fac <= 0) { importe = 5; }
  else {
    const ratio = maxSubv / fac;
    if (ratio >= 0.02 && ratio <= 2) { importe = 10; if (maxSubv >= 50_000) motivos.push(`Hasta ${fmtImporte(maxSubv)}`); }
    else if (ratio < 0.02) { importe = 4; }
    else { importe = 7; }
  }

  const detalle = { geografia: geo, tipo_empresa: tipo, sector, estado, importe, cnae: 0, gastos: 0 };
  let score_raw = geo + tipo + sector + estado + importe;
  if (confirmedCnaeMismatch) score_raw = Math.min(score_raw, 25);
  else if (sectorMismatch) score_raw = Math.min(score_raw, 39);
  const score = Math.min(1, score_raw / 100);
  return { score: Math.round(score * 100) / 100, score_raw, hard_exclude: false, detalle, motivos, alertas, version: 'v1' };
}

// ─── Entry point ─────────────────────────────────────────────────────────────

function calcularMatch(cliente, subvencion) {
  if (tieneDataV2(subvencion)) return calcularMatchV2(cliente, subvencion);
  return calcularMatchV1(cliente, subvencion);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔄 Motor de Matching v2`);
  console.log(`${filtroNif ? `NIF: ${filtroNif}` : 'Masivo'} | GALICIA_FOCUS: ${GALICIA_FOCUS}\n`);

  // Cargar clientes
  const clientesQuery = sb.from('cliente').select(
    'nif,nombre_empresa,cnae_codigo,cnae_descripcion,comunidad_autonoma,provincia,ciudad,tamano_empresa,forma_juridica,num_empleados,facturacion_anual,anos_antiguedad'
  );
  if (filtroNif) clientesQuery.eq('nif', filtroNif);
  const { data: clientes, error: errC } = await clientesQuery;
  if (errC) { console.error('Error cargando clientes:', errC.message); process.exit(1); }
  console.log(`Clientes cargados: ${clientes.length}`);

  // Cargar subvenciones activas
  const { data: subvenciones, error: errS } = await sb
    .from('subvenciones')
    .select('id,bdns_id,titulo,organismo,ambito_geografico,comunidad_autonoma,provincia,estado_convocatoria,importe_maximo,importe_minimo,presupuesto_total,plazo_fin,para_quien')
    .not('estado_convocatoria', 'in', '("cerrada","suspendida")');
  if (errS) { console.error('Error cargando subvenciones:', errS.message); process.exit(1); }

  // Filtro Galicia
  const subvFiltradas = GALICIA_FOCUS
    ? (subvenciones ?? []).filter(s => {
        const ca = (s.comunidad_autonoma ?? '').toLowerCase();
        const amb = (s.ambito_geografico ?? '').toLowerCase();
        return ca.includes('galicia') ||
          ['nacional', 'estatal', 'europeo', 'europe', 'ue'].some(k => amb.includes(k)) ||
          !ca;
      })
    : (subvenciones ?? []);
  console.log(`Subvenciones: ${subvenciones?.length} total → ${subvFiltradas.length} tras filtro`);

  if (!subvFiltradas.length) {
    console.log('Sin subvenciones activas. Termina.');
    return;
  }

  // Cargar tablas auxiliares (sectores, tipos, requisitos, gastos, beneficiarios)
  const subvIds = subvFiltradas.map(s => s.id);
  const [
    { data: sectores },
    { data: tipos },
    { data: requisitos },
    { data: gastos },
    { data: camposBeneficiarios },
  ] = await Promise.all([
    sb.from('subvencion_sectores').select('subvencion_id,cnae_codigo,nombre_sector,excluido').in('subvencion_id', subvIds),
    sb.from('subvencion_tipos_empresa').select('subvencion_id,tipo,excluido').in('subvencion_id', subvIds),
    sb.from('subvencion_requisitos').select('subvencion_id,tipo,descripcion,obligatorio').in('subvencion_id', subvIds),
    sb.from('subvencion_gastos').select('subvencion_id,categoria,descripcion,porcentaje_max').in('subvencion_id', subvIds),
    sb.from('subvencion_campos_extraidos')
      .select('subvencion_id,nombre_campo,valor_texto,valor_json')
      .in('subvencion_id', subvIds)
      .in('nombre_campo', ['beneficiarios', 'para_quien']),
  ]);

  // Construir mapa de beneficiarios
  const beneficiariosMap = {};
  const paraQuienMap = {};
  for (const campo of camposBeneficiarios ?? []) {
    if (campo.nombre_campo === 'beneficiarios' && campo.valor_json) {
      const arr = Array.isArray(campo.valor_json) ? campo.valor_json : typeof campo.valor_json === 'string' ? [campo.valor_json] : [];
      if (arr.length > 0) beneficiariosMap[campo.subvencion_id] = arr;
    } else if (campo.nombre_campo === 'para_quien' && campo.valor_texto) {
      paraQuienMap[campo.subvencion_id] = campo.valor_texto;
    }
  }

  // Construir perfiles de subvenciones
  const subvProfiles = subvFiltradas.map(s => ({
    ...s,
    sectores: (sectores ?? []).filter(sec => sec.subvencion_id === s.id),
    tipos_empresa: (tipos ?? []).filter(t => t.subvencion_id === s.id),
    requisitos: (requisitos ?? []).filter(r => r.subvencion_id === s.id),
    gastos: (gastos ?? []).filter(g => g.subvencion_id === s.id),
    beneficiarios_texto: beneficiariosMap[s.id],
    para_quien: paraQuienMap[s.id] ?? s.para_quien,
  }));

  // Stats de v2 data
  const conV2 = subvProfiles.filter(s => tieneDataV2(s)).length;
  console.log(`Subvenciones con datos v2: ${conV2}/${subvProfiles.length} (${Math.round(conV2 / subvProfiles.length * 100)}%)`);

  // ─── Modo --all: pizarra limpia ────────────────────────────────────────────
  const estadoMap = {};
  if (forceAll) {
    const clienteNifs = clientes.map(c => c.nif);
    const { data: existentes } = await sb
      .from('cliente_subvencion_match')
      .select('nif, subvencion_id, estado')
      .in('nif', clienteNifs)
      .in('estado', ['interesado', 'descartado', 'visto']);
    for (const e of existentes ?? []) {
      estadoMap[`${e.nif}|${e.subvencion_id}`] = e.estado;
    }
    const { error: delErr } = await sb
      .from('cliente_subvencion_match')
      .delete()
      .in('nif', clienteNifs);
    if (delErr) {
      console.error('Error borrando filas existentes:', delErr.message);
      process.exit(1);
    }
    console.log(`Modo --all: eliminadas filas previas. Preservados ${(existentes ?? []).length} estados manuales.`);
  }

  // ─── Calcular matches ──────────────────────────────────────────────────────
  let guardados = 0, excluidos = 0, bajos = 0;
  let v1Count = 0, v2Count = 0;
  const MIN_SCORE = 0.35;

  for (const cliente of clientes) {
    const toSave = [];

    for (const subv of subvProfiles) {
      const result = calcularMatch(cliente, subv);

      if (result.version === 'v2') v2Count++;
      else v1Count++;

      if (result.hard_exclude) {
        toSave.push({
          nif: cliente.nif,
          subvencion_id: subv.id,
          score: 0,
          detalle_scoring: result.detalle,
          motivos: [],
          estado: 'nuevo',
          notificado_admin: false,
          notificado_cliente: false,
          es_hard_exclude: true,
          calculado_at: new Date().toISOString(),
        });
        excluidos++;
      } else if (result.score >= MIN_SCORE) {
        const key = `${cliente.nif}|${subv.id}`;
        const estadoExistente = estadoMap[key];
        const estado = (estadoExistente && ['interesado', 'descartado', 'visto'].includes(estadoExistente))
          ? estadoExistente
          : 'nuevo';
        toSave.push({
          nif: cliente.nif,
          subvencion_id: subv.id,
          score: result.score,
          detalle_scoring: result.detalle,
          motivos: result.motivos,
          estado,
          notificado_admin: false,
          notificado_cliente: false,
          es_hard_exclude: false,
          calculado_at: new Date().toISOString(),
        });
        guardados++;
      } else {
        bajos++;
      }
    }

    if (toSave.length > 0) {
      for (let i = 0; i < toSave.length; i += 50) {
        const lote = toSave.slice(i, i + 50);
        const { error } = await sb
          .from('cliente_subvencion_match')
          .upsert(lote, { onConflict: 'nif,subvencion_id', ignoreDuplicates: false });
        if (error) {
          console.error(`  Error upsert para ${cliente.nif}:`, error.message);
        }
      }
      const relevantes = toSave.filter(m => !m.es_hard_exclude).length;
      if (relevantes > 0) {
        console.log(`  ${cliente.nombre_empresa || cliente.nif}: ${relevantes} matches relevantes`);
      }
    }
  }

  console.log(`\n📊 Resumen:`);
  console.log(`  Clientes procesados:  ${clientes.length}`);
  console.log(`  Subvenciones activas: ${subvFiltradas.length}`);
  console.log(`  Matches relevantes:   ${guardados}`);
  console.log(`  Hard excludes:        ${excluidos}`);
  console.log(`  Score bajo (< ${MIN_SCORE * 100}%): ${bajos}`);
  console.log(`\n🔄 Motor usado:`);
  console.log(`  v2 (campos_extraidos): ${v2Count} evaluaciones`);
  console.log(`  v1 (legacy):           ${v1Count} evaluaciones`);

  // Top 10
  const { data: top } = await sb
    .from('cliente_subvencion_match')
    .select('nif,score,subvencion:subvencion_id(titulo),cliente:nif(nombre_empresa)')
    .order('score', { ascending: false })
    .limit(10);

  if (top?.length) {
    console.log('\n🏆 Top 10 matches:');
    for (const m of top) {
      console.log(`  ${m.score}% — ${m.cliente?.nombre_empresa || m.nif} → ${m.subvencion?.titulo?.slice(0, 60) || 'N/A'}`);
    }
  }

  console.log('\n✅ Matching v2 completado.');
}

main().catch(console.error);
