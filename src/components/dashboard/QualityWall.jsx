import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, AlertTriangle, Award } from 'lucide-react';
import { useData } from '@/contexts/DataContext';

const QualityWall = () => {
    const { nonConformities, productionDepartments, loading } = useData();

    const departmentPerformance = useMemo(() => {
        if (!nonConformities || !productionDepartments) return { best: [], worst: [] };

        const deptStats = {};
        
        // Her birim için istatistikler - açılan birimlerden veri çek
        nonConformities.forEach(nc => {
            // Reddedilenleri kapatma oranı hesabına dahil etme
            if (nc.status === 'Reddedildi') return;
            
            // Açılan birim: department kolonu (talep eden birim yerine)
            const dept = nc.department || 'Belirtilmemiş';
            if (!deptStats[dept]) {
                deptStats[dept] = {
                    name: dept,
                    totalNCs: 0,
                    openNCs: 0,
                    closedNCs: 0
                };
            }
            deptStats[dept].totalNCs++;
            if (nc.status === 'Kapatıldı') {
                deptStats[dept].closedNCs++;
            } else {
                deptStats[dept].openNCs++;
            }
        });

        const departments = Object.values(deptStats);
        
        // En iyi 3 birim (en az açık uygunsuzluk)
        const best = departments
            .filter(d => d.totalNCs > 0)
            .sort((a, b) => {
                // Önce açık uygunsuzluk sayısına göre, sonra kapatma oranına göre
                if (a.openNCs !== b.openNCs) {
                    return a.openNCs - b.openNCs;
                }
                const aCloseRate = a.totalNCs > 0 ? a.closedNCs / a.totalNCs : 0;
                const bCloseRate = b.totalNCs > 0 ? b.closedNCs / b.totalNCs : 0;
                return bCloseRate - aCloseRate;
            })
            .slice(0, 3);

        // En kötü 3 birim (en çok açık uygunsuzluk)
        const worst = departments
            .filter(d => d.totalNCs > 0)
            .sort((a, b) => {
                if (b.openNCs !== a.openNCs) {
                    return b.openNCs - a.openNCs;
                }
                return b.totalNCs - a.totalNCs;
            })
            .slice(0, 3);

        return { best, worst };
    }, [nonConformities, productionDepartments]);

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-yellow-500" />
                        Kalite Duvarı
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8 text-muted-foreground">Yükleniyor...</div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-yellow-500" />
                    Kalite Duvarı
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* En İyi 3 Birim */}
                    <div>
                        <h4 className="font-semibold mb-4 flex items-center gap-2 text-green-600">
                            <Award className="h-4 w-4" />
                            En İyi 3 Birim
                        </h4>
                        {departmentPerformance.best.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Veri bulunamadı.</p>
                        ) : (
                            <div className="space-y-3">
                                {departmentPerformance.best.map((dept, idx) => {
                                    const closeRate = dept.totalNCs > 0 
                                        ? ((dept.closedNCs / dept.totalNCs) * 100).toFixed(1)
                                        : '0';
                                    return (
                                        <div 
                                            key={idx} 
                                            className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900"
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline" className="bg-yellow-100 dark:bg-yellow-900">
                                                        #{idx + 1}
                                                    </Badge>
                                                    <span className="font-medium">{dept.name}</span>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2 text-xs">
                                                <div>
                                                    <span className="text-muted-foreground">Toplam:</span>
                                                    <span className="ml-1 font-semibold">{dept.totalNCs}</span>
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground">Açık:</span>
                                                    <span className="ml-1 font-semibold text-red-600">{dept.openNCs}</span>
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground">Kapatma:</span>
                                                    <span className="ml-1 font-semibold text-green-600">%{closeRate}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* En Kötü 3 Birim */}
                    <div>
                        <h4 className="font-semibold mb-4 flex items-center gap-2 text-red-600">
                            <AlertTriangle className="h-4 w-4" />
                            En Kötü 3 Birim
                        </h4>
                        {departmentPerformance.worst.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Veri bulunamadı.</p>
                        ) : (
                            <div className="space-y-3">
                                {departmentPerformance.worst.map((dept, idx) => {
                                    const closeRate = dept.totalNCs > 0 
                                        ? ((dept.closedNCs / dept.totalNCs) * 100).toFixed(1)
                                        : '0';
                                    return (
                                        <div 
                                            key={idx} 
                                            className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900"
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="destructive">
                                                        #{idx + 1}
                                                    </Badge>
                                                    <span className="font-medium">{dept.name}</span>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2 text-xs">
                                                <div>
                                                    <span className="text-muted-foreground">Toplam:</span>
                                                    <span className="ml-1 font-semibold">{dept.totalNCs}</span>
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground">Açık:</span>
                                                    <span className="ml-1 font-semibold text-red-600">{dept.openNCs}</span>
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground">Kapatma:</span>
                                                    <span className="ml-1 font-semibold text-green-600">%{closeRate}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Ayın Kalite Şampiyonu */}
                {departmentPerformance.best.length > 0 && (
                    <div className="mt-6 p-4 bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-950/20 dark:to-yellow-900/20 rounded-lg border-2 border-yellow-300 dark:border-yellow-800">
                        <div className="flex items-center gap-3">
                            <Trophy className="h-8 w-8 text-yellow-600" />
                            <div>
                                <h4 className="font-bold text-lg">Ayın Kalite Şampiyonu</h4>
                                <p className="text-sm text-muted-foreground">
                                    {departmentPerformance.best[0].name}
                                </p>
                                <div className="mt-1 flex items-center gap-4 text-xs">
                                    <span>
                                        <span className="text-muted-foreground">Açık Uygunsuzluk:</span>
                                        <span className="ml-1 font-semibold">{departmentPerformance.best[0].openNCs}</span>
                                    </span>
                                    <span>
                                        <span className="text-muted-foreground">Kapatma Oranı:</span>
                                        <span className="ml-1 font-semibold text-green-600">
                                            %{departmentPerformance.best[0].totalNCs > 0 
                                                ? ((departmentPerformance.best[0].closedNCs / departmentPerformance.best[0].totalNCs) * 100).toFixed(1)
                                                : '0'}
                                        </span>
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default QualityWall;

