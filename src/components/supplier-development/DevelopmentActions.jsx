import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';

const DevelopmentActions = () => {
    const { toast } = useToast();
    const [actions, setActions] = useState([]);
    const [loading, setLoading] = useState(true);

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

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Geliştirme Aksiyonları</CardTitle>
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
                                        <Badge variant={
                                            action.status === 'Tamamlanan' ? 'success' :
                                            action.status === 'Devam Eden' ? 'warning' :
                                            action.status === 'İptal Edildi' ? 'destructive' : 'default'
                                        }>
                                            {action.status}
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default DevelopmentActions;

