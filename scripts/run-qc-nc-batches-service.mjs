#!/usr/bin/env node
/**
 * Kalite maliyeti NC batch INSERT'lerini service role ile çalıştırır.
 * Kullanım: node scripts/run-qc-nc-batches-service.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const supabaseUrl = 'https://rqnvoatirfczpklaamhf.supabase.co';
const supabaseServiceKey =
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxbnZvYXRpcmZjenBrbGFhbWhmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjgxNDgxMiwiZXhwIjoyMDcyMzkwODEyfQ.2YJmKcpk1kHbAOc-H9s37NbUY74QJuqIYB1Z2ssusa4';

const BATCH_DIR = path.join(__dirname, '_qc_nc_batches');

async function execSql(sql) {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
            apikey: supabaseServiceKey,
            Authorization: `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
        },
        body: JSON.stringify({ query: sql }),
    });
    const text = await response.text();
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${text}`);
    }
    if (text.includes('Error:')) {
        throw new Error(text);
    }
    return text;
}

/** BEGIN/COMMIT kaldırır; INSERT ifadelerini ayırır */
function splitInserts(sql) {
    let body = sql.replace(/^\s*BEGIN;\s*/i, '').replace(/\s*COMMIT;\s*$/gi, '').trim();
    const parts = body
        .split(/\n(?=INSERT INTO non_conformities)/i)
        .map((s) => s.trim())
        .filter(Boolean);
    return parts.map((p) => (p.endsWith(';') ? p : `${p};`));
}

async function main() {
    const files = fs
        .readdirSync(BATCH_DIR)
        .filter((f) => /^batch-\d+\.sql$/.test(f))
        .sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10));

    let ok = 0;
    let fail = 0;
    let inserts = 0;

    for (const file of files) {
        const sql = fs.readFileSync(path.join(BATCH_DIR, file), 'utf8');
        const stmts = splitInserts(sql);
        process.stdout.write(`[${file}] ${stmts.length} insert ... `);
        try {
            for (const stmt of stmts) {
                await execSql(stmt);
                inserts += 1;
            }
            console.log('ok');
            ok += 1;
        } catch (err) {
            console.log('HATA:', err.message.slice(0, 200));
            fail += 1;
        }
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await supabase
        .from('non_conformities')
        .select('id, status, five_why_analysis')
        .not('source_cost_id', 'is', null);

    if (error) {
        console.error('Doğrulama hatası:', error.message);
    } else {
        const total = data.length;
        const closed = data.filter((r) => r.status === 'Kapatıldı').length;
        const withFiveWhy = data.filter((r) => r.five_why_analysis).length;
        console.log('\n--- Doğrulama ---');
        console.log({ total, closed, withFiveWhy, insertsRun: inserts });
    }

    console.log(`\nBatch: ${ok} başarılı, ${fail} hata`);
    process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
