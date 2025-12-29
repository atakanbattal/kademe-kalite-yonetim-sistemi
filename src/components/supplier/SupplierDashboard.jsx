import React, { useMemo, useState } from 'react';
    import { motion } from 'framer-motion';
    import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList } from 'recharts';
    import { AlertCircle, ShieldCheck, TrendingUp, Users, CalendarClock, Target, ArrowDownCircle, Lightbulb, FilePlus, CheckCircle, Printer } from 'lucide-react';
    import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
    import { Badge } from '@/components/ui/badge';
    import { ScrollArea } from '@/components/ui/scroll-area';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { Button } from '@/components/ui/button';
    import SupplierAuditPlanModal from '@/components/supplier/SupplierAuditPlanModal';
    import { useData } from '@/contexts/DataContext';
    import { openPrintableReport } from '@/lib/reportUtils';

    const StatCard = ({ icon: Icon, title, value, colorClass, description }) => (
        <Card className={`overflow-hidden border-l-4 ${colorClass}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                <Icon className={`h-5 w-5 ${colorClass.replace('border-', 'text-')}`} />
            </CardHeader>
            <CardContent>
                <p className="text-2xl font-bold text-foreground">{value}</p>
                {description && <p className="text-xs text-muted-foreground">{description}</p>}
            </CardContent>
        </Card>
    );

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-background/80 backdrop-blur-sm p-2 border border-border rounded-lg shadow-lg text-sm">
                    <p className="font-bold text-foreground">{label}</p>
                    <p className="text-destructive">{`PPM: ${data.ppm.toLocaleString()}`}</p>
                    <hr className="my-1 border-border" />
                    <p className="text-muted-foreground">{`Toplam Muayene: ${data.inspected.toLocaleString()}`}</p>
                    <p className="text-muted-foreground">{`Toplam Hatalı: ${data.defective.toLocaleString()}`}</p>
                </div>
            );
        }
        return null;
    };

    const SupplierDashboard = ({ suppliers, loading, refreshData, allSuppliers }) => {
        const { incomingInspections, nonConformities } = useData();
        const [filterDate, setFilterDate] = useState({
            month: 'all',
            year: 'all'
        });
        const [isPlanModalOpen, setPlanModalOpen] = useState(false);
        const [selectedSupplierForNewPlan, setSelectedSupplierForNewPlan] = useState(null);

        const handleFilterChange = (type, value) => {
            setFilterDate(prev => ({ ...prev, [type]: value }));
        };

        const handleOpenPlanModal = (supplier) => {
            setSelectedSupplierForNewPlan(supplier);
            setPlanModalOpen(true);
        };

        const years = useMemo(() => {
            const currentYear = new Date().getFullYear();
            return ['all', ...Array.from({ length: 5 }, (_, i) => (currentYear - i).toString())];
        }, []);

        const months = useMemo(() => [
            { value: 'all', label: 'Tüm Aylar' },
            { value: '1', label: 'Ocak' }, { value: '2', label: 'Şubat' }, { value: '3', label: 'Mart' },
            { value: '4', label: 'Nisan' }, { value: '5', label: 'Mayıs' }, { value: '6', label: 'Haziran' },
            { value: '7', label: 'Temmuz' }, { value: '8', label: 'Ağustos' }, { value: '9', label: 'Eylül' },
            { value: '10', label: 'Ekim' }, { value: '11', label: 'Kasım' }, { value: '12', label: 'Aralık' }
        ], []);

        const dashboardData = useMemo(() => {
            if (!suppliers || !incomingInspections || !nonConformities) {
                return { totalSuppliers: 0, approvedSuppliers: 0, expiringCerts: 0, highRiskSuppliers: 0, openNCs: 0, gradeDistribution: [], upcomingAudits: [], supplierPPM: [], overallPPM: 0, auditRecommendations: [] };
            }

            const thirtyDaysFromNow = new Date();
            thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
            const now = new Date();

            const expiringCerts = suppliers.filter(s =>
                s.supplier_certificates && s.supplier_certificates.some(c => c.valid_until && new Date(c.valid_until) < thirtyDaysFromNow)
            ).length;
            
            const approvedSuppliersCount = suppliers.filter(s => s.status === 'Onaylı').length;

            const openNCs = nonConformities.filter(nc => nc.supplier_id && nc.status === 'Açık').length;
            
            const gradeCounts = suppliers.reduce((acc, s) => {
                const completedAudits = (s.supplier_audit_plans || [])
                    .filter(a => a.status === 'Tamamlandı' && a.score !== null)
                    .sort((a, b) => new Date(b.actual_date || b.planned_date) - new Date(a.actual_date || a.planned_date));
                const score = completedAudits.length > 0 ? completedAudits[0].score : null;
                
                let grade = 'N/A';
                if (score !== null) {
                    if (score >= 90) grade = 'A';
                    else if (score >= 75) grade = 'B';
                    else if (score >= 60) grade = 'C';
                    else grade = 'D';
                }
                acc[grade] = (acc[grade] || 0) + 1;
                return acc;
            }, {});
            
            const gradeDistribution = [
                { name: 'A', value: gradeCounts['A'] || 0, label: 'A (Stratejik)' },
                { name: 'B', value: gradeCounts['B'] || 0, label: 'B (Güvenilir)' },
                { name: 'C', value: gradeCounts['C'] || 0, label: 'C (İzlenecek)' },
                { name: 'D', value: gradeCounts['D'] || 0, label: 'D (Riskli)' },
                { name: 'N/A', value: gradeCounts['N/A'] || 0, label: 'Değerlendirilmedi' }
            ].filter(d => d.value > 0);

            const upcomingAudits = suppliers
                .flatMap(s => 
                    (s.supplier_audit_plans || [])
                    .filter(p => p.status === 'Planlandı' && new Date(p.planned_date) >= now && new Date(p.planned_date) <= thirtyDaysFromNow)
                    .map(p => ({ ...p, supplierName: s.name }))
                )
                .sort((a, b) => new Date(a.planned_date) - new Date(b.planned_date));
                
            const filteredInspections = incomingInspections.filter(inspection => {
                if (!inspection.inspection_date) return false;
                if (filterDate.year === 'all' && filterDate.month === 'all') return true;

                const inspectionDate = new Date(inspection.inspection_date);
                const yearMatch = filterDate.year === 'all' || inspectionDate.getFullYear().toString() === filterDate.year;
                const monthMatch = filterDate.month === 'all' || (inspectionDate.getMonth() + 1).toString() === filterDate.month;
                return yearMatch && monthMatch;
            });

            let totalInspected = 0;
            let totalDefective = 0;
            const supplierPerformance = {};

            filteredInspections.forEach(inspection => {
                const inspected = Number(inspection.quantity_received) || 0;
                if (inspected === 0 || !inspection.supplier_id) return;
                
                const defective = (Number(inspection.quantity_rejected) || 0) + (Number(inspection.quantity_conditional) || 0);

                if (!supplierPerformance[inspection.supplier_id]) {
                    supplierPerformance[inspection.supplier_id] = { inspected: 0, defective: 0 };
                }
                
                supplierPerformance[inspection.supplier_id].inspected += inspected;
                supplierPerformance[inspection.supplier_id].defective += defective;
                totalInspected += inspected;
                totalDefective += defective;
            });
            
            const supplierPPMData = Object.entries(supplierPerformance)
                .map(([supplierId, data]) => {
                    const supplier = suppliers.find(s => s.id === supplierId);
                    const ppm = data.inspected > 0 ? Math.round((data.defective / data.inspected) * 1000000) : 0;
                    return {
                        id: supplierId,
                        name: supplier ? supplier.name : 'Bilinmeyen',
                        ppm,
                        inspected: data.inspected,
                        defective: data.defective
                    };
                });

            const supplierPPM = supplierPPMData
                .filter(item => item.ppm > 0)
                .sort((a, b) => b.ppm - a.ppm)
                .slice(0, 10);
            
            const overallPPM = totalInspected > 0 ? Math.round((totalDefective / totalInspected) * 1000000) : 0;

            const auditRecommendations = supplierPPMData
                .filter(s => s.ppm > 50000)
                .map(s => ({
                    ...s,
                    supplier: suppliers.find(sup => sup.id === s.id)
                }))
                .filter(s => s.supplier && !(s.supplier.supplier_audit_plans || []).some(p => p.status === 'Planlandı' && new Date(p.planned_date) > now))
                .sort((a, b) => b.ppm - a.ppm);

            return {
                totalSuppliers: suppliers.length,
                approvedSuppliers: approvedSuppliersCount,
                expiringCerts,
                openNCs,
                gradeDistribution,
                upcomingAudits,
                supplierPPM,
                overallPPM,
                auditRecommendations,
            };
        }, [suppliers, incomingInspections, nonConformities, filterDate]);

        const COLORS = { 'A': '#22c55e', 'B': '#3b82f6', 'C': '#eab308', 'D': '#ef4444', 'N/A': '#9ca3af' };
        
        if (loading) {
            return <div className="text-center p-4 text-muted-foreground">Analizler yükleniyor...</div>;
        }

        const getFilterDescription = () => {
            const monthLabel = months.find(m => m.value === filterDate.month)?.label || '';
            const yearLabel = filterDate.year === 'all' ? 'Tüm Yıllar' : filterDate.year;

            if (filterDate.year === 'all' && filterDate.month === 'all') return 'Tüm Zamanlar';
            if (filterDate.year !== 'all' && filterDate.month === 'all') return yearLabel;
            if (filterDate.year === 'all' && filterDate.month !== 'all') return `${monthLabel} (Tüm Yıllar)`;
            return `${monthLabel} ${yearLabel}`;
        };

        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ staggerChildren: 0.1 }}
            >
                <SupplierAuditPlanModal
                    isOpen={isPlanModalOpen}
                    setIsOpen={setPlanModalOpen}
                    supplier={selectedSupplierForNewPlan}
                    refreshData={refreshData}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-6">
                    <StatCard icon={Users} title="Toplam Tedarikçi" value={dashboardData.totalSuppliers} colorClass="border-blue-500" />
                    <StatCard icon={CheckCircle} title="Onaylı Tedarikçi Oranı" value={`${dashboardData.totalSuppliers > 0 ? ((dashboardData.approvedSuppliers / dashboardData.totalSuppliers) * 100).toFixed(0) : 0}%`} colorClass="border-green-500" description={`${dashboardData.approvedSuppliers} / ${dashboardData.totalSuppliers}`} />
                    <StatCard icon={AlertCircle} title="Açık Uygunsuzluk" value={dashboardData.openNCs} colorClass="border-red-500" />
                    <StatCard icon={ShieldCheck} title="Sertifika Süresi Yaklaşan" value={dashboardData.expiringCerts} colorClass="border-yellow-500" />
                    <StatCard icon={Target} title="Genel PPM" value={dashboardData.overallPPM.toLocaleString()} colorClass="border-purple-500" description={getFilterDescription()} />
                </div>

                <div className="flex justify-between items-center gap-4 mb-6">
                    <Button 
                        variant="outline" 
                        onClick={() => {
                            const reportData = {
                                id: `supplier-dashboard-${Date.now()}`,
                                title: 'Tedarikçi Kalite Genel Bakış Raporu',
                                reportDate: new Date().toISOString(),
                                dashboardData,
                                filterDescription: getFilterDescription(),
                                suppliers: allSuppliers || suppliers || []
                            };
                            openPrintableReport(reportData, 'supplier_dashboard', true);
                        }}
                    >
                        <Printer className="w-4 h-4 mr-2" />
                        PDF Rapor Oluştur
                    </Button>
                    <div className="flex gap-4">
                        <Select value={filterDate.month} onValueChange={(v) => handleFilterChange('month', v)}>
                            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Ay Seçin" /></SelectTrigger>
                            <SelectContent>
                                {months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={filterDate.year} onValueChange={(v) => handleFilterChange('year', v)}>
                            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Yıl Seçin" /></SelectTrigger>
                            <SelectContent>
                                {years.map(y => <SelectItem key={y} value={y}>{y === 'all' ? 'Tüm Yıllar' : y}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="space-y-6">
                    <Card className="dashboard-widget">
                        <CardHeader><CardTitle className="flex items-center gap-2"><ArrowDownCircle className="w-5 h-5 text-destructive"/>Tedarikçi Bazlı PPM</CardTitle></CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={400}>
                                {dashboardData.supplierPPM.length > 0 ? (
                                <BarChart data={dashboardData.supplierPPM} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <XAxis type="number" hide />
                                    <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={14} tickLine={false} axisLine={false} width={200} interval={0} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--accent))' }} />
                                    <Bar dataKey="ppm" name="PPM" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]}>
                                       <LabelList dataKey="ppm" position="right" formatter={(value) => value.toLocaleString()} style={{ fill: 'hsl(var(--foreground))', fontSize: 14 }} />
                                    </Bar>
                                </BarChart>
                                ) : (
                                    <div className="flex items-center justify-center h-full text-muted-foreground">Seçili dönem için PPM verisi bulunmamaktadır.</div>
                                )}
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                    
                    <Card className="dashboard-widget">
                        <CardHeader><CardTitle>Tedarikçi Puan Dağılımı</CardTitle></CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={350}>
                                <BarChart data={dashboardData.gradeDistribution} layout="vertical" margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" allowDecimals={false} />
                                    <YAxis type="category" dataKey="label" width={180} fontSize={14} />
                                    <Tooltip />
                                    <Bar dataKey="value" name="Tedarikçi Sayısı">
                                        {dashboardData.gradeDistribution.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[entry.name]} />
                                        ))}
                                        <LabelList dataKey="value" position="right" style={{ fontSize: 14 }} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                    <Card className="dashboard-widget">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Lightbulb className="w-5 h-5 text-yellow-400" />Akıllı Tavsiyeler: Denetim Gereken Tedarikçiler</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-56">
                                {dashboardData.auditRecommendations.length > 0 ? (
                                    <ul className="space-y-3">
                                        {dashboardData.auditRecommendations.map(rec => (
                                            <li key={rec.id} className="flex items-center justify-between text-sm p-3 rounded-md hover:bg-muted/50 border border-border">
                                                <div>
                                                    <span className="font-medium text-foreground text-base">{rec.name}</span>
                                                    <p className="text-sm text-destructive mt-1">PPM: {rec.ppm.toLocaleString()}</p>
                                                </div>
                                                <Button size="sm" onClick={() => handleOpenPlanModal(rec.supplier)}>
                                                    <FilePlus className="w-4 h-4 mr-2" /> Denetim Planla
                                                </Button>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-muted-foreground text-center pt-10">Şu anda acil denetim gerektiren bir tedarikçi bulunmuyor. Harika iş!</p>
                                )}
                            </ScrollArea>
                        </CardContent>
                    </Card>
                    
                    <Card className="dashboard-widget">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><CalendarClock className="w-5 h-5 text-primary" />Yaklaşan Denetimler (30 Gün)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-56">
                                {dashboardData.upcomingAudits.length > 0 ? (
                                    <ul className="space-y-3">
                                        {dashboardData.upcomingAudits.map(audit => (
                                            <li key={audit.id} className="flex items-center justify-between text-sm p-3 rounded-md hover:bg-muted/50 border border-border">
                                                <span className="font-medium text-foreground text-base">{audit.supplierName}</span>
                                                <Badge variant="secondary" className="text-sm">{new Date(audit.planned_date).toLocaleDateString('tr-TR')}</Badge>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-muted-foreground text-center pt-10">Yaklaşan denetim bulunmuyor.</p>
                                )}
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>
            </motion.div>
        );
    };

    export default SupplierDashboard;