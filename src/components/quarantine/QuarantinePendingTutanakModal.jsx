import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ModernModalLayout, ModalSectionHeader, ModalField } from '@/components/shared/ModernModalLayout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { openPrintableReport } from '@/lib/reportUtils';
import {
    fetchPendingHurdaHistoryEntries,
    uploadPendingHurdaTutanakPdf,
} from '@/lib/quarantineHurdaPending';
import { FileText, FileWarning, Package, Printer, Upload, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const QuarantinePendingTutanakModal = ({ isOpen, setIsOpen, record, onCompleted }) => {
    const { toast } = useToast();
    const fileInputRef = useRef(null);
    const [pendingEntries, setPendingEntries] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedEntryId, setSelectedEntryId] = useState('');
    const [uploading, setUploading] = useState(false);
    const [selectedFileName, setSelectedFileName] = useState('');

    const selectedEntry = pendingEntries.find((entry) => entry.id === selectedEntryId) || null;

    const loadPendingEntries = useCallback(async () => {
        if (!record?.id) {
            setPendingEntries([]);
            setSelectedEntryId('');
            return;
        }
        setLoading(true);
        try {
            const entries = await fetchPendingHurdaHistoryEntries(record.id);
            setPendingEntries(entries);
            setSelectedEntryId(entries[0]?.id || '');
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Yüklenemedi',
                description: error?.message || 'Bekleyen hurda işlemleri alınamadı.',
            });
            setPendingEntries([]);
            setSelectedEntryId('');
        } finally {
            setLoading(false);
        }
    }, [record?.id, toast]);

    useEffect(() => {
        if (!isOpen) {
            setSelectedFileName('');
            return;
        }
        loadPendingEntries();
    }, [isOpen, loadPendingEntries]);

    const handlePrintPreview = () => {
        if (!record?.id || !selectedEntry) return;
        openPrintableReport(
            {
                ...record,
                quarantine_certificate_decision: 'Hurda',
                quarantine_certificate_quantity: selectedEntry.processed_quantity,
                quarantine_certificate_notes: selectedEntry.notes || '',
            },
            'quarantine_decision_certificate',
            true
        );
    };

    const handleUpload = async (file) => {
        if (!file || !record?.id || !selectedEntryId) return;

        setUploading(true);
        try {
            await uploadPendingHurdaTutanakPdf({
                recordId: record.id,
                historyEntryId: selectedEntryId,
                file,
            });
            toast({
                title: 'Tutanak yüklendi',
                description: 'İmzalı hurda tutanağı kayda bağlandı.',
            });
            setSelectedFileName('');
            if (fileInputRef.current) fileInputRef.current.value = '';
            onCompleted?.();
            setIsOpen(false);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Yükleme başarısız',
                description: error?.message || 'PDF kaydedilemedi.',
            });
        } finally {
            setUploading(false);
        }
    };

    const handleFileChange = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setSelectedFileName(file.name);
        handleUpload(file);
    };

    if (!record) return null;

    const rightPanel = (
        <div className="px-5 space-y-4">
            <div className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 rounded-xl p-4 border border-amber-300/40 relative overflow-hidden">
                <div className="absolute -right-3 -bottom-3 opacity-[0.06] pointer-events-none">
                    <Package className="w-20 h-20" />
                </div>
                <div className="flex items-center gap-2 mb-2">
                    <FileWarning className="h-4 w-4 text-amber-600" />
                    <p className="text-[10px] font-medium text-amber-700 uppercase tracking-widest">Bekleyen tutanak</p>
                </div>
                <p className="text-sm font-bold text-foreground leading-tight line-clamp-2">{record.part_name || '—'}</p>
                {record.part_code && <p className="text-xs text-muted-foreground mt-1 font-mono">{record.part_code}</p>}
            </div>

            {selectedEntry && (
                <>
                    <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-800">
                        Hurda · {selectedEntry.processed_quantity} {record.unit || 'Adet'}
                    </Badge>
                    <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">İşlem tarihi</p>
                        <p className="text-xs font-semibold">
                            {new Date(selectedEntry.decision_date).toLocaleString('tr-TR')}
                        </p>
                    </div>
                    {selectedEntry.notes ? (
                        <div>
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Notlar</p>
                            <p className="text-[11px] text-foreground leading-relaxed bg-muted/30 rounded-lg p-2.5 border whitespace-pre-wrap">
                                {selectedEntry.notes}
                            </p>
                        </div>
                    ) : null}
                </>
            )}

            <div className="rounded-lg border border-dashed border-amber-300/70 bg-amber-50/50 dark:bg-amber-950/10 p-3 text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                Yalnızca imzalı hurda tutanağı PDF dosyası yükleyin. Yükleme sonrası kayıt listeden «Tutanak bekliyor» uyarısından düşer.
            </div>
        </div>
    );

    return (
        <ModernModalLayout
            open={isOpen}
            onOpenChange={setIsOpen}
            title="Hurda Tutanağı Yükle"
            subtitle="Karantina Yönetimi"
            icon={<Upload className="h-5 w-5 text-white" />}
            badge="Tutanak"
            rightPanel={rightPanel}
            footerExtra={
                <Button
                    type="button"
                    variant="outline"
                    className="mr-1"
                    disabled={!selectedEntry}
                    onClick={handlePrintPreview}
                >
                    <Printer className="h-4 w-4 mr-2" />
                    Tutanağı önizle
                </Button>
            }
            onCancel={() => setIsOpen(false)}
            onSubmit={() => fileInputRef.current?.click()}
            isSubmitting={uploading}
            submitLabel={uploading ? 'Yükleniyor…' : 'PDF seç ve yükle'}
            cancelLabel="İptal"
        >
            <div className="p-6 space-y-6">
                {loading ? (
                    <p className="text-sm text-muted-foreground">Bekleyen işlemler yükleniyor…</p>
                ) : pendingEntries.length === 0 ? (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 p-4 flex items-start gap-3">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Tutanak beklenmiyor</p>
                            <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                                Bu kayıt için yüklenecek hurda tutanağı bulunmuyor.
                            </p>
                        </div>
                    </div>
                ) : (
                    <>
                        <p className="text-sm text-muted-foreground">
                            Hurda kararı verilmiş ancak imzalı tutanağı henüz yüklenmemiş. PDF dosyasını seçerek işlemi tamamlayın.
                        </p>

                        {pendingEntries.length > 1 && (
                            <div>
                                <ModalSectionHeader>Hangi işlem için?</ModalSectionHeader>
                                <ModalField label="Bekleyen hurda işlemi">
                                    <Select value={selectedEntryId} onValueChange={setSelectedEntryId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="İşlem seçin…" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {pendingEntries.map((entry) => (
                                                <SelectItem key={entry.id} value={entry.id}>
                                                    {new Date(entry.decision_date).toLocaleDateString('tr-TR')} ·{' '}
                                                    {entry.processed_quantity} {record.unit || 'Adet'}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </ModalField>
                            </div>
                        )}

                        <div>
                            <ModalSectionHeader>İmzalı tutanak (PDF)</ModalSectionHeader>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="application/pdf,.pdf"
                                className="hidden"
                                onChange={handleFileChange}
                            />
                            <div className="rounded-xl border-2 border-dashed border-amber-300/80 bg-amber-50/40 dark:bg-amber-950/10 p-6 text-center space-y-3">
                                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
                                    <FileText className="h-6 w-6 text-amber-700 dark:text-amber-300" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-foreground">İmzalı hurda tutanağını yükleyin</p>
                                    <p className="text-xs text-muted-foreground mt-1">Yalnızca PDF · tek dosya</p>
                                </div>
                                <Button
                                    type="button"
                                    variant="default"
                                    className="bg-amber-600 hover:bg-amber-700"
                                    disabled={uploading || !selectedEntryId}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <Upload className="h-4 w-4 mr-2" />
                                    {uploading ? 'Yükleniyor…' : 'PDF dosyası seç'}
                                </Button>
                                {selectedFileName && !uploading && (
                                    <p className="text-xs text-muted-foreground">Seçilen: {selectedFileName}</p>
                                )}
                            </div>
                        </div>

                        {selectedEntry && (
                            <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm space-y-1">
                                <Label className="text-xs text-muted-foreground">Seçili işlem özeti</Label>
                                <p className="font-medium">
                                    Hurda · {selectedEntry.processed_quantity} {record.unit || 'Adet'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {new Date(selectedEntry.decision_date).toLocaleString('tr-TR')}
                                </p>
                            </div>
                        )}
                    </>
                )}
            </div>
        </ModernModalLayout>
    );
};

export default QuarantinePendingTutanakModal;
