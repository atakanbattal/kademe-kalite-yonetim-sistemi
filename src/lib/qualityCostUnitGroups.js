/**
 * Kalite maliyetinde birim alanları, Ayarlar (cost_settings) + personel ile
 * aynı kanonik isme düşürülür (canonicalizeDepartmentName).
 */

import {
    canonicalizeDepartmentName,
    departmentMatchKey,
} from '@/lib/departmentCanonicalization';

/** @typedef {{ unitCostSettings?: unknown[], personnel?: unknown[] }} CanonicalUnitCtx */

const emptyCtx = {};

/**
 * cost_settings.personel bağlamına göre filtre anahtarı ve liste etiketi.
 * @param {string|null|undefined} raw
 * @param {CanonicalUnitCtx} canonicalCtx
 * @returns {{ filterKey: string, label: string }}
 */
export function canonicalUnitPresentation(raw, canonicalCtx = emptyCtx) {
    const t = raw == null ? '' : String(raw).trim();
    if (!t) return { filterKey: 'raw:_', label: '—' };
    const ctx = canonicalCtx || emptyCtx;
    const label = canonicalizeDepartmentName(t, ctx) || t;
    const filterKey = `canon:${departmentMatchKey(label)}`;
    return { filterKey, label };
}

/**
 * Küme / grafik etiketi: boş → "Belirtilmemiş", aksi ayarlarla uyumlu ad.
 */
export function formatOrgUnitForAggregate(raw, canonicalCtx = emptyCtx) {
    const t = raw == null ? '' : String(raw).trim();
    if (!t) return 'Belirtilmemiş';
    const lbl = getCanonicalUnitLabel(t, canonicalCtx);
    return lbl === '—' ? 'Belirtilmemiş' : lbl;
}

/**
 * Ayarlar ile aynı kanonik etiketi döndürür (görünen metin).
 */
export function getCanonicalUnitLabel(raw, canonicalCtx = emptyCtx) {
    return canonicalUnitPresentation(raw, canonicalCtx).label;
}

/** @deprecated use canonicalUnitPresentation / getCanonicalUnitLabel */
export function getUnitMergeGroup(raw, canonicalCtx = emptyCtx) {
    const t = raw == null ? '' : String(raw).trim();
    if (!t) return null;
    const { filterKey, label } = canonicalUnitPresentation(t, canonicalCtx);
    const idFromKey = filterKey.replace(/^canon:/, 'merge_');
    return { id: idFromKey, label };
}

export function getUnitFilterKeyFromRaw(raw, canonicalCtx = emptyCtx) {
    return canonicalUnitPresentation(raw, canonicalCtx).filterKey;
}

/**
 * Birim filtresinde eşleştirilecek tüm kaynak yazımları (unit, allocations, kalemler, tedarikçi işareti).
 */
export function collectUnitMatchCandidates(cost) {
    /** @type {string[]} */
    const candidates = [];

    const add = (u) => {
        if (u != null && String(u).trim() !== '') candidates.push(String(u).trim());
    };

    add(cost?.unit);

    const allocs = cost?.cost_allocations;
    if (Array.isArray(allocs)) {
        allocs.forEach((a) => add(a?.unit));
    }

    const lineItems = cost?.cost_line_items;
    if (Array.isArray(lineItems)) {
        lineItems.forEach((li) => {
            add(li?.responsible_unit);
            if (li?.responsible_type === 'supplier') add('Tedarikçi');
        });
    }

    if (cost?.is_supplier_nc) add('Tedarikçi');

    return candidates;
}

export function costMatchesUnitFilterKey(cost, filterKey, canonicalCtx = emptyCtx, filterKeyCache = null) {
    if (!filterKey || filterKey === 'all') return true;

    const ctx = canonicalCtx || emptyCtx;
    /** @returns {string} filter key for raw unit text */
    const fkForRaw = filterKeyCache
        ? (u) => filterKeyCache.getFilterKey(u)
        : (u) => getUnitFilterKeyFromRaw(u, ctx);

    return collectUnitMatchCandidates(cost).some((u) => fkForRaw(u) === filterKey);
}

/**
 * Tüm kalite maliyet listesi + kanon bağlam için her kayıtta olası kanonik filtre anahtarlarını tek sefer hesaplar.
 * Filtre değişiminde yeniden canonicalize etmek yerine Map.get(id).has(fk) kullanın (öz. geniş rollup birimleri).
 *
 * @param {unknown[]} costs
 * @param {ReturnType<typeof createCanonicalUnitCaches>} canonCaches
 * @returns {Map<string, Set<string>>} cost.id → Set of filter keys
 */
export function buildCostUnitFilterKeyIndex(costs, canonCaches) {
    const map = new Map();
    if (!costs?.length || !canonCaches) return map;

    for (const cost of costs) {
        const id = cost?.id;
        if (id == null || id === '') continue;
        /** @type {Set<string>} */
        const keys = new Set();
        for (const raw of collectUnitMatchCandidates(cost)) {
            keys.add(canonCaches.getFilterKey(raw));
        }
        map.set(id, keys);
    }
    return map;
}

/**
 * Id indeksliyse anahtar kümesinden eşler; eksik kayıtta (ör. id yok) eski canon yolu.
 * @param {Map<string, Set<string>>} index
 * @param {unknown} cost
 * @param {string} filterKey
 * @param {ReturnType<typeof createCanonicalUnitCaches>} canonCaches
 */
