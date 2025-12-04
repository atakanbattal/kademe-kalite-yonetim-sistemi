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

const ActionFormModal = ({ open, setOpen, planId, existingAction, onSuccess }) => {
    const { toast } = useToast();
    const { personnel } = useData();
    const [formData, setFormData] = useState({
        action_number: 1,
        action_description: '',
        action_type: 'Eğitim',
        status: 'Açık',
        due_date: '',
        completed_date: '',
        results: '',
        responsible_person_id: null
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [maxActionNumber, setMaxActionNumber] = useState(0);

    useEffect(() => {
        if (open && planId) {
            loadMaxActionNumber();
            if (existingAction) {
                setFormData({
                    action_number: existingAction.action_number || 1,
                    action_description: existingAction.action_description || '',
                    action_type: existingAction.action_type || 'Eğitim',
                    status: existingAction.status || 'Açık',
                    due_date: existingAction.due_date || '',
                    completed_date: existingAction.completed_date || '',
                    results: existingAction.results || '',
                    responsible_person_id: existingAction.responsible_person_id || null
                });
            } else {
                setFormData({
                    action_number: maxActionNumber + 1,
                    action_description: '',
                    action_type: 'Eğitim',
                    status: 'Açık',
                    due_date: '',
                    completed_date: '',
                    results: '',
                    responsible_person_id: null
                });
            }
        }
    }, [open, planId, existingAction, maxActionNumber]);

    const loadMaxActionNumber = async () => {
        if (!planId) return;
        try {
            const { data, error } = await supabase
                .from('supplier_development_actions')
                .select('action_number')
                .eq('plan_id', planId)
                .order('action_number', { ascending: false })
                .limit(1);

            if (error) throw error;
            setMaxActionNumber(data && data.length > 0 ? data[0].action_number : 0);
        } catch (error) {
            console.error('Max action number loading error:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const dataToSubmit = {
                plan_id: planId,
                action_number: parseInt(formData.action_number),
                action_description: formData.action_description,
                action_type: formData.action_type,
                status: formData.status,
                due_date: formData.due_date || null,
                completed_date: formData.completed_date || null,
                results: formData.results || null,
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
                    description: 'Aksiyon eklendi.'
                });
            }

            onSuccess();
            setOpen(false);
        } catch (error) {
            console.error('Action save error:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: error.message || 'Aksiyon kaydedilirken hata oluştu.'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const personnelOptions = personnel.map(p => ({
        value: p.id,
        label: p.full_name
    }));

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        {existingAction ? 'Aksiyon Düzenle' : 'Yeni Aksiyon Ekle'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="action_number">Aksiyon Numarası</Label>
                            <Input
                                id="action_number"
                                type="number"
                                min="1"
                                value={formData.action_number}
                                onChange={(e) => setFormData({ ...formData, action_number: parseInt(e.target.value) || 1 })}
                                required
                            />
                        </div>

                        <div>
                            <Label htmlFor="action_description">Aksiyon Açıklaması <span className="text-red-500">*</span></Label>
                            <Textarea
                                id="action_description"
                                value={formData.action_description}
                                onChange={(e) => setFormData({ ...formData, action_description: e.target.value })}
                                required
                                rows={3}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="action_type">Aksiyon Tipi</Label>
                                <Select
                                    value={formData.action_type}
                                    onValueChange={(value) => setFormData({ ...formData, action_type: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Eğitim">Eğitim</SelectItem>
                                        <SelectItem value="Proses İyileştirme">Proses İyileştirme</SelectItem>
                                        <SelectItem value="Ekipman">Ekipman</SelectItem>
                                        <SelectItem value="Dokümantasyon">Dokümantasyon</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label htmlFor="status">Durum</Label>
                                <Select
                                    value={formData.status}
                                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Açık">Açık</SelectItem>
                                        <SelectItem value="Devam Ediyor">Devam Ediyor</SelectItem>
                                        <SelectItem value="Tamamlandı">Tamamlandı</SelectItem>
                                        <SelectItem value="İptal Edildi">İptal Edildi</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="responsible_person_id">Sorumlu Personel</Label>
                            <Select
                                value={formData.responsible_person_id || ''}
                                onValueChange={(value) => setFormData({ ...formData, responsible_person_id: value || null })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Seçiniz" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">Seçiniz</SelectItem>
                                    {personnelOptions.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="due_date">Bitiş Tarihi</Label>
                                <Input
                                    id="due_date"
                                    type="date"
                                    value={formData.due_date}
                                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                                />
                            </div>

                            <div>
                                <Label htmlFor="completed_date">Tamamlanma Tarihi</Label>
                                <Input
                                    id="completed_date"
                                    type="date"
                                    value={formData.completed_date}
                                    onChange={(e) => setFormData({ ...formData, completed_date: e.target.value })}
                                />
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="results">Sonuçlar</Label>
                            <Textarea
                                id="results"
                                value={formData.results}
                                onChange={(e) => setFormData({ ...formData, results: e.target.value })}
                                rows={3}
                            />
                        </div>
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

export default ActionFormModal;

