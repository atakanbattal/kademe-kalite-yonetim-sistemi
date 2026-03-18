import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
    LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip,
    ResponsiveContainer, ReferenceLine, Area, AreaChart,
} from 'recharts';
import {
    Save, Trash2, TrendingUp, TrendingDown, Target, RefreshCw, Zap,
    CopyCheck, CalendarDays, Sparkles, ArrowUpRight, ArrowDownRight,
    Minus, CheckCircle2, AlertCircle, BarChart3, ListTodo, X,
    Brain, Flame, ShieldCheck, Clock3, Activity,
} from 'lucide-react';
import { format, subMonths } from 'date-fns';
import { tr } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';

// ─── helpers ────────────────────────────────────────────────────────────────
const fmt = (v, decimals = 2) =>
    v == null ? '—' : parseFloat(v).toLocaleString('tr-TR', { maximumFractionDigits: decimals });

const categoryMeta = {
    quality:    { color: '#ef4444', bg: '#fef2f2', label: 'Kalite' },
    production: { color: '#f97316', bg: '#fff7ed', label: 'Üretim' },
    supplier:   { color: '#8b5cf6', bg: '#f5f3ff', label: 'Tedarikçi' },
    training:   { color: '#06b6d4', bg: '#ecfeff', label: 'Eğitim' },
    document:   { color: '#0ea5e9', bg: '#f0f9ff', label: 'Doküman' },
    equipment:  { color: '#84cc16', bg: '#f7fee7', label: 'Ekipman' },
    process:    { color: '#f59e0b', bg: '#fffbeb', label: 'Proses' },
    finance:    { color: '#10b981', bg: '#ecfdf5', label: 'Maliyet' },
    performance:{ color: '#6366f1', bg: '#eef2ff', label: 'Performans' },
};

const TREND_LABELS = {
    improving: { text: 'İyileşiyor', icon: TrendingUp, color: '#10b981', bg: '#ecfdf5' },
    declining: { text: 'Dikkat', icon: TrendingDown, color: '#ef4444', bg: '#fef2f2' },
    stable:    { text: 'Sabit', icon: Minus, color: '#6b7280', bg: '#f9fafb' },
    perfect:   { text: 'Mükemmel', icon: CheckCircle2, color: '#10b981', bg: '#ecfdf5' },
    starting:  { text: 'Başlangıç', icon: Flame, color: '#f97316', bg: '#fff7ed' },
    unknown:   { text: 'Yeterli Veri Yok', icon: Activity, color: '#6b7280', bg: '#f9fafb' },
};

// ─── Custom tooltip ──────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label, unit }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white border border-border rounded-lg shadow-lg p-3 text-xs min-w-[140px]">
            <p className="font-semibold text-foreground mb-2 border-b pb-1">{label}</p>
            {payload.map((p, i) => (
                <div key={i} className="flex items-center justify-between gap-3 mt-1">
                    <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
                        <span className="text-muted-foreground">{p.name}</span>
                    </span>
                    <span className="font-semibold" style={{ color: p.color }}>
                        {p.value != null ? `${fmt(p.value)}${unit || ''}` : '—'}
                    </span>
                </div>
            ))}
        </div>
    );
};

// ─── Radial progress ring ────────────────────────────────────────────────────
const ProgressRing = ({ pct, color = '#6366f1', size = 80, stroke = 7 }) => {
    const r = (size - stroke) / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ - (Math.min(pct, 100) / 100) * circ;
    return (
        <svg width={size} height={size} className="rotate-[-90deg]">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke="currentColor" strokeWidth={stroke} className="text-muted/30" />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke={color} strokeWidth={stroke} strokeLinecap="round"
                strokeDasharray={circ} strokeDashoffset={offset}
                style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
        </svg>
    );
};

// ─── Confidence meter ────────────────────────────────────────────────────────
const ConfidenceBar = ({ value }) => {
    const pct = Math.min(100, Math.max(0, value || 0));
    const color = pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444';
    const label = pct >= 70 ? 'Yüksek' : pct >= 40 ? 'Orta' : 'Düşük';
    return (
        <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, background: color }} />
            </div>
            <span className="text-[10px] font-semibold" style={{ color }}>{label} ({pct}%)</span>
        </div>
    );
};

