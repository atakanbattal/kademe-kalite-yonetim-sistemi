import React, { useEffect, useMemo, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { format, startOfMonth, eachMonthOfInterval, isValid } from 'date-fns';
import { tr } from 'date-fns/locale';
import { supabase } from '@/lib/customSupabaseClient';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useData } from '@/contexts/DataContext';
import { cn } from '@/lib/utils';
import {
    AlertTriangle,
    CheckCircle2,
    Eye,
    Link2,
    Save,
    Target,
} from 'lucide-react';
import {
    VEHICLE_METRIC_ORDER,
    formatVehicleMetricDelta,
    formatVehicleMetricValue,
    getVehicleMetricContribution,
    getVehicleMetricDefinition,
    getVehicleMetricRecords,
} from '@/components/quality-cost/vehicleMetricConfig';

const formatCurrency = (value) =>
    (value || 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });

const formatNumber = (value) =>
    (value || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const buildMonthKey = (dateValue) => format(new Date(dateValue), 'yyyy-MM');

const CustomTooltip = ({ active, payload, label, unit, isCurrency }) => {
    if (!active || !payload || !payload.length) return null;

    return (
        <div className="bg-background/95 p-3 border border-border rounded-lg shadow-lg text-sm">
            <p className="font-bold">{label}</p>
            {payload.map((entry) => (
                <p key={entry.dataKey} style={{ color: entry.color }}>
                    {entry.name}:{' '}
                    {isCurrency
                        ? formatCurrency(entry.value)
                        : `${formatNumber(entry.value)} ${unit}`}
                </p>
            ))}
        </div>
    );
};

const PerformanceChart = ({ data, metric }) => (
    <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data} margin={{ top: 12, right: 24, left: 12, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
            <XAxis dataKey="name" fontSize={12} />
            <YAxis
                fontSize={12}
                tickFormatter={(value) => (metric.definition.isCurrency ? value.toLocaleString('tr-TR') : value)}
                domain={[0, 'auto']}
            />
            <Tooltip
                content={(
                    <CustomTooltip
                        unit={metric.definition.chartUnit}
                        isCurrency={metric.definition.isCurrency}
                    />
                )}
            />
            <Legend />
            <Line
                type="monotone"
                dataKey={metric.definition.chartKey}
                name={metric.definition.label}
                stroke={metric.definition.color}
                strokeWidth={2.5}
                dot={{ r: 4 }}
                activeDot={{ r: 7 }}
            />
            {metric.targetValue > 0 && (
                <ReferenceLine
                    y={metric.targetValue}
                    label={{
                        value: metric.definition.isCurrency
                            ? `Hedef: ${formatCurrency(metric.targetValue)}`
                            : `Hedef: ${formatNumber(metric.targetValue)} ${metric.definition.chartUnit}`,
                        position: 'insideTopRight',
                        fill: '#71717a',
                    }}
                    stroke="#71717a"
                    strokeDasharray="4 4"
                />
            )}
        </LineChart>
    </ResponsiveContainer>
);

const TargetManagementModal = ({ isOpen, setIsOpen, targets, onUpdate, vehicleType }) => {
    const [editableTargets, setEditableTargets] = useState({});
    const { toast } = useToast();

    useEffect(() => {
        const nextTargets = {};
        VEHICLE_METRIC_ORDER.forEach((metricKey) => {
            const definition = getVehicleMetricDefinition(metricKey);
            nextTargets[metricKey] = {
                value: Number(targets[metricKey]?.value) || 0,
                unit: definition.unit,
            };
        });
        setEditableTargets(nextTargets);
    }, [isOpen, targets]);

    const handleSave = async () => {
        const upsertData = Object.entries(editableTargets).map(([metricKey, target]) => ({
            target_type: metricKey,
            vehicle_type: vehicleType,
            value: Number(target.value) || 0,
            unit: getVehicleMetricDefinition(metricKey).unit,
        }));

        const { error } = await supabase
            .from('quality_cost_targets')
            .upsert(upsertData, { onConflict: 'target_type,vehicle_type' });

        if (error) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: `Hedefler güncellenirken hata oluştu: ${error.message}`,
            });
            return;
        }

        toast({
            title: 'Başarılı',
            description: `${vehicleType} için hedefler güncellendi.`,
        });

        await onUpdate?.();
        setIsOpen(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{vehicleType} - Performans Hedefleri</DialogTitle>
                    <DialogDescription>
                        Araç tipi bazlı hedefleri güncelleyin. Bu hedefler detay analiz kartlarında ve kayıt kırılımlarında kullanılacaktır.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {VEHICLE_METRIC_ORDER.map((metricKey) => {
                        const definition = getVehicleMetricDefinition(metricKey);
                        return (
                            <div key={metricKey} className="grid grid-cols-3 items-center gap-4">
                                <Label htmlFor={metricKey} className="text-right">
                                    {definition.label}
                                </Label>
                                <Input
                                    id={metricKey}
                                    type="number"
                                    value={editableTargets[metricKey]?.value ?? 0}
                                    onChange={(event) => {
                                        const nextValue = Number(event.target.value) || 0;
                                        setEditableTargets((current) => ({
                                            ...current,
                                            [metricKey]: {
                                                ...current[metricKey],
                                                value: nextValue,
                                            },
                                        }));
                                    }}
                                    className="col-span-2"
                                />
                            </div>
                        );
                    })}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>İptal</Button>
                    <Button onClick={handleSave}>
                        <Save className="mr-2 h-4 w-4" />
                        Kaydet
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const VehiclePerformanceModal = ({
    isOpen,
    setIsOpen,
    vehicleType,
    costs,
    producedVehicles,
    dateRange,
    onTargetsUpdate,
    onCreateNC,
    onOpenNCView,
    hasNCAccess,
}) => {
    const [targets, setTargets] = useState({});
    const [isTargetModalOpen, setTargetModalOpen] = useState(false);
    const [activeMetricKey, setActiveMetricKey] = useState(VEHICLE_METRIC_ORDER[0]);
    const { nonConformities } = useData();

    const fetchTargets = async () => {
        const { data, error } = await supabase.from('quality_cost_targets').select('*');
        if (error || !data) return;

        const nextTargets = {};
        data
            .filter((target) => target.vehicle_type === vehicleType || target.vehicle_type == null)
            .sort((left, right) => {
                if (left.vehicle_type === vehicleType && right.vehicle_type !== vehicleType) return -1;
                if (right.vehicle_type === vehicleType && left.vehicle_type !== vehicleType) return 1;
                return 0;
            })
            .forEach((target) => {
                if (!nextTargets[target.target_type]) {
                    nextTargets[target.target_type] = {
                        value: target.value,
                        unit: target.unit,
                    };
                }
            });

        setTargets(nextTargets);
        onTargetsUpdate?.();
    };

    useEffect(() => {
        if (isOpen) {
            fetchTargets();
        }
    }, [isOpen, vehicleType]);

    const relatedNCMap = useMemo(() => {
        const map = {};
        (nonConformities || []).forEach((record) => {
            if (!record.source_cost_id) return;
            if (!map[record.source_cost_id]) {
                map[record.source_cost_id] = [];
            }
            map[record.source_cost_id].push(record);
        });
        return map;
    }, [nonConformities]);

    const monthlyData = useMemo(() => {
        if (!costs?.length && !producedVehicles?.length) {
            return {
                monthlyTotals: [],
                totalVehicles: 0,
            };
        }

        const monthlyAggregates = {};
        const producedCountsByMonth = {};
        const allDates = [];
        const fallbackSourceIds = new Set();

        (producedVehicles || []).forEach((vehicle) => {
            const vehicleDate = vehicle.created_at || vehicle.production_date;
            if (!vehicleDate || !isValid(new Date(vehicleDate))) return;
            const monthKey = buildMonthKey(vehicleDate);
            producedCountsByMonth[monthKey] = (producedCountsByMonth[monthKey] || 0) + 1;
            allDates.push(new Date(vehicleDate));
        });

        (costs || []).forEach((cost) => {
            if (!cost.cost_date || !isValid(new Date(cost.cost_date))) return;

            const costDate = new Date(cost.cost_date);
            const monthKey = buildMonthKey(cost.cost_date);
            allDates.push(costDate);

            if (!monthlyAggregates[monthKey]) {
                monthlyAggregates[monthKey] = {
                    name: format(costDate, 'MMM yy', { locale: tr }),
                    sourceRecordIds: new Set(),
                    totals: VEHICLE_METRIC_ORDER.reduce((accumulator, metricKey) => {
                        accumulator[metricKey] = 0;
                        return accumulator;
                    }, {}),
                };
            }

            const fallbackSourceId = cost.source_record_id || cost.id;
            monthlyAggregates[monthKey].sourceRecordIds.add(fallbackSourceId);
            fallbackSourceIds.add(fallbackSourceId);

            VEHICLE_METRIC_ORDER.forEach((metricKey) => {
                monthlyAggregates[monthKey].totals[metricKey] += getVehicleMetricContribution(cost, metricKey);
            });
        });

        if (!allDates.length) {
            return {
                monthlyTotals: [],
                totalVehicles: producedVehicles?.length || fallbackSourceIds.size || 0,
            };
        }

        const sortedDates = [...allDates].sort((left, right) => left - right);
        const firstMonth = dateRange?.startDate
            ? startOfMonth(new Date(dateRange.startDate))
            : startOfMonth(sortedDates[0]);
        const lastMonth = dateRange?.endDate
            ? startOfMonth(new Date(dateRange.endDate))
            : startOfMonth(sortedDates[sortedDates.length - 1]);

        const monthInterval = eachMonthOfInterval({ start: firstMonth, end: lastMonth });
        const monthlyTotals = monthInterval.map((month) => {
            const monthKey = format(month, 'yyyy-MM');
            const aggregate = monthlyAggregates[monthKey];
            const denominator = producedCountsByMonth[monthKey] || aggregate?.sourceRecordIds.size || 0;

            const baseData = {
                name: format(month, 'MMM yy', { locale: tr }),
                producedVehicles: denominator,
            };

            VEHICLE_METRIC_ORDER.forEach((metricKey) => {
                const definition = getVehicleMetricDefinition(metricKey);
                const totalValue = aggregate?.totals?.[metricKey] || 0;
                baseData[definition.chartKey] = denominator > 0 ? totalValue / denominator : 0;
            });

            return baseData;
        });

        return {
            monthlyTotals,
            totalVehicles: producedVehicles?.length || fallbackSourceIds.size || 0,
        };
    }, [costs, dateRange, producedVehicles]);

    const metricAnalyses = useMemo(() => (
        VEHICLE_METRIC_ORDER.map((metricKey) => {
            const definition = getVehicleMetricDefinition(metricKey);
            const records = getVehicleMetricRecords(costs || [], metricKey)
                .map((record) => ({
                    ...record,
                    contribution: getVehicleMetricContribution(record, metricKey),
                    linkedNCs: relatedNCMap[record.id] || [],
                }))
                .sort((left, right) => {
                    if (right.contribution !== left.contribution) {
                        return right.contribution - left.contribution;
                    }
                    return new Date(right.cost_date || 0) - new Date(left.cost_date || 0);
                });

            const totalContribution = records.reduce((sum, record) => sum + record.contribution, 0);
            const targetValue = Number(targets[metricKey]?.value) || 0;
            const currentValue = monthlyData.totalVehicles > 0
                ? totalContribution / monthlyData.totalVehicles
                : 0;
            const uniqueLinkedNCCount = new Set(
                records.flatMap((record) => record.linkedNCs.map((linkedNC) => linkedNC.id))
            ).size;

            return {
                key: metricKey,
                definition,
                records,
                totalContribution,
                targetValue,
                currentValue,
                difference: targetValue > 0 ? currentValue - targetValue : null,
                isOverTarget: targetValue > 0 && currentValue > targetValue,
                uniqueLinkedNCCount,
            };
        })
    ), [costs, monthlyData.totalVehicles, relatedNCMap, targets]);

    useEffect(() => {
        if (!isOpen) return;
        const firstOverTargetMetric = metricAnalyses.find((metric) => metric.isOverTarget);
        setActiveMetricKey(firstOverTargetMetric?.key || VEHICLE_METRIC_ORDER[0]);
    }, [isOpen, metricAnalyses, vehicleType]);

    const activeMetric = metricAnalyses.find((metric) => metric.key === activeMetricKey) || metricAnalyses[0];
    const overTargetCount = metricAnalyses.filter((metric) => metric.isOverTarget).length;
    const totalLinkedNCCount = useMemo(() => new Set(
        metricAnalyses.flatMap((metric) =>
            metric.records.flatMap((record) => record.linkedNCs.map((linkedNC) => linkedNC.id))
        )
    ).size, [metricAnalyses]);

    const handleCreateNC = (costRecord, ncType) => {
        if (!activeMetric || !onCreateNC) return;

        onCreateNC(costRecord, ncType, {
            vehicleType,
            metricKey: activeMetric.key,
            metricLabel: activeMetric.definition.label,
            actualValue: activeMetric.currentValue,
            targetValue: activeMetric.targetValue,
            totalContribution: activeMetric.totalContribution,
            totalVehicles: monthlyData.totalVehicles,
            dateRangeLabel: dateRange?.label || 'Tüm Zamanlar',
        });
    };

    return (
        <>
            <TargetManagementModal
                isOpen={isTargetModalOpen}
                setIsOpen={setTargetModalOpen}
                targets={targets}
                onUpdate={fetchTargets}
                vehicleType={vehicleType}
            />

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
                    <DialogHeader className="px-6 pt-6 pb-4 border-b">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                                <DialogTitle className="text-2xl">{vehicleType} - Araç Bazlı Detay Analiz</DialogTitle>
                                <DialogDescription className="mt-1">
                                    {dateRange?.label || 'Tüm Zamanlar'} dönemi için {monthlyData.totalVehicles} araç baz alınarak hesaplandı.
                                    Karttaki rakamların hangi kalite maliyeti kayıtlarından geldiğini burada görebilir, aynı listeden DF/8D/MDI başlatabilirsiniz.
                                </DialogDescription>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => setTargetModalOpen(true)}>
                                <Target className="mr-2 h-4 w-4" />
                                Hedefleri Yönet
                            </Button>
                        </div>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Card>
                                <CardContent className="pt-6">
                                    <p className="text-sm text-muted-foreground">Analize Giren Araç</p>
                                    <p className="text-2xl font-bold">{monthlyData.totalVehicles}</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="pt-6">
                                    <p className="text-sm text-muted-foreground">Hedef Aşan Metrik</p>
                                    <p className="text-2xl font-bold text-red-600">{overTargetCount}</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="pt-6">
                                    <p className="text-sm text-muted-foreground">Bağlı DF/8D/MDI</p>
                                    <p className="text-2xl font-bold">{totalLinkedNCCount}</p>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
                            {metricAnalyses.map((metric) => {
                                const isActive = metric.key === activeMetricKey;
                                return (
                                    <button
                                        key={metric.key}
                                        type="button"
                                        onClick={() => setActiveMetricKey(metric.key)}
                                        className={cn(
                                            'rounded-xl border p-4 text-left transition-all',
                                            isActive && 'border-primary ring-2 ring-primary/20 bg-primary/5',
                                            !isActive && 'hover:border-primary/40'
                                        )}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <p className="text-sm font-semibold">{metric.definition.label}</p>
                                            {metric.isOverTarget ? (
                                                <Badge variant="destructive" className="gap-1">
                                                    <AlertTriangle className="h-3 w-3" />
                                                    Aşıldı
                                                </Badge>
                                            ) : metric.targetValue > 0 ? (
                                                <Badge variant="secondary" className="gap-1">
                                                    <CheckCircle2 className="h-3 w-3" />
                                                    Hedefte
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline">Hedef yok</Badge>
                                            )}
                                        </div>
                                        <p className="mt-3 text-xl font-bold">
                                            {formatVehicleMetricValue(metric.currentValue, metric.key)}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Hedef:{' '}
                                            {metric.targetValue > 0
                                                ? formatVehicleMetricValue(metric.targetValue, metric.key)
                                                : 'Tanımsız'}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-3">
                                            {metric.records.length} kayıt • {metric.uniqueLinkedNCCount} bağlı aksiyon
                                        </p>
                                    </button>
                                );
                            })}
                        </div>

                        {activeMetric && (
                            <>
                                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)] gap-6">
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>{activeMetric.definition.label} - Aylık Trend</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            {monthlyData.monthlyTotals.length > 0 ? (
                                                <PerformanceChart data={monthlyData.monthlyTotals} metric={activeMetric} />
                                            ) : (
                                                <div className="h-[320px] flex items-center justify-center text-muted-foreground">
                                                    Grafik için yeterli veri bulunamadı.
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Metrik Özeti</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <div className="rounded-lg border p-3">
                                                    <p className="text-xs text-muted-foreground">Gerçekleşen</p>
                                                    <p className="text-lg font-bold">
                                                        {formatVehicleMetricValue(activeMetric.currentValue, activeMetric.key)}
                                                    </p>
                                                </div>
                                                <div className="rounded-lg border p-3">
                                                    <p className="text-xs text-muted-foreground">Hedef</p>
                                                    <p className="text-lg font-bold">
                                                        {activeMetric.targetValue > 0
                                                            ? formatVehicleMetricValue(activeMetric.targetValue, activeMetric.key)
                                                            : 'Tanımsız'}
                                                    </p>
                                                </div>
                                                <div className="rounded-lg border p-3">
                                                    <p className="text-xs text-muted-foreground">Toplam Katkı</p>
                                                    <p className="text-lg font-bold">
                                                        {formatVehicleMetricDelta(activeMetric.totalContribution, activeMetric.key)}
                                                    </p>
                                                </div>
                                                <div className="rounded-lg border p-3">
                                                    <p className="text-xs text-muted-foreground">Kayıt Sayısı</p>
                                                    <p className="text-lg font-bold">{activeMetric.records.length}</p>
                                                </div>
                                            </div>

                                            <div
                                                className={cn(
                                                    'rounded-lg border p-4',
                                                    activeMetric.isOverTarget && 'border-red-200 bg-red-50/60',
                                                    !activeMetric.isOverTarget && activeMetric.targetValue > 0 && 'border-green-200 bg-green-50/60',
                                                    activeMetric.targetValue <= 0 && 'border-border'
                                                )}
                                            >
                                                <div className="flex items-center gap-2 font-semibold">
                                                    {activeMetric.isOverTarget ? (
                                                        <>
                                                            <AlertTriangle className="h-4 w-4 text-red-600" />
                                                            Hedef aşıldı
                                                        </>
                                                    ) : activeMetric.targetValue > 0 ? (
                                                        <>
                                                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                                                            Hedef içinde
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Target className="h-4 w-4 text-muted-foreground" />
                                                            Hedef tanımlanmamış
                                                        </>
                                                    )}
                                                </div>
                                                {activeMetric.targetValue > 0 && (
                                                    <p className="text-sm mt-2 text-muted-foreground">
                                                        Sapma: {formatVehicleMetricDelta(Math.abs(activeMetric.difference || 0), activeMetric.key)}
                                                        {' '}({activeMetric.difference > 0 ? 'üstünde' : 'altında'})
                                                    </p>
                                                )}
                                                <p className="text-sm mt-2 text-muted-foreground">
                                                    Bu metrikteki değerler {activeMetric.records.length} kalite maliyeti kaydından toplanıyor.
                                                </p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>

                                <Card>
                                    <CardHeader>
                                        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                                            <div>
                                                <CardTitle>{activeMetric.definition.label} Kaynak Kayıtları</CardTitle>
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    Kartta gördüğünüz rakam bu listedeki kayıtların toplamından oluşur. İsterseniz aynı satırdan bağlı aksiyonu açabilir veya yeni DF/8D/MDI başlatabilirsiniz.
                                                </p>
                                            </div>
                                            <Badge variant="outline" className="w-fit gap-1">
                                                <Link2 className="h-3 w-3" />
                                                {activeMetric.uniqueLinkedNCCount} bağlı uygunsuzluk
                                            </Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        {activeMetric.records.length === 0 ? (
                                            <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                                                Bu metrik için seçili dönemde kayıt bulunamadı.
                                            </div>
                                        ) : (
                                            <div className="border rounded-lg overflow-auto max-h-[420px]">
                                                <table className="w-full text-sm min-w-[1100px]">
                                                    <thead className="bg-muted/50 sticky top-0">
                                                        <tr className="border-b">
                                                            <th className="text-left px-3 py-2 font-medium">Tarih</th>
                                                            <th className="text-left px-3 py-2 font-medium">Maliyet Türü</th>
                                                            <th className="text-left px-3 py-2 font-medium">Birim</th>
                                                            <th className="text-left px-3 py-2 font-medium">Parça</th>
                                                            <th className="text-right px-3 py-2 font-medium">Toplam Tutar</th>
                                                            <th className="text-right px-3 py-2 font-medium">Metrik Katkısı</th>
                                                            <th className="text-left px-3 py-2 font-medium">Bağlı DF/8D/MDI</th>
                                                            <th className="text-right px-3 py-2 font-medium">İşlemler</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {activeMetric.records.map((record) => (
                                                            <tr key={`${activeMetric.key}-${record.id}`} className="border-b last:border-b-0">
                                                                <td className="px-3 py-2 whitespace-nowrap">
                                                                    {record.cost_date
                                                                        ? new Date(record.cost_date).toLocaleDateString('tr-TR')
                                                                        : '-'}
                                                                </td>
                                                                <td className="px-3 py-2">{record.cost_type || '-'}</td>
                                                                <td className="px-3 py-2">{record.unit || record.supplier?.name || '-'}</td>
                                                                <td className="px-3 py-2">
                                                                    <div className="max-w-[220px]">
                                                                        <p className="font-medium">{record.part_code || record.part_name || '-'}</p>
                                                                        {record.part_name && record.part_code && (
                                                                            <p className="text-xs text-muted-foreground truncate">{record.part_name}</p>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="px-3 py-2 text-right font-medium">
                                                                    {formatCurrency(record.amount || 0)}
                                                                </td>
                                                                <td className="px-3 py-2 text-right font-medium">
                                                                    {formatVehicleMetricDelta(record.contribution, activeMetric.key)}
                                                                </td>
                                                                <td className="px-3 py-2">
                                                                    {record.linkedNCs.length > 0 ? (
                                                                        <div className="flex flex-wrap gap-1">
                                                                            {record.linkedNCs.map((linkedNC) => (
                                                                                <Button
                                                                                    key={linkedNC.id}
                                                                                    type="button"
                                                                                    variant="outline"
                                                                                    size="sm"
                                                                                    className="h-7 px-2 text-xs"
                                                                                    onClick={() => onOpenNCView?.(linkedNC)}
                                                                                >
                                                                                    <Eye className="mr-1 h-3 w-3" />
                                                                                    {linkedNC.nc_number || linkedNC.mdi_no || linkedNC.type}
                                                                                </Button>
                                                                            ))}
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-xs text-muted-foreground">Bağlı kayıt yok</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-3 py-2 text-right">
                                                                    {hasNCAccess ? (
                                                                        <div className="flex justify-end gap-1">
                                                                            <Button
                                                                                type="button"
                                                                                variant="outline"
                                                                                size="sm"
                                                                                onClick={() => handleCreateNC(record, 'DF')}
                                                                            >
                                                                                DF
                                                                            </Button>
                                                                            <Button
                                                                                type="button"
                                                                                variant="outline"
                                                                                size="sm"
                                                                                onClick={() => handleCreateNC(record, '8D')}
                                                                            >
                                                                                8D
                                                                            </Button>
                                                                            <Button
                                                                                type="button"
                                                                                variant="outline"
                                                                                size="sm"
                                                                                onClick={() => handleCreateNC(record, 'MDI')}
                                                                            >
                                                                                MDI
                                                                            </Button>
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-xs text-muted-foreground">Yetki yok</span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </>
                        )}
                    </div>

                    <DialogFooter className="px-6 py-4 border-t">
                        <Button variant="outline" onClick={() => setIsOpen(false)}>Kapat</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default VehiclePerformanceModal;
