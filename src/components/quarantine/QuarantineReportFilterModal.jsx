import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { FileText, Filter, CheckSquare, Square } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

const QuarantineReportFilterModal = ({ isOpen, setIsOpen, records, onGenerateReport }) => {
    const [selectedIds, setSelectedIds] = useState([]);

    // Sadece "Karantinada" durumundaki kayıtları filtrele
    const activeRecords = useMemo(() => {
        return records.filter(r => r.status === 'Karantinada');
    }, [records]);

    const handleToggleRecord = (id) => {
        setSelectedIds(prev => {
            if (prev.includes(id)) {
                return prev.filter(i => i !== id);
            } else {
                return [...prev, id];
            }
        });
    };

    const handleSelectAll = () => {
        if (selectedIds.length === activeRecords.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(activeRecords.map(r => r.id));
        }
    };

    const handleGenerate = () => {
        const selectedRecords = activeRecords.filter(r => selectedIds.includes(r.id));
        if (selectedRecords.length === 0) {
            alert('Lütfen en az bir kayıt seçin.');
            return;
        }
        onGenerateReport(selectedRecords);
        setIsOpen(false);
        setSelectedIds([]); // Reset
    };

    const handleCancel = () => {
        setIsOpen(false);
        setSelectedIds([]); // Reset
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="max-w-3xl max-h-[80vh]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-primary" />
                        Karantina Raporu Oluştur
                    </DialogTitle>
                    <DialogDescription>
                        Rapora dahil edilecek kayıtları seçin. Sadece <strong>Karantinada</strong> durumundaki kayıtlar gösterilmektedir.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Özet ve Tümünü Seç */}
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleSelectAll}
                                className="gap-2"
                            >
                                {selectedIds.length === activeRecords.length ? (
                                    <>
                                        <CheckSquare className="w-4 h-4" />
                                        Tümünü Kaldır
                                    </>
                                ) : (
                                    <>
                                        <Square className="w-4 h-4" />
                                        Tümünü Seç
                                    </>
                                )}
                            </Button>
                            <Badge variant="secondary" className="text-sm">
                                {selectedIds.length} / {activeRecords.length} kayıt seçildi
                            </Badge>
                        </div>
                        {selectedIds.length > 0 && (
                            <Badge variant="outline" className="text-xs">
                                Tahmini URL: ~{Math.round(selectedIds.length * 400)} karakter
                            </Badge>
                        )}
                    </div>

                    {/* Kayıt Listesi */}
                    <ScrollArea className="h-[400px] rounded-md border p-4">
                        {activeRecords.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <Filter className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                <p className="font-medium">Karantinada bekleyen ürün bulunmuyor</p>
                                <p className="text-sm mt-1">Rapor oluşturmak için en az bir kayıt "Karantinada" durumunda olmalıdır.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {activeRecords.map((record) => {
                                    const isSelected = selectedIds.includes(record.id);
                                    return (
                                        <div
                                            key={record.id}
                                            className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer hover:bg-accent/50 ${
                                                isSelected ? 'bg-accent border-primary' : 'bg-card'
                                            }`}
                                            onClick={() => handleToggleRecord(record.id)}
                                        >
                                            <Checkbox
                                                checked={isSelected}
                                                onCheckedChange={() => handleToggleRecord(record.id)}
                                                className="mt-1"
                                            />
                                            <div className="flex-1 space-y-1">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex-1">
                                                        <p className="font-medium text-sm text-foreground">
                                                            {record.part_name}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            Kod: {record.part_code} / Lot: {record.lot_no || '-'}
                                                        </p>
                                                    </div>
                                                    <Badge variant="destructive" className="text-xs shrink-0">
                                                        {record.status}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                    <span>📦 {record.quantity} {record.unit}</span>
                                                    <span>🏢 {record.source_department || 'Belirtilmemiş'}</span>
                                                    <span>📅 {format(new Date(record.quarantine_date), 'dd MMM yyyy', { locale: tr })}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </ScrollArea>

                    {/* Uyarı Mesajı */}
                    {selectedIds.length > 5 && (
                        <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                            <p className="text-sm text-amber-800 dark:text-amber-200">
                                ⚠️ <strong>Dikkat:</strong> Çok fazla kayıt seçilirse URL limiti aşılabilir. 
                                5 kayıttan fazla seçerseniz rapor oluşturulamayabilir.
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={handleCancel}>
                        İptal
                    </Button>
                    <Button
                        onClick={handleGenerate}
                        disabled={selectedIds.length === 0 || activeRecords.length === 0}
                        className="gap-2"
                    >
                        <FileText className="w-4 h-4" />
                        Rapor Oluştur ({selectedIds.length} kayıt)
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default QuarantineReportFilterModal;

