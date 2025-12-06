import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle, XCircle } from 'lucide-react';

const SPCCapabilityAnalysis = ({ characteristics }) => {
    const { toast } = useToast();
    const [selectedCharacteristic, setSelectedCharacteristic] = useState(null);
    const [measurements, setMeasurements] = useState([]);
    const [capability, setCapability] = useState(null);
    const [loading, setLoading] = useState(false);

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

            if (data && data.length > 0) {
                calculateCapability(data, selectedCharacteristic);
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

    const calculateCapability = (measurements, charId) => {
        const char = characteristics.find(c => c.id === charId);
        if (!char || !char.usl || !char.lsl) {
            toast({
                variant: 'destructive',
                title: 'Eksik Bilgi',
                description: 'Bu karakteristik için USL ve LSL tanımlanmamış. Proses yetenek analizi yapılamaz.'
            });
            return;
        }

        const values = measurements.map(m => parseFloat(m.measurement_value)).filter(v => !isNaN(v));
        if (values.length === 0) return;

        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);

        const usl = parseFloat(char.usl);
        const lsl = parseFloat(char.lsl);
        const tolerance = usl - lsl;

        // Cp (Process Capability Index)
        const cp = tolerance / (6 * stdDev);

        // Cpk (Process Capability Index - Centered)
        const cpu = (usl - mean) / (3 * stdDev);
        const cpl = (mean - lsl) / (3 * stdDev);
        const cpk = Math.min(cpu, cpl);

        // Pp (Process Performance Index)
        const pp = tolerance / (6 * stdDev);

        // Ppk (Process Performance Index - Centered)
        const ppu = (usl - mean) / (3 * stdDev);
        const ppl = (mean - lsl) / (3 * stdDev);
        const ppk = Math.min(ppu, ppl);

        // Sigma Level
        const sigmaLevel = cpk * 3;

        // Defect Rate (PPM)
        const zUpper = (usl - mean) / stdDev;
        const zLower = (lsl - mean) / stdDev;
        const defectRateUpper = (1 - normalCDF(zUpper)) * 1000000;
        const defectRateLower = normalCDF(zLower) * 1000000;
        const totalDefectRate = defectRateUpper + defectRateLower;

        setCapability({
            mean,
            stdDev,
            usl,
            lsl,
            tolerance,
            cp,
            cpk,
            pp,
            ppk,
            sigmaLevel,
            defectRate: totalDefectRate,
            values: values.length
        });
    };

    // Normal CDF approximation
    const normalCDF = (z) => {
        return 0.5 * (1 + erf(z / Math.sqrt(2)));
    };

    const erf = (x) => {
        const a1 = 0.254829592;
        const a2 = -0.284496736;
        const a3 = 1.421413741;
        const a4 = -1.453152027;
        const a5 = 1.061405429;
        const p = 0.3275911;

        const sign = x < 0 ? -1 : 1;
        x = Math.abs(x);

        const t = 1.0 / (1.0 + p * x);
        const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

        return sign * y;
    };

    const getCapabilityStatus = (cpk) => {
        if (cpk >= 1.67) return { label: 'Mükemmel', color: 'success', icon: CheckCircle2 };
        if (cpk >= 1.33) return { label: 'Yeterli', color: 'default', icon: CheckCircle2 };
        if (cpk >= 1.0) return { label: 'Kabul Edilebilir', color: 'warning', icon: AlertCircle };
        return { label: 'Yetersiz', color: 'destructive', icon: XCircle };
    };

    const activeCharacteristics = useMemo(() => {
        return characteristics.filter(c => c.is_active && c.usl && c.lsl);
    }, [characteristics]);

    const selectedChar = useMemo(() => {
        return characteristics.find(c => c.id === selectedCharacteristic);
    }, [characteristics, selectedCharacteristic]);

    if (characteristics.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Proses Yetenek Analizi</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center text-muted-foreground py-12">
                        Önce bir karakteristik tanımlamanız gerekiyor.
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (activeCharacteristics.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Proses Yetenek Analizi</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center text-muted-foreground py-12">
                        Proses yetenek analizi için USL ve LSL tanımlı karakteristikler gereklidir.
                    </div>
                </CardContent>
            </Card>
        );
    }

    const status = capability ? getCapabilityStatus(capability.cpk) : null;

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Proses Yetenek Analizi (Cp, Cpk, Pp, Ppk)</CardTitle>
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
                                    <SelectValue placeholder="USL ve LSL tanımlı karakteristik seçin" />
                                </SelectTrigger>
                                <SelectContent>
                                    {activeCharacteristics.map(char => (
                                        <SelectItem key={char.id} value={char.id}>
                                            {char.characteristic_name} ({char.lsl} - {char.usl} {char.measurement_unit || ''})
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
                            Hesaplanıyor...
                        </div>
                    )}

                    {!loading && selectedCharacteristic && measurements.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground">
                            Bu karakteristik için henüz ölçüm verisi bulunmuyor.
                        </div>
                    )}

                    {!loading && capability && (
                        <div className="space-y-6">
                            {/* Durum */}
                            {status && (
                                <Card>
                                    <CardContent className="pt-6">
                                        <div className="flex items-center gap-3">
                                            <status.icon className={`w-6 h-6 text-${status.color === 'success' ? 'green' : status.color === 'destructive' ? 'red' : 'yellow'}-500`} />
                                            <div>
                                                <div className="font-semibold">Proses Durumu: {status.label}</div>
                                                <div className="text-sm text-muted-foreground">
                                                    {capability.values} ölçüm değeri analiz edildi
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* İstatistikler */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">
                                            Cp (Process Capability)
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">{capability.cp.toFixed(3)}</div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                            {capability.cp >= 1.33 ? 'Yeterli' : capability.cp >= 1.0 ? 'Kabul Edilebilir' : 'Yetersiz'}
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">
                                            Cpk (Centered Capability)
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">{capability.cpk.toFixed(3)}</div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                            {status?.label}
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">
                                            Pp (Process Performance)
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">{capability.pp.toFixed(3)}</div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                            {capability.pp >= 1.33 ? 'Yeterli' : capability.pp >= 1.0 ? 'Kabul Edilebilir' : 'Yetersiz'}
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">
                                            Ppk (Centered Performance)
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">{capability.ppk.toFixed(3)}</div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                            {capability.ppk >= 1.33 ? 'Yeterli' : capability.ppk >= 1.0 ? 'Kabul Edilebilir' : 'Yetersiz'}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Detaylı Bilgiler */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Detaylı İstatistikler</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                        <div>
                                            <div className="text-muted-foreground">Ortalama (Mean)</div>
                                            <div className="font-mono font-semibold">{capability.mean.toFixed(4)}</div>
                                        </div>
                                        <div>
                                            <div className="text-muted-foreground">Standart Sapma (σ)</div>
                                            <div className="font-mono font-semibold">{capability.stdDev.toFixed(4)}</div>
                                        </div>
                                        <div>
                                            <div className="text-muted-foreground">Sigma Seviyesi</div>
                                            <div className="font-mono font-semibold">{capability.sigmaLevel.toFixed(2)}σ</div>
                                        </div>
                                        <div>
                                            <div className="text-muted-foreground">Hata Oranı</div>
                                            <div className="font-mono font-semibold">{capability.defectRate.toFixed(2)} PPM</div>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-4 border-t">
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <div className="text-muted-foreground">USL</div>
                                                <div className="font-mono font-semibold">{capability.usl} {selectedChar?.measurement_unit || ''}</div>
                                            </div>
                                            <div>
                                                <div className="text-muted-foreground">LSL</div>
                                                <div className="font-mono font-semibold">{capability.lsl} {selectedChar?.measurement_unit || ''}</div>
                                            </div>
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

export default SPCCapabilityAnalysis;
