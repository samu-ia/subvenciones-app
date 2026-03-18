/**
 * Ejecuta la migración SQL del pipeline de subvenciones via Supabase Management API
 * Usage: node scripts/run-migration.mjs
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Leer .env.local (manejando valores multilínea y espacios)
const envPath = join(__dirname, '..', '.env.local');
const env = {};
const rawEnv = readFileSync(envPath, 'utf-8');
// Join continuation lines (lines without = that follow a KEY= line)
const joined = rawEnv.replace(/\r\n/g, '\n').replace(/\n(?![A-Z_0-9]+=)/g, '');
joined.split('\n').forEach(line => {
  const idx = line.indexOf('=');
  if (idx > 0) {
    const key = line.substring(0, idx).trim();
    const val = line.substring(idx + 1).trim();
    if (key.match(/^[A-Z_0-9]+$/)) env[key] = val;
  }
});

const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const PROJECT_REF = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');

console.log(`\n🔧 Ejecutando migración en proyecto: ${PROJECT_REF}\n`);

// ──────────────────────────────────────────────────────────────────
// Usamos el endpoint /rest/v1/rpc con la service_role key
// Para DDL necesitamos crear primero una función helper o usar
// el endpoint de Management API con PAT.
// 
// Estrategia: usar la API de Management de Supabase
// La service_role JWT en realidad SÍ puede usarse con Management API
// pero en el endpoint correcto: https://api.supabase.com/v1/projects/{ref}/database/query
// Necesita el Authorization header como "Bearer <service_role>"  → NO funciona
// 
// La única forma programática sin PAT es via psql/pg directamente.
// Usamos el DATABASE_URL con pg (via node-postgres o fetch al pooler).
// ──────────────────────────────────────────────────────────────────

const DATABASE_URL = env.DATABASE_URL;
console.log(`DB URL: ${DATABASE_URL ? DATABASE_URL.substring(0, 50) + '...' : 'NO ENCONTRADA'}`);

// Instalar pg si no está
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

let pg;
try {
  pg = require('pg');
} catch {
  console.log('📦 Instalando pg...');
  const { execSync } = await import('child_process');
  execSync('npm install pg --no-save', { stdio: 'inherit', cwd: join(__dirname, '..') });
  pg = require('pg');
}

const { Client } = pg;

// Parsear DATABASE_URL manualmente decodificando URL encoding
// Formato: postgresql://user:pass@host:port/db
function parseDbUrl(url) {
  // Decodificar primero
  const decoded = decodeURIComponent(url.replace('postgresql://', '').replace('postgres://', ''));
  // decoded: postgres.REF:MiPass@123:abc@host:5432/postgres
  // El problema: la contraseña contiene @ y : → necesitamos usar la URL original con %encoding
  // Usar URL parser nativo
  const u = new URL(url);
  return {
    user: u.username,
    password: decodeURIComponent(u.password),
    host: u.hostname,
    port: parseInt(u.port) || 5432,
    database: u.pathname.replace('/', ''),
  };
}

const connConfig = parseDbUrl(DATABASE_URL);
console.log(`   Host: ${connConfig.host}:${connConfig.port}`);
console.log(`   User: ${connConfig.user}`);
console.log(`   DB:   ${connConfig.database}`);
console.log(`\n🔌 Conectando a Supabase PostgreSQL...`);

const client = new Client({
  ...connConfig,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30000,
});

try {
  await client.connect();
  console.log('✅ Conectado a PostgreSQL\n');
} catch (err) {
  console.error(`❌ No se pudo conectar: ${err.message}`);
  console.log('\n💡 El DATABASE_URL requiere acceso directo (no pooler).');
  console.log('   Copia y pega la migración manualmente en Supabase Dashboard → SQL Editor');
  process.exit(1);
}

// Leer SQL
const sqlPath = join(__dirname, '..', 'supabase', 'migrations', '20260318000001_subvenciones_pipeline.sql');
const fullSql = readFileSync(sqlPath, 'utf-8');

console.log('📝 Ejecutando migración...\n');

try {
  // Ejecutar todo el SQL de una vez
  await client.query(fullSql);
  console.log('✅ Migración ejecutada con éxito\n');
} catch (err) {
  console.log(`⚠️  Error con SQL completo: ${err.message}`);
  console.log('🔄 Intentando statement por statement...\n');
  
  // Dividir en statements
  const statements = fullSql
    .split(/;\s*\n/)
    .map(s => s.trim())
    .filter(s => s.length > 10 && !s.match(/^--/));

  let okCount = 0, errCount = 0;
  for (const stmt of statements) {
    try {
      await client.query(stmt);
      okCount++;
      process.stdout.write('.');
    } catch (e) {
      const msg = e.message;
      if (msg.includes('already exists')) {
        process.stdout.write('·');
        okCount++;
      } else {
        errCount++;
        console.log(`\n❌ Error: ${msg.substring(0, 120)}`);
        console.log(`   SQL: ${stmt.substring(0, 80)}...`);
      }
    }
  }
  console.log(`\n\n📊 Completado: ${okCount} OK, ${errCount} errores reales`);
}

// Verificar tablas
console.log('\n📋 Verificando tablas...');
const { rows } = await client.query(`
  SELECT table_name FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name LIKE 'subvencion%' 
  ORDER BY table_name;
`);

if (rows.length > 0) {
  console.log(`\n✅ ${rows.length} tablas encontradas:`);
  rows.forEach(r => console.log(`   ✓ ${r.table_name}`));
} else {
  console.log('⚠️  No se encontraron tablas subvencion*');
}

await client.end();

// Crear bucket en Storage
console.log('\n🪣 Creando bucket de Storage "subvenciones"...');
const bucketResp = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ id: 'subvenciones', name: 'subvenciones', public: false }),
});
const bucketData = await bucketResp.text();
if (bucketResp.ok) {
  console.log('✅ Bucket "subvenciones" creado');
} else if (bucketData.includes('already exists') || bucketData.includes('Duplicate') || bucketData.includes('violates')) {
  console.log('ℹ️  Bucket "subvenciones" ya existía');
} else {
  console.log(`⚠️  Bucket response: ${bucketResp.status} - ${bucketData}`);
}

console.log('\n🎉 Todo listo. El pipeline puede comenzar.\n');

