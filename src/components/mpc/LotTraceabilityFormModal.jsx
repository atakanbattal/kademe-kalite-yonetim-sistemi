import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';

const LOT_STATUSES = ['In Stock', 'Shipped', 'Recalled', 'Quarantined'];

const LotTraceabilityFormModal = ({ open, setOpen, existingLot, onSuccess }) => {
    const { toast } = useToast();
    const [formData, setFormData] = useState({
        lot_number: '',
        serial_number: '',
        part_number: '',
        part_name: '',
        production_date: new Date().toISOString().split('T')[0],
        production_shift: '',
        production_line: '',
        quantity: 1,
        status: 'In Stock'
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (existingLot) {
            setFormData({
                ...existingLot,
                production_date: existingLot.production_date || new Date().toISOString().split('T')[0],
                quantity: existingLot.quantity?.toString() || '1'
            });
        } else {
            const year = new Date().getFullYear();
            const randomNum = Math.floor(Math.random() * 100000).toString().padStart(6, '0');
            setFormData({
                lot_number: `LOT-${year}-${randomNum}`,
                serial_number: '',
                part_number: '',
                part_name: '',
                production_date: new Date().toISOString().split('T')[0],
                production_shift: '',
                production_line: '',
                quantity: 1,
                status: 'In Stock'
            });
        }
    }, [existingLot, open]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const dataToSubmit = {
                ...formData,
                quantity: parseInt(formData.quantity) || 1
            };

            if (existingLot) {
                const { error } = await supabase
                    .from('lot_traceability')
                    .update(dataToSubmit)
                    .eq('id', existingLot.id);

                if (error) throw error;
                toast({ title: 'Başarılı', description: 'Lot kaydı güncellendi.' });
            } else {
                const { error } = await supabase
                    .from('lot_traceability')
                    .insert([dataToSubmit]);

                if (error) throw error;
                toast({ title: 'Başarılı', description: 'Lot kaydı oluşturuldu.' });
            }

            onSuccess();
        } catch (error) {
            console.error('Error saving lot:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: error.message || 'Lot kaydedilirken hata oluştu.'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{existingLot ? 'Lot Kaydı Düzenle' : 'Yeni Lot Kaydı'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="lot_number">Lot Numarası *</Label>
                                <Input id="lot_number" value={formData.lot_number} onChange={(e) => setFormData({ ...formData, lot_number: e.target.value })} required />
                            </div>
                            <div>
                                <Label htmlFor="serial_number">Seri Numarası</Label>
                                <Input id="serial_number" value={formData.serial_number} onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })} />
                            </div>
                            <div>
                                <Label htmlFor="part_number">Parça Numarası</Label>
                                <Input id="part_number" value={formData.part_number} onChange={(e) => setFormData({ ...formData, part_number: e.target.value })} />
                            </div>
                            <div>
                                <Label htmlFor="part_name">Parça Adı</Label>
                                <Input id="part_name" value={formData.part_name} onChange={(e) => setFormData({ ...formData, part_name: e.target.value })} />
                            </div>
                            <div>
                                <Label htmlFor="production_date">Üretim Tarihi *</Label>
                                <Input id="production_date" type="date" value={formData.production_date} onChange={(e) => setFormData({ ...formData, production_date: e.target.value })} required />
                            </div>
                            <div>
                                <Label htmlFor="production_shift">Vardiya</Label>
                                <Input id="production_shift" value={formData.production_shift} onChange={(e) => setFormData({ ...formData, production_shift: e.target.value })} />
                            </div>
                            <div>
                                <Label htmlFor="production_line">Üretim Hattı</Label>
                                <Input id="production_line" value={formData.production_line} onChange={(e) => setFormData({ ...formData, production_line: e.target.value })} />
                            </div>
                            <div>
                                <Label htmlFor="quantity">Miktar *</Label>
                                <Input id="quantity" type="number" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} required />
                            </div>
                            <div>
                                <Label htmlFor="status">Durum *</Label>
                                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {LOT_STATUSES.map(status => (
                                            <SelectItem key={status} value={status}>{status}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="mt-4">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>İptal</Button>
                        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default LotTraceabilityFormModal;

