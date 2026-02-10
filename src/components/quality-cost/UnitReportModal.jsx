import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Building2, CheckCircle2 } from 'lucide-react';
const formatCurrency = (value) => {
    if (typeof value !== 'number') return '-';
    return value.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
};

const UnitReportModal = ({ isOpen, setIsOpen, units, costs, onGenerate }) => {
    const [selectedUnits, setSelectedUnits] = useState([]);

    // Her birim için toplam maliyet hesapla (cost_allocations desteği ile)
    const unitStats = useMemo(() => {
        const stats = {};
        units.forEach(unit => {
            let totalAmount = 0;
            let count = 0;
            costs.forEach(cost => {
                if (cost.unit === unit) {
                    totalAmount += cost.amount || 0;
                    count += 1;
                } else if (cost.cost_allocations?.length) {
                    const alloc = cost.cost_allocations.find(a => a.unit === unit);
                    if (alloc) {
                        totalAmount += alloc.amount ?? (cost.amount || 0) * (parseFloat(alloc.percentage) / 100);
                        count += 1;
                    }
                }
            });
            stats[unit] = { count, totalAmount };
        });
        return stats;
    }, [units, costs]);

    const handleToggleUnit = (unit) => {
        setSelectedUnits(prev => {
            if (prev.includes(unit)) {
                return prev.filter(u => u !== unit);
            } else {
                return [...prev, unit];
            }
        });
    };

    const handleSelectAll = () => {
        if (selectedUnits.length === units.length) {
            setSelectedUnits([]);
        } else {
            setSelectedUnits([...units]);
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

    const totalSelectedAmount = selectedUnits.reduce((sum, unit) => {
        return sum + (unitStats[unit]?.totalAmount || 0);
    }, 0);

    const totalSelectedCount = selectedUnits.reduce((sum, unit) => {
        return sum + (unitStats[unit]?.count || 0);
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
                        Rapor oluşturmak istediğiniz birimleri seçin. Birden fazla birim seçebilirsiniz.
                    </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="select-all"
                                checked={selectedUnits.length === units.length && units.length > 0}
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
                        {units.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                Rapor oluşturulacak birim bulunamadı.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {units.map((unit) => {
                                    const isSelected = selectedUnits.includes(unit);
                                    const stats = unitStats[unit] || { count: 0, totalAmount: 0 };
                                    
                                    return (
                                        <div
                                            key={unit}
                                            className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                                                isSelected 
                                                    ? 'bg-primary/10 border-primary' 
                                                    : 'hover:bg-muted'
                                            }`}
                                            onClick={() => handleToggleUnit(unit)}
                                        >
                                            <div className="flex items-center space-x-3 flex-1">
                                                <Checkbox
                                                    checked={isSelected}
                                                    onCheckedChange={() => handleToggleUnit(unit)}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                                <div className="flex-1">
                                                    <Label className="font-semibold cursor-pointer text-base">
                                                        {unit}
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

