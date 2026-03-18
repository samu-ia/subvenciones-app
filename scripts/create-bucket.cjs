const { Client } = require('pg');
const fs = require('fs');

const lines = fs.readFileSync('.env.local', 'utf-8').split('\n');
const dbUrl = lines.find(l => l.startsWith('DATABASE_URL=')).replace('DATABASE_URL=', '').trim();
const u = new URL(dbUrl);

const client = new Client({
  user: u.username,
  password: decodeURIComponent(u.password),
  host: u.hostname,
  port: parseInt(u.port) || 5432,
  database: u.pathname.slice(1),
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  console.log('Conectado');

  // Crear bucket en storage.buckets
  await client.query(`
    INSERT INTO storage.buckets (id, name, public, created_at, updated_at)
    VALUES ('subvenciones', 'subvenciones', false, now(), now())
    ON CONFLICT (id) DO NOTHING;
  `);
  console.log('✅ Bucket "subvenciones" creado (o ya existía)');

  // Verificar
  const { rows } = await client.query("SELECT id, name, public FROM storage.buckets WHERE id = 'subvenciones'");
  console.log('Bucket info:', rows[0]);

  await client.end();
}

main().catch(e => { console.error('Error:', e.message); client.end(); });
