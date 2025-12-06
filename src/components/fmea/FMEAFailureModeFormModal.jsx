import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';

const FMEAFailureModeFormModal = ({ open, setOpen, existingFailureMode, functionId, onSuccess }) => {
    const { toast } = useToast();
    const [formData, setFormData] = useState({
        failure_mode_number: 1,
        failure_mode_description: '',
        potential_effect: '',
        severity: 5,
        severity_rationale: '',
        is_special_characteristic: false,
        classification: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [maxFailureModeNumber, setMaxFailureModeNumber] = useState(0);

    useEffect(() => {
        if (open && functionId) {
            loadMaxFailureModeNumber();
        }
    }, [open, functionId]);

    useEffect(() => {
        if (existingFailureMode) {
            setFormData({
                failure_mode_number: existingFailureMode.failure_mode_number || 1,
                failure_mode_description: existingFailureMode.failure_mode_description || '',
                potential_effect: existingFailureMode.potential_effect || '',
                severity: existingFailureMode.severity || 5,
                severity_rationale: existingFailureMode.severity_rationale || '',
                is_special_characteristic: existingFailureMode.is_special_characteristic || false,
                classification: existingFailureMode.classification || ''
            });
        } else {
            setFormData({
                failure_mode_number: maxFailureModeNumber + 1,
                failure_mode_description: '',
                potential_effect: '',
                severity: 5,
                severity_rationale: '',
                is_special_characteristic: false,
                classification: ''
            });
        }
    }, [existingFailureMode, maxFailureModeNumber, open]);

    const loadMaxFailureModeNumber = async () => {
        if (!functionId) return;
        try {
            const { data, error } = await supabase
                .from('fmea_failure_modes')
                .select('failure_mode_number')
                .eq('function_id', functionId)
                .order('failure_mode_number', { ascending: false })
                .limit(1);

            if (error) throw error;
            setMaxFailureModeNumber(data && data.length > 0 ? data[0].failure_mode_number : 0);
        } catch (error) {
            console.error('Max failure mode number loading error:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            if (!functionId) {
                toast({
                    variant: 'destructive',
                    title: 'Hata',
                    description: 'Fonksiyon ID bulunamadı.'
                });
                setIsSubmitting(false);
                return;
            }

            const dataToSubmit = {
                ...formData,
                function_id: functionId,
                failure_mode_number: parseInt(formData.failure_mode_number) || 1,
                severity: parseInt(formData.severity) || 5,
                classification: formData.is_special_characteristic ? (formData.classification || 'CC') : null
            };

            if (existingFailureMode) {
                const { error } = await supabase
                    .from('fmea_failure_modes')
                    .update(dataToSubmit)
                    .eq('id', existingFailureMode.id);

                if (error) throw error;
                toast({
                    title: 'Başarılı',
                    description: 'Hata modu güncellendi.'
                });
            } else {
                const { error } = await supabase
                    .from('fmea_failure_modes')
                    .insert([dataToSubmit]);

                if (error) throw error;
                toast({
                    title: 'Başarılı',
                    description: 'Hata modu oluşturuldu.'
                });
            }

            onSuccess();
            setOpen(false);
        } catch (error) {
            console.error('Error saving failure mode:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: error.message || 'Hata modu kaydedilirken hata oluştu.'
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
                        {existingFailureMode ? 'Hata Modu Düzenle' : 'Yeni Hata Modu'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="failure_mode_number">Hata Modu Numarası *</Label>
                            <Input
                                id="failure_mode_number"
                                type="number"
                                min="1"
                                value={formData.failure_mode_number}
                                onChange={(e) => setFormData({ ...formData, failure_mode_number: e.target.value })}
                                required
                            />
                        </div>

                        <div>
                            <Label htmlFor="failure_mode_description">Hata Modu Açıklaması *</Label>
                            <Textarea
                                id="failure_mode_description"
                                value={formData.failure_mode_description}
                                onChange={(e) => setFormData({ ...formData, failure_mode_description: e.target.value })}
                                rows={3}
                                required
                            />
                        </div>

                        <div>
                            <Label htmlFor="potential_effect">Potansiyel Etki</Label>
                            <Textarea
                                id="potential_effect"
                                value={formData.potential_effect}
                                onChange={(e) => setFormData({ ...formData, potential_effect: e.target.value })}
                                rows={2}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="severity">Severity (Şiddet) * (1-10)</Label>
                                <Select
                                    value={formData.severity.toString()}
                                    onValueChange={(v) => setFormData({ ...formData, severity: parseInt(v) })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(s => (
                                            <SelectItem key={s} value={s.toString()}>
                                                {s}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="severity_rationale">Şiddet Gerekçesi</Label>
                                <Input
                                    id="severity_rationale"
                                    value={formData.severity_rationale}
                                    onChange={(e) => setFormData({ ...formData, severity_rationale: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="is_special_characteristic"
                                checked={formData.is_special_characteristic}
                                onCheckedChange={(checked) => setFormData({ ...formData, is_special_characteristic: checked })}
                            />
                            <Label htmlFor="is_special_characteristic" className="cursor-pointer">
                                Özel Karakteristik
                            </Label>
                        </div>

                        {formData.is_special_characteristic && (
                            <div>
                                <Label htmlFor="classification">Sınıflandırma</Label>
                                <Select
                                    value={formData.classification}
                                    onValueChange={(v) => setFormData({ ...formData, classification: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seçiniz" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="CC">CC (Critical Characteristic)</SelectItem>
                                        <SelectItem value="SC">SC (Significant Characteristic)</SelectItem>
                                        <SelectItem value="Key">Key</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
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

export default FMEAFailureModeFormModal;

