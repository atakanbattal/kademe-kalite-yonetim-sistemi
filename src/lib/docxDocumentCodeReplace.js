import JSZip from 'jszip';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const CODE_SEGMENT = '[A-ZÇĞİÖŞÜ0-9]{2,4}';
const CODE_TYPE = '[A-ZÇĞİÖŞÜ]{2}';
const CODE_YEAR = '\\d{4}';
const CODE_SEQ = '\\d{4}';

const CODE_PATTERNS = [
    new RegExp(`${CODE_SEGMENT}-${CODE_TYPE}-${CODE_YEAR}-${CODE_SEQ}`, 'giu'),
    new RegExp(`${CODE_SEGMENT}\\.${CODE_TYPE}\\.${CODE_YEAR}\\.${CODE_SEQ}`, 'giu'),
    new RegExp(`${CODE_SEGMENT}\\s+${CODE_TYPE}\\s+${CODE_YEAR}\\s+${CODE_SEQ}`, 'giu'),
];

const SKIP_WORD_XML = /^word\/(styles|fontTable|settings|webSettings|numbering|theme)\b/i;

function escapeXmlText(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function foldTurkishAscii(text) {
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
    const match = normalized.match(/^([A-ZÇĞİÖŞÜ0-9]{2,4})[-.\s]+([A-ZÇĞİÖŞÜ]{2})[-.\s]+(\d{4})[-.\s]+(\d{4})$/iu);
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

function formatVariant(parsed, style) {
    const { dept, type, year, seq } = parsed;
    if (style === 'dot') return `${dept}.${type}.${year}.${seq}`;
    if (style === 'space') return `${dept} ${type} ${year} ${seq}`;
    return `${dept}-${type}-${year}-${seq}`;
}

/** Aynı kodun tire, nokta, boşluk ve ASCII varyantları */
function allFormatVariants(parsed) {
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

function collectCodesFromText(text, bucket) {
    const source = String(text || '');
    for (const pattern of CODE_PATTERNS) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(source)) !== null) {
            const parsed = parseStandardDocumentCode(match[0]);
            if (parsed) bucket.add(parsed.canonical);
        }
    }
}

function shouldProcessWordXml(path) {
    return /^word\/.+\.xml$/i.test(path) && !SKIP_WORD_XML.test(path);
}

/** .docx kaynak dosyası mı */
export function isDocxAttachment(fileName, mimeType = '') {
    const name = String(fileName || '').toLowerCase();
    const type = String(mimeType || '').toLowerCase();
    return name.endsWith('.docx') || type === DOCX_MIME;
}

/** Word XML parçalarından standart doküman kodlarını çıkarır */
export async function extractDocumentCodesFromDocx(input) {
    const zip = await JSZip.loadAsync(input);
    const found = new Set();
    const tasks = [];

    zip.forEach((relativePath, file) => {
        if (file.dir || !shouldProcessWordXml(relativePath)) return;
        tasks.push(
            file.async('string').then((content) => collectCodesFromText(content, found))
        );
    });

    await Promise.all(tasks);
    return [...found];
}

/**
 * Eski → yeni doküman kodu için Word içinde aranacak metin çiftleri.
 * @deprecated buildDocumentCodeReplacementsForTarget tercih edilir
 */
export function buildDocumentCodeReplacements(oldNumber, newNumber, extraTextSources = []) {
    const newParsed = parseStandardDocumentCode(newNumber);
    if (!newParsed) return [];

    const sources = new Set();
    const oldParsed = parseStandardDocumentCode(oldNumber);
    if (oldParsed) sources.add(oldParsed.canonical);

    for (const text of extraTextSources) collectCodesFromText(text, sources);

    return buildReplacementPairsFromSources(sources, newParsed);
}

