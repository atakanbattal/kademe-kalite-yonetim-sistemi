const CODE_SEGMENT = '[A-ZÇĞİÖŞÜ0-9]{2,4}';
const CODE_TYPE = '[A-ZÇĞİÖŞÜ]{2,3}';
const CODE_YEAR = '\\d{4}';
const CODE_SEQ = '\\d{4}';

export const CODE_PATTERNS = [
    new RegExp(`${CODE_SEGMENT}-${CODE_TYPE}-${CODE_YEAR}-${CODE_SEQ}`, 'giu'),
    new RegExp(`${CODE_SEGMENT}\\.${CODE_TYPE}\\.${CODE_YEAR}\\.${CODE_SEQ}`, 'giu'),
    new RegExp(`${CODE_SEGMENT}\\s+${CODE_TYPE}\\s+${CODE_YEAR}\\s+${CODE_SEQ}`, 'giu'),
    new RegExp(`1[-.]${CODE_SEGMENT}[-.]${CODE_TYPE}[-.]${CODE_YEAR}[-.]${CODE_SEQ}`, 'giu'),
];

/** Eski / alternatif kod formatları (ham metin olarak yakalanır) */
export const LEGACY_CODE_PATTERNS = [
    /\bKDM-[A-ZÇĞİÖŞÜ]{2,3}-\d+\b/giu,
    /\b[A-ZÇĞİÖŞÜ0-9]{2,4}-[A-ZÇĞİÖŞÜ]{2,3}-\d{1,4}\b/giu,
    /\b(?:KDM|[A-ZÇĞİÖŞÜ0-9]{2,4})\.[A-ZÇĞİÖŞÜ]{2,4}\.\d+\b/giu,
    /\bKDM\.[A-ZÇĞİÖŞÜ]{2,4}\.\d+\b/giu,
];

export const DOCUMENT_NUMBER_LABEL_RE = /Dok[üu]man\s*(?:No|Numaras[ıi]|Kodu)?\s*:?\s*$/iu;

export function escapeXmlText(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

export function decodeXmlEntities(text) {
    return String(text)
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");
}

export function foldTurkishAscii(text) {
    return String(text)
        .replace(/Ü/g, 'U')
        .replace(/ü/g, 'u')
        .replace(/İ/g, 'I')
        .replace(/ı/g, 'i')
        .replace(/Ö/g, 'O')
        .replace(/ö/g, 'o')
        .replace(/Ş/g, 'S')
        .replace(/ş/g, 's')
        .replace(/Ç/g, 'C')
        .replace(/ç/g, 'c')
        .replace(/Ğ/g, 'G')
        .replace(/ğ/g, 'g');
}

/** @returns {{ dept: string, type: string, year: string, seq: string, canonical: string } | null} */
export function parseStandardDocumentCode(raw) {
    const normalized = String(raw || '').trim().replace(/\s+/g, ' ');
    const match = normalized.match(/^1[-.\s]+([A-ZÇĞİÖŞÜ0-9]{2,4})[-.\s]+([A-ZÇĞİÖŞÜ]{2,3})[-.\s]+(\d{4})[-.\s]+(\d{4})$/iu)
        || normalized.match(/^([A-ZÇĞİÖŞÜ0-9]{2,4})[-.\s]+([A-ZÇĞİÖŞÜ]{2,3})[-.\s]+(\d{4})[-.\s]+(\d{4})$/iu);
    if (!match) return null;

    const dept = match[1].toLocaleUpperCase('tr');
    const type = match[2].toLocaleUpperCase('tr');
    const year = match[3];
    const seq = match[4];

    return {
        dept,
        type,
        year,
        seq,
        canonical: `${dept}-${type}-${year}-${seq}`,
    };
}

export function formatVariant(parsed, style) {
    const { dept, type, year, seq } = parsed;
    if (style === 'dot') return `${dept}.${type}.${year}.${seq}`;
    if (style === 'space') return `${dept} ${type} ${year} ${seq}`;
    return `${dept}-${type}-${year}-${seq}`;
}

export function allFormatVariants(parsed) {
    const styles = ['hyphen', 'dot', 'space'];
    const variants = new Set();

    for (const style of styles) {
        variants.add(formatVariant(parsed, style));
        const folded = parseStandardDocumentCode(formatVariant({
            dept: foldTurkishAscii(parsed.dept),
            type: foldTurkishAscii(parsed.type),
            year: parsed.year,
            seq: parsed.seq,
            canonical: '',
        }, style));
        if (folded) variants.add(formatVariant(folded, style));
    }

    return [...variants];
}

export function normalizeLooseCode(text) {
    return String(text || '').trim().replace(/\s+/g, ' ');
}

export function isDocumentNumberLabel(text) {
    const normalized = normalizeLooseCode(text).replace(/:$/, '').trim();
    return DOCUMENT_NUMBER_LABEL_RE.test(normalized)
        || /^Dok[üu]man\s*(?:No|Numaras[ıi]|Kodu)?\s*:?\s*$/iu.test(normalized);
}

export function isPlaceholderCodeValue(text) {
    const t = normalizeLooseCode(text);
    return !t || /^[-–—.\/_]+$/.test(t) || /^(yok|boş|tbd|n\/a)$/iu.test(t);
}

export function looksLikeDocumentCode(text) {
    const source = normalizeLooseCode(text);
    if (!source || isPlaceholderCodeValue(source)) return false;
    if (parseStandardDocumentCode(source)) return true;

    for (const pattern of LEGACY_CODE_PATTERNS) {
        pattern.lastIndex = 0;
        if (pattern.test(source)) return true;
    }

    for (const pattern of CODE_PATTERNS) {
        pattern.lastIndex = 0;
        if (pattern.test(source)) return true;
    }

    return false;
}

export function isCodeSlotValue(text, targetParsed = null) {
    const t = normalizeLooseCode(text);
    if (isPlaceholderCodeValue(t)) return true;
    if (!looksLikeDocumentCode(t)) return false;
    if (!targetParsed) return true;
    return !textMatchesTargetCode(t, targetParsed);
}

export function textMatchesTargetCode(text, targetParsed) {
    const normalized = normalizeLooseCode(text);
    if (!normalized || !targetParsed) return false;
    const parsed = parseStandardDocumentCode(normalized);
    if (parsed?.canonical === targetParsed.canonical) return true;
    return allFormatVariants(targetParsed).some((variant) => (
        normalized.toLocaleUpperCase('tr') === variant.toLocaleUpperCase('tr')
    ));
}

export function collectCodesFromText(text, bucket) {
    const source = String(text || '');

    for (const pattern of CODE_PATTERNS) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(source)) !== null) {
            const parsed = parseStandardDocumentCode(match[0]);
            if (parsed) {
                bucket.add(parsed.canonical);
                bucket.add(match[0].trim());
            }
        }
    }

    for (const pattern of LEGACY_CODE_PATTERNS) {
        pattern.lastIndex = 0;
        let legacyMatch;
        while ((legacyMatch = pattern.exec(source)) !== null) {
            const raw = String(legacyMatch[0] || '').trim();
            if (raw) bucket.add(raw);
        }
    }
}

