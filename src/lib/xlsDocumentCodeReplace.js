import { read, write, utils } from 'xlsx';
import {
    applyReplacements,
    collectCodesFromText,
    formatVariant,
    isCodeSlotValue,
    isDocumentNumberLabel,
    looksLikeDocumentCode,
    isPlaceholderCodeValue,
    parseStandardDocumentCode,
    textMatchesTargetCode,
} from './documentCodeUtils.js';

const XLS_MIME = 'application/vnd.ms-excel';

export function isXlsAttachment(fileName, mimeType = '') {
    const name = String(fileName || '').toLowerCase();
    const type = String(mimeType || '').toLowerCase();
    if (name.endsWith('.xlsx') || type.includes('spreadsheetml.sheet')) return false;
    return name.endsWith('.xls') || type === XLS_MIME;
}

async function blobToUint8Array(input) {
    if (input instanceof ArrayBuffer) return new Uint8Array(input);
    if (input instanceof Uint8Array) return input;
    if (input instanceof Blob) return new Uint8Array(await input.arrayBuffer());
    throw new TypeError('Expected Blob, ArrayBuffer, or Uint8Array');
}

function getCellText(cell) {
    if (!cell) return '';
    if (cell.w != null && String(cell.w).trim()) return String(cell.w);
    if (cell.v == null) return '';
    return String(cell.v);
}

function setCellText(cell, text) {
    cell.v = text;
    cell.t = 's';
    delete cell.w;
    delete cell.z;
}

function collectCodesFromWorkbook(workbook, bucket) {
    for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet?.['!ref']) continue;
        const range = utils.decode_range(sheet['!ref']);
        for (let row = range.s.r; row <= range.e.r; row += 1) {
            for (let col = range.s.c; col <= range.e.c; col += 1) {
                const address = utils.encode_cell({ r: row, c: col });
                collectCodesFromText(getCellText(sheet[address]), bucket);
            }
        }
    }
}

function injectDocumentCodeInWorkbook(workbook, targetHyphen, targetParsed) {
    for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet?.['!ref']) continue;
        const range = utils.decode_range(sheet['!ref']);
        const maxRow = Math.min(range.e.r, range.s.r + 24);

        for (let row = range.s.r; row <= maxRow; row += 1) {
            for (let col = range.s.c; col <= range.e.c; col += 1) {
                const labelAddress = utils.encode_cell({ r: row, c: col });
                const labelCell = sheet[labelAddress];
                if (!isDocumentNumberLabel(getCellText(labelCell))) continue;

                for (let nextCol = col + 1; nextCol <= range.e.c; nextCol += 1) {
                    const valueAddress = utils.encode_cell({ r: row, c: nextCol });
                    const valueCell = sheet[valueAddress];
                    const valueText = getCellText(valueCell);
                    if (textMatchesTargetCode(valueText, targetParsed)) return true;
                    if (
                        isCodeSlotValue(valueText, targetParsed)
                        || looksLikeDocumentCode(valueText)
                        || isPlaceholderCodeValue(valueText)
                    ) {
                        if (!valueCell) sheet[valueAddress] = { t: 's', v: targetHyphen };
                        else setCellText(valueCell, targetHyphen);
                        return true;
                    }
                }
            }
        }
    }
    return false;
}

function replaceInWorkbook(workbook, replacements, targetParsed) {
    for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet?.['!ref']) continue;
        const range = utils.decode_range(sheet['!ref']);
        for (let row = range.s.r; row <= range.e.r; row += 1) {
            for (let col = range.s.c; col <= range.e.c; col += 1) {
                const address = utils.encode_cell({ r: row, c: col });
                const cell = sheet[address];
                if (!cell) continue;
                const currentText = getCellText(cell);
                const updated = applyReplacements(currentText, replacements, targetParsed);
                if (updated !== currentText) setCellText(cell, updated);
            }
        }
    }
}

export async function extractDocumentCodesFromXls(input) {
    const data = await blobToUint8Array(input);
    const workbook = read(data, { type: 'array', cellDates: true });
    const found = new Set();
    collectCodesFromWorkbook(workbook, found);
    return [...found];
}

export async function replaceDocumentCodeInXls(input, replacements, targetNumber = null) {
    const targetParsed = parseStandardDocumentCode(targetNumber);
    const targetHyphen = targetParsed ? formatVariant(targetParsed, 'hyphen') : null;

    const data = await blobToUint8Array(input);
    const workbook = read(data, { type: 'array', cellDates: true });

    if (replacements?.length || targetParsed) {
        replaceInWorkbook(workbook, replacements, targetParsed);
    }
    if (targetHyphen && targetParsed) {
        injectDocumentCodeInWorkbook(workbook, targetHyphen, targetParsed);
    }

    const output = write(workbook, { bookType: 'biff8', type: 'array' });
    return new Blob([output], { type: XLS_MIME });
}

export async function ensureDocumentCodeInXls(input, targetNumber) {
    return replaceDocumentCodeInXls(input, [], targetNumber);
}
