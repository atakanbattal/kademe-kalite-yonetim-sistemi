import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, GitPullRequestArrow, Lightbulb } from 'lucide-react';

import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import NCFormModal from '@/components/df-8d/NCFormModal';
import {
    getAssignedPersonName,
    getCustomerDisplayName,
    getFaultPartSummaryLabel,
    getPrimaryFaultPart,
    getVehicleDisplayLabel,
    recommendWorkflowForComplaint,
} from '@/components/customer-complaints/afterSalesConfig';

const METHOD_OPTIONS = {
    DF: {
        title: 'DF',
        subtitle: 'Uygunsuzluk ve sistemsel hata',
        description: 'Standart düzeltici faaliyet ile yönetilebilecek, daha kısa çevrimli problemler için uygundur.',
    },
    MDI: {
        title: 'MDI',
        subtitle: 'Araç / müşteri bazlı mühendislik değişikliği',
        description: 'Araç bazlı hata, sahadaki müşteri problemi ve tasarım değişikliği gerektiren konular için uygundur.',
    },
    '8D': {
        title: '8D',
        subtitle: 'Büyük ve disiplinler arası problem',
        description: 'Tekrarlayan, kritik veya yüksek maliyetli konularda detaylı takım çalışması gerektirir.',
    },
};

const NONCONFORMITY_ALLOWED_COLUMNS = new Set([
    'nc_number',
    'audit_title',
    'title',
    'description',
    'category',
    'department',
    'requesting_person',
    'requesting_unit',
    'responsible_person',
    'status',
    'type',
    'opening_date',
    'due_date',
    'closed_at',
    'rejected_at',
    'rejection_reason',
    'rejection_notes',
    'related_vehicle_id',
    'source_cost_id',
    'source_finding_id',
    'source_inspection_id',
    'source_quarantine_id',
    'source_supplier_nc_id',
    'source_inspection_fault_id',
    'source_complaint_id',
    'audit_id',
    'created_by',
    'updated_by',
    'priority',
    'problem_definition',
    'closing_notes',
    'closing_attachments',
    'eight_d_steps',
    'mdi_no',
    'attachments',
    'part_name',
    'part_code',
    'production_batch',
    'vehicle_type',
    'affected_units',
    'amount',
    'cost_date',
    'cost_type',
    'material_type',
    'measurement_unit',
    'part_location',
    'quantity',
    'scrap_weight',
    'rework_duration',
    'quality_control_duration',
    'responsible_personnel_id',
    'chassis_no',
    'supplier_id',
    'shipment_impact',
    'df_opened_at',
    'status_entered_at',
    'due_at',
    'reopened_at',
    'forwarded_to',
    'forwarded_to_personnel_id',
    'forwarded_unit',
    'eight_d_progress',
    'five_why_analysis',
    'five_n1k_analysis',
    'ishikawa_analysis',
    'fta_analysis',
]);

const NONCONFORMITY_ALLOWED_STATUSES = new Set(['Açık', 'İşlemde', 'Kapatıldı', 'Reddedildi']);

const normalizeNCStatus = (status) =>
    NONCONFORMITY_ALLOWED_STATUSES.has(status) ? status : 'Açık';

const getMissingColumnName = (error) => {
    const message = error?.message || '';
    const schemaCacheMatch = message.match(/Could not find the '([^']+)' column/);
    if (schemaCacheMatch?.[1]) return schemaCacheMatch[1];
    const relationMatch = message.match(/column \"([^\"]+)\"/i);
    if (relationMatch?.[1]) return relationMatch[1];
    return null;
};

