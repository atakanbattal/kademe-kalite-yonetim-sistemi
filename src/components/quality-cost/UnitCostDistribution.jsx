import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Building2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';

const formatCurrency = (value) => {
    if (typeof value !== 'number') return '-';
    return value.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7C7C'];

const UnitCostDistribution = ({ costs }) => {
    const distributionData = useMemo(() => {
        if (!costs || costs.length === 0) return { unitData: [], totalCost: 0 };

        const unitMap = {};
        let totalCost = 0;

        costs.forEach(cost => {
            const unit = cost.unit || 'Belirtilmemiş';
            if (!unitMap[unit]) {
                unitMap[unit] = {
                    unit,
                    totalCost: 0,
                    count: 0,
                    internalCost: 0,
                    externalCost: 0,
                    appraisalCost: 0,
                    preventionCost: 0
                };
            }

            unitMap[unit].totalCost += cost.amount || 0;
            unitMap[unit].count += 1;
            totalCost += cost.amount || 0;

            const costType = cost.cost_type || '';
            
            // Internal Failure
            if (['Hurda Maliyeti', 'Yeniden İşlem Maliyeti', 'Fire Maliyeti', 'İç Kalite Kontrol Maliyeti'].some(t => costType.includes(t))) {
                unitMap[unit].internalCost += cost.amount || 0;
            }
            // External Failure
            else if (['Garanti Maliyeti', 'İade Maliyeti', 'Şikayet Maliyeti', 'Dış Hata Maliyeti', 'Geri Çağırma Maliyeti', 'Müşteri Kaybı Maliyeti'].some(t => costType.includes(t))) {
                unitMap[unit].externalCost += cost.amount || 0;
            }
            // Appraisal
            else if (['Girdi Kalite Kontrol Maliyeti', 'Üretim Kalite Kontrol Maliyeti', 'Test ve Ölçüm Maliyeti', 'Kalite Kontrol Maliyeti'].some(t => costType.includes(t))) {
                unitMap[unit].appraisalCost += cost.amount || 0;
            }
            // Prevention
            else if (['Eğitim Maliyeti', 'Kalite Planlama Maliyeti', 'Tedarikçi Değerlendirme Maliyeti', 'İyileştirme Projeleri Maliyeti', 'Kalite Sistem Maliyeti'].some(t => costType.includes(t))) {
                unitMap[unit].preventionCost += cost.amount || 0;
            }
        });

        const unitData = Object.values(unitMap)
            .sort((a, b) => b.totalCost - a.totalCost)
            .map((unit, index) => ({
                ...unit,
                percentage: totalCost > 0 ? (unit.totalCost / totalCost) * 100 : 0,
                rank: index + 1
            }));

        return { unitData, totalCost };
    }, [costs]);

    const pieData = distributionData.unitData.map(unit => ({
        name: unit.unit,
        value: unit.totalCost,
        percentage: unit.percentage
    }));

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const data = payload[0];
            return (
                <div className="bg-background/95 backdrop-blur-sm p-3 border border-border rounded-lg shadow-lg">
                    <p className="font-semibold text-foreground">{data.name}</p>
                    <p className="text-primary font-bold">{formatCurrency(data.value)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                        {data.payload.percentage.toFixed(2)}% - {data.payload.count} kayıt
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    Birim Bazında Maliyet Dağılımı
                </CardTitle>
                <CardDescription>
                    Kalitesizlik maliyetlerinin birimlere göre dağılımı ve analizi
                </CardDescription>
            </CardHeader>
            <CardContent>
                {distributionData.unitData.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        Birim bazında maliyet verisi bulunamadı.
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Pie Chart */}
                        <div className="h-[400px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={({ name, percentage }) => `${name}: ${percentage.toFixed(1)}%`}
                                        outerRadius={120}
                                        fill="#8884d8"
                                        dataKey="value"
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Bar Chart */}
                        <div className="h-[400px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={distributionData.unitData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis 
                                        dataKey="unit" 
                                        angle={-45}
                                        textAnchor="end"
                                        height={100}
                                        tick={{ fontSize: 12 }}
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
                                    <Bar dataKey="totalCost" fill="#8884d8" name="Toplam Maliyet" />
                                    <Bar dataKey="internalCost" fill="#82ca9d" name="Internal Failure" />
                                    <Bar dataKey="externalCost" fill="#ffc658" name="External Failure" />
                                    <Bar dataKey="appraisalCost" fill="#ff8042" name="Appraisal" />
                                    <Bar dataKey="preventionCost" fill="#0088FE" name="Prevention" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Detaylı Liste */}
                        <div className="space-y-2">
                            <h4 className="font-semibold text-sm mb-3">Birim Detayları</h4>
                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                {distributionData.unitData.map((unit, index) => (
                                    <motion.div
                                        key={unit.unit}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted transition-colors"
                                    >
                                        <div className="flex items-center gap-3 flex-1">
                                            <Badge variant="outline" className="font-mono min-w-[40px]">
                                                #{unit.rank}
                                            </Badge>
                                            <div className="flex-1">
                                                <p className="font-semibold text-sm">{unit.unit}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {unit.count} kayıt - %{unit.percentage.toFixed(2)} pay
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <p className="font-bold text-primary">{formatCurrency(unit.totalCost)}</p>
                                                <div className="flex gap-2 text-xs text-muted-foreground">
                                                    <span>I: {formatCurrency(unit.internalCost)}</span>
                                                    <span>E: {formatCurrency(unit.externalCost)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default UnitCostDistribution;

