import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Filter, CheckSquare, Square } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

const QuarantineReportFilterModal = ({ isOpen, setIsOpen, records, onGenerateReport }) => {
    const [selectedIds, setSelectedIds] = useState([]);
    const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'Karantinada', 'Tamamlandı', etc.

    // Durum filtresine göre kayıtları filtrele
    const filteredRecords = useMemo(() => {
        if (statusFilter === 'all') {
            return records;
        }
        return records.filter(r => r.status === statusFilter);
    }, [records, statusFilter]);

    // Mevcut durumları çıkar
    const availableStatuses = useMemo(() => {
        const statuses = new Set(records.map(r => r.status));
        return Array.from(statuses).sort();
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
        if (selectedIds.length === filteredRecords.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredRecords.map(r => r.id));
        }
    };

    const handleGenerate = () => {
        const selectedRecords = filteredRecords.filter(r => selectedIds.includes(r.id));
        if (selectedRecords.length === 0) {
            alert('Lütfen en az bir kayıt seçin.');
            return;
        }
        onGenerateReport(selectedRecords);
        setIsOpen(false);
        setSelectedIds([]); // Reset
        setStatusFilter('all'); // Reset filter
    };

    const handleCancel = () => {
        setIsOpen(false);
        setSelectedIds([]); // Reset
        setStatusFilter('all'); // Reset filter
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
                <DialogHeader className="flex-shrink-0">
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-primary" />
                        Karantina Raporu Oluştur
                    </DialogTitle>
                    <DialogDescription>
                        Rapora dahil edilecek kayıtları seçin. Durum filtresini kullanarak istediğiniz kayıtları görüntüleyebilirsiniz.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
                    {/* Durum Filtresi */}
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg flex-shrink-0">
                        <Filter className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Durum Filtresi:</span>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="Tüm Kayıtlar" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tüm Kayıtlar</SelectItem>
                                {availableStatuses.map(status => (
                                    <SelectItem key={status} value={status}>
                                        {status}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Badge variant="secondary" className="text-xs ml-auto">
                            {filteredRecords.length} kayıt
                        </Badge>
                    </div>

                    {/* Özet ve Tümünü Seç */}
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleSelectAll}
                                className="gap-2"
                            >
                                {selectedIds.length === filteredRecords.length && filteredRecords.length > 0 ? (
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
                                {selectedIds.length} / {filteredRecords.length} kayıt seçildi
                            </Badge>
                        </div>
                    </div>

                    {/* Kayıt Listesi */}
                    <ScrollArea className="flex-1 min-h-0 rounded-md border p-4">
                        {filteredRecords.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <Filter className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                <p className="font-medium">Kayıt bulunamadı</p>
                                <p className="text-sm mt-1">Seçili filtreye uygun kayıt bulunmamaktadır.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {filteredRecords.map((record) => {
                                    const isSelected = selectedIds.includes(record.id);
                                    
                                    // Durum rengini belirle
                                    const getStatusVariant = (status) => {
                                        switch (status) {
                                            case 'Karantinada': return 'destructive';
                                            case 'Tamamlandı': return 'default';
                                            case 'Serbest Bırakıldı': return 'default';
                                            default: return 'secondary';
                                        }
                                    };

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
                                                    <Badge variant={getStatusVariant(record.status)} className="text-xs shrink-0">
                                                        {record.status}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                    <span>{record.quantity} {record.unit}</span>
                                                    <span>{record.source_department || 'Belirtilmemiş'}</span>
                                                    <span>{format(new Date(record.quarantine_date), 'dd MMM yyyy', { locale: tr })}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </ScrollArea>

                    {/* Bilgi Mesajı */}
                    {selectedIds.length > 0 && (
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg flex-shrink-0">
                            <p className="text-sm text-blue-800 dark:text-blue-200">
                                <strong>Bilgi:</strong> Seçtiğiniz {selectedIds.length} kayıt PDF raporuna dahil edilecektir. 
                                Herhangi bir limit bulunmamaktadır.
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2 flex-shrink-0 mt-4">
                    <Button variant="outline" onClick={handleCancel}>
                        İptal
                    </Button>
                    <Button
                        onClick={handleGenerate}
                        disabled={selectedIds.length === 0 || filteredRecords.length === 0}
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

