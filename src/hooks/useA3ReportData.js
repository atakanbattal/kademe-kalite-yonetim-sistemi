import { useState, useEffect, useCallback, useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { supabase } from '@/lib/customSupabaseClient';
import {
    subMonths, startOfYear, endOfYear, format, differenceInDays,
    parseISO, isValid, startOfDay, endOfDay, addDays, startOfMonth, endOfMonth,
    eachMonthOfInterval,
} from 'date-fns';
import { tr } from 'date-fns/locale';
import { calculateInspectionDuration, calculateReworkDuration } from '@/lib/vehicleCostCalculator';
import { fetchExecutiveReportSupplement, fetchEquipmentsWithCalibrationsPaginated } from '@/lib/fetchExecutiveReportSupplement';
import { getOverdueCalibrationsFromEquipments } from '@/lib/overdueCalibrationsHelpers';
import { isNCOverdue } from '@/lib/statusUtils';
import { getAutoKpiDisplayMeta } from '@/components/kpi/kpi-definitions';

const EXT_DOC_CATEGORY_LABEL = {
    yasal_mevzuat: 'Yasal mevzuat',
    standartlar: 'Standartlar',
    musteri_dokumanlari: 'Müşteri dokümanları',
    tedarikci_kataloglari: 'Tedarikçi katalogları',
};

const QUALITY_GOAL_TYPE_LABEL = {
    DF_COUNT: 'DF sayısı',
    '8D_COUNT': '8D sayısı',
    QUALITY_COST: 'Kalite maliyeti',
    NC_CLOSURE_RATE: 'UY kapatma oranı',
    QUARANTINE_COUNT: 'Karantina',
    CUSTOM: 'Özel',
};

const CONTROL_FORM_RESULT_LABEL = {
    ONAY: 'Onay',
    SARTLI_KABUL: 'Şartlı kabul',
    RET: 'Ret',
};

/** KPI izleme: modüldeki tüm KPI satırları; önce Kalite & Uygunsuzluk, sonra diğerleri (alarm önceliği) */
const buildKpiWatchList = (latestKpiMap) => {
    const toEntry = (kpi) => {
        const meta = getAutoKpiDisplayMeta(kpi);
        const category = meta.category || kpi.category || '';
        const current = toNumber(kpi.current_value ?? kpi.actual_value ?? kpi.value);
        const target = toNumber(kpi.target_value ?? kpi.target);
        const direction = meta.target_direction ?? kpi.direction ?? kpi.trend_direction ?? 'decrease';
        const isIncrease = direction === 'increase';
        if (target <= 0) {
            return {
                name: kpi.name || kpi.metric_name || kpi.title || 'KPI',
                current,
                target: null,
                unit: (kpi.unit || '').trim(),
                auto_kpi_id: kpi.auto_kpi_id || null,
                status: 'Hedef yok',
                achieved: null,
                category,
            };
        }
        const achieved = isIncrease ? current >= target : current <= target;
        const normalizedProgress = isIncrease
            ? Math.min((current / target) * 100, 999)
            : Math.min((target / Math.max(current, 0.0001)) * 100, 999);
        const status = achieved ? 'Hedefte' : normalizedProgress >= 75 ? 'Risk' : 'Alarm';
        return {
            name: kpi.name || kpi.metric_name || kpi.title || 'KPI',
            current,
            target,
            unit: (kpi.unit || '').trim(),
            auto_kpi_id: kpi.auto_kpi_id || null,
            status,
            achieved,
            category,
        };
    };
    const all = Array.from(latestKpiMap.values()).map(toEntry).filter(Boolean);
    const rank = { Alarm: 0, Risk: 1, Hedefte: 2, 'Hedef yok': 3 };
    const sortFn = (a, b) => {
        const ra = rank[a.status] ?? 9;
        const rb = rank[b.status] ?? 9;
        if (ra !== rb) return ra - rb;
        const da = Math.abs(toNumber(a.target) - toNumber(a.current));
        const db = Math.abs(toNumber(b.target) - toNumber(b.current));
        return db - da;
    };
    const quality = all.filter((e) => e.category === 'quality').sort(sortFn);
    const others = all.filter((e) => e.category !== 'quality').sort(sortFn);
    return [...quality, ...others];
};

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

const chunkArray = (arr, size) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
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
    'Hurda Maliyeti', 'Yeniden İşlem Maliyeti', 'Fire Maliyeti',
    'İç Kalite Kontrol Maliyeti', 'Final Hataları Maliyeti',
    'İç Hata Maliyeti', 'İç Hata Maliyetleri', 'İç Hata',
    'Hurda', 'Yeniden İşlem', 'Tedarikçi Hata Maliyeti',
];

const EXTERNAL_FAILURE_COST_TYPES = [
    'Garanti Maliyeti', 'İade Maliyeti', 'Şikayet Maliyeti',
    'Dış Hata Maliyeti', 'Dış Hata Maliyetleri', 'Dış Hata',
    'Müşteri Şikayeti', 'Müşteri Reklaması',
    'Geri Çağırma Maliyeti', 'Müşteri Kaybı Maliyeti',
];

const APPRAISAL_COST_TYPES = [
    'İç Kalite Kontrol Maliyeti', 'Değerlendirme Maliyeti',
    'Değerlendirme Maliyetleri', 'Kontrol Maliyeti',
    'Kontrol', 'Test', 'Muayene',
];

const PREVENTION_COST_TYPES = [
    'Önleme Maliyeti', 'Önleme Maliyetleri', 'Önleme',
    'Eğitim Maliyeti', 'Eğitim', 'Kalite Planlama',
];

const getCostCategory = (costType, isSupplierCost = false) => {
    if (!costType) return isSupplierCost ? 'internalFailure' : 'internalFailure';
    if (EXTERNAL_FAILURE_COST_TYPES.some(t => costType.includes(t))) return 'externalFailure';
    if (isSupplierCost || INTERNAL_FAILURE_COST_TYPES.some(t => costType.includes(t))) return 'internalFailure';
    if (APPRAISAL_COST_TYPES.some(t => costType.includes(t))) return 'appraisal';
    if (PREVENTION_COST_TYPES.some(t => costType.includes(t))) return 'prevention';
    return 'internalFailure';
};

