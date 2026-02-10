import React, { useMemo, useState } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription } from '@/components/ui/alert-dialog';
import { X } from 'lucide-react';

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16'];

const QuarantineAnalytics = ({ quarantineRecords }) => {
    const [selectedData, setSelectedData] = useState(null);
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [searchFilter, setSearchFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    // Filtered records based on search and status
    const filteredRecords = useMemo(() => {
        return quarantineRecords.filter(record => {
            const matchesSearch = !searchFilter || 
                record.part_code?.toLowerCase().includes(searchFilter.toLowerCase()) ||
                record.part_name?.toLowerCase().includes(searchFilter.toLowerCase()) ||
                record.lot_no?.toLowerCase().includes(searchFilter.toLowerCase());
            
            const matchesStatus = statusFilter === 'all' || record.status === statusFilter;
            
            return matchesSearch && matchesStatus;
        });
    }, [quarantineRecords, searchFilter, statusFilter]);

    // Part Analysis
    const partAnalysisWithRecords = useMemo(() => {
        const parts = {};
        filteredRecords.forEach(q => {
            const part = `${q.part_code || 'Bilinmiyor'} - ${q.part_name || 'N/A'}`;
            if (!parts[part]) parts[part] = { count: 0, totalQuantity: 0, records: [] };
            parts[part].count++;
            parts[part].totalQuantity += q.quantity || 0;
            parts[part].records.push(q);
        });
        return Object.entries(parts)
            .map(([name, data]) => ({ name, count: data.count, quantity: data.totalQuantity, records: data.records }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
    }, [filteredRecords]);

    // Status Analysis
    const statusAnalysis = useMemo(() => {
        const statuses = {};
        const statusRecords = {};
        filteredRecords.forEach(q => {
            const status = q.status || 'Bilinmiyor';
            statuses[status] = (statuses[status] || 0) + 1;
            if (!statusRecords[status]) statusRecords[status] = [];
            statusRecords[status].push(q);
        });
        return Object.entries(statuses).map(([name, count]) => ({ name, count, records: statusRecords[name] }));
    }, [filteredRecords]);

    // Monthly Trend
    const monthlyTrend = useMemo(() => {
        const months = {};
        const monthRecords = {};
        filteredRecords.forEach(q => {
            if (q.quarantine_date || q.created_at) {
                const date = q.quarantine_date || q.created_at;
                const monthKey = format(parseISO(date), 'MMM yyyy', { locale: tr });
                if (!months[monthKey]) {
                    months[monthKey] = { count: 0, quantity: 0 };
                    monthRecords[monthKey] = [];
                }
                months[monthKey].count++;
                months[monthKey].quantity += q.quantity || 0;
                monthRecords[monthKey].push(q);
            }
        });
        return Object.entries(months)
            .sort((a, b) => new Date(a[0]) - new Date(b[0]))
            .map(([month, data]) => ({ month, count: data.count, quantity: data.quantity, records: monthRecords[month] }));
    }, [filteredRecords]);

    // Reason Analysis
    const reasonAnalysis = useMemo(() => {
        const reasons = {};
        const reasonRecords = {};
        filteredRecords.forEach(q => {
            const reason = q.reason || 'Bilinmiyor';
            reasons[reason] = (reasons[reason] || 0) + 1;
            if (!reasonRecords[reason]) reasonRecords[reason] = [];
            reasonRecords[reason].push(q);
        });
        return Object.entries(reasons)
            .map(([name, count]) => ({ name, count, records: reasonRecords[name] }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 8);
    }, [filteredRecords]);

    // Department Analysis
    const deptAnalysis = useMemo(() => {
        const depts = {};
        const deptRecords = {};
        filteredRecords.forEach(q => {
            const dept = q.source_department || 'Bilinmiyor';
            depts[dept] = (depts[dept] || 0) + 1;
            if (!deptRecords[dept]) deptRecords[dept] = [];
            deptRecords[dept].push(q);
        });
        return Object.entries(depts)
            .map(([name, count]) => ({ name, count, records: deptRecords[name] }))
            .sort((a, b) => b.count - a.count);
    }, [filteredRecords]);

    // Summary Stats - tüm durumları göster
    const stats = useMemo(() => ({
        total: filteredRecords.length,
        totalQuantity: filteredRecords.reduce((sum, q) => sum + (q.quantity || 0), 0),
        inQuarantine: filteredRecords.filter(q => q.status === 'Karantinada').length,
        released: filteredRecords.filter(q => q.status === 'Serbest Bırakıldı').length,
        scrap: filteredRecords.filter(q => q.status === 'Hurda').length,
        rework: filteredRecords.filter(q => q.status === 'Yeniden İşlem').length,
        returned: filteredRecords.filter(q => q.status === 'İade').length,
        deviationApproved: filteredRecords.filter(q => q.status === 'Sapma Onaylı').length,
    }), [filteredRecords]);

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
            {/* Filter Controls */}
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Akıllı Filtreleme</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-4 flex-wrap">
                        <div className="flex-1 min-w-xs">
                            <Input 
                                placeholder="Parça kodu, adı veya lot no ara..." 
                                value={searchFilter}
                                onChange={(e) => setSearchFilter(e.target.value)}
                                className="bg-white"
                            />
                        </div>
                        <select 
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-4 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition"
                        >
                            <option value="all">Tüm Durumlar</option>
                            <option value="Karantinada">Karantinada</option>
                            <option value="Hurda">Hurda</option>
                            <option value="Serbest Bırakıldı">Serbest Bırakıldı</option>
                            <option value="Yeniden İşlem">Yeniden İşlem</option>
                            <option value="İade">İade</option>
                            <option value="Sapma Onaylı">Sapma Onaylı</option>
                        </select>
                        {(searchFilter || statusFilter !== 'all') && (
                            <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => { setSearchFilter(''); setStatusFilter('all'); }}
                                className="gap-2"
                            >
                                <X className="w-4 h-4" /> Temizle
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 flex flex-col">
                    <CardHeader className="pb-1 pt-3 px-3">
                        <CardTitle className="text-xs font-medium text-blue-600 h-8 flex items-center">Toplam Kayıt</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 pb-3 px-3">
                        <div className="text-2xl font-bold text-blue-900">{stats.total}</div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200 flex flex-col">
                    <CardHeader className="pb-1 pt-3 px-3">
                        <CardTitle className="text-xs font-medium text-red-600 h-8 flex items-center">Karantinada</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 pb-3 px-3">
                        <div className="text-2xl font-bold text-red-900">{stats.inQuarantine}</div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-gray-100 to-gray-200 border-gray-300 flex flex-col">
                    <CardHeader className="pb-1 pt-3 px-3">
                        <CardTitle className="text-xs font-medium text-gray-700 h-8 flex items-center">Hurda</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 pb-3 px-3">
                        <div className="text-2xl font-bold text-gray-900">{stats.scrap}</div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 flex flex-col">
                    <CardHeader className="pb-1 pt-3 px-3">
                        <CardTitle className="text-xs font-medium text-green-600 h-8 flex items-center">Serbest Bırakıldı</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 pb-3 px-3">
                        <div className="text-2xl font-bold text-green-900">{stats.released}</div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200 flex flex-col">
                    <CardHeader className="pb-1 pt-3 px-3">
                        <CardTitle className="text-xs font-medium text-amber-600 h-8 flex items-center">Yeniden İşlem</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 pb-3 px-3">
                        <div className="text-2xl font-bold text-amber-900">{stats.rework}</div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 flex flex-col">
                    <CardHeader className="pb-1 pt-3 px-3">
                        <CardTitle className="text-xs font-medium text-orange-600 h-8 flex items-center">İade</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 pb-3 px-3">
                        <div className="text-2xl font-bold text-orange-900">{stats.returned}</div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 flex flex-col">
                    <CardHeader className="pb-1 pt-3 px-3">
                        <CardTitle className="text-xs font-medium text-purple-600 h-8 flex items-center">Sapma Onaylı</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 pb-3 px-3">
                        <div className="text-2xl font-bold text-purple-900">{stats.deviationApproved}</div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200 flex flex-col">
                    <CardHeader className="pb-1 pt-3 px-3">
                        <CardTitle className="text-xs font-medium text-indigo-600 h-8 flex items-center">Toplam Adet</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 pb-3 px-3">
                        <div className="text-2xl font-bold text-indigo-900">{stats.totalQuantity}</div>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="parts" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="parts">Parçalar</TabsTrigger>
                    <TabsTrigger value="status">Durum</TabsTrigger>
                    <TabsTrigger value="departments">Birimler</TabsTrigger>
                    <TabsTrigger value="trend">Trend</TabsTrigger>
                </TabsList>

                {/* Parts Tab */}
                <TabsContent value="parts">
                    <Card>
                        <CardHeader>
                            <CardTitle>En Çok Karantinaya Giren Parçalar</CardTitle>
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
                                    <YAxis yAxisId="left" label={{ value: 'Adet', angle: -90, position: 'insideLeft' }} />
                                    <YAxis yAxisId="right" orientation="right" label={{ value: 'Toplam Adet', angle: 90, position: 'insideRight' }} />
                                    <Tooltip contentStyle={{ backgroundColor: '#f3f4f6', border: '1px solid #d1d5db' }} />
                                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                    <Bar yAxisId="left" dataKey="count" fill="#3b82f6" name="Adet" radius={[8, 8, 0, 0]} onClick={(e) => handleBarClick(e)} style={{ cursor: 'pointer' }} />
                                    <Bar yAxisId="right" dataKey="quantity" fill="#8b5cf6" name="Toplam Adet" radius={[8, 8, 0, 0]} onClick={(e) => handleBarClick(e)} style={{ cursor: 'pointer' }} />
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
                                <CardTitle>Durum Dağılımı (Pie)</CardTitle>
                                <CardDescription>Tıklayarak detayları görebilirsiniz</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={350}>
                                    <PieChart>
                                        <Pie 
                                            data={statusAnalysis} 
                                            cx="50%" 
                                            cy="50%" 
                                            labelLine={false} 
                                            label={({ name, count, percent }) => `${name} (${count})`}
                                            outerRadius={100} 
                                            dataKey="count"
                                            onClick={(e) => handlePieClick(e.payload)}
                                        >
                                            {statusAnalysis.map((entry, index) => (
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
                                    {statusAnalysis.map((status, idx) => (
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
                                            <div className="mt-2 text-sm text-gray-600">
                                                {status.records.length} kayıt
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Departments Tab */}
                <TabsContent value="departments">
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Kaynak Birimler</CardTitle>
                                <CardDescription>Karantinaya giren ürünleri talep eden birimler</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart 
                                        data={deptAnalysis} 
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
                                            fill="#10b981" 
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
                                <CardTitle className="text-lg">Birim Detayları</CardTitle>
                                <CardDescription>Tıklayarak kayıtları görebilirsiniz</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {deptAnalysis.map((dept, idx) => (
                                        <div 
                                            key={idx} 
                                            className="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition cursor-pointer border border-gray-200"
                                            onClick={() => handleBarClick(dept)}
                                        >
                                            <div className="flex-1">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="font-semibold text-sm text-gray-800">{dept.name}</span>
                                                    <span className="text-xs font-bold px-3 py-1 bg-green-100 text-green-700 rounded-full">{dept.count} Adet</span>
                                                </div>
                                                <div className="w-full bg-gray-300 rounded-full h-2.5">
                                                    <div 
                                                        className="bg-gradient-to-r from-green-500 to-green-600 h-2.5 rounded-full transition-all" 
                                                        style={{ width: `${(dept.count / Math.max(...deptAnalysis.map(d => d.count))) * 100}%` }}
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
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Aylık Karantina Trendi</CardTitle>
                                <CardDescription>Zaman içinde karantina sayısı ve adedi değişimi</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={400}>
                                    <LineChart data={monthlyTrend}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                        <XAxis dataKey="month" />
                                        <YAxis yAxisId="left" label={{ value: 'Kayıt Sayısı', angle: -90, position: 'insideLeft' }} />
                                        <YAxis yAxisId="right" orientation="right" label={{ value: 'Toplam Adet', angle: 90, position: 'insideRight' }} />
                                        <Tooltip contentStyle={{ backgroundColor: '#f3f4f6', border: '1px solid #d1d5db' }} />
                                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                        <Line yAxisId="left" type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#3b82f6', r: 5 }} name="Adet" />
                                        <Line yAxisId="right" type="monotone" dataKey="quantity" stroke="#ef4444" strokeWidth={3} dot={{ fill: '#ef4444', r: 5 }} name="Toplam Adet" />
                                    </LineChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Karantina Nedenleri</CardTitle>
                                <CardDescription>En sık rastlanan karantina sebepleri</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {reasonAnalysis.map((reason, idx) => (
                                        <div 
                                            key={idx} 
                                            className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition cursor-pointer"
                                            onClick={() => handleBarClick(reason)}
                                        >
                                            <div className="w-full">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="font-medium text-sm">{reason.name}</span>
                                                    <span className="text-xs font-bold px-2 py-1 bg-blue-100 text-blue-700 rounded">{reason.count} kayıt</span>
                                                </div>
                                                <div className="w-full bg-gray-200 rounded-full h-2">
                                                    <div 
                                                        className="bg-blue-600 h-2 rounded-full" 
                                                        style={{ width: `${(reason.count / Math.max(...reasonAnalysis.map(r => r.count))) * 100}%` }}
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
            </Tabs>

            {/* Detail Modal */}
            <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
                <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
                    <DialogHeader>
                        <DialogTitle>Kayıt Detayları</DialogTitle>
                        <DialogDescription>
                            {selectedData?.name} - {selectedData?.count || selectedData?.records?.length} kayıt
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        {selectedData?.records?.map((record, idx) => (
                            <div key={idx} className="p-4 border rounded-lg bg-slate-50">
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <span className="font-semibold text-gray-600">Parça Kodu:</span>
                                        <p className="text-gray-900">{record.part_code || '-'}</p>
                                    </div>
                                    <div>
                                        <span className="font-semibold text-gray-600">Parça Adı:</span>
                                        <p className="text-gray-900">{record.part_name || '-'}</p>
                                    </div>
                                    <div>
                                        <span className="font-semibold text-gray-600">Miktar:</span>
                                        <p className="text-gray-900">{record.quantity} {record.unit}</p>
                                    </div>
                                    <div>
                                        <span className="font-semibold text-gray-600">Durum:</span>
                                        <p className="text-gray-900">{record.status}</p>
                                    </div>
                                    <div>
                                        <span className="font-semibold text-gray-600">Sebep:</span>
                                        <p className="text-gray-900">{record.reason || '-'}</p>
                                    </div>
                                    <div>
                                        <span className="font-semibold text-gray-600">Tarih:</span>
                                        <p className="text-gray-900">{record.quarantine_date ? format(parseISO(record.quarantine_date), 'dd.MM.yyyy') : '-'}</p>
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

export default QuarantineAnalytics;
