import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const DECISION_TYPES = ['Serbest Bırak', 'Sapma Onayı', 'Yeniden İşlem', 'Hurda', 'İade', 'Onay Bekliyor'];

/** Sapma modülü + imzalı PDF zorunlu */
const DECISIONS_REQUIRING_DEVIATION = ['Serbest Bırak', 'Sapma Onayı', 'Yeniden İşlem'];

const QUARANTINE_DEVIATION_FLOW_KEY = 'kademe_qms_quarantine_deviation_flow';

const QuarantineDecisionModal = ({ isOpen, setIsOpen, record, refreshData, onHurdaTutanagiRequest }) => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [decision, setDecision] = useState('');
    const [quantity, setQuantity] = useState(0);
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (record && isOpen) {
            setQuantity(record.quantity);
            setDecision('');
            setNotes('');
        }
    }, [record, isOpen]);

    const handleSubmit = async () => {
        if (!decision) {
            toast({ variant: 'destructive', title: 'Karar Seçilmedi', description: 'Lütfen bir karar seçin.' });
            return;
        }
        if (quantity <= 0 || quantity > record.quantity) {
            toast({ variant: 'destructive', title: 'Geçersiz Miktar', description: `Miktar 1 ile ${record.quantity} arasında olmalıdır.` });
            return;
        }

        if (decision === 'Hurda') {
            if (typeof onHurdaTutanagiRequest === 'function') {
                onHurdaTutanagiRequest({
                    quantity,
                    notes: notes || '',
                });
                toast({
                    title: 'Hurda tutanağı',
                    description: 'İmzalı PDF yükleyerek karantina kararını tamamlayın.',
                });
                setIsOpen(false);
                return;
            }
            toast({
                variant: 'destructive',
                title: 'Yapılandırma eksik',
                description: 'Hurda tutanağı akışı bağlı değil. Lütfen yöneticiye bildirin.',
            });
            return;
        }

        if (DECISIONS_REQUIRING_DEVIATION.includes(decision)) {
            try {
                sessionStorage.setItem(
                    QUARANTINE_DEVIATION_FLOW_KEY,
                    JSON.stringify({
                        quarantineRecordId: record.id,
                        quantity,
                        decision,
                        notes: notes || '',
                    })
                );
            } catch (e) {
                toast({
                    variant: 'destructive',
                    title: 'Oturum hatası',
                    description: 'Tarayıcı depolamasına yazılamadı. Lütfen tekrar deneyin.',
                });
                return;
            }
            toast({
                title: 'Sapma modülüne yönlendiriliyorsunuz',
                description:
                    'İmzalı sapma onayı PDF dosyasını sapma kaydına ekleyerek karantina kararını tamamlayın.',
            });
            setIsOpen(false);
            navigate('/deviation');
            return;
        }

        setIsSubmitting(true);

        try {
            const remainingQuantity = record.quantity - quantity;

            const { error: historyError } = await supabase.from('quarantine_history').insert({
                quarantine_record_id: record.id,
                processed_quantity: quantity,
                decision: decision,
                notes: notes,
                decision_date: new Date().toISOString(),
                deviation_approval_url: null,
            });

            if (historyError) throw historyError;

            let newStatus;
            if (remainingQuantity > 0) {
                newStatus = 'Karantinada';
            } else {
                const statusMap = {
                    'Serbest Bırak': 'Serbest Bırakıldı',
                    'Sapma Onayı': 'Sapma Onaylı',
                    'Yeniden İşlem': 'Yeniden İşlem',
                    Hurda: 'Hurda',
                    İade: 'İade',
                    'Onay Bekliyor': 'Onay Bekliyor',
                };
                newStatus = statusMap[decision] || 'Tamamlandı';
            }

            const { error: updateError } = await supabase
                .from('quarantine_records')
                .update({
                    quantity: remainingQuantity,
                    status: newStatus,
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

    const submitLabel = (() => {
        if (isSubmitting) return 'Kaydediliyor...';
        if (decision === 'Hurda') return 'Hurda tutanağına devam et';
        if (DECISIONS_REQUIRING_DEVIATION.includes(decision)) return 'Sapma modülüne git';
        return 'Kararı Kaydet';
    })();

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-y-auto p-6">
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
                                {DECISION_TYPES.map((type) => (
                                    <SelectItem key={type} value={type}>{type}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label htmlFor="quantity" className="text-foreground">İşlem Miktarı <span className="text-red-500">*</span></Label>
                        <Input id="quantity" type="number" value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 0)} max={record?.quantity} min="1" />
                    </div>

                    {DECISIONS_REQUIRING_DEVIATION.includes(decision) && (
                        <div className="text-sm p-3 bg-amber-50 border border-amber-200 text-amber-950 rounded-md">
                            <strong>Sapma onayı zorunlu:</strong> Sapma Yönetimi açılacak; imzalı sapma onayı PDF eklenmeden karantina
                            kararı tamamlanmaz.
                        </div>
                    )}

                    {decision === 'Hurda' && (
                        <div className="text-sm p-3 bg-amber-50 border border-amber-200 text-amber-950 rounded-md">
                            <strong>Hurda tutanağı zorunlu:</strong> Sonraki adımda imzalı hurda tutanağı PDF yüklenmeden karantina
                            güncellenmez.
                        </div>
                    )}

                    {decision === 'İade' && (
                        <div className="text-sm p-3 bg-slate-50 border border-slate-200 text-slate-800 rounded-md">
                            İade kararı ek dosya gerektirmez; kayıt doğrudan kapatılır.
                        </div>
                    )}

                    <div>
                        <Label htmlFor="notes" className="text-foreground">Notlar</Label>
                        <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Kararla ilgili notlarınızı buraya ekleyebilirsiniz..."/>
                    </div>

                    {decision === 'Yeniden İşlem' && (
                        <div className="text-sm p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-md">
                            Sapma süreci tamamlandıktan sonra bu karar türü Kalite Maliyeti modülüne yansıtılabilir.
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button onClick={() => setIsOpen(false)} variant="outline">İptal</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting || !decision || quantity <= 0}>
                        {submitLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default QuarantineDecisionModal;
