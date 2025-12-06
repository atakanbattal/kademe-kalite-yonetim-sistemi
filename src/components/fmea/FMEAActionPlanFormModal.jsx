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

const ACTION_TYPES = ['Prevention', 'Detection', 'Both'];
const ACTION_STATUSES = ['Open', 'In Progress', 'Completed', 'Verified', 'Cancelled'];

const FMEAActionPlanFormModal = ({ open, setOpen, existingActionPlan, causeControlId, onSuccess }) => {
    const { toast } = useToast();
    const { personnel = [], unitCostSettings = [] } = useData();
    const [formData, setFormData] = useState({
        action_number: 1,
        recommended_action: '',
        action_type: 'Prevention',
        status: 'Open',
        responsible_person_id: null,
        responsible_department_id: null,
        target_completion_date: '',
        actual_completion_date: '',
        new_severity: '',
        new_occurrence: '',
        new_detection: '',
        verification_method: '',
        verification_date: '',
        verification_result: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [maxActionNumber, setMaxActionNumber] = useState(0);
    const [causeData, setCauseData] = useState(null);

    useEffect(() => {
        if (open && causeControlId) {
            loadMaxActionNumber();
            loadCauseData();
        }
    }, [open, causeControlId]);

    useEffect(() => {
        if (existingActionPlan) {
            setFormData({
                action_number: existingActionPlan.action_number || 1,
                recommended_action: existingActionPlan.recommended_action || '',
                action_type: existingActionPlan.action_type || 'Prevention',
                status: existingActionPlan.status || 'Open',
                responsible_person_id: existingActionPlan.responsible_person_id || null,
                responsible_department_id: existingActionPlan.responsible_department_id || null,
                target_completion_date: existingActionPlan.target_completion_date || '',
                actual_completion_date: existingActionPlan.actual_completion_date || '',
                new_severity: existingActionPlan.new_severity || '',
                new_occurrence: existingActionPlan.new_occurrence || '',
                new_detection: existingActionPlan.new_detection || '',
                verification_method: existingActionPlan.verification_method || '',
                verification_date: existingActionPlan.verification_date || '',
                verification_result: existingActionPlan.verification_result || ''
            });
        } else {
            setFormData({
                action_number: maxActionNumber + 1,
                recommended_action: '',
                action_type: 'Prevention',
                status: 'Open',
                responsible_person_id: null,
                responsible_department_id: null,
                target_completion_date: '',
                actual_completion_date: '',
                new_severity: '',
                new_occurrence: '',
                new_detection: '',
                verification_method: '',
                verification_date: '',
                verification_result: ''
            });
        }
    }, [existingActionPlan, maxActionNumber, open]);

    const loadMaxActionNumber = async () => {
        if (!causeControlId) return;
        try {
            const { data, error } = await supabase
                .from('fmea_action_plans')
                .select('action_number')
                .eq('cause_control_id', causeControlId)
                .order('action_number', { ascending: false })
                .limit(1);

            if (error) throw error;
            setMaxActionNumber(data && data.length > 0 ? data[0].action_number : 0);
        } catch (error) {
            console.error('Max action number loading error:', error);
        }
    };

    const loadCauseData = async () => {
        if (!causeControlId) return;
        try {
            const { data, error } = await supabase
                .from('fmea_causes_controls')
                .select('severity, occurrence, detection')
                .eq('id', causeControlId)
                .single();

            if (error) throw error;
            setCauseData(data);
        } catch (error) {
            console.error('Cause data loading error:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            if (!causeControlId) {
                toast({
                    variant: 'destructive',
                    title: 'Hata',
                    description: 'Kök neden ID bulunamadı.'
                });
                setIsSubmitting(false);
                return;
            }

            const newSeverity = formData.new_severity ? parseInt(formData.new_severity) : null;
            const newOccurrence = formData.new_occurrence ? parseInt(formData.new_occurrence) : null;
            const newDetection = formData.new_detection ? parseInt(formData.new_detection) : null;
            const newRPN = (newSeverity && newOccurrence && newDetection) 
                ? newSeverity * newOccurrence * newDetection 
                : null;

            const dataToSubmit = {
                ...formData,
                cause_control_id: causeControlId,
                action_number: parseInt(formData.action_number) || 1,
                responsible_person_id: formData.responsible_person_id || null,
                responsible_department_id: formData.responsible_department_id || null,
                target_completion_date: formData.target_completion_date || null,
                actual_completion_date: formData.actual_completion_date || null,
                new_severity: newSeverity,
                new_occurrence: newOccurrence,
                new_detection: newDetection,
                new_rpn: newRPN,
                verification_date: formData.verification_date || null,
                verification_method: formData.verification_method || null,
                verification_result: formData.verification_result || null
            };

            if (existingActionPlan) {
                const { error } = await supabase
                    .from('fmea_action_plans')
                    .update(dataToSubmit)
                    .eq('id', existingActionPlan.id);

                if (error) throw error;
                toast({
                    title: 'Başarılı',
                    description: 'Aksiyon planı güncellendi.'
                });
            } else {
                const { error } = await supabase
                    .from('fmea_action_plans')
                    .insert([dataToSubmit]);

                if (error) throw error;
                toast({
                    title: 'Başarılı',
                    description: 'Aksiyon planı oluşturuldu.'
                });
            }

            onSuccess();
            setOpen(false);
        } catch (error) {
            console.error('Error saving action plan:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: error.message || 'Aksiyon planı kaydedilirken hata oluştu.'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const personnelOptions = (personnel || []).map(p => ({ value: p.id, label: p.full_name }));
    const departmentOptions = (unitCostSettings || []).map(u => ({ value: u.id, label: u.unit_name }));

    const calculateNewRPN = () => {
        const s = formData.new_severity ? parseInt(formData.new_severity) : null;
        const o = formData.new_occurrence ? parseInt(formData.new_occurrence) : null;
        const d = formData.new_detection ? parseInt(formData.new_detection) : null;
        if (s && o && d) return s * o * d;
        return null;
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {existingActionPlan ? 'Aksiyon Planı Düzenle' : 'Yeni Aksiyon Planı'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="action_number">Aksiyon Numarası *</Label>
                                <Input
                                    id="action_number"
                                    type="number"
                                    min="1"
                                    value={formData.action_number}
                                    onChange={(e) => setFormData({ ...formData, action_number: e.target.value })}
                                    required
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
                                                {type === 'Prevention' ? 'Önleme' :
                                                 type === 'Detection' ? 'Tespit' : 'Her İkisi'}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="recommended_action">Önerilen Aksiyon *</Label>
                            <Textarea
                                id="recommended_action"
                                value={formData.recommended_action}
                                onChange={(e) => setFormData({ ...formData, recommended_action: e.target.value })}
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
                                        {ACTION_STATUSES.map(status => (
                                            <SelectItem key={status} value={status}>
                                                {status === 'Open' ? 'Açık' :
                                                 status === 'In Progress' ? 'Devam Eden' :
                                                 status === 'Completed' ? 'Tamamlanan' :
                                                 status === 'Verified' ? 'Doğrulanan' : 'İptal Edildi'}
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
                                <Label>Sorumlu Departman</Label>
                                <SearchableSelectDialog
                                    options={departmentOptions}
                                    value={formData.responsible_department_id}
                                    onChange={(v) => setFormData({ ...formData, responsible_department_id: v })}
                                    triggerPlaceholder="Departman Seçin"
                                />
                            </div>
                            <div>
                                <Label htmlFor="target_completion_date">Hedef Tamamlanma Tarihi</Label>
                                <Input
                                    id="target_completion_date"
                                    type="date"
                                    value={formData.target_completion_date}
                                    onChange={(e) => setFormData({ ...formData, target_completion_date: e.target.value })}
                                />
                            </div>
                        </div>

                        {formData.status === 'Completed' && (
                            <>
                                <div>
                                    <Label htmlFor="actual_completion_date">Gerçek Tamamlanma Tarihi</Label>
                                    <Input
                                        id="actual_completion_date"
                                        type="date"
                                        value={formData.actual_completion_date}
                                        onChange={(e) => setFormData({ ...formData, actual_completion_date: e.target.value })}
                                    />
                                </div>

                                <div className="border-t pt-4">
                                    <h4 className="font-semibold mb-3">Yeni Değerler (Aksiyon Sonrası)</h4>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <Label htmlFor="new_severity">Yeni Severity (1-10)</Label>
                                            <Input
                                                id="new_severity"
                                                type="number"
                                                min="1"
                                                max="10"
                                                value={formData.new_severity}
                                                onChange={(e) => setFormData({ ...formData, new_severity: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor="new_occurrence">Yeni Occurrence (1-10)</Label>
                                            <Input
                                                id="new_occurrence"
                                                type="number"
                                                min="1"
                                                max="10"
                                                value={formData.new_occurrence}
                                                onChange={(e) => setFormData({ ...formData, new_occurrence: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor="new_detection">Yeni Detection (1-10)</Label>
                                            <Input
                                                id="new_detection"
                                                type="number"
                                                min="1"
                                                max="10"
                                                value={formData.new_detection}
                                                onChange={(e) => setFormData({ ...formData, new_detection: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    {calculateNewRPN() && (
                                        <div className="mt-2">
                                            <Label>Yeni RPN</Label>
                                            <Input
                                                value={calculateNewRPN()}
                                                readOnly
                                                className="bg-muted font-semibold"
                                            />
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <Label htmlFor="verification_method">Doğrulama Yöntemi</Label>
                                    <Textarea
                                        id="verification_method"
                                        value={formData.verification_method}
                                        onChange={(e) => setFormData({ ...formData, verification_method: e.target.value })}
                                        rows={2}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="verification_date">Doğrulama Tarihi</Label>
                                        <Input
                                            id="verification_date"
                                            type="date"
                                            value={formData.verification_date}
                                            onChange={(e) => setFormData({ ...formData, verification_date: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="verification_result">Doğrulama Sonucu</Label>
                                        <Input
                                            id="verification_result"
                                            value={formData.verification_result}
                                            onChange={(e) => setFormData({ ...formData, verification_result: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </>
                        )}
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

export default FMEAActionPlanFormModal;

