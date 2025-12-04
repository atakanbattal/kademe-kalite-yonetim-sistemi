import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';

const DevelopmentAssessments = () => {
    const { toast } = useToast();
    const [assessments, setAssessments] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadAssessments();
    }, []);

    const loadAssessments = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('supplier_development_assessments')
                .select(`
                    *,
                    supplier_development_plans!plan_id(plan_name)
                `)
                .order('assessment_date', { ascending: false });

            if (error) {
                if (error.code === '42P01' || error.message.includes('does not exist')) {
                    console.error('Tablo bulunamadı:', error);
                    toast({
                        variant: 'destructive',
                        title: 'Tablo Bulunamadı',
                        description: 'supplier_development_assessments tablosu henüz oluşturulmamış. Lütfen Supabase SQL Editor\'de create-supplier-development-module.sql script\'ini çalıştırın.'
                    });
                    setAssessments([]);
                    return;
                }
                throw error;
            }
            setAssessments(data || []);
        } catch (error) {
            console.error('Assessments loading error:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Değerlendirmeler yüklenirken hata oluştu: ' + (error.message || 'Bilinmeyen hata')
            });
            setAssessments([]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Geliştirme Değerlendirmeleri</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-12 text-muted-foreground">
                            Yükleniyor...
                        </div>
                    ) : assessments.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            Henüz değerlendirme kaydı yok.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {assessments.map((assessment) => (
                                <div key={assessment.id} className="p-4 border rounded-lg">
                                    <h4 className="font-semibold">{assessment.supplier_development_plans?.plan_name}</h4>
                                    <p className="text-sm text-muted-foreground">
                                        {new Date(assessment.assessment_date).toLocaleDateString('tr-TR')} | 
                                        İyileşme: {assessment.improvement_percentage || 0}%
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default DevelopmentAssessments;

