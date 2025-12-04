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

const STUDY_STATUSES = ['Planned', 'In Progress', 'Completed', 'Failed'];

const RunAtRateFormModal = ({ open, setOpen, existingStudy, projectId, onSuccess }) => {
    const { toast } = useToast();
    const { personnel } = useData();
    const [formData, setFormData] = useState({
        study_date: new Date().toISOString().split('T')[0],
        production_line: '',
        target_production_rate: '',
        actual_production_rate: '',
        production_quantity: '',
        duration_hours: '',
        success_rate: '',
        issues_encountered: '',
        corrective_actions: '',
        status: 'Completed',
        conducted_by: null
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (existingStudy) {
            setFormData({
                ...existingStudy,
                study_date: existingStudy.study_date || new Date().toISOString().split('T')[0],
                target_production_rate: existingStudy.target_production_rate?.toString() || '',
                actual_production_rate: existingStudy.actual_production_rate?.toString() || '',
                production_quantity: existingStudy.production_quantity?.toString() || '',
                duration_hours: existingStudy.duration_hours?.toString() || '',
                success_rate: existingStudy.success_rate?.toString() || '',
                conducted_by: existingStudy.conducted_by || null
            });
        } else {
            setFormData({
                study_date: new Date().toISOString().split('T')[0],
                production_line: '',
                target_production_rate: '',
                actual_production_rate: '',
                production_quantity: '',
                duration_hours: '',
                success_rate: '',
                issues_encountered: '',
                corrective_actions: '',
                status: 'Completed',
                conducted_by: null
            });
        }
    }, [existingStudy, open]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            // Başarı oranını otomatik hesapla
            const targetRate = parseFloat(formData.target_production_rate) || 0;
            const actualRate = parseFloat(formData.actual_production_rate) || 0;
            const calculatedSuccessRate = targetRate > 0 ? (actualRate / targetRate * 100) : 0;

            const dataToSubmit = {
                project_id: projectId,
                study_date: formData.study_date,
                production_line: formData.production_line,
                target_production_rate: parseInt(formData.target_production_rate) || 0,
                actual_production_rate: parseInt(formData.actual_production_rate) || 0,
                production_quantity: parseInt(formData.production_quantity) || 0,
                duration_hours: parseFloat(formData.duration_hours) || 0,
                success_rate: calculatedSuccessRate,
                issues_encountered: formData.issues_encountered,
                corrective_actions: formData.corrective_actions,
                status: formData.status,
                conducted_by: formData.conducted_by
            };

            if (existingStudy) {
                const { error } = await supabase
                    .from('run_at_rate_studies')
                    .update(dataToSubmit)
                    .eq('id', existingStudy.id);

                if (error) throw error;
                toast({
                    title: 'Başarılı',
                    description: 'Run-at-Rate çalışması güncellendi.'
                });
            } else {
                const { error } = await supabase
                    .from('run_at_rate_studies')
                    .insert([dataToSubmit]);

                if (error) throw error;
                toast({
                    title: 'Başarılı',
                    description: 'Run-at-Rate çalışması oluşturuldu.'
                });
            }

            onSuccess();
        } catch (error) {
            console.error('Error saving study:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: error.message || 'Çalışma kaydedilirken hata oluştu.'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const personnelOptions = personnel.map(p => ({ value: p.id, label: p.full_name }));

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        {existingStudy ? 'Run-at-Rate Çalışması Düzenle' : 'Yeni Run-at-Rate Çalışması'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="study_date">Çalışma Tarihi *</Label>
                                <Input
                                    id="study_date"
                                    type="date"
                                    value={formData.study_date}
                                    onChange={(e) => setFormData({ ...formData, study_date: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="production_line">Üretim Hattı</Label>
                                <Input
                                    id="production_line"
                                    value={formData.production_line}
                                    onChange={(e) => setFormData({ ...formData, production_line: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label htmlFor="target_production_rate">Hedef Üretim Hızı (adet/saat) *</Label>
                                <Input
                                    id="target_production_rate"
                                    type="number"
                                    value={formData.target_production_rate}
                                    onChange={(e) => setFormData({ ...formData, target_production_rate: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="actual_production_rate">Gerçekleşen Üretim Hızı (adet/saat) *</Label>
                                <Input
                                    id="actual_production_rate"
                                    type="number"
                                    value={formData.actual_production_rate}
                                    onChange={(e) => setFormData({ ...formData, actual_production_rate: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="production_quantity">Üretim Miktarı (adet) *</Label>
                                <Input
                                    id="production_quantity"
                                    type="number"
                                    value={formData.production_quantity}
                                    onChange={(e) => setFormData({ ...formData, production_quantity: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="duration_hours">Süre (saat) *</Label>
                                <Input
                                    id="duration_hours"
                                    type="number"
                                    step="0.1"
                                    value={formData.duration_hours}
                                    onChange={(e) => setFormData({ ...formData, duration_hours: e.target.value })}
                                    required
                                />
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
                                        {STUDY_STATUSES.map(status => (
                                            <SelectItem key={status} value={status}>{status}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Yürüten Kişi</Label>
                                <SearchableSelectDialog
                                    options={personnelOptions}
                                    value={formData.conducted_by}
                                    onChange={(v) => setFormData({ ...formData, conducted_by: v })}
                                    triggerPlaceholder="Personel Seçin"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <Label htmlFor="issues_encountered">Karşılaşılan Sorunlar</Label>
                                <Textarea
                                    id="issues_encountered"
                                    value={formData.issues_encountered}
                                    onChange={(e) => setFormData({ ...formData, issues_encountered: e.target.value })}
                                    rows={3}
                                />
                            </div>
                            <div className="md:col-span-2">
                                <Label htmlFor="corrective_actions">Düzeltici Aksiyonlar</Label>
                                <Textarea
                                    id="corrective_actions"
                                    value={formData.corrective_actions}
                                    onChange={(e) => setFormData({ ...formData, corrective_actions: e.target.value })}
                                    rows={3}
                                />
                            </div>
                            {formData.target_production_rate && formData.actual_production_rate && (
                                <div className="md:col-span-2 p-3 bg-blue-50 rounded-lg">
                                    <Label className="text-blue-800">Hesaplanan Başarı Oranı</Label>
                                    <p className="text-lg font-bold text-blue-700">
                                        {((parseFloat(formData.actual_production_rate) / parseFloat(formData.target_production_rate)) * 100).toFixed(1)}%
                                    </p>
                                </div>
                            )}
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

export default RunAtRateFormModal;

