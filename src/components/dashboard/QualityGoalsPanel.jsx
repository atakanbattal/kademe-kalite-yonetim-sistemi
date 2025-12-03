import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Target, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { supabase } from '@/lib/customSupabaseClient';
import { useEffect } from 'react';

const QualityGoalsPanel = () => {
    const { nonConformities, qualityCosts, loading } = useData();
    const [qualityGoals, setQualityGoals] = useState([]);

    useEffect(() => {
        const fetchQualityGoals = async () => {
            try {
                const { data, error } = await supabase
                    .from('quality_goals')
                    .select('*')
                    .eq('year', new Date().getFullYear())
                    .order('created_at', { ascending: false });

                if (error) throw error;
                setQualityGoals(data || []);
            } catch (error) {
                console.error('Kalite hedefleri yüklenemedi:', error);
            }
        };

        fetchQualityGoals();
    }, []);

    // Hedef vs gerçekleşen hesaplama
    const goalsWithProgress = useMemo(() => {
        const currentYear = new Date().getFullYear();
        const firstDayOfYear = new Date(currentYear, 0, 1);
        const today = new Date();

        return qualityGoals.map(goal => {
            let actual = 0;
            let target = goal.target_value || 0;

            // Hedef tipine göre gerçekleşen değeri hesapla
            switch (goal.goal_type) {
                case 'DF_COUNT':
                    actual = (nonConformities || []).filter(nc => {
                        const ncDate = new Date(nc.opening_date || nc.created_at);
                        return nc.type === 'DF' && ncDate >= firstDayOfYear && ncDate <= today;
                    }).length;
                    break;
                case '8D_COUNT':
                    actual = (nonConformities || []).filter(nc => {
                        const ncDate = new Date(nc.opening_date || nc.created_at);
                        return nc.type === '8D' && ncDate >= firstDayOfYear && ncDate <= today;
                    }).length;
                    break;
                case 'QUALITY_COST':
                    actual = (qualityCosts || []).filter(cost => {
                        const costDate = new Date(cost.cost_date);
                        return costDate >= firstDayOfYear && costDate <= today;
                    }).reduce((sum, c) => sum + (c.amount || 0), 0);
                    break;
                case 'NC_CLOSURE_RATE':
                    const totalNCs = (nonConformities || []).filter(nc => {
                        const ncDate = new Date(nc.opening_date || nc.created_at);
                        return ncDate >= firstDayOfYear && ncDate <= today;
                    }).length;
                    const closedNCs = (nonConformities || []).filter(nc => {
                        const ncDate = new Date(nc.opening_date || nc.created_at);
                        return nc.status === 'Kapatıldı' && ncDate >= firstDayOfYear && ncDate <= today;
                    }).length;
                    actual = totalNCs > 0 ? (closedNCs / totalNCs * 100) : 0;
                    break;
                default:
                    actual = 0;
            }

            // Yön kontrolü
            const isIncrease = goal.target_direction === 'increase';
            const isAchieved = isIncrease ? actual >= target : actual <= target;
            const progress = target > 0 ? Math.min((actual / target * 100), 100) : 0;
            const deviation = isIncrease 
                ? ((actual - target) / target * 100)
                : ((target - actual) / target * 100);

            return {
                ...goal,
                actual,
                target,
                isAchieved,
                progress: Math.max(0, Math.min(progress, 100)),
                deviation,
                status: isAchieved ? 'success' : progress >= 75 ? 'warning' : 'danger'
            };
        });
    }, [qualityGoals, nonConformities, qualityCosts]);

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Target className="h-5 w-5" />
                        Kalite Hedefleri
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8 text-muted-foreground">Yükleniyor...</div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Kalite Hedefleri - {new Date().getFullYear()}
                    <Badge variant="outline" className="ml-2">
                        {goalsWithProgress.filter(g => g.isAchieved).length} / {goalsWithProgress.length} Başarılı
                    </Badge>
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                    ISO 9001:2015 Madde 6.2 - Kalite Hedefleri ve Gerçekleşenler
                </p>
            </CardHeader>
            <CardContent>
                {goalsWithProgress.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Bu yıl için kalite hedefi tanımlanmamış.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {goalsWithProgress.map((goal, idx) => (
                            <div 
                                key={idx}
                                className={`p-4 rounded-lg border-2 ${
                                    goal.status === 'success' ? 'border-green-500 bg-green-50 dark:bg-green-950/20' :
                                    goal.status === 'warning' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20' :
                                    'border-red-500 bg-red-50 dark:bg-red-950/20'
                                }`}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        {goal.status === 'success' ? (
                                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                                        ) : goal.status === 'warning' ? (
                                            <AlertCircle className="h-5 w-5 text-yellow-600" />
                                        ) : (
                                            <XCircle className="h-5 w-5 text-red-600" />
                                        )}
                                        <h4 className="font-semibold">{goal.goal_name || 'Hedef'}</h4>
                                    </div>
                                    <Badge 
                                        variant={
                                            goal.status === 'success' ? 'default' :
                                            goal.status === 'warning' ? 'secondary' :
                                            'destructive'
                                        }
                                    >
                                        {goal.isAchieved ? 'Başarılı' : goal.status === 'warning' ? 'Risk' : 'Başarısız'}
                                    </Badge>
                                </div>
                                
                                <div className="grid grid-cols-3 gap-4 mb-2">
                                    <div>
                                        <p className="text-xs text-muted-foreground">Hedef</p>
                                        <p className="font-bold">{goal.target.toLocaleString('tr-TR')}{goal.unit || ''}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Gerçekleşen</p>
                                        <p className="font-bold">{goal.actual.toLocaleString('tr-TR')}{goal.unit || ''}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">İlerleme</p>
                                        <p className="font-bold">{goal.progress.toFixed(1)}%</p>
                                    </div>
                                </div>

                                <Progress value={goal.progress} className="h-2" />
                                
                                {goal.deviation !== 0 && (
                                    <p className={`text-xs mt-2 ${
                                        goal.isAchieved ? 'text-green-600' : 'text-red-600'
                                    }`}>
                                        {goal.isAchieved ? '+' : '-'}{Math.abs(goal.deviation).toFixed(1)}% sapma
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default QualityGoalsPanel;

