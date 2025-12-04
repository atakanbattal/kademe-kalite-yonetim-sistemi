import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { VEHICLE_TYPES } from '@/components/quality-cost/constants';

const BaseVehicleForm = ({ vehicle, onSave, setIsOpen }) => {
    const { toast } = useToast();
    const [formData, setFormData] = useState({
        chassis_no: '',
        serial_no: '',
        customer_name: '',
        vehicle_type: '',
        status: 'Kaliteye Girdi',
        notes: '',
        dmo_status: '',
    });
    const [loading, setLoading] = useState(false);

    const statusOptions = ['Kaliteye Girdi', 'Kontrol Başladı', 'Kontrol Bitti', 'Yeniden İşlemde', 'Sevk Hazır', 'Sevk Edildi'];
    const dmoStatusOptions = ['DMO Bekliyor', 'DMO Geçti', 'DMO Kaldı'];

    useEffect(() => {
        if (vehicle) {
            setFormData({
                chassis_no: vehicle.chassis_no || '',
                serial_no: vehicle.serial_no || '',
                customer_name: vehicle.customer_name || '',
                vehicle_type: vehicle.vehicle_type || '',
                status: vehicle.status || 'Kaliteye Girdi',
                notes: vehicle.notes || '',
                dmo_status: vehicle.dmo_status || '',
            });
        } else {
            setFormData({
                chassis_no: '',
                serial_no: '',
                customer_name: '',
                vehicle_type: '',
                status: 'Kaliteye Girdi',
                notes: '',
                dmo_status: '',
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

        const { chassis_no, serial_no, customer_name, vehicle_type, status, notes, dmo_status } = formData;

        if (!customer_name || !vehicle_type) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Lütfen Müşteri Adı ve Araç Tipi alanlarını doldurun.' });
            setLoading(false);
            return;
        }

        let result;
        const dataToSave = { 
            chassis_no, 
            serial_no, 
            customer_name, 
            vehicle_type, 
            status, 
            notes, 
            dmo_status,
            updated_at: new Date().toISOString() 
        };

        if (vehicle) {
            result = await supabase
                .from('quality_inspections')
                .update(dataToSave)
                .eq('id', vehicle.id);
        } else {
            dataToSave.quality_entry_at = new Date().toISOString();
            dataToSave.status_entered_at = new Date().toISOString();
            result = await supabase
                .from('quality_inspections')
                .insert([dataToSave]);
        }

        const { error } = result;

        if (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: `Araç kaydedilemedi: ${error.message}` });
        } else {
            toast({ title: 'Başarılı!', description: `Araç başarıyla ${vehicle ? 'güncellendi' : 'eklendi'}.` });
            onSave();
            setIsOpen(false);
        }
        setLoading(false);
    };

    return (
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="chassis_no" className="text-right">Şasi No</Label>
                <Input id="chassis_no" name="chassis_no" value={formData.chassis_no} onChange={handleChange} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="serial_no" className="text-right">Seri No</Label>
                <Input id="serial_no" name="serial_no" value={formData.serial_no} onChange={handleChange} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="customer_name" className="text-right">Müşteri Adı</Label>
                <Input id="customer_name" name="customer_name" value={formData.customer_name} onChange={handleChange} className="col-span-3" required />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="vehicle_type" className="text-right">Araç Tipi</Label>
                <Select name="vehicle_type" value={formData.vehicle_type} onValueChange={(value) => handleSelectChange('vehicle_type', value)} required>
                    <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Araç tipi seçin..." />
                    </SelectTrigger>
                    <SelectContent>
                        {VEHICLE_TYPES.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
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
                <Label htmlFor="notes" className="text-right">Notlar</Label>
                <Textarea id="notes" name="notes" value={formData.notes} onChange={handleChange} className="col-span-3" />
            </div>
            <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>İptal</Button>
                <Button type="submit" disabled={loading}>{loading ? 'Kaydediliyor...' : 'Kaydet'}</Button>
            </div>
        </form>
    );
};

export default BaseVehicleForm;