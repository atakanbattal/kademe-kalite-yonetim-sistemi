import { supabase } from '@/lib/customSupabaseClient';

/**
 * İmzalı onay PDF’i yükler ve benchmark kaydını onaylar (detay / liste ortak).
 */
export async function approveBenchmarkWithSignedPdf({ benchmarkId, file, approverId }) {
    if (!file || file.type !== 'application/pdf') {
        throw new Error('Yalnızca PDF dosyası yüklenebilir.');
    }
    if (!approverId) {
        throw new Error('Onaylayan personel bulunamadı.');
    }

    const safeName = `${Date.now()}-${file.name.replace(/[^\w.\-]/g, '_')}`;
    const filePath = `${benchmarkId}/${safeName}`;
    const storagePath = `benchmark-documents/${filePath}`;

    const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(storagePath, file, { contentType: 'application/pdf', upsert: true });

    if (uploadError) throw uploadError;

    const { error: updateError } = await supabase
        .from('benchmarks')
        .update({
            approval_status: 'Onaylandı',
            approved_by: approverId,
            approval_date: new Date().toISOString(),
            approval_signed_pdf_path: storagePath,
            approval_signed_pdf_name: file.name,
        })
        .eq('id', benchmarkId);

    if (updateError) throw updateError;
}
