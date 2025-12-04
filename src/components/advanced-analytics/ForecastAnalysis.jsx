import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';

const ForecastAnalysis = () => {
    const { toast } = useToast();
    const [selectedMetric, setSelectedMetric] = useState('PPM');
    const [forecastPeriods, setForecastPeriods] = useState(6);
    const [forecastData, setForecastData] = useState(null);
    const [loading, setLoading] = useState(false);

    const generateForecast = async () => {
        setLoading(true);
        try {
            // Mevcut verilerden tahmin oluştur
            let historicalData = [];
            const now = new Date();
            const startDate = new Date();
            startDate.setMonth(startDate.getMonth() - 12);

            if (selectedMetric === 'PPM') {
                const { data: inspections, error } = await supabase
                    .from('incoming_inspections')
                    .select('inspection_date, quantity_received, quantity_rejected')
                    .gte('inspection_date', startDate.toISOString().split('T')[0])
                    .order('inspection_date', { ascending: true });

                if (error) throw error;

                const grouped = {};
                inspections?.forEach(ins => {
                    const date = new Date(ins.inspection_date);
                    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    if (!grouped[key]) {
                        grouped[key] = { total: 0, rejected: 0 };
                    }
                    grouped[key].total += ins.quantity_received || 0;
                    grouped[key].rejected += ins.quantity_rejected || 0;
                });

                historicalData = Object.keys(grouped).sort().map(key => {
                    const ppm = grouped[key].total > 0 
                        ? (grouped[key].rejected / grouped[key].total) * 1000000 
                        : 0;
                    return { period: key, value: Math.round(ppm) };
                });
            } else if (selectedMetric === 'NC Count') {
                const { data: ncs, error } = await supabase
                    .from('non_conformities')
                    .select('created_at')
                    .gte('created_at', startDate.toISOString())
                    .order('created_at', { ascending: true });

                if (error) throw error;

                const grouped = {};
                ncs?.forEach(nc => {
                    const date = new Date(nc.created_at);
                    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    grouped[key] = (grouped[key] || 0) + 1;
                });

                historicalData = Object.keys(grouped).sort().map(key => ({
                    period: key,
                    value: grouped[key]
                }));
            } else if (selectedMetric === 'Cost') {
                const { data: costs, error } = await supabase
                    .from('quality_costs')
                    .select('cost_date, amount')
                    .gte('cost_date', startDate.toISOString().split('T')[0])
                    .order('cost_date', { ascending: true });

                if (error) throw error;

                const grouped = {};
                costs?.forEach(cost => {
                    const date = new Date(cost.cost_date);
                    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    grouped[key] = (grouped[key] || 0) + (parseFloat(cost.amount) || 0);
                });

                historicalData = Object.keys(grouped).sort().map(key => ({
                    period: key,
                    value: Math.round(grouped[key])
                }));
            }

            if (historicalData.length > 0) {
                // Basit lineer trend tahmini
                const values = historicalData.map(h => h.value);
                const avgChange = values.length > 1 ? (values[values.length - 1] - values[0]) / (values.length - 1) : 0;
                
                const forecast = [];
                let lastValue = values[values.length - 1];
                
                for (let i = 1; i <= forecastPeriods; i++) {
                    const forecastValue = lastValue + (avgChange * i);
                    const nextMonth = new Date();
                    nextMonth.setMonth(nextMonth.getMonth() + i);
                    forecast.push({
                        period: `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`,
                        value: Math.max(0, Math.round(forecastValue)),
                        type: 'forecast'
                    });
                }

                setForecastData({
                    historical: historicalData.map(h => ({
                        period: h.period,
                        value: h.value,
                        type: 'historical'
                    })),
                    forecast
                });
            } else {
                toast({
                    variant: 'default',
                    title: 'Bilgi',
                    description: 'Tahmin için yeterli veri bulunamadı.'
                });
            }
        } catch (error) {
            console.error('Forecast generation error:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Tahmin oluşturulurken hata oluştu: ' + (error.message || 'Bilinmeyen hata')
            });
        } finally {
            setLoading(false);
        }
    };

    const combinedData = forecastData ? [...forecastData.historical, ...forecastData.forecast] : [];

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Tahmin Analizi</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-4 items-end">
                        <div className="flex-1">
                            <Label>Metrik</Label>
                            <Select value={selectedMetric} onValueChange={setSelectedMetric}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="PPM">PPM</SelectItem>
                                    <SelectItem value="NC Count">Uygunsuzluk Sayısı</SelectItem>
                                    <SelectItem value="Cost">Kalitesizlik Maliyeti</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Tahmin Periyodu</Label>
                            <Input
                                type="number"
                                value={forecastPeriods}
                                onChange={(e) => setForecastPeriods(parseInt(e.target.value) || 6)}
                                min={1}
                                max={24}
                            />
                        </div>
                        <Button onClick={generateForecast} disabled={loading}>
                            {loading ? 'Hesaplanıyor...' : 'Tahmin Oluştur'}
                        </Button>
                    </div>

                    {combinedData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={400}>
                            <AreaChart data={combinedData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="period" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Area 
                                    type="monotone" 
                                    dataKey="value" 
                                    stroke="#8884d8" 
                                    fill="#8884d8"
                                    name="Değer"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="text-center py-12 text-muted-foreground">
                            Tahmin oluşturmak için "Tahmin Oluştur" butonuna tıklayın.
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default ForecastAnalysis;

