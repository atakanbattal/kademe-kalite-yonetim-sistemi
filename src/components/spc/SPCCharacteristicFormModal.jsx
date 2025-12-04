import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useData } from '@/contexts/DataContext';
import { SearchableSelectDialog } from '@/components/ui/searchable-select-dialog';

const CHART_TYPES = [
    { value: 'XbarR', label: 'X-bar ve R Grafikleri' },
    { value: 'XbarS', label: 'X-bar ve S Grafikleri' },
    { value: 'I-MR', label: 'I-MR Grafikleri' },
    { value: 'p', label: 'p Grafikleri (Hatalı Parça Oranı)' },
    { value: 'np', label: 'np Grafikleri (Hatalı Parça Sayısı)' },
    { value: 'c', label: 'c Grafikleri (Kusur Sayısı)' },
    { value: 'u', label: 'u Grafikleri (Birim Başına Kusur)' }
];

const SPCCharacteristicFormModal = ({ open, setOpen, existingCharacteristic, onSuccess }) => {
    const { toast } = useToast();
    const { personnel, unitCostSettings } = useData();
    const [formData, setFormData] = useState({
        characteristic_code: '',
        characteristic_name: '',
        part_code: '',
        part_name: '',
        process_name: '',
        measurement_unit: '',
        usl: '',
        lsl: '',
        target_value: '',
        chart_type: 'XbarR',
        sample_size: 5,
        sampling_frequency: '',
        is_active: true,
        responsible_person_id: null,
        responsible_department_id: null
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (existingCharacteristic) {
            setFormData({
                ...existingCharacteristic,
                usl: existingCharacteristic.usl || '',
                lsl: existingCharacteristic.lsl || '',
                target_value: existingCharacteristic.target_value || ''
            });
        } else {
            setFormData({
                characteristic_code: '',
                characteristic_name: '',
                part_code: '',
                part_name: '',
                process_name: '',
                measurement_unit: '',
                usl: '',
                lsl: '',
                target_value: '',
                chart_type: 'XbarR',
                sample_size: 5,
                sampling_frequency: '',
                is_active: true,
                responsible_person_id: null,
                responsible_department_id: null
            });
        }
    }, [existingCharacteristic, open]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const dataToSubmit = {
                ...formData,
                usl: formData.usl ? parseFloat(formData.usl) : null,
                lsl: formData.lsl ? parseFloat(formData.lsl) : null,
                target_value: formData.target_value ? parseFloat(formData.target_value) : null,
                sample_size: parseInt(formData.sample_size) || 5
            };

            if (existingCharacteristic) {
                const { error } = await supabase
                    .from('spc_characteristics')
                    .update(dataToSubmit)
                    .eq('id', existingCharacteristic.id);

                if (error) throw error;
                toast({
                    title: 'Başarılı',
                    description: 'Karakteristik güncellendi.'
                });
            } else {
                const { error } = await supabase
                    .from('spc_characteristics')
                    .insert([dataToSubmit]);

                if (error) throw error;
                toast({
                    title: 'Başarılı',
                    description: 'Karakteristik oluşturuldu.'
                });
            }

            onSuccess();
        } catch (error) {
            console.error('Error saving characteristic:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: error.message || 'Karakteristik kaydedilirken hata oluştu.'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const personnelOptions = personnel.map(p => ({ value: p.id, label: p.full_name }));
    const departmentOptions = unitCostSettings.map(u => ({ value: u.id, label: u.unit_name }));

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        {existingCharacteristic ? 'Karakteristik Düzenle' : 'Yeni Karakteristik Ekle'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="characteristic_code">Karakteristik Kodu *</Label>
                                <Input
                                    id="characteristic_code"
                                    value={formData.characteristic_code}
                                    onChange={(e) => setFormData({ ...formData, characteristic_code: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="characteristic_name">Karakteristik Adı *</Label>
                                <Input
                                    id="characteristic_name"
                                    value={formData.characteristic_name}
                                    onChange={(e) => setFormData({ ...formData, characteristic_name: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="part_code">Parça Kodu</Label>
                                <Input
                                    id="part_code"
                                    value={formData.part_code}
                                    onChange={(e) => setFormData({ ...formData, part_code: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label htmlFor="part_name">Parça Adı</Label>
                                <Input
                                    id="part_name"
                                    value={formData.part_name}
                                    onChange={(e) => setFormData({ ...formData, part_name: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label htmlFor="process_name">Proses Adı</Label>
                                <Input
                                    id="process_name"
                                    value={formData.process_name}
                                    onChange={(e) => setFormData({ ...formData, process_name: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label htmlFor="measurement_unit">Ölçüm Birimi</Label>
                                <Input
                                    id="measurement_unit"
                                    value={formData.measurement_unit}
                                    onChange={(e) => setFormData({ ...formData, measurement_unit: e.target.value })}
                                    placeholder="mm, kg, N, %, etc."
                                />
                            </div>
                            <div>
                                <Label htmlFor="lsl">Alt Spesifikasyon Limiti (LSL)</Label>
                                <Input
                                    id="lsl"
                                    type="number"
                                    step="0.000001"
                                    value={formData.lsl}
                                    onChange={(e) => setFormData({ ...formData, lsl: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label htmlFor="usl">Üst Spesifikasyon Limiti (USL)</Label>
                                <Input
                                    id="usl"
                                    type="number"
                                    step="0.000001"
                                    value={formData.usl}
                                    onChange={(e) => setFormData({ ...formData, usl: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label htmlFor="target_value">Hedef Değer (Nominal)</Label>
                                <Input
                                    id="target_value"
                                    type="number"
                                    step="0.000001"
                                    value={formData.target_value}
                                    onChange={(e) => setFormData({ ...formData, target_value: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label htmlFor="chart_type">Kontrol Grafik Tipi *</Label>
                                <Select
                                    value={formData.chart_type}
                                    onValueChange={(v) => setFormData({ ...formData, chart_type: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CHART_TYPES.map(type => (
                                            <SelectItem key={type.value} value={type.value}>
                                                {type.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="sample_size">Örneklem Boyutu</Label>
                                <Input
                                    id="sample_size"
                                    type="number"
                                    value={formData.sample_size}
                                    onChange={(e) => setFormData({ ...formData, sample_size: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label htmlFor="sampling_frequency">Örnekleme Sıklığı</Label>
                                <Input
                                    id="sampling_frequency"
                                    value={formData.sampling_frequency}
                                    onChange={(e) => setFormData({ ...formData, sampling_frequency: e.target.value })}
                                    placeholder="Her saat, Her shift, Her lot, etc."
                                />
                            </div>
                            <div>
                                <Label>Sorumlu Kişi</Label>
                                <SearchableSelectDialog
                                    options={personnelOptions}
                                    value={formData.responsible_person_id}
                                    onChange={(v) => setFormData({ ...formData, responsible_person_id: v })}
                                    triggerPlaceholder="Personel Seçin"
                                />
                            </div>
                            <div>
                                <Label>Sorumlu Departman</Label>
                                <SearchableSelectDialog
                                    options={departmentOptions}
                                    value={formData.responsible_department_id}
                                    onChange={(v) => setFormData({ ...formData, responsible_department_id: v })}
                                    triggerPlaceholder="Departman Seçin"
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="mt-4">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
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
};

export default SPCCharacteristicFormModal;

