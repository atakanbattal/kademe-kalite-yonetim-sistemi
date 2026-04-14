import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { AlertTriangle, CheckCircle, FileWarning, ListChecks, Percent, PieChart as PieChartIcon } from 'lucide-react';

const DECISION_COLORS = {
    Kabul: '#16a34a',
    'Şartlı Kabul': '#d97706',
    Ret: '#dc2626',
    Beklemede: '#64748b',
};

const IncomingQualityDashboard = ({
    inspections,
    loading,
    onCardClick,
    inkrReports = [],
    inkrMissingCount = 0,
    controlPlanMissingCount = 0,
    periodLabel = 'Tüm Zamanlar',
}) => {
    const stats = React.useMemo(() => {
        if (!inspections) {
            return {
                totalInspections: 0,
                conditionalAcceptance: 0,
                missingControlPlans: 0,
                missingInkr: 0,
                rejectedCount: 0,
                supplierRejectionRatePercent: null,
            };
        }
        const totalInspections = inspections.length;
        const rejectedCount = inspections.filter((i) => i.decision === 'Ret').length;
        const conditionalAcceptance = inspections.filter((i) => i.decision === 'Şartlı Kabul').length;
        const totalReceived = inspections.reduce((s, i) => s + (Number(i.quantity_received) || 0), 0);
        const totalRejectedQty = inspections.reduce((s, i) => s + (Number(i.quantity_rejected) || 0), 0);
        const supplierRejectionRatePercent =
            totalReceived > 0 ? parseFloat(((totalRejectedQty / totalReceived) * 100).toFixed(2)) : null;

        return {
            totalInspections,
            rejectedCount,
            conditionalAcceptance,
            missingControlPlans: controlPlanMissingCount,
            missingInkr: inkrMissingCount,
            supplierRejectionRatePercent,
        };
    }, [inspections, inkrMissingCount, controlPlanMissingCount]);

    const decisionBreakdown = React.useMemo(() => {
        const labels = ['Kabul', 'Şartlı Kabul', 'Ret', 'Beklemede'];
        const counts = { Kabul: 0, 'Şartlı Kabul': 0, Ret: 0, Beklemede: 0 };
        if (!inspections?.length) {
            return { items: labels.map((name) => ({ name, value: 0, pct: 0 })), total: 0 };
        }
        inspections.forEach((i) => {
            if (i.decision && Object.prototype.hasOwnProperty.call(counts, i.decision)) {
                counts[i.decision]++;
            } else if (!i.decision) {
                counts.Beklemede++;
            }
        });
        const total = inspections.length;
        const items = labels.map((name) => ({
            name,
            value: counts[name],
            pct: total > 0 ? Math.round((counts[name] / total) * 1000) / 10 : 0,
        }));
        return { items, total };
    }, [inspections]);

    const decisionSegments = React.useMemo(
        () => decisionBreakdown.items.filter((d) => d.value > 0),
        [decisionBreakdown.items]
    );

    const supplierRejectionData = React.useMemo(() => {
        if (!inspections) return [];
        const supplierData = {};
        inspections.forEach((i) => {
            if (i.supplier_name) {
                if (!supplierData[i.supplier_name]) {
                    supplierData[i.supplier_name] = { received: 0, rejected: 0 };
                }
                supplierData[i.supplier_name].received += Number(i.quantity_received) || 0;
                if (i.decision === 'Ret') {
                    supplierData[i.supplier_name].rejected += Number(i.quantity_rejected) || Number(i.quantity_received) || 0;
                }
            }
        });
        return Object.entries(supplierData)
            .map(([name, data]) => ({
                name,
                rejectionRate: data.received > 0 ? parseFloat(((data.rejected / data.received) * 100).toFixed(2)) : 0,
            }))
            .filter((item) => item.rejectionRate > 0)
            .sort((a, b) => b.rejectionRate - a.rejectionRate)
            .slice(0, 5);
    }, [inspections]);

    const metrics = [
        {
            key: 'total',
            label: 'Toplam kontrol',
            sub: periodLabel,
            value: loading ? '…' : stats.totalInspections,
            icon: ListChecks,
            onClick: () => onCardClick({ decision: 'all', controlPlanStatus: 'all', inkrStatus: 'all' }),
            valueClass: 'text-foreground',
        },
        {
            key: 'rejrate',
            label: 'Tedarikçi ret oranı',
            sub: periodLabel,
            value: loading ? '…' : stats.supplierRejectionRatePercent != null ? `${stats.supplierRejectionRatePercent}%` : '—',
            icon: Percent,
            onClick: () => onCardClick({ decision: 'Ret' }),
            valueClass: 'text-amber-600 dark:text-amber-400',
        },
        {
            key: 'ret',
            label: 'Ret',
            sub: null,
            value: loading ? '…' : stats.rejectedCount,
            icon: AlertTriangle,
            onClick: () => onCardClick({ decision: 'Ret' }),
            valueClass: 'text-destructive',
        },
        {
            key: 'cond',
            label: 'Şartlı kabul',
            sub: null,
            value: loading ? '…' : stats.conditionalAcceptance,
            icon: FileWarning,
            onClick: () => onCardClick({ decision: 'Şartlı Kabul' }),
            valueClass: 'text-amber-600 dark:text-amber-400',
        },
        {
            key: 'cp',
            label: 'Kontrol planı eksik',
            sub: 'Benzersiz parça',
            value: loading ? '…' : stats.missingControlPlans,
            icon: CheckCircle,
            onClick: () => onCardClick({ controlPlanStatus: 'Mevcut Değil' }),
            valueClass: stats.missingControlPlans > 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400',
        },
        {
            key: 'inkr',
            label: 'INKR eksik',
            sub: 'Benzersiz parça',
            value: loading ? '…' : stats.missingInkr,
            icon: FileWarning,
            onClick: () => onCardClick({ inkrStatus: 'Mevcut Değil', _switchTab: 'inkr' }),
            valueClass: stats.missingInkr > 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400',
        },
    ];

    return (
        <div className="space-y-4">
            {/* Özet göstergeler — tek panel, kart karması yok */}
            <div className="rounded-xl border border-border/80 bg-card shadow-sm overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-muted/25 px-4 py-2.5">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">Girdi kalite özeti</span>
                    </div>
                    <span className="text-xs font-medium text-muted-foreground tabular-nums">{periodLabel}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-y divide-border/60">
                    {metrics.map((m) => {
                        const Icon = m.icon;
                        return (
                            <button
                                key={m.key}
                                type="button"
                                onClick={m.onClick}
                                className="group relative flex flex-col gap-1 px-4 py-3.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground leading-tight">
                                        {m.label}
                                    </span>
                                    <Icon className={`h-4 w-4 shrink-0 opacity-70 group-hover:opacity-100 ${m.valueClass}`} aria-hidden />
                                </div>
                                <div className={`text-2xl font-semibold tabular-nums tracking-tight ${m.valueClass}`}>{m.value}</div>
                                {m.sub && <p className="text-[10px] text-muted-foreground/90 leading-snug">{m.sub}</p>}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {/* Tedarikçi ret oranları */}
                <section className="rounded-xl border border-border/80 bg-card shadow-sm overflow-hidden flex flex-col min-h-[320px]">
                    <header className="border-b border-border/60 bg-muted/30 px-4 py-3">
                        <h3 className="text-sm font-semibold text-foreground">Tedarikçi bazlı ret oranları</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">En yüksek beş tedarikçi (miktar ağırlıklı ret %)</p>
                    </header>
                    <div className="flex-1 p-4 min-h-[260px]">
                        <ResponsiveContainer width="100%" height="100%" minHeight={240}>
                            {supplierRejectionData.length > 0 ? (
                                <BarChart data={supplierRejectionData} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
                                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} domain={[0, 'dataMax + 10']} tickLine={false} />
                                    <YAxis
                                        type="category"
                                        dataKey="name"
                                        stroke="hsl(var(--muted-foreground))"
                                        fontSize={11}
                                        width={120}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <Tooltip
                                        cursor={{ fill: 'hsl(var(--accent) / 0.35)' }}
                                        contentStyle={{
                                            backgroundColor: 'hsl(var(--background))',
                                            border: '1px solid hsl(var(--border))',
                                            borderRadius: '8px',
                                            fontSize: '12px',
                                        }}
                                        formatter={(value) => [`${value}%`, 'Ret oranı']}
                                    />
                                    <Bar dataKey="rejectionRate" name="Ret oranı" fill="hsl(var(--destructive))" radius={[0, 6, 6, 0]} maxBarSize={22} />
                                </BarChart>
                            ) : (
                                <div className="flex h-[240px] items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/20 text-sm text-muted-foreground">
                                    Bu dönemde ret kaydı olan tedarikçi yok.
                                </div>
                            )}
                        </ResponsiveContainer>
                    </div>
                </section>

                {/* Kontrol karar dağılımı — pasta yerine segment şeridi + tablo */}
                <section className="rounded-xl border border-border/80 bg-card shadow-sm overflow-hidden flex flex-col min-h-[320px]">
                    <header className="border-b border-border/60 bg-muted/30 px-4 py-3">
                        <div className="flex items-center gap-2">
                            <PieChartIcon className="h-4 w-4 text-muted-foreground" aria-hidden />
                            <h3 className="text-sm font-semibold text-foreground">Kontrol karar dağılımı</h3>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">Muayene kayıtlarına göre karar oranları</p>
                    </header>
                    <div className="flex-1 p-4 space-y-5">
                        {decisionBreakdown.total > 0 ? (
                            <>
                                <div
                                    className="flex h-4 w-full overflow-hidden rounded-full bg-muted/80 ring-1 ring-border/60"
                                    role="img"
                                    aria-label="Karar dağılımı özeti"
                                >
                                    {decisionSegments.map((d) => (
                                        <div
                                            key={d.name}
                                            title={`${d.name}: ${d.value} (${d.pct}%)`}
                                            className="min-w-[4px] transition-[flex] duration-300 ease-out"
                                            style={{
                                                flexGrow: d.value,
                                                flexBasis: 0,
                                                backgroundColor: DECISION_COLORS[d.name] || '#64748b',
                                            }}
                                        />
                                    ))}
                                </div>
                                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {decisionBreakdown.items.map((d) => (
                                        <li
                                            key={d.name}
                                            className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/15 px-3 py-2 text-sm"
                                        >
                                            <div className="flex min-w-0 items-center gap-2">
                                                <span
                                                    className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-background"
                                                    style={{ backgroundColor: DECISION_COLORS[d.name] }}
                                                />
                                                <span className="truncate font-medium text-foreground">{d.name}</span>
                                            </div>
                                            <div className="flex shrink-0 items-baseline gap-2 tabular-nums">
                                                <span className="font-semibold text-foreground">{d.value}</span>
                                                <span className="text-xs text-muted-foreground w-12 text-right">{d.pct}%</span>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </>
                        ) : (
                            <div className="flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 text-center">
                                <p className="text-sm font-medium text-muted-foreground">Karar verisi yok</p>
                                <p className="text-xs text-muted-foreground/90 mt-1 max-w-xs">
                                    Seçili dönem veya filtrelerde muayene kaydı bulunmuyor.
                                </p>
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
};

export default React.memo(IncomingQualityDashboard);
