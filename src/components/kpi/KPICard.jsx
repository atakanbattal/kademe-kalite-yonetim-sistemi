import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
    TrendingUp, TrendingDown, Minus, ShieldAlert, Factory, Truck,
    Users, FileText, Wrench, GraduationCap, BarChart3, Target,
    AlertCircle, CheckCircle2, Clock
} from 'lucide-react';
import { KPI_CATEGORIES, getAutoKpiDisplayMeta } from './kpi-definitions';

const CATEGORY_ICONS = {
    quality: ShieldAlert,
    production: Factory,
    supplier: Truck,
    customer: Users,
    document: FileText,
    equipment: Wrench,
    hr: GraduationCap,
    improvement: TrendingUp,
    management: BarChart3,
};

const CATEGORY_STYLES = {
    quality:    { border: 'border-l-red-500',    badge: 'bg-red-50 text-red-700 border-red-200',    icon: 'text-red-500',    progress: 'bg-red-500' },
    production: { border: 'border-l-orange-500', badge: 'bg-orange-50 text-orange-700 border-orange-200', icon: 'text-orange-500', progress: 'bg-orange-500' },
    supplier:   { border: 'border-l-blue-500',   badge: 'bg-blue-50 text-blue-700 border-blue-200',  icon: 'text-blue-500',   progress: 'bg-blue-500' },
    customer:   { border: 'border-l-purple-500', badge: 'bg-purple-50 text-purple-700 border-purple-200', icon: 'text-purple-500', progress: 'bg-purple-500' },
    document:   { border: 'border-l-yellow-500', badge: 'bg-yellow-50 text-yellow-700 border-yellow-200', icon: 'text-yellow-600', progress: 'bg-yellow-500' },
    equipment:  { border: 'border-l-slate-500',  badge: 'bg-slate-50 text-slate-700 border-slate-200', icon: 'text-slate-500',  progress: 'bg-slate-500' },
    hr:         { border: 'border-l-emerald-500',badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'text-emerald-500', progress: 'bg-emerald-500' },
    improvement:{ border: 'border-l-teal-500',   badge: 'bg-teal-50 text-teal-700 border-teal-200',  icon: 'text-teal-500',   progress: 'bg-teal-500' },
    management: { border: 'border-l-violet-500', badge: 'bg-violet-50 text-violet-700 border-violet-200', icon: 'text-violet-500', progress: 'bg-violet-500' },
    default:    { border: 'border-l-gray-400',   badge: 'bg-gray-50 text-gray-700 border-gray-200',  icon: 'text-gray-500',   progress: 'bg-gray-400' },
};

