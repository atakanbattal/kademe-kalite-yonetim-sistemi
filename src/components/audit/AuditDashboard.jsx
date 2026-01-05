import React, { useMemo, useState } from 'react';
    import { motion } from 'framer-motion';
    import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
    import { AlertTriangle, ListChecks, CheckCircle, Calendar } from 'lucide-react';
    import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
    import { DateRangePicker } from '@/components/ui/date-range-picker';
    import { addDays, startOfMonth, endOfMonth } from 'date-fns';

    const StatCard = ({ icon: Icon, title, value, colorClass }) => (
        <Card className={`overflow-hidden border-l-4 ${colorClass}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
              <Icon className={`h-5 w-5 ${colorClass.replace('border-', 'text-')}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{value}</div>
            </CardContent>
        </Card>
    );

    const AuditDashboard = ({ audits, findings, loading, dateRange: externalDateRange, onDateRangeChange }) => {
        const [internalDateRange, setInternalDateRange] = useState({
            from: startOfMonth(new Date()),
            to: endOfMonth(new Date()),
        });
        
        // External dateRange varsa onu kullan, yoksa internal state'i kullan
        const dateRange = externalDateRange || internalDateRange;
        const setDateRange = onDateRangeChange || setInternalDateRange;

    const analytics = useMemo(() => {
        const filteredAudits = !dateRange || !dateRange.from ? audits : audits.filter(audit => {
            const auditDate = new Date(audit.audit_date);
            return auditDate >= dateRange.from && auditDate <= addDays(dateRange.to, 1);
        });

        const filteredFindings = !dateRange || !dateRange.from ? findings : findings.filter(finding => {
            const findingDate = new Date(finding.created_at);
            return findingDate >= dateRange.from && findingDate <= addDays(dateRange.to, 1);
        });

        const totalAuditsInRange = filteredAudits.length;
        const openedFindingsInRange = filteredFindings.length;
        const closedFindingsInRange = filteredFindings.filter(f => f.non_conformity?.status === 'Kapatıldı').length;

        const allTimeOpenFindings = findings.filter(f => !f.non_conformity || f.non_conformity.status !== 'Kapatıldı');
            
            const departmentFindings = {};
            allTimeOpenFindings.forEach(finding => {
                const audit = audits.find(a => a.id === finding.audit_id);
                const deptName = audit?.department?.unit_name || 'Belirtilmemiş';
                departmentFindings[deptName] = (departmentFindings[deptName] || 0) + 1;
            });

            const chartData = Object.entries(departmentFindings)
                .map(([name, value]) => ({ name, 'Açık Uygunsuzluk Sayısı': value }))
                .sort((a, b) => b['Açık Uygunsuzluk Sayısı'] - a['Açık Uygunsuzluk Sayısı']);

            return { totalAuditsInRange, openedFindingsInRange, closedFindingsInRange, chartData };
        }, [audits, findings, dateRange]);

        const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6'];

        if (loading) {
            return <div className="text-center p-4 text-muted-foreground">Analizler yükleniyor...</div>;
        }

        return (
            <div className="space-y-6">
                <div className="flex justify-end">
                    <DateRangePicker date={dateRange} onDateChange={setDateRange} />
                </div>
                <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }}
                    transition={{ staggerChildren: 0.1 }}
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                >
                    <StatCard icon={ListChecks} title="Yapılan Tetkik" value={analytics.totalAuditsInRange} colorClass="border-blue-500" />
                    <StatCard icon={AlertTriangle} title="Açılan Uygunsuzluk" value={analytics.openedFindingsInRange} colorClass="border-red-500" />
                    <StatCard icon={CheckCircle} title="Kapatılan Uygunsuzluk" value={analytics.closedFindingsInRange} colorClass="border-green-500" />
                </motion.div>
                <motion.div 
                    initial={{ y: 20, opacity: 0 }} 
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="dashboard-widget"
                >
                    <h3 className="text-lg font-semibold text-foreground mb-4">Birimlere Göre Açık Uygunsuzluk Dağılımı (Tümü)</h3>
                    {analytics.chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={analytics.chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                                <YAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'hsl(var(--background))',
                                        borderColor: 'hsl(var(--border))',
                                        color: 'hsl(var(--foreground))'
                                    }}
                                    cursor={{ fill: 'hsl(var(--accent))' }}
                                />
                                <Bar dataKey="Açık Uygunsuzluk Sayısı" barSize={30} radius={[4, 4, 0, 0]}>
                                    {analytics.chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                            Açık uygunsuzluk bulunmuyor.
                        </div>
                    )}
                </motion.div>
            </div>
        );
    };

    export default AuditDashboard;