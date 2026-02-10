import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useData } from '@/contexts/DataContext';

const AssessmentFormModal = ({ open, setOpen, planId, existingAssessment, onSuccess }) => {
    const { toast } = useToast();
    const { personnel } = useData();
    const [formData, setFormData] = useState({
        assessment_date: new Date().toISOString().split('T')[0],
        assessment_type: 'Başlangıç',
        improvement_percentage: null,
        assessment_notes: '',
        assessor_id: null
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (open) {
            if (existingAssessment) {
                setFormData({
                    assessment_date: existingAssessment.assessment_date || new Date().toISOString().split('T')[0],
                    assessment_type: existingAssessment.assessment_type || 'Başlangıç',
                    improvement_percentage: existingAssessment.improvement_percentage || null,
                    assessment_notes: existingAssessment.assessment_notes || '',
                    assessor_id: existingAssessment.assessor_id || null
                });
            } else {
                setFormData({
                    assessment_date: new Date().toISOString().split('T')[0],
                    assessment_type: 'Başlangıç',
                    improvement_percentage: null,
                    assessment_notes: '',
                    assessor_id: null
                });
            }
        }
    }, [open, existingAssessment]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const dataToSubmit = {
                plan_id: planId,
                assessment_date: formData.assessment_date,
                assessment_type: formData.assessment_type,
                improvement_percentage: formData.improvement_percentage ? parseFloat(formData.improvement_percentage) : null,
                assessment_notes: formData.assessment_notes || null,
                assessor_id: formData.assessor_id || null
            };

            if (existingAssessment) {
                const { error } = await supabase
                    .from('supplier_development_assessments')
                    .update(dataToSubmit)
                    .eq('id', existingAssessment.id);

                if (error) throw error;
                toast({
                    title: 'Başarılı',
                    description: 'Değerlendirme güncellendi.'
                });
            } else {
                const { error } = await supabase
                    .from('supplier_development_assessments')
                    .insert([dataToSubmit]);

                if (error) throw error;
                toast({
                    title: 'Başarılı',
                    description: 'Değerlendirme eklendi.'
                });
            }

            onSuccess();
            setOpen(false);
        } catch (error) {
            console.error('Assessment save error:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: error.message || 'Değerlendirme kaydedilirken hata oluştu.'
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
            <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
                <header className="bg-gradient-to-r from-primary to-blue-700 px-6 py-5 flex items-center justify-between text-white shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/20 p-2.5 rounded-lg"><ClipboardList className="h-5 w-5 text-white" /></div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight">{existingAssessment ? 'Değerlendirme Düzenle' : 'Yeni Değerlendirme Ekle'}</h1>
                            <p className="text-[11px] text-blue-100 uppercase tracking-[0.15em] font-medium">Tedarikçi geliştirme</p>
                        </div>
                        <span className="px-3 py-1 bg-white/20 border border-white/30 text-white/90 text-[10px] font-bold rounded-full uppercase tracking-wider">{existingAssessment ? 'Düzenle' : 'Yeni'}</span>
                    </div>
                </header>
                <form id="assessment-form" onSubmit={handleSubmit} className="flex flex-1 min-h-0 overflow-hidden">
                    <div className="flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden border-r border-border py-4">
                    <div className="p-6 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="assessment_date">Değerlendirme Tarihi <span className="text-red-500">*</span></Label>
                                <Input
                                    id="assessment_date"
                                    type="date"
                                    value={formData.assessment_date}
                                    onChange={(e) => setFormData({ ...formData, assessment_date: e.target.value })}
                                    required
                                />
                            </div>

                            <div>
                                <Label htmlFor="assessment_type">Değerlendirme Tipi <span className="text-red-500">*</span></Label>
                                <Select
                                    value={formData.assessment_type}
                                    onValueChange={(value) => setFormData({ ...formData, assessment_type: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Başlangıç">Başlangıç</SelectItem>
                                        <SelectItem value="İlerleme">İlerleme</SelectItem>
                                        <SelectItem value="Final">Final</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="improvement_percentage">İyileşme Yüzdesi (%)</Label>
                            <Input
                                id="improvement_percentage"
                                type="number"
                                step="0.01"
                                value={formData.improvement_percentage || ''}
                                onChange={(e) => setFormData({ ...formData, improvement_percentage: e.target.value || null })}
                            />
                        </div>

                        <div>
                            <Label htmlFor="assessor_id">Değerlendiren</Label>
                            <Select
                                value={formData.assessor_id || ''}
                                onValueChange={(value) => setFormData({ ...formData, assessor_id: value || null })}
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

                        <div>
                            <Label htmlFor="assessment_notes">Değerlendirme Notları</Label>
                            <Textarea
                                id="assessment_notes"
                                value={formData.assessment_notes}
                                onChange={(e) => setFormData({ ...formData, assessment_notes: e.target.value })}
                                rows={4}
                            />
                        </div>
                    </div>
                    </div>
                    <div className="w-[320px] min-w-[280px] shrink-0 min-h-0 overflow-y-auto bg-muted/30 py-4">
                        <div className="p-5 space-y-5">
                            <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Özet</h2>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between"><span className="text-muted-foreground">Tarih:</span><span className="font-medium">{formData.assessment_date || '-'}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Tip:</span><span className="font-medium">{formData.assessment_type || '-'}</span></div>
                                {formData.improvement_percentage != null && <div className="flex justify-between"><span className="text-muted-foreground">İyileşme:</span><span className="font-medium">%{formData.improvement_percentage}</span></div>}
                            </div>
                        </div>
                    </div>
                </form>
                <footer className="bg-background px-6 py-4 border-t border-border flex justify-end gap-3 shrink-0">
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>İptal</Button>
                    <Button type="submit" form="assessment-form" disabled={isSubmitting}>{isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}</Button>
                </footer>
            </DialogContent>
        </Dialog>
    );
};

export default AssessmentFormModal;

