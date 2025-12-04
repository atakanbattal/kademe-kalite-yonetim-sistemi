import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, DollarSign, Repeat, Car } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

const CriticalNonConformities = ({ onViewDetails }) => {
    const { nonConformities, qualityCosts, producedVehicles, loading } = useData();

    // RPN'i yüksek maddeler (RPN = Severity × Occurrence × Detection)
    // RPN skorları genellikle 1-10 arası değerlerle çalışır, maksimum 10×10×10 = 1000
    const highRPN = useMemo(() => {
        if (!nonConformities) return [];
        return nonConformities
            .filter(nc => {
                if (nc.status === 'Kapatıldı') return false;
                // RPN hesaplama: Severity (1-10) × Occurrence (1-10) × Detection (1-10)
                // Eğer değerler yoksa varsayılan olarak 5 kullanılır (orta risk)
                const severity = Math.min(Math.max(nc.severity || 5, 1), 10); // 1-10 arası
                const occurrence = Math.min(Math.max(nc.occurrence || 5, 1), 10); // 1-10 arası
                const detection = Math.min(Math.max(nc.detection || 5, 1), 10); // 1-10 arası
                const rpn = severity * occurrence * detection;
                // RPN >= 100 kritik kabul edilir (örn: 5×5×4 = 100)
                return rpn >= 100;
            })
            .map(nc => {
                const severity = Math.min(Math.max(nc.severity || 5, 1), 10);
                const occurrence = Math.min(Math.max(nc.occurrence || 5, 1), 10);
                const detection = Math.min(Math.max(nc.detection || 5, 1), 10);
                return {
                    ...nc,
                    rpn: severity * occurrence * detection,
                    severity,
                    occurrence,
                    detection
                };
            })
            .sort((a, b) => b.rpn - a.rpn)
            .slice(0, 5);
    }, [nonConformities]);

    // Maliyeti yüksek 5 uygunsuzluk
    const highCostNCs = useMemo(() => {
        if (!nonConformities || !qualityCosts) return [];
        
        const ncCostMap = {};
        qualityCosts.forEach(cost => {
            if (cost.related_nc_id) {
                if (!ncCostMap[cost.related_nc_id]) {
                    ncCostMap[cost.related_nc_id] = 0;
                }
                ncCostMap[cost.related_nc_id] += cost.amount || 0;
            }
        });

        return Object.entries(ncCostMap)
            .map(([ncId, totalCost]) => {
                const nc = nonConformities.find(n => n.id === ncId);
                if (!nc || nc.status === 'Kapatıldı') return null;
                return { ...nc, totalCost };
            })
            .filter(Boolean)
            .sort((a, b) => b.totalCost - a.totalCost)
            .slice(0, 5);
    }, [nonConformities, qualityCosts]);

    // Tekrarlayan uygunsuzluklar
    const recurringNCs = useMemo(() => {
        if (!nonConformities) return [];
        
        const ncMap = {};
        nonConformities.forEach(nc => {
            const key = nc.part_code || nc.title?.substring(0, 30) || 'Bilinmeyen';
            if (!ncMap[key]) {
                ncMap[key] = {
                    ...nc,
                    count: 0,
                    occurrences: []
                };
            }
            ncMap[key].count++;
            ncMap[key].occurrences.push(nc);
        });

        return Object.values(ncMap)
            .filter(item => item.count > 1)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
    }, [nonConformities]);

    // Kritik araçlar (en çok DF çıkan)
    const criticalVehicles = useMemo(() => {
        if (!producedVehicles) return [];
        
        const vehicleNCMap = {};
        nonConformities?.forEach(nc => {
            if (nc.vehicle_type) {
                if (!vehicleNCMap[nc.vehicle_type]) {
                    vehicleNCMap[nc.vehicle_type] = {
                        vehicleType: nc.vehicle_type,
                        ncCount: 0,
                        openNCs: 0
                    };
                }
                vehicleNCMap[nc.vehicle_type].ncCount++;
                if (nc.status !== 'Kapatıldı') {
                    vehicleNCMap[nc.vehicle_type].openNCs++;
                }
            }
        });

        return Object.values(vehicleNCMap)
            .sort((a, b) => b.openNCs - a.openNCs)
            .slice(0, 5);
    }, [producedVehicles, nonConformities]);

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>5 En Kritik Uygunsuzluk</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8 text-muted-foreground">Yükleniyor...</div>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* RPN'i Yüksek Maddeler */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                        RPN'i Yüksek Maddeler
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {highRPN.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            RPN'i yüksek uygunsuzluk bulunmuyor.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {highRPN.map((nc, idx) => (
                                <div 
                                    key={idx} 
                                    className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900 cursor-pointer hover:bg-red-100 dark:hover:bg-red-950/30 transition-colors"
                                    onClick={() => onViewDetails && onViewDetails(nc)}
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-medium">{nc.nc_number || nc.mdi_no || 'N/A'}</p>
                                            <p className="text-xs text-muted-foreground">{nc.title || 'Başlıksız'}</p>
                                        </div>
                                        <Badge variant="destructive">RPN: {nc.rpn}</Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Maliyeti Yüksek Uygunsuzluklar */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-orange-500" />
                        Maliyeti Yüksek Uygunsuzluklar
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {highCostNCs.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            Maliyet verisi bulunamadı.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {highCostNCs.map((nc, idx) => (
                                <div 
                                    key={idx} 
                                    className="p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-900 cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-950/30 transition-colors"
                                    onClick={() => onViewDetails && onViewDetails(nc)}
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-medium">{nc.nc_number || nc.mdi_no || 'N/A'}</p>
                                            <p className="text-xs text-muted-foreground">{nc.title || 'Başlıksız'}</p>
                                        </div>
                                        <Badge variant="secondary">
                                            {nc.totalCost.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Tekrarlayan Uygunsuzluklar */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Repeat className="h-5 w-5 text-purple-500" />
                        Tekrarlayan Uygunsuzluklar
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {recurringNCs.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            Tekrarlayan uygunsuzluk bulunmuyor.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {recurringNCs.map((item, idx) => (
                                <div 
                                    key={idx} 
                                    className="p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-900 cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-950/30 transition-colors"
                                    onClick={() => onViewDetails && onViewDetails(item)}
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-medium">{item.part_code || 'Parça Kodu Belirtilmemiş'}</p>
                                            <p className="text-xs text-muted-foreground">{item.title || 'Başlıksız'}</p>
                                        </div>
                                        <Badge variant="destructive">{item.count} kez</Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Kritik Araçlar */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Car className="h-5 w-5 text-blue-500" />
                        En Çok Sorun Yaşanan Araç Tipleri
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {criticalVehicles.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            Araç tipi verisi bulunamadı.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {criticalVehicles.map((vehicle, idx) => (
                                <div 
                                    key={idx} 
                                    className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900"
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-medium">{vehicle.vehicleType}</p>
                                            <p className="text-xs text-muted-foreground">Toplam {vehicle.ncCount} uygunsuzluk</p>
                                        </div>
                                        <Badge variant="destructive">{vehicle.openNCs} açık</Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default CriticalNonConformities;

