import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { Save, Trash2, AlertTriangle, TrendingUp, Plus, Target, RefreshCw, Zap, Info, CopyCheck, CalendarDays, Sparkles } from 'lucide-react';
import { format, subMonths } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const KPIDetailModalEnhanced = ({ kpi, open, setOpen, refreshKpis }) => {
    const { toast } = useToast();
    const [targetValue, setTargetValue] = useState(kpi?.target_value || '');
    const [responsibleUnit, setResponsibleUnit] = useState(kpi?.responsible_unit || '');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [monthlyData, setMonthlyData] = useState([]);
    const [actions, setActions] = useState([]);
    const [loadingMonthly, setLoadingMonthly] = useState(false);
    const [currentMonthTarget, setCurrentMonthTarget] = useState('');
    const [currentMonthActual, setCurrentMonthActual] = useState('');
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
    const [suggestion, setSuggestion] = useState(null);
    const [showSuggestionModal, setShowSuggestionModal] = useState(false);
    const [isBackfilling, setIsBackfilling] = useState(false);
    const [lastBackfillTime, setLastBackfillTime] = useState(null);
    // Toplu hedef girişi için
    const [editingTargets, setEditingTargets] = useState({});
    const [bulkTargetInput, setBulkTargetInput] = useState('');
    const [annualTargetInput, setAnnualTargetInput] = useState('');
    // Akıllı hedef önerisi
    const [smartSuggestion, setSmartSuggestion] = useState(null);
    const [loadingSmartSuggestion, setLoadingSmartSuggestion] = useState(false);

    // Auto KPI açıldığında aylık veriyi backfill et, sonra yükle
    const runBackfillAndLoad = useCallback(async () => {
        if (!kpi?.is_auto) return;
        setIsBackfilling(true);
        try {
            await supabase.rpc('backfill_kpi_monthly_data', { p_months_back: 13 });
            setLastBackfillTime(new Date());
        } catch (err) {
            console.warn('Backfill hatası:', err);
        } finally {
            setIsBackfilling(false);
        }
    }, [kpi?.is_auto]);

    useEffect(() => {
        if (kpi) {
            setTargetValue(kpi.target_value !== null ? String(kpi.target_value) : '');
            setResponsibleUnit(kpi.responsible_unit || '');
            setEditingTargets({});
            setBulkTargetInput('');
            setAnnualTargetInput('');
            setSmartSuggestion(null);
            if (kpi.is_auto) {
                runBackfillAndLoad().then(() => {
                    fetchMonthlyData();
                    fetchActions();
                    checkTargetAndSuggest();
                    fetchSmartSuggestion();
                });
            } else {
                fetchMonthlyData();
                fetchActions();
                checkTargetAndSuggest();
                fetchSmartSuggestion();
            }
        }
    }, [kpi?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchMonthlyData = async () => {
        if (!kpi) return;
        setLoadingMonthly(true);
        try {
            const { data, error } = await supabase
                .from('kpi_monthly_data')
                .select('*')
                .eq('kpi_id', kpi.id)
                .order('year', { ascending: true })
                .order('month', { ascending: true });

            if (error) throw error;
            
            // Son 13 ayı al (backfill 13 ay yapıyor)
            const now = new Date();
            const last13Months = [];
            for (let i = 12; i >= 0; i--) {
                const date = subMonths(now, i);
                const year = date.getFullYear();
                const month = date.getMonth() + 1;
                const existing = data?.find(d => d.year === year && d.month === month);
                last13Months.push({
                    year,
                    month,
                    monthName: format(date, 'MMM yyyy', { locale: tr }),
                    // ?? null: 0 değerleri kaybolmasın (|| null yanlış çalışıyordu)
                    target: existing != null ? (existing.target_value ?? null) : null,
                    actual: existing != null ? (existing.actual_value ?? null) : null,
                    id: existing?.id ?? null
                });
            }
            setMonthlyData(last13Months);

            // Mevcut ay verisini set et
            const currentData = data?.find(d => d.year === currentYear && d.month === currentMonth);
            if (currentData) {
                setCurrentMonthTarget(currentData.target_value != null ? String(currentData.target_value) : '');
                setCurrentMonthActual(currentData.actual_value != null ? String(currentData.actual_value) : '');
            } else {
                setCurrentMonthTarget('');
                setCurrentMonthActual('');
            }
        } catch (error) {
            console.error('Aylık veri yüklenemedi:', error);
            toast({ variant: 'destructive', title: 'Hata', description: 'Aylık veriler yüklenemedi.' });
        } finally {
            setLoadingMonthly(false);
        }
    };

    const fetchActions = async () => {
        if (!kpi) return;
        try {
            const { data, error } = await supabase
                .from('kpi_actions')
                .select('*')
                .eq('kpi_id', kpi.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setActions(data || []);
        } catch (error) {
            console.error('Aksiyonlar yüklenemedi:', error);
        }
    };

    const fetchSmartSuggestion = async () => {
        if (!kpi) return;
        setLoadingSmartSuggestion(true);
        try {
            const { data, error } = await supabase.rpc('get_smart_target_suggestion', { p_kpi_id: kpi.id });
            if (error) throw error;
            if (data?.success) setSmartSuggestion(data);
            else setSmartSuggestion(null);
        } catch (err) {
            console.warn('Akıllı öneri alınamadı:', err);
            setSmartSuggestion(null);
        } finally {
            setLoadingSmartSuggestion(false);
        }
    };

    const handleApplySmartSuggestion = async () => {
        if (!kpi || !smartSuggestion?.suggested_value) return;
        setIsSubmitting(true);
        try {
            const val = parseFloat(smartSuggestion.suggested_value);
            await supabase.from('kpis').update({ target_value: val }).eq('id', kpi.id);
            for (const d of monthlyData) {
                if (d.id) {
                    await supabase.from('kpi_monthly_data').update({ target_value: val }).eq('id', d.id);
                } else {
                    await supabase.from('kpi_monthly_data').insert({
                        kpi_id: kpi.id, year: d.year, month: d.month,
                        target_value: val, actual_value: d.actual ?? null
                    });
                }
            }
            setTargetValue(String(val));
            setEditingTargets({});
            setSmartSuggestion(null);
            toast({ title: 'Uygulandı!', description: `Akıllı hedef (${val}${kpi.unit || ''}) tüm aylara uygulandı.` });
            refreshKpis();
            fetchMonthlyData();
        } catch {
            toast({ variant: 'destructive', title: 'Hata', description: 'Öneri uygulanamadı.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const checkTargetAndSuggest = async () => {
        if (!kpi) return;
        try {
            const { data, error } = await supabase.rpc('check_kpi_target_and_suggest', {
                p_kpi_id: kpi.id,
                p_year: currentYear,
                p_month: currentMonth
            });

            if (error) throw error;
            setSuggestion(data);
            if (data?.needs_action) {
                setShowSuggestionModal(true);
            }
        } catch (error) {
            console.error('Öneri kontrolü yapılamadı:', error);
        }
    };

    const handleTargetUpdate = async () => {
        if (!kpi) return;
        setIsSubmitting(true);
        const newTarget = targetValue === '' ? null : parseFloat(targetValue);
        const { error } = await supabase
            .from('kpis')
            .update({ target_value: newTarget, responsible_unit: responsibleUnit || null })
            .eq('id', kpi.id);
        
        if (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: 'Hedef güncellenemedi.' });
        } else {
            toast({ title: 'Başarılı!', description: 'KPI hedefi güncellendi.' });
            refreshKpis();
        }
        setIsSubmitting(false);
    };

    const handleMonthlyDataSave = async () => {
        if (!kpi) return;
        setIsSubmitting(true);
        try {
            const target = currentMonthTarget ? parseFloat(currentMonthTarget) : null;
            const actual = currentMonthActual ? parseFloat(currentMonthActual) : null;

            const { data: existing, error: fetchError } = await supabase
                .from('kpi_monthly_data')
                .select('id')
                .eq('kpi_id', kpi.id)
                .eq('year', currentYear)
                .eq('month', currentMonth)
                .maybeSingle();

            if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

            if (existing) {
                const { error } = await supabase
                    .from('kpi_monthly_data')
                    .update({ target_value: target, actual_value: actual })
                    .eq('id', existing.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('kpi_monthly_data')
                    .insert({
                        kpi_id: kpi.id,
                        year: currentYear,
                        month: currentMonth,
                        target_value: target,
                        actual_value: actual,
                        responsible_unit: responsibleUnit || null
                    });
                if (error) throw error;
            }

            toast({ title: 'Başarılı!', description: 'Aylık veri kaydedildi.' });
            fetchMonthlyData();
            checkTargetAndSuggest();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: 'Aylık veri kaydedilemedi.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Tüm aylara aynı hedefi uygula
    const handleApplyBulkTarget = () => {
        if (!bulkTargetInput.trim()) return;
        const newEdits = {};
        monthlyData.forEach(d => { newEdits[`${d.year}-${d.month}`] = bulkTargetInput; });
        setEditingTargets(prev => ({ ...prev, ...newEdits }));
        setBulkTargetInput('');
        toast({ title: 'Uygulandı', description: `${monthlyData.length} aya ${bulkTargetInput}${kpi?.unit || ''} hedefi girildi. Kaydetmeyi unutmayın.` });
    };

    // Yıllık hedefi 12'ye bölerek aylara dağıt
    const handleDistributeAnnual = () => {
        const annual = parseFloat(annualTargetInput);
        if (isNaN(annual)) return;
        const monthly = (annual / 12).toFixed(2);
        const newEdits = {};
        monthlyData.forEach(d => { newEdits[`${d.year}-${d.month}`] = monthly; });
        setEditingTargets(prev => ({ ...prev, ...newEdits }));
        setAnnualTargetInput('');
        toast({ title: 'Dağıtıldı', description: `${annual}${kpi?.unit || ''} / 12 = ${monthly}${kpi?.unit || ''}/ay olarak uygulandı. Kaydetmeyi unutmayın.` });
    };

    // Tüm değiştirilmiş hedefleri tek seferde kaydet
    const handleSaveAllTargets = async () => {
        const entries = Object.entries(editingTargets).filter(([, v]) => v.trim() !== '');
        if (entries.length === 0) return;
        setIsSubmitting(true);
        try {
            const promises = entries.map(async ([monthKey, targetVal]) => {
                const [yearStr, monthStr] = monthKey.split('-');
                const year = parseInt(yearStr);
                const month = parseInt(monthStr);
                const targetNum = parseFloat(targetVal);
                if (isNaN(targetNum)) return;
                const existing = monthlyData.find(d => d.year === year && d.month === month);
                if (existing?.id) {
                    return supabase.from('kpi_monthly_data').update({ target_value: targetNum }).eq('id', existing.id);
                } else {
                    return supabase.from('kpi_monthly_data').insert({
                        kpi_id: kpi.id, year, month,
                        target_value: targetNum,
                        actual_value: existing?.actual ?? null
                    });
                }
            });
            await Promise.all(promises);

            // Kartta "Hedef Yok" gözükmesin: kpis.target_value'yu güncelle (bu ay veya ilk kaydedilen hedef)
            const now = new Date();
            const currentKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
            const currentTarget = editingTargets[currentKey];
            const targetToSync = currentTarget && !isNaN(parseFloat(currentTarget))
                ? parseFloat(currentTarget)
                : entries.length > 0 ? parseFloat(entries[0][1]) : null;
            if (targetToSync != null) {
                await supabase.from('kpis').update({ target_value: targetToSync }).eq('id', kpi.id);
            }

            toast({ title: 'Başarılı!', description: `${entries.length} aylık hedef kaydedildi.` });
            setEditingTargets({});
            fetchMonthlyData();
            refreshKpis();
        } catch {
            toast({ variant: 'destructive', title: 'Hata!', description: 'Hedefler kaydedilemedi.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCreateAction = async (actionType) => {
        if (!kpi) return;
        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from('kpi_actions')
                .insert({
                    kpi_id: kpi.id,
                    action_type: actionType,
                    title: `${kpi.name} - ${actionType} Önerisi`,
                    description: `KPI hedefi tutmadığı için otomatik oluşturulan ${actionType} önerisi. Sapma: %${suggestion?.deviation?.toFixed(2) || 'N/A'}`,
                    responsible_unit: responsibleUnit || kpi.responsible_unit || null,
                    status: 'Beklemede'
                });

            if (error) throw error;
            toast({ title: 'Başarılı!', description: `${actionType} önerisi oluşturuldu.` });
            fetchActions();
            setShowSuggestionModal(false);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: 'Aksiyon oluşturulamadı.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!kpi) return;
        setIsSubmitting(true);
        const { error } = await supabase.from('kpis').delete().eq('id', kpi.id);
        if (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: 'KPI silinemedi.' });
        } else {
            toast({ title: 'Başarılı!', description: 'KPI silindi.' });
            refreshKpis();
            setOpen(false);
        }
        setIsSubmitting(false);
    };

    // Trend grafiği için veri hazırlama
    const chartData = useMemo(() => {
        return monthlyData.map(d => ({
            month: d.monthName,
            target: d.target,
            actual: d.actual
        }));
    }, [monthlyData]);

    // Sapma hesaplama — 0 değerleri için ?? kullan
    const currentDeviation = useMemo(() => {
        const current = monthlyData.find(d => d.year === currentYear && d.month === currentMonth);
        if (!current || current.target == null || current.actual == null) return null;
        const t = parseFloat(current.target);
        const a = parseFloat(current.actual);
        if (t === 0) return null;
        return ((a - t) / Math.abs(t) * 100).toFixed(2);
    }, [monthlyData, currentYear, currentMonth]);

    if (!kpi) return null;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
                <header className="bg-gradient-to-r from-primary to-blue-700 px-6 py-5 flex items-center justify-between text-white shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/20 p-2.5 rounded-lg"><TrendingUp className="h-5 w-5 text-white" /></div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight">KPI Detayları: {kpi.name}</h1>
                            <p className="text-[11px] text-blue-100 uppercase tracking-[0.15em] font-medium">{kpi.description}</p>
                        </div>
                        <span className="px-3 py-1 bg-white/20 border border-white/30 text-white/90 text-[10px] font-bold rounded-full uppercase tracking-wider">Detay</span>
                    </div>
                </header>
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-4 pb-6">
                <Tabs defaultValue="overview" className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="overview">Genel Bakış</TabsTrigger>
                        <TabsTrigger value="trend">12 Aylık Trend</TabsTrigger>
                        <TabsTrigger value="monthly">Aylık Veri</TabsTrigger>
                        <TabsTrigger value="actions">Aksiyonlar</TabsTrigger>
                    </TabsList>

                    {/* Genel Bakış */}
                    <TabsContent value="overview" className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">Mevcut Değer</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-3xl font-bold">{kpi.current_value !== null ? parseFloat(kpi.current_value).toFixed(2) : 'N/A'}{kpi.unit}</div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">Hedef Değer</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-3xl font-bold">{kpi.target_value !== null ? parseFloat(kpi.target_value).toFixed(2) : 'N/A'}{kpi.unit}</div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">Bu Ay Sapma</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {currentDeviation !== null ? (
                                        <div className={`text-3xl font-bold ${parseFloat(currentDeviation) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                            {parseFloat(currentDeviation) > 0 ? '+' : ''}{currentDeviation}%
                                        </div>
                                    ) : (
                                        <div className="text-3xl font-bold text-muted-foreground">N/A</div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Akıllı Hedef Önerisi */}
                        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-primary" />
                                    Akıllı Hedef Önerisi
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {loadingSmartSuggestion ? (
                                    <div className="text-sm text-muted-foreground py-2">Analiz ediliyor...</div>
                                ) : smartSuggestion?.success && smartSuggestion.months_analyzed >= 1 ? (
                                    <>
                                        <div className="flex flex-wrap items-end gap-4">
                                            <div>
                                                <p className="text-xs text-muted-foreground">Önerilen hedef</p>
                                                <p className="text-2xl font-bold text-primary">
                                                    {parseFloat(smartSuggestion.suggested_value).toLocaleString('tr-TR', { maximumFractionDigits: 2 })}{kpi.unit || ''}
                                                </p>
                                            </div>
                                            {smartSuggestion.recent_avg != null && (
                                                <div className="text-sm text-muted-foreground">
                                                    Son {smartSuggestion.months_analyzed} ay ort: {parseFloat(smartSuggestion.recent_avg).toLocaleString('tr-TR')}{kpi.unit || ''}
                                                </div>
                                            )}
                                            {smartSuggestion.trend && smartSuggestion.trend !== 'unknown' && (
                                                <Badge variant={smartSuggestion.trend === 'improving' ? 'default' : 'secondary'} className="text-xs">
                                                    {smartSuggestion.trend === 'improving' ? '↑ İyileşiyor' : smartSuggestion.trend === 'declining' ? '↓ Dikkat' : '→ Sabit'}
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground">{smartSuggestion.reason}</p>
                                        <Button size="sm" onClick={handleApplySmartSuggestion} disabled={isSubmitting}>
                                            <Sparkles className="w-3 h-3 mr-1.5" />
                                            Öneriyi Tüm Aylara Uygula
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-sm text-muted-foreground mb-2">
                                            Geçmiş veriler analiz edilerek gerçekçi, motive edici hedefler önerilir. En az 1 aylık veri gereklidir.
                                        </p>
                                        <Button size="sm" variant="outline" onClick={fetchSmartSuggestion} disabled={loadingSmartSuggestion}>
                                            <RefreshCw className={`w-3 h-3 mr-1.5 ${loadingSmartSuggestion ? 'animate-spin' : ''}`} />
                                            Tekrar Dene
                                        </Button>
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>KPI Ayarları</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label>Hedef Değer</Label>
                                        <Input 
                                            type="number" 
                                            value={targetValue} 
                                            onChange={e => setTargetValue(e.target.value)} 
                                            placeholder="Hedef girin..."
                                        />
                                    </div>
                                    <div>
                                        <Label>Sorumlu Birim</Label>
                                        <Input 
                                            value={responsibleUnit} 
                                            onChange={e => setResponsibleUnit(e.target.value)} 
                                            placeholder="Birim adı..."
                                        />
                                    </div>
                                </div>
                                <Button onClick={handleTargetUpdate} disabled={isSubmitting}>
                                    <Save className="w-4 h-4 mr-2" /> Kaydet
                                </Button>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* 12 Aylık Trend */}
                    <TabsContent value="trend" className="space-y-4">
                        {/* Bilgi & Yenile */}
                        <div className="flex items-center justify-between gap-3">
                            {kpi.is_auto ? (
                                <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 border border-blue-200 px-3 py-2 rounded-lg">
                                    <Zap className="w-4 h-4 shrink-0" />
                                    <span>Veriler veritabanından otomatik hesaplanmaktadır.{lastBackfillTime ? ` Son güncelleme: ${format(lastBackfillTime, 'HH:mm:ss')}` : ''}</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted px-3 py-2 rounded-lg">
                                    <Info className="w-4 h-4 shrink-0" />
                                    <span>Aylık veriyi manuel olarak "Aylık Veri" sekmesinden girebilirsiniz.</span>
                                </div>
                            )}
                            {kpi.is_auto && (
                                <Button variant="outline" size="sm" onClick={() => runBackfillAndLoad().then(fetchMonthlyData)} disabled={isBackfilling}>
                                    <RefreshCw className={`w-3 h-3 mr-1.5 ${isBackfilling ? 'animate-spin' : ''}`} />
                                    {isBackfilling ? 'Hesaplanıyor...' : 'Yenile'}
                                </Button>
                            )}
                        </div>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base">13 Aylık Trend Analizi</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {loadingMonthly || isBackfilling ? (
                                    <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
                                        <RefreshCw className="w-8 h-8 animate-spin text-primary/40" />
                                        <span className="text-sm">{isBackfilling ? 'Geçmiş veriler veritabanından hesaplanıyor...' : 'Yükleniyor...'}</span>
                                    </div>
                                ) : chartData.every(d => d.actual == null) ? (
                                    <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                                        <TrendingUp className="w-10 h-10 opacity-20" />
                                        <p className="text-sm font-medium">Henüz aylık veri yok</p>
                                        <p className="text-xs">Bu dönem için veritabanında kayıt bulunmamaktadır.</p>
                                    </div>
                                ) : (
                                    <ResponsiveContainer width="100%" height={360}>
                                        <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                            <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} angle={-30} textAnchor="end" height={60} />
                                            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => v !== null ? parseFloat(v).toLocaleString('tr-TR') : ''} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '0.5rem', fontSize: '12px' }}
                                                labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                                                formatter={(value, name) => value !== null ? [`${parseFloat(value).toLocaleString('tr-TR', { maximumFractionDigits: 2 })}${kpi.unit || ''}`, name] : ['—', name]}
                                            />
                                            <Legend />
                                            {chartData.some(d => d.target != null) && (
                                                <Line type="monotone" dataKey="target" name="Hedef" stroke="#ef4444" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 3 }} connectNulls />
                                            )}
                                            <Line type="monotone" dataKey="actual" name="Gerçekleşen" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4, fill: '#3b82f6' }} connectNulls activeDot={{ r: 6 }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                )}
                            </CardContent>
                        </Card>
                        {/* Özet Tablo */}
                        {!loadingMonthly && !isBackfilling && chartData.some(d => d.actual != null) && (
                            <Card>
                                <CardHeader className="pb-2"><CardTitle className="text-sm">Aylık Özet</CardTitle></CardHeader>
                                <CardContent className="p-0">
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="text-xs">
                                                    <TableHead>Ay</TableHead>
                                                    <TableHead className="text-right">Gerçekleşen</TableHead>
                                                    <TableHead className="text-right">Hedef</TableHead>
                                                    <TableHead className="text-right">Sapma</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {[...monthlyData].reverse().map((d, i) => {
                                                    const dev = d.target != null && d.actual != null && parseFloat(d.target) !== 0
                                                        ? ((parseFloat(d.actual) - parseFloat(d.target)) / Math.abs(parseFloat(d.target)) * 100)
                                                        : null;
                                                    const isGood = dev === null ? null : kpi.target_direction === 'decrease' ? dev <= 0 : dev >= 0;
                                                    return (
                                                        <TableRow key={i} className="text-xs">
                                                            <TableCell className="font-medium">{d.monthName}</TableCell>
                                                            <TableCell className="text-right">{d.actual != null ? `${parseFloat(d.actual).toLocaleString('tr-TR', { maximumFractionDigits: 2 })}${kpi.unit || ''}` : '—'}</TableCell>
                                                            <TableCell className="text-right text-muted-foreground">{d.target != null ? `${parseFloat(d.target).toLocaleString('tr-TR', { maximumFractionDigits: 2 })}${kpi.unit || ''}` : '—'}</TableCell>
                                                            <TableCell className="text-right">
                                                                {dev !== null ? (
                                                                    <span className={`font-medium ${isGood ? 'text-green-600' : 'text-red-500'}`}>
                                                                        {dev > 0 ? '+' : ''}{dev.toFixed(1)}%
                                                                    </span>
                                                                ) : '—'}
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>

                    {/* Aylık Veri */}
                    <TabsContent value="monthly" className="space-y-3">
                        {kpi.is_auto && (
                            <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 border border-blue-200 px-3 py-2 rounded-lg">
                                <Zap className="w-4 h-4 shrink-0" />
                                <span>Gerçekleşen değerler otomatik hesaplanmaktadır. Hedef değerlerini aşağıdan girebilirsiniz.</span>
                            </div>
                        )}

                        {/* ── Toplu Hedef Araçları ── */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <CalendarDays className="w-4 h-4 text-primary" /> Toplu Hedef Belirleme
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {/* Tüm aylara tek hedef */}
                                <div>
                                    <Label className="text-xs text-muted-foreground mb-1 block">Tüm Aylara Aynı Hedef Uygula</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            type="number"
                                            className="h-8 text-sm"
                                            value={bulkTargetInput}
                                            onChange={e => setBulkTargetInput(e.target.value)}
                                            placeholder={`Örn: 10${kpi.unit || ''}`}
                                        />
                                        <Button size="sm" variant="outline" onClick={handleApplyBulkTarget} disabled={!bulkTargetInput}>
                                            <CopyCheck className="w-3.5 h-3.5 mr-1.5" /> Tümüne Uygula
                                        </Button>
                                    </div>
                                </div>
                                {/* Yıllık hedefi dağıt */}
                                <div>
                                    <Label className="text-xs text-muted-foreground mb-1 block">Yıllık Toplam Hedef → Aylara Eşit Dağıt (÷ 12)</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            type="number"
                                            className="h-8 text-sm"
                                            value={annualTargetInput}
                                            onChange={e => setAnnualTargetInput(e.target.value)}
                                            placeholder={`Örn: 120${kpi.unit || ''}`}
                                        />
                                        <Button size="sm" variant="outline" onClick={handleDistributeAnnual} disabled={!annualTargetInput}>
                                            <CalendarDays className="w-3.5 h-3.5 mr-1.5" /> Aylara Dağıt
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* ── 13 Ay Tablo (inline düzenleme) ── */}
                        <Card>
                            <CardHeader className="pb-2 flex flex-row items-center justify-between">
                                <CardTitle className="text-sm">
                                    13 Aylık Hedef & Gerçekleşen
                                    {Object.keys(editingTargets).length > 0 && (
                                        <span className="ml-2 text-[10px] font-normal text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded-full">
                                            {Object.keys(editingTargets).length} değişiklik bekliyor
                                        </span>
                                    )}
                                </CardTitle>
                                <Button
                                    size="sm"
                                    onClick={handleSaveAllTargets}
                                    disabled={isSubmitting || Object.keys(editingTargets).length === 0}
                                >
                                    <Save className="w-3 h-3 mr-1.5" />
                                    {isSubmitting ? 'Kaydediliyor…' : `Kaydet${Object.keys(editingTargets).length > 0 ? ` (${Object.keys(editingTargets).length})` : ''}`}
                                </Button>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="text-xs">
                                                <TableHead className="w-28">Ay</TableHead>
                                                <TableHead className="text-right">Gerçekleşen</TableHead>
                                                <TableHead className="w-36">Hedef (düzenle)</TableHead>
                                                <TableHead className="text-right w-20">Sapma</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {monthlyData.map((d, i) => {
                                                const monthKey = `${d.year}-${d.month}`;
                                                const now = new Date();
                                                const isCurrentMonth = d.year === now.getFullYear() && d.month === now.getMonth() + 1;
                                                const pendingVal = editingTargets[monthKey];
                                                const displayTarget = pendingVal !== undefined ? pendingVal : (d.target != null ? String(d.target) : '');
                                                const tNum = parseFloat(displayTarget);
                                                const aNum = d.actual != null ? parseFloat(d.actual) : null;
                                                const dev = !isNaN(tNum) && tNum !== 0 && aNum != null
                                                    ? ((aNum - tNum) / Math.abs(tNum) * 100) : null;
                                                const isGood = dev === null ? null : kpi.target_direction === 'decrease' ? dev <= 0 : dev >= 0;
                                                return (
                                                    <TableRow key={i} className={`text-xs ${isCurrentMonth ? 'bg-blue-50/60 dark:bg-blue-950/20' : ''}`}>
                                                        <TableCell className="font-medium py-1.5">
                                                            {d.monthName}
                                                            {isCurrentMonth && <span className="ml-1 text-[9px] bg-blue-100 text-blue-600 px-1 py-0.5 rounded">Bu Ay</span>}
                                                            {pendingVal !== undefined && <span className="ml-1 text-orange-400 text-[10px]">●</span>}
                                                        </TableCell>
                                                        <TableCell className="text-right text-muted-foreground py-1.5">
                                                            {aNum != null ? `${aNum.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}${kpi.unit || ''}` : '—'}
                                                        </TableCell>
                                                        <TableCell className="py-1">
                                                            <input
                                                                type="number"
                                                                className="w-full h-7 px-2 text-xs rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                                                                value={displayTarget}
                                                                onChange={e => setEditingTargets(prev => ({ ...prev, [monthKey]: e.target.value }))}
                                                                placeholder="—"
                                                            />
                                                        </TableCell>
                                                        <TableCell className="text-right py-1.5">
                                                            {dev !== null ? (
                                                                <span className={`font-medium ${isGood ? 'text-green-600' : 'text-red-500'}`}>
                                                                    {dev > 0 ? '+' : ''}{dev.toFixed(1)}%
                                                                </span>
                                                            ) : '—'}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Aksiyonlar */}
                    <TabsContent value="actions" className="space-y-4">
                        {suggestion?.needs_action && (
                            <Card className="border-orange-500">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-orange-600">
                                        <AlertTriangle className="h-5 w-5" />
                                        Hedef Tutmadı - Aksiyon Önerileri
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-muted-foreground mb-4">
                                        Sapma: %{suggestion.deviation?.toFixed(2)} | Eşik: %{suggestion.threshold}
                                    </p>
                                    <div className="flex gap-2">
                                        {suggestion.suggestions?.map((s, idx) => (
                                            <Button 
                                                key={idx} 
                                                variant="outline" 
                                                onClick={() => handleCreateAction(s.type)}
                                                disabled={isSubmitting}
                                            >
                                                <Plus className="w-4 h-4 mr-2" />
                                                {s.type} Oluştur
                                            </Button>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        <Card>
                            <CardHeader>
                                <CardTitle>Aksiyon Listesi</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {actions.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        Henüz aksiyon oluşturulmamış.
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Tür</TableHead>
                                                    <TableHead>Başlık</TableHead>
                                                    <TableHead>Sorumlu Birim</TableHead>
                                                    <TableHead>Durum</TableHead>
                                                    <TableHead>Tarih</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {actions.map(action => (
                                                    <TableRow key={action.id}>
                                                        <TableCell>
                                                            <Badge>{action.action_type}</Badge>
                                                        </TableCell>
                                                        <TableCell>{action.title}</TableCell>
                                                        <TableCell>{action.responsible_unit || '-'}</TableCell>
                                                        <TableCell>
                                                            <Badge variant={
                                                                action.status === 'Tamamlandı' ? 'default' :
                                                                action.status === 'Devam Ediyor' ? 'secondary' :
                                                                'outline'
                                                            }>
                                                                {action.status}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            {format(new Date(action.created_at), 'dd.MM.yyyy', { locale: tr })}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
                </div>

                <DialogFooter className="justify-between sm:justify-between w-full shrink-0">
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" disabled={isSubmitting}>
                                <Trash2 className="w-4 h-4 mr-2" /> KPI'yı Sil
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    "{kpi.name}" adlı KPI'yı kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>İptal</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                                    Sil
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                    <Button variant="outline" onClick={() => setOpen(false)}>Kapat</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default KPIDetailModalEnhanced;