export function buildReplacementPairsFromSources(sourceCanonicals, newParsed) {
    const pairs = new Map();
    const addPair = (from, to) => {
        const f = String(from || '').trim();
        const t = String(to || '').trim();
        if (!f || !t || f === t || f.length < 3) return;
        const existing = pairs.get(f);
        if (!existing || (t.includes('-') && !existing.includes('-'))) {
            pairs.set(f, t);
        }
    };

    const targetHyphen = formatVariant(newParsed, 'hyphen');
    const newVariants = allFormatVariants(newParsed);
    const styleKeys = ['hyphen', 'dot', 'space'];

    for (const sourceCanonical of sourceCanonicals) {
        if (!sourceCanonical || sourceCanonical === newParsed.canonical) continue;

        if (textMatchesTargetCode(sourceCanonical, newParsed)) continue;

        const sourceParsed = parseStandardDocumentCode(sourceCanonical);
        if (sourceParsed) {
            if (sourceParsed.canonical === newParsed.canonical) continue;

            for (let i = 0; i < styleKeys.length; i += 1) {
                const style = styleKeys[i];
                addPair(formatVariant(sourceParsed, style), formatVariant(newParsed, style));
            }

            addPair(`1-${formatVariant(sourceParsed, 'hyphen')}`, `1-${formatVariant(newParsed, 'hyphen')}`);
            addPair(`1-${formatVariant(sourceParsed, 'dot')}`, `1-${formatVariant(newParsed, 'dot')}`);

            for (const from of allFormatVariants(sourceParsed)) {
                for (const to of newVariants) {
                    if (from.includes('-') && to.includes('-')) addPair(from, to);
                    else if (from.includes('.') && to.includes('.')) addPair(from, to);
                    else if (from.includes(' ') && to.includes(' ')) addPair(from, to);
                }
            }
            continue;
        }

        const raw = String(sourceCanonical || '').trim();
        if (!raw) continue;
        addPair(raw, targetHyphen);
        addPair(raw.toLocaleUpperCase('tr'), targetHyphen);
        for (const to of newVariants) {
            if (to.includes('-')) continue;
            addPair(raw, to);
            addPair(raw.toLocaleUpperCase('tr'), to);
        }
    }

    return [...pairs.entries()]
        .map(([from, to]) => [from, to])
        .sort((a, b) => b[0].length - a[0].length);
}

export function applyReplacements(text, replacements) {
    let result = text;
    for (const [from, to] of replacements) {
        if (result.includes(from)) {
            result = result.split(from).join(to);
        }
    }
    return result;
}
