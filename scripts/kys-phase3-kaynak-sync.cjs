#!/usr/bin/env node
/**
 * KYS Aksiyon Planı — 3. faz: kaynak ↔ PDF ad eşitleme (A006 kuralı) + Rev temizliği (A010).
 *
 *  - A043   : KDM.ŞRT.006 → BOY-ST-2026-0002 (PDF + kaynak), KDM.ŞRT.005 kaynak senkronu
 *  - KSYNC  : Eski kodlu kaynak dosyasını klasördeki yeni kodlu PDF ile aynı ada getirir.
 *             Eşleştirme: 1) Kod Eşleme tablosu (eski kod → yeni kod), 2) başlık eşleşmesi
 *             (kod/önek/Rev ayıklanıp Türkçe küçük harfe çevrilerek; yalnız TEK aday varsa).
 *  - REVFIX : Yeni kodlu dosya adlarındaki (Rev.xx) eklerini temizler.
 *
 * Kullanım:
 *   node scripts/kys-phase3-kaynak-sync.cjs           # dry-run
 *   node scripts/kys-phase3-kaynak-sync.cjs --apply   # uygula
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const HOME = process.env.HOME;
const ROOT = path.join(HOME, 'Desktop/KademeQMS_Dokumanlar');
const EXCEL = path.join(ROOT, '00_KYS_Analiz/Revizyon/Kademe_KYS_Aksiyon_Takip Revizyon.xlsx');
const LOG = path.join(ROOT, '00_KYS_Analiz/rename_log_2026-06-12.csv');
const APPLY = process.argv.includes('--apply');

const norm = (s) => String(s ?? '').normalize('NFC');
const NEW_CODE_RE = /^([A-ZÇĞİÖŞÜ]{2,4}-[A-ZÇĞİÖŞÜ]{2}-\d{4}-\d{4})/u;
const OLD_CODE_RE = /^(\d-)?\s*(KDM[.\-][A-ZÇĞİÖŞÜa-zçğıöşü]{2,4}[.\-]?\s?\d{1,3}|[A-ZÇĞİÖŞÜ]{2,4}-[A-ZÇĞİÖŞÜ]{2}-\d{4}-\d{4})/u;

const stripRev = (s) => norm(s)
    .replace(/\s*\(\s*Rev[^)]*\)\s*/giu, ' ')
    .replace(/\s*Rev[._\s]*\d+\s*/giu, ' ')
    .replace(/\s*\(REVİZYON\)\s*/giu, ' ')
    .replace(/\s{2,}/g, ' ').trim();

// başlık: önek + kod + rev ayıklanmış, tr-küçük, boşluk normalize
const titleOf = (name) => {
    let s = stripRev(norm(name).replace(/\.[A-Za-z]+$/, ''));
    s = s.replace(/^\d-\s*/, '');
    s = s.replace(OLD_CODE_RE, '').replace(NEW_CODE_RE, '');
    return s.replace(/[\s._\-]+/gu, ' ').trim().toLocaleLowerCase('tr');
};

// ── Kod Eşleme tablosu ──────────────────────────────────────────────────────
const wb = XLSX.readFile(EXCEL);
const mapRows = XLSX.utils.sheet_to_json(wb.Sheets['Kod Eşleme'], { header: 1, defval: '' }).slice(1);
const old2new = new Map();
for (const r of mapRows) {
    const o = norm(r[0]).trim(), n = norm(r[1]).trim();
    if (o && /^[A-ZÇĞİÖŞÜ]{2,4}-[A-ZÇĞİÖŞÜ]{2}-\d{4}-\d{4}$/u.test(n)) old2new.set(o, n);
}

const findEntry = (dir, name) => {
    const t = norm(name);
    for (const e of fs.readdirSync(dir)) if (norm(e) === t) return e;
    return null;
};

const plan = [];   // {aksiyon, grup, klasor, eski, yeni}
const issues = [];

// ── A043: Şartnameler ───────────────────────────────────────────────────────
plan.push(
    { aksiyon: 'A043', grup: 'ADUYUM', klasor: 'Üretim Müdürlüğü (Üst Yapı)/Şartnameler',
      eski: 'KDM.ŞRT.006 Yaş Boya Şartnamesi.pdf', yeni: 'BOY-ST-2026-0002 Yaş Boya Şartnamesi.pdf' },
    { aksiyon: 'A043', grup: 'ADUYUM', klasor: 'Üretim Müdürlüğü (Üst Yapı)/Şartnameler/kaynak',
      eski: '1-KDM.ŞRT.006 Yaş Boya Şartnamesi.doc', yeni: '1-BOY-ST-2026-0002 Yaş Boya Şartnamesi.doc' },
    { aksiyon: 'A006', grup: 'KSYNC', klasor: 'Üretim Müdürlüğü (Üst Yapı)/Şartnameler/kaynak',
      eski: '1-KDM.ŞRT.005 Toz Boya Şartnamesi (Rev.01).doc', yeni: '1-BOY-ST-2026-0001 Toz Boya Şartnamesi.doc' },
);

