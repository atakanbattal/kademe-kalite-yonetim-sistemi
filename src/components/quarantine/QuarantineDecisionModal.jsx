import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { History, AlertCircle, CheckCircle2, Clock, FileWarning } from 'lucide-react';
import { cn } from '@/lib/utils';

const DECISION_TYPES = ['Serbest Bırak', 'Sapma Onayı', 'Yeniden İşlem', 'Hurda', 'İade', 'Onay Bekliyor'];
const DECISIONS_REQUIRING_DEVIATION = ['Serbest Bırak', 'Sapma Onayı', 'Yeniden İşlem'];

const DECISION_COLORS = {
    'Serbest Bırak': 'bg-emerald-100 text-emerald-800 border-emerald-300',
    'Sapma Onayı': 'bg-violet-100 text-violet-800 border-violet-300',
    'Yeniden İşlem': 'bg-blue-100 text-blue-800 border-blue-300',
    'Hurda': 'bg-red-100 text-red-800 border-red-300',
    'İade': 'bg-orange-100 text-orange-800 border-orange-300',
    'Onay Bekliyor': 'bg-amber-100 text-amber-800 border-amber-300',
};

const QuarantineDecisionModal = ({
    isOpen,
    setIsOpen,
    record,
    refreshData,
    onHurdaTutanagiRequest,
    onStartDeviationFlow,
    restoreDraft,
    onRestoreDraftApplied,
}) => {
    const { toast } = useToast();
    const [decision, setDecision] = useState('');
    const [quantity, setQuantity] = useState(0);
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const skipNextDefaultResetRef = useRef(false);

    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    useEffect(() => {
        if (!record?.id || !isOpen) {
            setHistory([]);
            return;
        }
        setHistoryLoading(true);
        supabase
            .from('quarantine_history')
            .select('id, decision, processed_quantity, decision_date, deviation_approval_url, quality_cost_id, notes')
            .eq('quarantine_record_id', record.id)
            .order('decision_date', { ascending: true })
            .then(({ data }) => {
                setHistory(data || []);
                setHistoryLoading(false);
            });
    }, [record?.id, isOpen]);

    const totalProcessed = useMemo(
        () => history.reduce((sum, h) => sum + (h.processed_quantity || 0), 0),
        [history]
    );

    const initialQuantity = useMemo(() => {
        if (record?.initial_quantity) return record.initial_quantity;
        return totalProcessed + (record?.quantity || 0);
    }, [totalProcessed, record]);

    const hasPendingHurda = useMemo(
        () => history.some((h) => h.decision === 'Hurda' && !h.deviation_approval_url && !h.quality_cost_id),
        [history]
    );

    useEffect(() => {
        if (!record || !isOpen) return;
        if (restoreDraft) {
            setQuantity(restoreDraft.quantity ?? record.quantity);
            setDecision(restoreDraft.decision || '');
            setNotes(restoreDraft.notes || '');
            skipNextDefaultResetRef.current = true;
            onRestoreDraftApplied?.();
            return;
        }
        if (skipNextDefaultResetRef.current) {
            skipNextDefaultResetRef.current = false;
            return;
        }
        setQuantity(record.quantity);
        setDecision('');
        setNotes('');
    }, [record, isOpen, restoreDraft, onRestoreDraftApplied]);

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
                onHurdaTutanagiRequest({ quantity, notes: notes || '' });
                toast({ title: 'Hurda tutanağı', description: 'İmzalı PDF yükleyerek karantina kararını tamamlayın.' });
                setIsOpen(false);
                return;
            }
            toast({ variant: 'destructive', title: 'Yapılandırma eksik', description: 'Hurda tutanağı akışı bağlı değil.' });
            return;
        }

        if (DECISIONS_REQUIRING_DEVIATION.includes(decision)) {
            if (typeof onStartDeviationFlow !== 'function') {
                toast({ variant: 'destructive', title: 'Yapılandırma eksik', description: 'Sapma akışı bağlı değil.' });
                return;
            }
            toast({
                title: 'Sapma kaydı',
                description: 'Sapma formu açılıyor; imzalı PDF ekleyerek kararı tamamlayın. İptal ederseniz bu ekrana dönersiniz.',
            });
            onStartDeviationFlow({ quarantineRecordId: record.id, quantity, decision, notes: notes || '' });
            setIsOpen(false);
            return;
        }

        setIsSubmitting(true);
        try {
            const remainingQuantity = record.quantity - quantity;

            const { error: historyError } = await supabase.from('quarantine_history').insert({
                quarantine_record_id: record.id,
                processed_quantity: quantity,
                decision,
                notes,
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
                .update({ quantity: remainingQuantity, status: newStatus, decision, decision_date: new Date().toISOString() })
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
        if (decision === 'Hurda') return 'Hurda tutanağına devam et →';
        if (DECISIONS_REQUIRING_DEVIATION.includes(decision)) return 'Sapma formu ile devam et →';
        return 'Kararı Kaydet';
    })();

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-4xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-y-auto p-0">
                <DialogHeader className="sr-only">
                    <DialogTitle>Karantina Kararı Ver</DialogTitle>
                    <DialogDescription>Karantina kararı giriş formu</DialogDescription>
                </DialogHeader>

                {/* Header */}
                <div className="bg-gradient-to-r from-primary to-blue-700 px-6 py-5 text-white rounded-t-lg">
                    <h2 className="text-lg font-bold">Karantina Kararı Ver</h2>
                    <p className="text-sm text-blue-100 mt-0.5">
                        <span className="font-semibold">{record?.part_name}</span>
                        {record?.part_code && <span className="font-mono ml-1 opacity-80">({record.part_code})</span>}
                    </p>
                </div>

                <div className="p-6 space-y-5">
                    {/* Miktar Özet Kartları */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-xl border bg-muted/30 p-3 text-center">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Başlangıç</p>
                            <p className="text-xl font-bold text-foreground tabular-nums">{initialQuantity}</p>
                            <p className="text-[10px] text-muted-foreground">{record?.unit}</p>
                        </div>
                        <div className="rounded-xl border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 p-3 text-center">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-1">İşlenen</p>
                            <p className="text-xl font-bold text-amber-800 dark:text-amber-300 tabular-nums">{totalProcessed}</p>
                            <p className="text-[10px] text-amber-600 dark:text-amber-500">{record?.unit}</p>
                        </div>
                        <div className={cn(
                            'rounded-xl border p-3 text-center',
                            (record?.quantity || 0) > 0
                                ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
                                : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
                        )}>
                            <p className={cn(
                                'text-[10px] font-semibold uppercase tracking-wider mb-1',
                                (record?.quantity || 0) > 0 ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'
                            )}>Kalan</p>
                            <p className={cn(
                                'text-xl font-bold tabular-nums',
                                (record?.quantity || 0) > 0 ? 'text-red-800 dark:text-red-300' : 'text-emerald-800 dark:text-emerald-300'
                            )}>{record?.quantity || 0}</p>
                            <p className={cn(
                                'text-[10px]',
                                (record?.quantity || 0) > 0 ? 'text-red-600 dark:text-red-500' : 'text-emerald-600 dark:text-emerald-500'
                            )}>{record?.unit}</p>
                        </div>
                    </div>

                    {/* Önceki Kararlar */}
                    {(historyLoading || history.length > 0) && (
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <History className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-semibold text-foreground">Önceki kararlar</span>
                                {history.length > 0 && (
                                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{history.length}</Badge>
                                )}
                            </div>
                            {historyLoading ? (
                                <p className="text-xs text-muted-foreground py-2">Yükleniyor…</p>
                            ) : (
                                <div className="rounded-lg border border-border overflow-hidden">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="bg-muted/50 border-b border-border">
                                                <th className="px-3 py-2 text-left font-semibold text-muted-foreground">#</th>
                                                <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Karar</th>
                                                <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Miktar</th>
                                                <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Tarih</th>
                                                <th className="px-3 py-2 text-center font-semibold text-muted-foreground">Tutanak</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {history.map((h, idx) => {
                                                const hasTutanak = !!h.deviation_approval_url || !!h.quality_cost_id;
                                                const isPendingHurda = h.decision === 'Hurda' && !hasTutanak;
                                                return (
                                                    <tr key={h.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                                                        <td className="px-3 py-2 text-muted-foreground font-mono">{idx + 1}</td>
                                                        <td className="px-3 py-2">
                                                            <span className={cn(
                                                                'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border',
                                                                DECISION_COLORS[h.decision] || 'bg-gray-100 text-gray-700 border-gray-300'
                                                            )}>
                                                                {h.decision}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2 text-right font-semibold tabular-nums">
                                                            {h.processed_quantity} {record?.unit}
                                                        </td>
                                                        <td className="px-3 py-2 text-muted-foreground">
                                                            {new Date(h.decision_date).toLocaleDateString('tr-TR')}
                                                        </td>
                                                        <td className="px-3 py-2 text-center">
                                                            {hasTutanak ? (
                                                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mx-auto" />
                                                            ) : isPendingHurda ? (
                                                                <FileWarning className="h-3.5 w-3.5 text-amber-500 mx-auto" title="Hurda tutanağı bekleniyor" />
                                                            ) : (
                                                                <Clock className="h-3.5 w-3.5 text-muted-foreground/50 mx-auto" />
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {hasPendingHurda && (
                        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
                            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                            <span>Bu kayıt için imzalanmamış hurda tutanağı var. Kaydı görüntüleyerek tutanağı yükleyebilirsiniz.</span>
                        </div>
                    )}

                    {(record?.quantity || 0) <= 0 ? (
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300 text-center">
                            <CheckCircle2 className="h-5 w-5 mx-auto mb-1" />
                            <p className="font-semibold">Tüm miktar işlendi.</p>
                            <p className="text-xs mt-0.5 opacity-75">Kalan miktar sıfır olduğu için yeni karar girilemez.</p>
                        </div>
                    ) : (
                        <>
                            <Separator />
                            {/* Yeni Karar Formu */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <div className="h-5 w-0.5 bg-primary rounded-full" />
                                    <span className="text-sm font-semibold text-foreground">Yeni karar</span>
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="decision">Karar <span className="text-red-500">*</span></Label>
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

                                    <div className="space-y-2">
                                        <Label htmlFor="quantity">
                                            İşlem Miktarı <span className="text-red-500">*</span>
                                            <span className="text-muted-foreground font-normal ml-1">(maks. {record?.quantity} {record?.unit})</span>
                                        </Label>
                                        <Input
                                            id="quantity"
                                            type="number"
                                            value={quantity}
                                            onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 0)}
                                            max={record?.quantity}
                                            min="1"
                                        />
                                    </div>
                                </div>

                                {DECISIONS_REQUIRING_DEVIATION.includes(decision) && (
                                    <div className="text-sm p-3 bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800 text-amber-900 dark:text-amber-200 rounded-lg">
                                        <strong>Sapma onayı zorunlu:</strong> Sapma formu açılır; en az bir PDF eklenerek tamamlanmalıdır. İptal ederseniz bu ekrana dönersiniz.
                                    </div>
                                )}

                                {decision === 'Hurda' && (
                                    <div className="text-sm p-3 bg-red-50 border border-red-200 dark:bg-red-950/20 dark:border-red-800 text-red-900 dark:text-red-200 rounded-lg">
                                        <strong>Hurda tutanağı:</strong> Sonraki adımda hurda tutanağı PDF yüklenmelidir. İsterseniz kararı kaydedip tutanağı sonradan da yükleyebilirsiniz.
                                    </div>
                                )}

                                {decision === 'İade' && (
                                    <div className="text-sm p-3 bg-slate-50 border border-slate-200 text-slate-800 rounded-lg">
                                        İade kararı ek dosya gerektirmez; kayıt doğrudan kapatılır.
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <Label htmlFor="notes">Notlar</Label>
                                    <Textarea
                                        id="notes"
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="Kararla ilgili notlarınızı buraya ekleyebilirsiniz..."
                                        rows={3}
                                    />
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="border-t px-6 py-4 flex items-center justify-end gap-2 bg-muted/20">
                    <Button onClick={() => setIsOpen(false)} variant="outline">İptal</Button>
                    {(record?.quantity || 0) > 0 && (
                        <Button
                            onClick={handleSubmit}
                            disabled={isSubmitting || !decision || quantity <= 0}
                        >
                            {submitLabel}
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default QuarantineDecisionModal;
