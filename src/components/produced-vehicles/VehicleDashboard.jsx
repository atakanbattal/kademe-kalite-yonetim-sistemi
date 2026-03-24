import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, CheckCircle, Wrench, Truck, Hourglass, BarChartHorizontal, FlaskConical, PackageCheck, ClipboardCheck } from 'lucide-react';
import { formatDuration } from '@/lib/formatDuration.js';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Badge } from '@/components/ui/badge';
import { calculateVehicleTimelineStats, calculateMonthlyAvgQualityAndRework } from '@/lib/vehicleTimelineUtils';

const MonthlyDurationTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-lg border border-border bg-popover px-3 py-2 text-sm shadow-md">
            <p className="mb-1 font-semibold text-foreground">{label}</p>
            {payload.map((entry) => (
                <p key={String(entry.dataKey)} className="text-foreground/90">
                    <span className="font-medium" style={{ color: entry.color }}>{entry.name}: </span>
                    {entry.value != null && !Number.isNaN(entry.value)
                        ? formatDuration(entry.value * 60000)
                        : '—'}
                </p>
            ))}
        </div>
    );
};

// Durum konfigürasyonları
const STATUS_CONFIG = [
        { 
            key: 'inQuality', 
            label: 'Kalitede Bekleyen', 
            statusFilter: 'Kalitede Bekleyen',
            color: 'bg-blue-500', 
            hoverColor: 'hover:bg-blue-600',
            textColor: 'text-blue-600',
            borderColor: 'border-blue-500',
            icon: Clock,
            tooltip: 'Kaliteye Girdi + Kontrol Başladı + Kontrol Bitti'
        },
        { 
            key: 'inRework', 
            label: 'Yeniden İşlemde', 
            statusFilter: 'Yeniden İşlemde',
            color: 'bg-red-500', 
            hoverColor: 'hover:bg-red-600',
            textColor: 'text-red-600',
            borderColor: 'border-red-500',
            icon: Wrench,
            tooltip: 'Aktif yeniden işlem sürecinde'
        },
        { 
            key: 'reworkDone', 
            label: 'Yeniden İşlem Bitti', 
            statusFilter: 'Yeniden İşlem Bitti',
            color: 'bg-orange-500', 
            hoverColor: 'hover:bg-orange-600',
            textColor: 'text-orange-600',
            borderColor: 'border-orange-500',
            icon: ClipboardCheck,
            tooltip: 'Yeniden işlemi tamamlanan araçlar'
        },
        { 
            key: 'inArge', 
            label: 'Ar-Ge\'de', 
            statusFilter: 'Ar-Ge\'de',
            color: 'bg-purple-500', 
            hoverColor: 'hover:bg-purple-600',
            textColor: 'text-purple-600',
            borderColor: 'border-purple-500',
            icon: FlaskConical,
            tooltip: 'Ar-Ge sürecinde olan araçlar'
        },
        { 
            key: 'waitingForShippingInfo', 
            label: 'Sevk Bilgisi Bekleniyor', 
            statusFilter: 'Sevk Bilgisi Bekleniyor',
            color: 'bg-amber-500', 
            hoverColor: 'hover:bg-amber-600',
            textColor: 'text-amber-600',
            borderColor: 'border-amber-500',
            icon: PackageCheck,
            tooltip: 'Sevk bilgisi beklenen araçlar'
        },
        { 
            key: 'readyForShipment', 
            label: 'Sevke Hazır', 
            statusFilter: 'Sevk Hazır',
            color: 'bg-green-500', 
            hoverColor: 'hover:bg-green-600',
            textColor: 'text-green-600',
            borderColor: 'border-green-500',
            icon: CheckCircle,
            tooltip: 'Sevk için hazır olan araçlar'
        },
        { 
            key: 'shipped', 
            label: 'Sevk Edilmiş', 
            statusFilter: 'Sevk Edildi',
            color: 'bg-gray-400', 
            hoverColor: 'hover:bg-gray-500',
            textColor: 'text-gray-600',
            borderColor: 'border-gray-400',
            icon: Truck,
            tooltip: 'Sevk edilmiş araçlar'
        },
    ];

    // Segmented Progress Bar Bileşeni
    const SegmentedProgressBar = ({ stats, total, onStatusClick, loading }) => {
        if (loading) {
            return <Skeleton className="h-10 w-full rounded-lg" />;
        }

        // Sadece değeri 0'dan büyük olan durumları göster
        const activeStatuses = STATUS_CONFIG.filter(status => stats[status.key] > 0);
        
        return (
            <div className="w-full">
                {/* Progress Bar */}
                <div className="flex h-10 rounded-lg overflow-hidden border border-border shadow-sm">
                    {activeStatuses.length > 0 ? (
                        activeStatuses.map((status) => {
                            const value = stats[status.key];
                            const percentage = total > 0 ? (value / total) * 100 : 0;
                            const Icon = status.icon;
                            
                            return (
                                <TooltipProvider key={status.key}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <motion.button
                                                className={`${status.color} ${status.hoverColor} flex items-center justify-center gap-1 text-white font-medium text-sm transition-all cursor-pointer`}
                                                style={{ width: `${percentage}%`, minWidth: value > 0 ? '40px' : '0' }}
                                                onClick={() => onStatusClick(status.statusFilter)}
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                            >
                                                <Icon className="h-4 w-4" />
                                                <span className="font-bold">{value}</span>
                                            </motion.button>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom">
                                            <p className="font-semibold">{status.label}</p>
                                            <p className="text-xs text-muted-foreground">{status.tooltip}</p>
                                            <p className="text-xs mt-1">%{percentage.toFixed(1)} ({value} araç)</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            );
                        })
                    ) : (
                        <div className="flex-1 bg-muted flex items-center justify-center text-muted-foreground text-sm">
                            Veri bulunamadı
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // Legend Bileşeni - Tıklanabilir badge'ler
    const StatusLegend = ({ stats, onStatusClick, loading }) => {
        if (loading) {
            return (
                <div className="flex flex-wrap gap-2">
                    {Array.from({ length: 7 }).map((_, i) => (
                        <Skeleton key={i} className="h-7 w-24 rounded-full" />
                    ))}
                </div>
            );
        }

        return (
            <div className="flex flex-wrap gap-2">
                {STATUS_CONFIG.map((status) => {
                    const value = stats[status.key];
                    const Icon = status.icon;
                    const hasData = value > 0;
                    
                    return (
                        <TooltipProvider key={status.key}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <motion.button
                                        className={`
                                            inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium
                                            border-2 transition-all cursor-pointer
                                            ${hasData 
                                                ? `${status.borderColor} ${status.textColor} bg-background hover:bg-muted` 
                                                : 'border-muted text-muted-foreground bg-muted/50 opacity-60'
                                            }
                                        `}
                                        onClick={() => onStatusClick(status.statusFilter)}
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                    >
                                        <Icon className="h-3.5 w-3.5" />
                                        <span>{status.label}</span>
                                        <Badge 
                                            variant={hasData ? "default" : "secondary"} 
                                            className={`ml-1 h-5 min-w-[20px] px-1.5 ${hasData ? status.color : ''}`}
                                        >
                                            {value}
                                        </Badge>
                                    </motion.button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{status.tooltip}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    );
                })}
            </div>
        );
    };

    // Özet İstatistik Kartı
    const SummaryCard = ({ label, value, icon: Icon, colorClass, loading, onClick, tooltip }) => (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <motion.div
                        className="flex items-center gap-3 px-4 py-3 bg-background border rounded-lg cursor-pointer hover:border-primary transition-colors"
                        onClick={onClick}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        <div className={`p-2 rounded-full bg-muted`}>
                            <Icon className={`h-5 w-5 ${colorClass}`} />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">{label}</p>
                            {loading ? (
                                <Skeleton className="h-6 w-16" />
                            ) : (
                                <p className="text-lg font-bold">{value}</p>
                            )}
                        </div>
                    </motion.div>
                </TooltipTrigger>
                {tooltip && (
                    <TooltipContent>
                        <p>{tooltip}</p>
                    </TooltipContent>
                )}
            </Tooltip>
        </TooltipProvider>
    );

    const VehicleDashboard = ({ vehicles, loading, onStatusClick }) => {
        const stats = useMemo(() => {
            if (loading || !vehicles) {
            return {
                inQuality: 0,
                reworkDone: 0,
                waitingForShippingInfo: 0,
                readyForShipment: 0,
                inRework: 0,
                inArge: 0,
                shipped: 0,
                avgInspectionTime: "0 dk",
                avgReworkTime: "0 dk"
            };
            }

            // Tüm durumları kapsayan istatistikler
            const baseStats = {
                // Kalitede Bekleyen: Kaliteye Girdi + Kontrol Başladı + Kontrol Bitti
                inQuality: vehicles.filter(v => ['Kaliteye Girdi', 'Kontrol Başladı', 'Kontrol Bitti'].includes(v.status)).length,
                // Yeniden İşlem Bitti
                reworkDone: vehicles.filter(v => v.status === 'Yeniden İşlem Bitti').length,
                // Sevk Bilgisi Bekleniyor
                waitingForShippingInfo: vehicles.filter(v => v.status === 'Sevk Bilgisi Bekleniyor').length,
                // Sevke Hazır
                readyForShipment: vehicles.filter(v => v.status === 'Sevk Hazır').length,
                // Yeniden İşlemde
                inRework: vehicles.filter(v => v.status === 'Yeniden İşlemde').length,
                // Ar-Ge'de
                inArge: vehicles.filter(v => v.status === 'Ar-Ge\'de').length,
                // Sevk Edilmiş
                shipped: vehicles.filter(v => v.status === 'Sevk Edildi').length,
            };

            let totalInspectionMillis = 0;
            let inspectionCount = 0;
            let totalReworkMillis = 0;
            let reworkCount = 0;
            const timelineNow = new Date();

            vehicles.forEach(vehicle => {
                const timelineStats = calculateVehicleTimelineStats(vehicle.vehicle_timeline_events, timelineNow);
                totalInspectionMillis += timelineStats.totalControlMillis;
                inspectionCount += timelineStats.controlCycleCount;
                totalReworkMillis += timelineStats.totalReworkMillis;
                reworkCount += timelineStats.reworkCycleCount;
            });

            const avgInspectionTime = inspectionCount > 0 ? formatDuration(totalInspectionMillis / inspectionCount) : "0 dk";
            const avgReworkTime = reworkCount > 0 ? formatDuration(totalReworkMillis / reworkCount) : "0 dk";

            return {
                ...baseStats,
                avgInspectionTime,
                avgReworkTime,
            };
        }, [vehicles, loading]);

        const monthlyChartData = useMemo(() => {
            if (loading || !vehicles?.length) return [];
            return calculateMonthlyAvgQualityAndRework(vehicles, new Date()).slice(-24);
        }, [vehicles, loading]);

        const total = vehicles?.length || 0;

        return (
            <Card className="p-4">
                <CardContent className="p-0 space-y-4">
                    {/* Üst kısım: Toplam ve Ortalama Süreler */}
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <div className="text-2xl font-bold text-primary">{total}</div>
                            <div className="text-sm text-muted-foreground">Toplam Araç</div>
                            <button 
                                onClick={() => onStatusClick('Tümü')}
                                className="text-xs text-primary hover:underline ml-2"
                            >
                                Tümünü Gör →
                            </button>
                        </div>
                        
                        <div className="flex items-center gap-4">
                            <SummaryCard 
                                label="Ort. Kontrol" 
                                value={stats.avgInspectionTime} 
                                icon={BarChartHorizontal}
                                colorClass="text-purple-500"
                                loading={loading}
                                tooltip="Ortalama kontrol süresi"
                            />
                            <SummaryCard 
                                label="Ort. Yeniden İşlem" 
                                value={stats.avgReworkTime} 
                                icon={Hourglass}
                                colorClass="text-orange-500"
                                loading={loading}
                                tooltip="Ortalama yeniden işlem süresi"
                            />
                        </div>
                    </div>

                    {monthlyChartData.length > 0 && (
                        <div className="space-y-3 border-t border-border/80 pt-4">
                            <CardHeader className="p-0 space-y-1.5">
                                <CardTitle className="text-base font-semibold tracking-tight text-foreground">
                                    Aylık süre özeti
                                </CardTitle>
                                <CardDescription className="text-sm leading-relaxed text-muted-foreground">
                                    Tamamlanan kalite kontrolü ile yeniden işlem adımlarının ortalama süreleri, ilgili adımın bittiği aya göre gruplanır.
                                    <span className="mt-1 block text-xs text-muted-foreground/90">
                                        Son {monthlyChartData.length} ay · Sol eksen: kontrol, sağ eksen: yeniden işlem (dakika).
                                    </span>
                                </CardDescription>
                            </CardHeader>
                            <div className="h-[300px] w-full min-w-0 pr-1">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart
                                        data={monthlyChartData}
                                        margin={{ top: 10, right: 14, left: 2, bottom: 44 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/80" />
                                        <XAxis
                                            dataKey="monthShort"
                                            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                                            tickMargin={10}
                                            interval={monthlyChartData.length > 16 ? 'preserveStartEnd' : 0}
                                            minTickGap={4}
                                            padding={{ left: 12, right: 28 }}
                                            height={46}
                                        />
                                        <YAxis
                                            yAxisId="kalite"
                                            orientation="left"
                                            tick={{ fontSize: 10, fill: '#9333ea' }}
                                            tickFormatter={(v) => `${Math.round(v)} dk`}
                                            width={46}
                                            domain={['auto', 'auto']}
                                        />
                                        <YAxis
                                            yAxisId="rework"
                                            orientation="right"
                                            tick={{ fontSize: 10, fill: '#ea580c' }}
                                            tickFormatter={(v) => `${Math.round(v)} dk`}
                                            width={52}
                                            domain={['auto', 'auto']}
                                        />
                                        <RechartsTooltip content={<MonthlyDurationTooltip />} />
                                        <Legend
                                            verticalAlign="bottom"
                                            align="center"
                                            wrapperStyle={{ fontSize: '12px', paddingTop: '12px', lineHeight: '1.35' }}
                                        />
                                        <Line
                                            yAxisId="kalite"
                                            type="monotone"
                                            dataKey="ortKaliteDk"
                                            name="Ort. kontrol süresi"
                                            stroke="#9333ea"
                                            strokeWidth={2}
                                            dot={{ r: 3, strokeWidth: 1 }}
                                            activeDot={{ r: 5 }}
                                            connectNulls
                                        />
                                        <Line
                                            yAxisId="rework"
                                            type="monotone"
                                            dataKey="ortYenidenIslemDk"
                                            name="Ort. yeniden işlem süresi"
                                            stroke="#ea580c"
                                            strokeWidth={2}
                                            dot={{ r: 3, strokeWidth: 1 }}
                                            activeDot={{ r: 5 }}
                                            connectNulls
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {!loading && monthlyChartData.length === 0 && vehicles?.length > 0 && (
                        <p className="border-t border-border/80 pt-3 text-center text-sm text-muted-foreground">
                            Zaman çizelgesinde tamamlanmış kontrol veya yeniden işlem adımı olmadığı için aylık özet gösterilemiyor.
                        </p>
                    )}

                    {/* Segmented Progress Bar */}
                    <SegmentedProgressBar 
                        stats={stats} 
                        total={total} 
                        onStatusClick={onStatusClick}
                        loading={loading}
                    />
                    
                    {/* Legend - Tıklanabilir Badge'ler */}
                    <StatusLegend 
                        stats={stats} 
                        onStatusClick={onStatusClick}
                        loading={loading}
                    />
                </CardContent>
            </Card>
        );
    };

export default VehicleDashboard;
