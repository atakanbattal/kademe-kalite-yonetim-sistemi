import React from 'react';
    import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
    import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
    import { AlertTriangle, CheckCircle, FileWarning, ListChecks } from 'lucide-react';
    import StatCard from '@/components/dashboard/StatCard';

    const PIE_COLORS = { 'Kabul': '#22C55E', 'Şartlı Kabul': '#F59E0B', 'Ret': '#EF4444', 'Beklemede': '#6B7280' };

    const IncomingQualityDashboard = ({ inspections, loading, onCardClick }) => {
        const stats = React.useMemo(() => {
            if (!inspections) return { totalInspections: 0, rejectionRate: 0, conditionalAcceptance: 0, missingControlPlans: 0, missingInkr: 0, rejectedCount: 0 };
            const totalInspections = inspections.length;
            const rejectedCount = inspections.filter(i => i.decision === 'Ret').length;
            const conditionalAcceptance = inspections.filter(i => i.decision === 'Şartlı Kabul').length;
            const missingControlPlans = inspections.filter(i => i.control_plan_status === 'Mevcut Değil').length;
            const missingInkr = inspections.filter(i => i.inkr_status === 'Mevcut Değil').length;

            return {
                totalInspections,
                rejectedCount,
                conditionalAcceptance,
                missingControlPlans,
                missingInkr
            };
        }, [inspections]);

        const decisionData = React.useMemo(() => {
            if (!inspections) return [];
            const decisions = { 'Kabul': 0, 'Şartlı Kabul': 0, 'Ret': 0, 'Beklemede': 0 };
            inspections.forEach(i => {
                if (i.decision && decisions.hasOwnProperty(i.decision)) {
                    decisions[i.decision]++;
                } else if (!i.decision) {
                    decisions['Beklemede']++;
                }
            });
            return Object.entries(decisions).map(([name, value]) => ({ name, value })).filter(d => d.value > 0);
        }, [inspections]);

        const supplierRejectionData = React.useMemo(() => {
            if (!inspections) return [];
            const supplierData = {};
            inspections.forEach(i => {
                if (i.supplier_name) {
                    if (!supplierData[i.supplier_name]) {
                        supplierData[i.supplier_name] = { received: 0, rejected: 0 };
                    }
                     supplierData[i.supplier_name].received += (Number(i.quantity_received) || 0);
                    if (i.decision === 'Ret') {
                        supplierData[i.supplier_name].rejected += (Number(i.quantity_rejected) || Number(i.quantity_received) || 0);
                    }
                }
            });
            return Object.entries(supplierData)
                .map(([name, data]) => ({
                    name,
                    rejectionRate: data.received > 0 ? parseFloat(((data.rejected / data.received) * 100).toFixed(2)) : 0
                }))
                .filter(item => item.rejectionRate > 0)
                .sort((a, b) => b.rejectionRate - a.rejectionRate)
                .slice(0, 5);
        }, [inspections]);

        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <StatCard icon={ListChecks} title="Toplam Kontrol" value={stats.totalInspections} loading={loading} onClick={() => onCardClick({ decision: 'all', controlPlanStatus: 'all', inkrStatus: 'all' })} />
                    <StatCard icon={AlertTriangle} title="Ret" value={stats.rejectedCount} loading={loading} color="text-destructive" onClick={() => onCardClick({ decision: 'Ret' })} />
                    <StatCard icon={FileWarning} title="Şartlı Kabul" value={stats.conditionalAcceptance} loading={loading} color="text-yellow-500" onClick={() => onCardClick({ decision: 'Şartlı Kabul' })} />
                    <StatCard icon={CheckCircle} title="Kontrol Planı Eksik" value={stats.missingControlPlans} loading={loading} color={stats.missingControlPlans > 0 ? "text-destructive" : "text-green-500"} onClick={() => onCardClick({ controlPlanStatus: 'Mevcut Değil' })} />
                    <StatCard icon={FileWarning} title="INKR Eksik" value={stats.missingInkr} loading={loading} color={stats.missingInkr > 0 ? "text-destructive" : "text-green-500"} onClick={() => onCardClick({ inkrStatus: 'Mevcut Değil' })} />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="dashboard-widget">
                        <CardHeader><CardTitle>Tedarikçi Bazlı Ret Oranları (%)</CardTitle></CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={300}>
                                {supplierRejectionData.length > 0 ? (
                                    <BarChart data={supplierRejectionData} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
                                        <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} domain={[0, 'dataMax + 10']} />
                                        <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} width={100} tick={{ width: 150 }} />
                                        <Tooltip cursor={{ fill: 'hsl(var(--accent))' }} contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }} formatter={(value) => `${value}%`} />
                                        <Bar dataKey="rejectionRate" name="Ret Oranı" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                ) : (
                                    <div className="flex items-center justify-center h-full text-muted-foreground">Reddedilen ürün bulunmamaktadır.</div>
                                )}
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                    <Card className="dashboard-widget">
                        <CardHeader><CardTitle>Kontrol Karar Dağılımı</CardTitle></CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={300}>
                                {decisionData.length > 0 ? (
                                    <PieChart>
                                        <Pie data={decisionData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} labelLine={false} label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                                            const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                                            const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180));
                                            const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180));
                                            return (
                                                <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={14} fontWeight="bold">
                                                    {`${(percent * 100).toFixed(0)}%`}
                                                </text>
                                            );
                                        }}>
                                            {decisionData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={PIE_COLORS[entry.name]} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }} />
                                        <Legend />
                                    </PieChart>
                                ) : (
                                    <div className="flex items-center justify-center h-full text-muted-foreground">Karar verisi bulunmamaktadır.</div>
                                )}
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    };

    export default IncomingQualityDashboard;