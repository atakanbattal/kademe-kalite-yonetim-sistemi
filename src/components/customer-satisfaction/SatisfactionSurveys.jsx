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

const SatisfactionSurveys = () => {
    const { toast } = useToast();
    const [surveys, setSurveys] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deletingSurvey, setDeletingSurvey] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

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

    const handleDelete = async () => {
        if (!deletingSurvey) return;
        
        setIsDeleting(true);
        try {
            const { error } = await supabase
                .from('customer_satisfaction_surveys')
                .delete()
                .eq('id', deletingSurvey.id);

            if (error) throw error;
            
            toast({
                title: 'Başarılı',
                description: 'Anket silindi.'
            });
            
            setDeletingSurvey(null);
            loadSurveys();
        } catch (error) {
            console.error('Error deleting survey:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: error.message || 'Anket silinirken hata oluştu.'
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
                                            {survey.customers?.customer_name} | {new Date(survey.survey_date).toLocaleDateString('tr-TR')}
                                        </p>
                                        {survey.nps_score !== null && (
                                            <Badge className="mt-2">NPS: {survey.nps_score}</Badge>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm">
                                            Görüntüle
                                        </Button>
                                        <Button 
                                            variant="outline" 
                                            size="sm"
                                            onClick={() => setDeletingSurvey(survey)}
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

            <AlertDialog open={!!deletingSurvey} onOpenChange={(open) => !open && setDeletingSurvey(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Anketi Sil</AlertDialogTitle>
                        <AlertDialogDescription>
                            "{deletingSurvey?.survey_name}" anketini silmek istediğinizden emin misiniz?
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

export default SatisfactionSurveys;

