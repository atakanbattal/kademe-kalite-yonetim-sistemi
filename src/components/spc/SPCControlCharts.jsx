import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid, ReferenceLine } from 'recharts';
import { AlertCircle } from 'lucide-react';

const SPCControlCharts = ({ characteristics }) => {
    const { toast } = useToast();
    const [selectedCharacteristic, setSelectedCharacteristic] = useState(null);
    const [chartData, setChartData] = useState([]);
    const [controlLimits, setControlLimits] = useState(null);
    const [loading, setLoading] = useState(false);

    const loadChartData = useCallback(async (charId) => {
        if (!charId) return;

        setLoading(true);
        try {
            // Ölçüm verilerini çek
            const { data: measurements, error: measError } = await supabase
                .from('spc_measurements')
                .select('*')
                .eq('characteristic_id', charId)
                .order('measurement_date', { ascending: true })
                .limit(100);

            if (measError) throw measError;

            // Kontrol limitlerini hesapla (RPC fonksiyonu kullanılabilir)
            const { data: limits, error: limitsError } = await supabase
                .rpc('calculate_xbar_r_limits', {
                    p_characteristic_id: charId,
                    p_subgroup_size: 5
                });

            if (limitsError) {
                console.warn('Control limits calculation error:', limitsError);
            }

            // Veriyi grafik formatına dönüştür
            const chartDataFormatted = measurements?.map((m, idx) => ({
                index: idx + 1,
                value: parseFloat(m.measurement_value),
                date: new Date(m.measurement_date).toLocaleDateString('tr-TR'),
                isOutOfControl: m.is_out_of_control,
                isOutOfSpec: m.is_out_of_spec
            })) || [];

            setChartData(chartDataFormatted);
            setControlLimits(limits?.[0] || null);
        } catch (error) {
            console.error('Chart data loading error:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Grafik verileri yüklenirken hata oluştu.'
            });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    React.useEffect(() => {
        if (selectedCharacteristic) {
            loadChartData(selectedCharacteristic);
        }
    }, [selectedCharacteristic, loadChartData]);

    const activeCharacteristics = characteristics.filter(c => c.is_active);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Kontrol Grafikleri</CardTitle>
                <CardDescription>
                    X-bar, R, p, np, c, u ve I-MR grafikleri
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
                                    {char.characteristic_name} ({char.chart_type})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {selectedCharacteristic && (
                        <Button onClick={() => loadChartData(selectedCharacteristic)}>
                            Yenile
                        </Button>
                    )}
                </div>

                {loading ? (
                    <div className="text-center py-12 text-muted-foreground">
                        Yükleniyor...
                    </div>
                ) : chartData.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                        {selectedCharacteristic 
                            ? 'Bu karakteristik için ölçüm verisi bulunamadı.'
                            : 'Lütfen bir karakteristik seçin.'}
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* X-bar Grafiği */}
                        {controlLimits && (
                            <div>
                                <h4 className="font-semibold mb-4">X-bar Kontrol Grafiği</h4>
                                <ResponsiveContainer width="100%" height={300}>
                                    <LineChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="index" />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        <ReferenceLine y={controlLimits.ucl_xbar} stroke="red" strokeDasharray="5 5" label="UCL" />
                                        <ReferenceLine y={controlLimits.cl_xbar} stroke="blue" label="CL" />
                                        <ReferenceLine y={controlLimits.lcl_xbar} stroke="red" strokeDasharray="5 5" label="LCL" />
                                        <Line 
                                            type="monotone" 
                                            dataKey="value" 
                                            stroke="#8884d8" 
                                            strokeWidth={2}
                                            dot={{ r: 4 }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                                <div className="mt-2 text-sm text-muted-foreground">
                                    UCL: {controlLimits.ucl_xbar?.toFixed(4)} | 
                                    CL: {controlLimits.cl_xbar?.toFixed(4)} | 
                                    LCL: {controlLimits.lcl_xbar?.toFixed(4)}
                                </div>
                            </div>
                        )}

                        {/* R Grafiği */}
                        {controlLimits && (
                            <div>
                                <h4 className="font-semibold mb-4">R Kontrol Grafiği</h4>
                                <ResponsiveContainer width="100%" height={300}>
                                    <LineChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="index" />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        <ReferenceLine y={controlLimits.ucl_r} stroke="red" strokeDasharray="5 5" label="UCL" />
                                        <ReferenceLine y={controlLimits.cl_r} stroke="blue" label="CL" />
                                        <ReferenceLine y={controlLimits.lcl_r} stroke="red" strokeDasharray="5 5" label="LCL" />
                                        <Line 
                                            type="monotone" 
                                            dataKey="value" 
                                            stroke="#82ca9d" 
                                            strokeWidth={2}
                                            dot={{ r: 4 }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                                <div className="mt-2 text-sm text-muted-foreground">
                                    UCL: {controlLimits.ucl_r?.toFixed(4)} | 
                                    CL: {controlLimits.cl_r?.toFixed(4)} | 
                                    LCL: {controlLimits.lcl_r?.toFixed(4)}
                                </div>
                            </div>
                        )}

                        {/* Uyarılar */}
                        {chartData.some(d => d.isOutOfControl || d.isOutOfSpec) && (
                            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <div className="flex items-center gap-2 text-yellow-800">
                                    <AlertCircle className="w-5 h-5" />
                                    <span className="font-semibold">Uyarı:</span>
                                </div>
                                <ul className="mt-2 text-sm text-yellow-700 list-disc list-inside">
                                    {chartData.filter(d => d.isOutOfControl).length > 0 && (
                                        <li>Kontrol limitleri dışında {chartData.filter(d => d.isOutOfControl).length} nokta bulunuyor.</li>
                                    )}
                                    {chartData.filter(d => d.isOutOfSpec).length > 0 && (
                                        <li>Spesifikasyon limitleri dışında {chartData.filter(d => d.isOutOfSpec).length} nokta bulunuyor.</li>
                                    )}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default SPCControlCharts;
