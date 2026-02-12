import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
    LineChart, Line, AreaChart, Area, CartesianGrid, ComposedChart, Legend
} from 'recharts';
import { useData } from '@/contexts/DataContext';
import {
    Car, TrendingUp, CheckCircle, AlertOctagon, Activity,
    Factory, Calendar, ArrowUpRight, ArrowDownRight, Filter
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, startOfWeek, endOfWeek, subMonths, isWithinInterval, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { tr } from 'date-fns/locale';

const CHART_COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#6366F1'];

const VehicleQualityAnalytics = () => {
    const { producedVehicles, loading } = useData();
    const [timeRange, setTimeRange] = useState('all'); // all, month, quarter, year

    // --- KPI & CHART CALCULATIONS ---

    const analyticsData = useMemo(() => {
        if (!producedVehicles || producedVehicles.length === 0) return null;

        let filteredVehicles = [...producedVehicles];

        // 1. Time Range Filtering
        const now = new Date();
        if (timeRange !== 'all') {
            const startDate =
                timeRange === 'month' ? subMonths(now, 1) :
                    timeRange === 'quarter' ? subMonths(now, 3) :
                        timeRange === 'year' ? subMonths(now, 12) : null;

            if (startDate) {
                filteredVehicles = filteredVehicles.filter(v => {
                    const date = new Date(v.created_at || v.production_date);
                    return date >= startDate;
                });
            }
        }

        const totalVehicles = filteredVehicles.length;
        if (totalVehicles === 0) return null;

        let totalFaults = 0;
        let vehiclesWithFaults = 0;
        let vehiclesClean = 0;

        // Data structures for charts
        const faultsByCategory = {};
        const trendDataMap = {}; // Key: Date (Week/Month), Value: { total, clean, faults }
        const faultsByModel = {};

        filteredVehicles.forEach(vehicle => {
            const faults = vehicle.quality_inspection_faults || [];
            const faultCount = faults.length; // Count all recorded faults

            // KPI Counts
            if (faultCount > 0) {
                totalFaults += faultCount;
                vehiclesWithFaults++;
            } else {
                vehiclesClean++;
            }

            // Pareto Data (Category)
            faults.forEach(f => {
                let cat = 'Diğer';

                // Güvenli kategori ismi alma mantığı
                if (f.category?.name) {
                    cat = f.category.name;
                } else if (typeof f.fault_category === 'object' && f.fault_category !== null) {
                    cat = f.fault_category.name || f.fault_category.label || 'Diğer';
                } else if (typeof f.fault_category === 'string') {
                    cat = f.fault_category;
                }

                faultsByCategory[cat] = (faultsByCategory[cat] || 0) + (f.quantity || 1);
            });

            // Trend Data (Group by Week)
            const date = new Date(vehicle.created_at || vehicle.production_date);
            // Format: YYYY-WN (Year-WeekNumber) for accumulation
            const weekStart = startOfWeek(date, { weekStartsOn: 1 });
            const weekKey = format(weekStart, 'yyyy-MM-dd'); // Use date string for sorting

            if (!trendDataMap[weekKey]) {
                trendDataMap[weekKey] = { date: weekKey, total: 0, clean: 0, faults: 0, defects: 0 };
            }
            trendDataMap[weekKey].total++;
            if (faultCount === 0) trendDataMap[weekKey].clean++;
            else trendDataMap[weekKey].faults++;
            trendDataMap[weekKey].defects += faultCount;

            // Model Breakdown
            const model = vehicle.vehicle_type || 'Bilinmiyor';
            if (!faultsByModel[model]) {
                faultsByModel[model] = { total: 0, clean: 0, defects: 0 };
            }
            faultsByModel[model].total++;
            if (faultCount === 0) faultsByModel[model].clean++;
            faultsByModel[model].defects += faultCount;

            });

        // Calculate KPIs
        const ftt = (vehiclesClean / totalVehicles) * 100; // First Time Quality (FTQ)
        const dpu = totalFaults / totalVehicles; // Defects Per Unit
        const defectRate = (vehiclesWithFaults / totalVehicles) * 100;

        // Process Pareto Data
        const paretoChartData = Object.entries(faultsByCategory)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10); // Top 10 categories

        // Calculate Cumulative % for Pareto
        let cumulative = 0;
        const totalParetoFaults = paretoChartData.reduce((sum, item) => sum + item.count, 0);
        paretoChartData.forEach(item => {
            cumulative += item.count;
            item.cumulativePercentage = Math.round((cumulative / totalParetoFaults) * 100);
        });

        // Process Trend Data
        const trendChartData = Object.values(trendDataMap)
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .map(item => ({
                ...item,
                ftt: Math.round((item.clean / item.total) * 100),
                label: format(new Date(item.date), 'd MMM', { locale: tr })
            }));

        // Process Model Data
        const modelTableData = Object.entries(faultsByModel).map(([name, data]) => ({
            name,
            total: data.total,
            ftt: ((data.clean / data.total) * 100).toFixed(1),
            dpu: (data.defects / data.total).toFixed(2)
        })).sort((a, b) => parseFloat(b.ftt) - parseFloat(a.ftt));

        return {
            kpi: {
                totalVehicles,
                totalFaults,
                ftt: ftt.toFixed(1),
                dpu: dpu.toFixed(2),
                defectRate: defectRate.toFixed(1)
            },
            pareto: paretoChartData,
            trend: trendChartData,
            models: modelTableData
        };
    }, [producedVehicles, timeRange]);

    if (loading) return <div className="p-8 text-center">Yükleniyor...</div>;
    if (!analyticsData) return <div className="p-8 text-center">Analiz edilecek veri bulunamadı.</div>;

    const { kpi, pareto, trend, models } = analyticsData;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <Select value={timeRange} onValueChange={setTimeRange}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Zaman Aralığı" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Tüm Zamanlar</SelectItem>
                        <SelectItem value="year">Son 1 Yıl</SelectItem>
                        <SelectItem value="quarter">Son 3 Ay</SelectItem>
                        <SelectItem value="month">Son 1 Ay</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-background border-blue-100 dark:border-blue-900">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-blue-900 dark:text-blue-100">FTQ (İlk Seferde Kalite)</CardTitle>
                        <CheckCircle className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">%{kpi.ftt}</div>
                        <p className="text-xs text-muted-foreground mt-1">Hatasız üretilen araç oranı</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Toplam Üretim</CardTitle>
                        <Factory className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{kpi.totalVehicles}</div>
                        <p className="text-xs text-muted-foreground mt-1">Adet araç üretildi</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">DPU (Araç Başı Hata)</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{kpi.dpu}</div>
                        <p className="text-xs text-muted-foreground mt-1">Ortalama hata sayısı</p>
                    </CardContent>
                </Card>
                <Card className={Number(kpi.totalFaults) > 0 ? "border-red-100 dark:border-red-900/50" : ""}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Toplam Hata</CardTitle>
                        <AlertOctagon className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-red-600 dark:text-red-400">{kpi.totalFaults}</div>
                        <p className="text-xs text-muted-foreground mt-1">Kayıt altına alınan hata</p>
                    </CardContent>
                </Card>
            </div>

            {/* Main Charts Area */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Trend Analysis */}
                <Card className="col-span-1 lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Kalite Trend Analizi (Haftalık)</CardTitle>
                        <CardDescription>FTQ oranının ve toplam üretimin zaman içindeki değişimi</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[350px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={trend} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                    <XAxis
                                        dataKey="label"
                                        tick={{ fontSize: 12 }}
                                        stroke="#6B7280"
                                    />
                                    <YAxis
                                        yAxisId="left"
                                        orientation="left"
                                        stroke="#3B82F6"
                                        label={{ value: 'FTQ %', angle: -90, position: 'insideLeft', fill: '#3B82F6' }}
                                    />
                                    <YAxis
                                        yAxisId="right"
                                        orientation="right"
                                        stroke="#9CA3AF"
                                        label={{ value: 'Üretim Adedi', angle: 90, position: 'insideRight', fill: '#9CA3AF' }}
                                    />
                                    <RechartsTooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Legend />
                                    <Bar yAxisId="right" dataKey="total" name="Üretim Adedi" fill="#E5E7EB" radius={[4, 4, 0, 0]} barSize={30} />
                                    <Line
                                        yAxisId="left"
                                        type="monotone"
                                        dataKey="ftt"
                                        name="FTQ %"
                                        stroke="#3B82F6"
                                        strokeWidth={3}
                                        dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                                        activeDot={{ r: 6 }}
                                    />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Pareto Chart */}
                <Card>
                    <CardHeader>
                        <CardTitle>Pareto Analizi (En Sık Görülen Hatalar)</CardTitle>
                        <CardDescription>Hataların %80'ine sebep olan kategoriler</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[350px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={pareto} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                    <XAxis type="number" hide />
                                    <YAxis
                                        dataKey="name"
                                        type="category"
                                        width={100}
                                        tick={{ fontSize: 11 }}
                                        stroke="#4B5563"
                                    />
                                    <RechartsTooltip />
                                    <Bar dataKey="count" name="Hata Sayısı" fill="#EF4444" radius={[0, 4, 4, 0]} barSize={20}>
                                        {pareto.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={index < 3 ? '#EF4444' : '#FCA5A5'} />
                                        ))}
                                    </Bar>
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Model Based Performance */}
                <Card>
                    <CardHeader>
                        <CardTitle>Model Bazlı Performans</CardTitle>
                        <CardDescription>Araç tiplerine göre kalite metrikleri</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Araç Tipi</TableHead>
                                    <TableHead className="text-center">Üretim</TableHead>
                                    <TableHead className="text-center">FTQ %</TableHead>
                                    <TableHead className="text-center">DPU</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {models.map((model) => (
                                    <TableRow key={model.name}>
                                        <TableCell className="font-medium">{model.name}</TableCell>
                                        <TableCell className="text-center">{model.total}</TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant={parseFloat(model.ftt) >= 90 ? 'success' : parseFloat(model.ftt) >= 75 ? 'warning' : 'destructive'}>
                                                %{model.ftt}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-center text-muted-foreground">{model.dpu}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

            </div>
        </div>
    );
};

export default VehicleQualityAnalytics;
