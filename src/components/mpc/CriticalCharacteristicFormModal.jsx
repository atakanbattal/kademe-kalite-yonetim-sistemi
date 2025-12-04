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

const CHARACTERISTIC_TYPES = ['CC', 'SC', 'Key'];
const CLASSIFICATION_SOURCES = ['Customer', 'Internal', 'Regulatory'];

const CriticalCharacteristicFormModal = ({ open, setOpen, existingCharacteristic, onSuccess }) => {
    const { toast } = useToast();
    const { unitCostSettings } = useData();
    const [formData, setFormData] = useState({
        characteristic_code: '',
        characteristic_name: '',
        part_number: '',
        part_name: '',
        characteristic_type: 'CC',
        classification_source: 'Customer',
        usl: '',
        lsl: '',
        target_value: '',
        measurement_unit: '',
        control_method: '',
        inspection_frequency: '',
        is_active: true,
        responsible_department_id: null
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (existingCharacteristic) {
            setFormData({
                ...existingCharacteristic,
                usl: existingCharacteristic.usl?.toString() || '',
                lsl: existingCharacteristic.lsl?.toString() || '',
                target_value: existingCharacteristic.target_value?.toString() || ''
            });
        } else {
            setFormData({
                characteristic_code: '',
                characteristic_name: '',
                part_number: '',
                part_name: '',
                characteristic_type: 'CC',
                classification_source: 'Customer',
                usl: '',
                lsl: '',
                target_value: '',
                measurement_unit: '',
                control_method: '',
                inspection_frequency: '',
                is_active: true,
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
                target_value: formData.target_value ? parseFloat(formData.target_value) : null
            };

            if (existingCharacteristic) {
                const { error } = await supabase
                    .from('critical_characteristics')
                    .update(dataToSubmit)
                    .eq('id', existingCharacteristic.id);

                if (error) throw error;
                toast({
                    title: 'Başarılı',
                    description: 'Kritik karakteristik güncellendi.'
                });
            } else {
                const { error } = await supabase
                    .from('critical_characteristics')
                    .insert([dataToSubmit]);

                if (error) throw error;
                toast({
                    title: 'Başarılı',
                    description: 'Kritik karakteristik oluşturuldu.'
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

    const departmentOptions = unitCostSettings.map(u => ({ value: u.id, label: u.unit_name }));

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        {existingCharacteristic ? 'Kritik Karakteristik Düzenle' : 'Yeni Kritik Karakteristik'}
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
                                <Label htmlFor="characteristic_type">Karakteristik Tipi *</Label>
                                <Select
                                    value={formData.characteristic_type}
                                    onValueChange={(v) => setFormData({ ...formData, characteristic_type: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CHARACTERISTIC_TYPES.map(type => (
                                            <SelectItem key={type} value={type}>{type}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="classification_source">Sınıflandırma Kaynağı</Label>
                                <Select
                                    value={formData.classification_source}
                                    onValueChange={(v) => setFormData({ ...formData, classification_source: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CLASSIFICATION_SOURCES.map(source => (
                                            <SelectItem key={source} value={source}>{source}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="part_number">Parça Numarası</Label>
                                <Input
                                    id="part_number"
                                    value={formData.part_number}
                                    onChange={(e) => setFormData({ ...formData, part_number: e.target.value })}
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
                                <Label htmlFor="target_value">Hedef Değer</Label>
                                <Input
                                    id="target_value"
                                    type="number"
                                    step="0.000001"
                                    value={formData.target_value}
                                    onChange={(e) => setFormData({ ...formData, target_value: e.target.value })}
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
                                <Label htmlFor="inspection_frequency">Kontrol Sıklığı</Label>
                                <Input
                                    id="inspection_frequency"
                                    value={formData.inspection_frequency}
                                    onChange={(e) => setFormData({ ...formData, inspection_frequency: e.target.value })}
                                    placeholder="Her saat, Her shift, Her lot, etc."
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
                            <div className="md:col-span-2">
                                <Label htmlFor="control_method">Kontrol Metodu</Label>
                                <Textarea
                                    id="control_method"
                                    value={formData.control_method}
                                    onChange={(e) => setFormData({ ...formData, control_method: e.target.value })}
                                    rows={3}
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

export default CriticalCharacteristicFormModal;

