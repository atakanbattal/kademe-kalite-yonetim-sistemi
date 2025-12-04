import React, { useMemo, useState } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { format, parseISO, startOfMonth } from 'date-fns';
import { tr } from 'date-fns/locale';

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16'];

const DeviationAnalytics = ({ deviations }) => {
    const [selectedData, setSelectedData] = useState(null);
    const [detailModalOpen, setDetailModalOpen] = useState(false);

    // Part Analysis with Records
    const partAnalysisWithRecords = useMemo(() => {
        const parts = {};
        deviations.forEach(d => {
            const partCode = d.part_code?.trim() || '';
            const partName = d.part_name?.trim() || '';
            const part = partCode && partName ? `${partCode} - ${partName}` : partCode || partName || 'Bilinmiyor';
            if (!parts[part]) parts[part] = { count: 0, records: [] };
            parts[part].count++;
            parts[part].records.push(d);
        });
        return Object.entries(parts)
            .map(([name, data]) => ({ name, count: data.count, records: data.records }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
    }, [deviations]);

    // Status Analysis with Records
    const statusAnalysisWithRecords = useMemo(() => {
        const statuses = {};
        deviations.forEach(d => {
            const status = d.status || 'Bilinmiyor';
            if (!statuses[status]) statuses[status] = { count: 0, records: [] };
            statuses[status].count++;
            statuses[status].records.push(d);
        });
        return Object.entries(statuses)
            .map(([name, data]) => ({ name, count: data.count, records: data.records }));
    }, [deviations]);

    // Unit Analysis with Records
    const unitAnalysisWithRecords = useMemo(() => {
        const units = {};
        deviations.forEach(d => {
            const unit = d.requesting_unit || 'Bilinmiyor';
            if (!units[unit]) units[unit] = { count: 0, records: [] };
            units[unit].count++;
            units[unit].records.push(d);
        });
        return Object.entries(units)
            .map(([name, data]) => ({ name, count: data.count, records: data.records }))
            .sort((a, b) => b.count - a.count);
    }, [deviations]);

    // Source Analysis with Records
    const sourceAnalysisWithRecords = useMemo(() => {
        const sources = {};
        deviations.forEach(d => {
            const source = d.source || 'Bilinmiyor';
            if (!sources[source]) sources[source] = { count: 0, records: [] };
            sources[source].count++;
            sources[source].records.push(d);
        });
        return Object.entries(sources)
            .map(([name, data]) => ({ name, count: data.count, records: data.records }))
            .sort((a, b) => b.count - a.count);
    }, [deviations]);

    // Monthly Trend with Records
    const monthlyTrend = useMemo(() => {
        const months = {};
        deviations.forEach(d => {
            if (d.created_at) {
                const monthKey = format(parseISO(d.created_at), 'MMM yyyy', { locale: tr });
                if (!months[monthKey]) months[monthKey] = { count: 0, records: [] };
                months[monthKey].count++;
                months[monthKey].records.push(d);
            }
        });
        return Object.entries(months)
            .sort((a, b) => new Date(a[0]) - new Date(b[0]))
            .map(([month, data]) => ({ month, count: data.count, records: data.records }));
    }, [deviations]);

    // Summary Stats
    const stats = useMemo(() => ({
        total: deviations.length,
        open: deviations.filter(d => d.status === 'Açık').length,
        pending: deviations.filter(d => d.status === 'Onay Bekliyor').length,
        approved: deviations.filter(d => d.status === 'Onaylandı').length,
        rejected: deviations.filter(d => d.status === 'Reddedildi').length,
        closed: deviations.filter(d => d.status === 'Kapatıldı').length,
    }), [deviations]);

    const handleBarClick = (data) => {
        setSelectedData(data);
        setDetailModalOpen(true);
    };

    const handlePieClick = (data) => {
        setSelectedData(data);
        setDetailModalOpen(true);
    };

    return (
        <div className="space-y-8">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-blue-600">Toplam Sapma</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-blue-900">{stats.total}</div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-red-600">Açık</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-red-900">{stats.open}</div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-yellow-600">Onay Bekliyor</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-yellow-900">{stats.pending}</div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-green-600">Onaylandı</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-green-900">{stats.approved}</div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-purple-600">Reddedildi</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-purple-900">{stats.rejected}</div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-gray-600">Kapatıldı</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-gray-900">{stats.closed}</div>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="parts" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="parts">Parçalar</TabsTrigger>
                    <TabsTrigger value="status">Durum</TabsTrigger>
                    <TabsTrigger value="sources">Kaynaklar</TabsTrigger>
                    <TabsTrigger value="trend">Trend</TabsTrigger>
                </TabsList>

                {/* Parts Tab */}
                <TabsContent value="parts">
                    <Card>
                        <CardHeader>
                            <CardTitle>En Çok Sapma Gelen Parçalar</CardTitle>
                            <CardDescription>Tıklayarak detayları görebilirsiniz</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={550}>
                                <BarChart data={partAnalysisWithRecords} margin={{ top: 20, right: 30, left: 20, bottom: 100 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                    <XAxis 
                                        dataKey="name" 
                                        angle={-45} 
                                        textAnchor="end" 
                                        height={100}
                                        interval={0}
                                        tick={{ fontSize: 11 }}
                                        tickFormatter={(value) => value.split(' - ')[0]}
                                    />
                                    <YAxis label={{ value: 'Adet', angle: -90, position: 'insideLeft' }} />
                                    <Tooltip contentStyle={{ backgroundColor: '#f3f4f6', border: '1px solid #d1d5db' }} />
                                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                    <Bar dataKey="count" fill="#3b82f6" name="Adet" radius={[8, 8, 0, 0]} onClick={(e) => handleBarClick(e)} style={{ cursor: 'pointer' }} />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Status Tab */}
                <TabsContent value="status">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Durum Dağılımı</CardTitle>
                                <CardDescription>Tıklayarak detayları görebilirsiniz</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={350}>
                                    <PieChart>
                                        <Pie 
                                            data={statusAnalysisWithRecords} 
                                            cx="50%" 
                                            cy="50%" 
                                            labelLine={false} 
                                            label={({ name, count }) => `${name} (${count})`}
                                            outerRadius={100} 
                                            dataKey="count"
                                            onClick={(e) => handlePieClick(e.payload)}
                                        >
                                            {statusAnalysisWithRecords.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} style={{ cursor: 'pointer' }} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value) => `${value} kayıt`} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Durum Detayları</CardTitle>
                                <CardDescription>Tıklayarak kayıtları görebilirsiniz</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {statusAnalysisWithRecords.map((status, idx) => (
                                        <div 
                                            key={idx} 
                                            className="p-4 bg-gradient-to-r rounded-lg border-2 cursor-pointer hover:shadow-lg transition"
                                            style={{ borderColor: COLORS[idx % COLORS.length], backgroundColor: COLORS[idx % COLORS.length] + '15' }}
                                            onClick={() => handlePieClick(status)}
                                        >
                                            <div className="flex justify-between items-center">
                                                <span className="font-semibold">{status.name}</span>
                                                <span className="text-2xl font-bold" style={{ color: COLORS[idx % COLORS.length] }}>{status.count}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Sources Tab */}
                <TabsContent value="sources">
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Sapma Kaynakları</CardTitle>
                                <CardDescription>Sapmalar hangi kaynaklardan geliyor</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart 
                                        data={sourceAnalysisWithRecords} 
                                        layout="vertical" 
                                        margin={{ top: 5, right: 30, bottom: 5, left: 120 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                        <XAxis type="number" tick={{ fontSize: 11 }} />
                                        <YAxis 
                                            dataKey="name" 
                                            type="category" 
                                            width={110} 
                                            tick={{ fontSize: 12 }}
                                        />
                                        <Tooltip 
                                            contentStyle={{ backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px' }} 
                                            formatter={(value) => `${value} Adet`} 
                                            labelFormatter={() => ''}
                                        />
                                        <Bar 
                                            dataKey="count" 
                                            fill="#8b5cf6" 
                                            radius={[0, 6, 6, 0]} 
                                            onClick={(e) => handleBarClick(e)} 
                                            style={{ cursor: 'pointer' }}
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Talep Yapan Birimler</CardTitle>
                                <CardDescription>Tıklayarak detayları görebilirsiniz</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {unitAnalysisWithRecords.map((unit, idx) => (
                                        <div 
                                            key={idx} 
                                            className="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition cursor-pointer border border-gray-200"
                                            onClick={() => handleBarClick(unit)}
                                        >
                                            <div className="flex-1">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="font-semibold text-sm text-gray-800">{unit.name}</span>
                                                    <span className="text-xs font-bold px-3 py-1 bg-purple-100 text-purple-700 rounded-full">{unit.count} Adet</span>
                                                </div>
                                                <div className="w-full bg-gray-300 rounded-full h-2.5">
                                                    <div 
                                                        className="bg-gradient-to-r from-purple-500 to-purple-600 h-2.5 rounded-full transition-all" 
                                                        style={{ width: `${(unit.count / Math.max(...unitAnalysisWithRecords.map(u => u.count))) * 100}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Trend Tab */}
                <TabsContent value="trend">
                    <Card>
                        <CardHeader>
                            <CardTitle>Aylık Sapma Trendi</CardTitle>
                            <CardDescription>Zaman içinde sapma sayısı değişimi</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={400}>
                                <LineChart data={monthlyTrend}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                    <XAxis dataKey="month" />
                                    <YAxis label={{ value: 'Adet', angle: -90, position: 'insideLeft' }} />
                                    <Tooltip contentStyle={{ backgroundColor: '#f3f4f6', border: '1px solid #d1d5db' }} />
                                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                    <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#3b82f6', r: 5 }} name="Adet" />
                                </LineChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Detail Modal */}
            <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
                <DialogContent className="max-w-3xl max-h-96 overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Sapma Detayları</DialogTitle>
                        <DialogDescription>
                            {selectedData?.name} - {selectedData?.count || selectedData?.records?.length} sapma kaydı
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        {selectedData?.records?.map((record, idx) => (
                            <div key={idx} className="p-4 border rounded-lg bg-slate-50">
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <span className="font-semibold text-gray-600">Talep No:</span>
                                        <p className="text-gray-900 font-mono">{record.request_no || '-'}</p>
                                    </div>
                                    <div>
                                        <span className="font-semibold text-gray-600">Durum:</span>
                                        <p className="text-gray-900">{record.status || '-'}</p>
                                    </div>
                                    <div>
                                        <span className="font-semibold text-gray-600">Açıklama:</span>
                                        <p className="text-gray-900">{record.description || '-'}</p>
                                    </div>
                                    <div>
                                        <span className="font-semibold text-gray-600">Kaynak:</span>
                                        <p className="text-gray-900">{record.source || '-'}</p>
                                    </div>
                                    <div>
                                        <span className="font-semibold text-gray-600">Talep Eden Birim:</span>
                                        <p className="text-gray-900">{record.requesting_unit || '-'}</p>
                                    </div>
                                    <div>
                                        <span className="font-semibold text-gray-600">Tarih:</span>
                                        <p className="text-gray-900">{record.created_at ? format(parseISO(record.created_at), 'dd.MM.yyyy') : '-'}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default DeviationAnalytics;
