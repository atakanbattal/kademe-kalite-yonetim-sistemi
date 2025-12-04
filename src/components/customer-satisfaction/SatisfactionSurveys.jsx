import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Edit } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import SurveyFormModal from './SurveyFormModal';

const SatisfactionSurveys = () => {
    const { toast } = useToast();
    const [surveys, setSurveys] = useState([]);
    const [loading, setLoading] = useState(true);
    const [formModalOpen, setFormModalOpen] = useState(false);
    const [selectedSurvey, setSelectedSurvey] = useState(null);

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
                    customers!customer_id(customer_name, customer_code)
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
                        <Button onClick={() => {
                            setSelectedSurvey(null);
                            setFormModalOpen(true);
                        }}>
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
                                            {survey.customers?.customer_name} | {new Date(survey.survey_date).toLocaleDateString('tr-TR')}
                                        </p>
                                        {survey.nps_score !== null && (
                                            <Badge className="mt-2">NPS: {survey.nps_score}</Badge>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                setSelectedSurvey(survey);
                                                setFormModalOpen(true);
                                            }}
                                        >
                                            <Edit className="w-4 h-4 mr-2" />
                                            Düzenle
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={async () => {
                                                if (confirm('Bu anketi silmek istediğinize emin misiniz?')) {
                                                    try {
                                                        const { error } = await supabase
                                                            .from('customer_satisfaction_surveys')
                                                            .delete()
                                                            .eq('id', survey.id);
                                                        if (error) throw error;
                                                        toast({
                                                            title: 'Başarılı',
                                                            description: 'Anket silindi.'
                                                        });
                                                        loadSurveys();
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
                                            <Trash2 className="w-4 h-4 mr-2" />
                                            Sil
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
            <SurveyFormModal
                open={formModalOpen}
                setOpen={setFormModalOpen}
                existingSurvey={selectedSurvey}
                onSuccess={() => {
                    loadSurveys();
                    setSelectedSurvey(null);
                }}
            />
        </div>
    );
};

export default SatisfactionSurveys;