// ── Kod çakışması çözümleri (disk üzerinde hâlâ duran A014/A015/A016) ──────
plan.push(
    // A014: KAL-TL-2026-0016 iki talimatta — Sapma Yönetimi'ne yeni numara (0032)
    { aksiyon: 'A014', grup: 'TAHSIS', klasor: 'Kalite Müdürlüğü/Talimatlar',
      eski: 'KAL-TL-2026-0016 Sapma Yönetimi Talimatı.pdf', yeni: 'KAL-TL-2026-0032 Sapma Yönetimi Talimatı.pdf' },
    { aksiyon: 'A014', grup: 'TAHSIS', klasor: 'Kalite Müdürlüğü/Talimatlar/kaynak',
      eski: '1-KDM-TL-106 Sapma Yönetimi Talimatı.doc', yeni: '1-KAL-TL-2026-0032 Sapma Yönetimi Talimatı.doc' },
    // A015: SSH-FR-2025-0009 hem Depo'da hem SSH'ta — Araç Temizlik'e DEP-FR kodu
    { aksiyon: 'A015', grup: 'TAHSIS', klasor: 'Depo Şefliği/Formlar',
      eski: 'SSH-FR-2025-0009 Araç Temizlik formu.pdf', yeni: 'DEP-FR-2025-0003 Araç Temizlik Formu.pdf' },
    { aksiyon: 'A015', grup: 'TAHSIS', klasor: 'Depo Şefliği/Formlar/kaynak',
      eski: '1-KDM.FRM.091 Araç Temizlik formu.xlsx', yeni: '1-DEP-FR-2025-0003 Araç Temizlik Formu.xlsx' },
    // A016: SSH-FR-2025-0003 iki formda — Müşteri Çözüm Desteği'ne yeni numara (0002)
    { aksiyon: 'A016', grup: 'TAHSIS', klasor: 'Satış Sonrası Hizmetler Müdürlüğü/Formlar',
      eski: 'SSH-FR-2025-0003 Müşteri Çözüm Desteği Kayıt Formu.pdf', yeni: 'SSH-FR-2025-0002 Müşteri Çözüm Desteği Kayıt Formu.pdf' },
    { aksiyon: 'A016', grup: 'TAHSIS', klasor: 'Satış Sonrası Hizmetler Müdürlüğü/Formlar/kaynak',
      eski: '1-KDM.FRM.054 Müşteri Çözüm Desteği Kayıt Formu.XLSX', yeni: '1-SSH-FR-2025-0002 Müşteri Çözüm Desteği Kayıt Formu.xlsx' },
    // Ad sonundaki fazla boşluklar (A200)
    { aksiyon: 'A200', grup: 'TYPO', klasor: 'Depo Şefliği/Formlar',
      eski: 'DEP-FR-2025-0001 Araç Bekletme Formu .pdf', yeni: 'DEP-FR-2025-0001 Araç Bekletme Formu.pdf' },
    { aksiyon: 'A200', grup: 'TYPO', klasor: 'Kalite Müdürlüğü/Formlar',
      eski: 'KAL-FR-2025-0061 Cross Cut- Kaplama Kontrol Formu .pdf', yeni: 'KAL-FR-2025-0061 Cross Cut- Kaplama Kontrol Formu.pdf' },
    // ÜRE-TL-2026-0006 kaynağı eski BOY-TL koduyla (KSYNC regex'i KDM dışını yakalamaz)
    { aksiyon: 'A006', grup: 'KSYNC', klasor: 'Üretim Müdürlüğü (Üst Yapı)/Talimatlar/kaynak',
      eski: '1-BOY-TL-2025-0006 Boya ve Kimyasal Malzemeler için FIFO (İlk Giren İlk Çıkar) Depolama ve Kullanım Talimatı (Rev.02).doc',
      yeni: '1-ÜRE-TL-2026-0006 Boya ve Kimyasal Malzemeler için FIFO (İlk Giren İlk Çıkar) Depolama ve Kullanım Talimatı.doc' },
);

// ── REVFIX: yeni kodlu adlardaki Rev ekleri ─────────────────────────────────
const REVFIX = [
    ['Kalite Müdürlüğü/El Kitapları', 'KAL-EK-2025-0001 Kalite El Kitabı (Rev.01).pdf'],
    ['Üretim Müdürlüğü (Üst Yapı)/Formlar', 'KAL-FR-2025-0023 Viskozite Takip Formu (Rev.01).pdf'],
    ['Üretim Müdürlüğü (Üst Yapı)/Talimatlar', 'ÜRE-TL-2026-0006 Boya ve Kimyasal Malzemeler için FIFO (İlk Giren İlk Çıkar) Depolama ve Kullanım Talimatı (Rev.02).pdf'],
    ['Kalite Müdürlüğü/Görev Tanımları/kaynak', '1-KAL-GT-2025-0009 SSH Müdürü Görev Tanımı (Rev.01).docx'],
    ['Kalite Müdürlüğü/Prosedürler/kaynak', '1-KAL-PR-2025-0004 İç Tetkik Prosedürü (Rev.01).doc'],
];
for (const [klasor, eski] of REVFIX) {
    const ext = path.extname(eski);
    const yeni = stripRev(eski.slice(0, -ext.length)) + ext;
    plan.push({ aksiyon: 'A010', grup: 'REVFIX', klasor, eski, yeni });
}

