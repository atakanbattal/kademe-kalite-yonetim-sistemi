import React, { memo, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, CartesianGrid, Legend, Brush, AreaChart, Area } from 'recharts';
import { motion } from 'framer-motion';
import { PIE_COLORS } from './constants';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Wallet, Calendar, ArrowRightLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { createCanonicalUnitCaches } from '@/lib/qualityCostUnitGroups';
import { getDefectContributionsFromCost } from '@/lib/qualityCostDefectAggregation';

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

const bumpAgg = (acc, key, cost, amountNum) => {
    if (key == null || key === '') return;
    if (!acc[key]) acc[key] = { value: 0, count: 0, allCosts: [] };
    acc[key].value += amountNum;
    acc[key].count += (cost.quantity || 1);
    acc[key].allCosts.push(cost);
};

const CostAnalytics = ({ costs, loading, onBarClick, copqYearTotals, copqYearlyInsight, onYearCOPQClick, canonicalUnitCtx = {} }) => {
    const [trendChartType, setTrendChartType] = useState('area'); // area, line, bar

    const canonCaches = useMemo(() => createCanonicalUnitCaches(canonicalUnitCtx), [canonicalUnitCtx]);

    const analyticsData = useMemo(() => {
        if (!costs || costs.length === 0) {
            return {
                parts: [], units: [], costTypes: [], vehicleTypes: [], defectGroups: [], defectTypes: [],
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

        const monthlyGroups = {};
        /** @type {Record<string, { value: number, count: number, allCosts: unknown[] }>} */
        const partsAgg = {};
        const unitsAgg = {};
        const costTypesAgg = {};
        const vehicleTypesAgg = {};
        const defectGroupAgg = {};
        const defectTypeAgg = {};

        for (const cost of costs) {
            const amountNum = parseFloat(cost.amount);
            const amt = Number.isFinite(amountNum) ? amountNum : 0;
            totalCost += amt;

            if (externalCostTypes.includes(cost.cost_type)) {
                externalCost += amt;
                externalCosts.push(cost);
            } else if (internalCostTypes.includes(cost.cost_type) || (cost.is_supplier_nc && cost.supplier_id)) {
                internalCost += amt;
                internalCosts.push(cost);
            }

            const date = new Date(cost.cost_date);
            const monthKey = format(date, 'yyyy-MM');
            const monthLabel = format(date, 'MMM yyyy', { locale: tr });

            if (!monthlyGroups[monthKey]) {
                monthlyGroups[monthKey] = {
                    name: monthLabel,
                    date: monthKey,
                    total: 0,
                    internal: 0,
                    external: 0
                };
            }
            monthlyGroups[monthKey].total += amt;
            if (externalCostTypes.includes(cost.cost_type)) {
                monthlyGroups[monthKey].external += amt;
            } else {
                monthlyGroups[monthKey].internal += amt;
            }

            const pc = cost.part_code;
            if (pc) bumpAgg(partsAgg, pc, cost, amt);

            let unitKey;
            if (cost.is_supplier_nc && cost.supplier?.name) {
                unitKey = cost.supplier.name;
            } else {
                const u = cost.unit?.trim?.() ? cost.unit.trim() : cost.unit;
                unitKey = u ? canonCaches.getLabel(u) : null;
            }
            if (unitKey) bumpAgg(unitsAgg, unitKey, cost, amt);

            const ct = cost.cost_type;
            if (ct) bumpAgg(costTypesAgg, ct, cost, amt);

            const vt = cost.vehicle_type;
            if (vt) bumpAgg(vehicleTypesAgg, vt, cost, amt);

            const defectRows = getDefectContributionsFromCost(cost, canonicalUnitCtx);
            for (const row of defectRows) {
                const gLabel = row.group_label || 'Diğer / Eşlenmemiş';
                bumpAgg(defectGroupAgg, gLabel, cost, row.amount);
                bumpAgg(defectTypeAgg, row.defect_type, cost, row.amount);
            }
        }

        const monthlyTrend = Object.values(monthlyGroups).sort((a, b) => a.date.localeCompare(b.date));

        const top5 = (agg) => Object.entries(agg)
            .map(([name, data]) => ({ name, value: data.value, count: data.count, costs: data.allCosts }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);

        return {
            parts: top5(partsAgg),
            units: top5(unitsAgg),
            costTypes: top5(costTypesAgg),
            vehicleTypes: top5(vehicleTypesAgg),
            defectGroups: top5(defectGroupAgg),
            defectTypes: top5(defectTypeAgg),
            totalCost,
            internalCost,
            externalCost,
            internalCosts,
            externalCosts,
            monthlyTrend
        };
    }, [costs, canonCaches, canonicalUnitCtx]);

    const handleBarClick = (dataKey, data) => {
        if (data && data.name) {
            let relatedCosts;
            if (dataKey === 'unit') {
                relatedCosts = costs.filter((c) => {
                    if (c.is_supplier_nc && c.supplier?.name) {
                        return c.supplier.name === data.name;
                    }
                    const u = c.unit?.trim?.() ? c.unit.trim() : c.unit;
                    const label = u ? canonCaches.getLabel(u) : null;
                    return label === data.name;
                });
            } else if (dataKey === 'defect_group') {
                relatedCosts = costs.filter((c) =>
                    getDefectContributionsFromCost(c, canonicalUnitCtx).some((r) => (r.group_label || 'Diğer / Eşlenmemiş') === data.name)
                );
            } else if (dataKey === 'defect_type') {
                relatedCosts = costs.filter((c) =>
                    getDefectContributionsFromCost(c, canonicalUnitCtx).some((r) => r.defect_type === data.name)
                );
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

            {copqYearTotals && copqYearlyInsight?.current && copqYearlyInsight?.previous && (
                <motion.div
                    className="rounded-2xl border border-border/60 bg-gradient-to-b from-muted/30 via-background to-background p-4 sm:p-5 shadow-sm"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35 }}
                >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                        <div className="flex items-center gap-2 min-w-0">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                <ArrowRightLeft className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-foreground tracking-tight">Yıllık COPQ karşılaştırması</p>
                                <p className="text-[11px] text-muted-foreground">
                                    Önceki tam yıl ile güncel yıl (yıl içi) — detay ve kıyas için karta tıklayın
                                </p>
                            </div>
                        </div>
                        {(() => {
                            const p = copqYearTotals.totalPrevious;
                            const c = copqYearTotals.totalCurrent;
                            const yoy = p > 0 ? ((c - p) / p) * 100 : c > 0 ? 100 : 0;
                            const up = yoy > 0.05;
                            const down = yoy < -0.05;
                            return (
                                <div
                                    className={cn(
                                        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium tabular-nums border',
                                        up && 'border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300',
                                        down && 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
                                        !up && !down && 'border-border/80 bg-muted/40 text-muted-foreground'
                                    )}
                                >
                                    {up ? (
                                        <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                                    ) : down ? (
                                        <TrendingDown className="h-3.5 w-3.5 shrink-0" />
                                    ) : null}
                                    <span>
                                        Güncel yıl / önceki yıl: {yoy > 0 ? '+' : ''}
                                        {yoy.toFixed(1)}%
                                    </span>
                                </div>
                            );
                        })()}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                        <button
                            type="button"
                            onClick={() => onYearCOPQClick?.(copqYearTotals.previousYear)}
                            className={cn(
                                'group text-left rounded-xl border border-border/70 bg-card/80 hover:bg-accent/25',
                                'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                'p-4 shadow-sm'
                            )}
                        >
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Tam yıl · {copqYearTotals.previousYear}
                            </p>
                            <p className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums text-foreground">
                                {formatCurrency(copqYearTotals.totalPrevious)}
                            </p>
                            <div className="mt-3 pt-3 border-t border-border/60 space-y-1 text-[11px] text-muted-foreground">
                                <p>
                                    <span className="text-foreground/90 font-medium">{copqYearlyInsight.previous.count}</span>{' '}
                                    kayıt · aylık ort.{' '}
                                    <span className="tabular-nums text-foreground/90 font-medium">
                                        {formatCurrency(
                                            typeof copqYearlyInsight.previousMonthlyAvg === 'number'
                                                ? copqYearlyInsight.previousMonthlyAvg
                                                : (copqYearlyInsight.previous?.total || 0) / 12
                                        )}
                                    </span>
                                </p>
                                <p>
                                    İç {copqYearlyInsight.previous.internalShare.toFixed(1)}% · dış{' '}
                                    {copqYearlyInsight.previous.externalShare.toFixed(1)}%
                                </p>
                            </div>
                        </button>
                        <button
                            type="button"
                            onClick={() => onYearCOPQClick?.(copqYearTotals.currentYear)}
                            className={cn(
                                'group text-left rounded-xl border border-primary/25 bg-gradient-to-br from-primary/[0.07] to-transparent',
                                'hover:from-primary/[0.11] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                'p-4 shadow-sm ring-1 ring-inset ring-primary/10'
                            )}
                        >
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                                Yıl içi · {copqYearTotals.currentYear}
                            </p>
                            <p className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums text-foreground">
                                {formatCurrency(copqYearTotals.totalCurrent)}
                            </p>
                            <div className="mt-3 pt-3 border-t border-primary/15 space-y-1 text-[11px] text-muted-foreground">
                                <p>
                                    <span className="text-foreground/90 font-medium">{copqYearlyInsight.current.count}</span>{' '}
                                    kayıt · iç {copqYearlyInsight.current.internalShare.toFixed(1)}% · dış{' '}
                                    {copqYearlyInsight.current.externalShare.toFixed(1)}%
                                </p>
                                <p className="text-[10px] leading-snug opacity-90">
                                    Modalda {copqYearTotals.currentYear} ile {copqYearTotals.currentYear - 1} aynı dönem kıyası
                                </p>
                            </div>
                        </button>
                    </div>
                </motion.div>
            )}

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
                {renderTop5Chart("Hurda / Yeniden — Hata grubu (birim)", analyticsData.defectGroups, (data) => handleBarClick('defect_group', data))}
                {renderTop5Chart("Hurda / Yeniden — Hata tipi", analyticsData.defectTypes, (data) => handleBarClick('defect_type', data))}
            </motion.div>
        </div>
    );
};

export default memo(CostAnalytics);