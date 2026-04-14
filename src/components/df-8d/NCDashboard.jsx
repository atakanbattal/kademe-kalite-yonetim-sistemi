import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
    FileText,
    FolderOpen,
    CheckCircle,
    XCircle,
    FileSpreadsheet,
    Hourglass,
    AlertTriangle,
    BarChart,
    Percent,
    CalendarDays,
    Zap,
    TrendingUp,
    TrendingDown,
    Minus,
    PlayCircle,
} from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import {
    differenceInDays,
    parseISO,
    format,
    eachMonthOfInterval,
    isValid,
    startOfMonth,
    subMonths,
} from 'date-fns';
import { getStatusBadge, isNCOverdue } from '@/lib/statusUtils';
import { cn, normalizeUnitNameForSettings } from '@/lib/utils';

/** Sorumlu / talep birimi sütununda tek tip yazım; farklı DB yazımlarını aynı satırda birleştirir */
function bucketUnitLabel(raw) {
    if (raw == null || String(raw).trim() === '') return 'Belirtilmemiş';
    const s = String(raw).trim();
    if (s === 'Belirtilmemiş') return 'Belirtilmemiş';
    return normalizeUnitNameForSettings(s);
}

/** Aylık sayı serisi: son 6 ay monotonisi + dönem ortalaması karşılaştırması */
const getMonthlySeriesTrendInsight = (values) => {
    const n = values.length;
    if (n < 3) return { type: 'none', label: 'Yetersiz ay verisi' };

    const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
    const mid = Math.max(1, Math.floor(n / 2));
    const firstAvg = avg(values.slice(0, mid));
    const secondAvg = avg(values.slice(mid));
    const diff = secondAvg - firstAvg;
    const significant =
        Math.abs(diff) >= 0.5 || (firstAvg > 0 && Math.abs(diff / firstAvg) >= 0.08);

    const tail = values.slice(-Math.min(6, n));
    const tailAllZero = tail.every((v) => v === 0);
    if (tailAllZero && firstAvg === 0 && secondAvg === 0) {
        return { type: 'flat', label: 'Yatay trend' };
    }

    const monoUp = tail.length >= 3 && tail.every((v, i) => i === 0 || v >= tail[i - 1]);
    const monoDown = tail.length >= 3 && tail.every((v, i) => i === 0 || v <= tail[i - 1]);
    const hasStrictIncrease = tail.some((v, i) => i > 0 && v > tail[i - 1]);
    const hasStrictDecrease = tail.some((v, i) => i > 0 && v < tail[i - 1]);

    if (tail.length >= 3 && monoUp && hasStrictIncrease && secondAvg >= firstAvg - 0.01) {
        return { type: 'steady_up', label: 'Sürekli artış' };
    }
    if (tail.length >= 3 && monoDown && hasStrictDecrease && secondAvg <= firstAvg + 0.01) {
        return { type: 'steady_down', label: 'Sürekli düşüş' };
    }
    if (diff > 0 && significant) return { type: 'up', label: 'Yükseliş eğilimi' };
    if (diff < 0 && significant) return { type: 'down', label: 'Düşüş eğilimi' };
    return { type: 'flat', label: 'Yatay / dalgalı' };
};

const trendInsightBadgeClass = (type) => {
    switch (type) {
        case 'steady_up':
        case 'up':
            return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200';
        case 'steady_down':
        case 'down':
            return 'border-red-500/40 bg-red-500/10 text-red-800 dark:text-red-200';
        case 'flat':
            return 'border-border bg-muted/50 text-muted-foreground';
        default:
            return 'border-border bg-muted/30 text-muted-foreground';
    }
};

const OPENED_TREND_MONTHS = 6;

/** Son N takvim ayında, df_opened_at ile açılan kayıt sayıları (eskiden yeniye). */
const buildMonthlyOpenedCounts = (recs, refDate) => {
    const end = startOfMonth(refDate);
    const start = startOfMonth(subMonths(end, OPENED_TREND_MONTHS - 1));
    const monthStarts = eachMonthOfInterval({ start, end });
    const keys = monthStarts.map((m) => format(m, 'yyyy-MM'));
    const countByKey = Object.fromEntries(keys.map((k) => [k, 0]));
    recs.forEach((rec) => {
        if (!rec.df_opened_at) return;
        const d = parseISO(rec.df_opened_at);
        if (!isValid(d)) return;
        const k = format(startOfMonth(d), 'yyyy-MM');
        if (Object.prototype.hasOwnProperty.call(countByKey, k)) countByKey[k] += 1;
    });
    return keys.map((k) => countByKey[k]);
};

const trendInsightIconClass = (type) => {
    switch (type) {
        case 'steady_up':
        case 'up':
            return 'text-emerald-600 dark:text-emerald-400';
        case 'steady_down':
        case 'down':
            return 'text-red-600 dark:text-red-400';
        case 'flat':
            return 'text-muted-foreground';
        default:
            return 'text-muted-foreground';
    }
};

