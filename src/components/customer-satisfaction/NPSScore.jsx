import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Progress } from '@/components/ui/progress';

const NPSScore = () => {
    const { toast } = useToast();
    const [npsData, setNpsData] = useState({ promoters: 0, passives: 0, detractors: 0, nps: 0 });

    useEffect(() => {
        loadNPSData();
    }, []);

    const loadNPSData = async () => {
        try {
            const { data, error } = await supabase
                .from('customer_satisfaction_surveys')
                .select('nps_score')
                .not('nps_score', 'is', null)
                .order('survey_date', { ascending: false })
                .limit(100);

            if (error) throw error;

            if (data && data.length > 0) {
                const scores = data.map(s => s.nps_score);
                const avgNPS = scores.reduce((a, b) => a + b, 0) / scores.length;
                
                // Basit hesaplama (gerçek uygulamada daha detaylı olabilir)
                setNpsData({
                    promoters: Math.round(scores.filter(s => s >= 50).length / scores.length * 100),
                    passives: Math.round(scores.filter(s => s >= 0 && s < 50).length / scores.length * 100),
                    detractors: Math.round(scores.filter(s => s < 0).length / scores.length * 100),
                    nps: Math.round(avgNPS)
                });
            }
        } catch (error) {
            console.error('NPS data loading error:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'NPS verileri yüklenirken hata oluştu.'
            });
        }
    };

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Net Promoter Score (NPS)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="text-center">
                        <div className="text-6xl font-bold text-primary">{npsData.nps}</div>
                        <p className="text-muted-foreground mt-2">NPS Skoru</p>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between mb-2">
                                <span>Promoters</span>
                                <span>{npsData.promoters}%</span>
                            </div>
                            <Progress value={npsData.promoters} className="h-2" />
                        </div>
                        <div>
                            <div className="flex justify-between mb-2">
                                <span>Passives</span>
                                <span>{npsData.passives}%</span>
                            </div>
                            <Progress value={npsData.passives} className="h-2" />
                        </div>
                        <div>
                            <div className="flex justify-between mb-2">
                                <span>Detractors</span>
                                <span>{npsData.detractors}%</span>
                            </div>
                            <Progress value={npsData.detractors} className="h-2" />
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default NPSScore;

