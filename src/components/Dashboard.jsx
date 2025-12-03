import React, { useState, useCallback } from 'react';
    import { motion } from 'framer-motion';
    import { 
        AlertTriangle, FileText, Beaker, CheckSquare, BarChart, List, ShieldCheck, CalendarClock, TrendingUp, BookCheck, ClipboardCheck, WalletCards, FileDown
    } from 'lucide-react';
    import { useToast } from '@/components/ui/use-toast';
    import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
    import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
    import { Skeleton } from '@/components/ui/skeleton';
    import { Button } from '@/components/ui/button';
    import { cn } from '@/lib/utils';
    import useDashboardData from '@/hooks/useDashboardData';
    import DashboardDetailModal, { renderNCItem, renderCostItem } from '@/components/dashboard/DashboardDetailModal';
    import ReportGenerationModalEnhanced from '@/components/dashboard/ReportGenerationModalEnhanced';
    import DFDrillDownAnalysis from '@/components/dashboard/DFDrillDownAnalysis';
    import QuarantineDrillDownAnalysis from '@/components/dashboard/QuarantineDrillDownAnalysis';
    import CostDrillDownAnalysis from '@/components/dashboard/CostDrillDownAnalysis';
    import DashboardAlerts from '@/components/dashboard/DashboardAlerts';
    import DashboardTrends from '@/components/dashboard/DashboardTrends';
    import TodayTasks from '@/components/dashboard/TodayTasks';
    import CriticalNonConformities from '@/components/dashboard/CriticalNonConformities';
    import QualityWall from '@/components/dashboard/QualityWall';
    import RootCauseHeatmap from '@/components/dashboard/RootCauseHeatmap';
    import QualityGoalsPanel from '@/components/dashboard/QualityGoalsPanel';
    import { Dialog, DialogContent } from '@/components/ui/dialog';

    const CHART_COLORS = ['#3B82F6', '#818CF8', '#A78BFA', '#F472B6', '#FBBF24', '#60A5FA'];
    const PIE_COLORS = {
        'İç Hata Maliyetleri': '#EF4444',
        'Dış Hata Maliyetleri': '#F97316',
        'Önleme Maliyetleri': '#F59E0B',
        'Değerlendirme Maliyetleri': '#84CC16',
    };

    const StatCard = ({ icon: Icon, title, value, color, onClick, loading }) => (
        <motion.div
            whileHover={{ y: -5, boxShadow: '0 10px 15px -3px hsla(var(--card-foreground), 0.07), 0 4px 6px -2px hsla(var(--card-foreground), 0.04)' }}
            className="h-full"
        >
            <Card className="h-full cursor-pointer shadow-sm hover:shadow-lg transition-all duration-300" onClick={onClick}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                    {Icon && <Icon className={`w-5 h-5 ${color || 'text-muted-foreground'}`} />}
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <Skeleton className="h-8 w-3/4 mt-1" />
                    ) : (
                        <div className={cn("text-3xl font-bold", color || 'text-foreground')}>{value}</div>
                    )}
                </CardContent>
            </Card>
        </motion.div>
    );


    const ListWidget = ({ title, items, icon: Icon, onRowClick, emptyText, onSeeAllClick, loading }) => (
        <Card className="dashboard-widget h-full flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <Icon className="w-5 h-5 text-primary" />
                    {title}
                </CardTitle>
                {items && items.length > 0 && (
                     <Button variant="link" size="sm" onClick={onSeeAllClick} className="p-0 h-auto">Tümünü Gör</Button>
                )}
            </CardHeader>
            <CardContent className="pt-0 flex-grow">
                {loading ? (
                     <div className="space-y-3">
                        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                     </div>
                ) : !items || items.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-sm text-muted-foreground text-center py-4">{emptyText}</p>
                    </div>
                ) : (
                    <ul className="space-y-1">
                        {items.slice(0, 5).map((item, index) => (
                            <li 
                                key={item.id || index}
                                onClick={() => onRowClick(item.module)}
                                className="grid grid-cols-[1fr,auto] items-center gap-4 text-sm p-2 rounded-md hover:bg-accent transition-colors cursor-pointer"
                            >
                                <div className="truncate">
                                    <p className="font-medium text-foreground truncate">{item.name}</p>
                                    {item.user && <p className="text-xs text-muted-foreground truncate">{item.user}</p>}
                                </div>
                                {item.date && <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(item.date).toLocaleDateString('tr-TR')}</span>}
                            </li>
                        ))}
                    </ul>
                )}
            </CardContent>
        </Card>
    );

    const Dashboard = ({ setActiveModule }) => {
        const { toast } = useToast();
        const { kpiData, nonconformityData, costData, pendingApprovals, upcomingCalibrations, expiringDocs, completedAudits, loading, error } = useDashboardData();
        
        const [isDetailModalOpen, setDetailModalOpen] = useState(false);
        const [detailModalContent, setDetailModalContent] = useState({ title: '', records: [], renderItem: () => null });
        const [isReportModalOpen, setReportModalOpen] = useState(false);
        const [drillDownType, setDrillDownType] = useState(null); // 'df', 'quarantine', 'cost', null

        const handleCardClick = useCallback((module, kpiTitle) => {
            // KPI kartlarına özel drill-down analizleri
            if (kpiTitle) {
                if (kpiTitle.includes('DF')) {
                    setDrillDownType('df');
                    return;
                } else if (kpiTitle.includes('Karantina')) {
                    setDrillDownType('quarantine');
                    return;
                } else if (kpiTitle.includes('Maliyet')) {
                    setDrillDownType('cost');
                    return;
                }
            }
            
            // Diğer modüller için normal yönlendirme
            if (module) {
                setActiveModule(module);
            } else {
                toast({
                    title: "🚧 Özellik Henüz Geliştirilmedi!",
                    description: "Bu özellik yakında gelecek. Takipte kalın! 🚀",
                });
            }
        }, [setActiveModule, toast]);
        
        const handleChartClick = (data) => {
            if(data && data.payload && data.payload.records && data.payload.records.length > 0) {
                const isCost = !!data.payload.records[0].cost_date;
                setDetailModalContent({ 
                    title: data.name, 
                    records: data.payload.records, 
                    renderItem: isCost ? renderCostItem : renderNCItem
                });
                setDetailModalOpen(true);
            }
        };

        const getIconForKpi = (title) => {
            if (title.includes('DF')) return AlertTriangle;
            if (title.includes('8D')) return FileText;
            if (title.includes('Karantina')) return Beaker;
            if (title.includes('Maliyet')) return WalletCards;
            return BarChart;
        }

        const containerVariants = {
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
        };
        
        const itemVariants = {
            hidden: { y: 20, opacity: 0 },
            visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 100 } }
        };

        if (error) {
            return <div className="text-red-500">Hata: {error}</div>
        }

        return (
            <div className="space-y-6 sm:space-y-8">
                {/* Drill-Down Analiz Modalleri */}
                <Dialog open={drillDownType === 'df'} onOpenChange={(open) => !open && setDrillDownType(null)}>
                    <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
                        <DFDrillDownAnalysis onClose={() => setDrillDownType(null)} />
                    </DialogContent>
                </Dialog>
                
                <Dialog open={drillDownType === 'quarantine'} onOpenChange={(open) => !open && setDrillDownType(null)}>
                    <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
                        <QuarantineDrillDownAnalysis onClose={() => setDrillDownType(null)} />
                    </DialogContent>
                </Dialog>
                
                <Dialog open={drillDownType === 'cost'} onOpenChange={(open) => !open && setDrillDownType(null)}>
                    <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
                        <CostDrillDownAnalysis onClose={() => setDrillDownType(null)} />
                    </DialogContent>
                </Dialog>

                <DashboardDetailModal 
                    isOpen={isDetailModalOpen} 
                    setIsOpen={setDetailModalOpen}
                    title={detailModalContent.title}
                    records={detailModalContent.records}
                    renderItem={detailModalContent.renderItem}
                    onRowClick={(item) => handleCardClick(item.module)}
                />
                <ReportGenerationModalEnhanced isOpen={isReportModalOpen} setIsOpen={setReportModalOpen} />
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">Ana Panel</h1>
                        <p className="text-muted-foreground mt-1">Tüm kalite süreçlerinize genel bir bakış.</p>
                    </div>
                    <Button onClick={() => setReportModalOpen(true)}>
                        <FileDown className="w-4 h-4 mr-2" /> Rapor Al
                    </Button>
                </div>

                <motion.div 
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                >
                    {(kpiData || []).map((item, index) => (
                        <motion.div key={index} variants={itemVariants}>
                            <StatCard 
                                icon={getIconForKpi(item.title)} 
                                title={item.title} 
                                value={item.value} 
                                color={item.title.includes('Maliyet') ? 'text-red-500' : 'text-primary'}
                                loading={loading}
                                onClick={() => handleCardClick(item.module, item.title)}
                            />
                        </motion.div>
                    ))}
                </motion.div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 sm:gap-8">
                    <motion.div variants={itemVariants} className="lg:col-span-3">
                        <Card className="dashboard-widget h-full">
                            <CardHeader>
                                <CardTitle>Birim Bazlı Uygunsuzluk Dağılımı</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {loading ? <Skeleton className="h-[300px] w-full" /> : (
                                    <ResponsiveContainer width="100%" height={300}>
                                        <RechartsBarChart data={nonconformityData || []} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                            <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                                            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                                            <Tooltip cursor={{ fill: 'hsl(var(--accent))' }} contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '0.5rem' }} />
                                            <Bar dataKey="value" name="Uygunsuzluk Sayısı" radius={[4, 4, 0, 0]} onClick={handleChartClick}>
                                                {(nonconformityData || []).map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} className="cursor-pointer" />
                                                ))}
                                            </Bar>
                                        </RechartsBarChart>
                                    </ResponsiveContainer>
                                )}
                            </CardContent>
                        </Card>
                    </motion.div>

                    <motion.div variants={itemVariants} className="lg:col-span-2">
                        <Card className="dashboard-widget h-full">
                            <CardHeader>
                                <CardTitle>Toplam Kalitesizlik Maliyetleri Dağılımı</CardTitle>
                            </CardHeader>
                            <CardContent>
                               {loading ? <Skeleton className="h-[300px] w-full" /> : (
                                   <ResponsiveContainer width="100%" height={300}>
                                        <PieChart>
                                            <Pie data={costData || []} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} fill="#8884d8" paddingAngle={5} labelLine={false} onClick={handleChartClick}>
                                                {(costData || []).map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={PIE_COLORS[entry.name] || CHART_COLORS[index % CHART_COLORS.length]} className="cursor-pointer" />
                                                ))}
                                            </Pie>
                                            <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '0.5rem' }} formatter={(value) => `${value.toLocaleString('tr-TR')} ₺`} />
                                            <Legend iconSize={10} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                )}
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>
                
                {/* Gerçek Zamanlı Uyarılar */}
                <motion.div variants={itemVariants}>
                    <DashboardAlerts onAlertClick={(type, data) => {
                        if (type === 'overdue-nc') handleCardClick('df-8d');
                        else if (type === 'overdue-calibration' || type === 'expiring-docs') handleCardClick('equipment');
                        else if (type === 'cost-anomaly') handleCardClick('quality-cost');
                    }} />
                </motion.div>

                {/* Bu Ayın Trendleri */}
                <motion.div variants={itemVariants}>
                    <DashboardTrends />
                </motion.div>

                {/* Bugünün Görevleri */}
                <motion.div variants={itemVariants}>
                    <TodayTasks onTaskClick={(type, data) => {
                        if (type === 'overdue-8d') handleCardClick('df-8d');
                        else if (type === 'due-calibration') handleCardClick('equipment');
                    }} />
                </motion.div>

                {/* 5 En Kritik Uygunsuzluk */}
                <motion.div variants={itemVariants}>
                    <CriticalNonConformities onViewDetails={(nc) => handleCardClick('df-8d')} />
                </motion.div>

                {/* Kalite Duvarı */}
                <motion.div variants={itemVariants}>
                    <QualityWall />
                </motion.div>

                {/* Kök Neden Isı Haritası */}
                <motion.div variants={itemVariants}>
                    <RootCauseHeatmap />
                </motion.div>

                {/* Kalite Hedefleri Paneli */}
                <motion.div variants={itemVariants}>
                    <QualityGoalsPanel />
                </motion.div>

                {/* Benchmark Analizi */}
                <motion.div variants={itemVariants}>
                    <BenchmarkAnalysis />
                </motion.div>

                {/* Risk Bazlı Göstergeler */}
                <motion.div variants={itemVariants}>
                    <RiskBasedIndicators />
                </motion.div>

                {/* AI Destekli Kök Neden Tahmin */}
                <motion.div variants={itemVariants}>
                    <AIRootCausePrediction />
                </motion.div>

                {/* 5S - İş Güvenliği - OEE */}
                <motion.div variants={itemVariants}>
                    <FiveSSafetyOEE />
                </motion.div>

                {/* Bildirim Merkezi */}
                <motion.div variants={itemVariants}>
                    <NotificationCenter />
                </motion.div>

                <motion.div 
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8"
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                >
                    <motion.div variants={itemVariants}>
                        <ListWidget 
                            title="Yaklaşan Kalibrasyonlar" 
                            items={upcomingCalibrations || []} 
                            icon={CalendarClock} 
                            onRowClick={handleCardClick}
                            onSeeAllClick={() => handleCardClick('equipment')}
                            emptyText="Yaklaşan kalibrasyon bulunmuyor."
                            loading={loading}
                        />
                    </motion.div>
                    <motion.div variants={itemVariants}>
                        <ListWidget 
                            title="Yaklaşan Dok. Son Geçerlilik" 
                            items={expiringDocs || []} 
                            icon={BookCheck} 
                            onRowClick={handleCardClick}
                            onSeeAllClick={() => handleCardClick('document')}
                            emptyText="Yaklaşan doküman tarihi yok."
                            loading={loading}
                        />
                    </motion.div>
                     <motion.div variants={itemVariants}>
                        <ListWidget 
                            title="Bu Ay Tamamlanan Tetkikler" 
                            items={completedAudits || []} 
                            icon={ClipboardCheck} 
                            onRowClick={handleCardClick}
                            onSeeAllClick={() => handleCardClick('internal-audit')}
                            emptyText="Bu ay tetkik tamamlanmamış."
                            loading={loading}
                        />
                    </motion.div>
                    <motion.div variants={itemVariants}>
                        <ListWidget 
                            title="Bekleyen Onaylar" 
                            items={pendingApprovals || []} 
                            icon={ShieldCheck} 
                            onRowClick={handleCardClick}
                            onSeeAllClick={() => handleCardClick('deviation')}
                            emptyText="Onayınızı bekleyen bir işlem yok."
                            loading={loading}
                        />
                    </motion.div>
                </motion.div>
            </div>
        );
    };

    export default Dashboard;