const MiniOpenedSparkline = ({ values }) => {
    const n = values.length;
    if (n === 0) return null;
    const max = Math.max(1, ...values);
    const w = 52;
    const h = 22;
    const pad = 2;
    const pts = values
        .map((v, i) => {
            const x = pad + (n <= 1 ? 0 : (i / (n - 1)) * (w - 2 * pad));
            const y = h - pad - (v / max) * (h - 2 * pad);
            return `${x.toFixed(2)},${y.toFixed(2)}`;
        })
        .join(' ');
    return (
        <svg
            width={w}
            height={h}
            viewBox={`0 0 ${w} ${h}`}
            className="shrink-0 text-primary/75 dark:text-primary/80"
            aria-hidden
        >
            <polyline
                fill="none"
                stroke="currentColor"
                strokeWidth="1.25"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={pts}
            />
        </svg>
    );
};

const OpenedTrendTableCell = ({ counts, insight }) => {
    const title = `Son ${OPENED_TREND_MONTHS} ay açılış (DF açılış tarihi): ${counts.join(' → ')}. Özet: ${insight.label}`;
    const Icon =
        insight.type === 'steady_up' || insight.type === 'up'
            ? TrendingUp
            : insight.type === 'steady_down' || insight.type === 'down'
              ? TrendingDown
              : insight.type === 'flat'
                ? Minus
                : null;
    return (
        <TableCell className="px-2 py-1.5 align-middle" title={title}>
            <div className="flex items-center justify-end gap-1.5 min-w-0">
                <MiniOpenedSparkline values={counts} />
                {Icon ? (
                    <Icon className={cn('h-4 w-4 shrink-0', trendInsightIconClass(insight.type))} aria-hidden />
                ) : (
                    <span className="text-muted-foreground text-xs w-4 text-center shrink-0">—</span>
                )}
                <span className="text-[10px] sm:text-[11px] text-muted-foreground max-w-[6.5rem] sm:max-w-[7.5rem] truncate text-right leading-tight">
                    {insight.label}
                </span>
            </div>
        </TableCell>
    );
};

