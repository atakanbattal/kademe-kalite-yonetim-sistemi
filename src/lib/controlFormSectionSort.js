/**
 * "14. Fonksiyonel ..." gibi bölüm başlıklarındaki sıra; order_index tutarsız olsa da tutarlı liste.
 */
export function sectionNameLeadingNumber(name) {
    if (!name || typeof name !== 'string') return null;
    const m = name.trim().match(/^(\d+)[\.\s]/);
    return m ? parseInt(m[1], 10) : null;
}

export function sortControlFormSections(sections) {
    return [...(sections || [])].sort((a, b) => {
        const na = sectionNameLeadingNumber(a.name);
        const nb = sectionNameLeadingNumber(b.name);
        if (na != null && nb != null && na !== nb) return na - nb;
        return (a.order_index ?? 0) - (b.order_index ?? 0);
    });
}
