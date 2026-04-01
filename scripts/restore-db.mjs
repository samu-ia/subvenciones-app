/**
 * Restaura un backup de la base de datos AyudaPyme.
 * Lee el archivo SQL de backups/ y lo ejecuta contra la BD.
 *
 * Uso: npm run db:restore backups/2026-03-27_10-30.sql
 *      npx dotenvx run -f .env.local -- node scripts/restore-db.mjs backups/2026-03-27_10-30.sql
 *
 * ⚠️ CUIDADO: Borra los datos actuales y los reemplaza por el backup.
 */

import pg from 'pg';
import fs from 'fs';
import readline from 'readline';

const { Client } = pg;

async function confirm(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => { rl.close(); resolve(answer.trim().toLowerCase()); });
  });
}

async function main() {
  const backupFile = process.argv[2];
  if (!backupFile) {
    console.error('Uso: node scripts/restore-db.mjs <archivo-backup>');
    console.error('Ejemplo: node scripts/restore-db.mjs backups/2026-03-27_10-30.sql');
    process.exit(1);
  }

  if (!fs.existsSync(backupFile)) {
    console.error(`❌ Archivo no encontrado: ${backupFile}`);
    process.exit(1);
  }

  const stats = fs.statSync(backupFile);
  console.log(`\n📦 Backup: ${backupFile} (${(stats.size/1024).toFixed(0)} KB)`);
  console.log(`⚠️  Esto BORRARÁ los datos actuales y los reemplazará por el backup.\n`);

  const answer = await confirm('¿Continuar? (escribe "si" para confirmar): ');
  if (answer !== 'si') {
    console.log('Cancelado.');
    process.exit(0);
  }

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL no definida.');
    process.exit(1);
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  console.log('\n🔌 Conectando...');
  await client.connect();

  const sql = fs.readFileSync(backupFile, 'utf8');

  // Dividir en statements (respetando strings con punto y coma)
  const statements = sql
    .split('\n')
    .filter(line => !line.startsWith('--') && line.trim())
    .join('\n')
    .split(/;\s*\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  console.log(`📝 Ejecutando ${statements.length} statements...\n`);

  let ok = 0;
  let errors = 0;

  for (const stmt of statements) {
    try {
      await client.query(stmt);
      ok++;
    } catch (e) {
      errors++;
      console.error(`  ✗ ${stmt.slice(0, 80).replace(/\n/g, ' ')}`);
      console.error(`    → ${e.message}\n`);
    }
  }

  await client.end();

  console.log(`\n✅ Restore completado: ${ok} ok, ${errors} errores`);
  if (errors > 0) {
    console.log('⚠️  Algunos statements fallaron — revisa los errores arriba.');
  }
}

main().catch(e => {
  console.error('❌ Error fatal:', e.message);
  process.exit(1);
});