export function costMatchesUnitUsingIndex(index, cost, filterKey, canonCaches) {
    if (!filterKey || filterKey === 'all') return true;
    const keys = index?.get(cost?.id);
    if (keys) return keys.has(filterKey);
    return canonCaches.costMatchesUnit(cost, filterKey);
}

/**
 * Büyük liste filtreleri için: aynı birim yazımına tekrar canonicalize etmeyin (Map ile önbellekle).
 * @returns {{
 *   getFilterKey: (raw: unknown) => string,
 *   getLabel: (raw: unknown) => string,
 *   formatOrgUnitForAggregate: (raw: unknown) => string,
 *   costMatchesUnit: (cost: unknown, fk: string) => boolean,
 *   stringMatchesFilterKey: (raw: unknown, fk: string) => boolean,
 *   presentation: (trimmedRaw: unknown) => { filterKey: string, label: string }
 * }}
 */
export function createCanonicalUnitCaches(canonicalCtx = emptyCtx) {
    const ctx = canonicalCtx || emptyCtx;
    /** canonicalUnitPresentation çıktısı; trim anahtarı */
    const presByTrimmed = new Map();

    function presentationInner(trimmed) {
        if (!trimmed) return { filterKey: 'raw:_', label: '—' };
        if (presByTrimmed.has(trimmed)) return presByTrimmed.get(trimmed);
        const pr = canonicalUnitPresentation(trimmed, ctx);
        presByTrimmed.set(trimmed, pr);
        return pr;
    }

    /** @type {{
     * getFilterKey: (raw: unknown) => string,
     * presentation: (raw: unknown) => { filterKey: string, label: string },
     * ...
     * }} */
    const api = {
        presentation(trimmedRaw) {
            const t = trimmedRaw == null ? '' : String(trimmedRaw).trim();
            if (!t) return { filterKey: 'raw:_', label: '—' };
            return presentationInner(t);
        },
        getFilterKey(raw) {
            const t = raw == null ? '' : String(raw).trim();
            if (!t) return 'raw:_';
            return presentationInner(t).filterKey;
        },
        getLabel(raw) {
            const t = raw == null ? '' : String(raw).trim();
            if (!t) return '—';
            return presentationInner(t).label;
        },
        formatOrgUnitForAggregate(raw) {
            const t = raw == null ? '' : String(raw).trim();
            if (!t) return 'Belirtilmemiş';
            const lbl = presentationInner(t).label;
            return lbl === '—' ? 'Belirtilmemiş' : lbl;
        },
        costMatchesUnit(cost, filterKey) {
            return costMatchesUnitFilterKey(cost, filterKey, ctx, api);
        },
        stringMatchesFilterKey(rawUnit, filterKey) {
            if (!filterKey || filterKey === 'all') return true;
            const t = rawUnit == null ? '' : String(rawUnit).trim();
            return presentationInner(t || '').filterKey === filterKey;
        },
    };

    return api;
}

/**
 * Kayıtlardan sıralı { key, label } birim seçenekleri (Tümü hariç).
 * Etiketler cost_settings ile uyumludur.
 */
export function collectUnitFilterOptions(costs, canonicalCtx = emptyCtx) {
    const cache = createCanonicalUnitCaches(canonicalCtx || emptyCtx);
    const labelByKey = new Map();

    const consider = (raw) => {
        if (raw == null || String(raw).trim() === '') return;
        const { filterKey, label } = cache.presentation(String(raw).trim());
        if (!labelByKey.has(filterKey)) labelByKey.set(filterKey, label);
    };

    for (const cost of costs || []) {
        consider(cost?.unit);

        const allocs = cost?.cost_allocations;
        if (Array.isArray(allocs)) allocs.forEach((a) => consider(a?.unit));

        const lineItems = cost?.cost_line_items;
        if (Array.isArray(lineItems)) {
            lineItems.forEach((li) => {
                consider(li?.responsible_unit);
                if (li?.responsible_type === 'supplier') consider('Tedarikçi');
            });
        }

        if (cost?.is_supplier_nc) consider('Tedarikçi');
    }

    return [...labelByKey.entries()]
        .map(([key, label]) => ({ key, label }))
        .sort((a, b) => a.label.localeCompare(b.label, 'tr', { sensitivity: 'base' }));
}

export function unitStringMatchesFilterKey(rawUnit, filterKey, canonicalCtx = emptyCtx) {
    if (!filterKey || filterKey === 'all') return true;
    return getUnitFilterKeyFromRaw(rawUnit ?? '', canonicalCtx || emptyCtx) === filterKey;
}

export function getPrimaryUnitDisplayLabel(cost, canonicalCtx = emptyCtx) {
    const ctx = canonicalCtx || emptyCtx;
    if (!cost) return '-';
    if (cost.is_supplier_nc && cost.supplier?.name) return cost.supplier.name;
    const raw = cost.unit;
    if (!raw) {
        if (cost.cost_allocations?.length) {
            const parts = cost.cost_allocations
                .map((a) => (a?.unit ? getCanonicalUnitLabel(a.unit, ctx) : null))
                .filter(Boolean);
            return parts.length ? [...new Set(parts)].join(', ') : '-';
        }
        return '-';
    }
    return getCanonicalUnitLabel(raw, ctx);
}
