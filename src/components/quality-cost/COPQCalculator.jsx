import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, DollarSign, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';

const formatCurrency = (value) => {
    if (typeof value !== 'number') return '-';
    return value.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
};

const COPQCalculator = ({ costs, producedVehicles, loading, dateRange }) => {
    const copqData = useMemo(() => {
        if (!costs || costs.length === 0) {
            return {
                internalFailure: 0,
                externalFailure: 0,
                appraisal: 0,
                prevention: 0,
                totalCOPQ: 0,
                costPerVehicle: 0,
                breakdown: {
                    internalFailure: [],
                    externalFailure: [],
                    appraisal: [],
                    prevention: []
                }
            };
        }

        // Internal Failure kategorileri
        const internalFailureTypes = [
            'Hurda Maliyeti',
            'Yeniden İşlem Maliyeti',
            'Fire Maliyeti',
            'İç Kalite Kontrol Maliyeti',
            'Final Hataları Maliyeti'
        ];

        // External Failure kategorileri
        const externalFailureTypes = [
            'Garanti Maliyeti',
            'İade Maliyeti',
            'Şikayet Maliyeti',
            'Dış Hata Maliyeti',
            'Geri Çağırma Maliyeti',
            'Müşteri Kaybı Maliyeti'
        ];

        // Appraisal kategorileri
        const appraisalTypes = [
            'Girdi Kalite Kontrol Maliyeti',
            'Üretim Kalite Kontrol Maliyeti',
            'Test ve Ölçüm Maliyeti',
            'Kalite Kontrol Maliyeti'
        ];

        // Prevention kategorileri
        const preventionTypes = [
            'Eğitim Maliyeti',
            'Kalite Planlama Maliyeti',
            'Tedarikçi Değerlendirme Maliyeti',
            'İyileştirme Projeleri Maliyeti',
            'Kalite Sistem Maliyeti'
        ];

        let internalFailure = 0;
        let externalFailure = 0;
        let appraisal = 0;
        let prevention = 0;

        const breakdown = {
            internalFailure: [],
            externalFailure: [],
            appraisal: [],
            prevention: []
        };

        costs.forEach(cost => {
            const amount = cost.amount || 0;
            const costType = cost.cost_type || '';
            
            // Final Hataları Maliyeti için detaylı analiz
            if (costType === 'Final Hataları Maliyeti') {
                finalFaultsBreakdown.totalFaults += (cost.quantity || 1);
                
                // Birim bazında analiz
                const unit = cost.unit || 'Bilinmeyen';
                if (!finalFaultsBreakdown.byUnit[unit]) {
                    finalFaultsBreakdown.byUnit[unit] = {
                        count: 0,
                        amount: 0,
                        qualityControlDuration: 0,
                        reworkDuration: 0
                    };
                }
                finalFaultsBreakdown.byUnit[unit].count += (cost.quantity || 1);
                finalFaultsBreakdown.byUnit[unit].amount += amount;
                finalFaultsBreakdown.byUnit[unit].qualityControlDuration += (cost.quality_control_duration || 0);
                finalFaultsBreakdown.byUnit[unit].reworkDuration += (cost.rework_duration || 0);
                
                // Araç tipi bazında analiz
                const vehicleType = cost.vehicle_type || 'Bilinmeyen';
                if (!finalFaultsBreakdown.byVehicleType[vehicleType]) {
                    finalFaultsBreakdown.byVehicleType[vehicleType] = {
                        count: 0,
                        amount: 0
                    };
                }
                finalFaultsBreakdown.byVehicleType[vehicleType].count += (cost.quantity || 1);
                finalFaultsBreakdown.byVehicleType[vehicleType].amount += amount;
                
                // Toplam süreler
                finalFaultsBreakdown.totalQualityControlDuration += (cost.quality_control_duration || 0);
                finalFaultsBreakdown.totalReworkDuration += (cost.rework_duration || 0);
            }
            
            // Tedarikçi kaynaklı maliyetler otomatik olarak External Failure
            if (cost.is_supplier_nc && cost.supplier_id) {
                externalFailure += amount;
                breakdown.externalFailure.push(cost);
            } else if (internalFailureTypes.some(type => costType.includes(type))) {
                internalFailure += amount;
                breakdown.internalFailure.push(cost);
            } else if (externalFailureTypes.some(type => costType.includes(type))) {
                externalFailure += amount;
                breakdown.externalFailure.push(cost);
            } else if (appraisalTypes.some(type => costType.includes(type))) {
                appraisal += amount;
                breakdown.appraisal.push(cost);
            } else if (preventionTypes.some(type => costType.includes(type))) {
                prevention += amount;
                breakdown.prevention.push(cost);
            } else {
                // Belirtilmemiş maliyetler - varsayılan olarak Internal Failure
                internalFailure += amount;
                breakdown.internalFailure.push(cost);
            }
        });

        const totalCOPQ = internalFailure + externalFailure + appraisal + prevention;
        
        // Araç başı ortalama kalitesizlik maliyeti
        // Tarih filtresine göre üretilen araç sayısını hesapla
        let filteredVehicles = producedVehicles || [];
        if (dateRange?.startDate && dateRange?.endDate) {
            const startDate = new Date(dateRange.startDate);
            const endDate = new Date(dateRange.endDate);
            filteredVehicles = filteredVehicles.filter(v => {
                const vehicleDate = v.created_at ? new Date(v.created_at) : (v.production_date ? new Date(v.production_date) : null);
                if (!vehicleDate) return false;
                return vehicleDate >= startDate && vehicleDate <= endDate;
            });
        }
        const totalVehicles = filteredVehicles.reduce((sum, v) => sum + (v.quantity || 1), 0);
        const costPerVehicle = totalVehicles > 0 ? totalCOPQ / totalVehicles : 0;

        return {
            internalFailure,
            externalFailure,
            appraisal,
            prevention,
            totalCOPQ,
            costPerVehicle,
            breakdown,
            totalVehicles,
            finalFaultsBreakdown
        };
    }, [costs, producedVehicles, dateRange]);

    if (loading) {
        return (
            <Card>
                <CardContent className="p-6">
                    <div className="text-center text-muted-foreground">Yükleniyor...</div>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-primary" />
                        COPQ (Kalitesizlik Maliyeti) Hesaplama
                    </CardTitle>
                    <CardDescription>
                        IATF 16949 mantığına göre kalitesizlik maliyeti analizi
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Toplam COPQ */}
                    <div className="p-4 bg-primary/10 rounded-lg border-2 border-primary">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Toplam COPQ</p>
                                <p className="text-3xl font-bold text-primary">
                                    {formatCurrency(copqData.totalCOPQ)}
                                </p>
                            </div>
                            <Badge variant="outline" className="text-lg px-4 py-2">
                                {copqData.breakdown.internalFailure.length + 
                                 copqData.breakdown.externalFailure.length + 
                                 copqData.breakdown.appraisal.length + 
                                 copqData.breakdown.prevention.length} Kayıt
                            </Badge>
                        </div>
                    </div>

                    {/* Kategori Dağılımı */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-semibold text-red-700 dark:text-red-400">
                                    İç Hata Maliyeti
                                </span>
                                <TrendingDown className="h-4 w-4 text-red-600" />
                            </div>
                            <p className="text-2xl font-bold text-red-900 dark:text-red-200">
                                {formatCurrency(copqData.internalFailure)}
                            </p>
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                                {copqData.totalCOPQ > 0 
                                    ? `%${((copqData.internalFailure / copqData.totalCOPQ) * 100).toFixed(1)}`
                                    : '0%'}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {copqData.breakdown.internalFailure.length} kayıt
                            </p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-900"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-semibold text-orange-700 dark:text-orange-400">
                                    Dış Hata Maliyeti
                                </span>
                                <TrendingUp className="h-4 w-4 text-orange-600" />
                            </div>
                            <p className="text-2xl font-bold text-orange-900 dark:text-orange-200">
                                {formatCurrency(copqData.externalFailure)}
                            </p>
                            <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                                {copqData.totalCOPQ > 0 
                                    ? `%${((copqData.externalFailure / copqData.totalCOPQ) * 100).toFixed(1)}`
                                    : '0%'}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {copqData.breakdown.externalFailure.length} kayıt
                            </p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                                    Değerlendirme Maliyeti
                                </span>
                                <DollarSign className="h-4 w-4 text-blue-600" />
                            </div>
                            <p className="text-2xl font-bold text-blue-900 dark:text-blue-200">
                                {formatCurrency(copqData.appraisal)}
                            </p>
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                {copqData.totalCOPQ > 0 
                                    ? `%${((copqData.appraisal / copqData.totalCOPQ) * 100).toFixed(1)}`
                                    : '0%'}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {copqData.breakdown.appraisal.length} kayıt
                            </p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-semibold text-green-700 dark:text-green-400">
                                    Önleme Maliyeti
                                </span>
                                <AlertTriangle className="h-4 w-4 text-green-600" />
                            </div>
                            <p className="text-2xl font-bold text-green-900 dark:text-green-200">
                                {formatCurrency(copqData.prevention)}
                            </p>
                            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                                {copqData.totalCOPQ > 0 
                                    ? `%${((copqData.prevention / copqData.totalCOPQ) * 100).toFixed(1)}`
                                    : '0%'}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {copqData.breakdown.prevention.length} kayıt
                            </p>
                        </motion.div>
                    </div>

                    {/* Araç Başı Ortalama */}
                    <div className="p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border border-primary/20">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <p className="text-sm font-semibold text-muted-foreground">
                                    Araç Başı Ortalama Kalitesizlik Maliyeti
                                </p>
                                <p className="text-3xl font-bold text-primary mt-1">
                                    {formatCurrency(copqData.costPerVehicle)}
                                </p>
                            </div>
                            <Badge variant="secondary" className="text-sm px-3 py-1">
                                IATF 16949 Metrik
                            </Badge>
                        </div>
                        {copqData.totalVehicles > 0 && (
                            <div className="text-xs text-muted-foreground">
                                <p>Toplam Üretilen Araç: {copqData.totalVehicles.toLocaleString('tr-TR')} adet</p>
                                <p>Toplam COPQ: {formatCurrency(copqData.totalCOPQ)}</p>
                            </div>
                        )}
                    </div>

                    {/* Formül Açıklaması */}
                    <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
                        <p className="font-semibold mb-1">COPQ Formülü (IATF 16949):</p>
                        <p>COPQ = İç Hata Maliyeti + Dış Hata Maliyeti + Değerlendirme Maliyeti + Önleme Maliyeti</p>
                    </div>
                </CardContent>
            </Card>

            {/* Final Hataları Detaylı Analizi */}
            {copqData.finalFaultsBreakdown && copqData.finalFaultsBreakdown.totalFaults > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-orange-500" />
                            Final Hataları Detaylı Analizi
                        </CardTitle>
                        <CardDescription>
                            Final hataları için birim, araç tipi ve süre bazlı detaylı analiz
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Özet İstatistikler */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-900">
                                <p className="text-xs text-muted-foreground">Toplam Hata</p>
                                <p className="text-xl font-bold text-orange-900 dark:text-orange-200">
                                    {copqData.finalFaultsBreakdown.totalFaults}
                                </p>
                            </div>
                            <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900">
                                <p className="text-xs text-muted-foreground">Toplam Kalite Kontrol Süresi</p>
                                <p className="text-xl font-bold text-blue-900 dark:text-blue-200">
                                    {copqData.finalFaultsBreakdown.totalQualityControlDuration} dk
                                </p>
                            </div>
                            <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900">
                                <p className="text-xs text-muted-foreground">Toplam Giderilme Süresi</p>
                                <p className="text-xl font-bold text-green-900 dark:text-green-200">
                                    {copqData.finalFaultsBreakdown.totalReworkDuration} dk
                                </p>
                            </div>
                            <div className="p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-900">
                                <p className="text-xs text-muted-foreground">Toplam Final Hataları Maliyeti</p>
                                <p className="text-xl font-bold text-purple-900 dark:text-purple-200">
                                    {formatCurrency(
                                        copqData.breakdown.internalFailure
                                            .filter(c => c.cost_type === 'Final Hataları Maliyeti')
                                            .reduce((sum, c) => sum + (c.amount || 0), 0)
                                    )}
                                </p>
                            </div>
                        </div>

                        {/* Birim Bazında Analiz */}
                        {Object.keys(copqData.finalFaultsBreakdown.byUnit).length > 0 && (
                            <div>
                                <h4 className="text-sm font-semibold mb-2">Birim Bazında Final Hataları</h4>
                                <div className="space-y-2">
                                    {Object.entries(copqData.finalFaultsBreakdown.byUnit)
                                        .sort((a, b) => b[1].amount - a[1].amount)
                                        .map(([unit, data]) => (
                                            <div key={unit} className="p-3 bg-muted/50 rounded-lg border">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="font-semibold">{unit}</span>
                                                    <Badge variant="outline">{data.count} hata</Badge>
                                                </div>
                                                <div className="grid grid-cols-3 gap-2 text-xs">
                                                    <div>
                                                        <p className="text-muted-foreground">Maliyet</p>
                                                        <p className="font-semibold">{formatCurrency(data.amount)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-muted-foreground">Kalite Kontrol</p>
                                                        <p className="font-semibold">{data.qualityControlDuration} dk</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-muted-foreground">Giderilme</p>
                                                        <p className="font-semibold">{data.reworkDuration} dk</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        )}

                        {/* Araç Tipi Bazında Analiz */}
                        {Object.keys(copqData.finalFaultsBreakdown.byVehicleType).length > 0 && (
                            <div>
                                <h4 className="text-sm font-semibold mb-2">Araç Tipi Bazında Final Hataları</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {Object.entries(copqData.finalFaultsBreakdown.byVehicleType)
                                        .sort((a, b) => b[1].amount - a[1].amount)
                                        .map(([vehicleType, data]) => (
                                            <div key={vehicleType} className="p-3 bg-muted/50 rounded-lg border">
                                                <div className="flex items-center justify-between">
                                                    <span className="font-semibold">{vehicleType}</span>
                                                    <Badge variant="outline">{data.count} hata</Badge>
                                                </div>
                                                <p className="text-sm text-primary mt-1">{formatCurrency(data.amount)}</p>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default COPQCalculator;

