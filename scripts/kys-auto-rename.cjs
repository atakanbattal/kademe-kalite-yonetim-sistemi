#!/usr/bin/env node
/**
 * KYS Aksiyon Planı — otomatik dosya adı düzeltme aracı.
 *
 * Gruplar:
 *  - TYPO     : Yazım/Adlandırma düzeltmeleri (A202–A212)
 *  - DOTFIX   : Noktalı kod → tireli format (A072, A073, A210)
 *  - KODSUZ   : Kodsuz dosya adlarına kod ekleme (A074+)
 *  - ESKIKOD  : KDM eski kodlu dosyalara yeni kod tahsisi (A091–A128)
 *  - ARDASH   : AR-- → AR- (A201)
 *  - DBLSPACE : Çift boşluk temizliği (A200)
 *
 * Kullanım:
 *   node scripts/kys-auto-rename.cjs           # dry-run
 *   node scripts/kys-auto-rename.cjs --apply   # uygula
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const HOME = process.env.HOME;
const ROOT = path.join(HOME, 'Desktop/KademeQMS_Dokumanlar');
const EXCEL = path.join(ROOT, '00_KYS_Analiz/Revizyon/Kademe_KYS_Aksiyon_Takip Revizyon.xlsx');
const WORKDIR = path.join(__dirname, '_kys_rename');
const APPLY = process.argv.includes('--apply');

const norm = (s) => String(s ?? '').normalize('NFC');
const CODE_RE = /([A-ZÇĞİÖŞÜ]{2,4}-[A-ZÇĞİÖŞÜ]{2}-\d{4}-\d{4})/g;
const LEAD_CODE_RE = /^[A-ZÇĞİÖŞÜ]{2,4}-[A-ZÇĞİÖŞÜ]{2}-\d{4}-\d{4}\s*/;

const walk = (dir, acc = []) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name.startsWith('.')) continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
            if (e.name === '00_KYS_Analiz') continue;
            walk(p, acc);
        } else acc.push(p);
    }
    return acc;
};

