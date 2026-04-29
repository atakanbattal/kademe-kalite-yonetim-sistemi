import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
    Target,
    PieChart,
    TrendingUp,
    TrendingDown,
    Minus,
    CalendarRange,
    ListOrdered,
    Lightbulb,
    AlertTriangle,
    CheckCircle2,
    BarChart3,
    Sparkles,
    Loader2,
    LineChart,
    Edit,
    Trash2,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import {
    summarizeCostRows,
    classifyCostInternalExternal,
    getPreviousYearDateRangeInclusive,
    filterCostsInDateRangeInclusive,
    filterCostsByYear,
    filterCostsAlignedYearToDate,
    isFullCalendarYearInclusiveRange,
} from '@/lib/qualityCostAnalysis';
import {
    VEHICLE_METRIC_ORDER,
    formatVehicleMetricValue,
    getVehicleMetricContribution,
    getVehicleMetricDefinition,
} from '@/components/quality-cost/vehicleMetricConfig';
import { useData } from '@/contexts/DataContext';
import { supabase } from '@/lib/customSupabaseClient';
import { cn } from '@/lib/utils';
import VehiclePerformancePanel from '@/components/quality-cost/VehiclePerformancePanel';

import { getCanonicalUnitLabel } from '@/lib/qualityCostUnitGroups';

const formatCurrency = (value) =>
    (typeof value === 'number' ? value : 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });

/** Kayıtlar sekmesinde birim: ana kayıt üstü birim yoksa ilk kalem satırından */
const formatDrillRecordUnitLabel = (cost, canonicalUnitCtx) => {
    const ctx = canonicalUnitCtx || {};
    if (cost?.unit) return getCanonicalUnitLabel(cost.unit, ctx);
    if (cost?.is_supplier_nc && cost.supplier?.name) return cost.supplier.name;
    const items = cost?.cost_line_items;
    if (!Array.isArray(items) || items.length === 0) return '—';
    const li = items[0];
    if (li.responsible_type === 'supplier') {
        return li.responsible_supplier_name || cost.supplier?.name || 'Tedarikçi';
    }
    if (li.responsible_unit) return getCanonicalUnitLabel(li.responsible_unit, ctx);
    return '—';
};

const formatDrillRecordPartLabel = (cost) => {
    if (cost?.part_code || cost?.part_name) return cost.part_code || cost.part_name || '—';
    const items = cost?.cost_line_items;
    if (!Array.isArray(items) || items.length === 0) return '—';
    const li = items[0];
    return li.part_code || li.part_name || '—';
};

const clampImprovementPercent = (raw) => {
    const n = typeof raw === 'number' ? raw : Number(String(raw).replace(',', '.'));
    if (!Number.isFinite(n)) return 5;
    return Math.min(99, Math.max(1, Math.round(n)));
};

const improvementMultiplier = (percent) => 1 - clampImprovementPercent(percent) / 100;

const roundTargetValueForDb = (value, metricKey) => {
    const def = getVehicleMetricDefinition(metricKey);
    const n = typeof value === 'number' ? value : 0;
    if (!Number.isFinite(n) || n <= 0) return 0;
    const decimals = def?.isCurrency ? 2 : 4;
    const p = 10 ** decimals;
    return Math.round(n * p) / p;
};

const mergeTargetRowsForVehicle = (rows, vehicleContext) => {
    const relevant = rows
        .filter(
            (r) =>
                r.vehicle_type === vehicleContext ||
                r.vehicle_type === 'global' ||
                r.vehicle_type == null
        )
        .sort((a, b) => {
            if (a.vehicle_type === vehicleContext && b.vehicle_type !== vehicleContext) return -1;
            if (b.vehicle_type === vehicleContext && a.vehicle_type !== vehicleContext) return 1;
            return 0;
        });
    const merged = {};
    relevant.forEach((r) => {
        const tk = r.target_type;
        if (!VEHICLE_METRIC_ORDER.includes(tk)) return;
        if (!merged[tk]) {
            merged[tk] = { value: Number(r.value) || 0, unit: r.unit || '' };
        }
    });
    VEHICLE_METRIC_ORDER.forEach((key) => {
        if (!merged[key]) merged[key] = { value: 0, unit: '' };
    });
    return merged;
};

const isWithinDateRange = (dateValue, dateRange) => {
    if (!dateRange?.startDate || !dateRange?.endDate) return true;
    if (!dateValue) return false;
    const currentDate = new Date(dateValue);
    const startDate = new Date(dateRange.startDate);
    const endDate = new Date(dateRange.endDate);
    endDate.setHours(23, 59, 59, 999);
    if (Number.isNaN(currentDate.getTime())) return false;
    return currentDate >= startDate && currentDate <= endDate;
};

const countProducedInRange = (vehicles, vehicleType, start, end) => {
    if (!Array.isArray(vehicles) || !vehicleType || !start || !end) return 0;
    return vehicles.filter((v) => {
        if (v.vehicle_type !== vehicleType) return false;
        const d = new Date(v.created_at || v.production_date);
        if (Number.isNaN(d.getTime())) return false;
        return d >= start && d <= end;
    }).length;
};

const denominatorFromRowsAndProduced = (rows, producedCount) => {
    const sourceIds = new Set(rows.map((c) => c.source_record_id).filter(Boolean));
    const costIds = new Set(rows.map((c) => c.id));
    const fallback = sourceIds.size || costIds.size;
    return Math.max(1, producedCount || fallback || 0);
};

const countProducedCalendarYear = (vehicles, vehicleType, year) => {
    const start = new Date(year, 0, 1, 0, 0, 0, 0);
    const end = new Date(year, 11, 31, 23, 59, 59, 999);
    return countProducedInRange(vehicles, vehicleType, start, end);
};

const getAlignedYearBounds = (year) => {
    const now = new Date();
    const start = new Date(year, 0, 1, 0, 0, 0, 0);
    const lastDayOfMonth = new Date(year, now.getMonth() + 1, 0).getDate();
    const day = Math.min(now.getDate(), lastDayOfMonth);
    const end = new Date(year, now.getMonth(), day, 23, 59, 59, 999);
    return { start, end };
};

