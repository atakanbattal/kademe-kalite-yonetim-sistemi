#!/usr/bin/env node
/**
 * Batch SQL dosyalarını stdout'a yazar — MCP execute_sql ile pipe için.
 * Kullanım: node scripts/mcp-run-qc-batches.mjs 0
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const n = process.argv[2] ?? '0';
const file = path.join(__dirname, '_qc_nc_batches', `batch-${n}.sql`);

if (!fs.existsSync(file)) {
    console.error(`Dosya yok: ${file}`);
    process.exit(1);
}

process.stdout.write(fs.readFileSync(file, 'utf8'));
