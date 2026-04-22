#!/usr/bin/env node
/**
 * Hesap yönetimi fix script - exec_sql RPC ile Supabase'de çalıştırır
 * Gereksinim: SUPABASE_SERVICE_KEY (Supabase Dashboard → Settings → API → service_role)
 * Kullanım: SUPABASE_SERVICE_KEY=xxx node scripts/run-fix-account-management.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const supabaseUrl = 'https://rqnvoatirfczpklaamhf.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

if (!serviceKey) {
  console.error('❌ SUPABASE_SERVICE_KEY gerekli');
  console.error('   Supabase Dashboard → Settings → API → service_role (secret)');
  console.error('   Kullanım: SUPABASE_SERVICE_KEY=xxx node scripts/run-fix-account-management.js');
  process.exit(1);
}

async function execSql(sql) {
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

function splitStatements(content) {
  const statements = [];
  let current = '';
  let inDollar = false;
  let dollarTag = '';
  let i = 0;

  while (i < content.length) {
    const rest = content.slice(i);

    if (!inDollar) {
      if (rest.startsWith('$$')) {
        const tag = rest.match(/^\$(\$*)/)?.[0] || '$$';
        dollarTag = tag;
        inDollar = true;
        current += tag;
        i += tag.length;
        continue;
      }
      if (rest.startsWith('--') || rest.startsWith('\n--')) {
        const nl = content.indexOf('\n', i);
        i = nl === -1 ? content.length : nl + 1;
        continue;
      }
      const semi = content.indexOf(';', i);
      if (semi === -1) {
        current += content.slice(i);
        break;
      }
      current += content.slice(i, semi + 1);
      const stmt = current.trim();
      if (stmt && !stmt.startsWith('--')) statements.push(stmt);
      current = '';
      i = semi + 1;
      continue;
    }

    const endTag = content.indexOf(dollarTag, i);
    if (endTag === -1) {
      current += content.slice(i);
      break;
    }
    current += content.slice(i, endTag + dollarTag.length);
    i = endTag + dollarTag.length;
    if (content[i] === ';') {
      current += ';';
      i++;
    }
    inDollar = false;
    const stmt = current.trim();
    if (stmt && !stmt.startsWith('--')) statements.push(stmt);
    current = '';
  }

  const last = current.trim();
  if (last && !last.startsWith('--')) statements.push(last);
  return statements.filter(Boolean);
}

async function run() {
  const sqlPath = path.join(__dirname, 'fix-account-management.sql');
  const content = fs.readFileSync(sqlPath, 'utf8');
  const statements = splitStatements(content);

  console.log('🚀 Hesap yönetimi fix script başlatılıyor...');
  console.log(`   ${statements.length} SQL ifadesi çalıştırılacak\n`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.slice(0, 60).replace(/\s+/g, ' ') + (stmt.length > 60 ? '...' : '');
    process.stdout.write(`[${i + 1}/${statements.length}] ${preview} ... `);
    try {
      const result = await execSql(stmt);
      const msg = Array.isArray(result) ? result[0] : result;
      if (msg && typeof msg === 'object' && msg.return === 'Error:') {
        console.log('⚠️  ', msg);
      } else {
        console.log('✅');
      }
    } catch (err) {
      console.log('❌');
      console.error('   Hata:', err.message);
      throw err;
    }
  }

  console.log('\n✅ Tüm SQL ifadeleri başarıyla çalıştırıldı.');
}

run().catch((err) => {
  console.error('\n❌ Script başarısız:', err.message);
  process.exit(1);
});
