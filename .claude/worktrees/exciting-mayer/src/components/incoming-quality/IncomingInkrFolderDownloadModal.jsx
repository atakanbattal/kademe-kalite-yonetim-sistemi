import React, { useEffect, useMemo, useState } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { supabase } from '@/lib/customSupabaseClient';
import { useData } from '@/contexts/DataContext';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import { Download, Loader2 } from 'lucide-react';
import {
    createPrintableReportPdfBuffer,
    getStorageFileName,
    runInBatches,
    sanitizeArchiveName,
} from '@/lib/qualityFolderDownloadUtils';

const MAX_CONCURRENT = 8;

const formatDateValue = (value) => {
    if (!value) return '-';

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return String(value);
    }

    return format(parsed, 'dd.MM.yyyy', { locale: tr });
};

const getPartFolderName = (record) =>
    sanitizeArchiveName(`${record.part_code || 'Parca'}_${record.part_name || 'Kayit'}`);

const getFallbackFileName = (report) =>
    sanitizeArchiveName(`INKR_${report.inkr_number || report.part_code || report.id || 'Rapor'}.pdf`);

const getAttachmentArchiveName = (attachment, report, index) =>
    sanitizeArchiveName(
        `INKR_Ek_${report.part_code || 'Parca'}_${index + 1}_${
            attachment.file_name || getStorageFileName(attachment.file_path, `Ek_${index + 1}`)
        }`
    );

const enrichInkrForPrintableReport = (report, { characteristics, measurementEquipment, attachments }) => ({
    ...report,
    revision: report.revision ?? 0,
    inkr_attachments: attachments || [],
    items: (report.items || []).map((item) => ({
        ...item,
        characteristic_name:
            characteristics.find((characteristic) => characteristic.value === item.characteristic_id)?.label ||
            item.characteristic_name ||
            item.characteristic_id ||
            '-',
        equipment_name:
            measurementEquipment.find((equipmentItem) => equipmentItem.value === item.equipment_id)?.label ||
            item.equipment_name ||
            item.equipment_id ||
            '-',
    })),
});