// ── KSYNC: eski kodlu kaynak dosyaları ──────────────────────────────────────
const walkKaynak = (dir, acc = []) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name.startsWith('.')) continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
            if (e.name === '00_KYS_Analiz') continue;
            if (norm(e.name) === 'kaynak') acc.push(p); else walkKaynak(p, acc);
        }
    }
    return acc;
};

const handled = new Set(plan.map(p => norm(p.klasor + '/' + p.eski)));

for (const kdir of walkKaynak(ROOT)) {
    const parent = path.dirname(kdir);
    const pdfs = fs.readdirSync(parent).filter(f => /\.pdf$/i.test(f));
    const pdfByTitle = new Map();
    for (const f of pdfs) {
        const t = titleOf(f);
        if (!pdfByTitle.has(t)) pdfByTitle.set(t, []);
        pdfByTitle.get(t).push(norm(f));
    }
    for (const f of fs.readdirSync(kdir)) {
        const nf = norm(f);
        const rel = path.relative(ROOT, kdir);
        if (handled.has(norm(rel + '/' + nf))) continue;
        if (!/^\d?-?\s*KDM[.\-]/u.test(nf)) continue;             // yalnız eski KDM kodlu kaynaklar
        const ext = path.extname(nf);
        const oldCodeM = nf.replace(/^\d-/, '').match(/^(KDM[.\-][A-ZÇĞİÖŞÜa-zçğıöşü]{2,4}[.\-]?\s?\d{1,3})/u);
        const oldCode = oldCodeM ? oldCodeM[1].replace(/\s+$/, '') : null;

        let targetPdf = null, via = null;
        // 1) kod eşleme tablosu
        if (oldCode && old2new.has(oldCode)) {
            const nc = old2new.get(oldCode);
            const hit = pdfs.map(norm).filter(p => p.startsWith(nc + ' ') || p.startsWith(nc + '.'));
            if (hit.length === 1) { targetPdf = hit[0]; via = 'eşleme'; }
        }
        // 2) başlık eşleşmesi (tek aday)
        if (!targetPdf) {
            const cands = pdfByTitle.get(titleOf(nf)) || [];
            const newCoded = cands.filter(p => NEW_CODE_RE.test(p));
            if (newCoded.length === 1) { targetPdf = newCoded[0]; via = 'başlık'; }
        }
        if (targetPdf) {
            // PDF taban adını da normalize et (Rev eki, çift/sondaki boşluk) — REVFIX/TYPO ile tutarlı
            const base = stripRev(targetPdf.replace(/\.pdf$/i, '')).replace(/\s{2,}/g, ' ').trim();
            const yeni = '1-' + base + ext.toLowerCase();
            if (norm(yeni) !== nf) plan.push({ aksiyon: 'A006', grup: 'KSYNC', klasor: rel, eski: nf, yeni, via });
        } else {
            issues.push(`${rel}/${nf}  (eski kod: ${oldCode || '?'} — PDF eşleşmesi bulunamadı)`);
        }
    }
}

// ── çalıştır ────────────────────────────────────────────────────────────────
const logRows = [];
let ok = 0, err = 0;
for (const r of plan) {
    const dir = path.join(ROOT, r.klasor);
    if (!fs.existsSync(dir)) { console.log(`  HATA ${r.aksiyon}: klasör yok → ${r.klasor}`); err++; continue; }
    const entry = findEntry(dir, r.eski);
    if (!entry) { console.log(`  HATA ${r.aksiyon}: bulunamadı → ${r.klasor}/${r.eski}`); err++; continue; }
    if (findEntry(dir, r.yeni)) { console.log(`  HATA ${r.aksiyon}: hedef zaten var → ${r.klasor}/${r.yeni}`); err++; continue; }
    console.log(`  ${r.aksiyon} [${r.grup}${r.via ? ':' + r.via : ''}] ${r.klasor}/`);
    console.log(`     ${r.eski}`);
    console.log(`  →  ${r.yeni}`);
    if (APPLY) {
        fs.renameSync(path.join(dir, entry), path.join(dir, r.yeni));
        logRows.push([new Date().toISOString(), r.aksiyon, r.grup, r.klasor, r.eski, r.yeni]);
    }
    ok++;
}

if (issues.length) {
    console.log('\nEŞLEŞTİRİLEMEYEN KAYNAKLAR (elle karar gerekli):');
    for (const i of issues) console.log('  ! ' + i);
}
if (APPLY && logRows.length) {
    fs.appendFileSync(LOG, logRows.map(r => r.map(c => `"${c}"`).join(';')).join('\n') + '\n');
    console.log(`\nLog eklendi: ${LOG}`);
}
console.log(`\n${APPLY ? 'UYGULANDI' : 'DRY-RUN'}: ${ok} işlem, ${err} hata, ${issues.length} eşleşmeyen`);
