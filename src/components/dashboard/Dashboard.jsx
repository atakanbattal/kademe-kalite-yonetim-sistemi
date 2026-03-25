import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { format, isValid, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  AlertTriangle, FileText, Beaker, CheckSquare, BarChart, ShieldCheck,
  CalendarClock, TrendingUp, TrendingDown, BookCheck, ClipboardCheck,
  WalletCards, FileDown, ScrollText, Plus, Edit, Trash2, GraduationCap,
  Activity, Shield, ArrowUpRight, ArrowDownRight, Minus,
  AlertOctagon, Package, Users, Wrench, ChevronDown, ChevronUp,
  Target, Zap, Clock, BarChart3
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import {
  AreaChart, Area, BarChart as RechartsBarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import TodayTasks from '@/components/dashboard/TodayTasks';
import CriticalNonConformities from '@/components/dashboard/CriticalNonConformities';
import QualityWall from '@/components/dashboard/QualityWall';
import RootCauseHeatmap from '@/components/dashboard/RootCauseHeatmap';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ErrorBoundary from '@/components/dashboard/ErrorBoundary';

const COST_COLORS = { 'İç Hata Maliyetleri': '#ef4444', 'Dış Hata Maliyetleri': '#f97316', 'Önleme Maliyetleri': '#eab308', 'Değerlendirme Maliyetleri': '#22c55e' };
const SEVERITY_COLORS = { 'Kritik': '#ef4444', 'Yüksek': '#f97316', 'Orta': '#eab308', 'Düşük': '#22c55e', 'Belirsiz': '#94a3b8' };
const DEPT_COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c084fc', '#818cf8', '#60a5fa', '#38bdf8', '#22d3ee'];

const fmtCurrency = (v) => {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M ₺`;
  if (v >= 1000) return `${Math.round(v / 1000)}K ₺`;
  return `${Math.round(v)} ₺`;
};

const TrendBadge = ({ value, suffix = '%', invert = false }) => {
  if (value == null || isNaN(value)) return <span className="text-xs text-muted-foreground">—</span>;
  const positive = invert ? value <= 0 : value >= 0;
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus;
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums', positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400')}>
      <Icon className="w-3 h-3" />
      {Math.abs(Math.round(value))}{suffix}
    </span>
  );
};

const MiniSpark = ({ data, dataKey = 'value', color = '#6366f1', height = 32 }) => (
  <ResponsiveContainer width="100%" height={height}>
    <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
      <defs>
        <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5} fill={`url(#spark-${color.replace('#', '')})`} dot={false} isAnimationActive={false} />
    </AreaChart>
  </ResponsiveContainer>
);

const CustomTooltip = ({ active, payload, label, formatter }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover/95 backdrop-blur-sm px-3 py-2 shadow-xl text-xs">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold">{formatter ? formatter(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

const TABLE_LABELS = { tasks: 'Görev', non_conformities: 'Uygunsuzluk', deviations: 'Sapma', audit_findings: 'Tetkik Bulgusu', quarantine_records: 'Karantina', quality_costs: 'Kalite Maliyeti', equipments: 'Ekipman', equipment_calibrations: 'Kalibrasyon', suppliers: 'Tedarikçi', supplier_non_conformities: 'Ted. Uygunsuzluk', supplier_audit_plans: 'Ted. Denetim', incoming_inspections: 'Girdi Muayene', documents: 'Doküman', personnel: 'Personel', kpis: 'KPI', customer_complaints: 'Müşteri Şikayeti', quality_inspections: 'Kalite Kontrol', vehicle_timeline_events: 'Araç süreç adımı', kaizen_entries: 'Kaizen' };

const AUDIT_TIMELINE_EVENT_LABELS = {
  quality_entry: 'Kaliteye giriş',
  control_start: 'Kontrol başladı',
  control_end: 'Kontrol bitti',
  rework_start: 'Yeniden işlem başladı',
  rework_end: 'Yeniden işlem bitti',
  waiting_for_shipping_info: 'Sevk bilgisi bekleniyor',
  ready_to_ship: 'Sevke hazır',
  shipped: 'Sevk edildi',
  arge_sent: 'Ar-Ge\'ye gönderildi',
  arge_returned: 'Ar-Ge\'den döndü',
};

const Dashboard = ({ setActiveModule, onOpenNCView }) => {
  const { toast } = useToast();
  const dashData = useDashboardData();
  const { loading, error } = dashData;
  const refreshDashboard = dashData.refreshDashboard || (() => {});
  const {
    nonConformities, equipments, documents, qualityCosts, auditLogs,
    quarantineRecords, deviations, nonconformityRecords, audits, trainings,
    suppliers, personnel, refreshData
  } = useData();

  const [isDetailModalOpen, setDetailModalOpen] = useState(false);
  const [detailModalContent, setDetailModalContent] = useState({ title: '', records: [], renderItem: () => null });
  const [isReportModalOpen, setReportModalOpen] = useState(false);
  const [drillDownType, setDrillDownType] = useState(null);
  const [detailModalData, setDetailModalData] = useState({ isOpen: false, title: '', description: '', data: [], columns: [] });
  const [expandedSections, setExpandedSections] = useState({ alerts: true, advanced: true });
  const refreshIntervalRef = useRef(null);

  useEffect(() => {
    refreshIntervalRef.current = setInterval(() => {
      refreshDashboard?.();
      refreshData?.();
    }, 5 * 60 * 1000);
    return () => clearInterval(refreshIntervalRef.current);
  }, [refreshDashboard, refreshData]);

  const m = useMemo(() => {
    const ncs = nonConformities || [];
    const costs = qualityCosts || [];
    const equips = equipments || [];
    const docs = documents || [];
    const trains = trainings || [];
    const logs = auditLogs || [];
    const qRecs = quarantineRecords || [];
    const devs = deviations || [];
    const ncRecs = nonconformityRecords || [];
    const auds = audits || [];
    const supps = suppliers || [];
    const pers = personnel || [];

    const today = new Date();
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const thirtyDays = new Date(today.getTime() + 30 * 86400000);

    const openDf = ncs.filter(n => n.type === 'DF' && n.status !== 'Kapatıldı');
    const open8d = ncs.filter(n => n.type === '8D' && n.status !== 'Kapatıldı');
    const openedThisMonth = ncs.filter(n => new Date(n.opening_date || n.created_at) >= thisMonth).length;
    const closedThisMonth = ncs.filter(n => n.status === 'Kapatıldı' && new Date(n.closing_date || n.updated_at) >= thisMonth).length;
    const openedLastMonth = ncs.filter(n => { const d = new Date(n.opening_date || n.created_at); return d >= lastMonth && d < thisMonth; }).length;

    const overdueNcs = ncs.filter(n => {
      if (n.status === 'Kapatıldı') return false;
      return (today - new Date(n.opening_date || n.created_at)) / 86400000 > 30;
    });

    const thisMonthCosts = costs.filter(c => new Date(c.cost_date) >= thisMonth);
    const lastMonthCosts = costs.filter(c => { const d = new Date(c.cost_date); return d >= lastMonth && d < thisMonth; });
    const totalThisMonth = thisMonthCosts.reduce((s, c) => s + (c.amount || 0), 0);
    const totalLastMonth = lastMonthCosts.reduce((s, c) => s + (c.amount || 0), 0);
    const costTrend = totalLastMonth > 0 ? ((totalThisMonth - totalLastMonth) / totalLastMonth * 100) : 0;

    const costByType = {};
    thisMonthCosts.forEach(c => {
      const t = c.cost_type || 'Diğer';
      costByType[t] = (costByType[t] || 0) + (c.amount || 0);
    });
    const costPieData = Object.entries(costByType).map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value);

    const allCals = equips.flatMap(e => (e.equipment_calibrations || []).map(c => ({ ...c, equipName: e.name })));
    const overdueCals = allCals.filter(c => c.next_calibration_date && new Date(c.next_calibration_date) < today);
    const upcomingCals = allCals.filter(c => c.next_calibration_date && new Date(c.next_calibration_date) >= today && new Date(c.next_calibration_date) <= thirtyDays).sort((a, b) => new Date(a.next_calibration_date) - new Date(b.next_calibration_date));
    const expiringDocs = docs.filter(d => d.valid_until && new Date(d.valid_until) >= today && new Date(d.valid_until) <= thirtyDays).sort((a, b) => new Date(a.valid_until) - new Date(b.valid_until));

    const completedTrainings = trains.filter(t => t.status === 'Tamamlandı').length;
    const trainingRate = trains.length > 0 ? Math.round(completedTrainings / trains.length * 100) : 0;

    const totalOpen = openDf.length + open8d.length;

    const ncTrend = [];
    for (let i = 5; i >= 0; i--) {
      const ms = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const me = new Date(today.getFullYear(), today.getMonth() - i + 1, 0);
      const label = ms.toLocaleDateString('tr-TR', { month: 'short' });
      ncTrend.push({
        month: label,
        açılan: ncs.filter(n => { const d = new Date(n.opening_date || n.created_at); return d >= ms && d <= me; }).length,
        kapanan: ncs.filter(n => { if (n.status !== 'Kapatıldı') return false; const d = new Date(n.closing_date || n.updated_at); return d >= ms && d <= me; }).length,
      });
    }

    const costTrend6 = [];
    for (let i = 5; i >= 0; i--) {
      const ms = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const me = new Date(today.getFullYear(), today.getMonth() - i + 1, 0);
      costTrend6.push({
        month: ms.toLocaleDateString('tr-TR', { month: 'short' }),
        value: costs.filter(c => { const d = new Date(c.cost_date); return d >= ms && d <= me; }).reduce((s, c) => s + (c.amount || 0), 0),
      });
    }

    const ncByDept = {};
    ncs.filter(n => n.status !== 'Kapatıldı').forEach(n => {
      const dept = n.department || n.responsible_unit || 'Belirsiz';
      ncByDept[dept] = (ncByDept[dept] || 0) + 1;
    });
    const deptData = Object.entries(ncByDept).sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([name, value]) => ({ name: name.length > 18 ? name.slice(0, 18) + '…' : name, value, fullName: name }));

    const activityByDay = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const ds = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const de = new Date(ds.getTime() + 86400000);
      activityByDay.push({
        day: d.toLocaleDateString('tr-TR', { weekday: 'short' }),
        value: logs.filter(l => { const t = new Date(l.created_at); return t >= ds && t < de; }).length,
      });
    }

    const sevDist = { 'Kritik': 0, 'Yüksek': 0, 'Orta': 0, 'Düşük': 0 };
    ncRecs.filter(r => r.status !== 'Kapatıldı').forEach(r => {
      const sev = r.severity || 'Orta';
      if (sevDist[sev] !== undefined) sevDist[sev]++;
    });
    const sevData = Object.entries(sevDist).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));

    const completedAuditsMonth = auds.filter(a => a.status === 'Tamamlandı' && new Date(a.audit_date) >= thisMonth);
    const pendingApprovals = devs.filter(d => d.status === 'Onay Bekliyor');

    return {
      openDf: openDf.length, open8d: open8d.length, totalOpen,
      overdueCount: overdueNcs.length, closedThisMonth, openedThisMonth,
      openedLastMonth,
      totalThisMonthCost: totalThisMonth, costTrend, costPieData, costTrend6,
      quarantine: qRecs.filter(q => q.status === 'Karantinada').length,
      overdueCals: overdueCals.length, upcomingCals, expiringDocs,
      totalEquip: equips.length,
      trainingRate, completedTrainings, totalTrainings: trains.length,
      ncTrend, deptData, activityByDay, sevData,
      openRecords: ncRecs.filter(r => r.status !== 'Kapatıldı').length,
      totalRecords: ncRecs.length, totalNcs: ncs.length,
      pendingApprovals: pendingApprovals.length, pendingApprovalsList: pendingApprovals.slice(0, 5),
      totalSuppliers: supps.length, totalPersonnel: pers.length,
      activeAudits: auds.filter(a => a.status !== 'Tamamlandı' && a.status !== 'İptal Edildi').length,
      completedAuditsMonth: completedAuditsMonth.length,
      completedAuditsList: completedAuditsMonth.sort((a, b) => new Date(b.audit_date) - new Date(a.audit_date)).slice(0, 5),
      expiringDocsCount: expiringDocs.length, totalDocs: docs.length,
      recentLogs: logs.slice(0, 6),
    };
  }, [nonConformities, qualityCosts, equipments, documents, trainings, auditLogs, quarantineRecords, deviations, nonconformityRecords, audits, suppliers, personnel]);

  const handleCardClick = useCallback((module, kpiTitle) => {
    if (kpiTitle) {
      if (kpiTitle.includes('DF') || kpiTitle.includes('8D')) { setDrillDownType('df'); return; }
      if (kpiTitle.includes('Karantina')) { setDrillDownType('quarantine'); return; }
      if (kpiTitle.includes('Maliyet')) { setDrillDownType('cost'); return; }
    }
    if (module) setActiveModule(module);
  }, [setActiveModule]);

  const handleAlertClick = useCallback((type, data) => {
    if (type === 'overdue-nc-detail' && data) {
      if (onOpenNCView && data.id) onOpenNCView(data); else handleCardClick('df-8d');
    } else if (type === 'overdue-nc') {
      setDetailModalData({ isOpen: true, title: '30+ Gün Açık DF/8D Kayıtları', description: `${data.length} adet geciken kayıt`, data, columns: [{ key: 'nc_number', label: 'No' }, { key: 'title', label: 'Başlık' }, { key: 'department', label: 'Birim' }, { key: 'daysOverdue', label: 'Gecikme', render: (r) => <span className="font-semibold text-red-600">{r.daysOverdue} gün</span> }], onRowClick: (row) => { setDetailModalData(p => ({ ...p, isOpen: false })); if (onOpenNCView && row.id) onOpenNCView(row); else handleCardClick('df-8d'); } });
    } else if (type === 'overdue-calibration') {
      setDetailModalData({ isOpen: true, title: 'Geciken Kalibrasyonlar', description: `${data.length} adet`, data, columns: [{ key: 'equipment', label: 'Ekipman' }, { key: 'dueDate', label: 'Son Tarih', render: (r) => format(new Date(r.dueDate), 'dd.MM.yyyy', { locale: tr }) }, { key: 'daysOverdue', label: 'Gecikme', render: (r) => <span className="text-red-600 font-semibold">{r.daysOverdue} gün</span> }], onRowClick: () => handleCardClick('equipment') });
    } else if (type === 'expiring-docs') {
      setDetailModalData({ isOpen: true, title: 'Geçerliliği Dolacak Dokümanlar', description: `${data.length} adet`, data, columns: [{ key: 'name', label: 'Doküman' }, { key: 'valid_until', label: 'Son Tarih', render: (r) => format(new Date(r.valid_until), 'dd.MM.yyyy', { locale: tr }) }, { key: 'daysRemaining', label: 'Kalan', render: (r) => <span className="text-yellow-600 font-semibold">{r.daysRemaining} gün</span> }], onRowClick: () => handleCardClick('document') });
    } else if (type === 'cost-anomaly' && data?.length) { setDrillDownType('cost'); }
    else if (type.endsWith('-detail') && data) { handleCardClick(type.includes('calibration') ? 'equipment' : 'document'); }
  }, [handleCardClick, onOpenNCView]);

  const handleTaskClick = useCallback((type, data) => {
    if (type === 'overdue-8d') {
      setDetailModalData({ isOpen: true, title: 'Bugün Kapanması Gereken 8D', description: `${data.length} adet`, data, columns: [{ key: 'nc_number', label: 'No' }, { key: 'title', label: 'Başlık' }, { key: 'department', label: 'Birim' }, { key: 'daysOverdue', label: 'Gecikme', render: (r) => r.isOverdue ? <span className="text-red-600 font-semibold">{r.daysOverdue} gün</span> : <span className="text-green-600">Bugün</span> }], onRowClick: (row) => { setDetailModalData(p => ({ ...p, isOpen: false })); if (onOpenNCView && row.id) onOpenNCView(row); else handleCardClick('df-8d'); } });
    } else if (type === 'due-calibration') {
      setDetailModalData({ isOpen: true, title: 'Bugün Dolan Kalibrasyonlar', description: `${data.length} adet`, data, columns: [{ key: 'equipment', label: 'Ekipman' }, { key: 'dueDate', label: 'Tarih', render: (r) => format(new Date(r.dueDate), 'dd.MM.yyyy', { locale: tr }) }], onRowClick: () => handleCardClick('equipment') });
    }
  }, [handleCardClick, onOpenNCView]);

  const toggleSection = useCallback((key) => setExpandedSections(p => ({ ...p, [key]: !p[key] })), []);

  if (error) {
    return (
      <div className="p-6"><div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-red-800 mb-2">Dashboard Yüklenirken Hata</h2>
        <p className="text-red-700">{error}</p>
        <Button onClick={() => window.location.reload()} className="mt-4" variant="destructive">Sayfayı Yenile</Button>
      </div></div>
    );
  }

  const todayStr = format(new Date(), 'dd MMMM yyyy, EEEE', { locale: tr });

  return (
    <div className="space-y-5">
      {/* Drill-down dialogs */}
      {['df', 'quarantine', 'cost'].map(type => (
        <Dialog key={type} open={drillDownType === type} onOpenChange={o => !o && setDrillDownType(null)}>
          <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="sr-only"><DialogTitle>{type} Analiz</DialogTitle></DialogHeader>
            {type === 'df' && <DFDrillDownAnalysis onClose={() => setDrillDownType(null)} />}
            {type === 'quarantine' && <QuarantineDrillDownAnalysis onClose={() => setDrillDownType(null)} />}
            {type === 'cost' && <CostDrillDownAnalysis onClose={() => setDrillDownType(null)} />}
          </DialogContent>
        </Dialog>
      ))}
      <DashboardDetailModal isOpen={isDetailModalOpen} setIsOpen={setDetailModalOpen} title={detailModalContent.title} records={detailModalContent.records} renderItem={detailModalContent.renderItem} />
      <ReportGenerationModalEnhanced isOpen={isReportModalOpen} setIsOpen={setReportModalOpen} />
      <DetailModal isOpen={detailModalData.isOpen} onClose={() => setDetailModalData(p => ({ ...p, isOpen: false }))} title={detailModalData.title} description={detailModalData.description} data={detailModalData.data} columns={detailModalData.columns} onRowClick={detailModalData.onRowClick} />

      {/* ═══════ HERO HEADER — marka mavisi (açık tema ile uyumlu) ═══════ */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/[0.08] via-background to-muted/40 dark:from-primary/[0.12] dark:via-background dark:to-muted/25 p-5 sm:p-6 shadow-sm">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/[0.12] via-transparent to-transparent pointer-events-none" />
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/[0.06] rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 w-full">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Kalite Yönetim Paneli</h1>
              <p className="text-sm text-muted-foreground mt-1">{todayStr}</p>
            </div>
            <Button onClick={() => setReportModalOpen(true)} size="sm" variant="default" className="shrink-0 w-full sm:w-auto">
              <FileDown className="w-4 h-4 mr-2" />Rapor Al
            </Button>
          </div>

          <div className="flex flex-wrap items-stretch gap-2 sm:gap-3">
            <button type="button" onClick={() => handleCardClick('df-8d', 'DF')} className="flex flex-1 min-w-[140px] sm:min-w-[160px] items-center gap-2 rounded-xl bg-card/95 backdrop-blur-sm border border-border px-3 py-2.5 shadow-sm hover:bg-accent/80 transition-colors text-left">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <div className="min-w-0"><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Açık DF/8D</p><p className="text-lg font-bold text-foreground tabular-nums">{loading ? '…' : m.totalOpen}</p></div>
            </button>
            <button type="button" onClick={() => handleCardClick('quality-cost', 'Maliyet')} className="flex flex-1 min-w-[140px] sm:min-w-[160px] items-center gap-2 rounded-xl bg-card/95 backdrop-blur-sm border border-border px-3 py-2.5 shadow-sm hover:bg-accent/80 transition-colors text-left">
              <WalletCards className="w-4 h-4 text-red-500 shrink-0" />
              <div className="min-w-0"><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Bu Ay Maliyet</p><p className="text-lg font-bold text-foreground tabular-nums">{loading ? '…' : fmtCurrency(m.totalThisMonthCost)}</p></div>
              {!loading && <TrendBadge value={m.costTrend} invert />}
            </button>
            <button type="button" onClick={() => handleCardClick('nonconformity')} className="flex flex-1 min-w-[140px] sm:min-w-[160px] items-center gap-2 rounded-xl bg-card/95 backdrop-blur-sm border border-border px-3 py-2.5 shadow-sm hover:bg-accent/80 transition-colors text-left">
              <Zap className="w-4 h-4 text-primary shrink-0" />
              <div className="min-w-0"><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Uygunsuzluk</p><p className="text-lg font-bold text-foreground tabular-nums">{loading ? '…' : m.openRecords}</p></div>
            </button>
            <button type="button" onClick={() => handleCardClick('quarantine', 'Karantina')} className="flex flex-1 min-w-[140px] sm:min-w-[160px] items-center gap-2 rounded-xl bg-card/95 backdrop-blur-sm border border-border px-3 py-2.5 shadow-sm hover:bg-accent/80 transition-colors text-left">
              <Beaker className="w-4 h-4 text-purple-500 shrink-0" />
              <div className="min-w-0"><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Karantina</p><p className="text-lg font-bold text-foreground tabular-nums">{loading ? '…' : m.quarantine}</p></div>
            </button>
          </div>

          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Operasyonel özet</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
              {[
                { label: '30+ gün geciken', value: m.overdueCount, mod: 'df-8d', k: 'DF', Icon: Clock, accent: m.overdueCount > 0 },
                { label: 'Gecikmiş kalibrasyon', value: m.overdueCals, mod: 'equipment', Icon: CalendarClock, accent: m.overdueCals > 0 },
                { label: 'Süresi dolacak doküman', value: m.expiringDocsCount, mod: 'document', Icon: BookCheck, accent: m.expiringDocsCount > 0 },
                { label: 'Aktif iç tetkik', value: m.activeAudits, mod: 'internal-audit', Icon: ClipboardCheck, accent: m.activeAudits > 0 },
                { label: 'Onay bekleyen sapma', value: m.pendingApprovals, mod: 'deviation', Icon: Target, accent: m.pendingApprovals > 0 },
                { label: 'Ekipman', value: m.totalEquip, mod: 'equipment', Icon: Wrench, accent: false },
                { label: 'Personel', value: m.totalPersonnel, mod: 'settings', Icon: Users, accent: false },
                { label: 'Tedarikçi', value: m.totalSuppliers, mod: 'supplier-quality', Icon: Package, accent: false },
              ].map((row, idx) => {
                const RowIcon = row.Icon;
                return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleCardClick(row.mod, row.k)}
                  className={cn(
                    'rounded-lg border bg-card/90 backdrop-blur-sm px-2.5 py-2 text-left shadow-sm hover:bg-accent/70 transition-colors',
                    row.accent ? 'border-amber-200/80 dark:border-amber-900/50 ring-1 ring-amber-500/15' : 'border-border'
                  )}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <RowIcon className={cn('w-3.5 h-3.5 shrink-0', row.accent ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')} />
                    <span className="text-[9px] leading-tight text-muted-foreground uppercase tracking-wide line-clamp-2">{row.label}</span>
                  </div>
                  <p className="text-base font-bold tabular-nums text-foreground">{loading ? '…' : row.value}</p>
                </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════ Akıllı uyarılar (kalite zihniyeti) — hero altında her zaman görünür ═══════ */}
      <ErrorBoundary componentName="Kalite uyarıları">
        <DashboardAlerts onAlertClick={handleAlertClick} onModuleNavigate={handleCardClick} showSmartInsightsStandalone />
      </ErrorBoundary>

      {/* ═══════ KPI CARDS ROW ═══════ */}
      <div>
        <h2 className="text-sm font-semibold text-foreground tracking-tight mb-2">Ana göstergeler</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-3">
        {[
          { title: 'Açık DF', value: m.openDf, icon: AlertTriangle, color: 'text-amber-500', module: 'df-8d', spark: m.ncTrend, sparkKey: 'açılan', sparkColor: '#f59e0b' },
          { title: 'Açık 8D', value: m.open8d, icon: AlertOctagon, color: 'text-red-500', module: 'df-8d' },
          { title: 'Geciken DF/8D', value: m.overdueCount, icon: Clock, color: m.overdueCount > 0 ? 'text-red-600' : 'text-emerald-500', module: 'df-8d' },
          { title: 'Bu Ay Açılan', value: m.openedThisMonth, icon: TrendingUp, color: 'text-blue-500', module: 'df-8d', trend: m.openedLastMonth > 0 ? ((m.openedThisMonth - m.openedLastMonth) / m.openedLastMonth * 100) : null, trendInvert: true },
          { title: 'Bu Ay Kapanan', value: m.closedThisMonth, icon: CheckSquare, color: 'text-emerald-500', module: 'df-8d' },
          { title: 'Eğitim Oranı', value: `%${m.trainingRate}`, icon: GraduationCap, color: 'text-teal-500', module: 'training' },
          { title: 'Gec. Kalibrasyon', value: m.overdueCals, icon: CalendarClock, color: m.overdueCals > 0 ? 'text-red-600' : 'text-emerald-500', module: 'equipment' },
          { title: 'Doküman (30 gün)', value: m.expiringDocsCount, icon: BookCheck, color: m.expiringDocsCount > 0 ? 'text-orange-500' : 'text-slate-400', module: 'document' },
          { title: 'Aktif Tetkik', value: m.activeAudits, icon: ClipboardCheck, color: 'text-violet-500', module: 'internal-audit' },
          { title: 'Onay Bekleyen Sapma', value: m.pendingApprovals, icon: Target, color: m.pendingApprovals > 0 ? 'text-red-500' : 'text-slate-400', module: 'deviation' },
        ].map((kpi, i) => (
          <Card key={i} className="group cursor-pointer hover:shadow-md transition-all duration-200 hover:-translate-y-0.5" onClick={() => handleCardClick(kpi.module, kpi.title)}>
            <CardContent className="p-3.5">
              <div className="flex items-start justify-between">
                <kpi.icon className={cn('w-4 h-4 shrink-0', kpi.color)} />
                {kpi.trend != null && <TrendBadge value={kpi.trend} invert={kpi.trendInvert} />}
              </div>
              <div className="mt-2">
                <p className="text-2xl font-bold tabular-nums">{loading ? <Skeleton className="h-7 w-12" /> : kpi.value}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{kpi.title}</p>
              </div>
              {kpi.spark && !loading && (
                <div className="mt-2 -mx-1"><MiniSpark data={kpi.spark} dataKey={kpi.sparkKey} color={kpi.sparkColor} height={28} /></div>
              )}
            </CardContent>
          </Card>
        ))}
        </div>
      </div>

      {/* ═══════ MAIN CHARTS ═══════ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* NC Trend - 3/5 */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2 p-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-500" />DF/8D Trend (6 Ay)
              </CardTitle>
              <div className="flex items-center gap-3 text-[10px]">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500" />Açılan</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />Kapanan</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {loading ? <Skeleton className="h-[220px] w-full" /> : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={m.ncTrend} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradOpened" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} /><stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradClosed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} /><stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} width={35} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="açılan" name="Açılan" stroke="#6366f1" strokeWidth={2} fill="url(#gradOpened)" dot={{ r: 3, fill: '#6366f1' }} />
                  <Area type="monotone" dataKey="kapanan" name="Kapanan" stroke="#22c55e" strokeWidth={2} fill="url(#gradClosed)" dot={{ r: 3, fill: '#22c55e' }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Cost Donut + Trend - 2/5 */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2 p-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <WalletCards className="w-4 h-4 text-red-500" />Maliyet Dağılımı (Bu Ay)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 flex flex-col items-center">
            {loading ? <Skeleton className="h-[180px] w-full" /> : m.costPieData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8">Bu ay maliyet verisi yok</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie data={m.costPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value" strokeWidth={0}>
                      {m.costPieData.map((entry, i) => <Cell key={i} fill={COST_COLORS[entry.name] || DEPT_COLORS[i % DEPT_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => `${v.toLocaleString('tr-TR')} ₺`} contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '0.5rem', fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[10px]">
                  {m.costPieData.map((entry, i) => (
                    <span key={i} className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COST_COLORS[entry.name] || DEPT_COLORS[i % DEPT_COLORS.length] }} />
                      <span className="text-muted-foreground">{entry.name.replace(' Maliyetleri', '')}</span>
                    </span>
                  ))}
                </div>
              </>
            )}
            {!loading && (
              <div className="w-full mt-3 pt-3 border-t">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Maliyet Trendi (6 Ay)</p>
                <MiniSpark data={m.costTrend6} color="#ef4444" height={36} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══════ DEPARTMENT BAR + SEVERITY + ACTIVITY ═══════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Department Bar */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2 p-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-500" />Birim Bazlı Açık DF/8D
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {loading ? <Skeleton className="h-[200px] w-full" /> : m.deptData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Veri yok</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <RechartsBarChart data={m.deptData} layout="vertical" margin={{ top: 0, right: 5, left: 5, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} width={100} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" name="Açık DF/8D" radius={[0, 4, 4, 0]} barSize={14}>
                    {m.deptData.map((_, i) => <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />)}
                  </Bar>
                </RechartsBarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Severity Distribution */}
        <Card>
          <CardHeader className="pb-2 p-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-500" />Ciddiyet Dağılımı (Uygunsuzluk Kayıtları)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-4">
            {loading ? <Skeleton className="h-[200px] w-full" /> : m.sevData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Açık kayıt yok</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={130}>
                  <PieChart>
                    <Pie data={m.sevData} cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={4} dataKey="value" strokeWidth={0}>
                      {m.sevData.map((entry, i) => <Cell key={i} fill={SEVERITY_COLORS[entry.name] || '#94a3b8'} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '0.5rem', fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-2">
                  {m.sevData.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 p-1.5 rounded-md bg-muted/30">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: SEVERITY_COLORS[s.name] }} />
                      <span className="text-xs text-muted-foreground flex-1">{s.name}</span>
                      <span className="text-xs font-bold tabular-nums">{s.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Activity + Quick Stats */}
        <Card>
          <CardHeader className="pb-2 p-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" />Haftalık Aktivite
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-3">
            {loading ? <Skeleton className="h-[80px] w-full" /> : (
              <ResponsiveContainer width="100%" height={80}>
                <RechartsBarChart data={m.activityByDay} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <XAxis dataKey="day" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" name="İşlem" radius={[3, 3, 0, 0]} barSize={20} fill="#6366f1" opacity={0.8} />
                </RechartsBarChart>
              </ResponsiveContainer>
            )}
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: Users, label: 'Personel', value: m.totalPersonnel, color: 'text-blue-500' },
                { icon: Package, label: 'Tedarikçi', value: m.totalSuppliers, color: 'text-indigo-500' },
                { icon: Wrench, label: 'Ekipman', value: m.totalEquip, color: 'text-amber-500' },
                { icon: FileText, label: 'Doküman', value: m.totalDocs, color: 'text-emerald-500' },
                { icon: ClipboardCheck, label: 'Tetkik (Ay)', value: m.completedAuditsMonth, color: 'text-purple-500' },
                { icon: Target, label: 'Onay Bekl.', value: m.pendingApprovals, color: m.pendingApprovals > 0 ? 'text-red-500' : 'text-slate-400' },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-2 p-1.5 rounded-md bg-muted/30">
                  <s.icon className={cn('w-3.5 h-3.5 shrink-0', s.color)} />
                  <span className="text-[10px] text-muted-foreground flex-1">{s.label}</span>
                  <span className="text-xs font-bold tabular-nums">{loading ? '…' : s.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══════ SON İŞLEMLER ═══════ */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 p-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ScrollText className="w-4 h-4 text-indigo-500" />Son İşlemler
          </CardTitle>
          <Button variant="link" size="sm" onClick={() => handleCardClick('audit-logs')} className="p-0 h-auto text-xs">Tümünü Gör</Button>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {loading ? (
            <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
          ) : !m.recentLogs?.length ? (
            <p className="text-xs text-muted-foreground text-center py-4">İşlem kaydı yok</p>
          ) : (
            <div className="space-y-0.5">
              {m.recentLogs.map((log) => {
                const isAdd = log.action?.startsWith('EKLEME');
                const isDel = log.action?.startsWith('SİLME');
                const tableLabel = TABLE_LABELS[log.table_name] || log.table_name;
                const shortAction = isAdd ? 'Eklendi' : isDel ? 'Silindi' : 'Güncellendi';
                let desc = '';
                try {
                  const d = log.details;
                  if (log.table_name === 'vehicle_timeline_events') {
                    const row = d?.new || d?.old;
                    const et = row?.event_type;
                    const evLabel = (et && AUDIT_TIMELINE_EVENT_LABELS[et]) || et || '';
                    let timeBit = '';
                    if (row?.event_timestamp) {
                      const t = parseISO(row.event_timestamp);
                      if (isValid(t)) timeBit = format(t, 'dd.MM. HH:mm', { locale: tr });
                    }
                    desc = [evLabel, timeBit].filter(Boolean).join(' · ');
                  } else {
                    desc = d?.new?.title || d?.new?.name || (d?.new?.nc_number ? `NC: ${d.new.nc_number}` : '') || d?.old?.title || d?.old?.name || '';
                  }
                } catch (_) {}
                const display = desc ? (desc.length > 50 ? desc.slice(0, 50) + '…' : desc) : '—';
                return (
                  <div key={log.id} onClick={() => handleCardClick('audit-logs')} className="flex items-center gap-2 p-2 rounded-md hover:bg-accent/50 cursor-pointer text-xs transition-colors">
                    <span className={cn('shrink-0 w-6 h-6 rounded-full flex items-center justify-center', isAdd ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : isDel ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400')}>
                      {isAdd ? <Plus className="w-3 h-3" /> : isDel ? <Trash2 className="w-3 h-3" /> : <Edit className="w-3 h-3" />}
                    </span>
                    <div className="min-w-0 flex-1 truncate">
                      <span className="font-medium">{log.user_full_name || 'Sistem'}</span>
                      <span className="text-muted-foreground"> {shortAction} · {tableLabel}: </span>
                      <span className="text-muted-foreground">{display}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0 tabular-nums">
                      {format(new Date(log.created_at), 'dd.MM HH:mm', { locale: tr })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══════ ALERTS + TASKS ═══════ */}
      <div className="space-y-1">
        <button onClick={() => toggleSection('alerts')} className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors w-full text-left py-1">
          {expandedSections.alerts ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          Uyarılar & Görevler
        </button>
        {expandedSections.alerts && (
          <div className="space-y-4 animate-in fade-in-0 slide-in-from-top-2 duration-300">
            <ErrorBoundary componentName="Uyarılar">
              <DashboardAlerts onAlertClick={handleAlertClick} onModuleNavigate={handleCardClick} hideSmartInsights />
            </ErrorBoundary>
            <ErrorBoundary componentName="Görevler">
              <TodayTasks onTaskClick={handleTaskClick} />
            </ErrorBoundary>
            <ErrorBoundary componentName="Kritik NC">
              <CriticalNonConformities onViewDetails={(nc) => {
                if (nc?.id && onOpenNCView) onOpenNCView(nc);
                else handleCardClick('df-8d');
              }} />
            </ErrorBoundary>
          </div>
        )}
      </div>

      {/* ═══════ QUICK LISTS ═══════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Upcoming Calibrations */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-amber-500" />Yaklaşan Kalibrasyonlar
              {m.overdueCals > 0 && <Badge variant="destructive" className="text-[9px] px-1.5 py-0">{m.overdueCals} gecikmiş</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {loading ? <Skeleton className="h-24 w-full" /> : m.upcomingCals.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">Yaklaşan kalibrasyon yok</p>
            ) : (
              <ul className="space-y-1">
                {m.upcomingCals.slice(0, 5).map((c, i) => (
                  <li key={i} onClick={() => handleCardClick('equipment')} className="flex items-center justify-between p-1.5 rounded-md hover:bg-accent/50 cursor-pointer text-xs transition-colors">
                    <span className="truncate flex-1">{c.equipName}</span>
                    <span className="text-muted-foreground tabular-nums shrink-0 ml-2">
                      {format(new Date(c.next_calibration_date), 'dd.MM.yy', { locale: tr })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Expiring Docs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BookCheck className="w-4 h-4 text-orange-500" />Süresi Dolacak Dokümanlar
              {m.expiringDocsCount > 0 && <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-orange-300 text-orange-600">{m.expiringDocsCount}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {loading ? <Skeleton className="h-24 w-full" /> : m.expiringDocs.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">Yaklaşan tarih yok</p>
            ) : (
              <ul className="space-y-1">
                {m.expiringDocs.slice(0, 5).map((d, i) => (
                  <li key={i} onClick={() => handleCardClick('document')} className="flex items-center justify-between p-1.5 rounded-md hover:bg-accent/50 cursor-pointer text-xs transition-colors">
                    <span className="truncate flex-1">{d.name}</span>
                    <span className="text-muted-foreground tabular-nums shrink-0 ml-2">
                      {format(new Date(d.valid_until), 'dd.MM.yy', { locale: tr })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Completed Audits */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-emerald-500" />Bu Ay Tamamlanan Tetkikler
              {m.completedAuditsMonth > 0 && <Badge className="text-[9px] px-1.5 py-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">{m.completedAuditsMonth}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {loading ? <Skeleton className="h-24 w-full" /> : m.completedAuditsList.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">Bu ay tetkik tamamlanmamış</p>
            ) : (
              <ul className="space-y-1">
                {m.completedAuditsList.map((a, i) => (
                  <li key={i} onClick={() => handleCardClick('internal-audit')} className="flex items-center justify-between p-1.5 rounded-md hover:bg-accent/50 cursor-pointer text-xs transition-colors">
                    <span className="truncate flex-1 font-mono">{a.report_number || a.title || '—'}</span>
                    <span className="text-muted-foreground tabular-nums shrink-0 ml-2">
                      {a.audit_date ? format(new Date(a.audit_date), 'dd.MM.yy', { locale: tr }) : '—'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══════ ADVANCED ANALYTICS (Collapsible) ═══════ */}
      <div className="space-y-1">
        <button onClick={() => toggleSection('advanced')} className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors w-full text-left py-1">
          {expandedSections.advanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          Gelişmiş Analitik
        </button>
        {expandedSections.advanced && (
          <div className="space-y-4 animate-in fade-in-0 slide-in-from-top-2 duration-300">
            <ErrorBoundary componentName="Kalite Duvarı">
              <QualityWall />
            </ErrorBoundary>
            <ErrorBoundary componentName="Kök Neden Isı Haritası">
              <RootCauseHeatmap onDeptClick={(deptName) => {
                const norm = normalizeTurkishForSearch(deptName.trim().toLowerCase());
                const deptNCs = (nonConformities || []).filter(nc => {
                  const d = nc.department || nc.responsible_unit;
                  return d && normalizeTurkishForSearch(String(d).trim().toLowerCase()) === norm;
                });
                setDetailModalData({
                  isOpen: true, title: `${deptName} - Uygunsuzluklar`, description: `${deptNCs.length} kayıt`, data: deptNCs,
                  columns: [{ key: 'nc_number', label: 'No' }, { key: 'title', label: 'Başlık' }, { key: 'type', label: 'Tip' }, { key: 'status', label: 'Durum' }],
                  onRowClick: (row) => { setDetailModalData(p => ({ ...p, isOpen: false })); if (onOpenNCView && row.id) onOpenNCView(row); else handleCardClick('df-8d'); }
                });
              }} />
            </ErrorBoundary>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
