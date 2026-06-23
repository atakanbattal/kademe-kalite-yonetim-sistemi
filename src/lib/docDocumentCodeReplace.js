import CFB from 'cfb';
import {
    applyReplacements,
    collectCodesFromText,
    formatVariant,
    isCodeSlotValue,
    isDocumentNumberLabel,
    isPlaceholderCodeValue,
    looksLikeDocumentCode,
    normalizeLooseCode,
    parseStandardDocumentCode,
    textMatchesTargetCode,
} from './documentCodeUtils.js';

const DOC_MIME = 'application/msword';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const CELL_PAD_CHARS = ['\u0007', ' ', '\t'];

export function isLegacyDocAttachment(fileName, mimeType = '') {
    const name = String(fileName || '').toLowerCase();
    const type = String(mimeType || '').toLowerCase();
    if (name.endsWith('.docx') || type === DOCX_MIME || type.includes('wordprocessingml')) return false;
    return name.endsWith('.doc') || type === DOC_MIME;
}

async function toUint8Array(input) {
    if (input instanceof ArrayBuffer) return new Uint8Array(input);
    if (input instanceof Uint8Array) return input;
    if (input instanceof Blob) return new Uint8Array(await input.arrayBuffer());
    throw new TypeError('Expected Blob, ArrayBuffer, or Uint8Array');
}

function readU8(buf, off) {
    return buf[off] ?? 0;
}

function readU16LE(buf, off) {
    return buf[off] | (buf[off + 1] << 8);
}

function readU32LE(buf, off) {
    return (buf[off] | (buf[off + 1] << 8) | (buf[off + 2] << 16) | (buf[off + 3] << 24)) >>> 0;
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

function decodeUtf16Le(bytes) {
    let out = '';
    for (let i = 0; i + 1 < bytes.length; i += 2) {
        out += String.fromCharCode(bytes[i] | (bytes[i + 1] << 8));
    }
    return out;
}

const ANSI_SPECIAL = {
    0x82: '\u201A', 0x83: '\u0192', 0x84: '\u201E', 0x85: '\u2026', 0x86: '\u2020', 0x87: '\u2021',
    0x88: '\u02C6', 0x89: '\u2030', 0x8A: '\u0160', 0x8B: '\u2039', 0x8C: '\u0152', 0x91: '\u2018',
    0x92: '\u2019', 0x93: '\u201C', 0x94: '\u201D', 0x95: '\u2022', 0x96: '\u2013', 0x97: '\u2014',
    0x98: '\u02DC', 0x99: '\u2122', 0x9A: '\u0161', 0x9B: '\u203A', 0x9C: '\u0153', 0x9F: '\u0178',
};

function decodeAnsi(bytes) {
    let out = '';
    for (let i = 0; i < bytes.length; i += 1) {
        const b = bytes[i];
        out += ANSI_SPECIAL[b] || String.fromCharCode(b);
    }
    return out;
}

function encodeAnsi(str) {
    const out = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i += 1) {
        out[i] = str.charCodeAt(i) & 0xff;
    }
    return out;
}

function decodePieceText(bytes, unicode) {
    return unicode ? decodeUtf16Le(bytes) : decodeAnsi(bytes);
}

function encodePieceText(text, unicode) {
    return unicode ? encodeUtf16Le(text) : encodeAnsi(text);
}

function isPadChar(ch) {
    return CELL_PAD_CHARS.includes(ch);
}

function countTrailingPad(text, start) {
    let count = 0;
    for (let i = start; i < text.length; i += 1) {
        if (!isPadChar(text[i])) break;
        count += 1;
    }
    return count;
}

