import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
    AlertTriangle,
    Box,
    CalendarDays,
    CheckCircle2,
    Download,
    FileImage,
    FileText,
    Gauge,
    Hash,
    Paperclip,
    Ruler,
    User,
    X,
    XCircle,
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { useData } from '@/contexts/DataContext';
import { supabase } from '@/lib/customSupabaseClient';
import { openPrintableReport } from '@/lib/reportUtils';
import { buildMeasurementBundle } from './processInspectionUtils';

const getResultDecisionFlag = (row) => {
    if (typeof row?.result === 'boolean') return row.result;
    if (typeof row?.is_ok === 'boolean') return row.is_ok;

    const normalized = String(
        row?.measured_value ?? row?.measurement_value ?? row?.actual_value ?? row?.result ?? ''
    )
        .trim()
        .toLowerCase();

    if (!normalized) return null;
    if (['ok', 'uygun', 'kabul', 'gecti', 'gectı', 'gecer', 'geçer', 'pass'].includes(normalized)) {
        return true;
    }
    if (['nok', 'uygun degil', 'uygun değil', 'ret', 'red', 'ng', 'fail'].includes(normalized)) {
        return false;
    }

    return null;
};

const InspectionStatCard = ({ icon: Icon, label, value, helper, tone = 'slate' }) => {
    const toneClasses = {
        slate: 'border-slate-200 bg-white text-slate-900',
        blue: 'border-blue-200 bg-blue-50/80 text-blue-950',
        green: 'border-emerald-200 bg-emerald-50/80 text-emerald-950',
        amber: 'border-amber-200 bg-amber-50/80 text-amber-950',
        red: 'border-rose-200 bg-rose-50/80 text-rose-950',
    };

    const selectedTone = toneClasses[tone] || toneClasses.slate;
    const valueClass =
        typeof value === 'number'
            ? 'text-3xl'
            : 'text-lg leading-snug sm:text-xl';

    return (
        <div className={`rounded-3xl border p-4 shadow-sm ${selectedTone}`}>
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-xs font-semibold tracking-[0.08em] text-slate-500">{label}</p>
                    <p className={`mt-3 font-semibold tracking-tight break-words ${valueClass}`}>{value}</p>
                    {helper ? <p className="mt-2 text-sm text-slate-500">{helper}</p> : null}
                </div>
                <div className="rounded-2xl bg-white/80 p-3 shadow-sm ring-1 ring-black/5">
                    <Icon className="h-5 w-5 text-slate-700" />
                </div>
            </div>
        </div>
    );
};

const getDecisionBadge = (decision, dark = false) => {
    const baseClass = dark ? 'border-white/15 text-white' : 'border-transparent';

    switch (decision) {
        case 'Kabul':
            return (
                <Badge className={`bg-emerald-500/90 ${baseClass}`}>
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                    Kabul
                </Badge>
            );
        case 'Şartlı Kabul':
            return <Badge className={`bg-amber-500/90 ${baseClass}`}>Şartlı Kabul</Badge>;
        case 'Ret':
            return (
                <Badge className={`bg-rose-500/90 ${baseClass}`}>
                    <XCircle className="mr-1.5 h-3.5 w-3.5" />
                    Ret
                </Badge>
            );
        default:
            return <Badge className={`bg-slate-500/90 ${baseClass}`}>Beklemede</Badge>;
    }
};

const getRowStatusBadge = (row) => {
    const resultFlag = getResultDecisionFlag(row);

    if (resultFlag === true) {
        return <Badge className="border-transparent bg-emerald-100 text-emerald-700">Uygun</Badge>;
    }
    if (resultFlag === false) {
        return <Badge className="border-transparent bg-rose-100 text-rose-700">Uygun Değil</Badge>;
    }
    return <Badge variant="secondary">Bekliyor</Badge>;
};

const formatInspectionDate = (value) => {
    if (!value) return '-';

    try {
        return format(new Date(value), 'dd MMMM yyyy HH:mm', { locale: tr });
    } catch {
        return '-';
    }
};

