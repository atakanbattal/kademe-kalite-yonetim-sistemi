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
import CustomerFeedbackFormModal from './CustomerFeedbackFormModal';

const CustomerFeedback = () => {
    const { toast } = useToast();
    const [feedback, setFeedback] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isFormModalOpen, setFormModalOpen] = useState(false);
    const [editingFeedback, setEditingFeedback] = useState(null);
    const [deletingFeedback, setDeletingFeedback] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        loadFeedback();
    }, []);

    const loadFeedback = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('customer_feedback')
                .select(`
                    *,
                    customers!customer_id(customer_name, customer_code)
                `)
                .order('feedback_date', { ascending: false });

            if (error) throw error;
            setFeedback(data || []);
        } catch (error) {
            console.error('Feedback loading error:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Geri bildirimler yüklenirken hata oluştu.'
            });
        } finally {
            setLoading(false);
        }
    };

    const openFormModal = (item = null) => {
        setEditingFeedback(item);
        setFormModalOpen(true);
    };

    const closeFormModal = () => {
        setEditingFeedback(null);
        setFormModalOpen(false);
        loadFeedback();
    };

    const handleDelete = async () => {
        if (!deletingFeedback) return;
        
        setIsDeleting(true);
        try {
            const { error } = await supabase
                .from('customer_feedback')
                .delete()
                .eq('id', deletingFeedback.id);

            if (error) throw error;
            
            toast({
                title: 'Başarılı',
                description: 'Geri bildirim silindi.'
            });
            
            setDeletingFeedback(null);
            loadFeedback();
        } catch (error) {
            console.error('Error deleting feedback:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: error.message || 'Geri bildirim silinirken hata oluştu.'
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
                        <CardTitle>Müşteri Geri Bildirimleri</CardTitle>
                        <Button onClick={() => openFormModal()}>
                            <Plus className="w-4 h-4 mr-2" />
                            Yeni Geri Bildirim
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-12 text-muted-foreground">
                            Yükleniyor...
                        </div>
                    ) : feedback.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            Henüz geri bildirim kaydı yok.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {feedback.map((item) => (
                                <div key={item.id} className="p-4 border rounded-lg">
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <h4 className="font-semibold">{item.subject}</h4>
                                            <p className="text-sm text-muted-foreground">
                                                {item.customers?.customer_name} | {new Date(item.feedback_date).toLocaleDateString('tr-TR')}
                                            </p>
                                        </div>
                                        <Badge variant={item.status === 'Resolved' || item.status === 'Çözüldü' ? 'success' : 'default'}>
                                            {item.status === 'Open' ? 'Açık' :
                                             item.status === 'In Progress' ? 'Devam Eden' :
                                             item.status === 'Resolved' ? 'Çözüldü' : item.status}
                                        </Badge>
                                    </div>
                                    <p className="text-sm">{item.description}</p>
                                    <div className="flex gap-2 mt-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => openFormModal(item)}
                                        >
                                            <Edit className="w-4 h-4 mr-1" />
                                            Düzenle
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setDeletingFeedback(item)}
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

            <CustomerFeedbackFormModal
                open={isFormModalOpen}
                setOpen={(open) => {
                    setFormModalOpen(open);
                    if (!open) {
                        setEditingFeedback(null);
                    }
                }}
                existingFeedback={editingFeedback}
                onSuccess={closeFormModal}
            />

            <AlertDialog open={!!deletingFeedback} onOpenChange={(open) => !open && setDeletingFeedback(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Geri Bildirimi Sil</AlertDialogTitle>
                        <AlertDialogDescription>
                            "{deletingFeedback?.subject}" geri bildirimini silmek istediğinizden emin misiniz?
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

export default CustomerFeedback;

