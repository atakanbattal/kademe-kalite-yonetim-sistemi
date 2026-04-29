import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Building2, CheckCircle2 } from 'lucide-react';
import { costMatchesUnitFilterKey } from '@/lib/qualityCostUnitGroups';

const formatCurrency = (value) => {
    if (typeof value !== 'number') return '-';
    return value.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
};

const UnitReportModal = ({ isOpen, setIsOpen, unitOptions = [], costs, onGenerate, canonicalUnitCtx = {} }) => {
    const [selectedUnits, setSelectedUnits] = useState([]);

    const unitStats = useMemo(() => {
        const stats = {};
        unitOptions.forEach(({ key }) => {
            let totalAmount = 0;
            let count = 0;
            costs.forEach((cost) => {
                if (!costMatchesUnitFilterKey(cost, key, canonicalUnitCtx)) return;
                totalAmount += cost.amount || 0;
                count += 1;
            });
            stats[key] = { count, totalAmount };
        });
        return stats;
    }, [unitOptions, costs, canonicalUnitCtx]);

    const handleToggleUnit = (unitKey) => {
        setSelectedUnits((prev) =>
            prev.includes(unitKey) ? prev.filter((u) => u !== unitKey) : [...prev, unitKey]
        );
    };

    const handleSelectAll = () => {
        if (selectedUnits.length === unitOptions.length) {
            setSelectedUnits([]);
        } else {
            setSelectedUnits(unitOptions.map((o) => o.key));
        }
    };

    const handleGenerate = () => {
        if (selectedUnits.length === 0) {
            return;
        }
        onGenerate(selectedUnits);
        setIsOpen(false);
        setSelectedUnits([]);
    };

    const handleClose = () => {
        setIsOpen(false);
        setSelectedUnits([]);
    };

    const totalSelectedAmount = selectedUnits.reduce((sum, unitKey) => {
        return sum + (unitStats[unitKey]?.totalAmount || 0);
    }, 0);

    const totalSelectedCount = selectedUnits.reduce((sum, unitKey) => {
        return sum + (unitStats[unitKey]?.count || 0);
    }, 0);

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-primary" />
                        Birim Seçimi - Rapor Oluşturma
                    </DialogTitle>
                    <DialogDescription>
                        Aynı birim için farklı yazılmış kayıtlar (ör. AR-GE birleşik) tek satırda gösterilir.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="select-all"
                                checked={selectedUnits.length === unitOptions.length && unitOptions.length > 0}
                                onCheckedChange={handleSelectAll}
                            />
                            <Label htmlFor="select-all" className="font-semibold cursor-pointer">
                                Tümünü Seç / Seçimi Kaldır
                            </Label>
                        </div>
                        {selectedUnits.length > 0 && (
                            <div className="text-sm text-muted-foreground">
                                <span className="font-semibold text-foreground">{selectedUnits.length}</span> birim seçildi
                                {' • '}
                                <span className="font-semibold text-foreground">{totalSelectedCount}</span> kayıt
                                {' • '}
                                <span className="font-semibold text-primary">{formatCurrency(totalSelectedAmount)}</span>
                            </div>
                        )}
                    </div>

                    <ScrollArea className="h-[400px] border rounded-lg p-4">
                        {unitOptions.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                Rapor oluşturulacak birim bulunamadı.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {unitOptions.map(({ key, label }) => {
                                    const isSelected = selectedUnits.includes(key);
                                    const stats = unitStats[key] || { count: 0, totalAmount: 0 };

                                    return (
                                        <div
                                            key={key}
                                            className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                                                isSelected
                                                    ? 'bg-primary/10 border-primary'
                                                    : 'hover:bg-muted'
                                            }`}
                                            onClick={() => handleToggleUnit(key)}
                                        >
                                            <div className="flex items-center space-x-3 flex-1">
                                                <Checkbox
                                                    checked={isSelected}
                                                    onCheckedChange={() => handleToggleUnit(key)}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                                <div className="flex-1">
                                                    <Label className="font-semibold cursor-pointer text-base">
                                                        {label}
                                                    </Label>
                                                    <div className="text-sm text-muted-foreground mt-1">
                                                        {stats.count} kayıt • {formatCurrency(stats.totalAmount)}
                                                    </div>
                                                </div>
                                            </div>
                                            {isSelected && (
                                                <CheckCircle2 className="h-5 w-5 text-primary" />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </ScrollArea>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={handleClose}>
                        İptal
                    </Button>
                    <Button
                        onClick={handleGenerate}
                        disabled={selectedUnits.length === 0}
                    >
                        Rapor Oluştur ({selectedUnits.length})
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default UnitReportModal;
