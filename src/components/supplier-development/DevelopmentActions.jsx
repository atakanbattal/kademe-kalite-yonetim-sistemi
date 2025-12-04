import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Edit } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import ActionFormModal from './ActionFormModal';

const DevelopmentActions = () => {
    const { toast } = useToast();
    const [actions, setActions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [plans, setPlans] = useState([]);
    const [selectedPlanId, setSelectedPlanId] = useState(null);
    const [formModalOpen, setFormModalOpen] = useState(false);
    const [selectedAction, setSelectedAction] = useState(null);

    useEffect(() => {
        loadPlans();
    }, []);

    useEffect(() => {
        if (selectedPlanId) {
            loadActions();
        }
    }, [selectedPlanId]);

    const loadPlans = async () => {
        try {
            const { data, error } = await supabase
                .from('supplier_development_plans')
                .select('id, plan_name, suppliers!supplier_id(name)')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setPlans(data || []);
            if (data && data.length > 0 && !selectedPlanId) {
                setSelectedPlanId(data[0].id);
            }
        } catch (error) {
            console.error('Plans loading error:', error);
        }
    };

    const loadActions = async () => {
        if (!selectedPlanId) {
            setActions([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('supplier_development_actions')
                .select(`
                    *,
                    supplier_development_plans!plan_id(plan_name, suppliers!supplier_id(id, name))
                `)
                .eq('plan_id', selectedPlanId)
                .order('due_date', { ascending: true });

            if (error) {
                if (error.code === '42P01' || error.message.includes('does not exist')) {
                    console.error('Tablo bulunamadı:', error);
                    toast({
                        variant: 'destructive',
                        title: 'Tablo Bulunamadı',
                        description: 'supplier_development_actions tablosu henüz oluşturulmamış. Lütfen Supabase SQL Editor\'de create-supplier-development-module.sql script\'ini çalıştırın.'
                    });
                    setActions([]);
                    return;
                }
                throw error;
            }
            setActions(data || []);
        } catch (error) {
            console.error('Actions loading error:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Aksiyonlar yüklenirken hata oluştu: ' + (error.message || 'Bilinmeyen hata')
            });
            setActions([]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>Geliştirme Aksiyonları</CardTitle>
                        <Button
                            onClick={() => {
                                if (!selectedPlanId) {
                                    toast({
                                        variant: 'destructive',
                                        title: 'Uyarı',
                                        description: 'Lütfen önce bir plan seçin.'
                                    });
                                    return;
                                }
                                setSelectedAction(null);
                                setFormModalOpen(true);
                            }}
                            disabled={!selectedPlanId}
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Yeni Aksiyon
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="mb-4">
                        <label className="text-sm font-medium mb-2 block">Plan Seçin</label>
                        <Select value={selectedPlanId || ''} onValueChange={setSelectedPlanId}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Plan seçiniz" />
                            </SelectTrigger>
                            <SelectContent>
                                {plans.map(plan => (
                                    <SelectItem key={plan.id} value={plan.id}>
                                        {plan.plan_name} - {plan.suppliers?.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {loading ? (
                        <div className="text-center py-12 text-muted-foreground">
                            Yükleniyor...
                        </div>
                    ) : !selectedPlanId ? (
                        <div className="text-center py-12 text-muted-foreground">
                            Lütfen bir plan seçin.
                        </div>
                    ) : actions.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            Bu plan için henüz aksiyon kaydı yok.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {actions.map((action) => (
                                <div key={action.id} className="p-4 border rounded-lg">
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex-1">
                                            <h4 className="font-semibold">
                                                Aksiyon #{action.action_number}: {action.action_description}
                                            </h4>
                                            <p className="text-sm text-muted-foreground">
                                                {action.supplier_development_plans?.plan_name} | {action.supplier_development_plans?.suppliers?.name}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant={
                                                action.status === 'Tamamlanan' ? 'success' :
                                                action.status === 'Devam Ediyor' ? 'warning' :
                                                action.status === 'İptal Edildi' ? 'destructive' : 'default'
                                            }>
                                                {action.status}
                                            </Badge>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    setSelectedAction(action);
                                                    setFormModalOpen(true);
                                                }}
                                            >
                                                <Edit className="w-3 h-3" />
                                            </Button>
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={async () => {
                                                    if (confirm('Bu aksiyonu silmek istediğinize emin misiniz?')) {
                                                        try {
                                                            const { error } = await supabase
                                                                .from('supplier_development_actions')
                                                                .delete()
                                                                .eq('id', action.id);
                                                            if (error) throw error;
                                                            toast({
                                                                title: 'Başarılı',
                                                                description: 'Aksiyon silindi.'
                                                            });
                                                            loadActions();
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
                                                <Trash2 className="w-3 h-3" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
            <ActionFormModal
                open={formModalOpen}
                setOpen={setFormModalOpen}
                planId={selectedPlanId}
                existingAction={selectedAction}
                onSuccess={() => {
                    loadActions();
                    setSelectedAction(null);
                }}
            />
        </div>
    );
};

export default DevelopmentActions;

