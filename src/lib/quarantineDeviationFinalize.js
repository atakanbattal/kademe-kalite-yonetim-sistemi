import { supabase } from '@/lib/customSupabaseClient';

/**
 * Sapma kaydı ve imzalı PDF yüklendikten sonra karantina miktarı ve durumunu günceller.
 */
export async function finalizeQuarantineFromDeviation({
    quarantineRecordId,
    quantity,
    decision,
    notes,
    deviationId,
    deviationApprovalUrl,
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
        'Serbest Bırak': 'Serbest Bırakıldı',
        'Sapma Onayı': 'Sapma Onaylı',
        'Yeniden İşlem': 'Yeniden İşlem',
        Hurda: 'Hurda',
        İade: 'İade',
        'Onay Bekliyor': 'Onay Bekliyor',
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
        deviation_approval_url: deviationApprovalUrl ?? null,
        deviation_id: deviationId ?? null,
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
