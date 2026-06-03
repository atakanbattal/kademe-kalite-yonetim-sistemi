/** CF-YYYY-#### ve KAL-FR-YYYY-#### benzeri numaralar için sıralama anahtarı */
export function parseControlFormNumberSortKey(value) {
    const t = String(value || '').trim();
    const m = t.match(/(\d{4})-(\d+)/g);
    if (m && m.length) {
        const last = m[m.length - 1].split('-');
        return {
            year: parseInt(last[0], 10) || 0,
            seq: parseInt(last[1], 10) || 0,
            hasMatch: true,
            raw: t,
        };
    }
    return { year: 0, seq: 0, hasMatch: false, raw: t };
}

/** Yüksek numara / yeni yıl üstte */
export function compareControlFormNumbersDesc(a, b) {
    const ka = parseControlFormNumberSortKey(a);
    const kb = parseControlFormNumberSortKey(b);
    if (ka.hasMatch && kb.hasMatch) {
        if (ka.year !== kb.year) return kb.year - ka.year;
        if (ka.seq !== kb.seq) return kb.seq - ka.seq;
    }
    if (ka.hasMatch !== kb.hasMatch) return ka.hasMatch ? -1 : 1;
    if (ka.raw && kb.raw) {
        const c = kb.raw.localeCompare(ka.raw, 'tr', { numeric: true, sensitivity: 'base' });
        if (c !== 0) return c;
    } else if (ka.raw || kb.raw) {
        return ka.raw ? -1 : 1;
    }
    return 0;
}