const ProcessInspectionDetailModal = ({ isOpen, setIsOpen, inspection }) => {
    const { toast } = useToast();
    const { characteristics, equipment } = useData();
    const [referencePlan, setReferencePlan] = useState(null);
    const [isLoadingReference, setIsLoadingReference] = useState(false);
    const [referenceError, setReferenceError] = useState('');

    useEffect(() => {
        let isMounted = true;

        const loadReferencePlan = async () => {
            if (!isOpen || !inspection?.part_code) {
                if (isMounted) {
                    setReferencePlan(null);
                    setReferenceError('');
                    setIsLoadingReference(false);
                }
                return;
            }

            setIsLoadingReference(true);
            setReferenceError('');

            try {
                const { data, error } = await supabase
                    .from('process_control_plans')
                    .select('id, revision_number, revision_date, items')
                    .eq('part_code', inspection.part_code)
                    .order('revision_number', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (error) throw error;

                if (isMounted) {
                    setReferencePlan(data || null);
                    if (!data) {
                        setReferenceError(
                            'Referans kontrol planı bulunamadı. Nominal ve tolerans alanları sadece mevcut kayıttan gösteriliyor.'
                        );
                    }
                }
            } catch (error) {
                if (isMounted) {
                    console.error('Referans kontrol planı alınamadı:', error);
                    setReferencePlan(null);
                    setReferenceError(
                        'Kontrol planı yüklenemedi. Ölçüm satırları temel kayıt verisi ile gösteriliyor.'
                    );
                }
            } finally {
                if (isMounted) {
                    setIsLoadingReference(false);
                }
            }
        };

        loadReferencePlan();

        return () => {
            isMounted = false;
        };
    }, [inspection?.part_code, isOpen]);

    const { measurementSummary, enhancedResults } = useMemo(() => {
        if (!inspection) {
            return { measurementSummary: [], enhancedResults: [] };
        }

        const bundle = buildMeasurementBundle({
            controlPlan: referencePlan,
            quantityProduced: Number(inspection.quantity_produced) || 0,
            characteristics,
            equipment,
            existingRows: inspection.results || [],
        });

        return {
            measurementSummary: bundle.summary || [],
            enhancedResults: bundle.results || [],
        };
    }, [characteristics, equipment, inspection, referencePlan]);

    const acceptedQuantity = Math.max(
        (Number(inspection?.quantity_produced) || 0) -
            (Number(inspection?.quantity_rejected) || 0) -
            (Number(inspection?.quantity_conditional) || 0),
        0
    );

    const totalDefects = useMemo(
        () =>
            (inspection?.defects || []).reduce(
                (total, item) => total + (Number(item?.defect_count) || 0),
                0
            ),
        [inspection?.defects]
    );

    const measurementStats = useMemo(() => {
        const passed = enhancedResults.filter((row) => getResultDecisionFlag(row) === true).length;
        const failed = enhancedResults.filter((row) => getResultDecisionFlag(row) === false).length;
        const pending = enhancedResults.length - passed - failed;

        return {
            total: enhancedResults.length,
            passed,
            failed,
            pending,
        };
    }, [enhancedResults]);

    const hasToleranceColumn = enhancedResults.some(
        (row) => row.min_value !== null || row.max_value !== null
    );

    const printableInspection = useMemo(
        () => ({
            ...inspection,
            quantity_accepted: acceptedQuantity,
            status: inspection?.decision || inspection?.status || 'Beklemede',
            prepared_by: inspection?.operator_name || '',
            controlled_by: '',
            created_by: '',
            results: enhancedResults.map((row) => ({
                ...row,
                feature: row.characteristic_name || '-',
                actual_value: String(row.measured_value ?? row.measurement_value ?? ''),
                measured_value: String(row.measured_value ?? row.measurement_value ?? ''),
                result: getResultDecisionFlag(row),
            })),
        }),
        [acceptedQuantity, enhancedResults, inspection]
    );

    const handleGenerateReport = async () => {
        if (!inspection) return;

        if (isLoadingReference) {
            toast({
                title: 'Hazırlanıyor',
                description: 'Referans kontrol planı yükleniyor. Birkaç saniye sonra tekrar deneyin.',
            });
            return;
        }

        try {
            await openPrintableReport(printableInspection, 'process_inspection', true);
        } catch (error) {
            console.error('Proses muayene PDF hatası:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Proses muayene raporu oluşturulamadı.',
            });
        }
    };

    if (!inspection) return null;

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-6xl w-[98vw] sm:w-[96vw] max-h-[96vh] overflow-hidden p-0 flex flex-col">
                <DialogHeader className="sr-only">
                    <DialogTitle>Proses Muayene Raporu: {inspection.record_no}</DialogTitle>
                    <DialogDescription>
                        {formatInspectionDate(inspection.inspection_date || inspection.created_at)} tarihli muayene
                        kaydının detayları
                    </DialogDescription>
                </DialogHeader>

                <header className="relative shrink-0 overflow-visible bg-slate-950 text-white">
                    <div className="absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(96,165,250,0.45),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.28),_transparent_32%),linear-gradient(135deg,_#0f172a,_#1d4ed8_55%,_#0f172a)]" />
                    <div className="relative border-b border-white/10 px-5 pt-6 pb-5 pr-12 sm:px-6 sm:pt-7 sm:pb-6 sm:pr-14">
                        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0 flex items-start gap-4">
                                <div className="rounded-3xl bg-white/10 p-3 shadow-lg ring-1 ring-white/15 backdrop-blur">
                                    <FileText className="h-6 w-6 text-white" />
                                </div>
                                <div className="min-w-0 space-y-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge className="border-white/15 bg-white/10 text-white">
                                            Proses Muayene
                                        </Badge>
                                        {getDecisionBadge(inspection.decision, true)}
                                    </div>
                                    <div>
                                        <h1 className="break-words text-xl font-semibold leading-snug tracking-tight sm:text-2xl lg:text-3xl">
                                            Muayene Kayıt Detayı
                                        </h1>
                                        <p className="mt-1 text-sm text-slate-200">
                                            Ölçüm sonuçları, miktar özetleri ve ek dosyalar tek rapor görünümünde
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-3 text-sm text-slate-100">
                                        <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1">
                                            <Box className="h-4 w-4" />
                                            {inspection.part_code || '-'}
                                        </span>
                                        <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1">
                                            <Hash className="h-4 w-4" />
                                            {inspection.record_no || '-'}
                                        </span>
                                        <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1">
                                            <CalendarDays className="h-4 w-4" />
                                            {formatInspectionDate(inspection.inspection_date || inspection.created_at)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 self-start">
                                <Button
                                    variant="secondary"
                                    className="border-white/15 bg-white/10 text-white hover:bg-white/20"
                                    onClick={handleGenerateReport}
                                >
                                    <Download className="mr-2 h-4 w-4" />
                                    PDF Indir
                                </Button>
                                <Button
                                    variant="secondary"
                                    size="icon"
                                    className="border-white/15 bg-white/10 text-white hover:bg-white/20"
                                    onClick={() => setIsOpen(false)}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </header>

                <div className="min-h-0 flex-1 overflow-y-auto bg-slate-100/80">
                    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-6">
                        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <InspectionStatCard
                                icon={Box}
                                label="Parça"
                                value={inspection.part_name || inspection.part_code || '-'}
                                helper={inspection.part_name && inspection.part_code ? inspection.part_code : null}
                                tone="blue"
                            />
                            <InspectionStatCard
                                icon={User}
                                label="Operatör"
                                value={inspection.operator_name || '-'}
                                helper="Kaydı oluşturan sorumlu"
                            />
                            <InspectionStatCard
                                icon={CalendarDays}
                                label="Muayene Tarihi"
                                value={formatInspectionDate(inspection.inspection_date || inspection.created_at)}
                                helper={inspection.created_at ? `Kayıt: ${formatInspectionDate(inspection.created_at)}` : null}
                            />
                            <InspectionStatCard
                                icon={Gauge}
                                label="Ölçüm Satırı"
                                value={measurementStats.total}
                                helper={`${measurementStats.passed} uygun / ${measurementStats.failed} uygunsuz`}
                                tone="green"
                            />
                        </section>

                        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                <div>
                                    <p className="text-xs font-semibold tracking-[0.08em] text-slate-500">
                                        Miktar Özeti
                                    </p>
                                    <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
                                        Karar dağılımı
                                    </h2>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {getDecisionBadge(inspection.decision)}
                                    {totalDefects > 0 ? (
                                        <Badge className="border-transparent bg-rose-100 text-rose-700">
                                            {totalDefects} toplam kusur
                                        </Badge>
                                    ) : null}
                                </div>
                            </div>

                            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                                <InspectionStatCard
                                    icon={Hash}
                                    label="Üretilen"
                                    value={Number(inspection.quantity_produced) || 0}
                                    helper="Toplam kontrol edilen miktar"
                                    tone="blue"
                                />
                                <InspectionStatCard
                                    icon={CheckCircle2}
                                    label="Kabul Edilen"
                                    value={acceptedQuantity}
                                    helper="Doğrudan kabul"
                                    tone="green"
                                />
                                <InspectionStatCard
                                    icon={AlertTriangle}
                                    label="Şartlı Kabul"
                                    value={Number(inspection.quantity_conditional) || 0}
                                    helper="Ek aksiyon gerektiren miktar"
                                    tone="amber"
                                />
                                <InspectionStatCard
                                    icon={XCircle}
                                    label="Ret"
                                    value={Number(inspection.quantity_rejected) || 0}
                                    helper="Hatalı parça adedi"
                                    tone="red"
                                />
                            </div>
                        </section>

                        {inspection.notes ? (
                            <section className="rounded-[28px] border border-amber-200 bg-amber-50/80 p-5 shadow-sm">
                                <div className="flex items-center gap-2 text-amber-900">
                                    <AlertTriangle className="h-5 w-5" />
                                    <h2 className="text-lg font-semibold">Açıklamalar</h2>
                                </div>
                                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-amber-950/80">
                                    {inspection.notes}
                                </p>
                            </section>
                        ) : null}

                        <section className="rounded-[28px] border border-slate-200 bg-white shadow-sm overflow-hidden">
                            <div className="border-b border-slate-200 px-5 py-4">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                    <div>
                                        <p className="text-xs font-semibold tracking-[0.08em] text-slate-500">
                                            Ölçüm Sonuçları
                                        </p>
                                        <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
                                            Referans plan ile zenginleştirilmiş kontrol listesi
                                        </h2>
                                        <p className="mt-1 text-sm text-slate-500">
                                            Ölçülen değerler kayıttan, nominal ve tolerans bilgileri varsa güncel proses
                                            kontrol planından geliyor.
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        <Badge variant="secondary">{measurementStats.total} satir</Badge>
                                        <Badge className="border-transparent bg-emerald-100 text-emerald-700">
                                            {measurementStats.passed} uygun
                                        </Badge>
                                        <Badge className="border-transparent bg-rose-100 text-rose-700">
                                            {measurementStats.failed} uygunsuz
                                        </Badge>
                                        {referencePlan ? (
                                            <Badge className="border-transparent bg-blue-100 text-blue-700">
                                                Plan Rev. {referencePlan.revision_number ?? 0}
                                            </Badge>
                                        ) : null}
                                    </div>
                                </div>

                                {isLoadingReference ? (
                                    <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                                        Referans proses kontrol planı yükleniyor...
                                    </div>
                                ) : null}

                                {!isLoadingReference && referenceError ? (
                                    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                        {referenceError}
                                    </div>
                                ) : null}

                                {measurementSummary.length > 0 ? (
                                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                        {measurementSummary.slice(0, 6).map((item, index) => (
                                            <div
                                                key={`${item.name}-${index}`}
                                                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <p className="font-medium text-slate-900">{item.name}</p>
                                                        <p className="mt-1 text-xs text-slate-500">{item.method}</p>
                                                    </div>
                                                    <Badge variant="secondary">{item.count} ölçüm</Badge>
                                                </div>
                                                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                                                    <span className="rounded-full bg-white px-2.5 py-1">Nominal: {item.nominal || '-'}</span>
                                                    <span className="rounded-full bg-white px-2.5 py-1">
                                                        Tolerans: {item.tolerance}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : null}
                            </div>

                            {enhancedResults.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="min-w-[920px] w-full text-sm">
                                        <thead className="bg-slate-50">
                                            <tr className="border-b border-slate-200 text-left text-xs font-semibold tracking-[0.08em] text-slate-500">
                                                <th className="px-4 py-3">#</th>
                                                <th className="px-4 py-3">Karakteristik</th>
                                                <th className="px-4 py-3">Ölçüm</th>
                                                <th className="px-4 py-3">Nominal</th>
                                                {hasToleranceColumn ? <th className="px-4 py-3">Tolerans</th> : null}
                                                <th className="px-4 py-3">Ölçülen Değer</th>
                                                <th className="px-4 py-3 text-center">Sonuç</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {enhancedResults.map((row, index) => (
                                                <tr
                                                    key={row.id || `${row.characteristic_id}-${index}`}
                                                    className="bg-white align-top transition-colors hover:bg-slate-50/80"
                                                >
                                                    <td className="px-4 py-4 font-medium text-slate-500">{index + 1}</td>
                                                    <td className="px-4 py-4">
                                                        <div className="space-y-1">
                                                            <p className="font-medium text-slate-900">
                                                                {row.characteristic_name || '-'}
                                                            </p>
                                                            <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                                                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1">
                                                                    <Gauge className="h-3.5 w-3.5" />
                                                                    {row.measurement_method || '-'}
                                                                </span>
                                                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1">
                                                                    <Ruler className="h-3.5 w-3.5" />
                                                                    {row.characteristic_type || 'Genel'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 text-slate-600">
                                                        {row.measurement_number && row.total_measurements
                                                            ? `${row.measurement_number} / ${row.total_measurements}`
                                                            : '-'}
                                                    </td>
                                                    <td className="px-4 py-4 font-medium text-slate-900">
                                                        {row.nominal_value || '-'}
                                                    </td>
                                                    {hasToleranceColumn ? (
                                                        <td className="px-4 py-4 text-slate-600">
                                                            {row.min_value !== null || row.max_value !== null
                                                                ? `${row.min_value ?? '-'} / ${row.max_value ?? '-'}`
                                                                : 'Yok'}
                                                        </td>
                                                    ) : null}
                                                    <td className="px-4 py-4">
                                                        <span className="inline-flex min-w-[88px] justify-center rounded-xl bg-slate-900 px-3 py-1.5 font-mono text-sm font-semibold text-white">
                                                            {row.measured_value || row.measurement_value || '-'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-4 text-center">{getRowStatusBadge(row)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="px-5 py-14 text-center text-slate-500">
                                    Bu kayıt için ölçüm sonucu bulunamadı.
                                </div>
                            )}
                        </section>

                        {(inspection.defects || []).length > 0 ? (
                            <section className="rounded-[28px] border border-rose-200 bg-white shadow-sm overflow-hidden">
                                <div className="border-b border-rose-100 bg-rose-50 px-5 py-4">
                                    <div className="flex items-center gap-2 text-rose-700">
                                        <AlertTriangle className="h-5 w-5" />
                                        <h2 className="text-lg font-semibold">Tespit Edilen Hatalar</h2>
                                        <Badge className="border-transparent bg-rose-100 text-rose-700">
                                            {totalDefects} toplam
                                        </Badge>
                                    </div>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[640px] text-sm">
                                        <thead className="bg-rose-50/70 text-left text-xs font-semibold tracking-[0.08em] text-rose-700">
                                            <tr>
                                                <th className="px-4 py-3">Hata Tipi</th>
                                                <th className="px-4 py-3">Açıklama</th>
                                                <th className="px-4 py-3 text-center">Adet</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-rose-100">
                                            {(inspection.defects || []).map((item, index) => (
                                                <tr key={item.id || index} className="bg-white">
                                                    <td className="px-4 py-4 font-medium text-slate-900">
                                                        {item.defect_type || '-'}
                                                    </td>
                                                    <td className="px-4 py-4 text-slate-600">{item.description || '-'}</td>
                                                    <td className="px-4 py-4 text-center font-semibold text-rose-700">
                                                        {Number(item.defect_count) || 0}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        ) : null}

                        {(inspection.attachments || []).length > 0 ? (
                            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                                <div className="flex items-center gap-2">
                                    <Paperclip className="h-5 w-5 text-slate-700" />
                                    <h2 className="text-lg font-semibold text-slate-900">Ekli Dosyalar</h2>
                                    <Badge variant="secondary">{inspection.attachments.length}</Badge>
                                </div>

                                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                    {(inspection.attachments || []).map((attachment) => (
                                        <div
                                            key={attachment.id}
                                            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                                        >
                                            <div className="rounded-2xl bg-white p-2 shadow-sm">
                                                {attachment.file_type?.startsWith('image/') ? (
                                                    <FileImage className="h-5 w-5 text-blue-600" />
                                                ) : (
                                                    <FileText className="h-5 w-5 text-slate-700" />
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="truncate font-medium text-slate-900">
                                                    {attachment.file_name}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    {attachment.file_size
                                                        ? `${(attachment.file_size / 1024).toFixed(1)} KB`
                                                        : '-'}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        ) : null}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ProcessInspectionDetailModal;
