import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import { useData } from '@/contexts/DataContext';

const RootCauseHeatmap = ({ onDeptClick }) => {
    const { nonConformities, loading } = useData();

    const heatmapData = useMemo(() => {
        if (!nonConformities) return { byDepartment: [], byRootCause: [] };

        // Kalite birimlerini hariç tut (bildiren birimler, sorumlu değiller)
        const qualityDepartments = [
            'kalite', 'kalite kontrol', 'kalite güvence', 'kalite kontrol ve güvence',
            'quality', 'quality control', 'quality assurance', 'qc', 'qa'
        ];

        const deptMap = {};
        const rootCauseMap = {};

        nonConformities.forEach(nc => {
            // Sorumlu birimi kullan (responsible_unit), yoksa department
            const dept = nc.responsible_unit || nc.department || 'Belirtilmemiş';
            
            // Kalite birimlerini birim bazlı analizden hariç tut
            const isQualityDept = qualityDepartments.some(q => dept.toLowerCase().includes(q));
            
            if (!isQualityDept) {
                if (!deptMap[dept]) {
                    deptMap[dept] = { name: dept, count: 0, severity: 0 };
                }
                deptMap[dept].count++;
                deptMap[dept].severity += nc.severity || 5;
            }

            // Kök neden bazında (8D D4 adımından veya root_cause alanından)
            const rootCause = nc.root_cause || nc.eight_d_steps?.D4?.description || 'Belirtilmemiş';
            const rootCauseKey = rootCause.substring(0, 50); // İlk 50 karakter
            
            if (!rootCauseMap[rootCauseKey]) {
                rootCauseMap[rootCauseKey] = { name: rootCauseKey, count: 0, departments: new Set() };
            }
            rootCauseMap[rootCauseKey].count++;
            if (dept !== 'Belirtilmemiş' && !isQualityDept) {
                rootCauseMap[rootCauseKey].departments.add(dept);
            }
        });

        // Birim bazında sıralama (Kalite birimleri hariç)
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
        if (intensity >= 0.8) return 'bg-red-600 text-white';
        if (intensity >= 0.6) return 'bg-orange-500 text-white';
        if (intensity >= 0.4) return 'bg-yellow-400 text-gray-900';
        if (intensity >= 0.2) return 'bg-yellow-200 text-gray-900';
        return 'bg-green-100 text-gray-900';
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
                    <CardTitle className="text-lg font-bold">Birim Bazında Hata Yoğunluğu</CardTitle>
                    <p className="text-sm font-medium text-muted-foreground mt-2">
                        <span className="inline-block w-3 h-3 bg-red-600 rounded mr-1"></span>
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
                            heatmapData.byDepartment.map((dept, idx) => {
                                const colorClass = getHeatmapColor(dept.count, maxDeptCount);
                                const isDark = colorClass.includes('text-white');
                                return (
                                    <div 
                                        key={idx}
                                        className={`p-4 rounded-lg transition-all ${colorClass} shadow-sm hover:shadow-md cursor-pointer`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                                <p className={`font-bold text-base mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                    {dept.name}
                                                </p>
                                                <p className={`text-sm font-medium ${isDark ? 'text-white/90' : 'text-gray-700'}`}>
                                                    {dept.count} uygunsuzluk
                                                </p>
                                            </div>
                                            <Badge 
                                                variant={isDark ? "secondary" : "default"} 
                                                className={`ml-3 ${isDark ? 'bg-white/30 text-white border-white/50' : 'bg-white/80 text-gray-900'}`}
                                            >
                                                Ort. Şiddet: {dept.avgSeverity}
                                            </Badge>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Kök Neden Bazında Isı Haritası */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg font-bold">En Çok Tekrarlayan Kök Nedenler</CardTitle>
                    <p className="text-sm font-medium text-muted-foreground mt-2">
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
                            heatmapData.byRootCause.map((rc, idx) => {
                                const colorClass = getHeatmapColor(rc.count, maxRootCauseCount);
                                const isDark = colorClass.includes('text-white');
                                return (
                                    <div 
                                        key={idx}
                                        className={`p-4 rounded-lg transition-all ${colorClass} shadow-sm hover:shadow-md cursor-pointer`}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <p className={`font-bold text-base flex-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                {rc.name}
                                            </p>
                                            <Badge 
                                                variant={isDark ? "secondary" : "default"} 
                                                className={`ml-3 ${isDark ? 'bg-white/30 text-white border-white/50' : 'bg-white/80 text-gray-900'}`}
                                            >
                                                {rc.count} kez
                                            </Badge>
                                        </div>
                                        {rc.departments && (
                                            <p className={`text-sm font-medium ${isDark ? 'text-white/90' : 'text-gray-700'}`}>
                                                <span className="font-semibold">Etkilenen birimler:</span> {rc.departments || 'Belirtilmemiş'}
                                            </p>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default RootCauseHeatmap;

