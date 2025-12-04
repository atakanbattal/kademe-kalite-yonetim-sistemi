import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

const SPCCapabilityAnalysis = ({ characteristics }) => {
    const { toast } = useToast();
    const [selectedCharacteristic, setSelectedCharacteristic] = useState(null);
    const [capabilityData, setCapabilityData] = useState(null);
    const [loading, setLoading] = useState(false);

    const loadCapabilityData = useCallback(async (charId) => {
        if (!charId) return;

        setLoading(true);
        try {
            const { data, error } = await supabase
                .rpc('calculate_capability_indices', {
                    p_characteristic_id: charId
                });

            if (error) {
                if (error.code === '42883' || error.message.includes('does not exist') || error.message.includes('function')) {
                    toast({
                        variant: 'default',
                        title: 'Fonksiyon Bulunamadı',
                        description: 'calculate_capability_indices fonksiyonu henüz oluşturulmamış. Lütfen Supabase SQL Editor\'de create-spc-module.sql script\'ini çalıştırın.'
                    });
                    setCapabilityData(null);
                    return;
                }
                throw error;
            }
            setCapabilityData(data?.[0] || null);
        } catch (error) {
            console.error('Capability data loading error:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Yetenek analizi verileri yüklenirken hata oluştu: ' + (error.message || 'Bilinmeyen hata')
            });
            setCapabilityData(null);
        } finally {
            setLoading(false);
        }
    }, [toast]);

    React.useEffect(() => {
        if (selectedCharacteristic) {
            loadCapabilityData(selectedCharacteristic);
        }
    }, [selectedCharacteristic, loadCapabilityData]);

    const activeCharacteristics = characteristics.filter(c => c.is_active && c.usl && c.lsl);

    const getCapabilityStatus = (cpk) => {
        if (!cpk) return { status: 'unknown', label: 'Bilinmiyor', color: 'secondary' };
        if (cpk >= 1.67) return { status: 'excellent', label: 'Mükemmel', color: 'success' };
        if (cpk >= 1.33) return { status: 'adequate', label: 'Yeterli', color: 'default' };
        if (cpk >= 1.0) return { status: 'marginal', label: 'Sınırda', color: 'warning' };
        return { status: 'inadequate', label: 'Yetersiz', color: 'destructive' };
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Proses Yetenek Analizi</CardTitle>
                <CardDescription>
                    Cp, Cpk, Pp, Ppk hesaplamaları ve sigma seviyesi
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex gap-4">
                    <Select value={selectedCharacteristic || ''} onValueChange={setSelectedCharacteristic}>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Karakteristik seçin..." />
                        </SelectTrigger>
                        <SelectContent>
                            {activeCharacteristics.map(char => (
                                <SelectItem key={char.id} value={char.id}>
                                    {char.characteristic_name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {selectedCharacteristic && (
                        <Button onClick={() => loadCapabilityData(selectedCharacteristic)}>
                            Hesapla
                        </Button>
                    )}
                </div>

                {loading ? (
                    <div className="text-center py-12 text-muted-foreground">
                        Hesaplanıyor...
                    </div>
                ) : !capabilityData ? (
                    <div className="text-center py-12 text-muted-foreground">
                        {selectedCharacteristic 
                            ? 'Yetenek analizi için yeterli veri bulunamadı.'
                            : 'Lütfen bir karakteristik seçin.'}
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Yetenek İndeksleri */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">
                                        Cp (Process Capability)
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">
                                        {capabilityData.cp?.toFixed(3) || 'N/A'}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Cp ≥ 1.33 ise yeterli
                                    </p>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">
                                        Cpk (Centered Capability)
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">
                                        {capabilityData.cpk?.toFixed(3) || 'N/A'}
                                    </div>
                                    {capabilityData.cpk && (
                                        <Badge 
                                            variant={getCapabilityStatus(capabilityData.cpk).color}
                                            className="mt-1"
                                        >
                                            {getCapabilityStatus(capabilityData.cpk).label}
                                        </Badge>
                                    )}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">
                                        Pp (Process Performance)
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">
                                        {capabilityData.pp?.toFixed(3) || 'N/A'}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Pp ≥ 1.33 ise yeterli
                                    </p>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">
                                        Ppk (Centered Performance)
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">
                                        {capabilityData.ppk?.toFixed(3) || 'N/A'}
                                    </div>
                                    {capabilityData.ppk && (
                                        <Badge 
                                            variant={getCapabilityStatus(capabilityData.ppk).color}
                                            className="mt-1"
                                        >
                                            {getCapabilityStatus(capabilityData.ppk).label}
                                        </Badge>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {/* İstatistikler */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">
                                        Ortalama (Mean)
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-xl font-bold">
                                        {capabilityData.mean_val?.toFixed(4) || 'N/A'}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">
                                        Standart Sapma (σ)
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-xl font-bold">
                                        {capabilityData.std_deviation?.toFixed(4) || 'N/A'}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">
                                        Sigma Seviyesi
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-xl font-bold">
                                        {capabilityData.sigma_level?.toFixed(2) || 'N/A'}σ
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {capabilityData.sigma_level >= 6 ? 'Mükemmel' :
                                         capabilityData.sigma_level >= 4 ? 'İyi' :
                                         capabilityData.sigma_level >= 3 ? 'Orta' : 'Düşük'}
                                    </p>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Öneriler */}
                        {capabilityData.cpk && (
                            <Card className={getCapabilityStatus(capabilityData.cpk).status === 'inadequate' ? 'border-red-500' : ''}>
                                <CardHeader>
                                    <CardTitle className="text-base">Değerlendirme ve Öneriler</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {getCapabilityStatus(capabilityData.cpk).status === 'excellent' && (
                                        <div className="flex items-start gap-2 text-green-700">
                                            <CheckCircle2 className="w-5 h-5 mt-0.5" />
                                            <div>
                                                <p className="font-semibold">Proses mükemmel durumda!</p>
                                                <p className="text-sm mt-1">Cpk ≥ 1.67, proses çok iyi kontrol altında.</p>
                                            </div>
                                        </div>
                                    )}
                                    {getCapabilityStatus(capabilityData.cpk).status === 'adequate' && (
                                        <div className="flex items-start gap-2 text-blue-700">
                                            <CheckCircle2 className="w-5 h-5 mt-0.5" />
                                            <div>
                                                <p className="font-semibold">Proses yeterli durumda.</p>
                                                <p className="text-sm mt-1">Cpk ≥ 1.33, proses kontrol altında ancak iyileştirme fırsatları var.</p>
                                            </div>
                                        </div>
                                    )}
                                    {getCapabilityStatus(capabilityData.cpk).status === 'marginal' && (
                                        <div className="flex items-start gap-2 text-yellow-700">
                                            <AlertTriangle className="w-5 h-5 mt-0.5" />
                                            <div>
                                                <p className="font-semibold">Proses sınırda!</p>
                                                <p className="text-sm mt-1">Cpk &lt; 1.33, proses kontrol altında değil. Acil iyileştirme gerekli.</p>
                                            </div>
                                        </div>
                                    )}
                                    {getCapabilityStatus(capabilityData.cpk).status === 'inadequate' && (
                                        <div className="flex items-start gap-2 text-red-700">
                                            <XCircle className="w-5 h-5 mt-0.5" />
                                            <div>
                                                <p className="font-semibold">Proses yetersiz!</p>
                                                <p className="text-sm mt-1">Cpk &lt; 1.0, proses kontrol altında değil. Kritik iyileştirme gerekli.</p>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default SPCCapabilityAnalysis;
