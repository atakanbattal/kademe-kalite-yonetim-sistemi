import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { History, FileText, User, Calendar, CheckCircle, XCircle, Clock, Eye, FileDown } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';

const RevisionHistoryModal = ({ isOpen, setIsOpen, document }) => {
    const { toast } = useToast();
    const [revisions, setRevisions] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && document?.id) {
            loadRevisionHistory();
        }
    }, [isOpen, document]);

    const loadRevisionHistory = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('document_revisions')
                .select(`
                    *,
                    prepared_by:prepared_by_id(id, full_name),
                    approved_by:approved_by_id(id, full_name),
                    reviewed_by:reviewed_by_id(id, full_name)
                `)
                .eq('document_id', document.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setRevisions(data || []);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Revizyon geçmişi yüklenemedi: ' + error.message
            });
        } finally {
            setLoading(false);
        }
    };

    const handleViewRevision = async (revision) => {
        const filePath = revision?.attachments?.[0]?.path;
        if (!filePath) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Dosya yolu bulunamadı.'
            });
            return;
        }

        try {
            const { data, error } = await supabase.storage
                .from('documents')
                .download(filePath);

            if (error) throw error;

            const blob = new Blob([data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            window.open(url, '_blank');
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Dosya açılamadı: ' + error.message
            });
        }
    };

    const handleDownloadRevision = async (revision) => {
        const filePath = revision?.attachments?.[0]?.path;
        const fileName = revision?.attachments?.[0]?.name || 'document.pdf';

        if (!filePath) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Dosya yolu bulunamadı.'
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
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Dosya indirilemedi: ' + error.message
            });
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'Yayınlandı':
            case 'Onaylandı':
                return <CheckCircle className="h-4 w-4 text-green-600" />;
            case 'Reddedildi':
                return <XCircle className="h-4 w-4 text-red-600" />;
            case 'Onay Bekliyor':
            case 'Taslak':
                return <Clock className="h-4 w-4 text-yellow-600" />;
            default:
                return <FileText className="h-4 w-4 text-gray-600" />;
        }
    };

    const getStatusBadge = (status) => {
        const statusConfig = {
            'Yayınlandı': 'bg-green-100 text-green-800',
            'Onaylandı': 'bg-blue-100 text-blue-800',
            'Onay Bekliyor': 'bg-yellow-100 text-yellow-800',
            'Taslak': 'bg-gray-100 text-gray-800',
            'Reddedildi': 'bg-red-100 text-red-800'
        };
        return (
            <Badge className={statusConfig[status] || 'bg-gray-100 text-gray-800'}>
                {status}
            </Badge>
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <History className="h-5 w-5" />
                        Revizyon Geçmişi
                    </DialogTitle>
                    <DialogDescription>
                        {document?.title} - {document?.document_number}
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="max-h-[70vh] pr-4">
                    {loading ? (
                        <div className="text-center py-8 text-muted-foreground">
                            Yükleniyor...
                        </div>
                    ) : revisions.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            Revizyon geçmişi bulunmuyor.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {revisions.map((revision, index) => {
                                const isCurrent = revision.id === document?.current_revision_id;
                                const hasFile = !!revision?.attachments?.[0]?.path;

                                return (
                                    <Card key={revision.id} className={isCurrent ? 'border-primary border-2' : ''}>
                                        <CardContent className="pt-6">
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="flex items-start gap-3">
                                                    <div className="mt-1">
                                                        {getStatusIcon(revision.revision_status)}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <h3 className="font-semibold">
                                                                Revizyon {revision.revision_number}
                                                            </h3>
                                                            {isCurrent && (
                                                                <Badge variant="default">Güncel</Badge>
                                                            )}
                                                            {getStatusBadge(revision.revision_status)}
                                                        </div>
                                                        {revision.revision_reason && (
                                                            <p className="text-sm text-muted-foreground mb-2">
                                                                {revision.revision_reason}
                                                            </p>
                                                        )}
                                                        {revision.change_summary && (
                                                            <p className="text-sm text-muted-foreground mb-2">
                                                                <strong>Değişiklik Özeti:</strong> {revision.change_summary}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                {hasFile && (
                                                    <div className="flex gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleViewRevision(revision)}
                                                        >
                                                            <Eye className="h-4 w-4 mr-1" />
                                                            Görüntüle
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleDownloadRevision(revision)}
                                                        >
                                                            <FileDown className="h-4 w-4 mr-1" />
                                                            İndir
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                                <div>
                                                    <div className="flex items-center gap-1 text-muted-foreground mb-1">
                                                        <Calendar className="h-3 w-3" />
                                                        <span>Yayın Tarihi</span>
                                                    </div>
                                                    <p className="font-medium">
                                                        {revision.publish_date
                                                            ? format(new Date(revision.publish_date), 'dd.MM.yyyy', { locale: tr })
                                                            : '-'}
                                                    </p>
                                                </div>

                                                {revision.effective_date && (
                                                    <div>
                                                        <div className="flex items-center gap-1 text-muted-foreground mb-1">
                                                            <Calendar className="h-3 w-3" />
                                                            <span>Yürürlük Tarihi</span>
                                                        </div>
                                                        <p className="font-medium">
                                                            {format(new Date(revision.effective_date), 'dd.MM.yyyy', { locale: tr })}
                                                        </p>
                                                    </div>
                                                )}

                                                {revision.prepared_by && (
                                                    <div>
                                                        <div className="flex items-center gap-1 text-muted-foreground mb-1">
                                                            <User className="h-3 w-3" />
                                                            <span>Hazırlayan</span>
                                                        </div>
                                                        <p className="font-medium">
                                                            {revision.prepared_by.full_name}
                                                        </p>
                                                    </div>
                                                )}

                                                {revision.approved_by && revision.approved_at && (
                                                    <div>
                                                        <div className="flex items-center gap-1 text-muted-foreground mb-1">
                                                            <CheckCircle className="h-3 w-3" />
                                                            <span>Onaylayan</span>
                                                        </div>
                                                        <p className="font-medium">
                                                            {revision.approved_by.full_name}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {format(new Date(revision.approved_at), 'dd.MM.yyyy', { locale: tr })}
                                                        </p>
                                                    </div>
                                                )}

                                                {revision.reviewed_by && revision.reviewed_at && (
                                                    <div>
                                                        <div className="flex items-center gap-1 text-muted-foreground mb-1">
                                                            <User className="h-3 w-3" />
                                                            <span>İnceleyen</span>
                                                        </div>
                                                        <p className="font-medium">
                                                            {revision.reviewed_by.full_name}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {format(new Date(revision.reviewed_at), 'dd.MM.yyyy', { locale: tr })}
                                                        </p>
                                                    </div>
                                                )}

                                                {revision.rejection_reason && (
                                                    <div className="md:col-span-2">
                                                        <div className="flex items-center gap-1 text-muted-foreground mb-1">
                                                            <XCircle className="h-3 w-3" />
                                                            <span>Red Nedeni</span>
                                                        </div>
                                                        <p className="text-sm text-red-600">
                                                            {revision.rejection_reason}
                                                        </p>
                                                    </div>
                                                )}

                                                {revision.review_notes && (
                                                    <div className="md:col-span-2">
                                                        <div className="flex items-center gap-1 text-muted-foreground mb-1">
                                                            <FileText className="h-3 w-3" />
                                                            <span>İnceleme Notları</span>
                                                        </div>
                                                        <p className="text-sm">
                                                            {revision.review_notes}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>

                                            {revision.attachments?.[0] && (
                                                <div className="mt-4 pt-4 border-t">
                                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                        <FileText className="h-4 w-4" />
                                                        <span>
                                                            {revision.attachments[0].name} 
                                                            ({Math.round((revision.attachments[0].size || 0) / 1024)} KB)
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
};

export default RevisionHistoryModal;

