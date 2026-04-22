import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { Download, Loader2 } from 'lucide-react';
import {
    createPrintableReportPdfBuffer,
    getStorageFileName,
    runInBatches,
    sanitizeArchiveName,
} from '@/lib/qualityFolderDownloadUtils';

const MAX_CONCURRENT = 6;
const PAGE = 1000;

const formatDateValue = (value) => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return format(parsed, 'dd.MM.yyyy', { locale: tr });
};

const getPlanFallbackFileName = (plan) =>
    sanitizeArchiveName(`Kontrol_Plani_${plan.part_code || 'Parca'}_Rev_${plan.revision_number ?? 0}.pdf`);

const getInkrFallbackFileName = (report) =>
    sanitizeArchiveName(`INKR_${report.inkr_number || report.part_code || report.id || 'Rapor'}.pdf`);

const getInkrAttachmentArchiveName = (attachment, report, index) =>
    sanitizeArchiveName(
        `INKR_Ek_${report.part_code || 'Parca'}_${index + 1}_${
            attachment.file_name || getStorageFileName(attachment.file_path, `Ek_${index + 1}`)
        }`
    );

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

const fetchAllRows = async (fetchPage) => {
    const rows = [];
    let from = 0;
    for (;;) {
        const { data, error } = await fetchPage(from, from + PAGE - 1);
        if (error) throw error;
        const batch = data || [];
        rows.push(...batch);
        if (batch.length < PAGE) break;
        from += PAGE;
    }
    return rows;
};

const STOCK_RISK_SELECT = `
    *,
    supplier:suppliers!stock_risk_controls_supplier_id_fkey(id, name),
    source_inspection:incoming_inspections!stock_risk_controls_source_inspection_id_fkey(id, record_no, part_code, part_name),
    controlled_inspection:incoming_inspections!stock_risk_controls_controlled_inspection_id_fkey(id, record_no, part_code, part_name, delivery_note_number),
    controlled_by:profiles!stock_risk_controls_controlled_by_id_fkey(id, full_name)
`;

