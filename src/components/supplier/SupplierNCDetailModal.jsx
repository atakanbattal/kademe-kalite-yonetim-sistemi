import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

const SupplierNCDetailModal = ({ isOpen, setIsOpen, ncRecord, refreshData }) => {
    const { toast } = useToast();
    const [formData, setFormData] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (ncRecord) {
            setFormData({
                title: ncRecord.title || '',
                description: ncRecord.description || '',
                cost_impact: ncRecord.cost_impact || 0,
                responsible_person: ncRecord.responsible_person || '',
            });
        }
    }, [ncRecord]);

    const handleInputChange = (e) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        const { error } = await supabase
            .from('supplier_non_conformities')
            .update(formData)
            .eq('id', ncRecord.id);

        if (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: 'Uygunsuzluk güncellenemedi: ' + error.message });
        } else {
            toast({ title: 'Başarılı!', description: 'Uygunsuzluk başarıyla güncellendi.' });
            refreshData();
            setIsOpen(false);
        }
        setIsSubmitting(false);
    };

    if (!ncRecord) return null;

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Uygunsuzluk Detayı: {ncRecord.nc_number}</DialogTitle>
                    <DialogDescription>
                        Uygunsuzluk kaydını görüntüleyin veya güncelleyin.
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
                    <div>
                        <Label htmlFor="responsible_person">Sorumlu Kişi</Label>
                        <Input id="responsible_person" value={formData.responsible_person} onChange={handleInputChange} />
                    </div>
                </form>
                <DialogFooter>
                    <Button onClick={() => setIsOpen(false)} variant="outline">İptal</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default SupplierNCDetailModal;