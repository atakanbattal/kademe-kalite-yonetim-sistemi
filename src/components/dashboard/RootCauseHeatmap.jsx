import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import { useData } from '@/contexts/DataContext';

const RootCauseHeatmap = () => {
    const { nonConformities, loading } = useData();

    const heatmapData = useMemo(() => {
        if (!nonConformities) return { byDepartment: [], byRootCause: [] };

        const deptMap = {};
        const rootCauseMap = {};

        nonConformities.forEach(nc => {
            // Birim bazında
            const dept = nc.requesting_unit || nc.department || 'Belirtilmemiş';
            if (!deptMap[dept]) {
                deptMap[dept] = { name: dept, count: 0, severity: 0 };
            }
            deptMap[dept].count++;
            deptMap[dept].severity += nc.severity || 5;

            // Kök neden bazında (8D D4 adımından veya root_cause alanından)
            const rootCause = nc.root_cause || nc.eight_d_steps?.D4?.description || 'Belirtilmemiş';
            const rootCauseKey = rootCause.substring(0, 50); // İlk 50 karakter
            
            if (!rootCauseMap[rootCauseKey]) {
                rootCauseMap[rootCauseKey] = { name: rootCauseKey, count: 0, departments: new Set() };
            }
            rootCauseMap[rootCauseKey].count++;
            if (dept !== 'Belirtilmemiş') {
                rootCauseMap[rootCauseKey].departments.add(dept);
            }
        });

        // Birim bazında sıralama
        const byDepartment = Object.values(deptMap)
            .map(dept => ({
                ...dept,
                avgSeverity: dept.count > 0 ? (dept.severity / dept.count).toFixed(1) : '0'
            }))
            .sort((a, b) => b.count - a.count);

        // Kök neden bazında sıralama
        const byRootCause = Object.values(rootCauseMap)
            .map(rc => ({
                ...rc,
                departmentCount: rc.departments.size,
                departments: Array.from(rc.departments).join(', ')
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10); // Top 10

        return { byDepartment, byRootCause };
    }, [nonConformities]);

    const getHeatmapColor = (value, max) => {
        const intensity = value / max;
        if (intensity >= 0.8) return 'bg-red-600';
        if (intensity >= 0.6) return 'bg-orange-500';
        if (intensity >= 0.4) return 'bg-yellow-400';
        if (intensity >= 0.2) return 'bg-yellow-200';
        return 'bg-green-100';
    };

    const maxDeptCount = Math.max(...heatmapData.byDepartment.map(d => d.count), 1);
    const maxRootCauseCount = Math.max(...heatmapData.byRootCause.map(rc => rc.count), 1);

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-orange-500" />
                        Kök Neden Isı Haritası
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8 text-muted-foreground">Yükleniyor...</div>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Birim Bazında Isı Haritası */}
            <Card>
                <CardHeader>
                    <CardTitle>Birim Bazında Hata Yoğunluğu</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                        Koyu renk = Daha fazla hata
                    </p>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {heatmapData.byDepartment.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                Veri bulunamadı.
                            </div>
                        ) : (
                            heatmapData.byDepartment.map((dept, idx) => (
                                <div 
                                    key={idx}
                                    className={`p-3 rounded-lg text-white transition-all ${getHeatmapColor(dept.count, maxDeptCount)}`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-semibold">{dept.name}</p>
                                            <p className="text-xs opacity-90">{dept.count} uygunsuzluk</p>
                                        </div>
                                        <Badge variant="secondary" className="bg-white/20 text-white">
                                            Ort. Şiddet: {dept.avgSeverity}
                                        </Badge>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Kök Neden Bazında Isı Haritası */}
            <Card>
                <CardHeader>
                    <CardTitle>En Çok Tekrarlayan Kök Nedenler</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                        Top 10 kök neden
                    </p>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {heatmapData.byRootCause.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                Kök neden verisi bulunamadı.
                            </div>
                        ) : (
                            heatmapData.byRootCause.map((rc, idx) => (
                                <div 
                                    key={idx}
                                    className={`p-3 rounded-lg text-white transition-all ${getHeatmapColor(rc.count, maxRootCauseCount)}`}
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="font-semibold text-sm">{rc.name}</p>
                                        <Badge variant="secondary" className="bg-white/20 text-white">
                                            {rc.count} kez
                                        </Badge>
                                    </div>
                                    {rc.departments && (
                                        <p className="text-xs opacity-90">
                                            Etkilenen birimler: {rc.departments || 'Belirtilmemiş'}
                                        </p>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default RootCauseHeatmap;

