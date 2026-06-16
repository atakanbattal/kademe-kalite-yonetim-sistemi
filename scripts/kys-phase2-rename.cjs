#!/usr/bin/env node
/**
 * KYS Aksiyon Planı — 2. faz dosya düzeltmeleri.
 *
 * Kapsam:
 *  - ADUYUM : Ad-İçerik uyuşmazlığı — dosya adını antetteki koda eşitleme (A029–A043)
 *  - KAYNAK : Kaynak dosya adı düzeltmeleri (A026, A044)
 *  - ARSIV  : Eski/mükerrer kaynakların arşive kaldırılması (A027, A028)
 *  - TAHSIS : Yeni kod tahsisi gerektiren dosyalar (A018/A040 Viskozite, A025 Stage5)
 *  - KODFIX : Antet–kaynak kod çelişkisi çözümü (A045)
 *
 * Kullanım:
 *   node scripts/kys-phase2-rename.cjs           # dry-run
 *   node scripts/kys-phase2-rename.cjs --apply   # uygula
 */
const fs = require('fs');
const path = require('path');

const HOME = process.env.HOME;
const ROOT = path.join(HOME, 'Desktop/KademeQMS_Dokumanlar');
const ARSIV = path.join(ROOT, '00_KYS_Analiz/Arsiv');
const LOG = path.join(ROOT, '00_KYS_Analiz/rename_log_2026-06-12.csv');
const APPLY = process.argv.includes('--apply');

const norm = (s) => String(s ?? '').normalize('NFC');

// Dizinde NFC-normalize ederek dosya bul (macOS NFD sorunu için)
const findEntry = (dir, name) => {
    const target = norm(name);
    for (const e of fs.readdirSync(dir)) {
        if (norm(e) === target) return e;
    }
    return null;
};

// plan: [aksiyon, grup, klasör, eskiAd, yeniAd] — yeniKlasör null ise aynı klasör
const P = [];
const ren = (aksiyon, grup, klasor, eski, yeni, yeniKlasor = null) =>
    P.push({ aksiyon, grup, klasor, eski, yeni, yeniKlasor });

// ── ADUYUM: dosya adı eski kod, antet yeni kod ──────────────────────────────
ren('A029', 'ADUYUM', 'Ar-Ge Direktörlüğü/Talimatlar',
    'KDM-TL-083 Benchmark Uygulamaları Talimatı.pdf',
    'AR-TL-2025-0004 Benchmark Uygulamaları Talimatı.pdf');
ren('A029', 'ADUYUM', 'Ar-Ge Direktörlüğü/Talimatlar/kaynak',
    '1-KDM-TL-083 Benchmark Uygulamaları Talimatı.docx',
    '1-AR-TL-2025-0004 Benchmark Uygulamaları Talimatı.docx');
ren('A030', 'ADUYUM', 'Depo Şefliği/Talimatlar',
    'KDM-TL-074 Araç Teslimi Evrak Talimatı.pdf',
    'DEP-TL-2025-0005 Araç Teslimi Evrak Talimatı.pdf');
ren('A030', 'ADUYUM', 'Depo Şefliği/Talimatlar/kaynak',
    '1-KDM-TL-074 Araç Teslimi Evrak Talimatı.docx',
    '1-DEP-TL-2025-0005 Araç Teslimi Evrak Talimatı.docx');
ren('A031', 'ADUYUM', 'Kalite Müdürlüğü/Formlar',
    'KAL-FR-2026-0018 Kompakt Son Kontrol Formu AGA2100.pdf',
    'KAL-FR-2025-0046 Kompakt Son Kontrol Formu AGA2100.pdf');
ren('A033', 'ADUYUM', 'Kalite Müdürlüğü/Listeler',
    'KDM.LST.023 TIG Kaynak Parametreleri Listesi.pdf',
    'KAL-LS-2025-0017 TIG Kaynak Parametreleri Listesi.pdf');
