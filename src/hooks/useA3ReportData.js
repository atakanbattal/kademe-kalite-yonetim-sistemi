import { useState, useEffect, useCallback, useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { supabase } from '@/lib/customSupabaseClient';
import {
    subMonths, startOfYear, endOfYear, format, differenceInDays,
    parseISO, isValid, startOfDay, endOfDay, addDays
} from 'date-fns';
import { tr } from 'date-fns/locale';
import { calculateInspectionDuration, calculateReworkDuration } from '@/lib/vehicleCostCalculator';

const inDateRange = (dateStr, startDate, endDate) => {
    if (!dateStr) return false;
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return false;
        return d >= startDate && d <= endDate;
    } catch {
        return false;
    }
};

const toNumber = (value) => {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const roundTo = (value, digits = 1) => {
    if (!Number.isFinite(value)) return 0;
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
};

const getSupplierGradeFromScore = (score) => {
    if (!Number.isFinite(score)) return 'N/A';
    if (score >= 90) return 'A';
    if (score >= 75) return 'B';
    if (score >= 60) return 'C';
    return 'D';
};

const getLatestSupplierEvaluation = (supplier) => {
    const completedAudit = [...(supplier?.supplier_audit_plans || [])]
        .filter(plan => plan.status === 'Tamamlandı' && plan.score != null)
        .sort((a, b) => new Date(b.actual_date || b.planned_date || 0) - new Date(a.actual_date || a.planned_date || 0))[0];

    if (completedAudit?.score != null) {
        return {
            grade: getSupplierGradeFromScore(Number(completedAudit.score)),
            score: Number(completedAudit.score),
            source: 'audit',
        };
    }

    const latestScore = [...(supplier?.supplier_scores || [])]
        .sort((a, b) => new Date(b.period || 0) - new Date(a.period || 0))[0];

    if (latestScore) {
        return {
            grade: latestScore.grade || getSupplierGradeFromScore(Number(latestScore.final_score)),
            score: Number(latestScore.final_score),
            source: 'scorecard',
        };
    }

    return { grade: 'N/A', score: null, source: null };
};

const getRootCauseText = (record) => (
    record?.root_cause ||
    record?.five_why_analysis?.rootCause ||
    record?.five_why_analysis?.why5 ||
    record?.fta_analysis?.rootCauses ||
    record?.fta_analysis?.summary ||
    record?.eight_d_steps?.D4?.description ||
    record?.eight_d_steps?.d4?.description ||
    record?.rejection_reason ||
    'Belirtilmemiş'
);

const getQuarantineReasonText = (record) => (
    record?.reason ||
    record?.description ||
    record?.rejection_reason ||
    record?.decision_reason ||
    'Belirtilmemiş'
);

const INTERNAL_FAILURE_COST_TYPES = [
    'Hurda Maliyeti',
    'Yeniden İşlem Maliyeti',
    'Fire Maliyeti',
    'Final Hataları Maliyeti',
    'İç Hata Maliyeti',
    'Tedarikçi Hata Maliyeti',
];

const EXTERNAL_FAILURE_COST_TYPES = [
    'Garanti Maliyeti',
    'İade Maliyeti',
    'Şikayet Maliyeti',
    'Dış Hata Maliyeti',
    'Müşteri Reklaması',
];

const APPRAISAL_COST_TYPES = [
    'İç Kalite Kontrol Maliyeti',
    'Değerlendirme Maliyeti',
    'Kontrol Maliyeti',
];

const PREVENTION_COST_TYPES = [
    'Önleme Maliyeti',
    'Eğitim Maliyeti',
];

const getCostCategory = (costType, isSupplierCost = false) => {
    if (isSupplierCost || INTERNAL_FAILURE_COST_TYPES.includes(costType)) return 'internalFailure';
    if (EXTERNAL_FAILURE_COST_TYPES.includes(costType)) return 'externalFailure';
    if (APPRAISAL_COST_TYPES.includes(costType)) return 'appraisal';
    if (PREVENTION_COST_TYPES.includes(costType)) return 'prevention';
    return 'appraisal';
};

const getCostSourceLabel = (cost) => {
    if (cost.is_supplier_nc || cost.supplier_id) return 'Tedarikçi Kalitesi';
    switch (cost.source_type) {
        case 'produced_vehicle':
        case 'produced_vehicle_manual':
        case 'produced_vehicle_final_faults':
            return 'Üretilen Araçlar';
        case 'incoming_inspection':
            return 'Girdi Kalite';
        case 'quarantine':
            return 'Karantina';
        case 'deviation':
            return 'Sapma';
        case 'audit_finding':
            return 'İç Tetkik';
        case 'customer_complaint':
        case 'complaint':
            return 'Müşteri Şikayeti';
        case 'nonconformity':
        case 'df8d':
            return 'DF / 8D';
        default:
            if (cost.customer_name) return 'Müşteri Şikayeti';
            return 'Genel Kalite Gideri';
    }
};

const useA3ReportData = (period = 'last3months') => {
    const ctx = useData();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const { startDate, endDate, periodLabel } = useMemo(() => {
        const now = new Date();
        let start, end = endOfDay(now), label = '';
        switch (period) {
            case 'last1month':  start = startOfDay(subMonths(now, 1));  label = 'Son 1 Ay';  break;
            case 'last3months': start = startOfDay(subMonths(now, 3));  label = 'Son 3 Ay';  break;
            case 'last6months': start = startOfDay(subMonths(now, 6));  label = 'Son 6 Ay';  break;
            case 'thisYear':    start = startOfYear(now); end = endOfYear(now); label = `${now.getFullYear()} Yılı`; break;
            default:            start = startOfDay(subMonths(now, 12)); label = 'Son 12 Ay'; break;
        }
        return { startDate: start, endDate: end, periodLabel: label };
    }, [period]);

    const processData = useCallback(async () => {
        if (ctx.loading) return;
        setLoading(true);
        setError(null);

        try {
            const raw = {
                nonConformities: ctx.nonConformities || [],
                nonconformityRecords: ctx.nonconformityRecords || [],
                qualityCosts: ctx.qualityCosts || [],
                quarantineRecords: ctx.quarantineRecords || [],
                incomingInspections: ctx.incomingInspections || [],
                producedVehicles: ctx.producedVehicles || [],
                productionDepartments: ctx.productionDepartments || [],
                customerComplaints: ctx.customerComplaints || [],
                kaizenEntries: ctx.kaizenEntries || [],
                deviations: ctx.deviations || [],
                equipments: ctx.equipments || [],
                audits: ctx.audits || [],
                auditFindings: ctx.auditFindings || [],
                personnel: ctx.personnel || [],
                tasks: ctx.tasks || [],
                documents: ctx.documents || [],
                kpis: ctx.kpis || [],
                suppliers: ctx.suppliers || [],
                supplierNonConformities: ctx.supplierNonConformities || [],
                incomingControlPlans: ctx.incomingControlPlans || [],
                processControlPlans: ctx.processControlPlans || [],
                trainings: ctx.trainings || [],
                complaintAnalyses: ctx.complaintAnalyses || [],
                complaintActions: ctx.complaintActions || [],
            };

            let fixtureRows = [];
            try {
                const { data: fixtureData, error: fixtureError } = await supabase
                    .from('fixtures')
                    .select(`
                        id,
                        fixture_no,
                        part_code,
                        part_name,
                        criticality_class,
                        responsible_department,
                        status,
                        activation_date,
                        created_at,
                        last_verification_date,
                        next_verification_date,
                        sample_count_required,
                        verification_period_months,
                        fixture_verifications(
                            id,
                            verification_date,
                            verification_type,
                            result,
                            sample_count,
                            verified_by,
                            created_at
                        ),
                        fixture_nonconformities(
                            id,
                            detection_date,
                            correction_status,
                            correction_date,
                            correction_description,
                            created_at
                        )
                    `)
                    .order('created_at', { ascending: false });

                if (fixtureError) throw fixtureError;
                fixtureRows = fixtureData || [];
            } catch (fixtureError) {
                console.warn('⚠️ A3 report fixtures fetch skipped:', fixtureError);
            }

            const ncData = raw.nonConformities.filter(n =>
                inDateRange(n.created_at, startDate, endDate)
            );
            const ncRecordsData = (raw.nonconformityRecords || []).filter(r =>
                inDateRange(r.detection_date || r.created_at, startDate, endDate)
            );
            const ncRecordsByStatus = {};
            ncRecordsData.forEach(r => {
                const st = r.status || 'Açık';
                ncRecordsByStatus[st] = (ncRecordsByStatus[st] || 0) + 1;
            });
            const ncRecordsBySeverity = {};
            ncRecordsData.forEach(r => {
                const sev = r.severity || 'Belirtilmemiş';
                ncRecordsBySeverity[sev] = (ncRecordsBySeverity[sev] || 0) + 1;
            });
            const ncRecordsOpen = ncRecordsData.filter(r => r.status !== 'Kapatıldı').length;
            const ncRecordTotalQuantity = ncRecordsData.reduce((sum, record) => sum + (Number(record.quantity) || 0), 0);
            const ncRecordDfSuggested = ncRecordsData.filter(r => r.status === 'DF Önerildi').length;
            const ncRecordEightDSuggested = ncRecordsData.filter(r => r.status === '8D Önerildi').length;
            const ncRecordConverted = ncRecordsData.filter(r => ['DF Açıldı', '8D Açıldı'].includes(r.status)).length;
            const ncRecordClosed = ncRecordsData.filter(r => r.status === 'Kapatıldı').length;
            const ncRecordCritical = ncRecordsData.filter(r => r.severity === 'Kritik' && r.status !== 'Kapatıldı').length;
            const ncCategoryCounts = {};
            const ncPartCounts = {};
            const ncResponsibleCounts = {};
            ncRecordsData.forEach(r => {
                const category = r.category || 'Belirtilmemiş';
                ncCategoryCounts[category] = (ncCategoryCounts[category] || 0) + 1;

                const partKey = r.part_code || r.part_name || 'Belirtilmemiş';
                if (!ncPartCounts[partKey]) {
                    ncPartCounts[partKey] = {
                        name: partKey,
                        count: 0,
                        severity: r.severity || 'Belirtilmemiş',
                    };
                }
                ncPartCounts[partKey].count += 1;

                const personName = r.responsible_person || r.detected_by || 'Atanmamış';
                if (!ncResponsibleCounts[personName]) {
                    ncResponsibleCounts[personName] = {
                        name: personName,
                        total: 0,
                        open: 0,
                        closed: 0,
                        critical: 0,
                    };
                }
                ncResponsibleCounts[personName].total += 1;
                if (r.status === 'Kapatıldı') ncResponsibleCounts[personName].closed += 1;
                else ncResponsibleCounts[personName].open += 1;
                if (r.severity === 'Kritik') ncResponsibleCounts[personName].critical += 1;
            });
            const ncTopCategories = Object.entries(ncCategoryCounts)
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 8);
            const ncTopParts = Object.values(ncPartCounts)
                .sort((a, b) => b.count - a.count)
                .slice(0, 8);
            const ncResponsibleLoad = Object.values(ncResponsibleCounts)
                .map(item => ({
                    ...item,
                    closeRate: item.total > 0 ? Math.round((item.closed / item.total) * 100) : 0,
                }))
                .sort((a, b) => {
                    if (b.open !== a.open) return b.open - a.open;
                    if (b.total !== a.total) return b.total - a.total;
                    return a.name.localeCompare(b.name, 'tr');
                })
                .slice(0, 8);
            const ncSuggestedItems = ncRecordsData
                .filter(r => r.status === 'DF Önerildi' || r.status === '8D Önerildi')
                .sort((a, b) => new Date(b.detection_date || b.created_at || 0) - new Date(a.detection_date || a.created_at || 0))
                .slice(0, 10)
                .map(r => ({
                    type: r.status === '8D Önerildi' ? '8D' : 'DF',
                    recordNumber: r.record_number || '—',
                    partCode: r.part_code || '—',
                    partName: r.part_name || '—',
                    description: r.description || '—',
                    severity: r.severity || '—',
                    quantity: Number(r.quantity) || 0,
                    area: r.detection_area || '—',
                    responsible: r.responsible_person || r.detected_by || '—',
                    detectionDate: r.detection_date || r.created_at,
                }));
            const ncRecordsRecent = ncRecordsData
                .sort((a, b) => new Date(b.detection_date || b.created_at || 0) - new Date(a.detection_date || a.created_at || 0))
                .slice(0, 15)
                .map(r => ({
                    kayitNo: r.record_number || '—',
                    tarih: r.detection_date || r.created_at,
                    parca: r.part_code || r.part_name || '—',
                    parcaAdi: r.part_name || '—',
                    aciklama: (r.description || '').slice(0, 120),
                    kategori: r.category || '—',
                    alan: r.detection_area || '—',
                    onem: r.severity || '—',
                    durum: r.status || '—',
                    sorumlu: r.responsible_person || r.department || '—',
                    tespitEden: r.detected_by || '—',
                    adet: Number(r.quantity) || 0,
                }));
            const costData = raw.qualityCosts.filter(c =>
                inDateRange(c.cost_date || c.created_at, startDate, endDate)
            );
            const incomingData = raw.incomingInspections.filter(i =>
                inDateRange(i.inspection_date || i.created_at, startDate, endDate)
            );
            const vehicleData = raw.producedVehicles.filter(v =>
                inDateRange(v.created_at, startDate, endDate)
            );
            const complaintData = raw.customerComplaints.filter(c =>
                inDateRange(c.complaint_date || c.created_at, startDate, endDate)
            );
            const kaizenData = raw.kaizenEntries.filter(k =>
                inDateRange(k.created_at, startDate, endDate)
            );
            const deviationData = raw.deviations.filter(d =>
                inDateRange(d.created_at, startDate, endDate)
            );
            const auditData = raw.audits.filter(a =>
                inDateRange(a.audit_date || a.created_at, startDate, endDate)
            );
            const allSuppliers = raw.suppliers || [];
            const approvedSuppliers = allSuppliers.filter(s => s.status === 'Onaylı');
            const alternativeSuppliers = allSuppliers.filter(s => s.status === 'Alternatif');
            const supplierData = allSuppliers.filter(s => ['Onaylı', 'Alternatif'].includes(s.status));
            const supplierNcData = (raw.supplierNonConformities || []).filter(nc =>
                inDateRange(nc.created_at, startDate, endDate)
            );
            const personnelData = (raw.personnel || []).filter(p => p.is_active !== false);
            const equipmentData = raw.equipments || [];
            const productionDepartments = raw.productionDepartments || [];
            const trainingData = (raw.trainings || []).filter(t =>
                inDateRange(t.start_date || t.end_date || t.created_at, startDate, endDate)
            );
            const completedTrainings = trainingData.filter(t => t.status === 'Tamamlandı').length;
            const plannedTrainings = trainingData.filter(t => t.status !== 'Tamamlandı').length;
            const trainingDetails = trainingData
                .sort((a, b) => new Date(b.start_date || b.created_at || 0) - new Date(a.start_date || a.created_at || 0))
                .map(t => ({
                    title: t.title || '—',
                    startDate: t.start_date,
                    endDate: t.end_date,
                    status: t.status || '—',
                    instructor: t.instructor || '—',
                    durationHours: t.duration_hours,
                    participantsCount: Array.isArray(t.training_participants) && t.training_participants[0]?.count != null
                        ? t.training_participants[0].count
                        : (t.training_participants?.count ?? 0),
                }));
            const complaintIdsInPeriod = new Set(complaintData.map(c => c.id));
            const complaintAnalysesData = (raw.complaintAnalyses || []).filter(a =>
                complaintIdsInPeriod.has(a.complaint_id) || inDateRange(a.analysis_date || a.created_at, startDate, endDate)
            );
            const complaintActionsData = (raw.complaintActions || []).filter(a =>
                complaintIdsInPeriod.has(a.complaint_id) || inDateRange(a.planned_start_date || a.planned_end_date || a.created_at, startDate, endDate)
            );
            const documentData = raw.documents || [];
            const kpiRecordData = raw.kpis || [];

            const openDF  = ncData.filter(n => n.type === 'DF' && n.status !== 'Kapatıldı').length;
            const open8D  = ncData.filter(n => n.type === '8D' && n.status !== 'Kapatıldı').length;
            const closedNc = ncData.filter(n => n.status === 'Kapatıldı').length;

            const closedWithDates = ncData.filter(n => n.status === 'Kapatıldı' && n.closed_at && n.created_at);
            const avgClosureDays = closedWithDates.length > 0
                ? Math.round(closedWithDates.reduce((sum, n) => sum + differenceInDays(parseISO(n.closed_at), parseISO(n.created_at)), 0) / closedWithDates.length)
                : 0;

            const totalCost    = costData.reduce((s, c) => s + (c.amount || 0), 0);
            const openComplaints  = complaintData.filter(c => c.status !== 'Kapatıldı' && c.status !== 'Reddedildi').length;
            const slaOverdue      = complaintData.filter(c => c.sla_resolution_due && new Date() > parseISO(c.sla_resolution_due)).length;

            const totalIncoming       = incomingData.length;
            const acceptedIncoming    = incomingData.filter(i => i.decision === 'Kabul').length;
            const conditionalIncoming = incomingData.filter(i => i.decision === 'Şartlı Kabul').length;
            const rejectedIncoming    = incomingData.filter(i => i.decision === 'Ret').length;
            const pendingIncoming     = incomingData.filter(i => !i.decision || i.decision === 'Beklemede').length;
            const incomingRejectionRate = totalIncoming > 0 ? ((rejectedIncoming / totalIncoming) * 100).toFixed(1) : '0.0';
            const totalPartsInspected = incomingData.reduce((s, i) => s + (i.quantity_received || i.total_quantity || 0), 0);
            const totalPartsRejected = incomingData.reduce((s, i) => s + (i.quantity_rejected || 0), 0);

            const totalVehicles  = vehicleData.length;
            const passedVehicles = vehicleData.filter(v => (v.quality_inspection_faults || []).length === 0).length;
            const failedVehicles = vehicleData.filter(v => (v.quality_inspection_faults || []).length > 0).length;
            const vehiclePassRate = totalVehicles > 0 ? ((passedVehicles / totalVehicles) * 100).toFixed(1) : '0.0';

            const completedKaizen = kaizenData.filter(k => k.status === 'Tamamlandı').length;
            const activeKaizen    = kaizenData.filter(k => k.status === 'Devam Ediyor' || k.status === 'Devam ediyor').length;
            const kaizenSavings   = kaizenData.reduce((s, k) => s + (k.total_yearly_gain || 0), 0);

            const openDeviations = deviationData.filter(d =>
                d.status !== 'Kapandı' && d.status !== 'Reddedildi' && d.status !== 'Kapatıldı'
            ).length;

            const completedAudits = auditData.filter(a => a.status === 'Tamamlandı').length;
            const auditIdsInRange = new Set(auditData.map(a => a.id));
            const openAuditFindings = (ctx.auditFindings || [])
                .filter(f => auditIdsInRange.has(f.audit_id) && f.status !== 'Kapatıldı').length;

            const currentOpenTasks = (raw.tasks || []).filter(t => t.status !== 'Tamamlandı' && t.status !== 'İptal');
            const overdueTaskList = currentOpenTasks
                .filter(t => t.due_date && isValid(parseISO(t.due_date)) && new Date() > parseISO(t.due_date))
                .map(t => ({
                    title: t.title || t.task_no || 'Görev',
                    taskNo: t.task_no || '—',
                    dueDate: t.due_date,
                    project: t.project?.name || 'Projesiz',
                    daysOverdue: differenceInDays(new Date(), parseISO(t.due_date)),
                    status: t.status || 'Bekliyor',
                }))
                .sort((a, b) => b.daysOverdue - a.daysOverdue);
            const openTasks = currentOpenTasks.length;
            const overdueTasks = overdueTaskList.length;

            const overdueCalibrations = [];
            equipmentData.forEach(eq => {
                (eq.equipment_calibrations || []).forEach(cal => {
                    if (cal && cal.next_calibration_date && isValid(parseISO(cal.next_calibration_date))) {
                        const daysOver = differenceInDays(new Date(), parseISO(cal.next_calibration_date));
                        if (daysOver > 0) overdueCalibrations.push({ cihaz: eq.name, tarih: cal.next_calibration_date, gecikme: daysOver });
                    }
                });
            });
            overdueCalibrations.sort((a, b) => b.gecikme - a.gecikme);

            const today = new Date();
            const nextThirtyDays = addDays(today, 30);
            const expiringDocs = documentData
                .filter(doc => doc.valid_until && isValid(parseISO(doc.valid_until)))
                .map(doc => ({
                    ad: doc.name || doc.title || 'Doküman',
                    no: doc.document_no || doc.document_number || '—',
                    tarih: doc.valid_until,
                    daysRemaining: differenceInDays(parseISO(doc.valid_until), today),
                }))
                .filter(doc => doc.daysRemaining >= 0 && parseISO(doc.tarih) <= nextThirtyDays)
                .sort((a, b) => a.daysRemaining - b.daysRemaining)
                .slice(0, 8);
            const expiredDocs = documentData
                .filter(doc => doc.valid_until && isValid(parseISO(doc.valid_until)) && parseISO(doc.valid_until) < today)
                .map(doc => ({
                    ad: doc.name || doc.title || 'Doküman',
                    no: doc.document_no || doc.document_number || '—',
                    tarih: doc.valid_until,
                    daysOverdue: differenceInDays(today, parseISO(doc.valid_until)),
                }))
                .sort((a, b) => b.daysOverdue - a.daysOverdue)
                .slice(0, 8);

            const ncByDept = {};
            ncData.forEach(nc => {
                const dept = nc.department || nc.requesting_unit || 'Belirtilmemiş';
                if (!ncByDept[dept]) ncByDept[dept] = { name: dept, acik: 0, kapali: 0, toplam: 0 };
                ncByDept[dept].toplam++;
                if (nc.status === 'Kapatıldı') ncByDept[dept].kapali++;
                else ncByDept[dept].acik++;
            });
            const ncByDeptArr = Object.values(ncByDept).sort((a, b) => b.toplam - a.toplam).slice(0, 12);

            const ncByType = {};
            ncData.forEach(nc => {
                const t = nc.type || 'Diğer';
                if (!ncByType[t]) ncByType[t] = { name: t, acik: 0, kapali: 0 };
                if (nc.status === 'Kapatıldı') ncByType[t].kapali++;
                else ncByType[t].acik++;
            });
            const ncByTypeArr = Object.values(ncByType);

            const ncMonthly = {};
            ncData.forEach(nc => {
                if (!nc.created_at || !isValid(parseISO(nc.created_at))) return;
                const month = format(parseISO(nc.created_at), 'MMM yy', { locale: tr });
                if (!ncMonthly[month]) ncMonthly[month] = { name: month, acilan: 0, kapilan: 0, sort: parseISO(nc.created_at).getTime() };
                ncMonthly[month].acilan++;
                if (nc.status === 'Kapatıldı' && nc.closed_at && isValid(parseISO(nc.closed_at))) {
                    const cm = format(parseISO(nc.closed_at), 'MMM yy', { locale: tr });
                    if (!ncMonthly[cm]) ncMonthly[cm] = { name: cm, acilan: 0, kapilan: 0, sort: parseISO(nc.closed_at).getTime() };
                    ncMonthly[cm].kapilan++;
                }
            });
            const ncMonthlyArr = Object.values(ncMonthly).sort((a, b) => a.sort - b.sort).slice(-10);

            const costByType = {};
            const costByUnit = {};
            const costRecordCountByUnit = {};
            costData.forEach(c => {
                const type = c.cost_type || 'Belirtilmemiş';
                costByType[type] = (costByType[type] || 0) + (c.amount || 0);
                const unit = c.unit || c.responsible_unit || 'Belirtilmemiş';
                costByUnit[unit] = (costByUnit[unit] || 0) + (c.amount || 0);
                costRecordCountByUnit[unit] = (costRecordCountByUnit[unit] || 0) + 1;
            });
            const costByTypeArr = Object.entries(costByType).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

            const costMonthly = {};
            costData.forEach(c => {
                if (!c.cost_date || !isValid(parseISO(c.cost_date))) return;
                const month = format(parseISO(c.cost_date), 'MMM yy', { locale: tr });
                if (!costMonthly[month]) costMonthly[month] = { name: month, toplam: 0, sort: parseISO(c.cost_date).getTime() };
                costMonthly[month].toplam += c.amount || 0;
            });
            const costMonthlyArr = Object.values(costMonthly).sort((a, b) => a.sort - b.sort);

            const costCategoryTotals = {
                internalFailure: 0,
                externalFailure: 0,
                appraisal: 0,
                prevention: 0,
            };
            const costSourceMap = {};
            const costVehicleTypeMap = {};
            const customerCostMap = {};
            const costComponentTotals = {
                invoice: 0,
                shared: 0,
                indirect: 0,
                recordOnly: 0,
            };
            const costDrivers = [];

            costData.forEach(cost => {
                const amount = toNumber(cost.amount);
                const isSupplierCost = Boolean(cost.is_supplier_nc && cost.supplier_id);
                const category = getCostCategory(cost.cost_type || '', isSupplierCost);
                const sourceName = getCostSourceLabel(cost);
                const lineItems = Array.isArray(cost.cost_line_items) ? cost.cost_line_items : [];
                const sharedCosts = Array.isArray(cost.shared_costs) ? cost.shared_costs : [];
                const indirectCosts = Array.isArray(cost.indirect_costs) ? cost.indirect_costs : [];
                const lineItemsTotal = lineItems.reduce((sum, item) => sum + toNumber(item.amount), 0);
                const sharedCostsTotal = sharedCosts.reduce((sum, item) => sum + toNumber(item.amount), 0);
                const indirectCostsTotal = indirectCosts.reduce((sum, item) => sum + toNumber(item.amount), 0);

                costCategoryTotals[category] += amount;
                if (!costSourceMap[sourceName]) {
                    costSourceMap[sourceName] = { name: sourceName, value: 0, count: 0 };
                }
                costSourceMap[sourceName].value += amount;
                costSourceMap[sourceName].count += 1;

                if (cost.vehicle_type) {
                    costVehicleTypeMap[cost.vehicle_type] = (costVehicleTypeMap[cost.vehicle_type] || 0) + amount;
                }
                if (cost.customer_name) {
                    customerCostMap[cost.customer_name] = (customerCostMap[cost.customer_name] || 0) + amount;
                }

                if (lineItemsTotal > 0) {
                    costComponentTotals.invoice += lineItemsTotal;
                    lineItems.forEach(item => {
                        const driverAmount = toNumber(item.amount);
                        if (driverAmount <= 0) return;
                        const ownerLabel = item.responsible_type === 'supplier'
                            ? (item.responsible_supplier_name || cost.supplier?.name || 'Tedarikçi')
                            : (item.responsible_unit || cost.unit || 'Belirtilmemiş');
                        costDrivers.push({
                            label: item.part_name || item.part_code || cost.part_name || cost.cost_type || 'Kalem',
                            partCode: item.part_code || cost.part_code || '—',
                            amount: driverAmount,
                            costType: cost.cost_type || 'Belirtilmemiş',
                            owner: ownerLabel,
                            source: sourceName,
                        });
                    });
                } else {
                    costComponentTotals.recordOnly += amount;
                    if (amount > 0) {
                        costDrivers.push({
                            label: cost.part_name || cost.part_code || cost.description || cost.cost_type || 'Kalite Gideri',
                            partCode: cost.part_code || '—',
                            amount,
                            costType: cost.cost_type || 'Belirtilmemiş',
                            owner: cost.unit || cost.responsible_unit || 'Belirtilmemiş',
                            source: sourceName,
                        });
                    }
                }

                costComponentTotals.shared += sharedCostsTotal;
                costComponentTotals.indirect += indirectCostsTotal;
            });

            const totalCopq = Object.values(costCategoryTotals).reduce((sum, value) => sum + value, 0);
            const costCategoryArr = [
                { name: 'İç Hata', value: costCategoryTotals.internalFailure },
                { name: 'Dış Hata', value: costCategoryTotals.externalFailure },
                { name: 'Değerlendirme', value: costCategoryTotals.appraisal },
                { name: 'Önleme', value: costCategoryTotals.prevention },
            ].filter(item => item.value > 0);
            const costSourceArr = Object.values(costSourceMap)
                .sort((a, b) => b.value - a.value)
                .slice(0, 10);
            const costComponentArr = [
                { name: 'Faturalı Kalemler', value: costComponentTotals.invoice },
                { name: 'Ortak Giderler', value: costComponentTotals.shared },
                { name: 'Dolaylı Giderler', value: costComponentTotals.indirect },
                { name: 'Tek Kayıt Yükleri', value: costComponentTotals.recordOnly },
            ].filter(item => item.value > 0);
            const topCostDrivers = costDrivers
                .sort((a, b) => b.amount - a.amount)
                .slice(0, 10)
                .map((item, index) => ({
                    ...item,
                    rank: index + 1,
                    percentage: totalCost > 0 ? ((item.amount / totalCost) * 100).toFixed(1) : '0.0',
                }));
            const costByVehicleTypeArr = Object.entries(costVehicleTypeMap)
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 8);
            const costByCustomerArr = Object.entries(customerCostMap)
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 6);

            const gradeDistribution = { A: 0, B: 0, C: 0, D: 0, 'N/A': 0 };
            supplierData.forEach(supplier => {
                const latestEvaluation = getLatestSupplierEvaluation(supplier);
                const grade = latestEvaluation.grade || 'N/A';
                if (Object.prototype.hasOwnProperty.call(gradeDistribution, grade)) {
                    gradeDistribution[grade]++;
                } else {
                    gradeDistribution['N/A']++;
                }
            });
            const gradeArr = Object.entries(gradeDistribution)
                .filter(([, value]) => value > 0)
                .map(([name, value]) => ({ name, value }));

            const supplierIdToName = new Map(allSuppliers.map(supplier => [supplier.id, supplier.name]));
            const supplierNcByKey = {};
            supplierNcData.forEach(nc => {
                const key = nc.supplier_id || nc.supplier?.id || nc.supplier?.name || 'Belirtilmemiş';
                const name = nc.supplier?.name || supplierIdToName.get(nc.supplier_id) || 'Belirtilmemiş';
                if (!supplierNcByKey[key]) supplierNcByKey[key] = { name, open: 0, closed: 0 };
                if (nc.status === 'Kapatıldı') supplierNcByKey[key].closed++;
                else supplierNcByKey[key].open++;
            });
            const topSuppliersNC = Object.values(supplierNcByKey)
                .map(item => ({ name: item.name.slice(0, 22), count: item.open + item.closed, open: item.open }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 8);

            const rejectedBySupplier = {};
            incomingData
                .filter(inspection => inspection.decision === 'Ret')
                .forEach(inspection => {
                    const key = inspection.supplier_id || inspection.supplier_name || 'Belirtilmemiş';
                    const name = supplierIdToName.get(inspection.supplier_id) || inspection.supplier_name || 'Belirtilmemiş';
                    if (!rejectedBySupplier[key]) rejectedBySupplier[key] = { name, count: 0 };
                    rejectedBySupplier[key].count += 1;
                });
            const topRejectedSuppliers = Object.values(rejectedBySupplier)
                .map(item => ({ name: item.name.slice(0, 22), count: item.count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 8);

            let totalInspectedParts = 0;
            let totalDefectiveParts = 0;
            const supplierPpmMap = {};
            incomingData.forEach(inspection => {
                const inspected = Number(inspection.quantity_received || inspection.total_quantity) || 0;
                if (inspected <= 0) return;

                const defective = (Number(inspection.quantity_rejected) || 0) + (Number(inspection.quantity_conditional) || 0);
                const key = inspection.supplier_id || inspection.supplier_name || 'Belirtilmemiş';
                const name = supplierIdToName.get(inspection.supplier_id) || inspection.supplier_name || 'Belirtilmemiş';

                if (!supplierPpmMap[key]) {
                    supplierPpmMap[key] = {
                        id: inspection.supplier_id || key,
                        name,
                        inspected: 0,
                        defective: 0,
                    };
                }

                supplierPpmMap[key].inspected += inspected;
                supplierPpmMap[key].defective += defective;
                totalInspectedParts += inspected;
                totalDefectiveParts += defective;
            });
            const supplierPpmArr = Object.values(supplierPpmMap)
                .map(item => ({
                    ...item,
                    ppm: item.inspected > 0 ? Math.round((item.defective / item.inspected) * 1000000) : 0,
                }))
                .filter(item => item.inspected > 0)
                .sort((a, b) => b.ppm - a.ppm)
                .slice(0, 8);
            const overallSupplierPpm = totalInspectedParts > 0
                ? Math.round((totalDefectiveParts / totalInspectedParts) * 1000000)
                : 0;

            const suppliersWithNCCount = Object.keys(supplierNcByKey).length;
            const suppliersWithRejectionCount = Object.keys(rejectedBySupplier).length;
            const gradeABCount = (gradeDistribution.A || 0) + (gradeDistribution.B || 0);

            const incomingMonthly = {};
            incomingData.forEach(i => {
                const dateStr = i.inspection_date || i.created_at;
                if (!dateStr || !isValid(parseISO(dateStr))) return;
                const month = format(parseISO(dateStr), 'MMM yy', { locale: tr });
                if (!incomingMonthly[month]) incomingMonthly[month] = { name: month, kontrol: 0, red: 0, sort: parseISO(dateStr).getTime() };
                incomingMonthly[month].kontrol++;
                if (i.decision === 'Ret') incomingMonthly[month].red++;
            });
            const incomingMonthlyArr = Object.values(incomingMonthly).sort((a, b) => a.sort - b.sort).slice(-8);

            const productionDepartmentMap = new Map(productionDepartments.map(department => [department.id, department.name]));
            const faultByCategory = {};
            const processFaultsMap = {};
            const vehicleTypeFaultsMap = {};
            vehicleData.forEach(vehicle => {
                const vehicleType = vehicle.vehicle_type || 'Belirtilmemiş';
                if (!vehicleTypeFaultsMap[vehicleType]) {
                    vehicleTypeFaultsMap[vehicleType] = { name: vehicleType, faultCount: 0, vehicleCount: 0 };
                }
                vehicleTypeFaultsMap[vehicleType].vehicleCount += 1;

                (vehicle.quality_inspection_faults || []).forEach(fault => {
                    const quantity = Number(fault.quantity) || 1;
                    const category = fault.fault_category?.name || fault.fault_type || fault.description || 'Belirtilmemiş';
                    const processName =
                        fault.department?.name ||
                        productionDepartmentMap.get(fault.department_id) ||
                        fault.department_name ||
                        'Belirtilmemiş';

                    if (!faultByCategory[category]) {
                        faultByCategory[category] = { name: category, count: 0, vehicleSet: new Set() };
                    }
                    faultByCategory[category].count += quantity;
                    faultByCategory[category].vehicleSet.add(vehicle.id);

                    if (!processFaultsMap[processName]) {
                        processFaultsMap[processName] = { name: processName, count: 0, vehicleSet: new Set() };
                    }
                    processFaultsMap[processName].count += quantity;
                    processFaultsMap[processName].vehicleSet.add(vehicle.id);

                    vehicleTypeFaultsMap[vehicleType].faultCount += quantity;
                });
            });
            const faultByCategoryArr = Object.values(faultByCategory)
                .map(item => ({ name: item.name, count: item.count, aracSayisi: item.vehicleSet.size }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 15);
            const processFaultsArr = Object.values(processFaultsMap)
                .map(item => ({
                    name: item.name,
                    count: item.count,
                    vehicleCount: item.vehicleSet.size,
                }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 8);

            const vehicleMonthly = {};
            vehicleData.forEach(vehicle => {
                if (!vehicle.created_at || !isValid(parseISO(vehicle.created_at))) return;
                const month = format(parseISO(vehicle.created_at), 'MMM yy', { locale: tr });
                if (!vehicleMonthly[month]) {
                    vehicleMonthly[month] = { name: month, toplam: 0, gecti: 0, hata: 0, sort: parseISO(vehicle.created_at).getTime() };
                }
                vehicleMonthly[month].toplam++;
                const totalFaultsInVehicle = (vehicle.quality_inspection_faults || []).reduce((sum, fault) => sum + (Number(fault.quantity) || 1), 0);
                vehicleMonthly[month].hata += totalFaultsInVehicle;
                if ((vehicle.quality_inspection_faults || []).length === 0) vehicleMonthly[month].gecti++;
            });
            const vehicleMonthlyArr = Object.values(vehicleMonthly)
                .sort((a, b) => a.sort - b.sort)
                .slice(-8)
                .map(item => ({
                    ...item,
                    kaldi: Math.max(item.toplam - item.gecti, 0),
                    dpu: item.toplam > 0 ? roundTo(item.hata / item.toplam, 2) : 0,
                    passRate: item.toplam > 0 ? roundTo((item.gecti / item.toplam) * 100, 1) : 0,
                }));
            const topFaultyVehicles = vehicleData
                .map(vehicle => {
                    const faults = vehicle.quality_inspection_faults || [];
                    const totalFaults = faults.reduce((sum, fault) => sum + (fault.quantity || 1), 0);
                    const activeFaults = faults
                        .filter(fault => !fault.is_resolved)
                        .reduce((sum, fault) => sum + (fault.quantity || 1), 0);
                    return {
                        chassisNo: vehicle.chassis_no || '—',
                        serialNo: vehicle.serial_no || '—',
                        customerName: vehicle.customer_name || '—',
                        vehicleType: vehicle.vehicle_type || 'Belirtilmemiş',
                        totalFaults,
                        activeFaults,
                        resolvedFaults: totalFaults - activeFaults,
                    };
                })
                .filter(vehicle => vehicle.totalFaults > 0)
                .sort((a, b) => b.totalFaults - a.totalFaults)
                .slice(0, 10);
            const totalVehicleFaults = faultByCategoryArr.reduce((sum, item) => sum + (item.count || 0), 0);
            const dpu = totalVehicles > 0 ? roundTo(totalVehicleFaults / totalVehicles, 2) : 0;
            const recurringFaultCount = Object.values(faultByCategory).reduce((sum, item) => (
                item.count > 1 ? sum + item.count : sum
            ), 0);
            const recurringFaultRate = totalVehicleFaults > 0
                ? Math.round((recurringFaultCount / totalVehicleFaults) * 100)
                : 0;
            const bestVehicleMonth = [...vehicleMonthlyArr]
                .filter(item => item.toplam > 0)
                .sort((a, b) => a.dpu - b.dpu || b.passRate - a.passRate)[0] || null;
            const worstVehicleMonth = [...vehicleMonthlyArr]
                .filter(item => item.toplam > 0)
                .sort((a, b) => b.dpu - a.dpu || a.passRate - b.passRate)[0] || null;

            const rootCauseMap = {};
            const registerRootCause = (causeText, department, sourceLabel) => {
                const normalizedCause = String(causeText || '').trim();
                if (!normalizedCause || normalizedCause === 'Belirtilmemiş' || normalizedCause === '-') return;

                if (!rootCauseMap[normalizedCause]) {
                    rootCauseMap[normalizedCause] = {
                        name: normalizedCause,
                        count: 0,
                        departmentSet: new Set(),
                        sourceSet: new Set(),
                    };
                }

                rootCauseMap[normalizedCause].count += 1;
                if (department) rootCauseMap[normalizedCause].departmentSet.add(department);
                if (sourceLabel) rootCauseMap[normalizedCause].sourceSet.add(sourceLabel);
            };

            ncData.forEach(record => {
                const department = record.department || record.requesting_unit || record.responsible_unit;
                registerRootCause(record?.five_why_analysis?.rootCause || record?.five_why_analysis?.why5, department, '5 Neden');
                registerRootCause(record?.fta_analysis?.rootCauses || record?.fta_analysis?.summary, department, 'FTA');
                registerRootCause(record?.eight_d_steps?.D4?.description || record?.eight_d_steps?.d4?.description, department, '8D D4');
                registerRootCause(record?.root_cause, department, 'DF/8D');
                registerRootCause(record?.rejection_reason, department, 'Ret Gerekçesi');
            });
            complaintAnalysesData.forEach(record => {
                const department = complaintData.find(item => item.id === record.complaint_id)?.responsible_department?.unit_name || 'Müşteri Şikayeti';
                registerRootCause(record?.root_cause, department, 'Şikayet Analizi');
            });
            const totalRootCauseCount = Object.values(rootCauseMap).reduce((sum, item) => sum + item.count, 0);
            let cumulativeRootCauseCount = 0;
            const rootCausePareto = Object.values(rootCauseMap)
                .sort((a, b) => b.count - a.count)
                .slice(0, 8)
                .map(item => {
                    cumulativeRootCauseCount += item.count;
                    return {
                        name: item.name,
                        count: item.count,
                        share: totalRootCauseCount > 0 ? Math.round((item.count / totalRootCauseCount) * 100) : 0,
                        cumulativeShare: totalRootCauseCount > 0 ? Math.round((cumulativeRootCauseCount / totalRootCauseCount) * 100) : 0,
                        departmentCount: item.departmentSet.size,
                        sources: Array.from(item.sourceSet).join(', '),
                    };
                });

            const unitIssueCountMap = {};
            ncRecordsData.forEach(record => {
                const unit = record.department || record.detection_area || 'Belirtilmemiş';
                unitIssueCountMap[unit] = (unitIssueCountMap[unit] || 0) + (Number(record.quantity) || 1);
            });
            Object.values(processFaultsMap).forEach(item => {
                unitIssueCountMap[item.name] = (unitIssueCountMap[item.name] || 0) + item.count;
            });
            const costByUnitArr = Object.entries(costByUnit)
                .map(([name, value]) => ({
                    name,
                    value,
                    issueCount: unitIssueCountMap[name] || 0,
                    recordCount: costRecordCountByUnit[name] || 0,
                    costPerIssue: (unitIssueCountMap[name] || 0) > 0 ? value / unitIssueCountMap[name] : null,
                }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 12);

            const copqByVehicleTypeArr = Object.values(vehicleTypeFaultsMap)
                .map(item => {
                    const cost = costVehicleTypeMap[item.name] || 0;
                    return {
                        name: item.name,
                        vehicleCount: item.vehicleCount,
                        faultCount: item.faultCount,
                        dpu: item.vehicleCount > 0 ? roundTo(item.faultCount / item.vehicleCount, 2) : 0,
                        cost,
                        costPerVehicle: item.vehicleCount > 0 ? roundTo(cost / item.vehicleCount, 0) : 0,
                    };
                })
                .filter(item => item.vehicleCount > 0 || item.cost > 0)
                .sort((a, b) => b.cost - a.cost || b.faultCount - a.faultCount)
                .slice(0, 8);

            const complaintByStatus = {};
            complaintData.forEach(c => { const st = c.status || 'Açık'; complaintByStatus[st] = (complaintByStatus[st] || 0) + 1; });
            const complaintMonthly = {};
            complaintData.forEach(c => {
                if (!c.complaint_date || !isValid(parseISO(c.complaint_date))) return;
                const month = format(parseISO(c.complaint_date), 'MMM yy', { locale: tr });
                if (!complaintMonthly[month]) complaintMonthly[month] = { name: month, sayi: 0, sort: parseISO(c.complaint_date).getTime() };
                complaintMonthly[month].sayi++;
            });
            const complaintActionsByStatus = {};
            complaintActionsData.forEach(action => {
                const status = action.status || 'Planlandı';
                complaintActionsByStatus[status] = (complaintActionsByStatus[status] || 0) + 1;
            });
            const complaintAnalysesByType = {};
            complaintAnalysesData.forEach(analysis => {
                const type = analysis.analysis_type || 'Belirtilmemiş';
                complaintAnalysesByType[type] = (complaintAnalysesByType[type] || 0) + 1;
            });
            const overdueComplaintActions = complaintActionsData.filter(action =>
                action.planned_end_date &&
                isValid(parseISO(action.planned_end_date)) &&
                parseISO(action.planned_end_date) < today &&
                action.status !== 'Tamamlandı'
            );

            const deptStats = {};
            ncData.forEach(nc => {
                if (nc.status === 'Reddedildi') return;
                const dept = nc.requesting_unit || nc.department || 'Belirtilmemiş';
                if (!deptStats[dept]) deptStats[dept] = { name: dept, toplam: 0, acik: 0, kapali: 0 };
                deptStats[dept].toplam++;
                if (nc.status === 'Kapatıldı') deptStats[dept].kapali++;
                else deptStats[dept].acik++;
            });
            const qualityWallArr = Object.values(deptStats)
                .filter(d => d.toplam > 0)
                .map(d => ({ ...d, kapatmaOrani: ((d.kapali / d.toplam) * 100).toFixed(0) }))
                .sort((a, b) => b.toplam - a.toplam).slice(0, 12);

            const overdueNC = (raw.nonConformities || [])
                .filter(nc => nc.status !== 'Kapatıldı' && nc.status !== 'Reddedildi' && !nc.supplier_id && (nc.due_at || nc.target_close_date))
                .map(nc => {
                    const due = nc.due_at || nc.target_close_date;
                    const rootCause = getRootCauseText(nc);
                    return {
                        ...nc,
                        rootCause,
                        gecikme: due && isValid(parseISO(due)) ? differenceInDays(new Date(), parseISO(due)) : 0,
                    };
                })
                .filter(nc => nc.gecikme > 0)
                .sort((a, b) => b.gecikme - a.gecikme);

            const openNCAll = (raw.nonConformities || [])
                .filter(nc => nc.status !== 'Kapatıldı' && nc.status !== 'Reddedildi' && !nc.supplier_id)
                .map(nc => {
                    const due = nc.due_at || nc.target_close_date;
                    const gecikme = due && isValid(parseISO(due)) ? differenceInDays(new Date(), parseISO(due)) : null;
                    return { ...nc, gecikme: gecikme !== null && gecikme > 0 ? gecikme : null };
                })
                .sort((a, b) => {
                    if (a.gecikme && b.gecikme) return b.gecikme - a.gecikme;
                    if (a.gecikme) return -1;
                    if (b.gecikme) return 1;
                    return new Date(b.created_at) - new Date(a.created_at);
                });
            const openNC = openNCAll.slice(0, 20);

            const activeQuarantine = (raw.quarantineRecords || [])
                .filter(q => q.status === 'Karantinada')
                .map(record => {
                    const quarantineDate = record.quarantine_date && isValid(parseISO(record.quarantine_date))
                        ? parseISO(record.quarantine_date)
                        : null;
                    return {
                        ...record,
                        report_reason: getQuarantineReasonText(record),
                        quarantine_duration_days: quarantineDate ? Math.max(differenceInDays(today, quarantineDate), 0) : null,
                    };
                })
                .sort((a, b) => new Date(b.quarantine_date || 0) - new Date(a.quarantine_date || 0));
            const inQuarantine = activeQuarantine.length;

            const kaizenByStatus = {};
            kaizenData.forEach(k => { const st = k.status || 'Belirtilmemiş'; kaizenByStatus[st] = (kaizenByStatus[st] || 0) + 1; });
            const kaizenByStatusArr = Object.entries(kaizenByStatus).map(([name, value]) => ({ name, value }));

            const kaizenByDept = {};
            kaizenData.forEach(k => {
                const dept = k.department?.unit_name || 'Belirtilmemiş';
                if (!kaizenByDept[dept]) kaizenByDept[dept] = { name: dept.slice(0, 20), tamamlanan: 0, devamEden: 0 };
                if (k.status === 'Tamamlandı') kaizenByDept[dept].tamamlanan++;
                else kaizenByDept[dept].devamEden++;
            });
            const kaizenByDeptArr = Object.values(kaizenByDept).sort((a, b) => (b.tamamlanan + b.devamEden) - (a.tamamlanan + a.devamEden)).slice(0, 8);

            const deviationByStatus = {};
            const deviationByUnit = {};
            deviationData.forEach(d => {
                const st = d.status || 'Açık';
                deviationByStatus[st] = (deviationByStatus[st] || 0) + 1;
                const unit = d.requesting_unit || 'Belirtilmemiş';
                deviationByUnit[unit] = (deviationByUnit[unit] || 0) + 1;
            });
            const deviationByStatusArr = Object.entries(deviationByStatus).map(([name, value]) => ({ name, value }));
            const deviationByUnitArr = Object.entries(deviationByUnit).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
            const deviationDetails = deviationData
                .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
                .slice(0, 8)
                .map(item => ({
                    requestNo: item.request_no || '—',
                    createdAt: item.created_at,
                    status: item.status || '—',
                    source: item.source || item.source_type || item.deviation_type || '—',
                    unit: item.requesting_unit || '—',
                    requester: item.requesting_person || '—',
                    partCode: item.part_code || item.source_record_details?.part_code || '—',
                    partName: item.part_name || item.source_record_details?.part_name || '—',
                    vehicleType: item.vehicle_type || '—',
                    description: item.description || item.deviation_reason || '—',
                }));

            const finalFaultCostMonthly = {};
            costData
                .filter(cost =>
                    cost.source_type === 'produced_vehicle_final_faults' ||
                    cost.cost_type === 'Final Hataları Maliyeti'
                )
                .forEach(cost => {
                    const dateStr = cost.cost_date || cost.created_at;
                    if (!dateStr || !isValid(parseISO(dateStr))) return;

                    const month = format(parseISO(dateStr), 'MMM yy', { locale: tr });
                    if (!finalFaultCostMonthly[month]) {
                        finalFaultCostMonthly[month] = {
                            name: month,
                            toplam: 0,
                            sort: parseISO(dateStr).getTime(),
                        };
                    }
                    finalFaultCostMonthly[month].toplam += toNumber(cost.amount);
                });
            const finalFaultCostMonthlyArr = Object.values(finalFaultCostMonthly)
                .sort((a, b) => a.sort - b.sort)
                .slice(-6);

            const fixtureToday = startOfDay(new Date());
            const fixtureDueSoonLimit = addDays(fixtureToday, 30);
            const fixtureStatusCounts = {};
            const fixtureDepartmentCounts = {};
            const fixtureVerificationEvents = [];
            const fixtureNonconformityEvents = [];

            fixtureRows.forEach(fixture => {
                const status = fixture.status || 'Belirtilmemiş';
                fixtureStatusCounts[status] = (fixtureStatusCounts[status] || 0) + 1;

                const department = fixture.responsible_department || 'Belirtilmemiş';
                fixtureDepartmentCounts[department] = (fixtureDepartmentCounts[department] || 0) + 1;

                (fixture.fixture_verifications || []).forEach(verification => {
                    fixtureVerificationEvents.push({
                        fixtureNo: fixture.fixture_no || '—',
                        partCode: fixture.part_code || '—',
                        partName: fixture.part_name || '—',
                        criticalityClass: fixture.criticality_class || '—',
                        department,
                        result: verification.result || '—',
                        verificationType: verification.verification_type || '—',
                        verificationDate: verification.verification_date || verification.created_at,
                        sampleCount: verification.sample_count || fixture.sample_count_required || 0,
                        verifiedBy: verification.verified_by || '—',
                    });
                });

                (fixture.fixture_nonconformities || []).forEach(item => {
                    fixtureNonconformityEvents.push({
                        fixtureNo: fixture.fixture_no || '—',
                        partCode: fixture.part_code || '—',
                        partName: fixture.part_name || '—',
                        criticalityClass: fixture.criticality_class || '—',
                        department,
                        status: item.correction_status || 'Beklemede',
                        detectionDate: item.detection_date || item.created_at,
                        correctionDescription: item.correction_description || '',
                    });
                });
            });

            const fixtureActive = fixtureRows.filter(f => f.status === 'Aktif').length;
            const fixtureCritical = fixtureRows.filter(f => f.criticality_class === 'Kritik').length;
            const fixturePendingActivation = fixtureRows.filter(f => f.status === 'Devreye Alma Bekleniyor').length;
            const fixtureRevisionPending = fixtureRows.filter(f => f.status === 'Revizyon Beklemede').length;
            const fixtureNonconformant = fixtureRows.filter(f => f.status === 'Uygunsuz').length;
            const fixtureScrapped = fixtureRows.filter(f => f.status === 'Hurdaya Ayrılmış').length;
            const fixtureNeverVerified = fixtureRows.filter(f => !f.last_verification_date).length;
            const fixtureOverdue = fixtureRows.filter(f => {
                if (f.status !== 'Aktif' || !f.next_verification_date || !isValid(parseISO(f.next_verification_date))) return false;
                return parseISO(f.next_verification_date) < fixtureToday;
            });
            const fixtureDueSoon = fixtureRows.filter(f => {
                if (f.status !== 'Aktif' || !f.next_verification_date || !isValid(parseISO(f.next_verification_date))) return false;
                const nextDate = parseISO(f.next_verification_date);
                return nextDate >= fixtureToday && nextDate <= fixtureDueSoonLimit;
            });
            const fixtureOpenCorrectiveActions = fixtureNonconformityEvents.filter(item => !['Tamamlandı', 'Hurdaya Ayrıldı'].includes(item.status)).length;
            const fixturePeriodVerifications = fixtureVerificationEvents.filter(item =>
                inDateRange(item.verificationDate, startDate, endDate)
            );
            const fixturePassedInPeriod = fixturePeriodVerifications.filter(item => item.result === 'Uygun').length;
            const fixtureFailedInPeriod = fixturePeriodVerifications.filter(item => item.result !== 'Uygun').length;
            const fixtureVerificationPassRate = fixturePeriodVerifications.length > 0
                ? Math.round((fixturePassedInPeriod / fixturePeriodVerifications.length) * 100)
                : null;
            const fixtureUrgentItems = fixtureRows
                .map(fixture => {
                    const nextDate = fixture.next_verification_date && isValid(parseISO(fixture.next_verification_date))
                        ? parseISO(fixture.next_verification_date)
                        : null;
                    const daysToVerification = nextDate ? differenceInDays(nextDate, fixtureToday) : null;
                    const openIssues = (fixture.fixture_nonconformities || []).filter(item => !['Tamamlandı', 'Hurdaya Ayrıldı'].includes(item.correction_status)).length;
                    const isOverdue = fixture.status === 'Aktif' && nextDate && nextDate < fixtureToday;
                    const isDueSoon = fixture.status === 'Aktif' && nextDate && nextDate >= fixtureToday && nextDate <= fixtureDueSoonLimit;

                    let priority = 0;
                    let alertText = '';

                    if (fixture.status === 'Uygunsuz') {
                        priority += 120;
                        alertText = 'Doğrulama sonucu uygunsuz';
                    } else if (fixture.status === 'Revizyon Beklemede') {
                        priority += 100;
                        alertText = 'Revizyon onayı bekliyor';
                    } else if (fixture.status === 'Devreye Alma Bekleniyor') {
                        priority += 90;
                        alertText = 'Devreye alma / ilk doğrulama bekliyor';
                    }

                    if (isOverdue) {
                        priority += fixture.criticality_class === 'Kritik' ? 110 : 75;
                        alertText = `Doğrulama ${Math.abs(daysToVerification)} gün geçti`;
                    } else if (isDueSoon) {
                        priority += fixture.criticality_class === 'Kritik' ? 65 : 35;
                        if (!alertText) {
                            alertText = `Doğrulama ${daysToVerification} gün içinde`;
                        }
                    }

                    if (openIssues > 0) {
                        priority += openIssues * 8;
                        alertText = alertText
                            ? `${alertText} · ${openIssues} açık aksiyon`
                            : `${openIssues} açık düzeltme aksiyonu`;
                    }

                    if (!priority) return null;

                    return {
                        fixtureNo: fixture.fixture_no || '—',
                        partCode: fixture.part_code || '—',
                        partName: fixture.part_name || '—',
                        class: fixture.criticality_class || '—',
                        status: fixture.status || '—',
                        nextVerificationDate: fixture.next_verification_date,
                        daysToVerification,
                        department: fixture.responsible_department || 'Belirtilmemiş',
                        alert: alertText || 'Takip gerekli',
                        sampleCount: fixture.sample_count_required || 0,
                        openIssues,
                        priority,
                    };
                })
                .filter(Boolean)
                .sort((a, b) => b.priority - a.priority)
                .slice(0, 10);
            const fixtureRecentVerifications = fixtureVerificationEvents
                .sort((a, b) => new Date(b.verificationDate || 0) - new Date(a.verificationDate || 0))
                .slice(0, 8);
            const fixtureRecentNonconformities = fixtureNonconformityEvents
                .filter(item => !['Tamamlandı', 'Hurdaya Ayrıldı'].includes(item.status))
                .sort((a, b) => new Date(b.detectionDate || 0) - new Date(a.detectionDate || 0))
                .slice(0, 8);
            const fixtureVerificationQueue = fixtureRows
                .map(fixture => {
                    const nextDate = fixture.next_verification_date && isValid(parseISO(fixture.next_verification_date))
                        ? parseISO(fixture.next_verification_date)
                        : null;
                    let nextVerificationLabel = 'Planlanmadı';

                    if (fixture.status === 'Devreye Alma Bekleniyor') {
                        nextVerificationLabel = 'İlk doğrulama bekleniyor';
                    } else if (fixture.status === 'Hurdaya Ayrılmış') {
                        nextVerificationLabel = 'Hurdaya ayrıldı';
                    } else if (fixture.status === 'Revizyon Beklemede') {
                        nextVerificationLabel = 'Revizyon sonrası doğrulama';
                    } else if (nextDate) {
                        nextVerificationLabel = format(nextDate, 'dd.MM.yyyy', { locale: tr });
                    }

                    return {
                        fixtureNo: fixture.fixture_no || '—',
                        partCode: fixture.part_code || '—',
                        partName: fixture.part_name || '—',
                        class: fixture.criticality_class || '—',
                        status: fixture.status || '—',
                        nextVerificationDate: fixture.next_verification_date,
                        nextVerificationLabel,
                        daysRemaining: nextDate ? differenceInDays(nextDate, fixtureToday) : null,
                    };
                })
                .sort((a, b) => {
                    if (a.daysRemaining == null && b.daysRemaining == null) return a.fixtureNo.localeCompare(b.fixtureNo, 'tr');
                    if (a.daysRemaining == null) return 1;
                    if (b.daysRemaining == null) return -1;
                    return a.daysRemaining - b.daysRemaining;
                });
            const fixtureNextVerifications = fixtureVerificationQueue;
            const fixtureUpcomingVerifications = fixtureVerificationQueue
                .filter(item => item.daysRemaining != null && item.daysRemaining >= 0 && item.daysRemaining <= 30);
            const fixtureByStatus = Object.entries(fixtureStatusCounts)
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value);
            const fixtureByDepartment = Object.entries(fixtureDepartmentCounts)
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 8);

            const personnelByDept = {};
            personnelData.forEach(p => { const d = p.department || 'Belirtilmemiş'; personnelByDept[d] = (personnelByDept[d] || 0) + 1; });
            const personnelByDeptArr = Object.entries(personnelByDept).map(([name, value]) => ({ name: name.slice(0, 20), value })).sort((a, b) => b.value - a.value).slice(0, 8);

            const latestKpiMap = new Map();
            [...kpiRecordData]
                .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
                .forEach(kpi => {
                    const key = kpi.auto_kpi_id || kpi.metric_name || kpi.name || kpi.title || kpi.id;
                    if (!latestKpiMap.has(key)) {
                        latestKpiMap.set(key, kpi);
                    }
                });

            const kpiWatchList = Array.from(latestKpiMap.values())
                .map(kpi => {
                    const current = toNumber(kpi.current_value ?? kpi.actual_value ?? kpi.value);
                    const target = toNumber(kpi.target_value ?? kpi.target);
                    if (target <= 0) return null;
                    const direction = kpi.direction || kpi.trend_direction || 'decrease';
                    const isIncrease = direction === 'increase';
                    const achieved = isIncrease ? current >= target : current <= target;
                    const normalizedProgress = isIncrease
                        ? Math.min((current / target) * 100, 999)
                        : Math.min((target / Math.max(current, 0.0001)) * 100, 999);
                    const status = achieved ? 'Hedefte' : normalizedProgress >= 75 ? 'Risk' : 'Alarm';
                    return {
                        name: kpi.name || kpi.metric_name || kpi.title || 'KPI',
                        current,
                        target,
                        unit: kpi.unit || '',
                        status,
                        achieved,
                    };
                })
                .filter(Boolean)
                .sort((a, b) => {
                    const rank = { Alarm: 0, Risk: 1, Hedefte: 2 };
                    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
                    return Math.abs(b.target - b.current) - Math.abs(a.target - a.current);
                })
                .slice(0, 8);

            // Kalitenin yaptıkları metrikleri
            const incomingPlans = raw.incomingControlPlans || [];
            const processPlans = raw.processControlPlans || [];
            const totalIncomingControlPlans = incomingPlans.filter(p => p.is_current !== false).length || incomingPlans.length;
            const totalProcessControlPlans = processPlans.length;

            let totalControlMin = 0, totalReworkMin = 0, vehiclesWithControl = 0, vehiclesWithRework = 0;
            vehicleData.forEach(v => {
                const events = v.vehicle_timeline_events || [];
                if (events.length > 0) {
                    const ctrl = calculateInspectionDuration(events);
                    const rework = calculateReworkDuration(events);
                    if (ctrl > 0) {
                        totalControlMin += ctrl;
                        vehiclesWithControl++;
                    }
                    if (rework > 0) {
                        totalReworkMin += rework;
                        vehiclesWithRework++;
                    }
                }
            });
            const avgControlTimeMin = vehiclesWithControl > 0 ? Math.round(totalControlMin / vehiclesWithControl) : 0;
            const avgReworkTimeMin = vehiclesWithRework > 0 ? Math.round(totalReworkMin / vehiclesWithRework) : 0;
            const fmtDuration = (min) => min >= 60 ? `${Math.floor(min / 60)}sa ${min % 60}dk` : `${min} dk`;

            const auditIdToDept = new Map();
            (raw.audits || []).forEach(a => {
                const dept = a.department?.unit_name || 'Belirtilmemiş';
                auditIdToDept.set(a.id, dept);
            });
            const auditFindingsByDept = {};
            (raw.auditFindings || [])
                .filter(f => auditIdsInRange.has(f.audit_id))
                .forEach(f => {
                    const dept = auditIdToDept.get(f.audit_id) || 'Belirtilmemiş';
                    auditFindingsByDept[dept] = (auditFindingsByDept[dept] || 0) + 1;
                });
            const auditFindingsByDeptArr = Object.entries(auditFindingsByDept)
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 10);

            const supplierAuditDetails = [];
            (raw.suppliers || []).forEach(s => {
                (s.supplier_audit_plans || []).forEach(p => {
                    if (p.status === 'Tamamlandı' && inDateRange(p.actual_date || p.planned_date, startDate, endDate)) {
                        supplierAuditDetails.push({
                            supplierName: s.name || 'Belirtilmemiş',
                            date: p.actual_date || p.planned_date,
                            score: p.score,
                        });
                    }
                });
            });
            supplierAuditDetails.sort((a, b) => new Date(b.date) - new Date(a.date));

            const governanceSummary = [
                { label: 'Geciken DF / 8D', value: overdueNC.length, severity: overdueNC.length > 0 ? 'bad' : 'good' },
                { label: 'Geciken Kalibrasyon', value: overdueCalibrations.length, severity: overdueCalibrations.length > 0 ? 'bad' : 'good' },
                { label: 'Süresi Yaklaşan Doküman', value: expiringDocs.length, severity: expiringDocs.length > 0 ? 'warning' : 'good' },
                { label: 'Süresi Geçmiş Doküman', value: expiredDocs.length, severity: expiredDocs.length > 0 ? 'bad' : 'good' },
                { label: 'Şikayet Aksiyonu', value: complaintActionsData.length, severity: complaintActionsData.length > 0 ? 'warning' : 'good' },
                { label: 'Geciken Şikayet Aksiyonu', value: overdueComplaintActions.length, severity: overdueComplaintActions.length > 0 ? 'bad' : 'good' },
            ];

            setData({
                meta: { periodLabel, generatedAt: new Date().toISOString(), totalPersonnel: personnelData.length },
                kpis: {
                    openDF, open8D,
                    totalNc: ncData.length, closedNc, avgClosureDays,
                    totalCost,
                    totalCopq,
                    costPerVehicle: totalVehicles > 0 ? totalCost / totalVehicles : 0,
                    inQuarantine, totalQuarantine: inQuarantine,
                    openComplaints, totalComplaints: complaintData.length, slaOverdue,
                    totalIncoming, acceptedIncoming, conditionalIncoming, rejectedIncoming, pendingIncoming,
                    totalPartsInspected, totalPartsRejected,
                    incomingRejectionRate: parseFloat(incomingRejectionRate),
                    totalVehicles, passedVehicles, failedVehicles,
                    totalVehicleFaults,
                    vehiclePassRate: parseFloat(vehiclePassRate),
                    completedKaizen, activeKaizen, kaizenSavings, totalKaizen: kaizenData.length,
                    openDeviations, totalDeviations: deviationData.length,
                    completedAudits, openAuditFindings, totalAudits: auditData.length,
                    openTasks, overdueTasks,
                    overdueCalCount: overdueCalibrations.length,
                    expiringDocCount: expiringDocs.length,
                    expiredDocCount: expiredDocs.length,
                    activeSuppliers: approvedSuppliers.length,
                    approvedSuppliers: approvedSuppliers.length,
                    alternativeSuppliers: alternativeSuppliers.length,
                    totalSupplierNC: supplierNcData.length,
                    openSupplierNC: supplierNcData.filter(n => n.status !== 'Kapatıldı').length,
                    supplierOverallPPM: overallSupplierPpm,
                },
                ncByDept: ncByDeptArr,
                ncByType: ncByTypeArr,
                ncMonthly: ncMonthlyArr,
                costByType: costByTypeArr,
                costByUnit: costByUnitArr,
                costMonthly: costMonthlyArr,
                incoming: {
                    byResult: { Kabul: acceptedIncoming, 'Şartlı Kabul': conditionalIncoming, Ret: rejectedIncoming, Beklemede: pendingIncoming },
                    topRejectedSuppliers,
                    monthly: incomingMonthlyArr,
                },
                suppliers: {
                    approvedCount: approvedSuppliers.length,
                    alternativeCount: alternativeSuppliers.length,
                    evaluatedCount: supplierData.length,
                    gradeDistribution: gradeArr,
                    topSuppliersNC,
                    suppliersWithNCCount,
                    suppliersWithRejectionCount,
                    gradeABCount,
                    ppmBySupplier: supplierPpmArr,
                    overallPPM: overallSupplierPpm,
                    totalInspectedParts,
                    totalDefectiveParts,
                },
                vehicles: {
                    faultByCategory: faultByCategoryArr,
                    monthly: vehicleMonthlyArr,
                    topFaultyVehicles,
                    faultCostByVehicleType: costByVehicleTypeArr,
                    finalFaultCostMonthly: finalFaultCostMonthlyArr,
                    dpu,
                    recurringFaultRate,
                    byProcess: processFaultsArr,
                    copqByVehicleType: copqByVehicleTypeArr,
                    bestMonth: bestVehicleMonth,
                    worstMonth: worstVehicleMonth,
                },
                complaints: {
                    byStatus: Object.entries(complaintByStatus).map(([name, value]) => ({ name, value })),
                    monthly: Object.values(complaintMonthly).sort((a, b) => a.sort - b.sort).slice(-8),
                    analysesByType: Object.entries(complaintAnalysesByType).map(([name, value]) => ({ name, value })),
                    actionsByStatus: Object.entries(complaintActionsByStatus).map(([name, value]) => ({ name, value })),
                },
                kaizen: { byStatus: kaizenByStatusArr, byDept: kaizenByDeptArr },
                deviations: {
                    byStatus: deviationByStatusArr,
                    byUnit: deviationByUnitArr,
                    details: deviationDetails,
                },
                costBurden: {
                    byCategory: costCategoryArr,
                    bySource: costSourceArr,
                    byComponent: costComponentArr,
                    byVehicleType: costByVehicleTypeArr,
                    byCustomer: costByCustomerArr,
                    topDrivers: topCostDrivers,
                    topSource: costSourceArr[0] || null,
                    totalCopq,
                    costPerVehicle: totalVehicles > 0 ? totalCost / totalVehicles : 0,
                },
                nonconformityModule: {
                    total: ncRecordsData.length,
                    open: ncRecordsOpen,
                    closed: ncRecordClosed,
                    critical: ncRecordCritical,
                    dfSuggested: ncRecordDfSuggested,
                    eightDSuggested: ncRecordEightDSuggested,
                    converted: ncRecordConverted,
                    totalQuantity: ncRecordTotalQuantity,
                    byStatus: Object.entries(ncRecordsByStatus).map(([name, value]) => ({ name, value })),
                    bySeverity: Object.entries(ncRecordsBySeverity).map(([name, value]) => ({ name, value })),
                    topCategories: ncTopCategories,
                    topParts: ncTopParts,
                    responsibleLoad: ncResponsibleLoad,
                    suggestedItems: ncSuggestedItems,
                    openedItems: ncRecordsData
                        .filter(r => r.status === 'DF Açıldı' || r.status === '8D Açıldı')
                        .sort((a, b) => new Date(b.detection_date || b.created_at || 0) - new Date(a.detection_date || a.created_at || 0))
                        .slice(0, 10)
                        .map(r => ({
                            type: r.status === '8D Açıldı' ? '8D' : 'DF',
                            recordNumber: r.record_number || '—',
                            partCode: r.part_code || '—',
                            partName: r.part_name || '—',
                            description: r.description || '—',
                            severity: r.severity || '—',
                            quantity: Number(r.quantity) || 0,
                            area: r.detection_area || '—',
                            responsible: r.responsible_person || r.detected_by || '—',
                            detectionDate: r.detection_date || r.created_at,
                        })),
                    recentRecords: ncRecordsRecent,
                    rootCausePareto,
                },
                fixtureTracking: {
                    total: fixtureRows.length,
                    active: fixtureActive,
                    critical: fixtureCritical,
                    pendingActivation: fixturePendingActivation,
                    revisionPending: fixtureRevisionPending,
                    nonconformant: fixtureNonconformant,
                    scrapped: fixtureScrapped,
                    overdue: fixtureOverdue.length,
                    dueSoon: fixtureDueSoon.length,
                    neverVerified: fixtureNeverVerified,
                    openCorrectiveActions: fixtureOpenCorrectiveActions,
                    verificationsInPeriod: fixturePeriodVerifications.length,
                    passedInPeriod: fixturePassedInPeriod,
                    failedInPeriod: fixtureFailedInPeriod,
                    verificationPassRate: fixtureVerificationPassRate,
                    byStatus: fixtureByStatus,
                    byDepartment: fixtureByDepartment,
                    urgentItems: fixtureUrgentItems,
                    recentVerifications: fixtureRecentVerifications,
                    recentNonconformities: fixtureRecentNonconformities,
                    nextVerifications: fixtureNextVerifications,
                    upcomingVerifications: fixtureUpcomingVerifications,
                },
                qualityWall: qualityWallArr,
                overdueNC: overdueNC.slice(0, 8),
                openNC,
                openNCTotal: openNCAll.length,
                openNCGeciken: openNCAll.filter(n => n.gecikme).length,
                activeQuarantine,
                overdueCalibrations: overdueCalibrations.slice(0, 8),
                personnelByDept: personnelByDeptArr,
                governance: {
                    summary: governanceSummary,
                    overdueTasks: overdueTaskList.slice(0, 8),
                    expiringDocs,
                    expiredDocs,
                    kpiWatch: kpiWatchList,
                    complaintActions: {
                        total: complaintActionsData.length,
                        completed: complaintActionsData.filter(action => action.status === 'Tamamlandı').length,
                        overdue: overdueComplaintActions.length,
                        actualCost: complaintActionsData.reduce((sum, action) => sum + toNumber(action.actual_cost), 0),
                        estimatedCost: complaintActionsData.reduce((sum, action) => sum + toNumber(action.estimated_cost), 0),
                    },
                    complaintAnalyses: {
                        total: complaintAnalysesData.length,
                        byType: Object.entries(complaintAnalysesByType).map(([name, value]) => ({ name, value })),
                    },
                },
                qualityActivities: {
                    totalIncomingControlPlans,
                    totalProcessControlPlans,
                    totalControlPlans: totalIncomingControlPlans + totalProcessControlPlans,
                    avgControlTimeMin,
                    avgReworkTimeMin,
                    avgControlTimeFormatted: fmtDuration(avgControlTimeMin),
                    avgReworkTimeFormatted: fmtDuration(avgReworkTimeMin),
                    vehiclesWithControl,
                    vehiclesWithRework,
                    completedInternalAudits: completedAudits,
                    auditFindingsByDept: auditFindingsByDeptArr,
                    supplierAuditsCompleted: supplierAuditDetails.length,
                    supplierAuditDetails,
                    completedTrainings,
                    plannedTrainings,
                    totalTrainings: trainingData.length,
                    trainingDetails,
                },
            });
        } catch (err) {
            setError('A3 Rapor verileri işlenirken hata: ' + (err.message || String(err)));
            console.error('useA3ReportData error:', err);
        } finally {
            setLoading(false);
        }
    }, [
        ctx.loading, ctx.nonConformities, ctx.nonconformityRecords, ctx.qualityCosts, ctx.quarantineRecords, ctx.incomingInspections,
        ctx.producedVehicles, ctx.productionDepartments, ctx.customerComplaints, ctx.kaizenEntries, ctx.deviations, ctx.equipments,
        ctx.audits, ctx.auditFindings, ctx.personnel, ctx.tasks, ctx.documents, ctx.kpis,
        ctx.suppliers, ctx.supplierNonConformities, ctx.complaintAnalyses, ctx.complaintActions,
        ctx.incomingControlPlans, ctx.processControlPlans, ctx.trainings,
        startDate, endDate
    ]);

    useEffect(() => {
        if (!ctx.loading) processData();
    }, [processData, ctx.loading]);

    const loadingState = ctx.loading || loading;

    return { data, loading: loadingState, error, periodLabel };
};

export default useA3ReportData;
