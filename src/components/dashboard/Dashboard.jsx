import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
    AlertTriangle, FileText, Beaker, CheckSquare, BarChart, List, ShieldCheck, CalendarClock, TrendingUp, BookCheck, ClipboardCheck, WalletCards, FileDown
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn, normalizeTurkishForSearch } from '@/lib/utils';
import useDashboardData from '@/hooks/useDashboardData';
import { useData } from '@/contexts/DataContext';
import DashboardDetailModal, { renderNCItem, renderCostItem } from '@/components/dashboard/DashboardDetailModal';
import DetailModal from '@/components/dashboard/DetailModal';
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
import BenchmarkAnalysis from '@/components/dashboard/BenchmarkAnalysis';
import RiskBasedIndicators from '@/components/dashboard/RiskBasedIndicators';
import AIRootCausePrediction from '@/components/dashboard/AIRootCausePrediction';
import NotificationCenter from '@/components/dashboard/NotificationCenter';
import FiveSSafetyOEE from '@/components/dashboard/FiveSSafetyOEE';
import QualityAdvisor from '@/components/dashboard/QualityAdvisor';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import ErrorBoundary from '@/components/dashboard/ErrorBoundary';

const CHART_COLORS = ['#3B82F6', '#818CF8', '#A78BFA', '#F472B6', '#FBBF24', '#60A5FA'];
const PIE_COLORS = {
    'İç Hata Maliyetleri': '#EF4444',
    'Dış Hata Maliyetleri': '#F97316',
    'Önleme Maliyetleri': '#F59E0B',
    'Değerlendirme Maliyetleri': '#84CC16',
};

const StatCard = ({ icon: Icon, title, value, color, onClick, loading }) => (
    <motion.div
        whileHover={{ y: -3 }}
        whileTap={{ scale: 0.98 }}
        className="h-full"
    >
        <Card className="h-full cursor-pointer shadow-sm hover:shadow-lg transition-all duration-300 active:shadow-md touch-manipulation" onClick={onClick}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-3 sm:p-6">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground line-clamp-2">{title}</CardTitle>
                {Icon && <Icon className={`w-4 h-4 sm:w-5 sm:h-5 shrink-0 ${color || 'text-muted-foreground'}`} />}
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                {loading ? (
                    <Skeleton className="h-7 sm:h-8 w-3/4 mt-1" />
                ) : (
                    <div className={cn("text-2xl sm:text-3xl font-bold", color || 'text-foreground')}>{value}</div>
                )}
            </CardContent>
        </Card>
    </motion.div>
);


