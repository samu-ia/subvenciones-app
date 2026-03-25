/**
 * lib/matching/engine.ts
 *
 * Motor de matching DETERMINISTA cliente ↔ subvención.
 * No usa IA. Calcula un score 0-1 basado en reglas explícitas.
 *
 * Dimensiones:
 *   · Geografía     (30 pts) — más importante: si es autonómica y no coincide = excluida
 *   · Tipo empresa  (25 pts) — tamaño/forma jurídica
 *   · Sector CNAE   (20 pts) — código CNAE del cliente vs sectores de la subvención
 *   · Estado        (15 pts) — abierta > próxima > desconocido > cerrada=0
 *   · Importe       (10 pts) — importes razonables para el tamaño de empresa
 *
 * Hard excludes (score = 0 automáticamente):
 *   · estado_convocatoria === 'cerrada' o 'suspendida'
 *   · ámbito autonómico y CA no coincide
 *   · ámbito local y ciudad/provincia no coincide
 *   · sector del cliente está explícitamente excluido en la subvención
 *   · tipo de empresa del cliente está explícitamente excluido
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
  // Tablas relacionadas
  sectores?: Array<{ cnae_codigo?: string; nombre_sector: string; excluido: boolean }>;
  tipos_empresa?: Array<{ tipo: string; excluido: boolean }>;
  requisitos?: Array<{ tipo: string; descripcion: string; obligatorio: boolean }>;
}

export interface MatchScore {
  score: number;                       // 0-1 normalizado
  score_raw: number;                   // 0-100 puntos brutos
  hard_exclude: boolean;
  hard_exclude_razon?: string;
  detalle: {
    geografia: number;                 // 0-30
    tipo_empresa: number;              // 0-25
    sector: number;                    // 0-20
    estado: number;                    // 0-15
    importe: number;                   // 0-10
  };
  motivos: string[];                   // frases positivas para mostrar al cliente
  alertas: string[];                   // posibles incompatibilidades
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

function normCA(s?: string): string {
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
  'pequeña':    ['pyme'],
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

function tiposCliente(cliente: ClienteMatchProfile): string[] {
  const tipos = new Set<string>();

  const tamano = (cliente.tamano_empresa ?? '').toLowerCase();
  const forma = (cliente.forma_juridica ?? '').toLowerCase();

  // Por tamaño
  const emp = cliente.num_empleados ?? 0;
  const fac = cliente.facturacion_anual ?? 0;
  if (emp <= 10 || fac <= 2_000_000) tipos.add('micropyme');
  if (emp <= 250 || fac <= 50_000_000) tipos.add('pyme');
  if (emp > 250) tipos.add('grande');

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

// ─── Algoritmo de scoring ────────────────────────────────────────────────────

export function calcularMatch(
  cliente: ClienteMatchProfile,
  subvencion: SubvencionMatchProfile,
): MatchScore {
  const motivos: string[] = [];
  const alertas: string[] = [];

  // ── HARD EXCLUDES ─────────────────────────────────────────────────────────

  // 1. Convocatoria cerrada o suspendida
  if (subvencion.estado_convocatoria === 'cerrada') {
    return hard('Convocatoria cerrada.', { geografia: 0, tipo_empresa: 0, sector: 0, estado: 0, importe: 0 });
  }
  if (subvencion.estado_convocatoria === 'suspendida') {
    return hard('Convocatoria suspendida.', { geografia: 0, tipo_empresa: 0, sector: 0, estado: 0, importe: 0 });
  }

  // 2. Exclusión de sector CNAE
  if (subvencion.sectores?.length) {
    const clienteCnae = (cliente.cnae_codigo ?? '').slice(0, 4);
    const excluidos = subvencion.sectores.filter(s => s.excluido);
    for (const exc of excluidos) {
      const cnaeExc = (exc.cnae_codigo ?? '').slice(0, 4);
      if (cnaeExc && clienteCnae && clienteCnae === cnaeExc) {
        return hard(`Tu sector (CNAE ${clienteCnae}) está excluido en esta convocatoria.`,
          { geografia: 0, tipo_empresa: 0, sector: 0, estado: 0, importe: 0 });
      }
    }
  }

  // 3. Exclusión de tipo empresa
  const tiposClienteList = tiposCliente(cliente);
  if (subvencion.tipos_empresa?.length) {
    const excluidos = subvencion.tipos_empresa.filter(t => t.excluido);
    for (const exc of excluidos) {
      if (tiposClienteList.includes(exc.tipo)) {
        return hard(`Tu tipo de empresa (${exc.tipo}) está excluido.`,
          { geografia: 0, tipo_empresa: 0, sector: 0, estado: 0, importe: 0 });
      }
    }
  }

  // ── DIMENSIÓN GEOGRAFÍA (0-30) ─────────────────────────────────────────────
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
      geo = 10; // no sabemos la CA del cliente, puntuación parcial
      alertas.push('No tenemos tu comunidad autónoma registrada para verificar ámbito autonómico');
    } else if (subvCA && clienteCA === subvCA) {
      geo = 28;
      motivos.push(`Tu empresa está en ${clienteCA}, igual que la convocatoria`);
    } else if (subvCA && clienteCA !== subvCA) {
      return hard(`Esta convocatoria es solo para ${subvCA} y tu empresa está en ${clienteCA}.`,
        { geografia: 0, tipo_empresa: 0, sector: 0, estado: 0, importe: 0 });
    } else {
      geo = 15; // CA de la subvención desconocida
    }
  } else if (ambito === 'local') {
    if (subvProv && clienteProv && subvProv.includes(clienteProv.slice(0, 5))) {
      geo = 20;
      motivos.push('Convocatoria local y tu empresa está en la misma provincia');
    } else if (subvProv && clienteProv) {
      return hard(`Convocatoria local para ${subvProv}, tu empresa está en ${clienteProv || 'otra provincia'}.`,
        { geografia: 0, tipo_empresa: 0, sector: 0, estado: 0, importe: 0 });
    } else if (!subvProv && subvCA && clienteCA && subvCA !== clienteCA) {
      // Sin provincia pero con localidad/CA distinta → excluir (ej. municipio de otra región)
      return hard(`Convocatoria local para ${subvCA}, tu empresa está en ${clienteCA}.`,
        { geografia: 0, tipo_empresa: 0, sector: 0, estado: 0, importe: 0 });
    } else {
      geo = 8; // sin datos suficientes de localización
      alertas.push('Convocatoria local — verifica si aplica a tu municipio');
    }
  } else {
    geo = 15; // ámbito desconocido
  }

  // ── DIMENSIÓN TIPO EMPRESA (0-25) ─────────────────────────────────────────
  let tipo = 0;
  if (!subvencion.tipos_empresa?.length) {
    tipo = 18; // sin restricción de tipo → aplica genéricamente
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
  let sectorMismatch = false; // true cuando hay sectores definidos pero el cliente no encaja
  let confirmedCnaeMismatch = false; // mismatch confirmado por CNAE (penalización extra)
  const clienteCnae = (cliente.cnae_codigo ?? '').slice(0, 4);
  const clienteCnae2 = clienteCnae.slice(0, 2); // división CNAE

  if (!subvencion.sectores?.length) {
    sector = 12; // sin restricción de sector → genérica
  } else {
    const permitidos = subvencion.sectores.filter(s => !s.excluido);
    if (!permitidos.length) {
      sector = 12;
    } else {
      // Buscar match exacto (4 dígitos) o parcial (2 dígitos)
      const exactMatch = permitidos.some(s => s.cnae_codigo?.slice(0, 4) === clienteCnae && clienteCnae);
      const divMatch = permitidos.some(s => s.cnae_codigo?.slice(0, 2) === clienteCnae2 && clienteCnae2);
      // Sectores con CNAE: si existen y no hay match exacto/div, el cliente no encaja
      const permitidosConCnae = permitidos.filter(s => s.cnae_codigo);
      // Keyword bidireccional: solo cuando los sectores NO tienen CNAE (evitar falsos positivos con palabras genéricas)
      const clienteDesc = (cliente.cnae_descripcion ?? '').toLowerCase();
      const keyword = permitidosConCnae.length === 0 && permitidos.some(s => {
        if (!s.nombre_sector) return false;
        const sectorLower = s.nombre_sector.toLowerCase();
        const STOP = new Set(['actividades', 'actividad', 'empresa', 'empresas', 'servicio', 'servicios', 'sector', 'sectores']);
        // Palabras específicas del sector en descripción del cliente
        const sectorEnCliente = sectorLower.split(/\s+/).some(w => w.length > 5 && !STOP.has(w) && clienteDesc.includes(w));
        // Palabras específicas del cliente en nombre del sector
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
        // Sectores definidos pero el cliente no encaja — penalización fuerte
        sector = 0;
        sectorMismatch = true;
        // Mismatch confirmado por CNAE explícito, O por palabras exclusivas del sector primario
        const EXCLUSIVE = ['agricultur', 'ganadería', 'ganaderia', 'silvicultur', 'forestal', 'pesca', 'acuicultur', 'minería', 'mineria', 'alimentación', 'alimentacion', 'agroaliment'];
        const CNAE_PRIMARIO = ['01', '02', '03', '05', '06', '07', '08', '09', '10', '11', '12'];
        const esExclusivo = permitidos.some(s => EXCLUSIVE.some(ex => (s.nombre_sector ?? '').toLowerCase().includes(ex)));
        const clienteEsPrimario = clienteCnae2 && CNAE_PRIMARIO.includes(clienteCnae2);
        if (permitidosConCnae.length > 0 || (esExclusivo && !clienteEsPrimario)) confirmedCnaeMismatch = true;
        alertas.push(`La convocatoria está orientada a sectores distintos al tuyo (${clienteDesc || `CNAE ${clienteCnae}`})`);
      }
    }
  }

  // ── DIMENSIÓN ESTADO (0-15) ────────────────────────────────────────────────
  let estado = 0;
  const diasCierre = subvencion.plazo_fin
    ? Math.ceil((new Date(subvencion.plazo_fin).getTime() - Date.now()) / 86_400_000)
    : null;

  switch (subvencion.estado_convocatoria) {
    case 'abierta':
      estado = diasCierre !== null && diasCierre <= 15 ? 12 : 15;
      if (diasCierre !== null && diasCierre <= 15) {
        alertas.push(`⚡ Quedan solo ${diasCierre} días para el cierre del plazo`);
      } else {
        motivos.push('Convocatoria actualmente abierta');
      }
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
      estado = 7; // desconocido
  }

  // ── DIMENSIÓN IMPORTE (0-10) ───────────────────────────────────────────────
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

  // ── SCORE FINAL ────────────────────────────────────────────────────────────
  const detalle = { geografia: geo, tipo_empresa: tipo, sector, estado, importe };
  let score_raw = geo + tipo + sector + estado + importe;

  // Si hay sector definido pero el cliente no encaja, la subvención no es relevante.
  // · confirmedCnaeMismatch (sector tiene CNAE explícito que no encaja): cap a 25 → nunca muestra
  // · sectorMismatch sin CNAE (etiqueta de sector ambigua): cap a 39 → puede mostrar con aviso
  if (confirmedCnaeMismatch) {
    score_raw = Math.min(score_raw, 25); // Por debajo del MIN_SCORE (35%) → no se muestra
  } else if (sectorMismatch) {
    score_raw = Math.min(score_raw, 39); // Por debajo de "Buen encaje" (40%) pero puede mostrarse
  }

  const score = Math.min(1, score_raw / 100);

  return {
    score: Math.round(score * 100) / 100,
    score_raw,
    hard_exclude: false,
    detalle,
    motivos,
    alertas,
  };
}

function hard(razon: string, detalle: MatchScore['detalle']): MatchScore {
  return { score: 0, score_raw: 0, hard_exclude: true, hard_exclude_razon: razon, detalle, motivos: [], alertas: [razon] };
}

function fmtImporte(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M€`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K€`;
  return `${n}€`;
}

// ─── Motor masivo ─────────────────────────────────────────────────────────────

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
