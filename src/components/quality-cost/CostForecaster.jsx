import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { Brain, TrendingUp, AlertCircle } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth } from 'date-fns';
import { tr } from 'date-fns/locale';

const CostForecaster = ({ costs }) => {
    const predictionData = useMemo(() => {
        if (!costs || costs.length < 3) return null;

        // 1. Veriyi Aylık Olarak Grupla
        const monthlyCosts = {};
        const now = new Date();
        const sixMonthsAgo = subMonths(now, 6);

        costs.forEach(cost => {
            const date = new Date(cost.cost_date);
            if (date >= sixMonthsAgo && date <= now) {
                const key = format(date, 'yyyy-MM');
                monthlyCosts[key] = (monthlyCosts[key] || 0) + (cost.amount || 0);
            }
        });

        // Veri noktalarını oluştur (X: Ay indeksi, Y: Tutar)
        // Son 6 ayın verilerini sıralı diziye çevir
        const dataPoints = [];
        for (let i = 5; i >= 0; i--) {
            const d = subMonths(now, i);
            const key = format(d, 'yyyy-MM');
            dataPoints.push({
                index: 5 - i, // 0'dan 5'e
                date: key,
                label: format(d, 'MMM', { locale: tr }),
                actual: monthlyCosts[key] || 0,
                isPrediction: false
            });
        }

        // 2. Lineer Regresyon (En Küçük Kareler Yöntemi)
        const n = dataPoints.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

        dataPoints.forEach(point => {
            sumX += point.index;
            sumY += point.actual;
            sumXY += point.index * point.actual;
            sumXX += point.index * point.index;
        });

        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;

        // 3. Gelecek 3 Ayı Tahmin Et
        const futurePoints = [];
        for (let i = 1; i <= 3; i++) {
            const nextIndex = dataPoints.length - 1 + i;
            const predictedValue = slope * nextIndex + intercept;
            const nextDate = addMonths(now, i);

            futurePoints.push({
                index: nextIndex,
                date: format(nextDate, 'yyyy-MM'),
                label: format(nextDate, 'MMM', { locale: tr }),
                predicted: Math.max(0, predictedValue), // Negatif tahmin olamaz
                isPrediction: true
            });
        }

        // Grafik verisini birleştir
        // Mevcut verilerde 'actual' var, 'predicted' null (ya da çizgi sürekliliği için son noktada birleşebilir)
        const chartData = [
            ...dataPoints.map(p => ({ ...p, predicted: null })),
            // Son gerçek noktayı tahmin çizgisinin başlangıcı olarak ekleyebiliriz (opsiyonel, grafik kopukluğu olmasın diye)
            // Ancak Recharts'ta connectNulls={true} kullanarak bunu aşabiliriz.
            ...futurePoints
        ];

        // Trend analizi
        const trend = slope > 0 ? 'increasing' : 'decreasing';
        const trendPercentage = (slope / (intercept || 1)) * 100;

        return {
            chartData,
            trend,
            trendPercentage: Math.abs(trendPercentage).toFixed(1),
            nextMonthPrediction: futurePoints[0].predicted
        };
    }, [costs]);

    if (!predictionData) {
        return (
            <Card className="h-full">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Brain className="w-5 h-5 text-purple-500" />
                        AI Maliyet Tahmini
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center h-[300px] text-muted-foreground">
                    <div className="text-center">
                        <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-50" />
                        <p>Tahminleme yapabilmek için en az 3 aylık veri gereklidir.</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="h-full">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Brain className="w-5 h-5 text-purple-600" />
                            AI Maliyet Öngörüsü
                        </CardTitle>
                        <CardDescription>
                            Lineer regresyon modeli ile gelecek 3 ayın maliyet tahmini.
                        </CardDescription>
                    </div>
                    <div className="text-right">
                        <p className="text-sm font-medium text-muted-foreground">Gelecek Ay Tahmini</p>
                        <p className="text-2xl font-bold text-purple-600">
                            {predictionData.nextMonthPrediction.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                        </p>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={predictionData.chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                            <XAxis
                                dataKey="label"
                                stroke="#888888"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                stroke="#888888"
                                fontSize={12}
                                tickFormatter={(value) => `${(value / 1000).toFixed(0)}k₺`}
                                tickLine={false}
                                axisLine={false}
                            />
                            <Tooltip
                                formatter={(value) => value.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            />
                            <Legend />
                            <ReferenceLine x={predictionData.chartData[5].label} stroke="red" strokeDasharray="3 3" label="Bugün" />
                            <Line
                                type="monotone"
                                dataKey="actual"
                                name="Gerçekleşen"
                                stroke="#2563eb"
                                strokeWidth={3}
                                dot={{ r: 4, fill: "#2563eb" }}
                                activeDot={{ r: 6 }}
                                connectNulls
                            />
                            <Line
                                type="monotone"
                                dataKey="predicted"
                                name="AI Tahmini"
                                stroke="#9333ea"
                                strokeWidth={3}
                                strokeDasharray="5 5"
                                dot={{ r: 4, fill: "#9333ea" }}
                                connectNulls
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
                <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground bg-secondary/50 p-3 rounded-lg">
                    <TrendingUp className="w-4 h-4" />
                    <span>
                        Trend Analizi: Maliyetlerin önümüzdeki dönemde
                        <span className={predictionData.trend === 'increasing' ? 'text-red-500 font-bold mx-1' : 'text-green-500 font-bold mx-1'}>
                            {predictionData.trend === 'increasing' ? 'artması' : 'azalması'}
                        </span>
                        bekleniyor. (Tahmini eğilim: %{predictionData.trendPercentage})
                    </span>
                </div>
            </CardContent>
        </Card>
    );
};

export default CostForecaster;
