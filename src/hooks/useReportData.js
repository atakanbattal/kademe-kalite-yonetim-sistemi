import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { subMonths, startOfYear, endOfYear, format, differenceInDays, parseISO, isValid } from 'date-fns';
import { tr } from 'date-fns/locale';

const useReportData = (period) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [periodLabel, setPeriodLabel] = useState('');

    const calculateDateRange = useCallback(() => {
        const now = new Date();
        let startDate, endDate = now;
        let label = '';

        switch (period) {
            case 'last3months':
                startDate = subMonths(now, 3);
                label = 'Son 3 Ay';
                break;
            case 'last6months':
                startDate = subMonths(now, 6);
                label = 'Son 6 Ay';
                break;
            case 'thisYear':
                startDate = startOfYear(now);
                endDate = endOfYear(now);
                label = 'Bu Yıl';
                break;
            case 'last12months':
            default:
                startDate = subMonths(now, 12);
                label = 'Son 12 Ay';
                break;
        }
        setPeriodLabel(label);
        return { startDate: startDate.toISOString(), endDate: endDate.toISOString() };
    }, [period]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        const { startDate, endDate } = calculateDateRange();

        try {
            const [
                df8dRes, auditRes, supplierRes, vehicleRes, kaizenRes, 
                costRes, quarantineRes, deviationRes, equipmentRes, documentRes
            ] = await Promise.all([
                supabase.from('non_conformities').select('*').gte('created_at', startDate).lte('created_at', endDate),
                supabase.from('audits').select('*, findings:audit_findings(*)').gte('audit_date', startDate).lte('audit_date', endDate),
                supabase.from('suppliers').select('*, non_conformities!inner(*), supplier_audit_plans!inner(*)'),
                supabase.from('quality_inspections').select('*').gte('created_at', startDate).lte('created_at', endDate),
                supabase.from('kaizen_entries').select('*').gte('created_at', startDate).lte('created_at', endDate),
                supabase.from('quality_costs').select('*').gte('cost_date', startDate).lte('cost_date', endDate),
                supabase.from('quarantine_records').select('*').gte('quarantine_date', startDate).lte('quarantine_date', endDate),
                supabase.from('deviations').select('*').gte('created_at', startDate).lte('created_at', endDate),
                supabase.from('equipments').select('*, equipment_calibrations!inner(*)'),
                supabase.from('documents').select('*'),
            ]);

            const processDf8d = (records) => {
                if (!records) return { openCount: 0, avgClosureDays: 0, monthlyTrend: [], departmentDistribution: [], overdueRecords: [] };
                const openCount = records.filter(r => r.status !== 'Kapatıldı' && r.status !== 'Reddedildi').length;
                const closedRecords = records.filter(r => r.status === 'Kapatıldı' && r.created_at && r.closed_at);
                const totalClosureDays = closedRecords.reduce((sum, r) => sum + differenceInDays(parseISO(r.closed_at), parseISO(r.created_at)), 0);
                const avgClosureDays = closedRecords.length > 0 ? Math.round(totalClosureDays / closedRecords.length) : 0;
                
                const monthlyTrend = records.reduce((acc, r) => {
                    if (!r.created_at || !isValid(parseISO(r.created_at))) return acc;
                    const openedMonth = format(parseISO(r.created_at), 'MMM yy', { locale: tr });
                    acc[openedMonth] = acc[openedMonth] || { name: openedMonth, opened: 0, closed: 0 };
                    acc[openedMonth].opened++;
                    if (r.status === 'Kapatıldı' && r.closed_at && isValid(parseISO(r.closed_at))) {
                        const closedMonth = format(parseISO(r.closed_at), 'MMM yy', { locale: tr });
                        if (acc[closedMonth]) {
                            acc[closedMonth].closed++;
                        }
                    }
                    return acc;
                }, {});

                const departmentDistribution = records.reduce((acc, r) => {
                    const dept = r.department || 'Belirtilmemiş';
                    acc[dept] = (acc[dept] || 0) + 1;
                    return acc;
                }, {});

                const overdueRecords = records.filter(r => r.status !== 'Kapatıldı' && r.due_at && isValid(parseISO(r.due_at)) && new Date() > parseISO(r.due_at))
                    .map(r => ({ ...r, delay_days: differenceInDays(new Date(), parseISO(r.due_at)) }));

                return {
                    openCount,
                    avgClosureDays,
                    monthlyTrend: Object.values(monthlyTrend),
                    departmentDistribution: Object.entries(departmentDistribution).map(([name, count]) => ({ name, count })),
                    overdueRecords,
                };
            };

            const processSuppliers = (records) => {
                if (!records) return { gradeDistribution: {}, topSuppliersWithNCs: [] };
                const gradeDistribution = { A: 0, B: 0, C: 0, D: 0, 'N/A': 0 };
                records.forEach(s => {
                    const latestAudit = s.supplier_audit_plans?.filter(p => p.status === 'Tamamlandı' && p.score != null).sort((a, b) => new Date(b.actual_date) - new Date(a.actual_date))[0];
                    const score = latestAudit?.score;
                    if (score >= 90) gradeDistribution.A++;
                    else if (score >= 75) gradeDistribution.B++;
                    else if (score >= 60) gradeDistribution.C++;
                    else if (score != null) gradeDistribution.D++;
                    else gradeDistribution['N/A']++;
                });

                const supplierNCs = records.reduce((acc, s) => {
                    const ncCount = s.non_conformities?.length || 0;
                    if (ncCount > 0) acc[s.name] = ncCount;
                    return acc;
                }, {});

                const topSuppliersWithNCs = Object.entries(supplierNCs).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count }));

                return { gradeDistribution, topSuppliersWithNCs };
            };
            
            const processQualityCosts = (records) => {
                if (!records) return { totalCost: 0, monthlyTrend: [] };
                const totalCost = records.reduce((sum, r) => sum + r.amount, 0);
                const monthlyTrend = records.reduce((acc, r) => {
                    if (!r.cost_date || !isValid(parseISO(r.cost_date))) return acc;
                    const month = format(parseISO(r.cost_date), 'MMM yy', { locale: tr });
                    acc[month] = (acc[month] || 0) + r.amount;
                    return acc;
                }, {});
                return { totalCost, monthlyTrend: Object.entries(monthlyTrend).map(([name, totalCost]) => ({ name, totalCost })) };
            };

            setData({
                df8d: processDf8d(df8dRes.data),
                internalAudit: { total: auditRes.data?.length || 0 },
                supplier: processSuppliers(supplierRes.data),
                vehicleQuality: { total: vehicleRes.data?.length || 0 },
                kaizen: { totalSavings: kaizenRes.data?.reduce((sum, r) => sum + (r.total_yearly_gain || 0), 0) || 0 },
                qualityCost: processQualityCosts(costRes.data),
                quarantine: { inQuarantineCount: quarantineRes.data?.filter(r => r.status === 'Karantinada').length || 0 },
                deviation: { openCount: deviationRes.data?.filter(r => r.status === 'Açık').length || 0 },
                equipment: { overdueCalibrations: equipmentRes.data?.flatMap(e => e.equipment_calibrations).filter(c => c.next_calibration_date && new Date() > parseISO(c.next_calibration_date)).length || 0 },
                document: { total: documentRes.data?.length || 0 },
            });

        } catch (err) {
            setError('Rapor verileri alınırken bir hata oluştu.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [period, calculateDateRange]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { data, loading, error, periodLabel };
};

export default useReportData;