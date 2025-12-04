import React, { useMemo, useState, useEffect } from 'react';
    import { motion } from 'framer-motion';
    import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
    import VehiclePerformanceModal from './VehiclePerformanceModal';
    import { supabase } from '@/lib/customSupabaseClient';
    import { Target } from 'lucide-react';
    import { cn } from '@/lib/utils';

    const formatCurrency = (value) => {
        if (typeof value !== 'number' || isNaN(value)) return '-';
        return value.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
    };

    const formatNumber = (value) => {
        if (typeof value !== 'number' || isNaN(value)) return '-';
        return value.toFixed(2).replace('.', ',');
    };

    const MetricDisplay = ({ label, value, unit, target, isCurrency = false }) => {
        const targetValue = target?.value ?? 0;
        const isOverTarget = targetValue > 0 && value > targetValue;
        const isApproachingTarget = targetValue > 0 && value > targetValue * 0.8 && value <= targetValue;
        const isUnderTarget = targetValue > 0 && value < targetValue * 0.8;

        const valueColor = isOverTarget
            ? 'text-red-500'
            : isApproachingTarget
            ? 'text-yellow-500'
            : isUnderTarget
            ? 'text-green-500'
            : 'text-foreground';

        const formattedValue = isCurrency ? formatCurrency(value) : formatNumber(value);
        const formattedTarget = isCurrency ? formatCurrency(targetValue) : formatNumber(targetValue);

        return (
            <div className="flex justify-between items-baseline text-sm py-2 border-b border-border/50 last:border-b-0">
                <span className="text-muted-foreground">{label}</span>
                <div className="text-right">
                    <p className={cn("font-bold text-lg", valueColor)}>
                        {formattedValue} <span className="text-xs font-normal">{unit}</span>
                    </p>
                    <p className="text-xs text-muted-foreground/80 flex items-center justify-end gap-1">
                        <Target className="h-3 w-3" /> Hedef: {formattedTarget} {unit}
                    </p>
                </div>
            </div>
        );
    };

    const VehicleCostBreakdown = ({ costs, loading }) => {
        const [isPerformanceModalOpen, setPerformanceModalOpen] = useState(false);
        const [selectedVehicleType, setSelectedVehicleType] = useState(null);
        const [targets, setTargets] = useState({});

        const fetchTargets = async () => {
            const { data, error } = await supabase.from('quality_cost_targets').select('*');
            if (!error && data) {
                const newTargets = {};
                data.forEach(target => {
                    const vehicleType = target.vehicle_type || 'global';
                    if (!newTargets[vehicleType]) {
                        newTargets[vehicleType] = {};
                    }
                    newTargets[vehicleType][target.target_type] = { value: target.value, unit: target.unit };
                });
                setTargets(newTargets);
            }
        };

        useEffect(() => {
            fetchTargets();
        }, []);

        const breakdownData = useMemo(() => {
            if (loading || !costs || costs.length === 0) return [];

            const vehicleData = {};

            costs.forEach(cost => {
                const vehicleType = cost.vehicle_type || 'Bilinmiyor';
                if (!vehicleData[vehicleType]) {
                    vehicleData[vehicleType] = {
                        totalCost: 0,
                        scrapCost: 0,
                        reworkCost: 0,
                        scrapWeight: 0,
                        wasteWeight: 0,
                        rejectionCount: 0,
                        vehicleSet: new Set(),
                    };
                }

                if (cost.part_code) vehicleData[vehicleType].vehicleSet.add(cost.part_code);
                vehicleData[vehicleType].totalCost += cost.amount;

                if (cost.cost_type === 'Hurda Maliyeti') {
                    vehicleData[vehicleType].scrapCost += cost.amount;
                    vehicleData[vehicleType].scrapWeight += cost.scrap_weight || 0;
                    vehicleData[vehicleType].rejectionCount += cost.quantity || 0;
                }
                if (cost.cost_type === 'Fire Maliyeti') {
                    vehicleData[vehicleType].wasteWeight += cost.scrap_weight || 0;
                }
                if (cost.cost_type === 'Yeniden İşlem Maliyeti') {
                    vehicleData[vehicleType].reworkCost += cost.amount;
                }
            });

            return Object.entries(vehicleData).map(([vehicle, data]) => {
                const totalVehicles = data.vehicleSet.size || 1;
                return {
                    vehicle,
                    totalCost: data.totalCost,
                    totalVehicles: data.vehicleSet.size,
                    metrics: {
                        scrap_cost_per_vehicle: data.scrapCost / totalVehicles,
                        rework_cost_per_vehicle: data.reworkCost / totalVehicles,
                        scrap_kg_per_vehicle: data.scrapWeight / totalVehicles,
                        waste_kg_per_vehicle: data.wasteWeight / totalVehicles,
                        rejection_count_per_vehicle: data.rejectionCount / totalVehicles,
                    }
                };
            }).sort((a, b) => b.totalCost - a.totalCost);

        }, [costs, loading]);

        const handleCardClick = (vehicleType) => {
            setSelectedVehicleType(vehicleType);
            setPerformanceModalOpen(true);
        };

        if (loading) {
            return <div className="text-center text-muted-foreground p-8">Detaylı analiz verileri yükleniyor...</div>;
        }

        if (breakdownData.length === 0) {
            return <div className="text-center text-muted-foreground p-8">Seçili dönem için veri bulunamadı.</div>;
        }

        const allVehicleCosts = selectedVehicleType ? costs.filter(c => c.vehicle_type === selectedVehicleType) : [];

        return (
            <>
                <motion.div
                    className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ staggerChildren: 0.05 }}
                >
                    {breakdownData.map(({ vehicle, totalCost, totalVehicles, metrics }) => {
                        const vehicleTargets = targets[vehicle] || targets['global'] || {};
                        return (
                            <motion.div key={vehicle} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                                <Card
                                    className="h-full flex flex-col cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all duration-300 bg-card/50 backdrop-blur-sm"
                                    onClick={() => handleCardClick(vehicle)}
                                >
                                    <CardHeader className="pb-4">
                                        <CardTitle className="text-lg text-primary">{vehicle}</CardTitle>
                                        <p className="text-2xl font-bold text-foreground">{formatCurrency(totalCost)}</p>
                                        <p className="text-xs text-muted-foreground">{totalVehicles} araç analiz edildi</p>
                                    </CardHeader>
                                    <CardContent className="flex-grow">
                                        <div className="space-y-1">
                                            <MetricDisplay label="Hurda Maliyeti" value={metrics.scrap_cost_per_vehicle} unit="TRY/Araç" target={vehicleTargets.scrap_cost_per_vehicle} isCurrency />
                                            <MetricDisplay label="Yeniden İşlem" value={metrics.rework_cost_per_vehicle} unit="TRY/Araç" target={vehicleTargets.rework_cost_per_vehicle} isCurrency />
                                            <MetricDisplay label="Hurda Ağırlığı" value={metrics.scrap_kg_per_vehicle} unit="Kg/Araç" target={vehicleTargets.scrap_kg_per_vehicle} />
                                            <MetricDisplay label="Fire Ağırlığı" value={metrics.waste_kg_per_vehicle} unit="Kg/Araç" target={vehicleTargets.waste_kg_per_vehicle} />
                                            <MetricDisplay label="Ret Adedi" value={metrics.rejection_count_per_vehicle} unit="Adet/Araç" target={vehicleTargets.rejection_count_per_vehicle} />
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        )
                    })}
                </motion.div>

                {selectedVehicleType && (
                    <VehiclePerformanceModal
                        isOpen={isPerformanceModalOpen}
                        setIsOpen={setPerformanceModalOpen}
                        vehicleType={selectedVehicleType}
                        costs={allVehicleCosts}
                        onTargetsUpdate={fetchTargets}
                    />
                )}
            </>
        );
    };

    export default VehicleCostBreakdown;