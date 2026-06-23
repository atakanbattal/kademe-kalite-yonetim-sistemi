import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { History, User, Calendar, FileText, Eye, FileDown } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import PdfViewerModal from '@/components/document/PdfViewerModal';
import SourceDocumentViewerModal from '@/components/document/SourceDocumentViewerModal';
import { useToast } from '@/components/ui/use-toast';
import {
    getPdfAttachment,
    getSourceAttachments,
    isOfficeSourcePreviewAttachment,
    resolveEditableSourceDownloadName,
} from '@/lib/documentRevisionAttachments';
import { prepareWordSourcePreview, fetchInternalDocumentBlob } from '@/lib/internalDocumentSourcePreview';

const detailDocumentFolder = (documentType) => {
    const folderMap = {
        'Kalite Sertifikaları': 'Kalite-Sertifikalari',
        'Personel Sertifikaları': 'Personel-Sertifikalari',
        'Prosedürler': 'documents',
        'Talimatlar': 'documents',
        'Formlar': 'documents',
        'El Kitapları': 'documents',
        'Şemalar': 'documents',
        'Görev Tanımları': 'documents',
        'Süreçler': 'documents',
        'Planlar': 'documents',
        'Listeler': 'documents',
        'Şartnameler': 'documents',
        'Politikalar': 'documents',
        'Tablolar': 'documents',
        'Antetler': 'documents',
        'Sözleşmeler': 'documents',
        'Yönetmelikler': 'documents',
        'Kontrol Planları': 'documents',
        'FMEA Planları': 'documents',
        'Proses Kontrol Kartları': 'documents',
        'Görsel Yardımcılar': 'documents',
        'Diğer': 'documents',
    };
    return folderMap[documentType] || 'documents';
};

const normalizeDetailStoragePath = (path, documentType) => {
    if (!path) return null;
    if (path.includes('/') && !path.startsWith('documents/') && !path.includes('Kalite') && !path.includes('Personel')) {
        const folderName = detailDocumentFolder(documentType);
        const parts = path.split('/');
        if (parts.length >= 2) {
            return `${folderName}/${parts.slice(1).join('/')}`;
        }
    }
    return path;
};

