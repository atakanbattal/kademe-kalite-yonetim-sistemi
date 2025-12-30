import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock, FileText, WalletCards, Calendar, Bell, CheckCircle } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { format, differenceInDays, addDays } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Button } from '@/components/ui/button';

const DashboardAlerts = ({ onAlertClick }) => {
    const {
        nonConformities,
        equipments,
        documents,
        qualityCosts,
        loading
    } = useData();

    // 30 gün üzerinde kapanmayan DF/8D (Kapatılan ve Reddedilen hariç)
    const overdueNCs = useMemo(() => {
        if (!nonConformities) return [];
        const thirtyDaysAgo = addDays(new Date(), -30);
        return nonConformities.filter(nc => {
            // Kapatılan veya Reddedilen kayıtları hariç tut
            if (nc.status === 'Kapatıldı' || nc.status === 'Reddedildi') return false;
            const openingDate = new Date(nc.opening_date || nc.created_at);
            return openingDate < thirtyDaysAgo;
        }).map(nc => ({
            ...nc,
            daysOverdue: differenceInDays(new Date(), new Date(nc.opening_date || nc.created_at))
        })).sort((a, b) => b.daysOverdue - a.daysOverdue);
    }, [nonConformities]);

    // Kalibrasyon gecikmeleri
    const overdueCalibrations = useMemo(() => {
        if (!equipments) return [];
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Bugünü gece yarısına ayarla
        const overdue = [];

        equipments.forEach(eq => {
            const calibrations = eq.equipment_calibrations || [];

            // Her ekipman için EN SON kalibrasyon kaydını bul
            if (calibrations.length > 0) {
                // Kalibrasyon tarihine göre sırala (en yeni en başta)
                const sortedCalibrations = [...calibrations].sort((a, b) => {
                    const dateA = new Date(a.calibration_date || 0);
                    const dateB = new Date(b.calibration_date || 0);
                    return dateB - dateA; // Azalan sıralama
                });

                // En son kalibrasyon kaydını al
                const latestCalibration = sortedCalibrations[0];

                if (latestCalibration.next_calibration_date) {
                    const dueDate = new Date(latestCalibration.next_calibration_date);
                    dueDate.setHours(0, 0, 0, 0); // Tarih kısmını gece yarısına ayarla

                    if (dueDate < today) {
                        overdue.push({
                            equipment: eq.name,
                            dueDate: latestCalibration.next_calibration_date,
                            daysOverdue: differenceInDays(today, dueDate)
                        });
                    }
                }
            }
        });

        return overdue.sort((a, b) => b.daysOverdue - a.daysOverdue);
    }, [equipments]);

    // Doküman geçerlilik bitişi (30 gün içinde)
    const expiringDocuments = useMemo(() => {
        if (!documents) return [];
        const thirtyDaysFromNow = addDays(new Date(), 30);
        const today = new Date();

        return documents
            .filter(doc => {
                if (!doc.valid_until) return false;
                const validUntil = new Date(doc.valid_until);
                return validUntil >= today && validUntil <= thirtyDaysFromNow;
            })
            .map(doc => ({
                ...doc,
                daysRemaining: differenceInDays(new Date(doc.valid_until), new Date())
            }))
            .sort((a, b) => a.daysRemaining - b.daysRemaining);
    }, [documents]);

    // Maliyet anomali tespiti (bu ay ortalamadan %50 fazla)
    const costAnomalies = useMemo(() => {
        if (!qualityCosts) return [];

        const today = new Date();
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const firstDayOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastDayOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

        // Bu ayki maliyetler
        const thisMonthCosts = qualityCosts.filter(c => {
            const costDate = new Date(c.cost_date);
            return costDate >= firstDayOfMonth;
        });

        // Geçen ayki maliyetler
        const lastMonthCosts = qualityCosts.filter(c => {
            const costDate = new Date(c.cost_date);
            return costDate >= firstDayOfLastMonth && costDate <= lastDayOfLastMonth;
        });

        const thisMonthTotal = thisMonthCosts.reduce((sum, c) => sum + (c.amount || 0), 0);
        const lastMonthTotal = lastMonthCosts.reduce((sum, c) => sum + (c.amount || 0), 0);

        if (lastMonthTotal === 0) return [];

        const increasePercentage = ((thisMonthTotal - lastMonthTotal) / lastMonthTotal * 100);

        if (increasePercentage > 50) {
            return [{
                type: 'Maliyet Anomalisi',
                message: `Bu ay maliyet geçen aya göre %${increasePercentage.toFixed(1)} arttı`,
                thisMonth: thisMonthTotal,
                lastMonth: lastMonthTotal,
                increase: increasePercentage
            }];
        }

        return [];
    }, [qualityCosts]);

    const totalAlerts = overdueNCs.length + overdueCalibrations.length + expiringDocuments.length + costAnomalies.length;

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Bell className="h-5 w-5 text-orange-500" />
                        Uyarılar
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-4 text-muted-foreground">Yükleniyor...</div>
                </CardContent>
            </Card>
        );
    }

    if (totalAlerts === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Bell className="h-5 w-5 text-green-500" />
                        Uyarılar
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-4 text-green-600">
                        <CheckCircle className="h-8 w-8 mx-auto mb-2" />
                        <p className="font-medium">Tüm sistemler normal çalışıyor</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-orange-500">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5 text-orange-500" />
                    Kritik Uyarılar
                    <Badge variant="destructive" className="ml-2">{totalAlerts}</Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* 30+ gün DF/8D */}
                {overdueNCs.length > 0 && (
                    <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-red-600" />
                                <span className="font-semibold text-red-900 dark:text-red-100">
                                    30+ Gün Açık DF/8D
                                </span>
                            </div>
                            <Badge variant="destructive">{overdueNCs.length}</Badge>
                        </div>
                        <div className="space-y-1 text-sm text-red-800 dark:text-red-200">
                            {overdueNCs.slice(0, 3).map((nc, idx) => (
                                <div
                                    key={idx}
                                    className="flex items-center justify-between cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/30 p-1 rounded transition-colors"
                                    onClick={() => onAlertClick && onAlertClick('overdue-nc-detail', nc)}
                                >
                                    <span className="font-medium">{nc.nc_number || nc.mdi_no || 'N/A'}</span>
                                    <span className="font-medium">{nc.daysOverdue} gün</span>
                                </div>
                            ))}
                            {overdueNCs.length > 3 && (
                                <p className="text-xs mt-2">+{overdueNCs.length - 3} kayıt daha...</p>
                            )}
                        </div>
                        {onAlertClick && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="mt-2 w-full"
                                onClick={() => onAlertClick('overdue-nc', overdueNCs)}
                            >
                                Tümünü Gör
                            </Button>
                        )}
                    </div>
                )}

                {/* Kalibrasyon gecikmeleri */}
                {overdueCalibrations.length > 0 && (
                    <div className="p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-900">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-orange-600" />
                                <span className="font-semibold text-orange-900 dark:text-orange-100">
                                    Geciken Kalibrasyonlar
                                </span>
                            </div>
                            <Badge variant="destructive">{overdueCalibrations.length}</Badge>
                        </div>
                        <div className="space-y-1 text-sm text-orange-800 dark:text-orange-200">
                            {overdueCalibrations.slice(0, 3).map((cal, idx) => (
                                <div
                                    key={idx}
                                    className="flex items-center justify-between cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-900/30 p-1 rounded transition-colors"
                                    onClick={() => onAlertClick && onAlertClick('overdue-calibration-detail', cal)}
                                >
                                    <span className="font-medium">{cal.equipment}</span>
                                    <span className="font-medium">{cal.daysOverdue} gün gecikme</span>
                                </div>
                            ))}
                            {overdueCalibrations.length > 3 && (
                                <p className="text-xs mt-2">+{overdueCalibrations.length - 3} kayıt daha...</p>
                            )}
                        </div>
                        {onAlertClick && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="mt-2 w-full"
                                onClick={() => onAlertClick('overdue-calibration', overdueCalibrations)}
                            >
                                Tümünü Gör
                            </Button>
                        )}
                    </div>
                )}

                {/* Doküman geçerlilik */}
                {expiringDocuments.length > 0 && (
                    <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-900">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-yellow-600" />
                                <span className="font-semibold text-yellow-900 dark:text-yellow-100">
                                    Geçerliliği Dolacak Dokümanlar
                                </span>
                            </div>
                            <Badge variant="secondary">{expiringDocuments.length}</Badge>
                        </div>
                        <div className="space-y-1 text-sm text-yellow-800 dark:text-yellow-200">
                            {expiringDocuments.slice(0, 3).map((doc, idx) => (
                                <div
                                    key={idx}
                                    className="flex items-center justify-between cursor-pointer hover:bg-yellow-100 dark:hover:bg-yellow-900/30 p-1 rounded transition-colors"
                                    onClick={() => onAlertClick && onAlertClick('expiring-docs-detail', doc)}
                                >
                                    <span className="font-medium">{doc.name}</span>
                                    <span className="font-medium">{doc.daysRemaining} gün kaldı</span>
                                </div>
                            ))}
                            {expiringDocuments.length > 3 && (
                                <p className="text-xs mt-2">+{expiringDocuments.length - 3} kayıt daha...</p>
                            )}
                        </div>
                        {onAlertClick && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="mt-2 w-full"
                                onClick={() => onAlertClick('expiring-docs', expiringDocuments)}
                            >
                                Tümünü Gör
                            </Button>
                        )}
                    </div>
                )}

                {/* Maliyet anomali */}
                {costAnomalies.length > 0 && (
                    <div className="p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-900">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <WalletCards className="h-4 w-4 text-purple-600" />
                                <span className="font-semibold text-purple-900 dark:text-purple-100">
                                    Maliyet Anomalisi
                                </span>
                            </div>
                        </div>
                        <div className="text-sm text-purple-800 dark:text-purple-200">
                            <p>{costAnomalies[0].message}</p>
                            <div className="mt-2 flex items-center justify-between text-xs">
                                <span>Bu Ay: {costAnomalies[0].thisMonth.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}</span>
                                <span>Geçen Ay: {costAnomalies[0].lastMonth.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}</span>
                            </div>
                        </div>
                        {onAlertClick && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="mt-2 w-full"
                                onClick={() => onAlertClick('cost-anomaly', costAnomalies)}
                            >
                                Detaylı Analiz
                            </Button>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default DashboardAlerts;

