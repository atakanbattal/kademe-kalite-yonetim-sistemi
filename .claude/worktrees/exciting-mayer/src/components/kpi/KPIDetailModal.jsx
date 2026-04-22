import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Save, Trash2, TrendingUp } from 'lucide-react';


const KPIDetailModal = ({ kpi, open, setOpen, refreshKpis }) => {
    const { toast } = useToast();
    const [targetValue, setTargetValue] = useState(kpi?.target_value || '');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (kpi) {
            setTargetValue(kpi.target_value !== null ? String(kpi.target_value) : '');
        }
    }, [kpi]);
    
    // Mock historical data for the chart. In a real scenario, this would be fetched.
    const historicalData = useMemo(() => {
        if (!kpi || kpi.current_value === null) return [];
        const baseValue = parseFloat(kpi.current_value);
        return [
            { month: 'Mayıs', value: baseValue * (1 + Math.random() * 0.2 - 0.1) },
            { month: 'Haziran', value: baseValue * (1 + Math.random() * 0.2 - 0.1) },
            { month: 'Temmuz', value: baseValue * (1 + Math.random() * 0.2 - 0.1) },
            { month: 'Ağustos', value: baseValue },
        ].map(d => ({...d, value: parseFloat(d.value.toFixed(2))}));
    }, [kpi]);

    const handleTargetUpdate = async () => {
        if (!kpi) return;
        setIsSubmitting(true);
        const newTarget = targetValue === '' ? null : parseFloat(targetValue);
        const { error } = await supabase
            .from('kpis')
            .update({ target_value: newTarget })
            .eq('id', kpi.id);
        
        if (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: 'Hedef güncellenemedi.' });
        } else {
            toast({ title: 'Başarılı!', description: 'KPI hedefi güncellendi.' });
            refreshKpis();
            setOpen(false);
        }
        setIsSubmitting(false);
    };

    const handleDelete = async () => {
        if (!kpi) return;
        setIsSubmitting(true);
        const { error } = await supabase.from('kpis').delete().eq('id', kpi.id);
        if (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: 'KPI silinemedi.' });
        } else {
            toast({ title: 'Başarılı!', description: 'KPI silindi.' });
            refreshKpis();
            setOpen(false);
        }
        setIsSubmitting(false);
    };

    if (!kpi) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
        <header className="bg-gradient-to-r from-primary to-blue-700 px-6 py-5 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-2.5 rounded-lg"><TrendingUp className="h-5 w-5 text-white" /></div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">KPI Detayları: {kpi.name}</h1>
              <p className="text-[11px] text-blue-100 uppercase tracking-[0.15em] font-medium">{kpi.description}</p>
            </div>
            <span className="px-3 py-1 bg-white/20 border border-white/30 text-white/90 text-[10px] font-bold rounded-full uppercase tracking-wider">Detay</span>
          </div>
        </header>
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-4 pb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
                <h4 className="font-semibold text-foreground">Mevcut Durum</h4>
                <div className="flex justify-between items-center p-4 bg-secondary rounded-lg">
                    <span className="text-foreground">Gerçekleşen</span>
                    <span className="text-2xl font-bold text-foreground">{kpi.current_value !== null ? parseFloat(kpi.current_value).toFixed(2) : 'N/A'}{kpi.unit}</span>
                </div>
                 <div className="flex justify-between items-center p-4 bg-secondary rounded-lg">
                    <span className="text-foreground">Hedef Yönü</span>
                    <span className="font-semibold text-foreground">{kpi.target_direction === 'decrease' ? 'Azalt (Düşük olan iyi)' : 'Artır (Yüksek olan iyi)'}</span>
                </div>
                <div>
                    <Label htmlFor="targetValue" className="text-foreground">Hedef Değeri Güncelle</Label>
                    <div className="flex gap-2 mt-1">
                        <Input id="targetValue" type="number" value={targetValue} onChange={e => setTargetValue(e.target.value)} className="flex-grow" placeholder="Hedef girin..."/>
                        <Button onClick={handleTargetUpdate} disabled={isSubmitting}>
                            <Save className="w-4 h-4 mr-2" /> {isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
                        </Button>
                    </div>
                </div>
            </div>
            <div>
                 <h4 className="font-semibold mb-2 text-foreground">Aylık Trend</h4>
                 <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={historicalData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="month" stroke="hsl(var(--foreground))" fontSize={12} />
                        <YAxis stroke="hsl(var(--foreground))" fontSize={12} />
                        <Tooltip 
                            contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '0.5rem' }} 
                            labelStyle={{ color: 'hsl(var(--foreground))' }}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="value" name="Gerçekleşen" stroke="var(--color-primary)" strokeWidth={2} activeDot={{ r: 8 }} />
                        {kpi.target_value !== null && <Line type="monotone" dataKey={() => kpi.target_value} name="Hedef" stroke="var(--color-destructive)" strokeWidth={2} strokeDasharray="5 5" dot={false} />}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
        </div>
        <DialogFooter className="justify-between sm:justify-between w-full shrink-0">
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={isSubmitting}><Trash2 className="w-4 h-4 mr-2" /> KPI'yı Sil</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                        <AlertDialogDescription>
                            "{kpi.name}" adlı KPI'yı kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>İptal</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Sil</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
          <Button variant="outline" onClick={() => setOpen(false)}>Kapat</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default KPIDetailModal;