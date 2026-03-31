/**
 * scripts/seed-subvenciones.mjs
 *
 * Fetches relevant PYME subvenciones from BDNS, filters by keyword,
 * and inserts directly into the subvenciones table (bypassing the heavy PDF pipeline).
 *
 * Usage: node scripts/seed-subvenciones.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load env vars
const envFile = readFileSync('.env.local', 'utf-8');
const env = Object.fromEntries(
  envFile.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const BDNS_BASE = 'https://www.infosubvenciones.es/bdnstrans/api';

// ─── Palabras clave que indican relevancia PYME ────────────────────────────────
const KW_POSITIVO = [
  'empresa', 'pyme', 'autónomo', 'autonomo', 'emprendedor', 'startup',
  'digitalización', 'digitalizacion', 'digital', 'innovación', 'innovacion',
  'I+D', 'investigación', 'investigacion', 'desarrollo tecnológico', 'tecnología', 'tecnologia',
  'exportación', 'exportacion', 'internacionalización', 'internacionalizacion',
  'competitividad', 'inversión', 'inversion', 'capital', 'financiación',
  'energía renovable', 'eficiencia energética', 'sostenibilidad', 'sostenible',
  'formación profesional', 'empleo', 'contratación', 'contratacion',
  'industria', 'comercio', 'turismo', 'hostelería', 'hosteleria',
  'agroalimentario', 'agroindustria', 'economía social', 'cooperativa',
  'microempresa', 'pequeña empresa', 'mediana empresa',
  'bono', 'kit digital', 'subvención empresas', 'ayuda empresa',
  'minimis', 'de minimis', 'concurrencia competitiva',
  'creación de empresas', 'creacion empresas', 'autoempleo',
  'economía circular', 'transformación digital', 'inteligencia artificial',
  'rehabilitación energética', 'renovables', 'solar', 'fotovoltaica',
];

// Palabras clave que EXCLUYEN la convocatoria
const KW_NEGATIVO = [
  'carnaval', 'teatro', 'deportiv', 'fútbol', 'futbol', 'baloncesto',
  'asociación vecinos', 'asociacion vecinos', 'amas de casa',
  'festividad', 'fiestas patron', 'certamen literario',
  'jubilados', 'mayores', 'tercera edad', 'infancia',
  'premio periodismo', 'concurso dibujo', 'concurso foto',
  'protección civil', 'voluntarios', 'oenegé', 'ong ',
  'hermandad', 'cofradía', 'peña', 'club deportivo',
  'conservatorio', 'orquesta', 'banda música',
  'parroquia', 'cáritas', 'caritas', 'religiosa',
  'nominativa a la asociación', 'nominativa al club',
  'nominativa a favor de la asociación',
  'viajes culturales', 'actividades culturales jubilados',
  'razas ganaderas', 'cría de razas', 'horreo',
  'patrimonio cultural inmueble', 'bienes inmuebles civiles',
];

function esRelevantePyme(descripcion, nivel1) {
  if (!descripcion) return false;
  const desc = descripcion.toLowerCase();

  // Exclude purely local (too small, usually not for PYMEs)
  if (nivel1 === 'LOCAL') return false;

  // Check negatives first (quick exit)
  for (const neg of KW_NEGATIVO) {
    if (desc.includes(neg.toLowerCase())) return false;
  }

  // At least one positive keyword
  return KW_POSITIVO.some(pos => desc.includes(pos.toLowerCase()));
}

async function fetchPagina(pagina, tamanio = 50) {
  // BDNS uses Spring pagination: page=0,1,2... and size=N
  const url = `${BDNS_BASE}/convocatorias/busqueda?page=${pagina}&size=${tamanio}`;
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'SubvencionesApp/1.0' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`BDNS error ${res.status}`);
  return res.json();
}

async function fetchDetalle(id) {
  // Try to get more details from BDNS convocatoria detail
  try {
    const url = `${BDNS_BASE}/convocatorias/${id}`;
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'SubvencionesApp/1.0' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok || res.headers.get('content-type')?.includes('html')) return null;
    const text = await res.text();
    if (text.trim().startsWith('<')) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function inferirAmbito(nivel1, nivel2) {
  if (nivel1 === 'ESTATAL') return 'nacional';
  if (nivel1 === 'AUTONOMICA') return 'autonomico';
  return 'local';
}

function inferirCCA(nivel1, nivel2) {
  if (nivel1 === 'ESTATAL') return null;
  // Map common BDNS level2 names to standard CA names
  const MAPA = {
    'GALICIA': 'Galicia',
    'CATALUÑA': 'Cataluña', 'CATALUNYA': 'Cataluña',
    'MADRID': 'Madrid', 'COMUNIDAD DE MADRID': 'Madrid',
    'ANDALUCÍA': 'Andalucía', 'ANDALUCIA': 'Andalucía',
    'VALENCIANA': 'Valencia', 'COMUNITAT VALENCIANA': 'Valencia',
    'PAÍS VASCO': 'País Vasco', 'EUSKADI': 'País Vasco',
    'ASTURIAS': 'Asturias', 'PRINCIPADO DE ASTURIAS': 'Asturias',
    'CANTABRIA': 'Cantabria',
    'CASTILLA Y LEÓN': 'Castilla y León', 'CASTILLA Y LEON': 'Castilla y León',
    'CASTILLA-LA MANCHA': 'Castilla-La Mancha',
    'ARAGÓN': 'Aragón', 'ARAGON': 'Aragón',
    'NAVARRA': 'Navarra', 'COMUNIDAD FORAL DE NAVARRA': 'Navarra',
    'LA RIOJA': 'La Rioja',
    'EXTREMADURA': 'Extremadura',
    'MURCIA': 'Murcia', 'REGIÓN DE MURCIA': 'Murcia',
    'BALEARES': 'Baleares', 'ILLES BALEARS': 'Baleares',
    'CANARIAS': 'Canarias',
  };
  const n2 = (nivel2 || '').toUpperCase().replace(/\bDE\b|\bDE LA\b/g, '').trim();
  for (const [key, val] of Object.entries(MAPA)) {
    if (n2.includes(key)) return val;
  }
  return nivel2 || null;
}

async function insertarSubvencion(item, detalle) {
  // IMPORTANTE: usar numeroConvocatoria (código BDNS) como bdns_id, NO el id interno
  const bdns_id = String(item.numeroConvocatoria || item.id);
  const titulo = item.descripcion || item.descripcionLeng || 'Sin título';
  const organismo = item.nivel3 || item.nivel2 || null;
  const ambito = inferirAmbito(item.nivel1, item.nivel2);
  const ca = inferirCCA(item.nivel1, item.nivel2);

  // Extract importe from detalle if available
  let importe_maximo = null;
  let plazo_fin = null;
  let objeto = null;
  let url_oficial = null;

  if (detalle) {
    importe_maximo = detalle.importeTotal || detalle.importeMaximo || detalle.presupuestoTotal || null;
    plazo_fin = detalle.fechaFinSolicitud || detalle.fechaFin || detalle.plazoFinSolicitud || null;
    objeto = detalle.objeto || detalle.descripcion || null;
    url_oficial = detalle.urlBDNS || detalle.url || null;
  }

  // Upsert to avoid duplicates
  const { error } = await sb.from('subvenciones').upsert({
    bdns_id,
    titulo,
    organismo,
    ambito_geografico: ambito,
    comunidad_autonoma: ca,
    objeto: objeto || titulo,
    estado_convocatoria: 'abierta',
    pipeline_estado: 'normalizado',
    importe_maximo,
    plazo_fin,
    url_oficial: url_oficial || `https://www.infosubvenciones.es/bdnstrans/GE/es/convocatorias/${bdns_id}`,
    para_quien: 'Empresas y PYMEs',
    resumen_ia: `${titulo}. Organismo: ${organismo || 'Desconocido'}. Ámbito: ${ambito}.`,
    fecha_publicacion: item.fechaRecepcion || null,
    version: 1,
  }, { onConflict: 'bdns_id' });

  if (error) {
    console.error(`  Error insertando ${bdns_id}:`, error.message);
    return false;
  }
  return true;
}

async function main() {
  console.log('🔍 Iniciando ingesta de subvenciones PYME desde BDNS...\n');

  let total_encontradas = 0;
  let total_relevantes = 0;
  let total_insertadas = 0;
  const MAX_PAGINAS = 20; // Primeras 1000 convocatorias abiertas
  const PAGINA_SIZE = 50;

  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    console.log(`📄 Página ${pagina + 1}/${MAX_PAGINAS}...`);

    let datos;
    try {
      datos = await fetchPagina(pagina, PAGINA_SIZE);
    } catch (e) {
      console.error(`  Error en página ${pagina}:`, e.message);
      break;
    }

    const items = datos.content || [];
    if (items.length === 0) break;

    total_encontradas += items.length;

    const relevantes = items.filter(x => esRelevantePyme(x.descripcion || x.descripcionLeng || '', x.nivel1));
    total_relevantes += relevantes.length;

    console.log(`  ${items.length} convocatorias → ${relevantes.length} relevantes para PYME`);

    for (const item of relevantes) {
      // Try to get detail (best effort, skip if fails)
      const detalle = await fetchDetalle(item.id);
      const ok = await insertarSubvencion(item, detalle);
      if (ok) {
        total_insertadas++;
        console.log(`  ✓ [${item.id}] ${(item.descripcion || '').slice(0, 70)}`);
      }
      // Small delay to be respectful of the API
      await new Promise(r => setTimeout(r, 300));
    }

    // Stop if we have enough
    if (total_insertadas >= 200) {
      console.log('\n✅ Límite de 200 subvenciones alcanzado.');
      break;
    }

    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n📊 Resumen:`);
  console.log(`  Total consultadas: ${total_encontradas}`);
  console.log(`  Relevantes PYME:   ${total_relevantes}`);
  console.log(`  Insertadas en BD:  ${total_insertadas}`);

  // Limpiar las que ya no son relevantes (las antiguas que tenemos)
  console.log('\n🧹 Limpiando subvenciones de baja calidad existentes...');
  const { data: existentes } = await sb.from('subvenciones')
    .select('id, titulo, estado_convocatoria')
    .not('estado_convocatoria', 'eq', 'abierta');

  if (existentes && existentes.length > 0) {
    const ids_basura = existentes
      .filter(s => !esRelevantePyme(s.titulo))
      .map(s => s.id);

    if (ids_basura.length > 0) {
      const { error } = await sb.from('subvenciones').delete().in('id', ids_basura);
      if (!error) console.log(`  Eliminadas ${ids_basura.length} subvenciones no relevantes`);
    }
  }

  console.log('\n🎯 Lanzando matching para todos los clientes...');

  // Call matching API
  try {
    const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL?.replace('supabase.co', 'supabase.co') || 'http://localhost:3000'}/api/matching/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.INGEST_SECRET || ''}` },
      body: JSON.stringify({}),
    });
    console.log('  Matching response:', res.status);
  } catch (e) {
    console.log('  (matching se lanzará manualmente)');
  }

  console.log('\n✅ Script completado');
}

main().catch(console.error);
