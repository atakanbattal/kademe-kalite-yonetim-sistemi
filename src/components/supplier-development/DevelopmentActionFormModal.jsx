import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Zap } from 'lucide-react';
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
            <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
                <header className="bg-gradient-to-r from-primary to-blue-700 px-6 py-5 flex items-center justify-between text-white shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/20 p-2.5 rounded-lg"><Zap className="h-5 w-5 text-white" /></div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight">{existingAction ? 'Aksiyon Düzenle' : 'Yeni Aksiyon'}</h1>
                            <p className="text-[11px] text-blue-100 uppercase tracking-[0.15em] font-medium">Tedarikçi geliştirme aksiyonu</p>
                        </div>
                        <span className="px-3 py-1 bg-white/20 border border-white/30 text-white/90 text-[10px] font-bold rounded-full uppercase tracking-wider">{existingAction ? 'Düzenle' : 'Yeni'}</span>
                    </div>
                </header>
                <form id="dev-action-form" onSubmit={handleSubmit} className="flex flex-1 min-h-0 overflow-hidden">
                    <div className="flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden border-r border-border py-4">
                    <div className="p-6 space-y-4">
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
                    </div>
                    <div className="w-[320px] min-w-[280px] shrink-0 min-h-0 overflow-y-auto bg-muted/30 py-4">
                        <div className="p-5 space-y-5">
                            <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Özet</h2>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between"><span className="text-muted-foreground">Tip:</span><span className="font-medium">{formData.action_type || '-'}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Durum:</span><span className="font-medium">{formData.status || '-'}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Bitiş:</span><span className="font-medium">{formData.due_date || '-'}</span></div>
                            </div>
                        </div>
                    </div>
                </form>
                <footer className="bg-background px-6 py-4 border-t border-border flex justify-end gap-3 shrink-0">
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>İptal</Button>
                    <Button type="submit" form="dev-action-form" disabled={isSubmitting}>{isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}</Button>
                </footer>
            </DialogContent>
        </Dialog>
    );
};

export default DevelopmentActionFormModal;

