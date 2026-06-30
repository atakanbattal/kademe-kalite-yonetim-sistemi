export const STEP_TYPE_OPTIONS = [
    { value: 'start', label: 'Başlangıç' },
    { value: 'process', label: 'İşlem Adımı' },
    { value: 'subprocess', label: 'Alt Süreç' },
    { value: 'io', label: 'Kayıt / Form' },
    { value: 'decision', label: 'Karar Noktası' },
    { value: 'end', label: 'Bitiş' },
    { value: 'note', label: 'Not' },
];

export const LINKABLE_DOCUMENT_TYPES = [
    'Prosedürler',
    'Talimatlar',
    'Formlar',
    'Şemalar',
    'Görev Tanımları',
    'Süreçler',
    'Planlar',
    'Listeler',
];

/** @deprecated use LINKABLE_DOCUMENT_TYPES */
export const LINKABLE_DOCUMENT_CATEGORIES = LINKABLE_DOCUMENT_TYPES;

const LINKABLE_CODE_PATTERN = /-(PR|TL|FR|SM)-/i;

export function isLinkableDocument(doc) {
    if (!doc?.document_number || doc.is_archived === true) return false;
    if (LINKABLE_DOCUMENT_TYPES.includes(doc.document_type)) return true;
    return LINKABLE_CODE_PATTERN.test(doc.document_number);
}

export function documentMatchesUnit(doc, unitCode) {
    if (!unitCode || !doc?.document_number) return false;
    return doc.document_number.toUpperCase().startsWith(`${unitCode.toUpperCase()}-`);
}

export const STEP_TYPE_CLASS = {
    start: 'n-start',
    process: 'n-proc',
    subprocess: 'n-sub',
    io: 'n-io',
    end: 'n-end',
    note: 'fl-note',
};

export const STEP_TYPE_ICON = {
    start: '▶',
    process: '▭',
    subprocess: '▣',
    io: '⇄',
    end: '■',
    note: 'ⓘ',
};

export function formatDocumentChip(doc) {
    if (!doc) return '';
    return doc.section_ref ? `${doc.document_code} ${doc.section_ref}` : doc.document_code;
}

export function splitDocumentCode(raw) {
    const t = String(raw || '').trim();
    const m = t.match(/^([A-ZÇĞİÖŞÜa-zçğıöşü0-9-]+)(?:\s+(§.+))?$/u);
    if (!m) return { document_code: t, section_ref: null };
    return { document_code: m[1], section_ref: m[2]?.trim() || null };
}