// ─── Sekme butonu ─────────────────────────────────────────────────────────────
const TabBtn = ({ active, onClick, icon: Icon, label, badge }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all
            ${active
                ? 'bg-white text-primary shadow-sm border border-border'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/60'}`}
    >
        <Icon className="w-3.5 h-3.5" />
        {label}
        {badge != null && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold
                ${active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                {badge}
            </span>
        )}
    </button>
);

// ════════════════════════════════════════════════════════════════════════════
const KPIDetailModalEnhanced = ({ kpi, open, setOpen, refreshKpis }) => {
    const { toast } = useToast();
    const [tab, setTab] = useState('overview');
    const [targetValue, setTargetValue] = useState(kpi?.target_value || '');
    const [responsibleUnit, setResponsibleUnit] = useState(kpi?.responsible_unit || '');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [monthlyData, setMonthlyData] = useState([]);
    const [actions, setActions] = useState([]);
    const [loadingMonthly, setLoadingMonthly] = useState(false);
    const [currentYear] = useState(new Date().getFullYear());
    const [currentMonth] = useState(new Date().getMonth() + 1);
    const [editingTargets, setEditingTargets] = useState({});
    const [bulkTargetInput, setBulkTargetInput] = useState('');
    const [annualTargetInput, setAnnualTargetInput] = useState('');
    const [smartSuggestion, setSmartSuggestion] = useState(null);
    const [loadingSmartSuggestion, setLoadingSmartSuggestion] = useState(false);
    const [isBackfilling, setIsBackfilling] = useState(false);

    const runBackfillAndLoad = useCallback(async () => {
        if (!kpi?.is_auto) return;
        setIsBackfilling(true);
        try { await supabase.rpc('backfill_kpi_monthly_data', { p_months_back: 13 }); }
        catch { /* silent */ }
        finally { setIsBackfilling(false); }
    }, [kpi?.is_auto]);

    useEffect(() => {
        if (!kpi) return;
        setTargetValue(kpi.target_value != null ? String(kpi.target_value) : '');
        setResponsibleUnit(kpi.responsible_unit || '');
        setEditingTargets({});
        setBulkTargetInput('');
        setAnnualTargetInput('');
        setSmartSuggestion(null);
        setTab('overview');
        const init = async () => {
            if (kpi.is_auto) await runBackfillAndLoad();
            await fetchMonthlyData();
            fetchActions();
            fetchSmartSuggestion();
        };
        init();
    }, [kpi?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchMonthlyData = async () => {
        if (!kpi) return;
        setLoadingMonthly(true);
        try {
            const { data } = await supabase
                .from('kpi_monthly_data').select('*').eq('kpi_id', kpi.id)
                .order('year', { ascending: true }).order('month', { ascending: true });
            const now = new Date();
            const last13 = [];
            for (let i = 12; i >= 0; i--) {
                const d = subMonths(now, i);
                const y = d.getFullYear(), m = d.getMonth() + 1;
                const ex = data?.find(r => r.year === y && r.month === m);
                last13.push({
                    year: y, month: m,
                    monthName: format(d, 'MMM yy', { locale: tr }),
                    monthNameLong: format(d, 'MMMM yyyy', { locale: tr }),
                    target: ex != null ? (ex.target_value ?? null) : null,
                    actual: ex != null ? (ex.actual_value ?? null) : null,
                    id: ex?.id ?? null,
                });
            }
            setMonthlyData(last13);
        } catch { /* silent */ }
        finally { setLoadingMonthly(false); }
    };

    const fetchActions = async () => {
        if (!kpi) return;
        const { data } = await supabase.from('kpi_actions').select('*')
            .eq('kpi_id', kpi.id).order('created_at', { ascending: false });
        setActions(data || []);
    };

    const fetchSmartSuggestion = async () => {
        if (!kpi) return;
        setLoadingSmartSuggestion(true);
        try {
            const { data } = await supabase.rpc('get_smart_target_suggestion', { p_kpi_id: kpi.id });
            setSmartSuggestion(data?.success ? data : null);
        } catch { setSmartSuggestion(null); }
        finally { setLoadingSmartSuggestion(false); }
    };

    // ─── Bulk / toplu işlemler ────────────────────────────────────────────
    const handleApplyBulkTarget = () => {
        if (!bulkTargetInput.trim()) return;
        const edits = {};
        monthlyData.forEach(d => { edits[`${d.year}-${d.month}`] = bulkTargetInput; });
        setEditingTargets(prev => ({ ...prev, ...edits }));
        setBulkTargetInput('');
        toast({ title: 'Uygulandı', description: `${monthlyData.length} aya ${bulkTargetInput}${kpi?.unit || ''} girildi.` });
    };

    const handleDistributeAnnual = () => {
        const annual = parseFloat(annualTargetInput);
        if (isNaN(annual)) return;
        const monthly = (annual / 12).toFixed(2);
        const edits = {};
        monthlyData.forEach(d => { edits[`${d.year}-${d.month}`] = monthly; });
        setEditingTargets(prev => ({ ...prev, ...edits }));
        setAnnualTargetInput('');
        toast({ title: 'Dağıtıldı', description: `${monthly}${kpi?.unit || ''}/ay uygulandı.` });
    };

    const handleSaveAllTargets = async () => {
        const entries = Object.entries(editingTargets).filter(([, v]) => v.trim() !== '');
        if (!entries.length) return;
        setIsSubmitting(true);
        try {
            await Promise.all(entries.map(async ([key, val]) => {
                const [y, m] = key.split('-').map(Number);
                const tNum = parseFloat(val);
                if (isNaN(tNum)) return;
                const ex = monthlyData.find(d => d.year === y && d.month === m);
                if (ex?.id) return supabase.from('kpi_monthly_data').update({ target_value: tNum }).eq('id', ex.id);
                return supabase.from('kpi_monthly_data').insert({
                    kpi_id: kpi.id, year: y, month: m,
                    target_value: tNum, actual_value: ex?.actual ?? null,
                });
            }));
            const nowKey = `${currentYear}-${currentMonth}`;
            const syncVal = editingTargets[nowKey] || entries[0]?.[1];
            if (syncVal && !isNaN(parseFloat(syncVal))) {
                await supabase.from('kpis').update({ target_value: parseFloat(syncVal) }).eq('id', kpi.id);
            }
            toast({ title: 'Kaydedildi!', description: `${entries.length} aylık hedef güncellendi.` });
            setEditingTargets({});
            fetchMonthlyData();
            refreshKpis();
        } catch {
            toast({ variant: 'destructive', title: 'Hata', description: 'Kaydedilemedi.' });
        } finally { setIsSubmitting(false); }
    };

    const handleApplySmartSuggestion = async () => {
        if (!smartSuggestion?.suggested_value) return;
        setIsSubmitting(true);
        try {
            const val = parseFloat(smartSuggestion.suggested_value);
            await supabase.from('kpis').update({ target_value: val }).eq('id', kpi.id);
            for (const d of monthlyData) {
                if (d.id) await supabase.from('kpi_monthly_data').update({ target_value: val }).eq('id', d.id);
                else await supabase.from('kpi_monthly_data').insert({
                    kpi_id: kpi.id, year: d.year, month: d.month,
                    target_value: val, actual_value: d.actual ?? null,
                });
            }
            toast({ title: 'Uygulandı!', description: `Akıllı hedef (${val}${kpi.unit || ''}) tüm aylara uygulandı.` });
            setSmartSuggestion(null);
            setEditingTargets({});
            fetchMonthlyData();
            refreshKpis();
        } catch {
            toast({ variant: 'destructive', title: 'Hata', description: 'Öneri uygulanamadı.' });
        } finally { setIsSubmitting(false); }
    };

    const handleTargetUpdate = async () => {
        if (!kpi) return;
        setIsSubmitting(true);
        const newTarget = targetValue === '' ? null : parseFloat(targetValue);
        const { error } = await supabase.from('kpis')
            .update({ target_value: newTarget, responsible_unit: responsibleUnit || null }).eq('id', kpi.id);
        if (error) toast({ variant: 'destructive', title: 'Hata', description: 'Hedef güncellenemedi.' });
        else { toast({ title: 'Kaydedildi!' }); refreshKpis(); }
        setIsSubmitting(false);
    };

    const handleDelete = async () => {
        setIsSubmitting(true);
        const { error } = await supabase.from('kpis').delete().eq('id', kpi.id);
        if (error) toast({ variant: 'destructive', title: 'Hata', description: 'Silinemedi.' });
        else { toast({ title: 'Silindi' }); refreshKpis(); setOpen(false); }
        setIsSubmitting(false);
    };

    // ─── Türetilmiş değerler ──────────────────────────────────────────────
    const chartData = useMemo(() =>
        monthlyData.map(d => ({ month: d.monthName, Hedef: d.target, Gerçekleşen: d.actual })),
        [monthlyData]
    );

    const currentMonthData = useMemo(() =>
        monthlyData.find(d => d.year === currentYear && d.month === currentMonth),
        [monthlyData, currentYear, currentMonth]
    );

    const kpiCurrent = useMemo(() => {
        if (kpi?.current_value != null) return parseFloat(kpi.current_value);
        return currentMonthData?.actual ?? null;
    }, [kpi, currentMonthData]);

    const kpiTarget = useMemo(() => {
        const t = currentMonthData?.target ?? kpi?.target_value;
        if (t == null) return null;
        const n = parseFloat(t);
        return isNaN(n) ? null : n;
    }, [kpi, currentMonthData]);

    const hasData   = kpiCurrent != null;
    const hasTarget = kpiTarget != null && kpiTarget !== 0;

    const progressPct = useMemo(() => {
        if (!hasData || !hasTarget || kpiTarget === 0) return 0;
        if (kpi?.target_direction === 'decrease') {
            return Math.min(100, (kpiTarget / kpiCurrent) * 100);
        }
        return Math.min(100, (kpiCurrent / kpiTarget) * 100);
    }, [kpiCurrent, kpiTarget, hasData, hasTarget, kpi]);

    const isOnTarget = useMemo(() => {
        if (!hasData || !hasTarget) return null;
        return kpi?.target_direction === 'decrease'
            ? kpiCurrent <= kpiTarget
            : kpiCurrent >= kpiTarget;
    }, [hasData, hasTarget, kpiCurrent, kpiTarget, kpi]);

    const deviation = useMemo(() => {
        if (!hasData || !hasTarget || kpiTarget === 0) return null;
        return ((kpiCurrent - kpiTarget) / Math.abs(kpiTarget) * 100);
    }, [kpiCurrent, kpiTarget, hasData, hasTarget]);

    const statusConfig = useMemo(() => {
        if (!hasData) return { color: '#9ca3af', bg: '#f9fafb', label: 'Veri Yok', Icon: Activity };
        if (!hasTarget) return { color: '#6366f1', bg: '#eef2ff', label: 'Hedef Belirlenmedi', Icon: Target };
        if (isOnTarget) return { color: '#10b981', bg: '#ecfdf5', label: 'Hedefe Ulaşıldı', Icon: CheckCircle2 };
        const dev = Math.abs(deviation || 0);
        if (dev > 20) return { color: '#ef4444', bg: '#fef2f2', label: 'Kritik', Icon: AlertCircle };
        return { color: '#f97316', bg: '#fff7ed', label: 'Geliştirilmeli', Icon: Clock3 };
    }, [hasData, hasTarget, isOnTarget, deviation]);

    const ringColor = isOnTarget === true ? '#10b981' : isOnTarget === false
        ? (Math.abs(deviation || 0) > 20 ? '#ef4444' : '#f97316')
        : '#6366f1';

    const catMeta = categoryMeta[kpi?.category] || { color: '#6366f1', bg: '#eef2ff', label: kpi?.category || 'KPI' };
    const trendInfo = TREND_LABELS[smartSuggestion?.trend] || TREND_LABELS.unknown;

    const pendingCount = Object.keys(editingTargets).filter(k => editingTargets[k].trim() !== '').length;
    const hasActualData = monthlyData.some(d => d.actual != null);

    if (!kpi) return null;

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-6xl w-[98vw] max-h-[95vh] overflow-hidden flex flex-col p-0 gap-0 rounded-2xl border-0 shadow-2xl">

                {/* ── HEADER ─────────────────────────────────────────────── */}
                <div className="relative overflow-hidden shrink-0"
                    style={{ background: `linear-gradient(135deg, ${catMeta.color}ee 0%, ${catMeta.color}99 100%)` }}>
                    {/* decorative circles */}
                    <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-20"
                        style={{ background: 'white' }} />
                    <div className="absolute -bottom-4 -left-4 w-24 h-24 rounded-full opacity-10"
                        style={{ background: 'white' }} />
                    <div className="relative px-6 py-5 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="bg-white/20 backdrop-blur-sm p-2.5 rounded-xl border border-white/30">
                                <BarChart3 className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">
                                        {catMeta.label}
                                    </span>
                                    {kpi.is_auto && (
                                        <span className="text-[9px] bg-white/20 border border-white/30 text-white px-1.5 py-0.5 rounded-full font-semibold">
                                            AUTO
                                        </span>
                                    )}
                                    {isBackfilling && (
                                        <span className="text-[9px] bg-white/20 text-white px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-1">
                                            <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Senkronize ediliyor
                                        </span>
                                    )}
                                </div>
                                <h1 className="text-lg font-bold text-white leading-tight">{kpi.name}</h1>
                                {kpi.description && (
                                    <p className="text-[11px] text-white/60 mt-0.5 max-w-lg truncate">{kpi.description}</p>
                                )}
                            </div>
                        </div>
                        <button onClick={() => setOpen(false)}
                            className="bg-white/20 hover:bg-white/30 transition-colors p-1.5 rounded-lg text-white">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* HERO METRICS ROW */}
                    <div className="px-6 pb-5 grid grid-cols-3 gap-3">
                        {[
                            {
                                label: 'Mevcut Değer',
                                value: hasData ? `${fmt(kpiCurrent)}${kpi.unit || ''}` : '—',
                                sub: kpi.data_source,
                                highlight: true,
                            },
                            {
                                label: 'Hedef Değer',
                                value: hasTarget ? `${fmt(kpiTarget)}${kpi.unit || ''}` : 'Belirsiz',
                                sub: kpi.target_direction === 'decrease' ? '↓ Düşük daha iyi' : '↑ Yüksek daha iyi',
                            },
                            {
                                label: 'Bu Ay Sapma',
                                value: deviation != null
                                    ? `${deviation > 0 ? '+' : ''}${deviation.toFixed(1)}%`
                                    : 'N/A',
                                sub: statusConfig.label,
                                deviationColor: deviation == null ? null : isOnTarget ? '#10b981' : '#ef4444',
                            },
                        ].map((item, i) => (
                            <div key={i} className="bg-white/15 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3">
                                <p className="text-[10px] font-medium text-white/60 uppercase tracking-wide mb-1">{item.label}</p>
                                <p className="text-xl font-bold text-white leading-none"
                                    style={item.deviationColor ? { color: 'white' } : {}}>
                                    {item.value}
                                </p>
                                {item.sub && <p className="text-[10px] text-white/50 mt-0.5 truncate">{item.sub}</p>}
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── TABS BAR ────────────────────────────────────────────── */}
                <div className="bg-muted/40 border-b px-4 py-2 flex items-center gap-1 shrink-0 overflow-x-auto">
                    <TabBtn active={tab === 'overview'}  onClick={() => setTab('overview')}  icon={Activity}     label="Genel Bakış" />
                    <TabBtn active={tab === 'trend'}     onClick={() => setTab('trend')}     icon={TrendingUp}   label="12 Aylık Trend" />
                    <TabBtn active={tab === 'monthly'}   onClick={() => setTab('monthly')}   icon={CalendarDays} label="Aylık Veri" badge={pendingCount || null} />
                    <TabBtn active={tab === 'actions'}   onClick={() => setTab('actions')}   icon={ListTodo}     label="Aksiyonlar" badge={actions.length || null} />
                </div>

                {/* ── CONTENT ─────────────────────────────────────────────── */}
                <div className="flex-1 min-h-0 overflow-y-auto bg-background">
                    <AnimatePresence mode="wait">
                        <motion.div key={tab}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.18 }}
                            className="p-5 space-y-5"
                        >

                            {/* ══ GENEL BAKIŞ ══════════════════════════════════ */}
                            {tab === 'overview' && (
                                <>
                                    {/* Status + progress ring */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Achievement gauge */}
                                        <div className="rounded-2xl border bg-gradient-to-br from-background to-muted/30 p-5 flex items-center gap-5">
                                            <div className="relative shrink-0">
                                                <ProgressRing pct={progressPct} color={ringColor} size={88} stroke={8} />
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <span className="text-sm font-bold text-foreground">
                                                        {hasTarget && hasData ? `${Math.round(progressPct)}%` : '—'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="p-1.5 rounded-lg" style={{ background: statusConfig.bg }}>
                                                        <statusConfig.Icon className="w-3.5 h-3.5" style={{ color: statusConfig.color }} />
                                                    </div>
                                                    <span className="text-sm font-semibold" style={{ color: statusConfig.color }}>
                                                        {statusConfig.label}
                                                    </span>
                                                </div>
                                                <p className="text-2xl font-bold text-foreground leading-none mb-1">
                                                    {hasData ? `${fmt(kpiCurrent)}${kpi.unit || ''}` : '—'}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {hasTarget
                                                        ? `Hedef: ${fmt(kpiTarget)}${kpi.unit || ''}`
                                                        : 'Henüz hedef belirlenmemiş'}
                                                </p>
                                                {deviation != null && (
                                                    <div className="mt-1.5 flex items-center gap-1">
                                                        {isOnTarget
                                                            ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
                                                            : <ArrowDownRight className="w-3.5 h-3.5 text-red-500" />}
                                                        <span className="text-xs font-medium"
                                                            style={{ color: isOnTarget ? '#10b981' : '#ef4444' }}>
                                                            {deviation > 0 ? '+' : ''}{deviation.toFixed(1)}% sapma
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Mini trend (son 6 ay) */}
                                        <div className="rounded-2xl border bg-gradient-to-br from-background to-muted/30 p-5">
                                            <p className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
                                                <TrendingUp className="w-3.5 h-3.5" /> Son 6 Aylık Trend
                                            </p>
                                            {hasActualData ? (
                                                <ResponsiveContainer width="100%" height={80}>
                                                    <AreaChart data={chartData.slice(-6)}
                                                        margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                                                        <defs>
                                                            <linearGradient id="miniGrad" x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="5%" stopColor={catMeta.color} stopOpacity={0.3} />
                                                                <stop offset="95%" stopColor={catMeta.color} stopOpacity={0} />
                                                            </linearGradient>
                                                        </defs>
                                                        <XAxis dataKey="month" hide />
                                                        <YAxis hide />
                                                        <Tooltip content={<CustomTooltip unit={kpi.unit} />} />
                                                        <Area type="monotone" dataKey="Gerçekleşen" stroke={catMeta.color}
                                                            fill="url(#miniGrad)" strokeWidth={2} dot={false} />
                                                        {hasTarget && (
                                                            <Line type="monotone" dataKey="Hedef" stroke="#9ca3af"
                                                                strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
                                                        )}
                                                    </AreaChart>
                                                </ResponsiveContainer>
                                            ) : (
                                                <div className="h-20 flex items-center justify-center text-xs text-muted-foreground">
                                                    Henüz yeterli veri yok
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Akıllı Hedef Önerisi */}
                                    <div className="rounded-2xl border border-primary/20 overflow-hidden"
                                        style={{ background: 'linear-gradient(135deg, #f5f3ff 0%, #eef2ff 100%)' }}>
                                        <div className="px-5 py-4 flex items-center justify-between border-b border-primary/10">
                                            <div className="flex items-center gap-2">
                                                <div className="bg-primary/10 p-2 rounded-lg">
                                                    <Brain className="w-4 h-4 text-primary" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-foreground">Akıllı Hedef Önerisi</p>
                                                    <p className="text-[10px] text-muted-foreground">Geçmiş performans analizi ile oluşturuldu</p>
                                                </div>
                                            </div>
                                            <button onClick={fetchSmartSuggestion} disabled={loadingSmartSuggestion}
                                                className="text-primary hover:text-primary/70 transition-colors p-1.5 rounded-lg hover:bg-primary/10">
                                                <RefreshCw className={`w-3.5 h-3.5 ${loadingSmartSuggestion ? 'animate-spin' : ''}`} />
                                            </button>
                                        </div>
                                        <div className="px-5 py-4">
                                            {loadingSmartSuggestion ? (
                                                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                                    <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                                                    Geçmiş veriler analiz ediliyor...
                                                </div>
                                            ) : smartSuggestion ? (
                                                <div className="space-y-3">
                                                    <div className="flex flex-wrap items-end gap-5">
                                                        <div>
                                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Önerilen Hedef</p>
                                                            <p className="text-3xl font-black text-primary leading-none">
                                                                {fmt(smartSuggestion.suggested_value)}{kpi.unit || ''}
                                                            </p>
                                                        </div>
                                                        {smartSuggestion.recent_avg != null && (
                                                            <div>
                                                                <p className="text-[10px] text-muted-foreground">Son {smartSuggestion.months_analyzed} ay ort.</p>
                                                                <p className="text-base font-semibold text-foreground">
                                                                    {fmt(smartSuggestion.recent_avg)}{kpi.unit || ''}
                                                                </p>
                                                            </div>
                                                        )}
                                                        {smartSuggestion.trend && (
                                                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                                                                style={{ background: trendInfo.bg, color: trendInfo.color }}>
                                                                <trendInfo.icon className="w-3 h-3" />
                                                                {trendInfo.text}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <p className="text-xs text-muted-foreground">{smartSuggestion.reason}</p>
                                                        <div className="space-y-1">
                                                            <p className="text-[10px] text-muted-foreground font-medium">Güven Skoru</p>
                                                            <ConfidenceBar value={smartSuggestion.confidence} />
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2 pt-1">
                                                        <Button size="sm" onClick={handleApplySmartSuggestion}
                                                            disabled={isSubmitting} className="text-xs">
                                                            <Sparkles className="w-3 h-3 mr-1.5" />
                                                            Tüm Aylara Uygula
                                                        </Button>
                                                        <Button size="sm" variant="outline" onClick={() => {
                                                            setBulkTargetInput(String(smartSuggestion.suggested_value));
                                                            setTab('monthly');
                                                        }} className="text-xs">
                                                            Aylık Tabloda Düzenle
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-sm text-muted-foreground">
                                                    Öneri yüklenemedi. Tekrar denemek için yenile butonunu kullanın.
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* KPI bilgileri */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        {[
                                            { label: 'Veri Kaynağı', value: kpi.data_source || '—' },
                                            { label: 'Birim', value: kpi.unit?.trim() || '—' },
                                            { label: 'Hedef Yönü', value: kpi.target_direction === 'decrease' ? '↓ Düşük' : '↑ Yüksek' },
                                            { label: 'Kategori', value: catMeta.label },
                                        ].map((item, i) => (
                                            <div key={i} className="rounded-xl border bg-muted/20 px-3 py-2.5">
                                                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{item.label}</p>
                                                <p className="text-sm font-semibold text-foreground mt-0.5 truncate">{item.value}</p>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}

                            {/* ══ 12 AYLIK TREND ═══════════════════════════════ */}
                            {tab === 'trend' && (
                                <>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="font-semibold text-foreground">12 Aylık Trend Grafiği</h3>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                Gerçekleşen değerler {kpi.is_auto ? 'otomatik' : 'manuel'} olarak güncellenmektedir.
                                            </p>
                                        </div>
                                        {!hasActualData && (
                                            <Badge variant="outline" className="text-xs text-muted-foreground">Veri bekleniyor</Badge>
                                        )}
                                    </div>
                                    <div className="rounded-2xl border bg-muted/10 p-5">
                                        <ResponsiveContainer width="100%" height={280}>
                                            <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="areaActual" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor={catMeta.color} stopOpacity={0.25} />
                                                        <stop offset="95%" stopColor={catMeta.color} stopOpacity={0} />
                                                    </linearGradient>
                                                    <linearGradient id="areaTarget" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#9ca3af" stopOpacity={0.15} />
                                                        <stop offset="95%" stopColor="#9ca3af" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                                                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                                                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                                                <Tooltip content={<CustomTooltip unit={kpi.unit} />} />
                                                {hasTarget && (
                                                    <Area type="monotone" dataKey="Hedef" stroke="#9ca3af"
                                                        fill="url(#areaTarget)" strokeWidth={1.5} strokeDasharray="5 3"
                                                        dot={false} activeDot={{ r: 4, fill: '#9ca3af' }} />
                                                )}
                                                <Area type="monotone" dataKey="Gerçekleşen" stroke={catMeta.color}
                                                    fill="url(#areaActual)" strokeWidth={2.5}
                                                    dot={{ r: 3, fill: catMeta.color, strokeWidth: 0 }}
                                                    activeDot={{ r: 5, fill: catMeta.color }} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                    {/* Summary stats */}
                                    {hasActualData && (() => {
                                        const actuals = monthlyData.filter(d => d.actual != null).map(d => parseFloat(d.actual));
                                        const avg = actuals.reduce((s, v) => s + v, 0) / actuals.length;
                                        const best = kpi.target_direction === 'decrease' ? Math.min(...actuals) : Math.max(...actuals);
                                        const worst = kpi.target_direction === 'decrease' ? Math.max(...actuals) : Math.min(...actuals);
                                        return (
                                            <div className="grid grid-cols-3 gap-3">
                                                {[
                                                    { label: 'Ortalama', value: `${fmt(avg)}${kpi.unit || ''}`, color: catMeta.color },
                                                    { label: 'En İyi Ay', value: `${fmt(best)}${kpi.unit || ''}`, color: '#10b981' },
                                                    { label: 'En Kötü Ay', value: `${fmt(worst)}${kpi.unit || ''}`, color: '#ef4444' },
                                                ].map((s, i) => (
                                                    <div key={i} className="rounded-xl border bg-muted/20 px-4 py-3 text-center">
                                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{s.label}</p>
                                                        <p className="text-lg font-bold mt-0.5" style={{ color: s.color }}>{s.value}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })()}
                                </>
                            )}

                            {/* ══ AYLIK VERİ ════════════════════════════════════ */}
                            {tab === 'monthly' && (
                                <>
                                    {kpi.is_auto && (
                                        <div className="flex items-start gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                                            <Zap className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                            <span>Gerçekleşen değerler otomatik hesaplanmaktadır. Hedef değerlerini aşağıdan girebilirsiniz.</span>
                                        </div>
                                    )}

                                    {/* Toplu araçlar */}
                                    <div className="rounded-2xl border bg-gradient-to-br from-muted/30 to-muted/10 p-4 space-y-3">
                                        <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                            <CopyCheck className="w-3.5 h-3.5 text-primary" /> Toplu Hedef Belirleme
                                        </p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Tüm Aylara Aynı Hedef</Label>
                                                <div className="flex gap-2">
                                                    <Input type="number" className="h-8 text-sm" value={bulkTargetInput}
                                                        onChange={e => setBulkTargetInput(e.target.value)}
                                                        placeholder={`Örn: 10${kpi.unit || ''}`} />
                                                    <Button size="sm" variant="outline" onClick={handleApplyBulkTarget} disabled={!bulkTargetInput}>
                                                        Uygula
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Yıllık Hedef → Aylara Dağıt (÷12)</Label>
                                                <div className="flex gap-2">
                                                    <Input type="number" className="h-8 text-sm" value={annualTargetInput}
                                                        onChange={e => setAnnualTargetInput(e.target.value)}
                                                        placeholder={`Örn: 120${kpi.unit || ''}`} />
                                                    <Button size="sm" variant="outline" onClick={handleDistributeAnnual} disabled={!annualTargetInput}>
                                                        Dağıt
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Aylık tablo */}
                                    <div className="rounded-2xl border overflow-hidden">
                                        <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-semibold text-foreground">13 Aylık Hedef & Gerçekleşen</p>
                                                {pendingCount > 0 && (
                                                    <span className="text-[10px] bg-orange-100 text-orange-600 border border-orange-200 px-2 py-0.5 rounded-full font-semibold">
                                                        {pendingCount} değişiklik
                                                    </span>
                                                )}
                                            </div>
                                            <Button size="sm" onClick={handleSaveAllTargets}
                                                disabled={isSubmitting || pendingCount === 0}
                                                className="text-xs h-7 px-3">
                                                <Save className="w-3 h-3 mr-1.5" />
                                                {isSubmitting ? 'Kaydediliyor…' : `Kaydet${pendingCount > 0 ? ` (${pendingCount})` : ''}`}
                                            </Button>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="border-b bg-muted/20">
                                                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-32">Ay</th>
                                                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Gerçekleşen</th>
                                                        <th className="px-4 py-2.5 font-medium text-muted-foreground w-36">Hedef</th>
                                                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground w-24">Sapma</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {monthlyData.map((d, i) => {
                                                        const key = `${d.year}-${d.month}`;
                                                        const isCurrent = d.year === currentYear && d.month === currentMonth;
                                                        const pending = editingTargets[key];
                                                        const dispTarget = pending !== undefined ? pending : (d.target != null ? String(d.target) : '');
                                                        const tNum = parseFloat(dispTarget);
                                                        const aNum = d.actual != null ? parseFloat(d.actual) : null;
                                                        const dev = !isNaN(tNum) && tNum !== 0 && aNum != null
                                                            ? ((aNum - tNum) / Math.abs(tNum) * 100) : null;
                                                        const good = dev === null ? null : kpi.target_direction === 'decrease' ? dev <= 0 : dev >= 0;
                                                        return (
                                                            <tr key={i}
                                                                className={`border-b last:border-0 transition-colors
                                                                    ${isCurrent ? 'bg-primary/5' : 'hover:bg-muted/20'}`}>
                                                                <td className="px-4 py-2 font-medium">
                                                                    <div className="flex items-center gap-1.5">
                                                                        {isCurrent && (
                                                                            <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                                                                        )}
                                                                        {d.monthNameLong}
                                                                        {isCurrent && (
                                                                            <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">Bu Ay</span>
                                                                        )}
                                                                        {pending !== undefined && (
                                                                            <span className="text-[8px] text-orange-500">●</span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-2 text-right">
                                                                    <span className={aNum != null ? 'font-semibold text-foreground' : 'text-muted-foreground'}>
                                                                        {aNum != null ? `${fmt(aNum)}${kpi.unit || ''}` : '—'}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-2">
                                                                    <input type="number"
                                                                        className="w-full h-7 px-2 text-xs rounded-lg border border-input bg-background
                                                                            focus:outline-none focus:ring-1 focus:ring-primary transition-shadow"
                                                                        value={dispTarget}
                                                                        onChange={e => setEditingTargets(prev => ({ ...prev, [key]: e.target.value }))}
                                                                        placeholder="—" />
                                                                </td>
                                                                <td className="px-4 py-2 text-right font-semibold">
                                                                    {dev !== null ? (
                                                                        <span style={{ color: good ? '#10b981' : '#ef4444' }}>
                                                                            {dev > 0 ? '+' : ''}{dev.toFixed(1)}%
                                                                        </span>
                                                                    ) : '—'}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* ══ AKSİYONLAR ═══════════════════════════════════ */}
                            {tab === 'actions' && (
                                <>
                                    {/* Hedef güncelle */}
                                    <div className="rounded-2xl border p-5 space-y-4 bg-muted/10">
                                        <p className="text-sm font-bold text-foreground flex items-center gap-2">
                                            <Target className="w-4 h-4 text-primary" /> Genel Hedef ve Sorumlu
                                        </p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div className="space-y-1.5">
                                                <Label className="text-xs">Hedef Değer</Label>
                                                <Input type="number" value={targetValue}
                                                    onChange={e => setTargetValue(e.target.value)}
                                                    placeholder="Hedef giriniz" className="h-9" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-xs">Sorumlu Birim</Label>
                                                <Input value={responsibleUnit}
                                                    onChange={e => setResponsibleUnit(e.target.value)}
                                                    placeholder="Sorumlu birim" className="h-9" />
                                            </div>
                                        </div>
                                        <Button size="sm" onClick={handleTargetUpdate} disabled={isSubmitting} className="text-xs">
                                            <Save className="w-3.5 h-3.5 mr-1.5" />
                                            {isSubmitting ? 'Kaydediliyor…' : 'Hedefi Güncelle'}
                                        </Button>
                                    </div>

                                    {/* Aksiyon listesi */}
                                    {actions.length > 0 ? (
                                        <div className="rounded-2xl border overflow-hidden">
                                            <div className="px-4 py-3 bg-muted/20 border-b">
                                                <p className="text-sm font-semibold text-foreground">Geçmiş Aksiyonlar</p>
                                            </div>
                                            <div className="divide-y">
                                                {actions.map(a => (
                                                    <div key={a.id} className="px-4 py-3 flex items-start justify-between gap-3 hover:bg-muted/10 transition-colors">
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-foreground truncate">{a.title}</p>
                                                            {a.description && (
                                                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.description}</p>
                                                            )}
                                                        </div>
                                                        <Badge variant={a.status === 'Tamamlandı' ? 'default' : 'outline'} className="text-[10px] shrink-0">
                                                            {a.status}
                                                        </Badge>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
                                            <ListTodo className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                            <p className="text-sm">Henüz aksiyon bulunmuyor</p>
                                        </div>
                                    )}

                                    {/* Tehlike zonu */}
                                    <div className="rounded-2xl border border-red-200 bg-red-50/50 p-4">
                                        <p className="text-xs font-bold text-red-700 mb-3 flex items-center gap-1.5">
                                            <AlertCircle className="w-3.5 h-3.5" /> Tehlike Zonu
                                        </p>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="destructive" size="sm" className="text-xs">
                                                    <Trash2 className="w-3.5 h-3.5 mr-1.5" /> KPI'yi Sil
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>KPI'yi Sil</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        <strong>{kpi.name}</strong> KPI'si ve tüm aylık verisi kalıcı olarak silinecek. Bu işlem geri alınamaz.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>İptal</AlertDialogCancel>
                                                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                                        Sil
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </>
                            )}

                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* ── FOOTER ─────────────────────────────────────────────── */}
                <div className="shrink-0 border-t bg-muted/20 px-5 py-3 flex items-center justify-between">
                    <p className="text-[10px] text-muted-foreground">
                        {kpi.created_at
                            ? `Oluşturuldu: ${format(new Date(kpi.created_at), 'd MMM yyyy', { locale: tr })}`
                            : 'KPI Detay Görünümü'}
                    </p>
                    <Button variant="ghost" size="sm" onClick={() => setOpen(false)} className="text-xs h-7">
                        Kapat
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default KPIDetailModalEnhanced;
