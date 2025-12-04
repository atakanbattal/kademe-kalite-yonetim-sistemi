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

const SurveyFormModal = ({ open, setOpen, existingSurvey, onSuccess }) => {
    const { toast } = useToast();
    const { customers } = useData();
    const [formData, setFormData] = useState({
        survey_name: '',
        customer_id: null,
        survey_type: 'NPS',
        survey_date: new Date().toISOString().split('T')[0],
        period: 'Q1',
        nps_score: null,
        csat_score: null,
        ces_score: null,
        overall_score: null,
        comments: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (open) {
            if (existingSurvey) {
                setFormData({
                    survey_name: existingSurvey.survey_name || '',
                    customer_id: existingSurvey.customer_id || null,
                    survey_type: existingSurvey.survey_type || 'NPS',
                    survey_date: existingSurvey.survey_date || new Date().toISOString().split('T')[0],
                    period: existingSurvey.period || 'Q1',
                    nps_score: existingSurvey.nps_score || null,
                    csat_score: existingSurvey.csat_score || null,
                    ces_score: existingSurvey.ces_score || null,
                    overall_score: existingSurvey.overall_score || null,
                    comments: existingSurvey.comments || ''
                });
            } else {
                setFormData({
                    survey_name: '',
                    customer_id: null,
                    survey_type: 'NPS',
                    survey_date: new Date().toISOString().split('T')[0],
                    period: 'Q1',
                    nps_score: null,
                    csat_score: null,
                    ces_score: null,
                    overall_score: null,
                    comments: ''
                });
            }
        }
    }, [open, existingSurvey]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const dataToSubmit = {
                ...formData,
                customer_id: formData.customer_id || null,
                nps_score: formData.nps_score ? parseInt(formData.nps_score) : null,
                csat_score: formData.csat_score ? parseFloat(formData.csat_score) : null,
                ces_score: formData.ces_score ? parseFloat(formData.ces_score) : null,
                overall_score: formData.overall_score ? parseFloat(formData.overall_score) : null
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
            console.error('Survey save error:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: error.message || 'Anket kaydedilirken hata oluştu.'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const customerOptions = customers.map(c => ({
        value: c.id,
        label: `${c.customer_name} (${c.customer_code})`
    }));

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        {existingSurvey ? 'Anket Düzenle' : 'Yeni Anket'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="survey_name">Anket Adı <span className="text-red-500">*</span></Label>
                            <Input
                                id="survey_name"
                                value={formData.survey_name}
                                onChange={(e) => setFormData({ ...formData, survey_name: e.target.value })}
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="customer_id">Müşteri</Label>
                                <Select
                                    value={formData.customer_id || ''}
                                    onValueChange={(value) => setFormData({ ...formData, customer_id: value || null })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seçiniz" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="">Seçiniz</SelectItem>
                                        {customerOptions.map(opt => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label htmlFor="survey_type">Anket Tipi</Label>
                                <Select
                                    value={formData.survey_type}
                                    onValueChange={(value) => setFormData({ ...formData, survey_type: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="NPS">NPS</SelectItem>
                                        <SelectItem value="CSAT">CSAT</SelectItem>
                                        <SelectItem value="CES">CES</SelectItem>
                                        <SelectItem value="Custom">Özel</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="survey_date">Anket Tarihi</Label>
                                <Input
                                    id="survey_date"
                                    type="date"
                                    value={formData.survey_date}
                                    onChange={(e) => setFormData({ ...formData, survey_date: e.target.value })}
                                />
                            </div>

                            <div>
                                <Label htmlFor="period">Dönem</Label>
                                <Select
                                    value={formData.period}
                                    onValueChange={(value) => setFormData({ ...formData, period: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Q1">Q1</SelectItem>
                                        <SelectItem value="Q2">Q2</SelectItem>
                                        <SelectItem value="Q3">Q3</SelectItem>
                                        <SelectItem value="Q4">Q4</SelectItem>
                                        <SelectItem value="Annual">Yıllık</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="nps_score">NPS Skoru (-100 to 100)</Label>
                                <Input
                                    id="nps_score"
                                    type="number"
                                    min="-100"
                                    max="100"
                                    value={formData.nps_score || ''}
                                    onChange={(e) => setFormData({ ...formData, nps_score: e.target.value || null })}
                                />
                            </div>

                            <div>
                                <Label htmlFor="csat_score">CSAT Skoru (1-5)</Label>
                                <Input
                                    id="csat_score"
                                    type="number"
                                    step="0.1"
                                    min="1"
                                    max="5"
                                    value={formData.csat_score || ''}
                                    onChange={(e) => setFormData({ ...formData, csat_score: e.target.value || null })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="ces_score">CES Skoru (1-7)</Label>
                                <Input
                                    id="ces_score"
                                    type="number"
                                    step="0.1"
                                    min="1"
                                    max="7"
                                    value={formData.ces_score || ''}
                                    onChange={(e) => setFormData({ ...formData, ces_score: e.target.value || null })}
                                />
                            </div>

                            <div>
                                <Label htmlFor="overall_score">Genel Skor</Label>
                                <Input
                                    id="overall_score"
                                    type="number"
                                    step="0.1"
                                    value={formData.overall_score || ''}
                                    onChange={(e) => setFormData({ ...formData, overall_score: e.target.value || null })}
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

export default SurveyFormModal;