ren('A033', 'ADUYUM', 'Kalite Müdürlüğü/Listeler/kaynak',
    '1-KDM.LST.023 TIG Kaynak Parametreleri Listesi (Rev.00).xlsx',
    '1-KAL-LS-2025-0017 TIG Kaynak Parametreleri Listesi.xlsx');
ren('A034', 'ADUYUM', 'Kalite Müdürlüğü/Talimatlar',
    'KAL-TL-2025-0033.pdf',
    'KAL-TL-2025-0033 Entegre Problem Çözme Talimatı (8D-DÖF).pdf');
ren('A034', 'ADUYUM', 'Kalite Müdürlüğü/Talimatlar/kaynak',
    '1-KDM-TL-112 Entegre Problem Çözme Talimatı (6 Sigma – 8D - DÖF).docx',
    '1-KAL-TL-2025-0033 Entegre Problem Çözme Talimatı (8D-DÖF).docx');
ren('A035', 'ADUYUM', 'Kalite Müdürlüğü/Talimatlar',
    'KDM-TL-087 Kaynak Makinası Bakım ve Kalibrasyon Talimatı.pdf',
    'KAL-TL-2025-0026 Kaynak Makinası Bakım ve Kalibrasyon Talimatı.pdf');
ren('A035', 'ADUYUM', 'Kalite Müdürlüğü/Talimatlar/kaynak',
    '1-KDM-TL-087 Kaynak Makinası Bakım ve Kalibrasyon Talimatı.docx',
    '1-KAL-TL-2025-0026 Kaynak Makinası Bakım ve Kalibrasyon Talimatı.docx');
ren('A036', 'ADUYUM', 'Kalite Müdürlüğü/Talimatlar',
    'KDM-TL-095 Tehlikeli Atık Yönetimi Talimatı.pdf',
    'KAL-TL-2025-0028 Tehlikeli Atık Yönetimi Talimatı.pdf');
ren('A036', 'ADUYUM', 'Kalite Müdürlüğü/Talimatlar/kaynak',
    '1-KDM-TL-095 Tehlikeli Atık Yönetimi Talimatı.docx',
    '1-KAL-TL-2025-0028 Tehlikeli Atık Yönetimi Talimatı.docx');
ren('A037', 'ADUYUM', 'Satış Sonrası Hizmetler Müdürlüğü/Talimatlar',
    'KDM-TL-079 İl Dışı Personel Görevlendirme Talimatı.pdf',
    'KAL-TL-2025-0025 İl Dışı Personel Görevlendirme Talimatı.pdf');
ren('A037', 'ADUYUM', 'Satış Sonrası Hizmetler Müdürlüğü/Talimatlar/kaynak',
    '1-KDM-TL-079 İl Dışı Personel Görevlendirme Talimatı.docx',
    '1-KAL-TL-2025-0025 İl Dışı Personel Görevlendirme Talimatı.docx');
ren('A038', 'ADUYUM', 'Satış Sonrası Hizmetler Müdürlüğü/Talimatlar',
    'KDM-TL-093 Yedek Parça Sevk Edilme Talimatı.pdf',
    'SSH-TL-2025-0002 Yedek Parça Sevk Edilme Talimatı.pdf');
ren('A038', 'ADUYUM', 'Satış Sonrası Hizmetler Müdürlüğü/Talimatlar/kaynak',
    '1-KDM-TL-093 Yedek Parça Sevk Edilme Talimatı.docx',
    '1-SSH-TL-2025-0002 Yedek Parça Sevk Edilme Talimatı.docx');
ren('A039', 'ADUYUM', 'Yurt Dışı Satış Müdürlüğü/Talimatlar',
    'KDM-TL-075 Yurt Dışı Sevkiyat Talimatı.pdf',
    'YUR-TL-2025-0001 Yurt Dışı Sevkiyat Talimatı.pdf');
ren('A039', 'ADUYUM', 'Yurt Dışı Satış Müdürlüğü/Talimatlar/kaynak',
    '1-KDM-TL-075 Yurt Dışı Sevkiyat Talimatı.docx',
    '1-YUR-TL-2025-0001 Yurt Dışı Sevkiyat Talimatı.docx');
