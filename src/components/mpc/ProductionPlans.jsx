import React, { useState, useCallback } from 'react';
import { Plus, Edit, TrendingUp, TrendingDown, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
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
import ProductionPlanFormModal from './ProductionPlanFormModal';

const ProductionPlans = () => {
    const { toast } = useToast();
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isFormModalOpen, setFormModalOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState(null);
    const [deletingPlan, setDeletingPlan] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const loadPlans = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('production_plans')
                .select('*')
                .order('plan_date', { ascending: false })
                .limit(100);

            if (error) throw error;
            setPlans(data || []);
        } catch (error) {
            console.error('Production plans loading error:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Üretim planları yüklenirken hata oluştu.'
            });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    React.useEffect(() => {
        loadPlans();
    }, [loadPlans]);

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
                .from('production_plans')
                .delete()
                .eq('id', deletingPlan.id);

            if (error) throw error;
            
            toast({
                title: 'Başarılı',
                description: 'Üretim planı silindi.'
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

    const getEfficiencyColor = (efficiency) => {
        if (!efficiency) return 'secondary';
        if (efficiency >= 95) return 'success';
        if (efficiency >= 80) return 'default';
        return 'destructive';
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="py-12">
                    <div className="text-center text-muted-foreground">
                        Yükleniyor...
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-semibold">Üretim Planları</h3>
                    <p className="text-sm text-muted-foreground">
                        Planlanan ve gerçekleşen üretim miktarlarını takip edin
                    </p>
                </div>
                <Button onClick={() => openFormModal()}>
                    <Plus className="w-4 h-4 mr-2" />
                    Yeni Plan
                </Button>
            </div>

            {plans.length === 0 ? (
                <Card>
                    <CardContent className="py-12">
                        <div className="text-center text-muted-foreground">
                            Henüz üretim planı tanımlanmamış.
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {plans.map((plan) => {
                        const efficiency = plan.efficiency_percentage || 
                            (plan.planned_quantity > 0 
                                ? (plan.actual_quantity / plan.planned_quantity * 100) 
                                : 0);
                        return (
                            <Card key={plan.id} className="hover:shadow-lg transition-shadow">
                                <CardContent className="p-6">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex-1">
                                            <h4 className="font-semibold text-lg">{plan.plan_name}</h4>
                                            <p className="text-sm text-muted-foreground font-mono">
                                                {plan.plan_number}
                                            </p>
                                        </div>
                                        <Badge variant={plan.status === 'Completed' ? 'success' : 
                                                       plan.status === 'In Progress' ? 'default' : 
                                                       'secondary'}>
                                            {plan.status}
                                        </Badge>
                                    </div>

                                    <div className="space-y-2 text-sm">
                                        <div>
                                            <span className="text-muted-foreground">Tarih: </span>
                                            <span className="font-medium">
                                                {new Date(plan.plan_date).toLocaleDateString('tr-TR')}
                                            </span>
                                        </div>
                                        {plan.part_name && (
                                            <div>
                                                <span className="text-muted-foreground">Parça: </span>
                                                <span className="font-medium">{plan.part_name}</span>
                                            </div>
                                        )}
                                        <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                                            <div>
                                                <span className="text-muted-foreground">Planlanan: </span>
                                                <span className="font-semibold">{plan.planned_quantity}</span>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground">Gerçekleşen: </span>
                                                <span className="font-semibold">{plan.actual_quantity || 0}</span>
                                            </div>
                                        </div>
                                        <div className="pt-2 border-t">
                                            <div className="flex items-center justify-between">
                                                <span className="text-muted-foreground">Verimlilik: </span>
                                                <Badge variant={getEfficiencyColor(efficiency)}>
                                                    {efficiency.toFixed(1)}%
                                                </Badge>
                                            </div>
                                            {efficiency < 95 && (
                                                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                                    {efficiency < plan.planned_quantity ? (
                                                        <TrendingDown className="w-3 h-3 text-red-500" />
                                                    ) : (
                                                        <TrendingUp className="w-3 h-3 text-green-500" />
                                                    )}
                                                    <span>Hedefin altında</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex gap-2 mt-4">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => openFormModal(plan)}
                                            className="flex-1"
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
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            <ProductionPlanFormModal
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
                            "{deletingPlan?.plan_name}" planını silmek istediğinizden emin misiniz?
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

export default ProductionPlans;
