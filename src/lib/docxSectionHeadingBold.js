import JSZip from 'jszip';
import { decodeXmlEntities } from './documentCodeUtils.js';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const SKIP_WORD_XML = /^word\/(styles|fontTable|settings|webSettings|numbering|theme)\b/i;

/** Prosedür / talimat iskelet bölüm başlıkları */
export const SECTION_HEADING_TITLES = [
    'AMAÇ',
    'KAPSAM',
    'SORUMLULUKLAR',
    'SORUMLULUK',
    'TANIMLAR VE KISALTMALAR',
    'TANIMLAR',
    'TANIM',
    'DAYANAK / REFERANS STANDARTLAR',
    'DAYANAK',
    'REFERANSLAR',
    'REFERANS STANDARTLAR',
    'UYGULAMA',
    'UYGULAMA ALANI',
    'İLGİLİ DOKÜMANLAR',
    'KAYITLAR',
    'KAYITLARIN KONTROLÜ',
    'KAYITLARIN SAKLANMASI',
    'EKLER',
    'KISALTMALAR',
    'YÜRÜRLÜK',
    'YÜRÜRLÜKTEN KALDIRMA',
    'GENEL HÜKÜMLER',
];

const SUBSECTION_PREFIXES = [
    'KAYIT',
    'UYGULAMA',
    'SORUMLULUK',
    'TANIM',
    'KONTROL',
    'SAKLAMA',
    'DOKÜMAN',
    'REFERANS',
    'EK ',
    'EKLER',
];

function shouldProcessWordXml(path) {
    return /^word\/.+\.xml$/i.test(path) && !SKIP_WORD_XML.test(path);
}

function normalizeHeadingKey(text) {
    return String(text || '')
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toUpperCase()
        .replace(/\s+/g, ' ')
        .trim();
}

function extractBlockText(blockXml) {
    const parts = [];
    const runRegex = /<w:t(\s+xml:space="preserve")?>([^<]*)<\/w:t>/g;
    let match;
    while ((match = runRegex.exec(blockXml)) !== null) {
        parts.push(decodeXmlEntities(match[2]));
    }
    return parts.join('').trim();
}

/** Paragraf / hücre metni KYS bölüm başlığı mı */
export function isSectionHeadingText(text) {
    const raw = String(text || '').trim();
    if (!raw || raw.length > 80) return false;

    const numbered = raw.match(/^(\d+(?:\.\d+)*[\.)]?\s+)(.+)$/);
    const body = numbered ? numbered[2] : raw;
    const bodyClean = body.split('—')[0].split(' - ')[0].trim().replace(/[:：]\s*$/, '');
    const key = normalizeHeadingKey(bodyClean);

    if (SECTION_HEADING_TITLES.some((title) => key === normalizeHeadingKey(title))) {
        return true;
    }

    // Alt bölüm: 6.5 Kayıtların Kontrolü
    if (/^\d+\.\d+/.test(raw) && bodyClean.length <= 60) {
        return SUBSECTION_PREFIXES.some((prefix) => key.startsWith(prefix));
    }

    return false;
}

function runHasBold(runXml) {
    return /<w:b\b|<w:b\s*\/>|<w:bCs\b|<w:bCs\s*\/>|<w:b w:val="(?:true|1|on)"/i.test(runXml);
}

function blockHasBold(blockXml) {
    const runRegex = /<w:r\b[\s\S]*?<\/w:r>/g;
    let match;
    while ((match = runRegex.exec(blockXml)) !== null) {
        if (runHasBold(match[0])) return true;
    }
    return false;
}

function ensureRunBold(runXml) {
    if (runHasBold(runXml)) {
        if (!/<w:bCs\b|<w:bCs\s*\/>/.test(runXml) && /<w:b\b|<w:b\s*\/>/.test(runXml)) {
            return runXml.replace(/<\/w:rPr>/, '<w:bCs/></w:rPr>');
        }
        return runXml;
    }

    if (/<w:rPr\b[\s\S]*?<\/w:rPr>/.test(runXml)) {
        return runXml.replace(/<\/w:rPr>/, '<w:b/><w:bCs/></w:rPr>');
    }

    return runXml.replace(/<w:r\b([^>]*)>/, '<w:r$1><w:rPr><w:b/><w:bCs/></w:rPr>');
}

/** Tek paragraf veya tablo hücresindeki tüm run'lara bold uygular */
export function ensureBlockRunsBold(blockXml) {
    if (blockHasBold(blockXml)) {
        // Eksik run'ları tamamla
        return blockXml.replace(/<w:r\b[\s\S]*?<\/w:r>/g, (run) => ensureRunBold(run));
    }
    return blockXml.replace(/<w:r\b[\s\S]*?<\/w:r>/g, (run) => ensureRunBold(run));
}

function patchWordXmlContent(xml) {
    let changed = false;

    const updated = xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (block) => {
        const text = extractBlockText(block);
        if (!isSectionHeadingText(text)) return block;
        const next = ensureBlockRunsBold(block);
        if (next !== block) changed = true;
        return next;
    });

    return { xml: updated, changed };
}

/**
 * .docx içindeki amaç / kapsam vb. bölüm başlıklarına bold ekler.
 * @returns {Promise<{ blob: Blob, patched: boolean, headingsPatched: number }>}
 */
export async function patchDocxSectionHeadingsBold(input) {
    const zip = await JSZip.loadAsync(input);
    let patched = false;
    let headingsPatched = 0;

    const tasks = [];
    zip.forEach((relativePath, file) => {
        if (file.dir || !shouldProcessWordXml(relativePath)) return;
        tasks.push(
            file.async('string').then((content) => {
                const { xml, changed } = patchWordXmlContent(content);
                if (changed) {
                    zip.file(relativePath, xml);
                    patched = true;
                    const before = (content.match(/<w:p\b/g) || []).length;
                    void before;
                    headingsPatched += 1;
                }
            })
        );
    });

    await Promise.all(tasks);

    if (!patched) {
        const blob = input instanceof Blob
            ? input
            : new Blob([input], { type: DOCX_MIME });
        return { blob, patched: false, headingsPatched: 0 };
    }

    const blob = await zip.generateAsync({
        type: 'blob',
        mimeType: DOCX_MIME,
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
    });

    return { blob, patched: true, headingsPatched };
}

export function isDocxSource(fileName, mimeType = '') {
    const name = String(fileName || '').toLowerCase();
    const type = String(mimeType || '').toLowerCase();
    return name.endsWith('.docx') || type === DOCX_MIME;
}
