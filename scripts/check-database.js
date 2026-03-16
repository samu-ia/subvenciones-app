#!/usr/bin/env node

const { readFileSync } = require('fs');
const { join } = require('path');

require('dotenv').config({ path: join(__dirname, '..', '.env.local') });

async function checkDatabase() {
  const { Client } = require('pg');
  
  console.log('🔍 Conectando a Supabase...');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Conectado\n');

    // Ver todas las tablas
    console.log('📋 Tablas actuales:');
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    tables.rows.forEach(row => console.log(`   - ${row.table_name}`));

    // Ver columnas de cliente
    console.log('\n📊 Columnas de la tabla cliente:');
    const columns = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'cliente' 
      ORDER BY ordinal_position;
    `);
    columns.rows.forEach(row => console.log(`   - ${row.column_name} (${row.data_type})`));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

checkDatabase();
