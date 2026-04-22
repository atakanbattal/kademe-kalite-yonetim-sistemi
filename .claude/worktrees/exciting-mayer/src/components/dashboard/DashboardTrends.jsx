import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { useData } from '@/contexts/DataContext';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { format, subMonths, startOfMonth, eachMonthOfInterval } from 'date-fns';
import { tr } from 'date-fns/locale';

const DashboardTrends = () => {
    const { nonConformities, qualityCosts, quarantineRecords, loading } = useData();

    // Son 6 ayın trend verileri
    const trends = useMemo(() => {
        const now = new Date();
        const sixMonthsAgo = subMonths(now, 5);
        const months = eachMonthOfInterval({ start: sixMonthsAgo, end: now });

        const dfTrend = months.map(month => {
            const monthStart = startOfMonth(month);
            const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
            
            const dfCount = (nonConformities || []).filter(nc => {
                const ncDate = new Date(nc.opening_date || nc.created_at);
                return nc.type === 'DF' && ncDate >= monthStart && ncDate <= monthEnd;
            }).length;

            return {
                month: format(month, 'MMM yyyy', { locale: tr }),
                df: dfCount
            };
        });

        const costTrend = months.map(month => {
            const monthStart = startOfMonth(month);
            const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
            
            const monthCost = (qualityCosts || []).filter(cost => {
                const costDate = new Date(cost.cost_date);
                return costDate >= monthStart && costDate <= monthEnd;
            }).reduce((sum, c) => sum + (c.amount || 0), 0);

            return {
                month: format(month, 'MMM yyyy', { locale: tr }),
                cost: monthCost
            };
        });

        const quarantineTrend = months.map(month => {
            const monthStart = startOfMonth(month);
            const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
            
            const quarantineCount = (quarantineRecords || []).filter(q => {
                const qDate = new Date(q.created_at || q.quarantine_date);
                return qDate >= monthStart && qDate <= monthEnd;
            }).length;

            return {
                month: format(month, 'MMM yyyy', { locale: tr }),
                quarantine: quarantineCount
            };
        });

        // Trend yönü hesaplama
        const calculateTrend = (values) => {
            if (values.length < 2) return { direction: 'stable', percentage: 0 };
            const firstHalf = values.slice(0, Math.floor(values.length / 2));
            const secondHalf = values.slice(Math.floor(values.length / 2));
            const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
            const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
            if (firstAvg === 0) return { direction: 'stable', percentage: 0 };
            const percentage = ((secondAvg - firstAvg) / firstAvg * 100);
            return {
                direction: percentage > 5 ? 'up' : percentage < -5 ? 'down' : 'stable',
                percentage: Math.abs(percentage)
            };
        };

        const dfValues = dfTrend.map(t => t.df);
        const costValues = costTrend.map(t => t.cost);
        const quarantineValues = quarantineTrend.map(t => t.quarantine);

        return {
            dfTrend,
            costTrend,
            quarantineTrend,
            dfTrendDirection: calculateTrend(dfValues),
            costTrendDirection: calculateTrend(costValues),
            quarantineTrendDirection: calculateTrend(quarantineValues)
        };
    }, [nonConformities, qualityCosts, quarantineRecords]);

    const TrendIcon = ({ direction }) => {
        if (direction === 'up') return <TrendingUp className="h-4 w-4 text-red-500" />;
        if (direction === 'down') return <TrendingDown className="h-4 w-4 text-green-500" />;
        return <Minus className="h-4 w-4 text-gray-500" />;
    };

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Bu Ayın Trendleri</CardTitle>
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
                <CardTitle>Bu Ayın Trendleri (Son 6 Ay)</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-6">
                    {/* DF Trendi */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold flex items-center gap-2">
                                DF Trendi
                                <TrendIcon direction={trends.dfTrendDirection.direction} />
                            </h4>
                            <span className={`text-sm font-medium ${
                                trends.dfTrendDirection.direction === 'up' ? 'text-red-600' :
                                trends.dfTrendDirection.direction === 'down' ? 'text-green-600' :
                                'text-gray-600'
                            }`}>
                                {trends.dfTrendDirection.direction === 'up' ? '+' : 
                                 trends.dfTrendDirection.direction === 'down' ? '-' : '~'}
                                {trends.dfTrendDirection.percentage.toFixed(1)}%
                            </span>
                        </div>
                        <ResponsiveContainer width="100%" height={150}>
                            <LineChart data={trends.dfTrend}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} />
                                <Tooltip 
                                    contentStyle={{ 
                                        backgroundColor: 'hsl(var(--background))', 
                                        border: '1px solid hsl(var(--border))',
                                        borderRadius: '0.5rem'
                                    }}
                                />
                                <Line 
                                    type="monotone" 
                                    dataKey="df" 
                                    stroke="#ef4444" 
                                    strokeWidth={2}
                                    dot={{ r: 4 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Maliyet Trendi */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold flex items-center gap-2">
                                Maliyet Trendi
                                <TrendIcon direction={trends.costTrendDirection.direction} />
                            </h4>
                            <span className={`text-sm font-medium ${
                                trends.costTrendDirection.direction === 'up' ? 'text-red-600' :
                                trends.costTrendDirection.direction === 'down' ? 'text-green-600' :
                                'text-gray-600'
                            }`}>
                                {trends.costTrendDirection.direction === 'up' ? '+' : 
                                 trends.costTrendDirection.direction === 'down' ? '-' : '~'}
                                {trends.costTrendDirection.percentage.toFixed(1)}%
                            </span>
                        </div>
                        <ResponsiveContainer width="100%" height={150}>
                            <LineChart data={trends.costTrend}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} />
                                <Tooltip 
                                    contentStyle={{ 
                                        backgroundColor: 'hsl(var(--background))', 
                                        border: '1px solid hsl(var(--border))',
                                        borderRadius: '0.5rem'
                                    }}
                                    formatter={(value) => `${value.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}`}
                                />
                                <Line 
                                    type="monotone" 
                                    dataKey="cost" 
                                    stroke="#f97316" 
                                    strokeWidth={2}
                                    dot={{ r: 4 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Karantina Trendi */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold flex items-center gap-2">
                                Karantina Trendi
                                <TrendIcon direction={trends.quarantineTrendDirection.direction} />
                            </h4>
                            <span className={`text-sm font-medium ${
                                trends.quarantineTrendDirection.direction === 'up' ? 'text-red-600' :
                                trends.quarantineTrendDirection.direction === 'down' ? 'text-green-600' :
                                'text-gray-600'
                            }`}>
                                {trends.quarantineTrendDirection.direction === 'up' ? '+' : 
                                 trends.quarantineTrendDirection.direction === 'down' ? '-' : '~'}
                                {trends.quarantineTrendDirection.percentage.toFixed(1)}%
                            </span>
                        </div>
                        <ResponsiveContainer width="100%" height={150}>
                            <LineChart data={trends.quarantineTrend}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} />
                                <Tooltip 
                                    contentStyle={{ 
                                        backgroundColor: 'hsl(var(--background))', 
                                        border: '1px solid hsl(var(--border))',
                                        borderRadius: '0.5rem'
                                    }}
                                />
                                <Line 
                                    type="monotone" 
                                    dataKey="quarantine" 
                                    stroke="#8b5cf6" 
                                    strokeWidth={2}
                                    dot={{ r: 4 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default DashboardTrends;

