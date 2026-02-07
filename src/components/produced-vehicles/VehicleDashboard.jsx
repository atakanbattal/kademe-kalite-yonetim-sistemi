import React, { useMemo } from 'react';
    import { motion } from 'framer-motion';
    import { Skeleton } from '@/components/ui/skeleton';
    import { Card, CardContent } from '@/components/ui/card';
    import { Clock, CheckCircle, Wrench, Truck, Hourglass, BarChartHorizontal, FlaskConical, PackageCheck, ClipboardCheck } from 'lucide-react';
    import { parseISO, differenceInMilliseconds } from 'date-fns';
    import { formatDuration } from '@/lib/formatDuration.js';
    import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
    import { Badge } from '@/components/ui/badge';

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