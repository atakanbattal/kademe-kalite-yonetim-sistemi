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

const FEEDBACK_TYPES = ['Complaint', 'Suggestion', 'Praise', 'Question'];
const CATEGORIES = ['Product Quality', 'Delivery', 'Service', 'Communication'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
const STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];

const CustomerFeedbackFormModal = ({ open, setOpen, existingFeedback, onSuccess }) => {
    const { toast } = useToast();
    const { customers = [] } = useData();
    const [formData, setFormData] = useState({
        customer_id: null,
        feedback_type: 'Complaint',
        feedback_date: new Date().toISOString().split('T')[0],
        subject: '',
        description: '',
        category: '',
        priority: 'Medium',
        status: 'Open',
        resolution: '',
        resolved_date: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (existingFeedback) {
            setFormData({
                ...existingFeedback,
                feedback_date: existingFeedback.feedback_date || new Date().toISOString().split('T')[0],
                resolved_date: existingFeedback.resolved_date || ''
            });
        } else {
            setFormData({
                customer_id: null,
                feedback_type: 'Complaint',
                feedback_date: new Date().toISOString().split('T')[0],
                subject: '',
                description: '',
                category: '',
                priority: 'Medium',
                status: 'Open',
                resolution: '',
                resolved_date: ''
            });
        }
    }, [existingFeedback, open]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const dataToSubmit = {
                ...formData,
                customer_id: formData.customer_id || null,
                resolved_date: formData.resolved_date || null
            };

            if (existingFeedback) {
                const { error } = await supabase
                    .from('customer_feedback')
                    .update(dataToSubmit)
                    .eq('id', existingFeedback.id);

                if (error) throw error;
                toast({
                    title: 'Başarılı',
                    description: 'Geri bildirim güncellendi.'
                });
            } else {
                const { error } = await supabase
                    .from('customer_feedback')
                    .insert([dataToSubmit]);

                if (error) throw error;
                toast({
                    title: 'Başarılı',
                    description: 'Geri bildirim oluşturuldu.'
                });
            }

            onSuccess();
            setOpen(false);
        } catch (error) {
            console.error('Error saving feedback:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: error.message || 'Geri bildirim kaydedilirken hata oluştu.'
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
                        {existingFeedback ? 'Geri Bildirim Düzenle' : 'Yeni Geri Bildirim'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
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
                                <Label htmlFor="feedback_type">Geri Bildirim Tipi *</Label>
                                <Select
                                    value={formData.feedback_type}
                                    onValueChange={(v) => setFormData({ ...formData, feedback_type: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {FEEDBACK_TYPES.map(type => (
                                            <SelectItem key={type} value={type}>
                                                {type === 'Complaint' ? 'Şikayet' : 
                                                 type === 'Suggestion' ? 'Öneri' :
                                                 type === 'Praise' ? 'Övgü' : 'Soru'}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="feedback_date">Tarih *</Label>
                                <Input
                                    id="feedback_date"
                                    type="date"
                                    value={formData.feedback_date}
                                    onChange={(e) => setFormData({ ...formData, feedback_date: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="category">Kategori</Label>
                                <Select
                                    value={formData.category}
                                    onValueChange={(v) => setFormData({ ...formData, category: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seçiniz" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CATEGORIES.map(cat => (
                                            <SelectItem key={cat} value={cat}>
                                                {cat}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="subject">Konu *</Label>
                            <Input
                                id="subject"
                                value={formData.subject}
                                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                required
                            />
                        </div>

                        <div>
                            <Label htmlFor="description">Açıklama *</Label>
                            <Textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                rows={4}
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="priority">Öncelik</Label>
                                <Select
                                    value={formData.priority}
                                    onValueChange={(v) => setFormData({ ...formData, priority: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PRIORITIES.map(p => (
                                            <SelectItem key={p} value={p}>
                                                {p === 'Low' ? 'Düşük' :
                                                 p === 'Medium' ? 'Orta' :
                                                 p === 'High' ? 'Yüksek' : 'Kritik'}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
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
                                                {s === 'Open' ? 'Açık' :
                                                 s === 'In Progress' ? 'Devam Eden' :
                                                 s === 'Resolved' ? 'Çözüldü' : 'Kapatıldı'}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {formData.status === 'Resolved' || formData.status === 'Closed' ? (
                            <>
                                <div>
                                    <Label htmlFor="resolution">Çözüm</Label>
                                    <Textarea
                                        id="resolution"
                                        value={formData.resolution}
                                        onChange={(e) => setFormData({ ...formData, resolution: e.target.value })}
                                        rows={3}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="resolved_date">Çözüm Tarihi</Label>
                                    <Input
                                        id="resolved_date"
                                        type="date"
                                        value={formData.resolved_date}
                                        onChange={(e) => setFormData({ ...formData, resolved_date: e.target.value })}
                                    />
                                </div>
                            </>
                        ) : null}
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

export default CustomerFeedbackFormModal;

