import React, { useState, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Zap, TrendingUp } from 'lucide-react';
import { predefinedKpis } from './kpi-definitions';
import { ScrollArea } from '@/components/ui/scroll-area';

const AddKpiModal = ({ open, setOpen, refreshKpis, existingKpis }) => {
    const { toast } = useToast();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [dataSource, setDataSource] = useState('');
    const [targetValue, setTargetValue] = useState('');
    const [targetDirection, setTargetDirection] = useState('decrease');
    const [unit, setUnit] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const resetForm = () => {
        setName('');
        setDescription('');
        setDataSource('');
        setTargetValue('');
        setTargetDirection('decrease');
        setUnit('');
    };

    const handleManualSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        const { error } = await supabase.from('kpis').insert({
            name,
            description,
            data_source: dataSource,
            target_value: targetValue ? parseFloat(targetValue) : null,
            target_direction: targetDirection,
            unit,
            current_value: 0,
            is_auto: false,
        });

        if (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: `KPI eklenemedi: ${error.message}`});
        } else {
            toast({ title: 'Başarılı!', description: 'Yeni KPI başarıyla eklendi.' });
            refreshKpis();
            setOpen(false);
            resetForm();
        }
        setIsSubmitting(false);
    };

    const handleAutoAdd = async (predefinedKpi) => {
        setIsSubmitting(true);

        const { data: rpcData, error: rpcError } = await supabase.rpc(predefinedKpi.rpc_name);

        if (rpcError) {
             toast({ variant: 'destructive', title: 'Hata!', description: `Otomatik KPI değeri alınamadı: ${rpcError.message}` });
             setIsSubmitting(false);
             return;
        }

        const { error } = await supabase.from('kpis').insert({
            name: predefinedKpi.name,
            description: predefinedKpi.description,
            data_source: predefinedKpi.data_source,
            target_value: 0, // Default target
            target_direction: predefinedKpi.target_direction,
            unit: predefinedKpi.unit,
            current_value: rpcData,
            is_auto: true,
            auto_kpi_id: predefinedKpi.id,
        });

         if (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: `Otomatik KPI eklenemedi: ${error.message}`});
        } else {
            toast({ title: 'Başarılı!', description: `${predefinedKpi.name} KPI'ı başarıyla eklendi.` });
            refreshKpis();
            setOpen(false);
        }

        setIsSubmitting(false);
    };
    
    const availablePredefinedKpis = useMemo(() => {
        const existingAutoIds = existingKpis.filter(k => k.is_auto).map(k => k.auto_kpi_id);
        return predefinedKpis.filter(pk => !existingAutoIds.includes(pk.id));
    }, [existingKpis]);

    return (
        <Dialog open={open} onOpenChange={(isOpen) => { if(!isOpen) resetForm(); setOpen(isOpen); }}>
            <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
                <header className="bg-gradient-to-r from-primary to-blue-700 px-6 py-5 flex items-center justify-between text-white shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/20 p-2.5 rounded-lg"><TrendingUp className="h-5 w-5 text-white" /></div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight">Yeni KPI Ekle</h1>
                            <p className="text-[11px] text-blue-100 uppercase tracking-[0.15em] font-medium">Key Performance Indicator</p>
                        </div>
                        <span className="px-3 py-1 bg-white/20 border border-white/30 text-white/90 text-[10px] font-bold rounded-full uppercase tracking-wider">Yeni</span>
                    </div>
                </header>
                <div className="flex flex-1 min-h-0 overflow-hidden">
                <div className="flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden border-r border-border py-4">
                <Tabs defaultValue="auto" className="w-full p-6">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="auto">Otomatik Ekle</TabsTrigger>
                        <TabsTrigger value="manual">Manuel Ekle</TabsTrigger>
                    </TabsList>
                    <TabsContent value="auto" className="py-4">
                        <ScrollArea className="h-96 pr-4">
                            <div className="space-y-4">
                                <p className="text-sm text-muted-foreground">Sistemdeki verilerden otomatik olarak hesaplanan bir KPI seçin.</p>
                                {availablePredefinedKpis.length > 0 ? availablePredefinedKpis.map(kpi => (
                                    <div key={kpi.id} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                                        <div>
                                            <h4 className="font-semibold text-foreground">{kpi.name}</h4>
                                            <p className="text-xs text-muted-foreground">{kpi.description}</p>
                                        </div>
                                        <Button size="sm" onClick={() => handleAutoAdd(kpi)} disabled={isSubmitting}>
                                            <Zap className="w-4 h-4 mr-2" /> Ekle
                                        </Button>
                                    </div>
                                )) : (
                                    <p className="text-center text-muted-foreground p-4">Tüm otomatik KPI'lar zaten eklenmiş.</p>
                                )}
                            </div>
                        </ScrollArea>
                    </TabsContent>
                    <TabsContent value="manual">
                        <form id="add-kpi-form" onSubmit={handleManualSubmit} className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="name" className="text-right text-foreground">Ad</Label>
                                <Input id="name" value={name} onChange={e => setName(e.target.value)} className="col-span-3" required />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="description" className="text-right text-foreground">Açıklama</Label>
                                <Input id="description" value={description} onChange={e => setDescription(e.target.value)} className="col-span-3" />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="dataSource" className="text-right text-foreground">Veri Kaynağı</Label>
                                <Input id="dataSource" value={dataSource} onChange={e => setDataSource(e.target.value)} className="col-span-3" placeholder="örn: Manuel, Üretim Raporları" />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="targetValue" className="text-right text-foreground">Hedef Değer</Label>
                                <Input id="targetValue" type="number" value={targetValue} onChange={e => setTargetValue(e.target.value)} className="col-span-3" />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="targetDirection" className="text-right text-foreground">Hedef Yönü</Label>
                                <Select onValueChange={setTargetDirection} value={targetDirection}>
                                    <SelectTrigger className="col-span-3">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="increase">Artır (Daha yüksek daha iyi)</SelectItem>
                                        <SelectItem value="decrease">Azalt (Daha düşük daha iyi)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="unit" className="text-right text-foreground">Birim</Label>
                                <Input id="unit" value={unit} onChange={e => setUnit(e.target.value)} className="col-span-3" placeholder="örn: %, gün, adet" />
                            </div>
                        </form>
                    </TabsContent>
                </Tabs>
                </div>
                <aside className="w-[320px] min-w-[280px] shrink-0 min-h-0 overflow-y-auto bg-muted/30 py-4 px-6">
                    <h3 className="text-sm font-semibold text-foreground mb-3">Özet</h3>
                    <div className="space-y-2 text-sm text-muted-foreground">
                        <p>KPI ekleyerek hedeflerinizi takip edebilirsiniz.</p>
                        <p>Otomatik mod: Var olan KPIden türetilir.</p>
                        <p>Manuel mod: Özel KPI tanımlayabilirsiniz.</p>
                    </div>
                </aside>
                </div>
                <footer className="flex shrink-0 justify-end gap-2 px-6 py-4 border-t border-border bg-muted/20">
                    <Button variant="outline" onClick={() => setOpen(false)}>İptal</Button>
                    <Button form="add-kpi-form" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Ekleniyor...' : 'KPI Oluştur'}</Button>
                </footer>
            </DialogContent>
        </Dialog>
    );
};

export default AddKpiModal;