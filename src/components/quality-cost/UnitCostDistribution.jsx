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

        const addToUnit = (unit, amount, costType, isSupplierCost) => {
            const u = unit || 'Belirtilmemiş';
            if (!unitMap[u]) {
                unitMap[u] = { unit: u, totalCost: 0, count: 0, internalCost: 0, externalCost: 0, appraisalCost: 0, preventionCost: 0 };
            }
            unitMap[u].totalCost += amount;
            unitMap[u].count += 1;
            if (['Garanti Maliyeti', 'İade Maliyeti', 'Şikayet Maliyeti', 'Dış Hata Maliyeti', 'Geri Çağırma Maliyeti', 'Müşteri Kaybı Maliyeti', 'Müşteri Reklaması'].some(t => costType.includes(t))) {
                unitMap[u].externalCost += amount;
            } else if (['Hurda Maliyeti', 'Yeniden İşlem Maliyeti', 'Fire Maliyeti', 'İç Kalite Kontrol Maliyeti', 'Final Hataları Maliyeti', 'İç Hata Maliyeti', 'Tedarikçi Hata Maliyeti'].some(t => costType.includes(t)) || isSupplierCost) {
                unitMap[u].internalCost += amount;
            } else if (['Girdi Kalite Kontrol Maliyeti', 'Üretim Kalite Kontrol Maliyeti', 'Test ve Ölçüm Maliyeti', 'Kalite Kontrol Maliyeti'].some(t => costType.includes(t))) {
                unitMap[u].appraisalCost += amount;
            } else if (['Eğitim Maliyeti', 'Kalite Planlama Maliyeti', 'Tedarikçi Değerlendirme Maliyeti', 'İyileştirme Projeleri Maliyeti', 'Kalite Sistem Maliyeti'].some(t => costType.includes(t))) {
                unitMap[u].preventionCost += amount;
            }
        };

        costs.forEach(cost => {
            const amount = cost.amount || 0;
            const costType = cost.cost_type || '';
            const isSupplierCost = cost.is_supplier_nc && cost.supplier_id;
            const lineItems = cost.cost_line_items && Array.isArray(cost.cost_line_items) ? cost.cost_line_items : [];
            const hasLineItems = lineItems.length > 0;

            if (hasLineItems) {
                lineItems.forEach(li => {
                    const itemAmount = parseFloat(li.amount) || 0;
                    if (itemAmount <= 0) return;
                    totalCost += itemAmount;
                    const unitKey = li.responsible_type === 'supplier'
                        ? `Tedarikçi: ${li.responsible_supplier_name || cost.supplier?.name || 'Bilinmeyen'}`
                        : (li.responsible_unit || 'Belirtilmemiş');
                    addToUnit(unitKey, itemAmount, costType, li.responsible_type === 'supplier');
                });
            } else {
                totalCost += amount;
                const allocs = cost.cost_allocations;
                if (allocs && Array.isArray(allocs) && allocs.length > 0) {
                    allocs.forEach(alloc => {
                        const allocAmount = alloc.amount ?? (amount * (alloc.percentage || 0) / 100);
                        addToUnit(alloc.unit, allocAmount, costType, isSupplierCost);
                    });
                } else {
                    addToUnit(cost.unit, amount, costType, isSupplierCost);
                }
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

    // Küçük dilimleri (< %3) "Diğer" kategorisine topla
    const pieData = useMemo(() => {
        const threshold = 3; // %3 altındaki dilimler
        const mainData = [];
        const otherData = { name: 'Diğer', value: 0, percentage: 0, count: 0 };
        
        distributionData.unitData.forEach(unit => {
            if (unit.percentage >= threshold) {
                mainData.push({
                    name: unit.unit,
                    value: unit.totalCost,
                    percentage: unit.percentage,
                    count: unit.count
                });
            } else {
                otherData.value += unit.totalCost;
                otherData.percentage += unit.percentage;
                otherData.count += unit.count;
            }
        });
        
        if (otherData.value > 0) {
            mainData.push(otherData);
        }
        
        return mainData.sort((a, b) => b.value - a.value);
    }, [distributionData.unitData]);

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
                    Kalite maliyetlerinin birimlere göre dağılımı ve analizi
                </CardDescription>
            </CardHeader>
            <CardContent>
                {distributionData.unitData.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        Birim bazında maliyet verisi bulunamadı.
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Pie Chart - Donut Chart olarak göster */}
                        <div className="h-[500px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={true}
                                        label={({ name, percentage }) => {
                                            // Sadece %5 üzerindeki dilimler için label göster
                                            if (percentage >= 5) {
                                                return `${name}\n${percentage.toFixed(1)}%`;
                                            }
                                            return '';
                                        }}
                                        outerRadius={140}
                                        innerRadius={60}
                                        fill="#8884d8"
                                        dataKey="value"
                                        paddingAngle={2}
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip 
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                const data = payload[0];
                                                return (
                                                    <div className="bg-background/95 backdrop-blur-sm p-3 border border-border rounded-lg shadow-lg">
                                                        <p className="font-semibold text-foreground">{data.name}</p>
                                                        <p className="text-primary font-bold">{formatCurrency(data.value)}</p>
                                                        <p className="text-xs text-muted-foreground mt-1">
                                                            {data.payload.percentage.toFixed(2)}% - {data.payload.count || 0} kayıt
                                                        </p>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Legend 
                                        verticalAlign="bottom" 
                                        height={36}
                                        formatter={(value, entry) => {
                                            const data = pieData.find(d => d.name === value);
                                            return `${value} (${data?.percentage.toFixed(1)}%)`;
                                        }}
                                    />
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
                                    <Bar dataKey="internalCost" fill="#82ca9d" name="İç Hata Maliyeti" />
                                    <Bar dataKey="externalCost" fill="#ffc658" name="Dış Hata Maliyeti" />
                                    <Bar dataKey="appraisalCost" fill="#ff8042" name="Değerlendirme Maliyeti" />
                                    <Bar dataKey="preventionCost" fill="#0088FE" name="Önleme Maliyeti" />
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