const IncomingInkrFolderDownloadModal = ({ isOpen, setIsOpen, reports = [] }) => {
    const { toast } = useToast();
    const { characteristics = [], equipment: measurementEquipment = [] } = useData();
    const [selectedReportIds, setSelectedReportIds] = useState([]);
    const [isDownloading, setIsDownloading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [downloadStatus, setDownloadStatus] = useState('');

    const sortedReports = useMemo(
        () =>
            [...reports].sort((left, right) => {
                const leftDate = new Date(left.report_date || left.created_at || 0).getTime();
                const rightDate = new Date(right.report_date || right.created_at || 0).getTime();
                return rightDate - leftDate;
            }),
        [reports]
    );

    useEffect(() => {
        if (!isOpen) {
            setSelectedReportIds([]);
            setIsDownloading(false);
            setProgress(0);
            setDownloadStatus('');
        }
    }, [isOpen]);

    const allSelected = sortedReports.length > 0 && selectedReportIds.length === sortedReports.length;

    const handleToggle = (reportId) => {
        setSelectedReportIds((previous) =>
            previous.includes(reportId)
                ? previous.filter((currentId) => currentId !== reportId)
                : [...previous, reportId]
        );
    };

    const handleDownload = async () => {
        const selectedReports = sortedReports.filter((report) => selectedReportIds.includes(report.id));
        if (selectedReports.length === 0) {
            toast({
                variant: 'destructive',
                title: 'Seçim Gerekli',
                description: 'Lütfen indirilecek en az bir INKR kaydı seçin.',
            });
            return;
        }

        setIsDownloading(true);
        setProgress(0);
        setDownloadStatus('Dosyalar hazırlanıyor...');

        try {
            const zip = new JSZip();
            const rootFolderName = 'Girdi_Kontrol_INKR';

            const { data: attachmentRows, error: attachmentError } = await supabase
                .from('inkr_attachments')
                .select('*')
                .in(
                    'inkr_report_id',
                    selectedReports.map((report) => report.id)
                )
                .order('uploaded_at', { ascending: false });

            if (attachmentError) {
                throw attachmentError;
            }

            const attachmentsByReport = {};
            (attachmentRows || []).forEach((attachment) => {
                if (!attachmentsByReport[attachment.inkr_report_id]) {
                    attachmentsByReport[attachment.inkr_report_id] = [];
                }
                attachmentsByReport[attachment.inkr_report_id].push(attachment);
            });

            const jobs = [];

            selectedReports.forEach((report) => {
                const folderName = `${rootFolderName}/${getPartFolderName(report)}`;
                const reportAttachments = attachmentsByReport[report.id] || [];

                if (reportAttachments.length > 0) {
                    reportAttachments.forEach((attachment, index) => {
                        jobs.push({
                            label: `INKR eki indiriliyor: ${report.part_code || '-'}`,
                            run: async () => {
                                const { data, error } = await supabase.storage.from('inkr_attachments').download(attachment.file_path);
                                if (error || !data) {
                                    return null;
                                }

                                return {
                                    path: `${folderName}/${getAttachmentArchiveName(attachment, report, index)}`,
                                    data,
                                };
                            },
                        });
                    });
                } else {
                    jobs.push({
                        label: `INKR PDF hazırlanıyor: ${report.part_code || '-'}`,
                        run: async () => {
                            const printableReport = enrichInkrForPrintableReport(report, {
                                characteristics,
                                measurementEquipment,
                                attachments: [],
                            });

                            return {
                                path: `${folderName}/${getFallbackFileName(report)}`,
                                data: await createPrintableReportPdfBuffer(printableReport, 'inkr_management'),
                            };
                        },
                    });
                }
            });

            let completedCount = 0;
            let successCount = 0;

            await runInBatches(jobs, MAX_CONCURRENT, async (job) => {
                const result = await job.run();
                completedCount += 1;

                if (result?.path && result?.data) {
                    zip.file(result.path, result.data);
                    successCount += 1;
                }

                setProgress(Math.round((completedCount / jobs.length) * 100));
                setDownloadStatus(`${job.label} (${completedCount}/${jobs.length})`);
            });

            if (successCount === 0) {
                toast({
                    variant: 'destructive',
                    title: 'Hata',
                    description: 'Seçili INKR dosyaları indirilemedi.',
                });
                return;
            }

            setDownloadStatus('Zip dosyası oluşturuluyor...');
            const content = await zip.generateAsync({ type: 'blob' });
            saveAs(content, `${rootFolderName}.zip`);

            toast({
                title: 'Başarılı',
                description: `${successCount} INKR dosyası arşivlenerek indirildi.`,
            });
            setIsOpen(false);
        } catch (error) {
            console.error('Girdi kalite INKR klasör indirme hatası:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: `Klasör arşivi oluşturulamadı: ${error.message}`,
            });
        } finally {
            setIsDownloading(false);
            setProgress(0);
            setDownloadStatus('');
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={isDownloading ? undefined : setIsOpen}>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle>INKR Dosyalarını İndir</DialogTitle>
                    <DialogDescription>
                        Seçilen INKR kayıtları tek arşiv içinde parça klasörleri halinde indirilir.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-muted-foreground">INKR Kayıtları</span>
                    <div className="flex items-center gap-2">
                        <Badge variant="secondary">{sortedReports.length}</Badge>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedReportIds(allSelected ? [] : sortedReports.map((report) => report.id))}
                            disabled={isDownloading || sortedReports.length === 0}
                        >
                            {allSelected ? 'Temizle' : 'Tümünü Seç'}
                        </Button>
                    </div>
                </div>

                <ScrollArea className="h-[340px] pr-4 border rounded-md p-4">
                    {sortedReports.length > 0 ? (
                        <div className="space-y-4">
                            {sortedReports.map((report) => (
                                <label key={report.id} className="flex items-start gap-3 cursor-pointer">
                                    <Checkbox
                                        checked={selectedReportIds.includes(report.id)}
                                        onCheckedChange={() => handleToggle(report.id)}
                                        disabled={isDownloading}
                                    />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">{report.part_code || '-'}</span>
                                            <Badge variant="outline">{report.status || 'Rapor'}</Badge>
                                        </div>
                                        <p className="truncate text-sm text-muted-foreground">{report.part_name || 'Parça adı yok'}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {report.inkr_number || '-'} • {formatDateValue(report.report_date || report.created_at)}
                                        </p>
                                    </div>
                                </label>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center text-muted-foreground py-8">İndirilebilecek INKR kaydı bulunmuyor.</div>
                    )}
                </ScrollArea>

                {isDownloading && (
                    <div className="space-y-2 p-3 bg-secondary/40 rounded-md border">
                        <div className="flex justify-between text-sm font-medium gap-3">
                            <span className="truncate">{downloadStatus}</span>
                            <span>{progress}%</span>
                        </div>
                        <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                            <div className="bg-primary h-full transition-all duration-300 ease-out" style={{ width: `${progress}%` }} />
                        </div>
                    </div>
                )}

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isDownloading}>
                        İptal
                    </Button>
                    <Button onClick={handleDownload} disabled={isDownloading || selectedReportIds.length === 0}>
                        {isDownloading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                İndiriliyor...
                            </>
                        ) : (
                            <>
                                <Download className="w-4 h-4 mr-2" />
                                Toplu İndir
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default IncomingInkrFolderDownloadModal;
