/**
 * PL.xlsx personel listesini Supabase personnel tablosu ile senkronize eder.
 * - PL'de olup DB'de olmayanları ekler
 * - Eşleşenleri günceller (birim, ünvan, yaka, aktif)
 * - PL'de olmayan aktif personeli pasife alır
 *
 * Kullanım:
 *   node scripts/sync-personnel-from-pl.mjs [PL.xlsx yolu]
 *   node scripts/sync-personnel-from-pl.mjs --apply [PL.xlsx yolu]
 */

import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import path from 'node:path';
import {
  formatPersonnelModuleField,
  normalizeUnitNameForSettings,
} from '../src/lib/utils.js';

const SUPABASE_URL = 'https://rqnvoatirfczpklaamhf.supabase.co';
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxbnZvYXRpcmZjenBrbGFhbWhmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjgxNDgxMiwiZXhwIjoyMDcyMzkwODEyfQ.2YJmKcpk1kHbAOc-H9s37NbUY74QJuqIYB1Z2ssusa4';

const DEFAULT_PL =
  '/Users/atakanbattal/Library/Containers/net.whatsapp.WhatsApp/Data/tmp/documents/3440B89F-7B15-4864-AD64-61241452F743/PL.xlsx';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const plPath = args.find((a) => !a.startsWith('--')) || DEFAULT_PL;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function deptNormKey(text) {
  if (text == null) return '';
  let s = String(text).trim();
  if (!s) return '';
  s = s.normalize('NFC');
  s = s.replace(/[İIıĞğÜüŞşÖöÇç]/g, (ch) => {
    const map = {
      İ: 'i',
      I: 'i',
      ı: 'i',
      Ğ: 'g',
      ğ: 'g',
      Ü: 'u',
      ü: 'u',
      Ş: 's',
      ş: 's',
      Ö: 'o',
      ö: 'o',
      Ç: 'c',
      ç: 'c',
    };
    return map[ch] ?? ch;
  });
  s = s.toLowerCase().replace(/[-\s_.]+/g, '');
  return s;
}

function normalizeSicil(raw) {
  if (raw == null || raw === '' || raw === '-') return '';
  let s = String(raw).trim().replace(/\s+/g, '');
  if (/^\d+$/.test(s)) {
    const n = Math.floor(Number(s) / 100);
    s = `A${String(n).padStart(6, '0')}`;
  } else if (/^a/i.test(s)) {
    s = `A${s.slice(1).replace(/\D/g, '').padStart(6, '0')}`;
  }
  return s.toUpperCase();
}

