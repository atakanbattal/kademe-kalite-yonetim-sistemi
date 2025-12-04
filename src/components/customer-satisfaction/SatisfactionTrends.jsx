import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const SatisfactionTrends = () => {
    const { toast } = useToast();
    const [trendData, setTrendData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadTrends();
    }, []);

    const loadTrends = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('customer_satisfaction_trends')
                .select('*')
                .eq('period_type', 'Monthly')
                .order('period_value', { ascending: true })
                .limit(12);

            if (error) throw error;
            
            setTrendData(data.map(t => ({
                period: new Date(t.period_value).toLocaleDateString('tr-TR', { month: 'short' }),
                nps: t.nps_score || 0,
                csat: t.csat_score || 0,
                overall: t.overall_score || 0
            })));
        } catch (error) {
            console.error('Trends loading error:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Trend verileri yüklenirken hata oluştu.'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Müşteri Memnuniyet Trendleri</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-12 text-muted-foreground">
                            Yükleniyor...
                        </div>
                    ) : trendData.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            Trend verisi bulunamadı.
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={400}>
                            <LineChart data={trendData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="period" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Line type="monotone" dataKey="nps" stroke="#8884d8" name="NPS" />
                                <Line type="monotone" dataKey="csat" stroke="#82ca9d" name="CSAT" />
                                <Line type="monotone" dataKey="overall" stroke="#ffc658" name="Genel" />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default SatisfactionTrends;

