import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';

const SUBMISSION_LEVELS = [1, 2, 3, 4, 5];
const SUBMISSION_TYPES = ['Full', 'Partial', 'Waiver'];
const SUBMISSION_STATUSES = ['Draft', 'Submitted', 'Approved', 'Rejected', 'Conditionally Approved'];
const CUSTOMER_DECISIONS = ['Approved', 'Rejected', 'Conditionally Approved'];
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
                ...existingSubmission,
                date_submitted: existingSubmission.date_submitted || '',
                date_approved: existingSubmission.date_approved || ''
            });
        } else {
            const year = new Date().getFullYear();
            const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
            setFormData({
                submission_level: 3,
                submission_type: 'Full',
                submission_status: 'Draft',
                psw_number: `PSW-${year}-${randomNum}`,
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
            const dataToSubmit = {
                ...formData,
                project_id: projectId,
                date_submitted: formData.date_submitted || null,
                date_approved: formData.date_approved || null
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
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        {existingSubmission ? 'Submission Düzenle' : 'Yeni PPAP Submission'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="psw_number">PSW Numarası *</Label>
                                <Input
                                    id="psw_number"
                                    value={formData.psw_number}
                                    onChange={(e) => setFormData({ ...formData, psw_number: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="submission_level">Submission Level *</Label>
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
                                <Label htmlFor="submission_type">Submission Tipi *</Label>
                                <Select
                                    value={formData.submission_type}
                                    onValueChange={(v) => setFormData({ ...formData, submission_type: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {SUBMISSION_TYPES.map(type => (
                                            <SelectItem key={type} value={type}>{type}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="submission_status">Durum *</Label>
                                <Select
                                    value={formData.submission_status}
                                    onValueChange={(v) => setFormData({ ...formData, submission_status: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {SUBMISSION_STATUSES.map(status => (
                                            <SelectItem key={status} value={status}>{status}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="customer_part_number">Müşteri Parça Numarası</Label>
                                <Input
                                    id="customer_part_number"
                                    value={formData.customer_part_number}
                                    onChange={(e) => setFormData({ ...formData, customer_part_number: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label htmlFor="engineering_change_level">Engineering Change Level</Label>
                                <Input
                                    id="engineering_change_level"
                                    value={formData.engineering_change_level}
                                    onChange={(e) => setFormData({ ...formData, engineering_change_level: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label htmlFor="reason_for_submission">Submission Nedeni</Label>
                                <Select
                                    value={formData.reason_for_submission}
                                    onValueChange={(v) => setFormData({ ...formData, reason_for_submission: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Neden seçin..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {REASONS.map(reason => (
                                            <SelectItem key={reason} value={reason}>{reason}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
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
                            <div>
                                <Label htmlFor="customer_decision">Müşteri Kararı</Label>
                                <Select
                                    value={formData.customer_decision}
                                    onValueChange={(v) => setFormData({ ...formData, customer_decision: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Karar seçin..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CUSTOMER_DECISIONS.map(decision => (
                                            <SelectItem key={decision} value={decision}>{decision}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="md:col-span-2">
                                <Label htmlFor="customer_comments">Müşteri Yorumları</Label>
                                <Textarea
                                    id="customer_comments"
                                    value={formData.customer_comments}
                                    onChange={(e) => setFormData({ ...formData, customer_comments: e.target.value })}
                                    rows={3}
                                />
                            </div>
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

export default PPAPSubmissionFormModal;

