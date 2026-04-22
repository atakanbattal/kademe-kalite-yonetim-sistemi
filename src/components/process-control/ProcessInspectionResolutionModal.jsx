import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
    AlertTriangle,
    CalendarDays,
    ExternalLink,
    FileText,
    History,
    PackageX,
    ShieldCheck,
    Sparkles,
    Truck,
    User as UserIcon,
    Wrench,
    XCircle,
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useData } from '@/contexts/DataContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { SearchableSelectDialog } from '@/components/ui/searchable-select-dialog';
import {
    RESOLUTION_STATUS,
    RESOLUTION_STATUS_OPTIONS,
    RESOLUTION_TYPE_OPTIONS,
    buildResolutionPayload,
} from './processInspectionResolution';

const INITIAL_FORM = {
    resolution_status: '',
    resolution_type: '',
    resolution_notes: '',
    resolution_date: '',
    resolved_by_personnel_id: '',
    resolved_by_name: '',
};

const getResultDecisionFlag = (row) => {
    if (typeof row?.result === 'boolean') return row.result;
    if (typeof row?.is_ok === 'boolean') return row.is_ok;

    const normalized = String(
        row?.measured_value ?? row?.measurement_value ?? row?.actual_value ?? row?.result ?? ''
    )
        .trim()
        .toLowerCase();

    if (!normalized) return null;
    if (['ok', 'uygun', 'kabul', 'gecti', 'gectı', 'gecer', 'geçer', 'pass'].includes(normalized)) return true;
    if (['nok', 'uygun degil', 'uygun değil', 'ret', 'red', 'ng', 'fail'].includes(normalized)) return false;
    return null;
};

const INTEGRATION_CONFIG = {
    'Sapma ile Kabul': {
        icon: FileText,
        actionLabel: 'Sapma Talebi Oluştur',
        moduleLabel: 'Sapma Yönetimi',
        alertTone: 'bg-indigo-50 border-indigo-200 text-indigo-900',
        buttonClass: 'bg-indigo-600 hover:bg-indigo-700 text-white',
        description:
            'Bu karar için Sapma Yönetimi modülünde bir sapma talebi açılması gerekir. Formu parça kodu, araç tipi ve açıklama ile ön-doldurulmuş halde açacağız. Sapma kaydedildiğinde bu ret kaydı otomatik olarak "Çözüldü" olarak işaretlenecek.',
    },
    Hurda: {
        icon: PackageX,
        actionLabel: 'Hurda Maliyeti Kaydı Oluştur',
        moduleLabel: 'Kalite Maliyetleri',
        alertTone: 'bg-rose-50 border-rose-200 text-rose-900',
        buttonClass: 'bg-rose-600 hover:bg-rose-700 text-white',
        description:
            'Hurda kararı için Kalite Maliyetleri modülünde "Hurda Maliyeti" kaydı oluşturulmalıdır. Formu parça bilgileri ile ön-doldurulmuş halde açacağız. Maliyet kaydedildiğinde bu ret kaydı otomatik olarak "Çözüldü" olarak işaretlenecek.',
    },
    'Tedarikçiye İade': {
        icon: Truck,
        actionLabel: 'Tedarikçi Uygunsuzluğu Oluştur',
        moduleLabel: 'Uygunsuzluk Yönetimi',
        alertTone: 'bg-amber-50 border-amber-200 text-amber-900',
        buttonClass: 'bg-amber-600 hover:bg-amber-700 text-white',
        description:
            'Tedarikçiye iade için Uygunsuzluk Yönetimi modülünde tedarikçi uygunsuzluk kaydı açmanız önerilir. İlgili modülü açık bir şekilde ziyaret edip uygunsuzluk oluşturduktan sonra buradaki çözüm bilgisini güncelleyin.',
    },
};

