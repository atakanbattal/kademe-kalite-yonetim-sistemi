import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Award, TrendingUp, RefreshCw, FileText } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { motion } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

const SupplierEvaluationDisplay = ({ supplierId, supplierName }) => {
    const { toast } = useToast();
    const [evaluation, setEvaluation] = useState(null);
    const [loading, setLoading] = useState(false);
    const [year, setYear] = useState(new Date().getFullYear());
    const [isEvaluateModalOpen, setIsEvaluateModalOpen] = useState(false);
    const [evaluationNotes, setEvaluationNotes] = useState('');

    useEffect(() => {
        if (supplierId) {
            loadEvaluation();
        }
    }, [supplierId, year]);

    const loadEvaluation = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('supplier_evaluations')
                .select('*')
                .eq('supplier_id', supplierId)
                .eq('evaluation_year', year)
                .single();

            if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned

            setEvaluation(data);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Değerlendirme verileri yüklenemedi: ' + error.message
            });
        } finally {
            setLoading(false);
        }
    };

    const handleEvaluate = async () => {
        setLoading(true);
        try {
            // RPC fonksiyonu yoksa manuel değerlendirme yap
            let ppmValue = 0;
            let otdPercentage = 0;
            let auditScore = 0;
            
            // PPM verisi al
            try {
                const { data: inspections } = await supabase
                    .from('incoming_inspections')
                    .select('quantity_received, quantity_rejected, quantity_conditional, inspection_date')
                    .eq('supplier_id', supplierId);
                
                if (inspections && inspections.length > 0) {
                    const yearInspections = inspections.filter(i => 
                        new Date(i.inspection_date).getFullYear() === year
                    );
                    
                    let totalReceived = 0;
                    let totalDefective = 0;
                    yearInspections.forEach(i => {
                        totalReceived += (i.quantity_received || 0);
                        totalDefective += ((i.quantity_rejected || 0) + (i.quantity_conditional || 0));
                    });
                    
                    ppmValue = totalReceived > 0 ? (totalDefective / totalReceived) * 1000000 : 0;
                }
            } catch (ppmError) {
                console.warn('PPM hesaplanamadı:', ppmError.message);
            }
            
            // Audit verisi al
            try {
                const { data: audits } = await supabase
                    .from('supplier_audits')
                    .select('score, audit_date')
                    .eq('supplier_id', supplierId)
                    .eq('status', 'Tamamlandı');
                
                if (audits && audits.length > 0) {
                    const yearAudits = audits.filter(a => 
                        new Date(a.audit_date).getFullYear() === year
                    );
                    
                    if (yearAudits.length > 0) {
                        const totalScore = yearAudits.reduce((sum, a) => sum + (a.score || 0), 0);
                        auditScore = totalScore / yearAudits.length;
                    }
                }
            } catch (auditError) {
                console.warn('Audit skoru hesaplanamadı:', auditError.message);
            }
            
            // Genel skor hesapla (PPM: %40, OTD: %30, Audit: %30)
            // PPM skoru: 0 PPM = 100 puan, 1000+ PPM = 0 puan
            const ppmScore = Math.max(0, 100 - (ppmValue / 10));
            // OTD skoru: direkt yüzde
            const otdScore = otdPercentage;
            // Genel skor
            const overallScore = (ppmScore * 0.4) + (otdScore * 0.3) + (auditScore * 0.3);
            
            // Sınıf belirle
            let grade = 'D';
            if (overallScore >= 90) grade = 'A';
            else if (overallScore >= 75) grade = 'B';
            else if (overallScore >= 50) grade = 'C';
            
            // Değerlendirme kaydet
            const evaluationData = {
                supplier_id: supplierId,
                evaluation_year: year,
                evaluation_date: new Date().toISOString(),
                ppm_value: Math.round(ppmValue * 100) / 100,
                otd_percentage: Math.round(otdPercentage * 100) / 100,
                audit_score: Math.round(auditScore * 100) / 100,
                overall_score: Math.round(overallScore * 100) / 100,
                grade: grade,
                notes: evaluationNotes.trim() || null
            };
            
            // supplier_evaluations tablosuna kaydet
            try {
                const { error: upsertError } = await supabase
                    .from('supplier_evaluations')
                    .upsert(evaluationData, { 
                        onConflict: 'supplier_id,evaluation_year',
                        ignoreDuplicates: false 
                    });
                
                if (upsertError) throw upsertError;
            } catch (tableError) {
                // Tablo yoksa hata ver
                throw new Error('Değerlendirme tablosu mevcut değil veya erişim hatası: ' + tableError.message);
            }

            toast({
                title: 'Başarılı',
                description: 'Tedarikçi değerlendirmesi tamamlandı.'
            });

            setIsEvaluateModalOpen(false);
            setEvaluationNotes('');
            await loadEvaluation();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Değerlendirme yapılamadı: ' + error.message
            });
        } finally {
            setLoading(false);
        }
    };

    const getGradeColor = (grade) => {
        switch (grade) {
            case 'A': return 'bg-green-500';
            case 'B': return 'bg-blue-500';
            case 'C': return 'bg-yellow-500';
            case 'D': return 'bg-red-500';
            default: return 'bg-gray-500';
        }
    };

    const getGradeLabel = (grade) => {
        switch (grade) {
            case 'A': return 'A Sınıfı (Stratejik)';
            case 'B': return 'B Sınıfı (Güvenilir)';
            case 'C': return 'C Sınıfı (İzlenecek)';
            case 'D': return 'D Sınıfı (Riskli)';
            default: return 'Değerlendirilmedi';
        }
    };

    if (loading && !evaluation) {
        return (
            <Card>
                <CardContent className="p-6">
                    <div className="text-center text-muted-foreground">Yükleniyor...</div>
                </CardContent>
            </Card>
        );
    }

    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Award className="h-5 w-5 text-primary" />
                                Yıllık Değerlendirme
                            </CardTitle>
                            <CardDescription>
                                {supplierName} - {year} Yılı Değerlendirme Sonuçları
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
                                <SelectTrigger className="w-[100px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Array.from({ length: 5 }, (_, i) => {
                                        const y = new Date().getFullYear() - i;
                                        return <SelectItem key={y} value={y.toString()}>{y}</SelectItem>;
                                    })}
                                </SelectContent>
                            </Select>
                            <Button onClick={() => setIsEvaluateModalOpen(true)} size="sm">
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Değerlendir
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {evaluation ? (
                        <>
                            {/* Genel Skor */}
                            <div className="p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border-2 border-primary/20">
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Genel Skor</p>
                                        <p className="text-3xl font-bold text-primary mt-1">
                                            {evaluation.overall_score.toFixed(1)} / 100
                                        </p>
                                    </div>
                                    <Badge className={`${getGradeColor(evaluation.grade)} text-white text-lg px-4 py-2`}>
                                        {evaluation.grade}
                                    </Badge>
                                </div>
                                <Progress value={evaluation.overall_score} className="h-2" />
                                <p className="text-xs text-muted-foreground mt-2">
                                    {getGradeLabel(evaluation.grade)}
                                </p>
                            </div>

                            {/* Detaylı Skorlar */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="p-3 bg-muted rounded-lg"
                                >
                                    <p className="text-xs text-muted-foreground mb-1">PPM Skoru</p>
                                    <p className="text-xl font-bold">{evaluation.ppm_value.toLocaleString('tr-TR')} PPM</p>
                                    <Progress 
                                        value={evaluation.ppm_value < 100 ? 100 : evaluation.ppm_value < 500 ? 80 : 50} 
                                        className="h-1 mt-2"
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">Ağırlık: %40</p>
                                </motion.div>

                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.1 }}
                                    className="p-3 bg-muted rounded-lg"
                                >
                                    <p className="text-xs text-muted-foreground mb-1">OTD% Skoru</p>
                                    <p className="text-xl font-bold">{evaluation.otd_percentage.toFixed(2)}%</p>
                                    <Progress value={evaluation.otd_percentage} className="h-1 mt-2" />
                                    <p className="text-xs text-muted-foreground mt-1">Ağırlık: %30</p>
                                </motion.div>

                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                    className="p-3 bg-muted rounded-lg"
                                >
                                    <p className="text-xs text-muted-foreground mb-1">Audit Skoru</p>
                                    <p className="text-xl font-bold">{evaluation.audit_score.toFixed(1)} / 100</p>
                                    <Progress value={evaluation.audit_score} className="h-1 mt-2" />
                                    <p className="text-xs text-muted-foreground mt-1">Ağırlık: %30</p>
                                </motion.div>
                            </div>

                            {/* Notlar */}
                            {evaluation.notes && (
                                <div className="p-3 bg-muted rounded-lg">
                                    <p className="text-xs font-semibold text-muted-foreground mb-1">Değerlendirme Notları</p>
                                    <p className="text-sm">{evaluation.notes}</p>
                                </div>
                            )}

                            {/* Değerlendirme Tarihi */}
                            <div className="text-xs text-muted-foreground">
                                Değerlendirme Tarihi: {new Date(evaluation.evaluation_date).toLocaleDateString('tr-TR')}
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            <p className="mb-4">Bu yıl için değerlendirme yapılmamış.</p>
                            <Button onClick={() => setIsEvaluateModalOpen(true)}>
                                <Award className="h-4 w-4 mr-2" />
                                Değerlendirme Yap
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Değerlendirme Modal */}
            <Dialog open={isEvaluateModalOpen} onOpenChange={setIsEvaluateModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Tedarikçi Değerlendirmesi</DialogTitle>
                        <DialogDescription>
                            {supplierName} için {year} yılı otomatik değerlendirme yapılacak.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>Değerlendirme Notları (Opsiyonel)</Label>
                            <Textarea
                                value={evaluationNotes}
                                onChange={(e) => setEvaluationNotes(e.target.value)}
                                placeholder="Değerlendirme hakkında notlarınızı ekleyin..."
                                rows={4}
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setIsEvaluateModalOpen(false)}>
                                İptal
                            </Button>
                            <Button onClick={handleEvaluate} disabled={loading}>
                                {loading ? 'Değerlendiriliyor...' : 'Değerlendir'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default SupplierEvaluationDisplay;

