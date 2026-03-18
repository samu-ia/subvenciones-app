#!/usr/bin/env node
'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local'), quiet: true });

const { createClient } = require('@supabase/supabase-js');

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  // 1. Lanzar ingesta
  console.log('🚀 Lanzando ingesta...');
  const res = await fetch('http://localhost:3000/api/subvenciones/ingest', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + (process.env.INGEST_SECRET || 'dev-local-secret'),
    },
    body: JSON.stringify({ limite: 10, modoBasico: true }),
  });

  console.log('HTTP status:', res.status);
  const text = await res.text();
  let j;
  try {
    j = JSON.parse(text);
    console.log('Respuesta:', JSON.stringify(j, null, 2));
  } catch {
    console.log('Respuesta (texto):', text.slice(0, 500));
    return;
  }

  // 2. Verificar que los títulos se guardaron bien
  console.log('\n📋 Verificando registros en BD...');
  const { data: rows, error } = await sb
    .from('subvenciones')
    .select('bdns_id, titulo, organismo, comunidad_autonoma, fecha_publicacion, url_pdf')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error leyendo BD:', error.message);
    return;
  }

  console.log(`\nTotal registros: ${rows.length}`);
  for (const r of rows) {
    console.log('---');
    console.log('bdns_id:', r.bdns_id);
    console.log('titulo:', r.titulo?.slice(0, 80));
    console.log('organismo:', r.organismo?.slice(0, 60));
    console.log('comunidad:', r.comunidad_autonoma);
    console.log('fecha:', r.fecha_publicacion);
    console.log('url_pdf:', r.url_pdf?.slice(0, 70));
  }
}

main().catch(console.error);
