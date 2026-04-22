import React, { useMemo } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
    Cell,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    Radar,
    Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, LayoutGrid } from 'lucide-react';

const PALETTE = [
    'hsl(var(--primary))',
    '#10b981',
    '#f59e0b',
    '#8b5cf6',
    '#ec4899',
];

function truncate(str, max) {
    if (!str || str.length <= max) return str || '';
    return `${str.slice(0, max - 1)}…`;
}

/**
 * Yatay çubuk: alternatiflerin toplam (ağırlıklı) skoru
 */
export function BenchmarkRankingBars({ itemsSortedByScore, itemScores, maxRows = 14 }) {
    const data = useMemo(() => {
        return itemsSortedByScore.slice(0, maxRows).map((item) => ({
            name: truncate(item.item_name, 32),
            fullName: item.item_name,
            score: Math.round((itemScores[item.id]?.average ?? 0) * 10) / 10,
        }));
    }, [itemsSortedByScore, itemScores, maxRows]);

    if (!data.length) {
        return (
            <div className="flex h-[280px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                Skor için önce alternatif ve kriter verisi girin.
            </div>
        );
    }

    return (
        <div className="w-full max-w-full text-left [&_.recharts-surface]:outline-none">
            <ResponsiveContainer width="100%" height={Math.min(520, 80 + data.length * 36)}>
                <BarChart
                    layout="vertical"
                    data={data}
                    margin={{ top: 6, right: 20, left: 4, bottom: 28 }}
                    barCategoryGap="14%"
                >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal vertical={false} />
                    <XAxis
                        type="number"
                        domain={[0, 100]}
                        tick={{ fontSize: 11 }}
                        label={{ value: 'Skor (0–100)', position: 'bottom', offset: -4, fontSize: 11 }}
                    />
                    <YAxis
                        type="category"
                        dataKey="name"
                        width={118}
                        tick={{ fontSize: 11 }}
                        tickMargin={4}
                        axisLine={false}
                        reversed
                    />
                    <Tooltip
                        content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const row = payload[0].payload;
                            return (
                                <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-md">
                                    <p className="font-medium">{row.fullName}</p>
                                    <p className="text-muted-foreground tabular-nums">Skor: {row.score}</p>
                                </div>
                            );
                        }}
                    />
                    <Bar dataKey="score" radius={[0, 4, 4, 0]} maxBarSize={28}>
                        {data.map((_, i) => (
                            <Cell key={i} fill={i === 0 ? 'hsl(var(--primary))' : PALETTE[(i % (PALETTE.length - 1)) + 1]} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

/**
 * Kriter bazında alternatif karşılaştırması (0–100 normalize skorlar)
 */
export function BenchmarkCriteriaRadar({ radarItems, criteria, scores }) {
    const { data, keys } = useMemo(() => {
        const crit = (criteria || []).slice(0, 12);
        const items = (radarItems || []).slice(0, 5);
        if (!crit.length || !items.length) return { data: [], keys: [] };

        const rows = crit.map((criterion) => {
            const row = {
                subject: truncate(criterion.criterion_name, 22),
                fullSubject: criterion.criterion_name,
            };
            items.forEach((item, idx) => {
                const k = `${item.id}_${criterion.id}`;
                const sc = scores[k];
                row[`alt_${idx}`] =
                    sc?.normalized_score != null ? Math.min(100, Math.max(0, Number(sc.normalized_score))) : 0;
            });
            return row;
        });

        const k = items.map((_, idx) => `alt_${idx}`);
        return { data: rows, keys: k };
    }, [criteria, radarItems, scores]);

    if (!data.length) {
        return (
            <div className="flex h-[320px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                Radar için en az iki kriter ve skor gerekir. Otomatik kriterler kayıt sonrası oluşur.
            </div>
        );
    }

    return (
        <div className="w-full">
            <ResponsiveContainer width="100%" height={380}>
                <RadarChart data={data} margin={{ top: 16, right: 24, bottom: 16, left: 24 }}>
                    <PolarGrid className="stroke-muted" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
                    {(radarItems || []).slice(0, 5).map((item, idx) => (
                        <Radar
                            key={item.id}
                            name={truncate(item.item_name, 20)}
                            dataKey={keys[idx]}
                            stroke={PALETTE[idx % PALETTE.length]}
                            fill={PALETTE[idx % PALETTE.length]}
                            fillOpacity={0.12}
                            strokeWidth={2}
                            dot={{ r: 3 }}
                        />
                    ))}
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Tooltip
                        content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const p = payload[0].payload;
                            return (
                                <div className="max-w-xs rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
                                    <p className="font-semibold">{p.fullSubject || p.subject}</p>
                                    <ul className="mt-1 space-y-0.5">
                                        {payload.map((pl) => (
                                            <li key={pl.name} className="flex justify-between gap-4">
                                                <span style={{ color: pl.color }}>{pl.name}</span>
                                                <span className="tabular-nums font-medium">{Number(pl.value).toFixed(1)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            );
                        }}
                    />
                </RadarChart>
            </ResponsiveContainer>
        </div>
    );
}

/**
 * Özet üst bölümü: kazanan + kısa yorum
 */
export function BenchmarkOverviewHero({ winner, itemCount, criteriaCount, hasRadar }) {
    if (!itemCount) {
        return (
            <div className="rounded-xl border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
                Karşılaştırmak için alternatif ekleyin. İsterseniz önce kayıt ekranından veri girin; otomatik kriterler
                oluşur.
            </div>
        );
    }

    return (
        <div className="grid gap-4 md:grid-cols-3">
            <Card className="md:col-span-2 border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background">
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Trophy className="h-5 w-5 text-amber-500" />
                        Öne çıkan sonuç
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {winner ? (
                        <>
                            <p className="text-2xl font-bold tracking-tight">{winner.item.item_name}</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Ağırlıklı toplam skorda birinci:{' '}
                                <span className="font-mono font-semibold text-foreground">
                                    {winner.score != null ? Number(winner.score).toFixed(1) : '—'}
                                </span>{' '}
                                / 100
                            </p>
                        </>
                    ) : (
                        <p className="text-sm text-muted-foreground">Skor hesaplanamadı; kriter veya sayısal veri ekleyin.</p>
                    )}
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <LayoutGrid className="h-4 w-4" />
                        Özet
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Alternatif</span>
                        <span className="font-semibold">{itemCount}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Kriter</span>
                        <span className="font-semibold">{criteriaCount}</span>
                    </div>
                    <div className="flex justify-between gap-2 border-t pt-2">
                        <span className="text-muted-foreground">Radar</span>
                        <span className="text-xs">{hasRadar ? 'Aktif' : 'Kriter yetersiz'}</span>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