function buildReplacementPairsFromSources(sourceCanonicals, newParsed) {
    const pairs = new Map();
    const addPair = (from, to) => {
        const f = String(from || '').trim();
        const t = String(to || '').trim();
        if (f && t && f !== t && f.length >= 5) pairs.set(f, t);
    };

    const newVariants = allFormatVariants(newParsed);
    const styleKeys = ['hyphen', 'dot', 'space'];

    for (const sourceCanonical of sourceCanonicals) {
        if (sourceCanonical === newParsed.canonical) continue;
        const sourceParsed = parseStandardDocumentCode(sourceCanonical);
        if (!sourceParsed) continue;

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
    }

    return [...pairs.entries()]
        .map(([from, to]) => [from, to])
        .sort((a, b) => b[0].length - a[0].length);
}

/**
 * Hedef numaraya göre değiştirme çiftleri — docx içeriğini tarayarak eski kodları bulur.
 */
export async function buildDocumentCodeReplacementsForTarget(newNumber, {
    oldNumber,
    extraTextSources = [],
    docxBlob,
} = {}) {
    const newParsed = parseStandardDocumentCode(newNumber);
    if (!newParsed) return [];

    const sources = new Set();
    const oldParsed = parseStandardDocumentCode(oldNumber);
    if (oldParsed) sources.add(oldParsed.canonical);

    for (const text of extraTextSources) collectCodesFromText(text, sources);

    if (docxBlob) {
        const inDocx = await extractDocumentCodesFromDocx(docxBlob);
        inDocx.forEach((code) => sources.add(code));
    }

    return buildReplacementPairsFromSources(sources, newParsed);
}

function applyReplacements(text, replacements) {
    let result = text;
    for (const [from, to] of replacements) {
        if (result.includes(from)) {
            result = result.split(from).join(to);
        }
    }
    return result;
}

/** Word paragrafındaki w:t birleşiminde kod değiştirir (parçalı run desteği). */
function replaceInParagraphXml(paragraphXml, replacements) {
    const runRegex = /<w:t(\s+xml:space="preserve")?>([^<]*)<\/w:t>/g;
    const runs = [];
    let match;
    while ((match = runRegex.exec(paragraphXml)) !== null) {
        runs.push({
            start: match.index,
            end: match.index + match[0].length,
            preserve: match[1] || '',
            text: match[2],
        });
    }
    if (runs.length === 0) return paragraphXml;

    const combined = runs.map((run) => run.text).join('');
    const updated = applyReplacements(combined, replacements);
    if (updated === combined) return paragraphXml;

    let result = paragraphXml;
    for (let i = runs.length - 1; i >= 0; i -= 1) {
        const run = runs[i];
        const nextText = i === 0 ? updated : '';
        const needsPreserve = run.preserve || nextText.startsWith(' ') || nextText.endsWith(' ');
        const openTag = needsPreserve ? '<w:t xml:space="preserve">' : '<w:t>';
        const replacement = `${openTag}${escapeXmlText(nextText)}</w:t>`;
        result = result.slice(0, run.start) + replacement + result.slice(run.end);
    }
    return result;
}

function replaceInXmlContent(xml, replacements) {
    let updated = applyReplacements(xml, replacements);
    updated = updated.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraph) => (
        replaceInParagraphXml(paragraph, replacements)
    ));
    return updated;
}

/**
 * .docx içindeki antet/gövde/üst-alt bilgi XML parçalarında doküman kodunu günceller.
 * @returns {Promise<Blob>}
 */
export async function replaceDocumentCodeInDocx(input, replacements) {
    if (!replacements?.length) {
        if (input instanceof Blob) return input;
        return new Blob([input], { type: DOCX_MIME });
    }

    const zip = await JSZip.loadAsync(input);
    const tasks = [];

    zip.forEach((relativePath, file) => {
        if (file.dir || !shouldProcessWordXml(relativePath)) return;
        tasks.push(
            file.async('string').then((content) => {
                const next = replaceInXmlContent(content, replacements);
                if (next !== content) zip.file(relativePath, next);
            })
        );
    });

    await Promise.all(tasks);

    return zip.generateAsync({
        type: 'blob',
        mimeType: DOCX_MIME,
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
    });
}