// ── Birim ismi normalizasyonu ─────────────────────────────────────────────────
const DEPARTMENT_ALIASES = {
    'Depo': 'Depo Şefliği',
    'Depo / Lojistik': 'Depo Şefliği',
    'Depo Müdürlüğü': 'Depo Şefliği',
    'Lojistik': 'Depo Şefliği',
    'Lojistik Operasyon Yöneticiliği': 'Depo Şefliği',
    'Kalite Kontrol Ve Güvence': 'Kalite Müdürlüğü',
    'Kalite Kontrol': 'Kalite Müdürlüğü',
    'Kalite Güvence': 'Kalite Müdürlüğü',
    'Genel Müdürlük': 'Kademe Genel Müdürlüğü',
    'İnsan Kaynakları': 'İnsan Kaynakları Müdürlüğü',
    'Üretim Müdürlüğü (üst Yapı)': 'Üretim Müdürlüğü (Üst Yapı)',
    'Üretim Müdürlüğü (Üst yapı)': 'Üretim Müdürlüğü (Üst Yapı)',
    'üretim müdürlüğü (üst yapı)': 'Üretim Müdürlüğü (Üst Yapı)',
    'ÜRETIM MÜDÜRLÜĞÜ (ÜST YAPI)': 'Üretim Müdürlüğü (Üst Yapı)',
    'Üretim Müdürlüğü': 'Üretim Müdürlüğü',
    'ÜRETIM MÜDÜRLÜĞÜ': 'Üretim Müdürlüğü',
    'Ar-Ge Direktörlüğü': 'Ar-Ge Direktörlüğü',
    'AR-GE DİREKTÖRLÜĞÜ': 'Ar-Ge Direktörlüğü',
    'Kalite Kontrol Müdürlüğü': 'Kalite Müdürlüğü',
    'KALİTE KONTROL MÜDÜRLÜĞÜ': 'Kalite Müdürlüğü',
    'Satış Sonrası Hizmetler Şefliği': 'Satış Sonrası Hizmetler',
    'Satış Sonrası Hizmetler': 'Satış Sonrası Hizmetler',
    'Ar-Ge': 'Ar-Ge Direktörlüğü',
    'Üretim Planlama': 'Üretim Planlama Müdürlüğü',
    'Kalite': 'Kalite Müdürlüğü',
    'Kalite Birimi': 'Kalite Müdürlüğü',
    'İnsan Kaynakları ve Eğitim Müdürlüğü': 'İnsan Kaynakları Müdürlüğü',
    'İK Müdürlüğü': 'İnsan Kaynakları Müdürlüğü',
    // ASCII / yanlış yazılmış birim adları (veri kaynağı Türkçe karakter içermiyorsa)
    'Kalite Mudurlugu': 'Kalite Müdürlüğü',
    'Uretim Planlama Mudurlugu': 'Üretim Planlama Müdürlüğü',
    'Insan Kaynaklari Mudurlugu': 'İnsan Kaynakları Müdürlüğü',
    'Insan Kaynaklari': 'İnsan Kaynakları Müdürlüğü',
    'Depo Sefligi': 'Depo Şefliği',
};

/** Birleştirici nokta vb. (Kali̇te vs Kalite) farklarını giderir */
const stripCombiningMarks = (s) =>
    String(s)
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .normalize('NFC');

/** Türkçe küçük harf + slug; görünür aynı birimleri tek anahtarda toplar */
const DEPARTMENT_SLUG_TO_CANONICAL = {
    'kalite müdürlüğü': 'Kalite Müdürlüğü',
    'depo şefliği': 'Depo Şefliği',
    'insan kaynakları müdürlüğü': 'İnsan Kaynakları Müdürlüğü',
    'insan kaynakları': 'İnsan Kaynakları Müdürlüğü',
    'insan kaynaklari müdürlüğü': 'İnsan Kaynakları Müdürlüğü',
    'insan kaynaklari': 'İnsan Kaynakları Müdürlüğü',
    'insan kaynaklari mudurlugu': 'İnsan Kaynakları Müdürlüğü',
    'kalite mudurlugu': 'Kalite Müdürlüğü',
    'uretim planlama mudurlugu': 'Üretim Planlama Müdürlüğü',
    'depo sefligi': 'Depo Şefliği',
    'i̇nsan kaynakları müdürlüğü': 'İnsan Kaynakları Müdürlüğü',
    'i̇nsan kaynakları': 'İnsan Kaynakları Müdürlüğü',
};

/** Aynı görünen birim adlarını (Unicode NFD/NFC, fazla boşluk) tek anahtarda toplar */
const normalizeDepartment = (dept) => {
    if (!dept || dept === 'Belirtilmemiş') return 'Belirtilmemiş';
    let trimmed = String(dept).trim().replace(/\s+/g, ' ');
    trimmed = stripCombiningMarks(trimmed).normalize('NFKC');
    const slug = trimmed.toLocaleLowerCase('tr-TR');
    if (DEPARTMENT_SLUG_TO_CANONICAL[slug]) return DEPARTMENT_SLUG_TO_CANONICAL[slug];
    if (DEPARTMENT_ALIASES[trimmed]) return DEPARTMENT_ALIASES[trimmed];
    for (const [key, value] of Object.entries(DEPARTMENT_ALIASES)) {
        const k = stripCombiningMarks(key).normalize('NFKC');
        if (k.toLocaleLowerCase('tr-TR') === slug) return value;
    }
    // Son çare: "Mudurlugu" / "Sefligi" ASCII kalıpları (slug'da i/ı farkı)
    const slugAscii = slug.replace(/ı/g, 'i');
    if (slugAscii.endsWith(' mudurlugu')) {
        const base = slug.slice(0, -' mudurlugu'.length);
        const trySlug = `${base} müdürlüğü`;
        if (DEPARTMENT_SLUG_TO_CANONICAL[trySlug]) return DEPARTMENT_SLUG_TO_CANONICAL[trySlug];
        if (base === 'kalite') return 'Kalite Müdürlüğü';
        if (base === 'uretim planlama') return 'Üretim Planlama Müdürlüğü';
        if (base === 'insan kaynaklari' || base === 'insan kaynakları') return 'İnsan Kaynakları Müdürlüğü';
    }
    if (slugAscii === 'depo sefligi' || slug === 'depo şefliği') return 'Depo Şefliği';
    return trimmed.normalize('NFC');
};

const consolidateDeptPerfDf8d = (raw) => {
    const merged = {};
    Object.entries(raw || {}).forEach(([k, v]) => {
        const key = normalizeDepartment(k);
        if (!merged[key]) {
            merged[key] = {
                open: 0, closed: 0, overdue: 0, inProgress: 0, rejected: 0,
                totalClosureDays: 0, closedCount: 0, records: [],
            };
        }
        const t = merged[key];
        t.open += v.open; t.closed += v.closed; t.overdue += v.overdue;
        t.inProgress += v.inProgress; t.rejected += v.rejected;
        t.totalClosureDays += v.totalClosureDays; t.closedCount += v.closedCount;
        t.records.push(...(v.records || []));
    });
    return merged;
};

const consolidateRequesterContribDf8d = (raw) => {
    const merged = {};
    Object.entries(raw || {}).forEach(([k, v]) => {
        const key = normalizeDepartment(k);
        if (!merged[key]) {
            merged[key] = {
                total: 0, DF: 0, '8D': 0, MDI: 0, open: 0, closed: 0,
                inProgress: 0, rejected: 0, records: [],
            };
        }
        const t = merged[key];
        t.total += v.total; t.DF += v.DF; t['8D'] += v['8D']; t.MDI += v.MDI;
        t.open += v.open; t.closed += v.closed; t.inProgress += v.inProgress; t.rejected += v.rejected;
        t.records.push(...(v.records || []));
    });
    return merged;
};

/** Tablo satırlarında kalan yinelenen birim adlarını (Unicode vb.) tek satırda toplar */
const mergeDf8dResponsibleRows = (rows) => {
    const map = new Map();
    for (const r of rows) {
        const key = normalizeDepartment(r.unit);
        if (!map.has(key)) {
            map.set(key, {
                unit: key,
                total: 0,
                open: 0,
                closed: 0,
                inProgress: 0,
                rejected: 0,
                overdue: 0,
                sumClosureDaysWeighted: 0,
                closureForAvg: 0,
            });
        }
        const t = map.get(key);
        t.total += r.total;
        t.open += r.open;
        t.closed += r.closed;
        t.inProgress += r.inProgress;
        t.rejected += r.rejected;
        t.overdue += r.overdue;
        const avg = parseFloat(String(r.avgClosureTime).replace(',', '.'));
        if (!Number.isNaN(avg) && r.closed > 0) {
            t.sumClosureDaysWeighted += avg * r.closed;
            t.closureForAvg += r.closed;
        }
    }
    return Array.from(map.values())
        .map((t) => {
            const pipeline = t.open + t.closed;
            const closurePct = pipeline > 0 ? ((t.closed / pipeline) * 100).toFixed(1) : '—';
            const avgClosureTime = t.closureForAvg > 0 ? (t.sumClosureDaysWeighted / t.closureForAvg).toFixed(1) : '—';
            return {
                unit: t.unit,
                total: t.total,
                open: t.open,
                closed: t.closed,
                inProgress: t.inProgress,
                rejected: t.rejected,
                overdue: t.overdue,
                avgClosureTime,
                closurePct,
            };
        })
        .sort((a, b) => b.total - a.total);
};

