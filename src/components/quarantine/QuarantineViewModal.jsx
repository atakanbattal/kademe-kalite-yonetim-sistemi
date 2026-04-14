import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, History, Paperclip, Image as ImageIcon, ExternalLink, ClipboardSignature, Upload, GitBranch } from 'lucide-react';
import { openPrintableReport } from '@/lib/reportUtils';
import { normalizeQuarantineAttachments } from '@/lib/quarantineAttachments';
import { QUARANTINE_DECISION_TYPES } from '@/lib/quarantineDecisionCertificate';
import { v4 as uuidv4 } from 'uuid';
import { sanitizeFileName, getAttachmentDisplayName } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const QUARANTINE_FILES_BUCKET = 'quarantine_documents';
const RECORD_ATTACHMENTS_PREFIX = 'record_attachments';

const DetailItem = ({ label, value }) => (
    <div className="grid grid-cols-3 gap-2 py-2.5 border-b border-border/60">
        <Label className="font-semibold text-muted-foreground col-span-1 text-sm">{label}</Label>
        <p className="text-foreground col-span-2 break-words text-sm">{value || '-'}</p>
    </div>
);

const QuarantineViewModal = ({ isOpen, setIsOpen, record, onRecordUpdated, refreshData }) => {
    const [history, setHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [resolvedUrls, setResolvedUrls] = useState({});
    const [linkedDeviations, setLinkedDeviations] = useState([]);
    const [deviationAttUrls, setDeviationAttUrls] = useState({});
    const { toast } = useToast();

    const [certDecision, setCertDecision] = useState('');
    const [certQuantity, setCertQuantity] = useState('');
    const [certNotes, setCertNotes] = useState('');
    const [certHistoryId, setCertHistoryId] = useState('');
    const [certUploading, setCertUploading] = useState(false);
    const certFileRef = useRef(null);

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

    const deviationAttachmentsFor = useCallback(
        (deviationId) => {
            const dev = linkedDeviations.find((d) => d.id === deviationId);
            return dev?.deviation_attachments || [];
        },
        [linkedDeviations]
    );

    useEffect(() => {
        if (!isOpen || attachmentList.length === 0) {
            setResolvedUrls({});
            return;
        }
        const urls = {};
        for (const att of attachmentList) {
            if (!att.path) continue;
            const pub = supabase.storage.from(QUARANTINE_FILES_BUCKET).getPublicUrl(att.path);
            urls[att.path] = pub.data?.publicUrl || att.public_url || null;
        }
        setResolvedUrls(urls);
    }, [isOpen, attachmentList]);

    useEffect(() => {
        if (isOpen) {
            fetchHistory();
        }
    }, [isOpen, fetchHistory]);

    useEffect(() => {
        if (!isOpen || !record?.id) {
            setLinkedDeviations([]);
            return;
        }
        const deviationIds = [...new Set((history || []).map((h) => h.deviation_id).filter(Boolean))];
        if (deviationIds.length === 0) {
            setLinkedDeviations([]);
            return;
        }
        let cancelled = false;
        (async () => {
            const { data, error } = await supabase
                .from('deviations')
                .select('id, request_no, deviation_attachments(*)')
                .in('id', deviationIds);
            if (cancelled) return;
            if (error) {
                toast({
                    variant: 'destructive',
                    title: 'Sapma ekleri yüklenemedi',
                    description: error.message,
                });
                setLinkedDeviations([]);
                return;
            }
            setLinkedDeviations(data || []);
        })();
        return () => {
            cancelled = true;
        };
    }, [isOpen, record?.id, history, toast]);

    useEffect(() => {
        if (!linkedDeviations.length) {
            setDeviationAttUrls({});
            return;
        }
        let cancelled = false;
        (async () => {
            const next = {};
            for (const dev of linkedDeviations) {
                const attachments = dev.deviation_attachments;
                if (!attachments || !Array.isArray(attachments)) continue;
                for (const att of attachments) {
                    if (!att?.file_path || !att?.id) continue;
                    const { data, error } = await supabase.storage
                        .from('deviation_attachments')
                        .createSignedUrl(att.file_path, 3600);
                    if (!error && data?.signedUrl) {
                        next[att.id] = data.signedUrl;
                    }
                }
            }
            if (!cancelled) setDeviationAttUrls(next);
        })();
        return () => {
            cancelled = true;
        };
    }, [linkedDeviations]);

    useEffect(() => {
        if (isOpen && record) {
            setCertQuantity(String(record.quantity ?? ''));
            setCertNotes('');
            setCertHistoryId('');
            setCertDecision('');
        }
    }, [isOpen, record?.id]);

    const handleCertHistoryChange = (val) => {
        setCertHistoryId(val);
        if (!val) return;
        const h = history.find((x) => x.id === val);
        if (h) {
            setCertDecision(h.decision || '');
            setCertQuantity(String(h.processed_quantity ?? ''));
            setCertNotes(h.notes || '');
        }
    };

    const handleCreateDecisionCertificate = () => {
        if (!record?.id) return;
        if (!certDecision) {
            toast({
                variant: 'destructive',
                title: 'Karar seçin',
                description: 'Tutanak metni için karantina karar türünü seçmelisiniz.',
            });
            return;
        }
        openPrintableReport(
            {
                ...record,
                quarantine_certificate_decision: certDecision,
                quarantine_certificate_quantity: certQuantity,
                quarantine_certificate_notes: certNotes,
            },
            'quarantine_decision_certificate',
            true
        );
        toast({
            title: 'Rapor hazır',
            description: 'PDF yeni sekmede açıldı; indirip imzaladıktan sonra aşağıdan yükleyebilirsiniz.',
        });
    };

    const reloadRecord = async () => {
        const { data, error } = await supabase.from('quarantine_records').select('*').eq('id', record.id).single();
        if (!error && data) {
            onRecordUpdated?.(data);
        }
        await refreshData?.();
    };

    const handleUploadSignedCertificate = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !record?.id) return;
        const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
        if (!isPdf) {
            toast({ variant: 'destructive', title: 'Geçersiz dosya', description: 'Yalnızca PDF yükleyin.' });
            return;
        }
        if (!certDecision) {
            toast({
                variant: 'destructive',
                title: 'Karar seçin',
                description: 'Yüklemeden önce karar türünü seçin veya geçmişten bir işlem satırı seçerek doldurun.',
            });
            return;
        }

        setCertUploading(true);
        try {
            const safeName = sanitizeFileName(file.name || 'karar-tutanagi.pdf');
            const filePath = `${RECORD_ATTACHMENTS_PREFIX}/${record.id}/karar-${uuidv4()}-${safeName}`;
            const { error: upErr } = await supabase.storage.from(QUARANTINE_FILES_BUCKET).upload(filePath, file, {
                contentType: file.type || 'application/pdf',
                upsert: false,
            });
            if (upErr) throw new Error(upErr.message);

            const { data: pub } = supabase.storage.from(QUARANTINE_FILES_BUCKET).getPublicUrl(filePath);
            const publicUrl = pub?.publicUrl || '';
            if (!publicUrl) throw new Error('Dosya adresi alınamadı.');

            if (certHistoryId) {
                const { error: hErr } = await supabase
                    .from('quarantine_history')
                    .update({ deviation_approval_url: publicUrl })
                    .eq('id', certHistoryId);
                if (hErr) throw new Error(hErr.message);
                await fetchHistory();
            } else {
                const prev = normalizeQuarantineAttachments(record.attachments);
                const newAtt = {
                    name: file.name || 'karar-tutanagi.pdf',
                    path: filePath,
                    mime_type: file.type || 'application/pdf',
                    public_url: publicUrl,
                    kind: 'karar_tutanagi',
                    decision: certDecision || null,
                };
                const { error: attErr } = await supabase
                    .from('quarantine_records')
                    .update({ attachments: [...prev, newAtt] })
                    .eq('id', record.id);
                if (attErr) throw new Error(attErr.message);
            }

            await reloadRecord();
            toast({ title: 'Yüklendi', description: 'İmzalı karar tutanağı kaydedildi.' });
            if (certFileRef.current) certFileRef.current.value = '';
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Yükleme başarısız',
                description: err?.message || 'Dosya kaydedilemedi.',
            });
        } finally {
            setCertUploading(false);
        }
    };

    const handleDownloadPDF = (e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        const resolvedAttachments = attachmentList.map((att) => {
            const url = resolvedUrls[att.path] || att.public_url;
            if (!url && att.path) {
                const pub = supabase.storage.from(QUARANTINE_FILES_BUCKET).getPublicUrl(att.path);
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
                <DialogHeader className="sr-only">
                    <DialogTitle>Karantina Kaydı Detayı</DialogTitle>
                </DialogHeader>
                <header className="bg-gradient-to-r from-primary to-blue-700 px-6 py-5 flex items-center justify-between text-white shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/20 p-2.5 rounded-lg">
                            <FileText className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight">Karantina Kaydı Detayı</h1>
                            <p className="text-[11px] text-blue-100 uppercase tracking-[0.15em] font-medium">
                                {record.part_name} ({record.part_code})
                            </p>
                        </div>
                        <span className="ml-2 px-3 py-1 bg-white/20 border border-white/30 text-white/90 text-[10px] font-bold rounded-full uppercase tracking-wider">
                            {record.status}
                        </span>
                    </div>
                </header>
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-4 pb-6">
                    <Tabs defaultValue="details" className="h-full flex flex-col">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="details">
                                <Paperclip className="w-4 h-4 mr-2" />
                                Detaylar
                            </TabsTrigger>
                            <TabsTrigger value="history">
                                <History className="w-4 h-4 mr-2" />
                                İşlem Geçmişi
                            </TabsTrigger>
                            <TabsTrigger value="certificate">
                                <ClipboardSignature className="w-4 h-4 mr-2" />
                                Karar tutanağı
                            </TabsTrigger>
                        </TabsList>
                        <TabsContent value="details" className="mt-4 flex-grow overflow-hidden">
                            <ScrollArea className="h-full pr-4">
                                <div className="space-y-1">
                                    <DetailItem label="Parça Adı" value={record.part_name} />
                                    <DetailItem label="Parça Kodu" value={record.part_code} />
                                    <DetailItem label="Lot / Seri No" value={record.lot_no} />
                                    <DetailItem label="Başlangıç Miktarı" value={`${initialQuantity} ${record.unit}`} />
                                    <DetailItem label="Mevcut Miktar" value={`${record.quantity} ${record.unit}`} />
                                    <DetailItem
                                        label="İşlenen Toplam Miktar"
                                        value={`${initialQuantity - (record.quantity || 0)} ${record.unit}`}
                                    />
                                    <DetailItem
                                        label="Karantina Tarihi"
                                        value={new Date(record.quarantine_date).toLocaleDateString('tr-TR')}
                                    />
                                    <DetailItem label="Durum" value={record.status} />
                                    <DetailItem label="Sebep Olan Birim" value={record.source_department} />
                                    <DetailItem label="Sebep Olan Tedarikçi" value={record.supplier_name} />
                                    <DetailItem label="Talebi Yapan Birim" value={record.requesting_department} />
                                    <DetailItem label="Talebi Yapan Kişi" value={record.requesting_person_name} />
                                    <DetailItem
                                        label="Neden Karantinaya Alındı"
                                        value={record.description || 'Belirtilmemiş'}
                                    />
                                    {record.decision && (
                                        <DetailItem
                                            label="Son Karar"
                                            value={`${record.decision}${
                                                record.decision_date
                                                    ? ` (${new Date(record.decision_date).toLocaleDateString('tr-TR')})`
                                                    : ''
                                            }`}
                                        />
                                    )}
                                    {attachmentList.length > 0 && (
                                        <div className="pt-4 mt-3 border-t border-border/60">
                                            <div className="flex items-center gap-2 mb-3">
                                                <ImageIcon className="w-4 h-4 text-primary" />
                                                <Label className="font-semibold text-foreground text-sm">
                                                    Ürün Görselleri ve Ekler
                                                </Label>
                                            </div>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                                {attachmentList.map((att, idx) => {
                                                    const url = resolvedUrls[att.path] || att.public_url || null;
                                                    const isImg =
                                                        (att.mime_type && att.mime_type.startsWith('image/')) ||
                                                        /\.(jpe?g|png|gif|webp|bmp)$/i.test(att.name || '');
                                                    return (
                                                        <div
                                                            key={att.path || idx}
                                                            className="group rounded-xl border border-border/80 bg-card shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                                                        >
                                                            {att.kind === 'karar_tutanagi' && (
                                                                <div className="px-2 py-1 border-b border-border/60 bg-muted/50">
                                                                    <Badge variant="secondary" className="text-[10px]">
                                                                        Karar tutanağı
                                                                        {att.decision ? ` · ${att.decision}` : ''}
                                                                    </Badge>
                                                                </div>
                                                            )}
                                                            {isImg && url ? (
                                                                <a
                                                                    href={url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="block"
                                                                >
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
                                                                        <p className="text-[11px] truncate text-muted-foreground font-medium">
                                                                            {att.name}
                                                                        </p>
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
                                                                    <span className="truncate font-medium">
                                                                        {att.name || 'PDF / dosya'}
                                                                    </span>
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
                                    {linkedDeviations.length > 0 && (
                                        <div className="pt-4 mt-3 border-t border-border/60">
                                            <div className="flex items-center gap-2 mb-3">
                                                <GitBranch className="w-4 h-4 text-violet-600" />
                                                <Label className="font-semibold text-foreground text-sm">
                                                    Sapma kanıt dokümanları
                                                </Label>
                                            </div>
                                            <p className="text-xs text-muted-foreground mb-3">
                                                Karantina kararı için oluşturulan sapma kayıtlarına eklediğiniz dosyalar burada
                                                görüntülenir.
                                            </p>
                                            <div className="space-y-4">
                                                {linkedDeviations.map((dev) => (
                                                    <div key={dev.id} className="rounded-lg border border-border/80 bg-muted/20 p-3">
                                                        <p className="text-xs font-semibold text-foreground mb-2">
                                                            Sapma talebi:{' '}
                                                            <span className="font-mono text-primary">{dev.request_no || dev.id}</span>
                                                        </p>
                                                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                                            {(dev.deviation_attachments || []).map((att, aidx) => {
                                                                const url = deviationAttUrls[att.id];
                                                                const displayName = getAttachmentDisplayName(
                                                                    att.file_name,
                                                                    att.file_path
                                                                );
                                                                const isImg =
                                                                    (att.file_type &&
                                                                        String(att.file_type).startsWith('image/')) ||
                                                                    /\.(jpe?g|png|gif|webp|bmp)$/i.test(displayName || '');
                                                                return (
                                                                    <div
                                                                        key={att.id || aidx}
                                                                        className="group rounded-xl border border-border/80 bg-card shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                                                                    >
                                                                        <div className="px-2 py-1 border-b border-border/60 bg-violet-50/80 dark:bg-violet-950/30">
                                                                            <Badge variant="secondary" className="text-[10px]">
                                                                                Sapma eki
                                                                            </Badge>
                                                                        </div>
                                                                        {isImg && url ? (
                                                                            <a
                                                                                href={url}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                className="block"
                                                                            >
                                                                                <div className="relative aspect-[4/3] bg-muted">
                                                                                    <img
                                                                                        src={url}
                                                                                        alt={displayName}
                                                                                        className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                                                                                        loading="lazy"
                                                                                    />
                                                                                </div>
                                                                                <div className="px-2.5 py-2 border-t border-border/40">
                                                                                    <p className="text-[11px] truncate text-muted-foreground font-medium">
                                                                                        {displayName}
                                                                                    </p>
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
                                                                                <span className="truncate font-medium">
                                                                                    {displayName || 'Dosya'}
                                                                                </span>
                                                                            </a>
                                                                        ) : (
                                                                            <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
                                                                                <FileText className="w-4 h-4 shrink-0" />
                                                                                <span className="truncate">{displayName}</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                ))}
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
                                        <div className="relative">
                                            {history.map((h, index) => {
                                                const isLast = index === history.length - 1;
                                                const decisionColors = {
                                                    'Serbest Bırak': 'bg-green-100 border-green-300 text-green-800',
                                                    'Sapma Onayı': 'bg-blue-100 border-blue-300 text-blue-800',
                                                    'Yeniden İşlem': 'bg-yellow-100 border-yellow-300 text-yellow-800',
                                                    Hurda: 'bg-red-100 border-red-300 text-red-800',
                                                    İade: 'bg-orange-100 border-orange-300 text-orange-800',
                                                    'Onay Bekliyor': 'bg-gray-100 border-gray-300 text-gray-800',
                                                };
                                                const colorClass =
                                                    decisionColors[h.decision] || 'bg-gray-100 border-gray-300 text-gray-800';

                                                return (
                                                    <div key={h.id} className="relative pb-8">
                                                        {!isLast && (
                                                            <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-border" />
                                                        )}
                                                        <div className="flex gap-4">
                                                            <div className="flex-shrink-0">
                                                                <div
                                                                    className={`w-8 h-8 rounded-full border-2 ${colorClass.replace('bg-', 'bg-').replace('border-', 'border-')} flex items-center justify-center font-bold text-sm`}
                                                                >
                                                                    {index + 1}
                                                                </div>
                                                            </div>
                                                            <div className={`flex-1 p-4 rounded-lg border-2 ${colorClass}`}>
                                                                <div className="flex justify-between items-start mb-2">
                                                                    <div>
                                                                        <h4 className="font-bold text-lg">{h.decision}</h4>
                                                                        <p className="text-sm opacity-80">
                                                                            {new Date(h.decision_date).toLocaleString(
                                                                                'tr-TR',
                                                                                {
                                                                                    day: '2-digit',
                                                                                    month: 'long',
                                                                                    year: 'numeric',
                                                                                    hour: '2-digit',
                                                                                    minute: '2-digit',
                                                                                }
                                                                            )}
                                                                        </p>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <p className="font-bold text-xl">
                                                                            {h.processed_quantity} {record.unit}
                                                                        </p>
                                                                        <p className="text-xs opacity-70">İşlenen Miktar</p>
                                                                    </div>
                                                                </div>
                                                                {h.notes && (
                                                                    <div className="mt-3 pt-3 border-t border-current/20">
                                                                        <p className="text-sm font-semibold mb-1">Notlar:</p>
                                                                        <p className="text-sm whitespace-pre-wrap">{h.notes}</p>
                                                                    </div>
                                                                )}
                                                                {h.deviation_id && (
                                                                    <div className="mt-2 space-y-2">
                                                                        <p className="text-xs text-muted-foreground">
                                                                            Bu işlem sapma modülünde oluşturulan kayıt ve eklenen
                                                                            kanıtlarla tamamlandı.
                                                                        </p>
                                                                        {deviationAttachmentsFor(h.deviation_id).length > 0 && (
                                                                            <div className="flex flex-wrap gap-2">
                                                                                {deviationAttachmentsFor(h.deviation_id).map(
                                                                                    (att) => {
                                                                                        const url = deviationAttUrls[att.id];
                                                                                        const displayName = getAttachmentDisplayName(
                                                                                            att.file_name,
                                                                                            att.file_path
                                                                                        );
                                                                                        return url ? (
                                                                                            <a
                                                                                                key={att.id}
                                                                                                href={url}
                                                                                                target="_blank"
                                                                                                rel="noopener noreferrer"
                                                                                                className="inline-flex max-w-full items-center gap-1 rounded-md border border-border/80 bg-background px-2 py-1 text-xs font-medium text-primary hover:bg-muted/50"
                                                                                            >
                                                                                                <FileText className="h-3.5 w-3.5 shrink-0" />
                                                                                                <span className="truncate">
                                                                                                    {displayName}
                                                                                                </span>
                                                                                                <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                                                                                            </a>
                                                                                        ) : (
                                                                                            <span
                                                                                                key={att.id}
                                                                                                className="inline-flex max-w-full items-center gap-1 rounded-md border border-dashed px-2 py-1 text-xs text-muted-foreground"
                                                                                            >
                                                                                                <FileText className="h-3.5 w-3.5 shrink-0" />
                                                                                                <span className="truncate">
                                                                                                    {displayName}
                                                                                                </span>
                                                                                            </span>
                                                                                        );
                                                                                    }
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                                {h.decision === 'Hurda' && h.quality_cost_id && (
                                                                    <p className="mt-2 text-xs text-muted-foreground">
                                                                        Bu işlem Kalite Maliyeti (hurda tutanağı) ile tamamlandı.
                                                                    </p>
                                                                )}
                                                                {h.decision === 'Hurda' && !h.quality_cost_id && (
                                                                    <p className="mt-2 text-xs text-muted-foreground">
                                                                        Bu işlem karantina hurda tutanağı ile tamamlandı.
                                                                    </p>
                                                                )}
                                                                {h.deviation_approval_url && (
                                                                    <div className="mt-2">
                                                                        <a
                                                                            href={h.deviation_approval_url}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="text-sm underline hover:opacity-80"
                                                                        >
                                                                            {h.decision === 'Hurda'
                                                                                ? 'İmzalı hurda tutanağı (PDF) →'
                                                                                : 'İmzalı sapma / karar onayı (PDF) →'}
                                                                        </a>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="mt-6 p-4 bg-muted rounded-lg">
                                            <h4 className="font-semibold mb-2">Özet</h4>
                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                                <div>
                                                    <span className="text-muted-foreground">Toplam İşlem Sayısı:</span>
                                                    <span className="font-semibold ml-2">{history.length}</span>
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground">Toplam İşlenen Miktar:</span>
                                                    <span className="font-semibold ml-2">
                                                        {history.reduce((sum, h) => sum + (h.processed_quantity || 0), 0)}{' '}
                                                        {record.unit}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <p className="text-muted-foreground mb-2">
                                            Bu kayıt için işlem geçmişi bulunamadı.
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            Henüz bu karantina kaydı için karar verilmemiş.
                                        </p>
                                    </div>
                                )}
                            </ScrollArea>
                        </TabsContent>
                        <TabsContent value="certificate" className="mt-4 space-y-6">
                            <p className="text-sm text-muted-foreground">
                                Seçtiğiniz karara göre tutanak metni ve sapma onayındaki ile aynı imza düzeniyle PDF oluşturulur.
                                İmzaladıktan sonra aynı ekrandan PDF yükleyebilirsiniz; geçmişteki bir işleme bağlıyorsanız ilgili satırı
                                seçin — yoksa taslak olarak kayda eklenir.
                            </p>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>İşlem satırı (isteğe bağlı)</Label>
                                    <Select
                                        value={certHistoryId || 'draft'}
                                        onValueChange={(v) => (v === 'draft' ? handleCertHistoryChange('') : handleCertHistoryChange(v))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Taslak veya geçmiş işlem" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="draft">Taslak (karar öncesi / kayıt genel)</SelectItem>
                                            {history.map((h) => (
                                                <SelectItem key={h.id} value={h.id}>
                                                    {h.decision} ·{' '}
                                                    {new Date(h.decision_date).toLocaleDateString('tr-TR')} · {h.processed_quantity}{' '}
                                                    {record.unit}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Karar türü *</Label>
                                    <Select
                                        value={certDecision || undefined}
                                        onValueChange={(v) => setCertDecision(v)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Karar seçin" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {QUARANTINE_DECISION_TYPES.map((d) => (
                                                <SelectItem key={d} value={d}>
                                                    {d}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="cert-qty">Miktar (tutanakta gösterilir)</Label>
                                    <Input
                                        id="cert-qty"
                                        value={certQuantity}
                                        onChange={(e) => setCertQuantity(e.target.value)}
                                        placeholder="Örn. işlem miktarı"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="cert-notes">Notlar (tutanakta gösterilir)</Label>
                                <Textarea
                                    id="cert-notes"
                                    value={certNotes}
                                    onChange={(e) => setCertNotes(e.target.value)}
                                    rows={3}
                                    placeholder="İsteğe bağlı açıklama"
                                />
                            </div>
                            <Separator />
                            <div className="flex flex-wrap gap-3 items-center">
                                <Button type="button" onClick={handleCreateDecisionCertificate} disabled={!certDecision}>
                                    <FileText className="w-4 h-4 mr-2" />
                                    Karar tutanağı oluştur (PDF)
                                </Button>
                            </div>
                            <div className="rounded-lg border border-dashed border-border p-4 space-y-3 bg-muted/20">
                                <div className="flex items-center gap-2">
                                    <Upload className="w-4 h-4 text-muted-foreground" />
                                    <Label className="font-semibold">İmzalı PDF yükle</Label>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Geçmiş satırı seçtiyseniz PDF bu işleme; taslaktaysa kayıt eklerine bağlanır.
                                </p>
                                <input
                                    ref={certFileRef}
                                    type="file"
                                    accept="application/pdf,.pdf"
                                    className="hidden"
                                    onChange={handleUploadSignedCertificate}
                                />
                                <Button
                                    type="button"
                                    variant="secondary"
                                    disabled={certUploading}
                                    onClick={() => certFileRef.current?.click()}
                                >
                                    {certUploading ? 'Yükleniyor…' : 'İmzalı PDF seç ve yükle'}
                                </Button>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
                <DialogFooter className="justify-between sm:justify-between pt-4 border-t">
                    <div>
                        <Button type="button" variant="outline" onClick={handleDownloadPDF}>
                            <FileText className="w-4 h-4 mr-2" />
                            Genel karantina PDF
                        </Button>
                    </div>
                    <div className="flex gap-2">
                        <Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>
                            Kapat
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default QuarantineViewModal;
