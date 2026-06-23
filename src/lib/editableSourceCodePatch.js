import {
    buildDocumentCodeReplacementsForTarget,
    isDocxAttachment,
    replaceDocumentCodeInDocx,
} from './docxDocumentCodeReplace.js';
import {
    isLegacyDocAttachment,
    replaceDocumentCodeInDoc,
} from './docDocumentCodeReplace.js';
import {
    isXlsAttachment,
    replaceDocumentCodeInXls,
} from './xlsDocumentCodeReplace.js';
import {
    isXlsxAttachment,
    replaceDocumentCodeInXlsx,
} from './xlsxDocumentCodeReplace.js';
import { resolveEditableSourceMimeType } from './documentRevisionAttachments.js';

async function toArrayBuffer(input) {
    if (input instanceof ArrayBuffer) return input;
    if (input instanceof Uint8Array) return input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);
    if (input instanceof Blob) return input.arrayBuffer();
    throw new TypeError('Expected Blob, ArrayBuffer, or Uint8Array');
}

function buffersEqual(a, b) {
    const aa = new Uint8Array(a);
    const bb = new Uint8Array(b);
    if (aa.byteLength !== bb.byteLength) return false;
    for (let i = 0; i < aa.byteLength; i += 1) {
        if (aa[i] !== bb[i]) return false;
    }
    return true;
}

export function isEditableOfficeSource(fileName, mimeType = '') {
    const resolved = resolveEditableSourceMimeType(fileName, mimeType);
    return isDocxAttachment(fileName, resolved)
        || isLegacyDocAttachment(fileName, resolved)
        || isXlsxAttachment(fileName, resolved)
        || isXlsAttachment(fileName, resolved);
}

export async function patchEditableSourceBlob(blob, documentNumber, {
    oldNumber,
    extraTextSources = [],
    fileName,
    mimeType,
} = {}) {
    if (!documentNumber || !isEditableOfficeSource(fileName, mimeType)) {
        return { blob, patched: false, replacements: [], injected: false };
    }

    const resolvedMime = resolveEditableSourceMimeType(fileName, mimeType);
    const isDocx = isDocxAttachment(fileName, resolvedMime);
    const isDoc = isLegacyDocAttachment(fileName, resolvedMime);
    const isXlsx = isXlsxAttachment(fileName, resolvedMime);
    const isXls = isXlsAttachment(fileName, resolvedMime);

    const replacements = await buildDocumentCodeReplacementsForTarget(documentNumber, {
        oldNumber,
        extraTextSources,
        docxBlob: isDocx ? blob : undefined,
        docBlob: isDoc ? blob : undefined,
        xlsxBlob: isXlsx ? blob : undefined,
        xlsBlob: isXls ? blob : undefined,
    });

    const beforeBuf = await toArrayBuffer(blob);
    let patchedBlob;

    if (isDocx) {
        patchedBlob = await replaceDocumentCodeInDocx(blob, replacements, documentNumber);
    } else if (isDoc) {
        patchedBlob = await replaceDocumentCodeInDoc(blob, replacements, documentNumber);
    } else if (isXls) {
        patchedBlob = await replaceDocumentCodeInXls(blob, replacements, documentNumber);
    } else {
        patchedBlob = await replaceDocumentCodeInXlsx(blob, replacements, documentNumber);
    }

    const afterBuf = await toArrayBuffer(patchedBlob);
    const contentChanged = !buffersEqual(beforeBuf, afterBuf);

    return {
        blob: patchedBlob,
        patched: contentChanged,
        replacements,
        injected: contentChanged,
    };
}
