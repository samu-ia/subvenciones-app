#!/usr/bin/env node

const { readFileSync } = require('fs');
const { join } = require('path');

// Cargar variables de entorno
require('dotenv').config({ path: join(__dirname, '..', '.env.local') });

async function runMigration() {
  const { Client } = require('pg');
  
  console.log('🔄 Conectando a Supabase (Session Pooler)...');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Conectado correctamente\n');

    // Leer el archivo de migración
    const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20260316000000_cleanup_database.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');

    console.log('🚀 Ejecutando migración de limpieza...\n');
    
    // Ejecutar la migración
    await client.query(migrationSQL);
    
    console.log('✅ Migración completada exitosamente!\n');
    
    // Verificar tablas restantes
    console.log('📊 Verificando estructura final...');
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    console.log('\n📋 Tablas en la base de datos:');
    result.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name}`);
    });
    
  } catch (error) {
    console.error('❌ Error ejecutando migración:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