const ListWidget = ({ title, items, icon: Icon, onRowClick, emptyText, onSeeAllClick, loading }) => (
    <Card className="dashboard-widget h-full flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between pb-2 sm:pb-4 p-3 sm:p-6">
            <CardTitle className="flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base font-semibold">
                <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary shrink-0" />
                <span className="truncate">{title}</span>
            </CardTitle>
            {items && items.length > 0 && (
                <Button variant="link" size="sm" onClick={onSeeAllClick} className="p-0 h-auto text-xs sm:text-sm shrink-0">Tümünü Gör</Button>
            )}
        </CardHeader>
        <CardContent className="pt-0 flex-grow p-3 sm:p-6">
            {loading ? (
                <div className="space-y-2 sm:space-y-3">
                    {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-9 sm:h-10 w-full" />)}
                </div>
            ) : !items || items.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                    <p className="text-xs sm:text-sm text-muted-foreground text-center py-3 sm:py-4">{emptyText}</p>
                </div>
            ) : (
                <ul className="space-y-0.5 sm:space-y-1">
                    {items.slice(0, 5).map((item, index) => (
                        <li
                            key={item.id || index}
                            onClick={() => onRowClick(item.module)}
                            className="grid grid-cols-[1fr,auto] items-center gap-2 sm:gap-4 text-xs sm:text-sm p-2 rounded-md hover:bg-accent active:bg-accent transition-colors cursor-pointer touch-manipulation"
                        >
                            <div className="truncate min-w-0">
                                <p className="font-medium text-foreground truncate">{item.name}</p>
                                {item.user && <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{item.user}</p>}
                            </div>
                            {item.date && <span className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap shrink-0">{new Date(item.date).toLocaleDateString('tr-TR')}</span>}
                        </li>
                    ))}
                </ul>
            )}
        </CardContent>
    </Card>
);

const Dashboard = ({ setActiveModule, onOpenNCView }) => {
    const { toast } = useToast();
    const dashboardData = useDashboardData();
    const { kpiData, nonconformityData, costData, pendingApprovals, upcomingCalibrations, expiringDocs, completedAudits, loading, error } = dashboardData;
    const refreshDashboard = dashboardData.refreshDashboard || (() => { });
    const { nonConformities, equipments, documents, qualityCosts, refreshData } = useData();

    const [isDetailModalOpen, setDetailModalOpen] = useState(false);
    const [detailModalContent, setDetailModalContent] = useState({ title: '', records: [], renderItem: () => null });
    const [isReportModalOpen, setReportModalOpen] = useState(false);
    const [drillDownType, setDrillDownType] = useState(null); // 'df', 'quarantine', 'cost', null
    const [detailModalData, setDetailModalData] = useState({ isOpen: false, title: '', description: '', data: [], columns: [] });
    const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
    const refreshIntervalRef = useRef(null);

    // Otomatik yenileme: 5 dakikada bir
    useEffect(() => {
        if (autoRefreshEnabled) {
            refreshIntervalRef.current = setInterval(() => {
                if (refreshDashboard) {
                    refreshDashboard();
                }
                if (refreshData) {
                    refreshData();
                }
            }, 5 * 60 * 1000); // 5 dakika
        }

        return () => {
            if (refreshIntervalRef.current) {
                clearInterval(refreshIntervalRef.current);
            }
        };
    }, [autoRefreshEnabled, refreshDashboard, refreshData]);

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
        if (data && data.payload && data.payload.records && data.payload.records.length > 0) {
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
        return (
            <div className="p-6">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h2 className="text-lg font-semibold text-red-800 mb-2">Dashboard Yüklenirken Hata Oluştu</h2>
                    <p className="text-red-700">{error}</p>
                    <Button
                        onClick={() => window.location.reload()}
                        className="mt-4"
                        variant="destructive"
                    >
                        Sayfayı Yenile
                    </Button>
                </div>
            </div>
        );
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
            <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-4">
                <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-foreground">Ana Panel</h1>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">Tüm kalite süreçlerinize genel bir bakış.</p>
                </div>
                <Button onClick={() => setReportModalOpen(true)} size="sm" className="shrink-0 w-full sm:w-auto">
                    <FileDown className="w-4 h-4 mr-2" /> Rapor Al
                </Button>
            </div>

            {/* Bildirim Merkezi - Üstte Görünür */}
            <motion.div variants={itemVariants}>
                <ErrorBoundary componentName="Bildirim Merkezi">
                    <NotificationCenter />
                </ErrorBoundary>
            </motion.div>

            {/* Kalite Sistem Danışmanı - AI Destekli Analiz */}
            <motion.div variants={itemVariants}>
                <ErrorBoundary componentName="Kalite Danışmanı">
                    <QualityAdvisor onNavigate={(module) => {
                        // Modül navigasyonu için callback
                        console.log('Navigate to module:', module);
                    }} />
                </ErrorBoundary>
            </motion.div>

            <motion.div
                className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4"
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

            <motion.div variants={itemVariants}>
                <Card className="dashboard-widget h-full">
                    <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-4">
                        <CardTitle className="text-sm sm:text-base md:text-lg">Birim Bazlı Uygunsuzluk Dağılımı</CardTitle>
                    </CardHeader>
                    <CardContent className="p-2 sm:p-6 pt-0">
                        {loading ? <Skeleton className="h-[200px] sm:h-[250px] md:h-[300px] w-full" /> : (
                            <ResponsiveContainer width="100%" height={window.innerWidth < 640 ? 200 : window.innerWidth < 768 ? 250 : 350}>
                                <RechartsBarChart data={nonconformityData || []} margin={{ top: 5, right: 10, left: 10, bottom: 60 }}>
                                    <XAxis
                                        dataKey="name"
                                        stroke="hsl(var(--muted-foreground))"
                                        fontSize={window.innerWidth < 640 ? 9 : 11}
                                        tickLine={false}
                                        axisLine={false}
                                        interval={0}
                                        angle={-45}
                                        textAnchor="end"
                                        height={80}
                                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                                    />
                                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={window.innerWidth < 640 ? 10 : 12} tickLine={false} axisLine={false} width={40} />
                                    <Tooltip cursor={{ fill: 'hsl(var(--accent))' }} contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '0.5rem', fontSize: '12px' }} />
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

            {/* Gerçek Zamanlı Uyarılar */}
            <motion.div variants={itemVariants}>
                <ErrorBoundary componentName="Gerçek Zamanlı Uyarılar">
                    <DashboardAlerts onAlertClick={(type, data) => {
                        if (type === 'overdue-nc-detail' && data) {
                            // Tek bir kayıt detayını doğrudan aç
                            if (onOpenNCView && data.id) {
                                onOpenNCView(data);
                            } else {
                                handleCardClick('df-8d');
                            }
                        } else if (type === 'overdue-nc') {
                            setDetailModalData({
                                isOpen: true,
                                title: '30+ Gün Açık DF/8D Kayıtları',
                                description: `${data.length} adet geciken kayıt bulundu`,
                                data: data,
                                columns: [
                                    { key: 'nc_number', label: 'Kayıt No' },
                                    { key: 'title', label: 'Başlık' },
                                    { key: 'department', label: 'Sorumlu Birim' },
                                    {
                                        key: 'daysOverdue',
                                        label: 'Gecikme (Gün)',
                                        render: (row) => <span className="font-semibold text-red-600">{row.daysOverdue}</span>
                                    },
                                    { key: 'status', label: 'Durum' }
                                ],
                                onRowClick: (row) => {
                                    // Satıra tıklandığında kaydı doğrudan aç
                                    if (onOpenNCView && row.id) {
                                        setDetailModalData(prev => ({ ...prev, isOpen: false }));
                                        onOpenNCView(row);
                                    } else {
                                        handleCardClick('df-8d');
                                    }
                                }
                            });
                        } else if (type === 'overdue-calibration-detail' && data) {
                            // Tek bir kalibrasyon detayı göster
                            handleCardClick('equipment');
                        } else if (type === 'overdue-calibration') {
                            setDetailModalData({
                                isOpen: true,
                                title: 'Geciken Kalibrasyonlar',
                                description: `${data.length} adet geciken kalibrasyon bulundu`,
                                data: data,
                                columns: [
                                    { key: 'equipment', label: 'Ekipman Adı' },
                                    {
                                        key: 'dueDate',
                                        label: 'Son Geçerlilik',
                                        render: (row) => format(new Date(row.dueDate), 'dd.MM.yyyy', { locale: tr })
                                    },
                                    {
                                        key: 'daysOverdue',
                                        label: 'Gecikme (Gün)',
                                        render: (row) => <span className="font-semibold text-red-600">{row.daysOverdue}</span>
                                    }
                                ],
                                onRowClick: (row) => handleCardClick('equipment')
                            });
                        } else if (type === 'expiring-docs-detail' && data) {
                            // Tek bir doküman detayı göster
                            handleCardClick('document');
                        } else if (type === 'expiring-docs') {
                            setDetailModalData({
                                isOpen: true,
                                title: 'Geçerliliği Dolacak Dokümanlar',
                                description: `${data.length} adet doküman yakında geçerliliğini yitirecek`,
                                data: data,
                                columns: [
                                    { key: 'name', label: 'Doküman Adı' },
                                    {
                                        key: 'valid_until',
                                        label: 'Son Geçerlilik',
                                        render: (row) => format(new Date(row.valid_until), 'dd.MM.yyyy', { locale: tr })
                                    },
                                    {
                                        key: 'daysRemaining',
                                        label: 'Kalan Gün',
                                        render: (row) => <span className="font-semibold text-yellow-600">{row.daysRemaining}</span>
                                    }
                                ],
                                onRowClick: (row) => handleCardClick('document')
                            });
                        } else if (type === 'cost-anomaly') {
                            // Maliyet anomalisi için detaylı analiz modalı veya drill-down
                            if (data && data.length > 0) {
                                setDrillDownType('cost');
                            } else {
                                handleCardClick('quality-cost');
                            }
                        }
                    }} />
                </ErrorBoundary>
            </motion.div>

            {/* Bu Ayın Trendleri */}
            <motion.div variants={itemVariants}>
                <ErrorBoundary componentName="Bu Ayın Trendleri">
                    <DashboardTrends />
                </ErrorBoundary>
            </motion.div>

            {/* Bugünün Görevleri */}
            <motion.div variants={itemVariants}>
                <ErrorBoundary componentName="Bugünün Görevleri">
                    <TodayTasks onTaskClick={(type, data) => {
                        if (type === 'overdue-8d') {
                            setDetailModalData({
                                isOpen: true,
                                title: 'Bugün Kapanması Gereken 8D Kayıtları',
                                description: `${data.length} adet 8D kaydı bugün kapanması gerekiyor`,
                                data: data,
                                columns: [
                                    { key: 'nc_number', label: 'Kayıt No' },
                                    { key: 'title', label: 'Başlık' },
                                    { key: 'department', label: 'Sorumlu Birim' },
                                    {
                                        key: 'target_close_date',
                                        label: 'Hedef Kapanış',
                                        render: (row) => format(new Date(row.target_close_date), 'dd.MM.yyyy', { locale: tr })
                                    },
                                    {
                                        key: 'daysOverdue',
                                        label: 'Gecikme',
                                        render: (row) => row.isOverdue ? (
                                            <span className="font-semibold text-red-600">{row.daysOverdue} gün</span>
                                        ) : (
                                            <span className="text-green-600">Bugün</span>
                                        )
                                    }
                                ],
                                onRowClick: (row) => {
                                    if (onOpenNCView && row.id) {
                                        setDetailModalData(prev => ({ ...prev, isOpen: false }));
                                        onOpenNCView(row);
                                    } else {
                                        handleCardClick('df-8d');
                                    }
                                }
                            });
                        } else if (type === 'due-calibration') {
                            setDetailModalData({
                                isOpen: true,
                                title: 'Bugün Kalibrasyonu Dolan Cihazlar',
                                description: `${data.length} adet cihazın kalibrasyonu bugün doluyor`,
                                data: data,
                                columns: [
                                    { key: 'equipment', label: 'Ekipman Adı' },
                                    {
                                        key: 'dueDate',
                                        label: 'Son Geçerlilik',
                                        render: (row) => format(new Date(row.dueDate), 'dd.MM.yyyy', { locale: tr })
                                    },
                                    {
                                        key: 'daysOverdue',
                                        label: 'Durum',
                                        render: (row) => row.isOverdue ? (
                                            <span className="font-semibold text-red-600">{row.daysOverdue} gün gecikme</span>
                                        ) : (
                                            <span className="text-green-600">Bugün</span>
                                        )
                                    }
                                ],
                                onRowClick: (row) => handleCardClick('equipment')
                            });
                        }
                    }} />
                </ErrorBoundary>
            </motion.div>

            {/* 5 En Kritik Uygunsuzluk */}
            <motion.div variants={itemVariants}>
                <ErrorBoundary componentName="Kritik Uygunsuzluklar">
                    <CriticalNonConformities onViewDetails={(nc) => {
                        if (nc && nc.id) {
                            setDetailModalData({
                                isOpen: true,
                                title: `Uygunsuzluk Detayı - ${nc.nc_number || nc.mdi_no || 'N/A'}`,
                                description: nc.title || 'Detay bilgisi',
                                data: [nc],
                                columns: [
                                    { key: 'nc_number', label: 'Kayıt No' },
                                    { key: 'title', label: 'Başlık' },
                                    { key: 'type', label: 'Tip' },
                                    { key: 'status', label: 'Durum' },
                                    { key: 'department', label: 'Sorumlu Birim' },
                                    {
                                        key: 'severity',
                                        label: 'Şiddet',
                                        render: (row) => row.severity || '-'
                                    },
                                    {
                                        key: 'opening_date',
                                        label: 'Açılış Tarihi',
                                        render: (row) => row.opening_date ? format(new Date(row.opening_date), 'dd.MM.yyyy', { locale: tr }) : '-'
                                    }
                                ],
                                onRowClick: (row) => {
                                    if (onOpenNCView && row.id) {
                                        setDetailModalData(prev => ({ ...prev, isOpen: false }));
                                        onOpenNCView(row);
                                    } else {
                                        handleCardClick('df-8d');
                                    }
                                }
                            });
                        } else {
                            handleCardClick('df-8d');
                        }
                    }} />
                </ErrorBoundary>
            </motion.div>

            {/* Kalite Duvarı */}
            <motion.div variants={itemVariants}>
                <ErrorBoundary componentName="Kalite Duvarı">
                    <QualityWall />
                </ErrorBoundary>
            </motion.div>

            {/* Kök Neden Isı Haritası */}
            <motion.div variants={itemVariants}>
                <ErrorBoundary componentName="Kök Neden Isı Haritası">
                    <RootCauseHeatmap onDeptClick={(deptName) => {
                        const normalizedDeptName = normalizeTurkishForSearch(deptName.trim().toLowerCase());
                        const deptNCs = (nonConformities || []).filter(nc => {
                            const ncDept = nc.requesting_unit || nc.department;
                            if (!ncDept) return false;
                            const normalizedNcDept = normalizeTurkishForSearch(String(ncDept).trim().toLowerCase());
                            return normalizedNcDept === normalizedDeptName;
                        });
                        setDetailModalData({
                            isOpen: true,
                            title: `${deptName} - Uygunsuzluk Detayları`,
                            description: `${deptNCs.length} adet uygunsuzluk kaydı bulundu`,
                            data: deptNCs,
                            columns: [
                                { key: 'nc_number', label: 'Kayıt No' },
                                { key: 'title', label: 'Başlık' },
                                { key: 'type', label: 'Tip' },
                                { key: 'status', label: 'Durum' },
                                {
                                    key: 'severity',
                                    label: 'Şiddet',
                                    render: (row) => row.severity || '-'
                                },
                                {
                                    key: 'opening_date',
                                    label: 'Açılış Tarihi',
                                    render: (row) => row.opening_date ? format(new Date(row.opening_date), 'dd.MM.yyyy', { locale: tr }) : '-'
                                }
                            ],
                            onRowClick: (row) => {
                                if (onOpenNCView && row.id) {
                                    setDetailModalData(prev => ({ ...prev, isOpen: false }));
                                    onOpenNCView(row);
                                } else {
                                    handleCardClick('df-8d');
                                }
                            }
                        });
                    }} />
                </ErrorBoundary>
            </motion.div>

            {/* Kalite Hedefleri Paneli */}
            <motion.div variants={itemVariants}>
                <ErrorBoundary componentName="Kalite Hedefleri">
                    <QualityGoalsPanel />
                </ErrorBoundary>
            </motion.div>

            {/* Benchmark Analizi */}
            <motion.div variants={itemVariants}>
                <ErrorBoundary componentName="Benchmark Analizi">
                    <BenchmarkAnalysis />
                </ErrorBoundary>
            </motion.div>

            {/* Risk Bazlı Göstergeler */}
            <motion.div variants={itemVariants}>
                <ErrorBoundary componentName="Risk Göstergeleri">
                    <RiskBasedIndicators />
                </ErrorBoundary>
            </motion.div>

            {/* AI Destekli Kök Neden Tahmin */}
            <motion.div variants={itemVariants}>
                <ErrorBoundary componentName="AI Kök Neden Tahmin">
                    <AIRootCausePrediction />
                </ErrorBoundary>
            </motion.div>

            {/* 5S - İş Güvenliği - OEE */}
            <motion.div variants={itemVariants}>
                <ErrorBoundary componentName="5S - İş Güvenliği - OEE">
                    <FiveSSafetyOEE />
                </ErrorBoundary>
            </motion.div>

            <motion.div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6"
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

            {/* Detay Modal */}
            <DetailModal
                isOpen={detailModalData.isOpen}
                onClose={() => setDetailModalData({ ...detailModalData, isOpen: false })}
                title={detailModalData.title}
                description={detailModalData.description}
                data={detailModalData.data}
                columns={detailModalData.columns}
                onRowClick={detailModalData.onRowClick}
            />
        </div>
    );
};

export default Dashboard;