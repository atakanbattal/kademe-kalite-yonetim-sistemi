import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
    Line, CartesianGrid, ComposedChart, Legend
} from 'recharts';
import { useData } from '@/contexts/DataContext';
import {
    CheckCircle, AlertOctagon, Activity, Factory, RefreshCw, Wrench, Clock,
    TrendingUp, TrendingDown, Minus, Calendar
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, parseISO, isValid, differenceInDays } from 'date-fns';
import { tr } from 'date-fns/locale';
import { parseFaultQuantity, sumFaultQuantityWhere } from '@/lib/vehicleFaultCounts';
import {
    getFirstQualityEntryDate,
    getReworkCount,
    buildWeeklyQualityIntake,
} from '@/lib/vehicleQualityMetrics';
import { calculateVehicleTimelineStats } from '@/lib/vehicleTimelineUtils';
import { formatDuration } from '@/lib/formatDuration.js';

// Yüzdeyi her zaman [0, 100] aralığında tutar — kalite metriklerinde >100 göstermemek için.
const clampPct = (n) => {
    if (n == null || Number.isNaN(n)) return 0;
    return Math.max(0, Math.min(100, n));
};

const VehicleQualityAnalytics = ({ vehicles: vehiclesProp, dateRange }) => {
    const dataContext = useData();
    // Üst modül filtrelenmiş aracı verir; props yoksa context'i kullanmaya geri düşer.
    const sourceVehicles = vehiclesProp != null ? vehiclesProp : dataContext.producedVehicles;
    const loading = dataContext.loading;

    const periodLabel = useMemo(() => {
        if (dateRange?.from && dateRange?.to) {
            return `${format(dateRange.from, 'd MMM yyyy', { locale: tr })} – ${format(dateRange.to, 'd MMM yyyy', { locale: tr })}`;
        }
        return 'Tüm Zamanlar';
    }, [dateRange]);

    const analyticsData = useMemo(() => {
        const vehicles = sourceVehicles || [];
        const totalVehicles = vehicles.length;
        if (totalVehicles === 0) return null;

        let totalDefects = 0;
        let vehiclesWithFaults = 0;
        let vehiclesClean = 0;
        let vehiclesWithRework = 0;
        let totalReworkCycles = 0;
        let firstPassClean = 0; // hiç yeniden işleme girmemiş + hatasız
        const faultsByCategory = {};
        const faultsByDiscipline = {};
        const faultsByModel = {};
        const reworkBuckets = { '0': 0, '1': 0, '2': 0, '3': 0, '4+': 0 };

        let totalCycleControlMs = 0;
        let totalCycleReworkMs = 0;
        let controlCycleCount = 0;
        let reworkCycleCount = 0;
        let totalQualityToShipDays = 0;
        let qualityToShipCount = 0;

        const now = new Date();
        vehicles.forEach((vehicle) => {
            const faults = vehicle.quality_inspection_faults || [];
            const defectQty = sumFaultQuantityWhere(faults, () => true);
            const hasFaultRecords = faults.length > 0;
            const reworkCount = getReworkCount(vehicle);

            if (hasFaultRecords) {
                totalDefects += defectQty;
                vehiclesWithFaults += 1;
            } else {
                vehiclesClean += 1;
            }
            if (reworkCount > 0) {
                vehiclesWithRework += 1;
                totalReworkCycles += reworkCount;
            }
            if (!hasFaultRecords && reworkCount === 0) {
                firstPassClean += 1;
            }

            const key = reworkCount >= 4 ? '4+' : String(reworkCount);
            reworkBuckets[key] = (reworkBuckets[key] || 0) + 1;

            // Pareto: kategori & disiplin bazlı hata adetleri
            faults.forEach((f) => {
                let cat = 'Diğer';
                if (f.category?.name) cat = f.category.name;
                else if (typeof f.fault_category === 'object' && f.fault_category !== null) cat = f.fault_category.name || f.fault_category.label || 'Diğer';
                else if (typeof f.fault_category === 'string') cat = f.fault_category;
                faultsByCategory[cat] = (faultsByCategory[cat] || 0) + parseFaultQuantity(f);

                let disc = f.category?.discipline || f.fault_category?.discipline || f.discipline || 'Genel';
                faultsByDiscipline[disc] = (faultsByDiscipline[disc] || 0) + parseFaultQuantity(f);
            });

            // Model performansı
            const model = vehicle.vehicle_type || 'Bilinmiyor';
            if (!faultsByModel[model]) {
                faultsByModel[model] = { total: 0, clean: 0, defects: 0, reworked: 0, reworkSum: 0 };
            }
            faultsByModel[model].total += 1;
            if (!hasFaultRecords) faultsByModel[model].clean += 1;
            faultsByModel[model].defects += defectQty;
            faultsByModel[model].reworkSum += reworkCount;
            if (reworkCount > 0) faultsByModel[model].reworked += 1;

            // Süre döngüleri (saat/dk olarak da göstermek için)
            const tl = calculateVehicleTimelineStats(vehicle.vehicle_timeline_events, now, {
                vehicleStatus: vehicle.status,
            });
            totalCycleControlMs += tl.totalControlMillis;
            totalCycleReworkMs += tl.totalReworkMillis;
            controlCycleCount += tl.controlCycleCount;
            reworkCycleCount += tl.reworkCycleCount;

            // Kalite → sevk süresi (gün)
            const entry = getFirstQualityEntryDate(vehicle);
            if (entry && vehicle.shipped_at) {
                const shipped = parseISO(vehicle.shipped_at);
                if (isValid(shipped)) {
                    const days = differenceInDays(shipped, entry);
                    if (days >= 0) {
                        totalQualityToShipDays += days;
                        qualityToShipCount += 1;
                    }
                }
            }
        });

        const ftq = totalVehicles > 0 ? (firstPassClean / totalVehicles) * 100 : 0; // "İlk seferde sıfır hata + yeniden işlem yok"
        const cleanRate = totalVehicles > 0 ? (vehiclesClean / totalVehicles) * 100 : 0;
        const dpu = totalVehicles > 0 ? totalDefects / totalVehicles : 0;
        const defectRate = totalVehicles > 0 ? (vehiclesWithFaults / totalVehicles) * 100 : 0;
        const reworkRate = totalVehicles > 0 ? (vehiclesWithRework / totalVehicles) * 100 : 0;
        const avgReworkPerVehicle = totalVehicles > 0 ? totalReworkCycles / totalVehicles : 0;
        const avgQualityToShipDays = qualityToShipCount > 0 ? totalQualityToShipDays / qualityToShipCount : 0;
        const avgControlDurationMs = controlCycleCount > 0 ? totalCycleControlMs / controlCycleCount : 0;
        const avgReworkDurationMs = reworkCycleCount > 0 ? totalCycleReworkMs / reworkCycleCount : 0;

        // Pareto verisi
        const paretoChartData = Object.entries(faultsByCategory)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        let cumulative = 0;
        const totalParetoFaults = paretoChartData.reduce((s, item) => s + item.count, 0);
        paretoChartData.forEach((item) => {
            cumulative += item.count;
            item.cumulativePercentage = totalParetoFaults > 0
                ? Math.round((cumulative / totalParetoFaults) * 100)
                : 0;
        });

        const disciplineData = Object.entries(faultsByDiscipline)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);

        // Model performansı tablosu — tüm yüzdeler [0,100] içinde
        const modelTableData = Object.entries(faultsByModel)
            .map(([name, data]) => {
                const total = data.total || 0;
                const cleanPct = total > 0 ? (data.clean / total) * 100 : 0;
                return {
                    name,
                    total,
                    ftq: clampPct(cleanPct).toFixed(1),
                    dpu: total > 0 ? (data.defects / total).toFixed(2) : '0.00',
                    reworkRate: clampPct(total > 0 ? (data.reworked / total) * 100 : 0).toFixed(1),
                    avgRework: total > 0 ? (data.reworkSum / total).toFixed(2) : '0.00',
                };
            })
            .sort((a, b) => parseFloat(b.ftq) - parseFloat(a.ftq));

        // Haftalık özet — kaliteye ilk giriş tarihine göre
        const weeklyData = buildWeeklyQualityIntake(vehicles).slice(-26); // son 26 hafta

        // Yeniden işlem dağılımı (kaç araç kaç kez yeniden işleme girmiş)
        const reworkDistribution = [
            { name: '0 (Temiz)', value: reworkBuckets['0'], color: '#10B981' },
            { name: '1 kez', value: reworkBuckets['1'], color: '#F59E0B' },
            { name: '2 kez', value: reworkBuckets['2'], color: '#F97316' },
            { name: '3 kez', value: reworkBuckets['3'], color: '#EF4444' },
            { name: '4+ kez', value: reworkBuckets['4+'], color: '#7F1D1D' },
        ];

        return {
            kpi: {
                totalVehicles,
                totalDefects,
                ftq: clampPct(ftq).toFixed(1),
                cleanRate: clampPct(cleanRate).toFixed(1),
                dpu: dpu.toFixed(2),
                defectRate: clampPct(defectRate).toFixed(1),
                reworkRate: clampPct(reworkRate).toFixed(1),
                avgReworkPerVehicle: avgReworkPerVehicle.toFixed(2),
                avgQualityToShipDays: avgQualityToShipDays.toFixed(1),
                avgControlDuration: avgControlDurationMs > 0 ? formatDuration(avgControlDurationMs) : '-',
                avgReworkDuration: avgReworkDurationMs > 0 ? formatDuration(avgReworkDurationMs) : '-',
                vehiclesWithRework,
                vehiclesClean,
                firstPassClean,
            },
            pareto: paretoChartData,
            disciplineData,
            models: modelTableData,
            weeklyData,
            reworkDistribution,
        };
    }, [sourceVehicles]);

    if (loading && !analyticsData) return <div className="p-8 text-center text-muted-foreground">Yükleniyor...</div>;
    if (!analyticsData) return (
        <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
                Bu filtre kriterleri için kalite analizine uygun veri bulunamadı.
                <div className="text-xs mt-2">Filtreleri genişletmek ya da tüm zamanları seçmek için yukarıdaki filtre çubuğunu kullanabilirsiniz.</div>
            </CardContent>
        </Card>
    );

    const { kpi, pareto, disciplineData, models, weeklyData, reworkDistribution } = analyticsData;

    // Haftalık trende baktığımız ek bilgi: son 4 hafta ortalaması vs önceki 4 hafta
    const trendInsight = (() => {
        if (weeklyData.length < 8) return null;
        const last = weeklyData.slice(-4);
        const prev = weeklyData.slice(-8, -4);
        const avg = (arr) => arr.reduce((s, w) => s + w.count, 0) / arr.length;
        const lastAvg = avg(last);
        const prevAvg = avg(prev);
        if (prevAvg === 0) return null;
        const delta = ((lastAvg - prevAvg) / prevAvg) * 100;
        return { lastAvg: lastAvg.toFixed(1), prevAvg: prevAvg.toFixed(1), delta: delta.toFixed(1) };
    })();

    return (
        <div className="space-y-6">
            {/* Aralık bilgisi */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-card/40 px-4 py-3">
                <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Analiz dönemi:</span>
                    <span className="font-semibold text-foreground">{periodLabel}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                    {kpi.totalVehicles} araç · {kpi.totalDefects} hata · {kpi.vehiclesWithRework} yeniden işlem
                </div>
            </div>

            {/* KPI Kartları - 6 adet, üst sıra ve alt sıra */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <Card className="bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20 dark:to-background border-emerald-100 dark:border-emerald-900">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-medium text-emerald-900 dark:text-emerald-100">FTQ (İlk Seferde Kalite)</CardTitle>
                        <CheckCircle className="h-4 w-4 text-emerald-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">%{kpi.ftq}</div>
                        <p className="text-[11px] text-muted-foreground mt-1">İlk denemede sıfır hata & yeniden işlem yok</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-medium">Hatasız Araç Oranı</CardTitle>
                        <CheckCircle className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">%{kpi.cleanRate}</div>
                        <p className="text-[11px] text-muted-foreground mt-1">Hata kaydı olmayan araç</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-medium">Yeniden İşlem Oranı</CardTitle>
                        <RefreshCw className="h-4 w-4 text-orange-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">%{kpi.reworkRate}</div>
                        <p className="text-[11px] text-muted-foreground mt-1">En az 1 kez yeniden işleme giren</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-medium">Toplam Üretim</CardTitle>
                        <Factory className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{kpi.totalVehicles}</div>
                        <p className="text-[11px] text-muted-foreground mt-1">Dönemdeki araç</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-medium">DPU</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{kpi.dpu}</div>
                        <p className="text-[11px] text-muted-foreground mt-1">Araç başına hata</p>
                    </CardContent>
                </Card>
                <Card className={Number(kpi.totalDefects) > 0 ? "border-red-100 dark:border-red-900/50" : ""}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-medium">Toplam Hata</CardTitle>
                        <AlertOctagon className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600 dark:text-red-400">{kpi.totalDefects}</div>
                        <p className="text-[11px] text-muted-foreground mt-1">Kayda alınan hata</p>
                    </CardContent>
                </Card>
            </div>

            {/* İkinci KPI sırası: süre & yeniden işlem */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-medium">Ort. Yeniden İşlem / Araç</CardTitle>
                        <Wrench className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{kpi.avgReworkPerVehicle}</div>
                        <p className="text-[11px] text-muted-foreground mt-1">Araç başına yeniden işlem sayısı</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-medium">Ort. Kontrol Süresi</CardTitle>
                        <Clock className="h-4 w-4 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-lg font-bold">{kpi.avgControlDuration}</div>
                        <p className="text-[11px] text-muted-foreground mt-1">Tamamlanmış kontrol döngüleri</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-medium">Ort. Yeniden İşlem Süresi</CardTitle>
                        <Clock className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-lg font-bold">{kpi.avgReworkDuration}</div>
                        <p className="text-[11px] text-muted-foreground mt-1">Bir yeniden işlem döngüsü</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-medium">Kalite → Sevk (gün)</CardTitle>
                        <Clock className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{kpi.avgQualityToShipDays}</div>
                        <p className="text-[11px] text-muted-foreground mt-1">Sevk edilen araçların ortalaması</p>
                    </CardContent>
                </Card>
            </div>

            {/* Haftalık Kaliteye Verilen Araç Trendi */}
            <Card>
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Calendar className="w-5 h-5" />
                            Haftalık Kaliteye Verilen Araçlar
                        </CardTitle>
                        <CardDescription>
                            Aracın kaliteye <strong>ilk giriş</strong> tarihine göre haftalık (Pazartesi başlangıçlı) toplam.
                            Yeniden işleme alınan araçlar ayrıca işaretlenir.
                        </CardDescription>
                    </div>
                    {trendInsight && (
                        <div className="text-right text-xs">
                            <div className="text-muted-foreground">Son 4 hafta ort.</div>
                            <div className="text-base font-bold flex items-center justify-end gap-1">
                                {trendInsight.lastAvg}
                                {parseFloat(trendInsight.delta) > 0 && <TrendingUp className="w-4 h-4 text-emerald-600" />}
                                {parseFloat(trendInsight.delta) < 0 && <TrendingDown className="w-4 h-4 text-red-600" />}
                                {parseFloat(trendInsight.delta) === 0 && <Minus className="w-4 h-4 text-muted-foreground" />}
                            </div>
                            <div className={`text-[11px] ${parseFloat(trendInsight.delta) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {parseFloat(trendInsight.delta) >= 0 ? '+' : ''}{trendInsight.delta}% önceki 4 haftaya göre
                            </div>
                        </div>
                    )}
                </CardHeader>
                <CardContent>
                    <div className="h-[min(52vh,480px)] min-h-[400px] w-full">
                        {weeklyData.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                                Bu dönem için haftalık veri bulunmuyor.
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={weeklyData} margin={{ top: 16, right: 48, left: 8, bottom: 72 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                    <XAxis dataKey="shortLabel" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={60} />
                                    <YAxis yAxisId="left" stroke="#3B82F6" label={{ value: 'Araç', angle: -90, position: 'insideLeft', fill: '#3B82F6' }} />
                                    <YAxis yAxisId="right" orientation="right" stroke="#9333EA" label={{ value: 'FTQ %', angle: 90, position: 'insideRight', fill: '#9333EA' }} domain={[0, 100]} />
                                    <RechartsTooltip
                                        content={({ active, payload }) => {
                                            if (!active || !payload?.length) return null;
                                            const d = payload[0].payload;
                                            return (
                                                <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
                                                    <div className="font-semibold mb-1">{d.weekLabel}</div>
                                                    <div className="space-y-0.5">
                                                        <div>Toplam: <span className="font-semibold">{d.count}</span></div>
                                                        <div className="text-emerald-700">Hatasız: {d.cleanCount} (FTQ %{d.ftq})</div>
                                                        <div className="text-red-700">Hatalı: {d.faultyCount}</div>
                                                        <div className="text-orange-700">Yeniden İşleme Giren: {d.reworkedCount} (%{d.reworkRate})</div>
                                                        <div className="text-muted-foreground">Toplam hata adedi: {d.totalFaults}</div>
                                                    </div>
                                                </div>
                                            );
                                        }}
                                    />
                                    <Legend wrapperStyle={{ paddingTop: 10 }} />
                                    <Bar yAxisId="left" dataKey="cleanCount" name="Hatasız" stackId="vehicles" fill="#10B981" />
                                    <Bar yAxisId="left" dataKey="faultyCount" name="Hatalı" stackId="vehicles" fill="#EF4444" />
                                    <Line yAxisId="left" type="monotone" dataKey="reworkedCount" name="Yeniden İşleme Giren" stroke="#F97316" strokeWidth={2} dot={{ r: 3 }} />
                                    <Line yAxisId="right" type="monotone" dataKey="ftq" name="FTQ %" stroke="#9333EA" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Haftalık tablo */}
            {weeklyData.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Haftalık Detay Tablosu</CardTitle>
                        <CardDescription>Hafta bazlı kalite ve yeniden işlem performansı</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Hafta</TableHead>
                                        <TableHead className="text-center">Verilen Araç</TableHead>
                                        <TableHead className="text-center">Hatasız</TableHead>
                                        <TableHead className="text-center">Hatalı</TableHead>
                                        <TableHead className="text-center">Toplam Hata</TableHead>
                                        <TableHead className="text-center">Yen. İşleme Giren</TableHead>
                                        <TableHead className="text-center">Ort. Yen. İşlem</TableHead>
                                        <TableHead className="text-center">FTQ %</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {[...weeklyData].reverse().slice(0, 12).map((w) => (
                                        <TableRow key={w.weekKey}>
                                            <TableCell className="font-medium whitespace-nowrap">{w.weekLabel}</TableCell>
                                            <TableCell className="text-center font-semibold">{w.count}</TableCell>
                                            <TableCell className="text-center text-emerald-700">{w.cleanCount}</TableCell>
                                            <TableCell className="text-center text-red-700">{w.faultyCount}</TableCell>
                                            <TableCell className="text-center">{w.totalFaults}</TableCell>
                                            <TableCell className="text-center text-orange-700">{w.reworkedCount}</TableCell>
                                            <TableCell className="text-center text-muted-foreground">{w.avgRework}</TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant={w.ftq >= 90 ? 'success' : w.ftq >= 75 ? 'warning' : 'destructive'}>
                                                    %{w.ftq.toFixed(1)}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        {weeklyData.length > 12 && (
                            <p className="text-xs text-muted-foreground mt-2">Sadece son 12 hafta gösterilmektedir.</p>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Grafikleri tam genişlikte dikey sırala — 2 sütun grid sıkışıklığını önler */}
            <div className="flex flex-col gap-8 lg:gap-10">
                {/* Pareto */}
                <Card>
                    <CardHeader>
                        <CardTitle>Pareto - En Sık Hatalar</CardTitle>
                        <CardDescription>Hataların %80'ine sebep olan kategoriler</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[min(45vh,420px)] min-h-[360px] w-full">
                            {pareto.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Hata kaydı bulunmuyor.</div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={pareto} layout="vertical" margin={{ top: 8, right: 48, left: 8, bottom: 8 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} />
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" width={148} tick={{ fontSize: 12 }} interval={0} />
                                        <RechartsTooltip />
                                        <Bar dataKey="count" name="Hata Sayısı" radius={[0, 4, 4, 0]} barSize={20}>
                                            {pareto.map((entry, index) => (
                                                <Cell key={`c-${index}`} fill={index < 3 ? '#EF4444' : '#FCA5A5'} />
                                            ))}
                                        </Bar>
                                    </ComposedChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Yeniden işlem dağılımı */}
                <Card>
                    <CardHeader>
                        <CardTitle>Yeniden İşlem Dağılımı</CardTitle>
                        <CardDescription>Aracın hayatı boyunca kaç kez yeniden işleme alındığı</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[min(40vh,380px)] min-h-[320px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={reworkDistribution} margin={{ top: 24, right: 40, left: 8, bottom: 32 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                    <YAxis label={{ value: 'Araç sayısı', angle: -90, position: 'insideLeft' }} />
                                    <RechartsTooltip />
                                    <Bar dataKey="value" name="Araç" radius={[4, 4, 0, 0]}>
                                        {reworkDistribution.map((entry, index) => (
                                            <Cell key={`r-${index}`} fill={entry.color} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Disiplin */}
                <Card>
                    <CardHeader>
                        <CardTitle>Disipline Göre Hata Dağılımı</CardTitle>
                        <CardDescription>Elektrik, Mekanik, Hidrolik vb.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[min(45vh,420px)] min-h-[360px] w-full">
                            {disciplineData.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Veri bulunmuyor.</div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={disciplineData} margin={{ top: 20, right: 40, left: 8, bottom: 72 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={60} />
                                        <YAxis />
                                        <RechartsTooltip />
                                        <Bar dataKey="count" name="Hata Adedi" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Model Bazlı Performans</CardTitle>
                        <CardDescription>FTQ, DPU ve yeniden işlem oranları model bazında</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-2">
                        <div className="overflow-x-auto -mx-1 px-1">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Araç Tipi</TableHead>
                                        <TableHead className="text-center">Üretim</TableHead>
                                        <TableHead className="text-center">FTQ %</TableHead>
                                        <TableHead className="text-center">DPU</TableHead>
                                        <TableHead className="text-center">Yen. İşlem %</TableHead>
                                        <TableHead className="text-center">Ort. Yen. İşlem</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {models.map((m) => (
                                        <TableRow key={m.name}>
                                            <TableCell className="font-medium">{m.name}</TableCell>
                                            <TableCell className="text-center">{m.total}</TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant={parseFloat(m.ftq) >= 90 ? 'success' : parseFloat(m.ftq) >= 75 ? 'warning' : 'destructive'}>
                                                    %{m.ftq}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center text-muted-foreground">{m.dpu}</TableCell>
                                            <TableCell className="text-center">%{m.reworkRate}</TableCell>
                                            <TableCell className="text-center text-muted-foreground">{m.avgRework}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default VehicleQualityAnalytics;
