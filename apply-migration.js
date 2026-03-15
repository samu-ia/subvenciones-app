const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Leer el archivo de migración
const migrationPath = path.join(__dirname, 'supabase/migrations/20260315000002_create_oportunidades.sql');
const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

// Configuración de conexión PostgreSQL
const connectionString = 'postgresql://postgres:MiPass@123:abc@db.whvmobuyydpxdpuffiuw.supabase.co:5432/postgres';

async function applyMigration() {
  const client = new Client({ connectionString });
  
  try {
    console.log('🔌 Conectando a PostgreSQL...');
    await client.connect();
    console.log('✅ Conectado');
    
    console.log('📝 Aplicando migración...');
    await client.query(migrationSQL);
    console.log('✅ Migración aplicada exitosamente');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

applyMigration();
