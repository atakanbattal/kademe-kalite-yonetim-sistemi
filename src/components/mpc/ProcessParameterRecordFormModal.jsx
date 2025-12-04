import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useData } from '@/contexts/DataContext';
import { SearchableSelectDialog } from '@/components/ui/searchable-select-dialog';

const SHIFTS = ['A', 'B', 'C', 'Gündüz', 'Gece'];

const ProcessParameterRecordFormModal = ({ open, setOpen, existingRecord, parameterId, onSuccess }) => {
    const { toast } = useToast();
    const { personnel } = useData();
    const [parameter, setParameter] = useState(null);
    const [formData, setFormData] = useState({
        record_date: new Date().toISOString(),
        recorded_value: '',
        shift: '',
        operator_id: null
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        // Parametre bilgilerini yükle
        const loadParameter = async () => {
            if (parameterId) {
                const { data, error } = await supabase
                    .from('process_parameters')
                    .select('*')
                    .eq('id', parameterId)
                    .single();

                if (!error && data) {
                    setParameter(data);
                }
            }
        };

        loadParameter();
    }, [parameterId]);

    useEffect(() => {
        if (existingRecord) {
            setFormData({
                record_date: existingRecord.record_date || new Date().toISOString(),
                recorded_value: existingRecord.recorded_value?.toString() || '',
                shift: existingRecord.shift || '',
                operator_id: existingRecord.operator_id || null
            });
        } else {
            setFormData({
                record_date: new Date().toISOString(),
                recorded_value: '',
                shift: '',
                operator_id: null
            });
        }
    }, [existingRecord, open]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const recordedValue = parseFloat(formData.recorded_value);
            const isOutOfSpec = parameter && (
                (parameter.usl && recordedValue > parameter.usl) ||
                (parameter.lsl && recordedValue < parameter.lsl)
            );
            const deviationAmount = parameter && (
                (parameter.usl && recordedValue > parameter.usl) ? recordedValue - parameter.usl :
                (parameter.lsl && recordedValue < parameter.lsl) ? parameter.lsl - recordedValue : 0
            );

            const dataToSubmit = {
                parameter_id: parameterId,
                record_date: formData.record_date,
                recorded_value: recordedValue,
                shift: formData.shift || null,
                operator_id: formData.operator_id || null,
                is_out_of_spec: isOutOfSpec || false,
                deviation_amount: deviationAmount || null
            };

            if (existingRecord) {
                const { error } = await supabase
                    .from('process_parameter_records')
                    .update(dataToSubmit)
                    .eq('id', existingRecord.id);

                if (error) throw error;
                toast({
                    title: 'Başarılı',
                    description: 'Kayıt güncellendi.'
                });
            } else {
                const { error } = await supabase
                    .from('process_parameter_records')
                    .insert([dataToSubmit]);

                if (error) throw error;
                toast({
                    title: 'Başarılı',
                    description: 'Kayıt oluşturuldu.'
                });
            }

            onSuccess();
        } catch (error) {
            console.error('Error saving record:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: error.message || 'Kayıt kaydedilirken hata oluştu.'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const personnelOptions = personnel.map(p => ({ value: p.id, label: p.full_name }));

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>
                        {existingRecord ? 'Kayıt Düzenle' : 'Yeni Parametre Kaydı'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        {parameter && (
                            <div className="p-3 bg-blue-50 rounded-lg">
                                <p className="text-sm font-medium text-blue-900">Parametre: {parameter.parameter_name}</p>
                                {parameter.usl && parameter.lsl && (
                                    <p className="text-xs text-blue-700 mt-1">
                                        Limitler: {parameter.lsl} - {parameter.usl} {parameter.unit || ''}
                                    </p>
                                )}
                            </div>
                        )}
                        <div>
                            <Label htmlFor="record_date">Kayıt Tarihi *</Label>
                            <Input
                                id="record_date"
                                type="datetime-local"
                                value={formData.record_date ? new Date(formData.record_date).toISOString().slice(0, 16) : ''}
                                onChange={(e) => setFormData({ ...formData, record_date: new Date(e.target.value).toISOString() })}
                                required
                            />
                        </div>
                        <div>
                            <Label htmlFor="recorded_value">Ölçülen Değer *</Label>
                            <Input
                                id="recorded_value"
                                type="number"
                                step="0.000001"
                                value={formData.recorded_value}
                                onChange={(e) => setFormData({ ...formData, recorded_value: e.target.value })}
                                required
                            />
                            {parameter && parameter.usl && parameter.lsl && formData.recorded_value && (
                                <p className={`text-xs mt-1 ${
                                    (parseFloat(formData.recorded_value) > parameter.usl || 
                                     parseFloat(formData.recorded_value) < parameter.lsl) 
                                    ? 'text-red-600' : 'text-green-600'
                                }`}>
                                    {(parseFloat(formData.recorded_value) > parameter.usl || 
                                      parseFloat(formData.recorded_value) < parameter.lsl) 
                                    ? '⚠ Limit dışında!' : '✓ Limitler içinde'}
                                </p>
                            )}
                        </div>
                        <div>
                            <Label htmlFor="shift">Vardiya</Label>
                            <Select
                                value={formData.shift}
                                onValueChange={(v) => setFormData({ ...formData, shift: v })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Vardiya seçin..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {SHIFTS.map(shift => (
                                        <SelectItem key={shift} value={shift}>{shift}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Operatör</Label>
                            <SearchableSelectDialog
                                options={personnelOptions}
                                value={formData.operator_id}
                                onChange={(v) => setFormData({ ...formData, operator_id: v })}
                                triggerPlaceholder="Operatör Seçin"
                            />
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

export default ProcessParameterRecordFormModal;