const formatValue = (value, unit) => {
    if (value === null || value === undefined) return '—';
    const num = parseFloat(value);
    if (isNaN(num)) return '—';
    // Büyük sayılar için kısaltma
    if (Math.abs(num) >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M${unit || ''}`;
    if (Math.abs(num) >= 100_000) return `${(num / 1_000).toFixed(0)}K${unit || ''}`;
    // Tam sayıysa ondalık gösterme
    if (Number.isInteger(num)) return `${num}${unit || ''}`;
    return `${num.toFixed(2)}${unit || ''}`;
};

const KPICard = ({ kpi, onCardClick }) => {
    const display = useMemo(() => getAutoKpiDisplayMeta(kpi), [kpi]);
    const category = display.category || kpi.category || 'default';
    const styles = CATEGORY_STYLES[category] || CATEGORY_STYLES.default;
    const catDef = KPI_CATEGORIES.find(c => c.id === category);
    const CategoryIcon = CATEGORY_ICONS[category] || Target;

    const current = parseFloat(kpi.current_value);
    const target = parseFloat(kpi.target_value);
    const hasData = !isNaN(current) && kpi.current_value !== null;
    const hasTarget = !isNaN(target) && kpi.target_value != null;

    const targetDir = display.target_direction ?? 'decrease';

    // Hedef durumu
    const isOnTarget = hasData && hasTarget
        ? targetDir === 'decrease'
            ? current <= target
            : current >= target
        : null;

    // Progress yüzdesi (0-100)
    let progressPct = 0;
    if (hasData && hasTarget) {
        if (target === 0) {
            if (targetDir === 'decrease') {
                progressPct = current <= 0 ? 100 : 0;
            } else {
                progressPct = current >= 0 ? 100 : 0;
            }
        } else if (targetDir === 'decrease') {
            progressPct = Math.min(100, Math.max(0, (target / Math.max(current, 0.001)) * 100));
        } else {
            progressPct = Math.min(100, Math.max(0, (current / target) * 100));
        }
    }

    // Durum rengi
    let statusColor = 'text-muted-foreground';
    let statusBg = 'bg-gray-100';
    let StatusIcon = Minus;
    let statusLabel = 'Veri Yok';

    if (!hasData) {
        // Hiç veri yok — varsayılan "Veri Yok" kalır
    } else if (isOnTarget === true) {
        statusColor = 'text-emerald-700';
        statusBg = 'bg-emerald-50';
        StatusIcon = CheckCircle2;
        statusLabel = 'Hedefe Ulaşıldı';
    } else if (isOnTarget === false) {
        const deviation = hasTarget && target !== 0
            ? Math.abs((current - target) / target * 100)
            : 0;
        if (deviation > 20) {
            statusColor = 'text-red-700';
            statusBg = 'bg-red-50';
            StatusIcon = AlertCircle;
            statusLabel = 'Kritik';
        } else {
            statusColor = 'text-orange-700';
            statusBg = 'bg-orange-50';
            StatusIcon = Clock;
            statusLabel = 'Geliştirilmeli';
        }
    } else {
        // Veri var ama hedef girilmemiş
        statusColor = 'text-slate-600';
        statusBg = 'bg-slate-50';
        StatusIcon = Minus;
        statusLabel = 'Hedef Yok';
    }

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.2 }}
            className={`relative bg-card rounded-xl border border-border border-l-4 ${styles.border} cursor-pointer
                        hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden`}
            onClick={() => onCardClick(kpi)}
        >
            {/* Header */}
            <div className="px-4 pt-4 pb-2">
                <div className="flex items-start justify-between gap-2">
                    {/* Kategori badge + ikon */}
                    <div className="flex items-center gap-2 min-w-0">
                        <div className={`p-1.5 rounded-lg ${styles.badge} border shrink-0`}>
                            <CategoryIcon className={`w-3.5 h-3.5 ${styles.icon}`} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] font-medium text-muted-foreground truncate">
                                {catDef?.label || display.data_source}
                            </p>
                            <h3 className="text-sm font-semibold text-foreground leading-tight line-clamp-2 mt-0.5">
                                {display.name}
                            </h3>
                        </div>
                    </div>
                    {/* Durum icon */}
                    <div className={`shrink-0 p-1 rounded-full ${statusBg}`}>
                        <StatusIcon className={`w-3.5 h-3.5 ${statusColor}`} />
                    </div>
                </div>
            </div>

            {/* Değer */}
            <div className="px-4 py-2">
                <div className="flex items-end justify-between">
                    <div>
                        <span className="text-2xl font-bold text-foreground tabular-nums">
                            {hasData ? formatValue(current, kpi.unit) : '—'}
                        </span>
                        {hasTarget && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Hedef: <span className="font-medium text-foreground">{formatValue(target, kpi.unit)}</span>
                            </p>
                        )}
                    </div>
                    {/* Durum etiketi */}
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusColor} ${statusBg}`}
                        style={{ borderColor: 'currentColor', opacity: 0.9 }}>
                        {statusLabel}
                    </span>
                </div>
            </div>

            {/* İlerleme oranı — tüm kartlarda göster */}
            <div className="px-4 pb-3">
                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                    {hasTarget && (
                        <motion.div
                            className={`h-full rounded-full ${isOnTarget ? 'bg-emerald-500' : progressPct > 60 ? 'bg-orange-400' : 'bg-red-400'}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${progressPct}%` }}
                            transition={{ duration: 0.6, ease: 'easeOut' }}
                        />
                    )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1 text-right">
                    {hasTarget
                        ? (hasData
                            ? (progressPct >= 80 && progressPct < 100 ? `Hedefe yaklaşıyorsunuz! %${progressPct.toFixed(0)}` : `%${progressPct.toFixed(0)} tamamlandı`)
                            : 'Veri girilmedi')
                        : 'Hedef belirleyin'}
                </p>
            </div>

            {/* Alt bilgi: oto/manuel */}
            <div className={`px-4 py-1.5 border-t border-border/50 flex items-center justify-between ${kpi.is_auto ? 'bg-muted/30' : 'bg-background'}`}>
                <span className="text-[10px] text-muted-foreground truncate max-w-[75%]">
                    {display.data_source}
                </span>
                <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${kpi.is_auto ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                    {kpi.is_auto ? 'Otomatik' : 'Manuel'}
                </span>
            </div>
        </motion.div>
    );
};

export default KPICard;
