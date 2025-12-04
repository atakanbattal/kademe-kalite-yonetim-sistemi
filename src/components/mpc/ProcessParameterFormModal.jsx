import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useData } from '@/contexts/DataContext';
import { SearchableSelectDialog } from '@/components/ui/searchable-select-dialog';

const ProcessParameterFormModal = ({ open, setOpen, existingParameter, onSuccess }) => {
    const { toast } = useToast();
    const { equipments } = useData();
    const [formData, setFormData] = useState({
        parameter_name: '',
        machine_equipment_id: null,
        process_name: '',
        target_value: '',
        usl: '',
        lsl: '',
        unit: '',
        is_critical: false,
        is_active: true
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (existingParameter) {
            setFormData({
                ...existingParameter,
                machine_equipment_id: existingParameter.machine_equipment_id || null,
                target_value: existingParameter.target_value?.toString() || '',
                usl: existingParameter.usl?.toString() || '',
                lsl: existingParameter.lsl?.toString() || ''
            });
        } else {
            setFormData({
                parameter_name: '',
                machine_equipment_id: null,
                process_name: '',
                target_value: '',
                usl: '',
                lsl: '',
                unit: '',
                is_critical: false,
                is_active: true
            });
        }
    }, [existingParameter, open]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const dataToSubmit = {
                ...formData,
                target_value: formData.target_value ? parseFloat(formData.target_value) : null,
                usl: formData.usl ? parseFloat(formData.usl) : null,
                lsl: formData.lsl ? parseFloat(formData.lsl) : null
            };

            if (existingParameter) {
                const { error } = await supabase
                    .from('process_parameters')
                    .update(dataToSubmit)
                    .eq('id', existingParameter.id);

                if (error) throw error;
                toast({
                    title: 'Başarılı',
                    description: 'Proses parametresi güncellendi.'
                });
            } else {
                const { error } = await supabase
                    .from('process_parameters')
                    .insert([dataToSubmit]);

                if (error) throw error;
                toast({
                    title: 'Başarılı',
                    description: 'Proses parametresi oluşturuldu.'
                });
            }

            onSuccess();
        } catch (error) {
            console.error('Error saving parameter:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: error.message || 'Parametre kaydedilirken hata oluştu.'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const equipmentOptions = equipments.map(e => ({ value: e.id, label: `${e.equipment_name} (${e.equipment_code})` }));

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        {existingParameter ? 'Proses Parametresi Düzenle' : 'Yeni Proses Parametresi'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <Label htmlFor="parameter_name">Parametre Adı *</Label>
                                <Input
                                    id="parameter_name"
                                    value={formData.parameter_name}
                                    onChange={(e) => setFormData({ ...formData, parameter_name: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <Label>Makine/Ekipman</Label>
                                <SearchableSelectDialog
                                    options={equipmentOptions}
                                    value={formData.machine_equipment_id}
                                    onChange={(v) => setFormData({ ...formData, machine_equipment_id: v })}
                                    triggerPlaceholder="Ekipman Seçin"
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
                                <Label htmlFor="unit">Birim</Label>
                                <Input
                                    id="unit"
                                    value={formData.unit}
                                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                                    placeholder="°C, bar, rpm, etc."
                                />
                            </div>
                            <div>
                                <Label htmlFor="lsl">Alt Limit (LSL)</Label>
                                <Input
                                    id="lsl"
                                    type="number"
                                    step="0.000001"
                                    value={formData.lsl}
                                    onChange={(e) => setFormData({ ...formData, lsl: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label htmlFor="usl">Üst Limit (USL)</Label>
                                <Input
                                    id="usl"
                                    type="number"
                                    step="0.000001"
                                    value={formData.usl}
                                    onChange={(e) => setFormData({ ...formData, usl: e.target.value })}
                                />
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="is_critical"
                                    checked={formData.is_critical}
                                    onCheckedChange={(checked) => setFormData({ ...formData, is_critical: checked })}
                                />
                                <Label htmlFor="is_critical" className="cursor-pointer">
                                    Kritik Parametre
                                </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="is_active"
                                    checked={formData.is_active}
                                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                                />
                                <Label htmlFor="is_active" className="cursor-pointer">
                                    Aktif
                                </Label>
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

export default ProcessParameterFormModal;

