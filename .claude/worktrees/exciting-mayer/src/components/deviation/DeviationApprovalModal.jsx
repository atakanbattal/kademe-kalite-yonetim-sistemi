import React, { useState, useEffect, useMemo } from 'react';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { useAuth } from '@/contexts/SupabaseAuthContext';
    import { useData } from '@/contexts/DataContext';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
    import { Button } from '@/components/ui/button';
    import { Textarea } from '@/components/ui/textarea';
    import { Label } from '@/components/ui/label';
    import { ScrollArea } from '@/components/ui/scroll-area';
    import { Hourglass, CheckCircle, XCircle, User } from 'lucide-react';
    import { format } from 'date-fns';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { SearchableSelectDialog } from '@/components/ui/searchable-select-dialog';

    const APPROVAL_STAGES = [
        "Üretim Planlama",
        "Ar-Ge",
        "Kalite Kontrol",
        "Fabrika Müdürü",
        "Genel Müdür (Opsiyonel)"
    ];

    const DeviationApprovalModal = ({ isOpen, setIsOpen, deviation, onRefresh }) => {
        const { toast } = useToast();
        const { profile } = useAuth();
        const { personnel } = useData();
        const [approvals, setApprovals] = useState([]);
        const [comment, setComment] = useState('');
        const [selectedStage, setSelectedStage] = useState('');
        const [selectedApproverId, setSelectedApproverId] = useState('');
        const [isSubmitting, setIsSubmitting] = useState(false);

        const personnelOptions = useMemo(() => 
            personnel.map(p => ({ value: p.id, label: p.full_name }))
        , [personnel]);

        const fetchApprovals = async () => {
            if (!deviation) return;
            const { data: existingApprovals, error } = await supabase
                .from('deviation_approvals')
                .select('*')
                .eq('deviation_id', deviation.id);

            if (error) {
                toast({ variant: 'destructive', title: 'Hata', description: 'Onay bilgileri alınamadı.' });
                return;
            }

            const allApprovals = APPROVAL_STAGES.map(stage => {
                const existing = existingApprovals.find(a => a.approval_stage === stage);
                return existing || {
                    approval_stage: stage,
                    status: 'Beklemede',
                    approver_name: null,
                    notes: null,
                    created_at: null,
                };
            });
            setApprovals(allApprovals);
            const nextStage = allApprovals.find(a => a.status === 'Beklemede')?.approval_stage;
            setSelectedStage(nextStage || '');
            setSelectedApproverId(profile?.id || '');
        };

        useEffect(() => {
            if (isOpen && deviation) {
                fetchApprovals();
            }
        }, [deviation, isOpen]);

        const handleApprovalAction = async (newStatus) => {
            if (!selectedStage) {
                toast({ variant: 'destructive', title: 'Hata', description: 'Lütfen bir onay adımı seçin.' });
                return;
            }
            if (!selectedApproverId) {
                toast({ variant: 'destructive', title: 'Hata', description: 'Lütfen onaylayan kişiyi seçin.' });
                return;
            }

            setIsSubmitting(true);

            const selectedApprover = personnel.find(p => p.id === selectedApproverId);
            if (!selectedApprover) {
                toast({ variant: 'destructive', title: 'Hata', description: 'Seçilen onaycı bulunamadı.' });
                setIsSubmitting(false);
                return;
            }

            const { data: existing, error: fetchError } = await supabase
                .from('deviation_approvals')
                .select('id')
                .eq('deviation_id', deviation.id)
                .eq('approval_stage', selectedStage)
                .maybeSingle();

            if (fetchError) {
                toast({ variant: 'destructive', title: 'Hata!', description: `Onay kontrolü başarısız: ${fetchError.message}` });
                setIsSubmitting(false);
                return;
            }

            const approvalData = {
                deviation_id: deviation.id,
                approver_id: selectedApprover.id,
                approver_name: selectedApprover.full_name,
                approval_stage: selectedStage,
                status: newStatus,
                notes: comment,
            };

            let error;
            if (existing) {
                ({ error } = await supabase.from('deviation_approvals').update(approvalData).eq('id', existing.id));
            } else {
                ({ error } = await supabase.from('deviation_approvals').insert(approvalData));
            }

            if (error) {
                toast({ variant: 'destructive', title: 'Hata!', description: `Onay işlemi başarısız: ${error.message}` });
                setIsSubmitting(false);
                return;
            }

            await fetchApprovals();
            
            const { data: allApprovals, error: allApprovalsError } = await supabase
                .from('deviation_approvals')
                .select('*')
                .eq('deviation_id', deviation.id);

            if (allApprovalsError) {
                setIsSubmitting(false);
                toast({ variant: 'warning', title: 'Uyarı', description: 'Onay durumu kontrol edilemedi.' });
                return;
            }

            // Zorunlu onay aşamaları (Genel Müdür opsiyonel)
            const requiredStages = APPROVAL_STAGES.filter(stage => !stage.includes('Opsiyonel'));
            
            const allRequiredApproved = requiredStages.every(stage =>
                allApprovals.some(a => a.approval_stage === stage && a.status === 'Onaylandı')
            );
            
            const anyRejected = allApprovals.some(a => a.status === 'Reddedildi');

            let finalStatus = 'Onay Bekliyor';
            if (anyRejected) {
                finalStatus = 'Reddedildi';
            } else if (allRequiredApproved) {
                finalStatus = 'Onaylandı';
            }

            const { error: updateStatusError } = await supabase
                .from('deviations')
                .update({ status: finalStatus })
                .eq('id', deviation.id);

            if (updateStatusError) {
                toast({ variant: 'destructive', title: 'Hata!', description: `Sapma durumu güncellenemedi: ${updateStatusError.message}` });
            } else {
                toast({ title: 'Başarılı!', description: `Onayınız başarıyla kaydedildi.` });
                setComment('');
            }
            
            await onRefresh();
            setIsSubmitting(false);
        };

        const getApprovalStatusIcon = (status) => {
            switch (status) {
                case 'Onaylandı': return <CheckCircle className="w-6 h-6 text-green-500" />;
                case 'Reddedildi': return <XCircle className="w-6 h-6 text-red-500" />;
                case 'Beklemede': return <Hourglass className="w-6 h-6 text-yellow-500" />;
                default: return <User className="w-6 h-6 text-muted-foreground" />;
            }
        };

        const availableStages = useMemo(() => {
            return APPROVAL_STAGES;
        }, []);

        return (
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
                    <DialogHeader>
                        <DialogTitle>Onay Süreci: {deviation?.request_no}</DialogTitle>
                        <DialogDescription>Lütfen ilgili aşamalar için onay durumunu belirtin.</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                        <ScrollArea className="h-96 pr-4">
                            <div className="space-y-4">
                                <h4 className="font-semibold text-lg">Onay Durumları</h4>
                                {approvals.map((approval, index) => (
                                    <div key={index} className="flex items-start gap-4 p-3 border rounded-lg bg-muted/50">
                                        <div className="flex-shrink-0 pt-1">{getApprovalStatusIcon(approval.status)}</div>
                                        <div className="flex-grow">
                                            <p className="font-semibold">{approval.approval_stage}</p>
                                            <p className="text-sm font-medium">{approval.approver_name || 'Onaycı bekleniyor...'}</p>
                                            <p className="text-sm text-muted-foreground italic">"{approval.notes || 'Yorum yok.'}"</p>
                                            {approval.created_at && <p className="text-xs text-muted-foreground mt-1">{format(new Date(approval.created_at), 'dd.MM.yyyy HH:mm')}</p>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                        <div className="space-y-4">
                            <h4 className="font-semibold text-lg">Yeni Onay/Red</h4>
                            <div>
                                <Label htmlFor="approval-stage">Onay Aşaması</Label>
                                <Select value={selectedStage} onValueChange={setSelectedStage}>
                                    <SelectTrigger id="approval-stage">
                                        <SelectValue placeholder="Aşama seçin..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableStages.map(stage => (
                                            <SelectItem key={stage} value={stage}>{stage}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                             <div>
                                <Label htmlFor="approver">Onaylayan Kişi</Label>
                                <SearchableSelectDialog
                                    options={personnelOptions}
                                    value={selectedApproverId}
                                    onChange={setSelectedApproverId}
                                    triggerPlaceholder="Onaycı seçin..."
                                    dialogTitle="Onaycı Seç"
                                    searchPlaceholder="Personel ara..."
                                    notFoundText="Personel bulunamadı."
                                />
                            </div>
                            <div>
                                <Label htmlFor="comments">Yorumunuz</Label>
                                <Textarea
                                    id="comments"
                                    placeholder="Onay veya ret nedeninizi buraya yazın..."
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    className="min-h-[120px]"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4 pt-4">
                                 <Button variant="destructive" onClick={() => handleApprovalAction('Reddedildi')} disabled={isSubmitting || !selectedStage || !selectedApproverId}>
                                    {isSubmitting ? 'İşleniyor...' : 'Reddet'}
                                </Button>
                                <Button onClick={() => handleApprovalAction('Onaylandı')} disabled={isSubmitting || !selectedStage || !selectedApproverId} className="bg-green-600 hover:bg-green-700">
                                    {isSubmitting ? 'İşleniyor...' : 'Onayla'}
                                </Button>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsOpen(false)}>Kapat</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    };

    export default DeviationApprovalModal;