import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CostViewModal } from './CostViewModal';

const formatCurrency = (value) => {
    if (typeof value !== 'number') return '-';
    return value.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
}

export const CostDetailModal = ({ isOpen, setOpen, title, costs }) => {
    const [isRecordViewOpen, setRecordViewOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState(null);

    const handleRowClick = (cost) => {
        setSelectedRecord(cost);
        setRecordViewOpen(true);
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
                    <DialogHeader className="shrink-0">
                        <DialogTitle className="text-primary">{title}</DialogTitle>
                        <DialogDescription>
                            Bu kategoriye ait maliyet kayıtlarının detayları aşağıda listelenmiştir.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto pr-4 pb-4">
                        <div className="dashboard-widget">
                            <div className="overflow-x-auto">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Tarih</th>
                                            <th>Maliyet Türü</th>
                                            <th>Parça Adı</th>
                                            <th>Tutar</th>
                                            <th>Miktar</th>
                                            <th>Ağırlık (Kg)</th>
                                            <th>Birim</th>
                                            <th>Açıklama</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {costs && costs.length > 0 ? (
                                            costs.map(cost => (
                                                <tr key={cost.id} className="cursor-pointer hover:bg-accent" onClick={() => handleRowClick(cost)}>
                                                    <td>{new Date(cost.cost_date).toLocaleDateString('tr-TR')}</td>
                                                    <td>{cost.cost_type}</td>
                                                    <td>{cost.part_name || '-'}</td>
                                                    <td className="font-semibold">{formatCurrency(cost.amount)}</td>
                                                    <td>{cost.quantity || '-'}</td>
                                                    <td>{cost.scrap_weight || '-'}</td>
                                                    <td>{cost.measurement_unit || '-'}</td>
                                                    <td className="max-w-xs truncate">{cost.description || '-'}</td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan="8" className="text-center p-8 text-muted-foreground">
                                                    Görüntülenecek kayıt bulunamadı.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="shrink-0">
                        <DialogClose asChild>
                            <Button type="button" variant="secondary">Kapat</Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            
            {selectedRecord && (
                <CostViewModal 
                    isOpen={isRecordViewOpen}
                    setOpen={setRecordViewOpen}
                    cost={selectedRecord}
                />
            )}
        </>
    );
};