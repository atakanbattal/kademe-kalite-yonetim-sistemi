#!/usr/bin/env node
/**
 * Hurda / Yeniden İşlem maliyetlerinde primary_defect ve kalem defect alanları boşsa,
 * description / parça kodu vb. metinlerden eşleştirir ve quality_costs satırını günceller.
 *
 * Kimlik doğrulama: SUPABASE_SERVICE_ROLE_KEY tercih (RLS yoklar). Yoksa anon + RLS uygun olmalı.
 * Önizleme: DRY_RUN=1 node scripts/backfill-quality-cost-defects.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { buildQualityCostDefectBackfillPatch } from '../src/lib/qualityCostDefectBackfill.js';

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;

const dryRun = process.env.DRY_RUN === '1' || process.argv.includes('--dry-run');

async function main() {
  if (!url || !key) {
    console.error('VITE_SUPABASE_URL / SUPABASE_URL ve service veya anon key gerekli.');
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const types = ['Hurda Maliyeti', 'Yeniden İşlem Maliyeti'];
  let from = 0;
  const page = 400;
  let updated = 0;
  let scanned = 0;

  for (;;) {
    const { data, error } = await supabase
      .from('quality_costs')
      .select('*')
      .in('cost_type', types)
      .order('id', { ascending: true })
      .range(from, from + page - 1);

    if (error) {
      console.error('Liste hatası:', error.message);
      process.exit(1);
    }

    const rows = data || [];
    if (rows.length === 0) break;

    for (const row of rows) {
      scanned += 1;
      const { changed, patch } = buildQualityCostDefectBackfillPatch(row);
      if (!changed) continue;

      updated += 1;
      console.log(`${dryRun ? '[DRY] ' : ''}Kayıt ${row.id} patch:`, JSON.stringify(patch, null, 0));

      if (!dryRun) {
        const { error: upErr } = await supabase.from('quality_costs').update(patch).eq('id', row.id);
        if (upErr) {
          console.error(`Kayıt ${row.id} güncellenemedi:`, upErr.message);
          process.exit(1);
        }
      }
    }

    if (rows.length < page) break;
    from += page;
  }

  console.log(`Tamamlandı. Taranan: ${scanned}, güncellenen (${dryRun ? 'simülasyon' : 'gerçek'}): ${updated}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
