import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { History, User, Calendar, FileText, RefreshCw, Eye, FileDown } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import PdfViewerModal from '@/components/document/PdfViewerModal';

const DocumentDetailModal = ({ isOpen, setIsOpen, document }) => {
    const [revisions, setRevisions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [pdfViewerState, setPdfViewerState] = useState({ isOpen: false, url: null, title: '' });

    useEffect(() => {
        if (isOpen && document?.id) {
            loadRevisions();
        }
    }, [isOpen, document?.id]);

    const loadRevisions = async () => {
        if (!document?.id) return;
        
        setLoading(true);
        try {
            // Önce revizyonları çek
            const { data: revisionsData, error: revisionsError } = await supabase
                .from('document_revisions')
                .select('*')
                .eq('document_id', document.id)
                .order('revision_number', { ascending: false });

            if (revisionsError) throw revisionsError;

            // Her revizyon için kullanıcı bilgilerini çek
            const revisionsWithUsers = await Promise.all((revisionsData || []).map(async (revision) => {
                const [createdBy, approvedBy, reviewedBy] = await Promise.all([
                    revision.created_by ? supabase.from('profiles').select('id, full_name').eq('id', revision.created_by).single() : Promise.resolve({ data: null }),
                    revision.approved_by_id ? supabase.from('profiles').select('id, full_name').eq('id', revision.approved_by_id).single() : Promise.resolve({ data: null }),
                    revision.reviewed_by_id ? supabase.from('profiles').select('id, full_name').eq('id', revision.reviewed_by_id).single() : Promise.resolve({ data: null })
                ]);

                return {
                    ...revision,
                    created_by_user: createdBy.data,
                    approved_by_user: approvedBy.data,
                    reviewed_by_user: reviewedBy.data
                };
            }));

            setRevisions(revisionsWithUsers);

            if (error) throw error;
            setRevisions(data || []);
        } catch (error) {
            console.error('Revizyon geçmişi yüklenemedi:', error);
            setRevisions([]);
        } finally {
            setLoading(false);
        }
    };

    const handleViewPdf = async (revision, title, documentType) => {
        let filePath = revision?.attachments?.[0]?.path;
        if (!filePath) {
            return;
        }
        
        // Path'i normalize et
        const getDocumentFolder = (documentType) => {
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

        const normalizeDocumentPath = (path, documentType) => {
            if (!path) return null;
            if (path.includes('/') && !path.startsWith('documents/') && !path.includes('Kalite') && !path.includes('Personel')) {
                const folderName = getDocumentFolder(documentType);
                const parts = path.split('/');
                if (parts.length >= 2) {
                    return `${folderName}/${parts.slice(1).join('/')}`;
                }
            }
            return path;
        };

        filePath = normalizeDocumentPath(filePath, documentType);
        
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
                <DialogContent className="sm:max-w-4xl lg:max-w-6xl h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FileText className="w-5 h-5" />
                            Doküman Detayları
                        </DialogTitle>
                        <DialogDescription>
                            {document.title} - {document.document_number}
                        </DialogDescription>
                    </DialogHeader>

                    <ScrollArea className="flex-1 pr-4">
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
                                                const hasFile = !!revision?.attachments?.[0]?.path;
                                                const isCurrent = document.current_revision_id === revision.id;
                                                
                                                return (
                                                    <div key={revision.id} className="border rounded-lg p-4 space-y-3">
                                                        <div className="flex items-start justify-between">
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
                                                            {hasFile && (
                                                                <div className="flex gap-2">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => handleViewPdf(revision, document.title, document.document_type)}
                                                                    >
                                                                        <Eye className="w-4 h-4 mr-1" />
                                                                        Görüntüle
                                                                    </Button>
                                                                </div>
                                                            )}
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

                                                        {revision.change_summary && (
                                                            <>
                                                                <Separator />
                                                                <div>
                                                                    <p className="text-sm font-medium text-muted-foreground mb-2">Değişiklik Özeti</p>
                                                                    <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-md">
                                                                        {revision.change_summary}
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
                    </ScrollArea>
                </DialogContent>
            </Dialog>

            <PdfViewerModal 
                isOpen={pdfViewerState.isOpen}
                setIsOpen={(isOpen) => setPdfViewerState(s => ({...s, isOpen}))}
                pdfUrl={pdfViewerState.url}
                title={pdfViewerState.title}
            />
        </>
    );
};

export default DocumentDetailModal;

