import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useDropzone } from 'react-dropzone';
import { sanitizeFileName } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { getProcessInkrDisplayNumber } from './processInkrUtils';
import { buildMeasurementBundle } from './processInspectionUtils';
import { syncProcessInspectionNonconformity } from '@/lib/processInspectionNonconformitySync';
import {
    AlertCircle,
    AlertTriangle,
    CheckCircle2,
    ClipboardCheck,
    ExternalLink,
    FileText,
    Gauge,
    Hash,
    HelpCircle,
    Paperclip,
    Plus,
    Ruler,
    ShieldAlert,
    Trash2,
    User,
    X,
} from 'lucide-react';

const INITIAL_FORM_STATE = {
    record_no: '',
    inspection_date: new Date().toISOString().split('T')[0],
    part_name: '',
    part_code: '',
    quantity_produced: 0,
    quantity_rejected: 0,
    quantity_conditional: 0,
    operator_name: '',
    decision: 'Beklemede',
    notes: '',
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
    if (['ok', 'uygun', 'kabul', 'gecti', 'gectı', 'gecer', 'geçer', 'pass'].includes(normalized)) {
        return true;
    }
    if (['nok', 'uygun değil', 'uygun degil', 'ret', 'red', 'ng', 'fail'].includes(normalized)) {
        return false;
    }

    return null;
};

const deriveInspectionDecision = ({
    quantityProduced,
    quantityRejected,
    quantityConditional,
    results,
}) => {
    const produced = Number(quantityProduced) || 0;
    const rejected = Number(quantityRejected) || 0;
    const conditional = Number(quantityConditional) || 0;
    const measurementRows = Array.isArray(results) ? results : [];
    const hasMeasurementRows = measurementRows.length > 0;
    const hasFailedMeasurements = measurementRows.some((row) => getResultDecisionFlag(row) === false);
    const hasPendingMeasurements =
        hasMeasurementRows && measurementRows.some((row) => getResultDecisionFlag(row) === null);

    if (conditional > 0) return 'Şartlı Kabul';
    if (rejected > 0 || hasFailedMeasurements) return 'Ret';
    if (produced <= 0) return 'Beklemede';
    if (hasPendingMeasurements) return 'Beklemede';
    return 'Kabul';
};

const InspectionResultRow = ({ item, index, onResultChange, isViewMode }) => {
    const hasTolerance = item.min_value !== null && item.min_value !== undefined;

    const handleActualValueChange = (value) => {
        const normalizedValue = String(value).replace(',', '.');
        let result = null;

        if (hasTolerance) {
            const actual = parseFloat(normalizedValue);
            const min = parseFloat(String(item.min_value).replace(',', '.'));
            const max = parseFloat(String(item.max_value).replace(',', '.'));

            if (!Number.isNaN(actual) && !Number.isNaN(min) && !Number.isNaN(max)) {
                result = actual >= min && actual <= max;
            }
        } else {
            const normalizedText = normalizedValue.trim().toLowerCase();
            if (['ok', 'uygun', 'kabul', 'gecti', 'gecer', 'geçer'].includes(normalizedText)) {
                result = true;
            } else if (normalizedText) {
                result = false;
            }
        }

        onResultChange(index, value, result);
    };

    return (
        <tr className="border-b border-border/70 transition-colors hover:bg-muted/30">
            <td className="p-3 align-middle">
                <div className="max-w-[220px]">
                    <p className="break-words font-medium text-foreground">{item.characteristic_name}</p>
                    <p className="text-xs text-muted-foreground">{item.characteristic_type || 'Genel'}</p>
                </div>
            </td>
            <td className="p-3 align-middle text-sm text-muted-foreground">
                <span className="break-words">{item.measurement_method}</span>
            </td>
            <td className="p-3 align-middle text-center text-sm font-medium">
                {item.measurement_number}/{item.total_measurements}
            </td>
            <td className="p-3 align-middle text-center text-sm">{item.nominal_value || '-'}</td>
            <td className="p-3 align-middle text-center text-sm text-muted-foreground">
                {hasTolerance ? item.min_value : '-'}
            </td>
            <td className="p-3 align-middle text-center text-sm text-muted-foreground">
                {hasTolerance ? item.max_value : '-'}
            </td>
            <td className="p-3 align-middle">
                <Input
                    type="text"
                    inputMode={hasTolerance ? 'decimal' : 'text'}
                    placeholder={hasTolerance ? 'Ölçülen değeri girin' : 'OK / NOK'}
                    value={item.measured_value || ''}
                    onChange={(event) => handleActualValueChange(event.target.value)}
                    disabled={isViewMode}
                    className={item.result === false ? 'border-destructive focus-visible:ring-destructive' : ''}
                />
            </td>
            <td className="p-3 align-middle text-center">
                <span
                    className={`inline-flex items-center justify-center rounded-md px-2 py-1 text-center text-[11px] font-semibold leading-tight ${
                        item.result === true
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                            : item.result === false
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                              : 'bg-muted text-muted-foreground'
                    }`}
                >
                    {item.result === true ? 'Uygun' : item.result === false ? 'Uygun Değil' : 'Bekliyor'}
                </span>
            </td>
        </tr>
    );
};

