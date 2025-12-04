import React, { useState } from 'react';
import { Plus, Edit, Eye, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import ValidationPlanFormModal from './ValidationPlanFormModal';

const STATUS_COLORS = {
    'Planlanan': 'default',
    'Devam Eden': 'warning',
    'Tamamlanan': 'success',
    'Başarısız': 'destructive',
    'İptal Edildi': 'secondary'
};

const ValidationPlansList = ({ plans, loading, onRefresh }) => {
    const { toast } = useToast();
    const [isFormModalOpen, setFormModalOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState(null);

    const openFormModal = (plan = null) => {
        setEditingPlan(plan);
        setFormModalOpen(true);
    };

    const closeFormModal = () => {
        setEditingPlan(null);
        setFormModalOpen(false);
        onRefresh();
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
                    <h3 className="text-lg font-semibold">Validasyon Planları</h3>
                    <p className="text-sm text-muted-foreground">
                        IQ/OQ/PQ validasyon planlarını yönetin
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
                            Henüz validasyon planı tanımlanmamış.
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {plans.map((plan) => (
                        <Card key={plan.id} className="hover:shadow-lg transition-shadow">
                            <CardContent className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <h4 className="font-semibold text-lg">{plan.plan_name}</h4>
                                        <p className="text-sm text-muted-foreground font-mono">
                                            {plan.plan_number}
                                        </p>
                                    </div>
                                    <Badge variant={STATUS_COLORS[plan.status] || 'default'}>
                                        {plan.status}
                                    </Badge>
                                </div>

                                <div className="space-y-2 text-sm">
                                    {plan.process_name && (
                                        <div>
                                            <span className="text-muted-foreground">Proses: </span>
                                            <span className="font-medium">{plan.process_name}</span>
                                        </div>
                                    )}
                                    {plan.equipments && (
                                        <div>
                                            <span className="text-muted-foreground">Ekipman: </span>
                                            <span className="font-medium">{plan.equipments.name}</span>
                                        </div>
                                    )}
                                    <div>
                                        <span className="text-muted-foreground">Tip: </span>
                                        <Badge variant="outline" className="ml-1">
                                            {plan.validation_type}
                                        </Badge>
                                    </div>
                                    {plan.planned_start_date && (
                                        <div>
                                            <span className="text-muted-foreground">Başlangıç: </span>
                                            <span className="font-medium">
                                                {new Date(plan.planned_start_date).toLocaleDateString('tr-TR')}
                                            </span>
                                        </div>
                                    )}
                                    {plan.planned_end_date && (
                                        <div>
                                            <span className="text-muted-foreground">Bitiş: </span>
                                            <span className="font-medium">
                                                {new Date(plan.planned_end_date).toLocaleDateString('tr-TR')}
                                            </span>
                                        </div>
                                    )}
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
                                        variant="destructive"
                                        size="sm"
                                        onClick={async () => {
                                            if (confirm('Bu validasyon planını silmek istediğinize emin misiniz?')) {
                                                try {
                                                    const { error } = await supabase
                                                        .from('validation_plans')
                                                        .delete()
                                                        .eq('id', plan.id);
                                                    if (error) throw error;
                                                    toast({
                                                        title: 'Başarılı',
                                                        description: 'Validasyon planı silindi.'
                                                    });
                                                    onRefresh();
                                                } catch (error) {
                                                    toast({
                                                        variant: 'destructive',
                                                        title: 'Hata',
                                                        description: error.message || 'Silme işlemi başarısız.'
                                                    });
                                                }
                                            }
                                        }}
                                    >
                                        <Trash2 className="w-4 h-4 mr-1" />
                                        Sil
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {isFormModalOpen && (
                <ValidationPlanFormModal
                    open={isFormModalOpen}
                    setOpen={setFormModalOpen}
                    existingPlan={editingPlan}
                    onSuccess={closeFormModal}
                />
            )}
        </div>
    );
};

export default ValidationPlansList;

