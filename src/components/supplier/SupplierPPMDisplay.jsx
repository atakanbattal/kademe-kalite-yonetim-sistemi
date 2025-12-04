import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import { TrendingUp, TrendingDown, RefreshCw, Calendar } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { motion } from 'framer-motion';

const SupplierPPMDisplay = ({ supplierId, supplierName }) => {
    const { toast } = useToast();
    const [ppmData, setPpmData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [period, setPeriod] = useState('yearly'); // 'monthly' or 'yearly'
    const [year, setYear] = useState(new Date().getFullYear());

    useEffect(() => {
        if (supplierId) {
            loadPPMData();
        }
    }, [supplierId, period, year]);

    const loadPPMData = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('supplier_ppm_data')
                .select('*')
                .eq('supplier_id', supplierId)
                .eq('year', year);

            if (period === 'monthly') {
                query = query.not('month', 'is', null).order('month', { ascending: true });
            } else {
                query = query.is('month', null);
            }

            const { data, error } = await query;

            if (error) throw error;

            // Eğer veri yoksa, hesapla
            if (!data || data.length === 0) {
                await calculatePPM();
                // Tekrar yükle
                const { data: newData, error: newError } = await query;
                if (newError) throw newError;
                setPpmData(newData || []);
            } else {
                setPpmData(data);
            }
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'PPM verileri yüklenemedi: ' + error.message
            });
        } finally {
            setLoading(false);
        }
    };

    const calculatePPM = async () => {
        try {
            if (period === 'monthly') {
                // Tüm aylar için hesapla
                for (let month = 1; month <= 12; month++) {
                    await supabase.rpc('update_supplier_ppm', {
                        p_supplier_id: supplierId,
                        p_year: year,
                        p_month: month
                    });
                }
            } else {
                await supabase.rpc('update_supplier_ppm', {
                    p_supplier_id: supplierId,
                    p_year: year,
                    p_month: null
                });
            }
        } catch (error) {
            console.error('PPM hesaplama hatası:', error);
        }
    };

    const handleRefresh = async () => {
        await calculatePPM();
        await loadPPMData();
        toast({
            title: 'Başarılı',
            description: 'PPM değerleri güncellendi.'
        });
    };

    const currentPPM = useMemo(() => {
        if (period === 'monthly') {
            const currentMonth = new Date().getMonth() + 1;
            const currentData = ppmData.find(d => d.month === currentMonth);
            return currentData?.ppm_value || 0;
        } else {
            return ppmData[0]?.ppm_value || 0;
        }
    }, [ppmData, period]);

    const chartData = useMemo(() => {
        if (period === 'monthly') {
            const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
            return ppmData.map(d => ({
                month: months[d.month - 1],
                ppm: d.ppm_value,
                inspected: d.inspected_quantity,
                defective: d.defective_quantity
            }));
        } else {
            return ppmData.map(d => ({
                year: d.year,
                ppm: d.ppm_value,
                inspected: d.inspected_quantity,
                defective: d.defective_quantity
            }));
        }
    }, [ppmData, period]);

    const getPPMStatus = (ppm) => {
        if (ppm < 100) return { label: 'Mükemmel', color: 'success', variant: 'default' };
        if (ppm < 500) return { label: 'İyi', color: 'blue', variant: 'secondary' };
        if (ppm < 1000) return { label: 'Orta', color: 'yellow', variant: 'outline' };
        return { label: 'Kötü', color: 'destructive', variant: 'destructive' };
    };

    const status = getPPMStatus(currentPPM);

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            PPM Analizi
                            <Badge variant={status.variant} className={`bg-${status.color}-500`}>
                                {status.label}
                            </Badge>
                        </CardTitle>
                        <CardDescription>
                            {supplierName} - Parts Per Million (Parça Başına Milyon Hata Oranı)
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Select value={period} onValueChange={setPeriod}>
                            <SelectTrigger className="w-[120px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="monthly">Aylık</SelectItem>
                                <SelectItem value="yearly">Yıllık</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
                            <SelectTrigger className="w-[100px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {Array.from({ length: 5 }, (_, i) => {
                                    const y = new Date().getFullYear() - i;
                                    return <SelectItem key={y} value={y.toString()}>{y}</SelectItem>;
                                })}
                            </SelectContent>
                        </Select>
                        <Button variant="outline" size="icon" onClick={handleRefresh} disabled={loading}>
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Mevcut PPM */}
                <div className="p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border-2 border-primary/20">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-muted-foreground">Mevcut PPM Değeri</p>
                            <p className="text-3xl font-bold text-primary mt-1">
                                {currentPPM.toLocaleString('tr-TR')}
                            </p>
                            {period === 'monthly' && (
                                <p className="text-xs text-muted-foreground mt-1">
                                    {new Date(year, new Date().getMonth(), 1).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}
                                </p>
                            )}
                        </div>
                        <div className="text-right">
                            {currentPPM > 0 && (
                                <>
                                    <p className="text-sm text-muted-foreground">Hedef</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        {currentPPM < 100 ? (
                                            <TrendingDown className="h-5 w-5 text-green-600" />
                                        ) : (
                                            <TrendingUp className="h-5 w-5 text-red-600" />
                                        )}
                                        <span className="text-lg font-semibold">100 PPM</span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Grafik */}
                {chartData.length > 0 ? (
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey={period === 'monthly' ? 'month' : 'year'} />
                                <YAxis />
                                <Tooltip 
                                    formatter={(value, name) => {
                                        if (name === 'ppm') return [value.toLocaleString('tr-TR'), 'PPM'];
                                        return [value.toLocaleString('tr-TR'), name === 'inspected' ? 'Muayene Edilen' : 'Hatalı'];
                                    }}
                                />
                                <Legend />
                                <Line 
                                    type="monotone" 
                                    dataKey="ppm" 
                                    stroke="#8884d8" 
                                    strokeWidth={2}
                                    name="PPM"
                                />
                                <Line 
                                    type="monotone" 
                                    dataKey="inspected" 
                                    stroke="#82ca9d" 
                                    strokeWidth={1}
                                    name="Muayene Edilen"
                                    strokeDasharray="5 5"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="text-center py-8 text-muted-foreground">
                        {loading ? 'Yükleniyor...' : 'Veri bulunamadı. Yenile butonuna tıklayarak hesaplayın.'}
                    </div>
                )}

                {/* Detaylı İstatistikler */}
                {ppmData.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {ppmData.slice(-4).map((data, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="p-3 bg-muted rounded-lg"
                            >
                                <p className="text-xs text-muted-foreground">
                                    {period === 'monthly' 
                                        ? new Date(year, data.month - 1, 1).toLocaleDateString('tr-TR', { month: 'long' })
                                        : `${data.year} Yılı`}
                                </p>
                                <p className="text-lg font-bold">{data.ppm_value.toLocaleString('tr-TR')} PPM</p>
                                <p className="text-xs text-muted-foreground">
                                    {data.inspected_quantity.toLocaleString('tr-TR')} muayene / {data.defective_quantity.toLocaleString('tr-TR')} hatalı
                                </p>
                            </motion.div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default SupplierPPMDisplay;

