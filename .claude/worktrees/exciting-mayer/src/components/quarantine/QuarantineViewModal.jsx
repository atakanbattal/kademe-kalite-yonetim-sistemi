import React, { useState, useEffect, useCallback, useMemo } from 'react';
    import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
    import { Button } from '@/components/ui/button';
    import { ScrollArea } from '@/components/ui/scroll-area';
    import { Label } from '@/components/ui/label';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
    import { FileText, History, Paperclip, Image as ImageIcon, ExternalLink } from 'lucide-react';
    import { openPrintableReport } from '@/lib/reportUtils';
    import { normalizeQuarantineAttachments } from '@/lib/quarantineAttachments';

    const DetailItem = ({ label, value }) => (
        <div className="grid grid-cols-3 gap-2 py-2.5 border-b border-border/60">
            <Label className="font-semibold text-muted-foreground col-span-1 text-sm">{label}</Label>
            <p className="text-foreground col-span-2 break-words text-sm">{value || '-'}</p>
        </div>
    );

    const QuarantineViewModal = ({ isOpen, setIsOpen, record }) => {
        const [history, setHistory] = useState([]);
        const [loadingHistory, setLoadingHistory] = useState(true);
        const [resolvedUrls, setResolvedUrls] = useState({});
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
                setHistory(data || []);
            }
            setLoadingHistory(false);
        }, [record, toast]);

        const initialQuantity = useMemo(() => {
            if (record?.initial_quantity) {
                return record.initial_quantity;
            }
            if (!history || history.length === 0) return record?.quantity || 0;
            const totalProcessed = history.reduce((sum, h) => sum + (h.processed_quantity || 0), 0);
            return (record?.quantity || 0) + totalProcessed;
        }, [history, record]);

        const attachmentList = useMemo(() => normalizeQuarantineAttachments(record?.attachments), [record?.attachments]);

        useEffect(() => {
            if (!isOpen || attachmentList.length === 0) {
                setResolvedUrls({});
                return;
            }
            const urls = {};
            for (const att of attachmentList) {
                if (!att.path) continue;
                const pub = supabase.storage.from('quarantine_documents').getPublicUrl(att.path);
                urls[att.path] = pub.data?.publicUrl || att.public_url || null;
            }
            setResolvedUrls(urls);
        }, [isOpen, attachmentList]);

        useEffect(() => {
            if (isOpen) {
                fetchHistory();
            }
        }, [isOpen, fetchHistory]);

    const handleDownloadPDF = (e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        const resolvedAttachments = attachmentList.map((att) => {
            const url = resolvedUrls[att.path] || att.public_url;
            if (!url && att.path) {
                const pub = supabase.storage.from('quarantine_documents').getPublicUrl(att.path);
                return { ...att, public_url: pub.data?.publicUrl || null };
            }
            return { ...att, public_url: url };
        });
        const recordWithHistory = {
            ...record,
            history: history,
            attachments: resolvedAttachments,
        };
        openPrintableReport(recordWithHistory, 'quarantine', true);
    };

        if (!record) return null;

        return (
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
                    <DialogHeader className="sr-only"><DialogTitle>Karantina Kaydı Detayı</DialogTitle></DialogHeader>
                    <header className="bg-gradient-to-r from-primary to-blue-700 px-6 py-5 flex items-center justify-between text-white shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="bg-white/20 p-2.5 rounded-lg"><FileText className="h-5 w-5 text-white" /></div>
                            <div>
                                <h1 className="text-lg font-bold tracking-tight">Karantina Kaydı Detayı</h1>
                                <p className="text-[11px] text-blue-100 uppercase tracking-[0.15em] font-medium">{record.part_name} ({record.part_code})</p>
                            </div>
                            <span className="ml-2 px-3 py-1 bg-white/20 border border-white/30 text-white/90 text-[10px] font-bold rounded-full uppercase tracking-wider">{record.status}</span>
                        </div>
                    </header>
                    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-4 pb-6">
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
                                        <DetailItem label="Başlangıç Miktarı" value={`${initialQuantity} ${record.unit}`} />
                                        <DetailItem label="Mevcut Miktar" value={`${record.quantity} ${record.unit}`} />
                                        <DetailItem label="İşlenen Toplam Miktar" value={`${initialQuantity - (record.quantity || 0)} ${record.unit}`} />
                                        <DetailItem label="Karantina Tarihi" value={new Date(record.quarantine_date).toLocaleDateString('tr-TR')} />
                                        <DetailItem label="Durum" value={record.status} />
                                        <DetailItem label="Sebep Olan Birim" value={record.source_department} />
                                        <DetailItem label="Sebep Olan Tedarikçi" value={record.supplier_name} />
                                        <DetailItem label="Talebi Yapan Birim" value={record.requesting_department} />
                                        <DetailItem label="Talebi Yapan Kişi" value={record.requesting_person_name} />
                                        <DetailItem label="Neden Karantinaya Alındı" value={record.description || 'Belirtilmemiş'} />
                                        {record.decision && (
                                            <DetailItem label="Son Karar" value={`${record.decision}${record.decision_date ? ` (${new Date(record.decision_date).toLocaleDateString('tr-TR')})` : ''}`} />
                                        )}
                                        {attachmentList.length > 0 && (
                                            <div className="pt-4 mt-3 border-t border-border/60">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <ImageIcon className="w-4 h-4 text-primary" />
                                                    <Label className="font-semibold text-foreground text-sm">Ürün Görselleri ve Ekler</Label>
                                                </div>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                                    {attachmentList.map((att, idx) => {
                                                        const url = resolvedUrls[att.path] || att.public_url || null;
                                                        const isImg =
                                                            (att.mime_type && att.mime_type.startsWith('image/')) ||
                                                            /\.(jpe?g|png|gif|webp|bmp)$/i.test(att.name || '');
                                                        return (
                                                            <div key={att.path || idx} className="group rounded-xl border border-border/80 bg-card shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                                                                {isImg && url ? (
                                                                    <a href={url} target="_blank" rel="noopener noreferrer" className="block">
                                                                        <div className="relative aspect-[4/3] bg-muted">
                                                                            <img
                                                                                src={url}
                                                                                alt={att.name || ''}
                                                                                className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                                                                                loading="lazy"
                                                                            />
                                                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                                                                <ExternalLink className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                                                                            </div>
                                                                        </div>
                                                                        <div className="px-2.5 py-2 border-t border-border/40">
                                                                            <p className="text-[11px] truncate text-muted-foreground font-medium">{att.name}</p>
                                                                        </div>
                                                                    </a>
                                                                ) : url ? (
                                                                    <a
                                                                        href={url}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="flex items-center gap-2.5 p-3.5 text-sm text-primary hover:bg-primary/5 transition-colors"
                                                                    >
                                                                        <FileText className="w-5 h-5 shrink-0" />
                                                                        <span className="truncate font-medium">{att.name || 'PDF / dosya'}</span>
                                                                    </a>
                                                                ) : (
                                                                    <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
                                                                        <FileText className="w-4 h-4 shrink-0" />
                                                                        <span className="truncate">{att.name}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </ScrollArea>
                            </TabsContent>
                            <TabsContent value="history" className="mt-4 flex-grow overflow-hidden">
                                <ScrollArea className="h-full pr-4">
                                    {loadingHistory ? (
                                        <p className="text-muted-foreground">Yükleniyor...</p>
                                    ) : history.length > 0 ? (
                                        <div className="space-y-4">
                                            {/* Timeline görünümü */}
                                            <div className="relative">
                                                {history.map((h, index) => {
                                                    const isLast = index === history.length - 1;
                                                    const decisionColors = {
                                                        'Serbest Bırak': 'bg-green-100 border-green-300 text-green-800',
                                                        'Sapma Onayı': 'bg-blue-100 border-blue-300 text-blue-800',
                                                        'Yeniden İşlem': 'bg-yellow-100 border-yellow-300 text-yellow-800',
                                                        'Hurda': 'bg-red-100 border-red-300 text-red-800',
                                                        'İade': 'bg-orange-100 border-orange-300 text-orange-800',
                                                        'Onay Bekliyor': 'bg-gray-100 border-gray-300 text-gray-800'
                                                    };
                                                    const colorClass = decisionColors[h.decision] || 'bg-gray-100 border-gray-300 text-gray-800';
                                                    
                                                    return (
                                                        <div key={h.id} className="relative pb-8">
                                                            {!isLast && (
                                                                <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-border"></div>
                                                            )}
                                                            <div className="flex gap-4">
                                                                <div className="flex-shrink-0">
                                                                    <div className={`w-8 h-8 rounded-full border-2 ${colorClass.replace('bg-', 'bg-').replace('border-', 'border-')} flex items-center justify-center font-bold text-sm`}>
                                                                        {index + 1}
                                                                    </div>
                                                                </div>
                                                                <div className={`flex-1 p-4 rounded-lg border-2 ${colorClass}`}>
                                                                    <div className="flex justify-between items-start mb-2">
                                                                        <div>
                                                                            <h4 className="font-bold text-lg">{h.decision}</h4>
                                                                            <p className="text-sm opacity-80">
                                                                                {new Date(h.decision_date).toLocaleString('tr-TR', {
                                                                                    day: '2-digit',
                                                                                    month: 'long',
                                                                                    year: 'numeric',
                                                                                    hour: '2-digit',
                                                                                    minute: '2-digit'
                                                                                })}
                                                                            </p>
                                                                        </div>
                                                                        <div className="text-right">
                                                                            <p className="font-bold text-xl">{h.processed_quantity} {record.unit}</p>
                                                                            <p className="text-xs opacity-70">İşlenen Miktar</p>
                                                                        </div>
                                                                    </div>
                                                                    {h.notes && (
                                                                        <div className="mt-3 pt-3 border-t border-current/20">
                                                                            <p className="text-sm font-semibold mb-1">Notlar:</p>
                                                                            <p className="text-sm whitespace-pre-wrap">{h.notes}</p>
                                                                        </div>
                                                                    )}
                                                                    {h.deviation_approval_url && (
                                                                        <div className="mt-2">
                                                                            <a 
                                                                                href={h.deviation_approval_url} 
                                                                                target="_blank" 
                                                                                rel="noopener noreferrer"
                                                                                className="text-sm underline hover:opacity-80"
                                                                            >
                                                                                Sapma Onayı Belgesi →
                                                                            </a>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            
                                            {/* Özet Bilgi */}
                                            <div className="mt-6 p-4 bg-muted rounded-lg">
                                                <h4 className="font-semibold mb-2">Özet</h4>
                                                <div className="grid grid-cols-2 gap-4 text-sm">
                                                    <div>
                                                        <span className="text-muted-foreground">Toplam İşlem Sayısı:</span>
                                                        <span className="font-semibold ml-2">{history.length}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-muted-foreground">Toplam İşlenen Miktar:</span>
                                                        <span className="font-semibold ml-2">{history.reduce((sum, h) => sum + (h.processed_quantity || 0), 0)} {record.unit}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center py-8">
                                            <p className="text-muted-foreground mb-2">Bu kayıt için işlem geçmişi bulunamadı.</p>
                                            <p className="text-sm text-muted-foreground">Henüz bu karantina kaydı için karar verilmemiş.</p>
                                        </div>
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