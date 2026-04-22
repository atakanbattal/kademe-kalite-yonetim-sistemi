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
export function canonicalizeDepartmentName(raw, { unitCostSettings = [], personnel = [] } = {}) {
    if (raw == null) return '';
    const t = String(raw).trim();
    if (!t) return '';
    if (SPECIAL_ORG_NAMES.has(t)) return t;

    const fromUnits = uniqueNonEmpty((unitCostSettings || []).map((u) => u?.unit_name));
    const fromPersonnel = [];
    for (const p of personnel || []) {
        if (p?.department) fromPersonnel.push(p.department);
        if (p?.management_department) fromPersonnel.push(p.management_department);
    }
    const fromPersonnelU = uniqueNonEmpty(fromPersonnel);

    const unitSet = new Set(fromUnits);
    const personnelSet = new Set(fromPersonnelU);
    const uniqueCandidates = uniqueNonEmpty([...fromUnits, ...fromPersonnelU]);

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
