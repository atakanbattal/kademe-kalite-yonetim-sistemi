import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useData } from '@/contexts/DataContext';
import { SearchableSelectDialog } from '@/components/ui/searchable-select-dialog';

const ACTION_TYPES = ['Training', 'Process Improvement', 'Equipment', 'Documentation'];
const STATUSES = ['Açık', 'Devam Eden', 'Tamamlanan', 'İptal Edildi'];

const DevelopmentActionFormModal = ({ open, setOpen, existingAction, planId, onSuccess }) => {
    const { toast } = useToast();
    const { personnel = [] } = useData();
    const [plans, setPlans] = useState([]);
    const [formData, setFormData] = useState({
        plan_id: planId || null,
        action_number: 1,
        action_description: '',
        action_type: 'Training',
        status: 'Açık',
        due_date: '',
        completed_date: '',
        results: '',
        responsible_person_id: null
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (open) {
            loadPlans();
        }
    }, [open]);

    useEffect(() => {
        if (existingAction) {
            setFormData({
                ...existingAction,
                due_date: existingAction.due_date || '',
                completed_date: existingAction.completed_date || ''
            });
        } else {
            setFormData({
                plan_id: planId || null,
                action_number: 1,
                action_description: '',
                action_type: 'Training',
                status: 'Açık',
                due_date: '',
                completed_date: '',
                results: '',
                responsible_person_id: null
            });
        }
    }, [existingAction, planId, open]);

    const loadPlans = async () => {
        try {
            const { data, error } = await supabase
                .from('supplier_development_plans')
                .select('id, plan_name')
                .order('plan_name', { ascending: true });

            if (error) throw error;
            setPlans(data || []);
        } catch (error) {
            console.error('Plans loading error:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            if (!formData.plan_id) {
                toast({
                    variant: 'destructive',
                    title: 'Hata',
                    description: 'Lütfen bir geliştirme planı seçin.'
                });
                setIsSubmitting(false);
                return;
            }

            const dataToSubmit = {
                ...formData,
                action_number: parseInt(formData.action_number) || 1,
                due_date: formData.due_date || null,
                completed_date: formData.completed_date || null,
                responsible_person_id: formData.responsible_person_id || null
            };

            if (existingAction) {
                const { error } = await supabase
                    .from('supplier_development_actions')
                    .update(dataToSubmit)
                    .eq('id', existingAction.id);

                if (error) throw error;
                toast({
                    title: 'Başarılı',
                    description: 'Aksiyon güncellendi.'
                });
            } else {
                const { error } = await supabase
                    .from('supplier_development_actions')
                    .insert([dataToSubmit]);

                if (error) throw error;
                toast({
                    title: 'Başarılı',
                    description: 'Aksiyon oluşturuldu.'
                });
            }

            onSuccess();
            setOpen(false);
        } catch (error) {
            console.error('Error saving action:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: error.message || 'Aksiyon kaydedilirken hata oluştu.'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const planOptions = plans.map(p => ({ value: p.id, label: p.plan_name }));
    const personnelOptions = (personnel || []).map(p => ({ value: p.id, label: p.full_name }));

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {existingAction ? 'Aksiyon Düzenle' : 'Yeni Aksiyon'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <Label>Geliştirme Planı *</Label>
                            <SearchableSelectDialog
                                options={planOptions}
                                value={formData.plan_id}
                                onChange={(v) => setFormData({ ...formData, plan_id: v })}
                                triggerPlaceholder="Plan Seçin"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="action_number">Aksiyon Numarası</Label>
                                <Input
                                    id="action_number"
                                    type="number"
                                    min="1"
                                    value={formData.action_number}
                                    onChange={(e) => setFormData({ ...formData, action_number: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label htmlFor="action_type">Aksiyon Tipi</Label>
                                <Select
                                    value={formData.action_type}
                                    onValueChange={(v) => setFormData({ ...formData, action_type: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ACTION_TYPES.map(type => (
                                            <SelectItem key={type} value={type}>
                                                {type === 'Training' ? 'Eğitim' :
                                                 type === 'Process Improvement' ? 'Proses İyileştirme' :
                                                 type === 'Equipment' ? 'Ekipman' : 'Dokümantasyon'}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="action_description">Aksiyon Açıklaması *</Label>
                            <Textarea
                                id="action_description"
                                value={formData.action_description}
                                onChange={(e) => setFormData({ ...formData, action_description: e.target.value })}
                                rows={3}
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="status">Durum</Label>
                                <Select
                                    value={formData.status}
                                    onValueChange={(v) => setFormData({ ...formData, status: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {STATUSES.map(s => (
                                            <SelectItem key={s} value={s}>
                                                {s}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
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
                                <Label htmlFor="due_date">Bitiş Tarihi</Label>
                                <Input
                                    id="due_date"
                                    type="date"
                                    value={formData.due_date}
                                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                                />
                            </div>
                            {formData.status === 'Tamamlanan' && (
                                <div>
                                    <Label htmlFor="completed_date">Tamamlanma Tarihi</Label>
                                    <Input
                                        id="completed_date"
                                        type="date"
                                        value={formData.completed_date}
                                        onChange={(e) => setFormData({ ...formData, completed_date: e.target.value })}
                                    />
                                </div>
                            )}
                        </div>

                        {formData.status === 'Tamamlanan' && (
                            <div>
                                <Label htmlFor="results">Sonuçlar</Label>
                                <Textarea
                                    id="results"
                                    value={formData.results}
                                    onChange={(e) => setFormData({ ...formData, results: e.target.value })}
                                    rows={3}
                                />
                            </div>
                        )}
                    </div>

                    <DialogFooter className="mt-6">
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

export default DevelopmentActionFormModal;

