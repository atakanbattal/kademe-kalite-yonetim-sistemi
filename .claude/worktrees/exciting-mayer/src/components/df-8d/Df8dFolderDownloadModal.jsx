import React, { useEffect, useMemo, useState } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { supabase } from '@/lib/customSupabaseClient';
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
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import { Building2, CheckSquare, FolderDown, Loader2, Square } from 'lucide-react';
import { createPrintableReportPdfBuffer, sanitizeArchiveName } from '@/lib/qualityFolderDownloadUtils';

const getDepartmentName = (record) => {
    const department = String(record?.department || '').trim();
    return department || 'Belirtilmemiş';
};

const buildPdfBaseName = (record) => {
    const num = record.nc_number || record.mdi_no || String(record.id || '').slice(0, 8);
    const type = record.type || 'Kayit';
    return sanitizeArchiveName(`${num}_${type}`, 'DF_Kayit');
};

const Df8dFolderDownloadModal = ({ isOpen, setIsOpen, records = [] }) => {
    const { toast } = useToast();
    const [selectedDepartments, setSelectedDepartments] = useState([]);
    const [isDownloading, setIsDownloading] = useState(false);
    const [progress, setProgress] = useState({ done: 0, total: 0, label: '' });

    const departmentStats = useMemo(() => {
        const statsMap = new Map();

        records.forEach((record) => {
            const departmentName = getDepartmentName(record);
            const current = statsMap.get(departmentName) || {
                name: departmentName,
                count: 0,
                df: 0,
                eightD: 0,
                mdi: 0,
            };

            current.count += 1;
            if (record.type === 'DF') current.df += 1;
            if (record.type === '8D') current.eightD += 1;
            if (record.type === 'MDI') current.mdi += 1;

            statsMap.set(departmentName, current);
        });

        return Array.from(statsMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    }, [records]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }
        setSelectedDepartments(departmentStats.map((department) => department.name));
    }, [departmentStats, isOpen]);

    const allSelected = departmentStats.length > 0 && selectedDepartments.length === departmentStats.length;

    const selectedRecordCount = useMemo(() => {
        const selectedSet = new Set(selectedDepartments);
        return departmentStats.reduce(
            (total, department) => (selectedSet.has(department.name) ? total + department.count : total),
            0
        );
    }, [departmentStats, selectedDepartments]);

    const handleToggleDepartment = (departmentName) => {
        setSelectedDepartments((prev) =>
            prev.includes(departmentName) ? prev.filter((item) => item !== departmentName) : [...prev, departmentName]
        );
    };

    const handleToggleAll = () => {
        setSelectedDepartments(allSelected ? [] : departmentStats.map((department) => department.name));
    };

    const handleClose = (nextOpen) => {
        if (typeof nextOpen === 'boolean' && nextOpen) {
            setIsOpen(true);
            return;
        }
        if (!isDownloading) {
            setIsOpen(false);
            setSelectedDepartments([]);
        }
    };

    const fetchFullRecord = async (id) => {
        const { data, error } = await supabase
            .from('non_conformities')
            .select('*, supplier:supplier_id(name)')
            .eq('id', id)
            .maybeSingle();
        if (error || !data) {
            return null;
        }
        return data;
    };

    const handleDownload = async () => {
        if (selectedDepartments.length === 0) {
            toast({
                variant: 'destructive',
                title: 'Birim seçin',
                description: 'ZIP içine alınacak birimleri işaretleyin.',
            });
            return;
        }

        const departmentSet = new Set(selectedDepartments);
        const toExport = records.filter((r) => departmentSet.has(getDepartmentName(r)));

        if (toExport.length === 0) {
            toast({
                variant: 'destructive',
                title: 'Kayıt yok',
                description: 'Seçilen birimlere uygun kayıt yok.',
            });
            return;
        }

        setIsDownloading(true);
        setProgress({ done: 0, total: toExport.length, label: 'Kayıtlar hazırlanıyor...' });

        try {
            const zip = new JSZip();
            let pdfCount = 0;

            for (let i = 0; i < toExport.length; i++) {
                const row = toExport[i];
                setProgress({
                    done: i,
                    total: toExport.length,
                    label: `PDF: ${row.nc_number || row.mdi_no || row.id} (${i + 1}/${toExport.length})`,
                });

                const full = (await fetchFullRecord(row.id)) || row;
                const deptFolder = sanitizeArchiveName(getDepartmentName(full), 'Birim');
                const baseName = buildPdfBaseName(full);
                const recordFolder = `${deptFolder}/${baseName}`;

                try {
                    const pdfBuffer = await createPrintableReportPdfBuffer(full, 'nonconformity');
                    zip.file(`${recordFolder}_rapor.pdf`, pdfBuffer);
                    pdfCount += 1;
                } catch (e) {
                    console.warn('DF/8D PDF oluşturulamadı:', full.id, e);
                    zip.file(
                        `${recordFolder}_HATA.txt`,
                        `PDF üretilemedi: ${e?.message || String(e)}\nKayıt: ${full.nc_number || full.id}`
                    );
                }
            }

            if (pdfCount === 0) {
                toast({
                    variant: 'destructive',
                    title: 'İndirilemedi',
                    description: 'Hiçbir kayıt için PDF oluşturulamadı.',
                });
                return;
            }

            setProgress({ done: toExport.length, total: toExport.length, label: 'ZIP oluşturuluyor...' });
            const blob = await zip.generateAsync({ type: 'blob' });
            const stamp = format(new Date(), 'yyyy-MM-dd_HHmm', { locale: tr });
            saveAs(blob, sanitizeArchiveName(`KademeQMS_DF8D_Klasor_${stamp}.zip`, 'DF8D_Klasor.zip'));

            toast({
                title: 'İndirme tamam',
                description: `${pdfCount} PDF arşive eklendi; kanıtlar rapor PDF içinde yer alır.`,
            });
            setIsOpen(false);
            setSelectedDepartments([]);
        } catch (error) {
            console.error('DF8D klasör indirme:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: error?.message || 'ZIP oluşturulurken bir hata oluştu.',
            });
        } finally {
            setIsDownloading(false);
            setProgress({ done: 0, total: 0, label: '' });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-4xl w-[96vw] max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FolderDown className="h-5 w-5 text-primary" />
                        Klasör indir (ZIP)
                    </DialogTitle>
                    <DialogDescription>
                        Seçtiğiniz birimlere göre her kayıt için standart PDF raporu üretilir; kanıtlar bu PDF içinde
                        yer alır, ayrı dosya eklenmez.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                            <Button type="button" variant="outline" size="sm" onClick={handleToggleAll} className="gap-2" disabled={isDownloading}>
                                {allSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                                {allSelected ? 'Tümünü Kaldır' : 'Tümünü Seç'}
                            </Button>
                            <Badge variant="secondary">
                                {selectedDepartments.length} / {departmentStats.length} birim
                            </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">{selectedRecordCount} kayıt ZIP’e dahil edilecek</div>
                    </div>

                    {isDownloading && (
                        <div className="flex items-center gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
                            <div>
                                <p className="font-medium text-foreground">{progress.label || 'İşleniyor...'}</p>
                                {progress.total > 0 && (
                                    <p className="text-xs">
                                        {progress.done} / {progress.total} kayıt
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                    {!isDownloading && departmentStats.length === 0 && (
                        <div className="flex h-full min-h-[220px] flex-col items-center justify-center rounded-lg border px-6 text-center text-muted-foreground">
                            <Building2 className="mb-3 h-10 w-10 opacity-50" />
                            <p className="font-medium">Raporlanacak birim bulunamadı</p>
                            <p className="mt-1 text-sm">Mevcut filtrelere uygun kayıt olmadığı için seçim yapılamıyor.</p>
                        </div>
                    )}
                    {!isDownloading && departmentStats.length > 0 && (
                        <ScrollArea className="h-[380px] rounded-lg border">
                            <div className="space-y-2 p-3">
                                {departmentStats.map((department) => {
                                    const isSelected = selectedDepartments.includes(department.name);

                                    return (
                                        <button
                                            key={department.name}
                                            type="button"
                                            onClick={() => handleToggleDepartment(department.name)}
                                            className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                                                isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                                            }`}
                                        >
                                            <Checkbox
                                                checked={isSelected}
                                                onCheckedChange={() => handleToggleDepartment(department.name)}
                                                onClick={(event) => event.stopPropagation()}
                                                className="mt-0.5"
                                            />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                    <Label
                                                        className="cursor-pointer text-sm font-semibold text-foreground"
                                                        onClick={(event) => event.preventDefault()}
                                                    >
                                                        {department.name}
                                                    </Label>
                                                    <Badge variant={isSelected ? 'default' : 'secondary'}>
                                                        {department.count} kayıt
                                                    </Badge>
                                                </div>
                                                <p className="mt-1 text-xs text-muted-foreground">
                                                    DF: {department.df} • 8D: {department.eightD} • MDI: {department.mdi}
                                                </p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </ScrollArea>
                    )}
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => handleClose(false)} disabled={isDownloading}>
                        İptal
                    </Button>
                    <Button
                        type="button"
                        onClick={handleDownload}
                        disabled={isDownloading || selectedDepartments.length === 0 || departmentStats.length === 0}
                    >
                        {isDownloading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Hazırlanıyor...
                            </>
                        ) : (
                            <>
                                <FolderDown className="mr-2 h-4 w-4" />
                                ZIP’i indir
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default Df8dFolderDownloadModal;
