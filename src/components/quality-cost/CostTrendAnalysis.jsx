import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid, AreaChart, Area } from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';

const formatCurrency = (value) => {
    if (typeof value !== 'number') return '-';
    return value.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
};

const CostTrendAnalysis = ({ costs, period = '6months' }) => {
    const [selectedPeriod, setSelectedPeriod] = React.useState(period);

    const trendData = useMemo(() => {
        if (!costs || costs.length === 0) return { monthly: [], trend: 'stable', changePercent: 0 };

        const now = new Date();
        const months = [];
        const monthMap = {};

        // Seçilen periyoda göre ay sayısını belirle
        const monthCount = selectedPeriod === '6months' ? 6 : 12;
        
        // Son N ay için boş veri oluştur
        for (let i = monthCount - 1; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            monthMap[monthKey] = {
                month: date.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }),
                monthKey,
                totalCost: 0,
                internalCost: 0,
                externalCost: 0,
                appraisalCost: 0,
                preventionCost: 0,
                count: 0
            };
            months.push(monthKey);
        }

        // Maliyetleri aylara göre grupla
        costs.forEach(cost => {
            if (!cost.cost_date) return;
            
            const costDate = new Date(cost.cost_date);
            const monthKey = `${costDate.getFullYear()}-${String(costDate.getMonth() + 1).padStart(2, '0')}`;
            
            if (monthMap[monthKey]) {
                monthMap[monthKey].totalCost += cost.amount || 0;
                monthMap[monthKey].count += 1;

                const costType = cost.cost_type || '';
                const isSupplierCost = cost.is_supplier_nc && cost.supplier_id;
                
                // External Failure - SADECE müşteride tespit edilen hatalar
                if (['Garanti Maliyeti', 'İade Maliyeti', 'Şikayet Maliyeti', 'Dış Hata Maliyeti', 'Geri Çağırma Maliyeti', 'Müşteri Kaybı Maliyeti', 'Müşteri Reklaması'].some(t => costType.includes(t))) {
                    monthMap[monthKey].externalCost += cost.amount || 0;
                }
                // Internal Failure - Fabrika içinde tespit edilen hatalar (tedarikçi kaynaklı dahil)
                else if (['Hurda Maliyeti', 'Yeniden İşlem Maliyeti', 'Fire Maliyeti', 'İç Kalite Kontrol Maliyeti', 'Final Hataları Maliyeti', 'İç Hata Maliyeti', 'Tedarikçi Hata Maliyeti'].some(t => costType.includes(t)) || isSupplierCost) {
                    monthMap[monthKey].internalCost += cost.amount || 0;
                }
                // Appraisal
                else if (['Girdi Kalite Kontrol Maliyeti', 'Üretim Kalite Kontrol Maliyeti', 'Test ve Ölçüm Maliyeti', 'Kalite Kontrol Maliyeti'].some(t => costType.includes(t))) {
                    monthMap[monthKey].appraisalCost += cost.amount || 0;
                }
                // Prevention
                else if (['Eğitim Maliyeti', 'Kalite Planlama Maliyeti', 'Tedarikçi Değerlendirme Maliyeti', 'İyileştirme Projeleri Maliyeti', 'Kalite Sistem Maliyeti'].some(t => costType.includes(t))) {
                    monthMap[monthKey].preventionCost += cost.amount || 0;
                }
            }
        });

        const monthlyData = months.map(key => monthMap[key]);

        // Trend hesaplama (son 3 ay vs önceki 3 ay)
        const recentMonths = monthlyData.slice(-3);
        const previousMonths = monthlyData.slice(-6, -3);
        
        const recentAvg = recentMonths.reduce((sum, m) => sum + m.totalCost, 0) / recentMonths.length;
        const previousAvg = previousMonths.length > 0 
            ? previousMonths.reduce((sum, m) => sum + m.totalCost, 0) / previousMonths.length 
            : recentAvg;

        const changePercent = previousAvg > 0 
            ? ((recentAvg - previousAvg) / previousAvg) * 100 
            : 0;

        let trend = 'stable';
        if (changePercent > 5) trend = 'increasing';
        else if (changePercent < -5) trend = 'decreasing';

        return {
            monthly: monthlyData,
            trend,
            changePercent: Math.abs(changePercent),
            recentAvg,
            previousAvg
        };
    }, [costs, selectedPeriod]);

    const TrendIcon = () => {
        if (trendData.trend === 'increasing') {
            return <TrendingUp className="h-5 w-5 text-red-500" />;
        } else if (trendData.trend === 'decreasing') {
            return <TrendingDown className="h-5 w-5 text-green-500" />;
        }
        return <Minus className="h-5 w-5 text-yellow-500" />;
    };

    const TrendBadge = () => {
        if (trendData.trend === 'increasing') {
            return <Badge variant="destructive">Artış: %{trendData.changePercent.toFixed(1)}</Badge>;
        } else if (trendData.trend === 'decreasing') {
            return <Badge className="bg-green-500">Azalış: %{trendData.changePercent.toFixed(1)}</Badge>;
        }
        return <Badge variant="secondary">Stabil: %{trendData.changePercent.toFixed(1)}</Badge>;
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            Trend Analizi
                            <TrendIcon />
                            <TrendBadge />
                        </CardTitle>
                        <CardDescription>
                            Aylık kalitesizlik maliyeti trend analizi ve değişim oranları
                        </CardDescription>
                    </div>
                    <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                        <SelectTrigger className="w-[150px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="6months">Son 6 Ay</SelectItem>
                            <SelectItem value="12months">Son 12 Ay</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent>
                {trendData.monthly.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        Trend verisi bulunamadı.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Trend Grafiği */}
                        <div className="h-[400px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={trendData.monthly}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis 
                                        dataKey="month" 
                                        tick={{ fontSize: 12 }}
                                        angle={-45}
                                        textAnchor="end"
                                        height={80}
                                    />
                                    <YAxis tickFormatter={formatCurrency} />
                                    <Tooltip 
                                        formatter={(value, name) => {
                                            if (name === 'totalCost') return [formatCurrency(value), 'Toplam Maliyet'];
                                            if (name === 'internalCost') return [formatCurrency(value), 'Internal Failure'];
                                            if (name === 'externalCost') return [formatCurrency(value), 'External Failure'];
                                            if (name === 'appraisalCost') return [formatCurrency(value), 'Appraisal'];
                                            if (name === 'preventionCost') return [formatCurrency(value), 'Prevention'];
                                            return [formatCurrency(value), name];
                                        }}
                                    />
                                    <Legend />
                                    <Area 
                                        type="monotone" 
                                        dataKey="totalCost" 
                                        stroke="#8884d8" 
                                        fill="#8884d8" 
                                        fillOpacity={0.6}
                                        name="Toplam Maliyet"
                                    />
                                    <Area 
                                        type="monotone" 
                                        dataKey="internalCost" 
                                        stroke="#82ca9d" 
                                        fill="#82ca9d" 
                                        fillOpacity={0.4}
                                        name="Internal Failure"
                                    />
                                    <Area 
                                        type="monotone" 
                                        dataKey="externalCost" 
                                        stroke="#ffc658" 
                                        fill="#ffc658" 
                                        fillOpacity={0.4}
                                        name="External Failure"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Özet İstatistikler */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="p-4 bg-muted rounded-lg"
                            >
                                <p className="text-sm text-muted-foreground">Ortalama Aylık Maliyet</p>
                                <p className="text-2xl font-bold text-primary mt-1">
                                    {formatCurrency(trendData.recentAvg)}
                                </p>
                            </motion.div>
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                                className="p-4 bg-muted rounded-lg"
                            >
                                <p className="text-sm text-muted-foreground">Önceki Dönem Ortalaması</p>
                                <p className="text-2xl font-bold text-muted-foreground mt-1">
                                    {formatCurrency(trendData.previousAvg)}
                                </p>
                            </motion.div>
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="p-4 bg-muted rounded-lg"
                            >
                                <p className="text-sm text-muted-foreground">Değişim Oranı</p>
                                <p className={`text-2xl font-bold mt-1 ${
                                    trendData.trend === 'increasing' ? 'text-red-500' : 
                                    trendData.trend === 'decreasing' ? 'text-green-500' : 
                                    'text-yellow-500'
                                }`}>
                                    {trendData.changePercent > 0 ? '+' : ''}{trendData.changePercent.toFixed(1)}%
                                </p>
                            </motion.div>
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className="p-4 bg-muted rounded-lg"
                            >
                                <p className="text-sm text-muted-foreground">Toplam Kayıt</p>
                                <p className="text-2xl font-bold text-primary mt-1">
                                    {trendData.monthly.reduce((sum, m) => sum + m.count, 0)}
                                </p>
                            </motion.div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default CostTrendAnalysis;

