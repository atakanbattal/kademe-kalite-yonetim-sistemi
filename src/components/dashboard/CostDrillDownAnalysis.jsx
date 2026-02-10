import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, WalletCards, TrendingUp, AlertTriangle, Car } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from 'recharts';
import { useData } from '@/contexts/DataContext';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const CHART_COLORS = ['#3B82F6', '#818CF8', '#A78BFA', '#F472B6', '#FBBF24', '#60A5FA', '#34D399', '#F87171'];

const CostDrillDownAnalysis = ({ onClose }) => {
    const { qualityCosts, producedVehicles, loading } = useData();
    const [activeTab, setActiveTab] = useState('breakdown'); // 'breakdown', 'vehicle', 'anomaly'

    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Bu ayki maliyetler
    const monthlyCosts = useMemo(() => {
        return (qualityCosts || []).filter(c => new Date(c.cost_date) >= firstDayOfMonth);
    }, [qualityCosts]);

    // Maliyet türüne göre dağılım (Hurda, Rework, Fire)
    const costTypeBreakdown = useMemo(() => {
        const breakdown = {
            'Hurda Maliyeti': 0,
            'Yeniden İşlem Maliyeti': 0,
            'Fire Maliyeti': 0,
            'Dış Hata Maliyeti': 0,
            'Garanti Maliyeti': 0,
            'İade Maliyeti': 0,
            'Şikayet Maliyeti': 0,
            'Önleme Maliyeti': 0,
            'Diğer': 0
        };
        
        monthlyCosts.forEach(cost => {
            const costType = cost.cost_type || '';
            if (breakdown.hasOwnProperty(costType)) {
                breakdown[costType] += cost.amount || 0;
            } else {
                breakdown['Diğer'] += cost.amount || 0;
            }
        });
        
        return Object.entries(breakdown)
            .filter(([_, value]) => value > 0)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [monthlyCosts]);

    // Araç tipine göre maliyet analizi
    const vehicleTypeCosts = useMemo(() => {
        const vehicleMap = {};
        monthlyCosts.forEach(cost => {
            // Araç tipini belirle (vehicle_type kolonu varsa onu kullan, yoksa part_code'dan çıkar)
            let vehicleType = cost.vehicle_type || 'Genel';
            if (vehicleType === 'Genel' && cost.part_code) {
                const partCode = cost.part_code.toLowerCase();
                if (partCode.includes('fth-240')) vehicleType = 'FTH-240';
                else if (partCode.includes('çelik-2000')) vehicleType = 'Çelik-2000';
                else if (partCode.includes('aga2100')) vehicleType = 'AGA2100';
                else if (partCode.includes('aga3000')) vehicleType = 'AGA3000';
                else if (partCode.includes('aga6000')) vehicleType = 'AGA6000';
                else if (partCode.includes('kompost')) vehicleType = 'Kompost Makinesi';
                else if (partCode.includes('çay')) vehicleType = 'Çay Toplama Makinesi';
                else if (partCode.includes('kdm')) vehicleType = 'KDM Serisi';
                else if (partCode.includes('ural')) vehicleType = 'Ural';
                else if (partCode.includes('hsc')) vehicleType = 'HSCK';
                else if (partCode.includes('traktör')) vehicleType = 'Traktör Kabin';
            }
            
            if (!vehicleMap[vehicleType]) {
                vehicleMap[vehicleType] = {
                    total: 0,
                    count: 0,
                    costs: []
                };
            }
            vehicleMap[vehicleType].total += cost.amount || 0;
            vehicleMap[vehicleType].count++;
            vehicleMap[vehicleType].costs.push(cost);
        });
        
        return Object.entries(vehicleMap)
            .map(([name, data]) => ({
                name: name || 'Belirtilmemiş',
                value: data.total,
                count: data.count,
                avgCost: data.total / data.count,
                costs: data.costs
            }))
            .sort((a, b) => b.value - a.value);
    }, [monthlyCosts]);

    // Anomali tespiti (ortalama maliyetin 2 katından fazla olanlar)
    const anomalies = useMemo(() => {
        if (vehicleTypeCosts.length === 0) return [];
        
        const avgCost = vehicleTypeCosts.reduce((sum, v) => sum + v.avgCost, 0) / vehicleTypeCosts.length;
        const threshold = avgCost * 2;
        
        return vehicleTypeCosts
            .filter(v => v.avgCost > threshold)
            .map(v => ({
                ...v,
                deviation: ((v.avgCost - avgCost) / avgCost * 100).toFixed(1)
            }))
            .sort((a, b) => b.avgCost - a.avgCost);
    }, [vehicleTypeCosts]);

    // Aylık trend analizi (son 6 ay)
    const monthlyTrend = useMemo(() => {
        const trendMap = {};
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        
        (qualityCosts || [])
            .filter(c => new Date(c.cost_date) >= sixMonthsAgo)
            .forEach(cost => {
                const monthKey = format(new Date(cost.cost_date), 'yyyy-MM', { locale: tr });
                if (!trendMap[monthKey]) {
                    trendMap[monthKey] = 0;
                }
                trendMap[monthKey] += cost.amount || 0;
            });
        
        return Object.entries(trendMap)
            .map(([name, value]) => ({
                name: format(new Date(name + '-01'), 'MMM yyyy', { locale: tr }),
                value
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [qualityCosts]);

    const totalMonthlyCost = monthlyCosts.reduce((sum, c) => sum + (c.amount || 0), 0);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
        >
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold">Kalite Maliyeti Analizi</h1>
                        <p className="text-muted-foreground mt-1">
                            Bu ayki toplam maliyet: <span className="font-semibold text-red-600">
                                {totalMonthlyCost.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                            </span>
                        </p>
                    </div>
                </div>
                <Badge variant="secondary" className="text-lg px-4 py-2">
                    {monthlyCosts.length} Kayıt
                </Badge>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-2 border-b">
                <Button
                    variant={activeTab === 'breakdown' ? 'default' : 'ghost'}
                    onClick={() => setActiveTab('breakdown')}
                    className="rounded-b-none"
                >
                    <WalletCards className="mr-2 h-4 w-4" />
                    Maliyet Dağılımı
                </Button>
                <Button
                    variant={activeTab === 'vehicle' ? 'default' : 'ghost'}
                    onClick={() => setActiveTab('vehicle')}
                    className="rounded-b-none"
                >
                    <Car className="mr-2 h-4 w-4" />
                    Araç Tipi Analizi
                </Button>
                <Button
                    variant={activeTab === 'anomaly' ? 'default' : 'ghost'}
                    onClick={() => setActiveTab('anomaly')}
                    className="rounded-b-none"
                >
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    Anomali Tespiti
                </Button>
            </div>

            {/* Content */}
            {loading ? (
                <div className="text-center py-12 text-muted-foreground">Yükleniyor...</div>
            ) : monthlyCosts.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <WalletCards className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-lg font-medium">Bu ay maliyet kaydı bulunmamaktadır.</p>
                    </CardContent>
                </Card>
            ) : (
                <>
                    {/* Maliyet Dağılımı */}
                    {activeTab === 'breakdown' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Maliyet Türü Dağılımı</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ResponsiveContainer width="100%" height={400}>
                                        <BarChart data={costTypeBreakdown} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                            <YAxis tick={{ fontSize: 12 }} />
                                            <Tooltip 
                                                contentStyle={{ 
                                                    backgroundColor: 'hsl(var(--background))', 
                                                    border: '1px solid hsl(var(--border))',
                                                    borderRadius: '0.5rem'
                                                }}
                                                formatter={(value) => value.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                                            />
                                            <Bar dataKey="value" name="Maliyet" radius={[4, 4, 0, 0]}>
                                                {costTypeBreakdown.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader>
                                    <CardTitle>Son 6 Ay Trend</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ResponsiveContainer width="100%" height={400}>
                                        <LineChart data={monthlyTrend} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                            <YAxis tick={{ fontSize: 12 }} />
                                            <Tooltip 
                                                contentStyle={{ 
                                                    backgroundColor: 'hsl(var(--background))', 
                                                    border: '1px solid hsl(var(--border))',
                                                    borderRadius: '0.5rem'
                                                }}
                                                formatter={(value) => value.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                                            />
                                            <Line 
                                                type="monotone" 
                                                dataKey="value" 
                                                stroke="#3B82F6" 
                                                strokeWidth={3}
                                                dot={{ r: 5 }}
                                                activeDot={{ r: 7 }}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                            <Card className="lg:col-span-2">
                                <CardHeader>
                                    <CardTitle>Maliyet Türü Detayları</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                        {costTypeBreakdown.map((type, index) => (
                                            <div key={index} className="p-4 bg-muted/50 rounded-lg">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                                                    <span className="font-medium">{type.name}</span>
                                                </div>
                                                <div className="text-2xl font-bold text-red-600">
                                                    {type.value.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                                                </div>
                                                <div className="text-xs text-muted-foreground mt-1">
                                                    %{((type.value / totalMonthlyCost) * 100).toFixed(1)} toplam maliyetten
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Araç Tipi Analizi */}
                    {activeTab === 'vehicle' && (
                        <div className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Car className="h-5 w-5" />
                                        Araç Tipine Göre Maliyet Dağılımı
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ResponsiveContainer width="100%" height={400}>
                                        <BarChart data={vehicleTypeCosts} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                                            <XAxis 
                                                dataKey="name" 
                                                angle={-45} 
                                                textAnchor="end" 
                                                height={100}
                                                tick={{ fontSize: 11 }}
                                            />
                                            <YAxis tick={{ fontSize: 12 }} />
                                            <Tooltip 
                                                contentStyle={{ 
                                                    backgroundColor: 'hsl(var(--background))', 
                                                    border: '1px solid hsl(var(--border))',
                                                    borderRadius: '0.5rem'
                                                }}
                                                formatter={(value) => value.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                                            />
                                            <Bar dataKey="value" name="Toplam Maliyet" radius={[4, 4, 0, 0]}>
                                                {vehicleTypeCosts.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader>
                                    <CardTitle>Araç Tipi Detayları</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Araç Tipi</TableHead>
                                                    <TableHead className="text-right">Toplam Maliyet</TableHead>
                                                    <TableHead className="text-center">Kayıt Sayısı</TableHead>
                                                    <TableHead className="text-right">Ortalama Maliyet</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {vehicleTypeCosts.map((vehicle, index) => (
                                                    <TableRow key={index}>
                                                        <TableCell className="font-medium">{vehicle.name}</TableCell>
                                                        <TableCell className="text-right font-semibold text-red-600">
                                                            {vehicle.value.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <Badge variant="secondary">{vehicle.count}</Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {vehicle.avgCost.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Anomali Tespiti */}
                    {activeTab === 'anomaly' && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                                    Maliyet Anomalileri
                                    {anomalies.length > 0 && (
                                        <Badge variant="destructive" className="ml-2">
                                            {anomalies.length} anomali tespit edildi
                                        </Badge>
                                    )}
                                </CardTitle>
                                <p className="text-sm text-muted-foreground mt-2">
                                    Ortalama maliyetin 2 katından fazla maliyet gösteren araç tipleri
                                </p>
                            </CardHeader>
                            <CardContent>
                                {anomalies.length === 0 ? (
                                    <div className="text-center py-12 text-muted-foreground">
                                        <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                        <p>Anomali tespit edilmedi. Tüm araç tipleri normal maliyet aralığında.</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Araç Tipi</TableHead>
                                                    <TableHead className="text-right">Ortalama Maliyet</TableHead>
                                                    <TableHead className="text-center">Kayıt Sayısı</TableHead>
                                                    <TableHead className="text-right">Sapma Oranı</TableHead>
                                                    <TableHead className="text-right">Toplam Maliyet</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {anomalies.map((anomaly, index) => (
                                                    <TableRow key={index} className="bg-orange-50 dark:bg-orange-950/20">
                                                        <TableCell className="font-medium">{anomaly.name}</TableCell>
                                                        <TableCell className="text-right font-semibold text-red-600">
                                                            {anomaly.avgCost.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <Badge variant="secondary">{anomaly.count}</Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Badge variant="destructive">+%{anomaly.deviation}</Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {anomaly.value.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </>
            )}
        </motion.div>
    );
};

export default CostDrillDownAnalysis;

