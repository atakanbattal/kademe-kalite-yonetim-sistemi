import React, { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, File as FileIcon, X as XIcon } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { sanitizeFileName } from '@/lib/utils';
import { Input } from '@/components/ui/input';

const IncomingInspectionDecisionModal = ({ isOpen, setIsOpen, inspection, refreshData, onOpenNCForm }) => {
    const { toast } = useToast();
    const [decision, setDecision] = useState('');
    const [notes, setNotes] = useState('');
    const [file, setFile] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [quantityConditional, setQuantityConditional] = useState('');
    
    useEffect(() => {
        if (isOpen) {
            setDecision('Şartlı Kabul'); // Modal is only for conditional acceptance now
            setNotes(inspection?.notes || '');
            setQuantityConditional(inspection?.quantity_received || '');
            setFile(null);
        }
    }, [isOpen, inspection]);

    const onDrop = useCallback((acceptedFiles) => {
        setFile(acceptedFiles[0]);
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'application/pdf': ['.pdf'], 'image/*': ['.jpeg', '.jpg', '.png'] },
        maxFiles: 1
    });

    const handleConfirm = async () => {
        const conditionalQty = Number(quantityConditional);
        if (!conditionalQty || conditionalQty <= 0) {
            toast({ variant: 'destructive', title: 'Miktar Gerekli', description: 'Lütfen geçerli bir şartlı kabul miktarı girin.' });
            return;
        }
        if (!file && !inspection.deviation_approval_url) {
            toast({ variant: 'destructive', title: 'Dosya Gerekli', description: 'Şartlı kabul için sapma onayı yüklenmelidir.' });
            return;
        }

        setIsSubmitting(true);

        let deviationApprovalUrl = inspection.deviation_approval_url;
        if (file) {
            const sanitizedName = sanitizeFileName(file.name);
            const filePath = `deviation_approvals/${inspection.id}/${uuidv4()}-${sanitizedName}`;
            const { error: uploadError } = await supabase.storage.from('incoming_control').upload(filePath, file);
            if (uploadError) {
                toast({ variant: 'destructive', title: 'Hata', description: `Dosya yüklenemedi: ${uploadError.message}` });
                setIsSubmitting(false);
                return;
            }
            const { data: urlData } = supabase.storage.from('incoming_control').getPublicUrl(filePath);
            deviationApprovalUrl = urlData.publicUrl;
        }

        const currentAccepted = Number(inspection.quantity_accepted) || 0;
        const currentRejected = Number(inspection.quantity_rejected) || 0;
        const totalReceived = Number(inspection.quantity_received) || 0;

        if ((currentAccepted + currentRejected + conditionalQty) > totalReceived) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Girilen miktarların toplamı, gelen miktarı aşamaz.' });
            setIsSubmitting(false);
            return;
        }

        const updateData = {
            decision: 'Şartlı Kabul',
            notes,
            quantity_conditional: conditionalQty,
            quantity_accepted: totalReceived - conditionalQty - currentRejected, // auto-adjust accepted
            deviation_approval_url: deviationApprovalUrl,
        };

        const { error } = await supabase.from('incoming_inspections').update(updateData).eq('id', inspection.id);

        if (error) {
            toast({ variant: 'destructive', title: 'Hata', description: `Karar kaydedilemedi: ${error.message}` });
        } else {
            toast({ title: 'Başarılı', description: 'Şartlı Kabul kararı başarıyla kaydedildi.' });

            if (!inspection.non_conformity) {
                 let ncDescription = `GKK Kararı: Şartlı Kabul. \n${notes || ''}\n\nTespit Edilen Hatalar:\n`;
                if(inspection.defects && inspection.defects.length > 0){
                    ncDescription += inspection.defects.map(d => `- ${d.defect_description} (${d.quantity} adet)`).join('\n');
                } else {
                    ncDescription += "Belirtilmedi.";
                }

                onOpenNCForm({
                    source_inspection_id: inspection.id,
                    title: `${inspection.part_name} (${inspection.part_code}) GKK Şartlı Kabul`,
                    description: ncDescription,
                    supplier_id: inspection.supplier_id,
                    is_supplier_nc: true,
                    type: 'DF'
                });
            }
            
            refreshData();
            setIsOpen(false);
        }
        setIsSubmitting(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Şartlı Kabul Kararı Ver</DialogTitle>
                    <DialogDescription>
                        <b>{inspection?.part_name} ({inspection?.part_code})</b> için sapma onayı ile şartlı kabul işlemi yapın.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div>
                        <Label htmlFor="quantity_conditional">Şartlı Kabul Miktarı</Label>
                        <Input
                            id="quantity_conditional"
                            type="number"
                            value={quantityConditional}
                            onChange={(e) => setQuantityConditional(e.target.value)}
                            placeholder="Miktar girin"
                        />
                    </div>
                    <div>
                        <Label>Sapma Onayı Yükle (Zorunlu)</Label>
                        <div {...getRootProps()} className={`p-6 border-2 border-dashed rounded-lg cursor-pointer text-center transition-colors ${isDragActive ? 'border-primary bg-primary/10' : 'border-border'}`}>
                            <input {...getInputProps()} />
                            <UploadCloud className="w-10 h-10 mx-auto text-muted-foreground" />
                            {file ? <p className="mt-2 text-sm">{file.name}</p> : <p className="mt-2 text-sm text-muted-foreground">Dosyayı buraya sürükleyin veya seçin</p>}
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="decision-notes">Notlar</Label>
                        <Textarea id="decision-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Karar ile ilgili notlar..." />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>İptal</Button>
                    <Button onClick={handleConfirm} disabled={isSubmitting}>
                        {isSubmitting ? 'Kaydediliyor...' : 'Onayla ve Kaydet'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default IncomingInspectionDecisionModal;