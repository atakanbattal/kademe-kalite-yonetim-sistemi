import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/customSupabaseClient';
import { 
    TrendingUp, 
    AlertTriangle, 
    CheckCircle, 
    Clock, 
    Users,
    DollarSign,
    BarChart3,
    PieChart,
    Calendar,
    Target,
    Activity
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';

export default function ComplaintsDashboard({ onFilterChange }) {
    const [stats, setStats] = useState({
        total: 0,
        new: 0,
        inProgress: 0,
        resolved: 0,
        critical: 0,
        avgResolutionDays: 0,
        totalFinancialImpact: 0,
        last30Days: 0,
        topCustomers: [],
        byCategory: [],
        bySeverity: [],
        byStatus: [],
        monthlyTrend: []
    });
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState('all'); // 'all', '30days', '90days', 'year'

    useEffect(() => {
        fetchDashboardStats();
    }, [timeRange]);

    const fetchDashboardStats = async () => {
        setLoading(true);
        try {
            // Tarih filtreleme
            let dateFilter = '';
            const now = new Date();
            if (timeRange === '30days') {
                const date = new Date(now.setDate(now.getDate() - 30));
                dateFilter = date.toISOString();
            } else if (timeRange === '90days') {
                const date = new Date(now.setDate(now.getDate() - 90));
                dateFilter = date.toISOString();
            } else if (timeRange === 'year') {
                const date = new Date(now.setFullYear(now.getFullYear() - 1));
                dateFilter = date.toISOString();
            }

            // Tüm şikayetleri çek
            let query = supabase
                .from('customer_complaints')
                .select(`
                    *,
                    customer:customers(customer_name, customer_code)
                `);

            if (dateFilter) {
                query = query.gte('complaint_date', dateFilter);
            }

            const { data: complaints, error } = await query;

            if (error) throw error;

            // İstatistikleri hesapla
            const total = complaints?.length || 0;
            const newComplaints = complaints?.filter(c => c.status === 'Yeni').length || 0;
            const inProgress = complaints?.filter(c => 
                ['İnceleniyor', 'Analiz Aşamasında', 'Aksiyon Alınıyor'].includes(c.status)
            ).length || 0;
            const resolved = complaints?.filter(c => 
                ['Çözüldü', 'Kapatıldı'].includes(c.status)
            ).length || 0;
            const critical = complaints?.filter(c => c.severity === 'Kritik').length || 0;

            // Ortalama çözüm süresi
            const resolvedWithDates = complaints?.filter(c => 
                c.actual_close_date && c.received_date
            ) || [];
            const avgDays = resolvedWithDates.length > 0
                ? resolvedWithDates.reduce((sum, c) => {
                    const days = Math.floor(
                        (new Date(c.actual_close_date) - new Date(c.received_date)) / (1000 * 60 * 60 * 24)
                    );
                    return sum + days;
                }, 0) / resolvedWithDates.length
                : 0;

            // Finansal etki
            const totalFinancial = complaints?.reduce((sum, c) => 
                sum + (parseFloat(c.financial_impact) || 0), 0
            ) || 0;

            // Son 30 gün
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const last30 = complaints?.filter(c => 
                new Date(c.complaint_date) >= thirtyDaysAgo
            ).length || 0;

            // Müşterilere göre şikayet sayısı (Top 5)
            const customerCounts = {};
            complaints?.forEach(c => {
                const customerName = c.customer?.customer_name || 'Bilinmeyen';
                customerCounts[customerName] = (customerCounts[customerName] || 0) + 1;
            });
            const topCustomers = Object.entries(customerCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([name, count]) => ({ name, count }));

            // Kategoriye göre
            const categoryCounts = {};
            complaints?.forEach(c => {
                const cat = c.complaint_category || 'Diğer';
                categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
            });
            const byCategory = Object.entries(categoryCounts)
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count);

            // Şiddete göre
            const severityCounts = {
                'Kritik': complaints?.filter(c => c.severity === 'Kritik').length || 0,
                'Yüksek': complaints?.filter(c => c.severity === 'Yüksek').length || 0,
                'Orta': complaints?.filter(c => c.severity === 'Orta').length || 0,
                'Düşük': complaints?.filter(c => c.severity === 'Düşük').length || 0
            };
            const bySeverity = Object.entries(severityCounts)
                .map(([name, count]) => ({ name, count }))
                .filter(item => item.count > 0);

            // Duruma göre
            const statusCounts = {};
            complaints?.forEach(c => {
                statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
            });
            const byStatus = Object.entries(statusCounts)
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count);

            // Aylık trend (son 6 ay)
            const monthlyData = {};
            for (let i = 5; i >= 0; i--) {
                const d = new Date();
                d.setMonth(d.getMonth() - i);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                monthlyData[key] = 0;
            }
            complaints?.forEach(c => {
                const date = new Date(c.complaint_date);
                const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                if (monthlyData.hasOwnProperty(key)) {
                    monthlyData[key]++;
                }
            });
            const monthlyTrend = Object.entries(monthlyData)
                .map(([month, count]) => ({ month, count }));

            setStats({
                total,
                new: newComplaints,
                inProgress,
                resolved,
                critical,
                avgResolutionDays: Math.round(avgDays * 10) / 10,
                totalFinancialImpact: totalFinancial,
                last30Days: last30,
                topCustomers,
                byCategory,
                bySeverity,
                byStatus,
                monthlyTrend
            });

        } catch (error) {
            console.error('Dashboard verileri yüklenirken hata:', error);
        } finally {
            setLoading(false);
        }
    };

    const getSeverityColor = (severity) => {
        switch (severity) {
            case 'Kritik': return 'bg-red-500';
            case 'Yüksek': return 'bg-orange-500';
            case 'Orta': return 'bg-yellow-500';
            case 'Düşük': return 'bg-green-500';
            default: return 'bg-gray-500';
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('tr-TR', {
            style: 'currency',
            currency: 'TRY'
        }).format(amount);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="ml-3 text-gray-600">Dashboard yükleniyor...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Zaman Filtresi */}
            <div className="flex justify-end gap-2">
                <button
                    onClick={() => setTimeRange('all')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium ${
                        timeRange === 'all' 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                    Tümü
                </button>
                <button
                    onClick={() => setTimeRange('30days')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium ${
                        timeRange === '30days' 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                    Son 30 Gün
                </button>
                <button
                    onClick={() => setTimeRange('90days')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium ${
                        timeRange === '90days' 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                    Son 90 Gün
                </button>
                <button
                    onClick={() => setTimeRange('year')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium ${
                        timeRange === 'year' 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                    Son 1 Yıl
                </button>
            </div>

            {/* Ana İstatistik Kartları */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => onFilterChange?.('all')}>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Toplam Şikayet</p>
                                <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                    Son 30 gün: {stats.last30Days}
                                </p>
                            </div>
                            <Activity className="w-10 h-10 text-blue-500" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => onFilterChange?.('new')}>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Yeni Şikayetler</p>
                                <p className="text-3xl font-bold text-orange-600">{stats.new}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                    Bekleyen
                                </p>
                            </div>
                            <AlertTriangle className="w-10 h-10 text-orange-500" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => onFilterChange?.('inProgress')}>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Devam Eden</p>
                                <p className="text-3xl font-bold text-yellow-600">{stats.inProgress}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                    İşlemde
                                </p>
                            </div>
                            <Clock className="w-10 h-10 text-yellow-500" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => onFilterChange?.('resolved')}>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Çözülen</p>
                                <p className="text-3xl font-bold text-green-600">{stats.resolved}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                    Tamamlandı
                                </p>
                            </div>
                            <CheckCircle className="w-10 h-10 text-green-500" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* İkinci Sıra İstatistikler */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => onFilterChange?.('critical')}>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Kritik Şikayetler</p>
                                <p className="text-3xl font-bold text-red-600">{stats.critical}</p>
                                <p className="text-xs text-red-600 mt-1">
                                    Acil müdahale gerekli
                                </p>
                            </div>
                            <Target className="w-10 h-10 text-red-500" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Ortalama Çözüm Süresi</p>
                                <p className="text-3xl font-bold text-blue-600">{stats.avgResolutionDays}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                    Gün
                                </p>
                            </div>
                            <Calendar className="w-10 h-10 text-blue-500" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Toplam Finansal Etki</p>
                                <p className="text-2xl font-bold text-purple-600">
                                    {formatCurrency(stats.totalFinancialImpact)}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                    Maliyet
                                </p>
                            </div>
                            <DollarSign className="w-10 h-10 text-purple-500" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Grafikler ve Detaylı İstatistikler */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* En Çok Şikayet Eden Müşteriler */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="w-5 h-5 text-blue-600" />
                            En Çok Şikayet Eden Müşteriler (Top 5)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {stats.topCustomers.length === 0 ? (
                            <p className="text-center text-gray-500 py-4">Henüz veri yok</p>
                        ) : (
                            <div className="space-y-3">
                                {stats.topCustomers.map((customer, idx) => (
                                    <div key={idx} className="flex items-center justify-between">
                                        <div className="flex items-center gap-3 flex-1">
                                            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-semibold text-sm">
                                                {idx + 1}
                                            </span>
                                            <span className="text-gray-900 font-medium truncate">{customer.name}</span>
                                        </div>
                                        <Badge variant="outline" className="ml-2">{customer.count} şikayet</Badge>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Kategoriye Göre Dağılım */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <PieChart className="w-5 h-5 text-blue-600" />
                            Kategoriye Göre Dağılım
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {stats.byCategory.length === 0 ? (
                            <p className="text-center text-gray-500 py-4">Henüz veri yok</p>
                        ) : (
                            <div className="space-y-3">
                                {stats.byCategory.map((cat, idx) => (
                                    <div key={idx}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm text-gray-700">{cat.name}</span>
                                            <span className="text-sm font-semibold text-gray-900">{cat.count}</span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2">
                                            <div 
                                                className="bg-blue-600 h-2 rounded-full" 
                                                style={{ width: `${(cat.count / stats.total) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Şiddete Göre Dağılım */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-blue-600" />
                            Şiddete Göre Dağılım
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {stats.bySeverity.length === 0 ? (
                            <p className="text-center text-gray-500 py-4">Henüz veri yok</p>
                        ) : (
                            <div className="space-y-3">
                                {stats.bySeverity.map((sev, idx) => (
                                    <div key={idx}>
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-3 h-3 rounded-full ${getSeverityColor(sev.name)}`} />
                                                <span className="text-sm text-gray-700">{sev.name}</span>
                                            </div>
                                            <span className="text-sm font-semibold text-gray-900">{sev.count}</span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2">
                                            <div 
                                                className={`${getSeverityColor(sev.name)} h-2 rounded-full`}
                                                style={{ width: `${(sev.count / stats.total) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Duruma Göre Dağılım */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-blue-600" />
                            Duruma Göre Dağılım
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {stats.byStatus.length === 0 ? (
                            <p className="text-center text-gray-500 py-4">Henüz veri yok</p>
                        ) : (
                            <div className="space-y-3">
                                {stats.byStatus.map((status, idx) => (
                                    <div key={idx}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm text-gray-700">{status.name}</span>
                                            <span className="text-sm font-semibold text-gray-900">{status.count}</span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2">
                                            <div 
                                                className="bg-green-600 h-2 rounded-full" 
                                                style={{ width: `${(status.count / stats.total) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Aylık Trend */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-blue-600" />
                        Aylık Şikayet Trendi (Son 6 Ay)
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {stats.monthlyTrend.length === 0 ? (
                        <p className="text-center text-gray-500 py-4">Henüz veri yok</p>
                    ) : (
                        <div className="space-y-2">
                            <div className="flex items-end justify-between gap-2 h-48">
                                {stats.monthlyTrend.map((month, idx) => {
                                    const maxCount = Math.max(...stats.monthlyTrend.map(m => m.count));
                                    const heightPercent = maxCount > 0 ? (month.count / maxCount) * 100 : 0;
                                    
                                    return (
                                        <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                                            <div className="w-full flex flex-col items-center justify-end h-40">
                                                <span className="text-xs font-semibold text-gray-700 mb-1">
                                                    {month.count}
                                                </span>
                                                <div 
                                                    className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-colors"
                                                    style={{ height: `${heightPercent}%`, minHeight: month.count > 0 ? '20px' : '0' }}
                                                />
                                            </div>
                                            <span className="text-xs text-gray-600">
                                                {month.month.split('-')[1]}/{month.month.split('-')[0].slice(2)}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

