import JSZip from 'jszip';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const DOCX_XML_PART = /^word\/(document\d*|header\d*|footer\d*|footnotes|endnotes|comments)\.xml$/i;
const STANDARD_CODE_RE = /^([A-ZÇĞİÖŞÜ0-9]{2,4})-([A-ZÇĞİÖŞÜ]{2})-(\d{4})-(\d{4})$/u;
const CODE_IN_TEXT_RE = /(?:^|\s|1-)([A-ZÇĞİÖŞÜ0-9]{2,4}-[A-ZÇĞİÖŞÜ]{2}-\d{4}-\d{4})/gu;

function escapeXmlText(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/** .docx kaynak dosyası mı */
export function isDocxAttachment(fileName, mimeType = '') {
    const name = String(fileName || '').toLowerCase();
    const type = String(mimeType || '').toLowerCase();
    return name.endsWith('.docx') || type === DOCX_MIME;
}

/**
 * Eski → yeni doküman kodu için Word içinde aranacak metin çiftleri.
 * Uzun eşleşmeler önce uygulanır.
 */
export function buildDocumentCodeReplacements(oldNumber, newNumber, extraTextSources = []) {
    const oldCode = String(oldNumber || '').trim();
    const newCode = String(newNumber || '').trim();
    if (!oldCode || !newCode || oldCode === newCode) return [];

    const pairs = new Map();
    const addPair = (from, to) => {
        const f = String(from || '').trim();
        const t = String(to || '').trim();
        if (f && t && f !== t && f.length >= 5) pairs.set(f, t);
    };

    addPair(oldCode, newCode);
    addPair(oldCode.replace(/-/g, '.'), newCode.replace(/-/g, '.'));

    const oldMatch = oldCode.match(STANDARD_CODE_RE);
    const newMatch = newCode.match(STANDARD_CODE_RE);
    if (oldMatch && newMatch) {
        addPair(
            `${oldMatch[1]}.${oldMatch[2]}.${oldMatch[3]}.${oldMatch[4]}`,
            `${newMatch[1]}.${newMatch[2]}.${newMatch[3]}.${newMatch[4]}`
        );
    }

    addPair(`1-${oldCode}`, `1-${newCode}`);
    addPair(`1-${oldCode.replace(/-/g, '.')}`, `1-${newCode.replace(/-/g, '.')}`);

    for (const sourceText of extraTextSources) {
        const text = String(sourceText || '');
        let match;
        CODE_IN_TEXT_RE.lastIndex = 0;
        while ((match = CODE_IN_TEXT_RE.exec(text)) !== null) {
            const found = match[1];
            if (found !== newCode) {
                addPair(found, newCode);
                addPair(found.replace(/-/g, '.'), newCode.replace(/-/g, '.'));
            }
        }
    }

    return [...pairs.entries()]
        .map(([from, to]) => [from, to])
        .sort((a, b) => b[0].length - a[0].length);
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
        if (file.dir || !DOCX_XML_PART.test(relativePath)) return;
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
