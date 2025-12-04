import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const METRIC_TYPES = [
    { value: 'PPM', label: 'PPM (Parts Per Million)' },
    { value: 'NC Count', label: 'Uygunsuzluk Sayısı' },
    { value: 'Cost', label: 'Kalitesizlik Maliyeti' },
    { value: 'OTD', label: 'Zamanında Teslimat %' }
];

const PERIOD_TYPES = [
    { value: 'Daily', label: 'Günlük' },
    { value: 'Weekly', label: 'Haftalık' },
    { value: 'Monthly', label: 'Aylık' },
    { value: 'Yearly', label: 'Yıllık' }
];

const TrendAnalysis = () => {
    const { toast } = useToast();
    const [selectedMetric, setSelectedMetric] = useState('PPM');
    const [selectedPeriod, setSelectedPeriod] = useState('Monthly');
    const [trendData, setTrendData] = useState([]);
    const [loading, setLoading] = useState(false);

    const loadTrendData = async () => {
        setLoading(true);
        try {
            let data = [];
            const now = new Date();
            const periods = selectedPeriod === 'Monthly' ? 12 : selectedPeriod === 'Yearly' ? 5 : selectedPeriod === 'Weekly' ? 52 : 30;
            
            if (selectedMetric === 'PPM') {
                // PPM verilerini incoming_inspections'tan çek
                const startDate = new Date();
                if (selectedPeriod === 'Monthly') {
                    startDate.setMonth(startDate.getMonth() - periods);
                } else if (selectedPeriod === 'Yearly') {
                    startDate.setFullYear(startDate.getFullYear() - periods);
                } else if (selectedPeriod === 'Weekly') {
                    startDate.setDate(startDate.getDate() - periods * 7);
                } else {
                    startDate.setDate(startDate.getDate() - periods);
                }

                const { data: inspections, error: inspError } = await supabase
                    .from('incoming_inspections')
                    .select('inspection_date, quantity_received, quantity_rejected')
                    .gte('inspection_date', startDate.toISOString().split('T')[0])
                    .order('inspection_date', { ascending: true });

                if (inspError) throw inspError;

                // Aylık/haftalık/günlük gruplama
                const grouped = {};
                inspections?.forEach(ins => {
                    const date = new Date(ins.inspection_date);
                    let key;
                    if (selectedPeriod === 'Monthly') {
                        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    } else if (selectedPeriod === 'Yearly') {
                        key = `${date.getFullYear()}`;
                    } else if (selectedPeriod === 'Weekly') {
                        const week = Math.floor((date - new Date(date.getFullYear(), 0, 1)) / (7 * 24 * 60 * 60 * 1000));
                        key = `${date.getFullYear()}-W${String(week + 1).padStart(2, '0')}`;
                    } else {
                        key = ins.inspection_date;
                    }

                    if (!grouped[key]) {
                        grouped[key] = { total: 0, rejected: 0 };
                    }
                    grouped[key].total += ins.quantity_received || 0;
                    grouped[key].rejected += ins.quantity_rejected || 0;
                });

                data = Object.keys(grouped).sort().map(key => {
                    const ppm = grouped[key].total > 0 
                        ? (grouped[key].rejected / grouped[key].total) * 1000000 
                        : 0;
                    return {
                        period: key,
                        value: Math.round(ppm),
                        moving_avg: Math.round(ppm) // Basit hesaplama
                    };
                });
            } else if (selectedMetric === 'NC Count') {
                // Non-conformities sayısı
                const startDate = new Date();
                if (selectedPeriod === 'Monthly') {
                    startDate.setMonth(startDate.getMonth() - periods);
                } else if (selectedPeriod === 'Yearly') {
                    startDate.setFullYear(startDate.getFullYear() - periods);
                } else if (selectedPeriod === 'Weekly') {
                    startDate.setDate(startDate.getDate() - periods * 7);
                } else {
                    startDate.setDate(startDate.getDate() - periods);
                }

                const { data: ncs, error: ncError } = await supabase
                    .from('non_conformities')
                    .select('created_at')
                    .gte('created_at', startDate.toISOString())
                    .order('created_at', { ascending: true });

                if (ncError) throw ncError;

                const grouped = {};
                ncs?.forEach(nc => {
                    const date = new Date(nc.created_at);
                    let key;
                    if (selectedPeriod === 'Monthly') {
                        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    } else if (selectedPeriod === 'Yearly') {
                        key = `${date.getFullYear()}`;
                    } else if (selectedPeriod === 'Weekly') {
                        const week = Math.floor((date - new Date(date.getFullYear(), 0, 1)) / (7 * 24 * 60 * 60 * 1000));
                        key = `${date.getFullYear()}-W${String(week + 1).padStart(2, '0')}`;
                    } else {
                        key = nc.created_at.split('T')[0];
                    }

                    grouped[key] = (grouped[key] || 0) + 1;
                });

                data = Object.keys(grouped).sort().map(key => ({
                    period: key,
                    value: grouped[key],
                    moving_avg: grouped[key]
                }));
            } else if (selectedMetric === 'Cost') {
                // Quality costs
                const startDate = new Date();
                if (selectedPeriod === 'Monthly') {
                    startDate.setMonth(startDate.getMonth() - periods);
                } else if (selectedPeriod === 'Yearly') {
                    startDate.setFullYear(startDate.getFullYear() - periods);
                } else if (selectedPeriod === 'Weekly') {
                    startDate.setDate(startDate.getDate() - periods * 7);
                } else {
                    startDate.setDate(startDate.getDate() - periods);
                }

                const { data: costs, error: costError } = await supabase
                    .from('quality_costs')
                    .select('cost_date, amount')
                    .gte('cost_date', startDate.toISOString().split('T')[0])
                    .order('cost_date', { ascending: true });

                if (costError) throw costError;

                const grouped = {};
                costs?.forEach(cost => {
                    const date = new Date(cost.cost_date);
                    let key;
                    if (selectedPeriod === 'Monthly') {
                        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    } else if (selectedPeriod === 'Yearly') {
                        key = `${date.getFullYear()}`;
                    } else if (selectedPeriod === 'Weekly') {
                        const week = Math.floor((date - new Date(date.getFullYear(), 0, 1)) / (7 * 24 * 60 * 60 * 1000));
                        key = `${date.getFullYear()}-W${String(week + 1).padStart(2, '0')}`;
                    } else {
                        key = cost.cost_date;
                    }

                    grouped[key] = (grouped[key] || 0) + (parseFloat(cost.amount) || 0);
                });

                data = Object.keys(grouped).sort().map(key => ({
                    period: key,
                    value: Math.round(grouped[key]),
                    moving_avg: Math.round(grouped[key])
                }));
            } else {
                // OTD için boş veri
                data = [];
            }

            setTrendData(data);
        } catch (error) {
            console.error('Trend data loading error:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Trend verileri yüklenirken hata oluştu: ' + (error.message || 'Bilinmeyen hata')
            });
            setTrendData([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTrendData();
    }, [selectedMetric, selectedPeriod]);

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Trend Analizi</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-4">
                        <Select value={selectedMetric} onValueChange={setSelectedMetric}>
                            <SelectTrigger className="w-64">
                                <SelectValue placeholder="Metrik seçin" />
                            </SelectTrigger>
                            <SelectContent>
                                {METRIC_TYPES.map(type => (
                                    <SelectItem key={type.value} value={type.value}>
                                        {type.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                            <SelectTrigger className="w-48">
                                <SelectValue placeholder="Periyot seçin" />
                            </SelectTrigger>
                            <SelectContent>
                                {PERIOD_TYPES.map(type => (
                                    <SelectItem key={type.value} value={type.value}>
                                        {type.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Button onClick={loadTrendData} disabled={loading}>
                            {loading ? 'Yükleniyor...' : 'Yenile'}
                        </Button>
                    </div>

                    {trendData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={400}>
                            <LineChart data={trendData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis 
                                    dataKey="period" 
                                    tickFormatter={(value) => new Date(value).toLocaleDateString('tr-TR')}
                                />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Line 
                                    type="monotone" 
                                    dataKey="value" 
                                    stroke="#8884d8" 
                                    name="Değer"
                                    strokeWidth={2}
                                />
                                <Line 
                                    type="monotone" 
                                    dataKey="moving_avg" 
                                    stroke="#82ca9d" 
                                    name="Hareketli Ortalama"
                                    strokeWidth={2}
                                    strokeDasharray="5 5"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="text-center py-12 text-muted-foreground">
                            {loading ? 'Yükleniyor...' : 'Veri bulunamadı. Lütfen farklı parametreler deneyin.'}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default TrendAnalysis;

