/**
 * DF/8D bulk UPDATE'leri Supabase'de çalıştırır.
 * exec_sql RPC tek SQL komutu kabul eder; merged JSON içindeki BEGIN/COMMIT ve
 * birden fazla UPDATE varsa satırlara böler.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const supabaseUrl = 'https://rqnvoatirfczpklaamhf.supabase.co';
const supabaseServiceKey =
    process.env.SUPABASE_SERVICE_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxbnZvYXRpcmZjenBrbGFhbWhmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjgxNDgxMiwiZXhwIjoyMDcyMzkwODEyfQ.2YJmKcpk1kHbAOc-H9s37NbUY74QJuqIYB1Z2ssusa4';

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

/** BEGIN/COMMIT kaldırır; birden fazla UPDATE varsa ayırır */
function queryToStatements(q) {
    let body = q.replace(/^\s*BEGIN;\s*/i, '').replace(/\s*COMMIT;\s*$/i, '').trim();
    const parts = body.split(/\n(?=UPDATE non_conformities SET)/i).map((s) => s.trim()).filter(Boolean);
    return parts.map((p) => (p.endsWith(';') ? p : `${p};`));
}

async function runJsonFile(jsonPath) {
    const j = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const stmts = queryToStatements(j.query);
    for (const sql of stmts) {
        await execSql(sql);
    }
}

async function main() {
    const mode = process.argv[2] || 'merged';
    const base = path.join(__dirname, '_mcp_exec_args');

    if (mode === 'merged') {
        const dir = path.join(base, '_merged_batches/_compact');
        const files = fs.readdirSync(dir).filter((f) => /^m\d{2}\.json$/.test(f)).sort();
        let i = 0;
        for (const name of files) {
            i += 1;
            process.stdout.write(`[${name}] ${i}/${files.length} ... `);
            await runJsonFile(path.join(dir, name));
            console.log('ok');
        }
    } else if (mode === 'singles') {
        for (let n = 0; n < 106; n++) {
            const name = `u${String(n).padStart(3, '0')}.json`;
            const p = path.join(base, name);
            if (!fs.existsSync(p)) {
                console.warn('missing', name);
                continue;
            }
            process.stdout.write(`[${name}] ${n + 1}/106 ... `);
            await runJsonFile(p);
            console.log('ok');
        }
    } else {
        console.error('Kullanım: node scripts/run-df8d-bulk-updates.js [merged|singles]');
        process.exit(1);
    }
    console.log('Tamamlandı.');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
