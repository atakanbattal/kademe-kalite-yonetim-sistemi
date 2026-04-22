import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, CartesianGrid, Legend, Brush, AreaChart, Area } from 'recharts';
import { motion } from 'framer-motion';
import { PIE_COLORS } from './constants';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Wallet, Calendar } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

const formatCurrency = (value) => {
    return value.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
};

const StatCard = ({ title, value, icon: Icon, onClick, loading }) => (
    <motion.div
        whileHover={{ y: -5 }}
        className="cursor-pointer"
        onClick={onClick}
    >
        <Card className="dashboard-widget hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                <Icon className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                {loading ? (
                    <Skeleton className="h-8 w-24" />
                ) : (
                    <div className="text-2xl font-bold text-primary">{formatCurrency(value)}</div>
                )}
            </CardContent>
        </Card>
    </motion.div>
);

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-background/95 backdrop-blur-sm p-3 border border-border rounded-lg shadow-xl">
                <p className="label font-bold text-foreground mb-1">{data.name || label}</p>
                {payload.map((entry, index) => (
                    <p key={index} style={{ color: entry.color }} className="text-sm">
                        {entry.name}: {formatCurrency(entry.value)}
                    </p>
                ))}
                {data.count !== undefined && (
                    <p className="text-sm text-muted-foreground mt-1">Adet: {data.count}</p>
                )}
            </div>
        );
    }
    return null;
};

const renderTop5Chart = (title, data, onBarClick) => (
    <Card className="dashboard-widget overflow-hidden">
        <CardHeader className="pb-2">
            <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent>
            {data && data.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                        <XAxis type="number" hide />
                        <YAxis
                            type="category"
                            dataKey="name"
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                            width={120}
                            tick={{ fill: 'hsl(var(--foreground))' }}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted)/0.3)' }} />
                        <Bar dataKey="value" name="Tutar" radius={[0, 4, 4, 0]} onClick={onBarClick} className="cursor-pointer">
                            {data.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">Veri bulunmuyor</div>
            )}
        </CardContent>
    </Card>
);