ren('A041', 'ADUYUM', 'Üretim Müdürlüğü (Üst Yapı)/Talimatlar',
    'KDM-TL-033 Kaynaklı İmalat Talimatı.pdf',
    'KAY-TL-2025-0003 Kaynaklı İmalat Talimatı.pdf');
ren('A041', 'ADUYUM', 'Üretim Müdürlüğü (Üst Yapı)/Talimatlar/kaynak',
    '1-KDM-TL-033 Kaynaklı İmalat Talimatı.docx',
    '1-KAY-TL-2025-0003 Kaynaklı İmalat Talimatı.docx');
ren('A042', 'ADUYUM', 'Üretim Müdürlüğü (Üst Yapı)/Talimatlar',
    'KDM-TL-096 Astar-Boya Karışım Hazırlama Talimatı (Rev. 01).pdf',
    'ÜRE-TL-2026-0029 Astar-Boya Karışım Hazırlama Talimatı.pdf');
ren('A042', 'ADUYUM', 'Üretim Müdürlüğü (Üst Yapı)/Talimatlar/kaynak',
    '1-KDM-TL-096 Astar-Boya Karışım Hazırlama Talimatı (Rev. 01).docx',
    '1-ÜRE-TL-2026-0029 Astar-Boya Karışım Hazırlama Talimatı.docx');

// ── TAHSIS: ÜRE-TL-2026-0028 çakışması — Viskozite'ye yeni kod (0038) ───────
ren('A040', 'TAHSIS', 'Üretim Müdürlüğü (Üst Yapı)/Talimatlar',
    'KDM-TL-020 Viskozite Ölçüm Kabı Kullanım Talimatı.pdf',
    'ÜRE-TL-2026-0038 Viskozite Ölçüm Kabı Kullanım Talimatı.pdf');
ren('A040', 'TAHSIS', 'Üretim Müdürlüğü (Üst Yapı)/Talimatlar/kaynak',
    '1-KDM-TL-020 Viskozite Ölçüm Kabı Kullanım Talimatı.docx',
    '1-ÜRE-TL-2026-0038 Viskozite Ölçüm Kabı Kullanım Talimatı.docx');

// ── TAHSIS: A025 Kopya Stage5 → KAL-FR-2026-0032, Kalite/Formlar'a taşı ─────
ren('A025', 'TAHSIS', 'Üretim Müdürlüğü (Üst Yapı)/Formlar',
    'Kopya Kompakt Stage5 Fonksiyonel Kontrol Formu.pdf',
    'KAL-FR-2026-0032 Kompakt Stage5 Fonksiyonel Kontrol Formu.pdf',
    'Kalite Müdürlüğü/Formlar');

// ── KODFIX: A045 Bakımhane — antet (İDA-TL-2026-0001) esas alındı ───────────
ren('A045', 'KODFIX', 'İdari İşler Müdürlüğü/Talimatlar',
    'BAKIMHANE TALİMATI.pdf',
    'İDA-TL-2026-0001 Bakımhane Talimatı.pdf');
ren('A045', 'KODFIX', 'İdari İşler Müdürlüğü/Talimatlar/kaynak',
    '1-İDA-TL-2026-0002 Bakımhane Talimatı.docx',
    '1-İDA-TL-2026-0001 Bakımhane Talimatı.docx');

// ── KAYNAK: kaynak dosya adı düzeltmeleri ───────────────────────────────────
ren('A026', 'KAYNAK', 'Kalite Müdürlüğü/Formlar/kaynak',
    '1-KDM.FRM.044 Motor Hararet Ölçüm Formu - Kopya.xlsx',
    '1-KAL-FR-2025-0013 Motor Hararet Ölçüm Formu.xlsx');
ren('A027', 'KAYNAK', 'Kalite Müdürlüğü/Formlar/kaynak',
    '2-KAL-FR-2026-0026 Çay Toplama Elektrik Sistemi Fonksiyonel Kontrol Formu.xlsx',
    '1-KAL-FR-2026-0026 Çay Toplama Elektrik Sistemi Fonksiyonel Kontrol Formu.xlsx');
