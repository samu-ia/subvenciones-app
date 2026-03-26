/**
 * Backup de la base de datos AyudaPyme.
 * Exporta datos críticos como INSERT statements SQL.
 * Guarda en backups/YYYY-MM-DD_HH-mm.sql (máximo 10 copias).
 *
 * Uso: npm run db:backup
 *      npx dotenvx run -f .env.local -- node scripts/backup-db.mjs
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUPS_DIR = path.join(__dirname, '..', 'backups');
const MAX_BACKUPS = 10;

// Tablas a incluir en el backup (en orden para respetar FK)
const TABLES = [
  'perfiles',
  'subvenciones',
  'cliente_subvencion_match',
  'expediente',
  'expediente_fases',
  'mensajes_gestor',
  'alertas',
  'proveedores',
  'reuniones',
  'agent_tasks',
  'agent_escalations',
  'novedades',
];

function timestamp() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
}

function escapeValue(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
  return `'${String(val).replace(/'/g, "''")}'`;
}

async function backupTable(client, table, out) {
  let rows;
  try {
    const res = await client.query(`SELECT * FROM public.${table} ORDER BY 1`);
    rows = res.rows;
  } catch (e) {
    out.push(`-- TABLA ${table}: ${e.message}`);
    return 0;
  }

  if (rows.length === 0) {
    out.push(`-- ${table}: vacía\n`);
    return 0;
  }

  out.push(`-- ${table}: ${rows.length} filas`);
  out.push(`TRUNCATE public.${table} CASCADE;`);

  const cols = Object.keys(rows[0]).map(c => `"${c}"`).join(', ');

  for (const row of rows) {
    const vals = Object.values(row).map(escapeValue).join(', ');
    out.push(`INSERT INTO public.${table} (${cols}) VALUES (${vals});`);
  }
  out.push('');
  return rows.length;
}

async function rotateBackups() {
  const files = fs.readdirSync(BACKUPS_DIR)
    .filter(f => f.endsWith('.sql'))
    .map(f => ({ name: f, time: fs.statSync(path.join(BACKUPS_DIR, f)).mtimeMs }))
    .sort((a, b) => b.time - a.time);

  const toDelete = files.slice(MAX_BACKUPS);
  for (const f of toDelete) {
    fs.unlinkSync(path.join(BACKUPS_DIR, f.name));
    console.log(`  🗑  Eliminado backup antiguo: ${f.name}`);
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL no definida. Usa: npx dotenvx run -f .env.local -- node scripts/backup-db.mjs');
    process.exit(1);
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  console.log('🔌 Conectando a la base de datos...');
  await client.connect();
  console.log('✅ Conectado\n');

  const ts = timestamp();
  const filename = `${ts}.sql`;
  const filepath = path.join(BACKUPS_DIR, filename);

  const out = [];
  out.push(`-- AyudaPyme — Backup completo`);
  out.push(`-- Generado: ${new Date().toISOString()}`);
  out.push(`-- DATABASE: ${process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'supabase'}`);
  out.push('');
  out.push('SET session_replication_role = replica; -- deshabilita FK checks durante restore');
  out.push('');

  let totalRows = 0;

  for (const table of TABLES) {
    process.stdout.write(`  📦 ${table}... `);
    const count = await backupTable(client, table, out);
    console.log(`${count} filas`);
    totalRows += count;
  }

  out.push('SET session_replication_role = DEFAULT;');
  out.push('');
  out.push(`-- Fin del backup: ${totalRows} filas totales`);

  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  fs.writeFileSync(filepath, out.join('\n'), 'utf8');

  const sizeMB = (fs.statSync(filepath).size / 1024 / 1024).toFixed(2);
  console.log(`\n✅ Backup guardado: backups/${filename} (${sizeMB} MB, ${totalRows} filas)`);

  await client.end();

  console.log('\n🔄 Rotando backups antiguos...');
  rotateBackups();

  console.log('\n📋 Backups disponibles:');
  const files = fs.readdirSync(BACKUPS_DIR).filter(f => f.endsWith('.sql')).sort().reverse();
  files.forEach((f, i) => {
    const size = (fs.statSync(path.join(BACKUPS_DIR, f)).size / 1024).toFixed(0);
    console.log(`  ${i === 0 ? '→' : ' '} ${f} (${size} KB)`);
  });
}

main().catch(e => {
  console.error('❌ Error en backup:', e.message);
  process.exit(1);
});
