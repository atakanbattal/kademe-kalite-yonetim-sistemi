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
import DevelopmentPlanFormModal from './DevelopmentPlanFormModal';

const DevelopmentPlans = () => {
    const { toast } = useToast();
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isFormModalOpen, setFormModalOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState(null);
    const [deletingPlan, setDeletingPlan] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        loadPlans();
    }, []);

    const openFormModal = (plan = null) => {
        setEditingPlan(plan);
        setFormModalOpen(true);
    };

    const closeFormModal = () => {
        setEditingPlan(null);
        setFormModalOpen(false);
        loadPlans();
    };

    const handleDelete = async () => {
        if (!deletingPlan) return;
        
        setIsDeleting(true);
        try {
            const { error } = await supabase
                .from('supplier_development_plans')
                .delete()
                .eq('id', deletingPlan.id);

            if (error) throw error;
            
            toast({
                title: 'Başarılı',
                description: 'Geliştirme planı silindi.'
            });
            
            setDeletingPlan(null);
            loadPlans();
        } catch (error) {
            console.error('Error deleting plan:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: error.message || 'Plan silinirken hata oluştu.'
            });
        } finally {
            setIsDeleting(false);
        }
    };

    const loadPlans = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('supplier_development_plans')
                .select(`
                    *,
                    suppliers!supplier_id(id, name)
                `)
                .order('created_at', { ascending: false });

            if (error) {
                // Tablo yoksa veya RLS hatası varsa daha açıklayıcı mesaj
                if (error.code === '42P01' || error.message.includes('does not exist')) {
                    console.error('Tablo bulunamadı:', error);
                    toast({
                        variant: 'destructive',
                        title: 'Tablo Bulunamadı',
                        description: 'supplier_development_plans tablosu henüz oluşturulmamış. Lütfen Supabase SQL Editor\'de create-supplier-development-module.sql script\'ini çalıştırın.'
                    });
                    setPlans([]);
                    return;
                }
                throw error;
            }
            setPlans(data || []);
        } catch (error) {
            console.error('Plans loading error:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Geliştirme planları yüklenirken hata oluştu: ' + (error.message || 'Bilinmeyen hata')
            });
            setPlans([]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>Tedarikçi Geliştirme Planları</CardTitle>
                        <Button onClick={() => openFormModal()}>
                            <Plus className="w-4 h-4 mr-2" />
                            Yeni Plan
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-12 text-muted-foreground">
                            Yükleniyor...
                        </div>
                    ) : plans.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            Henüz geliştirme planı oluşturulmamış.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {plans.map((plan) => (
                                <div key={plan.id} className="p-4 border rounded-lg">
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <h4 className="font-semibold">{plan.plan_name}</h4>
                                            <p className="text-sm text-muted-foreground">
                                                {plan.suppliers?.name} | {plan.plan_type}
                                            </p>
                                        </div>
                                        <Badge>{plan.current_status}</Badge>
                                    </div>
                                    <p className="text-sm">{plan.objectives}</p>
                                    <div className="flex gap-2 mt-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => openFormModal(plan)}
                                        >
                                            <Edit className="w-4 h-4 mr-1" />
                                            Düzenle
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setDeletingPlan(plan)}
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

            <DevelopmentPlanFormModal
                open={isFormModalOpen}
                setOpen={(open) => {
                    setFormModalOpen(open);
                    if (!open) {
                        setEditingPlan(null);
                    }
                }}
                existingPlan={editingPlan}
                onSuccess={closeFormModal}
            />

            <AlertDialog open={!!deletingPlan} onOpenChange={(open) => !open && setDeletingPlan(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Planı Sil</AlertDialogTitle>
                        <AlertDialogDescription>
                            "{deletingPlan?.plan_name}" geliştirme planını silmek istediğinizden emin misiniz?
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

export default DevelopmentPlans;

