import { useState, useEffect, useCallback, useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import {
    subMonths, startOfYear, endOfYear, format, differenceInDays,
    parseISO, isValid, startOfDay, endOfDay
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

    const processData = useCallback(() => {
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
                customerComplaints: ctx.customerComplaints || [],
                kaizenEntries: ctx.kaizenEntries || [],
                deviations: ctx.deviations || [],
                equipments: ctx.equipments || [],
                audits: ctx.audits || [],
                auditFindings: ctx.auditFindings || [],
                personnel: ctx.personnel || [],
                tasks: ctx.tasks || [],
                suppliers: ctx.suppliers || [],
                supplierNonConformities: ctx.supplierNonConformities || [],
                incomingControlPlans: ctx.incomingControlPlans || [],
                processControlPlans: ctx.processControlPlans || [],
                trainings: ctx.trainings || [],
            };

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
            const ncRecordsRecent = ncRecordsData
                .sort((a, b) => new Date(b.detection_date || b.created_at || 0) - new Date(a.detection_date || a.created_at || 0))
                .slice(0, 15)
                .map(r => ({
                    tarih: r.detection_date || r.created_at,
                    parca: r.part_code || r.part_name || '—',
                    aciklama: (r.description || '').slice(0, 40),
                    kategori: r.category || '—',
                    alan: r.detection_area || '—',
                    onem: r.severity || '—',
                    durum: r.status || '—',
                    sorumlu: r.responsible_person || r.department || '—',
                }));
            const costData = raw.qualityCosts.filter(c =>
                inDateRange(c.cost_date || c.created_at, startDate, endDate)
            );
            const quarantineData = raw.quarantineRecords.filter(q =>
                inDateRange(q.quarantine_date || q.created_at, startDate, endDate)
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
            const taskData = raw.tasks.filter(t =>
                inDateRange(t.created_at, startDate, endDate)
            );
            const supplierData = (raw.suppliers || []).filter(s => ['Onaylı', 'Alternatif'].includes(s.status));
            const supplierNcData = (raw.supplierNonConformities || []).filter(nc =>
                inDateRange(nc.created_at, startDate, endDate)
            );
            const personnelData = (raw.personnel || []).filter(p => p.is_active !== false);
            const equipmentData = raw.equipments || [];
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

            const openTasks   = taskData.filter(t => t.status !== 'Tamamlandı' && t.status !== 'İptal').length;
            const overdueTasks = taskData.filter(t =>
                t.status !== 'Tamamlandı' && t.due_date && new Date() > parseISO(t.due_date)
            ).length;

            const overdueCalibrations = [];
            equipmentData.forEach(eq => {
                (eq.equipment_calibrations || []).forEach(cal => {
                    if (cal && cal.next_calibration_date && isValid(parseISO(cal.next_calibration_date))) {
                        const daysOver = differenceInDays(new Date(), parseISO(cal.next_calibration_date));
                        if (daysOver > 0) overdueCalibrations.push({ cihaz: eq.name, tarih: cal.next_calibration_date, gecikme: daysOver });
                    }
                });
            });

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
            costData.forEach(c => {
                const type = c.cost_type || 'Belirtilmemiş';
                costByType[type] = (costByType[type] || 0) + (c.amount || 0);
                const unit = c.unit || c.responsible_unit || 'Belirtilmemiş';
                costByUnit[unit] = (costByUnit[unit] || 0) + (c.amount || 0);
            });
            const costByTypeArr = Object.entries(costByType).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
            const costByUnitArr = Object.entries(costByUnit).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 12);

            const costMonthly = {};
            costData.forEach(c => {
                if (!c.cost_date || !isValid(parseISO(c.cost_date))) return;
                const month = format(parseISO(c.cost_date), 'MMM yy', { locale: tr });
                if (!costMonthly[month]) costMonthly[month] = { name: month, toplam: 0, sort: parseISO(c.cost_date).getTime() };
                costMonthly[month].toplam += c.amount || 0;
            });
            const costMonthlyArr = Object.values(costMonthly).sort((a, b) => a.sort - b.sort);

            const gradeDistribution = { A: 0, B: 0, C: 0, D: 0, 'N/A': 0 };
            supplierData.forEach(s => {
                const latest = s.supplier_scores?.sort((a, b) => new Date(b.period || 0) - new Date(a.period || 0))[0];
                const g = latest?.grade;
                if (g && Object.prototype.hasOwnProperty.call(gradeDistribution, g)) gradeDistribution[g]++;
                else gradeDistribution['N/A']++;
            });
            const gradeArr = Object.entries(gradeDistribution).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));

            const supplierIdToName = new Map((raw.suppliers || []).map(s => [s.id, s.name]));
            const supplierNcByName = {};
            supplierNcData.forEach(nc => {
                const name = nc.supplier?.name || supplierIdToName.get(nc.supplier_id) || 'Belirtilmemiş';
                if (!supplierNcByName[name]) supplierNcByName[name] = { open: 0, closed: 0 };
                if (nc.status === 'Kapatıldı') supplierNcByName[name].closed++;
                else supplierNcByName[name].open++;
            });
            const topSuppliersNC = Object.entries(supplierNcByName)
                .map(([name, v]) => ({ name: name.slice(0, 22), count: v.open + v.closed, open: v.open }))
                .sort((a, b) => b.count - a.count).slice(0, 8);

            const rejectedBySupplier = {};
            incomingData.filter(i => i.decision === 'Ret').forEach(i => {
                const sup = i.supplier_name || 'Belirtilmemiş';
                rejectedBySupplier[sup] = (rejectedBySupplier[sup] || 0) + 1;
            });
            const topRejectedSuppliers = Object.entries(rejectedBySupplier)
                .map(([name, count]) => ({ name: name.slice(0, 22), count }))
                .sort((a, b) => b.count - a.count).slice(0, 8);

            const suppliersWithNCCount = Object.keys(supplierNcByName).length;
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

            const faultByCategory = {};
            vehicleData.forEach(v => {
                (v.quality_inspection_faults || []).forEach(f => {
                    const cat = f.fault_category?.name || f.fault_type || 'Belirtilmemiş';
                    if (!faultByCategory[cat]) faultByCategory[cat] = { name: cat.slice(0, 22), count: 0, vehicleSet: new Set() };
                    faultByCategory[cat].count  += f.quantity || 1;
                    faultByCategory[cat].vehicleSet.add(v.id);
                });
            });
            const faultByCategoryArr = Object.values(faultByCategory)
                .map(f => ({ name: f.name, count: f.count, aracSayisi: f.vehicleSet.size }))
                .sort((a, b) => b.count - a.count).slice(0, 15);

            const vehicleMonthly = {};
            vehicleData.forEach(v => {
                if (!v.created_at || !isValid(parseISO(v.created_at))) return;
                const month = format(parseISO(v.created_at), 'MMM yy', { locale: tr });
                if (!vehicleMonthly[month]) vehicleMonthly[month] = { name: month, toplam: 0, gecti: 0, sort: parseISO(v.created_at).getTime() };
                vehicleMonthly[month].toplam++;
                if ((v.quality_inspection_faults || []).length === 0) vehicleMonthly[month].gecti++;
            });
            const vehicleMonthlyArr = Object.values(vehicleMonthly).sort((a, b) => a.sort - b.sort).slice(-8);

            const complaintByStatus = {};
            complaintData.forEach(c => { const st = c.status || 'Açık'; complaintByStatus[st] = (complaintByStatus[st] || 0) + 1; });
            const complaintMonthly = {};
            complaintData.forEach(c => {
                if (!c.complaint_date || !isValid(parseISO(c.complaint_date))) return;
                const month = format(parseISO(c.complaint_date), 'MMM yy', { locale: tr });
                if (!complaintMonthly[month]) complaintMonthly[month] = { name: month, sayi: 0, sort: parseISO(c.complaint_date).getTime() };
                complaintMonthly[month].sayi++;
            });

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

            const overdueNC = ncData
                .filter(nc => nc.status !== 'Kapatıldı' && (nc.due_at || nc.target_close_date))
                .map(nc => {
                    const due = nc.due_at || nc.target_close_date;
                    return { ...nc, gecikme: isValid(parseISO(due)) ? differenceInDays(new Date(), parseISO(due)) : 0 };
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

            const personnelByDept = {};
            personnelData.forEach(p => { const d = p.department || 'Belirtilmemiş'; personnelByDept[d] = (personnelByDept[d] || 0) + 1; });
            const personnelByDeptArr = Object.entries(personnelByDept).map(([name, value]) => ({ name: name.slice(0, 20), value })).sort((a, b) => b.value - a.value).slice(0, 8);

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

            setData({
                meta: { periodLabel, generatedAt: new Date().toISOString(), totalPersonnel: personnelData.length },
                kpis: {
                    openDF, open8D,
                    totalNc: ncData.length, closedNc, avgClosureDays,
                    totalCost,
                    inQuarantine, totalQuarantine: inQuarantine,
                    openComplaints, totalComplaints: complaintData.length, slaOverdue,
                    totalIncoming, acceptedIncoming, conditionalIncoming, rejectedIncoming, pendingIncoming,
                    totalPartsInspected, totalPartsRejected,
                    incomingRejectionRate: parseFloat(incomingRejectionRate),
                    totalVehicles, passedVehicles, failedVehicles,
                    vehiclePassRate: parseFloat(vehiclePassRate),
                    completedKaizen, activeKaizen, kaizenSavings, totalKaizen: kaizenData.length,
                    openDeviations, totalDeviations: deviationData.length,
                    completedAudits, openAuditFindings, totalAudits: auditData.length,
                    openTasks, overdueTasks,
                    overdueCalCount: overdueCalibrations.length,
                    activeSuppliers: supplierData.length,
                    totalSupplierNC: supplierNcData.length,
                    openSupplierNC: supplierNcData.filter(n => n.status !== 'Kapatıldı').length,
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
                    gradeDistribution: gradeArr,
                    topSuppliersNC,
                    suppliersWithNCCount,
                    suppliersWithRejectionCount,
                    gradeABCount,
                },
                vehicles: { faultByCategory: faultByCategoryArr, monthly: vehicleMonthlyArr },
                complaints: {
                    byStatus: Object.entries(complaintByStatus).map(([name, value]) => ({ name, value })),
                    monthly: Object.values(complaintMonthly).sort((a, b) => a.sort - b.sort).slice(-8),
                },
                kaizen: { byStatus: kaizenByStatusArr, byDept: kaizenByDeptArr },
                deviations: { byStatus: deviationByStatusArr, byUnit: deviationByUnitArr },
                nonconformityModule: {
                    total: ncRecordsData.length,
                    open: ncRecordsOpen,
                    byStatus: Object.entries(ncRecordsByStatus).map(([name, value]) => ({ name, value })),
                    bySeverity: Object.entries(ncRecordsBySeverity).map(([name, value]) => ({ name, value })),
                    recentRecords: ncRecordsRecent,
                },
                qualityWall: qualityWallArr,
                overdueNC: overdueNC.slice(0, 8),
                openNC,
                openNCTotal: openNCAll.length,
                openNCGeciken: openNCAll.filter(n => n.gecikme).length,
                activeQuarantine,
                overdueCalibrations: overdueCalibrations.sort((a, b) => b.gecikme - a.gecikme).slice(0, 8),
                personnelByDept: personnelByDeptArr,
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
        ctx.producedVehicles, ctx.customerComplaints, ctx.kaizenEntries, ctx.deviations, ctx.equipments,
        ctx.audits, ctx.auditFindings, ctx.personnel, ctx.tasks, ctx.suppliers, ctx.supplierNonConformities,
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
