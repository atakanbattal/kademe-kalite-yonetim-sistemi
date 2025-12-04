import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

const DetailItem = ({ label, value, isCurrency = false }) => (
    <div className="grid grid-cols-3 gap-2 py-2 border-b border-border">
        <Label className="font-semibold text-muted-foreground col-span-1">{label}</Label>
        <p className="text-foreground col-span-2">{isCurrency ? formatCurrency(value) : (value || '-')}</p>
    </div>
);

const formatCurrency = (value) => {
    if (typeof value !== 'number') return '-';
    return value.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
}

export const CostViewModal = ({ isOpen, setOpen, cost }) => {
    if (!cost) return null;

    const mainReworkCost = cost.rework_duration ? `(Ana: ${cost.rework_duration} dk)` : '';
    const affectedUnitsCosts = cost.affected_units && cost.affected_units.length > 0
        ? cost.affected_units.map(au => `${au.unit}: ${au.duration} dk`).join(', ')
        : '';
    
    const reworkDetails = [mainReworkCost, affectedUnitsCosts].filter(Boolean).join(' | ');

    return (
        <Dialog open={isOpen} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="text-primary">Maliyet Kaydı Detayı</DialogTitle>
                    <DialogDescription>
                        Maliyet kaydına ait tüm bilgiler aşağıda listelenmiştir.
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] pr-4 mt-4">
                    <div className="space-y-2">
                        {cost.is_supplier_nc && (
                            <div className="grid grid-cols-3 gap-2 py-3 border-b border-border bg-orange-50 dark:bg-orange-950/20 p-3 rounded-md">
                                <Label className="font-semibold text-muted-foreground col-span-1">Tedarikçi</Label>
                                <div className="col-span-2">
                                    <Badge variant="default" className="bg-orange-500">
                                        {cost.supplier?.name || 'Tedarikçi Bilgisi Yok'}
                                    </Badge>
                                </div>
                            </div>
                        )}
                        <DetailItem label="Maliyet Türü" value={cost.cost_type} />
                        <DetailItem label="Tutar" value={cost.amount} isCurrency={true} />
                        <DetailItem label="Tarih" value={new Date(cost.cost_date).toLocaleDateString('tr-TR')} />
                        <DetailItem label="Birim (Kaynak)" value={cost.unit} />
                        <DetailItem label="Araç Türü" value={cost.vehicle_type} />
                        <DetailItem label="Parça Kodu" value={cost.part_code} />
                        <DetailItem label="Parça Adı" value={cost.part_name} />
                        <DetailItem label="Sorumlu Personel" value={cost.responsible_personnel?.full_name} />
                        <DetailItem label="Durum" value={cost.status} />

                        {cost.cost_type === 'Yeniden İşlem Maliyeti' && (
                            <DetailItem label="İşlem Süreleri" value={reworkDetails} />
                        )}

                        {cost.quantity && <DetailItem label="Miktar" value={cost.quantity} />}
                        {cost.measurement_unit && <DetailItem label="Ölçü Birimi" value={cost.measurement_unit} />}
                        {cost.scrap_weight && <DetailItem label="Hurda Ağırlığı (kg)" value={cost.scrap_weight} />}
                        <DetailItem label="Açıklama" value={cost.description} />
                    </div>
                </ScrollArea>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="secondary">Kapat</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};