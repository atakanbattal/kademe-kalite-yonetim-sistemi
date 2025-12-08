import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { 
    FileText, 
    Eye, 
    Download, 
    History, 
    User, 
    Calendar, 
    Tag, 
    Folder,
    CheckCircle,
    XCircle,
    Clock,
    AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import PdfViewerModal from './PdfViewerModal';

const DocumentDetailModal = ({ isOpen, setIsOpen, document, onRefresh }) => {
    const { toast } = useToast();
    const [documentDetails, setDocumentDetails] = useState(null);
    const [revisions, setRevisions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [pdfViewerState, setPdfViewerState] = useState({ isOpen: false, url: null, title: '' });

    useEffect(() => {
        if (isOpen && document) {
            loadDocumentDetails();
        }
    }, [isOpen, document]);

    const loadDocumentDetails = async () => {
        if (!document) return;
        
        setLoading(true);
        try {
            // Doküman detaylarını yükle
            const { data: docData, error: docError } = await supabase
                .from('documents')
                .select(`
                    *,
                    department:department_id(unit_name, unit_code),
                    supplier:supplier_id(name, supplier_code),
                    owner:owner_id(full_name, email),
                    folder:folder_id(folder_name, folder_path),
                    current_revision:current_revision_id(*)
                `)
                .eq('id', document.id)
                .single();

            if (docError) throw docError;

            // Revizyon geçmişini yükle
            const { data: revData, error: revError } = await supabase
                .from('document_revisions')
                .select(`
                    *,
                    prepared_by:prepared_by_id(full_name),
                    approved_by:approved_by_id(full_name),
                    reviewed_by:reviewed_by_id(full_name)
                `)
                .eq('document_id', document.id)
                .order('created_at', { ascending: false });

            if (revError) throw revError;

            setDocumentDetails(docData);
            setRevisions(revData || []);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Doküman detayları yüklenemedi: ' + error.message
            });
        } finally {
            setLoading(false);
        }
    };

    const handleViewPdf = async (revision) => {
        const filePath = revision?.attachments?.[0]?.path;
        if (!filePath) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Dosya bulunamadı.'
            });
            return;
        }

        try {
            const { data, error } = await supabase.storage
                .from('documents')
                .download(filePath);

            if (error) throw error;

            const blob = new Blob([data], { type: 'application/pdf' });
            const blobUrl = window.URL.createObjectURL(blob);

            setPdfViewerState({
                isOpen: true,
                url: blobUrl,
                title: documentDetails?.title || 'Doküman'
            });

            // Erişim logu kaydet
            await supabase.from('document_access_logs').insert({
                document_id: documentDetails.id,
                revision_id: revision.id,
                access_type: 'Görüntüleme'
            });
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'PDF açılamadı: ' + error.message
            });
        }
    };

    const handleDownload = async (revision) => {
        const filePath = revision?.attachments?.[0]?.path;
        const fileName = revision?.attachments?.[0]?.name || documentDetails?.title || 'document.pdf';
        
        if (!filePath) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Dosya bulunamadı.'
            });
            return;
        }

        try {
            const { data, error } = await supabase.storage
                .from('documents')
                .download(filePath);

            if (error) throw error;

            const blob = new Blob([data]);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            // Erişim logu kaydet
            await supabase.from('document_access_logs').insert({
                document_id: documentDetails.id,
                revision_id: revision.id,
                access_type: 'İndirme'
            });

            toast({
                title: 'Başarılı',
                description: 'Dosya indirildi.'
            });
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Dosya indirilemedi: ' + error.message
            });
        }
    };

    const getStatusBadge = (status) => {
        const statusConfig = {
            'Yayınlandı': { variant: 'success', icon: CheckCircle },
            'Onaylandı': { variant: 'success', icon: CheckCircle },
            'Onay Bekliyor': { variant: 'warning', icon: Clock },
            'Taslak': { variant: 'secondary', icon: FileText },
            'Reddedildi': { variant: 'destructive', icon: XCircle }
        };

        const config = statusConfig[status] || { variant: 'default', icon: AlertCircle };
        const Icon = config.icon;

        return (
            <Badge variant={config.variant} className="flex items-center gap-1">
                <Icon className="h-3 w-3" />
                {status}
            </Badge>
        );
    };

    if (!documentDetails && !loading) return null;

    return (
        <>
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-2xl">{documentDetails?.title || 'Doküman Detayları'}</DialogTitle>
                        <DialogDescription>
                            {documentDetails?.document_number && `Doküman No: ${documentDetails.document_number}`}
                        </DialogDescription>
                    </DialogHeader>

                    {loading ? (
                        <div className="py-8 text-center text-muted-foreground">
                            Yükleniyor...
                        </div>
                    ) : (
                        <Tabs defaultValue="details" className="w-full">
                            <TabsList>
                                <TabsTrigger value="details">Detaylar</TabsTrigger>
                                <TabsTrigger value="revisions">Revizyon Geçmişi ({revisions.length})</TabsTrigger>
                                <TabsTrigger value="metadata">Metadata</TabsTrigger>
                            </TabsList>

                            <TabsContent value="details" className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label className="text-sm text-muted-foreground">Doküman Tipi</Label>
                                        <p className="font-medium">{documentDetails?.document_type || '-'}</p>
                                    </div>
                                    <div>
                                        <Label className="text-sm text-muted-foreground">Alt Kategori</Label>
                                        <p className="font-medium">{documentDetails?.document_subcategory || '-'}</p>
                                    </div>
                                    <div>
                                        <Label className="text-sm text-muted-foreground">Birim</Label>
                                        <p className="font-medium">{documentDetails?.department?.unit_name || '-'}</p>
                                    </div>
                                    <div>
                                        <Label className="text-sm text-muted-foreground">Klasör</Label>
                                        <div className="flex items-center gap-2">
                                            <Folder className="h-4 w-4 text-muted-foreground" />
                                            <p className="font-medium">{documentDetails?.folder?.folder_path || '-'}</p>
                                        </div>
                                    </div>
                                    <div>
                                        <Label className="text-sm text-muted-foreground">Onay Durumu</Label>
                                        <div className="mt-1">
                                            {getStatusBadge(documentDetails?.approval_status)}
                                        </div>
                                    </div>
                                    <div>
                                        <Label className="text-sm text-muted-foreground">Sınıflandırma</Label>
                                        <p className="font-medium">{documentDetails?.classification || '-'}</p>
                                    </div>
                                    <div>
                                        <Label className="text-sm text-muted-foreground">Doküman Sahibi</Label>
                                        <div className="flex items-center gap-2">
                                            <User className="h-4 w-4 text-muted-foreground" />
                                            <p className="font-medium">{documentDetails?.owner?.full_name || '-'}</p>
                                        </div>
                                    </div>
                                    <div>
                                        <Label className="text-sm text-muted-foreground">Geçerlilik Tarihi</Label>
                                        <div className="flex items-center gap-2">
                                            <Calendar className="h-4 w-4 text-muted-foreground" />
                                            <p className="font-medium">
                                                {documentDetails?.valid_until 
                                                    ? format(new Date(documentDetails.valid_until), 'dd.MM.yyyy', { locale: tr })
                                                    : 'Süresiz'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {documentDetails?.description && (
                                    <div>
                                        <Label className="text-sm text-muted-foreground">Açıklama</Label>
                                        <p className="mt-1 whitespace-pre-wrap">{documentDetails.description}</p>
                                    </div>
                                )}

                                {(documentDetails?.tags?.length > 0 || documentDetails?.keywords?.length > 0) && (
                                    <div className="space-y-2">
                                        {documentDetails.tags?.length > 0 && (
                                            <div>
                                                <Label className="text-sm text-muted-foreground flex items-center gap-2">
                                                    <Tag className="h-4 w-4" />
                                                    Etiketler
                                                </Label>
                                                <div className="flex flex-wrap gap-2 mt-1">
                                                    {documentDetails.tags.map(tag => (
                                                        <Badge key={tag} variant="outline">{tag}</Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {documentDetails.keywords?.length > 0 && (
                                            <div>
                                                <Label className="text-sm text-muted-foreground">Anahtar Kelimeler</Label>
                                                <div className="flex flex-wrap gap-2 mt-1">
                                                    {documentDetails.keywords.map(keyword => (
                                                        <Badge key={keyword} variant="secondary">{keyword}</Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {documentDetails?.current_revision && (
                                    <div className="border-t pt-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <Label className="text-sm text-muted-foreground">Mevcut Revizyon</Label>
                                                <p className="font-medium">
                                                    Revizyon {documentDetails.current_revision.revision_number}
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    {documentDetails.current_revision.publish_date 
                                                        ? format(new Date(documentDetails.current_revision.publish_date), 'dd.MM.yyyy', { locale: tr })
                                                        : '-'}
                                                </p>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleViewPdf(documentDetails.current_revision)}
                                                >
                                                    <Eye className="h-4 w-4 mr-2" />
                                                    Görüntüle
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleDownload(documentDetails.current_revision)}
                                                >
                                                    <Download className="h-4 w-4 mr-2" />
                                                    İndir
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="revisions" className="space-y-4">
                                {revisions.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        Revizyon geçmişi bulunmuyor.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {revisions.map((revision, index) => (
                                            <div
                                                key={revision.id}
                                                className={`border rounded-lg p-4 ${
                                                    revision.id === documentDetails?.current_revision_id 
                                                        ? 'border-primary bg-primary/5' 
                                                        : ''
                                                }`}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <History className="h-4 w-4 text-muted-foreground" />
                                                            <span className="font-semibold">
                                                                Revizyon {revision.revision_number}
                                                            </span>
                                                            {revision.id === documentDetails?.current_revision_id && (
                                                                <Badge variant="success">Mevcut</Badge>
                                                            )}
                                                            {getStatusBadge(revision.revision_status)}
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                                                            <div>
                                                                <span className="font-medium">Yayın Tarihi: </span>
                                                                {revision.publish_date 
                                                                    ? format(new Date(revision.publish_date), 'dd.MM.yyyy', { locale: tr })
                                                                    : '-'}
                                                            </div>
                                                            <div>
                                                                <span className="font-medium">Hazırlayan: </span>
                                                                {revision.prepared_by?.full_name || '-'}
                                                            </div>
                                                            {revision.approved_by?.full_name && (
                                                                <div>
                                                                    <span className="font-medium">Onaylayan: </span>
                                                                    {revision.approved_by.full_name}
                                                                </div>
                                                            )}
                                                            {revision.effective_date && (
                                                                <div>
                                                                    <span className="font-medium">Yürürlük Tarihi: </span>
                                                                    {format(new Date(revision.effective_date), 'dd.MM.yyyy', { locale: tr })}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {revision.revision_reason && (
                                                            <div className="mt-2 text-sm">
                                                                <span className="font-medium">Revizyon Nedeni: </span>
                                                                {revision.revision_reason}
                                                            </div>
                                                        )}
                                                        {revision.change_summary && (
                                                            <div className="mt-2 text-sm">
                                                                <span className="font-medium">Değişiklik Özeti: </span>
                                                                {revision.change_summary}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {revision.attachments?.[0]?.path && (
                                                        <div className="flex gap-2">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleViewPdf(revision)}
                                                            >
                                                                <Eye className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleDownload(revision)}
                                                            >
                                                                <Download className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="metadata" className="space-y-4">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <Label className="text-muted-foreground">Oluşturulma Tarihi</Label>
                                        <p className="font-medium">
                                            {documentDetails?.created_at 
                                                ? format(new Date(documentDetails.created_at), 'dd.MM.yyyy HH:mm', { locale: tr })
                                                : '-'}
                                        </p>
                                    </div>
                                    <div>
                                        <Label className="text-muted-foreground">Son Güncelleme</Label>
                                        <p className="font-medium">
                                            {documentDetails?.updated_at 
                                                ? format(new Date(documentDetails.updated_at), 'dd.MM.yyyy HH:mm', { locale: tr })
                                                : '-'}
                                        </p>
                                    </div>
                                    <div>
                                        <Label className="text-muted-foreground">Görüntülenme Sayısı</Label>
                                        <p className="font-medium">{documentDetails?.view_count || 0}</p>
                                    </div>
                                    <div>
                                        <Label className="text-muted-foreground">İndirme Sayısı</Label>
                                        <p className="font-medium">{documentDetails?.download_count || 0}</p>
                                    </div>
                                    {documentDetails?.next_review_date && (
                                        <div>
                                            <Label className="text-muted-foreground">Sonraki Revizyon Tarihi</Label>
                                            <p className="font-medium">
                                                {format(new Date(documentDetails.next_review_date), 'dd.MM.yyyy', { locale: tr })}
                                            </p>
                                        </div>
                                    )}
                                    {documentDetails?.review_frequency_months && (
                                        <div>
                                            <Label className="text-muted-foreground">Revizyon Sıklığı</Label>
                                            <p className="font-medium">{documentDetails.review_frequency_months} ay</p>
                                        </div>
                                    )}
                                </div>
                            </TabsContent>
                        </Tabs>
                    )}
                </DialogContent>
            </Dialog>

            <PdfViewerModal
                isOpen={pdfViewerState.isOpen}
                setIsOpen={(isOpen) => setPdfViewerState(s => ({ ...s, isOpen }))}
                pdfUrl={pdfViewerState.url}
                title={pdfViewerState.title}
            />
        </>
    );
};

export default DocumentDetailModal;

