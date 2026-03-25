import { supabase } from '@/lib/customSupabaseClient';
import { sanitizeFileName } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';

const CATEGORY_TO_TRAINING_CATEGORY = {
    yasal_mevzuat: 'Kalite',
    standartlar: 'Kalite',
    musteri_dokumanlari: 'Kalite',
    tedarikci_kataloglari: 'Teknik',
};

function customerLabel(c) {
    if (!c) return '';
    return c.name || c.customer_name || c.customer_code || '';
}

function sourceSummaryLine(snapshot) {
    switch (snapshot.category) {
        case 'yasal_mevzuat':
            return [snapshot.reference_code, snapshot.source_publisher].filter(Boolean).join(' · ') || '—';
        case 'standartlar':
            if (snapshot.audit_standard) {
                return [snapshot.audit_standard.code, snapshot.audit_standard.name].filter(Boolean).join(' — ');
            }
            return snapshot.standard_title || '—';
        case 'musteri_dokumanlari':
            return customerLabel(snapshot.customer) || '—';
        case 'tedarikci_kataloglari':
            return snapshot.supplier?.name || '—';
        default:
            return '—';
    }
}

function categoryLabelTr(cat) {
    const map = {
        yasal_mevzuat: 'Yasal mevzuat',
        standartlar: 'Standart',
        musteri_dokumanlari: 'Müşteri dokümanı',
        tedarikci_kataloglari: 'Tedarikçi kataloğu',
    };
    return map[cat] || cat;
}

/**
 * Eğitim planı oluşturur, dosyayı training_documents bucket'ına kopyalar,
 * training_documents satırı ekler ve external_documents.training_id günceller.
 */
export async function createTrainingPlanFromExternalDocument({
    externalDocumentId,
    snapshot,
    filePath,
    fileName,
    mimeType,
}) {
    if (!externalDocumentId || !filePath) {
        throw new Error('Dış doküman kimliği veya dosya yolu eksik');
    }

    const refDateStr =
        snapshot.received_at && String(snapshot.received_at).slice(0, 10) ||
        new Date().toISOString().slice(0, 10);
    const { data: codeData, error: codeError } = await supabase.rpc('preview_training_code', {
        p_plan_date: refDateStr,
    });
    if (codeError) throw codeError;

    const startDate = snapshot.received_at || new Date().toISOString().slice(0, 10);
    const endDate = snapshot.valid_until || null;

    const descriptionParts = [];
    if (snapshot.description) descriptionParts.push(snapshot.description);
    descriptionParts.push(
        `Bu kayıt «Dış Kaynaklı Doküman Yönetimi» modülünden otomatik oluşturulmuştur.\nKategori: ${categoryLabelTr(snapshot.category)}\nKaynak özeti: ${sourceSummaryLine(snapshot)}`
    );

    const objectives = [
        'İlgili dış kaynaklı dokümanın içeriğinin ilgili personele aktarılması ve uygulanabilirliğinin sağlanması.',
        `Doküman: ${snapshot.title}`,
        `Kaynak bilgisi: ${sourceSummaryLine(snapshot)}`,
    ].join('\n');

    const trainingPayload = {
        title: `[Dış kaynak] ${snapshot.title}`,
        description: descriptionParts.join('\n\n'),
        category: CATEGORY_TO_TRAINING_CATEGORY[snapshot.category] || 'Kalite',
        training_type: 'İç',
        start_date: startDate,
        end_date: endDate,
        status: 'Planlandı',
        objectives,
        target_audience: 'İlgili birim personeli',
        prerequisites: snapshot.reference_code ? `Referans: ${snapshot.reference_code}` : null,
        duration_hours: 2,
        capacity: 0,
        training_code: codeData,
    };

    const { data: training, error: trainingError } = await supabase
        .from('trainings')
        .insert(trainingPayload)
        .select()
        .single();

    if (trainingError) throw trainingError;

    const { data: trainingFresh } = await supabase.from('trainings').select('*').eq('id', training.id).maybeSingle();
    const trainingRow = trainingFresh || training;

    const { data: fileBlob, error: downloadError } = await supabase.storage.from('documents').download(filePath);
    if (downloadError) throw downloadError;

    const safeName = sanitizeFileName(fileName || snapshot.title || 'belge');
    const destPath = `${trainingRow.id}/${uuidv4()}-${safeName}`;

    const { error: uploadError } = await supabase.storage.from('training_documents').upload(destPath, fileBlob, {
        contentType: mimeType || 'application/octet-stream',
        upsert: false,
    });
    if (uploadError) throw uploadError;

    const { error: tdError } = await supabase.from('training_documents').insert({
        training_id: trainingRow.id,
        file_name: fileName || safeName,
        file_path: destPath,
        file_type: mimeType || null,
    });
    if (tdError) throw tdError;

    const { error: linkError } = await supabase
        .from('external_documents')
        .update({ training_id: trainingRow.id, training_required: true })
        .eq('id', externalDocumentId);

    if (linkError) throw linkError;

    return trainingRow;
}