const DocumentDetailModal = ({ isOpen, setIsOpen, document }) => {
    const { toast } = useToast();
    const [revisions, setRevisions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [pdfViewerState, setPdfViewerState] = useState({ isOpen: false, url: null, title: '' });
    const [sourceViewerState, setSourceViewerState] = useState({
        isOpen: false,
        blob: null,
        previewUrl: null,
        fallbackPreviewUrl: null,
        previewMode: null,
        title: '',
        downloadHandler: null,
    });

    useEffect(() => {
        if (isOpen && document?.id) {
            console.log('DocumentDetailModal açıldı, document:', document);
            loadRevisions();
        } else {
            console.log('DocumentDetailModal açılmadı veya document.id yok:', { isOpen, documentId: document?.id });
        }
    }, [isOpen, document?.id]);

    const loadRevisions = async () => {
        if (!document?.id) {
            console.warn('DocumentDetailModal: document.id yok', document);
            return;
        }
        
        console.log('DocumentDetailModal: Revizyonlar yükleniyor, document_id:', document.id);
        setLoading(true);
        try {
            // Önce revizyonları çek
            const { data: revisionsData, error: revisionsError } = await supabase
                .from('document_revisions')
                .select('*')
                .eq('document_id', document.id)
                .order('revision_number', { ascending: false });

            if (revisionsError) {
                console.error('Revizyon çekme hatası:', revisionsError);
                throw revisionsError;
            }

            console.log('Çekilen revizyonlar:', revisionsData?.length || 0, 'document_id:', document.id, revisionsData);
            
            // Eğer revizyon yoksa ve document_revisions array'i varsa, onu kullan
            const fallbackRevisions = document.allDocumentRevisions || document.document_revisions;
            if ((!revisionsData || revisionsData.length === 0) && fallbackRevisions) {
                console.log('Supabase\'den revizyon gelmedi, doküman içindeki revizyonlar kullanılıyor:', fallbackRevisions);
                const docRevisions = Array.isArray(fallbackRevisions)
                    ? fallbackRevisions
                    : [fallbackRevisions].filter(Boolean);
                setRevisions(docRevisions);
                setLoading(false);
                return;
            }

            // Her revizyon için kullanıcı bilgilerini çek (hata olsa bile revizyonları göster)
            const revisionsWithUsers = await Promise.all((revisionsData || []).map(async (revision) => {
                try {
                    const [createdBy, approvedBy, reviewedBy] = await Promise.all([
                        revision.created_by ? supabase.from('profiles').select('id, full_name').eq('id', revision.created_by).single().catch(() => ({ data: null, error: null })) : Promise.resolve({ data: null, error: null }),
                        revision.approved_by_id ? supabase.from('personnel').select('id, full_name').eq('id', revision.approved_by_id).single().catch(() => ({ data: null, error: null })) : Promise.resolve({ data: null, error: null }),
                        revision.reviewed_by_id ? supabase.from('personnel').select('id, full_name').eq('id', revision.reviewed_by_id).single().catch(() => ({ data: null, error: null })) : Promise.resolve({ data: null, error: null })
                    ]);

                    return {
                        ...revision,
                        created_by_user: createdBy?.data || null,
                        approved_by_user: approvedBy?.data || null,
                        reviewed_by_user: reviewedBy?.data || null
                    };
                } catch (err) {
                    // Kullanıcı bilgileri çekilemese bile revizyonu göster
                    console.warn('Revizyon kullanıcı bilgileri çekilemedi:', err);
                    return {
                        ...revision,
                        created_by_user: null,
                        approved_by_user: null,
                        reviewed_by_user: null
                    };
                }
            }));

            setRevisions(revisionsWithUsers);
        } catch (err) {
            console.error('Revizyon geçmişi yüklenemedi:', err);
            setRevisions([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchSourceBlob = async (revision, documentType, attachment) => {
        let filePath = attachment?.path;
        if (!filePath) return null;
        filePath = normalizeDetailStoragePath(filePath, documentType);

        try {
            return await fetchInternalDocumentBlob(
                filePath,
                attachment.type || 'application/octet-stream',
            );
        } catch (err) {
            console.error('Kaynak dosyası alınamadı:', err);
            return null;
        }
    };

    const handleDownloadSource = async (revision, documentType, attachment) => {
        const blob = await fetchSourceBlob(revision, documentType, attachment);
        if (!blob) return;

        try {
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = resolveEditableSourceDownloadName(attachment, document?.document_number, document?.title);
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(blobUrl);
            document.body.removeChild(a);
        } catch (err) {
            console.error('Kaynak indirme hatası:', err);
        }
    };

    const handleViewSource = async (revision, documentType, attachment) => {
        if (!isOfficeSourcePreviewAttachment(attachment)) return;

        const preview = await prepareWordSourcePreview(
            attachment,
            (path) => normalizeDetailStoragePath(path, documentType),
        );
        if (preview.error) {
            toast({
                variant: 'destructive',
                title: 'Önizleme hatası',
                description: preview.error,
            });
            return;
        }

        const displayName = resolveEditableSourceDownloadName(attachment, document?.document_number, document?.title);
        setSourceViewerState({
            isOpen: true,
            blob: preview.blob || null,
            previewUrl: preview.previewUrl || null,
            fallbackPreviewUrl: preview.fallbackPreviewUrl || null,
            previewMode: preview.mode,
            title: displayName,
            downloadHandler: () => handleDownloadSource(revision, documentType, attachment),
        });
    };

    const handleViewPdf = async (revision, title, documentType) => {
        const pub = getPdfAttachment(revision?.attachments);
        let filePath = pub?.path;
        if (!filePath) {
            return;
        }

        filePath = normalizeDetailStoragePath(filePath, documentType);
        
        try {
            const { data, error } = await supabase.storage.from('documents').download(filePath);
            if (error) {
                console.error('PDF görüntülenemedi:', error);
                return;
            }
            
            const blob = new Blob([data], { type: 'application/pdf' });
            const blobUrl = window.URL.createObjectURL(blob);
            setPdfViewerState({ isOpen: true, url: blobUrl, title });
        } catch (err) {
            console.error('PDF açılırken hata:', err);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return '-';
            return format(date, 'dd.MM.yyyy HH:mm', { locale: tr });
        } catch {
            return '-';
        }
    };

    const formatDateOnly = (dateString) => {
        if (!dateString) return '-';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return '-';
            return format(date, 'dd.MM.yyyy', { locale: tr });
        } catch {
            return '-';
        }
    };

    if (!document) return null;

    return (
        <>
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
                    <header className="bg-gradient-to-r from-primary to-blue-700 px-6 py-5 flex items-center justify-between text-white shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="bg-white/20 p-2.5 rounded-lg"><FileText className="h-5 w-5 text-white" /></div>
                            <div>
                                <h1 className="text-lg font-bold tracking-tight">Doküman Detayları</h1>
                                <p className="text-[11px] text-blue-100 uppercase tracking-[0.15em] font-medium">{document.title} - {document.document_number}</p>
                            </div>
                        </div>
                    </header>

                    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-4 pb-6">
                        <div className="space-y-6">
                            {/* Doküman Genel Bilgileri */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Genel Bilgiler</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground">Doküman Adı</p>
                                            <p className="text-sm font-semibold">{document.title}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground">Doküman Numarası</p>
                                            <p className="text-sm font-semibold">{document.document_number || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground">Kategori</p>
                                            <p className="text-sm font-semibold">{document.document_type || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground">Birim</p>
                                            <p className="text-sm font-semibold">{document.department?.unit_name || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground">Oluşturulma Tarihi</p>
                                            <p className="text-sm font-semibold">{formatDate(document.created_at)}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground">Geçerlilik Tarihi</p>
                                            <p className="text-sm font-semibold">{document.valid_until ? formatDateOnly(document.valid_until) : 'Süresiz'}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground">Durum</p>
                                            <p className="text-sm font-semibold">
                                                {document.is_archived
                                                    ? (document.status === 'İptal' ? 'İptal (Arşiv)' : (document.status || 'Arşiv'))
                                                    : (document.status || 'Yayınlandı')}
                                            </p>
                                        </div>
                                        {document.is_archived && (
                                            <>
                                                <div>
                                                    <p className="text-sm font-medium text-muted-foreground">Arşiv Tarihi</p>
                                                    <p className="text-sm font-semibold">{formatDate(document.archived_at)}</p>
                                                </div>
                                                {document.archive_reason && (
                                                    <div className="col-span-2">
                                                        <p className="text-sm font-medium text-muted-foreground">İptal / Arşiv Gerekçesi</p>
                                                        <p className="text-sm font-semibold whitespace-pre-wrap">{document.archive_reason}</p>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Revizyon Tarihçesi */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <History className="w-5 h-5" />
                                        Revizyon Tarihçesi
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {loading ? (
                                        <div className="text-center py-8 text-muted-foreground">Yükleniyor...</div>
                                    ) : revisions.length === 0 ? (
                                        <div className="text-center py-8 text-muted-foreground">Revizyon bulunmuyor.</div>
                                    ) : (
                                        <div className="space-y-4">
                                            {revisions.map((revision, index) => {
                                                const pdfAttachment = getPdfAttachment(revision?.attachments);
                                                const sources = getSourceAttachments(revision?.attachments);
                                                const hasPdf = !!pdfAttachment?.path;
                                                const isCurrent = document.current_revision_id === revision.id;
                                                
                                                return (
                                                    <div key={revision.id} className="border rounded-lg p-4 space-y-3">
                                                        <div className="flex items-start justify-between gap-2 flex-wrap">
                                                            <div className="flex items-center gap-3">
                                                                <Badge variant={isCurrent ? "default" : "outline"} className="font-mono text-sm">
                                                                    Revizyon {revision.revision_number || index + 1}
                                                                </Badge>
                                                                {isCurrent && (
                                                                    <Badge variant="default" className="bg-green-600">
                                                                        Aktif Revizyon
                                                                    </Badge>
                                                                )}
                                                                {revision.revision_status && (
                                                                    <Badge variant="secondary">
                                                                        {revision.revision_status}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <div className="flex flex-wrap gap-2 justify-end">
                                                                {hasPdf && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => handleViewPdf(revision, document.title, document.document_type)}
                                                                    >
                                                                        <Eye className="w-4 h-4 mr-1" />
                                                                        PDF
                                                                    </Button>
                                                                )}
                                                                {sources.map((s) => {
                                                                    const sourceName = resolveEditableSourceDownloadName(s, document.document_number, document.title);
                                                                    return (
                                                                        <div key={s.path} className="flex flex-wrap gap-1">
                                                                            {isOfficeSourcePreviewAttachment(s) && (
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="sm"
                                                                                    onClick={() => handleViewSource(revision, document.document_type, s)}
                                                                                >
                                                                                    <Eye className="w-4 h-4 mr-1" />
                                                                                    <span className="max-w-[120px] truncate">Görüntüle</span>
                                                                                </Button>
                                                                            )}
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={() => handleDownloadSource(revision, document.document_type, s)}
                                                                            >
                                                                                <FileDown className="w-4 h-4 mr-1" />
                                                                                <span className="max-w-[140px] truncate">{sourceName}</span>
                                                                            </Button>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                                            <div className="flex items-start gap-2">
                                                                <Calendar className="w-4 h-4 mt-0.5 text-muted-foreground" />
                                                                <div>
                                                                    <p className="font-medium text-muted-foreground">Revizyon Tarihi</p>
                                                                    <p>{formatDate(revision.revision_date || revision.created_at)}</p>
                                                                </div>
                                                            </div>
                                                            {revision.publish_date && (
                                                                <div className="flex items-start gap-2">
                                                                    <Calendar className="w-4 h-4 mt-0.5 text-muted-foreground" />
                                                                    <div>
                                                                        <p className="font-medium text-muted-foreground">Yayın Tarihi</p>
                                                                        <p>{formatDateOnly(revision.publish_date)}</p>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {revision.effective_date && (
                                                                <div className="flex items-start gap-2">
                                                                    <Calendar className="w-4 h-4 mt-0.5 text-muted-foreground" />
                                                                    <div>
                                                                        <p className="font-medium text-muted-foreground">Yürürlük Tarihi</p>
                                                                        <p>{formatDateOnly(revision.effective_date)}</p>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {revision.superseded_date && (
                                                                <div className="flex items-start gap-2">
                                                                    <Calendar className="w-4 h-4 mt-0.5 text-muted-foreground" />
                                                                    <div>
                                                                        <p className="font-medium text-muted-foreground">Yürürlükten Kalkma</p>
                                                                        <p>{formatDateOnly(revision.superseded_date)}</p>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        <Separator />

                                                        <div className="space-y-3">
                                                            {revision.created_by_user && (
                                                                <div className="flex items-start gap-2">
                                                                    <User className="w-4 h-4 mt-0.5 text-muted-foreground" />
                                                                    <div className="flex-1">
                                                                        <p className="text-sm font-medium text-muted-foreground">Oluşturan</p>
                                                                        <p className="text-sm">{revision.created_by_user.full_name}</p>
                                                                        {revision.created_at && (
                                                                            <p className="text-xs text-muted-foreground mt-1">
                                                                                {formatDate(revision.created_at)}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            
                                                            {revision.approved_by_user && (
                                                                <div className="flex items-start gap-2">
                                                                    <User className="w-4 h-4 mt-0.5 text-muted-foreground" />
                                                                    <div className="flex-1">
                                                                        <p className="text-sm font-medium text-muted-foreground">Onaylayan</p>
                                                                        <p className="text-sm">{revision.approved_by_user.full_name}</p>
                                                                        {revision.approved_at && (
                                                                            <p className="text-xs text-muted-foreground mt-1">
                                                                                {formatDate(revision.approved_at)}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {revision.reviewed_by_user && (
                                                                <div className="flex items-start gap-2">
                                                                    <User className="w-4 h-4 mt-0.5 text-muted-foreground" />
                                                                    <div className="flex-1">
                                                                        <p className="text-sm font-medium text-muted-foreground">İnceleyen</p>
                                                                        <p className="text-sm">{revision.reviewed_by_user.full_name}</p>
                                                                        {revision.reviewed_at && (
                                                                            <p className="text-xs text-muted-foreground mt-1">
                                                                                {formatDate(revision.reviewed_at)}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {(revision.revision_reason || revision.change_summary) && (
                                                            <>
                                                                <Separator />
                                                                <div>
                                                                    <p className="text-sm font-medium text-muted-foreground mb-2">Revizyon Nedeni</p>
                                                                    <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-md">
                                                                        {revision.revision_reason || revision.change_summary}
                                                                    </p>
                                                                </div>
                                                            </>
                                                        )}

                                                        {revision.review_notes && (
                                                            <>
                                                                <Separator />
                                                                <div>
                                                                    <p className="text-sm font-medium text-muted-foreground mb-2">İnceleme Notları</p>
                                                                    <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-md">
                                                                        {revision.review_notes}
                                                                    </p>
                                                                </div>
                                                            </>
                                                        )}

                                                        {revision.rejection_reason && (
                                                            <>
                                                                <Separator />
                                                                <div>
                                                                    <p className="text-sm font-medium text-destructive mb-2">Red Nedeni</p>
                                                                    <p className="text-sm whitespace-pre-wrap bg-destructive/10 p-3 rounded-md text-destructive">
                                                                        {revision.rejection_reason}
                                                                    </p>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <PdfViewerModal 
                isOpen={pdfViewerState.isOpen}
                setIsOpen={(isOpen) => setPdfViewerState(s => ({...s, isOpen}))}
                pdfUrl={pdfViewerState.url}
                title={pdfViewerState.title}
            />
            <SourceDocumentViewerModal
                isOpen={sourceViewerState.isOpen}
                setIsOpen={(isOpen) => {
                    if (!isOpen) {
                        setSourceViewerState({
                            isOpen: false,
                            blob: null,
                            previewUrl: null,
                            fallbackPreviewUrl: null,
                            previewMode: null,
                            title: '',
                            downloadHandler: null,
                        });
                    } else {
                        setSourceViewerState((state) => ({ ...state, isOpen: true }));
                    }
                }}
                blob={sourceViewerState.blob}
                previewUrl={sourceViewerState.previewUrl}
                fallbackPreviewUrl={sourceViewerState.fallbackPreviewUrl}
                previewMode={sourceViewerState.previewMode}
                title={sourceViewerState.title}
                onDownload={sourceViewerState.downloadHandler}
            />
        </>
    );
};

export default DocumentDetailModal;
