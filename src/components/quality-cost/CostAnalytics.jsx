import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { motion } from 'framer-motion';
import { PIE_COLORS } from './constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';

const formatCurrency = (value) => {
    return value.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
};

const StatCard = ({ title, value, icon: Icon, onClick, loading }) => (
    <motion.div
        whileHover={{ y: -5 }}
        className="cursor-pointer"
        onClick={onClick}
    >
        <Card className="dashboard-widget">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                <Icon className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                {loading ? (
                    <Skeleton className="h-8 w-24" />
                ) : (
                    <div className="text-2xl font-bold text-primary">{formatCurrency(value)}</div>
                )}
            </CardContent>
        </Card>
    </motion.div>
);

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-background/90 backdrop-blur-sm p-2 border border-border rounded-lg shadow-lg">
                <p className="label font-semibold text-foreground">{`${data.name}`}</p>
                <p className="intro text-primary">{`Toplam Maliyet: ${formatCurrency(data.value)}`}</p>
                <p className="intro text-cyan-500">{`Toplam Adet: ${data.count.toLocaleString('tr-TR')}`}</p>
            </div>
        );
    }
    return null;
};

const renderTop5Chart = (title, data, onBarClick) => (
    <div className="dashboard-widget">
        <h3 className="widget-title mb-4">{title}</h3>
        {data && data.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <XAxis type="number" hide tickFormatter={formatCurrency} />
                    <YAxis
                        type="category"
                        dataKey="name"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        width={100}
                        tick={{ fill: 'hsl(var(--foreground))' }}
                        interval={0}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--accent))' }} />
                    <Bar dataKey="value" name="Toplam Maliyet" radius={[0, 4, 4, 0]} onClick={onBarClick} className="cursor-pointer">
                        {data.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        ) : (
            <div className="flex items-center justify-center h-[250px] text-muted-foreground">Veri bulunmuyor</div>
        )}
    </div>
);