const CreateNCFromComplaintModal = ({ open, setOpen, complaint, onSuccess, preferredType }) => {
    const { toast } = useToast();
    const workflowRecommendation = useMemo(
        () => recommendWorkflowForComplaint(complaint || {}),
        [complaint]
    );

    const [selectedType, setSelectedType] = useState(preferredType || workflowRecommendation.type || 'MDI');
    const [isNCModalOpen, setNCModalOpen] = useState(false);
    const [preparedData, setPreparedData] = useState(null);

    useEffect(() => {
        if (open) {
            setSelectedType(preferredType || workflowRecommendation.type || 'MDI');
        }
    }, [open, preferredType, workflowRecommendation.type]);

    useEffect(() => {
        if (!open || !complaint) return;

        const customerName = getCustomerDisplayName(complaint.customer);
        const vehicleLabel = getVehicleDisplayLabel(complaint);
        const complaintNumber = complaint.complaint_number || complaint.id?.slice(0, 8) || 'N/A';
        const primaryFaultPart = getPrimaryFaultPart(complaint);
        const faultPartSummary = getFaultPartSummaryLabel(complaint);
        const assignedPersonName = getAssignedPersonName(complaint);
        const responsibleDepartment =
            complaint.responsible_department?.unit_name ||
            complaint.responsible_department?.name ||
            complaint.department ||
            complaint.requesting_unit ||
            '';

        setPreparedData({
            type: selectedType,
            title: `Satış Sonrası Vaka: ${complaint.title || 'Başlıksız'}`,
            description: [
                complaint.description || '',
                '',
                `Müşteri: ${customerName}`,
                `Vaka No: ${complaintNumber}`,
                `Araç: ${vehicleLabel}`,
                `Seri No: ${complaint.vehicle_serial_number || '-'}`,
                `Şasi No: ${complaint.vehicle_chassis_number || '-'}`,
                `Arızalı Parça(lar): ${faultPartSummary}`,
                `Önerilen Yöntem: ${workflowRecommendation.type}`,
                `Gerekçe: ${workflowRecommendation.reason}`,
            ].join('\n'),
            nc_type: 'Müşteri Şikayeti',
            source: 'Müşteri Şikayeti',
            detection_date: new Date().toISOString().split('T')[0],
            status: 'Açık',
            severity: complaint.severity || 'Orta',
            priority: complaint.priority || 'Orta',
            ...(responsibleDepartment ? { department: responsibleDepartment } : {}),
            ...(assignedPersonName !== '-' ? { responsible_person: assignedPersonName } : {}),
            ...(complaint.created_by_name || complaint.created_by?.full_name
                ? { requesting_person: complaint.created_by_name || complaint.created_by?.full_name }
                : {}),
            requesting_unit: complaint.service_partner_name || complaint.case_type || 'Satış Sonrası Hizmetler',
            product_code: primaryFaultPart.part_code || '',
            product_name: primaryFaultPart.part_name || '',
            part_code: primaryFaultPart.part_code || '',
            part_name: primaryFaultPart.part_name || '',
            batch_number: complaint.batch_number || '',
            quantity_affected: complaint.quantity_affected || null,
            responsible_department_id: complaint.responsible_department_id || null,
            responsible_person_id: complaint.responsible_personnel_id || null,
            assigned_to_id: complaint.assigned_to_id || null,
            vehicle_type: vehicleLabel !== '-' ? vehicleLabel : '',
            chassis_no: complaint.vehicle_chassis_number || '',
            source_complaint_id: complaint.id,
            mdi_no: selectedType === 'MDI' ? complaint.complaint_number || '' : null,
            vehicle_serial_number: complaint.vehicle_serial_number || '',
            vehicle_chassis_number: complaint.vehicle_chassis_number || '',
            customer_name: customerName,
        });
    }, [open, complaint, selectedType, workflowRecommendation]);

    const handleProceed = () => {
        setNCModalOpen(true);
    };

    const handleNCFormSave = async (formData, files = []) => {
        try {
            const complaintReferenceLines = [
                complaint?.id ? `Kaynak Vaka ID: ${complaint.id}` : '',
                complaint?.complaint_number ? `Vaka No: ${complaint.complaint_number}` : '',
            ].filter(Boolean);

            const normalizedDescription = [formData.description || '']
                .concat(
                    complaintReferenceLines.filter(
                        (line) => !String(formData.description || '').includes(line)
                    )
                )
                .join('\n')
                .trim();

            const payload = Object.entries({
                ...formData,
                description: normalizedDescription,
                source_complaint_id: complaint.id,
                attachments: formData.attachments || [],
            }).reduce((acc, [key, value]) => {
                if (
                    value !== undefined &&
                    key !== 'assigned_to_id' &&
                    key !== 'responsible_person_id' &&
                    key !== 'responsible_department_id' &&
                    key !== 'vehicle_serial_number' &&
                    key !== 'vehicle_chassis_number' &&
                    key !== 'customer_name' &&
                    key !== 'product_code' &&
                    key !== 'product_name' &&
                    key !== 'batch_number' &&
                    key !== 'quantity_affected' &&
                    key !== 'nc_type' &&
                    key !== 'source' &&
                    key !== 'detection_date' &&
                    key !== 'severity'
                ) {
                    acc[key] = value;
                }
                return acc;
            }, {});

            Object.keys(payload).forEach((key) => {
                if (!NONCONFORMITY_ALLOWED_COLUMNS.has(key)) {
                    delete payload[key];
                }
            });

            payload.status = normalizeNCStatus(payload.status);

            if (payload.type !== 'MDI' && !payload.nc_number) {
                const { data: generatedNcNumber, error: numberError } = await supabase.rpc('generate_nc_number', {
                    nc_type: payload.type,
                });
                if (numberError) throw numberError;
                payload.nc_number = generatedNcNumber;
                payload.mdi_no = null;
            }

            if (payload.type === 'MDI') {
                payload.nc_number = null;
            }

            let sanitizedPayload = { ...payload };

            // Schema cache'de olmayan kolonları otomatik temizleyerek kaydı devam ettir.
            // Böylece canlı DB tarafında eksik migration olsa bile modal çökmez.
            // Files burada ayrıca upload edilmiyor; NC genel modal kendi attachment alanını payload'a yazıyor.
            // Aynı nedenle files parametresi şimdilik yalnızca imza uyumluluğu için tutuluyor.
            void files;

            // 최대 birkaç kolon temizleme denemesi
            for (let attempt = 0; attempt < 12; attempt += 1) {
                const { data: ncRecord, error: ncError } = await supabase
                    .from('non_conformities')
                    .insert([sanitizedPayload])
                    .select()
                    .single();

                if (!ncError) {
                    const { error: updateError } = await supabase
                        .from('customer_complaints')
                        .update({ related_nc_id: ncRecord.id })
                        .eq('id', complaint.id);

                    if (updateError) {
                        console.error('Şikayet ilişki güncelleme hatası:', updateError);
                    }

                    return { data: ncRecord, error: null };
                }

                const missingColumn = getMissingColumnName(ncError);
                if (!missingColumn || !(missingColumn in sanitizedPayload)) {
                    throw ncError;
                }

                delete sanitizedPayload[missingColumn];
            }

            const { data: ncRecord, error: ncError } = await supabase
                .from('non_conformities')
                .insert([sanitizedPayload])
                .select()
                .single();

            if (ncError) throw ncError;

            const { error: updateError } = await supabase
                .from('customer_complaints')
                .update({ related_nc_id: ncRecord.id })
                .eq('id', complaint.id);

            if (updateError) {
                console.error('Şikayet ilişki güncelleme hatası:', updateError);
            }

            return { data: ncRecord, error: null };
        } catch (error) {
            console.error('Yöntem oluşturma hatası:', error);
            return { data: null, error };
        }
    };

    const handleNCFormSaveSuccess = (createdRecord) => {
        setNCModalOpen(false);
        toast({
            title: 'Başarılı',
            description: `${selectedType} kaydı oluşturuldu ve satış sonrası vakaya bağlandı.`,
        });
        setOpen(false);
        onSuccess?.(createdRecord, complaint);
    };

    return (
        <>
            <Dialog
                open={open && !isNCModalOpen}
                onOpenChange={(nextOpen) => {
                    if (!nextOpen) {
                        setOpen(false);
                    }
                }}
            >
                <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <GitPullRequestArrow className="w-5 h-5 text-primary" />
                            DF / MDI / 8D Başlat
                        </DialogTitle>
                        <DialogDescription>
                            Vaka için uygun yöntemi seçin. İstersen önerilen yöntemle devam edebilir, istersen manuel seçim yapabilirsin.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-5 py-2">
                        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="text-xs font-semibold uppercase tracking-wider text-primary">Önerilen Yöntem</div>
                                    <div className="mt-1 flex items-center gap-2">
                                        <div className="text-lg font-semibold">{workflowRecommendation.type}</div>
                                        <Badge variant="outline">Otomatik öneri</Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-2">{workflowRecommendation.reason}</p>
                                </div>
                                <Lightbulb className="w-5 h-5 text-primary shrink-0 mt-1" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-xl border p-4">
                            <div>
                                <div className="text-sm font-medium">Vaka</div>
                                <div className="text-sm text-muted-foreground mt-1">{complaint?.title || '-'}</div>
                            </div>
                            <div>
                                <div className="text-sm font-medium">Müşteri</div>
                                <div className="text-sm text-muted-foreground mt-1">{getCustomerDisplayName(complaint?.customer)}</div>
                            </div>
                            <div>
                                <div className="text-sm font-medium">Araç</div>
                                <div className="text-sm text-muted-foreground mt-1">{getVehicleDisplayLabel(complaint)}</div>
                            </div>
                            <div>
                                <div className="text-sm font-medium">Arızalı Parça</div>
                                <div className="text-sm text-muted-foreground mt-1">
                                    {getFaultPartSummaryLabel(complaint)}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <Label>Yöntem Seçimi</Label>
                            <RadioGroup value={selectedType} onValueChange={setSelectedType} className="space-y-3">
                                {Object.entries(METHOD_OPTIONS).map(([key, option]) => (
                                    <label
                                        key={key}
                                        htmlFor={`method-${key}`}
                                        className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
                                            selectedType === key ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'
                                        }`}
                                    >
                                        <RadioGroupItem value={key} id={`method-${key}`} className="mt-1" />
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <div className="font-semibold">{option.title}</div>
                                                {workflowRecommendation.type === key && (
                                                    <Badge variant="secondary">
                                                        <CheckCircle2 className="w-3 h-3 mr-1" />
                                                        Önerilen
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="text-sm text-muted-foreground mt-1">{option.subtitle}</div>
                                            <div className="text-sm mt-2">{option.description}</div>
                                        </div>
                                    </label>
                                ))}
                            </RadioGroup>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            İptal
                        </Button>
                        <Button onClick={handleProceed}>
                            <AlertTriangle className="w-4 h-4 mr-2" />
                            Yöntemi Aç
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {preparedData && (
                <NCFormModal
                    isOpen={isNCModalOpen}
                    setIsOpen={setNCModalOpen}
                    record={preparedData}
                    onSave={handleNCFormSave}
                    onSaveSuccess={handleNCFormSaveSuccess}
                />
            )}
        </>
    );
};

export default CreateNCFromComplaintModal;
