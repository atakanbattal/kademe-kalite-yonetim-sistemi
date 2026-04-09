import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/customSupabaseClient';
import { AlertTriangle, Car, CheckCircle2, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useData } from '@/contexts/DataContext';
import {
    VEHICLE_METRIC_ORDER,
    formatVehicleMetricValue,
    getVehicleMetricDefinition,
} from '@/components/quality-cost/vehicleMetricConfig';

const formatCurrency = (value) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return '-';
    return value.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
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

const MetricDisplay = ({ definition, value, target }) => {
    const targetValue = Number(target?.value) || 0;
    const hasTarget = targetValue > 0;
    const isOverTarget = hasTarget && value > targetValue;
    const isApproachingTarget = hasTarget && value > targetValue * 0.8 && value <= targetValue;
    const isUnderTarget = hasTarget && value <= targetValue * 0.8;

    const valueColor = isOverTarget
        ? 'text-red-500'
        : isApproachingTarget
            ? 'text-yellow-500'
            : isUnderTarget
                ? 'text-green-500'
                : 'text-foreground';

    const formattedValue = formatVehicleMetricValue(value, definition.key);
    const formattedTarget = hasTarget ? formatVehicleMetricValue(targetValue, definition.key) : 'Tanımsız';

    return (
        <div className="flex justify-between items-baseline text-sm py-2 border-b border-border/50 last:border-b-0">
            <span className="text-muted-foreground">{definition.label}</span>
            <div className="text-right">
                <p className={cn('font-bold text-lg', valueColor)}>
                    {formattedValue}
                </p>
                <p className="text-xs text-muted-foreground/80 flex items-center justify-end gap-1">
                    <Target className="h-3 w-3" />
                    Hedef: {formattedTarget}
                </p>
            </div>
        </div>
    );
};

