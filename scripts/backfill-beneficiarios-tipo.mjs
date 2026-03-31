/**
 * backfill-beneficiarios-tipo.mjs
 *
 * Normaliza beneficiarios_tipo para subvenciones donde es null
 * usando tipos_beneficiario_api que ya está en campos_extraidos.
 *
 * También normaliza porcentaje_ayuda desde porcentaje_financiacion
 * y deriva localizacion desde comunidad_autonoma cuando falta.
 *
 * Uso: node scripts/backfill-beneficiarios-tipo.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envFile = readFileSync('.env.local', 'utf-8');
const env = Object.fromEntries(
  envFile.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Limpia strings tipo "ES11 - GALICIA" → "Galicia", "XXXX - TODO EL MUNDO" → "Nacional"
const CCAA_MAP = {
  GALICIA: 'Galicia', 'PAÍS VASCO': 'País Vasco', 'COMUNIDAD VALENCIANA': 'Comunidad Valenciana',
  'COMUNIDAD DE MADRID': 'Comunidad de Madrid', CATALUÑA: 'Cataluña', CATALUNYA: 'Catalunya',
  ANDALUCÍA: 'Andalucía', ANDALUCIA: 'Andalucía', ARAGÓN: 'Aragón', ARAGON: 'Aragón',
  'CASTILLA Y LEÓN': 'Castilla y León', 'CASTILLA-LA MANCHA': 'Castilla-La Mancha',
  EXTREMADURA: 'Extremadura', ASTURIAS: 'Asturias', CANTABRIA: 'Cantabria',
  'LA RIOJA': 'La Rioja', MURCIA: 'Murcia', NAVARRA: 'Navarra',
  'ISLAS BALEARES': 'Islas Baleares', 'CANARIAS': 'Canarias',
  'CEUTA': 'Ceuta', 'MELILLA': 'Melilla',
};

function limpiarComunidad(str) {
  if (!str) return str;
  // "XXXX - TODO EL MUNDO" o "TODO EL MUNDO" → Nacional
  if (/TODO EL MUNDO|ESPAÑA ENTERA/i.test(str)) return 'Nacional';
  // "ES11 - GALICIA" → extraer la parte después del guión
  const matchCod = str.match(/^[A-Z0-9]{2,5}\s*-\s*(.+)$/);
  const nombre = matchCod ? matchCod[1].trim() : str.trim();
  // Buscar en el mapa de CCAA
  const key = Object.keys(CCAA_MAP).find(k => nombre.toUpperCase().includes(k));
  return key ? CCAA_MAP[key] : nombre;
}

function normalizarBeneficiarioTipoDesdeApi(bens) {
  if (!bens?.length) return null;
  const joined = bens.join(' ').toLowerCase();
  if (joined.includes('microempresa') || joined.includes('micro')) return 'micropyme';
  if (joined.includes('pyme') || joined.includes('pequeña') || joined.includes('mediana') || joined.includes('personas físicas que desarrollan')) return 'pyme';
  if (joined.includes('gran empresa') || joined.includes('grandes empresas')) return 'gran_empresa';
  if (joined.includes('autónom') || joined.includes('autonomo') || joined.includes('personas físicas que no desarrollan')) return 'autónomos';
  if (joined.includes('empresa')) return 'pyme';
  return null;
}

async function main() {
  console.log('🔄 Backfill beneficiarios_tipo + campos faltantes...\n');

  // Fetch all with campos_extraidos
  const { data: subs, error } = await sb
    .from('subvenciones')
    .select('id, bdns_id, campos_extraidos, porcentaje_financiacion, comunidad_autonoma, ambito_geografico')
    .not('campos_extraidos', 'is', null);

  if (error) { console.error('Error fetching:', error.message); process.exit(1); }
  console.log(`📋 ${subs.length} subvenciones con campos_extraidos\n`);

  let updated = 0, skipped = 0;

  for (const sub of subs) {
    const ce = sub.campos_extraidos ?? {};
    let changed = false;

    // 1. beneficiarios_tipo desde tipos_beneficiario_api
    if (!ce.beneficiarios_tipo && ce.tipos_beneficiario_api?.length) {
      const bt = normalizarBeneficiarioTipoDesdeApi(ce.tipos_beneficiario_api);
      if (bt) { ce.beneficiarios_tipo = bt; changed = true; }
    }

    // 2. porcentaje_ayuda desde porcentaje_financiacion de la tabla
    if (!ce.porcentaje_ayuda && sub.porcentaje_financiacion) {
      ce.porcentaje_ayuda = sub.porcentaje_financiacion;
      changed = true;
    }

    // 3. localizacion desde comunidad_autonoma/ambito_geografico
    if (!ce.localizacion) {
      if (sub.ambito_geografico === 'nacional') {
        ce.localizacion = ['Nacional'];
        changed = true;
      } else if (sub.comunidad_autonoma) {
        ce.localizacion = [limpiarComunidad(sub.comunidad_autonoma)];
        changed = true;
      }
    } else {
      // Limpiar códigos ISO tipo "ES11 - GALICIA"
      const limpias = ce.localizacion.map(limpiarComunidad);
      if (JSON.stringify(limpias) !== JSON.stringify(ce.localizacion)) {
        ce.localizacion = limpias;
        changed = true;
      }
    }

    if (!changed) { skipped++; continue; }

    const { error: upErr } = await sb
      .from('subvenciones')
      .update({ campos_extraidos: ce })
      .eq('id', sub.id);

    if (upErr) {
      console.error(`❌ #${sub.bdns_id}: ${upErr.message}`);
    } else {
      console.log(`✅ #${sub.bdns_id}: beneficiarios=${ce.beneficiarios_tipo ?? '-'} | %ayuda=${ce.porcentaje_ayuda ?? '-'} | loc=${ce.localizacion?.[0] ?? '-'}`);
      updated++;
    }
  }

  console.log(`\n📊 Resultado: ${updated} actualizadas, ${skipped} ya correctas`);
}

main().catch(console.error);
