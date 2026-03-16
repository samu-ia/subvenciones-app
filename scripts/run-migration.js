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
    const migrationFile = process.argv[2] || '20260316000000_cleanup_database.sql';
    const migrationPath = join(__dirname, '..', 'supabase', 'migrations', migrationFile);
    const migrationSQL = readFileSync(migrationPath, 'utf8');

    console.log(`📄 Migración: ${migrationFile}\n`);

    console.log('🚀 Ejecutando migración de limpieza...\n');
    
    // Dividir respetando bloques DO $$
    const statements = [];
    let current = '';
    let inDoBlock = false;
    
    const lines = migrationSQL.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Detectar inicio de bloque DO
      if (trimmed.match(/^DO\s+\$\$/i)) {
        if (current.trim()) statements.push(current.trim());
        current = line + '\n';
        inDoBlock = true;
        continue;
      }
      
      // Detectar fin de bloque DO
      if (inDoBlock && trimmed.match(/^\$\$\s*;/)) {
        current += line + '\n';
        statements.push(current.trim());
        current = '';
        inDoBlock = false;
        continue;
      }
      
      // Si estamos en un bloque DO, acumular
      if (inDoBlock) {
        current += line + '\n';
        continue;
      }
      
      // Línea normal
      if (trimmed.startsWith('--') || trimmed === '') {
        continue; // Saltar comentarios y líneas vacías
      }
      
      current += line + '\n';
      
      // Si termina en ;, es fin de statement
      if (trimmed.endsWith(';')) {
        statements.push(current.trim());
        current = '';
      }
    }
    
    if (current.trim()) statements.push(current.trim());
    
    console.log(`📝 Total de statements: ${statements.length}\n`);
    
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      const preview = stmt.substring(0, 100).replace(/\n/g, ' ').replace(/\s+/g, ' ');
      console.log(`[${i + 1}/${statements.length}] ${preview}...`);
      
      try {
        await client.query(stmt);
        console.log(`   ✓ OK`);
      } catch (error) {
        console.log(`   ✗ ERROR: ${error.message}`);
        if (error.message.includes('does not exist') || 
            error.message.includes('already exists')) {
          console.log(`   → Continuando...`);
        } else {
          console.error(`\n❌ Error crítico en statement ${i + 1}`);
          console.error(`Statement:\n${stmt.substring(0, 300)}`);
          throw error;
        }
      }
    }
    
    console.log('\n✅ Migración completada exitosamente!\n');
    
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
