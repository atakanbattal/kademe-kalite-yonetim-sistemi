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

const VALIDATION_TYPES = ['Initial', 'Periodic', 'After Change'];
const VALIDATION_STATUSES = ['Planned', 'In Progress', 'Completed', 'Failed', 'Cancelled'];

const ValidationPlanFormModal = ({ open, setOpen, existingPlan, onSuccess }) => {
    const { toast } = useToast();
    const { personnel, unitCostSettings, equipments } = useData();
    const [formData, setFormData] = useState({
        plan_number: '',
        plan_name: '',
        process_name: '',
        equipment_id: null,
        part_number: '',
        part_name: '',
        validation_type: 'Initial',
        change_reason: '',
        planned_start_date: '',
        planned_end_date: '',
        status: 'Planned',
        responsible_person_id: null,
        responsible_department_id: null
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (existingPlan) {
            setFormData({
                ...existingPlan,
                planned_start_date: existingPlan.planned_start_date || '',
                planned_end_date: existingPlan.planned_end_date || ''
            });
        } else {
            const year = new Date().getFullYear();
            const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
            setFormData({
                plan_number: `VAL-${year}-${randomNum}`,
                plan_name: '',
                process_name: '',
                equipment_id: null,
                part_number: '',
                part_name: '',
                validation_type: 'Initial',
                change_reason: '',
                planned_start_date: '',
                planned_end_date: '',
                status: 'Planned',
                responsible_person_id: null,
                responsible_department_id: null
            });
        }
    }, [existingPlan, open]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const dataToSubmit = {
                ...formData,
                planned_start_date: formData.planned_start_date || null,
                planned_end_date: formData.planned_end_date || null
            };

            if (existingPlan) {
                const { error } = await supabase
                    .from('validation_plans')
                    .update(dataToSubmit)
                    .eq('id', existingPlan.id);

                if (error) throw error;
                toast({
                    title: 'Başarılı',
                    description: 'Validasyon planı güncellendi.'
                });
            } else {
                const { error } = await supabase
                    .from('validation_plans')
                    .insert([dataToSubmit]);

                if (error) throw error;
                toast({
                    title: 'Başarılı',
                    description: 'Validasyon planı oluşturuldu.'
                });
            }

            onSuccess();
        } catch (error) {
            console.error('Error saving plan:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: error.message || 'Plan kaydedilirken hata oluştu.'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const personnelOptions = personnel.map(p => ({ value: p.id, label: p.full_name }));
    const departmentOptions = unitCostSettings.map(u => ({ value: u.id, label: u.unit_name }));
    const equipmentOptions = equipments.map(e => ({ value: e.id, label: `${e.equipment_name} (${e.equipment_code})` }));

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        {existingPlan ? 'Validasyon Planı Düzenle' : 'Yeni Validasyon Planı'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="plan_number">Plan Numarası *</Label>
                                <Input
                                    id="plan_number"
                                    value={formData.plan_number}
                                    onChange={(e) => setFormData({ ...formData, plan_number: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="plan_name">Plan Adı *</Label>
                                <Input
                                    id="plan_name"
                                    value={formData.plan_name}
                                    onChange={(e) => setFormData({ ...formData, plan_name: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="validation_type">Validasyon Tipi *</Label>
                                <Select
                                    value={formData.validation_type}
                                    onValueChange={(v) => setFormData({ ...formData, validation_type: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {VALIDATION_TYPES.map(type => (
                                            <SelectItem key={type} value={type}>{type}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="status">Durum *</Label>
                                <Select
                                    value={formData.status}
                                    onValueChange={(v) => setFormData({ ...formData, status: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {VALIDATION_STATUSES.map(status => (
                                            <SelectItem key={status} value={status}>{status}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
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
                                <Label>Ekipman</Label>
                                <SearchableSelectDialog
                                    options={equipmentOptions}
                                    value={formData.equipment_id}
                                    onChange={(v) => setFormData({ ...formData, equipment_id: v })}
                                    triggerPlaceholder="Ekipman Seçin"
                                />
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
                                <Label htmlFor="planned_start_date">Planlanan Başlangıç Tarihi</Label>
                                <Input
                                    id="planned_start_date"
                                    type="date"
                                    value={formData.planned_start_date}
                                    onChange={(e) => setFormData({ ...formData, planned_start_date: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label htmlFor="planned_end_date">Planlanan Bitiş Tarihi</Label>
                                <Input
                                    id="planned_end_date"
                                    type="date"
                                    value={formData.planned_end_date}
                                    onChange={(e) => setFormData({ ...formData, planned_end_date: e.target.value })}
                                />
                            </div>
                            {formData.validation_type === 'After Change' && (
                                <div className="md:col-span-2">
                                    <Label htmlFor="change_reason">Değişiklik Nedeni</Label>
                                    <Textarea
                                        id="change_reason"
                                        value={formData.change_reason}
                                        onChange={(e) => setFormData({ ...formData, change_reason: e.target.value })}
                                        rows={3}
                                    />
                                </div>
                            )}
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

export default ValidationPlanFormModal;

