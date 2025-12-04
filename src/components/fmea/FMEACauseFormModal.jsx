import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';

const FMEACauseFormModal = ({ open, setOpen, failureModeId, existingCause, onSuccess }) => {
    const { toast } = useToast();
    const [formData, setFormData] = useState({
        cause_number: 1,
        potential_cause: '',
        severity: 5,
        occurrence: 5,
        detection: 5,
        occurrence_rationale: '',
        detection_rationale: '',
        current_controls_prevention: '',
        current_controls_detection: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [maxCauseNumber, setMaxCauseNumber] = useState(0);

    useEffect(() => {
        if (open && failureModeId) {
            loadMaxCauseNumber();
            loadFailureModeSeverity();
            if (existingCause) {
                setFormData({
                    cause_number: existingCause.cause_number || 1,
                    potential_cause: existingCause.potential_cause || '',
                    occurrence: existingCause.occurrence || 5,
                    detection: existingCause.detection || 5,
                    occurrence_rationale: existingCause.occurrence_rationale || '',
                    detection_rationale: existingCause.detection_rationale || '',
                    current_controls_prevention: existingCause.current_controls_prevention || '',
                    current_controls_detection: existingCause.current_controls_detection || ''
                });
                setFailureModeSeverity(existingCause.severity || 5);
            } else {
                setFormData({
                    cause_number: maxCauseNumber + 1,
                    potential_cause: '',
                    occurrence: 5,
                    detection: 5,
                    occurrence_rationale: '',
                    detection_rationale: '',
                    current_controls_prevention: '',
                    current_controls_detection: ''
                });
            }
        }
    }, [open, failureModeId, existingCause, maxCauseNumber]);

    const loadFailureModeSeverity = async () => {
        if (!failureModeId) return;
        try {
            const { data, error } = await supabase
                .from('fmea_failure_modes')
                .select('severity')
                .eq('id', failureModeId)
                .single();

            if (error) throw error;
            setFailureModeSeverity(data?.severity || 5);
        } catch (error) {
            console.error('Failure mode severity loading error:', error);
        }
    };

    const loadMaxCauseNumber = async () => {
        if (!failureModeId) return;
        try {
            const { data, error } = await supabase
                .from('fmea_causes_controls')
                .select('cause_number')
                .eq('failure_mode_id', failureModeId)
                .order('cause_number', { ascending: false })
                .limit(1);

            if (error) throw error;
            setMaxCauseNumber(data && data.length > 0 ? data[0].cause_number : 0);
        } catch (error) {
            console.error('Max cause number loading error:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            // Failure mode'dan severity'yi al
            const { data: failureMode, error: fmError } = await supabase
                .from('fmea_failure_modes')
                .select('severity')
                .eq('id', failureModeId)
                .single();

            if (fmError) throw fmError;

            const severity = failureMode.severity;
            const occurrence = parseInt(formData.occurrence);
            const detection = parseInt(formData.detection);
            const rpn = severity * occurrence * detection;

            const dataToSubmit = {
                failure_mode_id: failureModeId,
                cause_number: parseInt(formData.cause_number),
                potential_cause: formData.potential_cause,
                severity: severity,
                occurrence: occurrence,
                detection: detection,
                rpn: rpn,
                occurrence_rationale: formData.occurrence_rationale || null,
                detection_rationale: formData.detection_rationale || null,
                current_controls_prevention: formData.current_controls_prevention || null,
                current_controls_detection: formData.current_controls_detection || null
            };

            if (existingCause) {
                const { error } = await supabase
                    .from('fmea_causes_controls')
                    .update(dataToSubmit)
                    .eq('id', existingCause.id);

                if (error) throw error;
                toast({
                    title: 'Başarılı',
                    description: 'Kök neden güncellendi.'
                });
            } else {
                const { error } = await supabase
                    .from('fmea_causes_controls')
                    .insert([dataToSubmit]);

                if (error) throw error;
                toast({
                    title: 'Başarılı',
                    description: 'Kök neden eklendi.'
                });
            }

            onSuccess();
            setOpen(false);
        } catch (error) {
            console.error('Cause save error:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: error.message || 'Kök neden kaydedilirken hata oluştu.'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {existingCause ? 'Kök Neden Düzenle' : 'Yeni Kök Neden Ekle'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="cause_number">Kök Neden Numarası</Label>
                            <Input
                                id="cause_number"
                                type="number"
                                min="1"
                                value={formData.cause_number}
                                onChange={(e) => setFormData({ ...formData, cause_number: parseInt(e.target.value) || 1 })}
                                required
                            />
                        </div>

                        <div>
                            <Label htmlFor="potential_cause">Potansiyel Kök Neden <span className="text-red-500">*</span></Label>
                            <Textarea
                                id="potential_cause"
                                value={formData.potential_cause}
                                onChange={(e) => setFormData({ ...formData, potential_cause: e.target.value })}
                                required
                                rows={3}
                            />
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <Label htmlFor="occurrence">Oluşma (O) <span className="text-red-500">*</span></Label>
                                <Input
                                    id="occurrence"
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={formData.occurrence}
                                    onChange={(e) => setFormData({ ...formData, occurrence: parseInt(e.target.value) || 1 })}
                                    required
                                />
                                <p className="text-xs text-muted-foreground mt-1">1-10 arası</p>
                            </div>

                            <div>
                                <Label htmlFor="detection">Tespit (D) <span className="text-red-500">*</span></Label>
                                <Input
                                    id="detection"
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={formData.detection}
                                    onChange={(e) => setFormData({ ...formData, detection: parseInt(e.target.value) || 1 })}
                                    required
                                />
                                <p className="text-xs text-muted-foreground mt-1">1-10 arası</p>
                            </div>

                            <div>
                                <Label>RPN</Label>
                                <Input
                                    value={failureModeSeverity * formData.occurrence * formData.detection}
                                    readOnly
                                    className="bg-muted"
                                />
                                <p className="text-xs text-muted-foreground mt-1">S ({failureModeSeverity}) × O × D</p>
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="occurrence_rationale">Oluşma Gerekçesi</Label>
                            <Textarea
                                id="occurrence_rationale"
                                value={formData.occurrence_rationale}
                                onChange={(e) => setFormData({ ...formData, occurrence_rationale: e.target.value })}
                                rows={2}
                            />
                        </div>

                        <div>
                            <Label htmlFor="detection_rationale">Tespit Gerekçesi</Label>
                            <Textarea
                                id="detection_rationale"
                                value={formData.detection_rationale}
                                onChange={(e) => setFormData({ ...formData, detection_rationale: e.target.value })}
                                rows={2}
                            />
                        </div>

                        <div>
                            <Label htmlFor="current_controls_prevention">Mevcut Önleyici Kontroller</Label>
                            <Textarea
                                id="current_controls_prevention"
                                value={formData.current_controls_prevention}
                                onChange={(e) => setFormData({ ...formData, current_controls_prevention: e.target.value })}
                                rows={2}
                            />
                        </div>

                        <div>
                            <Label htmlFor="current_controls_detection">Mevcut Tespit Kontrolleri</Label>
                            <Textarea
                                id="current_controls_detection"
                                value={formData.current_controls_detection}
                                onChange={(e) => setFormData({ ...formData, current_controls_detection: e.target.value })}
                                rows={2}
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

export default FMEACauseFormModal;

