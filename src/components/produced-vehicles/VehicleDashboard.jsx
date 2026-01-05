import React, { useMemo } from 'react';
    import { motion } from 'framer-motion';
    import { Skeleton } from '@/components/ui/skeleton';
    import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
    import { Clock, CheckCircle, Wrench, Truck, Hourglass, BarChartHorizontal } from 'lucide-react';
    import { parseISO, differenceInMilliseconds } from 'date-fns';
    import { formatDuration } from '@/lib/formatDuration.js';

    // Sayı formatlama fonksiyonu - tüm sayıları doğru gösterir
    const formatNumber = (value) => {
        if (value === null || value === undefined || value === '') return '0';
        // Süre değerleri için (örn: "5 dk", "2s 30dk")
        if (typeof value === 'string' && (value.includes('dk') || value.includes('sn') || value.includes('g') || value.includes('s'))) {
            return value;
        }
        const numValue = typeof value === 'number' ? value : parseFloat(value);
        if (isNaN(numValue)) return String(value);
        // Büyük sayılar için binlik ayırıcı kullan
        return numValue.toLocaleString('tr-TR', { maximumFractionDigits: 0 });
    };

    const StatCard = ({ title, value, icon, onClick, loading, colorClass, isDuration = false }) => (
        <motion.div
            whileHover={{ y: -5 }}
            transition={{ type: 'spring', stiffness: 300 }}
        >
            <Card className="cursor-pointer hover:border-primary transition-colors duration-300 h-full" onClick={onClick}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                    {React.cloneElement(icon, { className: `h-5 w-5 ${colorClass}` })}
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <Skeleton className="h-8 w-1/2" />
                    ) : (
                        <div className="text-3xl font-bold text-foreground">{formatNumber(value)}</div>
                    )}
                </CardContent>
            </Card>
        </motion.div>
    );

    const VehicleDashboard = ({ vehicles, loading, onStatusClick }) => {
        const stats = useMemo(() => {
            if (loading || !vehicles) {
                return {
                    inQuality: 0,
                    readyForShipment: 0,
                    inRework: 0,
                    shipped: 0,
                    avgInspectionTime: "0 dk",
                    avgReworkTime: "0 dk"
                };
            }

            const baseStats = {
                inQuality: vehicles.filter(v => ['Kaliteye Girdi', 'Kontrol Başladı', 'Kontrol Bitti'].includes(v.status)).length,
                readyForShipment: vehicles.filter(v => v.status === 'Sevk Hazır').length,
                inRework: vehicles.filter(v => v.status === 'Yeniden İşlemde').length,
                shipped: vehicles.filter(v => v.status === 'Sevk Edildi').length,
            };

            let totalInspectionMillis = 0;
            let inspectionCount = 0;
            let totalReworkMillis = 0;
            let reworkCount = 0;

            vehicles.forEach(vehicle => {
                const timeline = vehicle.vehicle_timeline_events || [];
                for (let i = 0; i < timeline.length; i++) {
                    const currentEvent = timeline[i];
                    
                    if (currentEvent.event_type === 'control_start') {
                        const nextEnd = timeline.slice(i + 1).find(e => e.event_type === 'control_end');
                        if (nextEnd) {
                            totalInspectionMillis += differenceInMilliseconds(parseISO(nextEnd.event_timestamp), parseISO(currentEvent.event_timestamp));
                            inspectionCount++;
                        }
                    } else if (currentEvent.event_type === 'rework_start') {
                        const nextEnd = timeline.slice(i + 1).find(e => e.event_type === 'rework_end');
                        // Eğer rework_end yoksa, şu anki zamana kadar hesapla (dinamik)
                        if (nextEnd) {
                            totalReworkMillis += differenceInMilliseconds(parseISO(nextEnd.event_timestamp), parseISO(currentEvent.event_timestamp));
                            reworkCount++;
                        } else {
                            // Devam eden yeniden işlem - şu anki zamana kadar hesapla
                            totalReworkMillis += differenceInMilliseconds(new Date(), parseISO(currentEvent.event_timestamp));
                            reworkCount++;
                        }
                    }
                }
            });

            const avgInspectionTime = inspectionCount > 0 ? formatDuration(totalInspectionMillis / inspectionCount) : "0 dk";
            const avgReworkTime = reworkCount > 0 ? formatDuration(totalReworkMillis / reworkCount) : "0 dk";

            return {
                ...baseStats,
                avgInspectionTime,
                avgReworkTime,
            };
        }, [vehicles, loading]);

        return (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
                <StatCard 
                    title="Kalitede Bekleyen" 
                    value={stats.inQuality} 
                    icon={<Clock />} 
                    onClick={() => onStatusClick('Kalitede Bekleyen')}
                    loading={loading}
                    colorClass="text-blue-500"
                />
                <StatCard 
                    title="Sevke Hazır" 
                    value={stats.readyForShipment} 
                    icon={<CheckCircle />} 
                    onClick={() => onStatusClick('Sevk Hazır')}
                    loading={loading}
                    colorClass="text-green-500"
                />
                <StatCard 
                    title="Yeniden İşlemde" 
                    value={stats.inRework} 
                    icon={<Wrench />} 
                    onClick={() => onStatusClick('Yeniden İşlemde')}
                    loading={loading}
                    colorClass="text-red-500"
                />
                <StatCard 
                    title="Sevk Edilmiş" 
                    value={stats.shipped} 
                    icon={<Truck />} 
                    onClick={() => onStatusClick('Sevk Edildi')}
                    loading={loading}
                    colorClass="text-gray-500"
                />
                 <StatCard 
                    title="Ort. Kontrol Süresi" 
                    value={stats.avgInspectionTime} 
                    icon={<BarChartHorizontal />}
                    loading={loading}
                    colorClass="text-purple-500"
                    isDuration
                />
                <StatCard 
                    title="Ort. Yeniden İşlem Süresi" 
                    value={stats.avgReworkTime} 
                    icon={<Hourglass />} 
                    loading={loading}
                    colorClass="text-orange-500"
                    isDuration
                />
            </div>
        );
    };

    export default VehicleDashboard;