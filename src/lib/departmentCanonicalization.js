import { normalizeTurkishForSearch } from '@/lib/utils';

const SPECIAL_ORG_NAMES = new Set(['Tedarikçi', 'Girdi Kalite']);

/**
 * Ayarlar (cost_settings birim adları) + personel birim / üst departman ile
 * karşılaştırmada kullanılan anahtar: Türkçe fold, boşluk ve tire kaldırılır.
 */
export function departmentMatchKey(text) {
    if (text == null || text === '') return '';
    const n = normalizeTurkishForSearch(String(text));
    return n.replace(/[\s\-_.]/g, '');
}

function uniqueNonEmpty(strings) {
    const out = [];
    const seen = new Set();
    for (const s of strings) {
        const t = typeof s === 'string' ? s.trim() : '';
        if (!t || seen.has(t)) continue;
        seen.add(t);
        out.push(t);
    }
    return out;
}

/**
 * Personel tablosundan (department rk → çoğunluk management_department) tek geçişte harita.
 * Kalite maliyeti birim filtresinde canonicalize binlerce kez çağrıldığı için O(P) tarama tekrarlanmamalı.
 */
function buildPersonnelDepartmentToMdMap(personnel) {
    if (!personnel?.length) return new Map();
    /** @type {Map<string, Map<string, number>>} */
    const tallyByDeptNk = new Map();
    for (const p of personnel) {
        const d = typeof p?.department === 'string' ? p.department.trim() : '';
        const md = typeof p?.management_department === 'string' ? p.management_department.trim() : '';
        if (!d || !md) continue;
        const drk = departmentMatchKey(d);
        const mrk = departmentMatchKey(md);
        if (!drk || mrk === drk) continue;
        if (!tallyByDeptNk.has(drk)) tallyByDeptNk.set(drk, new Map());
        const inner = tallyByDeptNk.get(drk);
        inner.set(md, (inner.get(md) ?? 0) + 1);
    }
    /** @type {Map<string, string>} */
    const winner = new Map();
    for (const [deptNk, mdCounts] of tallyByDeptNk) {
        const ranked = [...mdCounts.entries()].sort((a, b) => {
            if (b[1] !== a[1]) return b[1] - a[1];
            const ld = departmentMatchKey(b[0]).length - departmentMatchKey(a[0]).length;
            if (ld !== 0) return ld;
            return a[0].localeCompare(b[0], 'tr');
        });
        winner.set(deptNk, ranked[0][0]);
    }
    return winner;
}

/**
 * cost_settings + personel birim havuzu (canonicalize gövdesi için); dizi referansı değişmediyse önbelleklenir.
 */
function buildOrganizationPool(unitCostSettings, personnel) {
    const fromUnits = uniqueNonEmpty((unitCostSettings || []).map((u) => u?.unit_name));
    const fromPersonnelRaw = [];
    for (const p of personnel || []) {
        if (p?.department) fromPersonnelRaw.push(p.department);
        if (p?.management_department) fromPersonnelRaw.push(p.management_department);
    }
    const fromPersonnelU = uniqueNonEmpty(fromPersonnelRaw);
    const unitSet = new Set(fromUnits);
    const personnelSet = new Set(fromPersonnelU);
    const uniqueCandidates = uniqueNonEmpty([...fromUnits, ...fromPersonnelU]);
    const personnelDeptToMd = buildPersonnelDepartmentToMdMap(personnel);
    return {
        fromUnits,
        fromPersonnelU,
        uniqueCandidates,
        unitSet,
        personnelSet,
        personnelDeptToMd,
    };
}

let _poolUnitsRef = null;
let _poolPersonnelRef = null;
/** @type {ReturnType<typeof buildOrganizationPool> | null} */
let _organizationPoolCache = null;

function getOrganizationPool(unitCostSettings, personnel) {
    if (
        _organizationPoolCache &&
        unitCostSettings === _poolUnitsRef &&
        personnel === _poolPersonnelRef
    ) {
        return _organizationPoolCache;
    }
    _poolUnitsRef = unitCostSettings;
    _poolPersonnelRef = personnel;
    _organizationPoolCache = buildOrganizationPool(unitCostSettings, personnel);
    return _organizationPoolCache;
}

/**
 * Personelde aynı alt birim yazımına (department) düşen çoğunluk üst departman.
 * Supabase dept_roll_subunit_to_management ile aynı öncelik.
 */
function resolveDepartmentToManagementViaPersonnel(trimmedDept, personnelDeptToMd) {
    if (!trimmedDept || !personnelDeptToMd?.size) return null;
    const rk = departmentMatchKey(trimmedDept);
    return personnelDeptToMd.get(rk) ?? null;
}

