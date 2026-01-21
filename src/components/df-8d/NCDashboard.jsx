import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FileText, FolderOpen, CheckCircle, XCircle, FileSpreadsheet, Hourglass, AlertTriangle, BarChart, Percent, CalendarDays, Zap, TrendingUp } from 'lucide-react';
import { differenceInDays, parseISO, format, eachMonthOfInterval, isValid, startOfMonth } from 'date-fns';
import { getStatusBadge } from '@/lib/statusUtils';

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-background/90 p-2 border border-border rounded-lg shadow-lg text-sm">
                <p className="font-bold">{label}</p>
                {payload.map((p, index) => (
                    <p key={index} style={{ color: p.color }}>
                        {`${p.name}: ${p.value}`}
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

const DashboardCard = ({ title, icon, children, loading, className = "" }) => (
    <Card className={`shadow-sm hover:shadow-lg transition-shadow duration-300 flex flex-col ${className}`}>
        <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                {icon && React.createElement(icon, { className: "w-5 h-5 text-muted-foreground"})}
                {title}
            </CardTitle>
        </CardHeader>
        <CardContent className="flex-grow flex items-center justify-center p-4">
            {loading ? <Skeleton className="h-full w-full" /> :
             !children || (Array.isArray(children) && children.length === 0) || (children.props && children.props.data && children.props.data.length === 0) ?
             <div className="text-muted-foreground text-center">Veri yok</div> : children
            }
        </CardContent>
    </Card>
);

const NCDashboard = ({ records, loading, onDashboardInteraction }) => {
    const analytics = useMemo(() => {
        if (!records || records.length === 0) {
            return {
                kpiCards: [],
                deptPerformance: [],
                overdueRecords: [],
                requesterContribution: [],
                monthlyTrend: [],
            };
        }

        const now = new Date();
        const counts = { DF: 0, '8D': 0, MDI: 0, open: 0, closed: 0, rejected: 0, overdue: 0 };
        const deptPerf = {};
        const requesterContrib = {};
        
        let allDates = [];

        records.forEach(rec => {
            const isClosed = rec.status === 'Kapatıldı';
            const isRejected = rec.status === 'Reddedildi';
            const isOpen = !isClosed && !isRejected;

            if (isOpen) counts.open++;
            if (isClosed) counts.closed++;
            if (isRejected) counts.rejected++;
            if (rec.type in counts) counts[rec.type]++;
            
            const dueAt = rec.due_at ? parseISO(rec.due_at) : null;
            const isOverdue = isOpen && dueAt && isValid(dueAt) && now > dueAt;
            
            const responsibleDept = rec.department || 'Belirtilmemiş';
            if (!deptPerf[responsibleDept]) {
                deptPerf[responsibleDept] = { open: 0, closed: 0, overdue: 0, totalClosureDays: 0, closedCount: 0, records: [] };
            }
            deptPerf[responsibleDept].records.push(rec);

            if (isOpen) {
                deptPerf[responsibleDept].open++;
                if (isOverdue) {
                    deptPerf[responsibleDept].overdue++;
                }
            }
            if (isClosed) {
                deptPerf[responsibleDept].closed++;
                const openedAtDate = rec.df_opened_at ? parseISO(rec.df_opened_at) : null;
                const closedAtDate = parseISO(rec.closed_at);
                if (openedAtDate && isValid(openedAtDate) && isValid(closedAtDate)) {
                    const closureDays = differenceInDays(closedAtDate, openedAtDate);
                    if (closureDays >= 0) {
                        deptPerf[responsibleDept].totalClosureDays += closureDays;
                        deptPerf[responsibleDept].closedCount++;
                    }
                }
            }
            
            const requesterUnit = rec.requesting_unit || 'Belirtilmemiş';
            if (!requesterContrib[requesterUnit]) requesterContrib[requesterUnit] = { total: 0, DF: 0, '8D': 0, MDI: 0, records: [] };
            requesterContrib[requesterUnit].records.push(rec);
            requesterContrib[requesterUnit].total++;
            if(rec.type in requesterContrib[requesterUnit]) requesterContrib[requesterUnit][rec.type]++;

            if (rec.df_opened_at) {
                const openedDate = parseISO(rec.df_opened_at);
                if(isValid(openedDate)) allDates.push(openedDate);
            }
            if (rec.closed_at) {
                const closedDate = parseISO(rec.closed_at);
                if(isValid(closedDate)) allDates.push(closedDate);
            }
        });

        const overdueRecords = records.filter(r => {
            const dueAt = r.due_at ? parseISO(r.due_at) : null;
            return r.status !== 'Kapatıldı' && r.status !== 'Reddedildi' && dueAt && isValid(dueAt) && new Date() > dueAt;
        }).sort((a,b) => {
             const dueA = a.due_at ? parseISO(a.due_at) : null;
             const dueB = b.due_at ? parseISO(b.due_at) : null;
             if (!dueA || !dueB || !isValid(dueA) || !isValid(dueB)) return 0;
             return differenceInDays(new Date(), dueB) - differenceInDays(new Date(), dueA);
        });

        counts.overdue = overdueRecords.length;

        // Kapatma oranı hesapla (Kapatılan / (Kapatılan + Açık + Reddedilen) * 100)
        const totalProcessed = counts.closed + counts.open + counts.rejected;
        const closureRate = totalProcessed > 0 ? ((counts.closed / totalProcessed) * 100).toFixed(1) : 0;

        const kpiCards = [
            { title: "Açık", value: counts.open, icon: FolderOpen, colorClass: "border-blue-500", records: records.filter(r => r.status !== 'Kapatıldı' && r.status !== 'Reddedildi') },
            { title: "Kapalı", value: counts.closed, icon: CheckCircle, colorClass: "border-green-500", records: records.filter(r => r.status === 'Kapatıldı') },
            { title: "Kapanma", value: `%${closureRate}`, icon: TrendingUp, colorClass: "border-emerald-500", isPercentage: true, records: records.filter(r => r.status === 'Kapatıldı') },
            { title: "Geciken", value: counts.overdue, icon: AlertTriangle, colorClass: "border-orange-500", records: overdueRecords },
            { title: "Reddedildi", value: counts.rejected, icon: XCircle, colorClass: "border-red-500", records: records.filter(r => r.status === 'Reddedildi') },
            { title: "DF", value: counts.DF, icon: FileText, colorClass: "border-indigo-500", records: records.filter(r => r.type === 'DF') },
            { title: "8D", value: counts['8D'], icon: FileSpreadsheet, colorClass: "border-purple-500", records: records.filter(r => r.type === '8D') },
            { title: "MDI", value: counts.MDI, icon: Hourglass, colorClass: "border-pink-500", records: records.filter(r => r.type === 'MDI') },
        ];

        const deptPerformance = Object.entries(deptPerf).map(([name, data]) => ({
            unit: name,
            open: data.open,
            closed: data.closed,
            overdue: data.overdue,
            avgClosureTime: data.closedCount > 0 ? (data.totalClosureDays / data.closedCount).toFixed(1) : "N/A",
            records: data.records
        })).sort((a, b) => b.open - a.open);

        const totalRequests = records.length;
        const requesterContribution = Object.entries(requesterContrib).map(([name, data]) => ({
            unit: name,
            total: data.total,
            DF: data.DF,
            '8D': data['8D'],
            MDI: data.MDI,
            contribution: totalRequests > 0 ? ((data.total / totalRequests) * 100).toFixed(1) + '%' : '0%',
            records: data.records
        })).sort((a, b) => b.total - a.total);

        const monthlyTrend = [];
        if (allDates.length > 0) {
            allDates.sort((a, b) => a - b);
            const firstMonth = startOfMonth(allDates[0]);
            const lastMonth = startOfMonth(now);
            const monthInterval = eachMonthOfInterval({ start: firstMonth, end: lastMonth });
            
            const monthlyData = monthInterval.reduce((acc, month) => {
                const monthKey = format(month, 'yyyy-MM');
                acc[monthKey] = { name: format(month, 'MMM yy'), opened: 0, closed: 0 };
                return acc;
            }, {});

            records.forEach(rec => {
                if (rec.df_opened_at) {
                    const openedDate = parseISO(rec.df_opened_at);
                    if(isValid(openedDate)) {
                        const monthKey = format(openedDate, 'yyyy-MM');
                        if (monthlyData[monthKey]) monthlyData[monthKey].opened++;
                    }
                }
                if (rec.closed_at) {
                    const closedDate = parseISO(rec.closed_at);
                    if(isValid(closedDate)) {
                        const monthKey = format(closedDate, 'yyyy-MM');
                        if (monthlyData[monthKey]) monthlyData[monthKey].closed++;
                    }
                }
            });
            monthlyTrend.push(...Object.values(monthlyData));
        }

        return { kpiCards, deptPerformance, overdueRecords, requesterContribution, monthlyTrend };
    }, [records]);

    if (loading) {
        return <Skeleton className="h-64 w-full" />;
    }

    const handleCardClick = (title, records) => {
        if (onDashboardInteraction) {
            onDashboardInteraction(`${title} Kayıtları`, records);
        }
    }

    const containerVariants = { hidden: {}, visible: { transition: { staggerChildren: 0.08 } }};
    const now = new Date();

    return (
        <motion.div initial="hidden" animate="visible" variants={containerVariants} className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                {analytics.kpiCards.map(card => (
                    <motion.div key={card.title}>
                        <Card 
                          className={`shadow-sm hover:shadow-lg transition-shadow duration-300 cursor-pointer border-l-4 h-full ${card.colorClass}`}
                          onClick={() => handleCardClick(card.title, card.records)}
                        >
                          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
                              <CardTitle className="text-sm font-medium truncate">{card.title}</CardTitle>
                              {React.createElement(card.icon, { className: "h-4 w-4 text-muted-foreground flex-shrink-0"})}
                          </CardHeader>
                          <CardContent className="pt-0">
                              <div className={`font-bold ${card.isPercentage ? 'text-xl' : 'text-2xl'}`}>
                                  {card.isPercentage ? (
                                      <span>{card.value.replace('%', '')}<span className="text-sm text-muted-foreground ml-0.5">%</span></span>
                                  ) : card.value}
                              </div>
                          </CardContent>
                        </Card>
                    </motion.div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <DashboardCard title="Departman Bazlı Performans" icon={BarChart} loading={loading}>
                    <ScrollArea className="h-80 w-full">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Birim</TableHead>
                                    <TableHead className="text-center">Açık</TableHead>
                                    <TableHead className="text-center">Kapalı</TableHead>
                                    <TableHead className="text-center">Geciken</TableHead>
                                    <TableHead className="text-right">Ort. Kapatma (Gün)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {analytics.deptPerformance.map(dept => (
                                    <TableRow key={dept.unit} className="cursor-pointer hover:bg-muted/50" onClick={() => onDashboardInteraction(`${dept.unit} Kayıtları`, dept.records)}>
                                        <TableCell className="font-medium">{dept.unit}</TableCell>
                                        <TableCell className="text-center">{dept.open}</TableCell>
                                        <TableCell className="text-center">{dept.closed}</TableCell>
                                        <TableCell className="text-center font-bold text-destructive">{dept.overdue}</TableCell>
                                        <TableCell className="text-right">{dept.avgClosureTime}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </DashboardCard>

                <DashboardCard title="Talep Eden Birim Katkısı" icon={Percent} loading={loading}>
                    <ScrollArea className="h-80 w-full">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Birim</TableHead>
                                    <TableHead className="text-center">Toplam</TableHead>
                                    <TableHead className="text-center">DF</TableHead>
                                    <TableHead className="text-center">8D</TableHead>
                                    <TableHead className="text-center">MDI</TableHead>
                                    <TableHead className="text-right">Katkı %</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {analytics.requesterContribution.map(req => (
                                    <TableRow key={req.unit} className="cursor-pointer hover:bg-muted/50" onClick={() => onDashboardInteraction(`${req.unit} Talepleri`, req.records)}>
                                        <TableCell className="font-medium">{req.unit}</TableCell>
                                        <TableCell className="text-center">{req.total}</TableCell>
                                        <TableCell className="text-center">{req.DF}</TableCell>
                                        <TableCell className="text-center">{req['8D']}</TableCell>
                                        <TableCell className="text-center">{req.MDI}</TableCell>
                                        <TableCell className="text-right font-semibold">{req.contribution}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </DashboardCard>
                
                 <DashboardCard title="Aylık Trend (Açılış/Kapanış)" icon={Zap} loading={loading} className="lg:col-span-2">
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={analytics.monthlyTrend} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" fontSize={12} />
                            <YAxis allowDecimals={false} fontSize={12} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                            <Line type="monotone" dataKey="opened" name="Açılan" stroke="#3b82f6" strokeWidth={2} />
                            <Line type="monotone" dataKey="closed" name="Kapatılan" stroke="#10b981" strokeWidth={2} />
                        </LineChart>
                    </ResponsiveContainer>
                </DashboardCard>
                
                <DashboardCard title="Termin Süresi Geciken Uygunsuzluklar" icon={CalendarDays} loading={loading} className="lg:col-span-2">
                    {analytics.overdueRecords.length > 0 ? (
                        <ScrollArea className="h-80 w-full">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>No/Tip</TableHead>
                                        <TableHead>Konu</TableHead>
                                        <TableHead>Birim</TableHead>
                                        <TableHead>Termin</TableHead>
                                        <TableHead>Durum</TableHead>
                                        <TableHead className="text-right">Gecikme (Gün)</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {analytics.overdueRecords.map(rec => {
                                        const dueAt = rec.due_at ? parseISO(rec.due_at) : null;
                                        return (
                                            <TableRow key={rec.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleCardClick("Geciken", [rec])}>
                                                <TableCell><Badge variant="secondary">{rec.nc_number || rec.mdi_no}</Badge></TableCell>
                                                <TableCell className="font-medium max-w-xs truncate">{rec.title}</TableCell>
                                                <TableCell>{rec.department}</TableCell>
                                                <TableCell>{dueAt && isValid(dueAt) ? format(dueAt, 'dd.MM.yyyy') : '-'}</TableCell>
                                                <TableCell>{getStatusBadge(rec)}</TableCell>
                                                <TableCell className="text-right font-bold text-destructive">{dueAt && isValid(dueAt) ? differenceInDays(now, dueAt) : '-'}</TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    ) : <div className="text-green-600 font-semibold flex items-center justify-center h-full gap-2"><CheckCircle/>Geciken kayıt bulunmuyor.</div>}
                </DashboardCard>
            </div>
        </motion.div>
    );
};

export default NCDashboard;