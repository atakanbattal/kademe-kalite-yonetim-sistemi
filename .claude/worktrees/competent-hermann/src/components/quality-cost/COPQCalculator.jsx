import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, DollarSign, AlertTriangle, Building2, User, Truck, Package } from 'lucide-react';
import { motion } from 'framer-motion';

const formatCurrency = (value) => {
    if (typeof value !== 'number') return '-';
    return value.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
};

// Kalem veya maliyet için kategorisini belirle
const getCategory = (costType, isSupplierCost) => {
    const internalFailureTypes = ['Hurda Maliyeti', 'Yeniden İşlem Maliyeti', 'Fire Maliyeti', 'İç Kalite Kontrol Maliyeti', 'Final Hataları Maliyeti', 'İç Hata Maliyeti', 'Tedarikçi Hata Maliyeti'];
    const externalFailureTypes = ['Garanti Maliyeti', 'İade Maliyeti', 'Şikayet Maliyeti', 'Dış Hata Maliyeti', 'Geri Çağırma Maliyeti', 'Müşteri Kaybı Maliyeti', 'Müşteri Reklaması'];
    const appraisalTypes = ['Girdi Kalite Kontrol Maliyeti', 'Üretim Kalite Kontrol Maliyeti', 'Test ve Ölçüm Maliyeti', 'Kalite Kontrol Maliyeti'];
    const preventionTypes = ['Eğitim Maliyeti', 'Kalite Planlama Maliyeti', 'Tedarikçi Değerlendirme Maliyeti', 'İyileştirme Projeleri Maliyeti', 'Kalite Sistem Maliyeti'];
    const ct = costType || '';
    if (externalFailureTypes.some(t => ct.includes(t))) return 'externalFailure';
    if (internalFailureTypes.some(t => ct.includes(t)) || isSupplierCost) return 'internalFailure';
    if (appraisalTypes.some(t => ct.includes(t))) return 'appraisal';
    if (preventionTypes.some(t => ct.includes(t))) return 'prevention';
    return 'internalFailure';
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
                breakdown: { internalFailure: [], externalFailure: [], appraisal: [], prevention: [] },
                totalVehicles: 0,
                finalFaultsBreakdown: { byUnit: {}, byVehicleType: {}, totalFaults: 0, totalQualityControlDuration: 0, totalReworkDuration: 0 },
                byUnitAndSupplier: [],
                byCustomer: [],
                bySupplier: [],
                topLineItems: []
            };
        }

        const internalFailureTypes = ['Hurda Maliyeti', 'Yeniden İşlem Maliyeti', 'Fire Maliyeti', 'İç Kalite Kontrol Maliyeti', 'Final Hataları Maliyeti', 'İç Hata Maliyeti', 'Tedarikçi Hata Maliyeti'];
        const externalFailureTypes = ['Garanti Maliyeti', 'İade Maliyeti', 'Şikayet Maliyeti', 'Dış Hata Maliyeti', 'Geri Çağırma Maliyeti', 'Müşteri Kaybı Maliyeti', 'Müşteri Reklaması'];
        const appraisalTypes = ['Girdi Kalite Kontrol Maliyeti', 'Üretim Kalite Kontrol Maliyeti', 'Test ve Ölçüm Maliyeti', 'Kalite Kontrol Maliyeti'];
        const preventionTypes = ['Eğitim Maliyeti', 'Kalite Planlama Maliyeti', 'Tedarikçi Değerlendirme Maliyeti', 'İyileştirme Projeleri Maliyeti', 'Kalite Sistem Maliyeti'];

        let internalFailure = 0;
        let externalFailure = 0;
        let appraisal = 0;
        let prevention = 0;

        const breakdown = { internalFailure: [], externalFailure: [], appraisal: [], prevention: [] };
        const finalFaultsBreakdown = { byUnit: {}, byVehicleType: {}, totalFaults: 0, totalQualityControlDuration: 0, totalReworkDuration: 0 };
        const unitMap = {}; // Birim/Tedarikçi bazında toplam
        const customerMap = {}; // Müşteri bazında Dış Hata
        const supplierMap = {}; // Tedarikçi bazında
        const lineItemsForTop = []; // En yüksek kalemler

        const seenCostIds = { internalFailure: new Set(), externalFailure: new Set(), appraisal: new Set(), prevention: new Set() };
        const addToCategory = (amt, cat, cost) => {
            if (cat === 'externalFailure') {
                externalFailure += amt;
                if (!seenCostIds.externalFailure.has(cost.id)) { seenCostIds.externalFailure.add(cost.id); breakdown.externalFailure.push(cost); }
            } else if (cat === 'internalFailure') {
                internalFailure += amt;
                if (!seenCostIds.internalFailure.has(cost.id)) { seenCostIds.internalFailure.add(cost.id); breakdown.internalFailure.push(cost); }
            } else if (cat === 'appraisal') {
                appraisal += amt;
                if (!seenCostIds.appraisal.has(cost.id)) { seenCostIds.appraisal.add(cost.id); breakdown.appraisal.push(cost); }
            } else {
                prevention += amt;
                if (!seenCostIds.prevention.has(cost.id)) { seenCostIds.prevention.add(cost.id); breakdown.prevention.push(cost); }
            }
        };

        const addToUnit = (unitKey, amount, category, cost) => {
            if (!unitMap[unitKey]) unitMap[unitKey] = { name: unitKey, total: 0, internal: 0, external: 0, appraisal: 0, prevention: 0, count: 0 };
            unitMap[unitKey].total += amount;
            unitMap[unitKey].count += 1;
            if (category === 'externalFailure') unitMap[unitKey].external += amount;
            else if (category === 'internalFailure') unitMap[unitKey].internal += amount;
            else if (category === 'appraisal') unitMap[unitKey].appraisal += amount;
            else unitMap[unitKey].prevention += amount;
        };

        costs.forEach(cost => {
            const costType = cost.cost_type || '';
            const isSupplierCost = cost.is_supplier_nc && cost.supplier_id;
            const lineItems = cost.cost_line_items && Array.isArray(cost.cost_line_items) ? cost.cost_line_items : [];
            const hasLineItems = lineItems.length > 0;

            if (hasLineItems) {
                lineItems.forEach(li => {
                    const itemAmount = parseFloat(li.amount) || 0;
                    if (itemAmount <= 0) return;
                    const cat = getCategory(costType, li.responsible_type === 'supplier');
                    addToCategory(itemAmount, cat, cost);

                    const unitKey = li.responsible_type === 'supplier'
                        ? `Tedarikçi: ${li.responsible_supplier_name || cost.supplier?.name || 'Bilinmeyen'}`
                        : (li.responsible_unit || 'Belirtilmemiş');
                    addToUnit(unitKey, itemAmount, cat, cost);

                    if (li.responsible_type === 'supplier') {
                        const supName = li.responsible_supplier_name || cost.supplier?.name || 'Bilinmeyen';
                        if (!supplierMap[supName]) supplierMap[supName] = { name: supName, total: 0, count: 0 };
                        supplierMap[supName].total += itemAmount;
                        supplierMap[supName].count += 1;
                    }

                    if (costType === 'Dış Hata Maliyeti' && cost.customer_name) {
                        const cust = cost.customer_name;
                        if (!customerMap[cust]) customerMap[cust] = { name: cust, total: 0, count: 0, units: {} };
                        customerMap[cust].total += itemAmount;
                        customerMap[cust].count += 1;
                        const u = unitKey;
                        customerMap[cust].units[u] = (customerMap[cust].units[u] || 0) + itemAmount;
                    }

                    lineItemsForTop.push({ part_code: li.part_code, part_name: li.part_name, amount: itemAmount, unit: unitKey, cost_type: costType });
                });
            } else {
                const amount = cost.amount || 0;
                const cat = getCategory(costType, isSupplierCost);
                addToCategory(amount, cat, cost);

                const allocs = cost.cost_allocations;
                if (allocs && allocs.length > 0) {
                    allocs.forEach(a => {
                        const allocAmt = a.amount ?? (amount * (parseFloat(a.percentage) || 0) / 100);
                        addToUnit(a.unit || 'Belirtilmemiş', allocAmt, cat, cost);
                    });
                } else {
                    const unitKey = cost.unit || 'Belirtilmemiş';
                    addToUnit(unitKey, amount, cat, cost);
                }

                if (costType === 'Dış Hata Maliyeti' && cost.customer_name) {
                    const cust = cost.customer_name;
                    if (!customerMap[cust]) customerMap[cust] = { name: cust, total: 0, count: 0, units: {} };
                    customerMap[cust].total += amount;
                    customerMap[cust].count += 1;
                    customerMap[cust].units[cost.unit || 'Belirtilmemiş'] = (customerMap[cust].units[cost.unit || 'Belirtilmemiş'] || 0) + amount;
                }
            }

            // Final Hataları Maliyeti - sadece kalemsiz kayıtlar için (kalemli kayıtlar Final değil genelde)
            if (costType === 'Final Hataları Maliyeti' && !hasLineItems) {
                const amount = cost.amount || 0;
                finalFaultsBreakdown.totalFaults += (cost.quantity || 1);
                const unit = cost.unit || 'Bilinmeyen';
                if (!finalFaultsBreakdown.byUnit[unit]) {
                    finalFaultsBreakdown.byUnit[unit] = { count: 0, amount: 0, qualityControlDuration: 0, reworkDuration: 0 };
                }
                finalFaultsBreakdown.byUnit[unit].count += (cost.quantity || 1);
                finalFaultsBreakdown.byUnit[unit].amount += amount;
                finalFaultsBreakdown.byUnit[unit].qualityControlDuration += (cost.quality_control_duration || 0);
                finalFaultsBreakdown.byUnit[unit].reworkDuration += (cost.rework_duration || 0);
                const vehicleType = cost.vehicle_type || 'Bilinmeyen';
                if (!finalFaultsBreakdown.byVehicleType[vehicleType]) {
                    finalFaultsBreakdown.byVehicleType[vehicleType] = { count: 0, amount: 0 };
                }
                finalFaultsBreakdown.byVehicleType[vehicleType].count += (cost.quantity || 1);
                finalFaultsBreakdown.byVehicleType[vehicleType].amount += amount;
                finalFaultsBreakdown.totalQualityControlDuration += (cost.quality_control_duration || 0);
                finalFaultsBreakdown.totalReworkDuration += (cost.rework_duration || 0);
            }
        });

        const totalCOPQ = internalFailure + externalFailure + appraisal + prevention;

        const byUnitAndSupplier = Object.values(unitMap)
            .sort((a, b) => b.total - a.total)
            .map(u => ({ ...u, percentage: totalCOPQ > 0 ? (u.total / totalCOPQ * 100).toFixed(1) : '0' }));

        const byCustomer = Object.values(customerMap)
            .sort((a, b) => b.total - a.total)
            .map(c => ({ ...c, percentage: (externalFailure > 0 ? (c.total / externalFailure * 100).toFixed(1) : '0') }));

        const bySupplier = Object.values(supplierMap)
            .sort((a, b) => b.total - a.total)
            .map(s => ({ ...s, percentage: totalCOPQ > 0 ? (s.total / totalCOPQ * 100).toFixed(1) : '0' }));

        const topLineItems = lineItemsForTop
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 10)
            .map((li, i) => ({ ...li, rank: i + 1, percentage: totalCOPQ > 0 ? ((li.amount / totalCOPQ) * 100).toFixed(1) : '0' }));
        
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
            finalFaultsBreakdown,
            byUnitAndSupplier,
            byCustomer,
            bySupplier,
            topLineItems
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
                        COPQ (İç/Dış Hata Maliyeti) Hesaplama
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
                                    Araç Başı Ortalama COPQ
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

            {/* Birim / Tedarikçi Bazında COPQ Dağılımı */}
            {copqData.byUnitAndSupplier && copqData.byUnitAndSupplier.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Building2 className="h-5 w-5 text-primary" />
                            Birim / Tedarikçi Bazında COPQ Dağılımı
                        </CardTitle>
                        <CardDescription>
                            Maliyet kalemlerine göre birim ve tedarikçi bazında tüm COPQ dağılımı
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left py-2 font-semibold">Birim / Tedarikçi</th>
                                        <th className="text-right py-2 font-semibold">Toplam</th>
                                        <th className="text-right py-2 font-semibold">%</th>
                                        <th className="text-right py-2 font-semibold">İç Hata</th>
                                        <th className="text-right py-2 font-semibold">Dış Hata</th>
                                        <th className="text-right py-2 font-semibold">Değerlendirme</th>
                                        <th className="text-right py-2 font-semibold">Önleme</th>
                                        <th className="text-right py-2 font-semibold">Kayıt</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {copqData.byUnitAndSupplier.map((u, i) => (
                                        <tr key={u.name} className="border-b hover:bg-muted/30">
                                            <td className="py-2 font-medium">{u.name}</td>
                                            <td className="text-right py-2 font-semibold text-primary">{formatCurrency(u.total)}</td>
                                            <td className="text-right py-2">%{u.percentage}</td>
                                            <td className="text-right py-2 text-red-600">{formatCurrency(u.internal)}</td>
                                            <td className="text-right py-2 text-orange-600">{formatCurrency(u.external)}</td>
                                            <td className="text-right py-2 text-blue-600">{formatCurrency(u.appraisal)}</td>
                                            <td className="text-right py-2 text-green-600">{formatCurrency(u.prevention)}</td>
                                            <td className="text-right py-2">{u.count}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Müşteri Bazında Dış Hata Maliyeti */}
            {copqData.byCustomer && copqData.byCustomer.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <User className="h-5 w-5 text-orange-500" />
                            Müşteri Bazında Dış Hata Maliyeti
                        </CardTitle>
                        <CardDescription>
                            Dış hata maliyetlerinin müşteri bazında dağılımı
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {copqData.byCustomer.map((c) => (
                                <div key={c.name} className="p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-900">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-semibold text-orange-900 dark:text-orange-200">{c.name}</span>
                                        <Badge variant="outline">{formatCurrency(c.total)} (%{c.percentage} dış hata)</Badge>
                                    </div>
                                    {Object.keys(c.units || {}).length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-2 text-xs">
                                            {Object.entries(c.units).map(([unit, amt]) => (
                                                <Badge key={unit} variant="secondary" className="text-xs">
                                                    {unit}: {formatCurrency(amt)}
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Tedarikçi Bazında Maliyet */}
            {copqData.bySupplier && copqData.bySupplier.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Truck className="h-5 w-5 text-amber-600" />
                            Tedarikçi Bazında COPQ
                        </CardTitle>
                        <CardDescription>
                            Tedarikçi kaynaklı maliyetlerin dağılımı (gerçek tedarikçi adları)
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {copqData.bySupplier.map((s) => (
                                <div key={s.name} className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900">
                                    <div className="flex items-center justify-between">
                                        <span className="font-semibold">{s.name}</span>
                                        <Badge variant="outline">{formatCurrency(s.total)} (%{s.percentage})</Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">{s.count} kalem</p>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* En Yüksek Maliyet Kalemleri */}
            {copqData.topLineItems && copqData.topLineItems.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Package className="h-5 w-5 text-primary" />
                            En Yüksek Maliyet Kalemleri (Top 10)
                        </CardTitle>
                        <CardDescription>
                            Parça bazında en yüksek maliyetli kalemler
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {copqData.topLineItems.map((li) => (
                                <div key={`${li.rank}-${li.part_code}-${li.amount}`} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="secondary" className="w-6 justify-center">#{li.rank}</Badge>
                                        <span className="font-medium">{li.part_code || '-'} {li.part_name ? `- ${li.part_name}` : ''}</span>
                                        <Badge variant="outline" className="text-[10px]">{li.unit}</Badge>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-muted-foreground">%{li.percentage}</span>
                                        <span className="font-bold text-primary">{formatCurrency(li.amount)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default COPQCalculator;