/**
 * Personelde aktif atanmı kalmayan eski kayıtlar: PL alt birim → üst yapı müdürlüğü yazımı
 * (migration 20260415180000 / dept_roll_subunit_to_management ile tutarlı hedef metinleri).
 */
const LEGACY_SUBUNIT_PARENT_ROWS = [
    ['Ar-Ge', 'Ar-Ge Direktörlüğü'],
    ['Boyahane', 'Üretim Müdürlüğü (Üst Yapı)'],
    ['Depo', 'Depo Şefliği'],
    ['Elektrikhane', 'Üretim Müdürlüğü (Üst Yapı)'],
    ['Genel Müdürlük', 'Kademe Genel Müdürlüğü'],
    ['Kabin Hattı', 'Üretim Müdürlüğü (Kabin Hattı)'],
    ['Kalite Güvence', 'Kalite Müdürlüğü'],
    ['Kalite Kontrol', 'Kalite Müdürlüğü'],
    ['Kaynakhane', 'Üretim Müdürlüğü (Üst Yapı)'],
    ['Kurumsal İletişim', 'Kurumsal İletişim ve Dijital Pazarlama'],
    ['Lojistik', 'Lojistik Yöneticiliği'],
    ['Mali İşler', 'Mali İşler'],
    ['Montajhane', 'Üretim Müdürlüğü (Üst Yapı)'],
    ['Planlama', 'Üretim Planlama Müdürlüğü'],
    ['Satınalma', 'Satınalma Müdürlüğü'],
    ['Satış Sonrası Hizmetler', 'Satış Sonrası Hizmetler Müdürlüğü'],
    ['Yurt Dışı Satış', 'Yurt Dışı Satış Müdürlüğü'],
    ['Yurt İçi Satış', 'Yurt İçi Satış Müdürlüğü'],
    ['Üst Yapı', 'Üretim Müdürlüğü (Üst Yapı)'],
    ['İdari İşler', 'İdari İşler Müdürlüğü'],
    ['İnsan Kaynakları', 'İnsan Kaynakları Müdürlüğü'],
    ['Mekanik Montaj', 'Üretim Müdürlüğü (Üst Yapı)'],
    ['Lazer Kesim', 'Üretim Müdürlüğü (Üst Yapı)'],
    ['Abkant Pres', 'Üretim Müdürlüğü (Üst Yapı)'],
    ['Bilgi İşlem', 'İdari İşler Müdürlüğü'],
    ['Mühendislik', 'Ar-Ge Direktörlüğü'],
    ['Üretim', 'Üretim Müdürlüğü (Üst Yapı)'],
    ['İsg', 'İdari İşler Müdürlüğü'],
    ['Elektrik Montaj', 'Üretim Müdürlüğü (Üst Yapı)'],
    ['Planma', 'Üretim Planlama Müdürlüğü'],
];

let legacyParentByMatchKey = null;
function lookupLegacySubunitParent(rk) {
    if (!rk) return null;
    if (!legacyParentByMatchKey) {
        legacyParentByMatchKey = new Map();
        for (const [sub, parent] of LEGACY_SUBUNIT_PARENT_ROWS) {
            legacyParentByMatchKey.set(departmentMatchKey(sub), parent);
        }
    }
    return legacyParentByMatchKey.get(rk) ?? null;
}

/**
 * cost_settings.unit_name + personnel.department + personnel.management_department
 * havuzundan tek tip departman adı üretir (mükerrer Ar-Ge / Ar-Ge Direktörlüğü vb.).
 */
function collectFamilyCandidates(rk, uniqueCandidates) {
    if (!rk) return [];
    const out = [];
    const seen = new Set();
    for (const c of uniqueCandidates) {
        const ck = departmentMatchKey(c);
        if (!ck) continue;
        let inFamily = false;
        if (ck === rk) inFamily = true;
        else if (rk.length >= 4 && ck.startsWith(rk) && ck.length > rk.length) inFamily = true;
        else if (rk.length >= 6 && rk.startsWith(ck) && ck.length >= 4 && ck.length < rk.length) inFamily = true;
        if (!inFamily || seen.has(c)) continue;
        seen.add(c);
        out.push(c);
    }
    return out;
}

/**
 * cost_settings.unit_name + personnel.department + personnel.management_department
 * havuzundan tek tip departman adı üretir (mükerrer Ar-Ge / Ar-Ge Direktörlüğü vb.).
 *
 * Önemli: Sadece cost_settings’te kısa "Ar-Ge" varken personelde uzun "Ar-Ge Direktörlüğü"
 * olduğunda, tam anahtar eşleşmesinde kısa ada dönülmesin diye önce "aile" (exact + prefix/suffix)
 * adayları toplanır; personelde geçen ve en uzun normalleştirilmiş anahtar tercih edilir.
 */
