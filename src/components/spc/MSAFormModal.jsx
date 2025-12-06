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

const MSAFormModal = ({ open, setOpen, existingStudy, onSuccess }) => {
    const { toast } = useToast();
    const { equipments = [] } = useData();
    const [formData, setFormData] = useState({
        study_name: '',
        characteristic_id: null,
        measurement_equipment_id: null,
        study_type: 'GageR&R',
        gage_rr_percent: null,
        ndc: null,
        recommendation: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [characteristics, setCharacteristics] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open) {
            loadCharacteristics();
            if (existingStudy) {
                setFormData({
                    study_name: existingStudy.study_name || '',
                    characteristic_id: existingStudy.characteristic_id || null,
                    measurement_equipment_id: existingStudy.measurement_equipment_id || null,
                    study_type: existingStudy.study_type || 'GageR&R',
                    gage_rr_percent: existingStudy.gage_rr_percent || null,
                    ndc: existingStudy.ndc || null,
                    recommendation: existingStudy.recommendation || ''
                });
            } else {
                setFormData({
                    study_name: '',
                    characteristic_id: null,
                    measurement_equipment_id: null,
                    study_type: 'GageR&R',
                    gage_rr_percent: null,
                    ndc: null,
                    recommendation: ''
                });
            }
        }
    }, [open, existingStudy]);

    const loadCharacteristics = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('spc_characteristics')
                .select('id, characteristic_name, characteristic_code')
                .eq('is_active', true)
                .order('characteristic_name', { ascending: true });

            if (error) {
                if (error.code === '42P01' || error.message.includes('does not exist')) {
                    toast({
                        variant: 'destructive',
                        title: 'Tablo Bulunamadı',
                        description: 'spc_characteristics tablosu henüz oluşturulmamış.'
                    });
                    setCharacteristics([]);
                    return;
                }
                throw error;
            }
            setCharacteristics(data || []);
        } catch (error) {
            console.error('Characteristics loading error:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Karakteristikler yüklenirken hata oluştu.'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const dataToSubmit = {
                ...formData,
                gage_rr_percent: formData.gage_rr_percent ? parseFloat(formData.gage_rr_percent) : null,
                ndc: formData.ndc ? parseInt(formData.ndc) : null,
                characteristic_id: formData.characteristic_id || null,
                measurement_equipment_id: formData.measurement_equipment_id || null
            };

            if (existingStudy) {
                const { error } = await supabase
                    .from('spc_msa_studies')
                    .update(dataToSubmit)
                    .eq('id', existingStudy.id);

                if (error) throw error;
                toast({
                    title: 'Başarılı',
                    description: 'MSA çalışması güncellendi.'
                });
            } else {
                const { error } = await supabase
                    .from('spc_msa_studies')
                    .insert([dataToSubmit]);

                if (error) throw error;
                toast({
                    title: 'Başarılı',
                    description: 'MSA çalışması oluşturuldu.'
                });
            }

            onSuccess();
            setOpen(false);
        } catch (error) {
            console.error('MSA study save error:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: error.message || 'MSA çalışması kaydedilirken hata oluştu.'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const equipmentOptions = (equipments || []).map(e => ({ 
        value: e.id, 
        label: `${e.name || e.equipment_name || 'Bilinmeyen'} (${e.serial_number || e.equipment_code || 'N/A'})` 
    }));

    const characteristicOptions = (characteristics || []).map(c => ({
        value: c.id,
        label: `${c.characteristic_code || 'N/A'} - ${c.characteristic_name || 'Bilinmeyen'}`
    }));

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {existingStudy ? 'MSA Çalışması Düzenle' : 'Yeni MSA Çalışması'}
                    </DialogTitle>
                </DialogHeader>
                {loading ? (
                    <div className="py-12 text-center text-muted-foreground">
                        Yükleniyor...
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-4">
                        <div>
                            <Label htmlFor="study_name">Çalışma Adı <span className="text-red-500">*</span></Label>
                            <Input
                                id="study_name"
                                value={formData.study_name}
                                onChange={(e) => setFormData({ ...formData, study_name: e.target.value })}
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="study_type">Çalışma Tipi</Label>
                                <Select
                                    value={formData.study_type}
                                    onValueChange={(value) => setFormData({ ...formData, study_type: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="GageR&R">Gage R&R</SelectItem>
                                        <SelectItem value="Bias">Bias</SelectItem>
                                        <SelectItem value="Linearity">Linearity</SelectItem>
                                        <SelectItem value="Stability">Stability</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label htmlFor="characteristic_id">Kritik Karakteristik</Label>
                                <Select
                                    value={formData.characteristic_id || ''}
                                    onValueChange={(value) => setFormData({ ...formData, characteristic_id: value || null })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seçiniz" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="">Seçiniz</SelectItem>
                                        {characteristicOptions.map(opt => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="measurement_equipment_id">Ölçüm Ekipmanı</Label>
                            <Select
                                value={formData.measurement_equipment_id || ''}
                                onValueChange={(value) => setFormData({ ...formData, measurement_equipment_id: value || null })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Seçiniz" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">Seçiniz</SelectItem>
                                    {equipmentOptions.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="gage_rr_percent">%Gage R&R</Label>
                                <Input
                                    id="gage_rr_percent"
                                    type="number"
                                    step="0.01"
                                    value={formData.gage_rr_percent || ''}
                                    onChange={(e) => setFormData({ ...formData, gage_rr_percent: e.target.value || null })}
                                />
                            </div>

                            <div>
                                <Label htmlFor="ndc">NDC (Number of Distinct Categories)</Label>
                                <Input
                                    id="ndc"
                                    type="number"
                                    value={formData.ndc || ''}
                                    onChange={(e) => setFormData({ ...formData, ndc: e.target.value || null })}
                                />
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="recommendation">Öneri</Label>
                            <Textarea
                                id="recommendation"
                                value={formData.recommendation}
                                onChange={(e) => setFormData({ ...formData, recommendation: e.target.value })}
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
                )}
            </DialogContent>
        </Dialog>
    );
};

export default MSAFormModal;

