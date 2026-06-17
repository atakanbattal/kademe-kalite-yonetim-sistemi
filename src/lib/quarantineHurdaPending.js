import { supabase } from '@/lib/customSupabaseClient';
import { v4 as uuidv4 } from 'uuid';
import { sanitizeFileName } from '@/lib/utils';

export const HURDA_DECISION = 'Hurda';
export const QUARANTINE_FILES_BUCKET = 'quarantine_documents';

export function normalizeQuarantineDecision(value) {
    return String(value ?? '').trim();
}

export function isHurdaDecision(decision) {
    return normalizeQuarantineDecision(decision) === HURDA_DECISION;
}

/** Tutanaksız, tamamlanmamış hurda geçmiş satırı */
export function isPendingHurdaHistoryEntry(entry) {
    if (!entry) return false;
    if (!isHurdaDecision(entry.decision)) return false;
    return !entry.deviation_approval_url && !entry.quality_cost_id;
}

export async function fetchPendingHurdaHistoryEntries(quarantineRecordId) {
    if (!quarantineRecordId) return [];

    const { data, error } = await supabase
        .from('quarantine_history')
        .select('*')
        .eq('quarantine_record_id', quarantineRecordId)
        .order('decision_date', { ascending: false });

    if (error) throw error;
    return (data || []).filter(isPendingHurdaHistoryEntry);
}

export async function uploadPendingHurdaTutanakPdf({ recordId, historyEntryId, file }) {
    if (!recordId || !historyEntryId || !file) {
        throw new Error('Kayıt, işlem satırı ve PDF dosyası gerekli.');
    }

    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
    if (!isPdf) {
        throw new Error('Yalnızca PDF yükleyebilirsiniz.');
    }

    const safeName = sanitizeFileName(file.name || 'hurda-tutanagi.pdf');
    const filePath = `record_attachments/${recordId}/hurda-${uuidv4()}-${safeName}`;
    const { error: upErr } = await supabase.storage
        .from(QUARANTINE_FILES_BUCKET)
        .upload(filePath, file, { contentType: file.type || 'application/pdf', upsert: false });
    if (upErr) throw new Error(upErr.message);

    const { data: pub } = supabase.storage.from(QUARANTINE_FILES_BUCKET).getPublicUrl(filePath);
    const publicUrl = pub?.publicUrl || '';
    if (!publicUrl) throw new Error('Dosya adresi alınamadı.');

    const { error: hErr } = await supabase
        .from('quarantine_history')
        .update({ deviation_approval_url: publicUrl })
        .eq('id', historyEntryId);
    if (hErr) throw new Error(hErr.message);

    return publicUrl;
}

const STATUS_BY_DECISION = {
    'Serbest Bırak': 'Serbest Bırakıldı',
    'Sapma Onayı': 'Sapma Onaylı',
    'Yeniden İşlem': 'Yeniden İşlem',
    Hurda: 'Hurda',
    İade: 'İade',
    'Onay Bekliyor': 'Onay Bekliyor',
};

export function statusForQuarantineDecision(decision, remainingQuantity) {
    if (remainingQuantity > 0) return 'Karantinada';
    return STATUS_BY_DECISION[decision] || 'Tamamlandı';
}

/**
 * Hurda dışı yeni karar öncesi: tutanaksız bekleyen hurda satırlarını siler, işlenen miktarı kayda geri ekler.
 */
export async function reconcilePendingHurdaBeforeNewDecision(quarantineRecordId) {
    if (!quarantineRecordId) return { restoredQty: 0, removedCount: 0 };

    const { data: pending, error: pendingErr } = await supabase
        .from('quarantine_history')
        .select('id, processed_quantity')
        .eq('quarantine_record_id', quarantineRecordId)
        .eq('decision', HURDA_DECISION)
        .is('deviation_approval_url', null)
        .is('quality_cost_id', null);

    if (pendingErr) throw pendingErr;
    if (!pending?.length) return { restoredQty: 0, removedCount: 0 };

    const restoredQty = pending.reduce((sum, row) => sum + (Number(row.processed_quantity) || 0), 0);
    const ids = pending.map((row) => row.id);

    const { error: delErr } = await supabase.from('quarantine_history').delete().in('id', ids);
    if (delErr) throw delErr;

    const { data: rec, error: recErr } = await supabase
        .from('quarantine_records')
        .select('quantity, status')
        .eq('id', quarantineRecordId)
        .single();
    if (recErr) throw recErr;

    const newQty = (Number(rec.quantity) || 0) + restoredQty;
    const patch = { quantity: newQty };
    if (rec.status === 'Hurda' && newQty > 0) {
        patch.status = 'Karantinada';
        patch.decision = null;
        patch.decision_date = null;
    }

    const { error: updErr } = await supabase.from('quarantine_records').update(patch).eq('id', quarantineRecordId);
    if (updErr) throw updErr;

    return { restoredQty, removedCount: ids.length };
}

export async function syncQuarantineRecordFromLatestHistory(quarantineRecordId) {
    const { data: record, error: recErr } = await supabase
        .from('quarantine_records')
        .select('id, quantity')
        .eq('id', quarantineRecordId)
        .single();
    if (recErr) throw recErr;

    const { data: latest, error: histErr } = await supabase
        .from('quarantine_history')
        .select('decision, decision_date')
        .eq('quarantine_record_id', quarantineRecordId)
        .order('decision_date', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (histErr) throw histErr;

    const remaining = Number(record.quantity) || 0;
    const decision = latest?.decision ?? null;
    const status = decision
        ? statusForQuarantineDecision(decision, remaining)
        : (remaining > 0 ? 'Karantinada' : 'Tamamlandı');

    const { error: updErr } = await supabase
        .from('quarantine_records')
        .update({
            status,
            decision,
            decision_date: latest?.decision_date ?? null,
        })
        .eq('id', quarantineRecordId);
    if (updErr) throw updErr;
}

export async function saveQuarantineHistoryEntry({ id, quarantine_record_id, decision, processed_quantity, notes, decision_date }) {
    const normalizedDecision = normalizeQuarantineDecision(decision);
    const payload = {
        quarantine_record_id,
        decision: normalizedDecision,
        processed_quantity: Number(processed_quantity) || 0,
        notes: notes ?? null,
        decision_date: decision_date
            ? new Date(decision_date).toISOString()
            : new Date().toISOString(),
    };

    if (id) {
        const { data: existing, error: fetchErr } = await supabase
            .from('quarantine_history')
            .select('quarantine_record_id, decision')
            .eq('id', id)
            .single();
        if (fetchErr) throw fetchErr;

        if (!isHurdaDecision(normalizedDecision) && isHurdaDecision(existing.decision)) {
            payload.deviation_approval_url = null;
            payload.quality_cost_id = null;
        }

        const { error } = await supabase.from('quarantine_history').update(payload).eq('id', id);
        if (error) throw error;

        await syncQuarantineRecordFromLatestHistory(existing.quarantine_record_id);
        return existing.quarantine_record_id;
    }

    const { error } = await supabase.from('quarantine_history').insert(payload);
    if (error) throw error;
    await syncQuarantineRecordFromLatestHistory(quarantine_record_id);
    return quarantine_record_id;
}
