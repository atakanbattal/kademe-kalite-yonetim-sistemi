import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';

const SUBMISSION_TYPES = ['Full', 'Partial', 'Waiver'];
const SUBMISSION_STATUSES = ['Draft', 'Submitted', 'Approved', 'Rejected', 'Conditionally Approved'];
const SUBMISSION_LEVELS = [1, 2, 3, 4, 5];
const REASONS = [
    'New Part',
    'Engineering Change',
    'Process Change',
    'Tooling Change',
    'Supplier Change',
    'Material Change',
    'Location Change',
    'Other'
];

const PPAPSubmissionFormModal = ({ open, setOpen, existingSubmission, projectId, onSuccess }) => {
    const { toast } = useToast();
    const [formData, setFormData] = useState({
        submission_level: 3,
        submission_type: 'Full',
        submission_status: 'Draft',
        psw_number: '',
        customer_part_number: '',
        engineering_change_level: '',
        date_submitted: '',
        date_approved: '',
        customer_decision: '',
        customer_comments: '',
        reason_for_submission: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (existingSubmission) {
            setFormData({
                submission_level: existingSubmission.submission_level || 3,
                submission_type: existingSubmission.submission_type || 'Full',
                submission_status: existingSubmission.submission_status || 'Draft',
                psw_number: existingSubmission.psw_number || '',
                customer_part_number: existingSubmission.customer_part_number || '',
                engineering_change_level: existingSubmission.engineering_change_level || '',
                date_submitted: existingSubmission.date_submitted || '',
                date_approved: existingSubmission.date_approved || '',
                customer_decision: existingSubmission.customer_decision || '',
                customer_comments: existingSubmission.customer_comments || '',
                reason_for_submission: existingSubmission.reason_for_submission || ''
            });
        } else {
            setFormData({
                submission_level: 3,
                submission_type: 'Full',
                submission_status: 'Draft',
                psw_number: '',
                customer_part_number: '',
                engineering_change_level: '',
                date_submitted: '',
                date_approved: '',
                customer_decision: '',
                customer_comments: '',
                reason_for_submission: ''
            });
        }
    }, [existingSubmission, open]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            if (!projectId) {
                toast({
                    variant: 'destructive',
                    title: 'Hata',
                    description: 'Lütfen bir proje seçin.'
                });
                setIsSubmitting(false);
                return;
            }

            const dataToSubmit = {
                ...formData,
                project_id: projectId,
                submission_level: parseInt(formData.submission_level),
                date_submitted: formData.date_submitted || null,
                date_approved: formData.date_approved || null,
                customer_comments: formData.customer_comments || null
            };

            if (existingSubmission) {
                const { error } = await supabase
                    .from('ppap_submissions')
                    .update(dataToSubmit)
                    .eq('id', existingSubmission.id);

                if (error) throw error;
                toast({
                    title: 'Başarılı',
                    description: 'Submission güncellendi.'
                });
            } else {
                const { error } = await supabase
                    .from('ppap_submissions')
                    .insert([dataToSubmit]);

                if (error) throw error;
                toast({
                    title: 'Başarılı',
                    description: 'Submission oluşturuldu.'
                });
            }

            onSuccess();
            setOpen(false);
        } catch (error) {
            console.error('Error saving submission:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: error.message || 'Submission kaydedilirken hata oluştu.'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {existingSubmission ? 'Submission Düzenle' : 'Yeni Submission'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <Label htmlFor="submission_level">Submission Level</Label>
                                <Select
                                    value={formData.submission_level.toString()}
                                    onValueChange={(v) => setFormData({ ...formData, submission_level: parseInt(v) })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {SUBMISSION_LEVELS.map(level => (
                                            <SelectItem key={level} value={level.toString()}>
                                                Level {level}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="submission_type">Submission Tipi</Label>
                                <Select
                                    value={formData.submission_type}
                                    onValueChange={(v) => setFormData({ ...formData, submission_type: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {SUBMISSION_TYPES.map(type => (
                                            <SelectItem key={type} value={type}>
                                                {type}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="submission_status">Durum</Label>
                                <Select
                                    value={formData.submission_status}
                                    onValueChange={(v) => setFormData({ ...formData, submission_status: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {SUBMISSION_STATUSES.map(status => (
                                            <SelectItem key={status} value={status}>
                                                {status === 'Draft' ? 'Taslak' :
                                                 status === 'Submitted' ? 'Gönderildi' :
                                                 status === 'Approved' ? 'Onaylandı' :
                                                 status === 'Rejected' ? 'Reddedildi' : 'Koşullu Onay'}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="psw_number">PSW Numarası</Label>
                                <Input
                                    id="psw_number"
                                    value={formData.psw_number}
                                    onChange={(e) => setFormData({ ...formData, psw_number: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label htmlFor="customer_part_number">Müşteri Parça Numarası</Label>
                                <Input
                                    id="customer_part_number"
                                    value={formData.customer_part_number}
                                    onChange={(e) => setFormData({ ...formData, customer_part_number: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="reason_for_submission">Gönderim Nedeni</Label>
                                <Select
                                    value={formData.reason_for_submission}
                                    onValueChange={(v) => setFormData({ ...formData, reason_for_submission: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seçiniz" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {REASONS.map(reason => (
                                            <SelectItem key={reason} value={reason}>
                                                {reason === 'New Part' ? 'Yeni Parça' :
                                                 reason === 'Engineering Change' ? 'Mühendislik Değişikliği' :
                                                 reason === 'Process Change' ? 'Proses Değişikliği' :
                                                 reason === 'Tooling Change' ? 'Takım Değişikliği' :
                                                 reason === 'Supplier Change' ? 'Tedarikçi Değişikliği' :
                                                 reason === 'Material Change' ? 'Malzeme Değişikliği' :
                                                 reason === 'Location Change' ? 'Konum Değişikliği' : 'Diğer'}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="engineering_change_level">Mühendislik Değişiklik Seviyesi</Label>
                                <Input
                                    id="engineering_change_level"
                                    value={formData.engineering_change_level}
                                    onChange={(e) => setFormData({ ...formData, engineering_change_level: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="date_submitted">Gönderim Tarihi</Label>
                                <Input
                                    id="date_submitted"
                                    type="date"
                                    value={formData.date_submitted}
                                    onChange={(e) => setFormData({ ...formData, date_submitted: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label htmlFor="date_approved">Onay Tarihi</Label>
                                <Input
                                    id="date_approved"
                                    type="date"
                                    value={formData.date_approved}
                                    onChange={(e) => setFormData({ ...formData, date_approved: e.target.value })}
                                />
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="customer_decision">Müşteri Kararı</Label>
                            <Select
                                value={formData.customer_decision}
                                onValueChange={(v) => setFormData({ ...formData, customer_decision: v })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Seçiniz" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Approved">Onaylandı</SelectItem>
                                    <SelectItem value="Rejected">Reddedildi</SelectItem>
                                    <SelectItem value="Conditionally Approved">Koşullu Onay</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label htmlFor="customer_comments">Müşteri Yorumları</Label>
                            <Textarea
                                id="customer_comments"
                                value={formData.customer_comments}
                                onChange={(e) => setFormData({ ...formData, customer_comments: e.target.value })}
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

export default PPAPSubmissionFormModal;
