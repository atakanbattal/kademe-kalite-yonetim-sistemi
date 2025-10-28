import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Save, Plus } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

const AddMaterialModal = ({ open, setOpen, onMaterialAdded }) => {
    const { toast } = useToast();
    const [materialName, setMaterialName] = useState('');
    const [purchasePrice, setPurchasePrice] = useState('');
    const [scrapPrice, setScrapPrice] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!materialName || !purchasePrice || !scrapPrice) {
            toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Lütfen tüm alanları doldurun.' });
            return;
        }
        setIsSubmitting(true);
        const { error } = await supabase.from('material_costs').insert({
            material_name: materialName,
            purchase_price_per_kg: parseFloat(purchasePrice),
            scrap_price_per_kg: parseFloat(scrapPrice),
            include_labor_in_scrap: false
        });

        if (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: 'Malzeme eklenemedi.' });
        } else {
            toast({ title: 'Başarılı!', description: 'Yeni malzeme başarıyla eklendi.' });
            setMaterialName('');
            setPurchasePrice('');
            setScrapPrice('');
            onMaterialAdded();
            setOpen(false);
        }
        setIsSubmitting(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Yeni Malzeme Ekle</DialogTitle>
                    <DialogDescription>Yeni bir malzeme ve KG başına maliyet bilgilerini ekleyin.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div>
                        <Label htmlFor="materialName">Malzeme Adı</Label>
                        <Input id="materialName" value={materialName} onChange={(e) => setMaterialName(e.target.value)} required />
                    </div>
                    <div>
                        <Label htmlFor="purchasePrice">Alış Fiyatı (₺/kg)</Label>
                        <Input id="purchasePrice" type="number" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} required />
                    </div>
                    <div>
                        <Label htmlFor="scrapPrice">Hurda Fiyatı (₺/kg)</Label>
                        <Input id="scrapPrice" type="number" value={scrapPrice} onChange={(e) => setScrapPrice(e.target.value)} required />
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Ekleniyor...' : 'Malzeme Ekle'}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

const MaterialCosts = () => {
    const { toast } = useToast();
    const [materialCosts, setMaterialCosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase.from('material_costs').select('*').order('material_name');
        if (error) toast({ variant: 'destructive', title: 'Malzeme maliyetleri alınamadı!' }); else setMaterialCosts(data);
        setLoading(false);
    }, [toast]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleMaterialCostChange = (id, field, value) => {
        setMaterialCosts(costs => costs.map(c => c.id === id ? { ...c, [field]: value } : c));
    };
    
    const handleMaterialCostCheckboxChange = (id, field, checked) => {
        setMaterialCosts(costs => costs.map(c => c.id === id ? { ...c, [field]: checked } : c));
    };

    const saveMaterialCost = async (id) => {
        const costToSave = materialCosts.find(c => c.id === id);
        const { error } = await supabase.from('material_costs').update({
            purchase_price_per_kg: costToSave.purchase_price_per_kg,
            scrap_price_per_kg: costToSave.scrap_price_per_kg,
            include_labor_in_scrap: costToSave.include_labor_in_scrap
        }).eq('id', id);
        if (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: 'Malzeme maliyeti güncellenemedi.' });
        } else {
            toast({ title: 'Başarılı!', description: `${costToSave.material_name} maliyeti güncellendi.` });
        }
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="dashboard-widget">
            <AddMaterialModal open={isMaterialModalOpen} setOpen={setIsMaterialModalOpen} onMaterialAdded={fetchData} />
            <div className="flex items-center justify-between mb-4">
                <h2 className="widget-title">Malzeme Maliyetleri (KG Başına)</h2>
                <Button variant="outline" size="sm" onClick={() => setIsMaterialModalOpen(true)}><Plus className="w-4 h-4 mr-2" /> Yeni Malzeme Ekle</Button>
            </div>
            <div className="space-y-6">
                {loading ? <p className="text-muted-foreground">Yükleniyor...</p> : materialCosts.map(cost => (
                    <div key={cost.id} className="grid grid-cols-1 md:grid-cols-5 items-center gap-4 p-3 rounded-lg border border-border">
                        <Label className="font-semibold md:col-span-1">{cost.material_name}</Label>
                        <div className="grid grid-cols-2 gap-2 md:col-span-3">
                            <div><Label className="text-xs">Alış Fiyatı</Label><Input type="number" value={cost.purchase_price_per_kg} onChange={e => handleMaterialCostChange(cost.id, 'purchase_price_per_kg', e.target.value)} /></div>
                            <div><Label className="text-xs">Hurda Fiyatı</Label><Input type="number" value={cost.scrap_price_per_kg} onChange={e => handleMaterialCostChange(cost.id, 'scrap_price_per_kg', e.target.value)} /></div>
                        </div>
                        <div className="flex flex-col gap-2 md:col-span-1">
                            <div className="flex items-center space-x-2"><Checkbox id={`labor-${cost.id}`} checked={cost.include_labor_in_scrap} onCheckedChange={(checked) => handleMaterialCostCheckboxChange(cost.id, 'include_labor_in_scrap', checked)} /><Label htmlFor={`labor-${cost.id}`} className="text-sm font-normal">İşçilik Ekle</Label></div>
                            <Button size="sm" onClick={() => saveMaterialCost(cost.id)}><Save className="w-4 h-4 mr-2" /> Kaydet</Button>
                        </div>
                    </div>
                ))}
            </div>
        </motion.div>
    );
};

export default MaterialCosts;