const TrendInsightBadge = ({ insight, lineLabel }) => {
    const Icon =
        insight.type === 'steady_up' || insight.type === 'up'
            ? TrendingUp
            : insight.type === 'steady_down' || insight.type === 'down'
              ? TrendingDown
              : insight.type === 'flat'
                ? Minus
                : null;
    return (
        <Badge
            variant="outline"
            className={cn('gap-1 font-normal tabular-nums', trendInsightBadgeClass(insight.type))}
        >
            {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
            <span className="font-medium">{lineLabel}:</span>
            <span>{insight.label}</span>
        </Badge>
    );
};

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

const Df8dMetricTile = ({ card, onActivate }) => {
    const Icon = card.icon;
    return (
        <button
            type="button"
            onClick={() => onActivate(card.clickTitle, card.records)}
            className={cn(
                'w-full text-left rounded-xl border border-border/90 bg-card/90 backdrop-blur-sm',
                'p-3.5 sm:p-4 shadow-sm hover:shadow-md hover:border-primary/20',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                'transition-all duration-200 min-h-[108px] flex flex-col justify-between'
            )}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-semibold text-foreground leading-snug">{card.label}</p>
                </div>
                <div className={cn('rounded-lg p-2 shrink-0', card.iconBg)}>
                    <Icon className={cn('h-4 w-4 sm:h-[18px] sm:w-[18px]', card.iconClass)} aria-hidden />
                </div>
            </div>
            <div className="mt-3 pt-0.5">
                {card.isPercentage ? (
                    <p className="text-2xl sm:text-3xl font-bold tabular-nums tracking-tight text-foreground">
                        {String(card.value).replace('%', '')}
                        <span className="text-base sm:text-lg font-semibold text-muted-foreground ml-0.5">%</span>
                    </p>
                ) : (
                    <p className="text-2xl sm:text-3xl font-bold tabular-nums tracking-tight text-foreground">{card.value}</p>
                )}
            </div>
        </button>
    );
};

const DashboardCard = ({ title, icon, children, loading, className = '', description, contentClassName }) => (
    <Card className={cn('shadow-sm hover:shadow-lg transition-shadow duration-300 flex flex-col min-w-0', className)}>
        <CardHeader className="space-y-1 pb-2 sm:pb-3">
            <CardTitle className="text-base sm:text-lg font-semibold text-foreground flex items-center gap-2">
                {icon && React.createElement(icon, { className: 'w-5 h-5 text-muted-foreground shrink-0' })}
                {title}
            </CardTitle>
            {description ? <CardDescription className="text-xs sm:text-sm leading-relaxed">{description}</CardDescription> : null}
        </CardHeader>
        <CardContent
            className={cn(
                'flex-grow flex min-h-0',
                contentClassName ?? 'items-center justify-center p-4'
            )}
        >
            {loading ? (
                <Skeleton className="h-full w-full min-h-[200px]" />
            ) : !children ||
              (Array.isArray(children) && children.length === 0) ||
              (children.props && children.props.data && children.props.data.length === 0) ? (
                <div className="text-muted-foreground text-center py-8">Veri yok</div>
            ) : (
                children
            )}
        </CardContent>
    </Card>
);

const NCDashboard = ({ records, loading, onDashboardInteraction }) => {
    const { productionDepartments } = useData();
    
    // Veritabanından gelen departman listesini kullan
    const allDepartments = useMemo(() => {
        if (!productionDepartments || productionDepartments.length === 0) {
            return [];
        }
        const seen = new Set();
        const out = [];
        for (const d of productionDepartments) {
            const label = bucketUnitLabel(d.unit_name);
            if (!label || label === 'Belirtilmemiş') continue;
            if (seen.has(label)) continue;
            seen.add(label);
            out.push(label);
        }
        out.sort((a, b) => a.localeCompare(b, 'tr'));
        return out;
    }, [productionDepartments]);
    
    const analytics = useMemo(() => {
        if (!records || records.length === 0) {
            return {
                kpiStatus: [],
                kpiTypes: [],
                deptPerformance: [],
                overdueRecords: [],
                requesterContribution: [],
                monthlyTrend: [],
                monthlyTrendInsights: null,
            };
        }

        const now = new Date();
        const rowOpenedTrend = (recs) => {
            const counts = buildMonthlyOpenedCounts(recs, now);
            return { counts, insight: getMonthlySeriesTrendInsight(counts) };
        };
        const counts = { DF: 0, '8D': 0, MDI: 0, open: 0, closed: 0, rejected: 0, overdue: 0, inProgress: 0 };
        const deptPerf = {};
        const requesterContrib = {};
        
        let allDates = [];

        records.forEach(rec => {
            const isClosed = rec.status === 'Kapatıldı';
            const isRejected = rec.status === 'Reddedildi';
            const isOpen = !isClosed && !isRejected;

            if (isOpen) counts.open++;
            if (rec.status === 'İşlemde') counts.inProgress++;
            if (isClosed) counts.closed++;
            if (isRejected) counts.rejected++;
            if (rec.type in counts) counts[rec.type]++;
            
            const isOverdue = isNCOverdue(rec, now);
            
            const responsibleDept = bucketUnitLabel(rec.department);
            if (!deptPerf[responsibleDept]) {
                deptPerf[responsibleDept] = {
                    open: 0,
                    closed: 0,
                    overdue: 0,
                    inProgress: 0,
                    rejected: 0,
                    totalClosureDays: 0,
                    closedCount: 0,
                    records: [],
                };
            }
            deptPerf[responsibleDept].records.push(rec);

            if (rec.status === 'İşlemde') deptPerf[responsibleDept].inProgress++;
            if (isRejected) deptPerf[responsibleDept].rejected++;

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
            
            const requesterUnit = bucketUnitLabel(rec.requesting_unit);
            if (!requesterContrib[requesterUnit]) {
                requesterContrib[requesterUnit] = {
                    total: 0,
                    DF: 0,
                    '8D': 0,
                    MDI: 0,
                    open: 0,
                    closed: 0,
                    inProgress: 0,
                    rejected: 0,
                    records: [],
                };
            }
            requesterContrib[requesterUnit].records.push(rec);
            requesterContrib[requesterUnit].total++;
            if (rec.type in requesterContrib[requesterUnit]) requesterContrib[requesterUnit][rec.type]++;
            if (rec.status === 'İşlemde') requesterContrib[requesterUnit].inProgress++;
            if (isOpen) requesterContrib[requesterUnit].open++;
            if (isClosed) requesterContrib[requesterUnit].closed++;
            if (isRejected) requesterContrib[requesterUnit].rejected++;

            if (rec.df_opened_at) {
                const openedDate = parseISO(rec.df_opened_at);
                if(isValid(openedDate)) allDates.push(openedDate);
            }
            if (rec.closed_at) {
                const closedDate = parseISO(rec.closed_at);
                if(isValid(closedDate)) allDates.push(closedDate);
            }
        });

        const overdueRecords = records.filter(record => isNCOverdue(record, now)).sort((a,b) => {
             const dueA = a.due_at ? parseISO(a.due_at) : null;
             const dueB = b.due_at ? parseISO(b.due_at) : null;
             if (!dueA || !dueB || !isValid(dueA) || !isValid(dueB)) return 0;
             return differenceInDays(new Date(), dueB) - differenceInDays(new Date(), dueA);
        });

        counts.overdue = overdueRecords.length;

        // Kapatma oranı hesapla (Kapatılan / (Kapatılan + Açık) * 100) - Reddedilenler hesaba katılmaz
        const totalProcessed = counts.closed + counts.open;
        const closureRate = totalProcessed > 0 ? ((counts.closed / totalProcessed) * 100).toFixed(1) : 0;

        const inProgressRecords = records.filter(r => r.status === 'İşlemde');

        const kpiStatus = [
            {
                clickTitle: 'Açık',
                label: 'Açık kayıtlar',
                value: counts.open,
                icon: FolderOpen,
                iconBg: 'bg-blue-500/10 dark:bg-blue-500/15',
                iconClass: 'text-blue-600 dark:text-blue-400',
                records: records.filter(r => r.status !== 'Kapatıldı' && r.status !== 'Reddedildi'),
            },
            {
                clickTitle: 'İşlemde',
                label: 'İşlemde',
                value: counts.inProgress,
                icon: PlayCircle,
                iconBg: 'bg-sky-500/10 dark:bg-sky-500/15',
                iconClass: 'text-sky-600 dark:text-sky-400',
                records: inProgressRecords,
            },
            {
                clickTitle: 'Kapalı',
                label: 'Kapatılan',
                value: counts.closed,
                icon: CheckCircle,
                iconBg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
                iconClass: 'text-emerald-600 dark:text-emerald-400',
                records: records.filter(r => r.status === 'Kapatıldı'),
            },
            {
                clickTitle: 'Kapanma',
                label: 'Kapanma oranı',
                value: `%${closureRate}`,
                isPercentage: true,
                icon: TrendingUp,
                iconBg: 'bg-teal-500/10 dark:bg-teal-500/15',
                iconClass: 'text-teal-600 dark:text-teal-400',
                records: records.filter(r => r.status === 'Kapatıldı'),
            },
            {
                clickTitle: 'Geciken',
                label: 'Termin geciken',
                value: counts.overdue,
                icon: AlertTriangle,
                iconBg: 'bg-amber-500/10 dark:bg-amber-500/15',
                iconClass: 'text-amber-600 dark:text-amber-400',
                records: overdueRecords,
            },
            {
                clickTitle: 'Reddedildi',
                label: 'Reddedilen',
                value: counts.rejected,
                icon: XCircle,
                iconBg: 'bg-red-500/10 dark:bg-red-500/15',
                iconClass: 'text-red-600 dark:text-red-400',
                records: records.filter(r => r.status === 'Reddedildi'),
            },
        ];

        const kpiTypes = [
            {
                clickTitle: 'DF',
                label: 'DF',
                value: counts.DF,
                icon: FileText,
                iconBg: 'bg-indigo-500/10 dark:bg-indigo-500/15',
                iconClass: 'text-indigo-600 dark:text-indigo-400',
                records: records.filter(r => r.type === 'DF'),
            },
            {
                clickTitle: '8D',
                label: '8D',
                value: counts['8D'],
                icon: FileSpreadsheet,
                iconBg: 'bg-violet-500/10 dark:bg-violet-500/15',
                iconClass: 'text-violet-600 dark:text-violet-400',
                records: records.filter(r => r.type === '8D'),
            },
            {
                clickTitle: 'MDI',
                label: 'MDI',
                value: counts.MDI,
                icon: Hourglass,
                iconBg: 'bg-fuchsia-500/10 dark:bg-fuchsia-500/15',
                iconClass: 'text-fuchsia-600 dark:text-fuchsia-400',
                records: records.filter(r => r.type === 'MDI'),
            },
        ];

        const deptPerformance = Object.entries(deptPerf).map(([name, data]) => {
            const total = data.records.length;
            const pipeline = data.open + data.closed;
            const closurePct = pipeline > 0 ? ((data.closed / pipeline) * 100).toFixed(1) : '—';
            const ot = rowOpenedTrend(data.records);
            return {
                unit: name,
                total,
                open: data.open,
                closed: data.closed,
                inProgress: data.inProgress,
                rejected: data.rejected,
                overdue: data.overdue,
                avgClosureTime: data.closedCount > 0 ? (data.totalClosureDays / data.closedCount).toFixed(1) : '—',
                closurePct,
                records: data.records,
                openedTrendCounts: ot.counts,
                openedTrendInsight: ot.insight,
            };
        }).sort((a, b) => b.total - a.total);

        const totalRequests = records.length;
        
        // Veritabanındaki tüm birimleri kullan + kayıtlarda geçen ama listede olmayan birimleri de ekle
        const allUnitsSet = new Set(allDepartments);
        Object.keys(requesterContrib).forEach(unit => {
            if (unit !== 'Belirtilmemiş') {
                allUnitsSet.add(unit);
            }
        });
        const allUnits = Array.from(allUnitsSet).sort();
        
        // Tüm birimleri dahil et (0 katkısı olanlar dahil)
        const requesterContribution = allUnits.map(dept => {
            const data = requesterContrib[dept] || {
                total: 0,
                DF: 0,
                '8D': 0,
                MDI: 0,
                open: 0,
                closed: 0,
                inProgress: 0,
                rejected: 0,
                records: [],
            };
            const pctNum = totalRequests > 0 ? (data.total / totalRequests) * 100 : 0;
            const ot = rowOpenedTrend(data.records);
            return {
                unit: dept,
                total: data.total,
                DF: data.DF,
                '8D': data['8D'],
                MDI: data.MDI,
                open: data.open,
                closed: data.closed,
                inProgress: data.inProgress,
                rejected: data.rejected,
                contribution: totalRequests > 0 ? `${pctNum.toFixed(1)}%` : '0%',
                contributionPct: pctNum,
                records: data.records,
                openedTrendCounts: ot.counts,
                openedTrendInsight: ot.insight,
            };
        }).sort((a, b) => b.total - a.total);
        
        // "Belirtilmemiş" kategorisini de ekle (varsa)
        if (requesterContrib['Belirtilmemiş']) {
            const data = requesterContrib['Belirtilmemiş'];
            const pctNum = totalRequests > 0 ? (data.total / totalRequests) * 100 : 0;
            const otUnspec = rowOpenedTrend(data.records);
            requesterContribution.push({
                unit: 'Belirtilmemiş',
                total: data.total,
                DF: data.DF,
                '8D': data['8D'],
                MDI: data.MDI,
                open: data.open,
                closed: data.closed,
                inProgress: data.inProgress,
                rejected: data.rejected,
                contribution: totalRequests > 0 ? `${pctNum.toFixed(1)}%` : '0%',
                contributionPct: pctNum,
                records: data.records,
                openedTrendCounts: otUnspec.counts,
                openedTrendInsight: otUnspec.insight,
            });
        }

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

        const monthlyTrendInsights =
            monthlyTrend.length >= 3
                ? {
                      opened: getMonthlySeriesTrendInsight(monthlyTrend.map((m) => m.opened ?? 0)),
                      closed: getMonthlySeriesTrendInsight(monthlyTrend.map((m) => m.closed ?? 0)),
                  }
                : null;

        return {
            kpiStatus,
            kpiTypes,
            deptPerformance,
            overdueRecords,
            requesterContribution,
            monthlyTrend,
            monthlyTrendInsights,
        };
    }, [records, allDepartments]);

    const deptTableSummary = useMemo(() => {
        const n = analytics.deptPerformance.length;
        const sum = analytics.deptPerformance.reduce((s, d) => s + d.total, 0);
        const openSum = analytics.deptPerformance.reduce((s, d) => s + d.open, 0);
        const closedSum = analytics.deptPerformance.reduce((s, d) => s + d.closed, 0);
        if (n === 0) return null;
        return `${n} sorumlu birim · ${sum} kayıt · ${openSum} açık · ${closedSum} kapalı (görünümdeki kayıtlar)`;
    }, [analytics.deptPerformance]);

    const requesterTableSummary = useMemo(() => {
        const n = analytics.requesterContribution.length;
        const withTalep = analytics.requesterContribution.filter((r) => r.total > 0).length;
        if (n === 0) return null;
        return `${n} talep birimi (${withTalep} tanesinde kayıt var) · toplam ${records?.length ?? 0} kayıt`;
    }, [analytics.requesterContribution, records?.length]);

    if (loading) {
        return <Skeleton className="h-64 w-full" />;
    }

    const handleCardClick = (title, records) => {
        if (onDashboardInteraction) {
            onDashboardInteraction(`${title} Kayıtları`, records);
        }
    };

    const containerVariants = { hidden: {}, visible: { transition: { staggerChildren: 0.08 } }};
    const now = new Date();

    return (
        <motion.div initial="hidden" animate="visible" variants={containerVariants} className="space-y-6 min-w-0">
            <div className="rounded-xl border border-border bg-gradient-to-br from-muted/25 via-background to-muted/10 p-4 sm:p-5 space-y-5 shadow-sm">
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                        Durum özeti
                    </p>
                    <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                        {analytics.kpiStatus.map((card) => (
                            <Df8dMetricTile key={card.clickTitle} card={card} onActivate={handleCardClick} />
                        ))}
                    </div>
                </div>
                <div className="pt-1 border-t border-border/60">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                        Kayıt tipi dağılımı
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-4xl">
                        {analytics.kpiTypes.map((card) => (
                            <Df8dMetricTile key={card.clickTitle} card={card} onActivate={handleCardClick} />
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
                <DashboardCard
                    title="Departman Bazlı Performans"
                    icon={BarChart}
                    loading={loading}
                    className="lg:col-span-2"
                    description={
                        deptTableSummary
                            ? `${deptTableSummary} — Sorumlu departmana göre açık/kapalı dağılım, gecikenler ve kapanma performansı.`
                            : undefined
                    }
                    contentClassName="w-full flex-1 flex-col items-stretch justify-start px-4 pb-5 sm:px-6 sm:pb-6 pt-0 gap-3 min-h-0"
                >
                    <p className="text-[11px] sm:text-xs text-muted-foreground">
                        Satıra tıklayarak o departmana atanmış tüm kayıtları listede görebilirsiniz.{' '}
                        <span className="text-foreground/80">
                            Açılış trendi: son {OPENED_TREND_MONTHS} ayda DF açılış tarihine göre aylık adet (çizgi + ok).
                        </span>
                    </p>
                    <div className="w-full min-h-[min(22rem,45vh)] h-[min(28rem,52vh)] overflow-auto rounded-lg border border-border/70 bg-muted/20">
                        <Table className="min-w-[880px] w-full">
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="sticky left-0 z-[1] bg-card px-3 py-2.5 text-xs sm:text-sm font-semibold shadow-[4px_0_8px_-4px_rgba(0,0,0,0.15)]">
                                        Sorumlu birim
                                    </TableHead>
                                    <TableHead className="text-center whitespace-nowrap px-2 py-2.5 text-xs sm:text-sm">Toplam</TableHead>
                                    <TableHead className="text-center whitespace-nowrap px-2 py-2.5 text-xs sm:text-sm">Açık</TableHead>
                                    <TableHead className="text-center whitespace-nowrap px-2 py-2.5 text-xs sm:text-sm">İşlemde</TableHead>
                                    <TableHead className="text-center whitespace-nowrap px-2 py-2.5 text-xs sm:text-sm">Kapalı</TableHead>
                                    <TableHead className="text-center whitespace-nowrap px-2 py-2.5 text-xs sm:text-sm">Red</TableHead>
                                    <TableHead className="text-center whitespace-nowrap px-2 py-2.5 text-xs sm:text-sm text-destructive">
                                        Geciken
                                    </TableHead>
                                    <TableHead className="text-center whitespace-nowrap px-2 py-2.5 text-xs sm:text-sm">
                                        Ort. kapanma (gün)
                                    </TableHead>
                                    <TableHead className="text-right whitespace-nowrap px-2 py-2.5 text-xs sm:text-sm">
                                        Kapanma %
                                    </TableHead>
                                    <TableHead className="text-right whitespace-nowrap px-2 py-2.5 text-xs sm:text-sm min-w-[9.5rem]">
                                        Açılış trendi
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {analytics.deptPerformance.map((dept) => (
                                    <TableRow
                                        key={dept.unit}
                                        className="cursor-pointer hover:bg-muted/60"
                                        onClick={() => onDashboardInteraction(`${dept.unit} Kayıtları`, dept.records)}
                                    >
                                        <TableCell
                                            className="sticky left-0 z-[1] bg-card font-medium px-3 py-2 text-xs sm:text-sm max-w-[14rem] truncate shadow-[4px_0_8px_-4px_rgba(0,0,0,0.12)]"
                                            title={dept.unit}
                                        >
                                            {dept.unit}
                                        </TableCell>
                                        <TableCell className="text-center tabular-nums px-2 py-2 text-xs sm:text-sm">{dept.total}</TableCell>
                                        <TableCell className="text-center tabular-nums px-2 py-2 text-xs sm:text-sm">{dept.open}</TableCell>
                                        <TableCell className="text-center tabular-nums px-2 py-2 text-xs sm:text-sm text-sky-700 dark:text-sky-300">
                                            {dept.inProgress}
                                        </TableCell>
                                        <TableCell className="text-center tabular-nums px-2 py-2 text-xs sm:text-sm">{dept.closed}</TableCell>
                                        <TableCell className="text-center tabular-nums px-2 py-2 text-xs sm:text-sm text-muted-foreground">
                                            {dept.rejected}
                                        </TableCell>
                                        <TableCell className="text-center font-semibold text-destructive tabular-nums px-2 py-2 text-xs sm:text-sm">
                                            {dept.overdue}
                                        </TableCell>
                                        <TableCell className="text-center tabular-nums px-2 py-2 text-xs sm:text-sm">{dept.avgClosureTime}</TableCell>
                                        <TableCell className="text-right font-medium tabular-nums px-2 py-2 text-xs sm:text-sm whitespace-nowrap">
                                            {dept.closurePct === '—' ? (
                                                '—'
                                            ) : (
                                                <>
                                                    {dept.closurePct}
                                                    <span className="text-muted-foreground font-normal">%</span>
                                                </>
                                            )}
                                        </TableCell>
                                        <OpenedTrendTableCell
                                            counts={dept.openedTrendCounts}
                                            insight={dept.openedTrendInsight}
                                        />
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </DashboardCard>

                <DashboardCard
                    title="Talep Eden Birim Katkısı"
                    icon={Percent}
                    loading={loading}
                    className="lg:col-span-2"
                    description={
                        requesterTableSummary
                            ? `${requesterTableSummary} — Talep eden birime göre hacim, durum kırılımı ve DF/8D/MDI dağılımı.`
                            : undefined
                    }
                    contentClassName="w-full flex-1 flex-col items-stretch justify-start px-4 pb-5 sm:px-6 sm:pb-6 pt-0 gap-3 min-h-0"
                >
                    <p className="text-[11px] sm:text-xs text-muted-foreground">
                        Satıra tıklayarak o birimden gelen talepleri listede görebilirsiniz. Katkı %, görünümdeki tüm kayıtlar içindeki payı gösterir.{' '}
                        <span className="text-foreground/80">
                            Açılış trendi bu birime ait kayıtların son {OPENED_TREND_MONTHS} aydaki açılış hızını gösterir.
                        </span>
                    </p>
                    <div className="w-full min-h-[min(22rem,45vh)] h-[min(28rem,52vh)] overflow-auto rounded-lg border border-border/70 bg-muted/20">
                        <Table className="min-w-[1020px] w-full">
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="sticky left-0 z-[1] bg-card px-3 py-2.5 text-xs sm:text-sm font-semibold shadow-[4px_0_8px_-4px_rgba(0,0,0,0.15)]">
                                        Talep eden birim
                                    </TableHead>
                                    <TableHead className="text-center whitespace-nowrap px-2 py-2.5 text-xs sm:text-sm">Toplam</TableHead>
                                    <TableHead className="text-center whitespace-nowrap px-2 py-2.5 text-xs sm:text-sm">Açık</TableHead>
                                    <TableHead className="text-center whitespace-nowrap px-2 py-2.5 text-xs sm:text-sm">İşlemde</TableHead>
                                    <TableHead className="text-center whitespace-nowrap px-2 py-2.5 text-xs sm:text-sm">Kapalı</TableHead>
                                    <TableHead className="text-center whitespace-nowrap px-2 py-2.5 text-xs sm:text-sm">Red</TableHead>
                                    <TableHead className="text-center whitespace-nowrap px-2 py-2.5 text-xs sm:text-sm">DF</TableHead>
                                    <TableHead className="text-center whitespace-nowrap px-2 py-2.5 text-xs sm:text-sm">8D</TableHead>
                                    <TableHead className="text-center whitespace-nowrap px-2 py-2.5 text-xs sm:text-sm">MDI</TableHead>
                                    <TableHead className="text-right whitespace-nowrap px-2 py-2.5 text-xs sm:text-sm min-w-[9.5rem]">
                                        Açılış trendi
                                    </TableHead>
                                    <TableHead className="text-right whitespace-nowrap px-2 py-2.5 text-xs sm:text-sm w-[5.5rem]">Katkı</TableHead>
                                    <TableHead className="min-w-[7rem] px-2 py-2.5 text-xs sm:text-sm">Pay (görsel)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {analytics.requesterContribution.map((req) => (
                                    <TableRow
                                        key={req.unit}
                                        className="cursor-pointer hover:bg-muted/60"
                                        onClick={() => onDashboardInteraction(`${req.unit} Talepleri`, req.records)}
                                    >
                                        <TableCell
                                            className="sticky left-0 z-[1] bg-card font-medium px-3 py-2 text-xs sm:text-sm max-w-[14rem] truncate shadow-[4px_0_8px_-4px_rgba(0,0,0,0.12)]"
                                            title={req.unit}
                                        >
                                            {req.unit}
                                        </TableCell>
                                        <TableCell className="text-center tabular-nums px-2 py-2 text-xs sm:text-sm">{req.total}</TableCell>
                                        <TableCell className="text-center tabular-nums px-2 py-2 text-xs sm:text-sm">{req.open}</TableCell>
                                        <TableCell className="text-center tabular-nums px-2 py-2 text-xs sm:text-sm text-sky-700 dark:text-sky-300">
                                            {req.inProgress}
                                        </TableCell>
                                        <TableCell className="text-center tabular-nums px-2 py-2 text-xs sm:text-sm">{req.closed}</TableCell>
                                        <TableCell className="text-center tabular-nums px-2 py-2 text-xs sm:text-sm text-muted-foreground">
                                            {req.rejected}
                                        </TableCell>
                                        <TableCell className="text-center tabular-nums px-2 py-2 text-xs sm:text-sm">{req.DF}</TableCell>
                                        <TableCell className="text-center tabular-nums px-2 py-2 text-xs sm:text-sm">{req['8D']}</TableCell>
                                        <TableCell className="text-center tabular-nums px-2 py-2 text-xs sm:text-sm">{req.MDI}</TableCell>
                                        <OpenedTrendTableCell
                                            counts={req.openedTrendCounts}
                                            insight={req.openedTrendInsight}
                                        />
                                        <TableCell className="text-right font-semibold tabular-nums px-2 py-2 text-xs sm:text-sm whitespace-nowrap">
                                            {req.contribution}
                                        </TableCell>
                                        <TableCell className="px-2 py-2 align-middle">
                                            <Progress
                                                value={Math.min(100, req.contributionPct)}
                                                className="h-2 bg-muted"
                                                indicatorClassName="bg-primary/90"
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </DashboardCard>
                
                <DashboardCard
                    title="Aylık Trend (Açılış/Kapanış)"
                    icon={Zap}
                    loading={loading}
                    className="lg:col-span-2"
                    description="Son ayların serisi; aşağıdaki ibareler son dönemde sürekli artış/düşüş veya genel eğilimi özetler (en az 3 ay gerekir)."
                    contentClassName="w-full flex-1 flex-col items-stretch justify-start gap-3 px-4 pb-5 sm:px-6 sm:pb-6 pt-0 min-h-0"
                >
                    {analytics.monthlyTrendInsights ? (
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] sm:text-xs font-medium text-muted-foreground shrink-0">
                                Trend yönü
                            </span>
                            <TrendInsightBadge insight={analytics.monthlyTrendInsights.opened} lineLabel="Açılan" />
                            <TrendInsightBadge insight={analytics.monthlyTrendInsights.closed} lineLabel="Kapatılan" />
                        </div>
                    ) : analytics.monthlyTrend.length > 0 ? (
                        <p className="text-[11px] sm:text-xs text-muted-foreground">
                            Trend özeti için en az üç aylık veri gerekir.
                        </p>
                    ) : null}
                    <div className="w-full min-h-[280px] h-[300px] shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
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
                    </div>
                </DashboardCard>
                
                <DashboardCard title="Termin Süresi Geciken Uygunsuzluklar" icon={CalendarDays} loading={loading} className="lg:col-span-2">
                    {analytics.overdueRecords.length > 0 ? (
                        <div className="h-80 w-full overflow-auto min-w-0">
                            <Table className="min-w-0 w-full table-fixed">
                                <colgroup>
                                    <col style={{ width: '14%' }} />
                                    <col style={{ width: '28%' }} />
                                    <col style={{ width: '18%' }} />
                                    <col style={{ width: '18%' }} />
                                    <col style={{ width: '14%' }} />
                                    <col style={{ width: '14%' }} />
                                </colgroup>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="px-2 py-1.5 text-xs">No/Tip</TableHead>
                                        <TableHead className="px-2 py-1.5 text-xs">Konu</TableHead>
                                        <TableHead className="px-2 py-1.5 text-xs">Birim</TableHead>
                                        <TableHead className="px-2 py-1.5 text-xs">Termin</TableHead>
                                        <TableHead className="px-2 py-1.5 text-xs">Durum</TableHead>
                                        <TableHead className="text-right px-2 py-1.5 text-xs">Gecikme (Gün)</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {analytics.overdueRecords.map(rec => {
                                        const dueAt = rec.due_at ? parseISO(rec.due_at) : null;
                                        return (
                                            <TableRow key={rec.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleCardClick("Geciken", [rec])}>
                                                <TableCell className="px-2 py-1.5 text-xs"><Badge variant="secondary" className="text-xs">{rec.nc_number || rec.mdi_no}</Badge></TableCell>
                                                <TableCell className="font-medium px-2 py-1.5 text-xs truncate max-w-0" title={rec.title}>{rec.title}</TableCell>
                                                <TableCell className="px-2 py-1.5 text-xs truncate max-w-0" title={rec.department}>{rec.department}</TableCell>
                                                <TableCell className="px-2 py-1.5 text-xs">{dueAt && isValid(dueAt) ? format(dueAt, 'dd.MM.yyyy') : '-'}</TableCell>
                                                <TableCell className="px-2 py-1.5 text-xs">{getStatusBadge(rec)}</TableCell>
                                                <TableCell className="text-right font-bold text-destructive px-2 py-1.5 text-xs">{dueAt && isValid(dueAt) ? differenceInDays(now, dueAt) : '-'}</TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    ) : <div className="text-green-600 font-semibold flex items-center justify-center h-full gap-2"><CheckCircle/>Geciken kayıt bulunmuyor.</div>}
                </DashboardCard>
            </div>
        </motion.div>
    );
};

export default NCDashboard;
