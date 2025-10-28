import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { AlertCircle, Clock, CheckCircle, FileText } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';

const StatCard = ({ icon: Icon, title, value, colorClass }) => (
    <Card className={`overflow-hidden border-l-4 ${colorClass}`}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
            <Icon className={`h-5 w-5 ${colorClass.replace('border-', 'text-')}`} />
        </CardHeader>
        <CardContent>
            <p className="text-2xl font-bold text-foreground">{value}</p>
        </CardContent>
    </Card>
);

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6'];

const DeviationDashboard = ({ deviations, loading }) => {
    const analytics = useMemo(() => {
        const statusCounts = {
            'Açık': 0,
            'Onay Bekliyor': 0,
            'Onaylandı': 0,
            'Reddedildi': 0,
            'Kapatıldı': 0,
        };
        const sourceCounts = {};
        
        const now = new Date();
        const monthStart = startOfMonth(now);
        const monthEnd = endOfMonth(now);
        let thisMonthCount = 0;

        deviations.forEach(d => {
            if (d.status in statusCounts) {
                statusCounts[d.status]++;
            }
            if (d.source) {
                sourceCounts[d.source] = (sourceCounts[d.source] || 0) + 1;
            }
            const recordDate = parseISO(d.created_at);
            if (isWithinInterval(recordDate, { start: monthStart, end: monthEnd })) {
                thisMonthCount++;
            }
        });

        const sourceChartData = Object.entries(sourceCounts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        return { statusCounts, sourceChartData, thisMonthCount };
    }, [deviations]);

    if (loading) {
        return <div className="text-center p-4 text-muted-foreground">Analizler yükleniyor...</div>;
    }

    const stats = [
        { icon: AlertCircle, title: 'Açık Sapmalar', value: analytics.statusCounts['Açık'], colorClass: 'border-yellow-500' },
        { icon: Clock, title: 'Onay Bekleyenler', value: analytics.statusCounts['Onay Bekliyor'], colorClass: 'border-blue-500' },
        { icon: CheckCircle, title: 'Onaylananlar', value: analytics.statusCounts['Onaylandı'], colorClass: 'border-green-500' },
        { icon: FileText, title: 'Bu Ayki Toplam Sapma', value: analytics.thisMonthCount, colorClass: 'border-indigo-500' }
    ];

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ staggerChildren: 0.1, delayChildren: 0.1 }}
        >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                {stats.map(stat => (
                    <motion.div key={stat.title} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
                        <StatCard {...stat} />
                    </motion.div>
                ))}
            </div>

            <div className="dashboard-widget">
                 <h3 className="text-lg font-semibold text-foreground mb-4">Sapma Kaynağı Dağılımı</h3>
                 {analytics.sourceChartData.length > 0 ? (
                     <ResponsiveContainer width="100%" height={300}>
                         <BarChart data={analytics.sourceChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                             <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                             <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                             <Tooltip
                                 contentStyle={{
                                     backgroundColor: 'hsl(var(--background))',
                                     borderColor: 'hsl(var(--border))',
                                     color: 'hsl(var(--foreground))'
                                 }}
                                 cursor={{ fill: 'hsl(var(--accent))' }}
                             />
                             <Bar dataKey="value" name="Sapma Sayısı" radius={[4, 4, 0, 0]}>
                                 {analytics.sourceChartData.map((entry, index) => (
                                     <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                 ))}
                             </Bar>
                         </BarChart>
                     </ResponsiveContainer>
                 ) : (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                        Analiz için veri bulunmuyor.
                    </div>
                 )}
            </div>
        </motion.div>
    );
};

export default DeviationDashboard;