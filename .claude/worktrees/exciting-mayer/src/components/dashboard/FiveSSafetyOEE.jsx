import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { supabase } from '@/lib/customSupabaseClient';
import { Factory, Shield, Settings, TrendingUp } from 'lucide-react';
import { format, startOfMonth } from 'date-fns';
import { tr } from 'date-fns/locale';

const FiveSSafetyOEE = () => {
    const [fiveSScores, setFiveSScores] = useState([]);
    const [safetyScores, setSafetyScores] = useState([]);
    const [oeeScores, setOeeScores] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Bu tablolar henüz oluşturulmamış olabilir, sessizce devam et
            // Gelecekte bu tablolar oluşturulduğunda veriler görünecek
            console.warn('5S, Güvenlik ve OEE tabloları henüz oluşturulmamış');
            setFiveSScores([]);
            setSafetyScores([]);
            setOeeScores([]);
        } catch (error) {
            console.warn('Veriler yüklenemedi:', error.message);
            setFiveSScores([]);
            setSafetyScores([]);
            setOeeScores([]);
        } finally {
            setLoading(false);
        }
    };

    const latest5S = useMemo(() => {
        if (fiveSScores.length === 0) return null;
        return fiveSScores[0];
    }, [fiveSScores]);

    const avgSafetyScore = useMemo(() => {
        if (safetyScores.length === 0) return null;
        const total = safetyScores.reduce((sum, s) => sum + (s.safety_score || 0), 0);
        return total / safetyScores.length;
    }, [safetyScores]);

    const avgOEE = useMemo(() => {
        if (oeeScores.length === 0) return null;
        const total = oeeScores.reduce((sum, o) => sum + (o.oee_score || 0), 0);
        return total / oeeScores.length;
    }, [oeeScores]);

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>5S - İş Güvenliği - OEE</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8 text-muted-foreground">Yükleniyor...</div>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 5S Skorları */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Factory className="h-5 w-5 text-blue-500" />
                        5S Skorları
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {latest5S ? (
                        <div className="space-y-4">
                            <div className="text-center">
                                <div className="text-4xl font-bold text-blue-600 mb-2">
                                    {latest5S.total_score.toFixed(1)}
                                </div>
                                <p className="text-sm text-muted-foreground">Toplam Skor</p>
                                <Progress value={latest5S.total_score} className="mt-2" />
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <p className="text-muted-foreground">Seiri (Ayıklama)</p>
                                    <p className="font-semibold">{latest5S.score_sort}/100</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Seiton (Düzenleme)</p>
                                    <p className="font-semibold">{latest5S.score_set_in_order}/100</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Seiso (Temizlik)</p>
                                    <p className="font-semibold">{latest5S.score_shine}/100</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Seiketsu (Standartlaştırma)</p>
                                    <p className="font-semibold">{latest5S.score_standardize}/100</p>
                                </div>
                                <div className="col-span-2">
                                    <p className="text-muted-foreground">Shitsuke (Sürdürme)</p>
                                    <p className="font-semibold">{latest5S.score_sustain}/100</p>
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground text-center">
                                Değerlendirme: {format(new Date(latest5S.assessment_date), 'dd MMM yyyy', { locale: tr })}
                            </p>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            <Factory className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>5S skoru bulunamadı.</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* İş Güvenliği Skorları */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-green-500" />
                        İş Güvenliği Skorları
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {avgSafetyScore !== null ? (
                        <div className="space-y-4">
                            <div className="text-center">
                                <div className="text-4xl font-bold text-green-600 mb-2">
                                    {avgSafetyScore.toFixed(1)}
                                </div>
                                <p className="text-sm text-muted-foreground">Ortalama Güvenlik Skoru</p>
                                <Progress value={avgSafetyScore} className="mt-2" />
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <p className="text-muted-foreground">Toplam Kaza</p>
                                    <p className="font-semibold text-red-600">
                                        {safetyScores.reduce((sum, s) => sum + (s.accident_count || 0), 0)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Ramak Kala</p>
                                    <p className="font-semibold text-orange-600">
                                        {safetyScores.reduce((sum, s) => sum + (s.near_miss_count || 0), 0)}
                                    </p>
                                </div>
                                <div className="col-span-2">
                                    <p className="text-muted-foreground">Eğitim Saati</p>
                                    <p className="font-semibold">
                                        {safetyScores.reduce((sum, s) => sum + (s.safety_training_hours || 0), 0).toFixed(1)} saat
                                    </p>
                                </div>
                            </div>
                            {safetyScores.length > 0 && (
                                <ResponsiveContainer width="100%" height={150}>
                                    <BarChart data={safetyScores}>
                                        <XAxis dataKey="department_name" tick={{ fontSize: 10 }} />
                                        <YAxis tick={{ fontSize: 10 }} />
                                        <Tooltip />
                                        <Bar dataKey="safety_score" radius={[4, 4, 0, 0]}>
                                            {safetyScores.map((entry, index) => (
                                                <Cell 
                                                    key={`cell-${index}`} 
                                                    fill={entry.safety_score >= 90 ? '#22c55e' :
                                                          entry.safety_score >= 75 ? '#eab308' :
                                                          '#ef4444'}
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>İş güvenliği skoru bulunamadı.</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* OEE Skorları */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Settings className="h-5 w-5 text-purple-500" />
                        OEE (Overall Equipment Effectiveness)
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {avgOEE !== null ? (
                        <div className="space-y-4">
                            <div className="text-center">
                                <div className="text-4xl font-bold text-purple-600 mb-2">
                                    {(avgOEE * 100).toFixed(1)}%
                                </div>
                                <p className="text-sm text-muted-foreground">Ortalama OEE</p>
                                <Progress value={avgOEE * 100} className="mt-2" />
                            </div>
                            {oeeScores.length > 0 && (
                                <>
                                    <div className="grid grid-cols-3 gap-2 text-xs">
                                        <div>
                                            <p className="text-muted-foreground">Kullanılabilirlik</p>
                                            <p className="font-semibold">
                                                {(oeeScores.reduce((sum, o) => sum + (o.availability || 0), 0) / oeeScores.length).toFixed(1)}%
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Performans</p>
                                            <p className="font-semibold">
                                                {(oeeScores.reduce((sum, o) => sum + (o.performance || 0), 0) / oeeScores.length).toFixed(1)}%
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Kalite</p>
                                            <p className="font-semibold">
                                                {(oeeScores.reduce((sum, o) => sum + (o.quality || 0), 0) / oeeScores.length).toFixed(1)}%
                                            </p>
                                        </div>
                                    </div>
                                    <ResponsiveContainer width="100%" height={150}>
                                        <BarChart data={oeeScores.slice(0, 5)}>
                                            <XAxis dataKey="equipment_name" tick={{ fontSize: 10 }} />
                                            <YAxis tick={{ fontSize: 10 }} />
                                            <Tooltip formatter={(value) => `${(value * 100).toFixed(1)}%`} />
                                            <Bar dataKey="oee_score" radius={[4, 4, 0, 0]}>
                                                {oeeScores.slice(0, 5).map((entry, index) => (
                                                    <Cell 
                                                        key={`cell-${index}`} 
                                                        fill={entry.oee_score >= 0.85 ? '#22c55e' :
                                                              entry.oee_score >= 0.70 ? '#eab308' :
                                                              '#ef4444'}
                                                    />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>OEE skoru bulunamadı.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default FiveSSafetyOEE;