const ProcessInspectionResolutionModal = ({
    isOpen,
    setIsOpen,
    inspection,
    onResolved,
    onCreateDeviation,
    onCreateScrapCost,
}) => {
    const { toast } = useToast();
    const { user } = useAuth();
    const { personnel } = useData();

    const [form, setForm] = useState(INITIAL_FORM);
    const [history, setHistory] = useState([]);
    const [measurementResults, setMeasurementResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const inspectionId = inspection?.id || null;

    const resetForm = useCallback(() => {
        setForm(INITIAL_FORM);
        setHistory([]);
        setMeasurementResults([]);
    }, []);

    useEffect(() => {
        if (!isOpen || !inspectionId) {
            resetForm();
            return undefined;
        }

        let cancelled = false;
        setIsLoading(true);

        (async () => {
            try {
                const [inspectionRes, historyRes, resultsRes] = await Promise.all([
                    supabase.from('process_inspections').select('*').eq('id', inspectionId).single(),
                    supabase
                        .from('process_inspection_resolutions')
                        .select('*')
                        .eq('inspection_id', inspectionId)
                        .order('actioned_at', { ascending: false }),
                    supabase.from('process_inspection_results').select('*').eq('inspection_id', inspectionId),
                ]);

                if (cancelled) return;

                if (inspectionRes.error) throw inspectionRes.error;
                if (historyRes.error) throw historyRes.error;
                if (resultsRes.error) throw resultsRes.error;

                const row = inspectionRes.data || {};
                setForm({
                    resolution_status: row.resolution_status || '',
                    resolution_type: row.resolution_type || '',
                    resolution_notes: row.resolution_notes || '',
                    resolution_date: row.resolution_date
                        ? new Date(row.resolution_date).toISOString().split('T')[0]
                        : '',
                    resolved_by_personnel_id: row.resolved_by_personnel_id || '',
                    resolved_by_name: row.resolved_by_name || '',
                });
                setHistory(historyRes.data || []);
                setMeasurementResults(resultsRes.data || []);
            } catch (error) {
                console.error('Çözüm verileri yüklenemedi:', error);
                toast({
                    variant: 'destructive',
                    title: 'Hata',
                    description: `Çözüm verileri alınamadı: ${error.message}`,
                });
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [isOpen, inspectionId, resetForm, toast]);

    const personnelOptions = useMemo(() => {
        const active = Array.isArray(personnel)
            ? personnel.filter((p) => p?.is_active && p?.full_name)
            : [];

        const base = active.map((p) => ({
            value: p.id,
            label: p.department ? `${p.full_name} • ${p.department}` : p.full_name,
            triggerLabel: p.full_name,
            searchText: [p.full_name, p.department, p.job_title].filter(Boolean).join(' '),
            description: p.department || p.job_title || undefined,
        }));

        if (form.resolved_by_personnel_id && !base.some((o) => o.value === form.resolved_by_personnel_id)) {
            return [
                {
                    value: form.resolved_by_personnel_id,
                    label: `${form.resolved_by_name || 'Kayıtlı personel'} (Pasif)`,
                    triggerLabel: form.resolved_by_name || 'Kayıtlı personel',
                    searchText: form.resolved_by_name || '',
                    description: 'Aktif personel listesinde bulunmayan kayıtlı çözüm sorumlusu',
                },
                ...base,
            ];
        }

        return base;
    }, [personnel, form.resolved_by_personnel_id, form.resolved_by_name]);

    const allMeasurementsPass = useMemo(() => {
        if (!measurementResults.length) return false;
        return measurementResults.every((row) => getResultDecisionFlag(row) === true);
    }, [measurementResults]);

    const smartHint = useMemo(() => {
        if (form.resolution_status === RESOLUTION_STATUS.RESOLVED) return null;
        const rejectedNow = Number(inspection?.quantity_rejected) || 0;

        if (allMeasurementsPass && rejectedNow === 0) {
            return 'Tüm ölçümler şu an uygun ve ret miktarı sıfırlanmış. Görünüşe göre sorun giderildi — durumu "Çözüldü" olarak işaretleyebilirsiniz.';
        }
        if (allMeasurementsPass) {
            return 'Ölçümler şu an uygun. Düzeltme aksiyonu tamamlandıysa çözüm tipini seçip "Çözüldü" olarak işaretleyin.';
        }
        return null;
    }, [form.resolution_status, allMeasurementsPass, inspection]);

    const handleStatusChange = useCallback(
        (value) => {
            setForm((prev) => {
                const next = { ...prev, resolution_status: value || '' };

                if (value === RESOLUTION_STATUS.RESOLVED) {
                    if (!prev.resolution_date) {
                        next.resolution_date = new Date().toISOString().split('T')[0];
                    }
                    if (!prev.resolved_by_personnel_id && user?.id) {
                        const match = Array.isArray(personnel)
                            ? personnel.find((p) => p?.user_id === user.id || p?.id === user.id)
                            : null;
                        if (match?.id) {
                            next.resolved_by_personnel_id = match.id;
                            next.resolved_by_name = match.full_name || '';
                        }
                    }
                }

                if (!value) {
                    next.resolution_type = '';
                    next.resolution_date = '';
                    next.resolved_by_personnel_id = '';
                    next.resolved_by_name = '';
                }

                return next;
            });
        },
        [personnel, user?.id]
    );

    const handleTypeChange = useCallback((value) => {
        setForm((prev) => {
            const next = { ...prev, resolution_type: value || '' };
            // Tip seçildiğinde durum otomatik olarak "Çözümleniyor" yapılsın (daha önce seçilmediyse).
            if (value && !prev.resolution_status) {
                next.resolution_status = RESOLUTION_STATUS.IN_PROGRESS;
            }
            return next;
        });
    }, []);

    const handlePersonnelChange = useCallback(
        (value) => {
            if (!value) {
                setForm((prev) => ({ ...prev, resolved_by_personnel_id: '', resolved_by_name: '' }));
                return;
            }
            const match = Array.isArray(personnel) ? personnel.find((p) => p?.id === value) : null;
            setForm((prev) => ({
                ...prev,
                resolved_by_personnel_id: value,
                resolved_by_name: match?.full_name || prev.resolved_by_name || '',
            }));
        },
        [personnel]
    );

    const handleInputChange = (event) => {
        const { name, value } = event.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleMarkResolved = () => {
        handleStatusChange(RESOLUTION_STATUS.RESOLVED);
        setForm((prev) => ({
            ...prev,
            resolution_type: prev.resolution_type || 'Yeniden İşleme',
        }));
    };

    const activeIntegration = form.resolution_type
        ? INTEGRATION_CONFIG[form.resolution_type]
        : null;

    const handleIntegrationAction = () => {
        if (!inspection || !form.resolution_type) return;

        if (form.resolution_type === 'Sapma ile Kabul' && typeof onCreateDeviation === 'function') {
            setIsOpen(false);
            onCreateDeviation(inspection, {
                notes: form.resolution_notes,
                personnelId: form.resolved_by_personnel_id,
                personnelName: form.resolved_by_name,
            });
            return;
        }

        if (form.resolution_type === 'Hurda' && typeof onCreateScrapCost === 'function') {
            setIsOpen(false);
            onCreateScrapCost(inspection, {
                notes: form.resolution_notes,
                personnelId: form.resolved_by_personnel_id,
                personnelName: form.resolved_by_name,
            });
            return;
        }

        toast({
            title: 'Bilgi',
            description:
                'Bu çözüm tipi için şu an manuel işlem gerekli. İlgili modülü ayrı olarak ziyaret edin.',
        });
    };

    const canLaunchIntegration = Boolean(
        (form.resolution_type === 'Sapma ile Kabul' && typeof onCreateDeviation === 'function') ||
            (form.resolution_type === 'Hurda' && typeof onCreateScrapCost === 'function')
    );

    const handleSave = async () => {
        if (!inspectionId) return;

        if (!form.resolution_status) {
            toast({
                variant: 'destructive',
                title: 'Eksik Bilgi',
                description: 'Lütfen bir çözüm durumu seçin.',
            });
            return;
        }

        if (form.resolution_status === RESOLUTION_STATUS.RESOLVED && !form.resolution_type) {
            toast({
                variant: 'destructive',
                title: 'Eksik Bilgi',
                description: '"Çözüldü" durumu için çözüm tipi zorunludur.',
            });
            return;
        }

        setIsSaving(true);
        try {
            const payload = buildResolutionPayload({
                status: form.resolution_status,
                type: form.resolution_type,
                notes: form.resolution_notes,
                personnelId: form.resolved_by_personnel_id,
                personnelName: form.resolved_by_name,
                date: form.resolution_date ? new Date(form.resolution_date).toISOString() : null,
            });

            const { error: updateError } = await supabase
                .from('process_inspections')
                .update({
                    ...payload,
                    updated_at: new Date().toISOString(),
                    updated_by: user?.id || null,
                })
                .eq('id', inspectionId);

            if (updateError) throw updateError;

            try {
                await supabase.from('process_inspection_resolutions').insert([
                    {
                        inspection_id: inspectionId,
                        event_type:
                            form.resolution_status === RESOLUTION_STATUS.RESOLVED
                                ? 'resolved'
                                : history.length === 0
                                  ? 'created'
                                  : 'updated',
                        resolution_status: form.resolution_status || null,
                        resolution_type: form.resolution_type || null,
                        resolution_notes: form.resolution_notes || null,
                        actioned_by_personnel_id: form.resolved_by_personnel_id || null,
                        actioned_by_name: form.resolved_by_name || null,
                        actioned_at: form.resolution_date
                            ? new Date(form.resolution_date).toISOString()
                            : new Date().toISOString(),
                        created_by: user?.id || null,
                    },
                ]);
            } catch (historyError) {
                console.error('Çözüm geçmişi yazılamadı:', historyError);
            }

            toast({
                title: 'Başarılı',
                description:
                    form.resolution_status === RESOLUTION_STATUS.RESOLVED
                        ? 'Ret kaydı "Çözüldü" olarak işaretlendi.'
                        : 'Çözüm bilgileri güncellendi.',
            });

            onResolved?.();
            setIsOpen(false);
        } catch (error) {
            console.error('Çözüm kaydedilemedi:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: `Çözüm kaydedilemedi: ${error.message}`,
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleClear = async () => {
        if (!inspectionId) return;

        if (!window.confirm('Çözüm bilgilerini temizlemek istediğinize emin misiniz?')) return;

        setIsSaving(true);
        try {
            const payload = buildResolutionPayload({
                status: '',
                type: '',
                notes: '',
                personnelId: '',
                personnelName: '',
                date: null,
            });

            const { error } = await supabase
                .from('process_inspections')
                .update({
                    ...payload,
                    updated_at: new Date().toISOString(),
                    updated_by: user?.id || null,
                })
                .eq('id', inspectionId);

            if (error) throw error;

            try {
                await supabase.from('process_inspection_resolutions').insert([
                    {
                        inspection_id: inspectionId,
                        event_type: 'cleared',
                        resolution_status: null,
                        resolution_type: null,
                        resolution_notes: 'Çözüm bilgileri temizlendi.',
                        actioned_by_personnel_id: null,
                        actioned_by_name: null,
                        actioned_at: new Date().toISOString(),
                        created_by: user?.id || null,
                    },
                ]);
            } catch (historyError) {
                console.error('Çözüm geçmişi yazılamadı:', historyError);
            }

            toast({ title: 'Başarılı', description: 'Çözüm bilgileri temizlendi.' });
            onResolved?.();
            setIsOpen(false);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: `İşlem tamamlanamadı: ${error.message}`,
            });
        } finally {
            setIsSaving(false);
        }
    };

    if (!inspection) return null;

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-3xl w-[96vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
                <DialogHeader className="sr-only">
                    <DialogTitle>Ret Kaydı Çözümü: {inspection.record_no}</DialogTitle>
                </DialogHeader>

                <header className="bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 px-6 py-5 text-white shrink-0">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                            <div className="rounded-xl bg-white/20 p-2.5">
                                <Wrench className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <h1 className="text-lg font-bold tracking-tight">Sorun Çözümü · Ret Kapatma</h1>
                                <p className="text-xs text-white/85 mt-1">
                                    {inspection.record_no} · {inspection.part_code}
                                    {inspection.part_name ? ` · ${inspection.part_name}` : ''}
                                </p>
                            </div>
                        </div>
                        <Badge
                            className={
                                form.resolution_status === RESOLUTION_STATUS.RESOLVED
                                    ? 'border-white/30 bg-white/90 text-emerald-700'
                                    : form.resolution_status === RESOLUTION_STATUS.IN_PROGRESS
                                      ? 'border-white/30 bg-white/90 text-amber-700'
                                      : form.resolution_status === RESOLUTION_STATUS.OPEN
                                        ? 'border-white/30 bg-white/90 text-rose-700'
                                        : 'border-white/30 bg-white/10 text-white'
                            }
                        >
                            {form.resolution_status || 'Çözüm girilmedi'}
                        </Badge>
                    </div>
                </header>

                <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
                    {isLoading ? (
                        <div className="py-10 text-center text-muted-foreground">Yükleniyor...</div>
                    ) : (
                        <div className="space-y-5">
                            <Alert className="border-slate-200 bg-slate-50 text-slate-700">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>Bilgi</AlertTitle>
                                <AlertDescription>
                                    Bu kayıt <strong>ret</strong> aldı. Sorun giderildiyse burada çözüm tipini,
                                    sorumluyu ve tarihi belirterek kaydı <strong>Ret (Çözüldü)</strong> olarak
                                    işaretleyebilirsiniz. Karar <strong>Ret</strong> olarak kalır — sadece akıllı
                                    çözüm rozeti eklenir ve geçmişe aksiyon kaydı düşer.
                                </AlertDescription>
                            </Alert>

                            {smartHint && (
                                <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800">
                                    <Sparkles className="h-4 w-4" />
                                    <AlertTitle>Akıllı Öneri</AlertTitle>
                                    <AlertDescription className="space-y-2">
                                        <p>{smartHint}</p>
                                        <div className="flex flex-wrap gap-2 pt-1">
                                            <Button
                                                type="button"
                                                size="sm"
                                                className="bg-emerald-600 text-white hover:bg-emerald-700"
                                                onClick={handleMarkResolved}
                                            >
                                                <ShieldCheck className="mr-1.5 h-4 w-4" />
                                                Çözüldü olarak işaretle
                                            </Button>
                                        </div>
                                    </AlertDescription>
                                </Alert>
                            )}

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div>
                                    <Label htmlFor="resolution_type">Çözüm Tipi *</Label>
                                    <SearchableSelectDialog
                                        options={RESOLUTION_TYPE_OPTIONS}
                                        value={form.resolution_type || ''}
                                        onChange={handleTypeChange}
                                        triggerPlaceholder="Çözüm tipi seçin..."
                                        dialogTitle="Çözüm Tipi"
                                        searchPlaceholder="Ara..."
                                        notFoundText="Seçenek bulunamadı."
                                        allowClear
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="resolution_status">Çözüm Durumu *</Label>
                                    <SearchableSelectDialog
                                        options={RESOLUTION_STATUS_OPTIONS}
                                        value={form.resolution_status || ''}
                                        onChange={handleStatusChange}
                                        triggerPlaceholder="Durum seçin..."
                                        dialogTitle="Çözüm Durumu"
                                        searchPlaceholder="Ara..."
                                        notFoundText="Seçenek bulunamadı."
                                        allowClear
                                    />
                                </div>
                            </div>

                            {activeIntegration && (
                                <Alert className={`${activeIntegration.alertTone} border-2 shadow-sm`}>
                                    <activeIntegration.icon className="h-5 w-5" />
                                    <AlertTitle className="text-base font-semibold">
                                        İlgili Modül Entegrasyonu · {activeIntegration.moduleLabel}
                                    </AlertTitle>
                                    <AlertDescription className="space-y-3">
                                        <p className="text-sm">{activeIntegration.description}</p>
                                        {canLaunchIntegration ? (
                                            <div className="flex flex-wrap items-center gap-2 pt-1">
                                                <Button
                                                    type="button"
                                                    size="default"
                                                    className={activeIntegration.buttonClass}
                                                    onClick={handleIntegrationAction}
                                                    disabled={isSaving}
                                                >
                                                    <ExternalLink className="mr-2 h-4 w-4" />
                                                    {activeIntegration.actionLabel}
                                                </Button>
                                                <span className="inline-flex items-center text-xs opacity-80">
                                                    Açıldığında çözüm otomatik tamamlanır.
                                                </span>
                                            </div>
                                        ) : (
                                            <p className="text-xs opacity-80">
                                                Şu an bu modül entegrasyonu otomatik başlatılamıyor. Çözüm
                                                bilgilerini manuel girerek kaydedebilirsiniz.
                                            </p>
                                        )}
                                    </AlertDescription>
                                </Alert>
                            )}

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div>
                                    <Label htmlFor="resolution_date">Çözüm Tarihi</Label>
                                    <Input
                                        id="resolution_date"
                                        name="resolution_date"
                                        type="date"
                                        value={form.resolution_date || ''}
                                        onChange={handleInputChange}
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="resolved_by_personnel_id">Çözüm Sorumlusu</Label>
                                    <SearchableSelectDialog
                                        options={personnelOptions}
                                        value={form.resolved_by_personnel_id || ''}
                                        onChange={handlePersonnelChange}
                                        triggerPlaceholder="Personel seçin..."
                                        dialogTitle="Çözüm Sorumlusu"
                                        searchPlaceholder="Personel ara..."
                                        notFoundText="Personel bulunamadı."
                                        allowClear
                                    />
                                </div>
                            </div>

                            <div>
                                <Label htmlFor="resolution_notes">Çözüm Açıklaması</Label>
                                <Textarea
                                    id="resolution_notes"
                                    name="resolution_notes"
                                    value={form.resolution_notes || ''}
                                    onChange={handleInputChange}
                                    placeholder="Yapılan aksiyonu, kök nedeni ve doğrulama adımlarını açıklayın..."
                                    className="min-h-[110px]"
                                />
                            </div>

                            {history.length > 0 && (
                                <div className="rounded-xl border border-slate-200 bg-white">
                                    <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
                                        <History className="h-4 w-4 text-slate-600" />
                                        <h3 className="text-sm font-semibold text-slate-900">Çözüm Geçmişi</h3>
                                        <Badge variant="secondary">{history.length}</Badge>
                                    </div>
                                    <ol className="relative space-y-3 border-l border-slate-200 px-4 py-4 pl-8">
                                        {history.map((event) => (
                                            <li key={event.id} className="relative">
                                                <span
                                                    className={`absolute -left-[22px] top-1 inline-flex h-3 w-3 rounded-full ${
                                                        event.resolution_status === RESOLUTION_STATUS.RESOLVED
                                                            ? 'bg-emerald-500'
                                                            : event.resolution_status === RESOLUTION_STATUS.IN_PROGRESS
                                                              ? 'bg-amber-500'
                                                              : event.event_type === 'cleared'
                                                                ? 'bg-slate-400'
                                                                : 'bg-rose-500'
                                                    }`}
                                                />
                                                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                                        <div className="flex flex-wrap items-center gap-1.5">
                                                            <Badge
                                                                className={
                                                                    event.resolution_status === RESOLUTION_STATUS.RESOLVED
                                                                        ? 'border-transparent bg-emerald-100 text-emerald-700'
                                                                        : event.resolution_status === RESOLUTION_STATUS.IN_PROGRESS
                                                                          ? 'border-transparent bg-amber-100 text-amber-700'
                                                                          : 'border-transparent bg-rose-100 text-rose-700'
                                                                }
                                                            >
                                                                {event.resolution_status || event.event_type || '-'}
                                                            </Badge>
                                                            {event.resolution_type ? (
                                                                <Badge variant="outline" className="text-xs">
                                                                    {event.resolution_type}
                                                                </Badge>
                                                            ) : null}
                                                        </div>
                                                        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                                                            <CalendarDays className="h-3 w-3" />
                                                            {event.actioned_at
                                                                ? format(new Date(event.actioned_at), 'dd.MM.yyyy HH:mm', {
                                                                      locale: tr,
                                                                  })
                                                                : '-'}
                                                        </span>
                                                    </div>
                                                    {event.actioned_by_name ? (
                                                        <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500">
                                                            <UserIcon className="h-3 w-3" />
                                                            {event.actioned_by_name}
                                                        </p>
                                                    ) : null}
                                                    {event.resolution_notes ? (
                                                        <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-700">
                                                            {event.resolution_notes}
                                                        </p>
                                                    ) : null}
                                                </div>
                                            </li>
                                        ))}
                                    </ol>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <footer className="flex shrink-0 flex-wrap justify-between gap-2 border-t border-border bg-muted/20 px-6 py-4">
                    <div>
                        {form.resolution_status && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleClear}
                                disabled={isSaving}
                                className="text-muted-foreground"
                            >
                                <XCircle className="mr-1.5 h-4 w-4" />
                                Çözüm Bilgilerini Temizle
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={isSaving}>
                            İptal
                        </Button>
                        <Button type="button" onClick={handleSave} disabled={isSaving || isLoading}>
                            {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
                        </Button>
                    </div>
                </footer>
            </DialogContent>
        </Dialog>
    );
};

export default ProcessInspectionResolutionModal;