const VehicleCostBreakdown = ({
    costs,
    loading,
    dateRange,
    onCreateNC,
    onOpenNCView,
    hasNCAccess,
    onVehicleCOPQClick,
}) => {
    const [targets, setTargets] = useState({});
    const { producedVehicles, products, productCategories } = useData();

    const vehicleTypeCategory = useMemo(
        () => (productCategories || []).find((category) => category.category_code === 'VEHICLE_TYPES'),
        [productCategories]
    );

    const filteredProducedVehicles = useMemo(
        () => (producedVehicles || []).filter((vehicle) => {
            const vehicleDate = vehicle.created_at || vehicle.production_date;
            return isWithinDateRange(vehicleDate, dateRange);
        }),
        [producedVehicles, dateRange]
    );

    const producedVehiclesByType = useMemo(() => {
        const counts = {};
        filteredProducedVehicles.forEach((vehicle) => {
            const vehicleType = vehicle.vehicle_type || 'Bilinmiyor';
            if (vehicleType && vehicleType !== 'Bilinmiyor') {
                counts[vehicleType] = (counts[vehicleType] || 0) + 1;
            }
        });
        return counts;
    }, [filteredProducedVehicles]);

    const excludedVehicleTypes = useMemo(
        () => ['Traktör Kabin', 'Traktör Kabini', 'Kabin'],
        []
    );

    const validProductNames = useMemo(() => {
        if (!vehicleTypeCategory) return [];

        return (products || [])
            .filter((product) => product.category_id === vehicleTypeCategory.id)
            .map((product) => product.product_name)
            .filter(Boolean)
            .filter((name) => !excludedVehicleTypes.some((excluded) => name.toLowerCase().includes(excluded.toLowerCase())));
    }, [excludedVehicleTypes, products, vehicleTypeCategory]);

    const fetchTargets = useCallback(async () => {
        const { data, error } = await supabase.from('quality_cost_targets').select('*');
        if (error || !data) return;

        const nextTargets = {};
        data.forEach((target) => {
            const vehicleType = target.vehicle_type || 'global';
            if (!nextTargets[vehicleType]) {
                nextTargets[vehicleType] = {};
            }
            nextTargets[vehicleType][target.target_type] = {
                value: target.value,
                unit: target.unit,
            };
        });
        setTargets(nextTargets);
    }, []);

    useEffect(() => {
        fetchTargets();
    }, [fetchTargets]);

    const breakdownData = useMemo(() => {
        if (loading || !validProductNames.length) return [];

        const vehicleData = {};

        validProductNames.forEach((productName) => {
            if (!productName || productName.length < 2) return;
            if (/^\d/.test(productName) || /^\d{2}-/.test(productName)) return;

            vehicleData[productName] = {
                totalCost: 0,
                producedVehicleCount: producedVehiclesByType[productName] || 0,
                costRecordIds: new Set(),
                sourceRecordIds: new Set(),
                metrics: VEHICLE_METRIC_ORDER.reduce((accumulator, metricKey) => {
                    accumulator[metricKey] = 0;
                    return accumulator;
                }, {}),
            };
        });

        (costs || []).forEach((cost) => {
            const vehicleType = cost.vehicle_type;
            if (!vehicleType || !vehicleData[vehicleType]) return;

            const currentVehicle = vehicleData[vehicleType];
            currentVehicle.totalCost += parseFloat(cost.amount) || 0;
            currentVehicle.costRecordIds.add(cost.id);

            if (cost.source_record_id) {
                currentVehicle.sourceRecordIds.add(cost.source_record_id);
            }

            VEHICLE_METRIC_ORDER.forEach((metricKey) => {
                const definition = getVehicleMetricDefinition(metricKey);
                if (!definition.costTypes.includes(cost.cost_type)) return;
                currentVehicle.metrics[metricKey] += definition.valueAccessor(cost);
            });
        });

        return Object.entries(vehicleData)
            .map(([vehicle, data]) => {
                const fallbackVehicleCount = data.sourceRecordIds.size || data.costRecordIds.size;
                const denominator = data.producedVehicleCount || fallbackVehicleCount || 0;
                const hasData = data.totalCost > 0 || denominator > 0;

                return {
                    vehicle,
                    totalCost: data.totalCost,
                    totalVehicles: denominator,
                    producedVehicleCount: data.producedVehicleCount,
                    hasData,
                    metrics: VEHICLE_METRIC_ORDER.reduce((accumulator, metricKey) => {
                        accumulator[metricKey] = denominator > 0
                            ? data.metrics[metricKey] / denominator
                            : 0;
                        return accumulator;
                    }, {}),
                };
            })
            .sort((left, right) => right.totalCost - left.totalCost);
    }, [costs, loading, producedVehiclesByType, validProductNames]);

    const handleCardClick = useCallback(
        (vehicleType) => {
            onVehicleCOPQClick?.(vehicleType);
        },
        [onVehicleCOPQClick]
    );

    if (loading) {
        return <div className="text-center text-muted-foreground p-8">Detaylı analiz verileri yükleniyor...</div>;
    }

    if (!breakdownData.length) {
        return (
            <div className="text-center text-muted-foreground p-8 bg-muted/30 rounded-xl border border-dashed">
                <Car className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium mb-2">Detaylı Analiz için Araç Tipi Tanımı Gerekli</p>
                <p className="text-sm mb-4">
                    Bu sekme, "Genel Ayarlar → Ürünler" bölümündeki <strong>"Araç Tipleri"</strong> kategorisindeki
                    ürünleri seçilen dönemle eşleştirerek model bazlı maliyet analizi sunar.
                </p>
                <div className="text-xs space-y-1 bg-background/50 p-3 rounded-lg inline-block">
                    <p>🏷️ Araç tipi kategorisi: <span className="font-bold">{vehicleTypeCategory ? 'Mevcut ✓' : 'Bulunamadı ✗'}</span></p>
                    <p>🚗 Tanımlı araç modeli: <span className="font-bold">{validProductNames.length}</span></p>
                    <p>📋 Seçili dönemde üretilen araç: <span className="font-bold">{filteredProducedVehicles.length}</span></p>
                    <p>📊 Maliyetli model tipi: <span className="font-bold">{breakdownData.filter((item) => item.hasData).length}</span></p>
                </div>
            </div>
        );
    }

    return (
        <motion.div
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ staggerChildren: 0.05 }}
        >
            {breakdownData.map(({ vehicle, totalCost, totalVehicles, producedVehicleCount, hasData, metrics }) => {
                const vehicleTargets = targets[vehicle] || targets.global || {};
                const definedTargetCount = VEHICLE_METRIC_ORDER.filter(
                    (metricKey) => Number(vehicleTargets[metricKey]?.value) > 0
                ).length;
                const exceededMetrics = VEHICLE_METRIC_ORDER.filter((metricKey) => {
                    const targetValue = Number(vehicleTargets[metricKey]?.value) || 0;
                    return targetValue > 0 && metrics[metricKey] > targetValue;
                });

                return (
                    <motion.div key={vehicle} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                        <Card
                            className={cn(
                                'h-full flex flex-col cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all duration-300 bg-card/50 backdrop-blur-sm',
                                !hasData && 'opacity-60'
                            )}
                            onClick={() => handleCardClick(vehicle)}
                        >
                            <CardHeader className="pb-4 space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <Car className="h-5 w-5 text-primary shrink-0" />
                                        <CardTitle className="text-lg text-primary truncate">{vehicle}</CardTitle>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                        {exceededMetrics.length > 0 ? (
                                            <Badge variant="destructive" className="gap-1">
                                                <AlertTriangle className="h-3 w-3" />
                                                {exceededMetrics.length} hedef aşımı
                                            </Badge>
                                        ) : definedTargetCount === 0 ? (
                                            <Badge variant="outline" className="gap-1">
                                                <Target className="h-3 w-3" />
                                                Hedef yok
                                            </Badge>
                                        ) : (
                                            <Badge variant="secondary" className="gap-1">
                                                <CheckCircle2 className="h-3 w-3" />
                                                Hedefte
                                            </Badge>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <p className="text-2xl font-bold text-foreground">{formatCurrency(totalCost)}</p>
                                    <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                                        <p>
                                            <span className="font-medium">{producedVehicleCount || 0}</span> araç üretildi
                                        </p>
                                        {hasData && (
                                            <p className="text-muted-foreground/70">
                                                Hesaplama paydası: {totalVehicles || 0} araç
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </CardHeader>

                            <CardContent className="flex-grow">
                                {hasData ? (
                                    <div className="space-y-1">
                                        {VEHICLE_METRIC_ORDER.map((metricKey) => (
                                            <MetricDisplay
                                                key={metricKey}
                                                definition={getVehicleMetricDefinition(metricKey)}
                                                value={metrics[metricKey]}
                                                target={vehicleTargets[metricKey]}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center text-muted-foreground py-4">
                                        <p className="text-sm">Bu dönemde maliyet kaydı yok</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </motion.div>
                );
            })}
        </motion.div>
    );
};

export default VehicleCostBreakdown;
