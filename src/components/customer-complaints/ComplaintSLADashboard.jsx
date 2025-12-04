import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Clock, TrendingUp, AlertTriangle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { motion } from 'framer-motion';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

const ComplaintSLADashboard = ({ complaints }) => {
    const slaStats = useMemo(() => {
        if (!complaints || complaints.length === 0) {
            return {
                total: 0,
                onTime: 0,
                atRisk: 0,
                overdue: 0,
                pending: 0,
                avgFirstResponseHours: 0,
                avgResolutionHours: 0,
                bySeverity: {},
                trend: []
            };
        }

        let onTime = 0;
        let atRisk = 0;
        let overdue = 0;
        let pending = 0;
        let totalFirstResponseHours = 0;
        let totalResolutionHours = 0;
        let firstResponseCount = 0;
        let resolutionCount = 0;

        const bySeverity = {
            'Kritik': { onTime: 0, atRisk: 0, overdue: 0, pending: 0 },
            'Yüksek': { onTime: 0, atRisk: 0, overdue: 0, pending: 0 },
            'Orta': { onTime: 0, atRisk: 0, overdue: 0, pending: 0 },
            'Düşük': { onTime: 0, atRisk: 0, overdue: 0, pending: 0 }
        };

        complaints.forEach(complaint => {
            const slaStatus = complaint.sla_status || 'Pending';
            
            if (slaStatus === 'On Time') onTime++;
            else if (slaStatus === 'At Risk') atRisk++;
            else if (slaStatus === 'Overdue') overdue++;
            else pending++;

            if (complaint.first_response_hours) {
                totalFirstResponseHours += complaint.first_response_hours;
                firstResponseCount++;
            }

            if (complaint.resolution_hours) {
                totalResolutionHours += complaint.resolution_hours;
                resolutionCount++;
            }

            const severity = complaint.severity || 'Orta';
            if (bySeverity[severity]) {
                if (slaStatus === 'On Time') bySeverity[severity].onTime++;
                else if (slaStatus === 'At Risk') bySeverity[severity].atRisk++;
                else if (slaStatus === 'Overdue') bySeverity[severity].overdue++;
                else bySeverity[severity].pending++;
            }
        });

        // Aylık trend (son 6 ay)
        const monthlyTrend = {};
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            monthlyTrend[key] = { onTime: 0, atRisk: 0, overdue: 0, total: 0 };
        }

        complaints.forEach(complaint => {
            const date = new Date(complaint.complaint_date);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (monthlyTrend[key]) {
                monthlyTrend[key].total++;
                const slaStatus = complaint.sla_status || 'Pending';
                if (slaStatus === 'On Time') monthlyTrend[key].onTime++;
                else if (slaStatus === 'At Risk') monthlyTrend[key].atRisk++;
                else if (slaStatus === 'Overdue') monthlyTrend[key].overdue++;
            }
        });

        return {
            total: complaints.length,
            onTime,
            atRisk,
            overdue,
            pending,
            avgFirstResponseHours: firstResponseCount > 0 ? totalFirstResponseHours / firstResponseCount : 0,
            avgResolutionHours: resolutionCount > 0 ? totalResolutionHours / resolutionCount : 0,
            bySeverity,
            trend: Object.entries(monthlyTrend).map(([month, data]) => ({
                month,
                ...data,
                complianceRate: data.total > 0 ? ((data.onTime / data.total) * 100).toFixed(1) : 0
            }))
        };
    }, [complaints]);

    const pieData = [
        { name: 'On Time', value: slaStats.onTime, color: '#00C49F' },
        { name: 'At Risk', value: slaStats.atRisk, color: '#FFBB28' },
        { name: 'Overdue', value: slaStats.overdue, color: '#FF8042' },
        { name: 'Pending', value: slaStats.pending, color: '#0088FE' }
    ].filter(item => item.value > 0);

    const complianceRate = slaStats.total > 0 
        ? ((slaStats.onTime / slaStats.total) * 100).toFixed(1)
        : 0;

    return (
        <div className="space-y-6">
            {/* SLA Özet Kartları */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Toplam Şikayet
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{slaStats.total}</div>
                    </CardContent>
                </Card>

                <Card className="border-green-500">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            On Time
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{slaStats.onTime}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {slaStats.total > 0 ? ((slaStats.onTime / slaStats.total) * 100).toFixed(1) : 0}%
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-yellow-500">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-yellow-500" />
                            At Risk
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-yellow-600">{slaStats.atRisk}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {slaStats.total > 0 ? ((slaStats.atRisk / slaStats.total) * 100).toFixed(1) : 0}%
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-red-500">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-red-500" />
                            Overdue
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{slaStats.overdue}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {slaStats.total > 0 ? ((slaStats.overdue / slaStats.total) * 100).toFixed(1) : 0}%
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Clock className="w-4 h-4 text-blue-500" />
                            Compliance Rate
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-primary">{complianceRate}%</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            SLA Uyum Oranı
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Ortalama Süreler */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Ortalama İlk Yanıt Süresi</CardTitle>
                        <CardDescription>
                            Şikayet açıldıktan sonra ilk yanıt verilene kadar geçen süre
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-primary">
                            {slaStats.avgFirstResponseHours.toFixed(1)} saat
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">
                            {slaStats.avgFirstResponseHours < 24 ? '✅ Hedefin altında' :
                             slaStats.avgFirstResponseHours < 48 ? '⚠️ Hedefe yakın' :
                             '❌ Hedefin üzerinde'}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Ortalama Çözüm Süresi</CardTitle>
                        <CardDescription>
                            Şikayet açıldıktan çözülene kadar geçen toplam süre
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-primary">
                            {slaStats.avgResolutionHours.toFixed(1)} saat
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">
                            ({Math.round(slaStats.avgResolutionHours / 24)} gün)
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Grafikler */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* SLA Durumu Dağılımı */}
                <Card>
                    <CardHeader>
                        <CardTitle>SLA Durumu Dağılımı</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {pieData.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                Veri bulunamadı
                            </div>
                        ) : (
                            <div className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={pieData}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                            outerRadius={100}
                                            fill="#8884d8"
                                            dataKey="value"
                                        >
                                            {pieData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Severity Bazında SLA */}
                <Card>
                    <CardHeader>
                        <CardTitle>Önem Seviyesine Göre SLA</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={Object.entries(slaStats.bySeverity).map(([severity, data]) => ({
                                    severity,
                                    'On Time': data.onTime,
                                    'At Risk': data.atRisk,
                                    'Overdue': data.overdue,
                                    'Pending': data.pending
                                }))}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="severity" />
                                    <YAxis />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="On Time" stackId="a" fill="#00C49F" />
                                    <Bar dataKey="At Risk" stackId="a" fill="#FFBB28" />
                                    <Bar dataKey="Overdue" stackId="a" fill="#FF8042" />
                                    <Bar dataKey="Pending" stackId="a" fill="#0088FE" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Aylık Trend */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5" />
                        SLA Uyum Oranı Trendi (Son 6 Ay)
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={slaStats.trend}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="month" />
                                <YAxis domain={[0, 100]} />
                                <Tooltip 
                                    formatter={(value, name) => {
                                        if (name === 'complianceRate') return [`${value}%`, 'Uyum Oranı'];
                                        return [value, name];
                                    }}
                                />
                                <Legend />
                                <Line 
                                    type="monotone" 
                                    dataKey="complianceRate" 
                                    stroke="#8884d8" 
                                    strokeWidth={2}
                                    name="Uyum Oranı (%)"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default ComplaintSLADashboard;

