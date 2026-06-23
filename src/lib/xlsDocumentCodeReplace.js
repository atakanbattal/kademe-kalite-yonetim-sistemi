import { read, utils } from 'xlsx';
import {
    collectCodesFromText,
    formatVariant,
    parseStandardDocumentCode,
} from './documentCodeUtils.js';

const XLS_MIME = 'application/vnd.ms-excel';
const PAD_CHARS = ['\u0007', ' ', '\t'];

export function isXlsAttachment(fileName, mimeType = '') {
    const name = String(fileName || '').toLowerCase();
    const type = String(mimeType || '').toLowerCase();
    if (name.endsWith('.xlsx') || type.includes('spreadsheetml.sheet')) return false;
    return name.endsWith('.xls') || type === XLS_MIME;
}

async function toUint8Array(input) {
    if (input instanceof ArrayBuffer) return new Uint8Array(input);
    if (input instanceof Uint8Array) return input;
    if (input instanceof Blob) return new Uint8Array(await input.arrayBuffer());
    throw new TypeError('Expected Blob, ArrayBuffer, or Uint8Array');
}

function encodeUtf16Le(str) {
    const out = new Uint8Array(str.length * 2);
    for (let i = 0; i < str.length; i += 1) {
        const code = str.charCodeAt(i);
        out[i * 2] = code & 0xff;
        out[i * 2 + 1] = code >> 8;
    }
    return out;
}

function encodeAscii(str) {
    const out = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i += 1) {
        out[i] = str.charCodeAt(i) & 0xff;
    }
    return out;
}

function fitToLength(text, length) {
    if (text.length === length) return text;
    if (text.length > length) return text.slice(0, length);
    let padded = text;
    while (padded.length < length) {
        padded += PAD_CHARS[0];
    }
    return padded;
}

function buildSameLengthPairs(fullText, replacements) {
    const pairs = [];
    const seen = new Set();
    for (const [from, to] of replacements) {
        const source = String(from);
        const target = String(to);
        if (!source || source === target || !fullText.includes(source)) continue;

        const nextTarget = source.length === target.length
            ? target
            : fitToLength(target, source.length);
        if (nextTarget === source) continue;

        const key = `${source}\0${nextTarget}`;
        if (seen.has(key)) continue;
        seen.add(key);
        pairs.push([source, nextTarget]);
    }
    return pairs;
}

function patchRawBuffer(data, pairs) {
    if (!pairs.length) return { buf: data, changed: false };

    const buf = new Uint8Array(data);
    let changed = false;

    for (const [from, to] of pairs) {
        if (from.length !== to.length) continue;

        const variants = [
            [encodeUtf16Le(from), encodeUtf16Le(to)],
            [encodeAscii(from), encodeAscii(to)],
        ];

        for (const [fromBytes, toBytes] of variants) {
            for (let i = 0; i <= buf.length - fromBytes.length; i += 1) {
                let matched = true;
                for (let j = 0; j < fromBytes.length; j += 1) {
                    if (buf[i + j] !== fromBytes[j]) {
                        matched = false;
                        break;
                    }
                }
                if (!matched) continue;
                buf.set(toBytes, i);
                changed = true;
                i += fromBytes.length - 1;
            }
        }
    }

    return { buf, changed };
}

function getCellText(cell) {
    if (!cell) return '';
    if (cell.w != null && String(cell.w).trim()) return String(cell.w);
    if (cell.v == null) return '';
    return String(cell.v);
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

function collectWorkbookText(workbook) {
    const parts = [];
    for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet?.['!ref']) continue;
        const range = utils.decode_range(sheet['!ref']);
        for (let row = range.s.r; row <= range.e.r; row += 1) {
            for (let col = range.s.c; col <= range.e.c; col += 1) {
                const address = utils.encode_cell({ r: row, c: col });
                parts.push(getCellText(sheet[address]));
            }
        }
    }
    return parts.join('\n');
}

export async function extractDocumentCodesFromXls(input) {
    const data = await toUint8Array(input);
    const workbook = read(data, { type: 'array', cellDates: true });
    const found = new Set();
    collectCodesFromWorkbook(workbook, found);
    return [...found];
}

export async function replaceDocumentCodeInXls(input, replacements, targetNumber = null) {
    const targetParsed = parseStandardDocumentCode(targetNumber);
    const data = await toUint8Array(input);
    const workbook = read(data, { type: 'array', cellDates: true });
    const fullText = collectWorkbookText(workbook);

    const effectiveReplacements = buildSameLengthPairs(fullText, replacements || []);
    if (targetParsed) {
        const targetHyphen = formatVariant(targetParsed, 'hyphen');
        const found = new Set();
        collectCodesFromWorkbook(workbook, found);
        for (const code of found) {
            if (code === targetHyphen) continue;
            effectiveReplacements.push(...buildSameLengthPairs(fullText, [[code, targetHyphen]]));
        }
    }

    const { buf, changed } = patchRawBuffer(data, effectiveReplacements);
    if (!changed) {
        return new Blob([data], { type: XLS_MIME });
    }

    return new Blob([buf], { type: XLS_MIME });
}

export async function ensureDocumentCodeInXls(input, targetNumber) {
    return replaceDocumentCodeInXls(input, [], targetNumber);
}
