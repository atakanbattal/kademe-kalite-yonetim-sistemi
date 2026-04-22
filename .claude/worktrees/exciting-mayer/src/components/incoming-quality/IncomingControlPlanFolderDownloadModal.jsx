import React, { useEffect, useMemo, useState } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
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

const getPartFolderName = (record) =>
    sanitizeArchiveName(`${record.part_code || 'Parca'}_${record.part_name || 'Kayit'}`);

const getPlanFallbackFileName = (plan) =>
    sanitizeArchiveName(`Kontrol_Plani_${plan.part_code || 'Parca'}_Rev_${plan.revision_number ?? 0}.pdf`);

const enrichPlanForPrintableReport = (plan, { characteristics, measurementEquipment, standards }) => ({
    ...plan,
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

const IncomingControlPlanFolderDownloadModal = ({ isOpen, setIsOpen, plans = [] }) => {
    const { toast } = useToast();
    const { characteristics = [], equipment: measurementEquipment = [], standards = [] } = useData();
    const [selectedPlanIds, setSelectedPlanIds] = useState([]);
    const [isDownloading, setIsDownloading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [downloadStatus, setDownloadStatus] = useState('');

    const sortedPlans = useMemo(
        () =>
            [...plans].sort((left, right) => {
                const leftCode = left.part_code || '';
                const rightCode = right.part_code || '';
                return leftCode.localeCompare(rightCode, 'tr');
            }),
        [plans]
    );

    useEffect(() => {
        if (!isOpen) {
            setSelectedPlanIds([]);
            setIsDownloading(false);
            setProgress(0);
            setDownloadStatus('');
        }
    }, [isOpen]);

    const allSelected = sortedPlans.length > 0 && selectedPlanIds.length === sortedPlans.length;

    const handleToggle = (planId) => {
        setSelectedPlanIds((previous) =>
            previous.includes(planId)
                ? previous.filter((currentId) => currentId !== planId)
                : [...previous, planId]
        );
    };

    const handleDownload = async () => {
        const selectedPlans = sortedPlans.filter((plan) => selectedPlanIds.includes(plan.id));
        if (selectedPlans.length === 0) {
            toast({
                variant: 'destructive',
                title: 'Seçim Gerekli',
                description: 'Lütfen indirilecek en az bir kontrol planı seçin.',
            });
            return;
        }

        setIsDownloading(true);
        setProgress(0);
        setDownloadStatus('Dosyalar hazırlanıyor...');

        try {
            const zip = new JSZip();
            const rootFolderName = 'Girdi_Kontrol_Planlari';
            const jobs = selectedPlans.map((plan) => ({
                label: `Plan hazırlanıyor: ${plan.part_code || '-'}`,
                run: async () => {
                    const folderName = `${rootFolderName}/${getPartFolderName(plan)}`;

                    if (plan.file_path) {
                        const { data, error } = await supabase.storage.from('incoming_control').download(plan.file_path);
                        if (error || !data) {
                            return null;
                        }

                        return {
                            path: `${folderName}/${sanitizeArchiveName(
                                plan.file_name || getStorageFileName(plan.file_path, `${plan.part_code || 'Parca'}_kontrol_plani`)
                            )}`,
                            data,
                        };
                    }

                    const printablePlan = enrichPlanForPrintableReport(plan, {
                        characteristics,
                        measurementEquipment,
                        standards,
                    });

                    return {
                        path: `${folderName}/${getPlanFallbackFileName(plan)}`,
                        data: await createPrintableReportPdfBuffer(printablePlan, 'incoming_control_plans'),
                    };
                },
            }));

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
                    description: 'Seçili planlar indirilemedi.',
                });
                return;
            }

            setDownloadStatus('Zip dosyası oluşturuluyor...');
            const content = await zip.generateAsync({ type: 'blob' });
            saveAs(content, `${rootFolderName}.zip`);

            toast({
                title: 'Başarılı',
                description: `${successCount} kontrol planı arşivlenerek indirildi.`,
            });
            setIsOpen(false);
        } catch (error) {
            console.error('Girdi kontrol planı klasör indirme hatası:', error);
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
                    <DialogTitle>Kontrol Planlarını İndir</DialogTitle>
                    <DialogDescription>
                        `Document` modülündeki gibi seçilen planlar tek arşiv içinde klasörlenerek indirilir.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-muted-foreground">Kontrol Planları</span>
                    <div className="flex items-center gap-2">
                        <Badge variant="secondary">{sortedPlans.length}</Badge>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedPlanIds(allSelected ? [] : sortedPlans.map((plan) => plan.id))}
                            disabled={isDownloading || sortedPlans.length === 0}
                        >
                            {allSelected ? 'Temizle' : 'Tümünü Seç'}
                        </Button>
                    </div>
                </div>

                <ScrollArea className="h-[340px] pr-4 border rounded-md p-4">
                    {sortedPlans.length > 0 ? (
                        <div className="space-y-4">
                            {sortedPlans.map((plan) => (
                                <label key={plan.id} className="flex items-start gap-3 cursor-pointer">
                                    <Checkbox
                                        checked={selectedPlanIds.includes(plan.id)}
                                        onCheckedChange={() => handleToggle(plan.id)}
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
                        <div className="text-center text-muted-foreground py-8">İndirilebilecek kontrol planı bulunmuyor.</div>
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
                    <Button onClick={handleDownload} disabled={isDownloading || selectedPlanIds.length === 0}>
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

export default IncomingControlPlanFolderDownloadModal;
