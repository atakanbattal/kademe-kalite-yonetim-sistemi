import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, DollarSign, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';

const formatCurrency = (value) => {
    if (typeof value !== 'number') return '-';
    return value.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
};

const COPQCalculator = ({ costs, producedVehicles, loading }) => {
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
            'İç Kalite Kontrol Maliyeti'
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
        const totalVehicles = producedVehicles?.reduce((sum, v) => sum + (v.quantity || 0), 0) || 0;
        const costPerVehicle = totalVehicles > 0 ? totalCOPQ / totalVehicles : 0;

        return {
            internalFailure,
            externalFailure,
            appraisal,
            prevention,
            totalCOPQ,
            costPerVehicle,
            breakdown
        };
    }, [costs, producedVehicles]);

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
                        COPQ (Cost of Poor Quality) Hesaplama
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
                                    Internal Failure
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
                                    External Failure
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
                                    Appraisal
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
                                    Prevention
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
                    {copqData.costPerVehicle > 0 && (
                        <div className="p-4 bg-muted rounded-lg">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-muted-foreground">
                                        Araç Başı Ortalama Kalitesizlik Maliyeti
                                    </p>
                                    <p className="text-xl font-bold text-foreground mt-1">
                                        {formatCurrency(copqData.costPerVehicle)}
                                    </p>
                                </div>
                                <Badge variant="secondary" className="text-sm">
                                    IATF Metrik
                                </Badge>
                            </div>
                        </div>
                    )}

                    {/* Formül Açıklaması */}
                    <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
                        <p className="font-semibold mb-1">COPQ Formülü (IATF 16949):</p>
                        <p>COPQ = Internal Failure + External Failure + Appraisal + Prevention</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default COPQCalculator;