const CostAnalytics = ({ costs, loading, onBarClick }) => {

    const analyticsData = useMemo(() => {
        if (!costs || costs.length === 0) {
            return {
                parts: [], units: [], costTypes: [], vehicleTypes: [],
                totalCost: 0, internalCost: 0, externalCost: 0,
                internalCosts: [], externalCosts: []
            };
        }

        // İç Hata Maliyetleri: Fabrika içinde (tedarikçi dahil girdi kontrolünde) tespit edilen hatalar
        // Tedarikçi kaynaklı maliyetler de fabrika içinde (girdi kalite kontrolünde) tespit edildiği için iç hata maliyetidir
        const internalCostTypes = [
            'Hurda Maliyeti', 
            'Yeniden İşlem Maliyeti', 
            'Fire Maliyeti', 
            'İç Kalite Kontrol Maliyeti', 
            'Final Hataları Maliyeti',
            'Tedarikçi Hata Maliyeti' // Girdi kontrolünde tespit edilen tedarikçi hataları
        ];
        
        // Dış Hata Maliyetleri: SADECE müşteride tespit edilen hatalar
        // Bunlar ürün müşteriye ulaştıktan sonra ortaya çıkan maliyetlerdir
        const externalCostTypes = [
            'Garanti Maliyeti',      // Müşteriye teslim sonrası garanti kapsamında
            'İade Maliyeti',         // Müşteri iadesi
            'Şikayet Maliyeti',      // Müşteri şikayeti
            'Dış Hata Maliyeti',     // Müşteride tespit edilen diğer hatalar
            'Müşteri Reklaması'      // Müşteri şikayetleri/reklamasyonlar
        ];

        let totalCost = 0;
        let internalCost = 0;
        let externalCost = 0;
        const internalCosts = [];
        const externalCosts = [];

        costs.forEach(cost => {
            totalCost += cost.amount;
            
            // Dış Hata: Sadece müşteride tespit edilen hatalar
            if (externalCostTypes.includes(cost.cost_type)) {
                externalCost += cost.amount;
                externalCosts.push(cost);
            } 
            // İç Hata: Fabrika içinde tespit edilen tüm hatalar (tedarikçi kaynaklı dahil)
            // Tedarikçi kaynaklı maliyetler de iç hata olarak sayılır çünkü girdi kontrolünde tespit edilir
            else if (internalCostTypes.includes(cost.cost_type) || (cost.is_supplier_nc && cost.supplier_id)) {
                internalCost += cost.amount;
                internalCosts.push(cost);
            }
        });

        const aggregate = (key, filterFn = () => true) => {
            const aggregatedData = costs.filter(filterFn).reduce((acc, cost) => {
                // Tedarikçi kaynaklı maliyetlerde, birim yerine tedarikçi adını kullan
                let itemKey;
                if (key === 'unit' && cost.is_supplier_nc && cost.supplier?.name) {
                    itemKey = cost.supplier.name;
                } else {
                    itemKey = cost[key];
                }
                
                if (!itemKey) return acc;

                if (!acc[itemKey]) {
                    acc[itemKey] = { value: 0, count: 0, allCosts: [] };
                }
                acc[itemKey].value += cost.amount;
                acc[itemKey].count += (cost.quantity || 1);
                acc[itemKey].allCosts.push(cost);
                return acc;
            }, {});

            return Object.entries(aggregatedData)
                .map(([name, data]) => ({ name, value: data.value, count: data.count, costs: data.allCosts }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 5);
        };

        return {
            parts: aggregate('part_code'),
            units: aggregate('unit'),
            costTypes: aggregate('cost_type'),
            vehicleTypes: aggregate('vehicle_type'),
            totalCost,
            internalCost,
            externalCost,
            internalCosts,
            externalCosts,
        };
    }, [costs]);

    const handleBarClick = (dataKey, data) => {
        if (data && data.name) {
            // Tedarikçi kaynaklı maliyetler için özel filtreleme
            let relatedCosts;
            if (dataKey === 'unit') {
                // Tedarikçi veya birim maliyeti
                relatedCosts = costs.filter(c => {
                    if (c.is_supplier_nc && c.supplier?.name) {
                        return c.supplier.name === data.name;
                    }
                    return c.unit === data.name;
                });
            } else {
                relatedCosts = costs.filter(c => c[dataKey] === data.name || (c.part_code === data.name && dataKey === 'part_code'));
            }
            onBarClick(`Detay: ${data.name}`, relatedCosts);
        }
    };
    
    return (
        <>
            <motion.div
                className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ staggerChildren: 0.1 }}
            >
                <StatCard 
                    title="Toplam Kalitesizlik Maliyeti" 
                    value={analyticsData.totalCost} 
                    icon={Wallet} 
                    loading={loading}
                    onClick={() => onBarClick('Toplam Kalitesizlik Maliyeti', costs)}
                />
                <StatCard 
                    title="İç Hata Maliyetleri" 
                    value={analyticsData.internalCost} 
                    icon={TrendingDown} 
                    loading={loading}
                    onClick={() => onBarClick('İç Hata Maliyetleri', analyticsData.internalCosts)}
                />
                <StatCard 
                    title="Dış Hata Maliyetleri" 
                    value={analyticsData.externalCost} 
                    icon={TrendingUp} 
                    loading={loading}
                    onClick={() => onBarClick('Dış Hata Maliyetleri', analyticsData.externalCosts)}
                />
            </motion.div>
            <motion.div
                className="grid grid-cols-1 lg:grid-cols-2 gap-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ staggerChildren: 0.1, delay: 0.2 }}
            >
                {renderTop5Chart("En Maliyetli 5 Parça", analyticsData.parts, (data) => handleBarClick('part_code', data))}
                {renderTop5Chart("En Maliyetli 5 Kaynak (Birim/Tedarikçi)", analyticsData.units, (data) => handleBarClick('unit', data))}
                {renderTop5Chart("En Maliyetli 5 Tür", analyticsData.costTypes, (data) => handleBarClick('cost_type', data))}
                {renderTop5Chart("En Maliyetli 5 Araç Türü", analyticsData.vehicleTypes, (data) => handleBarClick('vehicle_type', data))}
            </motion.div>
        </>
    );
};

export default CostAnalytics;