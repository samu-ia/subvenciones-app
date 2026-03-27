/**
 * scripts/prospectar.mjs
 *
 * Script de prospección: busca subvenciones activas que encajan con un perfil
 * de empresa (sector + zona) para facilitar la captación de clientes.
 *
 * Genera un CSV en prospection/ y un pitch por cada subvención encontrada.
 *
 * Usage:
 *   node scripts/prospectar.mjs --sector hosteleria --provincia Pontevedra
 *   node scripts/prospectar.mjs --sector construccion --provincia Madrid --cnae 41
 *   node scripts/prospectar.mjs --sector agricultura --provincia Toledo
 *
 * Parámetros:
 *   --sector     Sector de actividad (hosteleria, construccion, agricultura, tecnologia, etc.)
 *   --provincia  Provincia objetivo (Pontevedra, Madrid, Barcelona, etc.)
 *   --cnae       (Opcional) Código CNAE o prefijo para filtrar más fino
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// ─── Load env ───────────────────────────────────────────────────────────────
const envFile = readFileSync('.env.local', 'utf-8');
const env = Object.fromEntries(
  envFile.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// ─── CLI args ───────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}

const sector = getArg('sector');
const provincia = getArg('provincia');
const cnae = getArg('cnae');

if (!sector || !provincia) {
  console.error('❌ Uso: node scripts/prospectar.mjs --sector <sector> --provincia <provincia> [--cnae <codigo>]');
  console.error('');
  console.error('Ejemplos:');
  console.error('  node scripts/prospectar.mjs --sector hosteleria --provincia Pontevedra');
  console.error('  node scripts/prospectar.mjs --sector construccion --provincia Madrid --cnae 41');
  console.error('  node scripts/prospectar.mjs --sector tecnologia --provincia Barcelona');
  console.error('');
  console.error('Sectores comunes: hosteleria, construccion, agricultura, tecnologia,');
  console.error('  comercio, industria, turismo, energia, transporte, alimentacion');
  process.exit(1);
}

// ─── Mapeo de sectores a keywords de búsqueda ──────────────────────────────
const SECTOR_KEYWORDS = {
  hosteleria:    ['hostelería', 'hosteleria', 'restauración', 'restauracion', 'hotel', 'alojamiento', 'turismo', 'bar', 'cafetería'],
  construccion:  ['construcción', 'construccion', 'edificación', 'edificacion', 'obra', 'rehabilitación', 'reforma', 'vivienda'],
  agricultura:   ['agricultura', 'agrícola', 'agricola', 'agroalimentario', 'ganadería', 'ganaderia', 'pesca', 'forestal', 'rural'],
  tecnologia:    ['tecnología', 'tecnologia', 'digital', 'software', 'TIC', 'informática', 'informatica', 'innovación', 'I+D', 'startup'],
  comercio:      ['comercio', 'comercial', 'retail', 'venta', 'distribución', 'distribución', 'mercado'],
  industria:     ['industria', 'industrial', 'manufactura', 'fabricación', 'fabricacion', 'producción', 'produccion', 'fábrica'],
  turismo:       ['turismo', 'turístico', 'turistico', 'alojamiento', 'hostelería', 'ocio', 'viaje'],
  energia:       ['energía', 'energia', 'renovable', 'solar', 'fotovoltaica', 'eólica', 'eficiencia energética', 'sostenibilidad'],
  transporte:    ['transporte', 'logística', 'logistica', 'movilidad', 'vehículo', 'flota'],
  alimentacion:  ['alimentación', 'alimentacion', 'alimentario', 'agroalimentario', 'conservera', 'bodega', 'vino'],
  formacion:     ['formación', 'formacion', 'empleo', 'capacitación', 'contratación', 'contratacion'],
  medioambiente: ['medio ambiente', 'medioambiental', 'residuos', 'reciclaje', 'economía circular', 'sostenible'],
};

const sectorLower = sector.toLowerCase();
const keywords = SECTOR_KEYWORDS[sectorLower] || [sector]; // Si no hay mapeo, usa el texto directamente

// ─── Mapeo de provincia a comunidad autónoma ────────────────────────────────
const PROVINCIA_CA = {
  'a coruña': 'Galicia', 'coruña': 'Galicia', 'lugo': 'Galicia', 'ourense': 'Galicia', 'pontevedra': 'Galicia',
  'madrid': 'Madrid', 'barcelona': 'Cataluña', 'girona': 'Cataluña', 'lleida': 'Cataluña', 'tarragona': 'Cataluña',
  'valencia': 'Valencia', 'alicante': 'Valencia', 'castellón': 'Valencia', 'castellon': 'Valencia',
  'sevilla': 'Andalucía', 'málaga': 'Andalucía', 'malaga': 'Andalucía', 'cádiz': 'Andalucía', 'cadiz': 'Andalucía',
  'granada': 'Andalucía', 'córdoba': 'Andalucía', 'cordoba': 'Andalucía', 'jaén': 'Andalucía', 'jaen': 'Andalucía',
  'huelva': 'Andalucía', 'almería': 'Andalucía', 'almeria': 'Andalucía',
  'vizcaya': 'País Vasco', 'guipúzcoa': 'País Vasco', 'guipuzcoa': 'País Vasco', 'álava': 'País Vasco', 'alava': 'País Vasco',
  'bilbao': 'País Vasco', 'san sebastián': 'País Vasco', 'san sebastian': 'País Vasco',
  'zaragoza': 'Aragón', 'huesca': 'Aragón', 'teruel': 'Aragón',
  'murcia': 'Murcia', 'las palmas': 'Canarias', 'santa cruz de tenerife': 'Canarias', 'tenerife': 'Canarias',
  'palma de mallorca': 'Baleares', 'mallorca': 'Baleares', 'ibiza': 'Baleares',
  'valladolid': 'Castilla y León', 'león': 'Castilla y León', 'leon': 'Castilla y León',
  'salamanca': 'Castilla y León', 'burgos': 'Castilla y León', 'zamora': 'Castilla y León',
  'segovia': 'Castilla y León', 'ávila': 'Castilla y León', 'avila': 'Castilla y León',
  'palencia': 'Castilla y León', 'soria': 'Castilla y León',
  'toledo': 'Castilla-La Mancha', 'ciudad real': 'Castilla-La Mancha', 'albacete': 'Castilla-La Mancha',
  'cuenca': 'Castilla-La Mancha', 'guadalajara': 'Castilla-La Mancha',
  'cáceres': 'Extremadura', 'caceres': 'Extremadura', 'badajoz': 'Extremadura',
  'oviedo': 'Asturias', 'asturias': 'Asturias', 'gijón': 'Asturias', 'gijon': 'Asturias',
  'pamplona': 'Navarra', 'navarra': 'Navarra',
  'santander': 'Cantabria', 'cantabria': 'Cantabria',
  'logroño': 'La Rioja', 'logrono': 'La Rioja', 'la rioja': 'La Rioja',
};

const provLower = provincia.toLowerCase().trim();
const comunidadAutonoma = PROVINCIA_CA[provLower] || null;

console.log('');
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║           🔍 PROSPECCIÓN DE SUBVENCIONES                    ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log('');
console.log(`  📋 Sector:     ${sector}`);
console.log(`  📍 Provincia:  ${provincia}${comunidadAutonoma ? ` (${comunidadAutonoma})` : ''}`);
if (cnae) console.log(`  🏷️  CNAE:       ${cnae}`);
console.log('');

// ─── Paso 1: Buscar subvenciones activas ────────────────────────────────────
console.log('⏳ Buscando subvenciones activas...');

// Traemos subvenciones activas con plazo abierto
const { data: subvenciones, error: errSub } = await sb
  .from('subvenciones')
  .select('id, bdns_id, titulo, titulo_comercial, organismo, objeto, resumen_ia, para_quien, importe_maximo, importe_minimo, presupuesto_total, plazo_fin, plazo_presentacion, comunidad_autonoma, provincia, ambito_geografico, estado_convocatoria')
  .or('estado_convocatoria.is.null,estado_convocatoria.neq.cerrada')
  .order('plazo_fin', { ascending: true, nullsFirst: false });

if (errSub) {
  console.error('❌ Error consultando subvenciones:', errSub.message);
  process.exit(1);
}

console.log(`  → ${subvenciones.length} subvenciones activas en BD`);

// ─── Paso 2: Filtrar por geografía ──────────────────────────────────────────
function matchGeografia(sub) {
  const ambito = (sub.ambito_geografico ?? '').toLowerCase();
  const ca = (sub.comunidad_autonoma ?? '').toLowerCase();
  const prov = (sub.provincia ?? '').toLowerCase();
  const org = (sub.organismo ?? '').toLowerCase();
  const titulo = (sub.titulo ?? '').toLowerCase();

  // Nacional = aplica a todos
  if (ambito.includes('nacional') || ambito.includes('españa') || ambito.includes('estatal')) return true;
  if (org.includes('ministerio') || org.includes('estado') || org.includes('gobierno de españa')) return true;

  // Match por provincia directa
  if (prov && prov.includes(provLower)) return true;

  // Match por comunidad autónoma
  if (comunidadAutonoma) {
    const caLower = comunidadAutonoma.toLowerCase();
    if (ca.includes(caLower)) return true;
    if (ambito.includes(caLower)) return true;
    if (org.toLowerCase().includes(caLower)) return true;
    if (titulo.includes(caLower)) return true;
  }

  // Match por nombre de provincia en titulo/organismo
  if (titulo.includes(provLower)) return true;
  if (org.includes(provLower)) return true;

  return false;
}

const geoFiltered = subvenciones.filter(matchGeografia);
console.log(`  → ${geoFiltered.length} aplican a ${provincia}${comunidadAutonoma ? ` / ${comunidadAutonoma}` : ''}`);

// ─── Paso 3: Filtrar por sector ─────────────────────────────────────────────
function matchSector(sub) {
  // Buscar en todos los campos de texto relevantes
  const textos = [
    sub.titulo, sub.titulo_comercial, sub.objeto,
    sub.resumen_ia, sub.para_quien
  ].filter(Boolean).join(' ').toLowerCase();

  // Coincidencia por keywords del sector
  for (const kw of keywords) {
    if (textos.includes(kw.toLowerCase())) return true;
  }

  return false;
}

let sectorFiltered = geoFiltered.filter(matchSector);

// Si hay CNAE, filtrar también por la tabla subvencion_sectores
if (cnae) {
  const { data: sectores, error: errSec } = await sb
    .from('subvencion_sectores')
    .select('subvencion_id, cnae_codigo, nombre_sector')
    .or(`cnae_codigo.like.${cnae}%,nombre_sector.ilike.%${sector}%`)
    .eq('excluido', false);

  if (!errSec && sectores?.length) {
    const idsConCnae = new Set(sectores.map(s => s.subvencion_id));
    // Unir: las que ya pasaron el filtro de texto + las que tienen CNAE match
    const cnaeExtras = geoFiltered.filter(s => idsConCnae.has(s.id) && !sectorFiltered.find(sf => sf.id === s.id));
    sectorFiltered = [...sectorFiltered, ...cnaeExtras];
    console.log(`  → ${sectores.length} registros CNAE coincidentes (${cnaeExtras.length} extras)`);
  }
}

// También buscar "genéricas" que aplican a cualquier sector (digitalización, empleo, etc.)
const KEYWORDS_GENERICAS = ['digitalización', 'digitalizacion', 'digital', 'kit digital', 'empleo', 'contratación', 'formación', 'inversión', 'eficiencia energética', 'renovable', 'autoempleo'];
const genericMatches = geoFiltered.filter(sub => {
  if (sectorFiltered.find(sf => sf.id === sub.id)) return false; // ya incluida
  const textos = [sub.titulo, sub.titulo_comercial, sub.objeto, sub.resumen_ia].filter(Boolean).join(' ').toLowerCase();
  return KEYWORDS_GENERICAS.some(kw => textos.includes(kw));
});

const allMatches = [...sectorFiltered, ...genericMatches];
console.log(`  → ${sectorFiltered.length} específicas del sector + ${genericMatches.length} genéricas`);
console.log(`  → ${allMatches.length} subvenciones totales encontradas`);

if (allMatches.length === 0) {
  console.log('');
  console.log('⚠️  No se encontraron subvenciones activas para este perfil.');
  console.log('   Prueba ampliando el sector o cambiando la provincia.');
  process.exit(0);
}

// ─── Paso 4: Calcular totales y preparar datos ─────────────────────────────
const now = new Date();
let importeTotal = 0;
let fechaLimiteCercana = null;

const rows = allMatches.map(sub => {
  const importe = sub.importe_maximo || sub.presupuesto_total || 0;
  importeTotal += importe;

  const plazo = sub.plazo_fin ? new Date(sub.plazo_fin) : null;
  if (plazo && (!fechaLimiteCercana || plazo < fechaLimiteCercana)) {
    fechaLimiteCercana = plazo;
  }

  const diasRestantes = plazo ? Math.ceil((plazo.getTime() - now.getTime()) / 86_400_000) : null;
  const esEspecifica = sectorFiltered.find(sf => sf.id === sub.id) ? 'SI' : 'GENERICA';

  return {
    bdns_id: sub.bdns_id,
    titulo: sub.titulo_comercial || sub.titulo,
    organismo: sub.organismo,
    importe_maximo: importe,
    plazo_fin: sub.plazo_fin || '',
    dias_restantes: diasRestantes,
    para_quien: sub.para_quien || '',
    tipo_match: esEspecifica,
    resumen: sub.resumen_ia || sub.objeto || '',
  };
});

// Ordenar: primero las específicas, luego por plazo más cercano
rows.sort((a, b) => {
  if (a.tipo_match !== b.tipo_match) return a.tipo_match === 'SI' ? -1 : 1;
  if (a.dias_restantes === null && b.dias_restantes === null) return 0;
  if (a.dias_restantes === null) return 1;
  if (b.dias_restantes === null) return -1;
  return a.dias_restantes - b.dias_restantes;
});

// ─── Paso 5: Generar CSV ────────────────────────────────────────────────────
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const filename = `prospection_${sectorLower}_${provLower.replace(/\s+/g, '_')}_${timestamp}.csv`;
const filepath = join('prospection', filename);

// Cabecera del CSV
const csvHeader = 'sector,provincia,bdns_id,titulo,organismo,importe_maximo,plazo_fin,dias_restantes,tipo_match,para_quien,resumen';

function csvEscape(val) {
  const str = String(val ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const csvRows = rows.map(r => [
  csvEscape(sector),
  csvEscape(provincia),
  csvEscape(r.bdns_id),
  csvEscape(r.titulo),
  csvEscape(r.organismo),
  r.importe_maximo,
  csvEscape(r.plazo_fin),
  r.dias_restantes ?? '',
  csvEscape(r.tipo_match),
  csvEscape(r.para_quien),
  csvEscape(r.resumen),
].join(','));

const csvContent = [csvHeader, ...csvRows].join('\n');

mkdirSync('prospection', { recursive: true });
writeFileSync(filepath, csvContent, 'utf-8');

// ─── Paso 6: Resumen y pitches ─────────────────────────────────────────────
console.log('');
console.log('════════════════════════════════════════════════════════════════');
console.log(`  📊 RESUMEN DE PROSPECCIÓN — ${sector.toUpperCase()} en ${provincia}`);
console.log('════════════════════════════════════════════════════════════════');
console.log('');
console.log(`  🎯 Subvenciones encontradas: ${allMatches.length}`);
console.log(`  💰 Importe potencial total:  ${formatImporte(importeTotal)}`);
console.log(`  ⏰ Plazo más cercano:        ${fechaLimiteCercana ? fechaLimiteCercana.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Sin fecha límite'}`);
console.log(`  📁 CSV guardado:             ${filepath}`);
console.log('');

// ─── Pitches ────────────────────────────────────────────────────────────────
console.log('════════════════════════════════════════════════════════════════');
console.log('  📞 PITCHES PARA LLAMADAS (copiar y adaptar)');
console.log('════════════════════════════════════════════════════════════════');

for (const row of rows) {
  const importeStr = row.importe_maximo > 0 ? formatImporte(row.importe_maximo) : 'importe variable';
  const plazoStr = row.plazo_fin
    ? new Date(row.plazo_fin).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
    : 'plazo abierto';
  const diasStr = row.dias_restantes !== null
    ? (row.dias_restantes > 0 ? `(quedan ${row.dias_restantes} días)` : '⚠️ PLAZO VENCIDO')
    : '';

  const nombre = row.titulo.length > 80 ? row.titulo.slice(0, 77) + '...' : row.titulo;
  const tag = row.tipo_match === 'SI' ? '🎯' : '📋';

  console.log('');
  console.log(`${tag} ${nombre}`);
  console.log(`   └─ ${row.organismo || 'Organismo no especificado'} | BDNS: ${row.bdns_id}`);
  console.log('');

  // Pitch de 3 líneas
  console.log(`   "Empresas de ${sector} en ${provincia} pueden conseguir hasta ${importeStr}`);
  console.log(`    para ${extractPurpose(row)}. Plazo: ${plazoStr} ${diasStr}.`);
  console.log(`    Coste para ellos: 0€ hasta cobrar."`);
  console.log('');
  console.log('   ───────────────────────────────────────────────────────');
}

// ─── Resumen final ──────────────────────────────────────────────────────────
console.log('');
console.log('════════════════════════════════════════════════════════════════');
console.log('  📝 RESUMEN PARA HOY');
console.log('════════════════════════════════════════════════════════════════');
console.log('');

const urgentes = rows.filter(r => r.dias_restantes !== null && r.dias_restantes > 0 && r.dias_restantes <= 15);
const proximas = rows.filter(r => r.dias_restantes !== null && r.dias_restantes > 15 && r.dias_restantes <= 30);

if (urgentes.length > 0) {
  console.log(`  🔴 URGENTES (≤15 días): ${urgentes.length} subvenciones`);
  for (const u of urgentes) {
    console.log(`     → ${u.titulo.slice(0, 60)}... (${u.dias_restantes} días)`);
  }
}
if (proximas.length > 0) {
  console.log(`  🟡 PRÓXIMAS (15-30 días): ${proximas.length} subvenciones`);
}
const abiertas = rows.filter(r => r.dias_restantes === null || r.dias_restantes > 30);
if (abiertas.length > 0) {
  console.log(`  🟢 PLAZO AMPLIO (>30 días o sin fecha): ${abiertas.length} subvenciones`);
}

console.log('');
console.log(`  💡 Mensaje sugerido para WhatsApp/email:`);
console.log(`  "Hola [nombre], soy de AyudaPyme. Hay ${allMatches.length} subvenciones abiertas`);
console.log(`   ahora mismo para empresas de ${sector} en ${provincia}, por un total de`);
console.log(`   hasta ${formatImporte(importeTotal)}. Te lo tramitamos gratis hasta que cobres.`);
console.log(`   ¿Te cuento más?"`);
console.log('');
console.log('✅ Prospección completada.');

// ─── Helpers ────────────────────────────────────────────────────────────────
function formatImporte(n) {
  if (!n || n === 0) return '0€';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M€`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k€`;
  return `${n.toLocaleString('es-ES')}€`;
}

function extractPurpose(row) {
  // Extraer el propósito corto de la subvención
  const resumen = row.resumen || row.para_quien || '';
  if (!resumen) return 'mejorar su negocio';

  // Intentar sacar una frase corta útil
  const frases = resumen.split(/[.;]/);
  const frase = frases[0]?.trim();
  if (frase && frase.length < 100) return frase.toLowerCase();
  if (frase) return frase.slice(0, 80).toLowerCase() + '...';
  return 'mejorar su negocio';
}
