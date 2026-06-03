import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Bell, TrendingUp, TrendingDown, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { getCanonicalUnitLabel } from '@/lib/qualityCostUnitGroups';

const formatCurrency = (value) => {
    if (typeof value !== 'number') return '-';
    return value.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
};

const CostAnomalyDetector = ({ costs, onAnomalyClick, canonicalUnitCtx = {} }) => {
    const { toast } = useToast();
    const { user } = useAuth();
    const [dismissedAnomalies, setDismissedAnomalies] = useState([]);
    const [notifiedAnomalyIds, setNotifiedAnomalyIds] = useState([]);

    const anomalies = useMemo(() => {
        if (!costs || costs.length === 0) return [];

        const anomaliesList = [];
        const currentMonth = new Date();
        currentMonth.setDate(1);
        currentMonth.setHours(0, 0, 0, 0);

        const lastMonth = new Date(currentMonth);
        lastMonth.setMonth(lastMonth.getMonth() - 1);

        const twoMonthsAgo = new Date(currentMonth);
        twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

        let thisMonthTotal = 0;
        let lastMonthTotal = 0;
        let last3MonthsTotal = 0;
        const unitCosts = {};
        const currentMonthKey = `${currentMonth.getFullYear()}-${currentMonth.getMonth()}`;
        const lastMonthKey = `${lastMonth.getFullYear()}-${lastMonth.getMonth()}`;

        for (const cost of costs) {
            const amt = parseFloat(cost.amount) || 0;
            const costDate = new Date(cost.cost_date);
            if (Number.isNaN(costDate.getTime())) continue;

            if (costDate >= currentMonth) thisMonthTotal += amt;
            else if (costDate >= lastMonth) lastMonthTotal += amt;

            if (costDate >= twoMonthsAgo && costDate < currentMonth) {
                last3MonthsTotal += amt;
            }

            const raw = (cost.unit || '').trim();
            const unit = raw ? getCanonicalUnitLabel(raw, canonicalUnitCtx) : 'Bilinmeyen';
            const monthKey = `${costDate.getFullYear()}-${costDate.getMonth()}`;
            if (!unitCosts[unit]) unitCosts[unit] = {};
            unitCosts[unit][monthKey] = (unitCosts[unit][monthKey] || 0) + amt;
        }

        const avg3Months = last3MonthsTotal / 3;

        // Genel maliyet anomalisi
        if (lastMonthTotal > 0) {
            const increase = ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100;
            if (Math.abs(increase) >= 50) {
                anomaliesList.push({
                    id: 'general-cost-anomaly',
                    type: 'general',
                    severity: increase > 0 ? 'high' : 'low',
                    title: increase > 0 ? 'Maliyet Anormal Artış' : 'Maliyet Anormal Azalış',
                    message: increase > 0
                        ? `Bu ay maliyet geçen aya göre %${increase.toFixed(1)} arttı`
                        : `Bu ay maliyet geçen aya göre %${Math.abs(increase).toFixed(1)} azaldı`,
                    thisMonth: thisMonthTotal,
                    lastMonth: lastMonthTotal,
                    increase: increase,
                    timestamp: new Date().toISOString()
                });
            }
        }

        // 3 aylık ortalama ile karşılaştırma
        if (avg3Months > 0) {
            const deviation = ((thisMonthTotal - avg3Months) / avg3Months) * 100;
            if (Math.abs(deviation) >= 50) {
                anomaliesList.push({
                    id: 'avg-deviation-anomaly',
                    type: 'average',
                    severity: deviation > 0 ? 'high' : 'low',
                    title: deviation > 0 ? 'Ortalamadan Sapma (Yüksek)' : 'Ortalamadan Sapma (Düşük)',
                    message: `Bu ay maliyet 3 aylık ortalamadan %${Math.abs(deviation).toFixed(1)} ${deviation > 0 ? 'yüksek' : 'düşük'}`,
                    thisMonth: thisMonthTotal,
                    average: avg3Months,
                    deviation: deviation,
                    timestamp: new Date().toISOString()
                });
            }
        }

        // Birim bazında anomali tespiti
        Object.entries(unitCosts).forEach(([unit, monthlyData]) => {
            const months = Object.keys(monthlyData).sort();
            if (months.length >= 2) {
                const currentValue = monthlyData[currentMonthKey] || 0;
                const lastValue = monthlyData[lastMonthKey] || 0;
                
                if (lastValue > 0) {
                    const increase = ((currentValue - lastValue) / lastValue) * 100;
                    if (Math.abs(increase) >= 50) {
                        anomaliesList.push({
                            id: `unit-${unit}-anomaly`,
                            type: 'unit',
                            severity: increase > 0 ? 'high' : 'low',
                            title: `${unit} Birimi - Maliyet Anomalisi`,
                            message: `${unit} biriminde bu ay maliyet geçen aya göre %${Math.abs(increase).toFixed(1)} ${increase > 0 ? 'arttı' : 'azaldı'}`,
                            unit: unit,
                            thisMonth: currentValue,
                            lastMonth: lastValue,
                            increase: increase,
                            timestamp: new Date().toISOString()
                        });
                    }
                }
            }
        });

        return anomaliesList.filter(a => !dismissedAnomalies.includes(a.id));
    }, [costs, dismissedAnomalies, canonicalUnitCtx]);

    const handleDismiss = (anomalyId) => {
        setDismissedAnomalies(prev => [...prev, anomalyId]);
    };

    const handleAnomalyClick = (anomaly) => {
        if (onAnomalyClick) {
            onAnomalyClick(anomaly);
        }
    };

    // Bildirim oluşturma (oturum açık kullanıcı için, her anomali bir kez)
    useEffect(() => {
        if (!user?.id || anomalies.length === 0) return;

        const pending = anomalies.filter(
            (a) => !notifiedAnomalyIds.includes(a.id) && !dismissedAnomalies.includes(a.id)
        );
        if (!pending.length) return;

        (async () => {
            const created = [];
            for (const anomaly of pending) {
                const { error } = await supabase.rpc('create_notification', {
                    p_user_id: user.id,
                    p_notification_type: 'COST_ANOMALY',
                    p_title: anomaly.title,
                    p_message: anomaly.message,
                    p_related_module: 'quality-cost',
                    p_related_id: null,
                    p_priority: anomaly.severity === 'high' ? 'HIGH' : 'NORMAL',
                    p_action_url: '/quality-cost',
                });
                if (!error) created.push(anomaly.id);
            }
            if (created.length) {
                setNotifiedAnomalyIds((prev) => [...prev, ...created]);
            }
        })();
    }, [anomalies, user?.id, dismissedAnomalies, notifiedAnomalyIds]);

    if (anomalies.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Bell className="h-5 w-5 text-primary" />
                        Maliyet Anomali Tespiti
                    </CardTitle>
                    <CardDescription>
                        AI destekli anormal maliyet tespiti (%50 sapma eşiği)
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                        <Badge variant="outline" className="text-green-600 border-green-600">
                            Anomali Tespit Edilmedi
                        </Badge>
                        <p className="text-sm mt-2">Maliyetler normal aralıkta görünüyor.</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    Maliyet Anomali Tespiti
                    <Badge variant="destructive" className="ml-2">
                        {anomalies.length} Anomali
                    </Badge>
                </CardTitle>
                <CardDescription>
                    AI destekli anormal maliyet tespiti (%50 sapma eşiği)
                </CardDescription>
            </CardHeader>
            <CardContent>
                <AnimatePresence>
                    <div className="space-y-3">
                        {anomalies.map((anomaly) => (
                            <motion.div
                                key={anomaly.id}
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className={`p-4 rounded-lg border-2 ${
                                    anomaly.severity === 'high'
                                        ? 'bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-800'
                                        : 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-300 dark:border-yellow-800'
                                }`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            {anomaly.severity === 'high' ? (
                                                <TrendingUp className="h-5 w-5 text-red-600" />
                                            ) : (
                                                <TrendingDown className="h-5 w-5 text-yellow-600" />
                                            )}
                                            <h4 className="font-semibold text-sm">
                                                {anomaly.title}
                                            </h4>
                                            <Badge variant={anomaly.severity === 'high' ? 'destructive' : 'secondary'}>
                                                {anomaly.severity === 'high' ? 'YÜKSEK' : 'ORTA'}
                                            </Badge>
                                        </div>
                                        <p className="text-sm text-muted-foreground mb-2">
                                            {anomaly.message}
                                        </p>
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            {anomaly.thisMonth !== undefined && (
                                                <div>
                                                    <span className="text-muted-foreground">Bu Ay: </span>
                                                    <span className="font-semibold">{formatCurrency(anomaly.thisMonth)}</span>
                                                </div>
                                            )}
                                            {anomaly.lastMonth !== undefined && (
                                                <div>
                                                    <span className="text-muted-foreground">Geçen Ay: </span>
                                                    <span className="font-semibold">{formatCurrency(anomaly.lastMonth)}</span>
                                                </div>
                                            )}
                                            {anomaly.average !== undefined && (
                                                <div>
                                                    <span className="text-muted-foreground">Ortalama: </span>
                                                    <span className="font-semibold">{formatCurrency(anomaly.average)}</span>
                                                </div>
                                            )}
                                            {anomaly.increase !== undefined && (
                                                <div>
                                                    <span className="text-muted-foreground">Değişim: </span>
                                                    <span className={`font-semibold ${anomaly.increase > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                        %{Math.abs(anomaly.increase).toFixed(1)}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        {anomaly.unit && (
                                            <Badge variant="outline" className="mt-2">
                                                Birim: {anomaly.unit}
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => handleDismiss(anomaly.id)}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleAnomalyClick(anomaly)}
                                        >
                                            Detay
                                        </Button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </AnimatePresence>
            </CardContent>
        </Card>
    );
};

export default CostAnomalyDetector;

