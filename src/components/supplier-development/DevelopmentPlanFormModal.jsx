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
import { FolderKanban, Target, Hash } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

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
    const priorityColors = { Kritik: 'bg-red-100 text-red-800', Yüksek: 'bg-amber-100 text-amber-800', Orta: 'bg-blue-100 text-blue-800', Düşük: 'bg-slate-100 text-slate-700' };

    const rightPanel = (
        <div className="p-5 space-y-4">
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-4 border border-primary/20 relative overflow-hidden">
                <div className="absolute -right-3 -bottom-3 opacity-[0.06] pointer-events-none"><FolderKanban className="w-20 h-20" /></div>
                <div className="flex items-center gap-2 mb-2">
                    <Hash className="w-4 h-4 text-primary" />
                    <p className="text-[10px] font-medium text-primary uppercase tracking-widest">Plan Adı</p>
                </div>
                <p className="text-xl font-bold text-foreground font-mono tracking-wide">{formData.plan_name || '-'}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-[10px]">{formData.plan_type || '-'}</Badge>
                <Badge className={`text-[10px] ${priorityColors[formData.priority] || 'bg-slate-100 text-slate-700'}`}>{formData.priority || '-'}</Badge>
                <Badge variant="outline" className="text-[10px]">{formData.current_status || '-'}</Badge>
            </div>
            <Separator className="my-1" />
            <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <FolderKanban className="w-3 h-3" /> Tedarikçi & Sorumluluk
                </p>
                <div className="space-y-1.5 pl-1">
                    <div className="py-1"><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Tedarikçi</p><p className="text-xs font-semibold text-foreground truncate">{selectedSupplierName}</p></div>
                    <div className="py-1"><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Sorumlu Kişi</p><p className="text-xs font-semibold text-foreground truncate">{selectedPersonName}</p></div>
                    <div className="py-1"><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Departman</p><p className="text-xs font-semibold text-foreground truncate">{selectedDeptName}</p></div>
                </div>
            </div>
            <Separator className="my-1" />
            <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Target className="w-3 h-3" /> Tarihler
                </p>
                <div className="space-y-1.5 pl-1">
                    <div className="py-1"><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Başlangıç</p><p className="text-xs font-semibold text-foreground">{formData.start_date ? new Date(formData.start_date).toLocaleDateString('tr-TR') : '-'}</p></div>
                    <div className="py-1"><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Hedef Tamamlanma</p><p className="text-xs font-semibold text-foreground">{formData.target_completion_date ? new Date(formData.target_completion_date).toLocaleDateString('tr-TR') : '-'}</p></div>
                </div>
            </div>
            {formData.objectives && (
                <>
                    <Separator className="my-1" />
                    <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Hedefler</p>
                        <p className="text-[11px] text-foreground leading-relaxed line-clamp-4 bg-muted/30 rounded-lg p-2.5 border">{formData.objectives}</p>
                    </div>
                </>
            )}
            <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-start gap-2 border border-blue-100 dark:border-blue-800">
                <Target className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
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

