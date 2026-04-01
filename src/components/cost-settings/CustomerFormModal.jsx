import React, { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const CUSTOMER_TYPES = [
    'OEM',
    'Tier 1',
    'Tier 2',
    'Perakende',
    'Distribütör',
    'Diğer',
];

/**
 * Ayarlar > Müşteri sekmesindeki ile aynı form.
 * @param {(payload?: { customer?: object }) => void} [onSuccess] — Yeni kayıtta `customer` satırı döner.
 */
export function CustomerFormModal({ open, setOpen, onSuccess, existingCustomer }) {
    const { toast } = useToast();
    const isEditMode = !!existingCustomer;
    const [formData, setFormData] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const initialData = {
            name: '',
            customer_type: 'OEM',
            contact_person: '',
            contact_email: '',
            contact_phone: '',
            address: '',
            city: '',
            country: 'Türkiye',
            tax_number: '',
            contract_start_date: '',
            contract_end_date: '',
            annual_revenue: '',
            payment_terms: '',
            notes: '',
            is_active: true
        };
        
        if (isEditMode) {
            setFormData({ 
                ...existingCustomer,
                contract_start_date: existingCustomer.contract_start_date || '',
                contract_end_date: existingCustomer.contract_end_date || '',
            });
        } else {
            setFormData(initialData);
        }
    }, [existingCustomer, isEditMode, open]);

    const handleChange = (e) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleSelectChange = (id, value) => {
        setFormData(prev => ({ ...prev, [id]: value }));
    };
    
    const handleCheckboxChange = (id, checked) => {
        setFormData(prev => ({ ...prev, [id]: checked }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.name) {
            toast({ 
                variant: 'destructive', 
                title: 'Eksik Bilgi', 
                description: 'Müşteri adı zorunludur.' 
            });
            return;
        }

        setIsSubmitting(true);
        
        const { id, created_at, updated_at, ...dataToSubmit } = formData;
        
        // Boş string değerleri null'a çevir
        Object.keys(dataToSubmit).forEach(key => {
            if (dataToSubmit[key] === '') {
                dataToSubmit[key] = null;
            }
        });

        if (!isEditMode) {
            if (dataToSubmit.name && !dataToSubmit.customer_name) {
                dataToSubmit.customer_name = dataToSubmit.name;
            }
            if (!dataToSubmit.customer_code) {
                dataToSubmit.customer_code = `AUTO-${Date.now().toString(36).toUpperCase().slice(-10)}`;
            }
        }

        if (isEditMode) {
            const { error: updateError } = await supabase
                .from('customers')
                .update(dataToSubmit)
                .eq('id', existingCustomer.id);
            if (updateError) {
                toast({
                    variant: 'destructive',
                    title: 'Hata!',
                    description: `Müşteri güncellenemedi: ${updateError.message}`,
                });
            } else {
                toast({
                    title: 'Başarılı!',
                    description: 'Müşteri başarıyla güncellendi.',
                });
                onSuccess?.({ customer: { ...existingCustomer, ...dataToSubmit } });
            }
        } else {
            const { data: inserted, error: insertError } = await supabase
                .from('customers')
                .insert([dataToSubmit])
                .select()
                .single();
            if (insertError) {
                toast({
                    variant: 'destructive',
                    title: 'Hata!',
                    description: `Müşteri eklenemedi: ${insertError.message}`,
                });
            } else {
                toast({
                    title: 'Başarılı!',
                    description: 'Müşteri başarıyla eklendi.',
                });
                onSuccess?.({ customer: inserted });
            }
        }
        setIsSubmitting(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
                <DialogHeader>
                    <DialogTitle>
                        {isEditMode ? 'Müşteri Düzenle' : 'Yeni Müşteri Ekle'}
                    </DialogTitle>
                    <DialogDescription>
                        Müşteri bilgilerini ekleyin veya güncelleyin
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6 py-4">
                    <Tabs defaultValue="basic" className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="basic">Temel Bilgiler</TabsTrigger>
                            <TabsTrigger value="contact">İletişim</TabsTrigger>
                            <TabsTrigger value="business">İş Bilgileri</TabsTrigger>
                        </TabsList>

                        <TabsContent value="basic" className="space-y-4 mt-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="name">
                                        Müşteri Adı <span className="text-red-500">*</span>
                                    </Label>
                                    <Input 
                                        id="name" 
                                        value={formData.name || ''} 
                                        onChange={handleChange} 
                                        required 
                                        placeholder="Firma ünvanı"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="customer_type">Müşteri Tipi</Label>
                                    <Select 
                                        value={formData.customer_type || 'OEM'} 
                                        onValueChange={(val) => handleSelectChange('customer_type', val)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {CUSTOMER_TYPES.map(type => (
                                                <SelectItem key={type} value={type}>
                                                    {type}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label htmlFor="tax_number">Vergi Numarası</Label>
                                    <Input 
                                        id="tax_number" 
                                        value={formData.tax_number || ''} 
                                        onChange={handleChange} 
                                        placeholder="VKN / TCKN"
                                    />
                                </div>
                                <div className="flex items-center space-x-2 pt-6">
                                    <Checkbox 
                                        id="is_active" 
                                        checked={!!formData.is_active} 
                                        onCheckedChange={(c) => handleCheckboxChange('is_active', c)} 
                                    />
                                    <Label htmlFor="is_active">Aktif Müşteri</Label>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="contact" className="space-y-4 mt-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="contact_person">Yetkili Kişi</Label>
                                    <Input 
                                        id="contact_person" 
                                        value={formData.contact_person || ''} 
                                        onChange={handleChange} 
                                        placeholder="Ad Soyad"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="contact_email">Email</Label>
                                    <Input 
                                        id="contact_email" 
                                        type="email"
                                        value={formData.contact_email || ''} 
                                        onChange={handleChange} 
                                        placeholder="email@domain.com"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="contact_phone">Telefon</Label>
                                    <Input 
                                        id="contact_phone" 
                                        value={formData.contact_phone || ''} 
                                        onChange={handleChange} 
                                        placeholder="+90 (555) 123 45 67"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="city">Şehir</Label>
                                    <Input 
                                        id="city" 
                                        value={formData.city || ''} 
                                        onChange={handleChange} 
                                        placeholder="İstanbul"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="country">Ülke</Label>
                                    <Input 
                                        id="country" 
                                        value={formData.country || 'Türkiye'} 
                                        onChange={handleChange} 
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <Label htmlFor="address">Adres</Label>
                                    <Textarea 
                                        id="address" 
                                        value={formData.address || ''} 
                                        onChange={handleChange} 
                                        rows={3}
                                        placeholder="Tam adres"
                                    />
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="business" className="space-y-4 mt-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="contract_start_date">Sözleşme Başlangıç</Label>
                                    <Input 
                                        id="contract_start_date" 
                                        type="date"
                                        value={formData.contract_start_date || ''} 
                                        onChange={handleChange} 
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="contract_end_date">Sözleşme Bitiş</Label>
                                    <Input 
                                        id="contract_end_date" 
                                        type="date"
                                        value={formData.contract_end_date || ''} 
                                        onChange={handleChange} 
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="annual_revenue">Yıllık Ciro (TL)</Label>
                                    <Input 
                                        id="annual_revenue" 
                                        type="number"
                                        step="0.01"
                                        value={formData.annual_revenue || ''} 
                                        onChange={handleChange} 
                                        placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="payment_terms">Ödeme Koşulları</Label>
                                    <Input 
                                        id="payment_terms" 
                                        value={formData.payment_terms || ''} 
                                        onChange={handleChange} 
                                        placeholder="Örn: 30 gün vadeli"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <Label htmlFor="notes">Notlar</Label>
                                    <Textarea 
                                        id="notes" 
                                        value={formData.notes || ''} 
                                        onChange={handleChange} 
                                        rows={4}
                                        placeholder="Ek bilgiler, özel notlar..."
                                    />
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>

                    <DialogFooter>
                        <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => setOpen(false)}
                        >
                            İptal
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
