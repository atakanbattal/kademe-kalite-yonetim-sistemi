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

export function isEditableOfficeSource(fileName, mimeType = '') {
    return isDocxAttachment(fileName, mimeType)
        || isLegacyDocAttachment(fileName, mimeType)
        || isXlsxAttachment(fileName, mimeType)
        || isXlsAttachment(fileName, mimeType);
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

    const isDocx = isDocxAttachment(fileName, mimeType);
    const isDoc = isLegacyDocAttachment(fileName, mimeType);
    const isXlsx = isXlsxAttachment(fileName, mimeType);
    const isXls = isXlsAttachment(fileName, mimeType);

    const replacements = await buildDocumentCodeReplacementsForTarget(documentNumber, {
        oldNumber,
        extraTextSources,
        docxBlob: isDocx ? blob : undefined,
        docBlob: isDoc ? blob : undefined,
        xlsxBlob: isXlsx ? blob : undefined,
        xlsBlob: isXls ? blob : undefined,
    });

    const beforeSize = blob instanceof Blob ? blob.size : blob?.byteLength;
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

    const afterSize = patchedBlob instanceof Blob ? patchedBlob.size : patchedBlob?.byteLength;
    const contentChanged = beforeSize !== afterSize || replacements.length > 0;

    return {
        blob: patchedBlob,
        patched: contentChanged || replacements.length > 0,
        replacements,
        injected: true,
    };
}
