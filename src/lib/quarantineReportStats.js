/**
 * Karantina geçmişinden hurda / iade ve başlangıç miktarı özeti.
 * Karar sonrası quantity=0 olsa bile işlenen miktarlar toplanır.
 */
export function aggregateQuarantineHistoryByRecord(historyRows = []) {
    const map = {};
    for (const row of historyRows) {
        const id = row.quarantine_record_id;
        if (!id) continue;
        if (!map[id]) {
            map[id] = { hurda: 0, iade: 0, other: 0, totalProcessed: 0 };
        }
        const qty = Number(row.processed_quantity) || 0;
        const decision = String(row.decision || '').trim();
        map[id].totalProcessed += qty;
        if (decision === 'Hurda') map[id].hurda += qty;
        else if (decision === 'İade') map[id].iade += qty;
        else map[id].other += qty;
    }
    return map;
}

export function enrichQuarantineRecordForReport(record, historyStats = {}) {
    const currentQty = Number(record.quantity ?? 0);
    const hurda = historyStats.hurda || 0;
    const iade = historyStats.iade || 0;
    const totalProcessed = historyStats.totalProcessed || 0;
    const initialQty = currentQty + totalProcessed;

    return {
        ...record,
        quantity_current: currentQty,
        quantity_initial: initialQty,
        hurda_processed_total: hurda,
        iade_processed_total: iade,
        total_processed: totalProcessed,
    };
}