export function canonicalizeDepartmentName(raw, ctx = {}) {
    const unitCostSettings = ctx.unitCostSettings ?? [];
    const personnel = ctx.personnel ?? [];
    const skipDeptRollup = ctx.skipDeptRollup === true;

    if (raw == null) return '';
    const t = String(raw).trim();
    if (!t) return '';
    if (SPECIAL_ORG_NAMES.has(t)) return t;

    const pool = getOrganizationPool(unitCostSettings, personnel);

    if (!skipDeptRollup) {
        const viaPe = resolveDepartmentToManagementViaPersonnel(t, pool.personnelDeptToMd);
        if (viaPe) {
            return canonicalizeDepartmentName(viaPe, {
                unitCostSettings,
                personnel,
                skipDeptRollup: true,
            });
        }
        const leg = lookupLegacySubunitParent(departmentMatchKey(t));
        if (leg) {
            return canonicalizeDepartmentName(leg, {
                unitCostSettings,
                personnel,
                skipDeptRollup: true,
            });
        }
    }

    const fromUnits = pool.fromUnits;
    const fromPersonnelU = pool.fromPersonnelU;
    const uniqueCandidates = pool.uniqueCandidates;
    const unitSet = pool.unitSet;
    const personnelSet = pool.personnelSet;

    const rk = departmentMatchKey(t);

    const family = collectFamilyCandidates(rk, uniqueCandidates);
    if (family.length > 0) {
        family.sort((a, b) => {
            const ka = departmentMatchKey(a).length;
            const kb = departmentMatchKey(b).length;
            if (ka !== kb) return kb - ka;
            const pa = personnelSet.has(a) ? 0 : 1;
            const pb = personnelSet.has(b) ? 0 : 1;
            if (pa !== pb) return pa - pb;
            const ua = unitSet.has(a) ? 0 : 1;
            const ub = unitSet.has(b) ? 0 : 1;
            if (ua !== ub) return ua - ub;
            return a.localeCompare(b, 'tr');
        });
        return family[0];
    }

    const nr = normalizeTurkishForSearch(t);
    const normMatch = fromUnits.find((u) => normalizeTurkishForSearch(u) === nr);
    if (normMatch) return normMatch;
    const normMatchP = fromPersonnelU.find((c) => normalizeTurkishForSearch(c) === nr);
    if (normMatchP) return normMatchP;

    if (rk.length >= 4) {
        const expandMatches = uniqueCandidates.filter((c) => {
            const ck = departmentMatchKey(c);
            return ck.startsWith(rk) && ck.length > rk.length;
        });
        if (expandMatches.length === 1) return expandMatches[0];
        if (expandMatches.length > 1) {
            expandMatches.sort((a, b) => {
                const ka = departmentMatchKey(a).length;
                const kb = departmentMatchKey(b).length;
                if (ka !== kb) return kb - ka;
                const pa = personnelSet.has(a) ? 0 : 1;
                const pb = personnelSet.has(b) ? 0 : 1;
                if (pa !== pb) return pa - pb;
                const ua = unitSet.has(a) ? 0 : 1;
                const ub = unitSet.has(b) ? 0 : 1;
                if (ua !== ub) return ua - ub;
                return a.localeCompare(b, 'tr');
            });
            return expandMatches[0];
        }
    }

    if (rk.length >= 6) {
        const shrinkMatches = uniqueCandidates.filter((c) => {
            const ck = departmentMatchKey(c);
            return rk.startsWith(ck) && rk.length > ck.length && ck.length >= 4;
        });
        if (shrinkMatches.length === 1) return shrinkMatches[0];
        if (shrinkMatches.length > 1) {
            shrinkMatches.sort((a, b) => {
                const ka = departmentMatchKey(a).length;
                const kb = departmentMatchKey(b).length;
                if (ka !== kb) return kb - ka;
                const pa = personnelSet.has(a) ? 0 : 1;
                const pb = personnelSet.has(b) ? 0 : 1;
                if (pa !== pb) return pa - pb;
                const ua = unitSet.has(a) ? 0 : 1;
                const ub = unitSet.has(b) ? 0 : 1;
                if (ua !== ub) return ua - ub;
                return a.localeCompare(b, 'tr');
            });
            return shrinkMatches[0];
        }
    }

    return t;
}

/**
 * non_conformities satırı için sorumlu birim alanlarını canonical biçimde döndürür.
 */
export function canonicalizeNonConformityOrgFields(record, ctx) {
    if (!record || typeof record !== 'object') return record;
    return {
        ...record,
        department: canonicalizeDepartmentName(record.department, ctx),
        requesting_unit: record.requesting_unit
            ? canonicalizeDepartmentName(record.requesting_unit, ctx)
            : record.requesting_unit,
        forwarded_unit: record.forwarded_unit
            ? canonicalizeDepartmentName(record.forwarded_unit, ctx)
            : record.forwarded_unit,
    };
}
