#!/usr/bin/env node
/**
 * Kalite maliyeti NC batch SQL dosyalarını pg ile çalıştırır.
 * Gereksinim: SUPABASE_DB_URL veya DATABASE_URL (URI, şifre dahil)
 *
 * Kullanım:
 *   SUPABASE_DB_URL="postgresql://postgres.[ref]:[pass]@..." node scripts/run-qc-nc-batches.mjs
 *   node scripts/run-qc-nc-batches.mjs --batch 0   # tek batch
 */
import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BATCH_DIR = path.join(__dirname, '_qc_nc_batches');

const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
const singleBatch = process.argv.includes('--batch')
    ? Number(process.argv[process.argv.indexOf('--batch') + 1])
    : null;

async function main() {
    if (!dbUrl) {
        console.error('❌ SUPABASE_DB_URL veya DATABASE_URL gerekli');
        process.exit(1);
    }

    const files = fs
        .readdirSync(BATCH_DIR)
        .filter((f) => /^batch-\d+\.sql$/.test(f))
        .sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10));

    const toRun =
        singleBatch !== null && !Number.isNaN(singleBatch)
            ? files.filter((f) => f === `batch-${singleBatch}.sql`)
            : files;

    if (!toRun.length) {
        console.error('❌ Batch bulunamadı');
        process.exit(1);
    }

    const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    await client.connect();

    let ok = 0;
    let fail = 0;

    for (const file of toRun) {
        const sql = fs.readFileSync(path.join(BATCH_DIR, file), 'utf8');
        try {
            await client.query(sql);
            console.log(`✅ ${file}`);
            ok += 1;
        } catch (err) {
            console.error(`❌ ${file}: ${err.message}`);
            fail += 1;
        }
    }

    const { rows } = await client.query(`
        SELECT count(*)::int AS total,
               count(*) FILTER (WHERE status = 'Kapatıldı')::int AS closed,
               count(*) FILTER (WHERE five_why_analysis IS NOT NULL)::int AS with_five_why
        FROM non_conformities WHERE source_cost_id IS NOT NULL
    `);
    console.log('\n--- Doğrulama ---');
    console.log(rows[0]);
    console.log(`\nBatch: ${ok} başarılı, ${fail} hata`);

    await client.end();
    process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