function replaceSameLengthSegment(text, from, to) {
    if (!from || from === to || !text.includes(from)) return text;
    if (from.length === to.length) {
        return text.split(from).join(to);
    }

    let result = text;
    let searchFrom = 0;
    while (searchFrom < result.length) {
        const idx = result.indexOf(from, searchFrom);
        if (idx < 0) break;

        const afterFrom = idx + from.length;
        const extraNeeded = to.length - from.length;

        if (extraNeeded <= 0) {
            const paddedTo = extraNeeded < 0
                ? to + '\u0007'.repeat(-extraNeeded)
                : to;
            result = result.slice(0, idx) + paddedTo + result.slice(afterFrom);
            searchFrom = idx + paddedTo.length;
            continue;
        }

        const availablePad = countTrailingPad(result, afterFrom);
        if (availablePad < extraNeeded) {
            searchFrom = afterFrom;
            continue;
        }

        const replaceEnd = afterFrom + extraNeeded;
        result = result.slice(0, idx) + to + result.slice(replaceEnd);
        searchFrom = idx + to.length;
    }

    return result;
}

function applyDocTextReplacements(text, replacements, targetParsed = null) {
    let result = applyReplacements(text, replacements, targetParsed);
    for (const [from, to] of replacements) {
        result = replaceSameLengthSegment(result, String(from), String(to));
    }
    if (targetParsed) {
        result = applyReplacements(result, replacements, targetParsed);
    }
    return result;
}

function fitTextToByteSize(text, byteSize, unicode) {
    let current = text;
    let encoded = encodePieceText(current, unicode);
    if (encoded.length === byteSize) return current;

    if (encoded.length < byteSize) {
        const padChar = unicode ? '\u0007' : ' ';
        while (encodePieceText(current, unicode).length < byteSize) {
            current += padChar;
        }
        encoded = encodePieceText(current, unicode);
        if (encoded.length > byteSize) {
            while (encodePieceText(current, unicode).length > byteSize && current.length > 0) {
                current = current.slice(0, -1);
            }
        }
        return current;
    }

    while (current.length > 0 && encodePieceText(current, unicode).length > byteSize) {
        current = current.slice(0, -1);
    }
    return current;
}

function injectDocumentCodeInText(text, targetHyphen, targetParsed) {
    const segments = text.split(/(\u0007|\t|\r|\n)/);
    for (let i = 0; i < segments.length; i += 1) {
        if (!isDocumentNumberLabel(normalizeLooseCode(segments[i]))) continue;
        for (let j = i + 1; j < segments.length; j += 1) {
            if (!segments[j] || /^[\u0007\t\r\n]+$/.test(segments[j])) continue;
            const valueText = normalizeLooseCode(segments[j]);
            if (textMatchesTargetCode(valueText, targetParsed)) return text;
            if (
                isCodeSlotValue(valueText, targetParsed)
                || looksLikeDocumentCode(valueText)
                || isPlaceholderCodeValue(valueText)
            ) {
                const oldSegment = segments[j];
                let nextValue = targetHyphen;
                if (nextValue.length < oldSegment.length) {
                    nextValue += '\u0007'.repeat(oldSegment.length - nextValue.length);
                } else if (nextValue.length > oldSegment.length) {
                    const extra = nextValue.length - oldSegment.length;
                    const padAfter = countTrailingPad(segments, j + 1);
                    let padSegmentIdx = j + 1;
                    let available = 0;
                    while (padSegmentIdx < segments.length && /^[\u0007\t\r\n]+$/.test(segments[padSegmentIdx])) {
                        available += segments[padSegmentIdx].length;
                        padSegmentIdx += 2;
                    }
                    if (available < extra) return text;
                    segments[j] = nextValue;
                    let remaining = extra;
                    for (let k = j + 1; k < segments.length && remaining > 0; k += 1) {
                        if (!/^[\u0007\t\r\n]+$/.test(segments[k])) continue;
                        const remove = Math.min(remaining, segments[k].length);
                        segments[k] = segments[k].slice(remove);
                        remaining -= remove;
                    }
                } else {
                    segments[j] = nextValue;
                }
                return segments.join('');
            }
        }
    }
    return text;
}

function getCfbEntryContent(cfb, pathSuffix) {
    const idx = cfb.FullPaths.findIndex((p) => p.endsWith(pathSuffix));
    if (idx < 0) return null;
    const entry = cfb.FileIndex[idx];
    if (!entry?.content) return null;
    return entry.content instanceof Uint8Array ? entry.content : new Uint8Array(entry.content);
}

