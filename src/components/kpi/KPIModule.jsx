import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus, RefreshCw, Search, CheckCircle2, AlertCircle,
    TrendingUp, BarChart3, Target, Zap, Clock, FileSpreadsheet, Presentation, Filter,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import AddKpiModal from '@/components/kpi/AddKpiModal';
import KPIDetailModalEnhanced from '@/components/kpi/KPIDetailModalEnhanced';
import KPICard from '@/components/kpi/KPICard';
import KpiReportSelectModal from '@/components/kpi/KpiReportSelectModal';
import { useData } from '@/contexts/DataContext';
import { KPI_CATEGORIES, getAutoKpiDisplayMeta } from '@/components/kpi/kpi-definitions';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { supabase } from '@/lib/customSupabaseClient';
import { openPrintableReport } from '@/lib/reportUtils';
import { buildKpiReportPerformanceFromMonthly, getKpiMeetsTarget } from '@/lib/kpiReportStats';

// =====================================================
// Summary Card - üst istatistik kartları
// =====================================================
const SummaryCard = ({ label, value, icon: Icon, colorClass, bgClass }) => (
    <div className={`flex items-center gap-3 rounded-xl border p-4 ${bgClass}`}>
        <div className={`p-2 rounded-lg bg-white/60 dark:bg-black/20 ${colorClass}`}>
            <Icon className="w-5 h-5" />
        </div>
        <div>
            <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
        </div>
    </div>
);

