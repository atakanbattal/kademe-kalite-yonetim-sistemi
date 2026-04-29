import React, { useCallback, useEffect, useMemo, memo, useState } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { getCanonicalUnitLabel } from '@/lib/qualityCostUnitGroups';
import { cn } from '@/lib/utils';
import {
    AlertTriangle,
    CheckCircle2,
    Eye,
    Link2,
    Save,
    Settings2,
    Target,
} from 'lucide-react';
import {
    getCostNcSuggestion,
    getPartRecurrenceCount,
    normalizeQualityCostSuggestionSettings,
} from '@/lib/qualityCostSuggestion';
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

const PerformanceChart = memo(function PerformanceChart({ data, metric }) {
    return (
        <ResponsiveContainer width="100%" height={280} debounce={50}>
            <LineChart data={data} margin={{ top: 12, right: 24, left: 12, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis
                    fontSize={11}
                    tickFormatter={(value) => (metric.definition.isCurrency ? value.toLocaleString('tr-TR') : value)}
                    domain={[0, 'auto']}
                />
                <Tooltip
                    content={(
                        <CustomTooltip
                            unit={metric.definition.isCurrency ? metric.definition.chartUnit : metric.definition.unit}
                            isCurrency={metric.definition.isCurrency}
                        />
                    )}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                    type="monotone"
                    dataKey={metric.definition.chartKey}
                    name={metric.definition.label}
                    stroke={metric.definition.color}
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    activeDot={{ r: 6 }}
                    isAnimationActive={false}
                />
                {metric.targetValue > 0 && (
                    <ReferenceLine
                        y={metric.targetValue}
                        label={{
                            value: metric.definition.isCurrency
                                ? `Hedef: ${formatCurrency(metric.targetValue)}`
                                : `Hedef: ${formatNumber(metric.targetValue)} ${metric.definition.unit}`,
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
});

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
            <DialogContent className="max-h-[90vh] overflow-y-auto">
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
                                <Label htmlFor={`perf-${metricKey}`} className="text-right">
                                    {definition.label}
                                </Label>
                                <Input
                                    id={`perf-${metricKey}`}
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

const SuggestionSettingsDialog = ({ open, onOpenChange, settings, onSave, saving }) => {
    const [draft, setDraft] = useState(() => normalizeQualityCostSuggestionSettings(settings));

    useEffect(() => {
        if (open) setDraft(normalizeQualityCostSuggestionSettings(settings));
    }, [open, settings]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Settings2 className="h-5 w-5" />
                        DF / 8D / MDI öneri eşikleri
                    </DialogTitle>
                    <DialogDescription>
                        Uygunsuzluk yönetimindeki mantığa benzer: önce tek kayıt tutarı, sonra aynı parça kodunda tekrar sayısı
                        (seçili dönemdeki tüm maliyet kayıtlarından) değerlendirilir.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
                        <div>
                            <p className="text-sm font-medium">Otomatik öneri</p>
                            <p className="text-xs text-muted-foreground">Kapalıysa öneri sütunu ve vurgular gösterilmez.</p>
                        </div>
                        <Switch
                            checked={draft.auto_suggest}
                            onCheckedChange={(checked) => setDraft((d) => ({ ...d, auto_suggest: checked }))}
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-2 p-3 rounded-lg border bg-blue-50/50 dark:bg-blue-950/20">
                            <Label className="text-xs font-semibold text-blue-800 dark:text-blue-300">DF — tek kayıt tutarı (₺)</Label>
                            <p className="text-[10px] text-muted-foreground">
                                Bu tutarı geçen tek maliyet kaydı için DF önerilir.
                            </p>
                            <Input
                                type="number"
                                min={0}
                                step={1000}
                                value={draft.df_cost_threshold_try}
                                onChange={(e) => setDraft((d) => ({ ...d, df_cost_threshold_try: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2 p-3 rounded-lg border bg-red-50/50 dark:bg-red-950/20">
                            <Label className="text-xs font-semibold text-red-800 dark:text-red-300">8D — tek kayıt tutarı (₺)</Label>
                            <p className="text-[10px] text-muted-foreground">
                                Bu tutarı geçen tek kayıt için 8D önerilir (DF önceliğinden önce).
                            </p>
                            <Input
                                type="number"
                                min={0}
                                step={1000}
                                value={draft.eight_d_cost_threshold_try}
                                onChange={(e) => setDraft((d) => ({ ...d, eight_d_cost_threshold_try: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2 p-3 rounded-lg border bg-amber-50/50 dark:bg-amber-950/20">
                            <Label className="text-xs font-semibold text-amber-800 dark:text-amber-300">MDI — tek kayıt tutarı (₺)</Label>
                            <p className="text-[10px] text-muted-foreground">
                                Tutar eşikleri karşılanmazsa; bu eşiği geçen kayıt için MDI önerilir.
                            </p>
                            <Input
                                type="number"
                                min={0}
                                step={1000}
                                value={draft.mdi_cost_threshold_try}
                                onChange={(e) => setDraft((d) => ({ ...d, mdi_cost_threshold_try: e.target.value }))}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-2 p-3 rounded-lg border">
                            <Label className="text-xs font-semibold">DF — parça tekrarı (adet)</Label>
                            <p className="text-[10px] text-muted-foreground">
                                Bu parça kodu seçili dönemde kaç kez geçersse DF önerilir.
                            </p>
                            <Input
                                type="number"
                                min={1}
                                max={100}
                                value={draft.df_recurrence_threshold}
                                onChange={(e) => setDraft((d) => ({ ...d, df_recurrence_threshold: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2 p-3 rounded-lg border">
                            <Label className="text-xs font-semibold">8D — parça tekrarı (adet)</Label>
                            <p className="text-[10px] text-muted-foreground">
                                Aynı parça kodu bu kadar kayıtta geçerse 8D önerilir.
                            </p>
                            <Input
                                type="number"
                                min={1}
                                max={100}
                                value={draft.eight_d_recurrence_threshold}
                                onChange={(e) => setDraft((d) => ({ ...d, eight_d_recurrence_threshold: e.target.value }))}
                            />
                        </div>
                    </div>

                    <div className="space-y-2 p-3 rounded-lg border">
                        <Label className="text-xs font-semibold">Referans periyodu (gün)</Label>
                        <p className="text-[10px] text-muted-foreground">
                            İleride tarih penceresi ile tekrar hesabı için saklanır; şu an açıklama amaçlıdır.
                        </p>
                        <Input
                            type="number"
                            min={1}
                            max={365}
                            value={draft.threshold_period_days}
                            onChange={(e) => setDraft((d) => ({ ...d, threshold_period_days: e.target.value }))}
                            className="max-w-[120px]"
                        />
                    </div>

                    <div className="p-3 rounded-lg bg-muted/40 border text-[11px] text-muted-foreground space-y-1">
                        <p className="font-semibold text-foreground">Öncelik sırası</p>
                        <p>1) Tek kayıt tutarı (8D eşiği → DF eşiği)</p>
                        <p>2) Aynı parça kodunda tekrar sayısı (8D eşiği → DF eşiği)</p>
                        <p>3) MDI tutar eşiği</p>
                    </div>
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                        İptal
                    </Button>
                    <Button type="button" disabled={saving} onClick={() => onSave(draft)}>
                        <Save className="mr-2 h-4 w-4" />
                        {saving ? 'Kaydediliyor…' : 'Kaydet'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

/**
 * Aylık trend, metrik kartları, kaynak kayıtlar ve DF/8D/MDI — CostDrillDownModal içinde sekme olarak kullanılır.
 */
const VehiclePerformancePanel = ({
    vehicleType,
    costs,
    producedVehicles,
    dateRange,
    onTargetsUpdate,
    onCreateNC,
    onOpenNCView,
    hasNCAccess,
}) => {
    const { toast } = useToast();
    const [targets, setTargets] = useState({});
    const [isTargetModalOpen, setTargetModalOpen] = useState(false);
    const [activeMetricKey, setActiveMetricKey] = useState(VEHICLE_METRIC_ORDER[0]);
    const [suggestionSettings, setSuggestionSettings] = useState(() => normalizeQualityCostSuggestionSettings(null));
    const [suggestionSettingsOpen, setSuggestionSettingsOpen] = useState(false);
    const [savingSuggestionSettings, setSavingSuggestionSettings] = useState(false);
    const { nonConformities, unitCostSettings, personnel } = useData();
    const canonicalUnitCtx = useMemo(
        () => ({ unitCostSettings: unitCostSettings || [], personnel: personnel || [] }),
        [unitCostSettings, personnel]
    );

    const fetchSuggestionSettings = useCallback(async () => {
        try {
            const { data, error } = await supabase.from('quality_cost_suggestion_settings').select('*').limit(1).maybeSingle();
            if (error && error.code !== 'PGRST116') {
                console.warn('quality_cost_suggestion_settings:', error.message);
            }
            setSuggestionSettings(normalizeQualityCostSuggestionSettings(data));
        } catch (e) {
            console.warn(e);
            setSuggestionSettings(normalizeQualityCostSuggestionSettings(null));
        }
    }, []);

    useEffect(() => {
        void fetchSuggestionSettings();
    }, [fetchSuggestionSettings]);

    const handleSaveSuggestionSettings = useCallback(
        async (draft) => {
            const row = normalizeQualityCostSuggestionSettings(draft);
            setSavingSuggestionSettings(true);
            try {
                const payload = {
                    df_cost_threshold_try: row.df_cost_threshold_try,
                    eight_d_cost_threshold_try: row.eight_d_cost_threshold_try,
                    mdi_cost_threshold_try: row.mdi_cost_threshold_try,
                    df_recurrence_threshold: row.df_recurrence_threshold,
                    eight_d_recurrence_threshold: row.eight_d_recurrence_threshold,
                    threshold_period_days: row.threshold_period_days,
                    auto_suggest: row.auto_suggest,
                    updated_at: new Date().toISOString(),
                };
                let result;
                if (row.id) {
                    result = await supabase.from('quality_cost_suggestion_settings').update(payload).eq('id', row.id).select().single();
                } else {
                    result = await supabase.from('quality_cost_suggestion_settings').insert(payload).select().single();
                }
                if (result.error) {
                    toast({ variant: 'destructive', title: 'Kayıt hatası', description: result.error.message });
                    return;
                }
                setSuggestionSettings(normalizeQualityCostSuggestionSettings(result.data));
                setSuggestionSettingsOpen(false);
                toast({ title: 'Kaydedildi', description: 'Öneri eşikleri güncellendi.' });
            } finally {
                setSavingSuggestionSettings(false);
            }
        },
        [toast]
    );

    const costSuggestionById = useMemo(() => {
        const m = new Map();
        const list = Array.isArray(costs) ? costs : [];
        for (const c of list) {
            if (!c?.id) continue;
            m.set(c.id, getCostNcSuggestion(c, list, suggestionSettings));
        }
        return m;
    }, [costs, suggestionSettings]);

    const fetchTargets = useCallback(async () => {
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
    }, [vehicleType]);

    /** Sadece hedef kaydı sonrası üst bileşenleri yenile — fetch ile her seferinde tetiklenmez (takılma döngüsünü önler). */
    const handleTargetsSaved = useCallback(async () => {
        await fetchTargets();
        onTargetsUpdate?.();
    }, [fetchTargets, onTargetsUpdate]);

    useEffect(() => {
        if (vehicleType) {
            void fetchTargets();
        }
    }, [vehicleType, fetchTargets]);

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
        setActiveMetricKey(VEHICLE_METRIC_ORDER[0]);
    }, [vehicleType]);

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
                onUpdate={handleTargetsSaved}
                vehicleType={vehicleType}
            />

            <SuggestionSettingsDialog
                open={suggestionSettingsOpen}
                onOpenChange={setSuggestionSettingsOpen}
                settings={suggestionSettings}
                onSave={handleSaveSuggestionSettings}
                saving={savingSuggestionSettings}
            />

            <div className="space-y-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <p className="text-sm text-muted-foreground max-w-3xl">
                        {dateRange?.label || 'Tüm Zamanlar'} dönemi için {monthlyData.totalVehicles} araç baz alınarak hesaplandı.
                        Aşağıdan metrik seçin; trend grafiği, kaynak kayıtlar ve bağlı DF/8D/MDI işlemlerine erişin.
                        Öneri sütunu, kaydettiğiniz eşiklere göre DF / 8D / MDI önerir.
                    </p>
                    <div className="flex flex-wrap gap-2 shrink-0 justify-end">
                        <Button type="button" variant="outline" size="sm" onClick={() => setSuggestionSettingsOpen(true)}>
                            <Settings2 className="mr-2 h-4 w-4" />
                            Öneri eşikleri
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => setTargetModalOpen(true)}>
                            <Target className="mr-2 h-4 w-4" />
                            Hedefleri Yönet
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Card>
                        <CardContent className="pt-5 pb-4">
                            <p className="text-xs text-muted-foreground">Analize giren araç</p>
                            <p className="text-2xl font-bold tabular-nums">{monthlyData.totalVehicles}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-5 pb-4">
                            <p className="text-xs text-muted-foreground">Hedef aşan metrik</p>
                            <p className="text-2xl font-bold text-red-600 tabular-nums">{overTargetCount}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-5 pb-4">
                            <p className="text-xs text-muted-foreground">Bağlı DF / 8D / MDI</p>
                            <p className="text-2xl font-bold tabular-nums">{totalLinkedNCCount}</p>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2">
                    {metricAnalyses.map((metric) => {
                        const isActive = metric.key === activeMetricKey;
                        return (
                            <button
                                key={metric.key}
                                type="button"
                                onClick={() => setActiveMetricKey(metric.key)}
                                className={cn(
                                    'rounded-xl border p-3 text-left transition-all text-sm',
                                    isActive && 'border-primary ring-2 ring-primary/20 bg-primary/5',
                                    !isActive && 'hover:border-primary/40'
                                )}
                            >
                                <div className="flex items-start justify-between gap-1">
                                    <p className="font-semibold leading-tight">{metric.definition.label}</p>
                                    {metric.isOverTarget ? (
                                        <Badge variant="destructive" className="gap-0.5 text-[10px] shrink-0 px-1.5">
                                            <AlertTriangle className="h-3 w-3" />
                                        </Badge>
                                    ) : metric.targetValue > 0 ? (
                                        <Badge variant="secondary" className="gap-0.5 text-[10px] shrink-0 px-1.5">
                                            <CheckCircle2 className="h-3 w-3" />
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="text-[10px]">—</Badge>
                                    )}
                                </div>
                                <p className="mt-2 text-lg font-bold tabular-nums">
                                    {formatVehicleMetricValue(metric.currentValue, metric.key)}
                                </p>
                                <p className="text-[10px] text-muted-foreground mt-1 truncate">
                                    {metric.records.length} kayıt · {metric.uniqueLinkedNCCount} aksiyon
                                </p>
                            </button>
                        );
                    })}
                </div>

                {activeMetric && (
                    <>
                        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.85fr)] gap-5">
                            <Card className="overflow-hidden">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">{activeMetric.definition.label} — Aylık trend</CardTitle>
                                </CardHeader>
                                <CardContent className="pb-4">
                                    {monthlyData.monthlyTotals.length > 0 ? (
                                        <PerformanceChart data={monthlyData.monthlyTotals} metric={activeMetric} />
                                    ) : (
                                        <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                                            Grafik için yeterli veri bulunamadı.
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">Metrik özeti</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3 text-sm">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="rounded-lg border p-2.5">
                                            <p className="text-[10px] text-muted-foreground">Gerçekleşen</p>
                                            <p className="font-bold tabular-nums">
                                                {formatVehicleMetricValue(activeMetric.currentValue, activeMetric.key)}
                                            </p>
                                        </div>
                                        <div className="rounded-lg border p-2.5">
                                            <p className="text-[10px] text-muted-foreground">Hedef</p>
                                            <p className="font-bold tabular-nums">
                                                {activeMetric.targetValue > 0
                                                    ? formatVehicleMetricValue(activeMetric.targetValue, activeMetric.key)
                                                    : 'Tanımsız'}
                                            </p>
                                        </div>
                                        <div className="rounded-lg border p-2.5">
                                            <p className="text-[10px] text-muted-foreground">Toplam katkı</p>
                                            <p className="font-bold tabular-nums">
                                                {formatVehicleMetricDelta(activeMetric.totalContribution, activeMetric.key)}
                                            </p>
                                        </div>
                                        <div className="rounded-lg border p-2.5">
                                            <p className="text-[10px] text-muted-foreground">Kayıt</p>
                                            <p className="font-bold tabular-nums">{activeMetric.records.length}</p>
                                        </div>
                                    </div>

                                    <div
                                        className={cn(
                                            'rounded-lg border p-3 text-xs',
                                            activeMetric.isOverTarget && 'border-red-200 bg-red-50/60 dark:bg-red-950/20',
                                            !activeMetric.isOverTarget && activeMetric.targetValue > 0 && 'border-green-200 bg-green-50/60 dark:bg-green-950/20',
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
                                            <p className="text-muted-foreground mt-2">
                                                Sapma: {formatVehicleMetricDelta(Math.abs(activeMetric.difference || 0), activeMetric.key)}
                                                {' '}({activeMetric.difference > 0 ? 'üstünde' : 'altında'})
                                            </p>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <Card>
                            <CardHeader className="pb-2">
                                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                                    <div>
                                        <CardTitle className="text-sm">{activeMetric.definition.label} — Kaynak kayıtlar</CardTitle>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Öneri sütunu eşik ayarlarınıza göre hesaplanır; vurgulu düğme önerilen türdür.
                                        </p>
                                    </div>
                                    <Badge variant="outline" className="w-fit gap-1 text-[10px]">
                                        <Link2 className="h-3 w-3" />
                                        {activeMetric.uniqueLinkedNCCount} bağlı
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {activeMetric.records.length === 0 ? (
                                    <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
                                        Bu metrik için seçili dönemde kayıt bulunamadı.
                                    </div>
                                ) : (
                                    <div className="border rounded-xl overflow-auto max-h-[min(420px,50vh)]">
                                        <table className="w-full text-xs min-w-[1180px]">
                                            <thead className="bg-muted/50 sticky top-0 z-[1]">
                                                <tr className="border-b">
                                                    <th className="text-left px-2 py-2 font-semibold">Tarih</th>
                                                    <th className="text-left px-2 py-2 font-semibold">Tür</th>
                                                    <th className="text-left px-2 py-2 font-semibold">Birim</th>
                                                    <th className="text-left px-2 py-2 font-semibold">Parça</th>
                                                    <th className="text-right px-2 py-2 font-semibold">Tutar</th>
                                                    <th className="text-right px-2 py-2 font-semibold">Katkı</th>
                                                    <th className="text-left px-2 py-2 font-semibold">Bağlı DF/8D/MDI</th>
                                                    <th className="text-center px-2 py-2 font-semibold w-[100px]">Öneri</th>
                                                    <th className="text-right px-2 py-2 font-semibold">İşlem</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {activeMetric.records.map((record) => {
                                                    const sug = costSuggestionById.get(record.id) ?? null;
                                                    const recurrence = getPartRecurrenceCount(record, costs);
                                                    return (
                                                    <tr key={`${activeMetric.key}-${record.id}`} className="border-b last:border-b-0 hover:bg-muted/20">
                                                        <td className="px-2 py-2 whitespace-nowrap tabular-nums">
                                                            {record.cost_date
                                                                ? new Date(record.cost_date).toLocaleDateString('tr-TR')
                                                                : '-'}
                                                        </td>
                                                        <td className="px-2 py-2 max-w-[120px] truncate">{record.cost_type || '-'}</td>
                                                        <td className="px-2 py-2">
                                                            {record.supplier?.name && record.is_supplier_nc
                                                                ? record.supplier.name
                                                                : record.unit
                                                                    ? getCanonicalUnitLabel(record.unit, canonicalUnitCtx)
                                                                    : '-'}
                                                        </td>
                                                        <td className="px-2 py-2 max-w-[200px]">
                                                            <span className="font-medium">{record.part_code || record.part_name || '-'}</span>
                                                        </td>
                                                        <td className="px-2 py-2 text-right font-medium tabular-nums">
                                                            {formatCurrency(record.amount || 0)}
                                                        </td>
                                                        <td className="px-2 py-2 text-right font-medium tabular-nums">
                                                            {formatVehicleMetricDelta(record.contribution, activeMetric.key)}
                                                        </td>
                                                        <td className="px-2 py-2">
                                                            {record.linkedNCs.length > 0 ? (
                                                                <div className="flex flex-wrap gap-1">
                                                                    {record.linkedNCs.map((linkedNC) => (
                                                                        <Button
                                                                            key={linkedNC.id}
                                                                            type="button"
                                                                            variant="outline"
                                                                            size="sm"
                                                                            className="h-7 px-2 text-[10px]"
                                                                            onClick={() => onOpenNCView?.(linkedNC)}
                                                                        >
                                                                            <Eye className="mr-1 h-3 w-3" />
                                                                            {linkedNC.nc_number || linkedNC.mdi_no || linkedNC.type}
                                                                        </Button>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <span className="text-muted-foreground">—</span>
                                                            )}
                                                        </td>
                                                        <td className="px-2 py-2 text-center align-top">
                                                            {suggestionSettings.auto_suggest && sug ? (
                                                                <div className="flex flex-col items-center gap-0.5">
                                                                    <Badge
                                                                        variant={sug === '8D' ? 'destructive' : sug === 'MDI' ? 'secondary' : 'default'}
                                                                        className="text-[10px] px-1.5"
                                                                    >
                                                                        {sug}
                                                                    </Badge>
                                                                    <span className="text-[10px] text-muted-foreground tabular-nums">
                                                                        Parça: {recurrence}
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-muted-foreground">—</span>
                                                            )}
                                                        </td>
                                                        <td className="px-2 py-2 text-right">
                                                            {hasNCAccess ? (
                                                                <div className="flex justify-end gap-1 flex-wrap">
                                                                    <Button
                                                                        type="button"
                                                                        variant={sug === 'DF' ? 'default' : 'outline'}
                                                                        size="sm"
                                                                        className="h-7 text-[10px] px-2"
                                                                        onClick={() => handleCreateNC(record, 'DF')}
                                                                    >
                                                                        DF
                                                                    </Button>
                                                                    <Button
                                                                        type="button"
                                                                        variant={sug === '8D' ? 'default' : 'outline'}
                                                                        size="sm"
                                                                        className={cn(
                                                                            'h-7 text-[10px] px-2',
                                                                            sug === '8D' && 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                                                                        )}
                                                                        onClick={() => handleCreateNC(record, '8D')}
                                                                    >
                                                                        8D
                                                                    </Button>
                                                                    <Button
                                                                        type="button"
                                                                        variant={sug === 'MDI' ? 'default' : 'outline'}
                                                                        size="sm"
                                                                        className="h-7 text-[10px] px-2"
                                                                        onClick={() => handleCreateNC(record, 'MDI')}
                                                                    >
                                                                        MDI
                                                                    </Button>
                                                                </div>
                                                            ) : (
                                                                <span className="text-muted-foreground">Yetki yok</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>
        </>
    );
};

export default memo(VehiclePerformancePanel);
