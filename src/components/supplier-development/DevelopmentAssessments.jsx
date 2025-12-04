import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Edit } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import AssessmentFormModal from './AssessmentFormModal';

const DevelopmentAssessments = () => {
    const { toast } = useToast();
    const [assessments, setAssessments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [plans, setPlans] = useState([]);
    const [selectedPlanId, setSelectedPlanId] = useState(null);
    const [formModalOpen, setFormModalOpen] = useState(false);
    const [selectedAssessment, setSelectedAssessment] = useState(null);

    useEffect(() => {
        loadPlans();
    }, []);

    useEffect(() => {
        if (selectedPlanId) {
            loadAssessments();
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

    const loadAssessments = async () => {
        if (!selectedPlanId) {
            setAssessments([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('supplier_development_assessments')
                .select(`
                    *,
                    supplier_development_plans!plan_id(plan_name)
                `)
                .eq('plan_id', selectedPlanId)
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
                    <div className="flex items-center justify-between">
                        <CardTitle>Geliştirme Değerlendirmeleri</CardTitle>
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
                                setSelectedAssessment(null);
                                setFormModalOpen(true);
                            }}
                            disabled={!selectedPlanId}
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Yeni Değerlendirme
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
                    ) : assessments.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            Bu plan için henüz değerlendirme kaydı yok.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {assessments.map((assessment) => (
                                <div key={assessment.id} className="p-4 border rounded-lg">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <h4 className="font-semibold">{assessment.supplier_development_plans?.plan_name}</h4>
                                            <p className="text-sm text-muted-foreground">
                                                {new Date(assessment.assessment_date).toLocaleDateString('tr-TR')} | 
                                                Tip: {assessment.assessment_type} | 
                                                İyileşme: {assessment.improvement_percentage || 0}%
                                            </p>
                                            {assessment.assessment_notes && (
                                                <p className="text-sm mt-2">{assessment.assessment_notes}</p>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    setSelectedAssessment(assessment);
                                                    setFormModalOpen(true);
                                                }}
                                            >
                                                <Edit className="w-3 h-3" />
                                            </Button>
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={async () => {
                                                    if (confirm('Bu değerlendirmeyi silmek istediğinize emin misiniz?')) {
                                                        try {
                                                            const { error } = await supabase
                                                                .from('supplier_development_assessments')
                                                                .delete()
                                                                .eq('id', assessment.id);
                                                            if (error) throw error;
                                                            toast({
                                                                title: 'Başarılı',
                                                                description: 'Değerlendirme silindi.'
                                                            });
                                                            loadAssessments();
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
            <AssessmentFormModal
                open={formModalOpen}
                setOpen={setFormModalOpen}
                planId={selectedPlanId}
                existingAssessment={selectedAssessment}
                onSuccess={() => {
                    loadAssessments();
                    setSelectedAssessment(null);
                }}
            />
        </div>
    );
};

export default DevelopmentAssessments;

