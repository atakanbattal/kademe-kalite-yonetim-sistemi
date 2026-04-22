import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { useData } from '@/contexts/DataContext';
import { supabase } from '@/lib/customSupabaseClient';
import { TrendingUp, TrendingDown, Minus, Target } from 'lucide-react';
import { format, startOfMonth } from 'date-fns';
import { tr } from 'date-fns/locale';

const BenchmarkAnalysis = () => {
    const { nonConformities, qualityCosts, loading } = useData();
    const [benchmarks, setBenchmarks] = useState([]);

    useEffect(() => {
        const fetchBenchmarks = async () => {
            try {
                // Benchmark tablosu henüz oluşturulmamış olabilir
                // Bu özellik için veritabanı şeması oluşturulmalı
                console.warn('Benchmark tablosu henüz yapılandırılmamış');
                setBenchmarks([]);
            } catch (error) {
                console.warn('Benchmark verileri yüklenemedi:', error.message);
                setBenchmarks([]);
            }
        };

        fetchBenchmarks();
    }, []);

    // Mevcut değerleri hesapla
    const currentValues = useMemo(() => {
        const today = new Date();
        const firstDayOfMonth = startOfMonth(today);

        const dfCount = (nonConformities || []).filter(nc => {
            const ncDate = new Date(nc.opening_date || nc.created_at);
            return nc.type === 'DF' && ncDate >= firstDayOfMonth && nc.status !== 'Kapatıldı';
        }).length;

        const monthlyCost = (qualityCosts || []).filter(cost => {
            const costDate = new Date(cost.cost_date);
            return costDate >= firstDayOfMonth;
        }).reduce((sum, c) => sum + (c.amount || 0), 0);

        const totalNCs = (nonConformities || []).filter(nc => {
            const ncDate = new Date(nc.opening_date || nc.created_at);
            return ncDate >= firstDayOfMonth;
        }).length;

        const closedNCs = (nonConformities || []).filter(nc => {
            const ncDate = new Date(nc.opening_date || nc.created_at);
            return nc.status === 'Kapatıldı' && ncDate >= firstDayOfMonth;
        }).length;

        const closureRate = totalNCs > 0 ? (closedNCs / totalNCs * 100) : 0;

        return {
            DF_COUNT: dfCount,
            QUALITY_COST: monthlyCost,
            NC_CLOSURE_RATE: closureRate
        };
    }, [nonConformities, qualityCosts]);

    // Benchmark karşılaştırması
    const benchmarkComparison = useMemo(() => {
        return benchmarks.map(benchmark => {
            const current = currentValues[benchmark.metric_type] || 0;
            const industryAvg = benchmark.industry_average || 0;
            const bestInClass = benchmark.best_in_class || 0;

            let status = 'UNKNOWN';
            let trend = 'stable';
            let percentage = 0;

            if (benchmark.metric_type === 'NC_CLOSURE_RATE') {
                // Kapatma oranı için yüksek olan iyi
                if (current >= bestInClass) {
                    status = 'EXCELLENT';
                    trend = 'up';
                } else if (current >= industryAvg) {
                    status = 'GOOD';
                    trend = 'up';
                } else {
                    status = 'NEEDS_IMPROVEMENT';
                    trend = 'down';
                }
                percentage = industryAvg > 0 ? ((current - industryAvg) / industryAvg * 100) : 0;
            } else {
                // DF sayısı ve maliyet için düşük olan iyi
                if (current <= bestInClass) {
                    status = 'EXCELLENT';
                    trend = 'down';
                } else if (current <= industryAvg) {
                    status = 'GOOD';
                    trend = 'down';
                } else {
                    status = 'NEEDS_IMPROVEMENT';
                    trend = 'up';
                }
                percentage = industryAvg > 0 ? ((current - industryAvg) / industryAvg * 100) : 0;
            }

            return {
                ...benchmark,
                current,
                status,
                trend,
                percentage: Math.abs(percentage)
            };
        });
    }, [benchmarks, currentValues]);

    const chartData = benchmarkComparison.map(b => ({
        name: b.metric_type === 'DF_COUNT' ? 'DF Sayısı' :
              b.metric_type === 'QUALITY_COST' ? 'Maliyet' :
              'Kapatma Oranı',
        current: b.current,
        industryAvg: b.industry_average || 0,
        bestInClass: b.best_in_class || 0
    }));

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Target className="h-5 w-5" />
                        Benchmark Analizi
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
                    Benchmark Analizi
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                    Sektör ortalaması ve en iyi performans ile karşılaştırma
                </p>
            </CardHeader>
            <CardContent>
                {benchmarkComparison.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Benchmark verisi bulunamadı. Lütfen benchmark değerlerini girin.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Grafik */}
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 12 }} />
                                <Tooltip 
                                    contentStyle={{ 
                                        backgroundColor: 'hsl(var(--background))', 
                                        border: '1px solid hsl(var(--border))',
                                        borderRadius: '0.5rem'
                                    }}
                                />
                                <Bar dataKey="current" name="Bizim Değerimiz" radius={[4, 4, 0, 0]}>
                                    {chartData.map((entry, index) => (
                                        <Cell 
                                            key={`cell-${index}`} 
                                            fill={
                                                entry.current <= entry.bestInClass ? '#22c55e' :
                                                entry.current <= entry.industryAvg ? '#eab308' :
                                                '#ef4444'
                                            }
                                        />
                                    ))}
                                </Bar>
                                <Bar dataKey="industryAvg" name="Sektör Ortalaması" radius={[4, 4, 0, 0]} fill="#3b82f6" />
                                <Bar dataKey="bestInClass" name="En İyi Performans" radius={[4, 4, 0, 0]} fill="#10b981" />
                            </BarChart>
                        </ResponsiveContainer>

                        {/* Detay Tablosu */}
                        <div className="space-y-3">
                            {benchmarkComparison.map((benchmark, idx) => (
                                <div 
                                    key={idx}
                                    className={`p-4 rounded-lg border-2 ${
                                        benchmark.status === 'EXCELLENT' ? 'border-green-500 bg-green-50 dark:bg-green-950/20' :
                                        benchmark.status === 'GOOD' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20' :
                                        'border-red-500 bg-red-50 dark:bg-red-950/20'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            {benchmark.trend === 'up' && benchmark.status === 'EXCELLENT' ? (
                                                <TrendingUp className="h-4 w-4 text-green-600" />
                                            ) : benchmark.trend === 'down' && benchmark.status === 'EXCELLENT' ? (
                                                <TrendingDown className="h-4 w-4 text-green-600" />
                                            ) : (
                                                <Minus className="h-4 w-4 text-gray-600" />
                                            )}
                                            <h4 className="font-semibold">
                                                {benchmark.metric_type === 'DF_COUNT' ? 'DF Sayısı' :
                                                 benchmark.metric_type === 'QUALITY_COST' ? 'Kalite Maliyeti' :
                                                 'Uygunsuzluk Kapatma Oranı'}
                                            </h4>
                                        </div>
                                        <Badge 
                                            variant={
                                                benchmark.status === 'EXCELLENT' ? 'default' :
                                                benchmark.status === 'GOOD' ? 'secondary' :
                                                'destructive'
                                            }
                                        >
                                            {benchmark.status === 'EXCELLENT' ? 'Mükemmel' :
                                             benchmark.status === 'GOOD' ? 'İyi' :
                                             'İyileştirme Gerekli'}
                                        </Badge>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4 text-sm">
                                        <div>
                                            <p className="text-muted-foreground">Bizim Değerimiz</p>
                                            <p className="font-bold">
                                                {benchmark.metric_type === 'QUALITY_COST' 
                                                    ? `${benchmark.current.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}`
                                                    : benchmark.metric_type === 'NC_CLOSURE_RATE'
                                                    ? `${benchmark.current.toFixed(1)}%`
                                                    : benchmark.current}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Sektör Ortalaması</p>
                                            <p className="font-semibold">
                                                {benchmark.metric_type === 'QUALITY_COST'
                                                    ? `${(benchmark.industry_average || 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}`
                                                    : benchmark.metric_type === 'NC_CLOSURE_RATE'
                                                    ? `${(benchmark.industry_average || 0).toFixed(1)}%`
                                                    : benchmark.industry_average || 0}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">En İyi Performans</p>
                                            <p className="font-semibold text-green-600">
                                                {benchmark.metric_type === 'QUALITY_COST'
                                                    ? `${(benchmark.best_in_class || 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}`
                                                    : benchmark.metric_type === 'NC_CLOSURE_RATE'
                                                    ? `${(benchmark.best_in_class || 0).toFixed(1)}%`
                                                    : benchmark.best_in_class || 0}
                                            </p>
                                        </div>
                                    </div>
                                    {benchmark.percentage > 0 && (
                                        <p className={`text-xs mt-2 ${
                                            benchmark.status === 'EXCELLENT' ? 'text-green-600' :
                                            benchmark.status === 'GOOD' ? 'text-yellow-600' :
                                            'text-red-600'
                                        }`}>
                                            Sektör ortalamasından %{benchmark.percentage.toFixed(1)} 
                                            {benchmark.trend === 'up' ? ' yüksek' : ' düşük'}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default BenchmarkAnalysis;