ren('A028', 'KAYNAK', 'Üretim Planlama Müdürlüğü/Talimatlar/kaynak',
    '2-kumlama.docx',
    '1-ÜRE-TL-2026-0020 Kumlama Ve Boyahane Çalışma Talimatı.docx');
ren('A044', 'KAYNAK', 'Üretim Planlama Müdürlüğü/Talimatlar/kaynak',
    '1-KDM-TL-096 Depoya Malzeme Giriş ve Çıkış Talimatı.docx',
    '1-ÜRE-TL-2025-0009 Depoya Malzeme Giriş ve Çıkış Talimatı.docx');

// ── ARSIV: eski/mükerrer kaynaklar ──────────────────────────────────────────
const ARCHIVES = [
    { aksiyon: 'A027', klasor: 'Kalite Müdürlüğü/Formlar/kaynak',
      dosya: '1-KDM.FRM.280 Çay Toplama Elektrik Sistemi Fonksiyonel Kontrol Formu.xlsx' },
    { aksiyon: 'A028', klasor: 'Üretim Planlama Müdürlüğü/Talimatlar/kaynak',
      dosya: '1-KDM-TL-098 Kumlama ve Boyahane Çalışma Talimatı (REVİZYON).doc' },
];

// ── çalıştır ────────────────────────────────────────────────────────────────
const logRows = [];
let ok = 0, err = 0;

for (const r of P) {
    const dir = path.join(ROOT, r.klasor);
    const outDir = r.yeniKlasor ? path.join(ROOT, r.yeniKlasor) : dir;
    const entry = fs.existsSync(dir) && findEntry(dir, r.eski);
    if (!entry) { console.log(`  HATA ${r.aksiyon}: bulunamadı → ${r.klasor}/${r.eski}`); err++; continue; }
    if (findEntry(outDir, r.yeni)) { console.log(`  HATA ${r.aksiyon}: hedef zaten var → ${r.yeni}`); err++; continue; }
    console.log(`  ${r.aksiyon} [${r.grup}] ${r.klasor}/`);
    console.log(`     ${r.eski}`);
    console.log(`  →  ${r.yeniKlasor ? r.yeniKlasor + '/' : ''}${r.yeni}`);
    if (APPLY) {
        fs.renameSync(path.join(dir, entry), path.join(outDir, r.yeni));
        logRows.push([new Date().toISOString(), r.aksiyon, r.grup, r.klasor, r.eski,
            (r.yeniKlasor ? r.yeniKlasor + '/' : '') + r.yeni]);
    }
    ok++;
}

for (const a of ARCHIVES) {
    const dir = path.join(ROOT, a.klasor);
    const entry = fs.existsSync(dir) && findEntry(dir, a.dosya);
    if (!entry) { console.log(`  HATA ${a.aksiyon}: arşivlenecek dosya bulunamadı → ${a.dosya}`); err++; continue; }
    const dest = path.join(ARSIV, a.klasor);
    console.log(`  ${a.aksiyon} [ARSIV] ${a.klasor}/${a.dosya} → 00_KYS_Analiz/Arsiv/${a.klasor}/`);
    if (APPLY) {
        fs.mkdirSync(dest, { recursive: true });
        fs.renameSync(path.join(dir, entry), path.join(dest, a.dosya));
        logRows.push([new Date().toISOString(), a.aksiyon, 'ARSIV', a.klasor, a.dosya,
            '00_KYS_Analiz/Arsiv/' + a.klasor + '/' + a.dosya]);
    }
    ok++;
}

if (APPLY && logRows.length) {
    const csv = logRows.map(r => r.map(c => `"${c}"`).join(';')).join('\n') + '\n';
    fs.appendFileSync(LOG, csv);
    console.log(`\nLog eklendi: ${LOG}`);
}
console.log(`\n${APPLY ? 'UYGULANDI' : 'DRY-RUN'}: ${ok} işlem, ${err} hata`);