function setCfbEntryContent(cfb, pathSuffix, content) {
    const idx = cfb.FullPaths.findIndex((p) => p.endsWith(pathSuffix));
    if (idx < 0) return false;
    const entry = cfb.FileIndex[idx];
    entry.content = content;
    entry.size = content.length;
    return true;
}

function parsePieces(wordDoc, tableBuf) {
    const magic = readU16LE(wordDoc, 0);
    if (magic !== 0xa5ec) {
        throw new Error('Geçersiz Word .doc dosyası');
    }

    let pos = readU32LE(wordDoc, 0x01a2);
    while (pos < tableBuf.length) {
        const flag = readU8(tableBuf, pos);
        if (flag !== 1) break;
        pos += 1;
        const skip = readU16LE(tableBuf, pos);
        pos += 2 + skip;
    }

    if (readU8(tableBuf, pos) !== 2) {
        throw new Error('Word parça tablosu okunamadı');
    }
    pos += 1;

    const pieceTableSize = readU32LE(tableBuf, pos);
    pos += 4;
    const pieceCount = (pieceTableSize - 4) / 12;
    const pieces = [];

    for (let x = 0; x < pieceCount; x += 1) {
        const pcdOffset = pos + ((pieceCount + 1) * 4) + (x * 8) + 2;
        let startFilePos = readU32LE(tableBuf, pcdOffset);
        const unicode = (startFilePos & 0x40000000) === 0;
        if (!unicode) {
            startFilePos &= ~0x40000000;
            startFilePos = Math.floor(startFilePos / 2);
        }

        const cpStart = readU32LE(tableBuf, pos + (x * 4));
        const cpEnd = readU32LE(tableBuf, pos + ((x + 1) * 4));
        const byteSize = (cpEnd - cpStart) * (unicode ? 2 : 1);
        const textBytes = wordDoc.slice(startFilePos, startFilePos + byteSize);
        const text = decodePieceText(textBytes, unicode);

        pieces.push({
            startFilePos,
            endFilePos: startFilePos + byteSize,
            unicode,
            text,
            byteSize,
        });
    }

    return pieces;
}

function replaceAllSameLengthUtf16Le(buffer, from, to) {
    if (from.length !== to.length) return null;
    const fromBytes = encodeUtf16Le(from);
    const toBytes = encodeUtf16Le(to);
    const src = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let found = false;
    const out = new Uint8Array(src.length);
    let ri = 0;
    for (let i = 0; i < src.length;) {
        let matched = i + fromBytes.length <= src.length;
        if (matched) {
            for (let j = 0; j < fromBytes.length; j += 1) {
                if (src[i + j] !== fromBytes[j]) {
                    matched = false;
                    break;
                }
            }
        }
        if (matched) {
            out.set(toBytes, ri);
            ri += toBytes.length;
            i += fromBytes.length;
            found = true;
        } else {
            out[ri] = src[i];
            ri += 1;
            i += 1;
        }
    }
    return found ? out.slice(0, ri) : null;
}

function buildSameLengthPairs(text, replacements) {
    const pairs = [];
    for (const [from, to] of replacements) {
        const source = String(from);
        const target = String(to);
        if (!source || source === target || !text.includes(source)) continue;

        if (source.length === target.length) {
            pairs.push([source, target]);
            continue;
        }

        let searchFrom = 0;
        while (searchFrom < text.length) {
            const idx = text.indexOf(source, searchFrom);
            if (idx < 0) break;
            const after = idx + source.length;
            const extraNeeded = target.length - source.length;

            if (extraNeeded <= 0) {
                const paddedTarget = target + '\u0007'.repeat(-extraNeeded);
                pairs.push([source, paddedTarget]);
                searchFrom = after;
                continue;
            }

            const availablePad = countTrailingPad(text, after);
            if (availablePad >= extraNeeded) {
                pairs.push([
                    source + text.slice(after, after + extraNeeded),
                    target,
                ]);
            }
            searchFrom = after;
        }
    }
    return pairs;
}

