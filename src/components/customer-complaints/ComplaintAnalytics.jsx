import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, TrendingUp, TrendingDown, Clock, DollarSign, AlertCircle } from 'lucide-react';

const ComplaintAnalytics = ({ complaints, customers }) => {
    const analytics = useMemo(() => {
        // Müşteri bazlı analiz
        const customerStats = {};
        customers.forEach(customer => {
            const customerComplaints = complaints.filter(c => c.customer_id === customer.id);
            const open = customerComplaints.filter(c => c.status !== 'Kapalı' && c.status !== 'İptal').length;
            const critical = customerComplaints.filter(c => c.severity === 'Kritik').length;
            const closed = customerComplaints.filter(c => c.status === 'Kapalı').length;
            
            const resolved = customerComplaints.filter(c => c.actual_close_date);
            let avgDays = 0;
            if (resolved.length > 0) {
                const totalDays = resolved.reduce((sum, c) => {
                    const start = new Date(c.complaint_date);
                    const end = new Date(c.actual_close_date);
                    return sum + Math.ceil((end - start) / (1000 * 60 * 60 * 24));
                }, 0);
                avgDays = Math.round(totalDays / resolved.length);
            }

            customerStats[customer.id] = {
                customer,
                total: customerComplaints.length,
                open,
                critical,
                closed,
                avgResolutionDays: avgDays
            };
        });

        // Kategori bazlı analiz
        const categoryStats = {};
        complaints.forEach(c => {
            const cat = c.complaint_category || 'Diğer';
            if (!categoryStats[cat]) {
                categoryStats[cat] = { total: 0, open: 0, critical: 0 };
            }
            categoryStats[cat].total++;
            if (c.status !== 'Kapalı' && c.status !== 'İptal') categoryStats[cat].open++;
            if (c.severity === 'Kritik') categoryStats[cat].critical++;
        });

        // Önem seviyesi analizi
        const severityStats = {
            'Kritik': complaints.filter(c => c.severity === 'Kritik').length,
            'Yüksek': complaints.filter(c => c.severity === 'Yüksek').length,
            'Orta': complaints.filter(c => c.severity === 'Orta').length,
            'Düşük': complaints.filter(c => c.severity === 'Düşük').length
        };

        // Durum bazlı analiz
        const statusStats = {
            'Açık': complaints.filter(c => c.status === 'Açık').length,
            'Analiz Aşamasında': complaints.filter(c => c.status === 'Analiz Aşamasında').length,
            'Aksiyon Alınıyor': complaints.filter(c => c.status === 'Aksiyon Alınıyor').length,
            'Doğrulama Bekleniyor': complaints.filter(c => c.status === 'Doğrulama Bekleniyor').length,
            'Kapalı': complaints.filter(c => c.status === 'Kapalı').length,
            'İptal': complaints.filter(c => c.status === 'İptal').length
        };

        // Finansal analiz
        const totalFinancialImpact = complaints.reduce((sum, c) => 
            sum + (parseFloat(c.financial_impact) || 0), 0
        );

        // En çok şikayet alan müşteriler
        const topCustomers = Object.values(customerStats)
            .filter(s => s.total > 0)
            .sort((a, b) => b.total - a.total)
            .slice(0, 10);

        // Aylık trend
        const monthlyTrend = {};
        complaints.forEach(c => {
            const month = new Date(c.complaint_date).toISOString().slice(0, 7);
            if (!monthlyTrend[month]) monthlyTrend[month] = 0;
            monthlyTrend[month]++;
        });

        return {
            customerStats,
            categoryStats,
            severityStats,
            statusStats,
            totalFinancialImpact,
            topCustomers,
            monthlyTrend
        };
    }, [complaints, customers]);

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold mb-1">Şikayet Analizleri</h3>
                <p className="text-sm text-muted-foreground">Detaylı analiz ve raporlar</p>
            </div>

            {/* Önem Seviyesi Dağılımı */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5" />
                        Önem Seviyesi Dağılımı
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {Object.entries(analytics.severityStats).map(([severity, count]) => (
                            <div key={severity} className="text-center p-4 bg-muted/50 rounded-lg">
                                <div className="text-3xl font-bold text-primary">{count}</div>
                                <div className="text-sm text-muted-foreground mt-1">{severity}</div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Durum Dağılımı */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5" />
                        Durum Dağılımı
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {Object.entries(analytics.statusStats).map(([status, count]) => (
                            <div key={status} className="p-3 border rounded-lg">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">{status}</span>
                                    <Badge variant="outline">{count}</Badge>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Kategori Bazlı Analiz */}
            <Card>
                <CardHeader>
                    <CardTitle>Kategori Bazlı Analiz</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {Object.entries(analytics.categoryStats)
                            .sort((a, b) => b[1].total - a[1].total)
                            .map(([category, stats]) => (
                                <div key={category} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                    <div className="flex-1">
                                        <div className="font-medium">{category}</div>
                                        <div className="text-sm text-muted-foreground">
                                            {stats.open} açık • {stats.critical} kritik
                                        </div>
                                    </div>
                                    <Badge variant="outline" className="text-lg">
                                        {stats.total}
                                    </Badge>
                                </div>
                            ))}
                    </div>
                </CardContent>
            </Card>

            {/* En Çok Şikayet Alan Müşteriler */}
            <Card>
                <CardHeader>
                    <CardTitle>En Çok Şikayet Alan Müşteriler</CardTitle>
                    <CardDescription>Son dönem şikayet sayılarına göre sıralama</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {analytics.topCustomers.map((stat, index) => (
                            <div key={stat.customer.id} className="flex items-center gap-4 p-3 border rounded-lg">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                                    {index + 1}
                                </div>
                                <div className="flex-1">
                                    <div className="font-medium">{stat.customer.customer_name}</div>
                                    <div className="text-sm text-muted-foreground">
                                        {stat.open} açık • {stat.critical} kritik • Ort. {stat.avgResolutionDays} gün çözüm
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-2xl font-bold text-primary">{stat.total}</div>
                                    <div className="text-xs text-muted-foreground">toplam</div>
                                </div>
                            </div>
                        ))}
                        {analytics.topCustomers.length === 0 && (
                            <div className="text-center py-8 text-muted-foreground">
                                Henüz şikayet kaydı bulunmuyor.
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Finansal Etki */}
            {analytics.totalFinancialImpact > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <DollarSign className="w-5 h-5" />
                            Toplam Finansal Etki
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold text-red-600">
                            {analytics.totalFinancialImpact.toLocaleString('tr-TR', {
                                style: 'currency',
                                currency: 'TRY'
                            })}
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">
                            Tüm şikayetlerin toplam finansal etkisi
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Aylık Trend */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5" />
                        Aylık Şikayet Trendi
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {Object.entries(analytics.monthlyTrend)
                            .sort((a, b) => b[0].localeCompare(a[0]))
                            .slice(0, 12)
                            .map(([month, count]) => {
                                const date = new Date(month + '-01');
                                const monthName = date.toLocaleDateString('tr-TR', { year: 'numeric', month: 'long' });
                                return (
                                    <div key={month} className="flex items-center justify-between p-2 hover:bg-muted/50 rounded">
                                        <span className="text-sm">{monthName}</span>
                                        <Badge variant="outline">{count} şikayet</Badge>
                                    </div>
                                );
                            })}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default ComplaintAnalytics;