const CostAnalytics = ({ costs, loading, onBarClick }) => {
    const [trendChartType, setTrendChartType] = useState('area'); // area, line, bar

    const analyticsData = useMemo(() => {
        if (!costs || costs.length === 0) {
            return {
                parts: [], units: [], costTypes: [], vehicleTypes: [],
                totalCost: 0, internalCost: 0, externalCost: 0,
                internalCosts: [], externalCosts: [],
                monthlyTrend: []
            };
        }

        const internalCostTypes = [
            'Hurda Maliyeti', 'Yeniden İşlem Maliyeti', 'Fire Maliyeti',
            'İç Kalite Kontrol Maliyeti', 'Final Hataları Maliyeti', 'İç Hata Maliyeti', 'Tedarikçi Hata Maliyeti'
        ];

        const externalCostTypes = [
            'Garanti Maliyeti', 'İade Maliyeti', 'Şikayet Maliyeti',
            'Dış Hata Maliyeti', 'Müşteri Reklaması'
        ];

        let totalCost = 0;
        let internalCost = 0;
        let externalCost = 0;
        const internalCosts = [];
        const externalCosts = [];

        // Aylık Trend Hesabı
        const monthlyGroups = {};

        costs.forEach(cost => {
            totalCost += cost.amount;

            if (externalCostTypes.includes(cost.cost_type)) {
                externalCost += cost.amount;
                externalCosts.push(cost);
            } else if (internalCostTypes.includes(cost.cost_type) || (cost.is_supplier_nc && cost.supplier_id)) {
                internalCost += cost.amount;
                internalCosts.push(cost);
            }

            // Aylık gruplama
            const date = new Date(cost.cost_date);
            const monthKey = format(date, 'yyyy-MM');
            const monthLabel = format(date, 'MMM yyyy', { locale: tr });

            if (!monthlyGroups[monthKey]) {
                monthlyGroups[monthKey] = {
                    name: monthLabel,
                    date: monthKey, // sıralama için
                    total: 0,
                    internal: 0,
                    external: 0
                };
            }
            monthlyGroups[monthKey].total += cost.amount;
            if (externalCostTypes.includes(cost.cost_type)) {
                monthlyGroups[monthKey].external += cost.amount;
            } else {
                monthlyGroups[monthKey].internal += cost.amount;
            }
        });

        // Aylık veriyi diziye çevir ve sırala
        const monthlyTrend = Object.values(monthlyGroups).sort((a, b) => a.date.localeCompare(b.date));

        const aggregate = (key, filterFn = () => true) => {
            const aggregatedData = costs.filter(filterFn).reduce((acc, cost) => {
                let itemKey;
                if (key === 'unit' && cost.is_supplier_nc && cost.supplier?.name) {
                    itemKey = cost.supplier.name;
                } else {
                    itemKey = cost[key];
                }

                if (!itemKey) return acc;

                if (!acc[itemKey]) {
                    acc[itemKey] = { value: 0, count: 0, allCosts: [] };
                }
                acc[itemKey].value += cost.amount;
                acc[itemKey].count += (cost.quantity || 1);
                acc[itemKey].allCosts.push(cost);
                return acc;
            }, {});

            return Object.entries(aggregatedData)
                .map(([name, data]) => ({ name, value: data.value, count: data.count, costs: data.allCosts }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 5);
        };

        return {
            parts: aggregate('part_code'),
            units: aggregate('unit'),
            costTypes: aggregate('cost_type'),
            vehicleTypes: aggregate('vehicle_type'),
            totalCost,
            internalCost,
            externalCost,
            internalCosts,
            externalCosts,
            monthlyTrend
        };
    }, [costs]);

    const handleBarClick = (dataKey, data) => {
        if (data && data.name) {
            let relatedCosts;
            if (dataKey === 'unit') {
                relatedCosts = costs.filter(c => {
                    if (c.is_supplier_nc && c.supplier?.name) {
                        return c.supplier.name === data.name;
                    }
                    return c.unit === data.name;
                });
            } else {
                relatedCosts = costs.filter(c => c[dataKey] === data.name || (c.part_code === data.name && dataKey === 'part_code'));
            }
            onBarClick(`Detay: ${data.name}`, relatedCosts); // Bu parent componentte modalı tetikleyecek
        }
    };

    return (
        <div className="space-y-6">
            <motion.div
                className="grid grid-cols-1 md:grid-cols-3 gap-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
            >
                <StatCard
                    title="Toplam Kalite Maliyeti"
                    value={analyticsData.totalCost}
                    icon={Wallet}
                    loading={loading}
                    onClick={() => onBarClick('Toplam Kalite Maliyeti', costs)}
                />
                <StatCard
                    title="İç Hata Maliyetleri"
                    value={analyticsData.internalCost}
                    icon={TrendingDown}
                    loading={loading}
                    onClick={() => onBarClick('İç Hata Maliyetleri', analyticsData.internalCosts)}
                />
                <StatCard
                    title="Dış Hata Maliyetleri"
                    value={analyticsData.externalCost}
                    icon={TrendingUp}
                    loading={loading}
                    onClick={() => onBarClick('Dış Hata Maliyetleri', analyticsData.externalCosts)}
                />
            </motion.div>

            {/* Yeni Aylık Trend Grafiği - Zoom/Pan Özellikli */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
            >
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-primary" />
                                Aylık Maliyet Trendi
                            </CardTitle>
                            <CardDescription>Zaman içindeki maliyet değişimi (Zoom için alttaki barı kullanın)</CardDescription>
                        </div>
                        <Select value={trendChartType} onValueChange={setTrendChartType}>
                            <SelectTrigger className="w-[120px]">
                                <SelectValue placeholder="Grafik Tipi" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="area">Alan (Area)</SelectItem>
                                <SelectItem value="bar">Sütun (Bar)</SelectItem>
                                <SelectItem value="line">Çizgi (Line)</SelectItem>
                            </SelectContent>
                        </Select>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[350px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                {trendChartType === 'bar' ? (
                                    <BarChart data={analyticsData.monthlyTrend} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} fontSize={12} tickLine={false} axisLine={false} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend verticalAlign="top" />
                                        <Bar dataKey="internal" name="İç Hata" stackId="a" fill="#3b82f6" radius={[0, 0, 4, 4]} />
                                        <Bar dataKey="external" name="Dış Hata" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                        <Brush dataKey="name" height={30} stroke="#8884d8" />
                                    </BarChart>
                                ) : trendChartType === 'line' ? (
                                    <LineChart data={analyticsData.monthlyTrend} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} fontSize={12} tickLine={false} axisLine={false} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend verticalAlign="top" />
                                        <Line type="monotone" dataKey="total" name="Toplam Trend" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4 }} />
                                        <Brush dataKey="name" height={30} stroke="#8884d8" />
                                    </LineChart>
                                ) : (
                                    <AreaChart data={analyticsData.monthlyTrend} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                                                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} fontSize={12} tickLine={false} axisLine={false} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend verticalAlign="top" />
                                        <Area type="monotone" dataKey="total" name="Toplam Maliyet" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorTotal)" />
                                        <Brush dataKey="name" height={30} stroke="#8884d8" />
                                    </AreaChart>
                                )}
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>

            <motion.div
                className="grid grid-cols-1 lg:grid-cols-2 gap-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ staggerChildren: 0.1, delay: 0.4 }}
            >
                {renderTop5Chart("En Maliyetli 5 Parça", analyticsData.parts, (data) => handleBarClick('part_code', data))}
                {renderTop5Chart("En Maliyetli 5 Kaynak (Birim/Tedarikçi)", analyticsData.units, (data) => handleBarClick('unit', data))}
                {renderTop5Chart("En Maliyetli 5 Tür", analyticsData.costTypes, (data) => handleBarClick('cost_type', data))}
                {renderTop5Chart("En Maliyetli 5 Araç Türü", analyticsData.vehicleTypes, (data) => handleBarClick('vehicle_type', data))}
            </motion.div>
        </div>
    );
};

export default CostAnalytics;