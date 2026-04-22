import React, { useMemo } from 'react';
import {
    AlertCircle,
    AlertTriangle,
    CheckCircle2,
    Clock,
    TrendingUp,
} from 'lucide-react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    calculateFirstResponseHours,
    calculateResolutionHours,
    getDynamicSlaStatus,
} from '@/components/customer-complaints/afterSalesConfig';

const STATUS_COLORS = {
    'Hedef İçinde': '#16a34a',
    Riskte: '#f59e0b',
    'Süre Aşıldı': '#dc2626',
    Beklemede: '#2563eb',
};

const STATUS_ICONS = {
    'Hedef İçinde': CheckCircle2,
    Riskte: AlertTriangle,
    'Süre Aşıldı': AlertCircle,
    Beklemede: Clock,
};

const STATUS_ORDER = ['Hedef İçinde', 'Riskte', 'Süre Aşıldı', 'Beklemede'];

const StatCard = ({ title, value, helper, status }) => {
    const Icon = STATUS_ICONS[status] || Clock;
    const color = STATUS_COLORS[status] || '#2563eb';

    return (
        <Card>
            <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <div className="text-sm text-muted-foreground">{title}</div>
                        <div className="text-3xl font-bold mt-2">{value}</div>
                        {helper && <div className="text-xs text-muted-foreground mt-2">{helper}</div>}
                    </div>
                    <div className="rounded-full p-3" style={{ backgroundColor: `${color}1A`, color }}>
                        <Icon className="w-5 h-5" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

const ComplaintSLADashboard = ({ complaints, periodLabel }) => {
    const analytics = useMemo(() => {
        const initialStatusCounts = {
            'Hedef İçinde': 0,
            Riskte: 0,
            'Süre Aşıldı': 0,
            Beklemede: 0,
        };

        if (!complaints || complaints.length === 0) {
            return {
                total: 0,
                statusCounts: initialStatusCounts,
                avgFirstResponseHours: 0,
                avgResolutionHours: 0,
                firstResponseCount: 0,
                resolutionCount: 0,
                trend: [],
                severityBreakdown: [],
            };
        }

        let totalFirstResponseHours = 0;
        let totalResolutionHours = 0;
        let firstResponseCount = 0;
        let resolutionCount = 0;

        const statusCounts = { ...initialStatusCounts };
        const bySeverity = {
            Kritik: { ...initialStatusCounts },
            Yüksek: { ...initialStatusCounts },
            Orta: { ...initialStatusCounts },
            Düşük: { ...initialStatusCounts },
        };

        const monthlyTrend = {};
        const now = new Date();
        for (let i = 5; i >= 0; i -= 1) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            monthlyTrend[key] = {
                label: date.toLocaleDateString('tr-TR', { month: 'short', year: '2-digit' }),
                total: 0,
                'Hedef İçinde': 0,
                Riskte: 0,
                'Süre Aşıldı': 0,
                Beklemede: 0,
            };
        }

        complaints.forEach((complaint) => {
            const normalizedStatus = getDynamicSlaStatus(complaint);
            const severity = complaint.severity || 'Orta';
            const firstResponseHours = calculateFirstResponseHours(complaint);
            const resolutionHours = calculateResolutionHours(complaint);

            statusCounts[normalizedStatus] += 1;
            if (bySeverity[severity]) {
                bySeverity[severity][normalizedStatus] += 1;
            }

            const hasFirstResponseData =
                Boolean(complaint.first_response_date || complaint.service_start_date) ||
                (complaint.first_response_hours !== undefined && complaint.first_response_hours !== null && complaint.first_response_hours !== '');

            if (hasFirstResponseData) {
                totalFirstResponseHours += Number(firstResponseHours || 0);
                firstResponseCount += 1;
            }

            const hasResolutionData =
                Boolean(complaint.actual_close_date || complaint.service_completion_date) ||
                (complaint.resolution_hours !== undefined && complaint.resolution_hours !== null && complaint.resolution_hours !== '');

            if (hasResolutionData) {
                totalResolutionHours += Number(resolutionHours || 0);
                resolutionCount += 1;
            }

            if (complaint.complaint_date) {
                const complaintDate = new Date(complaint.complaint_date);
                const key = `${complaintDate.getFullYear()}-${String(complaintDate.getMonth() + 1).padStart(2, '0')}`;
                if (monthlyTrend[key]) {
                    monthlyTrend[key].total += 1;
                    monthlyTrend[key][normalizedStatus] += 1;
                }
            }
        });

        const complianceRate = complaints.length > 0
            ? Number(((statusCounts['Hedef İçinde'] / complaints.length) * 100).toFixed(1))
            : 0;

        return {
            total: complaints.length,
            statusCounts,
            complianceRate,
            avgFirstResponseHours: firstResponseCount > 0 ? totalFirstResponseHours / firstResponseCount : 0,
            avgResolutionHours: resolutionCount > 0 ? totalResolutionHours / resolutionCount : 0,
            firstResponseCount,
            resolutionCount,
            trend: Object.values(monthlyTrend).map((entry) => ({
                ...entry,
                complianceRate: entry.total > 0 ? Number(((entry['Hedef İçinde'] / entry.total) * 100).toFixed(1)) : 0,
            })),
            severityBreakdown: Object.entries(bySeverity).map(([severity, data]) => ({
                severity,
                ...data,
            })),
        };
    }, [complaints]);

    const pieData = STATUS_ORDER
        .map((status) => ({
            name: status,
            value: analytics.statusCounts[status],
            color: STATUS_COLORS[status],
        }))
        .filter((item) => item.value > 0);

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold mb-1">SLA ve Süre Yönetimi</h3>
                <p className="text-sm text-muted-foreground">
                    {periodLabel
                        ? `${periodLabel} filtrelerine göre ilk yanıt, çözüm süresi ve zamanında kapanma performansını izleyin.`
                        : 'İlk yanıt, çözüm süresi ve vaka zamanında kapanma performansını Türkçe ve okunabilir bir görünümle izleyin.'}
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                <StatCard title="Toplam Vaka" value={analytics.total} helper="SLA takibine giren tüm kayıtlar" status="Beklemede" />
                <StatCard title="Hedef İçinde" value={analytics.statusCounts['Hedef İçinde']} helper={`${analytics.complianceRate || 0}% uyum`} status="Hedef İçinde" />
                <StatCard title="Riskte" value={analytics.statusCounts.Riskte} helper="Süre baskısı oluşan vakalar" status="Riskte" />
                <StatCard title="Süre Aşıldı" value={analytics.statusCounts['Süre Aşıldı']} helper="Aksiyon hızlandırılması gereken vakalar" status="Süre Aşıldı" />
                <StatCard title="Beklemede" value={analytics.statusCounts.Beklemede} helper="Henüz net SLA durumu oluşmayanlar" status="Beklemede" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Ortalama İlk Yanıt Süresi</CardTitle>
                        <CardDescription>Vaka açılışı ile ilk geri dönüş arasındaki ortalama süre</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold">
                            {analytics.firstResponseCount > 0 ? `${analytics.avgFirstResponseHours.toFixed(1)} saat` : '-'}
                        </div>
                        <div className="mt-3">
                            <Badge variant={
                                analytics.firstResponseCount === 0
                                    ? 'secondary'
                                    : analytics.avgFirstResponseHours <= 24
                                        ? 'default'
                                        : analytics.avgFirstResponseHours <= 48
                                            ? 'warning'
                                            : 'destructive'
                            }>
                                {analytics.firstResponseCount === 0
                                    ? 'Veri yok'
                                    : analytics.avgFirstResponseHours <= 24
                                        ? 'Hedef içinde'
                                        : analytics.avgFirstResponseHours <= 48
                                            ? 'Riskte'
                                            : 'Süre baskısı var'}
                            </Badge>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Ortalama Çözüm Süresi</CardTitle>
                        <CardDescription>Vakanın tamamen kapatılmasına kadar geçen toplam ortalama süre</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold">
                            {analytics.resolutionCount > 0 ? `${analytics.avgResolutionHours.toFixed(1)} saat` : '-'}
                        </div>
                        <div className="text-sm text-muted-foreground mt-3">
                            {analytics.resolutionCount > 0
                                ? `Yaklaşık ${Math.round(analytics.avgResolutionHours / 24)} gün`
                                : 'Çözüm süresi verisi henüz oluşmadı'}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>SLA Durumu Dağılımı</CardTitle>
                    <CardDescription>Vakaların hedefte, riskte, gecikmiş veya beklemede olma dağılımı</CardDescription>
                </CardHeader>
                <CardContent>
                    {pieData.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground">Henüz SLA verisi bulunmuyor.</div>
                    ) : (
                        <div className="h-[380px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={125}
                                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                    >
                                        {pieData.map((entry) => (
                                            <Cell key={entry.name} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value, name) => [value, name]} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Önem Seviyesine Göre SLA Dağılımı</CardTitle>
                    <CardDescription>Kritik ve yüksek önem seviyelerindeki vakalarda zaman baskısını görün.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[380px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={analytics.severityBreakdown} margin={{ left: 8, right: 8 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="severity" />
                                <YAxis allowDecimals={false} />
                                <Tooltip />
                                <Legend />
                                {STATUS_ORDER.map((status) => (
                                    <Bar key={status} dataKey={status} stackId="a" fill={STATUS_COLORS[status]} />
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5" />
                        Aylık SLA Uyum Oranı Trendi
                    </CardTitle>
                    <CardDescription>Son 6 ayda hedef içinde kapanan vakaların oranı</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[360px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={analytics.trend}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="label" />
                                <YAxis domain={[0, 100]} unit="%" />
                                <Tooltip formatter={(value, name) => [name === 'complianceRate' ? `${value}%` : value, name === 'complianceRate' ? 'Uyum Oranı' : name]} />
                                <Legend />
                                <Line type="monotone" dataKey="complianceRate" name="Uyum Oranı" stroke="#2563eb" strokeWidth={3} />
                                <Line type="monotone" dataKey="Süre Aşıldı" name="Süre Aşıldı" stroke={STATUS_COLORS['Süre Aşıldı']} strokeWidth={2} />
                                <Line type="monotone" dataKey="Riskte" name="Riskte" stroke={STATUS_COLORS.Riskte} strokeWidth={2} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default ComplaintSLADashboard;
