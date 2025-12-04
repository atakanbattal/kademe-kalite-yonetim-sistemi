import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';

const DevelopmentPlans = () => {
    const { toast } = useToast();
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadPlans();
    }, []);

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

            if (error) throw error;
            setPlans(data || []);
        } catch (error) {
            console.error('Plans loading error:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Geliştirme planları yüklenirken hata oluştu.'
            });
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
                        <Button>
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
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default DevelopmentPlans;

