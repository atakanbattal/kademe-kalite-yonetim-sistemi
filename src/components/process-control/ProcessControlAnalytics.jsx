import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    BarChart,
    Bar,
    LineChart,
    Line,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
    BarChart3,
    ExternalLink,
    LineChart as LineChartIcon,
    PieChart as PieChartIcon,
    TrendingUp,
} from 'lucide-react';
import { formatInspectionDateOnly } from '@/lib/dateDisplay';

const PAGE = 1000;
const COLORS = ['#3b82f6', '#ef4444', '#f97316', '#10b981', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b'];

const defaultRange = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 365);
    return {
        from: start.toISOString().split('T')[0],
        to: end.toISOString().split('T')[0],
    };
};

const normalizeDefectType = (d) => (d.defect_type || '').trim() || 'Belirsiz';

/**
 * @param {object} props
 * @param {(inspectionId: string) => void} [props.onOpenInspectionRecord]
 */
const ProcessControlAnalytics = ({ onOpenInspectionRecord }) => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [inspections, setInspections] = useState([]);
    const [defectRows, setDefectRows] = useState([]);
    const [preset, setPreset] = useState('365');
    const [manualFrom, setManualFrom] = useState(() => defaultRange().from);
    const [manualTo, setManualTo] = useState(() => defaultRange().to);

    const [drillOpen, setDrillOpen] = useState(false);
    const [drillTypeLabel, setDrillTypeLabel] = useState('');

    const applyPreset = useCallback((p) => {
        const end = new Date();
        const start = new Date();
        if (p === '30') start.setDate(end.getDate() - 30);
        else if (p === '90') start.setDate(end.getDate() - 90);
        else if (p === '365') start.setDate(end.getDate() - 365);
        else if (p === 'all') {
            setManualFrom('');
            setManualTo('');
            return;
        }
        setManualFrom(start.toISOString().split('T')[0]);
        setManualTo(end.toISOString().split('T')[0]);
    }, []);

    useEffect(() => {
        if (preset !== 'custom') applyPreset(preset);
    }, [preset, applyPreset]);

    const effectiveFrom = manualFrom || null;
    const effectiveTo = manualTo || null;

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const range = defaultRange();
            let filterFrom = effectiveFrom;
            let filterTo = effectiveTo;
            if (preset === 'custom' && !filterFrom && !filterTo) {
                filterFrom = range.from;
                filterTo = range.to;
            }

            let allInspections = [];
            let from = 0;
            for (;;) {
                let query = supabase
                    .from('process_inspections')
                    .select(
                        'id, record_no, inspection_date, part_code, part_name, decision, quantity_rejected, quantity_conditional'
                    )
                    .order('inspection_date', { ascending: false });

                if (filterFrom) query = query.gte('inspection_date', filterFrom);
                if (filterTo) query = query.lte('inspection_date', filterTo);

                const { data, error } = await query.range(from, from + PAGE - 1);
                if (error) throw error;
                const batch = data || [];
                allInspections.push(...batch);
                if (batch.length < PAGE) break;
                from += PAGE;
            }

            setInspections(allInspections);

            const ids = allInspections.map((i) => i.id).filter(Boolean);
            const defects = [];
            const chunk = 200;
            for (let i = 0; i < ids.length; i += chunk) {
                const slice = ids.slice(i, i + chunk);
                const { data: drows, error: derr } = await supabase
                    .from('process_inspection_defects')
                    .select('id, inspection_id, defect_type, defect_count, description')
                    .in('inspection_id', slice);
                if (derr) throw derr;
                if (drows?.length) defects.push(...drows);
            }
            setDefectRows(defects);
        } catch (err) {
            console.error('Proses kontrol analiz verisi:', err);
            toast({ variant: 'destructive', title: 'Analiz', description: err.message || 'Veri alınamadı.' });
            setInspections([]);
            setDefectRows([]);
        } finally {
            setLoading(false);
        }
    }, [effectiveFrom, effectiveTo, preset, toast]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const inspectionById = useMemo(() => {
        const m = new Map();
        inspections.forEach((row) => {
            if (row?.id) m.set(row.id, row);
        });
        return m;
    }, [inspections]);

    const decisionPie = useMemo(() => {
        const m = {};
        inspections.forEach((row) => {
            const k = row.decision || 'Bilinmiyor';
            m[k] = (m[k] || 0) + 1;
        });
        return Object.entries(m).map(([name, value]) => ({ name, value }));
    }, [inspections]);

    const monthlyTrend = useMemo(() => {
        const months = {};
        inspections.forEach((row) => {
            if (!row.inspection_date) return;
            const monthKey = format(parseISO(row.inspection_date), 'yyyy-MM');
            if (!months[monthKey]) {
                months[monthKey] = {
                    label: format(parseISO(`${monthKey}-01`), 'MMM yyyy', { locale: tr }),
                    total: 0,
                    ret: 0,
                    sartli: 0,
                    kabul: 0,
                };
            }
            months[monthKey].total += 1;
            if (row.decision === 'Ret') months[monthKey].ret += 1;
            if (row.decision === 'Şartlı Kabul') months[monthKey].sartli += 1;
            if (row.decision === 'Kabul') months[monthKey].kabul += 1;
        });
        return Object.entries(months)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([, row]) => row);
    }, [inspections]);

    const defectTypeBars = useMemo(() => {
        const m = {};
        defectRows.forEach((d) => {
            const t = normalizeDefectType(d);
            const c = Number(d.defect_count) || 1;
            m[t] = (m[t] || 0) + c;
        });
        return Object.entries(m)
            .map(([name, adet]) => ({ name, adet }))
            .sort((a, b) => b.adet - a.adet)
            .slice(0, 15);
    }, [defectRows]);

    const drillRows = useMemo(() => {
        if (!drillTypeLabel) return [];
        return defectRows
            .filter((d) => normalizeDefectType(d) === drillTypeLabel)
            .map((d) => ({
                key: d.id || `${d.inspection_id}-${d.defect_type}-${d.description}`,
                defect: d,
                inspection: inspectionById.get(d.inspection_id) || null,
            }));
    }, [defectRows, drillTypeLabel, inspectionById]);

    const stats = useMemo(() => {
        const n = inspections.length;
        const ret = inspections.filter((i) => i.decision === 'Ret').length;
        const sartli = inspections.filter((i) => i.decision === 'Şartlı Kabul').length;
        const defectLines = defectRows.filter((d) => (d.defect_type || '').trim()).length;
        return { total: n, ret, sartli, defectLines };
    }, [inspections, defectRows]);

    const openDrillModal = useCallback((typeName) => {
        if (typeName == null || typeName === '') return;
        setDrillTypeLabel(String(typeName));
        setDrillOpen(true);
    }, []);

    const handleDefectBarClick = useCallback(
        (barData) => {
            const payload = barData?.payload ?? barData;
            const name = payload?.name;
            if (name != null) openDrillModal(name);
        },
        [openDrillModal]
    );

    const handleOpenInspection = useCallback(
        (inspectionId) => {
            if (!inspectionId || !onOpenInspectionRecord) return;
            setDrillOpen(false);
            onOpenInspectionRecord(inspectionId);
        },
        [onOpenInspectionRecord]
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 rounded-lg border bg-card p-4 shadow-sm sm:flex-row sm:items-end sm:justify-between">
                <div className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1.5">
                        <Label>Dönem</Label>
                        <Select value={preset} onValueChange={setPreset}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Dönem" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="30">Son 30 gün</SelectItem>
                                <SelectItem value="90">Son 90 gün</SelectItem>
                                <SelectItem value="365">Son 365 gün</SelectItem>
                                <SelectItem value="all">Tümü (tarih filtresiz)</SelectItem>
                                <SelectItem value="custom">Özel aralık</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {preset === 'custom' && (
                        <>
                            <div className="space-y-1.5">
                                <Label htmlFor="pc-an-from">Başlangıç</Label>
                                <Input
                                    id="pc-an-from"
                                    type="date"
                                    value={manualFrom}
                                    onChange={(e) => setManualFrom(e.target.value)}
                                    className="w-[160px]"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="pc-an-to">Bitiş</Label>
                                <Input
                                    id="pc-an-to"
                                    type="date"
                                    value={manualTo}
                                    onChange={(e) => setManualTo(e.target.value)}
                                    className="w-[160px]"
                                />
                            </div>
                        </>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="rounded-lg border p-8 text-center text-muted-foreground">Yükleniyor...</div>
            ) : (
                <>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <Card>
                            <CardHeader className="pb-1">
                                <CardTitle className="text-xs font-medium text-muted-foreground">Muayene</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.total}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-1">
                                <CardTitle className="text-xs font-medium text-red-600">Ret</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-red-700">{stats.ret}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-1">
                                <CardTitle className="text-xs font-medium text-orange-600">Şartlı Kabul</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-orange-700">{stats.sartli}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-1">
                                <CardTitle className="text-xs font-medium text-muted-foreground">Hata satırı</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.defectLines}</div>
                            </CardContent>
                        </Card>
                    </div>

                    <Tabs defaultValue="trend" className="w-full">
                        <TabsList className="grid w-full grid-cols-3 max-w-lg">
                            <TabsTrigger value="trend" className="gap-1">
                                <LineChartIcon className="h-4 w-4" />
                                Trend
                            </TabsTrigger>
                            <TabsTrigger value="decision" className="gap-1">
                                <PieChartIcon className="h-4 w-4" />
                                Karar
                            </TabsTrigger>
                            <TabsTrigger value="defects" className="gap-1">
                                <BarChart3 className="h-4 w-4" />
                                Hatalar
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="trend" className="mt-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <TrendingUp className="h-4 w-4" />
                                        Aylık muayene ve uygunsuz karar trendi
                                    </CardTitle>
                                    <CardDescription>
                                        Kayıt sayıları; Ret ve Şartlı Kabul ayrı izlenir.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="h-[360px]">
                                    {monthlyTrend.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">Bu dönemde veri yok.</p>
                                    ) : (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={monthlyTrend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                                                <Tooltip />
                                                <Legend />
                                                <Line type="monotone" dataKey="total" name="Toplam" stroke="#64748b" strokeWidth={2} dot={false} />
                                                <Line type="monotone" dataKey="ret" name="Ret" stroke="#ef4444" strokeWidth={2} />
                                                <Line type="monotone" dataKey="sartli" name="Şartlı Kabul" stroke="#f97316" strokeWidth={2} />
                                                <Line type="monotone" dataKey="kabul" name="Kabul" stroke="#22c55e" strokeWidth={2} dot={false} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="decision" className="mt-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Karar dağılımı</CardTitle>
                                    <CardDescription>Muayene kayıtlarındaki nihai kararlar.</CardDescription>
                                </CardHeader>
                                <CardContent className="h-[360px] flex items-center justify-center">
                                    {decisionPie.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">Veri yok.</p>
                                    ) : (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={decisionPie}
                                                    dataKey="value"
                                                    nameKey="name"
                                                    cx="50%"
                                                    cy="50%"
                                                    outerRadius={120}
                                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                                >
                                                    {decisionPie.map((_, i) => (
                                                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="defects" className="mt-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Hata tipi dağılımı (adet)</CardTitle>
                                    <CardDescription>Çubuğa tıklayarak o hata tipine ait satırları ve muayene kayıtlarını açın.</CardDescription>
                                </CardHeader>
                                <CardContent className="h-[420px]">
                                    {defectTypeBars.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">Bu dönemde tespit edilen hata satırı yok.</p>
                                    ) : (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart
                                                data={defectTypeBars}
                                                layout="vertical"
                                                margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                                <XAxis type="number" allowDecimals={false} />
                                                <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 11 }} />
                                                <Tooltip />
                                                <Bar
                                                    dataKey="adet"
                                                    name="Adet"
                                                    fill="#3b82f6"
                                                    radius={[0, 4, 4, 0]}
                                                    cursor="pointer"
                                                    onClick={handleDefectBarClick}
                                                />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </>
            )}

            <Dialog open={drillOpen} onOpenChange={setDrillOpen}>
                <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Hata tipi: {drillTypeLabel}</DialogTitle>
                        <DialogDescription>
                            {drillRows.length} satır — muayene kaydını görüntülemek için ilgili satırdaki bağlantıyı kullanın.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="min-h-0 flex-1 overflow-auto rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Kayıt no</TableHead>
                                    <TableHead>Tarih</TableHead>
                                    <TableHead>Parça</TableHead>
                                    <TableHead className="text-right">Adet</TableHead>
                                    <TableHead>Açıklama</TableHead>
                                    <TableHead className="w-[140px] text-right">İşlem</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {drillRows.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                                            Bu grupta satır yok.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    drillRows.map(({ key, defect, inspection }) => (
                                        <TableRow key={key}>
                                            <TableCell className="font-mono text-sm">
                                                {inspection?.record_no ?? '—'}
                                            </TableCell>
                                            <TableCell className="text-sm whitespace-nowrap">
                                                {inspection?.inspection_date
                                                    ? formatInspectionDateOnly(inspection.inspection_date)
                                                    : '—'}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                <div className="flex flex-col">
                                                    <span>{inspection?.part_code ?? '—'}</span>
                                                    {inspection?.part_name ? (
                                                        <span className="text-xs text-muted-foreground line-clamp-2">
                                                            {inspection.part_name}
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {Number(defect.defect_count) || 1}
                                            </TableCell>
                                            <TableCell className="text-sm max-w-[220px]">
                                                <span className="line-clamp-3">{defect.description || '—'}</span>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {inspection?.id && onOpenInspectionRecord ? (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="gap-1"
                                                        onClick={() => handleOpenInspection(inspection.id)}
                                                    >
                                                        <ExternalLink className="h-3.5 w-3.5" />
                                                        Kayıt
                                                    </Button>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">—</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default ProcessControlAnalytics;
