import React, { useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { AlertTriangle } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

const SupplierNCFormModal = ({ isOpen, setIsOpen, supplier, refreshData, onOpenNCForm }) => {
    const { toast } = useToast();
    const [formData, setFormData] = useState({ title: '', description: '', cost_impact: 0 });
    const [createDF, setCreateDF] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleInputChange = (e) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        const ncData = {
            supplier_id: supplier.id,
            title: formData.title,
            description: formData.description,
            cost_impact: formData.cost_impact || 0,
            status: 'Açık',
        };

        const { data: newNC, error } = await supabase
            .from('supplier_non_conformities')
            .insert(ncData)
            .select()
            .single();

        if (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: 'Uygunsuzluk oluşturulamadı: ' + error.message });
            setIsSubmitting(false);
            return;
        }

        toast({ title: 'Başarılı!', description: 'Tedarikçi uygunsuzluğu başarıyla oluşturuldu.' });

        if (createDF) {
            onOpenNCForm('DF', {
                source: 'supplier',
                source_id: newNC.id,
                title: `Tedarikçi UGS: ${supplier.name} - ${formData.title}`,
                description: formData.description,
                supplier_name: supplier.name,
            });
        }
        
        if (refreshData) refreshData();
        setIsOpen(false);
        setIsSubmitting(false);
        setFormData({ title: '', description: '', cost_impact: 0 });
        setCreateDF(false);
    };

    if (!supplier) return null;

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
                <header className="bg-gradient-to-r from-primary to-blue-700 px-6 py-5 flex items-center justify-between text-white shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/20 p-2.5 rounded-lg"><AlertTriangle className="h-5 w-5 text-white" /></div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight">Uygunsuzluk Aç: {supplier.name}</h1>
                            <p className="text-[11px] text-blue-100 uppercase tracking-[0.15em] font-medium">Tedarikçi uygunsuzluğu</p>
                        </div>
                        <span className="px-3 py-1 bg-white/20 border border-white/30 text-white/90 text-[10px] font-bold rounded-full uppercase tracking-wider">Yeni</span>
                    </div>
                </header>
                <form id="supplier-nc-form" onSubmit={handleSubmit} className="flex flex-1 min-h-0 overflow-hidden">
                    <div className="flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden border-r border-border py-4">
                    <div className="p-6 space-y-4">
                    <div>
                        <Label htmlFor="title">Başlık <span className="text-red-500">*</span></Label>
                        <Input id="title" value={formData.title} onChange={handleInputChange} required />
                    </div>
                    <div>
                        <Label htmlFor="description">Açıklama / Problem Tanımı <span className="text-red-500">*</span></Label>
                        <Textarea id="description" value={formData.description} onChange={handleInputChange} required />
                    </div>
                    <div>
                        <Label htmlFor="cost_impact">Maliyet Etkisi (₺)</Label>
                        <Input id="cost_impact" type="number" value={formData.cost_impact} onChange={handleInputChange} />
                    </div>
                    <div className="flex items-center space-x-2 pt-2">
                        <Checkbox id="create-df" checked={createDF} onCheckedChange={setCreateDF} />
                        <Label htmlFor="create-df" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            Bu uygunsuzluk için aynı zamanda bir DF (Düzeltici Faaliyet) başlat.
                        </Label>
                    </div>
                    </div>
                    </div>
                    <div className="w-[320px] min-w-[280px] shrink-0 min-h-0 overflow-y-auto bg-muted/30 py-4">
                        <div className="p-5 space-y-5">
                            <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Özet</h2>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between"><span className="text-muted-foreground">Başlık:</span><span className="font-medium truncate ml-2">{formData.title || '-'}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Maliyet:</span><span className="font-medium">{formData.cost_impact ? formData.cost_impact + ' ₺' : '-'}</span></div>
                            </div>
                        </div>
                    </div>
                </form>
                <footer className="bg-background px-6 py-4 border-t border-border flex justify-end gap-3 shrink-0">
                    <Button onClick={() => setIsOpen(false)} variant="outline">İptal</Button>
                    <Button form="supplier-nc-form" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Oluşturuluyor...' : 'Uygunsuzluk Oluştur'}</Button>
                </footer>
            </DialogContent>
        </Dialog>
    );
};

export default SupplierNCFormModal;