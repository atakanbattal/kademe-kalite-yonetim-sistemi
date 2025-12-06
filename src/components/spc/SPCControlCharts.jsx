import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Bar } from 'recharts';
import { AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const SPCControlCharts = ({ characteristics }) => {
    const { toast } = useToast();
    const [selectedCharacteristic, setSelectedCharacteristic] = useState(null);
    const [measurements, setMeasurements] = useState([]);
    const [controlLimits, setControlLimits] = useState(null);
    const [loading, setLoading] = useState(false);
    const [chartData, setChartData] = useState([]);

    useEffect(() => {
        if (selectedCharacteristic && characteristics.length > 0) {
            loadMeasurements();
        }
    }, [selectedCharacteristic]);

    const loadMeasurements = async () => {
        if (!selectedCharacteristic) return;

        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('spc_measurements')
                .select('*')
                .eq('characteristic_id', selectedCharacteristic)
                .order('measurement_date', { ascending: true })
                .limit(100);

            if (error) {
                if (error.code === '42P01' || error.message.includes('does not exist')) {
                    toast({
                        variant: 'destructive',
                        title: 'Tablo Bulunamadı',
                        description: 'spc_measurements tablosu henüz oluşturulmamış. Lütfen Supabase SQL Editor\'de create-spc-module.sql script\'ini çalıştırın.'
                    });
                    setMeasurements([]);
                    return;
                }
                throw error;
            }

            setMeasurements(data || []);

            // Kontrol limitlerini hesapla
            if (data && data.length > 0) {
                calculateControlLimits(data, selectedCharacteristic);
            }
        } catch (error) {
            console.error('Measurements loading error:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Ölçüm verileri yüklenirken hata oluştu.'
            });
        } finally {
            setLoading(false);
        }
    };

    const calculateControlLimits = async (measurements, charId) => {
        const char = characteristics.find(c => c.id === charId);
        if (!char) return;

        try {
            // Subgroup'lara göre verileri grupla
            const subgroups = {};
            measurements.forEach(m => {
                const subgroup = m.subgroup_number || Math.floor(measurements.indexOf(m) / (char.sample_size || 5));
                if (!subgroups[subgroup]) {
                    subgroups[subgroup] = [];
                }
                subgroups[subgroup].push(m.measurement_value);
            });

            // X-bar ve R hesapla
            const xbarValues = [];
            const rValues = [];

            Object.keys(subgroups).forEach(subgroup => {
                const values = subgroups[subgroup];
                const xbar = values.reduce((a, b) => a + b, 0) / values.length;
                const r = Math.max(...values) - Math.min(...values);
                xbarValues.push(xbar);
                rValues.push(r);
            });

            if (xbarValues.length === 0) return;

            const meanXbar = xbarValues.reduce((a, b) => a + b, 0) / xbarValues.length;
            const meanR = rValues.reduce((a, b) => a + b, 0) / rValues.length;

            // A2, D3, D4 faktörleri (subgroup size = 5 için)
            const sampleSize = char.sample_size || 5;
            let a2 = 0.577, d3 = 0, d4 = 2.114;
            
            if (sampleSize === 4) {
                a2 = 0.729; d3 = 0; d4 = 2.282;
            } else if (sampleSize === 3) {
                a2 = 1.023; d3 = 0; d4 = 2.574;
            }

            const limits = {
                xbar: {
                    ucl: meanXbar + (a2 * meanR),
                    cl: meanXbar,
                    lcl: meanXbar - (a2 * meanR)
                },
                r: {
                    ucl: d4 * meanR,
                    cl: meanR,
                    lcl: d3 * meanR
                }
            };

            setControlLimits(limits);

            // Grafik verilerini hazırla
            const chartDataPoints = Object.keys(subgroups).map((subgroup, index) => ({
                subgroup: parseInt(subgroup) || index + 1,
                xbar: xbarValues[index],
                r: rValues[index],
                ucl_xbar: limits.xbar.ucl,
                cl_xbar: limits.xbar.cl,
                lcl_xbar: limits.xbar.lcl,
                ucl_r: limits.r.ucl,
                cl_r: limits.r.cl,
                lcl_r: limits.r.lcl
            }));

            setChartData(chartDataPoints);
        } catch (error) {
            console.error('Control limits calculation error:', error);
        }
    };

    const activeCharacteristics = useMemo(() => {
        return characteristics.filter(c => c.is_active);
    }, [characteristics]);

    const selectedChar = useMemo(() => {
        return characteristics.find(c => c.id === selectedCharacteristic);
    }, [characteristics, selectedCharacteristic]);

    if (characteristics.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Kontrol Grafikleri</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center text-muted-foreground py-12">
                        Önce bir karakteristik tanımlamanız gerekiyor.
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Kontrol Grafikleri</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                        <div className="flex-1">
                            <Label>Karakteristik Seçin</Label>
                            <Select
                                value={selectedCharacteristic || ''}
                                onValueChange={setSelectedCharacteristic}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Karakteristik seçin" />
                                </SelectTrigger>
                                <SelectContent>
                                    {activeCharacteristics.map(char => (
                                        <SelectItem key={char.id} value={char.id}>
                                            {char.characteristic_name} ({char.chart_type})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {selectedCharacteristic && (
                            <Button onClick={loadMeasurements} variant="outline">
                                Yenile
                            </Button>
                        )}
                    </div>

                    {loading && (
                        <div className="text-center py-12 text-muted-foreground">
                            Yükleniyor...
                        </div>
                    )}

                    {!loading && selectedCharacteristic && measurements.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground">
                            Bu karakteristik için henüz ölçüm verisi bulunmuyor.
                            <br />
                            Ölçüm verileri eklendiğinde kontrol grafikleri otomatik olarak oluşturulacaktır.
                        </div>
                    )}

                    {!loading && chartData.length > 0 && controlLimits && selectedChar && (
                        <div className="space-y-6">
                            {/* X-bar Grafiği */}
                            <div>
                                <h3 className="text-lg font-semibold mb-2">
                                    X-bar Kontrol Grafiği ({selectedChar.chart_type})
                                </h3>
                                <ResponsiveContainer width="100%" height={300}>
                                    <ComposedChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="subgroup" label={{ value: 'Subgroup', position: 'insideBottom', offset: -5 }} />
                                        <YAxis label={{ value: 'X-bar', angle: -90, position: 'insideLeft' }} />
                                        <Tooltip />
                                        <Legend />
                                        <Line type="monotone" dataKey="xbar" stroke="#2563eb" strokeWidth={2} name="X-bar" />
                                        <Line type="monotone" dataKey="ucl_xbar" stroke="#ef4444" strokeDasharray="5 5" name="UCL" />
                                        <Line type="monotone" dataKey="cl_xbar" stroke="#10b981" strokeDasharray="5 5" name="CL" />
                                        <Line type="monotone" dataKey="lcl_xbar" stroke="#ef4444" strokeDasharray="5 5" name="LCL" />
                                    </ComposedChart>
                                </ResponsiveContainer>
                                <div className="mt-2 flex gap-4 text-sm">
                                    <div>UCL: <span className="font-mono">{controlLimits.xbar.ucl.toFixed(4)}</span></div>
                                    <div>CL: <span className="font-mono">{controlLimits.xbar.cl.toFixed(4)}</span></div>
                                    <div>LCL: <span className="font-mono">{controlLimits.xbar.lcl.toFixed(4)}</span></div>
                                </div>
                            </div>

                            {/* R Grafiği */}
                            {selectedChar.chart_type === 'XbarR' && (
                                <div>
                                    <h3 className="text-lg font-semibold mb-2">R Kontrol Grafiği</h3>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <ComposedChart data={chartData}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="subgroup" label={{ value: 'Subgroup', position: 'insideBottom', offset: -5 }} />
                                            <YAxis label={{ value: 'Range', angle: -90, position: 'insideLeft' }} />
                                            <Tooltip />
                                            <Legend />
                                            <Line type="monotone" dataKey="r" stroke="#2563eb" strokeWidth={2} name="R" />
                                            <Line type="monotone" dataKey="ucl_r" stroke="#ef4444" strokeDasharray="5 5" name="UCL" />
                                            <Line type="monotone" dataKey="cl_r" stroke="#10b981" strokeDasharray="5 5" name="CL" />
                                            <Line type="monotone" dataKey="lcl_r" stroke="#ef4444" strokeDasharray="5 5" name="LCL" />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                    <div className="mt-2 flex gap-4 text-sm">
                                        <div>UCL: <span className="font-mono">{controlLimits.r.ucl.toFixed(4)}</span></div>
                                        <div>CL: <span className="font-mono">{controlLimits.r.cl.toFixed(4)}</span></div>
                                        <div>LCL: <span className="font-mono">{controlLimits.r.lcl.toFixed(4)}</span></div>
                                    </div>
                                </div>
                            )}

                            {/* Durum Bilgisi */}
                            <Card>
                                <CardContent className="pt-6">
                                    <div className="flex items-center gap-2">
                                        <AlertCircle className="w-5 h-5 text-blue-500" />
                                        <div>
                                            <p className="text-sm text-muted-foreground">
                                                Kontrol grafikleri {selectedChar.chart_type} tipinde hesaplanmıştır.
                                                {selectedChar.usl && selectedChar.lsl && (
                                                    <> Spesifikasyon limitleri: {selectedChar.lsl} - {selectedChar.usl} {selectedChar.measurement_unit || ''}</>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default SPCControlCharts;
