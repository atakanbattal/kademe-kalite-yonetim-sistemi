import { sanitizeFileName } from '@/lib/utils';

const getMimeTypeFromFileName = (fileName) => {
    if (!fileName) return 'application/octet-stream';
    const extension = fileName.split('.').pop()?.toLowerCase();
    const mimeTypes = {
        pdf: 'application/pdf',
        doc: 'application/msword',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        xls: 'application/vnd.ms-excel',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        webp: 'image/webp',
    };
    return mimeTypes[extension] || 'application/octet-stream';
};

/**
 * Girdi kalite muayenesinde yüklenen ek dosyaları, aynı parça koduna sahip INKR kaydına kopyalar.
 * Böylece kullanıcı dosyayı iki bucket'a / iki forma tekrar yüklemez.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ inkrReportId: string, files: { file: File, file_name: string }[] }} params
 * @returns {Promise<{ errors: string[] }>}
 */
export async function copyIncomingInspectionFilesToInkr(supabase, { inkrReportId, files }) {
    const errors = [];
    if (!inkrReportId || !files?.length) return { errors };

    for (const { file, file_name } of files) {
        const name = file_name || file?.name || 'dosya';
        const sanitized = sanitizeFileName(name);
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 9);
        const destPath = `${inkrReportId}/${timestamp}-${randomStr}-${sanitized}`;
        const contentType = file?.type || getMimeTypeFromFileName(name);

        try {
            const arrayBuffer = await file.arrayBuffer();
            const { error: uploadError } = await supabase.storage
                .from('inkr_attachments')
                .upload(destPath, arrayBuffer, { contentType, upsert: false });

            if (uploadError) {
                errors.push(`${name}: ${uploadError.message}`);
                continue;
            }

            const { error: dbError } = await supabase.from('inkr_attachments').insert({
                inkr_report_id: inkrReportId,
                file_path: destPath,
                file_name: name,
                file_type: contentType,
                file_size: file.size ?? null,
            });

            if (dbError) {
                errors.push(`${name}: ${dbError.message}`);
            }
        } catch (e) {
            errors.push(`${name}: ${e?.message || String(e)}`);
        }
    }

    return { errors };
}
