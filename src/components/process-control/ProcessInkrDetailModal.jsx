import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
    CalendarDays,
    CheckCircle2,
    Download,
    ExternalLink,
    File,
    FileDown,
    FileSpreadsheet,
    Factory,
    Hash,
    Image,
    Package2,
    Paperclip,
    Ruler,
    ShieldCheck,
    X,
    XCircle,
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { useData } from '@/contexts/DataContext';
import { supabase } from '@/lib/customSupabaseClient';
import {
    fetchProcessInkrAttachmentsForReport,
    getProcessInkrDisplayNumber,
} from './processInkrUtils';

const DetailStatCard = ({ icon: Icon, label, value, helper, tone = 'slate' }) => {
    const toneClasses = {
        slate: 'border-slate-200 bg-white text-slate-900',
        blue: 'border-blue-200 bg-blue-50/80 text-blue-950',
        green: 'border-emerald-200 bg-emerald-50/80 text-emerald-950',
        amber: 'border-amber-200 bg-amber-50/80 text-amber-950',
    };

    return (
        <div className={`rounded-3xl border p-4 shadow-sm ${toneClasses[tone] || toneClasses.slate}`}>
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-xs font-semibold tracking-[0.08em] text-slate-500">{label}</p>
                    <p className="mt-3 break-words text-2xl font-semibold tracking-tight">{value}</p>
                    {helper ? <p className="mt-2 text-sm text-slate-500">{helper}</p> : null}
                </div>
                <div className="rounded-2xl bg-white/80 p-3 shadow-sm ring-1 ring-black/5">
                    <Icon className="h-5 w-5 text-slate-700" />
                </div>
            </div>
        </div>
    );
};

const getStatusBadge = (status, dark = false) => {
    const baseClass = dark ? 'border-white/15 text-white' : 'border-transparent';

    switch (status) {
        case 'Onaylandı':
            return (
                <Badge className={`bg-emerald-500/90 ${baseClass}`}>
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                    Onaylandı
                </Badge>
            );
        case 'Reddedildi':
            return (
                <Badge className={`bg-rose-500/90 ${baseClass}`}>
                    <XCircle className="mr-1.5 h-3.5 w-3.5" />
                    Reddedildi
                </Badge>
            );
        default:
            return <Badge className={`bg-amber-500/90 ${baseClass}`}>{status || 'Taslak'}</Badge>;
    }
};

const getItemDecision = (item) => {
    const rawValue = String(item?.measured_value ?? '').trim();
    if (!rawValue) return null;

    const upperValue = rawValue.toUpperCase();
    const nominalValue = String(item?.nominal_value ?? '').trim().toUpperCase();
    const normalizedNumber = parseFloat(rawValue.replace(',', '.'));
    const minValue = parseFloat(String(item?.min_value ?? '').replace(',', '.'));
    const maxValue = parseFloat(String(item?.max_value ?? '').replace(',', '.'));
    const nominalNumber = parseFloat(String(item?.nominal_value ?? '').replace(',', '.'));

    const rejected = ['RET', 'UYGUNSUZ', 'NOK', 'NG', 'HATALI', 'RED'].some(
        (text) => upperValue === text || upperValue.startsWith(`${text} `)
    );
    if (rejected) return false;

    const approved = ['OK', 'UYGUN', 'KABUL', 'PASS', 'GECER', 'GECER', 'GEÇER', 'VAR', 'EVET'].some(
        (text) => upperValue === text || upperValue.startsWith(`${text} `)
    );
    if (approved) return true;

    if (nominalValue && upperValue === nominalValue) return true;

    if (!Number.isNaN(normalizedNumber)) {
        if (!Number.isNaN(minValue) && !Number.isNaN(maxValue)) {
            return normalizedNumber >= minValue && normalizedNumber <= maxValue;
        }
        if (!Number.isNaN(minValue)) return normalizedNumber >= minValue;
        if (!Number.isNaN(maxValue)) return normalizedNumber <= maxValue;
        if (!Number.isNaN(nominalNumber)) return normalizedNumber === nominalNumber;
    }

    return false;
};

