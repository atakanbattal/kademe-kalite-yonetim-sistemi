import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';

const getStatusVariant = (status) => {
    switch (status) {
        case 'Kapatıldı':
        case 'Tamamlandı':
        case 'Onaylandı':
            return 'success';
        case 'Açık':
        case 'Aksiyon Bekliyor':
        case 'Onay Bekliyor':
            return 'warning';
        case 'Reddedildi':
        case 'İptal Edildi':
            return 'destructive';
        default:
            return 'default';
    }
};

const DashboardDetailModal = ({ isOpen, setIsOpen, title, records, renderItem, onRowClick }) => {
    const { toast } = useToast();
    
    const handleRowClick = (record) => {
        if (record && record.module) {
            onRowClick(record.module);
        } else {
             toast({
                title: "🚧 Navigasyon Hatası!",
                description: "Bu kayıt için ilgili modül bulunamadı. 🚀",
            });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
                <DialogHeader>
                    <DialogTitle>{title} Detayları</DialogTitle>
                    <DialogDescription>
                        Bu kategoriye ait tüm kayıtların listesi aşağıdadır. Kaydı görüntülemek için üzerine tıklayın.
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="h-96 pr-4">
                    <div className="space-y-3">
                        {records && records.length > 0 ? (
                            records.map((record, index) => (
                                <div 
                                    key={record.id || index} 
                                    className="p-3 bg-secondary rounded-lg flex justify-between items-center cursor-pointer hover:bg-accent transition-colors"
                                    onClick={() => onRowClick && handleRowClick(record)}
                                >
                                    {renderItem(record)}
                                </div>
                            ))
                        ) : (
                            <p className="text-muted-foreground text-center py-10">Görüntülenecek kayıt bulunamadı.</p>
                        )}
                    </div>
                </ScrollArea>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>Kapat</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export const renderNCItem = (record) => (
    <>
        <div>
            <p className="font-semibold">{record.title || record.nc_number}</p>
            <p className="text-sm text-muted-foreground">{record.department || 'Belirtilmemiş'}</p>
        </div>
        <Badge variant={getStatusVariant(record.status)}>{record.status}</Badge>
    </>
);

export const renderCostItem = (record) => (
    <>
        <div>
            <p className="font-semibold">{record.part_name || record.cost_type}</p>
            <p className="text-sm text-muted-foreground">{new Date(record.cost_date).toLocaleDateString('tr-TR')}</p>
        </div>
        <span className="font-bold text-lg text-primary">{record.amount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}</span>
    </>
);

export default DashboardDetailModal;