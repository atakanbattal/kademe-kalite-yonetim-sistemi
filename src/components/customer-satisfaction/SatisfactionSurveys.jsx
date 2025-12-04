import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';

const SatisfactionSurveys = () => {
    const { toast } = useToast();
    const [surveys, setSurveys] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadSurveys();
    }, []);

    const loadSurveys = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('customer_satisfaction_surveys')
                .select(`
                    *,
                    customer:customer_id(customer_name)
                `)
                .order('survey_date', { ascending: false });

            if (error) throw error;
            setSurveys(data || []);
        } catch (error) {
            console.error('Surveys loading error:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Anketler yüklenirken hata oluştu.'
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
                        <CardTitle>Müşteri Memnuniyet Anketleri</CardTitle>
                        <Button>
                            <Plus className="w-4 h-4 mr-2" />
                            Yeni Anket
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-12 text-muted-foreground">
                            Yükleniyor...
                        </div>
                    ) : surveys.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            Henüz anket oluşturulmamış.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {surveys.map((survey) => (
                                <div key={survey.id} className="flex items-center justify-between p-4 border rounded-lg">
                                    <div>
                                        <h4 className="font-semibold">{survey.survey_name}</h4>
                                        <p className="text-sm text-muted-foreground">
                                            {survey.customer?.customer_name} | {new Date(survey.survey_date).toLocaleDateString('tr-TR')}
                                        </p>
                                        {survey.nps_score !== null && (
                                            <Badge className="mt-2">NPS: {survey.nps_score}</Badge>
                                        )}
                                    </div>
                                    <Button variant="outline" size="sm">
                                        Görüntüle
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default SatisfactionSurveys;

