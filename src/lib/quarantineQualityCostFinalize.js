import { supabase } from '@/lib/customSupabaseClient';

/**
 * İmzalı hurda tutanağı (PDF) sonrası karantina güncellemesi.
 * `quality_cost_id` yalnızca eski akışta (Kalite Maliyeti üzerinden) dolu olur; karantina modülündeki hurda tutanağında null kalır.
 */
export async function finalizeQuarantineFromQualityCost({
    quarantineRecordId,
    quantity,
    decision,
    notes,
    qualityCostId,
    hurdaDocumentUrl,
}) {
    const { data: record, error: fetchErr } = await supabase
        .from('quarantine_records')
        .select('id, quantity')
        .eq('id', quarantineRecordId)
        .single();

    if (fetchErr || !record) {
        throw new Error(fetchErr?.message || 'Karantina kaydı bulunamadı.');
    }

    const currentQty = Number(record.quantity ?? 0);
    const processed = Number(quantity ?? 0);
    const remainingQuantity = currentQty - processed;

    if (remainingQuantity < 0) {
        throw new Error('İşlem miktarı güncel karantina miktarından fazla olamaz.');
    }

    const statusMap = {
        Hurda: 'Hurda',
    };

    let newStatus;
    if (remainingQuantity > 0) {
        newStatus = 'Karantinada';
    } else {
        newStatus = statusMap[decision] || 'Tamamlandı';
    }

    const { error: historyError } = await supabase.from('quarantine_history').insert({
        quarantine_record_id: quarantineRecordId,
        processed_quantity: processed,
        decision,
        notes: notes ?? null,
        decision_date: new Date().toISOString(),
        deviation_approval_url: hurdaDocumentUrl ?? null,
        deviation_id: null,
        quality_cost_id: qualityCostId ?? null,
    });

    if (historyError) throw historyError;

    const { error: updateError } = await supabase
        .from('quarantine_records')
        .update({
            quantity: remainingQuantity,
            status: newStatus,
            decision,
            decision_date: new Date().toISOString(),
        })
        .eq('id', quarantineRecordId);

    if (updateError) throw updateError;
}
