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
    const summary = getQuarantineQuantitySummary(record, historyStats);

    return {
        ...record,
        quantity_current: summary.remainingQty,
        quantity_initial: summary.initialQty,
        hurda_processed_total: historyStats.hurda || 0,
        iade_processed_total: historyStats.iade || 0,
        total_processed: summary.processedQty,
    };
}

/** Liste ve raporlar için başlangıç / işlenen / kalan özeti */
export function getQuarantineQuantitySummary(record, historyStats = {}) {
    const currentQty = Number(record?.quantity ?? 0);
    const totalFromHistory = Number(historyStats?.totalProcessed ?? 0);
    const initialFromField = Number(record?.initial_quantity ?? 0);

    let initialQty = initialFromField > 0 ? initialFromField : currentQty + totalFromHistory;
    let processedQty = totalFromHistory > 0
        ? totalFromHistory
        : Math.max(0, initialQty - currentQty);

    if (initialQty <= 0 && currentQty > 0) {
        initialQty = currentQty;
        processedQty = 0;
    }

    return {
        initialQty,
        processedQty,
        remainingQty: currentQty,
    };
}
