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
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        {existingAssessment ? 'Değerlendirme Düzenle' : 'Yeni Değerlendirme Ekle'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
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

export default AssessmentFormModal;

