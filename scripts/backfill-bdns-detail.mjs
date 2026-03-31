/**
 * backfill-bdns-detail.mjs
 *
 * Enriquece las subvenciones existentes con campos del API oficial BDNS:
 *   - presupuesto_total (presupuestoTotal)
 *   - plazo_fin / plazo_inicio (fechaFinSolicitud / fechaInicioSolicitud)
 *   - url_oficial (sedeElectronica)
 *   - tipos_beneficiario (tiposBeneficiarios[])
 *   - sectores_actividad (sectores[])
 *   - comunidad_autonoma / ambito_geografico (regiones[])
 *
 * Uso:
 *   node scripts/backfill-bdns-detail.mjs          # todas las subvenciones
 *   node scripts/backfill-bdns-detail.mjs --id 893737  # una sola
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const BDNS_BASE = 'https://www.infosubvenciones.es/bdnstrans/api';

const args = process.argv.slice(2);
const SINGLE_ID = args.includes('--id') ? args[args.indexOf('--id') + 1] : null;
const WORKERS = 3; // conservative — BDNS rate limits

async function fetchDetalle(bdnsId) {
  try {
    const res = await fetch(`${BDNS_BASE}/convocatorias?numConv=${bdnsId}&vpd=GE`, {
      headers: { Accept: 'application/json', 'User-Agent': 'AyudaPyme/2.0' },
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.id) return data;
    }
  } catch { /* 404 or network error */ }
  return null;
}

function buildUpdate(detalle) {
  const u = {};

  if (detalle.presupuestoTotal) u.presupuesto_total = detalle.presupuestoTotal;
  if (detalle.fechaFinSolicitud) u.plazo_fin = detalle.fechaFinSolicitud.split('T')[0];
  if (detalle.fechaInicioSolicitud) u.plazo_inicio = detalle.fechaInicioSolicitud.split('T')[0];
  if (detalle.sedeElectronica) u.url_oficial = detalle.sedeElectronica;

  // tipos_beneficiario y sectores van dentro de campos_extraidos (JSONB)
  const bens = (detalle.tiposBeneficiarios ?? []).map(b => b.descripcion).filter(Boolean);
  const sects = (detalle.sectores ?? []).map(s => s.descripcion ?? s.codigo).filter(Boolean);
  if (bens.length || sects.length) {
    // Merge with existing campos_extraidos — fetched separately in procesarUno
    u._bens = bens;
    u._sects = sects;
  }

  const regNames = (detalle.regiones ?? []).map(r => r.descripcion).filter(Boolean);
  if (regNames.length) {
    if (regNames.some(r => r.includes('ES - ESPAÑA'))) {
      u.ambito_geografico = 'nacional';
    } else {
      u.ambito_geografico = 'autonomico';
      // First region that looks like a CCAA (ES11, ES12, etc.)
      const ccaa = regNames.find(r => /^ES\d/.test(r));
      if (ccaa) u.comunidad_autonoma = ccaa;
    }
  }

  return u;
}

async function crearSemaforo(max) {
  let activos = 0;
  const cola = [];
  return {
    acquire() {
      if (activos < max) { activos++; return Promise.resolve(); }
      return new Promise(r => cola.push(r));
    },
    release() {
      activos--;
      if (cola.length) { activos++; cola.shift()(); }
    },
  };
}

async function procesarUno(bdnsId, sem) {
  await sem.acquire();
  try {
    const detalle = await fetchDetalle(bdnsId);
    if (!detalle) {
      process.stdout.write('·'); // no BDNS detail
      return { resultado: 'sin_detalle' };
    }

    const raw = buildUpdate(detalle);
    const { _bens, _sects, ...update } = raw;

    // Merge tipos_beneficiario and sectores into campos_extraidos
    if (_bens?.length || _sects?.length) {
      const { data: sub } = await sb.from('subvenciones')
        .select('campos_extraidos')
        .eq('bdns_id', bdnsId)
        .maybeSingle();
      const campos = sub?.campos_extraidos ?? {};
      if (_bens?.length) campos.tipos_beneficiario_api = _bens;
      if (_sects?.length) campos.sectores_api = _sects;
      update.campos_extraidos = campos;
    }

    if (Object.keys(update).length === 0 || (Object.keys(update).length === 1 && update.campos_extraidos)) {
      process.stdout.write('○'); // nothing useful
      return { resultado: 'vacio' };
    }

    update.updated_at = new Date().toISOString();

    const { error } = await sb.from('subvenciones').update(update).eq('bdns_id', bdnsId);
    if (error) {
      process.stdout.write('E');
      return { resultado: 'error', error: error.message };
    }

    process.stdout.write('✓');
    return { resultado: 'ok', campos: Object.keys(update).length };
  } finally {
    sem.release();
    await new Promise(r => setTimeout(r, 200)); // gentle rate limiting
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────────

const sem = await crearSemaforo(WORKERS);

if (SINGLE_ID) {
  console.log(`Enriching bdns_id=${SINGLE_ID}...`);
  const detalle = await fetchDetalle(SINGLE_ID);
  if (!detalle) {
    console.log('No BDNS detail found (404 or network error)');
    process.exit(0);
  }
  console.log('Detail found:', {
    id: detalle.id,
    presupuestoTotal: detalle.presupuestoTotal,
    fechaFinSolicitud: detalle.fechaFinSolicitud,
    tiposBeneficiarios: detalle.tiposBeneficiarios?.map(b => b.descripcion),
    sectores: detalle.sectores?.map(s => s.descripcion),
    regiones: detalle.regiones?.map(r => r.descripcion),
    sedeElectronica: detalle.sedeElectronica,
  });
  const raw = buildUpdate(detalle);
  const { _bens, _sects, ...update } = raw;
  if (_bens?.length || _sects?.length) {
    const { data: sub } = await sb.from('subvenciones').select('campos_extraidos').eq('bdns_id', SINGLE_ID).maybeSingle();
    const campos = sub?.campos_extraidos ?? {};
    if (_bens?.length) campos.tipos_beneficiario_api = _bens;
    if (_sects?.length) campos.sectores_api = _sects;
    update.campos_extraidos = campos;
  }
  console.log('Update:', update);
  const { error } = await sb.from('subvenciones').update(update).eq('bdns_id', SINGLE_ID);
  if (error) console.error('Error:', error.message);
  else console.log('✓ Updated');
  process.exit(0);
}

// Bulk mode: all subvenciones with a bdns_id
const { data: subs } = await sb.from('subvenciones')
  .select('bdns_id')
  .not('bdns_id', 'is', null)
  .order('created_at', { ascending: false });

if (!subs?.length) {
  console.log('No subvenciones found');
  process.exit(0);
}

console.log(`Enriching ${subs.length} subvenciones from BDNS API (${WORKERS} workers)...`);
console.log('Legend: ✓=updated  ·=no detail  ○=nothing new  E=error\n');

const results = await Promise.all(subs.map(s => procesarUno(s.bdns_id, sem)));

const ok = results.filter(r => r.resultado === 'ok').length;
const sinDetalle = results.filter(r => r.resultado === 'sin_detalle').length;
const vacio = results.filter(r => r.resultado === 'vacio').length;
const errores = results.filter(r => r.resultado === 'error').length;

console.log(`\n\n✅ Enriched: ${ok}  · No detail: ${sinDetalle}  ○ Nothing new: ${vacio}  ❌ Errors: ${errores}`);
