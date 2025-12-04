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
            // customer_satisfaction_trends tablosu yoksa, anketlerden hesapla
            const { data: trends, error: trendsError } = await supabase
                .from('customer_satisfaction_trends')
                .select('*')
                .eq('period_type', 'Aylık')
                .order('period_value', { ascending: true })
                .limit(12);

            if (trendsError && (trendsError.code === '42P01' || trendsError.message.includes('does not exist'))) {
                // Tablo yoksa anketlerden hesapla
                const { data: surveys, error: surveysError } = await supabase
                    .from('customer_satisfaction_surveys')
                    .select('survey_date, nps_score, csat_score')
                    .not('nps_score', 'is', null)
                    .order('survey_date', { ascending: true })
                    .limit(100);

                if (surveysError) throw surveysError;

                if (surveys && surveys.length > 0) {
                    // Aylık gruplama
                    const grouped = {};
                    surveys.forEach(survey => {
                        const date = new Date(survey.survey_date);
                        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                        if (!grouped[key]) {
                            grouped[key] = { nps: [], csat: [] };
                        }
                        if (survey.nps_score !== null) grouped[key].nps.push(survey.nps_score);
                        if (survey.csat_score !== null) grouped[key].csat.push(survey.csat_score);
                    });

                    const trendDataArray = Object.keys(grouped).sort().map(key => {
                        const group = grouped[key];
                        const avgNPS = group.nps.length > 0 ? group.nps.reduce((a, b) => a + b, 0) / group.nps.length : 0;
                        const avgCSAT = group.csat.length > 0 ? group.csat.reduce((a, b) => a + b, 0) / group.csat.length : 0;
                        return {
                            period: key,
                            nps: Math.round(avgNPS),
                            csat: Math.round(avgCSAT),
                            overall: Math.round((avgNPS + avgCSAT) / 2)
                        };
                    });

                    setTrendData(trendDataArray);
                } else {
                    setTrendData([]);
                }
            } else if (trendsError) {
                throw trendsError;
            } else {
                setTrendData(trends.map(t => ({
                    period: t.period_value || new Date(t.created_at).toLocaleDateString('tr-TR', { month: 'short' }),
                    nps: t.nps_score || 0,
                    csat: t.csat_score || 0,
                    overall: t.overall_score || 0
                })));
            }
        } catch (error) {
            console.error('Trends loading error:', error);
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

