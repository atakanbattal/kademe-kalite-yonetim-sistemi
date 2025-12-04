import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import NCFormModal from '@/components/df-8d/modals/NCFormModal';

const CreateNCFromComplaintModal = ({ open, setOpen, complaint, onSuccess }) => {
    const { toast } = useToast();
    const [selectedType, setSelectedType] = useState('DF');
    const [isNCModalOpen, setNCModalOpen] = useState(false);
    const [preparedData, setPreparedData] = useState(null);

    // Şikayet bilgilerini hazırla
    useEffect(() => {
        if (open && complaint) {
            const data = {
                type: selectedType,
                title: `Müşteri Şikayeti: ${complaint.title || 'Başlıksız'}`,
                description: `${complaint.description || ''}\n\nMüşteri: ${complaint.customer?.name || 'N/A'} (${complaint.customer?.customer_code || 'N/A'})\nŞikayet No: ${complaint.complaint_no || 'N/A'}`,
                nc_type: 'Müşteri Şikayeti',
                source: 'Müşteri Şikayeti',
                detection_date: new Date().toISOString().split('T')[0],
                status: 'Yeni',
                severity: complaint.severity || 'Orta',
                priority: complaint.priority || 'Orta',
                product_code: complaint.product_code || '',
                product_name: complaint.product_name || '',
                batch_number: complaint.batch_number || '',
                quantity_affected: complaint.quantity_affected || null,
                responsible_department_id: complaint.responsible_department_id || null,
                responsible_person_id: complaint.responsible_personnel_id || null,
                assigned_to_id: complaint.assigned_to_id || null,
                source_complaint_id: complaint.id
            };
            setPreparedData(data);
        }
    }, [open, complaint, selectedType]);

    const handleProceed = () => {
        // Ana modalı kapat, NC Form modalını aç
        setOpen(false);
        setNCModalOpen(true);
    };

    const handleNCFormSave = async (formData, files) => {
        try {
            // NC kaydını oluştur
            const { data: ncRecord, error: ncError } = await supabase
                .from('non_conformities')
                .insert([formData])
                .select()
                .single();

            if (ncError) throw ncError;

            // Şikayetin ilgili uygunsuzluk ID'sini güncelle
            const { error: updateError } = await supabase
                .from('customer_complaints')
                .update({ related_nc_id: ncRecord.id })
                .eq('id', complaint.id);

            if (updateError) console.error('Şikayet güncelleme hatası:', updateError);

            return { data: ncRecord, error: null };
        } catch (error) {
            console.error('NC oluşturma hatası:', error);
            return { data: null, error };
        }
    };

    const handleNCFormSaveSuccess = () => {
        toast({
            title: 'Başarılı!',
            description: `${selectedType} kaydı oluşturuldu ve şikayete bağlandı.`
        });
        if (onSuccess) onSuccess();
    };

    return (
        <>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-orange-500" />
                            Uygunsuzluk Oluştur
                        </DialogTitle>
                        <DialogDescription>
                            Bu şikayetten DF veya 8D kaydı oluşturun.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <div className="text-sm">
                                <span className="font-medium">Şikayet:</span> {complaint?.title}
                            </div>
                            <div className="text-sm text-muted-foreground">
                                <span className="font-medium">Müşteri:</span> {complaint?.customer?.name || 'N/A'}
                            </div>
                            <div className="text-sm text-muted-foreground">
                                <span className="font-medium">Önem:</span> {complaint?.severity || 'Orta'}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <Label>Uygunsuzluk Tipi</Label>
                            <RadioGroup value={selectedType} onValueChange={setSelectedType}>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="DF" id="df" />
                                    <Label htmlFor="df" className="font-normal cursor-pointer">
                                        DF (Düzeltici Faaliyet)
                                    </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="8D" id="8d" />
                                    <Label htmlFor="8d" className="font-normal cursor-pointer">
                                        8D (8 Disiplin Metodu)
                                    </Label>
                                </div>
                            </RadioGroup>
                            <p className="text-xs text-muted-foreground">
                                {selectedType === 'DF' 
                                    ? 'Basit ve hızlı çözüm gerektiren uygunsuzluklar için' 
                                    : 'Karmaşık, sistematik analiz gerektiren uygunsuzluklar için (8 adımlı süreç)'}
                            </p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            İptal
                        </Button>
                        <Button onClick={handleProceed}>
                            Devam Et
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {preparedData && (
                <NCFormModal
                    isOpen={isNCModalOpen}
                    setIsOpen={setNCModalOpen}
                    record={preparedData}
                    onSave={handleNCFormSave}
                    onSaveSuccess={handleNCFormSaveSuccess}
                />
            )}
        </>
    );
};

export default CreateNCFromComplaintModal;

