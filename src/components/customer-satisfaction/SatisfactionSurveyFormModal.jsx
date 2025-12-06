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

const SURVEY_TYPES = ['NPS', 'CSAT', 'CES', 'Custom'];
const PERIODS = ['Q1', 'Q2', 'Q3', 'Q4', 'Annual'];

const SatisfactionSurveyFormModal = ({ open, setOpen, existingSurvey, onSuccess }) => {
    const { toast } = useToast();
    const { customers = [] } = useData();
    const [formData, setFormData] = useState({
        survey_name: '',
        customer_id: null,
        survey_type: 'NPS',
        survey_date: new Date().toISOString().split('T')[0],
        period: '',
        nps_score: null,
        csat_score: null,
        ces_score: null,
        overall_score: null,
        comments: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (existingSurvey) {
            setFormData({
                ...existingSurvey,
                survey_date: existingSurvey.survey_date || new Date().toISOString().split('T')[0]
            });
        } else {
            setFormData({
                survey_name: '',
                customer_id: null,
                survey_type: 'NPS',
                survey_date: new Date().toISOString().split('T')[0],
                period: '',
                nps_score: null,
                csat_score: null,
                ces_score: null,
                overall_score: null,
                comments: ''
            });
        }
    }, [existingSurvey, open]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const dataToSubmit = {
                ...formData,
                nps_score: formData.nps_score ? parseInt(formData.nps_score) : null,
                csat_score: formData.csat_score ? parseFloat(formData.csat_score) : null,
                ces_score: formData.ces_score ? parseFloat(formData.ces_score) : null,
                overall_score: formData.overall_score ? parseFloat(formData.overall_score) : null,
                customer_id: formData.customer_id || null
            };

            if (existingSurvey) {
                const { error } = await supabase
                    .from('customer_satisfaction_surveys')
                    .update(dataToSubmit)
                    .eq('id', existingSurvey.id);

                if (error) throw error;
                toast({
                    title: 'Başarılı',
                    description: 'Anket güncellendi.'
                });
            } else {
                const { error } = await supabase
                    .from('customer_satisfaction_surveys')
                    .insert([dataToSubmit]);

                if (error) throw error;
                toast({
                    title: 'Başarılı',
                    description: 'Anket oluşturuldu.'
                });
            }

            onSuccess();
            setOpen(false);
        } catch (error) {
            console.error('Error saving survey:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: error.message || 'Anket kaydedilirken hata oluştu.'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const customerOptions = (customers || []).map(c => ({ value: c.id, label: c.customer_name }));

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {existingSurvey ? 'Anket Düzenle' : 'Yeni Anket'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="survey_name">Anket Adı *</Label>
                            <Input
                                id="survey_name"
                                value={formData.survey_name}
                                onChange={(e) => setFormData({ ...formData, survey_name: e.target.value })}
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Müşteri</Label>
                                <SearchableSelectDialog
                                    options={customerOptions}
                                    value={formData.customer_id}
                                    onChange={(v) => setFormData({ ...formData, customer_id: v })}
                                    triggerPlaceholder="Müşteri Seçin"
                                />
                            </div>
                            <div>
                                <Label htmlFor="survey_type">Anket Tipi *</Label>
                                <Select
                                    value={formData.survey_type}
                                    onValueChange={(v) => setFormData({ ...formData, survey_type: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {SURVEY_TYPES.map(type => (
                                            <SelectItem key={type} value={type}>
                                                {type}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="survey_date">Anket Tarihi *</Label>
                                <Input
                                    id="survey_date"
                                    type="date"
                                    value={formData.survey_date}
                                    onChange={(e) => setFormData({ ...formData, survey_date: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="period">Dönem</Label>
                                <Select
                                    value={formData.period}
                                    onValueChange={(v) => setFormData({ ...formData, period: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seçiniz" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PERIODS.map(p => (
                                            <SelectItem key={p} value={p}>
                                                {p}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {formData.survey_type === 'NPS' && (
                                <div>
                                    <Label htmlFor="nps_score">NPS Skoru (-100 to 100)</Label>
                                    <Input
                                        id="nps_score"
                                        type="number"
                                        min="-100"
                                        max="100"
                                        value={formData.nps_score || ''}
                                        onChange={(e) => setFormData({ ...formData, nps_score: e.target.value })}
                                    />
                                </div>
                            )}
                            {formData.survey_type === 'CSAT' && (
                                <div>
                                    <Label htmlFor="csat_score">CSAT Skoru (1-5)</Label>
                                    <Input
                                        id="csat_score"
                                        type="number"
                                        min="1"
                                        max="5"
                                        step="0.1"
                                        value={formData.csat_score || ''}
                                        onChange={(e) => setFormData({ ...formData, csat_score: e.target.value })}
                                    />
                                </div>
                            )}
                            {formData.survey_type === 'CES' && (
                                <div>
                                    <Label htmlFor="ces_score">CES Skoru (1-7)</Label>
                                    <Input
                                        id="ces_score"
                                        type="number"
                                        min="1"
                                        max="7"
                                        step="0.1"
                                        value={formData.ces_score || ''}
                                        onChange={(e) => setFormData({ ...formData, ces_score: e.target.value })}
                                    />
                                </div>
                            )}
                            <div>
                                <Label htmlFor="overall_score">Genel Skor</Label>
                                <Input
                                    id="overall_score"
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.1"
                                    value={formData.overall_score || ''}
                                    onChange={(e) => setFormData({ ...formData, overall_score: e.target.value })}
                                />
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="comments">Yorumlar</Label>
                            <Textarea
                                id="comments"
                                value={formData.comments}
                                onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
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

export default SatisfactionSurveyFormModal;

