import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
    X, Edit, Trash2, TrendingUp, FileText, User, Calendar,
    Clock, Tag, DollarSign, CheckCircle, AlertCircle,
    Download, Eye, Plus, Upload, File, Image as ImageIcon,
    ExternalLink, Printer
} from 'lucide-react';
import BenchmarkDocumentUpload from './BenchmarkDocumentUpload';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { generateBenchmarkComparisonReportHtml } from '@/lib/benchmarkComparisonReportHtml';
import { fetchBenchmarkComparisonReportPayload } from '@/lib/benchmarkComparisonReportData';
import { approveBenchmarkWithSignedPdf } from '@/lib/benchmarkApprovalUpload';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import BenchmarkComparison from './BenchmarkComparison';

const BenchmarkDetail = ({
    isOpen,
    onClose,
    benchmark,
    onEdit,
    onDelete,
    onRefresh,
    personnel = [],
}) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState([]);
    const [documents, setDocuments] = useState([]);
    const [activityLog, setActivityLog] = useState([]);
    const [approvals, setApprovals] = useState([]);
    const [showDocumentUpload, setShowDocumentUpload] = useState(false);
    const [signedPdfUploading, setSignedPdfUploading] = useState(false);
    const [reportLoading, setReportLoading] = useState(false);
    const [approveUploading, setApproveUploading] = useState(false);
    const approveDocInputRef = useRef(null);
    /** documents bucket çoğunlukla private — getPublicUrl 403 verir; imzalı URL gerekir */
    const [signedApprovalPdfUrl, setSignedApprovalPdfUrl] = useState(null);
    const [signedApprovalPdfUrlLoading, setSignedApprovalPdfUrlLoading] = useState(false);

    useEffect(() => {
        if (benchmark?.id) {
            fetchDetails();
        }
    }, [benchmark?.id]);

    useEffect(() => {
        const path = benchmark?.approval_signed_pdf_path;
        if (!path) {
            setSignedApprovalPdfUrl(null);
            setSignedApprovalPdfUrlLoading(false);
            return;
        }
        let cancelled = false;
        setSignedApprovalPdfUrl(null);
        setSignedApprovalPdfUrlLoading(true);
        supabase.storage
            .from('documents')
            .createSignedUrl(path, 3600)
            .then(({ data, error }) => {
                if (cancelled) return;
                if (error) {
                    console.error('İmzalı onay PDF URL:', error);
                    setSignedApprovalPdfUrl(null);
                } else {
                    setSignedApprovalPdfUrl(data?.signedUrl ?? null);
                }
            })
            .finally(() => {
                if (!cancelled) setSignedApprovalPdfUrlLoading(false);
            });
        return () => { cancelled = true; };
    }, [benchmark?.approval_signed_pdf_path]);

    const fetchDetails = async () => {
        if (!benchmark?.id) return;

        setLoading(true);
        try {
            // Önce kritik verileri yükle (alternatifler ve dokümanlar)
            const [itemsRes, docsRes] = await Promise.all([
                supabase
                    .from('benchmark_items')
                    .select('*')
                    .eq('benchmark_id', benchmark.id)
                    .order('rank_order'),
                supabase
                    .from('benchmark_documents')
                    .select('*')
                    .eq('benchmark_id', benchmark.id)
                    .order('created_at', { ascending: false })
            ]);

            if (itemsRes.error) throw itemsRes.error;
            if (docsRes.error) throw docsRes.error;

            setItems(itemsRes.data || []);
            setDocuments(docsRes.data || []);

            // Opsiyonel verileri ayrı ayrı yükle (hata olsa bile devam et)
            try {
                const activityRes = await supabase
                    .from('benchmark_activity_log')
                    .select('*')
                    .eq('benchmark_id', benchmark.id)
                    .order('performed_at', { ascending: false })
                    .limit(20);
                
                if (!activityRes.error) {
                    setActivityLog(activityRes.data || []);
                }
            } catch (err) {
                console.warn('Activity log yüklenemedi:', err);
                setActivityLog([]);
            }

            try {
                const approvalsRes = await supabase
                    .from('benchmark_approvals')
                    .select(`
                        *,
                        approver:personnel!benchmark_approvals_approver_id_fkey(id, name)
                    `)
                    .eq('benchmark_id', benchmark.id)
                    .order('approval_level');
                
                if (!approvalsRes.error) {
                    setApprovals(approvalsRes.data || []);
                }
            } catch (err) {
                console.warn('Approvals yüklenemedi (tablo mevcut olmayabilir):', err);
                setApprovals([]);
            }
        } catch (error) {
            console.error('Detaylar yüklenirken hata:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Detaylar yüklenirken bir hata oluştu: ' + (error.message || 'Bilinmeyen hata')
            });
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status) => {
        const colors = {
            'Taslak': 'bg-gray-100 text-gray-800',
            'Devam Ediyor': 'bg-blue-100 text-blue-800',
            'Analiz Aşamasında': 'bg-purple-100 text-purple-800',
            'Onay Bekliyor': 'bg-yellow-100 text-yellow-800',
            'Tamamlandı': 'bg-green-100 text-green-800',
            'İptal': 'bg-red-100 text-red-800'
        };
        return colors[status] || 'bg-gray-100 text-gray-800';
    };

    const getPriorityColor = (priority) => {
        const colors = {
            'Kritik': 'text-red-500',
            'Yüksek': 'text-orange-500',
            'Normal': 'text-blue-500',
            'Düşük': 'text-gray-500'
        };
        return colors[priority] || 'text-gray-500';
    };

    const getApprovalStatusColor = (status) => {
        const colors = {
            'Bekliyor': 'bg-yellow-100 text-yellow-800',
            'Onaylandı': 'bg-green-100 text-green-800',
            'Reddedildi': 'bg-red-100 text-red-800',
            'Revizyon İstendi': 'bg-orange-100 text-orange-800'
        };
        return colors[status] || 'bg-gray-100 text-gray-800';
    };

    const handleDownloadDocument = async (doc) => {
        try {
            const { data, error } = await supabase.storage
                .from('documents')
                .download(doc.file_path);

            if (error) throw error;

            let extension = doc.file_name?.split('.').pop() || 'pdf';
            let downloadName = doc.document_title || doc.file_name;
            if (downloadName && !downloadName.toLowerCase().endsWith(`.${extension.toLowerCase()}`)) {
                downloadName = `${downloadName}.${extension}`;
            }

            const url = URL.createObjectURL(data);
            const a = document.createElement('a');
            a.href = url;
            a.download = downloadName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            toast({
                title: 'Başarılı',
                description: 'Doküman indirildi.'
            });
        } catch (error) {
            console.error('İndirme hatası:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Doküman indirilirken bir hata oluştu.'
            });
        }
    };

    const handleDocumentUploadSuccess = () => {
        setShowDocumentUpload(false);
        fetchDetails();
        toast({
            title: 'Başarılı',
            description: 'Dokümanlar başarıyla yüklendi.'
        });
    };

    const handleSignedApprovalPdf = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !benchmark?.id) return;
        if (file.type !== 'application/pdf') {
            toast({
                variant: 'destructive',
                title: 'Geçersiz dosya',
                description: 'Yalnızca PDF yükleyebilirsiniz.'
            });
            e.target.value = '';
            return;
        }
        setSignedPdfUploading(true);
        try {
            const safeName = `${Date.now()}-${file.name.replace(/[^\w.\-]/g, '_')}`;
            const filePath = `${benchmark.id}/${safeName}`;
            const storagePath = `benchmark-documents/${filePath}`;

            const { error: uploadError } = await supabase.storage
                .from('documents')
                .upload(storagePath, file, { contentType: 'application/pdf', upsert: true });

            if (uploadError) throw uploadError;

            const { error: updateError } = await supabase
                .from('benchmarks')
                .update({
                    approval_signed_pdf_path: storagePath,
                    approval_signed_pdf_name: file.name,
                })
                .eq('id', benchmark.id);

            if (updateError) throw updateError;

            toast({ title: 'Yüklendi', description: 'İmzalı onay PDF’i kaydedildi.' });
            onRefresh?.();
            fetchDetails();
        } catch (err) {
            console.error(err);
            toast({
                variant: 'destructive',
                title: 'Yükleme hatası',
                description: err.message || 'Dosya yüklenemedi.'
            });
        } finally {
            setSignedPdfUploading(false);
            e.target.value = '';
        }
    };

    const handleRemoveSignedApprovalPdf = async () => {
        if (!benchmark?.id || !benchmark.approval_signed_pdf_path) return;
        if (!confirm('İmzalı onay PDF’ini kaldırmak istiyor musunuz?')) return;
        setSignedPdfUploading(true);
        try {
            await supabase.storage.from('documents').remove([benchmark.approval_signed_pdf_path]);
            const { error } = await supabase
                .from('benchmarks')
                .update({ approval_signed_pdf_path: null, approval_signed_pdf_name: null })
                .eq('id', benchmark.id);
            if (error) throw error;
            toast({ title: 'Kaldırıldı' });
            onRefresh?.();
            fetchDetails();
        } catch (err) {
            console.error(err);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: err.message || 'Kaldırılamadı.'
            });
        } finally {
            setSignedPdfUploading(false);
        }
    };

    const handleGenerateReport = async () => {
        if (!benchmark?.id) return;

        setReportLoading(true);
        try {
            const payload = await fetchBenchmarkComparisonReportPayload(supabase, benchmark.id);
            const htmlContent = await generateBenchmarkComparisonReportHtml({
                benchmark,
                ...payload,
            });
            const blob = new Blob([htmlContent], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const printWindow = window.open(url, '_blank');

            if (!printWindow) {
                toast({
                    variant: 'destructive',
                    title: 'Hata',
                    description: 'Rapor penceresi açılamadı. Pop-up engelleyiciyi kontrol edin.',
                });
                URL.revokeObjectURL(url);
                return;
            }

            printWindow.addEventListener('afterprint', () => URL.revokeObjectURL(url));
        } catch (error) {
            console.error(error);
            toast({
                variant: 'destructive',
                title: 'Rapor oluşturulamadı',
                description: error.message || 'Bilinmeyen hata',
            });
        } finally {
            setReportLoading(false);
        }
    };

    const handleApproveWithDocument = async (e) => {
        const file = e.target.files?.[0];
        if (e.target) e.target.value = '';
        if (!file || !benchmark?.id) return;

        const approverId = personnel.find((p) => p.email === user?.email)?.id;
        if (!approverId) {
            toast({
                variant: 'destructive',
                title: 'Onay verilemedi',
                description: 'Oturum e-postanızla eşleşen personel kaydı bulunamadı.',
            });
            return;
        }

        setApproveUploading(true);
        try {
            await approveBenchmarkWithSignedPdf({
                benchmarkId: benchmark.id,
                file,
                approverId,
            });
            toast({
                title: 'Onaylandı',
                description: 'Onay dokümanı kaydedildi ve kayıt onaylandı.',
            });
            onRefresh?.();
            fetchDetails();
        } catch (err) {
            console.error(err);
            toast({
                variant: 'destructive',
                title: 'Onay hatası',
                description: err.message || 'İşlem tamamlanamadı.',
            });
        } finally {
            setApproveUploading(false);
        }
    };

    if (!benchmark) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent
                className="!fixed !inset-0 !left-0 !top-0 z-50 !m-0 flex h-[100dvh] !max-h-[100dvh] w-full !max-w-none !translate-x-0 !translate-y-0 flex-col gap-0 overflow-hidden !rounded-none border-0 p-0 shadow-xl sm:!max-h-[100dvh]"
                hideCloseButton
            >
                <header className="bg-gradient-to-r from-primary to-blue-700 px-4 py-4 sm:px-6 sm:py-5 flex flex-wrap items-center justify-between gap-3 text-white shrink-0">
                    <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
                        <div className="bg-white/20 p-2.5 rounded-lg shrink-0"><TrendingUp className="h-5 w-5 text-white" /></div>
                        <div className="min-w-0">
                            <h1 className="text-base sm:text-lg font-bold tracking-tight truncate">{benchmark.title}</h1>
                            <p className="text-[10px] sm:text-[11px] text-blue-100 font-medium leading-snug">
                                <span className="uppercase tracking-wide">Form No:</span>{' '}
                                <span className="font-mono">{benchmark.benchmark_number}</span>
                                <span className="text-blue-200/90"> · Öncelik: {benchmark.priority}</span>
                            </p>
                        </div>
                        <span className="shrink-0 px-3 py-1 bg-white/20 border border-white/30 text-white/90 text-[10px] font-bold rounded-full uppercase tracking-wider">{benchmark.status}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 flex-wrap justify-end">
                        <input
                            ref={approveDocInputRef}
                            type="file"
                            className="hidden"
                            accept="application/pdf,.pdf"
                            onChange={handleApproveWithDocument}
                        />
                        <Button size="sm" variant="outline" className="bg-white/10 border-white/30 text-white hover:bg-white/20" onClick={handleGenerateReport} disabled={reportLoading}>
                            <Printer className="h-4 w-4 mr-2" /> {reportLoading ? 'Rapor…' : 'Rapor'}
                        </Button>
                        {benchmark.approval_status !== 'Onaylandı' && (
                            <Button
                                size="sm"
                                variant="secondary"
                                className="bg-emerald-600/90 border border-emerald-400/50 text-white hover:bg-emerald-600"
                                disabled={approveUploading}
                                onClick={() => approveDocInputRef.current?.click()}
                            >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                {approveUploading ? 'Yükleniyor…' : 'Onayla'}
                            </Button>
                        )}
                        <Button
                            size="sm"
                            variant="outline"
                            className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                            onClick={() => onEdit(benchmark, { fromDetail: true })}
                        >
                            <Edit className="h-4 w-4 mr-2" /> Düzenle
                        </Button>
                        <Button size="icon" variant="ghost" className="bg-white/20 hover:bg-white/30 text-white rounded-xl shrink-0" onClick={onClose}>
                            <X className="h-4 w-4" />
                            <span className="sr-only">Kapat</span>
                        </Button>
                    </div>
                </header>
                <div className="flex flex-1 min-h-0 flex-col overflow-hidden px-4 py-3 sm:px-6 sm:py-4">
                    <Tabs defaultValue="comparison" className="flex min-h-0 min-w-0 w-full flex-1 flex-col">
                        <TabsList className="!inline-flex !h-auto w-full min-w-0 flex-wrap items-stretch justify-start gap-1.5 rounded-lg border bg-muted/40 p-1.5 sm:p-2 overflow-x-visible overflow-y-visible">
                            <TabsTrigger
                                value="comparison"
                                className="shrink-0 flex-none rounded-md px-3 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
                            >
                                Karşılaştırma
                            </TabsTrigger>
                            <TabsTrigger
                                value="overview"
                                className="shrink-0 flex-none rounded-md px-3 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
                            >
                                Genel bakış
                            </TabsTrigger>
                            <TabsTrigger
                                value="items"
                                className="shrink-0 flex-none rounded-md px-3 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
                            >
                                Alternatifler ({items.length})
                            </TabsTrigger>
                            <TabsTrigger
                                value="documents"
                                className="shrink-0 flex-none rounded-md px-3 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
                            >
                                Dokümanlar ({documents.length})
                            </TabsTrigger>
                            <TabsTrigger
                                value="approvals"
                                className="shrink-0 flex-none rounded-md px-3 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
                            >
                                Onaylar ({approvals.length})
                            </TabsTrigger>
                            <TabsTrigger
                                value="activity"
                                className="shrink-0 flex-none rounded-md px-3 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
                            >
                                Geçmiş ({activityLog.length})
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="comparison" className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden">
                            <BenchmarkComparison
                                embedded
                                benchmark={benchmark}
                                isOpen
                                onClose={() => {}}
                                onRefresh={() => {
                                    onRefresh?.();
                                    fetchDetails();
                                }}
                            />
                        </TabsContent>

                        {/* Genel Bakış */}
                        <TabsContent value="overview" className="mt-4 flex-1 min-h-0 space-y-4 overflow-y-auto overflow-x-hidden data-[state=inactive]:hidden">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Temel Bilgiler</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground mb-1">
                                                Kategori
                                            </p>
                                            <Badge variant="secondary">
                                                {benchmark.category?.name || 'Belirtilmemiş'}
                                            </Badge>
                                        </div>

                                        {benchmark.owner && (
                                            <div>
                                                <p className="text-sm font-medium text-muted-foreground mb-1">
                                                    Sorumlu
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <User className="h-4 w-4 text-muted-foreground" />
                                                    <span>{benchmark.owner.full_name}</span>
                                                </div>
                                            </div>
                                        )}

                                        {benchmark.department && (
                                            <div>
                                                <p className="text-sm font-medium text-muted-foreground mb-1">
                                                    Departman
                                                </p>
                                                <span>{benchmark.department.unit_name}</span>
                                            </div>
                                        )}

                                        {benchmark.start_date && (
                                            <div>
                                                <p className="text-sm font-medium text-muted-foreground mb-1">
                                                    Başlangıç Tarihi
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                                    <span>
                                                        {format(new Date(benchmark.start_date), 'dd MMMM yyyy', { locale: tr })}
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        {benchmark.target_completion_date && (
                                            <div>
                                                <p className="text-sm font-medium text-muted-foreground mb-1">
                                                    Hedef Tamamlanma
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                                    <span>
                                                        {format(new Date(benchmark.target_completion_date), 'dd MMMM yyyy', { locale: tr })}
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        {benchmark.estimated_budget && (
                                            <div>
                                                <p className="text-sm font-medium text-muted-foreground mb-1">
                                                    Tahmini Bütçe
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                                                    <span>
                                                        {new Intl.NumberFormat('tr-TR', {
                                                            style: 'currency',
                                                            currency: benchmark.currency || 'TRY'
                                                        }).format(benchmark.estimated_budget)}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {benchmark.description && (
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground mb-1">
                                                Açıklama
                                            </p>
                                            <p className="text-sm whitespace-pre-wrap">
                                                {benchmark.description}
                                            </p>
                                        </div>
                                    )}

                                    {benchmark.objective && (
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground mb-1">
                                                Amaç
                                            </p>
                                            <p className="text-sm whitespace-pre-wrap">
                                                {benchmark.objective}
                                            </p>
                                        </div>
                                    )}

                                    {benchmark.scope && (
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground mb-1">
                                                Kapsam
                                            </p>
                                            <p className="text-sm whitespace-pre-wrap">
                                                {benchmark.scope}
                                            </p>
                                        </div>
                                    )}

                                    {benchmark.tags && benchmark.tags.length > 0 && (
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground mb-2">
                                                Etiketler
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                {benchmark.tags.map((tag, idx) => (
                                                    <Badge key={idx} variant="outline">
                                                        <Tag className="h-3 w-3 mr-1" />
                                                        {tag}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {benchmark.notes && (
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground mb-1">
                                                Notlar
                                            </p>
                                            <p className="text-sm whitespace-pre-wrap">
                                                {benchmark.notes}
                                            </p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Onay Durumu */}
                            {benchmark.approval_status && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Onay Durumu</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <Badge className={getApprovalStatusColor(benchmark.approval_status)}>
                                            {benchmark.approval_status}
                                        </Badge>
                                        {benchmark.approved_by_person && benchmark.approval_date && (
                                            <div className="mt-3 text-sm">
                                                <p>
                                                    <span className="font-medium">Onaylayan:</span>{' '}
                                                    {benchmark.approved_by_person.full_name}
                                                </p>
                                                <p>
                                                    <span className="font-medium">Onay Tarihi:</span>{' '}
                                                    {format(new Date(benchmark.approval_date), 'dd MMMM yyyy HH:mm', { locale: tr })}
                                                </p>
                                            </div>
                                        )}
                                        {benchmark.approval_notes && (
                                            <div className="mt-3">
                                                <p className="text-sm font-medium text-muted-foreground mb-1">
                                                    Onay Notları
                                                </p>
                                                <p className="text-sm">{benchmark.approval_notes}</p>
                                            </div>
                                        )}

                                        {(benchmark.approval_status === 'Onaylandı' || benchmark.approval_signed_pdf_path) && (
                                            <div className="mt-4 rounded-lg border bg-muted/30 p-4 space-y-3">
                                                <p className="text-sm font-medium">İmzalı onay PDF&apos;i</p>
                                                {benchmark.approval_signed_pdf_path && (
                                                    <div className="space-y-2">
                                                        {signedApprovalPdfUrlLoading && (
                                                            <p className="text-xs text-muted-foreground">İndirme bağlantısı hazırlanıyor…</p>
                                                        )}
                                                        {!signedApprovalPdfUrlLoading && signedApprovalPdfUrl && (
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <Button variant="outline" size="sm" asChild>
                                                                    <a
                                                                        href={signedApprovalPdfUrl}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                    >
                                                                        <FileText className="mr-2 h-4 w-4" />
                                                                        {benchmark.approval_signed_pdf_name || 'PDF aç'}
                                                                    </a>
                                                                </Button>
                                                                {benchmark.approval_status === 'Onaylandı' && (
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        disabled={signedPdfUploading}
                                                                        onClick={handleRemoveSignedApprovalPdf}
                                                                    >
                                                                        Kaldır
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        )}
                                                        {!signedApprovalPdfUrlLoading && !signedApprovalPdfUrl && (
                                                            <p className="text-xs text-destructive">
                                                                PDF bağlantısı oluşturulamadı (depolama veya yetki).
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                                {benchmark.approval_status === 'Onaylandı' && (
                                                    <>
                                                        <p className="text-xs text-muted-foreground">
                                                            Onay için imzalanmış rapor PDF&apos;ini buraya yükleyin (max. 10 MB).
                                                        </p>
                                                        <div className="flex items-center gap-2">
                                                            <Input
                                                                type="file"
                                                                accept="application/pdf,.pdf"
                                                                disabled={signedPdfUploading}
                                                                onChange={handleSignedApprovalPdf}
                                                                className="max-w-md cursor-pointer"
                                                            />
                                                            {signedPdfUploading && (
                                                                <span className="text-xs text-muted-foreground">Yükleniyor…</span>
                                                            )}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            )}
                        </TabsContent>

                        {/* Alternatifler */}
                        <TabsContent value="items" className="mt-4 flex-1 min-h-0 overflow-y-auto overflow-x-hidden data-[state=inactive]:hidden">
                            <div className="space-y-4">
                                {items.length === 0 ? (
                                    <Card>
                                        <CardContent className="flex flex-col items-center justify-center py-8">
                                            <TrendingUp className="h-12 w-12 text-muted-foreground mb-3" />
                                            <p className="text-muted-foreground">
                                                Henüz alternatif eklenmemiş.
                                            </p>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    items.map((item, idx) => (
                                        <Card key={item.id}>
                                            <CardHeader>
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <CardTitle className="flex items-center gap-2">
                                                            {item.rank_order > 0 && (
                                                                <Badge variant="outline">
                                                                    #{item.rank_order}
                                                                </Badge>
                                                            )}
                                                            {item.item_name}
                                                        </CardTitle>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        {item.is_recommended && (
                                                            <Badge className="bg-green-100 text-green-800">
                                                                <CheckCircle className="h-3 w-3 mr-1" />
                                                                Önerilen
                                                            </Badge>
                                                        )}
                                                        {item.is_current_solution && (
                                                            <Badge className="bg-blue-100 text-blue-800">
                                                                Mevcut
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            </CardHeader>
                                            <CardContent>
                                                {item.description && (
                                                    <p className="text-sm mb-3">{item.description}</p>
                                                )}
                                                
                                                {/* Temel Bilgiler */}
                                                {(item.model_number || item.category || item.origin) && (
                                                    <div className="mb-3 pb-3 border-b">
                                                        <h4 className="text-sm font-semibold mb-2">Temel Bilgiler</h4>
                                                        <div className="grid gap-2 md:grid-cols-2 text-sm">
                                                            {item.model_number && (
                                                                <div>
                                                                    <p className="text-muted-foreground">Model/Seri No</p>
                                                                    <p className="font-medium">{item.model_number}</p>
                                                                </div>
                                                            )}
                                                            {item.category && (
                                                                <div>
                                                                    <p className="text-muted-foreground">Kategori</p>
                                                                    <p className="font-medium">{item.category}</p>
                                                                </div>
                                                            )}
                                                            {item.origin && (
                                                                <div>
                                                                    <p className="text-muted-foreground">Menşei</p>
                                                                    <p className="font-medium">{item.origin}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Maliyet Bilgileri */}
                                                {(item.unit_price || item.total_cost_of_ownership || item.roi_percentage || item.minimum_order_quantity || item.payment_terms) && (
                                                    <div className="mb-3 pb-3 border-b">
                                                        <h4 className="text-sm font-semibold mb-2">Maliyet Bilgileri</h4>
                                                        <div className="grid gap-2 md:grid-cols-3 text-sm">
                                                            {item.unit_price && (
                                                                <div>
                                                                    <p className="text-muted-foreground">Birim Fiyat</p>
                                                                    <p className="font-medium">
                                                                        {new Intl.NumberFormat('tr-TR', {
                                                                            style: 'currency',
                                                                            currency: item.currency || 'TRY'
                                                                        }).format(item.unit_price)}
                                                                    </p>
                                                                </div>
                                                            )}
                                                            {item.total_cost_of_ownership && (
                                                                <div>
                                                                    <p className="text-muted-foreground">TCO</p>
                                                                    <p className="font-medium">
                                                                        {new Intl.NumberFormat('tr-TR', {
                                                                            style: 'currency',
                                                                            currency: item.currency || 'TRY'
                                                                        }).format(item.total_cost_of_ownership)}
                                                                    </p>
                                                                </div>
                                                            )}
                                                            {item.roi_percentage && (
                                                                <div>
                                                                    <p className="text-muted-foreground">ROI</p>
                                                                    <p className="font-medium">{item.roi_percentage}%</p>
                                                                </div>
                                                            )}
                                                            {item.minimum_order_quantity && (
                                                                <div>
                                                                    <p className="text-muted-foreground">Minimum Sipariş</p>
                                                                    <p className="font-medium">{item.minimum_order_quantity} adet</p>
                                                                </div>
                                                            )}
                                                            {item.payment_terms && (
                                                                <div>
                                                                    <p className="text-muted-foreground">Ödeme Koşulları</p>
                                                                    <p className="font-medium">{item.payment_terms}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Kalite ve Performans */}
                                                {(item.quality_score || item.performance_score || item.reliability_score || item.durability_score || item.safety_score || item.standards_compliance_score) && (
                                                    <div className="mb-3 pb-3 border-b">
                                                        <h4 className="text-sm font-semibold mb-2">Kalite ve Performans</h4>
                                                        <div className="grid gap-2 md:grid-cols-3 text-sm">
                                                            {item.quality_score && (
                                                                <div>
                                                                    <p className="text-muted-foreground">Kalite Skoru</p>
                                                                    <p className="font-medium">{item.quality_score}/100</p>
                                                                </div>
                                                            )}
                                                            {item.performance_score && (
                                                                <div>
                                                                    <p className="text-muted-foreground">Performans Skoru</p>
                                                                    <p className="font-medium">{item.performance_score}/100</p>
                                                                </div>
                                                            )}
                                                            {item.reliability_score && (
                                                                <div>
                                                                    <p className="text-muted-foreground">Güvenilirlik Skoru</p>
                                                                    <p className="font-medium">{item.reliability_score}/100</p>
                                                                </div>
                                                            )}
                                                            {item.durability_score && (
                                                                <div>
                                                                    <p className="text-muted-foreground">Dayanıklılık Skoru</p>
                                                                    <p className="font-medium">{item.durability_score}/100</p>
                                                                </div>
                                                            )}
                                                            {item.safety_score && (
                                                                <div>
                                                                    <p className="text-muted-foreground">Güvenlik Skoru</p>
                                                                    <p className="font-medium">{item.safety_score}/100</p>
                                                                </div>
                                                            )}
                                                            {item.standards_compliance_score && (
                                                                <div>
                                                                    <p className="text-muted-foreground">Standart Uygunluk</p>
                                                                    <p className="font-medium">{item.standards_compliance_score}/100</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Hizmet Bilgileri */}
                                                {(item.after_sales_service_score || item.technical_support_score || item.warranty_period_months || item.support_availability) && (
                                                    <div className="mb-3 pb-3 border-b">
                                                        <h4 className="text-sm font-semibold mb-2">Satış Sonrası Hizmet</h4>
                                                        <div className="grid gap-2 md:grid-cols-3 text-sm">
                                                            {item.after_sales_service_score && (
                                                                <div>
                                                                    <p className="text-muted-foreground">Satış Sonrası Skoru</p>
                                                                    <p className="font-medium">{item.after_sales_service_score}/100</p>
                                                                </div>
                                                            )}
                                                            {item.technical_support_score && (
                                                                <div>
                                                                    <p className="text-muted-foreground">Teknik Destek Skoru</p>
                                                                    <p className="font-medium">{item.technical_support_score}/100</p>
                                                                </div>
                                                            )}
                                                            {item.warranty_period_months && (
                                                                <div>
                                                                    <p className="text-muted-foreground">Garanti Süresi</p>
                                                                    <p className="font-medium">{item.warranty_period_months} ay</p>
                                                                </div>
                                                            )}
                                                            {item.support_availability && (
                                                                <div>
                                                                    <p className="text-muted-foreground">Destek Erişilebilirliği</p>
                                                                    <p className="font-medium">{item.support_availability}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Operasyonel Bilgiler */}
                                                {(item.delivery_time_days || item.lead_time_days || item.implementation_time_days || item.training_required_hours) && (
                                                    <div className="mb-3 pb-3 border-b">
                                                        <h4 className="text-sm font-semibold mb-2">Operasyonel Bilgiler</h4>
                                                        <div className="grid gap-2 md:grid-cols-3 text-sm">
                                                            {item.delivery_time_days && (
                                                                <div>
                                                                    <p className="text-muted-foreground">Teslimat Süresi</p>
                                                                    <p className="font-medium">{item.delivery_time_days} gün</p>
                                                                </div>
                                                            )}
                                                            {item.lead_time_days && (
                                                                <div>
                                                                    <p className="text-muted-foreground">Tedarik Süresi</p>
                                                                    <p className="font-medium">{item.lead_time_days} gün</p>
                                                                </div>
                                                            )}
                                                            {item.implementation_time_days && (
                                                                <div>
                                                                    <p className="text-muted-foreground">Uygulama Süresi</p>
                                                                    <p className="font-medium">{item.implementation_time_days} gün</p>
                                                                </div>
                                                            )}
                                                            {item.training_required_hours && (
                                                                <div>
                                                                    <p className="text-muted-foreground">Eğitim Gereksinimi</p>
                                                                    <p className="font-medium">{item.training_required_hours} saat</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Risk */}
                                                {item.risk_level && (
                                                    <div className="mb-3">
                                                        <h4 className="text-sm font-semibold mb-2">Risk Değerlendirmesi</h4>
                                                        <Badge 
                                                            variant={
                                                                item.risk_level === 'Düşük' ? 'default' :
                                                                item.risk_level === 'Orta' ? 'secondary' :
                                                                item.risk_level === 'Yüksek' ? 'destructive' : 'destructive'
                                                            }
                                                        >
                                                            {item.risk_level}
                                                        </Badge>
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    ))
                                )}
                            </div>
                        </TabsContent>

                        {/* Dokümanlar */}
                        <TabsContent value="documents" className="mt-4 flex-1 min-h-0 overflow-y-auto overflow-x-hidden data-[state=inactive]:hidden">
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-lg font-semibold">
                                        Kanıt Dokümanları ({documents.length})
                                    </h3>
                                    <Button
                                        size="sm"
                                        onClick={() => setShowDocumentUpload(!showDocumentUpload)}
                                    >
                                        <Upload className="mr-2 h-4 w-4" />
                                        Doküman Yükle
                                    </Button>
                                </div>

                                {showDocumentUpload && (
                                    <Card className="border-2 border-primary">
                                        <CardHeader>
                                            <CardTitle className="text-base">Yeni Doküman Yükle</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <BenchmarkDocumentUpload
                                                benchmarkId={benchmark.id}
                                                onUploadSuccess={handleDocumentUploadSuccess}
                                            />
                                        </CardContent>
                                    </Card>
                                )}

                                {documents.length === 0 ? (
                                    <Card>
                                        <CardContent className="flex flex-col items-center justify-center py-12">
                                            <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                                            <h3 className="text-lg font-semibold mb-2">
                                                Henüz Doküman Yok
                                            </h3>
                                            <p className="text-muted-foreground text-center mb-4">
                                                Benchmark çalışmanıza kanıt dokümanlar ekleyerek<br />
                                                karşılaştırmanızı güçlendirin.
                                            </p>
                                            <Button onClick={() => setShowDocumentUpload(true)}>
                                                <Upload className="mr-2 h-4 w-4" />
                                                İlk Dokümanı Yükle
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    <div className="grid gap-3 md:grid-cols-2">
                                        {documents.map((doc) => (
                                            <Card key={doc.id} className="hover:shadow-md transition-shadow">
                                                <CardContent className="p-4">
                                                    <div className="flex items-start gap-3">
                                                        <div className="flex-shrink-0 mt-1">
                                                            {doc.file_type?.includes('image') ? (
                                                                <ImageIcon className="h-10 w-10 text-blue-500" />
                                                            ) : doc.file_type?.includes('pdf') ? (
                                                                <FileText className="h-10 w-10 text-red-500" />
                                                            ) : (
                                                                <File className="h-10 w-10 text-gray-500" />
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <h4 className="font-semibold truncate mb-1">
                                                                {doc.document_title}
                                                            </h4>
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <Badge variant="secondary" className="text-xs">
                                                                    {doc.document_type}
                                                                </Badge>
                                                                {doc.file_size && (
                                                                    <span className="text-xs text-muted-foreground">
                                                                        {(doc.file_size / 1024 / 1024).toFixed(2)} MB
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {doc.description && (
                                                                <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                                                                    {doc.description}
                                                                </p>
                                                            )}
                                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                                <span>{doc.file_name}</span>
                                                            </div>
                                                            {doc.tags && doc.tags.length > 0 && (
                                                                <div className="flex flex-wrap gap-1 mt-2">
                                                                    {doc.tags.slice(0, 3).map((tag, idx) => (
                                                                        <Badge key={idx} variant="outline" className="text-xs">
                                                                            {tag}
                                                                        </Badge>
                                                                    ))}
                                                                    {doc.tags.length > 3 && (
                                                                        <Badge variant="outline" className="text-xs">
                                                                            +{doc.tags.length - 3}
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2 mt-3">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => handleDownloadDocument(doc)}
                                                            className="flex-1"
                                                        >
                                                            <Download className="h-4 w-4 mr-2" />
                                                            İndir
                                                        </Button>
                                                        {doc.file_type?.includes('image') && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => {
                                                                    // Görüntüleme için yeni sekme aç (önce file_url kullan, yoksa oluştur)
                                                                    const url = doc.file_url || supabase.storage
                                                                        .from('documents')
                                                                        .getPublicUrl(doc.file_path).data.publicUrl;
                                                                    window.open(url, '_blank');
                                                                }}
                                                            >
                                                                <Eye className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </TabsContent>

                        {/* Onaylar */}
                        <TabsContent value="approvals" className="mt-4 flex-1 min-h-0 overflow-y-auto overflow-x-hidden data-[state=inactive]:hidden">
                            <div className="space-y-3">
                                {approvals.length === 0 ? (
                                    <Card>
                                        <CardContent className="flex flex-col items-center justify-center py-8">
                                            <CheckCircle className="h-12 w-12 text-muted-foreground mb-3" />
                                            <p className="text-muted-foreground">
                                                Onay kaydı bulunmuyor.
                                            </p>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    approvals.map((approval) => (
                                        <Card key={approval.id}>
                                            <CardContent className="py-4">
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <p className="font-medium">
                                                            {approval.approver?.name || 'Bilinmiyor'}
                                                        </p>
                                                        <p className="text-sm text-muted-foreground">
                                                            {approval.approver_role || 'Onaylayıcı'}
                                                        </p>
                                                    </div>
                                                    <Badge className={getApprovalStatusColor(approval.status)}>
                                                        {approval.status}
                                                    </Badge>
                                                </div>
                                                {approval.comments && (
                                                    <p className="text-sm mt-3">{approval.comments}</p>
                                                )}
                                                {approval.decision_date && (
                                                    <p className="text-xs text-muted-foreground mt-2">
                                                        {format(new Date(approval.decision_date), 'dd MMMM yyyy HH:mm', { locale: tr })}
                                                    </p>
                                                )}
                                            </CardContent>
                                        </Card>
                                    ))
                                )}
                            </div>
                        </TabsContent>

                        {/* Aktivite Geçmişi */}
                        <TabsContent value="activity" className="mt-4 flex-1 min-h-0 overflow-y-auto overflow-x-hidden data-[state=inactive]:hidden">
                            <div className="space-y-3">
                                {activityLog.length === 0 ? (
                                    <Card>
                                        <CardContent className="flex flex-col items-center justify-center py-8">
                                            <Clock className="h-12 w-12 text-muted-foreground mb-3" />
                                            <p className="text-muted-foreground">
                                                Aktivite geçmişi bulunmuyor.
                                            </p>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    activityLog.map((activity) => (
                                        <Card key={activity.id}>
                                            <CardContent className="py-3">
                                                <div className="flex items-start gap-3">
                                                    <div className="flex-shrink-0 mt-1">
                                                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                                            <AlertCircle className="h-4 w-4 text-primary" />
                                                        </div>
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="text-sm font-medium">
                                                            {activity.activity_type}
                                                        </p>
                                                        <p className="text-sm text-muted-foreground">
                                                            {activity.description}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground mt-1">
                                                            {format(new Date(activity.performed_at), 'dd MMMM yyyy HH:mm', { locale: tr })}
                                                        </p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))
                                )}
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default BenchmarkDetail;

