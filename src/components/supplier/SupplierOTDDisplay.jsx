import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid, BarChart, Bar } from 'recharts';
import { Clock, RefreshCw, TrendingUp, Calendar } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { motion } from 'framer-motion';

const SupplierOTDDisplay = ({ supplierId, supplierName }) => {
    const { toast } = useToast();
    const [deliveries, setDeliveries] = useState([]);
    const [otdData, setOtdData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [period, setPeriod] = useState('yearly');
    const [year, setYear] = useState(new Date().getFullYear());

    useEffect(() => {
        if (supplierId) {
            loadOTDData();
        }
    }, [supplierId, period, year]);

    const loadOTDData = async () => {
        setLoading(true);
        try {
            let deliveryData = [];
            let otdPercentage = 0;
            
            // Teslimat kayıtlarını yüklemeyi dene
            try {
                let query = supabase
                    .from('supplier_deliveries')
                    .select('*')
                    .eq('supplier_id', supplierId)
                    .eq('year', year);

                if (period === 'monthly') {
                    query = query.not('month', 'is', null).order('month', { ascending: true });
                }

                const { data, error } = await query;

                if (error) {
                    // Tablo yoksa veya erişim hatası varsa
                    if (error.code === '42P01' || error.message.includes('does not exist')) {
                        console.warn('supplier_deliveries tablosu mevcut değil');
                    } else {
                        console.warn('Teslimat verileri alınamadı:', error.message);
                    }
                } else {
                    deliveryData = data || [];
                }
            } catch (tableError) {
                console.warn('Teslimat tablosu erişim hatası:', tableError.message);
            }

            setDeliveries(deliveryData);

            // OTD% hesapla - RPC fonksiyonu yoksa manuel hesapla
            if (deliveryData.length > 0) {
                const total = deliveryData.length;
                const onTime = deliveryData.filter(d => d.on_time).length;
                otdPercentage = total > 0 ? (onTime / total) * 100 : 0;
            } else {
                // Teslimat verisi yoksa, incoming_inspections'dan zamanında teslimat oranını tahmin et
                // (Bu basit bir yaklaşım - gerçek teslimat verisi olmadan)
                otdPercentage = 0;
            }

            setOtdData(otdPercentage);
        } catch (error) {
            console.error('OTD verileri yüklenemedi:', error);
            // Hata durumunda bile UI çökmemeli
            setDeliveries([]);
            setOtdData(0);
        } finally {
            setLoading(false);
        }
    };

    const chartData = useMemo(() => {
        if (period === 'monthly') {
            const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
            const monthlyData = {};
            
            deliveries.forEach(delivery => {
                if (delivery.month) {
                    const monthKey = months[delivery.month - 1];
                    if (!monthlyData[monthKey]) {
                        monthlyData[monthKey] = { total: 0, onTime: 0 };
                    }
                    monthlyData[monthKey].total += 1;
                    if (delivery.on_time) {
                        monthlyData[monthKey].onTime += 1;
                    }
                }
            });

            return Object.entries(monthlyData).map(([month, data]) => ({
                month,
                otd: data.total > 0 ? ((data.onTime / data.total) * 100).toFixed(2) : 0,
                total: data.total,
                onTime: data.onTime
            }));
        } else {
            // Yıllık veri
            const total = deliveries.length;
            const onTime = deliveries.filter(d => d.on_time).length;
            return [{
                year: year,
                otd: total > 0 ? ((onTime / total) * 100).toFixed(2) : 0,
                total: total,
                onTime: onTime
            }];
        }
    }, [deliveries, period, year]);

    const getOTDStatus = (otd) => {
        if (otd >= 95) return { label: 'Mükemmel', color: 'success', variant: 'default' };
        if (otd >= 90) return { label: 'İyi', color: 'blue', variant: 'secondary' };
        if (otd >= 80) return { label: 'Orta', color: 'yellow', variant: 'outline' };
        return { label: 'Kötü', color: 'destructive', variant: 'destructive' };
    };

    const status = getOTDStatus(otdData || 0);

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Clock className="h-5 w-5 text-primary" />
                            OTD% Analizi
                            <Badge variant={status.variant} className={`bg-${status.color}-500`}>
                                {status.label}
                            </Badge>
                        </CardTitle>
                        <CardDescription>
                            {supplierName} - On-Time Delivery (Zamanında Teslimat Oranı)
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
                        <Button variant="outline" size="icon" onClick={loadOTDData} disabled={loading}>
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Mevcut OTD% */}
                <div className="p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border-2 border-primary/20">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-muted-foreground">Mevcut OTD%</p>
                            <p className="text-3xl font-bold text-primary mt-1">
                                {otdData ? otdData.toFixed(2) : '0.00'}%
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-muted-foreground">Hedef</p>
                            <div className="flex items-center gap-2 mt-1">
                                <TrendingUp className="h-5 w-5 text-green-600" />
                                <span className="text-lg font-semibold">95%</span>
                            </div>
                        </div>
                    </div>
                    {deliveries.length > 0 && (
                        <div className="mt-3 text-xs text-muted-foreground">
                            <p>Toplam Teslimat: {deliveries.length}</p>
                            <p>Zamanında Teslimat: {deliveries.filter(d => d.on_time).length}</p>
                        </div>
                    )}
                </div>

                {/* Grafik */}
                {chartData.length > 0 ? (
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey={period === 'monthly' ? 'month' : 'year'} />
                                <YAxis domain={[0, 100]} />
                                <Tooltip 
                                    formatter={(value, name) => {
                                        if (name === 'otd') return [`${value}%`, 'OTD%'];
                                        return [value, name === 'total' ? 'Toplam Teslimat' : 'Zamanında'];
                                    }}
                                />
                                <Legend />
                                <Bar dataKey="otd" fill="#8884d8" name="OTD%" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="text-center py-8 text-muted-foreground">
                        {loading ? 'Yükleniyor...' : 'Teslimat verisi bulunamadı.'}
                    </div>
                )}

                {/* Teslimat Listesi */}
                {deliveries.length > 0 && (
                    <div className="space-y-2">
                        <h4 className="font-semibold text-sm">Son Teslimatlar</h4>
                        <div className="max-h-[200px] overflow-y-auto space-y-1">
                            {deliveries.slice(-10).reverse().map((delivery, index) => (
                                <motion.div
                                    key={delivery.id || index}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className={`p-2 rounded border ${
                                        delivery.on_time 
                                            ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900' 
                                            : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900'
                                    }`}
                                >
                                    <div className="flex items-center justify-between text-sm">
                                        <div>
                                            <span className="font-medium">{delivery.delivery_note_number || 'Teslimat #' + (index + 1)}</span>
                                            {delivery.planned_delivery_date && (
                                                <span className="text-muted-foreground ml-2">
                                                    Planlanan: {new Date(delivery.planned_delivery_date).toLocaleDateString('tr-TR')}
                                                </span>
                                            )}
                                        </div>
                                        <Badge variant={delivery.on_time ? 'default' : 'destructive'}>
                                            {delivery.on_time ? 'Zamanında' : 'Gecikmeli'}
                                        </Badge>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default SupplierOTDDisplay;

