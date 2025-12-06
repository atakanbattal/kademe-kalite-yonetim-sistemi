import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';

const FMEAFunctionFormModal = ({ open, setOpen, existingFunction, projectId, onSuccess }) => {
    const { toast } = useToast();
    const [formData, setFormData] = useState({
        function_number: 1,
        function_name: '',
        function_description: '',
        display_order: 0
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [maxFunctionNumber, setMaxFunctionNumber] = useState(0);

    useEffect(() => {
        if (open && projectId) {
            loadMaxFunctionNumber();
        }
    }, [open, projectId]);

    useEffect(() => {
        if (existingFunction) {
            setFormData({
                function_number: existingFunction.function_number || 1,
                function_name: existingFunction.function_name || '',
                function_description: existingFunction.function_description || '',
                display_order: existingFunction.display_order || 0
            });
        } else {
            setFormData({
                function_number: maxFunctionNumber + 1,
                function_name: '',
                function_description: '',
                display_order: maxFunctionNumber
            });
        }
    }, [existingFunction, maxFunctionNumber, open]);

    const loadMaxFunctionNumber = async () => {
        if (!projectId) return;
        try {
            const { data, error } = await supabase
                .from('fmea_functions')
                .select('function_number')
                .eq('fmea_project_id', projectId)
                .order('function_number', { ascending: false })
                .limit(1);

            if (error) throw error;
            setMaxFunctionNumber(data && data.length > 0 ? data[0].function_number : 0);
        } catch (error) {
            console.error('Max function number loading error:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            if (!projectId) {
                toast({
                    variant: 'destructive',
                    title: 'Hata',
                    description: 'Proje ID bulunamadı.'
                });
                setIsSubmitting(false);
                return;
            }

            const dataToSubmit = {
                ...formData,
                fmea_project_id: projectId,
                function_number: parseInt(formData.function_number) || 1,
                display_order: parseInt(formData.display_order) || 0
            };

            if (existingFunction) {
                const { error } = await supabase
                    .from('fmea_functions')
                    .update(dataToSubmit)
                    .eq('id', existingFunction.id);

                if (error) throw error;
                toast({
                    title: 'Başarılı',
                    description: 'Fonksiyon güncellendi.'
                });
            } else {
                const { error } = await supabase
                    .from('fmea_functions')
                    .insert([dataToSubmit]);

                if (error) throw error;
                toast({
                    title: 'Başarılı',
                    description: 'Fonksiyon oluşturuldu.'
                });
            }

            onSuccess();
            setOpen(false);
        } catch (error) {
            console.error('Error saving function:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: error.message || 'Fonksiyon kaydedilirken hata oluştu.'
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
                        {existingFunction ? 'Fonksiyon Düzenle' : 'Yeni Fonksiyon'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="function_number">Fonksiyon Numarası *</Label>
                                <Input
                                    id="function_number"
                                    type="number"
                                    min="1"
                                    value={formData.function_number}
                                    onChange={(e) => setFormData({ ...formData, function_number: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="display_order">Görüntüleme Sırası</Label>
                                <Input
                                    id="display_order"
                                    type="number"
                                    value={formData.display_order}
                                    onChange={(e) => setFormData({ ...formData, display_order: e.target.value })}
                                />
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="function_name">Fonksiyon Adı *</Label>
                            <Input
                                id="function_name"
                                value={formData.function_name}
                                onChange={(e) => setFormData({ ...formData, function_name: e.target.value })}
                                required
                            />
                        </div>

                        <div>
                            <Label htmlFor="function_description">Fonksiyon Açıklaması</Label>
                            <Textarea
                                id="function_description"
                                value={formData.function_description}
                                onChange={(e) => setFormData({ ...formData, function_description: e.target.value })}
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

export default FMEAFunctionFormModal;

