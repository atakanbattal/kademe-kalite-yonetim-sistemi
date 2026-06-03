const esc = (t) =>
    String(t ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

/**
 * Girdi kontrol PDF raporu için kusur listesi HTML (<li>…</li> parçaları).
 */
export function buildIncomingInspectionDefectsListHtml(record) {
    const defects = Array.isArray(record?.defects) ? record.defects : [];
    const validDefects = defects.filter((d) =>
        String(d.defect_description || d.description || d.defect_type || '').trim()
    );

    if (validDefects.length > 0) {
        return validDefects
            .map((d) => {
                const title = d.defect_type || d.defect_description || '-';
                const desc = d.defect_description || d.description || '';
                const qty =
                    d.quantity != null && d.quantity !== ''
                        ? ` (${d.quantity} adet)`
                        : '';
                const body =
                    desc && desc !== title ? `: ${esc(desc)}` : '';
                return `<li><strong>${esc(title)}</strong>${body}${qty}</li>`;
            })
            .join('');
    }

    const failedResults = (record?.results || []).filter((r) => r.result === false);
    if (failedResults.length > 0) {
        return failedResults
            .map(
                (r) =>
                    `<li><strong>${esc(r.feature || 'Ölçüm')}</strong>: NOK — Ölçülen: ${esc(r.actual_value ?? '-')} (Nom: ${esc(r.nominal_value ?? '-')})</li>`
            )
            .join('');
    }

    const rejected = Number(record?.quantity_rejected) || 0;
    const decision = String(record?.decision || '').trim();
    if (decision === 'Ret' || rejected > 0) {
        const unit = record?.unit || 'Adet';
        return `<li><strong>Ret / NOK</strong>: Muayene kararı ret veya red miktarı mevcut; detaylı kusur satırı girilmemiş olabilir. Reddedilen: <strong>${rejected}</strong> ${esc(unit)}</li>`;
    }

    return '<li>Kusur tespit edilmemiştir.</li>';
}
