import React, { useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { predefinedKpis } from './kpi-definitions';

const KpiSettingsModal = ({ open, setOpen, refreshKpis }) => {
    const { toast } = useToast();
    const [isUpdating, setIsUpdating] = useState(false);

    const handleUpdateAllAutoKpis = async () => {
        setIsUpdating(true);
        toast({ title: 'Güncelleme Başladı', description: 'Otomatik KPI değerleri güncelleniyor...' });

        const { data: autoKpis, error: fetchError } = await supabase
            .from('kpis')
            .select('id, auto_kpi_id')
            .eq('is_auto', true);

        if (fetchError) {
            toast({ variant: 'destructive', title: 'Hata!', description: 'Otomatik KPI listesi alınamadı.' });
            setIsUpdating(false);
            return;
        }

        let successCount = 0;
        let errorCount = 0;

        for (const kpi of autoKpis) {
            const predefined = predefinedKpis.find(p => p.id === kpi.auto_kpi_id);
            if (predefined && predefined.rpc_name) {
                const { data: rpcData, error: rpcError } = await supabase.rpc(predefined.rpc_name);
                if (!rpcError) {
                    await supabase.from('kpis').update({ current_value: rpcData }).eq('id', kpi.id);
                    successCount++;
                } else {
                    console.error(`Error updating KPI ${kpi.auto_kpi_id}:`, rpcError);
                    errorCount++;
                }
            }
        }

        toast({
            title: 'Güncelleme Tamamlandı',
            description: `${successCount} KPI başarıyla güncellendi, ${errorCount} KPI güncellenemedi.`,
        });
        
        refreshKpis();
        setIsUpdating(false);
        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>KPI Ayarları</DialogTitle>
                    <DialogDescription>Otomatik KPI'ların yönetimi.</DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <p className="text-sm text-muted-foreground mb-4">
                        Tüm otomatik KPI'ların mevcut değerlerini veritabanından yeniden hesaplayarak güncelleyebilirsiniz. Bu işlem biraz zaman alabilir.
                    </p>
                    <Button onClick={handleUpdateAllAutoKpis} disabled={isUpdating} className="w-full">
                        {isUpdating ? 'Güncelleniyor...' : "Tüm Otomatik KPI'ları Şimdi Güncelle"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default KpiSettingsModal;