import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, Eye, FileText, Calendar, User } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const RevisionHistory = ({ ncId, onRevisionCreate }) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [revisions, setRevisions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [revisionReason, setRevisionReason] = useState('');
    const [selectedRevision, setSelectedRevision] = useState(null);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);

    useEffect(() => {
        if (ncId) {
            loadRevisions();
        }
    }, [ncId]);

    const loadRevisions = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('eight_d_revisions')
                .select('*, created_by_user:profiles!eight_d_revisions_created_by_fkey(full_name)')
                .eq('nc_id', ncId)
                .order('revision_date', { ascending: false });

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

    const handleCreateRevision = async () => {
        if (!revisionReason.trim()) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Lütfen revizyon nedeni belirtin.'
            });
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase.rpc('create_8d_revision', {
                p_nc_id: ncId,
                p_revision_reason: revisionReason
            });

            if (error) throw error;

            toast({
                title: 'Başarılı',
                description: 'Revizyon oluşturuldu.'
            });

            setRevisionReason('');
            setIsCreateModalOpen(false);
            loadRevisions();
            
            if (onRevisionCreate) {
                onRevisionCreate(data);
            }
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Revizyon oluşturulamadı: ' + error.message
            });
        } finally {
            setLoading(false);
        }
    };

    const handleViewRevision = (revision) => {
        setSelectedRevision(revision);
        setIsViewModalOpen(true);
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <History className="h-5 w-5 text-primary" />
                                8D Revizyon Geçmişi
                            </CardTitle>
                            <CardDescription>
                                Tüm revizyon kayıtları ve snapshot'ları
                            </CardDescription>
                        </div>
                        <Button
                            onClick={() => setIsCreateModalOpen(true)}
                            size="sm"
                        >
                            <FileText className="h-4 w-4 mr-2" />
                            Yeni Revizyon
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading && revisions.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            Yükleniyor...
                        </div>
                    ) : revisions.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            Henüz revizyon kaydı bulunmuyor.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {revisions.map((revision) => (
                                <div
                                    key={revision.id}
                                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <Badge variant="outline" className="font-mono">
                                            {revision.revision_number}
                                        </Badge>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium">
                                                {format(new Date(revision.revision_date), 'dd.MM.yyyy', { locale: tr })}
                                            </span>
                                            {revision.revision_reason && (
                                                <span className="text-xs text-muted-foreground">
                                                    {revision.revision_reason}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">
                                            {revision.created_by_user?.full_name || 'Sistem'}
                                        </span>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleViewRevision(revision)}
                                        >
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Yeni Revizyon Modal */}
            <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Yeni Revizyon Oluştur</DialogTitle>
                        <DialogDescription>
                            Mevcut 8D adımlarının snapshot'ı alınacak ve yeni bir revizyon kaydı oluşturulacak.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium">Revizyon Nedeni</label>
                            <textarea
                                className="w-full mt-1 p-2 border rounded-md"
                                rows={4}
                                value={revisionReason}
                                onChange={(e) => setRevisionReason(e.target.value)}
                                placeholder="Bu revizyonun neden yapıldığını açıklayın..."
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setIsCreateModalOpen(false)}
                            >
                                İptal
                            </Button>
                            <Button
                                onClick={handleCreateRevision}
                                disabled={loading}
                            >
                                {loading ? 'Oluşturuluyor...' : 'Revizyon Oluştur'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Revizyon Detay Modal */}
            <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
                <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
                    <DialogHeader>
                        <DialogTitle>
                            Revizyon Detayı - {selectedRevision?.revision_number}
                        </DialogTitle>
                        <DialogDescription>
                            {selectedRevision && format(new Date(selectedRevision.revision_date), 'dd.MM.yyyy', { locale: tr })}
                        </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[70vh] pr-4">
                        {selectedRevision && (
                            <div className="space-y-4">
                                {selectedRevision.revision_reason && (
                                    <div>
                                        <h4 className="font-semibold mb-2">Revizyon Nedeni</h4>
                                        <p className="text-sm text-muted-foreground">
                                            {selectedRevision.revision_reason}
                                        </p>
                                    </div>
                                )}
                                {selectedRevision.eight_d_steps && (
                                    <div>
                                        <h4 className="font-semibold mb-2">8D Adımları Snapshot</h4>
                                        <pre className="text-xs bg-muted p-3 rounded overflow-auto">
                                            {JSON.stringify(selectedRevision.eight_d_steps, null, 2)}
                                        </pre>
                                    </div>
                                )}
                                {selectedRevision.eight_d_progress && (
                                    <div>
                                        <h4 className="font-semibold mb-2">8D Progress Snapshot</h4>
                                        <pre className="text-xs bg-muted p-3 rounded overflow-auto">
                                            {JSON.stringify(selectedRevision.eight_d_progress, null, 2)}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        )}
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default RevisionHistory;

