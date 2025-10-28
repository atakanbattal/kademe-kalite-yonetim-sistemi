import React from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, Zap, CheckCircle, TrendingUp } from 'lucide-react';

const StatCard = ({ icon: Icon, title, value, color, loading }) => (
    <Card className="h-full shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
            {Icon && <Icon className={`w-5 h-5 ${color || 'text-muted-foreground'}`} />}
        </CardHeader>
        <CardContent>
            {loading ? (
                <Skeleton className="h-8 w-3/4 mt-1" />
            ) : (
                <div className={`text-3xl font-bold ${color || 'text-foreground'}`}>{value}</div>
            )}
        </CardContent>
    </Card>
);

const KaizenDashboard = ({ data, loading }) => {
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.07 } }
    };
    
    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: { y: 0, opacity: 1 }
    };

    const totalKaizens = data.length;
    const approvedKaizens = data.filter(k => ['Onaylandı', 'Uygulamada', 'Standartlaştırıldı', 'Kapandı'].includes(k.status)).length;
    const inProgressKaizens = data.filter(k => k.status === 'Uygulamada').length;
    const totalYearlyGain = data.reduce((acc, k) => acc + (k.total_yearly_gain || 0), 0);

    const byDepartment = data.reduce((acc, k) => {
        const dept = k.department?.unit_name || 'Belirtilmemiş';
        acc[dept] = (acc[dept] || 0) + 1;
        return acc;
    }, {});
    const departmentData = Object.entries(byDepartment).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    const byProposer = data.reduce((acc, k) => {
        const proposer = k.proposer?.full_name || 'Belirtilmemiş';
        acc[proposer] = (acc[proposer] || 0) + 1;
        return acc;
    }, {});
    const proposerData = Object.entries(byProposer).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);

    const monthlyTrend = data.reduce((acc, k) => {
        const month = new Date(k.created_at).toLocaleString('default', { month: 'short', year: '2-digit' });
        if (!acc[month]) acc[month] = { opened: 0, closed: 0 };
        acc[month].opened++;
        if (k.status === 'Kapandı') acc[month].closed++;
        return acc;
    }, {});
    const trendData = Object.entries(monthlyTrend).map(([name, values]) => ({ name, ...values }));

    const CHART_COLORS = ['#3B82F6', '#818CF8', '#A78BFA', '#F472B6', '#FBBF24', '#60A5FA'];

    return (
        <motion.div 
            className="space-y-6"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <motion.div variants={itemVariants}><StatCard icon={Zap} title="Toplam Kaizen" value={totalKaizens} loading={loading} /></motion.div>
                <motion.div variants={itemVariants}><StatCard icon={CheckCircle} title="Onaylanan" value={approvedKaizens} loading={loading} color="text-green-500" /></motion.div>
                <motion.div variants={itemVariants}><StatCard icon={TrendingUp} title="Uygulamada" value={inProgressKaizens} loading={loading} color="text-orange-500" /></motion.div>
                <motion.div variants={itemVariants}><StatCard icon={DollarSign} title="Yıllık Kazanç" value={totalYearlyGain.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })} loading={loading} color="text-blue-500" /></motion.div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <motion.div variants={itemVariants} className="lg:col-span-2">
                    <Card className="h-full">
                        <CardHeader><CardTitle>Departman Bazlı Kaizen Sayısı</CardTitle></CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={departmentData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                                    <Tooltip cursor={{ fill: 'hsl(var(--accent))' }} contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }} />
                                    <Bar dataKey="value" name="Kaizen Sayısı" radius={[4, 4, 0, 0]}>
                                        {departmentData.map((entry, index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </motion.div>
                <motion.div variants={itemVariants}>
                    <Card className="h-full">
                        <CardHeader><CardTitle>En Çok Öneri Yapanlar</CardTitle></CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie data={proposerData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} fill="#8884d8" paddingAngle={5}>
                                        {proposerData.map((entry, index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }} />
                                    <Legend iconSize={10} />
                                </PieChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
             <motion.div variants={itemVariants}>
                <Card>
                    <CardHeader><CardTitle>Aylık Kaizen Trendi</CardTitle></CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={trendData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }} />
                                <Legend />
                                <Line type="monotone" dataKey="opened" name="Açılan" stroke="#3B82F6" strokeWidth={2} />
                                <Line type="monotone" dataKey="closed" name="Kapatılan" stroke="#16A34A" strokeWidth={2} />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </motion.div>
        </motion.div>
    );
};

export default KaizenDashboard;