// =====================================================
// Ana Modül
// =====================================================
const KPIModule = ({ onOpenNCForm }) => {
    const { kpis, loading, refreshKpis, refreshAutoKpis } = useData();
    const { toast } = useToast();
    const [isAddModalOpen, setAddModalOpen] = useState(false);
    const [isDetailModalOpen, setDetailModalOpen] = useState(false);
    const [selectedKpi, setSelectedKpi] = useState(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [activeCategory, setActiveCategory] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [lastSyncTime, setLastSyncTime] = useState(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [reportModalOpen, setReportModalOpen] = useState(false);
    const [reportGenerating, setReportGenerating] = useState(false);

    // Sayfa açıldığında otomatik KPI'ları güncelle + aylık veri backfill
    useEffect(() => {
        const updateAutoKpis = async () => {
            if (kpis.length > 0 && kpis.some(k => k.is_auto)) {
                setIsSyncing(true);
                await refreshAutoKpis();
                setLastSyncTime(new Date());
                setIsSyncing(false);
            }
        };
        updateAutoKpis();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Filtrelenmiş KPI listesi
    const filteredKpis = useMemo(() => {
        let list = kpis;
        if (activeCategory !== 'all') {
            list = list.filter(k => (k.category || 'default') === activeCategory);
        }
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            list = list.filter((k) => {
                const d = getAutoKpiDisplayMeta(k);
                return (
                    d.name?.toLowerCase().includes(term) ||
                    k.name?.toLowerCase().includes(term) ||
                    d.data_source?.toLowerCase().includes(term) ||
                    k.data_source?.toLowerCase().includes(term) ||
                    d.description?.toLowerCase().includes(term) ||
                    k.description?.toLowerCase().includes(term)
                );
            });
        }
        return list;
    }, [kpis, activeCategory, searchTerm]);

    // Kategori bazlı KPI sayıları
    const categoryCounts = useMemo(() => {
        const counts = { all: kpis.length };
        KPI_CATEGORIES.filter(c => c.id !== 'all').forEach(cat => {
            counts[cat.id] = kpis.filter(k => (k.category || 'default') === cat.id).length;
        });
        return counts;
    }, [kpis]);

    // Özet istatistikler
    const summaryStats = useMemo(() => {
        const withTarget = kpis.filter(k =>
            k.current_value !== null && k.target_value != null
        );
        const onTarget = withTarget.filter(k => {
            const c = parseFloat(k.current_value), t = parseFloat(k.target_value);
            const dir = getAutoKpiDisplayMeta(k).target_direction ?? 'decrease';
            return dir === 'decrease' ? c <= t : c >= t;
        });
        const noData = kpis.filter(k => k.current_value === null || k.current_value === undefined);
        const critical = withTarget.filter(k => {
            const c = parseFloat(k.current_value), t = parseFloat(k.target_value);
            const dir = getAutoKpiDisplayMeta(k).target_direction ?? 'decrease';
            const ok = dir === 'decrease' ? c <= t : c >= t;
            if (ok || t === 0) return false;
            return Math.abs((c - t) / t * 100) > 20;
        });
        return {
            total: kpis.length,
            onTarget: onTarget.length,
            critical: critical.length,
            noData: noData.length,
            onTargetRate: withTarget.length > 0
                ? Math.round(onTarget.length / withTarget.length * 100)
                : null,
        };
    }, [kpis]);

    const handleCardClick = (kpi) => {
        setSelectedKpi(kpi);
        setDetailModalOpen(true);
    };

    /** Rapor modalında varsayılan: mevcut ekran filtresindeki KPI’lar */
    const defaultReportSelectedIds = useMemo(
        () => filteredKpis.map((k) => k.id),
        [filteredKpis]
    );

    const runKpiListReport = useCallback(async (kpiList) => {
        if (!kpiList?.length) {
            toast({ variant: 'destructive', title: 'Rapor', description: 'En az bir KPI seçin.' });
            return;
        }
        setReportGenerating(true);
        try {
            const ids = kpiList.map((k) => k.id);
            const monthlyByKpi = new Map();
            const { data: monthlyRows, error } = await supabase
                .from('kpi_monthly_data')
                .select('kpi_id, year, month, actual_value')
                .in('kpi_id', ids);
            if (error) throw error;
            for (const row of monthlyRows || []) {
                if (!monthlyByKpi.has(row.kpi_id)) monthlyByKpi.set(row.kpi_id, []);
                monthlyByKpi.get(row.kpi_id).push(row);
            }

            const items = kpiList.map((k) => {
                const d = getAutoKpiDisplayMeta(k);
                const catId = d.category ?? k.category;
                const category_label = KPI_CATEGORIES.find((c) => c.id === catId)?.label
                    ?? (catId && catId !== 'default' ? String(catId) : 'Genel');
                const rows = monthlyByKpi.get(k.id) || [];
                const perf = buildKpiReportPerformanceFromMonthly(
                    rows,
                    d.target_direction ?? k.target_direction ?? 'decrease',
                    k.unit
                );
                return {
                    name: d.name,
                    category: catId,
                    category_label,
                    target_value: k.target_value,
                    current_value: k.current_value,
                    unit: k.unit,
                    target_direction: d.target_direction ?? k.target_direction ?? 'decrease',
                    performance_lines: perf.performance_lines,
                    meets_target: getKpiMeetsTarget(k),
                };
            });

            const filterParts = [`Seçilen: ${kpiList.length} KPI`];
            openPrintableReport(
                {
                    id: `kpi-list-${Date.now()}`,
                    title: 'KPI Performans Raporu (Yönetim Özeti)',
                    items,
                    filterInfo: filterParts.join(' · '),
                },
                'kpi_list',
                true
            );
            setReportModalOpen(false);
            toast({ title: 'Rapor hazır', description: 'Yeni sekmede açıldı.' });
        } catch (e) {
            toast({
                variant: 'destructive',
                title: 'Rapor',
                description: e?.message || 'Rapor oluşturulamadı.',
            });
        } finally {
            setReportGenerating(false);
        }
    }, [toast]);

    const handleManualRefresh = useCallback(async () => {
        setIsRefreshing(true);
        setIsSyncing(true);
        try {
            await refreshAutoKpis();
            setLastSyncTime(new Date());
            toast({ title: 'Başarılı', description: 'KPI değerleri ve aylık trend verileri güncellendi.' });
        } catch {
            toast({ variant: 'destructive', title: 'Hata', description: 'KPI değerleri güncellenemedi.' });
        } finally {
            setIsRefreshing(false);
            setIsSyncing(false);
        }
    }, [refreshAutoKpis, toast]);

    // Aktif kategorileri (en az 1 KPI olan) göster
    const visibleCategories = useMemo(() =>
        KPI_CATEGORIES.filter(cat => cat.id === 'all' || (categoryCounts[cat.id] || 0) > 0),
        [categoryCounts]
    );

    return (
        <div className="space-y-6">
            {/* Modals */}
            <AddKpiModal
                open={isAddModalOpen}
                setOpen={setAddModalOpen}
                refreshKpis={refreshKpis}
                existingKpis={kpis}
            />
            {selectedKpi && (
                <KPIDetailModalEnhanced
                    kpi={selectedKpi}
                    open={isDetailModalOpen}
                    setOpen={setDetailModalOpen}
                    refreshKpis={refreshKpis}
                    onOpenNCForm={onOpenNCForm}
                />
            )}
            <KpiReportSelectModal
                open={reportModalOpen}
                onOpenChange={setReportModalOpen}
                kpis={kpis}
                defaultSelectedIds={defaultReportSelectedIds}
                onConfirm={runKpiListReport}
                isGenerating={reportGenerating}
            />

            {/* ── Başlık ve butonlar ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <p className="text-sm text-muted-foreground">Tüm modüllerden otomatik toplanan performans göstergeleri</p>
                        {isSyncing ? (
                            <span className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                                <RefreshCw className="w-3 h-3 animate-spin" /> Senkronize ediliyor...
                            </span>
                        ) : lastSyncTime ? (
                            <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                                <Clock className="w-3 h-3" /> Son sync: {format(lastSyncTime, 'HH:mm:ss', { locale: tr })}
                            </span>
                        ) : null}
                    </div>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={handleManualRefresh} disabled={isRefreshing}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                        {isRefreshing ? 'Güncelleniyor…' : 'Tümünü Yenile'}
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            if (kpis.length === 0) {
                                toast({ variant: 'destructive', title: 'Rapor', description: 'Önce en az bir KPI ekleyin.' });
                                return;
                            }
                            setReportModalOpen(true);
                        }}
                        disabled={loading || kpis.length === 0}
                    >
                        <FileSpreadsheet className="w-4 h-4 mr-2" /> Rapor Al
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                        <Link to="/print/executive-presentation" target="_blank" rel="noopener noreferrer">
                            <Presentation className="w-4 h-4 mr-2" /> Yönetici özeti
                        </Link>
                    </Button>
                    <Button size="sm" onClick={() => setAddModalOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" /> Yeni KPI
                    </Button>
                </div>
            </div>

            {/* ── Özet istatistik kartları ── */}
            {!loading && kpis.length > 0 && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <SummaryCard
                        label="Toplam KPI"
                        value={summaryStats.total}
                        icon={BarChart3}
                        colorClass="text-blue-600"
                        bgClass="bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800"
                    />
                    <SummaryCard
                        label="Hedef Tutuldu"
                        value={summaryStats.onTarget}
                        icon={CheckCircle2}
                        colorClass="text-emerald-600"
                        bgClass="bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800"
                    />
                    <SummaryCard
                        label="Kritik Durum"
                        value={summaryStats.critical}
                        icon={AlertCircle}
                        colorClass="text-red-600"
                        bgClass="bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800"
                    />
                    <SummaryCard
                        label="Hedef Tutma Oranı"
                        value={summaryStats.onTargetRate !== null ? `%${summaryStats.onTargetRate}` : '—'}
                        icon={Target}
                        colorClass="text-violet-600"
                        bgClass="bg-violet-50 border-violet-200 dark:bg-violet-950/30 dark:border-violet-800"
                    />
                </div>
            )}

            {/* ── Arama ve filtreler ── */}
            <div className="space-y-2">
                {/* Arama — flex layout: sm:px-3 override sorununu önler */}
                <div className="flex items-center gap-2 w-full sm:w-80 h-9 sm:h-10 rounded-md border border-input bg-background px-3 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 transition-shadow">
                    <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                    <input
                        className="flex-1 min-w-0 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
                        placeholder="KPI ara…"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                {/* Kategori filtre butonları */}
                <div className="flex flex-wrap gap-1.5">
                    {visibleCategories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all
                                ${activeCategory === cat.id
                                    ? `${cat.bg} ${cat.text} ${cat.border} shadow-sm`
                                    : 'bg-background border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                                }`}
                        >
                            <span>{cat.label}</span>
                            <span className={`text-[10px] font-bold rounded-full px-1.5 py-0 ${activeCategory === cat.id ? 'bg-white/60' : 'bg-muted'}`}>
                                {categoryCounts[cat.id] || 0}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* ── KPI Grid ── */}
            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {[...Array(12)].map((_, i) => (
                        <Skeleton key={i} className="h-40 w-full rounded-xl" />
                    ))}
                </div>
            ) : filteredKpis.length > 0 ? (
                <motion.div
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                    initial="hidden"
                    animate="visible"
                    variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
                >
                    <AnimatePresence>
                        {filteredKpis.map(kpi => (
                            <KPICard key={kpi.id} kpi={kpi} onCardClick={handleCardClick} />
                        ))}
                    </AnimatePresence>
                </motion.div>
            ) : kpis.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="p-4 bg-muted rounded-full mb-4">
                        <TrendingUp className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">Henüz KPI Eklenmemiş</h3>
                    <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                        Tüm modüllerden otomatik veri toplayan KPI'lar ekleyerek performansınızı takip edin.
                    </p>
                    <Button className="mt-5" onClick={() => setAddModalOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" /> İlk KPI'ı Ekle
                    </Button>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Filter className="w-8 h-8 text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">
                        Bu kategoride veya arama kriterine uyan KPI bulunamadı.
                    </p>
                    <Button variant="ghost" size="sm" className="mt-3" onClick={() => { setActiveCategory('all'); setSearchTerm(''); }}>
                        Filtreyi Temizle
                    </Button>
                </div>
            )}
        </div>
    );
};

export default KPIModule;