const IncomingQualityFolderDownloadModal = ({ isOpen, setIsOpen }) => {
    const { toast } = useToast();
    const { characteristics = [], equipment: measurementEquipment = [], standards = [] } = useData();

    const [catalogLoading, setCatalogLoading] = useState(false);
    const [plans, setPlans] = useState([]);
    const [inkrReports, setInkrReports] = useState([]);
    const [inspectionRows, setInspectionRows] = useState([]);
    const [stockRisks, setStockRisks] = useState([]);

    const [selectedPlanIds, setSelectedPlanIds] = useState([]);
    const [selectedInkrIds, setSelectedInkrIds] = useState([]);
    const [selectedInspectionIds, setSelectedInspectionIds] = useState([]);
    const [selectedStockRiskIds, setSelectedStockRiskIds] = useState([]);

    const [isDownloading, setIsDownloading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [downloadStatus, setDownloadStatus] = useState('');

    const loadCatalog = useCallback(async () => {
        setCatalogLoading(true);
        try {
            const [planRows, inkrRows, inspectionList, riskRows] = await Promise.all([
                fetchAllRows((from, to) =>
                    supabase.from('incoming_control_plans').select('*').order('updated_at', { ascending: false }).range(from, to)
                ),
                fetchAllRows((from, to) =>
                    supabase.from('inkr_reports').select('*').order('updated_at', { ascending: false }).range(from, to)
                ),
                fetchAllRows((from, to) =>
                    supabase
                        .from('incoming_inspections_with_supplier')
                        .select('id, record_no, part_code, part_name, inspection_date, supplier_name, decision')
                        .order('inspection_date', { ascending: false })
                        .range(from, to)
                ),
                fetchAllRows((from, to) =>
                    supabase.from('stock_risk_controls').select(STOCK_RISK_SELECT).order('created_at', { ascending: false }).range(from, to)
                ),
            ]);
            setPlans(planRows);
            setInkrReports(inkrRows);
            setInspectionRows(inspectionList);
            setStockRisks(riskRows);
        } catch (e) {
            console.error('Girdi kalite klasör kataloğu:', e);
            toast({
                variant: 'destructive',
                title: 'Veri yüklenemedi',
                description: e.message || 'Kayıtlar alınamadı.',
            });
            setPlans([]);
            setInkrReports([]);
            setInspectionRows([]);
            setStockRisks([]);
        } finally {
            setCatalogLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        if (!isOpen) {
            setSelectedPlanIds([]);
            setSelectedInkrIds([]);
            setSelectedInspectionIds([]);
            setSelectedStockRiskIds([]);
            setIsDownloading(false);
            setProgress(0);
            setDownloadStatus('');
            return;
        }
        void loadCatalog();
    }, [isOpen, loadCatalog]);

    const toggleInSet = (setter, id) => {
        setter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    };

    const fetchFullInspection = async (id) => {
        const { data, error } = await supabase
            .from('incoming_inspections')
            .select(
                '*, supplier:suppliers(id, name), attachments:incoming_inspection_attachments(*), non_conformity:non_conformities!non_conformities_source_inspection_id_fkey(id, nc_number), defects:incoming_inspection_defects(*), results:incoming_inspection_results(*)'
            )
            .eq('id', id)
            .single();
        if (error) throw error;
        return data;
    };

    const fetchFullStockRisk = async (id) => {
        const { data, error } = await supabase.from('stock_risk_controls').select(STOCK_RISK_SELECT).eq('id', id).single();
        if (error) throw error;
        return data;
    };

    const handleDownload = async () => {
        const totalSel =
            selectedPlanIds.length +
            selectedInkrIds.length +
            selectedInspectionIds.length +
            selectedStockRiskIds.length;
        if (totalSel === 0) {
            toast({
                variant: 'destructive',
                title: 'Seçim gerekli',
                description: 'En az bir kayıt seçin (kontrol planı, INKR, muayene veya stok risk).',
            });
            return;
        }

        setIsDownloading(true);
        setProgress(0);
        setDownloadStatus('Hazırlanıyor...');

        try {
            const zip = new JSZip();
            const root = sanitizeArchiveName('Girdi_Kalite');
            const jobs = [];

            const selectedPlans = plans.filter((p) => selectedPlanIds.includes(p.id));
            const folderPlans = `${root}/Kontrol_Planlari`;
            selectedPlans.forEach((plan) => {
                jobs.push({
                    label: `Kontrol planı: ${plan.part_code || '-'}`,
                    run: async () => {
                        if (plan.file_path) {
                            const { data, error } = await supabase.storage.from('incoming_control').download(plan.file_path);
                            if (error || !data) return null;
                            return {
                                path: `${folderPlans}/${sanitizeArchiveName(
                                    plan.file_name || getStorageFileName(plan.file_path, `${plan.part_code || 'Parca'}_kontrol_plani`)
                                )}`,
                                data,
                            };
                        }
                        const printable = enrichPlanForPrintableReport(plan, {
                            characteristics,
                            measurementEquipment,
                            standards,
                        });
                        return {
                            path: `${folderPlans}/${getPlanFallbackFileName(plan)}`,
                            data: await createPrintableReportPdfBuffer(printable, 'incoming_control_plans'),
                        };
                    },
                });
            });

            const selectedInkrs = inkrReports.filter((r) => selectedInkrIds.includes(r.id));
            if (selectedInkrs.length > 0) {
                const { data: attRows, error: attErr } = await supabase
                    .from('inkr_attachments')
                    .select('*')
                    .in(
                        'inkr_report_id',
                        selectedInkrs.map((r) => r.id)
                    );
                if (attErr) throw attErr;
                const byReport = {};
                (attRows || []).forEach((a) => {
                    const rid = a.inkr_report_id;
                    if (!byReport[rid]) byReport[rid] = [];
                    byReport[rid].push(a);
                });

                const folderInkr = `${root}/INKR`;
                selectedInkrs.forEach((report) => {
                    const attachments = byReport[report.id] || [];
                    if (attachments.length > 0) {
                        attachments.forEach((attachment, index) => {
                            jobs.push({
                                label: `INKR ek: ${report.part_code || '-'}`,
                                run: async () => {
                                    const { data, error } = await supabase.storage.from('inkr_attachments').download(attachment.file_path);
                                    if (error || !data) return null;
                                    return {
                                        path: `${folderInkr}/${getInkrAttachmentArchiveName(attachment, report, index)}`,
                                        data,
                                    };
                                },
                            });
                        });
                    } else {
                        jobs.push({
                            label: `INKR PDF: ${report.part_code || '-'}`,
                            run: async () => {
                                const printable = enrichInkrForPrintableReport(report, {
                                    characteristics,
                                    measurementEquipment,
                                    attachments: [],
                                });
                                return {
                                    path: `${folderInkr}/${getInkrFallbackFileName(report)}`,
                                    data: await createPrintableReportPdfBuffer(printable, 'inkr_management'),
                                };
                            },
                        });
                    }
                });
            }

            const folderInspections = `${root}/Muayene_Kayitlari`;
            selectedInspectionIds.forEach((id) => {
                const row = inspectionRows.find((r) => r.id === id);
                jobs.push({
                    label: `Muayene: ${row?.record_no || id}`,
                    run: async () => {
                        const full = await fetchFullInspection(id);
                        const fn = sanitizeArchiveName(`Muayene_${full.record_no || full.id}_${full.part_code || 'kayit'}.pdf`);
                        return {
                            path: `${folderInspections}/${fn}`,
                            data: await createPrintableReportPdfBuffer(full, 'incoming_inspection'),
                        };
                    },
                });
            });

            const folderStockRisk = `${root}/Stok_Risk`;
            selectedStockRiskIds.forEach((id) => {
                const row = stockRisks.find((r) => r.id === id);
                jobs.push({
                    label: `Stok risk: ${row?.part_code || id}`,
                    run: async () => {
                        const full = await fetchFullStockRisk(id);
                        const fn = sanitizeArchiveName(`Stok_Risk_${full.part_code || 'Parca'}_${String(id).slice(0, 8)}.pdf`);
                        return {
                            path: `${folderStockRisk}/${fn}`,
                            data: await createPrintableReportPdfBuffer(full, 'stock_risk_controls'),
                        };
                    },
                });
            });

            if (jobs.length === 0) {
                toast({ variant: 'destructive', title: 'İş yok', description: 'İndirilecek dosya oluşturulamadı.' });
                return;
            }

            let completed = 0;
            let ok = 0;
            await runInBatches(jobs, MAX_CONCURRENT, async (job) => {
                try {
                    const result = await job.run();
                    completed += 1;
                    if (result?.path && result?.data) {
                        zip.file(result.path, result.data);
                        ok += 1;
                    }
                } catch (e) {
                    console.warn(job.label, e);
                    completed += 1;
                }
                setProgress(Math.round((completed / jobs.length) * 100));
                setDownloadStatus(`${job.label} (${completed}/${jobs.length})`);
            });

            if (ok === 0) {
                toast({ variant: 'destructive', title: 'Hata', description: 'Hiçbir dosya indirilemedi.' });
                return;
            }

            setDownloadStatus('Zip oluşturuluyor...');
            const blob = await zip.generateAsync({ type: 'blob' });
            saveAs(blob, `${root}.zip`);
            toast({ title: 'Başarılı', description: `${ok} dosya arşivlendi.` });
            setIsOpen(false);
        } catch (error) {
            console.error('Girdi kalite klasör indir:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: error.message || 'Arşiv oluşturulamadı.',
            });
        } finally {
            setIsDownloading(false);
            setProgress(0);
            setDownloadStatus('');
        }
    };

    const selectionSummary = useMemo(
        () =>
            `Plan: ${selectedPlanIds.length} · INKR: ${selectedInkrIds.length} · Muayene: ${selectedInspectionIds.length} · Stok risk: ${selectedStockRiskIds.length}`,
        [selectedPlanIds.length, selectedInkrIds.length, selectedInspectionIds.length, selectedStockRiskIds.length]
    );

    const anySelection =
        selectedPlanIds.length +
            selectedInkrIds.length +
            selectedInspectionIds.length +
            selectedStockRiskIds.length >
        0;

    return (
        <Dialog open={isOpen} onOpenChange={isDownloading ? undefined : setIsOpen}>
            <DialogContent className="sm:max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle>Klasör İndir</DialogTitle>
                    <DialogDescription>
                        Girdi kaliteye ait kontrol planları, INKR raporları, muayene kayıtları ve stok risk kontrollerini seçip tek ZIP
                        içinde PDF veya yüklenmiş dosyalar halinde indirebilirsiniz (proses kontroldeki gibi).
                    </DialogDescription>
                </DialogHeader>

                {catalogLoading ? (
                    <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Kayıtlar yükleniyor...
                    </div>
                ) : (
                    <Tabs defaultValue="plans" className="flex-1 min-h-0 flex flex-col gap-2">
                        <TabsList className="grid w-full grid-cols-4 h-auto flex-wrap gap-1">
                            <TabsTrigger value="plans" className="text-xs sm:text-sm">
                                Kontrol planı ({plans.length})
                            </TabsTrigger>
                            <TabsTrigger value="inkr" className="text-xs sm:text-sm">
                                INKR ({inkrReports.length})
                            </TabsTrigger>
                            <TabsTrigger value="inspections" className="text-xs sm:text-sm">
                                Muayene ({inspectionRows.length})
                            </TabsTrigger>
                            <TabsTrigger value="risk" className="text-xs sm:text-sm">
                                Stok risk ({stockRisks.length})
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="plans" className="mt-0 flex-1 min-h-0">
                            <SectionHeader
                                count={plans.length}
                                allSelected={plans.length > 0 && selectedPlanIds.length === plans.length}
                                onToggleAll={() =>
                                    setSelectedPlanIds(
                                        plans.length && selectedPlanIds.length === plans.length ? [] : plans.map((p) => p.id)
                                    )
                                }
                                disabled={isDownloading || plans.length === 0}
                            />
                            <ScrollArea className="h-[280px] border rounded-md p-3">
                                <CheckboxList
                                    items={plans}
                                    selectedIds={selectedPlanIds}
                                    onToggle={(id) => toggleInSet(setSelectedPlanIds, id)}
                                    disabled={isDownloading}
                                    renderLabel={(plan) => (
                                        <>
                                            <span className="font-medium">{plan.part_code || '-'}</span>
                                            <Badge variant={plan.file_path ? 'default' : 'outline'} className="ml-2">
                                                {plan.file_path ? 'Dosya' : 'PDF'}
                                            </Badge>
                                            <p className="text-sm text-muted-foreground truncate">{plan.part_name || '-'}</p>
                                            <p className="text-xs text-muted-foreground">Rev.{plan.revision_number ?? 0}</p>
                                        </>
                                    )}
                                />
                            </ScrollArea>
                        </TabsContent>

                        <TabsContent value="inkr" className="mt-0 flex-1 min-h-0">
                            <SectionHeader
                                count={inkrReports.length}
                                allSelected={inkrReports.length > 0 && selectedInkrIds.length === inkrReports.length}
                                onToggleAll={() =>
                                    setSelectedInkrIds(
                                        inkrReports.length && selectedInkrIds.length === inkrReports.length
                                            ? []
                                            : inkrReports.map((r) => r.id)
                                    )
                                }
                                disabled={isDownloading || inkrReports.length === 0}
                            />
                            <ScrollArea className="h-[280px] border rounded-md p-3">
                                <CheckboxList
                                    items={inkrReports}
                                    selectedIds={selectedInkrIds}
                                    onToggle={(id) => toggleInSet(setSelectedInkrIds, id)}
                                    disabled={isDownloading}
                                    renderLabel={(report) => (
                                        <>
                                            <span className="font-medium">{report.part_code || '-'}</span>
                                            <Badge variant="outline" className="ml-2">
                                                {report.status || '—'}
                                            </Badge>
                                            <p className="text-sm text-muted-foreground truncate">{report.part_name || '-'}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {report.inkr_number || '-'} · {formatDateValue(report.report_date || report.created_at)}
                                            </p>
                                        </>
                                    )}
                                />
                            </ScrollArea>
                        </TabsContent>

                        <TabsContent value="inspections" className="mt-0 flex-1 min-h-0">
                            <SectionHeader
                                count={inspectionRows.length}
                                allSelected={
                                    inspectionRows.length > 0 && selectedInspectionIds.length === inspectionRows.length
                                }
                                onToggleAll={() =>
                                    setSelectedInspectionIds(
                                        inspectionRows.length && selectedInspectionIds.length === inspectionRows.length
                                            ? []
                                            : inspectionRows.map((r) => r.id)
                                    )
                                }
                                disabled={isDownloading || inspectionRows.length === 0}
                            />
                            <ScrollArea className="h-[280px] border rounded-md p-3">
                                <CheckboxList
                                    items={inspectionRows}
                                    selectedIds={selectedInspectionIds}
                                    onToggle={(id) => toggleInSet(setSelectedInspectionIds, id)}
                                    disabled={isDownloading}
                                    renderLabel={(inv) => (
                                        <>
                                            <span className="font-medium">{inv.record_no || '-'}</span>
                                            <Badge variant="outline" className="ml-2">
                                                {inv.decision || '—'}
                                            </Badge>
                                            <p className="text-sm text-muted-foreground truncate">
                                                {inv.part_code} · {inv.part_name || '-'}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {formatDateValue(inv.inspection_date)} · {inv.supplier_name || '-'}
                                            </p>
                                        </>
                                    )}
                                />
                            </ScrollArea>
                        </TabsContent>

                        <TabsContent value="risk" className="mt-0 flex-1 min-h-0">
                            <SectionHeader
                                count={stockRisks.length}
                                allSelected={stockRisks.length > 0 && selectedStockRiskIds.length === stockRisks.length}
                                onToggleAll={() =>
                                    setSelectedStockRiskIds(
                                        stockRisks.length && selectedStockRiskIds.length === stockRisks.length
                                            ? []
                                            : stockRisks.map((r) => r.id)
                                    )
                                }
                                disabled={isDownloading || stockRisks.length === 0}
                            />
                            <ScrollArea className="h-[280px] border rounded-md p-3">
                                <CheckboxList
                                    items={stockRisks}
                                    selectedIds={selectedStockRiskIds}
                                    onToggle={(id) => toggleInSet(setSelectedStockRiskIds, id)}
                                    disabled={isDownloading}
                                    renderLabel={(c) => (
                                        <>
                                            <span className="font-medium">{c.part_code || '-'}</span>
                                            <Badge variant="outline" className="ml-2">
                                                {c.status || '—'}
                                            </Badge>
                                            <p className="text-sm text-muted-foreground truncate">{c.part_name || '-'}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {c.supplier?.name || c.supplier_id || '-'} · {formatDateValue(c.created_at)}
                                            </p>
                                        </>
                                    )}
                                />
                            </ScrollArea>
                        </TabsContent>
                    </Tabs>
                )}

                {anySelection && (
                    <p className="text-sm text-muted-foreground border rounded-md px-3 py-2 bg-muted/30">{selectionSummary}</p>
                )}

                {isDownloading && (
                    <div className="space-y-2 p-3 bg-secondary/40 rounded-md border">
                        <div className="flex justify-between text-sm font-medium gap-3">
                            <span className="truncate">{downloadStatus || '...'}</span>
                            <span>{progress}%</span>
                        </div>
                        <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                            <div className="bg-primary h-full transition-all" style={{ width: `${progress}%` }} />
                        </div>
                    </div>
                )}

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isDownloading}>
                        İptal
                    </Button>
                    <Button onClick={handleDownload} disabled={isDownloading || catalogLoading || !anySelection}>
                        {isDownloading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                İndiriliyor...
                            </>
                        ) : (
                            <>
                                <Download className="mr-2 h-4 w-4" />
                                ZIP İndir
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const SectionHeader = ({ count, allSelected, onToggleAll, disabled }) => (
    <div className="flex items-center justify-between gap-2 mb-2">
        <Label className="text-muted-foreground">Kayıtlar ({count})</Label>
        <Button type="button" variant="ghost" size="sm" onClick={onToggleAll} disabled={disabled}>
            {allSelected ? 'Seçimi temizle' : 'Tümünü seç'}
        </Button>
    </div>
);

const CheckboxList = ({ items, selectedIds, onToggle, disabled, renderLabel }) => (
    <div className="space-y-2">
        {items.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">Kayıt yok.</p>
        ) : (
            items.map((item) => (
                <label
                    key={item.id}
                    className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:border-primary/40 transition-colors"
                >
                    <Checkbox
                        checked={selectedIds.includes(item.id)}
                        onCheckedChange={() => onToggle(item.id)}
                        disabled={disabled}
                    />
                    <div className="min-w-0 flex-1">{renderLabel(item)}</div>
                </label>
            ))
        )}
    </div>
);

export default IncomingQualityFolderDownloadModal;
