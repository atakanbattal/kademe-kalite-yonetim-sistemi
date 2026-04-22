import React, { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Building2, CheckSquare, FileText, Square } from 'lucide-react';

const getDepartmentName = (record) => {
    const department = String(record?.department || '').trim();
    return department || 'Belirtilmemiş';
};

const NCReportFilterModal = ({ isOpen, setIsOpen, records = [], reportType = 'list', onGenerate }) => {
    const [selectedDepartments, setSelectedDepartments] = useState([]);

    const departmentStats = useMemo(() => {
        const statsMap = new Map();

        records.forEach((record) => {
            const departmentName = getDepartmentName(record);
            const current = statsMap.get(departmentName) || { name: departmentName, count: 0, df: 0, eightD: 0, mdi: 0 };

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
        return departmentStats.reduce((total, department) => (
            selectedSet.has(department.name) ? total + department.count : total
        ), 0);
    }, [departmentStats, selectedDepartments]);

    const handleToggleDepartment = (departmentName) => {
        setSelectedDepartments((prev) => (
            prev.includes(departmentName)
                ? prev.filter((item) => item !== departmentName)
                : [...prev, departmentName]
        ));
    };

    const handleToggleAll = () => {
        setSelectedDepartments(allSelected ? [] : departmentStats.map((department) => department.name));
    };

    const handleClose = (nextOpen) => {
        if (typeof nextOpen === 'boolean' && nextOpen) {
            setIsOpen(true);
            return;
        }

        setIsOpen(false);
        setSelectedDepartments([]);
    };

    const handleGenerate = () => {
        if (selectedDepartments.length === 0) {
            return;
        }

        onGenerate({
            selectedDepartments,
            availableDepartmentCount: departmentStats.length,
        });
        handleClose(false);
    };

    const reportTitle = reportType === 'executive'
        ? 'DF / 8D Yönetici Özet Raporu'
        : 'DF / 8D Liste Raporu';

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-4xl w-[96vw] max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        {reportTitle} için Birim Seçimi
                    </DialogTitle>
                    <DialogDescription>
                        Tüm ilgili birimler varsayılan olarak seçili gelir. Tick işaretini kaldırarak rapora dahil etmek istemediklerinizi çıkarabilirsiniz.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                            <Button type="button" variant="outline" size="sm" onClick={handleToggleAll} className="gap-2">
                                {allSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                                {allSelected ? 'Tümünü Kaldır' : 'Tümünü Seç'}
                            </Button>
                            <Badge variant="secondary">
                                {selectedDepartments.length} / {departmentStats.length} birim
                            </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                            {selectedRecordCount} kayıt rapora dahil edilecek
                        </div>
                    </div>

                    <ScrollArea className="h-[420px] rounded-lg border">
                        {departmentStats.length === 0 ? (
                            <div className="flex h-full min-h-[220px] flex-col items-center justify-center px-6 text-center text-muted-foreground">
                                <Building2 className="mb-3 h-10 w-10 opacity-50" />
                                <p className="font-medium">Raporlanacak birim bulunamadı</p>
                                <p className="mt-1 text-sm">Mevcut filtrelere uygun kayıt olmadığı için seçim yapılamıyor.</p>
                            </div>
                        ) : (
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
                        )}
                    </ScrollArea>
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => handleClose(false)}>
                        İptal
                    </Button>
                    <Button
                        type="button"
                        onClick={handleGenerate}
                        disabled={selectedDepartments.length === 0 || departmentStats.length === 0}
                    >
                        Rapor Oluştur ({selectedRecordCount} kayıt)
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default NCReportFilterModal;
