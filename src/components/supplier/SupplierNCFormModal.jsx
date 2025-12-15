import React, { useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
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
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Uygunsuzluk Aç: {supplier.name}</DialogTitle>
                    <DialogDescription>
                        Tedarikçiyle ilgili bir uygunsuzluk kaydı oluşturun.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
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
                </form>
                <DialogFooter>
                    <Button onClick={() => setIsOpen(false)} variant="outline">İptal</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? 'Oluşturuluyor...' : 'Uygunsuzluk Oluştur'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default SupplierNCFormModal;