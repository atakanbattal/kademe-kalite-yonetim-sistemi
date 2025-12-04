import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';

const PROTOCOL_TYPES = ['IQ', 'OQ', 'PQ'];
const PROTOCOL_STATUSES = ['Not Started', 'In Progress', 'Completed', 'Failed'];

const ValidationProtocolFormModal = ({ open, setOpen, existingProtocol, planId, onSuccess }) => {
    const { toast } = useToast();
    const [formData, setFormData] = useState({
        protocol_type: 'IQ',
        protocol_number: 1,
        status: 'Not Started',
        acceptance_criteria: '',
        actual_results: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (existingProtocol) {
            setFormData({
                protocol_type: existingProtocol.protocol_type,
                protocol_number: existingProtocol.protocol_number,
                status: existingProtocol.status,
                acceptance_criteria: existingProtocol.acceptance_criteria || '',
                actual_results: existingProtocol.actual_results || ''
            });
        } else {
            setFormData({
                protocol_type: 'IQ',
                protocol_number: 1,
                status: 'Not Started',
                acceptance_criteria: '',
                actual_results: ''
            });
        }
    }, [existingProtocol, open]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const dataToSubmit = {
                validation_plan_id: planId,
                ...formData
            };

            if (existingProtocol) {
                const { error } = await supabase
                    .from('validation_protocols')
                    .update(dataToSubmit)
                    .eq('id', existingProtocol.id);

                if (error) throw error;
                toast({
                    title: 'Başarılı',
                    description: 'Protokol güncellendi.'
                });
            } else {
                const { error } = await supabase
                    .from('validation_protocols')
                    .insert([dataToSubmit]);

                if (error) throw error;
                toast({
                    title: 'Başarılı',
                    description: 'Protokol oluşturuldu.'
                });
            }

            onSuccess();
        } catch (error) {
            console.error('Error saving protocol:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: error.message || 'Protokol kaydedilirken hata oluştu.'
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
                        {existingProtocol ? 'Protokol Düzenle' : 'Yeni Validasyon Protokolü'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="protocol_type">Protokol Tipi *</Label>
                                <Select
                                    value={formData.protocol_type}
                                    onValueChange={(v) => setFormData({ ...formData, protocol_type: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PROTOCOL_TYPES.map(type => (
                                            <SelectItem key={type} value={type}>{type}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="protocol_number">Protokol Numarası *</Label>
                                <Input
                                    id="protocol_number"
                                    type="number"
                                    value={formData.protocol_number}
                                    onChange={(e) => setFormData({ ...formData, protocol_number: parseInt(e.target.value) })}
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="status">Durum *</Label>
                                <Select
                                    value={formData.status}
                                    onValueChange={(v) => setFormData({ ...formData, status: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PROTOCOL_STATUSES.map(status => (
                                            <SelectItem key={status} value={status}>{status}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="md:col-span-2">
                                <Label htmlFor="acceptance_criteria">Kabul Kriterleri</Label>
                                <Textarea
                                    id="acceptance_criteria"
                                    value={formData.acceptance_criteria}
                                    onChange={(e) => setFormData({ ...formData, acceptance_criteria: e.target.value })}
                                    rows={3}
                                />
                            </div>
                            <div className="md:col-span-2">
                                <Label htmlFor="actual_results">Gerçekleşen Sonuçlar</Label>
                                <Textarea
                                    id="actual_results"
                                    value={formData.actual_results}
                                    onChange={(e) => setFormData({ ...formData, actual_results: e.target.value })}
                                    rows={4}
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

export default ValidationProtocolFormModal;

