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
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import {
    fetchProcessInkrAttachmentsForReports,
    getProcessInkrAttachmentReportId,
    getProcessInkrDisplayNumber,
} from './processInkrUtils';

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

const getPlanFallbackFileName = (plan) =>
    sanitizeArchiveName(`Kontrol_Plani_${plan.part_code || 'Parca'}_Rev_${plan.revision_number ?? 0}.pdf`);

const getReportFallbackFileName = (report) =>
    sanitizeArchiveName(`INKR_${report.part_code || 'Parca'}_${formatDateValue(report.report_date || report.created_at) || 'Rapor'}.pdf`);

const getAttachmentArchiveName = (attachment, report, index) =>
    sanitizeArchiveName(
        `INKR_Ek_${report.part_code || 'Parca'}_${index + 1}_${
            attachment.file_name || getStorageFileName(attachment.file_path, `Ek_${index + 1}`)
        }`
    );

const enrichPlanForPrintableReport = (plan, { characteristics, measurementEquipment, standards }) => ({
    ...plan,
    revision: plan.revision_number ?? 0,
    items: (plan.items || []).map((item) => {
        let standardName = item.standard_name || item.standard_id || '-';
        if (item.standard_class) {
            standardName = item.standard_class;
        } else if (item.standard_id) {
            standardName =
                standards.find((standard) => standard.value === item.standard_id)?.label ||
                item.standard_name ||
                item.standard_id ||
                '-';
        }

        return {
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
            standard_name: standardName,
        };
    }),
});

