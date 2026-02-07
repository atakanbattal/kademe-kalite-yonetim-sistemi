import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useData } from '@/contexts/DataContext';

// Müşteri adını CamelCase formatına çeviren fonksiyon
const toCamelCase = (str) => {
    if (!str) return '';
    return str
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
        .trim();
};

const BaseVehicleForm = ({ vehicle, onSave, setIsOpen }) => {
    const { toast } = useToast();
    const { products, productCategories } = useData();
    const [formData, setFormData] = useState({
        chassis_no: '',
        serial_no: '',
        customer_name: '',
        vehicle_type: '',
        vehicle_brand: '',
        status: 'Kaliteye Girdi',
        notes: '',
        dmo_status: '',
        delivery_due_date: '',
    });
    const [loading, setLoading] = useState(false);

    const statusOptions = ['Kaliteye Girdi', 'Kontrol Başladı', 'Kontrol Bitti', 'Yeniden İşlemde', 'Sevk Hazır', 'Sevk Edildi'];
    const dmoStatusOptions = ['DMO Bekliyor', 'DMO Geçti', 'DMO Kaldı'];
    
    // Marka seçenekleri
    const brandOptions = ['FORD', 'OTOKAR', 'ISUZU', 'MERCEDES', 'MITSUBISHI', 'IVECO'];
    
    // Marka gerektiren araç tipleri
    const brandRequiredVehicleTypes = ['Çay Toplama Makinesi', 'HSCK (Hidrolik Sıkıştırmalı Çöp Kamyonu)', 'İSTAÇ', 'KDM 35', 'KDM 70', 'KDM 80'];
    
    // Araç tiplerini products tablosundan çek
    const vehicleTypeCategory = (productCategories || []).find(cat => cat.category_code === 'VEHICLE_TYPES');
    const vehicleTypes = (products || [])
        .filter(p => p.category_id === vehicleTypeCategory?.id)
        .map(p => p.product_name);
    
    // Seçilen araç tipi marka gerektiriyor mu?
    const needsBrand = brandRequiredVehicleTypes.some(type => 
        formData.vehicle_type?.toLowerCase().includes(type.toLowerCase()) ||
        type.toLowerCase().includes(formData.vehicle_type?.toLowerCase())
    );

    useEffect(() => {
        if (vehicle) {
            setFormData({
                chassis_no: vehicle.chassis_no || '',
                serial_no: vehicle.serial_no || '',
                customer_name: vehicle.customer_name || '',
                vehicle_type: vehicle.vehicle_type || '',
                vehicle_brand: vehicle.vehicle_brand || '',
                status: vehicle.status || 'Kaliteye Girdi',
                notes: vehicle.notes || '',
                dmo_status: vehicle.dmo_status || '',
                delivery_due_date: vehicle.delivery_due_date ? vehicle.delivery_due_date.split('T')[0] : '',
            });
        } else {
            setFormData({
                chassis_no: '',
                serial_no: '',
                customer_name: '',
                vehicle_type: '',
                vehicle_brand: '',
                status: 'Kaliteye Girdi',
                notes: '',
                dmo_status: '',
                delivery_due_date: '',
            });
        }
    }, [vehicle]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    
    const handleSelectChange = (name, value) => {
        setFormData(prev => ({ ...prev, [name]: value === 'none' ? '' : value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        const { chassis_no, serial_no, customer_name, vehicle_type, vehicle_brand, status, notes, dmo_status, delivery_due_date } = formData;
        
        // Müşteri adını CamelCase formatına çevir
        const formattedCustomerName = toCamelCase(customer_name);

        if (!formattedCustomerName || !vehicle_type) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Lütfen Müşteri Adı ve Araç Tipi alanlarını doldurun.' });
            setLoading(false);
            return;
        }
        
        // Marka gerektiren araç tipi için marka kontrolü
        if (needsBrand && !vehicle_brand) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Bu araç tipi için marka seçimi zorunludur.' });
            setLoading(false);
            return;
        }

        // Undefined key'leri ve geçersiz kolonları temizle
        const dataToSave = { 
            chassis_no, 
            serial_no, 
            customer_name: formattedCustomerName, 
            vehicle_type,
            vehicle_brand: needsBrand ? vehicle_brand : null,
            status, 
            notes, 
            dmo_status,
            delivery_due_date: delivery_due_date || null,
            updated_at: new Date().toISOString() 
        };
        
        const cleanedData = {};
        for (const key in dataToSave) {
            if (dataToSave[key] !== undefined && key !== 'undefined') {
                cleanedData[key] = dataToSave[key];
            }
        }

        let result;
        if (vehicle) {
            result = await supabase
                .from('quality_inspections')
                .update(cleanedData)
                .eq('id', vehicle.id);
        } else {
            cleanedData.quality_entry_at = new Date().toISOString();
            cleanedData.status_entered_at = new Date().toISOString();
            result = await supabase
                .from('quality_inspections')
                .insert([cleanedData]);
        }

        const { error, data } = result;

        if (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: `Araç kaydedilemedi: ${error.message}` });
            setLoading(false);
            return;
        }

        toast({ title: 'Başarılı!', description: `Araç başarıyla ${vehicle ? 'güncellendi' : 'eklendi'}.` });
        
        // Verileri yenile (async olabilir)
        if (onSave) {
            await onSave();
        }
        
        setIsOpen(false);
        setLoading(false);
    };

    return (
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="chassis_no" className="text-right">Şasi No</Label>
                <Input id="chassis_no" name="chassis_no" value={formData.chassis_no} onChange={handleChange} className="col-span-3" autoCapitalize="off" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="serial_no" className="text-right">Seri No</Label>
                <Input id="serial_no" name="serial_no" value={formData.serial_no} onChange={handleChange} className="col-span-3" autoCapitalize="off" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="customer_name" className="text-right">Müşteri Adı</Label>
                <Input id="customer_name" name="customer_name" value={formData.customer_name} onChange={handleChange} className="col-span-3" required autoCapitalize="off" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="vehicle_type" className="text-right">Araç Tipi</Label>
                <Select name="vehicle_type" value={formData.vehicle_type} onValueChange={(value) => handleSelectChange('vehicle_type', value)} required>
                    <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Araç tipi seçin..." />
                    </SelectTrigger>
                    <SelectContent>
                        {vehicleTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            {/* Marka alanı - sadece belirli araç tipleri için */}
            {needsBrand && (
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="vehicle_brand" className="text-right">Marka *</Label>
                    <Select name="vehicle_brand" value={formData.vehicle_brand} onValueChange={(value) => handleSelectChange('vehicle_brand', value)} required>
                        <SelectTrigger className="col-span-3">
                            <SelectValue placeholder="Marka seçin..." />
                        </SelectTrigger>
                        <SelectContent>
                            {brandOptions.map(brand => <SelectItem key={brand} value={brand}>{brand}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            )}
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="dmo_status" className="text-right">DMO Durumu</Label>
                <Select name="dmo_status" value={formData.dmo_status} onValueChange={(value) => handleSelectChange('dmo_status', value)}>
                    <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="DMO durumu seçin..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {dmoStatusOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="delivery_due_date" className="text-right">Termin Tarihi</Label>
                <Input 
                    id="delivery_due_date" 
                    name="delivery_due_date" 
                    type="date" 
                    value={formData.delivery_due_date} 
                    onChange={handleChange} 
                    className="col-span-3" 
                />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="notes" className="text-right">Notlar</Label>
                <Textarea id="notes" name="notes" value={formData.notes} onChange={handleChange} className="col-span-3" autoCapitalize="off" />
            </div>
            <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>İptal</Button>
                <Button type="submit" disabled={loading}>{loading ? 'Kaydediliyor...' : 'Kaydet'}</Button>
            </div>
        </form>
    );
};

export default BaseVehicleForm;