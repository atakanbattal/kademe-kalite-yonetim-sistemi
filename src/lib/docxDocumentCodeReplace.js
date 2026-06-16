import JSZip from 'jszip';
import {
    applyReplacements,
    buildReplacementPairsFromSources,
    collectCodesFromText,
    decodeXmlEntities,
    escapeXmlText,
    formatVariant,
    isCodeSlotValue,
    isDocumentNumberLabel,
    isPlaceholderCodeValue,
    looksLikeDocumentCode,
    parseStandardDocumentCode,
    textMatchesTargetCode,
    allFormatVariants,
} from './documentCodeUtils.js';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const SKIP_WORD_XML = /^word\/(styles|fontTable|settings|webSettings|numbering|theme)\b/i;
const INJECT_PRIORITY = /^word\/(header|footer)\d+\.xml$/i;

function shouldProcessWordXml(path) {
    return /^word\/.+\.xml$/i.test(path) && !SKIP_WORD_XML.test(path);
}

/** w:p içindeki w:t metinlerini birleştirir (Word run bölünmesi için). */
function extractParagraphTextsFromXml(xml) {
    const paragraphs = [];
    const paragraphRegex = /<w:p\b[\s\S]*?<\/w:p>/g;
    let paragraphMatch;
    while ((paragraphMatch = paragraphRegex.exec(xml)) !== null) {
        const paragraph = paragraphMatch[0];
        const runRegex = /<w:t(\s+xml:space="preserve")?>([^<]*)<\/w:t>/g;
        const parts = [];
        let runMatch;
        while ((runMatch = runRegex.exec(paragraph)) !== null) {
            parts.push(decodeXmlEntities(runMatch[2]));
        }
        if (parts.length) paragraphs.push(parts.join(''));
    }
    return paragraphs;
}

function extractTextFromXmlBlock(blockXml) {
    const runRegex = /<w:t(\s+xml:space="preserve")?>([^<]*)<\/w:t>/g;
    const parts = [];
    let runMatch;
    while ((runMatch = runRegex.exec(blockXml)) !== null) {
        parts.push(decodeXmlEntities(runMatch[2]));
    }
    return parts.join('');
}

function collectCodesFromWordXml(xml, bucket) {
    for (const paragraphText of extractParagraphTextsFromXml(xml)) {
        collectCodesFromText(paragraphText, bucket);
    }
}

/** .docx kaynak dosyası mı */
export function isDocxAttachment(fileName, mimeType = '') {
    const name = String(fileName || '').toLowerCase();
    const type = String(mimeType || '').toLowerCase();
    return name.endsWith('.docx') || type === DOCX_MIME;
}

/** Word XML parçalarından doküman kodlarını çıkarır */
export async function extractDocumentCodesFromDocx(input) {
    const zip = await JSZip.loadAsync(input);
    const found = new Set();
    const tasks = [];

    zip.forEach((relativePath, file) => {
        if (file.dir || !shouldProcessWordXml(relativePath)) return;
        tasks.push(
            file.async('string').then((content) => collectCodesFromWordXml(content, found))
        );
    });

    await Promise.all(tasks);
    return [...found];
}

export {
    buildReplacementPairsFromSources,
    collectCodesFromText,
    parseStandardDocumentCode,
};

/** Hedef numaraya göre değiştirme çiftleri — docx/xlsx içeriğini tarayarak eski kodları bulur. */
export async function buildDocumentCodeReplacementsForTarget(newNumber, {
    oldNumber,
    extraTextSources = [],
    docxBlob,
    xlsxBlob,
} = {}) {
    const newParsed = parseStandardDocumentCode(newNumber);
    if (!newParsed) return [];

    const sources = new Set();
    const oldParsed = parseStandardDocumentCode(oldNumber);
    if (oldParsed) {
        sources.add(oldParsed.canonical);
        allFormatVariants(oldParsed).forEach((v) => sources.add(v));
    }

    for (const text of extraTextSources) collectCodesFromText(text, sources);

    if (docxBlob) {
        const inDocx = await extractDocumentCodesFromDocx(docxBlob);
        inDocx.forEach((code) => sources.add(code));
    }
    if (xlsxBlob) {
        const { extractDocumentCodesFromXlsx } = await import('./xlsxDocumentCodeReplace.js');
        const inXlsx = await extractDocumentCodesFromXlsx(xlsxBlob);
        inXlsx.forEach((code) => sources.add(code));
    }

    return buildReplacementPairsFromSources(sources, newParsed);
}

/** @deprecated buildDocumentCodeReplacementsForTarget tercih edilir */
export function buildDocumentCodeReplacements(oldNumber, newNumber, extraTextSources = []) {
    const newParsed = parseStandardDocumentCode(newNumber);
    if (!newParsed) return [];

    const sources = new Set();
    const oldParsed = parseStandardDocumentCode(oldNumber);
    if (oldParsed) sources.add(oldParsed.canonical);

    for (const text of extraTextSources) collectCodesFromText(text, sources);

    return buildReplacementPairsFromSources(sources, newParsed);
}