const getDecisionBadge = (decision) => {
    if (decision === true) {
        return <Badge className="border-transparent bg-emerald-100 text-emerald-700">Kabul</Badge>;
    }
    if (decision === false) {
        return <Badge className="border-transparent bg-rose-100 text-rose-700">Ret</Badge>;
    }
    return <Badge variant="secondary">Bekliyor</Badge>;
};

const formatDateTime = (value) => {
    if (!value) return '-';

    try {
        return format(new Date(value), 'dd MMMM yyyy HH:mm', { locale: tr });
    } catch {
        return '-';
    }
};

const formatFileSize = (bytes) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const ProcessInkrDetailModal = ({
    isOpen,
    setIsOpen,
    report,
    onDownloadPDF,
    onViewPdf,
}) => {
    const { toast } = useToast();
    const { characteristics, equipment } = useData();
    const [preparedBy, setPreparedBy] = useState('');
    const [controlledBy, setControlledBy] = useState('');
    const [createdBy, setCreatedBy] = useState('');
    const [attachments, setAttachments] = useState([]);
    const [loadingAttachments, setLoadingAttachments] = useState(false);

    const getCharacteristicName = (id) => {
        const match = characteristics?.find((item) => item.value === id || item.id === id);
        return match?.label || match?.name || id || '-';
    };

    const getEquipmentName = (id) => {
        const match = equipment?.find((item) => item.value === id || item.id === id);
        return match?.label || match?.name || id || '-';
    };

    const enrichedItems = useMemo(
        () =>
            (report?.items || []).map((item, index) => {
                const methodName =
                    item.measurement_method ||
                    item.equipment_name ||
                    getEquipmentName(item.equipment_id);
                const standardLabel = item.standard_label || item.standard_class || item.tolerance_class || '-';
                const decision = getItemDecision(item);

                return {
                    ...item,
                    row_number: index + 1,
                    characteristic_name: item.characteristic_name || getCharacteristicName(item.characteristic_id),
                    equipment_name: methodName,
                    measurement_method: methodName,
                    standard_label: standardLabel,
                    decision,
                };
            }),
        [characteristics, equipment, report]
    );

    const stats = useMemo(() => {
        const approved = enrichedItems.filter((item) => item.decision === true).length;
        const rejected = enrichedItems.filter((item) => item.decision === false).length;
        const pending = enrichedItems.length - approved - rejected;

        return {
            total: enrichedItems.length,
            approved,
            rejected,
            pending,
        };
    }, [enrichedItems]);

    useEffect(() => {
        if (!report) {
            setPreparedBy('');
            setControlledBy('');
            setCreatedBy('');
            return;
        }

        setPreparedBy(report.prepared_by || '');
        setControlledBy(report.controlled_by || '');
        setCreatedBy(report.created_by || '');
    }, [report]);

    useEffect(() => {
        const fetchAttachments = async () => {
            if (!report?.id || !isOpen) {
                setAttachments([]);
                setLoadingAttachments(false);
                return;
            }

            setLoadingAttachments(true);

            try {
                const data = await fetchProcessInkrAttachmentsForReport(supabase, report.id);
                setAttachments(data || []);
            } catch (error) {
                console.error('INKR ekleri alınamadı:', error);
                setAttachments([]);
            } finally {
                setLoadingAttachments(false);
            }
        };

        fetchAttachments();
    }, [isOpen, report?.id]);

    const handleGenerateReport = async () => {
        if (!report) return;

        try {
            const enrichedData = {
                ...report,
                items: enrichedItems,
                attachments,
                prepared_by: preparedBy || '',
                controlled_by: controlledBy || '',
                created_by: createdBy || '',
            };

            await onDownloadPDF(enrichedData);
        } catch (error) {
            console.error('INKR PDF hatası:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'INKR raporu oluşturulamadı.',
            });
        }
    };

    const getFileIcon = (fileType) => {
        if (fileType?.startsWith('image/')) return <Image className="h-5 w-5 text-blue-500" />;
        if (fileType === 'application/pdf') return <FileSpreadsheet className="h-5 w-5 text-red-500" />;
        return <File className="h-5 w-5 text-slate-500" />;
    };

    const handleViewAttachment = async (attachment) => {
        try {
            const { data, error } = await supabase.storage
                .from('process_inkr_attachments')
                .createSignedUrl(attachment.file_path, 3600);

            if (error) throw error;

            if (attachment.file_type === 'application/pdf' && onViewPdf) {
                onViewPdf(attachment.file_path);
                return;
            }

            window.open(data.signedUrl, '_blank');
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: `Dosya açılamadı: ${error.message}`,
            });
        }
    };

    const handleDownloadAttachment = async (attachment) => {
        try {
            const { data, error } = await supabase.storage
                .from('process_inkr_attachments')
                .download(attachment.file_path);

            if (error) throw error;

            const url = URL.createObjectURL(data);
            const link = document.createElement('a');
            link.href = url;
            link.download = attachment.file_name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: `Dosya indirilemedi: ${error.message}`,
            });
        }
    };

    if (!report) return null;

    const displayInkrNumber = getProcessInkrDisplayNumber(report);

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-6xl w-[98vw] sm:w-[96vw] max-h-[96vh] overflow-hidden p-0 flex flex-col">
                <DialogHeader className="sr-only">
                    <DialogTitle>INKR Rapor Detayı: {displayInkrNumber}</DialogTitle>
                    <DialogDescription>
                        {displayInkrNumber} numaralı ilk numune kontrol raporu detayları
                    </DialogDescription>
                </DialogHeader>

                <header className="relative bg-slate-950 text-white">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(96,165,250,0.45),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.28),_transparent_32%),linear-gradient(135deg,_#0f172a,_#1d4ed8_55%,_#0f172a)]" />
                    <div className="relative border-b border-white/10 px-5 py-7 sm:px-6 sm:py-8">
                        <div className="flex flex-col gap-5">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div className="min-w-0 flex items-start gap-4">
                                    <div className="rounded-3xl bg-white/10 p-3 shadow-lg ring-1 ring-white/15 backdrop-blur">
                                        <FileSpreadsheet className="h-6 w-6 text-white" />
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 pt-1">
                                        <Badge className="border-white/15 bg-white/10 text-white">INKR</Badge>
                                        {getStatusBadge(report.status, true)}
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 self-start">
                                    <Button
                                        type="button"
                                        onClick={handleGenerateReport}
                                        className="rounded-2xl border border-white/10 bg-white/10 text-white shadow-lg backdrop-blur transition hover:bg-white/20"
                                    >
                                        <Download className="mr-2 h-4 w-4" />
                                        PDF Indir
                                    </Button>
                                    <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        className="rounded-2xl border border-white/10 bg-white/10 text-white hover:bg-white/20"
                                        onClick={() => setIsOpen(false)}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            <div className="min-w-0 lg:pl-[5.5rem]">
                                <div className="space-y-2">
                                    <h1 className="break-words text-[1.7rem] font-semibold leading-[1.15] tracking-tight sm:text-[1.95rem]">
                                        İlk Numune Kontrol Raporu
                                    </h1>
                                    <p className="text-sm leading-5 text-slate-200">
                                        Ölçüm sonuçları, dosyalar ve imza bilgileri tek rapor görünümünde
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2.5 pt-3 text-sm text-slate-100">
                                    <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1">
                                        <Hash className="h-4 w-4" />
                                        {displayInkrNumber}
                                    </span>
                                    <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1">
                                        <Package2 className="h-4 w-4" />
                                        {report.part_code || '-'}
                                    </span>
                                    <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1">
                                        <CalendarDays className="h-4 w-4" />
                                        {formatDateTime(report.report_date || report.created_at)}
                                    </span>
                                    {report.vehicle_type ? (
                                        <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1">
                                            <Factory className="h-4 w-4" />
                                            {report.vehicle_type}
                                        </span>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto bg-slate-50 px-5 py-5 sm:px-6">
                    <section className="grid gap-4 xl:grid-cols-4">
                        <DetailStatCard
                            icon={Package2}
                            label="Parça Adı"
                            value={report.part_name || '-'}
                            helper={[report.part_code || '-', report.vehicle_type].filter(Boolean).join(' • ')}
                            tone="slate"
                        />
                        <DetailStatCard
                            icon={Ruler}
                            label="Ölçüm Satırı"
                            value={stats.total}
                            helper={`${stats.pending} bekleyen`}
                            tone="blue"
                        />
                        <DetailStatCard
                            icon={CheckCircle2}
                            label="Kabul"
                            value={stats.approved}
                            helper="Uygun sonuçlar"
                            tone="green"
                        />
                        <DetailStatCard
                            icon={ShieldCheck}
                            label="Durum"
                            value={report.status || 'Taslak'}
                            helper={attachments.length ? `${attachments.length} ek dosya` : 'Ek dosya yok'}
                            tone="amber"
                        />
                    </section>

                    <section className="mt-5 grid gap-5 xl:grid-cols-[1.25fr_0.95fr]">
                        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="flex items-center gap-2">
                                <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                                <h2 className="text-xl font-semibold tracking-tight text-slate-900">Genel Bilgiler</h2>
                            </div>
                            <div className="mt-5 grid gap-4 sm:grid-cols-2">
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                    <p className="text-xs font-semibold tracking-[0.08em] text-slate-500">INKR No</p>
                                    <p className="mt-2 text-base font-semibold text-slate-900">{displayInkrNumber}</p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                    <p className="text-xs font-semibold tracking-[0.08em] text-slate-500">Rapor Tarihi</p>
                                    <p className="mt-2 text-base font-semibold text-slate-900">
                                        {formatDateTime(report.report_date || report.created_at)}
                                    </p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                    <p className="text-xs font-semibold tracking-[0.08em] text-slate-500">Parça Kodu</p>
                                    <p className="mt-2 text-base font-semibold text-slate-900">{report.part_code || '-'}</p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                    <p className="text-xs font-semibold tracking-[0.08em] text-slate-500">Araç Tipi</p>
                                    <p className="mt-2 text-base font-semibold text-slate-900">{report.vehicle_type || '-'}</p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                    <p className="text-xs font-semibold tracking-[0.08em] text-slate-500">Durum</p>
                                    <div className="mt-2">{getStatusBadge(report.status)}</div>
                                </div>
                            </div>

                            <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                                <p className="text-xs font-semibold tracking-[0.08em] text-slate-500">Kritik Bilgiler / Notlar</p>
                                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                                    {report.notes || 'Bu kayıt için not eklenmemiş.'}
                                </p>
                            </div>
                        </div>

                        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="flex items-center gap-2">
                                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                                <h2 className="text-xl font-semibold tracking-tight text-slate-900">Rapor Onayı</h2>
                            </div>
                            <div className="mt-5 space-y-4">
                                <div>
                                    <Label htmlFor="inkr-prepared-by">Hazırlayan</Label>
                                    <Input
                                        id="inkr-prepared-by"
                                        value={preparedBy}
                                        onChange={(event) => setPreparedBy(event.target.value)}
                                        placeholder="Ad Soyad"
                                        className="mt-2 h-11 rounded-2xl"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="inkr-controlled-by">Kontrol Eden</Label>
                                    <Input
                                        id="inkr-controlled-by"
                                        value={controlledBy}
                                        onChange={(event) => setControlledBy(event.target.value)}
                                        placeholder="Ad Soyad"
                                        className="mt-2 h-11 rounded-2xl"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="inkr-created-by">Onaylayan</Label>
                                    <Input
                                        id="inkr-created-by"
                                        value={createdBy}
                                        onChange={(event) => setCreatedBy(event.target.value)}
                                        placeholder="Ad Soyad"
                                        className="mt-2 h-11 rounded-2xl"
                                    />
                                </div>
                                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                                    PDF oluştururken bu bilgiler ortak rapor şablonuna aktarılır.
                                </div>
                                <Button onClick={handleGenerateReport} className="h-11 w-full rounded-2xl">
                                    <FileDown className="mr-2 h-4 w-4" />
                                    PDF Oluştur
                                </Button>
                            </div>
                        </div>
                    </section>

                    <section className="mt-5 rounded-[28px] border border-slate-200 bg-white shadow-sm">
                        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                            <div>
                                <h2 className="text-xl font-semibold tracking-tight text-slate-900">Ölçüm Sonuçları</h2>
                                <p className="mt-1 text-sm text-slate-500">
                                    Muayene kaydı görünümüne uygun, rapor odaklı tablo
                                </p>
                            </div>
                            <Badge variant="secondary">{stats.total} satır</Badge>
                        </div>

                        {enrichedItems.length ? (
                            <div className="overflow-x-auto">
                                <table className="min-w-full border-collapse text-sm">
                                    <thead>
                                        <tr className="bg-slate-100/80 text-slate-600">
                                            <th className="px-5 py-4 text-left font-semibold">Karakteristik</th>
                                            <th className="px-5 py-4 text-left font-semibold">Yöntem</th>
                                            <th className="px-5 py-4 text-left font-semibold">Standart / Sınıf</th>
                                            <th className="px-5 py-4 text-center font-semibold">Nominal</th>
                                            <th className="px-5 py-4 text-center font-semibold">Tolerans</th>
                                            <th className="px-5 py-4 text-center font-semibold">Ölçülen</th>
                                            <th className="px-5 py-4 text-center font-semibold">Sonuç</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {enrichedItems.map((item) => (
                                            <tr key={item.id || item.row_number} className="border-t border-slate-200">
                                                <td className="px-5 py-4 align-top">
                                                    <p className="font-semibold text-slate-900">
                                                        {item.characteristic_name || '-'}
                                                    </p>
                                                    <p className="mt-1 text-xs tracking-[0.08em] text-slate-500">
                                                        Satır {item.row_number}
                                                    </p>
                                                </td>
                                                <td className="px-5 py-4 align-top text-slate-700">
                                                    {item.measurement_method || '-'}
                                                </td>
                                                <td className="px-5 py-4 align-top text-slate-700">
                                                    {item.standard_label || '-'}
                                                </td>
                                                <td className="px-5 py-4 text-center font-medium text-slate-900">
                                                    {item.nominal_value || '-'}
                                                </td>
                                                <td className="px-5 py-4 text-center text-slate-600">
                                                    {item.min_value !== null && item.min_value !== undefined
                                                        ? `${item.min_value} - ${item.max_value ?? '-'}`
                                                        : 'Yok'}
                                                </td>
                                                <td className="px-5 py-4 text-center font-semibold text-slate-900">
                                                    {item.measured_value || '-'}
                                                </td>
                                                <td className="px-5 py-4 text-center">{getDecisionBadge(item.decision)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="px-5 py-10 text-center text-sm text-slate-500">
                                Bu INKR kaydında ölçüm satırı bulunamadı.
                            </div>
                        )}
                    </section>

                    <section className="mt-5 rounded-[28px] border border-slate-200 bg-white shadow-sm">
                        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
                            <Paperclip className="h-4 w-4 text-slate-500" />
                            <h2 className="text-xl font-semibold tracking-tight text-slate-900">Ek Dosyalar</h2>
                        </div>

                        <div className="px-5 py-5">
                            {loadingAttachments ? (
                                <p className="text-sm text-slate-500">Dosyalar yükleniyor...</p>
                            ) : attachments.length ? (
                                <div className="space-y-3">
                                    {attachments.map((attachment) => (
                                        <div
                                            key={attachment.id}
                                            className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
                                                    {getFileIcon(attachment.file_type)}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-slate-900">{attachment.file_name}</p>
                                                    <p className="mt-1 text-sm text-slate-500">
                                                        {formatFileSize(attachment.file_size)} •{' '}
                                                        {formatDateTime(attachment.uploaded_at)}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="rounded-2xl"
                                                    onClick={() => handleViewAttachment(attachment)}
                                                >
                                                    <ExternalLink className="mr-2 h-4 w-4" />
                                                    Görüntüle
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="rounded-2xl"
                                                    onClick={() => handleDownloadAttachment(attachment)}
                                                >
                                                    <Download className="mr-2 h-4 w-4" />
                                                    İndir
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-slate-500">Bu INKR kaydına henüz dosya eklenmemiş.</p>
                            )}
                        </div>
                    </section>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ProcessInkrDetailModal;