const mergeDf8dRequesterRows = (rows, totalDf8dRequests) => {
    const map = new Map();
    for (const r of rows) {
        const key = normalizeDepartment(r.unit);
        if (!map.has(key)) {
            map.set(key, {
                unit: key,
                total: 0,
                DF: 0,
                '8D': 0,
                MDI: 0,
                open: 0,
                closed: 0,
                inProgress: 0,
                rejected: 0,
            });
        }
        const t = map.get(key);
        t.total += r.total;
        t.DF += r.DF;
        t['8D'] += r['8D'];
        t.MDI += r.MDI;
        t.open += r.open;
        t.closed += r.closed;
        t.inProgress += r.inProgress;
        t.rejected += r.rejected;
    }
    return Array.from(map.values())
        .map((t) => {
            const pctNum = totalDf8dRequests > 0 ? (t.total / totalDf8dRequests) * 100 : 0;
            return {
                ...t,
                contribution: totalDf8dRequests > 0 ? `${pctNum.toFixed(1)}%` : '0%',
                contributionPct: pctNum,
            };
        })
        .sort((a, b) => b.total - a.total);
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

const useA3ReportData = (period = 'last3months', options = {}) => {
    const { executiveReport = false, calendarYear, calendarMonth } = options;
    const ctx = useData();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const { startDate, endDate, periodLabel } = useMemo(() => {
        const now = new Date();
        let start;
        let end = endOfDay(now);
        let label = '';

        if (period === 'month' && calendarYear != null && calendarMonth != null) {
            const y = Number(calendarYear);
            const mo = Number(calendarMonth);
            if (Number.isFinite(y) && Number.isFinite(mo) && mo >= 1 && mo <= 12) {
                const d = new Date(y, mo - 1, 1);
                start = startOfDay(startOfMonth(d));
                end = endOfDay(endOfMonth(d));
                label = format(d, 'MMMM yyyy', { locale: tr });
                return { startDate: start, endDate: end, periodLabel: label };
            }
        }

        switch (period) {
            case 'last1month':  start = startOfDay(subMonths(now, 1));  label = 'Son 1 Ay';  break;
            case 'last3months': start = startOfDay(subMonths(now, 3));  label = 'Son 3 Ay';  break;
            case 'last6months': start = startOfDay(subMonths(now, 6));  label = 'Son 6 Ay';  break;
            case 'thisYear':    start = startOfYear(now); end = endOfYear(now); label = `${now.getFullYear()} Yılı`; break;
            default:            start = startOfDay(subMonths(now, 12)); label = 'Son 12 Ay'; break;
        }
        return { startDate: start, endDate: end, periodLabel: label };
    }, [period, calendarYear, calendarMonth]);

    const processData = useCallback(async () => {
        if (ctx.loading) return;
        setLoading(true);
        setError(null);

        try {
            let supplement = null;
            if (executiveReport) {
                try {
                    supplement = await fetchExecutiveReportSupplement({ startDate, endDate });
                } catch (supErr) {
                    console.warn('fetchExecutiveReportSupplement failed:', supErr);
                }
            }

            const XL = executiveReport ? 24 : 8;
            const XL2 = executiveReport ? 22 : 12;
            const XL3 = executiveReport ? 25 : 10;

            const raw = {
                nonConformities: (supplement?.nonConformities ?? ctx.nonConformities) || [],
                nonconformityRecords: (supplement?.nonconformityRecords ?? ctx.nonconformityRecords) || [],
                qualityCosts: ctx.qualityCosts || [],
                quarantineRecords: (supplement?.quarantineRecords ?? ctx.quarantineRecords) || [],
                incomingInspections: (supplement?.incomingInspections ?? ctx.incomingInspections) || [],
                producedVehicles: (supplement?.producedVehicles ?? ctx.producedVehicles) || [],
                productionDepartments: ctx.productionDepartments || [],
                customerComplaints: (supplement?.customerComplaints ?? ctx.customerComplaints) || [],
                kaizenEntries: ctx.kaizenEntries || [],
                deviations: ctx.deviations || [],
                equipments: (executiveReport && supplement?.equipments != null ? supplement.equipments : ctx.equipments) || [],
                audits: ctx.audits || [],
                auditFindings: ctx.auditFindings || [],
                personnel: ctx.personnel || [],
                tasks: ctx.tasks || [],
                documents: ctx.documents || [],
                kpis: ctx.kpis || [],
                suppliers: ctx.suppliers || [],
                supplierNonConformities: (supplement?.supplierNonConformities ?? ctx.supplierNonConformities) || [],
                incomingControlPlans: ctx.incomingControlPlans || [],
                processControlPlans: ctx.processControlPlans || [],
                trainings: (() => {
                    if (executiveReport && supplement && Array.isArray(supplement.trainingsRaw)) {
                        return supplement.trainingsRaw.filter((t) =>
                            inDateRange(t.start_date || t.end_date || t.created_at, startDate, endDate)
                        );
                    }
                    return ctx.trainings || [];
                })(),
                complaintAnalyses: ctx.complaintAnalyses || [],
                complaintActions: ctx.complaintActions || [],
                stockRiskControls: (supplement?.stockRiskControls ?? ctx.stockRiskControls) || [],
                inkrReports: ctx.inkrReports || [],
            };

            let qualityGoalsFetched = [];
            let processInspectionFetched = [];
            let controlFormExecFetched = [];
            try {
                const piLimit = executiveReport ? 1200 : 400;
                const cfLimit = executiveReport ? 1200 : 400;
                const goalYear = endDate.getFullYear();
                const [qgRes, piRes, cfRes] = await Promise.all([
                    supabase.from('quality_goals').select('*').eq('year', goalYear).order('goal_name'),
                    supabase.from('process_inspections').select('id, record_no, inspection_date, decision, part_code, part_name')
                        .gte('inspection_date', format(startDate, 'yyyy-MM-dd'))
                        .lte('inspection_date', format(endDate, 'yyyy-MM-dd'))
                        .order('inspection_date', { ascending: false })
                        .limit(piLimit),
                    supabase.from('control_form_executions').select('id, execution_no, result, inspection_date, created_at, serial_number, control_form_templates(name, document_no)')
                        .gte('created_at', startDate.toISOString())
                        .lte('created_at', endDate.toISOString())
                        .order('created_at', { ascending: false })
                        .limit(cfLimit),
                ]);
                if (!qgRes.error && qgRes.data) qualityGoalsFetched = qgRes.data;
                if (!piRes.error && piRes.data) processInspectionFetched = piRes.data;
                if (!cfRes.error && cfRes.data) controlFormExecFetched = cfRes.data;
            } catch (extraFetchErr) {
                console.warn('A3/icra raporu ek kalite verileri:', extraFetchErr);
            }

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

            /** Dönem: DF/8D açılışı (yoksa oluşturma tarihi) — icra ve A3 ile tutarlı */
            const ncData = raw.nonConformities.filter((n) => {
                const openAt = n.df_opened_at || n.created_at;
                return inDateRange(openAt, startDate, endDate);
            });
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
                .slice(0, XL);
            const ncTopParts = Object.values(ncPartCounts)
                .sort((a, b) => b.count - a.count)
                .slice(0, XL);
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
                .slice(0, XL);
            const ncSuggestedItems = ncRecordsData
                .filter(r => r.status === 'DF Önerildi' || r.status === '8D Önerildi')
                .sort((a, b) => new Date(b.detection_date || b.created_at || 0) - new Date(a.detection_date || a.created_at || 0))
                .slice(0, XL3)
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
                .slice(0, executiveReport ? 32 : 15)
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
            const twelveMonthsAgoForTrend = startOfDay(subMonths(endDate, 12));
            const vehiclesFor12mTrend = (raw.producedVehicles || []).filter((v) =>
                inDateRange(v.created_at, twelveMonthsAgoForTrend, endDate)
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
            let equipmentData = raw.equipments || [];
            const needFullEquipmentList =
                equipmentData.length >= 1000 ||
                (executiveReport && supplement != null && supplement.equipments == null);
            if (needFullEquipmentList) {
                const fullEquip = await fetchEquipmentsWithCalibrationsPaginated();
                if (Array.isArray(fullEquip) && fullEquip.length > 0) {
                    equipmentData = fullEquip;
                }
            }
            const productionDepartments = raw.productionDepartments || [];
            const trainingData = (raw.trainings || []).filter(t =>
                inDateRange(t.start_date || t.end_date || t.created_at, startDate, endDate)
            );
            const completedTrainings = trainingData.filter(t => t.status === 'Tamamlandı').length;
            const plannedTrainings = trainingData.filter(t => t.status !== 'Tamamlandı').length;

            const trainingIds = [...new Set(trainingData.map(t => t.id).filter((id) => id != null))];
            const examMetaByTrainingId = {};
            let trainingExamParticipantRows = [];
            const examSummary = {
                trainingsWithExam: 0,
                evaluated: 0,
                passed: 0,
                failed: 0,
                awaiting: 0,
            };

            if (trainingIds.length > 0) {
                const idChunks = chunkArray(trainingIds, 80);
                try {
                    for (const chunk of idChunks) {
                        const { data: metaRows, error: metaErr } = await supabase
                            .from('trainings')
                            .select('id, training_exams(id, title, passing_score)')
                            .in('id', chunk);
                        if (metaErr) {
                            console.warn('A3 sınav meta (trainings) alınamadı:', metaErr);
                        } else {
                            (metaRows || []).forEach((row) => {
                                examMetaByTrainingId[row.id] = row.training_exams || [];
                            });
                        }
                    }
                    examSummary.trainingsWithExam = trainingIds.filter((id) => (examMetaByTrainingId[id]?.length || 0) > 0).length;

                    for (const chunk of idChunks) {
                        const { data: partRows, error: partErr } = await supabase
                            .from('training_participants')
                            .select(`
                                id,
                                status,
                                score,
                                personnel:personnel_id(full_name, department),
                                training:training_id!inner(
                                    id,
                                    title,
                                    training_exams!inner(title, passing_score)
                                )
                            `)
                            .in('training_id', chunk);
                        if (partErr) {
                            console.warn('A3 sınav katılımcıları alınamadı:', partErr);
                        } else if (partRows?.length) {
                            trainingExamParticipantRows.push(...partRows);
                        }
                    }

                    const seenPid = new Map();
                    trainingExamParticipantRows = trainingExamParticipantRows.filter((p) => {
                        if (seenPid.has(p.id)) return false;
                        seenPid.set(p.id, true);
                        return true;
                    });

                    for (const p of trainingExamParticipantRows) {
                        const exam = p.training?.training_exams?.[0];
                        if (!exam) continue;
                        const passS = Number(exam.passing_score);
                        const done = p.status === 'Tamamlandı' && p.score != null && p.score !== undefined;
                        if (done) {
                            examSummary.evaluated++;
                            if (Number(p.score) >= passS) examSummary.passed++;
                            else examSummary.failed++;
                        } else {
                            examSummary.awaiting++;
                        }
                    }
                } catch (examFetchErr) {
                    console.warn('A3 eğitim sınav verisi işlenemedi:', examFetchErr);
                }
            }

            const trainingExamPersonnelRows = (() => {
                const rows = [];
                for (const p of trainingExamParticipantRows) {
                    const exam = p.training?.training_exams?.[0];
                    if (!exam) continue;
                    const passS = Number(exam.passing_score);
                    let resultLabel = 'Bekliyor';
                    if (p.status === 'Tamamlandı' && p.score != null && p.score !== undefined) {
                        resultLabel = Number(p.score) >= passS ? 'Geçti' : 'Kaldı';
                    }
                    rows.push({
                        trainingTitle: p.training?.title || '—',
                        examTitle: exam.title || '—',
                        passingScore: passS,
                        score: p.score,
                        personnelName: p.personnel?.full_name || '—',
                        department: p.personnel?.department || '—',
                        result: resultLabel,
                    });
                }
                rows.sort((a, b) => {
                    const t = (a.trainingTitle || '').localeCompare(b.trainingTitle || '', 'tr');
                    if (t !== 0) return t;
                    return (a.personnelName || '').localeCompare(b.personnelName || '', 'tr');
                });
                return rows;
            })();

            const trainingDetails = trainingData
                .sort((a, b) => new Date(b.start_date || b.created_at || 0) - new Date(a.start_date || a.created_at || 0))
                .map((t) => {
                    const exams = examMetaByTrainingId[t.id] || [];
                    const ex0 = exams[0];
                    return {
                        title: t.title || '—',
                        startDate: t.start_date,
                        endDate: t.end_date,
                        status: t.status || '—',
                        instructor: t.instructor || '—',
                        durationHours: t.duration_hours,
                        participantsCount: Array.isArray(t.training_participants) && t.training_participants[0]?.count != null
                            ? t.training_participants[0].count
                            : (t.training_participants?.count ?? 0),
                        examTitle: ex0?.title ?? null,
                        passingScore: ex0?.passing_score ?? null,
                    };
                });
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

            const closedWithDates = ncData.filter((n) => {
                if (n.status !== 'Kapatıldı' || !n.closed_at || !isValid(parseISO(n.closed_at))) return false;
                const opened = parseISO(n.df_opened_at || n.created_at);
                return isValid(opened);
            });
            const avgClosureDays = closedWithDates.length > 0
                ? Math.round(closedWithDates.reduce((sum, n) => {
                    const o = parseISO(n.df_opened_at || n.created_at);
                    const c = parseISO(n.closed_at);
                    return sum + (isValid(o) && isValid(c) ? Math.max(0, differenceInDays(c, o)) : 0);
                }, 0) / closedWithDates.length)
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

            const openDeviations = deviationData.filter(d => d.status === 'Açık').length;

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

            const overdueCalibrations = getOverdueCalibrationsFromEquipments(equipmentData);

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
                .slice(0, XL);
            const expiredDocs = documentData
                .filter(doc => doc.valid_until && isValid(parseISO(doc.valid_until)) && parseISO(doc.valid_until) < today)
                .map(doc => ({
                    ad: doc.name || doc.title || 'Doküman',
                    no: doc.document_no || doc.document_number || '—',
                    tarih: doc.valid_until,
                    daysOverdue: differenceInDays(today, parseISO(doc.valid_until)),
                }))
                .sort((a, b) => b.daysOverdue - a.daysOverdue)
                .slice(0, XL);

            const ncByDept = {};
            ncData.forEach(nc => {
                const dept = normalizeDepartment(nc.department || nc.requesting_unit || 'Belirtilmemiş');
                if (!ncByDept[dept]) ncByDept[dept] = { name: dept, acik: 0, kapali: 0, toplam: 0 };
                ncByDept[dept].toplam++;
                if (nc.status === 'Kapatıldı') ncByDept[dept].kapali++;
                else ncByDept[dept].acik++;
            });
            const ncByDeptArr = Object.values(ncByDept).sort((a, b) => b.toplam - a.toplam).slice(0, XL2);

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
                const openRef = nc.df_opened_at || nc.created_at;
                if (!openRef || !isValid(parseISO(openRef))) return;
                const month = format(parseISO(openRef), 'MMM yy', { locale: tr });
                if (!ncMonthly[month]) ncMonthly[month] = { name: month, acilan: 0, kapilan: 0, sort: parseISO(openRef).getTime() };
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
                const unit = normalizeDepartment(c.unit || c.responsible_unit || 'Belirtilmemiş');
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
                .slice(0, XL3);
            const costComponentArr = [
                { name: 'Faturalı Kalemler', value: costComponentTotals.invoice },
                { name: 'Ortak Giderler', value: costComponentTotals.shared },
                { name: 'Dolaylı Giderler', value: costComponentTotals.indirect },
                { name: 'Tek Kayıt Yükleri', value: costComponentTotals.recordOnly },
            ].filter(item => item.value > 0);
            const topCostDrivers = costDrivers
                .sort((a, b) => b.amount - a.amount)
                .slice(0, XL3)
                .map((item, index) => ({
                    ...item,
                    rank: index + 1,
                    percentage: totalCost > 0 ? ((item.amount / totalCost) * 100).toFixed(1) : '0.0',
                }));
            const costByVehicleTypeArr = Object.entries(costVehicleTypeMap)
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value)
                .slice(0, XL);
            const costByCustomerArr = Object.entries(customerCostMap)
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value)
                .slice(0, executiveReport ? 14 : 6);

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
                .slice(0, XL);

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
                .slice(0, XL);

            const incomingSupplierBreakdown = {};
            incomingData.forEach((i) => {
                const key = i.supplier_id || i.supplier_name || 'Belirtilmemiş';
                const name = supplierIdToName.get(i.supplier_id) || i.supplier_name || 'Belirtilmemiş';
                if (!incomingSupplierBreakdown[key]) {
                    incomingSupplierBreakdown[key] = {
                        name,
                        inspections: 0,
                        qtyReceived: 0,
                        qtyRejected: 0,
                        acceptedCount: 0,
                        conditionalCount: 0,
                        rejectedCount: 0,
                        pendingCount: 0,
                    };
                }
                const row = incomingSupplierBreakdown[key];
                row.inspections += 1;
                row.qtyReceived += Number(i.quantity_received || i.total_quantity) || 0;
                row.qtyRejected += Number(i.quantity_rejected) || 0;
                if (i.decision === 'Kabul') row.acceptedCount += 1;
                else if (i.decision === 'Şartlı Kabul') row.conditionalCount += 1;
                else if (i.decision === 'Ret') row.rejectedCount += 1;
                else row.pendingCount += 1;
            });
            const incomingSupplierBreakdownArr = Object.values(incomingSupplierBreakdown)
                .sort((a, b) => b.qtyRejected - a.qtyRejected || b.inspections - a.inspections)
                .slice(0, executiveReport ? 36 : 18);

            const supplierRestrictedList = (allSuppliers || [])
                .filter(s => ['Ret', 'Red', 'Askıya Alınmış', 'Değerlendirilmemiş', 'Pasif', 'Çalışılmaz'].includes(s.status))
                .map(s => ({
                    name: s.name || '—',
                    status: s.status === 'Red' ? 'Ret' : (s.status || '—'),
                    city: s.city || '—',
                }))
                .sort((a, b) => String(a.name).localeCompare(String(b.name), 'tr'));

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
                .slice(0, XL);
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
            const processPassThroughByDept = {};
            vehicleData.forEach((vehicle) => {
                (vehicle.vehicle_timeline_events || []).forEach((e) => {
                    if (e.event_type !== 'control_start') return;
                    const processName =
                        e.department?.name ||
                        productionDepartmentMap.get(e.department_id) ||
                        e.department_name ||
                        null;
                    if (!processName) return;
                    if (!processPassThroughByDept[processName]) processPassThroughByDept[processName] = new Set();
                    processPassThroughByDept[processName].add(vehicle.id);
                });
            });
            const faultByCategoryArr = Object.values(faultByCategory)
                .map(item => ({ name: item.name, count: item.count, aracSayisi: item.vehicleSet.size }))
                .sort((a, b) => b.count - a.count)
                .slice(0, executiveReport ? 24 : 15);
            const processFaultsArr = Object.values(processFaultsMap)
                .map(item => ({
                    name: item.name,
                    count: item.count,
                    vehicleCount: item.vehicleSet.size,
                    vehiclesThroughProcess: (processPassThroughByDept[item.name] && processPassThroughByDept[item.name].size) || totalVehicles,
                }))
                .sort((a, b) => b.count - a.count)
                .slice(0, XL);

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
                .slice(0, XL3);
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

            let rootCausePareto = [];
            if (!executiveReport) {
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
                rootCausePareto = Object.values(rootCauseMap)
                    .sort((a, b) => b.count - a.count)
                    .slice(0, XL)
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
            }

            const unitIssueCountMap = {};
            ncRecordsData.forEach(record => {
                const unit = normalizeDepartment(record.department || record.detection_area || 'Belirtilmemiş');
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
                .slice(0, XL2);

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
                .slice(0, XL);

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
                const dept = normalizeDepartment(nc.requesting_unit || nc.department || 'Belirtilmemiş');
                if (!deptStats[dept]) deptStats[dept] = { name: dept, toplam: 0, acik: 0, kapali: 0 };
                deptStats[dept].toplam++;
                if (nc.status === 'Kapatıldı') deptStats[dept].kapali++;
                else deptStats[dept].acik++;
            });
            const qualityWallArr = Object.values(deptStats)
                .filter(d => d.toplam > 0)
                .map(d => ({ ...d, kapatmaOrani: ((d.kapali / d.toplam) * 100).toFixed(0) }))
                .sort((a, b) => b.toplam - a.toplam).slice(0, XL2);

            const allDeptNames = (productionDepartments || [])
                .map((d) => normalizeDepartment(d.unit_name))
                .filter((u) => u && u !== 'Belirtilmemiş')
                .sort();
            let deptPerfDf8d = {};
            let requesterContribDf8d = {};
            ncData.forEach((rec) => {
                const isClosed = rec.status === 'Kapatıldı';
                const isRejected = rec.status === 'Reddedildi';
                const isOpen = !isClosed && !isRejected;
                const isOverdue = isNCOverdue(rec, today);
                const responsibleDept = normalizeDepartment(rec.department || 'Belirtilmemiş');
                if (!deptPerfDf8d[responsibleDept]) {
                    deptPerfDf8d[responsibleDept] = {
                        open: 0,
                        closed: 0,
                        overdue: 0,
                        inProgress: 0,
                        rejected: 0,
                        totalClosureDays: 0,
                        closedCount: 0,
                        records: [],
                    };
                }
                deptPerfDf8d[responsibleDept].records.push(rec);
                if (rec.status === 'İşlemde') deptPerfDf8d[responsibleDept].inProgress++;
                if (isRejected) deptPerfDf8d[responsibleDept].rejected++;
                if (isOpen) {
                    deptPerfDf8d[responsibleDept].open++;
                    if (isOverdue) deptPerfDf8d[responsibleDept].overdue++;
                }
                if (isClosed) {
                    deptPerfDf8d[responsibleDept].closed++;
                    const openedAt = rec.df_opened_at ? parseISO(rec.df_opened_at) : null;
                    const closedAt = rec.closed_at ? parseISO(rec.closed_at) : null;
                    if (openedAt && isValid(openedAt) && closedAt && isValid(closedAt)) {
                        const closureDays = differenceInDays(closedAt, openedAt);
                        if (closureDays >= 0) {
                            deptPerfDf8d[responsibleDept].totalClosureDays += closureDays;
                            deptPerfDf8d[responsibleDept].closedCount++;
                        }
                    }
                }
                const requesterUnit = normalizeDepartment(rec.requesting_unit || 'Belirtilmemiş');
                if (!requesterContribDf8d[requesterUnit]) {
                    requesterContribDf8d[requesterUnit] = {
                        total: 0,
                        DF: 0,
                        '8D': 0,
                        MDI: 0,
                        open: 0,
                        closed: 0,
                        inProgress: 0,
                        rejected: 0,
                        records: [],
                    };
                }
                const rq = requesterContribDf8d[requesterUnit];
                rq.records.push(rec);
                rq.total++;
                if (['DF', '8D', 'MDI'].includes(rec.type)) rq[rec.type]++;
                if (rec.status === 'İşlemde') rq.inProgress++;
                if (isOpen) rq.open++;
                if (isClosed) rq.closed++;
                if (isRejected) rq.rejected++;
            });
            deptPerfDf8d = consolidateDeptPerfDf8d(deptPerfDf8d);
            requesterContribDf8d = consolidateRequesterContribDf8d(requesterContribDf8d);
            let df8dResponsiblePerformance = Object.entries(deptPerfDf8d).map(([name, data]) => {
                const total = data.records.length;
                const pipeline = data.open + data.closed;
                const closurePct = pipeline > 0 ? ((data.closed / pipeline) * 100).toFixed(1) : '—';
                return {
                    unit: name,
                    total,
                    open: data.open,
                    closed: data.closed,
                    inProgress: data.inProgress,
                    rejected: data.rejected,
                    overdue: data.overdue,
                    avgClosureTime: data.closedCount > 0 ? (data.totalClosureDays / data.closedCount).toFixed(1) : '—',
                    closurePct,
                };
            }).sort((a, b) => b.total - a.total);
            df8dResponsiblePerformance = mergeDf8dResponsibleRows(df8dResponsiblePerformance);
            const totalDf8dRequests = ncData.length;
            const allUnitsSet = new Set(allDeptNames);
            Object.keys(requesterContribDf8d).forEach((unit) => {
                const u = normalizeDepartment(unit);
                if (u && u !== 'Belirtilmemiş') allUnitsSet.add(u);
            });
            const allUnitsSorted = Array.from(allUnitsSet).sort((a, b) => a.localeCompare(b, 'tr'));
            let df8dRequesterContribution = allUnitsSorted.map((dept) => {
                const data = requesterContribDf8d[dept] || {
                    total: 0,
                    DF: 0,
                    '8D': 0,
                    MDI: 0,
                    open: 0,
                    closed: 0,
                    inProgress: 0,
                    rejected: 0,
                    records: [],
                };
                const pctNum = totalDf8dRequests > 0 ? (data.total / totalDf8dRequests) * 100 : 0;
                return {
                    unit: dept,
                    total: data.total,
                    DF: data.DF,
                    '8D': data['8D'],
                    MDI: data.MDI,
                    open: data.open,
                    closed: data.closed,
                    inProgress: data.inProgress,
                    rejected: data.rejected,
                    contribution: totalDf8dRequests > 0 ? `${pctNum.toFixed(1)}%` : '0%',
                    contributionPct: pctNum,
                };
            }).sort((a, b) => b.total - a.total);
            if (requesterContribDf8d['Belirtilmemiş']) {
                const data = requesterContribDf8d['Belirtilmemiş'];
                const pctNum = totalDf8dRequests > 0 ? (data.total / totalDf8dRequests) * 100 : 0;
                df8dRequesterContribution.push({
                    unit: 'Belirtilmemiş',
                    total: data.total,
                    DF: data.DF,
                    '8D': data['8D'],
                    MDI: data.MDI,
                    open: data.open,
                    closed: data.closed,
                    inProgress: data.inProgress,
                    rejected: data.rejected,
                    contribution: totalDf8dRequests > 0 ? `${pctNum.toFixed(1)}%` : '0%',
                    contributionPct: pctNum,
                });
            }
            df8dRequesterContribution = mergeDf8dRequesterRows(df8dRequesterContribution, totalDf8dRequests);

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
            const openNC = openNCAll.slice(0, executiveReport ? 45 : 20);

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
                const dept = normalizeDepartment(k.department?.unit_name || 'Belirtilmemiş');
                if (!kaizenByDept[dept]) kaizenByDept[dept] = { name: dept.slice(0, 20), tamamlanan: 0, devamEden: 0 };
                if (k.status === 'Tamamlandı') kaizenByDept[dept].tamamlanan++;
                else kaizenByDept[dept].devamEden++;
            });
            const kaizenByDeptArr = Object.values(kaizenByDept).sort((a, b) => (b.tamamlanan + b.devamEden) - (a.tamamlanan + a.devamEden)).slice(0, XL);

            const deviationByStatus = {};
            const deviationByUnit = {};
            deviationData.forEach(d => {
                const st = d.status || 'Açık';
                deviationByStatus[st] = (deviationByStatus[st] || 0) + 1;
                const unit = normalizeDepartment(d.requesting_unit || 'Belirtilmemiş');
                deviationByUnit[unit] = (deviationByUnit[unit] || 0) + 1;
            });
            const deviationByStatusArr = Object.entries(deviationByStatus).map(([name, value]) => ({ name, value }));
            const deviationByUnitArr = Object.entries(deviationByUnit).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, XL3);
            const deviationDetails = deviationData
                .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
                .slice(0, XL)
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

            // Final hata maliyeti — son 12 takvim ayı (dönemden bağımsız; kontrol/yeniden işlem trendi ile uyumlu)
            const finalFaultChartStart = startOfMonth(subMonths(endDate, 11));
            const finalFaultChartEnd = endDate;
            const finalFaultCostByMonth = {};
            (raw.qualityCosts || [])
                .filter(
                    cost =>
                        (cost.source_type === 'produced_vehicle_final_faults' ||
                            cost.cost_type === 'Final Hataları Maliyeti') &&
                        inDateRange(cost.cost_date || cost.created_at, finalFaultChartStart, finalFaultChartEnd)
                )
                .forEach(cost => {
                    const dateStr = cost.cost_date || cost.created_at;
                    if (!dateStr || !isValid(parseISO(dateStr))) return;
                    const month = format(parseISO(dateStr), 'MMM yy', { locale: tr });
                    finalFaultCostByMonth[month] = (finalFaultCostByMonth[month] || 0) + toNumber(cost.amount);
                });
            const finalFaultMonthSlots = eachMonthOfInterval({
                start: finalFaultChartStart,
                end: endOfMonth(endDate),
            });
            const finalFaultCostMonthlyArr = finalFaultMonthSlots.map((d) => {
                const key = format(d, 'MMM yy', { locale: tr });
                return {
                    name: key,
                    toplam: finalFaultCostByMonth[key] || 0,
                    sort: d.getTime(),
                };
            });

            const fixtureToday = startOfDay(new Date());
            const fixtureDueSoonLimit = addDays(fixtureToday, 30);
            const fixtureStatusCounts = {};
            const fixtureDepartmentCounts = {};
            const fixtureVerificationEvents = [];
            const fixtureNonconformityEvents = [];

            fixtureRows.forEach(fixture => {
                const status = fixture.status || 'Belirtilmemiş';
                fixtureStatusCounts[status] = (fixtureStatusCounts[status] || 0) + 1;

                const department = normalizeDepartment(fixture.responsible_department || 'Belirtilmemiş');
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
                .slice(0, XL3);
            const fixtureRecentVerifications = fixtureVerificationEvents
                .sort((a, b) => new Date(b.verificationDate || 0) - new Date(a.verificationDate || 0))
                .slice(0, XL);
            const fixtureRecentNonconformities = fixtureNonconformityEvents
                .filter(item => !['Tamamlandı', 'Hurdaya Ayrıldı'].includes(item.status))
                .sort((a, b) => new Date(b.detectionDate || 0) - new Date(a.detectionDate || 0))
                .slice(0, XL);
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
                .slice(0, XL);

            const personnelByDept = {};
            personnelData.forEach(p => { const d = normalizeDepartment(p.department || 'Belirtilmemiş'); personnelByDept[d] = (personnelByDept[d] || 0) + 1; });
            const personnelByDeptArr = Object.entries(personnelByDept).map(([name, value]) => ({ name: name.slice(0, 20), value })).sort((a, b) => b.value - a.value).slice(0, XL);

            const latestKpiMap = new Map();
            (kpiRecordData || []).forEach((kpi) => {
                if (kpi?.id) latestKpiMap.set(kpi.id, kpi);
            });

            const kpiWatchList = buildKpiWatchList(latestKpiMap);

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

            const controlReworkByMonth = {};
            vehiclesFor12mTrend.forEach(v => {
                if (!v.created_at || !isValid(parseISO(v.created_at))) return;
                const month = format(parseISO(v.created_at), 'MMM yy', { locale: tr });
                const t = parseISO(v.created_at).getTime();
                if (!controlReworkByMonth[month]) {
                    controlReworkByMonth[month] = { name: month, sort: t, sumCtrl: 0, sumRework: 0, nCtrl: 0, nRework: 0 };
                }
                const events = v.vehicle_timeline_events || [];
                const ctrl = calculateInspectionDuration(events);
                const rework = calculateReworkDuration(events);
                if (ctrl > 0) {
                    controlReworkByMonth[month].sumCtrl += ctrl;
                    controlReworkByMonth[month].nCtrl += 1;
                }
                if (rework > 0) {
                    controlReworkByMonth[month].sumRework += rework;
                    controlReworkByMonth[month].nRework += 1;
                }
            });
            const controlReworkMonthly = Object.values(controlReworkByMonth)
                .sort((a, b) => a.sort - b.sort)
                .slice(-12)
                .map(m => {
                    const avgControlMin = m.nCtrl > 0 ? Math.round(m.sumCtrl / m.nCtrl) : 0;
                    const avgReworkMin = m.nRework > 0 ? Math.round(m.sumRework / m.nRework) : 0;
                    return {
                        name: m.name,
                        avgControlMin,
                        avgReworkMin,
                        avgControlHr: roundTo(avgControlMin / 60, 1),
                        avgReworkHr: roundTo(avgReworkMin / 60, 1),
                        vehiclesWithControl: m.nCtrl,
                        vehiclesWithRework: m.nRework,
                    };
                });

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
                .slice(0, XL3);

            const stockRiskData = (raw.stockRiskControls || []).filter(s =>
                inDateRange(s.created_at, startDate, endDate)
            );
            const stockRiskByStatus = {};
            stockRiskData.forEach(s => {
                const st = s.status || 'Beklemede';
                stockRiskByStatus[st] = (stockRiskByStatus[st] || 0) + 1;
            });
            const stockRiskOpen = stockRiskData.filter(s => s.status && s.status !== 'Tamamlandı').length;
            const stockRiskRecent = [...stockRiskData]
                .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
                .slice(0, XL3)
                .map(s => ({
                    partCode: s.part_code || '—',
                    partName: s.part_name || '—',
                    supplier: s.supplier?.name || '—',
                    status: s.status || '—',
                    decision: s.decision || '—',
                    createdAt: s.created_at,
                }));

            const inkrData = (raw.inkrReports || []).filter(r =>
                inDateRange(r.report_date || r.created_at, startDate, endDate)
            );
            const inkrByStatus = {};
            inkrData.forEach(r => {
                const st = r.status || 'Beklemede';
                inkrByStatus[st] = (inkrByStatus[st] || 0) + 1;
            });
            const inkrPending = inkrData.filter(r => (r.status || 'Beklemede') === 'Beklemede').length;
            const inkrRecent = [...inkrData]
                .sort((a, b) => new Date(b.report_date || b.created_at || 0) - new Date(a.report_date || a.created_at || 0))
                .slice(0, XL3)
                .map(r => ({
                    partCode: r.part_code || '—',
                    partName: r.part_name || '—',
                    supplier: r.supplier?.name || '—',
                    status: r.status || '—',
                    reportDate: r.report_date || r.created_at,
                }));

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

            const extDocs = ctx.externalDocuments || [];
            const todayRef = new Date();
            const extDocExpiringSoonRows = extDocs
                .filter(d => d.valid_until && isValid(parseISO(d.valid_until)))
                .map(d => ({
                    title: d.title || '—',
                    reference: d.reference_code || '—',
                    category: d.category,
                    categoryLabel: EXT_DOC_CATEGORY_LABEL[d.category] || d.category || '—',
                    validUntil: d.valid_until,
                    daysRemaining: differenceInDays(parseISO(d.valid_until), todayRef),
                }))
                .filter(d => d.daysRemaining >= 0 && d.daysRemaining <= 30)
                .sort((a, b) => a.daysRemaining - b.daysRemaining)
                .slice(0, XL3);
            const extDocExpiredCount = extDocs.filter(d =>
                d.valid_until && isValid(parseISO(d.valid_until)) && parseISO(d.valid_until) < startOfDay(todayRef)
            ).length;
            const extDocByCategoryArr = (() => {
                const acc = {};
                extDocs.forEach(d => {
                    const k = d.category || '—';
                    acc[k] = (acc[k] || 0) + 1;
                });
                return Object.entries(acc).map(([id, value]) => ({
                    id,
                    label: EXT_DOC_CATEGORY_LABEL[id] || id,
                    value,
                })).sort((a, b) => b.value - a.value);
            })();

            const qualityGoalsForReport = qualityGoalsFetched.map(g => ({
                id: g.id,
                name: g.goal_name,
                type: g.goal_type,
                typeLabel: QUALITY_GOAL_TYPE_LABEL[g.goal_type] || g.goal_type,
                target: toNumber(g.target_value),
                direction: g.target_direction || 'decrease',
                unit: (g.unit || '').trim(),
                responsible: g.responsible_unit || '—',
                year: g.year,
            }));

            const piByDecision = {};
            processInspectionFetched.forEach((x) => {
                const d = x.decision || '—';
                piByDecision[d] = (piByDecision[d] || 0) + 1;
            });
            const processInspectionRecent = processInspectionFetched.slice(0, XL3).map((x) => ({
                recordNo: x.record_no || '—',
                date: x.inspection_date,
                decision: x.decision || '—',
                part: [x.part_code, x.part_name].filter(Boolean).join(' · ') || '—',
            }));

            const cfByResult = {};
            controlFormExecFetched.forEach((x) => {
                const r = x.result || '—';
                cfByResult[r] = (cfByResult[r] || 0) + 1;
            });
            const controlFormRecent = controlFormExecFetched.slice(0, XL3).map((x) => ({
                executionNo: x.execution_no || '—',
                templateName: x.control_form_templates?.name || '—',
                docNo: x.control_form_templates?.document_no || '—',
                result: x.result,
                resultLabel: CONTROL_FORM_RESULT_LABEL[x.result] || x.result || '—',
                serial: x.serial_number || '—',
                date: x.inspection_date || x.created_at,
            }));

            const governanceSummary = [
                { label: 'Geciken DF / 8D', value: overdueNC.length, severity: overdueNC.length > 0 ? 'bad' : 'good' },
                { label: 'Geciken Kalibrasyon', value: overdueCalibrations.length, severity: overdueCalibrations.length > 0 ? 'bad' : 'good' },
                { label: 'Süresi Yaklaşan Doküman', value: expiringDocs.length, severity: expiringDocs.length > 0 ? 'warning' : 'good' },
                { label: 'Süresi Geçmiş Doküman', value: expiredDocs.length, severity: expiredDocs.length > 0 ? 'bad' : 'good' },
                { label: 'Şikayet Aksiyonu', value: complaintActionsData.length, severity: complaintActionsData.length > 0 ? 'warning' : 'good' },
                { label: 'Geciken Şikayet Aksiyonu', value: overdueComplaintActions.length, severity: overdueComplaintActions.length > 0 ? 'bad' : 'good' },
            ];

            const executiveProcessQuality =
                executiveReport && supplement
                    ? (() => {
                        const pi = supplement.processInspections || [];
                        const lt = supplement.leakTestRecords || [];
                        const fb = supplement.fanBalanceRecords || [];
                        const pir = supplement.processInkrReports || [];
                        const pcp = supplement.processControlPlans || [];
                        const leakByResult = {};
                        lt.forEach((r) => {
                            const k = r.test_result || '—';
                            leakByResult[k] = (leakByResult[k] || 0) + 1;
                        });
                        const leakAccepted = lt.filter((r) => r.test_result === 'Kabul').length;
                        const leakFailed = lt.filter((r) => r.test_result === 'Kaçak Var').length;
                        const leakSuccessRatePct =
                            lt.length > 0 ? roundTo((leakAccepted / lt.length) * 100, 1) : null;
                        const isBalancePass = (r) =>
                            r.overall_result === 'PASS' ||
                            (r.left_plane_result === 'PASS' && r.right_plane_result === 'PASS');
                        const balancePass = fb.filter(isBalancePass).length;
                        return {
                            processInspections: {
                                total: pi.length,
                                byDecision: Object.entries(
                                    pi.reduce((acc, x) => {
                                        const d = x.decision || '—';
                                        acc[d] = (acc[d] || 0) + 1;
                                        return acc;
                                    }, {})
                                ).map(([name, value]) => ({ name, value })),
                                recent: pi.slice(0, 14).map((x) => ({
                                    recordNo: x.record_no || '—',
                                    date: x.inspection_date,
                                    part: [x.part_code, x.part_name].filter(Boolean).join(' · ') || '—',
                                    decision: x.decision || '—',
                                })),
                            },
                            processControlPlans: {
                                total: pcp.length,
                                activeCount: pcp.filter((p) => p.is_active !== false).length,
                            },
                            processInkr: {
                                total: pir.length,
                                recent: pir.slice(0, 10).map((r) => ({
                                    recordNo: r.inkr_number || '—',
                                    status: r.status || '—',
                                    part: [r.part_code, r.part_name].filter(Boolean).join(' · ') || '—',
                                })),
                            },
                            leakTest: {
                                total: lt.length,
                                acceptedCount: leakAccepted,
                                failCount: leakFailed,
                                successRatePct: leakSuccessRatePct,
                                byResult: Object.entries(leakByResult)
                                    .map(([name, value]) => ({ name, value }))
                                    .sort((a, b) => b.value - a.value),
                                recent: lt.slice(0, 12).map((r) => ({
                                    recordNo: r.record_number || '—',
                                    date: r.test_date,
                                    result: r.test_result || '—',
                                    part: r.part_code || '—',
                                    leaks: r.leak_count,
                                })),
                            },
                            dynamicBalance: {
                                total: fb.length,
                                passCount: balancePass,
                                failCount: Math.max(0, fb.length - balancePass),
                                recent: fb.slice(0, 12).map((r) => ({
                                    serial: r.serial_number || '—',
                                    date: r.test_date || r.created_at,
                                    pass: isBalancePass(r),
                                    product:
                                        r.fan_products?.product_code ||
                                        r.fan_products?.product_name ||
                                        '—',
                                })),
                            },
                        };
                    })()
                    : null;

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
                    supplierBreakdown: incomingSupplierBreakdownArr,
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
                    restrictedList: supplierRestrictedList,
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
                        .slice(0, XL3)
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
                df8dResponsiblePerformance,
                df8dRequesterContribution,
                overdueNC: overdueNC.slice(0, XL),
                openNC,
                openNCTotal: openNCAll.length,
                openNCGeciken: openNCAll.filter(n => n.gecikme).length,
                activeQuarantine,
                overdueCalibrations: overdueCalibrations.slice(0, XL),
                personnelByDept: personnelByDeptArr,
                governance: {
                    summary: governanceSummary,
                    overdueTasks: overdueTaskList.slice(0, XL),
                    expiringDocs,
                    expiredDocs,
                    kpiWatch: kpiWatchList,
                    qualityGoals: qualityGoalsForReport,
                    externalDocuments: {
                        total: extDocs.length,
                        byCategory: extDocByCategoryArr,
                        expiringSoonCount: extDocExpiringSoonRows.length,
                        expiredCount: extDocExpiredCount,
                        expiringSoon: extDocExpiringSoonRows,
                    },
                    processQualityRecords: {
                        inspections: {
                            total: processInspectionFetched.length,
                            byDecision: Object.entries(piByDecision)
                                .map(([name, value]) => ({ name, value }))
                                .sort((a, b) => b.value - a.value),
                            recent: processInspectionRecent,
                        },
                        controlForms: {
                            total: controlFormExecFetched.length,
                            byResult: Object.entries(cfByResult)
                                .map(([key, value]) => ({
                                    key,
                                    name: CONTROL_FORM_RESULT_LABEL[key] || key,
                                    value,
                                }))
                                .sort((a, b) => b.value - a.value),
                            recent: controlFormRecent,
                        },
                    },
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
                    avgControlHr: roundTo(avgControlTimeMin / 60, 1),
                    avgReworkHr: roundTo(avgReworkTimeMin / 60, 1),
                    avgControlTimeFormatted: fmtDuration(avgControlTimeMin),
                    avgReworkTimeFormatted: fmtDuration(avgReworkTimeMin),
                    vehiclesWithControl,
                    vehiclesWithRework,
                    controlReworkMonthly,
                    completedInternalAudits: completedAudits,
                    auditFindingsByDept: auditFindingsByDeptArr,
                    supplierAuditsCompleted: supplierAuditDetails.length,
                    supplierAuditDetails,
                    completedTrainings,
                    plannedTrainings,
                    totalTrainings: trainingData.length,
                    trainingDetails,
                    examSummary,
                    trainingExamPersonnelRows,
                },
                stockRisk: {
                    totalInPeriod: stockRiskData.length,
                    openCount: stockRiskOpen,
                    byStatus: Object.entries(stockRiskByStatus).map(([name, value]) => ({ name, value })),
                    recent: stockRiskRecent,
                },
                inkrIncoming: {
                    totalInPeriod: inkrData.length,
                    pendingCount: inkrPending,
                    byStatus: Object.entries(inkrByStatus).map(([name, value]) => ({ name, value })),
                    recent: inkrRecent,
                },
                executiveProcessQuality,
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
        ctx.stockRiskControls, ctx.inkrReports, ctx.externalDocuments,
        startDate, endDate, executiveReport, calendarYear, calendarMonth,
    ]);

    useEffect(() => {
        if (!ctx.loading) processData();
    }, [processData, ctx.loading]);

    const loadingState = ctx.loading || loading;

    return { data, loading: loadingState, error, periodLabel };
};

export default useA3ReportData;