const enrichReportForPrintableReport = (report, { characteristics, measurementEquipment, attachments }) => ({
    ...report,
    revision: report.revision ?? 0,
    inkr_number: getProcessInkrDisplayNumber(report),
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

const ProcessControlFolderDownloadModal = ({ isOpen, setIsOpen, plans = [], inkrReports = [] }) => {
    const { toast } = useToast();
    const { characteristics = [], equipment: measurementEquipment = [], standards = [] } = useData();
    const [selectedVehicleType, setSelectedVehicleType] = useState('');
    const [selectedPlanIds, setSelectedPlanIds] = useState([]);
    const [selectedReportIds, setSelectedReportIds] = useState([]);
    const [isDownloading, setIsDownloading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [downloadStatus, setDownloadStatus] = useState('');

    const vehicleTypeOptions = useMemo(
        () =>
            Array.from(new Set((plans || []).map((plan) => plan.vehicle_type).filter(Boolean))).sort((left, right) =>
                left.localeCompare(right, 'tr')
            ),
        [plans]
    );

    const filteredPlans = useMemo(
        () => (plans || []).filter((plan) => plan.vehicle_type === selectedVehicleType),
        [plans, selectedVehicleType]
    );

    const filteredReports = useMemo(() => {
        const partCodes = new Set(filteredPlans.map((plan) => plan.part_code).filter(Boolean));
        return (inkrReports || []).filter((report) => report.part_code && partCodes.has(report.part_code));
    }, [filteredPlans, inkrReports]);

    useEffect(() => {
        if (!isOpen) {
            setSelectedVehicleType('');
            setSelectedPlanIds([]);
            setSelectedReportIds([]);
            setIsDownloading(false);
            setProgress(0);
            setDownloadStatus('');
            return;
        }

        if (!selectedVehicleType && vehicleTypeOptions.length > 0) {
            setSelectedVehicleType(vehicleTypeOptions[0]);
        }
    }, [isOpen, selectedVehicleType, vehicleTypeOptions]);

    useEffect(() => {
        if (!isOpen) return;
        setSelectedPlanIds([]);
        setSelectedReportIds([]);
    }, [selectedVehicleType, isOpen]);

    const allPlansSelected = filteredPlans.length > 0 && selectedPlanIds.length === filteredPlans.length;
    const allReportsSelected = filteredReports.length > 0 && selectedReportIds.length === filteredReports.length;

    const togglePlanSelection = (planId) => {
        setSelectedPlanIds((previous) =>
            previous.includes(planId)
                ? previous.filter((currentId) => currentId !== planId)
                : [...previous, planId]
        );
    };

    const toggleReportSelection = (reportId) => {
        setSelectedReportIds((previous) =>
            previous.includes(reportId)
                ? previous.filter((currentId) => currentId !== reportId)
                : [...previous, reportId]
        );
    };

    const handleDownload = async () => {
        if (!selectedVehicleType) {
            toast({
                variant: 'destructive',
                title: 'Araç Tipi Seçin',
                description: 'İndirmeden önce bir araç tipi seçmelisiniz.',
            });
            return;
        }

        const selectedPlans = filteredPlans.filter((plan) => selectedPlanIds.includes(plan.id));
        const selectedReports = filteredReports.filter((report) => selectedReportIds.includes(report.id));

        if (selectedPlans.length === 0 && selectedReports.length === 0) {
            toast({
                variant: 'destructive',
                title: 'Seçim Gerekli',
                description: 'Lütfen indirilecek en az bir kontrol planı veya INKR kaydı seçin.',
            });
            return;
        }

        setIsDownloading(true);
        setProgress(0);
        setDownloadStatus('Dosyalar hazırlanıyor...');

        try {
            const zip = new JSZip();
            const rootFolderName = sanitizeArchiveName(`Proses_Kontrol_${selectedVehicleType}`);
            const attachmentsByReport = {};

            if (selectedReports.length > 0) {
                const attachmentRows = await fetchProcessInkrAttachmentsForReports(
                    supabase,
                    selectedReports.map((report) => report.id)
                );

                (attachmentRows || []).forEach((attachment) => {
                    const reportId = getProcessInkrAttachmentReportId(attachment);
                    if (!reportId) return;

                    if (!attachmentsByReport[reportId]) {
                        attachmentsByReport[reportId] = [];
                    }
                    attachmentsByReport[reportId].push(attachment);
                });
            }

            const jobs = [];

            selectedPlans.forEach((plan) => {
                const folderName = `${rootFolderName}/${getPartFolderName(plan)}`;
                if (plan.file_path) {
                    jobs.push({
                        label: `Kontrol planı indiriliyor: ${plan.part_code || '-'}`,
                        run: async () => {
                            const { data, error } = await supabase.storage.from('process_control').download(plan.file_path);
                            if (error || !data) {
                                return null;
                            }

                            return {
                                path: `${folderName}/${sanitizeArchiveName(
                                    plan.file_name || getStorageFileName(plan.file_path, `${plan.part_code || 'Parca'}_kontrol_plani`)
                                )}`,
                                data,
                            };
                        },
                    });
                } else {
                    jobs.push({
                        label: `Kontrol planı PDF hazırlanıyor: ${plan.part_code || '-'}`,
                        run: async () => {
                            const printablePlan = enrichPlanForPrintableReport(plan, {
                                characteristics,
                                measurementEquipment,
                                standards,
                            });

                            return {
                                path: `${folderName}/${getPlanFallbackFileName(plan)}`,
                                data: await createPrintableReportPdfBuffer(printablePlan, 'process_control_plans'),
                            };
                        },
                    });
                }
            });

            selectedReports.forEach((report) => {
                const folderName = `${rootFolderName}/${getPartFolderName(report)}`;
                const reportAttachments = attachmentsByReport[report.id] || [];

                if (reportAttachments.length > 0) {
                    reportAttachments.forEach((attachment, index) => {
                        jobs.push({
                            label: `INKR eki indiriliyor: ${report.part_code || '-'} / ${attachment.file_name || 'Ek'}`,
                            run: async () => {
                                const { data, error } = await supabase.storage
                                    .from('process_inkr_attachments')
                                    .download(attachment.file_path);

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
                            const printableReport = enrichReportForPrintableReport(report, {
                                characteristics,
                                measurementEquipment,
                                attachments: [],
                            });

                            return {
                                path: `${folderName}/${getReportFallbackFileName(report)}`,
                                data: await createPrintableReportPdfBuffer(printableReport, 'inkr_management'),
                            };
                        },
                    });
                }
            });

            if (jobs.length === 0) {
                toast({
                    variant: 'destructive',
                    title: 'Dosya Bulunamadı',
                    description: 'Seçili kayıtlar için indirilebilir dosya bulunamadı.',
                });
                return;
            }

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
                    description: 'Seçili dosyaların hiçbiri indirilemedi.',
                });
                return;
            }

            setDownloadStatus('Zip dosyası oluşturuluyor...');
            const content = await zip.generateAsync({ type: 'blob' });
            saveAs(content, `${rootFolderName}.zip`);

            toast({
                title: 'Başarılı',
                description: `${successCount} dosya arşivlenerek indirildi.`,
            });
            setIsOpen(false);
        } catch (error) {
            console.error('Proses klasör indirme hatası:', error);
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
            <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle>Klasör İndir</DialogTitle>
                    <DialogDescription>
                        `Document` modülündeki akış gibi, araç tipine göre dosyaları toplu seçip arşiv olarak indirebilirsiniz.
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="flex-1 min-h-0 pr-4">
                    <div className="space-y-4 pb-4">
                    <div className="space-y-2">
                        <Label>Araç Tipi</Label>
                        <Select value={selectedVehicleType} onValueChange={setSelectedVehicleType} disabled={isDownloading}>
                            <SelectTrigger>
                                <SelectValue placeholder="Araç tipini seçin" />
                            </SelectTrigger>
                            <SelectContent>
                                {vehicleTypeOptions.length > 0 ? (
                                    vehicleTypeOptions.map((vehicleType) => (
                                        <SelectItem key={vehicleType} value={vehicleType}>
                                            {vehicleType}
                                        </SelectItem>
                                    ))
                                ) : (
                                    <SelectItem value="no-vehicle-type" disabled>
                                        Araç tipi bulunamadı
                                    </SelectItem>
                                )}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                                <div className="rounded-lg border bg-card p-4 space-y-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="font-semibold">Kontrol Planları</p>
                                            <p className="text-sm text-muted-foreground">
                                                Seçilen araç tipine ait plan dosyaları indirilir.
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="secondary">{filteredPlans.length}</Badge>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setSelectedPlanIds(allPlansSelected ? [] : filteredPlans.map((plan) => plan.id))}
                                                disabled={isDownloading || filteredPlans.length === 0}
                                            >
                                                {allPlansSelected ? 'Temizle' : 'Tümünü Seç'}
                                            </Button>
                                        </div>
                                    </div>

                                    <ScrollArea className="h-[340px] pr-3 border rounded-md p-3">
                                        {filteredPlans.length > 0 ? (
                                            <div className="space-y-3">
                                                {filteredPlans.map((plan) => (
                                                    <label
                                                        key={plan.id}
                                                        className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:border-primary/40 transition-colors"
                                                    >
                                                        <Checkbox
                                                            checked={selectedPlanIds.includes(plan.id)}
                                                            onCheckedChange={() => togglePlanSelection(plan.id)}
                                                            disabled={isDownloading}
                                                        />
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-medium">{plan.part_code || '-'}</span>
                                                                <Badge variant={plan.file_path ? 'default' : 'outline'}>
                                                                    {plan.file_path ? 'Dosya' : 'PDF'}
                                                                </Badge>
                                                            </div>
                                                            <p className="truncate text-sm text-muted-foreground">{plan.part_name || 'Parça adı yok'}</p>
                                                            <p className="text-xs text-muted-foreground">Rev.{plan.revision_number ?? 0}</p>
                                                        </div>
                                                    </label>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center text-muted-foreground py-8">
                                                Bu araç tipine ait kontrol planı bulunmuyor.
                                            </div>
                                        )}
                                    </ScrollArea>
                                </div>

                                <div className="rounded-lg border bg-card p-4 space-y-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="font-semibold">INKR Raporları</p>
                                            <p className="text-sm text-muted-foreground">
                                                Varsa gerçek ek dosyalar, yoksa rapor PDF&apos;i indirilir.
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="secondary">{filteredReports.length}</Badge>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setSelectedReportIds(allReportsSelected ? [] : filteredReports.map((report) => report.id))}
                                                disabled={isDownloading || filteredReports.length === 0}
                                            >
                                                {allReportsSelected ? 'Temizle' : 'Tümünü Seç'}
                                            </Button>
                                        </div>
                                    </div>

                                    <ScrollArea className="h-[340px] pr-3 border rounded-md p-3">
                                        {filteredReports.length > 0 ? (
                                            <div className="space-y-3">
                                                {filteredReports.map((report) => (
                                                    <label
                                                        key={report.id}
                                                        className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:border-primary/40 transition-colors"
                                                    >
                                                        <Checkbox
                                                            checked={selectedReportIds.includes(report.id)}
                                                            onCheckedChange={() => toggleReportSelection(report.id)}
                                                            disabled={isDownloading}
                                                        />
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-medium">{report.part_code || '-'}</span>
                                                                <Badge variant="outline">{report.status || 'Rapor'}</Badge>
                                                            </div>
                                                            <p className="truncate text-sm text-muted-foreground">{report.part_name || 'Parça adı yok'}</p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {formatDateValue(report.report_date || report.created_at)}
                                                            </p>
                                                        </div>
                                                    </label>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center text-muted-foreground py-8">
                                                Bu araç tipine bağlı INKR kaydı bulunmuyor.
                                            </div>
                                        )}
                                    </ScrollArea>
                                </div>
                    </div>

                    {(selectedPlanIds.length > 0 || selectedReportIds.length > 0) && (
                        <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm">
                            <span>Seçili plan: <strong>{selectedPlanIds.length}</strong></span>
                            <span className="ml-4">Seçili INKR: <strong>{selectedReportIds.length}</strong></span>
                        </div>
                    )}

                    {isDownloading && (
                        <div className="space-y-2 p-3 bg-secondary/40 rounded-md border">
                            <div className="flex justify-between text-sm font-medium gap-3">
                                <span className="truncate">{downloadStatus || 'Hazırlanıyor...'}</span>
                                <span>{progress}%</span>
                            </div>
                            <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                                <div
                                    className="bg-primary h-full transition-all duration-300 ease-out"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    )}
                    </div>
                </ScrollArea>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isDownloading}>
                        İptal
                    </Button>
                    <Button
                        onClick={handleDownload}
                        disabled={isDownloading || (!selectedPlanIds.length && !selectedReportIds.length)}
                    >
                        {isDownloading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                İndiriliyor...
                            </>
                        ) : (
                            <>
                                <Download className="mr-2 h-4 w-4" />
                                Toplu İndir
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ProcessControlFolderDownloadModal;
