import React, { useState, useEffect } from 'react';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/customSupabaseClient';
    import { Button } from '@/components/ui/button';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
    import { Label } from '@/components/ui/label';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { Input } from '@/components/ui/input';
    import { Textarea } from '@/components/ui/textarea';
    import { v4 as uuidv4 } from 'uuid';

    const DECISION_TYPES = ['Serbest Bırak', 'Sapma Onayı', 'Yeniden İşlem', 'Hurda', 'İade', 'Onay Bekliyor'];

    const QuarantineDecisionModal = ({ isOpen, setIsOpen, record, refreshData }) => {
        const { toast } = useToast();
        const [decision, setDecision] = useState('');
        const [quantity, setQuantity] = useState(0);
        const [notes, setNotes] = useState('');
        const [file, setFile] = useState(null);
        const [isSubmitting, setIsSubmitting] = useState(false);

        useEffect(() => {
            if (record && isOpen) {
                setQuantity(record.quantity);
                setDecision('');
                setNotes('');
                setFile(null);
            }
        }, [record, isOpen]);

        const handleFileChange = (e) => {
            if (e.target.files && e.target.files.length > 0) {
                setFile(e.target.files[0]);
            }
        };
        
        const uploadFile = async () => {
            if (!file) return null;
            const fileName = `${uuidv4()}-${file.name}`;
            const filePath = `deviation_approvals/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('quarantine_documents')
                .upload(filePath, file);
            
            if (uploadError) {
                throw new Error(`Dosya yüklenemedi: ${uploadError.message}`);
            }

            const { data } = supabase.storage.from('quarantine_documents').getPublicUrl(filePath);
            return data.publicUrl;
        };

        const handleSubmit = async () => {
            if (!decision) {
                toast({ variant: 'destructive', title: 'Karar Seçilmedi', description: 'Lütfen bir karar seçin.' });
                return;
            }
            if (quantity <= 0 || quantity > record.quantity) {
                toast({ variant: 'destructive', title: 'Geçersiz Miktar', description: `Miktar 1 ile ${record.quantity} arasında olmalıdır.` });
                return;
            }
            setIsSubmitting(true);

            try {
                let deviation_approval_url = null;
                if (decision === 'Sapma Onayı') {
                    if(!file) {
                       toast({ variant: 'destructive', title: 'Dosya Eksik', description: 'Lütfen sapma onayı PDF dosyasını yükleyin.' });
                       setIsSubmitting(false);
                       return;
                    }
                    deviation_approval_url = await uploadFile();
                }

                const remainingQuantity = record.quantity - quantity;

                const { error: historyError } = await supabase
                    .from('quarantine_history')
                    .insert({
                        quarantine_record_id: record.id,
                        processed_quantity: quantity,
                        decision: decision,
                        notes: notes,
                        decision_date: new Date().toISOString(),
                        deviation_approval_url: deviation_approval_url,
                    });

                if (historyError) throw historyError;

                const { error: updateError } = await supabase
                    .from('quarantine_records')
                    .update({
                        quantity: remainingQuantity,
                        status: remainingQuantity > 0 ? 'Karantinada' : 'Tamamlandı',
                        decision: decision,
                        decision_date: new Date().toISOString(),
                    })
                    .eq('id', record.id);

                if (updateError) throw updateError;
                
                toast({ title: 'Başarılı!', description: 'Karar başarıyla kaydedildi.' });
                refreshData();
                setIsOpen(false);
            } catch (error) {
                toast({ variant: 'destructive', title: 'Hata!', description: error.message });
            } finally {
                setIsSubmitting(false);
            }
        };

        return (
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="text-foreground">Karantina Kararı Ver</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            <b>{record?.part_name} (Mevcut: {record?.quantity} {record?.unit})</b> için kararınızı belirtin.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div>
                            <Label htmlFor="decision" className="text-foreground">Karar <span className="text-red-500">*</span></Label>
                            <Select onValueChange={setDecision} value={decision}>
                                <SelectTrigger id="decision">
                                    <SelectValue placeholder="Bir karar seçin..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {DECISION_TYPES.map(type => (
                                        <SelectItem key={type} value={type}>{type}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label htmlFor="quantity" className="text-foreground">İşlem Miktarı <span className="text-red-500">*</span></Label>
                            <Input id="quantity" type="number" value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 0)} max={record?.quantity} min="1" />
                        </div>

                        {decision === 'Sapma Onayı' && (
                            <div>
                                <Label htmlFor="deviation-pdf" className="text-foreground">Sapma Onayı PDF</Label>
                                <Input id="deviation-pdf" type="file" accept="application/pdf" onChange={handleFileChange} />
                            </div>
                        )}

                        <div>
                            <Label htmlFor="notes" className="text-foreground">Notlar</Label>
                            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Kararla ilgili notlarınızı buraya ekleyebilirsiniz..."/>
                        </div>

                        {(decision === 'Hurda' || decision === 'Yeniden İşlem') && (
                            <div className="text-sm p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-md">
                                Bu karar, Kalitesizlik Maliyeti modülüne otomatik olarak bir kayıt oluşturacaktır.
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setIsOpen(false)} variant="outline">İptal</Button>
                        <Button onClick={handleSubmit} disabled={isSubmitting || !decision || quantity <= 0}>
                            {isSubmitting ? 'Kaydediliyor...' : 'Kararı Kaydet'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    };

    export default QuarantineDecisionModal;