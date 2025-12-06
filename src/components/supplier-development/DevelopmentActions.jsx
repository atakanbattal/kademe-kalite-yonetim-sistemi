import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import DevelopmentActionFormModal from './DevelopmentActionFormModal';

const DevelopmentActions = () => {
    const { toast } = useToast();
    const [actions, setActions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isFormModalOpen, setFormModalOpen] = useState(false);
    const [editingAction, setEditingAction] = useState(null);
    const [deletingAction, setDeletingAction] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        loadActions();
    }, []);

    const loadActions = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('supplier_development_actions')
                .select(`
                    *,
                    supplier_development_plans!plan_id(plan_name, suppliers!supplier_id(id, name))
                `)
                .order('due_date', { ascending: true });

            if (error) throw error;
            setActions(data || []);
        } catch (error) {
            console.error('Actions loading error:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Aksiyonlar yüklenirken hata oluştu.'
            });
        } finally {
            setLoading(false);
        }
    };

    const openFormModal = (action = null) => {
        setEditingAction(action);
        setFormModalOpen(true);
    };

    const closeFormModal = () => {
        setEditingAction(null);
        setFormModalOpen(false);
        loadActions();
    };

    const handleDelete = async () => {
        if (!deletingAction) return;
        
        setIsDeleting(true);
        try {
            const { error } = await supabase
                .from('supplier_development_actions')
                .delete()
                .eq('id', deletingAction.id);

            if (error) throw error;
            
            toast({
                title: 'Başarılı',
                description: 'Aksiyon silindi.'
            });
            
            setDeletingAction(null);
            loadActions();
        } catch (error) {
            console.error('Error deleting action:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: error.message || 'Aksiyon silinirken hata oluştu.'
            });
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>Geliştirme Aksiyonları</CardTitle>
                        <Button onClick={() => openFormModal()}>
                            <Plus className="w-4 h-4 mr-2" />
                            Yeni Aksiyon
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-12 text-muted-foreground">
                            Yükleniyor...
                        </div>
                    ) : actions.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            Henüz aksiyon kaydı yok.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {actions.map((action) => (
                                <div key={action.id} className="p-4 border rounded-lg">
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <h4 className="font-semibold">
                                                Aksiyon #{action.action_number}: {action.action_description}
                                            </h4>
                                            <p className="text-sm text-muted-foreground">
                                                {action.supplier_development_plans?.plan_name} | {action.supplier_development_plans?.suppliers?.name}
                                            </p>
                                        </div>
                                        <Badge>{action.status}</Badge>
                                    </div>
                                    <div className="flex gap-2 mt-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => openFormModal(action)}
                                        >
                                            <Edit className="w-4 h-4 mr-1" />
                                            Düzenle
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setDeletingAction(action)}
                                            className="text-destructive hover:text-destructive"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <DevelopmentActionFormModal
                open={isFormModalOpen}
                setOpen={(open) => {
                    setFormModalOpen(open);
                    if (!open) {
                        setEditingAction(null);
                    }
                }}
                existingAction={editingAction}
                planId={null}
                onSuccess={closeFormModal}
            />

            <AlertDialog open={!!deletingAction} onOpenChange={(open) => !open && setDeletingAction(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Aksiyonu Sil</AlertDialogTitle>
                        <AlertDialogDescription>
                            "{deletingAction?.action_description}" aksiyonunu silmek istediğinizden emin misiniz?
                            Bu işlem geri alınamaz.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>İptal</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeleting ? 'Siliniyor...' : 'Sil'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default DevelopmentActions;

