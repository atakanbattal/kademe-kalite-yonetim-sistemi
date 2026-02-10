import React from 'react';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LayoutDashboard } from 'lucide-react';
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
                <header className="bg-gradient-to-r from-primary to-blue-700 px-6 py-5 flex items-center justify-between text-white shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/20 p-2.5 rounded-lg"><LayoutDashboard className="h-5 w-5 text-white" /></div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight">{title} Detayları</h1>
                            <p className="text-[11px] text-blue-100 uppercase tracking-[0.15em] font-medium">Kaydı görüntülemek için üzerine tıklayın</p>
                        </div>
                        <span className="px-3 py-1 bg-white/20 border border-white/30 text-white/90 text-[10px] font-bold rounded-full uppercase tracking-wider">Liste</span>
                    </div>
                </header>
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-4 pb-6">
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
                </div>
                <DialogFooter className="shrink-0">
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