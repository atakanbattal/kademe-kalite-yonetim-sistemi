import React from 'react';
import { motion } from 'framer-motion';
import {
    ClipboardCheck,
    Factory,
    Gauge,
    ListChecks,
    Microscope,
    MoveRight,
    ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { getProcessInkrDisplayNumber } from './processInkrUtils';

const decisionBadgeVariant = (decision) => {
    if (decision === 'Kabul') return 'success';
    if (decision === 'Ret') return 'destructive';
    if (decision === 'Şartlı Kabul') return 'warning';
    return 'secondary';
};

const ProcessControlDashboard = ({
    plans = [],
    inkrReports = [],
    inspections = [],
    loading,
    onTabChange,
}) => {
    const stats = {
        totalPlans: plans.length,
        totalInkrReports: inkrReports.length,
        totalInspections: inspections.length,
        actionNeeded: inspections.filter(
            (inspection) => inspection.decision === 'Ret' || inspection.decision === 'Şartlı Kabul'
        ).length,
    };

    const recentInspections = inspections.slice(0, 6);
    const recentInkrReports = inkrReports.slice(0, 5);

    if (loading) {
        return <div className="py-10 text-center text-muted-foreground">Yükleniyor...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                    <Card className="h-full">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Kontrol Planları</CardTitle>
                            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.totalPlans}</div>
                            <p className="mt-1 text-xs text-muted-foreground">Aktif proses plan arşivi</p>
                        </CardContent>
                    </Card>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                    <Card className="h-full">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">INKR Kayıtları</CardTitle>
                            <Microscope className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.totalInkrReports}</div>
                            <p className="mt-1 text-xs text-muted-foreground">İlk numune kontrol raporları</p>
                        </CardContent>
                    </Card>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                    <Card className="h-full">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Muayene Kayıtları</CardTitle>
                            <ListChecks className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.totalInspections}</div>
                            <p className="mt-1 text-xs text-muted-foreground">Proses muayene geçmişi</p>
                        </CardContent>
                    </Card>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                    <Card className="h-full">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Aksiyon Gereken</CardTitle>
                            <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.actionNeeded}</div>
                            <p className="mt-1 text-xs text-muted-foreground">Ret veya şartlı kabul kayıtları</p>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                    <Card className="h-full">
                        <CardHeader>
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <CardTitle>Son Proses Muayeneleri</CardTitle>
                                    <CardDescription>
                                        En güncel proses muayene kayıtları ve karar özetleri
                                    </CardDescription>
                                </div>
                                {onTabChange && (
                                    <Button variant="outline" size="sm" onClick={() => onTabChange('inspections')}>
                                        Muayene Kayıtlarına Git
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            {recentInspections.length === 0 ? (
                                <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                                    Henüz proses muayene kaydı bulunmuyor.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {recentInspections.map((inspection) => (
                                        <div
                                            key={inspection.id}
                                            className="flex flex-col gap-3 rounded-xl border p-4 transition-colors hover:bg-muted/30 md:flex-row md:items-center md:justify-between"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="font-semibold text-foreground">
                                                        {inspection.record_no || 'Kaydı'}
                                                    </p>
                                                    <Badge variant={decisionBadgeVariant(inspection.decision)}>
                                                        {inspection.decision || 'Beklemede'}
                                                    </Badge>
                                                </div>
                                                <p className="mt-1 text-sm font-medium text-foreground">
                                                    {inspection.part_code || '-'}
                                                </p>
                                                <p className="line-clamp-1 text-sm text-muted-foreground">
                                                    {inspection.part_name || 'Parça adı girilmemiş'}
                                                </p>
                                            </div>
                                            <div className="flex shrink-0 flex-wrap items-center gap-4 text-sm">
                                                <span className="flex items-center gap-2 text-muted-foreground">
                                                    <Gauge className="h-4 w-4" />
                                                    {inspection.quantity_produced || 0} adet
                                                </span>
                                                <span className="flex items-center gap-2 text-muted-foreground">
                                                    <Factory className="h-4 w-4" />
                                                    {inspection.production_line || '-'}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {inspection.inspection_date
                                                        ? formatDistanceToNow(new Date(inspection.inspection_date), {
                                                              addSuffix: true,
                                                              locale: tr,
                                                          })
                                                        : '-'}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </motion.div>

                <div className="space-y-6">
                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                        <Card>
                            <CardHeader>
                                <CardTitle>Hızlı Geçiş</CardTitle>
                                <CardDescription>Bu modülde sık kullanılan akışlara hızlı erişim</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <Button
                                    variant="outline"
                                    className="w-full justify-between"
                                    onClick={() => onTabChange?.('equipment')}
                                >
                                    Araç Bilgileri
                                    <MoveRight className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    className="w-full justify-between"
                                    onClick={() => onTabChange?.('plans')}
                                >
                                    Kontrol Planları
                                    <MoveRight className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    className="w-full justify-between"
                                    onClick={() => onTabChange?.('inkr')}
                                >
                                    İlk Numune (INKR)
                                    <MoveRight className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    className="w-full justify-between"
                                    onClick={() => onTabChange?.('inspections')}
                                >
                                    Muayene Kayıtları
                                    <MoveRight className="h-4 w-4" />
                                </Button>
                            </CardContent>
                        </Card>
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                        <Card>
                            <CardHeader>
                                <CardTitle>Son INKR Kayıtları</CardTitle>
                                <CardDescription>En son oluşturulan ilk numune raporları</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {recentInkrReports.length === 0 ? (
                                    <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                                        Henüz INKR raporu bulunmuyor.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {recentInkrReports.map((report) => (
                                            <div key={report.id} className="rounded-xl border p-4">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="font-semibold text-foreground">
                                                            {getProcessInkrDisplayNumber(report)}
                                                        </p>
                                                        <p className="text-sm text-muted-foreground">
                                                            {report.part_code || '-'}
                                                        </p>
                                                    </div>
                                                    <Badge variant="outline">
                                                        {report.vehicle_type || 'Araç tipi yok'}
                                                    </Badge>
                                                </div>
                                                <p className="mt-2 line-clamp-1 text-sm text-muted-foreground">
                                                    {report.part_name || 'Parça adı bulunmuyor'}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

export default ProcessControlDashboard;