function patchPiecesInPlace(wordDoc, pieces, replacements, targetParsed) {
    const doc = new Uint8Array(wordDoc);
    let changed = false;

    for (const piece of pieces) {
        let nextText = applyDocTextReplacements(piece.text, replacements, targetParsed);
        if (targetParsed) {
            const targetHyphen = formatVariant(targetParsed, 'hyphen');
            nextText = injectDocumentCodeInText(nextText, targetHyphen, targetParsed);
        }
        nextText = fitTextToByteSize(nextText, piece.byteSize, piece.unicode);
        const nextBytes = encodePieceText(nextText, piece.unicode);
        const oldBytes = doc.slice(piece.startFilePos, piece.endFilePos);

        if (nextBytes.length !== oldBytes.length) continue;
        if (nextBytes.some((b, i) => b !== oldBytes[i])) {
            doc.set(nextBytes, piece.startFilePos);
            changed = true;
        }
    }

    return { wordDoc: doc, changed };
}

function tryFastSameLengthReplace(cfb, pairs) {
    if (!pairs.length) return false;
    let changed = false;

    for (let i = 0; i < cfb.FullPaths.length; i += 1) {
        const entry = cfb.FileIndex[i];
        if (!entry?.content || entry.type !== 2) continue;
        let content = entry.content instanceof Uint8Array ? entry.content : new Uint8Array(entry.content);
        let next = content;
        for (const [from, to] of pairs) {
            if (from.length !== to.length) continue;
            const replaced = replaceAllSameLengthUtf16Le(next, from, to);
            if (replaced) {
                next = replaced;
                changed = true;
            }
        }
        if (next !== content) {
            entry.content = next;
            entry.size = next.length;
        }
    }

    return changed;
}

function getTableStreamName(wordDoc) {
    const flags = readU16LE(wordDoc, 0x0a);
    return (flags & 0x0200) !== 0 ? '1Table' : '0Table';
}

function collectCodesFromPieces(pieces, bucket) {
    for (const piece of pieces) {
        collectCodesFromText(piece.text, bucket);
    }
}

export async function extractDocumentCodesFromDoc(input) {
    const data = await toUint8Array(input);
    const cfb = CFB.read(data, { type: 'array' });
    const wordDoc = getCfbEntryContent(cfb, 'WordDocument');
    const tableName = getTableStreamName(wordDoc);
    const tableBuf = getCfbEntryContent(cfb, tableName);
    if (!wordDoc || !tableBuf) return [];

    const pieces = parsePieces(wordDoc, tableBuf);
    const found = new Set();
    collectCodesFromPieces(pieces, found);
    return [...found];
}

export async function replaceDocumentCodeInDoc(input, replacements, targetNumber = null) {
    const targetParsed = parseStandardDocumentCode(targetNumber);
    const data = await toUint8Array(input);
    const cfb = CFB.read(data, { type: 'array' });
    const wordDoc = getCfbEntryContent(cfb, 'WordDocument');
    if (!wordDoc) {
        throw new Error('WordDocument akışı bulunamadı');
    }

    const tableName = getTableStreamName(wordDoc);
    const tableBuf = getCfbEntryContent(cfb, tableName);
    if (!tableBuf) {
        throw new Error('Word tablo akışı bulunamadı');
    }

    const pieces = parsePieces(wordDoc, tableBuf);
    const fullText = pieces.map((p) => p.text).join('');
    const sameLengthPairs = buildSameLengthPairs(fullText, replacements || []);

    let changed = tryFastSameLengthReplace(cfb, sameLengthPairs);
    if (!changed) {
        const patched = patchPiecesInPlace(wordDoc, pieces, replacements || [], targetParsed);
        if (patched.changed) {
            setCfbEntryContent(cfb, 'WordDocument', patched.wordDoc);
            changed = true;
        }
    }

    if (!changed && targetParsed) {
        const patched = patchPiecesInPlace(wordDoc, pieces, [], targetParsed);
        if (patched.changed) {
            setCfbEntryContent(cfb, 'WordDocument', patched.wordDoc);
            changed = true;
        }
    }

    const output = CFB.write(cfb, { type: 'array' });
    return new Blob([output], { type: DOC_MIME });
}

export async function ensureDocumentCodeInDoc(input, targetNumber) {
    return replaceDocumentCodeInDoc(input, [], targetNumber);
}
