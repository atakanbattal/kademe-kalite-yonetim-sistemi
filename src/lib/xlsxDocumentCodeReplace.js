import JSZip from 'jszip';
import {
    applyReplacements,
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
} from './documentCodeUtils.js';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const SKIP_XLSX_XML = /^xl\/(styles|theme|calcChain|metadata|tables)\b/i;

function shouldProcessXlsxXml(path) {
    return /^xl\/.+\.xml$/i.test(path) && !SKIP_XLSX_XML.test(path);
}

function extractSharedStringItemsFromXml(xml) {
    const items = [];
    const itemRegex = /<si\b[\s\S]*?<\/si>/g;
    let itemMatch;
    while ((itemMatch = itemRegex.exec(xml)) !== null) {
        const item = itemMatch[0];
        const textRegex = /<t(\s+xml:space="preserve")?>([^<]*)<\/t>/g;
        const parts = [];
        let textMatch;
        while ((textMatch = textRegex.exec(item)) !== null) {
            parts.push(decodeXmlEntities(textMatch[2]));
        }
        if (parts.length) items.push(parts.join(''));
    }
    return items;
}

function parseSharedStringsXml(xml) {
    const entries = [];
    const itemRegex = /<si\b[\s\S]*?<\/si>/g;
    let itemMatch;
    while ((itemMatch = itemRegex.exec(xml)) !== null) {
        const item = itemMatch[0];
        const textRegex = /<t(\s+xml:space="preserve")?>([^<]*)<\/t>/g;
        const parts = [];
        let textMatch;
        while ((textMatch = textRegex.exec(item)) !== null) {
            parts.push(decodeXmlEntities(textMatch[2]));
        }
        entries.push({ xml: item, text: parts.join('') });
    }
    return entries;
}

function setSharedStringItemText(itemXml, newText) {
    const textRegex = /<t(\s+xml:space="preserve")?>([^<]*)<\/t>/g;
    const runs = [];
    let match;
    while ((match = textRegex.exec(itemXml)) !== null) {
        runs.push({ start: match.index, end: match.index + match[0].length, preserve: match[1] || '' });
    }
    if (!runs.length) {
        return itemXml.replace(/<\/si>/, `<t>${escapeXmlText(newText)}</t></si>`);
    }
    let result = itemXml;
    for (let i = runs.length - 1; i >= 0; i -= 1) {
        const run = runs[i];
        const nextText = i === 0 ? newText : '';
        const openTag = run.preserve ? '<t xml:space="preserve">' : '<t>';
        result = result.slice(0, run.start) + `${openTag}${escapeXmlText(nextText)}</t>` + result.slice(run.end);
    }
    return result;
}

function rebuildSharedStringsXml(originalXml, entries) {
    const itemRegex = /<si\b[\s\S]*?<\/si>/g;
    let index = 0;
    return originalXml.replace(itemRegex, () => {
        const entry = entries[index];
        index += 1;
        return entry?.xml || '<si><t></t></si>';
    });
}

function collectCodesFromXlsxXml(xml, bucket) {
    for (const itemText of extractSharedStringItemsFromXml(xml)) {
        collectCodesFromText(itemText, bucket);
    }
    collectCodesFromText(xml, bucket);
}

export function isXlsxAttachment(fileName, mimeType = '') {
    const name = String(fileName || '').toLowerCase();
    const type = String(mimeType || '').toLowerCase();
    return name.endsWith('.xlsx') || type === XLSX_MIME || type.includes('spreadsheetml.sheet');
}

export async function extractDocumentCodesFromXlsx(input) {
    const zip = await JSZip.loadAsync(input);
    const found = new Set();
    const tasks = [];
    zip.forEach((relativePath, file) => {
        if (file.dir || !shouldProcessXlsxXml(relativePath)) return;
        tasks.push(file.async('string').then((content) => collectCodesFromXlsxXml(content, found)));
    });
    await Promise.all(tasks);
    return [...found];
}

function replaceInTextRunsXml(blockXml, replacements, tagName = 't') {
    const runRegex = new RegExp(`<${tagName}(\\s+xml:space="preserve")?>([^<]*)<\\/${tagName}>`, 'g');
    const runs = [];
    let match;
    while ((match = runRegex.exec(blockXml)) !== null) {
        runs.push({ start: match.index, end: match.index + match[0].length, preserve: match[1] || '', text: match[2] });
    }
    if (!runs.length) return blockXml;
    const combined = runs.map((run) => run.text).join('');
    const updated = applyReplacements(combined, replacements);
    if (updated === combined) return blockXml;
    let result = blockXml;
    for (let i = runs.length - 1; i >= 0; i -= 1) {
        const run = runs[i];
        const nextText = i === 0 ? updated : '';
        const openTag = run.preserve || nextText.startsWith(' ') || nextText.endsWith(' ')
            ? `<${tagName} xml:space="preserve">` : `<${tagName}>`;
        result = result.slice(0, run.start) + `${openTag}${escapeXmlText(nextText)}</${tagName}>` + result.slice(run.end);
    }
    return result;
}

function replaceInXlsxXmlContent(xml, replacements) {
    if (!replacements?.length) return xml;
    let updated = applyReplacements(xml, replacements);
    updated = updated.replace(/<si\b[\s\S]*?<\/si>/g, (item) => replaceInTextRunsXml(item, replacements, 't'));
    updated = updated.replace(/<is\b[\s\S]*?<\/is>/g, (inlineStr) => replaceInTextRunsXml(inlineStr, replacements, 't'));
    return updated;
}

