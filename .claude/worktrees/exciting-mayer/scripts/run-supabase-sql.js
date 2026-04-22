#!/usr/bin/env node
/**
 * Supabase SQL çalıştırıcı - pg ile doğrudan veritabanına bağlanır
 * Kullanım: SUPABASE_DB_URL="postgresql://..." node scripts/run-supabase-sql.js scripts/fix-account-management.sql
 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('❌ SUPABASE_DB_URL veya DATABASE_URL gerekli');
  console.error('   Supabase Dashboard → Settings → Database → Connection string (URI)');
  process.exit(1);
}

const sqlFile = process.argv[2] || path.join(__dirname, '../scripts/fix-account-management.sql');
const sql = fs.readFileSync(sqlFile, 'utf8');

const client = new pg.Client({ connectionString: dbUrl });

async function run() {
  try {
    await client.connect();
    await client.query(sql);
    console.log('✅ SQL başarıyla çalıştırıldı:', sqlFile);
  } catch (err) {
    console.error('❌ Hata:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
