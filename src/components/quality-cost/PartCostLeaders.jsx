import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { TrendingUp, Package } from 'lucide-react';
import { motion } from 'framer-motion';

const formatCurrency = (value) => {
    if (typeof value !== 'number') return '-';
    return value.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
};

const PartCostLeaders = ({ costs, onPartClick }) => {
    const topParts = useMemo(() => {
        if (!costs || costs.length === 0) return [];

        const partMap = {};
        
        costs.forEach(cost => {
            const partCode = cost.part_code || 'Bilinmeyen';
            if (!partMap[partCode]) {
                partMap[partCode] = {
                    partCode,
                    partName: cost.part_name || '-',
                    totalCost: 0,
                    count: 0,
                    costTypes: {},
                    costs: []
                };
            }
            
            partMap[partCode].totalCost += cost.amount || 0;
            partMap[partCode].count += 1;
            partMap[partCode].costs.push(cost);
            
            const costType = cost.cost_type || 'Diğer';
            partMap[partCode].costTypes[costType] = (partMap[partCode].costTypes[costType] || 0) + (cost.amount || 0);
        });

        return Object.values(partMap)
            .sort((a, b) => b.totalCost - a.totalCost)
            .slice(0, 10)
            .map((part, index) => ({
                ...part,
                rank: index + 1
            }));
    }, [costs]);

    const chartData = topParts.map(part => ({
        name: part.partCode.length > 15 ? part.partCode.substring(0, 15) + '...' : part.partCode,
        fullName: part.partCode,
        value: part.totalCost,
        count: part.count
    }));

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            const part = topParts.find(p => p.partCode === data.fullName);
            return (
                <div className="bg-background/95 backdrop-blur-sm p-3 border border-border rounded-lg shadow-lg">
                    <p className="font-semibold text-foreground mb-2">{part?.partCode}</p>
                    <p className="text-sm text-muted-foreground mb-1">{part?.partName}</p>
                    <p className="text-primary font-bold">{formatCurrency(data.value)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{data.count} maliyet kaydı</p>
                    {part && Object.keys(part.costTypes).length > 0 && (
                        <div className="mt-2 pt-2 border-t border-border">
                            <p className="text-xs font-semibold mb-1">Maliyet Türleri:</p>
                            {Object.entries(part.costTypes)
                                .sort((a, b) => b[1] - a[1])
                                .slice(0, 3)
                                .map(([type, amount]) => (
                                    <p key={type} className="text-xs text-muted-foreground">
                                        {type}: {formatCurrency(amount)}
                                    </p>
                                ))}
                        </div>
                    )}
                </div>
            );
        }
        return null;
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" />
                    Parça Bazlı Maliyet Liderleri (Top 10)
                </CardTitle>
                <CardDescription>
                    En yüksek kalitesizlik maliyeti oluşturan parça kodları
                </CardDescription>
            </CardHeader>
            <CardContent>
                {topParts.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        Parça bazlı maliyet verisi bulunamadı.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Grafik */}
                        <div className="h-[400px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 120, bottom: 5 }}>
                                    <XAxis 
                                        type="number" 
                                        tickFormatter={formatCurrency}
                                        stroke="hsl(var(--muted-foreground))"
                                    />
                                    <YAxis
                                        type="category"
                                        dataKey="name"
                                        stroke="hsl(var(--muted-foreground))"
                                        fontSize={12}
                                        width={120}
                                    />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar 
                                        dataKey="value" 
                                        name="Toplam Maliyet"
                                        radius={[0, 4, 4, 0]}
                                        onClick={(data) => {
                                            const part = topParts.find(p => p.partCode === data.fullName);
                                            if (part && onPartClick) {
                                                onPartClick(part);
                                            }
                                        }}
                                        className="cursor-pointer"
                                    >
                                        {chartData.map((entry, index) => (
                                            <Cell 
                                                key={`cell-${index}`} 
                                                fill={`hsl(${220 + index * 10}, 70%, ${60 - index * 3}%)`}
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Detaylı Liste */}
                        <div className="space-y-2">
                            <h4 className="font-semibold text-sm mb-3">Detaylı Liste</h4>
                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                {topParts.map((part, index) => (
                                    <motion.div
                                        key={part.partCode}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted transition-colors cursor-pointer"
                                        onClick={() => onPartClick && onPartClick(part)}
                                    >
                                        <div className="flex items-center gap-3 flex-1">
                                            <Badge variant="outline" className="font-mono min-w-[40px]">
                                                #{part.rank}
                                            </Badge>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-sm truncate">{part.partCode}</p>
                                                {part.partName && part.partName !== '-' && (
                                                    <p className="text-xs text-muted-foreground truncate">{part.partName}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <p className="font-bold text-primary">{formatCurrency(part.totalCost)}</p>
                                                <p className="text-xs text-muted-foreground">{part.count} kayıt</p>
                                            </div>
                                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
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

export default PartCostLeaders;