const countProducedAlignedYearToDate = (vehicles, vehicleType, year) => {
    const { start, end } = getAlignedYearBounds(year);
    return countProducedInRange(vehicles, vehicleType, start, end);
};

const CostDrillDownModal = ({
    isOpen,
    onClose,
    data,
    allCosts,
    onVehicleTargetsApplied,
    onCreateNC,
    onOpenNCView,
    hasNCAccess,
    /** COPQ / analiz modallarında kayıtlar sekmesi: görüntüle, düzenle, sil */
    recordDrillActions,
}) => {
    const costs = Array.isArray(data?.costs) ? data.costs : [];
    const title = data?.title || 'Maliyet detayı';
    const yearContext = data?.yearContext;
    const vehicleContext = data?.vehicleContext;
    const dateRange = data?.dateRange;

    const { producedVehicles, unitCostSettings, personnel } = useData();
    const canonicalUnitCtx = useMemo(
        () => ({ unitCostSettings: unitCostSettings || [], personnel: personnel || [] }),
        [unitCostSettings, personnel]
    );
    const { toast } = useToast();
    const [resolvedTargets, setResolvedTargets] = useState({});
    const [applyingTargets, setApplyingTargets] = useState(false);
    const [confirmApplyOpen, setConfirmApplyOpen] = useState(false);
    /** Önerilen taslak: bir önceki tam yıl baz çizgisinden düşülecek iyileştirme yüzdesi (1–99) */
    const [improvementPercent, setImprovementPercent] = useState(5);
    const [drillTab, setDrillTab] = useState('overview');

    useEffect(() => {
        if (isOpen) setDrillTab('overview');
    }, [isOpen, vehicleContext]);

    /** Takvim yılı ve kıyas: yıl detayı açıldıysa o yıl ↔ bir önceki yıl; araç modunda güncel yıl ↔ önceki yıl */
    const yearComparison = useMemo(() => {
        const n = new Date();
        const calendarYearNow = n.getFullYear();
        const previousCalendarYear = calendarYearNow - 1;
        const compareCurYear = yearContext != null ? yearContext : calendarYearNow;
        const comparePrevYear = compareCurYear - 1;
        return { calendarYearNow, previousCalendarYear, compareCurYear, comparePrevYear };
    }, [yearContext]);

    const fetchResolvedTargets = useCallback(async () => {
        if (!vehicleContext) {
            setResolvedTargets({});
            return;
        }
        const { data: rows, error } = await supabase.from('quality_cost_targets').select('*');
        if (error || !rows) return;
        setResolvedTargets(mergeTargetRowsForVehicle(rows, vehicleContext));
    }, [vehicleContext]);

    useEffect(() => {
        if (!isOpen || !vehicleContext) {
            setResolvedTargets({});
            return;
        }
        let cancelled = false;
        (async () => {
            const { data: rows, error } = await supabase.from('quality_cost_targets').select('*');
            if (error || cancelled || !rows) return;
            if (!cancelled) setResolvedTargets(mergeTargetRowsForVehicle(rows, vehicleContext));
        })();
        return () => {
            cancelled = true;
        };
    }, [isOpen, vehicleContext]);

    const scopeForComparison = useMemo(() => {
        if (!Array.isArray(allCosts)) return [];
        if (vehicleContext) return allCosts.filter((c) => c.vehicle_type === vehicleContext);
        return allCosts;
    }, [allCosts, vehicleContext]);

    const summary = useMemo(() => summarizeCostRows(costs), [costs]);

    const monthlyBars = useMemo(() => {
        const map = {};
        for (const c of costs) {
            if (!c?.cost_date) continue;
            const d = new Date(c.cost_date);
            if (Number.isNaN(d.getTime())) continue;
            const key = format(d, 'yyyy-MM', { locale: tr });
            const label = format(d, 'MMM yy', { locale: tr });
            if (!map[key]) map[key] = { key, label, internal: 0, external: 0, total: 0 };
            const amt = parseFloat(c.amount) || 0;
            map[key].total += amt;
            if (classifyCostInternalExternal(c) === 'external') map[key].external += amt;
            else map[key].internal += amt;
        }
        return Object.values(map).sort((a, b) => a.key.localeCompare(b.key));
    }, [costs]);

    const samePeriodCompare = useMemo(() => {
        const show = yearContext != null || Boolean(vehicleContext);
        if (!show || !Array.isArray(scopeForComparison)) return null;
        const { compareCurYear, comparePrevYear } = yearComparison;
        const cur = filterCostsAlignedYearToDate(scopeForComparison, compareCurYear);
        const prev = filterCostsAlignedYearToDate(scopeForComparison, comparePrevYear);
        const sCur = summarizeCostRows(cur);
        const sPrev = summarizeCostRows(prev);
        if (sPrev.total === 0 && sCur.total === 0) return null;
        const delta =
            sPrev.total > 0 ? ((sCur.total - sPrev.total) / sPrev.total) * 100 : sCur.total > 0 ? 100 : 0;
        return { sCur, sPrev, delta, compareCurYear, comparePrevYear };
    }, [yearContext, vehicleContext, scopeForComparison, yearComparison]);

    /** Bir önceki tam takvim yılı COPQ toplamı (taslak üst sınır / tam yıl baz metrikleri için) */
    const referencePrevFullYear = useMemo(() => {
        if (!Array.isArray(scopeForComparison)) return null;
        const rows = filterCostsByYear(scopeForComparison, yearComparison.previousCalendarYear);
        return summarizeCostRows(rows);
    }, [scopeForComparison, yearComparison.previousCalendarYear]);

    const suggestedAnnualCopqCeiling = useMemo(() => {
        const mult = improvementMultiplier(improvementPercent);
        if (vehicleContext && referencePrevFullYear?.total > 0) {
            return referencePrevFullYear.total * mult;
        }
        if (!samePeriodCompare?.sCur?.total || samePeriodCompare.sCur.total <= 0) return null;
        return samePeriodCompare.sCur.total * mult;
    }, [vehicleContext, referencePrevFullYear, samePeriodCompare, improvementPercent]);

    const producedVehiclesInScope = useMemo(() => {
        if (!vehicleContext || !Array.isArray(producedVehicles)) return [];
        return producedVehicles.filter((v) => {
            if (v.vehicle_type !== vehicleContext) return false;
            return isWithinDateRange(v.created_at || v.production_date, dateRange);
        });
    }, [vehicleContext, producedVehicles, dateRange]);

    const producedInSelectedRange = producedVehiclesInScope.length;

    const vehicleDenominator = useMemo(() => {
        if (!vehicleContext) return 1;
        const costRecordIds = new Set(costs.map((c) => c.id));
        const sourceIds = new Set(costs.map((c) => c.source_record_id).filter(Boolean));
        const fallbackDen = sourceIds.size || costRecordIds.size;
        return Math.max(1, producedInSelectedRange || fallbackDen || 0);
    }, [vehicleContext, costs, producedInSelectedRange]);

    const hasExplicitDateRange = Boolean(dateRange?.startDate && dateRange?.endDate);
    const prevCalendarRange = useMemo(
        () => (hasExplicitDateRange ? getPreviousYearDateRangeInclusive(dateRange) : null),
        [hasExplicitDateRange, dateRange]
    );

    const vehicleMetricRows = useMemo(() => {
        if (!vehicleContext) return [];

        const { calendarYearNow, previousCalendarYear } = yearComparison;

        const rowsPrevFullYear = filterCostsByYear(scopeForComparison, previousCalendarYear);
        const prodPrevFullYear = countProducedCalendarYear(producedVehicles, vehicleContext, previousCalendarYear);

        const rowsPrevAligned = filterCostsAlignedYearToDate(scopeForComparison, previousCalendarYear);
        const rowsCurAligned = filterCostsAlignedYearToDate(scopeForComparison, calendarYearNow);
        const prodPrevAligned = countProducedAlignedYearToDate(producedVehicles, vehicleContext, previousCalendarYear);
        const prodCurAligned = countProducedAlignedYearToDate(producedVehicles, vehicleContext, calendarYearNow);

        return VEHICLE_METRIC_ORDER.map((metricKey) => {
            const definition = getVehicleMetricDefinition(metricKey);
            let sumPeriod = 0;
            for (const c of costs) {
                sumPeriod += getVehicleMetricContribution(c, metricKey);
            }
            const actualPerVehicle = sumPeriod / vehicleDenominator;

            let sumPrevFull = 0;
            for (const c of rowsPrevFullYear) sumPrevFull += getVehicleMetricContribution(c, metricKey);
            const denomPrevFull = denominatorFromRowsAndProduced(rowsPrevFullYear, prodPrevFullYear);
            const ratePrevFullYear = sumPrevFull / denomPrevFull;

            const mult = improvementMultiplier(improvementPercent);

            let sumPrevA = 0;
            for (const c of rowsPrevAligned) sumPrevA += getVehicleMetricContribution(c, metricKey);
            let sumCurA = 0;
            for (const c of rowsCurAligned) sumCurA += getVehicleMetricContribution(c, metricKey);
            const denomPrevA = denominatorFromRowsAndProduced(rowsPrevAligned, prodPrevAligned);
            const denomCurA = denominatorFromRowsAndProduced(rowsCurAligned, prodCurAligned);
            const ratePrevAligned = sumPrevA / denomPrevA;
            const rateCurAligned = sumCurA / denomCurA;

            let compareMode = 'aligned';
            let prevYearSamePeriodPerVehicle = null;
            let deltaPct = null;

            /** Tam yıl referans: kısmi dönemde kaydırılmış yılın ocak–aralık ortalaması; kaydırılmış tam yıl ise bir önceki tam yıl bazı */
            let referenceFullYearRate = ratePrevFullYear;
            let referenceFullYearYear = previousCalendarYear;

            if (hasExplicitDateRange && prevCalendarRange) {
                const prevRows = filterCostsInDateRangeInclusive(
                    scopeForComparison,
                    prevCalendarRange.start,
                    prevCalendarRange.end
                );
                let prevSum = 0;
                for (const c of prevRows) prevSum += getVehicleMetricContribution(c, metricKey);
                const prevProduced = countProducedInRange(
                    producedVehicles,
                    vehicleContext,
                    prevCalendarRange.start,
                    prevCalendarRange.end
                );
                const prevDenom = denominatorFromRowsAndProduced(prevRows, prevProduced);
                prevYearSamePeriodPerVehicle = prevSum / prevDenom;
                compareMode = 'shifted';
                if (prevYearSamePeriodPerVehicle > 0) {
                    deltaPct = ((actualPerVehicle - prevYearSamePeriodPerVehicle) / prevYearSamePeriodPerVehicle) * 100;
                } else if (actualPerVehicle > 0) {
                    deltaPct = 100;
                }

                const shiftedStart = prevCalendarRange.start;
                const shiftedEnd = prevCalendarRange.end;
                const shiftedCoversOneFullYear = isFullCalendarYearInclusiveRange(shiftedStart, shiftedEnd);
                const y = shiftedStart.getFullYear();
                referenceFullYearYear = shiftedCoversOneFullYear ? y - 1 : y;
                const rowsRefYear = filterCostsByYear(scopeForComparison, referenceFullYearYear);
                const prodRefYear = countProducedCalendarYear(producedVehicles, vehicleContext, referenceFullYearYear);
                let sumRef = 0;
                for (const c of rowsRefYear) sumRef += getVehicleMetricContribution(c, metricKey);
                const denomRef = denominatorFromRowsAndProduced(rowsRefYear, prodRefYear);
                referenceFullYearRate = denomRef > 0 ? sumRef / denomRef : 0;
            } else {
                compareMode = 'aligned';
                if (ratePrevAligned > 0) {
                    deltaPct = ((rateCurAligned - ratePrevAligned) / ratePrevAligned) * 100;
                } else if (rateCurAligned > 0) {
                    deltaPct = 100;
                }
            }

            const suggested =
                referenceFullYearRate > 0 && Number.isFinite(referenceFullYearRate)
                    ? referenceFullYearRate * mult
                    : 0;

            const registered = Number(resolvedTargets[metricKey]?.value) || 0;
            const overTarget = registered > 0 && actualPerVehicle > registered;

            return {
                metricKey,
                definition,
                actualPerVehicle,
                registered,
                suggested,
                compareMode,
                prevYearSamePeriodPerVehicle,
                ratePrevFullYear,
                referenceFullYearRate,
                referenceFullYearYear,
                ratePrevAligned,
                rateCurAligned,
                deltaPct,
                overTarget,
            };
        });
    }, [
        vehicleContext,
        costs,
        scopeForComparison,
        producedVehicles,
        vehicleDenominator,
        hasExplicitDateRange,
        prevCalendarRange,
        resolvedTargets,
        improvementPercent,
        yearComparison,
    ]);

    const draftTargetReferenceYear =
        vehicleMetricRows[0]?.referenceFullYearYear ?? yearComparison.previousCalendarYear;

    /** Kümülatif kart için: hizalı yılbaşı–bugün penceresinde COPQ / üretilen araç (model bazlı) */
    const vehicleCopqYtdPerVehicle = useMemo(() => {
        if (!vehicleContext || !Array.isArray(scopeForComparison)) return null;
        const { compareCurYear, comparePrevYear } = yearComparison;
        const curRows = filterCostsAlignedYearToDate(scopeForComparison, compareCurYear);
        const prevRows = filterCostsAlignedYearToDate(scopeForComparison, comparePrevYear);
        const tCur = summarizeCostRows(curRows).total;
        const tPrev = summarizeCostRows(prevRows).total;
        const pCur = countProducedAlignedYearToDate(producedVehicles, vehicleContext, compareCurYear);
        const pPrev = countProducedAlignedYearToDate(producedVehicles, vehicleContext, comparePrevYear);
        return {
            cur: pCur > 0 ? tCur / pCur : null,
            prev: pPrev > 0 ? tPrev / pPrev : null,
            pCur,
            pPrev,
            compareCurYear,
            comparePrevYear,
        };
    }, [vehicleContext, scopeForComparison, producedVehicles, yearComparison]);

    const hasApplicableSuggestions = useMemo(
        () => vehicleMetricRows.some((r) => r.suggested > 0 && Number.isFinite(r.suggested)),
        [vehicleMetricRows]
    );

    const handleApplySuggestedTargets = useCallback(async () => {
        if (!vehicleContext) return;
        const payload = vehicleMetricRows
            .map((row) => {
                const v = roundTargetValueForDb(row.suggested, row.metricKey);
                if (v <= 0) return null;
                return {
                    target_type: row.metricKey,
                    vehicle_type: vehicleContext,
                    value: v,
                    unit: getVehicleMetricDefinition(row.metricKey).unit,
                };
            })
            .filter(Boolean);
        if (payload.length === 0) {
            toast({
                variant: 'destructive',
                title: 'Uygulanacak değer yok',
                description: `Önerilen hedefler hesaplanmadı (${draftTargetReferenceYear} referans tam yıl verisi eksik olabilir).`,
            });
            setConfirmApplyOpen(false);
            return;
        }
        setApplyingTargets(true);
        const { error } = await supabase
            .from('quality_cost_targets')
            .upsert(payload, { onConflict: 'target_type,vehicle_type' });
        setApplyingTargets(false);
        setConfirmApplyOpen(false);
        if (error) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: error.message || 'Hedefler kaydedilemedi.',
            });
            return;
        }
        toast({
            title: 'Hedefler uygulandı',
            description: `${vehicleContext} için tablodaki önerilen değerler kayıtlı hedef olarak kaydedildi.`,
        });
        await fetchResolvedTargets();
        onVehicleTargetsApplied?.();
    }, [vehicleContext, vehicleMetricRows, toast, fetchResolvedTargets, onVehicleTargetsApplied, draftTargetReferenceYear]);

    return (
        <>
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="!w-[98vw] !max-w-[1440px] max-h-[96vh] overflow-hidden flex flex-col p-0 gap-0 border-border/40 shadow-2xl rounded-2xl">
                <DialogHeader className="px-5 sm:px-8 pt-5 pb-4 shrink-0 border-b border-border/40 bg-gradient-to-r from-primary/[0.04] via-background to-background">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-inset ring-primary/20">
                                <BarChart3 className="h-5 w-5 text-primary" />
                            </div>
                            <div className="min-w-0">
                                <DialogTitle className="text-base sm:text-lg font-semibold tracking-tight leading-snug truncate pr-8">
                                    {title}
                                </DialogTitle>
                                <DialogDescription className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                    <span>{costs.length} kayıt</span>
                                    {vehicleContext && (
                                        <>
                                            <span className="text-muted-foreground/40">·</span>
                                            <span>Model: <strong className="text-foreground/80 font-medium">{vehicleContext}</strong></span>
                                        </>
                                    )}
                                </DialogDescription>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <div className="hidden sm:flex flex-col items-end">
                                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Toplam COPQ</span>
                                <span className="text-lg font-bold tabular-nums tracking-tight text-foreground leading-tight">
                                    {formatCurrency(summary.total)}
                                </span>
                            </div>
                            <div className="sm:hidden">
                                <Badge variant="outline" className="text-xs tabular-nums font-semibold border-primary/25 text-primary">
                                    {formatCurrency(summary.total)}
                                </Badge>
                            </div>
                        </div>
                    </div>
                </DialogHeader>

                <Tabs value={drillTab} onValueChange={setDrillTab} className="flex-1 min-h-0 flex flex-col">
                    <div className="shrink-0 border-b border-border/40 px-5 sm:px-8">
                        <TabsList className="h-10 bg-transparent p-0 gap-0 w-full justify-start rounded-none">
                            <TabsTrigger value="overview" className="relative rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2 text-xs font-medium">
                                <PieChart className="h-3.5 w-3.5 mr-1.5" />
                                Genel Bakış
                            </TabsTrigger>
                            <TabsTrigger value="records" className="relative rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2 text-xs font-medium">
                                <ListOrdered className="h-3.5 w-3.5 mr-1.5" />
                                Kayıtlar
                                <Badge variant="secondary" className="ml-1.5 text-[9px] font-normal tabular-nums h-4 px-1.5 rounded-full">
                                    {costs.length}
                                </Badge>
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    {/* ═══════ TAB: GENEL BAKIŞ ═══════ */}
                    <TabsContent value="overview" className="flex-1 min-h-0 overflow-y-auto mt-0 px-5 sm:px-8 pb-6 pt-5 space-y-5">
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            {[
                                { label: 'İç hata payı', value: `${summary.internalShare.toFixed(1)}%`, sub: formatCurrency(summary.internal), accent: 'blue' },
                                { label: 'Dış hata payı', value: `${summary.externalShare.toFixed(1)}%`, sub: formatCurrency(summary.external), accent: 'red' },
                                { label: 'Kayıt başı ort.', value: formatCurrency(summary.avgPerRecord), sub: `${summary.count} kayıt`, accent: 'violet' },
                                { label: 'Aktif ay ort.', value: formatCurrency(summary.avgPerActiveMonth), sub: `${summary.distinctMonths} ay veri`, accent: 'amber' },
                            ].map((s) => (
                                <div key={s.label} className="group relative rounded-xl border border-border/60 bg-card p-3.5 transition-shadow hover:shadow-md">
                                    <div className={cn(
                                        'absolute inset-x-0 top-0 h-0.5 rounded-t-xl',
                                        s.accent === 'blue' && 'bg-blue-500',
                                        s.accent === 'red' && 'bg-red-500',
                                        s.accent === 'violet' && 'bg-violet-500',
                                        s.accent === 'amber' && 'bg-amber-500',
                                    )} />
                                    <p className="text-[11px] font-medium text-muted-foreground">{s.label}</p>
                                    <p className="mt-1 text-xl font-bold tabular-nums tracking-tight">{s.value}</p>
                                    <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">{s.sub}</p>
                                </div>
                            ))}
                        </div>

                        {samePeriodCompare ? (() => {
                            const up = samePeriodCompare.delta > 0.05;
                            const down = samePeriodCompare.delta < -0.05;
                            return (
                                <section className="rounded-2xl border border-border/50 bg-gradient-to-b from-muted/20 via-background to-background p-4 sm:p-5 shadow-sm space-y-4">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                                                <CalendarRange className="h-4 w-4 text-primary" />
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="text-sm font-semibold text-foreground tracking-tight">Kümülatif COPQ karşılaştırması</h3>
                                                <p className="text-[10px] text-muted-foreground">Ocak – bugün · önceki yıl hizalı aynı dönem</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                                            <div className={cn(
                                                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold tabular-nums border',
                                                up && 'border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300',
                                                down && 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
                                                !up && !down && 'border-border/80 bg-muted/40 text-muted-foreground'
                                            )}>
                                                {up ? <TrendingUp className="h-3.5 w-3.5" /> : down ? <TrendingDown className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                                                {samePeriodCompare.delta > 0 ? '+' : ''}{samePeriodCompare.delta.toFixed(1)}%
                                            </div>
                                            {!vehicleContext && (
                                                <div className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card px-2 py-1">
                                                    <Label htmlFor="copq-improvement-pct-global" className="text-[10px] text-muted-foreground whitespace-nowrap">İyileştirme</Label>
                                                    <Input id="copq-improvement-pct-global" type="number" min={1} max={99} className="h-7 w-12 text-xs tabular-nums px-1.5" value={improvementPercent}
                                                        onChange={(e) => setImprovementPercent(clampImprovementPercent(e.target.value))}
                                                        onBlur={(e) => { if (e.target.value === '') setImprovementPercent(5); }} />
                                                    <span className="text-[10px] text-muted-foreground">%</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="grid sm:grid-cols-2 gap-3">
                                        <div className="rounded-xl border border-border/60 bg-card p-4 space-y-1.5">
                                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{samePeriodCompare.comparePrevYear} · Ocak – bugün</p>
                                            <p className="text-2xl font-bold tabular-nums tracking-tight">{formatCurrency(samePeriodCompare.sPrev.total)}</p>
                                            <p className="text-[11px] text-muted-foreground">{samePeriodCompare.sPrev.count} kayıt</p>
                                            {vehicleContext && vehicleCopqYtdPerVehicle?.prev != null && (
                                                <p className="text-[11px] pt-2 mt-2 border-t border-border/40 text-foreground/80">
                                                    Birim COPQ: <span className="font-semibold tabular-nums">{formatCurrency(vehicleCopqYtdPerVehicle.prev)}</span>
                                                    <span className="text-muted-foreground"> · {vehicleCopqYtdPerVehicle.pPrev} üretim</span>
                                                </p>
                                            )}
                                        </div>
                                        <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/[0.06] to-transparent p-4 space-y-1.5 ring-1 ring-inset ring-primary/10">
                                            <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">{samePeriodCompare.compareCurYear} · Ocak – bugün</p>
                                            <p className="text-2xl font-bold tabular-nums tracking-tight">{formatCurrency(samePeriodCompare.sCur.total)}</p>
                                            <p className="text-[11px] text-muted-foreground">{samePeriodCompare.sCur.count} kayıt</p>
                                            {vehicleContext && vehicleCopqYtdPerVehicle?.cur != null && (
                                                <p className="text-[11px] pt-2 mt-2 border-t border-primary/15 text-foreground/80">
                                                    Birim COPQ: <span className="font-semibold tabular-nums">{formatCurrency(vehicleCopqYtdPerVehicle.cur)}</span>
                                                    <span className="text-muted-foreground"> · {vehicleCopqYtdPerVehicle.pCur} üretim</span>
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    {suggestedAnnualCopqCeiling != null && (
                                        <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-3.5">
                                            <Lightbulb className="h-4.5 w-4.5 text-amber-600 shrink-0 mt-0.5" />
                                            <div className="text-xs leading-relaxed space-y-0.5">
                                                <p className="font-semibold text-foreground">Hedef taslağı</p>
                                                <p className="text-muted-foreground">
                                                    %{improvementPercent} iyileştirme ile örnek üst sınır:{' '}
                                                    <span className="font-bold tabular-nums text-foreground">{formatCurrency(suggestedAnnualCopqCeiling)}</span>
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </section>
                            );
                        })() : null}

                        {monthlyBars.length > 0 && (
                            <section className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
                                <div className="flex items-center gap-2 px-5 pt-4 pb-2">
                                    <BarChart3 className="w-4 h-4 text-primary shrink-0" />
                                    <h3 className="text-sm font-semibold text-foreground tracking-tight">Aylık COPQ dağılımı</h3>
                                    <span className="text-[10px] text-muted-foreground ml-auto">Filtrelenmiş kayıtlar</span>
                                </div>
                                <div className="h-[280px] w-full px-2 pb-3">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={monthlyBars} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                                            <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
                                            <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                                            <Tooltip formatter={(v) => formatCurrency(v)} labelFormatter={(_, p) => p?.[0]?.payload?.label}
                                                contentStyle={{ borderRadius: '0.75rem', border: '1px solid hsl(var(--border))', background: 'hsl(var(--popover))', fontSize: 12 }} />
                                            <Legend wrapperStyle={{ fontSize: 11 }} />
                                            <Bar dataKey="internal" name="İç hata" stackId="a" fill="hsl(217 91% 60%)" radius={[0, 0, 0, 0]} />
                                            <Bar dataKey="external" name="Dış hata" stackId="a" fill="hsl(0 84% 60%)" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </section>
                        )}

                        {vehicleContext && vehicleMetricRows.length > 0 && (
                        <section className="space-y-4 border-t border-border/40 pt-6">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="flex items-start gap-2 min-w-0">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                                        <Target className="h-4 w-4 text-primary" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-foreground tracking-tight">Metrikler ve hedefler</h3>
                                        <p className="text-[11px] text-muted-foreground">Araç başı değerler, kıyas ve taslak hedefler</p>
                                    </div>
                                </div>
                                <Badge variant="secondary" className="text-[11px] font-normal tabular-nums w-fit shrink-0">
                                    Payda: {vehicleDenominator} üretim
                                </Badge>
                            </div>
                            <div className="flex flex-wrap items-center justify-end gap-2">
                                    <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card px-2.5 py-1.5">
                                        <Label htmlFor="copq-improvement-pct" className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">İyileştirme hedefi</Label>
                                        <Input id="copq-improvement-pct" type="number" min={1} max={99} className="h-7 w-14 text-xs tabular-nums px-2" value={improvementPercent}
                                            onChange={(e) => setImprovementPercent(clampImprovementPercent(e.target.value))}
                                            onBlur={(e) => { if (e.target.value === '') setImprovementPercent(5); }} />
                                        <span className="text-[11px] text-muted-foreground">%</span>
                                    </div>
                                    <Button type="button" size="sm" className="gap-1.5 h-8" disabled={!hasApplicableSuggestions || applyingTargets} onClick={() => setConfirmApplyOpen(true)}>
                                        {applyingTargets ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                                        Önerilenleri hedef olarak uygula
                                    </Button>
                            </div>

                            <div className="hidden md:block rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
                                <div className="overflow-x-auto">
                                    <Table className="min-w-[920px]">
                                        <TableHeader>
                                            <TableRow className="bg-muted/40 hover:bg-muted/40 border-b">
                                                <TableHead className="sticky left-0 z-[1] bg-muted/40 text-[11px] font-semibold min-w-[160px]">Metrik</TableHead>
                                                <TableHead className="text-[11px] font-semibold text-right whitespace-nowrap">Bu dönem</TableHead>
                                                <TableHead className="text-[11px] font-semibold text-right min-w-[168px]">Kıyas</TableHead>
                                                <TableHead className="text-[11px] font-semibold text-right w-[76px]">
                                                    Fark
                                                    <span className="block text-[10px] text-muted-foreground font-normal">{hasExplicitDateRange ? 'önceki yıl' : 'eş dönem'}</span>
                                                </TableHead>
                                                <TableHead className="text-[11px] font-semibold text-right whitespace-nowrap">Kayıtlı hedef</TableHead>
                                                <TableHead className="text-[11px] font-semibold text-right min-w-[120px]">
                                                    <span className="inline-flex items-center gap-1 justify-end">
                                                        <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                                                        Taslak hedef
                                                    </span>
                                                    <span className="block text-[10px] text-muted-foreground font-normal">
                                                        {draftTargetReferenceYear} referans tam yıl bazı · %{improvementPercent} iyileştirme
                                                    </span>
                                                </TableHead>
                                                <TableHead className="text-[11px] font-semibold text-center w-[88px]">Durum</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {vehicleMetricRows.map((row, idx) => {
                                                const fmt = (v) => formatVehicleMetricValue(v, row.metricKey, { perVehicle: true });
                                                const reg = row.registered;
                                                const d = row.deltaPct;
                                                const deltaColor = d == null || Number.isNaN(d) ? '' : d > 0 ? 'text-red-600 dark:text-red-400' : d < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground';
                                                return (
                                                    <TableRow key={row.metricKey} className={cn('text-sm transition-colors hover:bg-muted/20', idx % 2 === 1 && 'bg-muted/[0.04]')}>
                                                        <TableCell className="sticky left-0 z-[1] bg-card border-r font-medium">{row.definition.label}</TableCell>
                                                        <TableCell className="text-right tabular-nums font-semibold">{fmt(row.actualPerVehicle)}</TableCell>
                                                        <TableCell className="text-right align-top">
                                                            {row.compareMode === 'shifted' ? (
                                                                <div className="space-y-2">
                                                                    <div className="rounded-md border border-border/70 bg-muted/20 px-2 py-1.5">
                                                                        <p className="text-[10px] text-muted-foreground">Önceki yıl aynı dönem</p>
                                                                        <p className="tabular-nums font-semibold">{row.prevYearSamePeriodPerVehicle != null ? fmt(row.prevYearSamePeriodPerVehicle) : '—'}</p>
                                                                    </div>
                                                                    <div className="grid grid-cols-2 gap-1.5 text-left">
                                                                        <div className="rounded bg-muted/40 px-1.5 py-1">
                                                                            <p className="text-[9px] text-muted-foreground leading-tight">
                                                                                {row.referenceFullYearYear} tam yıl · araç ort.
                                                                            </p>
                                                                            <p className="tabular-nums text-[11px] font-medium">{fmt(row.referenceFullYearRate)}</p>
                                                                        </div>
                                                                        <div className="rounded bg-muted/40 px-1.5 py-1">
                                                                            <p className="text-[9px] text-muted-foreground leading-tight">{yearComparison.calendarYearNow} · ocak – bugün</p>
                                                                            <p className="tabular-nums text-[11px] font-medium">{fmt(row.rateCurAligned)}</p>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="space-y-2">
                                                                    <div className="rounded-md bg-muted/40 px-2 py-1.5">
                                                                        <p className="text-[10px] text-muted-foreground">{row.referenceFullYearYear} tam yıl · araç ort.</p>
                                                                        <p className="tabular-nums font-semibold">{fmt(row.referenceFullYearRate)}</p>
                                                                    </div>
                                                                    <div className="rounded-md border border-border/60 px-2 py-1.5">
                                                                        <p className="text-[10px] text-muted-foreground">{yearComparison.calendarYearNow} · ocak – bugün</p>
                                                                        <p className="tabular-nums font-semibold">{fmt(row.rateCurAligned)}</p>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className={cn('text-right tabular-nums font-medium', deltaColor)}>
                                                            {d != null && !Number.isNaN(d) ? <>{d > 0 ? '+' : ''}{d.toFixed(1)}%</> : '—'}
                                                        </TableCell>
                                                        <TableCell className="text-right tabular-nums text-muted-foreground">{reg > 0 ? fmt(reg) : '—'}</TableCell>
                                                        <TableCell className="text-right tabular-nums">
                                                            {row.suggested > 0 ? <span className="text-amber-800 dark:text-amber-300 font-medium">{fmt(row.suggested)}</span> : '—'}
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            {reg <= 0 ? <Badge variant="secondary" className="text-[10px]">Hedef yok</Badge>
                                                                : row.overTarget ? <Badge variant="destructive" className="gap-1 text-[10px]"><AlertTriangle className="h-3 w-3" />Üstünde</Badge>
                                                                : <Badge variant="outline" className="gap-1 text-[10px] border-emerald-500/40 text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="h-3 w-3" />Hedefte</Badge>}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>

                            <div className="grid gap-3 md:hidden">
                                {vehicleMetricRows.map((row) => {
                                    const fmt = (v) => formatVehicleMetricValue(v, row.metricKey, { perVehicle: true });
                                    const reg = row.registered;
                                    const d = row.deltaPct;
                                    return (
                                        <Card key={row.metricKey} className="border-border/60 p-4 space-y-3">
                                            <div className="flex justify-between gap-2">
                                                <span className="font-semibold text-sm">{row.definition.label}</span>
                                                {reg <= 0 ? <Badge variant="secondary" className="text-[10px] shrink-0">Hedef yok</Badge>
                                                    : row.overTarget ? <Badge variant="destructive" className="text-[10px] shrink-0">Üstünde</Badge>
                                                    : <Badge variant="outline" className="text-[10px] shrink-0 border-emerald-500/40 text-emerald-700">Hedefte</Badge>}
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                <div className="rounded-lg bg-muted/50 p-2">
                                                    <p className="text-muted-foreground">Bu dönem</p>
                                                    <p className="font-semibold tabular-nums mt-0.5">{fmt(row.actualPerVehicle)}</p>
                                                </div>
                                                <div className="rounded-lg bg-muted/50 p-2">
                                                    <p className="text-muted-foreground">Fark</p>
                                                    <p className={cn('font-semibold tabular-nums mt-0.5', d != null && !Number.isNaN(d) && d > 0 ? 'text-red-600' : d != null && !Number.isNaN(d) && d < 0 ? 'text-emerald-600' : '')}>
                                                        {d != null && !Number.isNaN(d) ? `${d > 0 ? '+' : ''}${d.toFixed(1)}%` : '—'}
                                                    </p>
                                                </div>
                                                <div className="col-span-2 rounded-lg border p-2 space-y-2 text-[11px]">
                                                    {row.compareMode === 'shifted' && (
                                                        <div className="flex justify-between gap-2 pb-2 border-b border-border/40">
                                                            <span className="text-muted-foreground">Önceki yıl aynı dönem</span>
                                                            <span className="tabular-nums font-medium">
                                                                {row.prevYearSamePeriodPerVehicle != null ? fmt(row.prevYearSamePeriodPerVehicle) : '—'}
                                                            </span>
                                                        </div>
                                                    )}
                                                    <div className="flex justify-between gap-2">
                                                        <span className="text-muted-foreground">{row.referenceFullYearYear} tam yıl · araç ort.</span>
                                                        <span className="tabular-nums font-medium">{fmt(row.referenceFullYearRate)}</span>
                                                    </div>
                                                    <div className="flex justify-between gap-2">
                                                        <span className="text-muted-foreground">{yearComparison.calendarYearNow} · ocak – bugün</span>
                                                        <span className="tabular-nums font-semibold">{fmt(row.rateCurAligned)}</span>
                                                    </div>
                                                </div>
                                                <div className="rounded-lg bg-muted/50 p-2">
                                                    <p className="text-muted-foreground">Kayıtlı hedef</p>
                                                    <p className="tabular-nums mt-0.5">{reg > 0 ? fmt(reg) : '—'}</p>
                                                </div>
                                                <div className="rounded-lg bg-amber-500/10 p-2 border border-amber-500/20">
                                                    <p className="text-amber-800 dark:text-amber-200">Taslak (%{improvementPercent})</p>
                                                    <p className="font-semibold tabular-nums mt-0.5">{row.suggested > 0 ? fmt(row.suggested) : '—'}</p>
                                                </div>
                                            </div>
                                        </Card>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    {vehicleContext && (
                        <section className="space-y-4 border-t border-border/40 pt-6">
                            <div className="flex items-start gap-2">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                                    <LineChart className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-foreground tracking-tight">Performans, trend ve DF / 8D</h3>
                                    <p className="text-[11px] text-muted-foreground">Aylık trend, kaynak kayıtlar ve DF/8D/MDI önerileri</p>
                                </div>
                            </div>
                            <VehiclePerformancePanel
                                vehicleType={vehicleContext}
                                costs={costs}
                                producedVehicles={producedVehiclesInScope}
                                dateRange={dateRange}
                                onTargetsUpdate={onVehicleTargetsApplied}
                                onCreateNC={onCreateNC}
                                onOpenNCView={onOpenNCView}
                                hasNCAccess={hasNCAccess}
                            />
                        </section>
                    )}

                    </TabsContent>

                    {/* ═══════ TAB: KAYITLAR ═══════ */}
                    <TabsContent value="records" className="flex-1 min-h-0 mt-0 flex flex-col">
                        <ScrollArea className="flex-1">
                            {costs.length === 0 ? (
                                <p className="py-16 text-sm text-muted-foreground text-center">Bu görünüm için kayıt yok.</p>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/40 sticky top-0 z-[2]">
                                            <TableHead className="text-[11px] font-semibold pl-5 sm:pl-8">Tarih</TableHead>
                                            <TableHead className="text-[11px] font-semibold">Tür</TableHead>
                                            <TableHead className="text-[11px] font-semibold">Birim</TableHead>
                                            <TableHead className="text-[11px] font-semibold">Parça</TableHead>
                                            {vehicleContext && (
                                                <>
                                                    <TableHead className="text-right text-[11px] font-semibold">Miktar</TableHead>
                                                    <TableHead className="text-right text-[11px] font-semibold">Hurda kg</TableHead>
                                                </>
                                            )}
                                            <TableHead className="text-right text-[11px] font-semibold pr-2 sm:pr-4">Tutar</TableHead>
                                            {recordDrillActions && (
                                                <TableHead className="text-right text-[11px] font-semibold whitespace-nowrap min-w-[8.5rem] pl-2 pr-5 sm:pr-8 align-middle">
                                                    İşlem
                                                </TableHead>
                                            )}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {[...costs]
                                            .sort((a, b) => new Date(b.cost_date || 0) - new Date(a.cost_date || 0))
                                            .map((c, idx) => (
                                                <TableRow
                                                    key={c.id}
                                                    className={cn(
                                                        'transition-colors',
                                                        idx % 2 === 1 && 'bg-muted/[0.06]',
                                                        typeof recordDrillActions?.onView === 'function' && 'cursor-pointer hover:bg-muted/50 active:bg-muted/60',
                                                    )}
                                                    onClick={() => {
                                                        if (typeof recordDrillActions?.onView === 'function') {
                                                            recordDrillActions.onView(c);
                                                        }
                                                    }}
                                                    title={
                                                        typeof recordDrillActions?.onView === 'function'
                                                            ? 'Kayda gitmek için tıklayın'
                                                            : undefined
                                                    }
                                                >
                                                    <TableCell className="whitespace-nowrap text-xs tabular-nums pl-5 sm:pl-8">
                                                        {c.cost_date ? format(new Date(c.cost_date), 'dd.MM.yyyy', { locale: tr }) : '—'}
                                                    </TableCell>
                                                    <TableCell className="text-xs max-w-[160px] truncate">{c.cost_type || '—'}</TableCell>
                                                    <TableCell className="text-xs">
                                                        {formatDrillRecordUnitLabel(c, canonicalUnitCtx)}
                                                    </TableCell>
                                                    <TableCell className="text-xs max-w-[220px] truncate" title={formatDrillRecordPartLabel(c)}>
                                                        {formatDrillRecordPartLabel(c)}
                                                    </TableCell>
                                                    {vehicleContext && (
                                                        <>
                                                            <TableCell className="text-right text-xs tabular-nums">
                                                                {c.quantity != null && c.quantity !== '' ? Number(c.quantity).toLocaleString('tr-TR') : '—'}
                                                            </TableCell>
                                                            <TableCell className="text-right text-xs tabular-nums">
                                                                {c.scrap_weight != null && c.scrap_weight !== ''
                                                                    ? Number(c.scrap_weight).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                                                    : '—'}
                                                            </TableCell>
                                                        </>
                                                    )}
                                                    <TableCell className="text-right text-xs font-semibold tabular-nums pr-2 sm:pr-4">
                                                        {formatCurrency(parseFloat(c.amount) || 0)}
                                                    </TableCell>
                                                    {recordDrillActions && (
                                                        <TableCell
                                                            className="p-2 pl-3 pr-5 sm:pr-8 text-right align-middle"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <div className="flex flex-wrap items-center justify-end gap-1.5">
                                                                {typeof recordDrillActions.onEdit === 'function' && (
                                                                    <Button
                                                                        type="button"
                                                                        variant="secondary"
                                                                        size="sm"
                                                                        className="h-8 gap-1.5 px-2.5 text-xs font-medium"
                                                                        onClick={() => recordDrillActions.onEdit(c)}
                                                                    >
                                                                        <Edit className="h-3.5 w-3.5 shrink-0" />
                                                                        Düzenle
                                                                    </Button>
                                                                )}
                                                                {typeof recordDrillActions.onRequestDelete === 'function' && (
                                                                    <Button
                                                                        type="button"
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="h-8 gap-1.5 px-2.5 text-xs font-medium text-destructive border-destructive/30 hover:bg-destructive/10"
                                                                        onClick={() => recordDrillActions.onRequestDelete(c.id)}
                                                                    >
                                                                        <Trash2 className="h-3.5 w-3.5 shrink-0" />
                                                                        Sil
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                    )}
                                                </TableRow>
                                            ))}
                                    </TableBody>
                                </Table>
                            )}
                        </ScrollArea>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>

        <AlertDialog open={confirmApplyOpen} onOpenChange={setConfirmApplyOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Önerilen hedefleri uygula?</AlertDialogTitle>
                    <AlertDialogDescription className="text-left">
                        <strong>{vehicleContext || 'Bu model'}</strong> için tablodaki taslak hedefler (
                        {draftTargetReferenceYear} referans tam yıl bazı, %{improvementPercent} iyileştirme) kayıtlı hedef
                        alanlarına yazılacak. Mevcut model hedeflerinin üzerine
                        yazılır.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={applyingTargets}>İptal</AlertDialogCancel>
                    <Button
                        type="button"
                        disabled={applyingTargets || !hasApplicableSuggestions}
                        onClick={() => void handleApplySuggestedTargets()}
                        className="gap-2"
                    >
                        {applyingTargets ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Sparkles className="h-4 w-4" />
                        )}
                        Uygula
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </>
    );
};

export default CostDrillDownModal;