function colLettersToIndex(col) {
    let index = 0;
    for (let i = 0; i < col.length; i += 1) index = index * 26 + (col.charCodeAt(i) - 64);
    return index;
}

function parseSheetRows(sheetXml, sharedEntries) {
    const rows = [];
    const rowRegex = /<row\b[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
    let rowMatch;
    while ((rowMatch = rowRegex.exec(sheetXml)) !== null) {
        const cells = [];
        const cellRegex = /<c\b([^>/]*)(?:\/>|>([\s\S]*?)<\/c>)/g;
        let cellMatch;
        while ((cellMatch = cellRegex.exec(rowMatch[2])) !== null) {
            const attrs = cellMatch[1] || '';
            const inner = cellMatch[2] || '';
            const refMatch = attrs.match(/\br="([A-Z]+)(\d+)"/);
            if (!refMatch) continue;
            const typeMatch = attrs.match(/\bt="([^"]+)"/);
            const type = typeMatch ? typeMatch[1] : '';
            const valueMatch = inner.match(/<v>([^<]*)<\/v>/);
            const rawValue = valueMatch ? valueMatch[1] : '';
            let text = rawValue;
            if (type === 's' && rawValue !== '') {
                text = sharedEntries[Number(rawValue)]?.text || '';
            } else if (type === 'inlineStr') {
                text = [...inner.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((m) => decodeXmlEntities(m[1])).join('');
            }
            cells.push({ col: colLettersToIndex(refMatch[1]), text, type, rawValue });
        }
        cells.sort((a, b) => a.col - b.col);
        rows.push({ rowNum: Number(rowMatch[1]), cells });
    }
    return rows;
}

function injectDocumentCodeInSheet(sharedEntries, sheetXml, targetHyphen, targetParsed) {
    const rows = parseSheetRows(sheetXml, sharedEntries);
    for (const row of rows.slice(0, 25)) {
        for (let i = 0; i < row.cells.length; i += 1) {
            if (!isDocumentNumberLabel(row.cells[i].text)) continue;
            for (let j = i + 1; j < row.cells.length; j += 1) {
                const valueCell = row.cells[j];
                if (textMatchesTargetCode(valueCell.text, targetParsed)) return false;
                if (isCodeSlotValue(valueCell.text, targetParsed) || looksLikeDocumentCode(valueCell.text) || isPlaceholderCodeValue(valueCell.text)) {
                    if (valueCell.type === 's' && valueCell.rawValue !== '') {
                        const idx = Number(valueCell.rawValue);
                        if (sharedEntries[idx]) {
                            sharedEntries[idx].text = targetHyphen;
                            sharedEntries[idx].xml = setSharedStringItemText(sharedEntries[idx].xml, targetHyphen);
                            return true;
                        }
                    }
                    return false;
                }
            }
        }
    }
    return false;
}

export async function replaceDocumentCodeInXlsx(input, replacements, targetNumber = null) {
    const targetParsed = parseStandardDocumentCode(targetNumber);
    const targetHyphen = targetParsed ? formatVariant(targetParsed, 'hyphen') : null;

    const zip = await JSZip.loadAsync(input);
    const sharedFile = zip.file('xl/sharedStrings.xml');
    let sharedXml = sharedFile ? await sharedFile.async('string') : null;
    let sharedEntries = sharedXml ? parseSharedStringsXml(sharedXml) : [];

    if (sharedXml && replacements?.length) {
        const next = replaceInXlsxXmlContent(sharedXml, replacements);
        if (next !== sharedXml) {
            sharedXml = next;
            sharedEntries = parseSharedStringsXml(sharedXml);
        }
    }

    const sheetPaths = Object.keys(zip.files).filter((p) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(p));
    for (const sheetPath of sheetPaths) {
        let sheetXml = await zip.file(sheetPath).async('string');
        if (replacements?.length) {
            sheetXml = replaceInXlsxXmlContent(sheetXml, replacements);
        }
        if (targetHyphen && targetParsed && sharedEntries.length) {
            injectDocumentCodeInSheet(sharedEntries, sheetXml, targetHyphen, targetParsed);
        }
        zip.file(sheetPath, sheetXml);
    }

    if (sharedXml && sharedEntries.length) {
        zip.file('xl/sharedStrings.xml', rebuildSharedStringsXml(sharedXml, sharedEntries));
    }

    const otherTasks = [];
    zip.forEach((relativePath, file) => {
        if (file.dir || relativePath === 'xl/sharedStrings.xml') return;
        if (!shouldProcessXlsxXml(relativePath)) return;
        if (/^xl\/worksheets\/sheet\d+\.xml$/i.test(relativePath)) return;
        otherTasks.push(
            file.async('string').then((content) => {
                const next = replaceInXlsxXmlContent(content, replacements);
                if (next !== content) zip.file(relativePath, next);
            })
        );
    });
    await Promise.all(otherTasks);

    return zip.generateAsync({
        type: 'blob',
        mimeType: XLSX_MIME,
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
    });
}

export async function ensureDocumentCodeInXlsx(input, targetNumber) {
    return replaceDocumentCodeInXlsx(input, [], targetNumber);
}

export { parseStandardDocumentCode };