const ProcessInspectionFormModal = ({
    isOpen,
    setIsOpen,
    existingInspection,
    refreshData,
    isViewMode,
}) => {
    const { toast } = useToast();
    const { characteristics, equipment } = useData();
    const { user } = useAuth();

    const [formData, setFormData] = useState(INITIAL_FORM_STATE);
    const [controlPlan, setControlPlan] = useState(null);
    const [inkrReport, setInkrReport] = useState(null);
    const [results, setResults] = useState([]);
    const [existingResultRows, setExistingResultRows] = useState([]);
    const [defects, setDefects] = useState([]);
    const [newAttachments, setNewAttachments] = useState([]);
    const [existingAttachments, setExistingAttachments] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingContext, setIsLoadingContext] = useState(false);
    const [warnings, setWarnings] = useState({ inkr: null, plan: null });
    const [measurementSummary, setMeasurementSummary] = useState([]);
    const [generatingRecordNo, setGeneratingRecordNo] = useState(false);

    const resultsSeedRef = useRef([]);
    const partContextRequestRef = useRef(0);

    useEffect(() => {
        resultsSeedRef.current = results;
    }, [results]);

    const acceptedQuantity = useMemo(() => {
        const produced = Number(formData.quantity_produced) || 0;
        const rejected = Number(formData.quantity_rejected) || 0;
        const conditional = Number(formData.quantity_conditional) || 0;
        return Math.max(produced - rejected - conditional, 0);
    }, [formData.quantity_conditional, formData.quantity_produced, formData.quantity_rejected]);

    const hasQuantityMismatch = useMemo(() => {
        const produced = Number(formData.quantity_produced) || 0;
        const rejected = Number(formData.quantity_rejected) || 0;
        const conditional = Number(formData.quantity_conditional) || 0;
        return rejected + conditional > produced;
    }, [formData.quantity_conditional, formData.quantity_produced, formData.quantity_rejected]);

    const hasReferenceSuccess =
        !warnings.plan && !warnings.inkr && !!controlPlan && !!inkrReport && !!formData.part_code;

    const title = isViewMode
        ? 'Proses Muayene Kaydını Görüntüle'
        : existingInspection
          ? 'Proses Muayene Kaydını Düzenle'
          : 'Yeni Proses Muayene Kaydı';
    const badgeLabel = isViewMode ? 'Görüntüleme' : existingInspection ? 'Düzenleme' : 'Yeni';

    const resetForm = useCallback(() => {
        setFormData(INITIAL_FORM_STATE);
        setControlPlan(null);
        setInkrReport(null);
        setResults([]);
        setExistingResultRows([]);
        setDefects([]);
        setNewAttachments([]);
        setExistingAttachments([]);
        setWarnings({ inkr: null, plan: null });
        setMeasurementSummary([]);
        setIsLoadingContext(false);
        resultsSeedRef.current = [];
        partContextRequestRef.current = 0;
    }, []);

    const generateRecordNo = useCallback(async () => {
        setGeneratingRecordNo(true);

        try {
            const today = new Date();
            const prefix = `PM${today.getFullYear().toString().slice(-2)}${String(
                today.getMonth() + 1
            ).padStart(2, '0')}`;

            const { data, error } = await supabase
                .from('process_inspections')
                .select('record_no')
                .like('record_no', `${prefix}%`)
                .order('record_no', { ascending: false })
                .limit(1);

            if (error) throw error;

            let sequence = 1;

            if (data?.length) {
                const latestNumber = data[0].record_no;
                const latestSequence = Number(latestNumber.slice(prefix.length));
                if (!Number.isNaN(latestSequence)) {
                    sequence = latestSequence + 1;
                }
            }

            setFormData((previous) => ({
                ...previous,
                record_no: `${prefix}${String(sequence).padStart(3, '0')}`,
            }));
        } catch (error) {
            console.error('Kayıt numarası oluşturulamadı:', error);
            setFormData((previous) => ({
                ...previous,
                record_no: `PM${Date.now().toString().slice(-8)}`,
            }));
        } finally {
            setGeneratingRecordNo(false);
        }
    }, []);

    const loadPartContext = useCallback(
        async (partCode, fallbackPartName = '') => {
            const trimmedPartCode = partCode?.trim();
            const requestId = partContextRequestRef.current + 1;

            partContextRequestRef.current = requestId;

            setWarnings({ inkr: null, plan: null });
            setControlPlan(null);
            setInkrReport(null);

            if (!trimmedPartCode) {
                setMeasurementSummary([]);
                setResults([]);
                setExistingResultRows((previous) => previous);
                return;
            }

            setIsLoadingContext(true);

            try {
                const [planResponse, inkrResponse] = await Promise.all([
                    supabase
                        .from('process_control_plans')
                        .select('*')
                        .eq('part_code', trimmedPartCode)
                        .order('revision_number', { ascending: false })
                        .limit(1)
                        .maybeSingle(),
                    supabase
                        .from('process_inkr_reports')
                        .select('*')
                        .eq('part_code', trimmedPartCode)
                        .order('report_date', { ascending: false })
                        .order('updated_at', { ascending: false })
                        .limit(1)
                        .maybeSingle(),
                ]);

                if (planResponse.error) throw planResponse.error;
                if (inkrResponse.error) throw inkrResponse.error;

                if (requestId !== partContextRequestRef.current) return;

                setControlPlan(planResponse.data || null);
                setInkrReport(inkrResponse.data || null);
                setFormData((previous) => ({
                    ...previous,
                    part_code: trimmedPartCode,
                    part_name: planResponse.data?.part_name || fallbackPartName || previous.part_name,
                }));

                if (!planResponse.data) {
                    setWarnings((previous) => ({
                        ...previous,
                        plan: 'Bu parça için aktif bir proses kontrol planı bulunamadı.',
                    }));
                }

                if (!inkrResponse.data) {
                    setWarnings((previous) => ({
                        ...previous,
                        inkr: 'Bu parça için proses INKR kaydı bulunamadı. Ölçüm öncesi ilk numune kontrolünü kontrol edin.',
                    }));
                }
            } catch (error) {
                if (requestId !== partContextRequestRef.current) return;
                toast({
                    variant: 'destructive',
                    title: 'Hata',
                    description: `Parça bilgileri alınamadı: ${error.message}`,
                });
            } finally {
                if (requestId === partContextRequestRef.current) {
                    setIsLoadingContext(false);
                }
            }
        },
        [toast]
    );

    useEffect(() => {
        if (!isOpen) return undefined;

        let isActive = true;

        const initializeModal = async () => {
            resetForm();

            if (existingInspection) {
                if (!isActive) return;

                setFormData({
                    record_no: existingInspection.record_no || '',
                    inspection_date: existingInspection.inspection_date
                        ? new Date(existingInspection.inspection_date).toISOString().split('T')[0]
                        : new Date().toISOString().split('T')[0],
                    part_name: existingInspection.part_name || '',
                    part_code: existingInspection.part_code || '',
                    quantity_produced: Number(existingInspection.quantity_produced) || 0,
                    quantity_rejected: Number(existingInspection.quantity_rejected) || 0,
                    quantity_conditional: Number(existingInspection.quantity_conditional) || 0,
                    operator_name: existingInspection.operator_name || '',
                    decision: existingInspection.decision || 'Beklemede',
                    notes: existingInspection.notes || '',
                });

                const [resultsResponse, defectsResponse, attachmentsResponse] = await Promise.all([
                    supabase
                        .from('process_inspection_results')
                        .select('*')
                        .eq('inspection_id', existingInspection.id),
                    supabase
                        .from('process_inspection_defects')
                        .select('*')
                        .eq('inspection_id', existingInspection.id),
                    supabase
                        .from('process_inspection_attachments')
                        .select('*')
                        .eq('inspection_id', existingInspection.id),
                ]);

                if (!isActive) return;

                if (resultsResponse.error) throw resultsResponse.error;
                if (defectsResponse.error) throw defectsResponse.error;
                if (attachmentsResponse.error) throw attachmentsResponse.error;

                setExistingResultRows(resultsResponse.data || []);
                setDefects(defectsResponse.data || []);
                setExistingAttachments(attachmentsResponse.data || []);
                resultsSeedRef.current = resultsResponse.data || [];

                if (existingInspection.part_code) {
                    await loadPartContext(existingInspection.part_code, existingInspection.part_name || '');
                }
            } else {
                await generateRecordNo();
            }
        };

        initializeModal().catch((error) => {
            console.error('Proses muayene modalı başlatılamadı:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: `Muayene kaydı yüklenemedi: ${error.message}`,
            });
        });

        return () => {
            isActive = false;
        };
    }, [existingInspection, generateRecordNo, isOpen, loadPartContext, resetForm, toast]);

    useEffect(() => {
        const quantityProduced = Number(formData.quantity_produced) || 0;
        const seedRows = resultsSeedRef.current.length ? resultsSeedRef.current : existingResultRows;
        const { summary, results: nextResults } = buildMeasurementBundle({
            controlPlan,
            quantityProduced,
            characteristics,
            equipment,
            existingRows: seedRows,
        });

        setMeasurementSummary(summary);
        setResults(nextResults);
        resultsSeedRef.current = nextResults;
    }, [characteristics, controlPlan, equipment, existingResultRows, formData.quantity_produced]);

    useEffect(() => {
        const nextDecision = deriveInspectionDecision({
            quantityProduced: formData.quantity_produced,
            quantityRejected: formData.quantity_rejected,
            quantityConditional: formData.quantity_conditional,
            results,
        });

        setFormData((previous) => ({
            ...previous,
            decision: nextDecision,
        }));
    }, [formData.quantity_conditional, formData.quantity_produced, formData.quantity_rejected, results]);

    const handleInputChange = (event) => {
        const { name, value, type } = event.target;
        const normalizedValue = type === 'number' ? (value === '' ? 0 : Number(value)) : value;

        setFormData((previous) => ({
            ...previous,
            [name]: normalizedValue,
        }));
    };

    const handlePartCodeChange = async (value) => {
        resultsSeedRef.current = [];
        setResults([]);
        setMeasurementSummary([]);
        setExistingResultRows([]);
        setFormData((previous) => ({
            ...previous,
            part_code: value,
            part_name: existingInspection ? previous.part_name : '',
        }));

        await loadPartContext(value, existingInspection?.part_name || '');
    };

    const handleResultChange = (index, measuredValue, resultStatus) => {
        setResults((previous) =>
            previous.map((row, rowIndex) =>
                rowIndex === index
                    ? {
                          ...row,
                          measured_value: measuredValue,
                          result: resultStatus,
                      }
                    : row
            )
        );
    };

    const handleDefectChange = (index, field, value) => {
        setDefects((previous) =>
            previous.map((defect, defectIndex) =>
                defectIndex === index
                    ? {
                          ...defect,
                          [field]: field === 'defect_count' ? value : value,
                      }
                    : defect
            )
        );
    };

    const addDefect = () => {
        setDefects((previous) => [
            ...previous,
            { id: uuidv4(), defect_type: '', description: '', defect_count: 1 },
        ]);
    };

    const removeDefect = (index) => {
        setDefects((previous) => previous.filter((_, itemIndex) => itemIndex !== index));
    };

    const onDrop = useCallback((acceptedFiles) => {
        setNewAttachments((previous) => [...previous, ...acceptedFiles]);
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        disabled: isViewMode,
    });

    const removeNewAttachment = (index) => {
        setNewAttachments((previous) => previous.filter((_, fileIndex) => fileIndex !== index));
    };

    const removeExistingAttachment = async (attachmentId, filePath) => {
        try {
            const { error: storageError } = await supabase.storage
                .from('process_inspections')
                .remove([filePath]);

            if (storageError) throw storageError;

            const { error } = await supabase
                .from('process_inspection_attachments')
                .delete()
                .eq('id', attachmentId);

            if (error) throw error;

            setExistingAttachments((previous) =>
                previous.filter((attachment) => attachment.id !== attachmentId)
            );
            toast({ title: 'Başarılı', description: 'Ek dosya kaldırıldı.' });
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: `Ek dosya silinemedi: ${error.message}`,
            });
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (isViewMode) return;

        if (hasQuantityMismatch) {
            toast({
                variant: 'destructive',
                title: 'Miktar Uyuşmazlığı',
                description: 'Ret ve şartlı kabul toplamı, üretilen miktarı geçemez.',
            });
            return;
        }

        if (!formData.part_code?.trim()) {
            toast({
                variant: 'destructive',
                title: 'Eksik Bilgi',
                description: 'Parça kodu zorunludur.',
            });
            return;
        }

        setIsSubmitting(true);

        try {
            const derivedDecision = deriveInspectionDecision({
                quantityProduced: formData.quantity_produced,
                quantityRejected: formData.quantity_rejected,
                quantityConditional: formData.quantity_conditional,
                results,
            });

            const payload = {
                record_no: formData.record_no || null,
                inspection_date: formData.inspection_date,
                part_name: formData.part_name || formData.part_code,
                part_code: formData.part_code?.trim() || null,
                quantity_produced: Number(formData.quantity_produced) || 0,
                quantity_rejected: Number(formData.quantity_rejected) || 0,
                quantity_conditional: Number(formData.quantity_conditional) || 0,
                operator_name: formData.operator_name || null,
                production_line: null,
                shift: null,
                decision: derivedDecision,
                notes: formData.notes || null,
            };

            let inspectionId = existingInspection?.id;

            if (existingInspection) {
                const { error } = await supabase
                    .from('process_inspections')
                    .update({
                        ...payload,
                        updated_at: new Date().toISOString(),
                        updated_by: user?.id || null,
                    })
                    .eq('id', existingInspection.id);

                if (error) throw error;
            } else {
                const { data, error } = await supabase
                    .from('process_inspections')
                    .insert([
                        {
                            ...payload,
                            created_by: user?.id || null,
                            updated_by: user?.id || null,
                        },
                    ])
                    .select()
                    .single();

                if (error) throw error;
                inspectionId = data.id;
            }

            await supabase.from('process_inspection_results').delete().eq('inspection_id', inspectionId);

            const resultsToInsert = results.map((row) => ({
                inspection_id: inspectionId,
                characteristic_id: row.characteristic_id,
                measurement_value: String(row.measured_value ?? ''),
                is_ok: row.result,
                notes: '',
                created_by: user?.id || null,
            }));

            if (resultsToInsert.length) {
                const { error } = await supabase
                    .from('process_inspection_results')
                    .insert(resultsToInsert);

                if (error) throw error;
            }

            await supabase.from('process_inspection_defects').delete().eq('inspection_id', inspectionId);

            const validDefects = defects.filter(
                (defect) => defect.defect_type || defect.description || Number(defect.defect_count) > 0
            );

            if (validDefects.length) {
                const defectsToInsert = validDefects.map((defect) => ({
                    inspection_id: inspectionId,
                    defect_type: defect.defect_type || '',
                    description: defect.description || '',
                    defect_count: Number(defect.defect_count) || 1,
                    created_by: user?.id || null,
                }));

                const { error } = await supabase
                    .from('process_inspection_defects')
                    .insert(defectsToInsert);

                if (error) throw error;
            }

            if (newAttachments.length) {
                const uploadedAttachments = await Promise.all(
                    newAttachments.map(async (file) => {
                        const filePath = `process_inspections/${inspectionId}/${uuidv4()}-${sanitizeFileName(file.name)}`;

                        const { error: uploadError } = await supabase.storage
                            .from('process_inspections')
                            .upload(filePath, file);

                        if (uploadError) throw uploadError;

                        return {
                            inspection_id: inspectionId,
                            file_name: file.name,
                            file_path: filePath,
                            file_type: file.type,
                            file_size: file.size,
                            created_by: user?.id || null,
                        };
                    })
                );

                const { error } = await supabase
                    .from('process_inspection_attachments')
                    .insert(uploadedAttachments);

                if (error) throw error;
            }

            let nonconformitySyncWarning = null;
            try {
                await syncProcessInspectionNonconformity({
                    supabase,
                    inspection: {
                        id: inspectionId,
                        ...payload,
                    },
                    results,
                    userId: user?.id || null,
                });
            } catch (syncError) {
                console.error('Proses muayene uygunsuzluk senkronu başarısız:', syncError);
                nonconformitySyncWarning = syncError.message;
            }

            toast({
                title: 'Başarılı',
                description: nonconformitySyncWarning
                    ? `Proses muayene kaydı ${
                          existingInspection ? 'güncellendi' : 'oluşturuldu'
                      }, ancak otomatik uygunsuzluk senkronu tamamlanamadı: ${nonconformitySyncWarning}`
                    : `Proses muayene kaydı başarıyla ${
                          existingInspection ? 'güncellendi' : 'oluşturuldu'
                      }.`,
            });

            refreshData();
            handleOpenChange(false);
        } catch (error) {
            console.error('Proses muayene kaydı kaydedilemedi:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: `İşlem tamamlanamadı: ${error.message}`,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const summaryDate = formData.inspection_date
        ? format(new Date(formData.inspection_date), 'dd.MM.yyyy')
        : '-';

    const handleOpenChange = (open) => {
        setIsOpen(open);
        if (!open) {
            setTimeout(resetForm, 200);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
                <DialogHeader className="sr-only">
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>

                <header className="bg-gradient-to-r from-primary to-blue-700 px-6 py-5 text-white shrink-0">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="rounded-xl bg-white/20 p-2.5">
                                <ClipboardCheck className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <h1 className="text-lg font-bold tracking-tight">{title}</h1>
                                <p className="text-[11px] text-blue-100 uppercase tracking-[0.15em] font-medium">
                                    Proses Kontrol Muayenesi
                                </p>
                            </div>
                            <span className="rounded-full border border-white/30 bg-white/20 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white/90">
                                {badgeLabel}
                            </span>
                        </div>
                        <div className="hidden sm:flex items-center gap-2 text-sm text-blue-100">
                            <Hash className="h-4 w-4" />
                            <span>{formData.record_no || (generatingRecordNo ? 'Oluşturuluyor...' : '-')}</span>
                        </div>
                    </div>
                </header>

                <div className="flex flex-1 min-h-0 overflow-hidden">
                    <form
                        id="process-inspection-form"
                        onSubmit={handleSubmit}
                        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
                    >
                        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden border-r border-border px-6 py-4">
                            <div className="space-y-6">
                                <div className="space-y-3">
                                    {warnings.plan && (
                                        <Alert variant="warning">
                                            <AlertTriangle className="h-4 w-4" />
                                            <AlertTitle>Kontrol Planı Bulunamadı</AlertTitle>
                                            <AlertDescription>{warnings.plan}</AlertDescription>
                                        </Alert>
                                    )}

                                    {warnings.inkr && (
                                        <Alert variant="warning">
                                            <ShieldAlert className="h-4 w-4" />
                                            <AlertTitle>INKR Uyarısı</AlertTitle>
                                            <AlertDescription>{warnings.inkr}</AlertDescription>
                                        </Alert>
                                    )}

                                    {hasReferenceSuccess && (
                                        <Alert className="border-green-200 bg-green-50 text-green-700 dark:border-green-900/40 dark:bg-green-900/10 dark:text-green-300">
                                            <CheckCircle2 className="h-4 w-4" />
                                            <AlertTitle>Referanslar Hazır</AlertTitle>
                                            <AlertDescription>
                                                Bu parça için revizyonlu proses kontrol planı ve INKR kaydı bulundu.
                                                Ölçüm girişine devam edebilirsiniz.
                                            </AlertDescription>
                                        </Alert>
                                    )}

                                    {isLoadingContext && (
                                        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                                            Parça referansları ve kontrol planı yükleniyor...
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                                    <div>
                                        <Label htmlFor="inspection_date">Kontrol Tarihi</Label>
                                        <Input
                                            id="inspection_date"
                                            name="inspection_date"
                                            type="date"
                                            value={formData.inspection_date}
                                            onChange={handleInputChange}
                                            required
                                            disabled={isViewMode}
                                        />
                                    </div>

                                    <div>
                                        <Label htmlFor="record_no">Kayıt No</Label>
                                        <Input
                                            id="record_no"
                                            name="record_no"
                                            value={formData.record_no}
                                            disabled
                                            placeholder={generatingRecordNo ? 'Oluşturuluyor...' : ''}
                                            className="bg-muted/40 font-mono"
                                        />
                                    </div>

                                    <div>
                                        <Label htmlFor="part_code">
                                            Parça Kodu <span className="text-destructive">*</span>
                                        </Label>
                                        <Input
                                            id="part_code"
                                            name="part_code"
                                            value={formData.part_code}
                                            onChange={(event) => handlePartCodeChange(event.target.value)}
                                            placeholder="Parça kodu girin"
                                            disabled={isViewMode || !!existingInspection}
                                            required
                                        />
                                    </div>

                                    <div className="lg:col-span-2">
                                        <Label htmlFor="part_name">Parça Adı</Label>
                                        <Input
                                            id="part_name"
                                            name="part_name"
                                            value={formData.part_name}
                                            onChange={handleInputChange}
                                            placeholder="Parça adı"
                                            disabled={isViewMode}
                                        />
                                    </div>

                                    <div>
                                        <Label htmlFor="operator_name">Operatör</Label>
                                        <Input
                                            id="operator_name"
                                            name="operator_name"
                                            value={formData.operator_name}
                                            onChange={handleInputChange}
                                            placeholder="Operatör adı"
                                            disabled={isViewMode}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between border-b pb-2">
                                        <div>
                                            <h3 className="text-lg font-semibold">Miktar Dağılımı ve Karar</h3>
                                            <p className="text-sm text-muted-foreground">
                                                Üretilen, kabul edilen ve problemli miktarları birlikte yönetin.
                                            </p>
                                        </div>
                                        <Badge
                                            variant={
                                                formData.decision === 'Kabul'
                                                    ? 'success'
                                                    : formData.decision === 'Ret'
                                                      ? 'destructive'
                                                      : formData.decision === 'Şartlı Kabul'
                                                        ? 'warning'
                                                        : 'secondary'
                                            }
                                        >
                                            {formData.decision}
                                        </Badge>
                                    </div>

                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                                        <div className="rounded-xl border bg-card p-4 shadow-sm">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                                        Üretilen
                                                    </p>
                                                    <Input
                                                        id="quantity_produced"
                                                        name="quantity_produced"
                                                        type="number"
                                                        min="0"
                                                        value={formData.quantity_produced}
                                                        onChange={handleInputChange}
                                                        disabled={isViewMode}
                                                        className="mt-3 text-lg font-semibold"
                                                    />
                                                </div>
                                                <Gauge className="h-5 w-5 text-primary" />
                                            </div>
                                        </div>

                                        <div className="rounded-xl border bg-card p-4 shadow-sm">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                                        Kabul Edilen
                                                    </p>
                                                    <div className="mt-3 text-3xl font-bold text-green-600">
                                                        {acceptedQuantity}
                                                    </div>
                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                        Otomatik hesaplanır
                                                    </p>
                                                </div>
                                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                                            </div>
                                        </div>

                                        <div className="rounded-xl border bg-card p-4 shadow-sm">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                                        Ret
                                                    </p>
                                                    <Input
                                                        id="quantity_rejected"
                                                        name="quantity_rejected"
                                                        type="number"
                                                        min="0"
                                                        value={formData.quantity_rejected}
                                                        onChange={handleInputChange}
                                                        disabled={isViewMode}
                                                        className="mt-3 text-lg font-semibold"
                                                    />
                                                </div>
                                                <AlertCircle className="h-5 w-5 text-red-500" />
                                            </div>
                                        </div>

                                        <div className="rounded-xl border bg-card p-4 shadow-sm">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                                            Şartlı Kabul
                                                        </p>
                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <HelpCircle className="h-4 w-4 cursor-help text-muted-foreground" />
                                                                </TooltipTrigger>
                                                                <TooltipContent>
                                                                    <p>Karar, miktar girişlerine göre otomatik hesaplanır.</p>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    </div>
                                                    <Input
                                                        id="quantity_conditional"
                                                        name="quantity_conditional"
                                                        type="number"
                                                        min="0"
                                                        value={formData.quantity_conditional}
                                                        onChange={handleInputChange}
                                                        disabled={isViewMode}
                                                        className="mt-3 text-lg font-semibold"
                                                    />
                                                </div>
                                                <AlertTriangle className="h-5 w-5 text-amber-500" />
                                            </div>
                                        </div>
                                    </div>

                                    {hasQuantityMismatch && (
                                        <Alert variant="destructive">
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertTitle>Miktar Uyuşmazlığı</AlertTitle>
                                            <AlertDescription>
                                                Ret ve şartlı kabul toplamı, üretilen miktarı geçiyor. Lütfen miktarları
                                                kontrol edin.
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between border-b pb-2">
                                        <div>
                                            <h3 className="text-lg font-semibold">Ölçüm Planı ve Sonuçlar</h3>
                                            <p className="text-sm text-muted-foreground">
                                                Kontrol planından oluşan ölçüm satırlarını bu alandan yönetin.
                                            </p>
                                        </div>
                                        <Badge variant="outline">{results.length} satır</Badge>
                                    </div>

                                    {measurementSummary.length > 0 && (
                                        <div className="rounded-xl border bg-muted/40 p-4">
                                            <p className="mb-3 text-sm font-semibold text-foreground">
                                                Bu kayıt için toplam {results.length} ölçüm satırı oluşturuldu:
                                            </p>
                                            <div className="space-y-2 text-sm">
                                                {measurementSummary.map((item, index) => (
                                                    <div
                                                        key={`${item.name}-${index}`}
                                                        className="flex flex-col gap-1 rounded-lg border border-border/60 bg-background px-3 py-2"
                                                    >
                                                        <div className="flex items-center justify-between gap-3">
                                                            <span className="font-medium">{item.name}</span>
                                                            <Badge variant="secondary">{item.count} ölçüm</Badge>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">
                                                            {item.type} | Yöntem: {item.method} | Nominal: {item.nominal || '-'} |
                                                            Tolerans: {item.tolerance}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {results.length > 0 ? (
                                        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
                                            <div className="overflow-x-auto lg:overflow-x-visible">
                                                <table className="w-full table-fixed text-sm">
                                                    <thead className="bg-muted/70 text-xs uppercase tracking-wide text-muted-foreground">
                                                        <tr>
                                                            <th className="w-[24%] p-3 text-left font-semibold">Karakteristik</th>
                                                            <th className="w-[16%] p-3 text-left font-semibold">Ölçüm Aracı</th>
                                                            <th className="w-[8%] p-3 text-center font-semibold">No</th>
                                                            <th className="w-[10%] p-3 text-center font-semibold">Nominal</th>
                                                            <th className="w-[10%] p-3 text-center font-semibold">Min</th>
                                                            <th className="w-[10%] p-3 text-center font-semibold">Max</th>
                                                            <th className="w-[14%] p-3 text-left font-semibold">Ölçülen</th>
                                                            <th className="w-[8%] p-3 text-center font-semibold">Sonuç</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {results.map((item, index) => (
                                                            <InspectionResultRow
                                                                key={item.id || `${item.characteristic_id}-${index}`}
                                                                item={item}
                                                                index={index}
                                                                onResultChange={handleResultChange}
                                                                isViewMode={isViewMode}
                                                            />
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="rounded-xl border border-dashed bg-muted/10 px-4 py-10 text-center text-sm text-muted-foreground">
                                            Ölçüm satırları için parça kodu ve üretilen miktar bilgisi girin.
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between border-b pb-2">
                                        <div>
                                            <h3 className="text-lg font-semibold">Tespit Edilen Hatalar</h3>
                                            <p className="text-sm text-muted-foreground">
                                                Muayene sırasında bulunan hata tiplerini ve adetlerini kaydedin.
                                            </p>
                                        </div>
                                        {!isViewMode && (
                                            <Button type="button" variant="outline" onClick={addDefect}>
                                                <Plus className="mr-2 h-4 w-4" />
                                                Hata Ekle
                                            </Button>
                                        )}
                                    </div>

                                    {defects.length > 0 ? (
                                        <div className="space-y-3">
                                            {defects.map((defect, index) => (
                                                <div
                                                    key={defect.id || index}
                                                    className="grid gap-3 rounded-xl border border-red-100 bg-red-50/60 p-4 dark:border-red-900/30 dark:bg-red-950/10 md:grid-cols-[1.2fr_1.5fr_120px_44px]"
                                                >
                                                    <div>
                                                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                                                            Hata Tipi
                                                        </Label>
                                                        <Input
                                                            value={defect.defect_type || ''}
                                                            onChange={(event) =>
                                                                handleDefectChange(index, 'defect_type', event.target.value)
                                                            }
                                                            placeholder="Örn: Ölçü Dışı, Kaynak Hatası"
                                                            disabled={isViewMode}
                                                            className="mt-2 bg-background"
                                                        />
                                                    </div>

                                                    <div>
                                                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                                                            Açıklama
                                                        </Label>
                                                        <Input
                                                            value={defect.description || ''}
                                                            onChange={(event) =>
                                                                handleDefectChange(index, 'description', event.target.value)
                                                            }
                                                            placeholder="Opsiyonel açıklama"
                                                            disabled={isViewMode}
                                                            className="mt-2 bg-background"
                                                        />
                                                    </div>

                                                    <div>
                                                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                                                            Adet
                                                        </Label>
                                                        <Input
                                                            type="number"
                                                            min="1"
                                                            value={defect.defect_count ?? 1}
                                                            onChange={(event) =>
                                                                handleDefectChange(index, 'defect_count', event.target.value)
                                                            }
                                                            disabled={isViewMode}
                                                            className="mt-2 bg-background"
                                                        />
                                                    </div>

                                                    {!isViewMode && (
                                                        <div className="flex items-end">
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => removeDefect(index)}
                                                                className="text-destructive"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="rounded-xl border border-dashed bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
                                            Henüz hata eklenmedi.
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <div className="border-b pb-2">
                                        <h3 className="text-lg font-semibold">Açıklamalar</h3>
                                        <p className="text-sm text-muted-foreground">
                                            Operasyon veya muayene ile ilgili ek notlarınızı buraya yazın.
                                        </p>
                                    </div>
                                    <Textarea
                                        id="notes"
                                        name="notes"
                                        value={formData.notes}
                                        onChange={handleInputChange}
                                        placeholder="Ek açıklamalar, gözlemler veya operasyona özel notlar..."
                                        disabled={isViewMode}
                                        className="min-h-[120px]"
                                    />
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between border-b pb-2">
                                        <div>
                                            <h3 className="text-lg font-semibold">Ekler ve Fotoğraflar</h3>
                                            <p className="text-sm text-muted-foreground">
                                                Muayene fotoğrafları ve destekleyici dosyaları ekleyin.
                                            </p>
                                        </div>
                                        <Badge variant="outline">
                                            {existingAttachments.length + newAttachments.length} dosya
                                        </Badge>
                                    </div>

                                    {!isViewMode && (
                                        <div
                                            {...getRootProps()}
                                            className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                                                isDragActive
                                                    ? 'border-primary bg-primary/10'
                                                    : 'border-input hover:border-primary/50 hover:bg-muted/30'
                                            }`}
                                        >
                                            <input {...getInputProps()} />
                                            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                                                <Paperclip className="h-5 w-5 text-primary" />
                                            </div>
                                            <p className="text-sm font-medium">
                                                Dosyaları buraya sürükleyin veya seçmek için tıklayın.
                                            </p>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                Fotoğraf, PDF veya ilgili belge yükleyebilirsiniz.
                                            </p>
                                        </div>
                                    )}

                                    {existingAttachments.length > 0 || newAttachments.length > 0 ? (
                                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                            {existingAttachments.map((attachment) => {
                                                const publicUrl = supabase.storage
                                                    .from('process_inspections')
                                                    .getPublicUrl(attachment.file_path).data.publicUrl;

                                                return (
                                                    <div
                                                        key={attachment.id}
                                                        className="rounded-xl border bg-card p-3 shadow-sm"
                                                    >
                                                        <div className="flex items-start justify-between gap-3">
                                                            <a
                                                                href={publicUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="min-w-0 flex-1 text-sm font-medium text-primary hover:underline"
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <FileText className="h-4 w-4 shrink-0" />
                                                                    <span className="truncate">{attachment.file_name}</span>
                                                                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                                                                </div>
                                                            </a>
                                                            {!isViewMode && (
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() =>
                                                                        removeExistingAttachment(
                                                                            attachment.id,
                                                                            attachment.file_path
                                                                        )
                                                                    }
                                                                    className="h-8 w-8 text-destructive"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}

                                            {newAttachments.map((file, index) => (
                                                <div key={`${file.name}-${index}`} className="rounded-xl border bg-primary/5 p-3 shadow-sm">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-2 text-sm font-medium">
                                                                <FileText className="h-4 w-4 shrink-0 text-primary" />
                                                                <span className="truncate">{file.name}</span>
                                                            </div>
                                                            <p className="mt-1 text-xs text-muted-foreground">
                                                                Yeni eklendi
                                                            </p>
                                                        </div>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => removeNewAttachment(index)}
                                                            className="h-8 w-8 text-destructive"
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="rounded-xl border border-dashed bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
                                            Henüz ek dosya bulunmuyor.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </form>

                    <aside className="w-[320px] min-w-[280px] shrink-0 min-h-0 overflow-y-auto bg-muted/30 px-6 py-4">
                        <h3 className="mb-3 text-sm font-semibold text-foreground">Özet</h3>
                        <div className="space-y-3">
                            <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
                                <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                                    Parça
                                </p>
                                <p className="truncate font-bold text-foreground">
                                    {formData.part_name || formData.part_code || '-'}
                                </p>
                                {formData.part_code && (
                                    <p className="mt-0.5 text-xs text-muted-foreground">{formData.part_code}</p>
                                )}
                            </div>

                            <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
                                <div className="space-y-2 text-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="flex items-center gap-2 text-muted-foreground">
                                            <Hash className="h-4 w-4" />
                                            Kayıt
                                        </span>
                                        <span className="font-semibold">{formData.record_no || '-'}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="flex items-center gap-2 text-muted-foreground">
                                            <User className="h-4 w-4" />
                                            Operatör
                                        </span>
                                        <span className="font-semibold">{formData.operator_name || '-'}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="flex items-center gap-2 text-muted-foreground">
                                            <FileText className="h-4 w-4" />
                                            Tarih
                                        </span>
                                        <span className="font-semibold">{summaryDate}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
                                <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                                    Karar Özeti
                                </p>
                                <div className="space-y-2 text-sm">
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Üretilen</span>
                                        <span className="font-semibold">{formData.quantity_produced || 0}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Kabul</span>
                                        <span className="font-semibold text-green-600">{acceptedQuantity}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Ret</span>
                                        <span className="font-semibold text-red-600">
                                            {formData.quantity_rejected || 0}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Şartlı</span>
                                        <span className="font-semibold text-amber-600">
                                            {formData.quantity_conditional || 0}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between border-t pt-2">
                                        <span className="text-muted-foreground">Karar</span>
                                        <Badge
                                            variant={
                                                formData.decision === 'Kabul'
                                                    ? 'success'
                                                    : formData.decision === 'Ret'
                                                      ? 'destructive'
                                                      : formData.decision === 'Şartlı Kabul'
                                                        ? 'warning'
                                                        : 'secondary'
                                            }
                                        >
                                            {formData.decision}
                                        </Badge>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
                                <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                                    Muayene Kapsamı
                                </p>
                                <div className="space-y-2 text-sm">
                                    <div className="flex items-center justify-between">
                                        <span className="flex items-center gap-2 text-muted-foreground">
                                            <Ruler className="h-4 w-4" />
                                            Ölçüm Satırı
                                        </span>
                                        <span className="font-semibold">{results.length}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="flex items-center gap-2 text-muted-foreground">
                                            <AlertTriangle className="h-4 w-4" />
                                            Hata Kaydı
                                        </span>
                                        <span className="font-semibold">{defects.length}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="flex items-center gap-2 text-muted-foreground">
                                            <Paperclip className="h-4 w-4" />
                                            Ek Dosya
                                        </span>
                                        <span className="font-semibold">
                                            {existingAttachments.length + newAttachments.length}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Kontrol Planı</span>
                                        <Badge variant={controlPlan ? 'success' : 'secondary'}>
                                            {controlPlan ? 'Mevcut' : 'Yok'}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">INKR</span>
                                        <Badge variant={inkrReport ? 'success' : 'secondary'}>
                                            {inkrReport ? getProcessInkrDisplayNumber(inkrReport) : 'Yok'}
                                        </Badge>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </aside>
                </div>

                <footer className="flex shrink-0 justify-end gap-2 border-t border-border bg-muted/20 px-6 py-4">
                    <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                        {isViewMode ? 'Kapat' : 'İptal'}
                    </Button>
                    {!isViewMode && (
                        <Button form="process-inspection-form" type="submit" disabled={isSubmitting || generatingRecordNo}>
                            {isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
                        </Button>
                    )}
                </footer>
            </DialogContent>
        </Dialog>
    );
};

export default ProcessInspectionFormModal;
