import React, { useState, useEffect, useCallback } from 'react';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
    import { Button } from '@/components/ui/button';
    import { ScrollArea } from '@/components/ui/scroll-area';
    import { Label } from '@/components/ui/label';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
    import { FileText, History, Paperclip } from 'lucide-react';
    import { openPrintableReport } from '@/lib/reportUtils';

    const DetailItem = ({ label, value }) => (
        <div className="grid grid-cols-3 gap-2 py-2 border-b border-border">
            <Label className="font-semibold text-muted-foreground col-span-1">{label}</Label>
            <p className="text-foreground col-span-2 break-words">{value || '-'}</p>
        </div>
    );

    const QuarantineViewModal = ({ isOpen, setIsOpen, record }) => {
        const [history, setHistory] = useState([]);
        const [loadingHistory, setLoadingHistory] = useState(true);
        const { toast } = useToast();

        const fetchHistory = useCallback(async () => {
            if (!record?.id) return;
            setLoadingHistory(true);
            const { data, error } = await supabase
                .from('quarantine_history')
                .select('*')
                .eq('quarantine_record_id', record.id)
                .order('decision_date', { ascending: false });

            if (error) {
                toast({ variant: 'destructive', title: 'Hata!', description: 'İşlem geçmişi alınamadı.' });
            } else {
                setHistory(data);
            }
            setLoadingHistory(false);
        }, [record, toast]);

        useEffect(() => {
            if (isOpen) {
                fetchHistory();
            }
        }, [isOpen, fetchHistory]);

    const handleDownloadPDF = async () => {
        // İşlem geçmişini de rapor için ekle
        const recordWithHistory = {
            ...record,
            history: history
        };
        openPrintableReport(recordWithHistory, 'quarantine', true);
    };

        if (!record) return null;

        return (
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-4xl flex flex-col h-[80vh]">
                    <DialogHeader>
                        <DialogTitle className="text-primary text-2xl">Karantina Kaydı Detayı</DialogTitle>
                        <DialogDescription>
                            {record.part_name} ({record.part_code}) - Karantina kaydına ait tüm bilgiler.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex-grow overflow-hidden">
                        <Tabs defaultValue="details" className="h-full flex flex-col">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="details"><Paperclip className="w-4 h-4 mr-2"/>Detaylar</TabsTrigger>
                                <TabsTrigger value="history"><History className="w-4 h-4 mr-2"/>İşlem Geçmişi</TabsTrigger>
                            </TabsList>
                            <TabsContent value="details" className="mt-4 flex-grow overflow-hidden">
                                <ScrollArea className="h-full pr-4">
                                    <div className="space-y-1">
                                        <DetailItem label="Parça Adı" value={record.part_name} />
                                        <DetailItem label="Parça Kodu" value={record.part_code} />
                                        <DetailItem label="Lot / Seri No" value={record.lot_no} />
                                        <DetailItem label="Mevcut Miktar" value={`${record.quantity} ${record.unit}`} />
                                        <DetailItem label="Karantina Tarihi" value={new Date(record.quarantine_date).toLocaleDateString('tr-TR')} />
                                        <DetailItem label="Durum" value={record.status} />
                                        <DetailItem label="Sebep Olan Birim" value={record.source_department} />
                                        <DetailItem label="Talebi Yapan Birim" value={record.requesting_department} />
                                        <DetailItem label="Talebi Yapan Kişi" value={record.requesting_person_name} />
                                        <DetailItem label="Açıklama" value={record.description} />
                                    </div>
                                </ScrollArea>
                            </TabsContent>
                            <TabsContent value="history" className="mt-4 flex-grow overflow-hidden">
                                <ScrollArea className="h-full pr-4">
                                    {loadingHistory ? (
                                        <p className="text-muted-foreground">Yükleniyor...</p>
                                    ) : history.length > 0 ? (
                                        <div className="overflow-x-auto">
                                            <table className="data-table w-full">
                                                <thead>
                                                    <tr>
                                                        <th>Tarih</th>
                                                        <th>Karar</th>
                                                        <th>Miktar</th>
                                                        <th>Notlar</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {history.map(h => (
                                                        <tr key={h.id}>
                                                            <td>{new Date(h.decision_date).toLocaleString('tr-TR')}</td>
                                                            <td>{h.decision}</td>
                                                            <td>{h.processed_quantity}</td>
                                                            <td>{h.notes || '-'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <p className="text-muted-foreground text-center py-8">Bu kayıt için işlem geçmişi bulunamadı.</p>
                                    )}
                                </ScrollArea>
                            </TabsContent>
                        </Tabs>
                    </div>
                    <DialogFooter className="justify-between sm:justify-between pt-4 border-t">
                        <div>
                            <Button type="button" variant="outline" onClick={handleDownloadPDF}>
                                <FileText className="w-4 h-4 mr-2" />
                                PDF Raporu Oluştur
                            </Button>
                        </div>
                        <div className="flex gap-2">
                            <Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>Kapat</Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    };

    export default QuarantineViewModal;