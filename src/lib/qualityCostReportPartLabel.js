/**
 * Parça kodu yokken raporda kayıtları ayırt etmek için etiket (170 aynı isimli kayıt sorunu).
 */
export function buildQualityCostReportPartLabel(item) {
    const code =
        item?.part_code && String(item.part_code).trim() && item.part_code !== '-'
            ? String(item.part_code).trim()
            : '';
    const name =
        item?.part_name && String(item.part_name).trim() && item.part_name !== '-'
            ? String(item.part_name).trim()
            : '';

    if (code) {
        return name ? `${code} — ${name}` : code;
    }

    if (name) {
        const parts = [name];
        const desc = String(item?.description || '')
            .replace(/\s+/g, ' ')
            .trim();
        if (desc && desc !== '-') {
            const short = desc.length > 48 ? `${desc.slice(0, 48)}…` : desc;
            parts.push(short);
        }
        const date = item?.cost_date && item.cost_date !== '-' ? item.cost_date : '';
        if (date) parts.push(date);
        return parts.join(' · ');
    }

    const desc = String(item?.description || '').replace(/\s+/g, ' ').trim();
    if (desc && desc !== '-') {
        return desc.length > 60 ? `${desc.slice(0, 60)}…` : desc;
    }

    return '-';
}
