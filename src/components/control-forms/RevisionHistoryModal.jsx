import React, { useEffect, useState } from 'react';
import { History, FileText } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

const RevisionHistoryModal = ({ open, setOpen, templateId }) => {
    const { toast } = useToast();
    const [revisions, setRevisions] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open || !templateId) return;
        (async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('control_form_template_revisions')
                    .select('*')
                    .eq('template_id', templateId)
                    .order('revision_no', { ascending: false });
                if (error) throw error;
                setRevisions(data || []);
            } catch (err) {
                toast({
                    variant: 'destructive',
                    title: 'Hata',
                    description: 'Revizyon geçmişi yüklenemedi: ' + err.message,
                });
            } finally {
                setLoading(false);
            }
        })();
    }, [open, templateId, toast]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <History className="w-5 h-5 text-primary" />
                        Revizyon Geçmişi
                    </DialogTitle>
                    <DialogDescription>
                        Şablonda yapılan her değişiklik için otomatik revizyon snapshot'ı saklanır.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <p className="text-center py-8 text-muted-foreground">Yükleniyor...</p>
                    ) : revisions.length === 0 ? (
                        <div className="text-center py-12 border border-dashed rounded-md">
                            <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                            <p className="text-sm text-muted-foreground">
                                Henüz revizyon oluşmadı. İlk düzenleme ile Rev 1 oluşacaktır.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {revisions.map((r) => (
                                <div key={r.id} className="border rounded-md p-3 hover:bg-muted/30">
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="default">
                                                Rev {String(r.revision_no).padStart(2, '0')}
                                            </Badge>
                                            <span className="text-sm text-muted-foreground">
                                                {format(new Date(r.revision_date), 'dd.MM.yyyy', { locale: tr })}
                                            </span>
                                        </div>
                                        <span className="text-xs text-muted-foreground">
                                            {format(new Date(r.created_at), 'dd.MM.yyyy HH:mm', { locale: tr })}
                                        </span>
                                    </div>
                                    {r.changes_summary && (
                                        <p className="text-sm text-foreground">{r.changes_summary}</p>
                                    )}
                                    {r.snapshot?.sections && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {r.snapshot.sections.length} bölüm,{' '}
                                            {r.snapshot.sections.reduce(
                                                (acc, s) => acc + (s.items?.length || 0),
                                                0
                                            )}{' '}
                                            madde
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default RevisionHistoryModal;
