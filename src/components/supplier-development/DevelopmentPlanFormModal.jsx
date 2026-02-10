import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useData } from '@/contexts/DataContext';
import { SearchableSelectDialog } from '@/components/ui/searchable-select-dialog';
import { ModernModalLayout, ModalSectionHeader, ModalField } from '@/components/shared/ModernModalLayout';
import { FolderKanban, Target } from 'lucide-react';

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

    const selectedSupplierName = suppliers?.find(s => s.id === formData.supplier_id)?.name || '-';
    const selectedPersonName = personnel?.find(p => p.id === formData.responsible_person_id)?.full_name || '-';
    const selectedDeptName = unitCostSettings?.find(u => u.id === formData.responsible_department_id)?.unit_name || '-';

    const rightPanel = (
        <div className="p-6 space-y-5">
            <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Plan Özeti</h2>
            <div className="bg-background rounded-xl p-5 shadow-sm border border-border relative overflow-hidden">
                <div className="absolute -right-3 -bottom-3 opacity-[0.04] pointer-events-none"><FolderKanban className="w-20 h-20" /></div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-1">Plan Adı</p>
                <p className="text-lg font-bold text-foreground">{formData.plan_name || '-'}</p>
            </div>
            <div className="space-y-3">
                <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium">
                        <span className="text-muted-foreground">Plan Tipi</span>
                        <span className="text-foreground">{formData.plan_type}</span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: '100%' }} />
                    </div>
                </div>
                <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium">
                        <span className="text-muted-foreground">Öncelik</span>
                        <span className="text-foreground">{formData.priority}</span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 rounded-full" style={{ width: formData.priority === 'Kritik' ? '100%' : formData.priority === 'Yüksek' ? '75%' : formData.priority === 'Orta' ? '50%' : '25%' }} />
                    </div>
                </div>
                <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium">
                        <span className="text-muted-foreground">Durum</span>
                        <span className="font-semibold text-foreground">{formData.current_status}</span>
                    </div>
                </div>
            </div>
            <div className="pt-4 border-t border-border space-y-2.5">
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Tedarikçi:</span><span className="font-semibold text-foreground truncate ml-2">{selectedSupplierName}</span></div>
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Başlangıç:</span><span className="font-semibold text-foreground">{formData.start_date ? new Date(formData.start_date).toLocaleDateString('tr-TR') : '-'}</span></div>
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Hedef Tamamlanma:</span><span className="font-semibold text-foreground">{formData.target_completion_date ? new Date(formData.target_completion_date).toLocaleDateString('tr-TR') : '-'}</span></div>
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Sorumlu:</span><span className="font-semibold text-foreground truncate ml-2">{selectedPersonName}</span></div>
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Departman:</span><span className="font-semibold text-foreground truncate ml-2">{selectedDeptName}</span></div>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-start gap-2.5 border border-blue-100 dark:border-blue-800">
                <Target className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed text-blue-700 dark:text-blue-300">
                    Geliştirme planı kaydedildikten sonra tedarikçi geliştirme takibinde listelenecektir.
                </p>
            </div>
        </div>
    );

    return (
        <ModernModalLayout
            open={open}
            onOpenChange={setOpen}
            title={existingPlan ? 'Geliştirme Planı Düzenle' : 'Yeni Geliştirme Planı'}
            subtitle="Tedarikçi Geliştirme Yönetimi"
            icon={<FolderKanban className="h-5 w-5 text-white" />}
            badge={existingPlan ? 'Düzenleme' : 'Yeni'}
            onCancel={() => setOpen(false)}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            submitLabel="Kaydet"
            cancelLabel="İptal Et"
            formId="dev-plan-form"
            footerDate={formData.start_date || formData.target_completion_date}
            rightPanel={rightPanel}
        >
            <form id="dev-plan-form" onSubmit={handleSubmit} className="p-6">
                <div className="space-y-6">
                    <div>
                        <ModalSectionHeader>Tedarikçi ve Plan Bilgileri</ModalSectionHeader>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <ModalField label="Tedarikçi" required>
                                    <SearchableSelectDialog
                                        options={supplierOptions}
                                        value={formData.supplier_id}
                                        onChange={(v) => setFormData({ ...formData, supplier_id: v })}
                                        triggerPlaceholder="Tedarikçi Seçin"
                                    />
                                </ModalField>
                            </div>
                            <ModalField label="Plan Adı" required>
                                <Input id="plan_name" value={formData.plan_name} onChange={(e) => setFormData({ ...formData, plan_name: e.target.value })} required />
                            </ModalField>
                            <ModalField label="Plan Tipi" required>
                                <Select value={formData.plan_type} onValueChange={(v) => setFormData({ ...formData, plan_type: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>{PLAN_TYPES.map(type => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}</SelectContent>
                                </Select>
                            </ModalField>
                            <ModalField label="Öncelik" required>
                                <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>{PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                                </Select>
                            </ModalField>
                            <ModalField label="Durum" required>
                                <Select value={formData.current_status} onValueChange={(v) => setFormData({ ...formData, current_status: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>{STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                                </Select>
                            </ModalField>
                        </div>
                    </div>
                    <div>
                        <ModalSectionHeader>Hedefler ve Tarihler</ModalSectionHeader>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <ModalField label="Hedefler" required>
                                    <Textarea id="objectives" value={formData.objectives} onChange={(e) => setFormData({ ...formData, objectives: e.target.value })} rows={4} required className="resize-none" />
                                </ModalField>
                            </div>
                            <ModalField label="Başlangıç Tarihi">
                                <Input id="start_date" type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} />
                            </ModalField>
                            <ModalField label="Hedef Tamamlanma Tarihi">
                                <Input id="target_completion_date" type="date" value={formData.target_completion_date} onChange={(e) => setFormData({ ...formData, target_completion_date: e.target.value })} />
                            </ModalField>
                            {formData.current_status === 'Tamamlanan' && (
                                <ModalField label="Gerçek Tamamlanma Tarihi">
                                    <Input id="actual_completion_date" type="date" value={formData.actual_completion_date} onChange={(e) => setFormData({ ...formData, actual_completion_date: e.target.value })} />
                                </ModalField>
                            )}
                            <ModalField label="Sorumlu Kişi">
                                <SearchableSelectDialog options={personnelOptions} value={formData.responsible_person_id} onChange={(v) => setFormData({ ...formData, responsible_person_id: v })} triggerPlaceholder="Personel Seçin" />
                            </ModalField>
                            <ModalField label="Sorumlu Departman">
                                <SearchableSelectDialog options={departmentOptions} value={formData.responsible_department_id} onChange={(v) => setFormData({ ...formData, responsible_department_id: v })} triggerPlaceholder="Departman Seçin" />
                            </ModalField>
                        </div>
                    </div>
                </div>
            </form>
        </ModernModalLayout>
    );
};

export default DevelopmentPlanFormModal;

