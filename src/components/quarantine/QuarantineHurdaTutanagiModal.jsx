import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ModernModalLayout, ModalSectionHeader, ModalField } from '@/components/shared/ModernModalLayout';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { v4 as uuidv4 } from 'uuid';
import { sanitizeFileName } from '@/lib/utils';
import { finalizeQuarantineFromQualityCost } from '@/lib/quarantineQualityCostFinalize';
import { normalizeQuarantineAttachments } from '@/lib/quarantineAttachments';
import { openPrintableReport } from '@/lib/reportUtils';
import { FileText, Package, Printer, Upload, CalendarDays, Clock, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const QUARANTINE_FILES_BUCKET = 'quarantine_documents';
const RECORD_ATTACHMENTS_PREFIX = 'record_attachments';

const QuarantineHurdaTutanagiModal = ({
    isOpen,
    setIsOpen,
    record,
    processedQuantity,
    decisionNotes,
    onCompleted,
}) => {
    const { toast } = useToast();
    const [pdfFile, setPdfFile] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadMode, setUploadMode] = useState('now'); // 'now' | 'later'
    const inputRef = useRef(null);

    useEffect(() => {
        if (!isOpen) {
            setPdfFile(null);
            setUploadMode('now');
        }
    }, [isOpen]);

    const handlePick = useCallback(
        (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const ok = f.type === 'application/pdf' || /\.pdf$/i.test(f.name || '');
            if (!ok) {
                toast({ variant: 'destructive', title: 'Geçersiz dosya', description: 'Yalnızca PDF yükleyebilirsiniz.' });
                return;
            }
            setPdfFile(f);
        },
        [toast]
    );

    /** Hurda karar tutanağı önizlemesi — 'quarantine_decision_certificate' tipiyle Hurda ifadesi gösterilir */
    const handlePrintPreview = useCallback(() => {
        if (!record?.id) return;
        openPrintableReport(
            {
                ...record,
                quarantine_certificate_decision: 'Hurda',
                quarantine_certificate_quantity: processedQuantity,
                quarantine_certificate_notes: decisionNotes || '',
            },
            'quarantine_decision_certificate',
            true
        );
    }, [record, processedQuantity, decisionNotes]);

    /** Tutanağı şimdi yükle (tam akış) */
    const handleSubmitNow = async () => {
        if (!record?.id) return;
        if (!pdfFile) {
            toast({ variant: 'destructive', title: 'PDF gerekli', description: 'İmzalı hurda tutanağını PDF olarak yükleyin.' });
            return;
        }

        setIsSubmitting(true);
        try {
            const safeName = sanitizeFileName(pdfFile.name || 'hurda-tutanagi.pdf');
            const filePath = `${RECORD_ATTACHMENTS_PREFIX}/${record.id}/hurda-${uuidv4()}-${safeName}`;
            const { error: upErr } = await supabase.storage
                .from(QUARANTINE_FILES_BUCKET)
                .upload(filePath, pdfFile, { contentType: pdfFile.type || 'application/pdf', upsert: false });
            if (upErr) throw new Error(upErr.message);

            const { data: pub } = supabase.storage.from(QUARANTINE_FILES_BUCKET).getPublicUrl(filePath);
            const publicUrl = pub?.publicUrl || '';
            if (!publicUrl) throw new Error('Dosya adresi alınamadı.');

            const prev = normalizeQuarantineAttachments(record.attachments);
            const newAtt = {
                name: pdfFile.name || 'hurda-tutanagi.pdf',
                path: filePath,
                mime_type: pdfFile.type || 'application/pdf',
                public_url: publicUrl,
            };
            const { error: attErr } = await supabase
                .from('quarantine_records')
                .update({ attachments: [...prev, newAtt] })
                .eq('id', record.id);
            if (attErr) throw new Error(attErr.message);

            await finalizeQuarantineFromQualityCost({
                quarantineRecordId: record.id,
                quantity: processedQuantity,
                decision: 'Hurda',
                notes: decisionNotes || '',
                qualityCostId: null,
                hurdaDocumentUrl: publicUrl,
            });

            toast({ title: 'Tamamlandı', description: 'Hurda tutanağı kaydedildi ve karantina güncellendi.' });
            setIsOpen(false);
            onCompleted?.();
        } catch (err) {
            toast({ variant: 'destructive', title: 'İşlem başarısız', description: err?.message || 'Kayıt tamamlanamadı.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    /** Tutanağı sonra yükle — kararı DB'ye yaz, PDF olmadan */
    const handleDeferUpload = async () => {
        if (!record?.id) return;
        setIsSubmitting(true);
        try {
            await finalizeQuarantineFromQualityCost({
                quarantineRecordId: record.id,
                quantity: processedQuantity,
                decision: 'Hurda',
                notes: decisionNotes || '',
                qualityCostId: null,
                hurdaDocumentUrl: null,
            });

            toast({
                title: 'Hurda kararı kaydedildi',
                description: 'İmzalı tutanağı daha sonra kaydın "Geçmiş" sekmesinden yükleyebilirsiniz.',
            });
            setIsOpen(false);
            onCompleted?.();
        } catch (err) {
            toast({ variant: 'destructive', title: 'İşlem başarısız', description: err?.message || 'Karar kaydedilemedi.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!record) return null;

    const rightPanel = (
        <div className="px-5 space-y-4">
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-4 border border-primary/20 relative overflow-hidden">
                <div className="absolute -right-3 -bottom-3 opacity-[0.06] pointer-events-none">
                    <Package className="w-20 h-20" />
                </div>
                <div className="flex items-center gap-2 mb-2">
                    <Package className="h-4 w-4 text-primary" />
                    <p className="text-[10px] font-medium text-primary uppercase tracking-widest">Özet</p>
                </div>
                <p className="text-sm font-bold text-foreground leading-tight line-clamp-2">{record.part_name || '—'}</p>
                {record.part_code && <p className="text-xs text-muted-foreground mt-1 font-mono">{record.part_code}</p>}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-[10px]">{record.status || 'Karantinada'}</Badge>
                <Badge className="text-[10px] bg-red-100 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-200">
                    Hurda · {processedQuantity} {record.unit || 'Adet'}
                </Badge>
            </div>

            <Separator />

            <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Lot / seri</p>
                <p className="text-xs font-semibold">{record.lot_no || '—'}</p>
            </div>

            <div className="flex items-start gap-2.5">
                <CalendarDays className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Karantina tarihi</p>
                    <p className="text-xs font-semibold text-foreground">
                        {record.quarantine_date
                            ? new Date(record.quarantine_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
                            : '—'}
                    </p>
                </div>
            </div>

            {decisionNotes ? (
                <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Karar notları</p>
                    <p className="text-[11px] text-foreground leading-relaxed whitespace-pre-wrap bg-muted/30 rounded-lg p-2.5 border">
                        {decisionNotes}
                    </p>
                </div>
            ) : null}

            <Separator />

            {/* Upload mode seçimi */}
            <div className="space-y-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Tutanak yükleme</p>
                <button
                    type="button"
                    onClick={() => setUploadMode('now')}
                    className={`w-full flex items-start gap-2.5 rounded-lg border p-2.5 text-left transition-colors ${
                        uploadMode === 'now'
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-border hover:bg-muted/30 text-foreground'
                    }`}
                >
                    <Upload className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-xs font-semibold">Şimdi yükle</p>
                        <p className="text-[10px] text-muted-foreground">PDF seç, karar ve tutanak birlikte kaydedilir.</p>
                    </div>
                </button>
                <button
                    type="button"
                    onClick={() => setUploadMode('later')}
                    className={`w-full flex items-start gap-2.5 rounded-lg border p-2.5 text-left transition-colors ${
                        uploadMode === 'later'
                            ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300'
                            : 'border-border hover:bg-muted/30 text-foreground'
                    }`}
                >
                    <Clock className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-xs font-semibold">Sonra yükle</p>
                        <p className="text-[10px] text-muted-foreground">Karar şimdi kaydedilir, tutanağı sonra ekleyebilirsiniz.</p>
                    </div>
                </button>
            </div>
        </div>
    );

    return (
        <ModernModalLayout
            open={isOpen}
            onOpenChange={setIsOpen}
            title="Hurda Tutanağı"
            subtitle="Karantina Yönetimi"
            icon={<FileText className="h-5 w-5 text-white" />}
            badge="Hurda Kararı"
            rightPanel={rightPanel}
            footerExtra={
                <Button type="button" variant="outline" className="mr-1" onClick={handlePrintPreview}>
                    <Printer className="h-4 w-4 mr-2" />
                    Hurda tutanağını önizle
                </Button>
            }
            onCancel={() => setIsOpen(false)}
            onSubmit={uploadMode === 'now' ? handleSubmitNow : handleDeferUpload}
            isSubmitting={isSubmitting}
            submitLabel={
                isSubmitting
                    ? 'Kaydediliyor...'
                    : uploadMode === 'now'
                    ? 'PDF yükle ve tamamla'
                    : 'Kararı kaydet, tutanağı sonra yükle'
            }
            cancelLabel="İptal"
        >
            <div className="p-6 space-y-6">
                <p className="text-sm text-muted-foreground">
                    Hurda kararını kaydetmek için önce tutanağı önizleyebilir, imzaladıktan sonra PDF olarak yükleyebilirsiniz.
                    Tutanağı şimdi yüklemek zorunda değilsiniz — kararı kaydedip tutanağı daha sonra kaydın geçmiş sekmesinden ekleyebilirsiniz.
                </p>

                {uploadMode === 'now' ? (
                    <div>
                        <ModalSectionHeader>İmzalı tutanak yükle</ModalSectionHeader>
                        <ModalField label="Hurda tutanağı (PDF)" required>
                            <input
                                ref={inputRef}
                                type="file"
                                accept="application/pdf,.pdf"
                                className="hidden"
                                onChange={handlePick}
                            />
                            <Button
                                type="button"
                                variant="secondary"
                                className="w-full justify-start"
                                onClick={() => inputRef.current?.click()}
                            >
                                <Upload className="h-4 w-4 mr-2 shrink-0" />
                                {pdfFile ? pdfFile.name : 'PDF dosyası seçin…'}
                            </Button>
                            {pdfFile && (
                                <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                                    <CheckCircle2 className="h-3 w-3" />
                                    Dosya seçildi: {pdfFile.name}
                                </p>
                            )}
                        </ModalField>
                    </div>
                ) : (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4 space-y-2">
                        <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Tutanak daha sonra eklenecek</p>
                        </div>
                        <p className="text-xs text-amber-700 dark:text-amber-400">
                            Hurda kararı veritabanına kaydedilecek, ancak imzalı PDF şimdi istenmeyecek.
                            Tutanağı kaydı görüntüleyerek <strong>İşlem Geçmişi</strong> sekmesinden yükleyebilirsiniz.
                        </p>
                    </div>
                )}
            </div>
        </ModernModalLayout>
    );
};

export default QuarantineHurdaTutanagiModal;
