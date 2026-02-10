import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, History } from 'lucide-react';

const VehicleHistoryModal = ({ isOpen, setIsOpen, vehicle }) => {
    const { toast } = useToast();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchHistory = useCallback(async () => {
        if (!vehicle?.id) return;
        setLoading(true);
        const { data, error } = await supabase
            .from('quality_inspection_history')
            .select('*')
            .eq('inspection_id', vehicle.id)
            .order('changed_at', { ascending: false });

        if (error) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Araç geçmişi alınamadı.' });
        } else {
            setHistory(data);
        }
        setLoading(false);
    }, [vehicle, toast]);

    useEffect(() => {
        if (isOpen) {
            fetchHistory();
        }
    }, [isOpen, fetchHistory]);

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleString('tr-TR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusVariant = (status) => {
        switch (status) {
            case 'Onaylanmış': return 'success';
            case 'Yeniden İşlem': return 'destructive';
            case 'Kalitede Bekleyen': return 'warning';
            case 'Sevk Edilmiş': return 'info';
            default: return 'default';
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
                <header className="bg-gradient-to-r from-primary to-blue-700 px-6 py-5 flex items-center justify-between text-white shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/20 p-2.5 rounded-lg"><History className="h-5 w-5 text-white" /></div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight">Araç Geçmişi: {vehicle?.serial_no}</h1>
                            <p className="text-[11px] text-blue-100 uppercase tracking-[0.15em] font-medium">Kalite sürecindeki durum değişiklikleri</p>
                        </div>
                        <span className="px-3 py-1 bg-white/20 border border-white/30 text-white/90 text-[10px] font-bold rounded-full uppercase tracking-wider">Geçmiş</span>
                    </div>
                </header>
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-4 pb-6">
                    {loading ? (
                        <p>Yükleniyor...</p>
                    ) : history.length === 0 ? (
                        <p className="text-muted-foreground text-center py-4">Geçmiş kaydı bulunmuyor.</p>
                    ) : (
                        <div className="relative pl-6">
                            <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-border"></div>
                            {history.map((item, index) => (
                                <div key={item.id} className="relative mb-8">
                                    <div className="absolute -left-[29px] top-1.5 h-4 w-4 rounded-full bg-primary"></div>
                                    <div className="pl-4">
                                        <div className="flex items-center gap-2">
                                            <Badge variant={getStatusVariant(item.status)}>{item.status}</Badge>
                                        </div>
                                        <p className="text-sm text-muted-foreground mt-1">{formatDate(item.changed_at)}</p>
                                        {item.changed_by_name && <p className="text-xs text-muted-foreground">Değiştiren: {item.changed_by_name}</p>}
                                        {item.notes && <p className="mt-2 p-2 bg-secondary rounded-md text-sm">{item.notes}</p>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <DialogFooter className="shrink-0">
                    <Button variant="outline" onClick={() => setIsOpen(false)}>Kapat</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default VehicleHistoryModal;