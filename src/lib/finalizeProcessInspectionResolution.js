import { supabase } from '@/lib/customSupabaseClient';
import {
    RESOLUTION_STATUS,
} from '@/components/process-control/processInspectionResolution';

/**
 * Proses muayene kaydının (ret kaydı) çözümünü; bir dış modül kaydıyla (sapma, hurda maliyeti, vs.)
 * otomatik "Çözüldü" olarak işaretler ve audit kaydı oluşturur.
 *
 * @param {Object} params
 * @param {string} params.inspectionId - process_inspections.id
 * @param {string} params.resolutionType - 'Sapma ile Kabul' | 'Hurda' | 'Tedarikçiye İade' vb.
 * @param {string} [params.linkedRecordNo] - sapma numarası / maliyet kaydı no / NC no
 * @param {string} [params.linkedRecordLabel] - "Sapma", "Hurda Maliyeti" vb.
 * @param {string} [params.notes]
 * @param {string} [params.actionedByUserId]
 * @param {string} [params.actionedByName]
 * @returns {Promise<boolean>} - başarılı olup olmadığı
 */
export async function finalizeProcessInspectionResolution({
    inspectionId,
    resolutionType,
    linkedRecordNo,
    linkedRecordLabel = 'Bağlı Kayıt',
    notes,
    actionedByUserId = null,
    actionedByName = null,
}) {
    if (!inspectionId) return false;

    const nowIso = new Date().toISOString();
    const composedNotes = [
        linkedRecordNo ? `${linkedRecordLabel} No: ${linkedRecordNo}` : null,
        notes || null,
    ]
        .filter(Boolean)
        .join(' — ');

    try {
        const { error: updateError } = await supabase
            .from('process_inspections')
            .update({
                resolution_status: RESOLUTION_STATUS.RESOLVED,
                resolution_type: resolutionType || null,
                resolution_notes: composedNotes || null,
                resolution_date: nowIso,
                resolved_by_name: actionedByName || null,
                resolved_at: nowIso,
                updated_at: nowIso,
                updated_by: actionedByUserId || null,
            })
            .eq('id', inspectionId);

        if (updateError) throw updateError;

        try {
            await supabase.from('process_inspection_resolutions').insert([
                {
                    inspection_id: inspectionId,
                    event_type: 'resolved',
                    resolution_status: RESOLUTION_STATUS.RESOLVED,
                    resolution_type: resolutionType || null,
                    resolution_notes: composedNotes || null,
                    actioned_by_name: actionedByName || null,
                    actioned_at: nowIso,
                    created_by: actionedByUserId || null,
                },
            ]);
        } catch (historyError) {
            console.error('Çözüm geçmişi yazılamadı:', historyError);
        }

        return true;
    } catch (err) {
        console.error('Proses muayene çözümü finalize edilemedi:', err);
        return false;
    }
}

/**
 * Çözümü 'Çözümleniyor' aşamasına al (örn. kullanıcı sapma/hurda butonuna bastığında
 * dış modüle gitmeden önce ara bir durum).
 */
export async function startProcessInspectionResolution({
    inspectionId,
    resolutionType,
    actionedByUserId = null,
    actionedByName = null,
}) {
    if (!inspectionId) return false;

    const nowIso = new Date().toISOString();

    try {
        const { error: updateError } = await supabase
            .from('process_inspections')
            .update({
                resolution_status: RESOLUTION_STATUS.IN_PROGRESS,
                resolution_type: resolutionType || null,
                updated_at: nowIso,
                updated_by: actionedByUserId || null,
            })
            .eq('id', inspectionId);

        if (updateError) throw updateError;

        try {
            await supabase.from('process_inspection_resolutions').insert([
                {
                    inspection_id: inspectionId,
                    event_type: 'started',
                    resolution_status: RESOLUTION_STATUS.IN_PROGRESS,
                    resolution_type: resolutionType || null,
                    resolution_notes: 'İlgili modülde kayıt oluşturma işlemi başlatıldı.',
                    actioned_by_name: actionedByName || null,
                    actioned_at: nowIso,
                    created_by: actionedByUserId || null,
                },
            ]);
        } catch (historyError) {
            console.error('Çözüm geçmişi yazılamadı:', historyError);
        }

        return true;
    } catch (err) {
        console.error('Proses muayene çözüm başlatma hatası:', err);
        return false;
    }
}
