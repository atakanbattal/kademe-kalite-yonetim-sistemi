import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Save, Trash2, Plus, Edit } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

const UnitCostModal = ({ open, setOpen, onSave, existingUnit }) => {
    const { toast } = useToast();
    const [unitName, setUnitName] = useState('');
    const [costPerMinute, setCostPerMinute] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isEditMode = !!existingUnit;

    useEffect(() => {
        if (existingUnit) {
            setUnitName(existingUnit.unit_name || '');
            setCostPerMinute(existingUnit.cost_per_minute || '');
        } else {
            setUnitName('');
            setCostPerMinute('');
        }
    }, [existingUnit, open]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!unitName || !costPerMinute) {
            toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Lütfen tüm alanları doldurun.' });
            return;
        }
        setIsSubmitting(true);
        const unitData = { unit_name: unitName, cost_per_minute: parseFloat(costPerMinute) };

        let error;
        if (isEditMode) {
            const { error: updateError } = await supabase.from('cost_settings').update(unitData).eq('id', existingUnit.id);
            error = updateError;
        } else {
            const { error: insertError } = await supabase.from('cost_settings').insert(unitData);
            error = insertError;
        }

        if (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: `Birim ${isEditMode ? 'güncellenemedi' : 'eklenemedi'}. Hata: ${error.message}` });
        } else {
            toast({ title: 'Başarılı!', description: `Birim başarıyla ${isEditMode ? 'güncellendi' : 'eklendi'}.` });
            onSave();
            setOpen(false);
        }
        setIsSubmitting(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{isEditMode ? 'Birimi Düzenle' : 'Yeni Birim Ekle'}</DialogTitle>
                    <DialogDescription>{isEditMode ? 'Birimin adını veya maliyetini güncelleyin.' : 'Yeni bir birim ve dakika başına maliyetini ekleyin.'}</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div>
                        <Label htmlFor="unitName">Birim Adı</Label>
                        <Input id="unitName" value={unitName} onChange={(e) => setUnitName(e.target.value)} required />
                    </div>
                    <div>
                        <Label htmlFor="costPerMinute">Maliyet (₺/dk)</Label>
                        <Input id="costPerMinute" type="number" step="0.01" value={costPerMinute} onChange={(e) => setCostPerMinute(e.target.value)} required />
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? (isEditMode ? 'Güncelleniyor...' : 'Ekleniyor...') : (isEditMode ? 'Güncelle' : 'Ekle')}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

const UnitCosts = () => {
    const { toast } = useToast();
    const [unitCosts, setUnitCosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedUnit, setSelectedUnit] = useState(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase.from('cost_settings').select('*').order('unit_name');
        if (error) toast({ variant: 'destructive', title: 'Birim maliyetleri alınamadı!' });
        else setUnitCosts(data || []);
        setLoading(false);
    }, [toast]);

    useEffect(() => { fetchData(); }, [fetchData]);
    
    const handleOpenModal = (unit = null) => {
        setSelectedUnit(unit);
        setIsModalOpen(true);
    };

    const deleteUnitCost = async (id) => {
        const { data: personnel, error: personnelError } = await supabase
            .from('personnel')
            .select('id')
            .eq('unit_id', id)
            .limit(1);

        if (personnelError) {
            toast({ variant: 'destructive', title: 'Hata!', description: 'Personel kontrolü sırasında bir hata oluştu.' });
            return;
        }

        if (personnel && personnel.length > 0) {
            toast({ variant: 'destructive', title: 'Silme Başarısız', description: 'Bu birim personellere atandığı için silinemez. Lütfen önce ilgili personellerin birimini değiştirin.' });
            return;
        }
        
        const { error } = await supabase.from('cost_settings').delete().eq('id', id);
        if (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: `Birim maliyeti silinemedi: ${error.message}` });
        } else {
            toast({ title: 'Başarılı!', description: `Birim maliyeti silindi.` });
            fetchData();
        }
    }

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="dashboard-widget">
            <UnitCostModal open={isModalOpen} setOpen={setIsModalOpen} onSave={fetchData} existingUnit={selectedUnit} />
            <div className="flex items-center justify-between mb-4">
                <h2 className="widget-title">Birim Maliyetleri Yönetimi</h2>
                <Button variant="outline" size="sm" onClick={() => handleOpenModal(null)}><Plus className="w-4 h-4 mr-2" /> Yeni Birim Ekle</Button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
                Burada tanımlanan birimler ve maliyetleri, Kalitesizlik Maliyetleri modülünde otomatik hesaplamalar için kullanılır.
            </p>
            <ScrollArea className="h-[60vh]">
                <div className="space-y-2 pr-4">
                    {loading ? <p className="text-muted-foreground">Yükleniyor...</p> : unitCosts.length === 0 ? <p className="text-muted-foreground text-center py-4">Henüz birim eklenmemiş.</p> : unitCosts.map(cost => (
                        <div key={cost.id} className="flex items-center gap-4 p-3 rounded-lg border border-border bg-card">
                            <div className="flex-1 font-semibold text-card-foreground">{cost.unit_name}</div>
                            <div className="flex-1 text-muted-foreground">{parseFloat(cost.cost_per_minute).toFixed(2)} ₺ / dk</div>
                            <div className="flex gap-2">
                                <Button size="icon" variant="ghost" onClick={() => handleOpenModal(cost)}><Edit className="w-4 h-4" /></Button>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive"><Trash2 className="w-4 h-4" /></Button></AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader><AlertDialogTitle>Emin misiniz?</AlertDialogTitle><AlertDialogDescription>Bu işlem geri alınamaz. "{cost.unit_name}" birimini kalıcı olarak sileceksiniz.</AlertDialogDescription></AlertDialogHeader>
                                        <AlertDialogFooter><AlertDialogCancel>İptal</AlertDialogCancel><AlertDialogAction onClick={() => deleteUnitCost(cost.id)} className="bg-destructive hover:bg-destructive/90">Sil</AlertDialogAction></AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </motion.div>
    );
};

export default UnitCosts;