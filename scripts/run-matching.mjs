/**
 * scripts/run-matching.mjs
 *
 * Runs the full matching engine (same logic as /api/matching/run) directly
 * without needing the Next.js server running.
 *
 * Usage: node scripts/run-matching.mjs [nif]
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
const GALICIA_FOCUS = !forceAll && env.GALICIA_FOCUS !== 'false';

// ─── Engine (ported from lib/matching/engine.ts) ──────────────────────────────

const CA_ALIAS = {
  'Madrid':          ['madrid', 'comunidad de madrid', 'com. de madrid'],
  'Cataluña':        ['cataluña', 'catalunya', 'catalonia'],
  'Andalucía':       ['andalucía', 'andalucia'],
  'Valencia':        ['valencia', 'comunitat valenciana', 'comunidad valenciana'],
  'Galicia':         ['galicia'],
  'Castilla y León': ['castilla y leon', 'castilla y león'],
  'País Vasco':      ['país vasco', 'pais vasco', 'euskadi'],
  'Canarias':        ['canarias'],
  'Murcia':          ['murcia', 'región de murcia'],
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
  if (emp <= 10 || fac <= 2_000_000) tipos.add('micropyme');
  if (emp <= 250 || fac <= 50_000_000) tipos.add('pyme');
  if (emp > 250) tipos.add('grande');
  if (forma.includes('autón') || forma === 'autonomo') tipos.add('autonomo');
  if (forma.includes('startup') || (cliente.anos_antiguedad ?? 99) <= 5) tipos.add('startup');
  if (forma.includes('cooperat') || forma.includes('asocia') || forma.includes('fundac')) tipos.add('otro');
  for (const [key, vals] of Object.entries(TAMANO_A_TIPO)) {
    if (tamano.includes(key)) vals.forEach(v => tipos.add(v));
  }
  if (tipos.size === 0) tipos.add('pyme');
  return [...tipos];
}

function hard(razon) {
  return { score: 0, score_raw: 0, hard_exclude: true, hard_exclude_razon: razon, detalle: { geografia: 0, tipo_empresa: 0, sector: 0, estado: 0, importe: 0 }, motivos: [], alertas: [razon] };
}

function calcularMatch(cliente, subvencion) {
  const motivos = [];
  const alertas = [];

  if (subvencion.estado_convocatoria === 'cerrada') return hard('Convocatoria cerrada.');
  if (subvencion.estado_convocatoria === 'suspendida') return hard('Convocatoria suspendida.');

  const clienteCnae = (cliente.cnae_codigo ?? '').slice(0, 4);
  if (subvencion.sectores?.length) {
    for (const exc of subvencion.sectores.filter(s => s.excluido)) {
      if (exc.cnae_codigo?.slice(0, 4) === clienteCnae && clienteCnae) {
        return hard(`Sector CNAE ${clienteCnae} excluido.`);
      }
    }
  }

  const tiposClienteList = tiposCliente(cliente);
  if (subvencion.tipos_empresa?.length) {
    for (const exc of subvencion.tipos_empresa.filter(t => t.excluido)) {
      if (tiposClienteList.includes(exc.tipo)) return hard(`Tipo empresa ${exc.tipo} excluido.`);
    }
  }

  // Geografía (0-30)
  let geo = 0;
  const ambito = subvencion.ambito_geografico ?? 'desconocido';
  const clienteCA = normCA(cliente.comunidad_autonoma);
  const subvCA = normCA(subvencion.comunidad_autonoma);
  const subvProv = (subvencion.provincia ?? '').toLowerCase();
  const clienteProv = (cliente.provincia ?? '').toLowerCase();

  if (ambito === 'nacional') {
    geo = 30;
    motivos.push('Convocatoria nacional');
  } else if (ambito === 'autonomico') {
    if (!clienteCA) {
      geo = 10;
    } else if (subvCA && clienteCA === subvCA) {
      geo = 28;
      motivos.push(`Tu empresa está en ${clienteCA}`);
    } else if (subvCA && clienteCA !== subvCA) {
      return hard(`Solo para ${subvCA}, tu empresa está en ${clienteCA}.`);
    } else {
      geo = 15;
    }
  } else if (ambito === 'local') {
    if (subvProv && clienteProv && subvProv.includes(clienteProv.slice(0, 5))) {
      geo = 20;
    } else if (subvProv && clienteProv) {
      return hard(`Local para ${subvProv}.`);
    } else {
      geo = 8;
    }
  } else {
    geo = 15;
  }

  // Tipo empresa (0-25)
  let tipo = 0;
  if (!subvencion.tipos_empresa?.length) {
    tipo = 18;
  } else {
    const permitidos = subvencion.tipos_empresa.filter(t => !t.excluido);
    const match = permitidos.filter(t => tiposClienteList.includes(t.tipo));
    if (match.length > 0) {
      tipo = 25;
      motivos.push(`Tipo de empresa encaja`);
    } else if (permitidos.length === 0) {
      tipo = 18;
    } else {
      tipo = 5;
      alertas.push(`Orientada a: ${permitidos.map(t => t.tipo).join(', ')}`);
    }
  }

  // Sector CNAE (0-20)
  let sector = 0;
  let sectorMismatch = false;
  const clienteCnae2 = clienteCnae.slice(0, 2);
  if (!subvencion.sectores?.length) {
    sector = 12;
  } else {
    const permitidos = subvencion.sectores.filter(s => !s.excluido);
    if (!permitidos.length) {
      sector = 12;
    } else {
      const exactMatch = permitidos.some(s => s.cnae_codigo?.slice(0, 4) === clienteCnae && clienteCnae);
      const divMatch = permitidos.some(s => s.cnae_codigo?.slice(0, 2) === clienteCnae2 && clienteCnae2);
      const clienteDesc = (cliente.cnae_descripcion ?? '').toLowerCase();
      const keyword = permitidos.some(s => {
        if (!s.nombre_sector) return false;
        const sectorLower = s.nombre_sector.toLowerCase();
        const sectorEnCliente = sectorLower.split(/\s+/).some(w => w.length > 4 && clienteDesc.includes(w));
        const clienteEnSector = clienteDesc.split(/\s+/).some(w => w.length > 4 && sectorLower.includes(w));
        return sectorEnCliente || clienteEnSector;
      });
      if (exactMatch) { sector = 20; motivos.push(`CNAE ${clienteCnae} encaja`); }
      else if (divMatch || keyword) { sector = 14; motivos.push('Sector dentro del ámbito'); }
      else { sector = 0; sectorMismatch = true; alertas.push('Sectores específicos distintos al tuyo'); }
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
  if (!maxSubv || fac <= 0) {
    importe = 5;
  } else {
    const ratio = maxSubv / fac;
    if (ratio >= 0.02 && ratio <= 2) { importe = 10; if (maxSubv >= 50_000) motivos.push(`Hasta ${fmtImporte(maxSubv)}`); }
    else if (ratio < 0.02) { importe = 4; }
    else { importe = 7; }
  }

  const detalle = { geografia: geo, tipo_empresa: tipo, sector, estado, importe };
  let score_raw = geo + tipo + sector + estado + importe;
  if (sectorMismatch) score_raw = Math.min(score_raw, 39);
  const score = Math.min(1, score_raw / 100);
  return { score: Math.round(score * 100) / 100, score_raw, hard_exclude: false, detalle, motivos, alertas };
}

function fmtImporte(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M€`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K€`;
  return `${n}€`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Iniciando matching${filtroNif ? ` para NIF ${filtroNif}` : ' masivo'}...`);
  console.log(`GALICIA_FOCUS: ${GALICIA_FOCUS}`);

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
    .select('id,bdns_id,titulo,organismo,ambito_geografico,comunidad_autonoma,provincia,estado_convocatoria,importe_maximo,importe_minimo,presupuesto_total,plazo_fin')
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
  console.log(`Subvenciones: ${subvenciones?.length} total → ${subvFiltradas.length} tras filtro Galicia`);

  if (!subvFiltradas.length) {
    console.log('Sin subvenciones activas. Termina.');
    return;
  }

  // Cargar sectores y tipos relacionados
  const subvIds = subvFiltradas.map(s => s.id);
  const [{ data: sectores }, { data: tipos }] = await Promise.all([
    sb.from('subvencion_sectores').select('subvencion_id,cnae_codigo,nombre_sector,excluido').in('subvencion_id', subvIds),
    sb.from('subvencion_tipos_empresa').select('subvencion_id,tipo,excluido').in('subvencion_id', subvIds),
  ]);

  // Construir perfiles de subvenciones
  const subvProfiles = subvFiltradas.map(s => ({
    ...s,
    sectores: (sectores ?? []).filter(sec => sec.subvencion_id === s.id),
    tipos_empresa: (tipos ?? []).filter(t => t.subvencion_id === s.id),
  }));

  // Calcular matches
  let nuevos = 0, actualizados = 0, excluidos = 0;
  const MIN_SCORE = 0.45; // 45 pts mínimo para guardar

  for (const cliente of clientes) {
    const matchesCliente = [];

    for (const subv of subvProfiles) {
      const result = calcularMatch(cliente, subv);
      if (result.hard_exclude || result.score < MIN_SCORE) {
        excluidos++;
        continue;
      }
      matchesCliente.push({
        nif: cliente.nif,
        subvencion_id: subv.id,
        score: result.score,          // decimal 0-1 (portal lo multiplica × 100 para mostrar %)
        detalle_scoring: result.detalle,
        motivos: result.motivos,
        estado: 'nuevo',
        notificado_admin: false,
        notificado_cliente: false,
      });
    }

    if (matchesCliente.length > 0) {
      // Upsert en lotes de 50
      for (let i = 0; i < matchesCliente.length; i += 50) {
        const lote = matchesCliente.slice(i, i + 50);
        const { error } = await sb
          .from('cliente_subvencion_match')
          .upsert(lote, { onConflict: 'nif,subvencion_id', ignoreDuplicates: false });
        if (error) {
          console.error(`  Error upsert para ${cliente.nif}:`, error.message);
        } else {
          nuevos += lote.length;
        }
      }
      console.log(`  ${cliente.nombre_empresa || cliente.nif}: ${matchesCliente.length} matches (score >= ${MIN_SCORE * 100})`);
    }
  }

  console.log(`\nResumen:`);
  console.log(`  Clientes procesados:  ${clientes.length}`);
  console.log(`  Subvenciones activas: ${subvFiltradas.length}`);
  console.log(`  Matches guardados:    ${nuevos}`);
  console.log(`  Excluidos (hard/score): ${excluidos}`);

  // Top 10 mejores matches
  const { data: top } = await sb
    .from('cliente_subvencion_match')
    .select('nif,score,subvencion:subvencion_id(titulo),cliente:nif(nombre_empresa)')
    .order('score', { ascending: false })
    .limit(10);

  if (top?.length) {
    console.log('\nTop 10 matches:');
    for (const m of top) {
      const cliente = m.cliente;
      const subv = m.subvencion;
      console.log(`  ${m.score}% — ${cliente?.nombre_empresa || m.nif} → ${subv?.titulo?.slice(0, 60) || 'N/A'}`);
    }
  }

  console.log('\nMatching completado.');
}

main().catch(console.error);