function normName(s) {
  return String(s || '')
    .normalize('NFC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function readPlRows(filePath) {
  const wb = XLSX.readFile(filePath);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
  return rows
    .map((r) => {
      const keys = Object.keys(r);
      const get = (part) => keys.find((k) => k.replace(/\r?\n/g, ' ').toUpperCase().includes(part));
      const sicilRaw = r[get('SİCİL') ?? get('SICIL') ?? 'SİCİL\r\nNO'];
      const adSoyad = String(r[get('AD - SOYAD') ?? get('AD') ?? 'AD - SOYAD'] || '').trim();
      const departman = String(r[get('DEPARTMAN') ?? 'DEPARTMAN'] || '').trim();
      const birim = String(r[get('BİRİM') ?? get('BIRIM') ?? 'BİRİM'] || '').trim();
      const yaka = String(r[get('UNVAN') ?? 'UNVAN'] || '').trim().toUpperCase();
      const sirketUnvan = String(r[get('ŞİRKET UNVAN') ?? get('SIRKET') ?? 'ŞİRKET UNVAN'] || '').trim();
      if (!adSoyad) return null;
      return {
        sicil: normalizeSicil(sicilRaw),
        ad_soyad: formatPersonnelModuleField(adSoyad),
        management_department: normalizeUnitNameForSettings(departman),
        department: formatPersonnelModuleField(birim),
        collar_type: yaka === 'MAVİ' || yaka === 'BEYAZ' ? yaka : yaka || null,
        job_title: formatPersonnelModuleField(sirketUnvan),
        ad_n: normName(adSoyad),
      };
    })
    .filter(Boolean);
}

function buildUnitMap(units) {
  const map = new Map();
  for (const u of units) {
    map.set(deptNormKey(u.unit_name), u);
  }
  return map;
}

function resolveUnitId(unitMap, managementDepartment) {
  const key = deptNormKey(managementDepartment);
  return unitMap.get(key) || null;
}

async function ensureCostSetting(unitMap, managementDepartment) {
  const formatted = normalizeUnitNameForSettings(managementDepartment);
  if (!formatted) throw new Error('Birim (management_department) boş olamaz');
  let unit = resolveUnitId(unitMap, formatted);
  if (unit) return unit;

  const { data, error } = await supabase
    .from('cost_settings')
    .insert({ unit_name: formatted, cost_per_minute: 0 })
    .select('*')
    .single();
  if (error) throw new Error(`cost_settings eklenemedi (${formatted}): ${error.message}`);
  unitMap.set(deptNormKey(formatted), data);
  return data;
}

async function main() {
  console.log(`PL dosyası: ${plPath}`);
  console.log(`Mod: ${APPLY ? 'UYGULA' : 'DRY-RUN'}\n`);

  const plRows = readPlRows(plPath);
  console.log(`PL kayıt sayısı: ${plRows.length}`);

  const [{ data: personnel, error: pErr }, { data: units, error: uErr }] = await Promise.all([
    supabase.from('personnel').select('id, full_name, registration_number, management_department, department, collar_type, job_title, unit_id, is_active'),
    supabase.from('cost_settings').select('id, unit_name'),
  ]);
  if (pErr) throw new Error(pErr.message);
  if (uErr) throw new Error(uErr.message);

  const unitMap = buildUnitMap(units || []);
  const bySicil = new Map();
  const byName = new Map();
  for (const p of personnel || []) {
    const sicil = normalizeSicil(p.registration_number);
    if (sicil) bySicil.set(sicil, p);
    const nameKey = normName(p.full_name);
    if (nameKey && !byName.has(nameKey)) byName.set(nameKey, p);
  }

  const matchedIds = new Set();
  const toInsert = [];
  const toUpdate = [];
  const unmatchedPl = [];

  for (const row of plRows) {
    let existing =
      (row.sicil && bySicil.get(row.sicil)) ||
      byName.get(row.ad_n) ||
      null;

    if (!existing) {
      unmatchedPl.push(row);
      toInsert.push(row);
      continue;
    }

    matchedIds.add(existing.id);
    const unit = resolveUnitId(unitMap, row.management_department);
    const patch = {
      full_name: row.ad_soyad,
      registration_number: row.sicil || existing.registration_number,
      management_department: row.management_department,
      department: row.department,
      collar_type: row.collar_type,
      job_title: row.job_title,
      is_active: true,
    };
    if (unit) patch.unit_id = unit.id;

    const changed =
      existing.full_name !== patch.full_name ||
      normalizeSicil(existing.registration_number) !== normalizeSicil(patch.registration_number) ||
      existing.management_department !== patch.management_department ||
      existing.department !== patch.department ||
      (existing.collar_type || '') !== (patch.collar_type || '') ||
      (existing.job_title || '') !== (patch.job_title || '') ||
      existing.is_active === false ||
      (unit && existing.unit_id !== unit.id);

    if (changed) toUpdate.push({ id: existing.id, patch, name: row.ad_soyad, sicil: row.sicil });
  }

  const toDeactivate = (personnel || []).filter(
    (p) => p.is_active !== false && !matchedIds.has(p.id)
  );

  console.log(`\nÖzet:`);
  console.log(`  Güncellenecek: ${toUpdate.length}`);
  console.log(`  Eklenecek:     ${toInsert.length}`);
  console.log(`  Pasife alınacak: ${toDeactivate.length}`);

  if (toInsert.length) {
    console.log('\nYeni personel:');
    toInsert.forEach((r) => console.log(`  + ${r.sicil || '(sicil yok)'} | ${r.ad_soyad} | ${r.management_department}`));
  }
  if (toDeactivate.length) {
    console.log('\nPasife alınacak:');
    toDeactivate.forEach((p) =>
      console.log(`  - ${p.registration_number || '?'} | ${p.full_name} | ${p.management_department || ''}`)
    );
  }
  if (toUpdate.length && toUpdate.length <= 30) {
    console.log('\nGüncellenecek (örnek):');
    toUpdate.slice(0, 30).forEach((u) => console.log(`  ~ ${u.sicil} | ${u.name}`));
  } else if (toUpdate.length) {
    console.log(`\nGüncellenecek kayıt sayısı: ${toUpdate.length}`);
  }

  if (!APPLY) {
    console.log('\nUygulamak için: node scripts/sync-personnel-from-pl.mjs --apply');
    return;
  }

  let inserted = 0;
  for (const row of toInsert) {
    const unit = await ensureCostSetting(unitMap, row.management_department);
    const { error } = await supabase.from('personnel').insert({
      full_name: row.ad_soyad,
      registration_number: row.sicil || null,
      management_department: row.management_department,
      department: row.department,
      collar_type: row.collar_type,
      job_title: row.job_title,
      unit_id: unit.id,
      is_active: true,
    });
    if (error) throw new Error(`Insert (${row.ad_soyad}): ${error.message}`);
    inserted++;
  }

  let updated = 0;
  for (const { id, patch } of toUpdate) {
    if (!patch.unit_id) {
      const unit = await ensureCostSetting(unitMap, patch.management_department);
      patch.unit_id = unit.id;
    }
    const { error } = await supabase.from('personnel').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw new Error(`Update (${id}): ${error.message}`);
    updated++;
  }

  let deactivated = 0;
  if (toDeactivate.length) {
    const ids = toDeactivate.map((p) => p.id);
    const { error } = await supabase
      .from('personnel')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .in('id', ids);
    if (error) throw new Error(`Deactivate: ${error.message}`);
    deactivated = ids.length;
  }

  const { error: syncErr } = await supabase.rpc('sync_cost_settings_from_personnel');
  if (syncErr) console.warn('sync_cost_settings_from_personnel:', syncErr.message);

  const { data: stats } = await supabase
    .from('personnel')
    .select('is_active');
  const total = stats?.length ?? 0;
  const active = stats?.filter((p) => p.is_active !== false).length ?? 0;

  console.log(`\nTamamlandı:`);
  console.log(`  Eklenen: ${inserted}`);
  console.log(`  Güncellenen: ${updated}`);
  console.log(`  Pasife alınan: ${deactivated}`);
  console.log(`  Toplam personel: ${total} (aktif: ${active}, pasif: ${total - active})`);
}

main().catch((err) => {
  console.error('HATA:', err.message);
  process.exit(1);
});