const stripRev = (s) => s
    .replace(/\s*\(Rev[^)]*\)?\s*/gi, ' ')
    .replace(/\s*Rev[._]\s*\d+\s*/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

const collapseSpaces = (s) => s.replace(/\s{2,}/g, ' ').replace(/\s+(\.[A-Za-z]+)$/, '$1').trim();

// ── veri yükle ───────────────────────────────────────────────────────────────
const wb = XLSX.readFile(EXCEL);
const actions = XLSX.utils.sheet_to_json(wb.Sheets['Aksiyon Listesi'], { defval: '' });
const mappingRows = XLSX.utils.sheet_to_json(wb.Sheets['Kod Eşleme'], { header: 1, defval: '' }).slice(1);

const allFiles = walk(ROOT);
const byBasename = new Map(); // norm(basename).toLowerCase() -> [fullpath]
for (const f of allFiles) {
    const k = norm(path.basename(f)).toLowerCase();
    if (!byBasename.has(k)) byBasename.set(k, []);
    byBasename.get(k).push(f);
}

// kullanılan kodlar
const usedCodes = new Set();
const addCodes = (text) => {
    for (const m of norm(text).matchAll(CODE_RE)) usedCodes.add(m[1]);
};
for (const f of allFiles) addCodes(path.basename(f));
addCodes(fs.readFileSync(path.join(WORKDIR, 'ekys-codes.txt'), 'utf8'));
for (const r of mappingRows) addCodes(String(r[1] || ''));
for (const a of actions) { addCodes(a['Önerilen Aksiyon']); addCodes(a['Dosya / Doküman']); }

const allocate = (series) => {
    let n = 1;
    while (usedCodes.has(`${series}-${String(n).padStart(4, '0')}`)) n++;
    const code = `${series}-${String(n).padStart(4, '0')}`;
    usedCodes.add(code);
    return code;
};

const PREFIX = {
    'Ar-Ge Direktörlüğü': 'AR', 'Depo Şefliği': 'DEP', 'Kalite Müdürlüğü': 'KAL',
    'Satınalma Müdürlüğü': 'SAT', 'Satış Sonrası Hizmetler Müdürlüğü': 'SSH',
    'Üretim Müdürlüğü (Üst Yapı)': 'ÜRE', 'Üretim Planlama Müdürlüğü': 'PLA',
    'İdari İşler Müdürlüğü': 'İDA', 'İnsan Kaynakları Müdürlüğü': 'İNS',
    'Yurt İçi Satış Müdürlüğü': 'YİS', 'Yurt Dışı Satış Müdürlüğü': 'YUR',
};
const TYPE = {
    'Talimatlar': 'TL', 'Formlar': 'FR', 'Planlar': 'PL', 'Tablolar': 'TB',
    'Sözleşmeler': 'SZ', 'Şartnameler': 'ST', 'Prosedürler': 'PR',
    'Şemalar': 'SM', 'Listeler': 'LS', 'Yönetmelikler': 'YN',
};

// sahiplik/tip kararı bekleyenler — dokunma
const SKIP_ACTIONS = new Map([
    ['A084', 'tip kararı gerekli (SOP şablonu form mu talimat mı)'],
]);
const SKIP_OLDCODES = new Map([
    ['KDM-TL-128', 'A066 sahiplik kararı bekliyor (İK\'ya devir önerisi)'],
    ['KDM-TL-104', 'A067 sahiplik kararı bekliyor (Depo önerisi)'],
]);

const TYPO_FIXES = [
    { no: 'A202', from: 'Teknil', to: 'Teknik' },
    { no: 'A203', from: 'Gannt', to: 'Gantt' },
    { no: 'A204', from: 'Sıkıştıma', to: 'Sıkıştırma' },
    { no: 'A205', from: 'Dogrudan', to: 'Doğrudan' },
    { no: 'A207', from: 'Dogrulama', to: 'Doğrulama' },
    { no: 'A208', from: 'Tehlikleli', to: 'Tehlikeli' },
    { no: 'A209', from: 'Satınalma Talimat.pdf', to: 'Satınalma Talimatı.pdf' },
    { no: 'A210', from: 'Kontrlol', to: 'Kontrol' },
    { no: 'A211', from: 'Tutanagı', to: 'Tutanağı' },
    { no: 'A212', from: 'Eğitim İhtiyaç Analiz ve Analiz Formu', to: 'Eğitim İhtiyaç Analiz Formu' },
];
const applyTypos = (s) => {
    let out = s;
    for (const t of TYPO_FIXES) out = out.split(t.from.replace(/\.pdf$/, '')).join(t.to.replace(/\.pdf$/, ''));
    return out;
};

// ── plan: dosya başına tek kayıt; kurallar zincirlenir ───────────────────────
const renames = new Map(); // fullPath -> { nos:Set, groups:Set, newName, notes:[] }
const skipped = [];
const newMappings = [];

const current = (f) => (renames.get(f)?.newName) ?? norm(path.basename(f));
const setRename = (no, group, f, newName, note = '') => {
    newName = collapseSpaces(norm(newName));
    const entry = renames.get(f) || { nos: new Set(), groups: new Set(), newName: norm(path.basename(f)), notes: [] };
    entry.nos.add(no); entry.groups.add(group);
    entry.newName = newName;
    if (note) entry.notes.push(note);
    renames.set(f, entry);
};

const findFile = (fileName) => {
    const hits = byBasename.get(norm(fileName).toLowerCase()) || [];
    return hits.filter((h) => !path.dirname(h).endsWith('kaynak'));
};

const findKaynak = (pdfPath) => {
    const dir = path.join(path.dirname(pdfPath), 'kaynak');
    if (!fs.existsSync(dir)) return null;
    const base = norm(path.basename(pdfPath)).replace(/\.pdf$/i, '');
    const baseNoRev = stripRev(base);
    for (const f of fs.readdirSync(dir)) {
        const fBase = norm(f).replace(/^1-/, '').replace(/\.[^.]+$/, '');
        if (fBase === base || stripRev(fBase) === stripRev(baseNoRev) || stripRev(fBase) === baseNoRev) {
            return path.join(dir, f);
        }
    }
    return null;
};

const openActions = actions.filter((a) => String(a['Durum']).trim() === 'Açık');

for (const a of openActions) {
    const no = a['No'];
    const cat = norm(a['Kategori']).trim();
    const fileField = norm(a['Dosya / Doküman']).trim();
    const actionText = norm(a['Önerilen Aksiyon']);
    const konum = norm(a['Konum (Müdürlük/Klasör)']).trim();

    if (SKIP_ACTIONS.has(no)) { skipped.push({ no, reason: SKIP_ACTIONS.get(no) }); continue; }

    // — Yazım düzeltmeleri —
    const typo = TYPO_FIXES.find((t) => t.no === no);
    if (typo) {
        const hits = findFile(fileField);
        if (!hits.length) { skipped.push({ no, reason: `dosya bulunamadı: ${fileField}` }); continue; }
        for (const h of hits) {
            let nn = current(h).split(typo.from).join(typo.to);
            if (no === 'A210') {
                nn = stripRev(nn.replace(/^([A-ZÇĞİÖŞÜ]{2,4})\.([A-ZÇĞİÖŞÜ]{2})\.(\d{4})\.(\d{4})/, '$1-$2-$3-$4').replace(/\.pdf$/i, '')) + path.extname(h);
            }
            setRename(no, 'TYPO', h, nn);
            const k = findKaynak(h);
            if (k) {
                let kn = current(k).split(typo.from).join(typo.to);
                if (no === 'A210') {
                    kn = '1-' + stripRev(kn.replace(/^1-/, '').replace(/^([A-ZÇĞİÖŞÜ]{2,4})\.([A-ZÇĞİÖŞÜ]{2})\.(\d{4})\.(\d{4})/, '$1-$2-$3-$4').replace(/\.[^.]+$/, '')) + path.extname(k);
                }
                setRename(no, 'TYPO', k, kn);
            }
        }
        continue;
    }

    // — Noktalı kod → tireli —
    if (no === 'A072' || no === 'A073') {
        const hits = findFile(fileField);
        if (!hits.length) { skipped.push({ no, reason: `dosya bulunamadı: ${fileField}` }); continue; }
        for (const h of hits) {
            let nn = current(h).replace(/^([A-ZÇĞİÖŞÜ]{2,4})\.([A-ZÇĞİÖŞÜ]{2})\.(\d{4})\.(\d{4})/, '$1-$2-$3-$4');
            if (no === 'A072') nn = nn.replace('Depo işleyiş prösedürü', 'Depo İşleyiş Prosedürü');
            setRename(no, 'DOTFIX', h, nn);
            const k = findKaynak(h);
            if (k) {
                let kn = current(k).replace(/^1-([A-ZÇĞİÖŞÜ]{2,4})\.([A-ZÇĞİÖŞÜ]{2})\.(\d{4})\.(\d{4})/, '1-$1-$2-$3-$4');
                if (no === 'A072') kn = kn.replace('Depo işleyiş prösedürü', 'Depo İşleyiş Prosedürü');
                setRename(no, 'DOTFIX', k, kn);
            }
        }
        continue;
    }

    // — Kodsuz dosya adı —
    if (cat === 'Kodsuz Dosya Adı') {
        const hits = findFile(fileField);
        if (!hits.length) { skipped.push({ no, reason: `dosya bulunamadı: ${fileField}` }); continue; }
        const codeMatch = actionText.match(/'([A-ZÇĞİÖŞÜ]{2,4}-[A-ZÇĞİÖŞÜ]{2}-\d{4}-\d{4})/);
        for (const h of hits) {
            const ext = path.extname(h);
            let title = current(h).replace(/\.[^.]+$/, '');
            title = title.replace(LEAD_CODE_RE, '');          // mevcut kodu at (A088)
            title = title.replace(/[_\s]\d{6,8}$/, '');        // tarih süreklemesi (A085)
            title = stripRev(title).replace(/\.drawio/gi, '').replace(/\s+R\d+$/, '');
            title = applyTypos(title);
            if (no === 'A088') title = 'İSG Kurul Toplantı Tutanağı Formu';
            if (no === 'A090') title = 'Disiplin Yönetmeliği';
            title = title.replace(/^KDM\.YN\.\d+\s*/, '');

            let code;
            if (codeMatch) code = codeMatch[1];
            else if (no === 'A088') code = 'İSG-FR-2026-0001'; // kod zaten dosyada
            else {
                const seriesMatch = actionText.match(/\(?([A-ZÇĞİÖŞÜ]{2,4}-[A-ZÇĞİÖŞÜ]{2})\)?(?:-\.\.\.)?\s*kod/);
                let prefix, type;
                if (seriesMatch) [prefix, type] = seriesMatch[1].split('-');
                else { const [mud, klasor] = konum.split('/'); prefix = PREFIX[mud]; type = TYPE[klasor]; }
                if (!prefix || !type) { skipped.push({ no, reason: `seri belirlenemedi: ${konum}` }); continue; }
                code = allocate(`${prefix}-${type}-2026`);
            }
            setRename(no, 'KODSUZ', h, `${code} ${title}${ext}`);
            const k = findKaynak(h);
            if (k) setRename(no, 'KODSUZ', k, `1-${code} ${title}${path.extname(k)}`);
            newMappings.push({ old: fileField.replace(/\.[^.]+$/, ''), neu: code, folder: konum, oldFile: norm(path.basename(h)), newFile: `${code} ${title}.pdf`, note: no });
        }
        continue;
    }

    // — Eski kod sistemi —
    if (cat === 'Eski Kod Sistemi') {
        const oldCodeMatch = fileField.match(/^(KDM[.-][A-ZÇĞİÖŞÜ]+[.-]?\d+)/);
        const oldCode = oldCodeMatch ? oldCodeMatch[1] : null;
        const oldCodeKey = oldCode ? oldCode.replace(/\./g, '-') : null;
        if (oldCodeKey && SKIP_OLDCODES.has(oldCodeKey)) {
            skipped.push({ no, reason: SKIP_OLDCODES.get(oldCodeKey) });
            continue;
        }
        const hits = findFile(fileField);
        if (!hits.length) { skipped.push({ no, reason: `dosya bulunamadı: ${fileField}` }); continue; }
        const [mud, klasor] = konum.split('/');
        const prefix = PREFIX[mud]; const type = TYPE[klasor];
        if (!prefix || !type) { skipped.push({ no, reason: `seri belirlenemedi: ${konum}` }); continue; }
        for (const h of hits) {
            const ext = path.extname(h);
            let title = current(h).replace(/\.[^.]+$/, '').replace(/^KDM[.-][A-ZÇĞİÖŞÜ]+[.-]?\d+\s*/, '');
            title = applyTypos(stripRev(title));
            const code = allocate(`${prefix}-${type}-2026`);
            setRename(no, 'ESKIKOD', h, `${code} ${title}${ext}`, `eski: ${oldCode}`);
            const k = findKaynak(h);
            if (k) setRename(no, 'ESKIKOD', k, `1-${code} ${title}${path.extname(k)}`, `eski: ${oldCode}`);
            newMappings.push({ old: oldCode, neu: code, folder: konum, oldFile: norm(path.basename(h)), newFile: `${code} ${title}.pdf`, note: no });
        }
        continue;
    }
}

// — AR-- → AR- (A201) —
for (const f of allFiles) {
    const c = current(f);
    if (c.includes('AR--')) setRename('A201', 'ARDASH', f, c.split('AR--').join('AR-'));
}

// — Çift boşluk (A200) —
for (const f of allFiles) {
    const c = current(f);
    if (/\s{2,}/.test(c)) setRename('A200', 'DBLSPACE', f, c);
}

// ── çakışma kontrolü ─────────────────────────────────────────────────────────
const plan = [...renames.entries()]
    .filter(([f, e]) => norm(path.basename(f)) !== e.newName)
    .map(([f, e]) => ({
        no: [...e.nos].join('+'), group: [...e.groups].join('+'),
        dir: path.dirname(f), src: f, oldName: norm(path.basename(f)), newName: e.newName,
        note: e.notes.join('; '),
    }));

const targets = new Map();
const conflicts = [];
for (const p of plan) {
    const t = norm(path.join(p.dir, p.newName));
    if (targets.has(t)) conflicts.push({ ...p, reason: `hedef çakışıyor: ${targets.get(t).no}` });
    else if (fs.existsSync(t)) conflicts.push({ ...p, reason: 'hedef dosya zaten var' });
    targets.set(t, p);
}

const byGroup = {};
for (const p of plan) byGroup[p.group] = (byGroup[p.group] || 0) + 1;
console.log('PLAN ÖZETİ:', JSON.stringify(byGroup), '— toplam', plan.length, 'rename');
console.log('Atlanan:', skipped.length, '| Çakışma:', conflicts.length);
for (const s of skipped) console.log('  SKIP', s.no, '-', s.reason);
for (const c of conflicts) console.log('  CONFLICT', c.no, c.oldName, '->', c.newName, '|', c.reason);

fs.writeFileSync(path.join(WORKDIR, 'plan.json'), JSON.stringify({ plan, skipped, conflicts, newMappings }, null, 2));

if (!APPLY) {
    console.log('');
    for (const p of plan) console.log(`[${p.group}] ${p.no}\n  ${p.oldName}\n  -> ${p.newName}`);
    process.exit(0);
}

// ── uygula ───────────────────────────────────────────────────────────────────
const conflictSrcs = new Set(conflicts.map((c) => c.src));
const log = [['zaman', 'aksiyon', 'grup', 'klasor', 'eski_ad', 'yeni_ad']];
let done = 0;
for (const p of plan) {
    if (conflictSrcs.has(p.src)) { console.log('ATLA (çakışma):', p.oldName); continue; }
    fs.renameSync(p.src, path.join(p.dir, p.newName));
    log.push([new Date().toISOString(), p.no, p.group, path.relative(ROOT, p.dir), p.oldName, p.newName]);
    done++;
}
const csv = log.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
const logPath = path.join(ROOT, '00_KYS_Analiz', `rename_log_${new Date().toISOString().slice(0, 10)}.csv`);
fs.writeFileSync(logPath, '\ufeff' + csv);
console.log(`\n${done} dosya yeniden adlandırıldı. Log: ${logPath}`);
fs.writeFileSync(path.join(WORKDIR, 'new-mappings.json'), JSON.stringify(newMappings, null, 2));