function replaceInParagraphXml(paragraphXml, replacements, targetParsed = null) {
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
    const updated = applyReplacements(combined, replacements, targetParsed);
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

function setParagraphText(paragraphXml, newText) {
    const pPrMatch = paragraphXml.match(/<w:pPr\b[\s\S]*?<\/w:pPr>/);
    const pPr = pPrMatch ? pPrMatch[0] : '';
    const rPrMatch = paragraphXml.match(/<w:rPr\b[\s\S]*?<\/w:rPr>/);
    const rPr = rPrMatch ? rPrMatch[0] : '<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr>';
    return `<w:p>${pPr}<w:r>${rPr}<w:t>${escapeXmlText(newText)}</w:t></w:r></w:p>`;
}

function setCellText(cellXml, newText) {
    const paragraphRegex = /<w:p\b[\s\S]*?<\/w:p>/;
    if (!paragraphRegex.test(cellXml)) return cellXml;
    let replaced = false;
    return cellXml.replace(paragraphRegex, (paragraph) => {
        if (replaced) return paragraph;
        replaced = true;
        return setParagraphText(paragraph, newText);
    });
}

function injectDocumentCodeInTableRow(rowXml, targetHyphen, targetParsed) {
    const cellRegex = /<w:tc\b[\s\S]*?<\/w:tc>/g;
    const cells = [...rowXml.matchAll(cellRegex)].map((m) => m[0]);
    if (cells.length < 2) return rowXml;

    for (let i = 0; i < cells.length; i += 1) {
        const labelText = extractTextFromXmlBlock(cells[i]);
        if (!isDocumentNumberLabel(labelText)) continue;

        for (let j = i + 1; j < cells.length; j += 1) {
            const valueText = extractTextFromXmlBlock(cells[j]);
            if (textMatchesTargetCode(valueText, targetParsed)) return rowXml;
            if (isCodeSlotValue(valueText, targetParsed) || looksLikeDocumentCode(valueText) || isPlaceholderCodeValue(valueText)) {
                const updatedCell = setCellText(cells[j], targetHyphen);
                return rowXml.replace(cells[j], updatedCell);
            }
        }
    }

    return rowXml;
}

function injectDocumentCodeInWordXml(xml, targetHyphen) {
    const targetParsed = parseStandardDocumentCode(targetHyphen);
    if (!targetParsed) return xml;

    let updated = xml.replace(/<w:tr\b[\s\S]*?<\/w:tr>/g, (row) => (
        injectDocumentCodeInTableRow(row, targetHyphen, targetParsed)
    ));

    updated = updated.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraph) => {
        const text = extractTextFromXmlBlock(paragraph);
        if (!isDocumentNumberLabel(text)) return paragraph;
        return paragraph;
    });

    return updated;
}

function replaceInXmlContent(xml, replacements, targetHyphen) {
    const targetParsed = parseStandardDocumentCode(targetHyphen);
    let updated = applyReplacements(xml, replacements, targetParsed);
    updated = updated.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraph) => (
        replaceInParagraphXml(paragraph, replacements, targetParsed)
    ));
    if (targetHyphen) {
        updated = injectDocumentCodeInWordXml(updated, targetHyphen);
    }
    return updated;
}

function docHasTargetCode(xml, targetParsed) {
    return extractParagraphTextsFromXml(xml).some((text) => textMatchesTargetCode(text, targetParsed));
}

/**
 * .docx içindeki antet/gövde/üst-alt bilgi XML parçalarında doküman kodunu günceller.
 * Kod yoksa "Doküman No" satırına yazar.
 * @returns {Promise<Blob>}
 */
export async function replaceDocumentCodeInDocx(input, replacements, targetNumber = null) {
    const targetParsed = parseStandardDocumentCode(targetNumber);
    const targetHyphen = targetParsed ? formatVariant(targetParsed, 'hyphen') : null;

    const zip = await JSZip.loadAsync(input);
    const tasks = [];
    const paths = [];

    zip.forEach((relativePath, file) => {
        if (file.dir || !shouldProcessWordXml(relativePath)) return;
        paths.push(relativePath);
    });

    paths.sort((a, b) => {
        const aPri = INJECT_PRIORITY.test(a) ? 0 : 1;
        const bPri = INJECT_PRIORITY.test(b) ? 0 : 1;
        return aPri - bPri || a.localeCompare(b);
    });

    for (const relativePath of paths) {
        const file = zip.file(relativePath);
        if (!file) continue;
        tasks.push(
            file.async('string').then((content) => {
                const next = replaceInXmlContent(
                    content,
                    replacements || [],
                    targetHyphen
                );
                if (next !== content) zip.file(relativePath, next);
            })
        );
    }

    await Promise.all(tasks);

    if (targetParsed) {
        let found = false;
        const verifyTasks = paths.map((relativePath) => (
            zip.file(relativePath)?.async('string').then((content) => {
                if (docHasTargetCode(content, targetParsed)) found = true;
            })
        ));
        await Promise.all(verifyTasks);

        if (!found) {
            for (const relativePath of paths.filter((p) => INJECT_PRIORITY.test(p))) {
                const file = zip.file(relativePath);
                if (!file) continue;
                const content = await file.async('string');
                const next = injectDocumentCodeInWordXml(content, targetHyphen);
                if (next !== content) zip.file(relativePath, next);
            }
        }
    }

    return zip.generateAsync({
        type: 'blob',
        mimeType: DOCX_MIME,
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
    });
}

export async function ensureDocumentCodeInDocx(input, targetNumber) {
    return replaceDocumentCodeInDocx(input, [], targetNumber);
}
