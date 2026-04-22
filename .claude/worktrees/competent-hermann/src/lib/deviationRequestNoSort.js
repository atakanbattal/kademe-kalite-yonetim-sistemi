/**
 * Sapma talep numarası (request_no) için sıralama anahtarı.
 * Biçimler: YYYY-NNN (Girdi), YYYY-UNNN (Üretim), eski SAP-*
 */
export const parseDeviationRequestSortKey = (deviation) => {
    const no = String(deviation?.request_no || '').trim();
    const type = deviation?.deviation_type || '';

    if (!no) {
        return { legacy: true, year: 0, production: false, seq: 0, created: deviation?.created_at || '' };
    }

    if (/^SAP-/i.test(no)) {
        const digits = no.match(/(\d+)/g);
        const seq = digits ? parseInt(digits.join(''), 10) : 0;
        return { legacy: true, year: 0, production: false, seq, created: deviation?.created_at || '' };
    }

    const yearMatch = no.match(/^(\d{4})-/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : 0;
    const production = type === 'Üretim' || /^\d{4}-U\d/i.test(no);
    const seqMatch = no.match(/-U?(\d+)$/i);
    const seq = seqMatch ? parseInt(seqMatch[1], 10) : 0;

    return { legacy: false, year, production, seq, created: deviation?.created_at || '' };
};

/** Talep numarasına göre ters: yıl ↓, önce Üretim sonra Girdi, sıra ↓; SAP yine sonda; eşitlikte yeni created_at üstte */
export const compareDeviationsByRequestNo = (a, b) => {
    const ka = parseDeviationRequestSortKey(a);
    const kb = parseDeviationRequestSortKey(b);

    if (ka.legacy !== kb.legacy) return ka.legacy ? 1 : -1;
    if (ka.year !== kb.year) return kb.year - ka.year;
    if (ka.production !== kb.production) return Number(kb.production) - Number(ka.production);
    if (ka.seq !== kb.seq) return kb.seq - ka.seq;
    return new Date(kb.created || 0) - new Date(ka.created || 0);
};
