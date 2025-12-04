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
            const { data, error } = await supabase
                .rpc('calculate_trend_analysis', {
                    p_metric_name: selectedMetric,
                    p_period_type: selectedPeriod,
                    p_periods: 12
                });

            if (error) throw error;
            
            if (data && data.trend_data) {
                setTrendData(data.trend_data);
            } else {
                setTrendData([]);
            }
        } catch (error) {
            console.error('Trend data loading error:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Trend verileri yüklenirken hata oluştu.'
            });
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

