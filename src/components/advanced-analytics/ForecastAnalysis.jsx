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
            // Basit tahmin hesaplama (gerçek uygulamada ML modeli kullanılabilir)
            const { data: historical, error } = await supabase
                .from('quality_trends')
                .select('*')
                .eq('metric_name', selectedMetric)
                .eq('period_type', 'Monthly')
                .order('period_value', { ascending: false })
                .limit(12);

            if (error) throw error;

            if (historical && historical.length > 0) {
                // Basit lineer trend tahmini
                const values = historical.map(h => parseFloat(h.value)).reverse();
                const avgChange = (values[values.length - 1] - values[0]) / (values.length - 1);
                
                const forecast = [];
                let lastValue = values[values.length - 1];
                
                for (let i = 1; i <= forecastPeriods; i++) {
                    const forecastValue = lastValue + (avgChange * i);
                    forecast.push({
                        period: `Tahmin ${i}`,
                        value: Math.max(0, forecastValue),
                        type: 'forecast'
                    });
                }

                setForecastData({
                    historical: historical.map((h, idx) => ({
                        period: new Date(h.period_value).toLocaleDateString('tr-TR', { month: 'short', year: 'numeric' }),
                        value: parseFloat(h.value),
                        type: 'historical'
                    })),
                    forecast
                });
            }
        } catch (error) {
            console.error('Forecast generation error:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Tahmin oluşturulurken hata oluştu.'
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

