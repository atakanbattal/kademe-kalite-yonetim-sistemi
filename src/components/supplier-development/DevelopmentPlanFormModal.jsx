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

const PLAN_TYPES = [
    { value: 'Kalite İyileştirme', label: 'Kalite İyileştirme' },
    { value: 'Kapasite', label: 'Kapasite' },
    { value: 'Maliyet Azaltma', label: 'Maliyet Azaltma' },
    { value: 'Teknoloji', label: 'Teknoloji' }
];

const PRIORITIES = [
    { value: 'Düşük', label: 'Düşük' },
    { value: 'Orta', label: 'Orta' },
    { value: 'Yüksek', label: 'Yüksek' },
    { value: 'Kritik', label: 'Kritik' }
];

const STATUSES = [
    { value: 'Planlanan', label: 'Planlanan' },
    { value: 'Devam Eden', label: 'Devam Eden' },
    { value: 'Tamamlanan', label: 'Tamamlanan' },
    { value: 'Beklemede', label: 'Beklemede' }
];

const DevelopmentPlanFormModal = ({ open, setOpen, existingPlan, onSuccess }) => {
    const { toast } = useToast();
    const { personnel, unitCostSettings, suppliers } = useData();
    const [formData, setFormData] = useState({
        supplier_id: null,
        plan_name: '',
        plan_type: 'Kalite İyileştirme',
        priority: 'Orta',
        objectives: '',
        target_metrics: {},
        current_status: 'Planlanan',
        start_date: '',
        target_completion_date: '',
        actual_completion_date: '',
        responsible_person_id: null,
        responsible_department_id: null
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (existingPlan) {
            setFormData({
                ...existingPlan,
                start_date: existingPlan.start_date || '',
                target_completion_date: existingPlan.target_completion_date || '',
                actual_completion_date: existingPlan.actual_completion_date || ''
            });
        } else {
            setFormData({
                supplier_id: null,
                plan_name: '',
                plan_type: 'Kalite İyileştirme',
                priority: 'Orta',
                objectives: '',
                target_metrics: {},
                current_status: 'Planlanan',
                start_date: '',
                target_completion_date: '',
                actual_completion_date: '',
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
                start_date: formData.start_date || null,
                target_completion_date: formData.target_completion_date || null,
                actual_completion_date: formData.actual_completion_date || null,
                target_metrics: formData.target_metrics || {}
            };

            if (existingPlan) {
                const { error } = await supabase
                    .from('supplier_development_plans')
                    .update(dataToSubmit)
                    .eq('id', existingPlan.id);

                if (error) throw error;
                toast({
                    title: 'Başarılı',
                    description: 'Geliştirme planı güncellendi.'
                });
            } else {
                const { error } = await supabase
                    .from('supplier_development_plans')
                    .insert([dataToSubmit]);

                if (error) throw error;
                toast({
                    title: 'Başarılı',
                    description: 'Geliştirme planı oluşturuldu.'
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

    const personnelOptions = personnel?.map(p => ({ value: p.id, label: p.full_name })) || [];
    const departmentOptions = unitCostSettings?.map(u => ({ value: u.id, label: u.unit_name })) || [];
    const supplierOptions = suppliers?.map(s => ({ value: s.id, label: s.name })) || [];

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        {existingPlan ? 'Geliştirme Planı Düzenle' : 'Yeni Geliştirme Planı'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <Label>Tedarikçi *</Label>
                                <SearchableSelectDialog
                                    options={supplierOptions}
                                    value={formData.supplier_id}
                                    onChange={(v) => setFormData({ ...formData, supplier_id: v })}
                                    triggerPlaceholder="Tedarikçi Seçin"
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
                                <Label htmlFor="plan_type">Plan Tipi *</Label>
                                <Select
                                    value={formData.plan_type}
                                    onValueChange={(v) => setFormData({ ...formData, plan_type: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PLAN_TYPES.map(type => (
                                            <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="priority">Öncelik *</Label>
                                <Select
                                    value={formData.priority}
                                    onValueChange={(v) => setFormData({ ...formData, priority: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PRIORITIES.map(priority => (
                                            <SelectItem key={priority.value} value={priority.value}>{priority.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="current_status">Durum *</Label>
                                <Select
                                    value={formData.current_status}
                                    onValueChange={(v) => setFormData({ ...formData, current_status: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {STATUSES.map(status => (
                                            <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="md:col-span-2">
                                <Label htmlFor="objectives">Hedefler *</Label>
                                <Textarea
                                    id="objectives"
                                    value={formData.objectives}
                                    onChange={(e) => setFormData({ ...formData, objectives: e.target.value })}
                                    rows={4}
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="start_date">Başlangıç Tarihi</Label>
                                <Input
                                    id="start_date"
                                    type="date"
                                    value={formData.start_date}
                                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label htmlFor="target_completion_date">Hedef Tamamlanma Tarihi</Label>
                                <Input
                                    id="target_completion_date"
                                    type="date"
                                    value={formData.target_completion_date}
                                    onChange={(e) => setFormData({ ...formData, target_completion_date: e.target.value })}
                                />
                            </div>
                            {formData.current_status === 'Tamamlanan' && (
                                <div>
                                    <Label htmlFor="actual_completion_date">Gerçek Tamamlanma Tarihi</Label>
                                    <Input
                                        id="actual_completion_date"
                                        type="date"
                                        value={formData.actual_completion_date}
                                        onChange={(e) => setFormData({ ...formData, actual_completion_date: e.target.value })}
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

export default DevelopmentPlanFormModal;

