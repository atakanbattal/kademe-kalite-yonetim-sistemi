import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, Droplets, GaugeCircle, ListChecks } from 'lucide-react';

import {
    formatDuration,
    formatTestDateTime,
    getPersonnelName,
    getVehicleTypeLabel,
} from './utils';

const StatCard = ({ title, value, description, icon: Icon, valueClassName = '' }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className={`text-2xl font-bold ${valueClassName}`}>{value}</div>
            <p className="text-xs text-muted-foreground">{description}</p>
        </CardContent>
    </Card>
);

const LeakTestDashboard = ({ records = [], loading }) => {
    const dashboardData = useMemo(() => {
        if (!records.length) {
            return {
                total: 0,
                accepted: 0,
                rejected: 0,
                acceptanceRate: 0,
                totalLeaks: 0,
                averageDuration: 0,
                tankStats: [],
                recentRejected: [],
            };
        }

        const accepted = records.filter((record) => record.test_result === 'Kabul').length;
        const rejected = records.filter((record) => record.test_result === 'Kaçak Var').length;
        const totalLeaks = records.reduce((sum, record) => sum + (Number(record.leak_count) || 0), 0);
        const totalDuration = records.reduce((sum, record) => sum + (Number(record.test_duration_minutes) || 0), 0);
        const tankCountMap = records.reduce((acc, record) => {
            const key = record.tank_type || 'Belirsiz';
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});

        const recentRejected = [...records]
            .filter((record) => record.test_result === 'Kaçak Var')
            .sort((left, right) => {
                const leftValue = new Date(`${left.test_date || '1970-01-01'}T${left.test_start_time || '00:00'}:00`).getTime();
                const rightValue = new Date(`${right.test_date || '1970-01-01'}T${right.test_start_time || '00:00'}:00`).getTime();
                return rightValue - leftValue;
            })
            .slice(0, 5);

        return {
            total: records.length,
            accepted,
            rejected,
            acceptanceRate: records.length ? ((accepted / records.length) * 100).toFixed(1) : '0.0',
            totalLeaks,
            averageDuration: records.length ? Math.round(totalDuration / records.length) : 0,
            tankStats: Object.entries(tankCountMap)
                .map(([tankType, count]) => ({ tankType, count, ratio: (count / records.length) * 100 }))
                .sort((left, right) => right.count - left.count),
            recentRejected,
        };
    }, [records]);

    if (loading) {
        return <div className="text-center py-10 text-muted-foreground">Yükleniyor...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                    <StatCard
                        title="Toplam Test"
                        value={dashboardData.total}
                        description="Arşivlenen sızdırmazlık kaydı"
                        icon={ListChecks}
                    />
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                    <StatCard
                        title="Kabul Oranı"
                        value={`%${dashboardData.acceptanceRate}`}
                        description={`${dashboardData.accepted} kayıt ilk seferde kabul`}
                        icon={GaugeCircle}
                        valueClassName="text-emerald-600"
                    />
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                    <StatCard
                        title="Kaçaklı Test"
                        value={dashboardData.rejected}
                        description="Kaçak tespit edilen kayıt"
                        icon={AlertTriangle}
                        valueClassName="text-red-600"
                    />
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                    <StatCard
                        title="Toplam Kaçak"
                        value={dashboardData.totalLeaks}
                        description="Reddedilen testlerdeki toplam kaçak"
                        icon={Droplets}
                        valueClassName="text-sky-600"
                    />
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                    <StatCard
                        title="Ortalama Süre"
                        value={formatDuration(dashboardData.averageDuration)}
                        description="Bir testin ortalama tamamlanma süresi"
                        icon={CheckCircle2}
                    />
                </motion.div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                    <Card className="h-full">
                        <CardHeader>
                            <CardTitle>Sızdırmazlık Parçası Yoğunluğu</CardTitle>
                            <CardDescription>
                                Test yükünün hangi sızdırmazlık parçalarında biriktiğini hızlıca görün.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {dashboardData.tankStats.length === 0 ? (
                                <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                                    Henüz dağılım gösterecek kayıt bulunmuyor.
                                </div>
                            ) : (
                                dashboardData.tankStats.map((item) => (
                                    <div key={item.tankType} className="space-y-2">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="font-medium text-foreground">{item.tankType}</span>
                                            <span className="text-muted-foreground">
                                                {item.count} kayıt / %{item.ratio.toFixed(0)}
                                            </span>
                                        </div>
                                        <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                                            <div
                                                className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-400"
                                                style={{ width: `${item.ratio}%` }}
                                            />
                                        </div>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                    <Card className="h-full">
                        <CardHeader>
                            <CardTitle>Son Kaçaklı Kayıtlar</CardTitle>
                            <CardDescription>
                                Hızlı aksiyon için en son reddedilen testler.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {dashboardData.recentRejected.length === 0 ? (
                                <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                                    Kaçaklı test kaydı bulunmuyor.
                                </div>
                            ) : (
                                dashboardData.recentRejected.map((record) => (
                                    <div key={record.id} className="rounded-xl border bg-muted/20 p-4 space-y-2">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="font-semibold text-foreground">{record.record_number}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {getVehicleTypeLabel(record)}
                                                </p>
                                                {record.vehicle_serial_number && (
                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                        Seri No: {record.vehicle_serial_number}
                                                    </p>
                                                )}
                                            </div>
                                            <Badge variant="destructive">{record.leak_count || 0} kaçak</Badge>
                                        </div>
                                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                            <span>{record.tank_type || '-'}</span>
                                            <span>•</span>
                                            <span>{formatTestDateTime(record.test_date, record.test_start_time)}</span>
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            Testi yapan: {getPersonnelName(record, 'tested_by', 'tested_by_name')}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            Kaynatan: {getPersonnelName(record, 'welded_by', 'welded_by_name')}
                                        </div>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        </div>
    );
};

export default LeakTestDashboard;
