import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
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
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Save, Trash2, AlertTriangle, TrendingUp, TrendingDown, Plus, Building2, FileText, Target } from 'lucide-react';
import { format, subMonths, startOfMonth } from 'date-fns';
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

    useEffect(() => {
        if (kpi) {
            setTargetValue(kpi.target_value !== null ? String(kpi.target_value) : '');
            setResponsibleUnit(kpi.responsible_unit || '');
            fetchMonthlyData();
            fetchActions();
            checkTargetAndSuggest();
        }
    }, [kpi, currentYear, currentMonth]);

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
            
            // Son 12 ayı al
            const now = new Date();
            const last12Months = [];
            for (let i = 11; i >= 0; i--) {
                const date = subMonths(now, i);
                const year = date.getFullYear();
                const month = date.getMonth() + 1;
                const existing = data?.find(d => d.year === year && d.month === month);
                last12Months.push({
                    year,
                    month,
                    monthName: format(date, 'MMM yyyy', { locale: tr }),
                    target: existing?.target_value || null,
                    actual: existing?.actual_value || null,
                    id: existing?.id || null
                });
            }
            setMonthlyData(last12Months);

            // Mevcut ay verisini set et
            const currentData = data?.find(d => d.year === currentYear && d.month === currentMonth);
            if (currentData) {
                setCurrentMonthTarget(currentData.target_value ? String(currentData.target_value) : '');
                setCurrentMonthActual(currentData.actual_value ? String(currentData.actual_value) : '');
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

    // Sapma hesaplama
    const currentDeviation = useMemo(() => {
        const current = monthlyData.find(d => d.year === currentYear && d.month === currentMonth);
        if (!current || !current.target || !current.actual) return null;
        if (current.target === 0) return null;
        return ((current.actual - current.target) / current.target * 100).toFixed(2);
    }, [monthlyData, currentYear, currentMonth]);

    if (!kpi) return null;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-6xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-2xl text-foreground">KPI Detayları: {kpi.name}</DialogTitle>
                    <DialogDescription className="text-muted-foreground">{kpi.description}</DialogDescription>
                </DialogHeader>

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
                        <Card>
                            <CardHeader>
                                <CardTitle>12 Aylık Trend Analizi</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {loadingMonthly ? (
                                    <div className="text-center py-8">Yükleniyor...</div>
                                ) : (
                                    <ResponsiveContainer width="100%" height={400}>
                                        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                            <XAxis dataKey="month" stroke="hsl(var(--foreground))" fontSize={12} angle={-45} textAnchor="end" height={80} />
                                            <YAxis stroke="hsl(var(--foreground))" fontSize={12} />
                                            <Tooltip 
                                                contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '0.5rem' }} 
                                                labelStyle={{ color: 'hsl(var(--foreground))' }}
                                                formatter={(value) => value !== null ? `${parseFloat(value).toFixed(2)}${kpi.unit}` : 'N/A'}
                                            />
                                            <Legend />
                                            <Line 
                                                type="monotone" 
                                                dataKey="target" 
                                                name="Hedef" 
                                                stroke="#ef4444" 
                                                strokeWidth={2} 
                                                strokeDasharray="5 5"
                                                dot={{ r: 4 }}
                                            />
                                            <Line 
                                                type="monotone" 
                                                dataKey="actual" 
                                                name="Gerçekleşen" 
                                                stroke="#3b82f6" 
                                                strokeWidth={2}
                                                dot={{ r: 4 }}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Aylık Veri */}
                    <TabsContent value="monthly" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Bu Ay Veri Girişi</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label>Yıl</Label>
                                        <Input 
                                            type="number" 
                                            value={currentYear} 
                                            onChange={e => setCurrentYear(parseInt(e.target.value))}
                                        />
                                    </div>
                                    <div>
                                        <Label>Ay</Label>
                                        <Select value={String(currentMonth)} onValueChange={v => setCurrentMonth(parseInt(v))}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                                    <SelectItem key={m} value={String(m)}>
                                                        {format(new Date(2024, m - 1, 1), 'MMMM', { locale: tr })}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label>Hedef</Label>
                                        <Input 
                                            type="number" 
                                            value={currentMonthTarget} 
                                            onChange={e => setCurrentMonthTarget(e.target.value)}
                                            placeholder="Aylık hedef..."
                                        />
                                    </div>
                                    <div>
                                        <Label>Gerçekleşen</Label>
                                        <Input 
                                            type="number" 
                                            value={currentMonthActual} 
                                            onChange={e => setCurrentMonthActual(e.target.value)}
                                            placeholder="Aylık gerçekleşen..."
                                        />
                                    </div>
                                </div>
                                <Button onClick={handleMonthlyDataSave} disabled={isSubmitting}>
                                    <Save className="w-4 h-4 mr-2" /> Kaydet
                                </Button>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Aylık Veri Tablosu</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Ay</TableHead>
                                                <TableHead className="text-right">Hedef</TableHead>
                                                <TableHead className="text-right">Gerçekleşen</TableHead>
                                                <TableHead className="text-right">Sapma %</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {monthlyData.map((d, idx) => {
                                                const deviation = d.target && d.actual && d.target !== 0 
                                                    ? ((d.actual - d.target) / d.target * 100).toFixed(2)
                                                    : null;
                                                return (
                                                    <TableRow key={idx}>
                                                        <TableCell>{d.monthName}</TableCell>
                                                        <TableCell className="text-right">{d.target !== null ? `${parseFloat(d.target).toFixed(2)}${kpi.unit}` : '-'}</TableCell>
                                                        <TableCell className="text-right">{d.actual !== null ? `${parseFloat(d.actual).toFixed(2)}${kpi.unit}` : '-'}</TableCell>
                                                        <TableCell className="text-right">
                                                            {deviation !== null ? (
                                                                <Badge variant={parseFloat(deviation) > 0 ? 'destructive' : 'default'}>
                                                                    {parseFloat(deviation) > 0 ? '+' : ''}{deviation}%
                                                                </Badge>
                                                            ) : '-'}
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

                <DialogFooter className="justify-between sm:justify-between w-full">
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

