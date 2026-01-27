import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { subMonths, startOfYear, endOfYear, format, differenceInDays, parseISO, isValid, addDays, startOfMonth } from 'date-fns';
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
                costRes, quarantineRes, deviationRes, equipmentRes, documentRes,
                complaintRes, kpiRes, qualityGoalRes, benchmarkRes, riskRes
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
                supabase.from('customer_complaints').select('*').gte('complaint_date', startDate).lte('complaint_date', endDate),
                supabase.from('kpis').select('*'),
                supabase.from('quality_goals').select('*').eq('year', new Date().getFullYear()),
                supabase.from('benchmark_values').select('*').eq('period', format(startOfMonth(new Date()), 'yyyy-MM')),
                supabase.from('risk_assessments').select('*').eq('status', 'ACTIVE').order('risk_score', { ascending: false }).limit(10),
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

            const processComplaints = (records) => {
                if (!records) return { total: 0, byStatus: {}, bySeverity: {}, slaOverdue: 0, monthlyTrend: [] };
                const byStatus = records.reduce((acc, r) => {
                    acc[r.status || 'Açık'] = (acc[r.status || 'Açık'] || 0) + 1;
                    return acc;
                }, {});
                const bySeverity = records.reduce((acc, r) => {
                    acc[r.severity || 'Orta'] = (acc[r.severity || 'Orta'] || 0) + 1;
                    return acc;
                }, {});
                const slaOverdue = records.filter(r => r.sla_status === 'Overdue' || (r.sla_resolution_due && new Date() > parseISO(r.sla_resolution_due))).length;
                const monthlyTrend = records.reduce((acc, r) => {
                    if (!r.complaint_date || !isValid(parseISO(r.complaint_date))) return acc;
                    const month = format(parseISO(r.complaint_date), 'MMM yy', { locale: tr });
                    acc[month] = (acc[month] || 0) + 1;
                    return acc;
                }, {});
                return {
                    total: records.length,
                    byStatus,
                    bySeverity,
                    slaOverdue,
                    monthlyTrend: Object.entries(monthlyTrend).map(([name, count]) => ({ name, count }))
                };
            };

            const processCriticalNCs = (ncRecords, costRecords) => {
                if (!ncRecords) return { highRPN: [], highCost: [], recurring: [] };
                
                // RPN yüksek (>= 100)
                const highRPN = ncRecords
                    .filter(nc => {
                        if (nc.status === 'Kapatıldı') return false;
                        const severity = Math.min(Math.max(nc.severity || 5, 1), 10);
                        const occurrence = Math.min(Math.max(nc.occurrence || 5, 1), 10);
                        const detection = Math.min(Math.max(nc.detection || 5, 1), 10);
                        return (severity * occurrence * detection) >= 100;
                    })
                    .map(nc => {
                        const severity = Math.min(Math.max(nc.severity || 5, 1), 10);
                        const occurrence = Math.min(Math.max(nc.occurrence || 5, 1), 10);
                        const detection = Math.min(Math.max(nc.detection || 5, 1), 10);
                        return {
                            ...nc,
                            rpn: severity * occurrence * detection,
                            nc_number: nc.nc_number || nc.id
                        };
                    })
                    .sort((a, b) => b.rpn - a.rpn)
                    .slice(0, 5);

                // Maliyet yüksek
                const ncCostMap = {};
                (costRecords || []).forEach(cost => {
                    if (cost.related_nc_id) {
                        ncCostMap[cost.related_nc_id] = (ncCostMap[cost.related_nc_id] || 0) + (cost.amount || 0);
                    }
                });
                const highCost = Object.entries(ncCostMap)
                    .map(([ncId, totalCost]) => {
                        const nc = ncRecords.find(n => n.id === ncId);
                        if (!nc || nc.status === 'Kapatıldı') return null;
                        return { ...nc, totalCost, nc_number: nc.nc_number || nc.id };
                    })
                    .filter(Boolean)
                    .sort((a, b) => b.totalCost - a.totalCost)
                    .slice(0, 5);

                // Tekrarlayan
                const ncMap = {};
                ncRecords.forEach(nc => {
                    const key = nc.part_code || nc.title?.substring(0, 30) || nc.nc_number || 'Bilinmeyen';
                    if (!ncMap[key]) {
                        ncMap[key] = { ...nc, count: 0, occurrences: [] };
                    }
                    ncMap[key].count++;
                    ncMap[key].occurrences.push(nc);
                });
                const recurring = Object.values(ncMap)
                    .filter(item => item.count > 1)
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 5)
                    .map(item => ({
                        ...item,
                        nc_number: item.nc_number || item.id,
                        part_code: item.part_code || 'Belirtilmemiş'
                    }));

                return { highRPN, highCost, recurring };
            };

            const processQualityWall = (ncRecords) => {
                if (!ncRecords) return { best: [], worst: [] };
                const deptStats = {};
                ncRecords.forEach(nc => {
                    // Reddedilenleri kapatma oranı hesabına dahil etme
                    if (nc.status === 'Reddedildi') return;
                    
                    const dept = nc.requesting_unit || nc.department || 'Belirtilmemiş';
                    if (!deptStats[dept]) {
                        deptStats[dept] = { name: dept, totalNCs: 0, openNCs: 0, closedNCs: 0 };
                    }
                    deptStats[dept].totalNCs++;
                    if (nc.status === 'Kapatıldı') {
                        deptStats[dept].closedNCs++;
                    } else {
                        deptStats[dept].openNCs++;
                    }
                });
                const departments = Object.values(deptStats).filter(d => d.totalNCs > 0);
                const best = departments
                    .sort((a, b) => {
                        if (a.openNCs !== b.openNCs) return a.openNCs - b.openNCs;
                        const aCloseRate = a.totalNCs > 0 ? a.closedNCs / a.totalNCs : 0;
                        const bCloseRate = b.totalNCs > 0 ? b.closedNCs / b.totalNCs : 0;
                        return bCloseRate - aCloseRate;
                    })
                    .slice(0, 3);
                const worst = departments
                    .sort((a, b) => {
                        if (b.openNCs !== a.openNCs) return b.openNCs - a.openNCs;
                        const aCloseRate = a.totalNCs > 0 ? a.closedNCs / a.totalNCs : 0;
                        const bCloseRate = b.totalNCs > 0 ? b.closedNCs / b.totalNCs : 0;
                        return aCloseRate - bCloseRate;
                    })
                    .slice(0, 3);
                return { best, worst };
            };

            const processRootCauseHeatmap = (ncRecords) => {
                if (!ncRecords) return { byDepartment: [], byRootCause: [] };
                const deptMap = {};
                const rootCauseMap = {};
                ncRecords.forEach(nc => {
                    const dept = nc.requesting_unit || nc.department || 'Belirtilmemiş';
                    if (!deptMap[dept]) {
                        deptMap[dept] = { name: dept, count: 0, severity: 0 };
                    }
                    deptMap[dept].count++;
                    deptMap[dept].severity += nc.severity || 5;
                    const rootCause = nc.root_cause || nc.eight_d_steps?.D4?.description || 'Belirtilmemiş';
                    const rootCauseKey = rootCause.substring(0, 50);
                    if (!rootCauseMap[rootCauseKey]) {
                        rootCauseMap[rootCauseKey] = { name: rootCauseKey, count: 0 };
                    }
                    rootCauseMap[rootCauseKey].count++;
                });
                const byDepartment = Object.values(deptMap)
                    .map(dept => ({
                        ...dept,
                        avgSeverity: dept.count > 0 ? (dept.severity / dept.count).toFixed(1) : '0'
                    }))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 10);
                const byRootCause = Object.values(rootCauseMap)
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 10);
                return { byDepartment, byRootCause };
            };

            const processTodayTasks = (ncRecords, eqRecords) => {
                const today = new Date();
                const tasks = {
                    overdue8D: [],
                    dueCalibrations: []
                };
                (ncRecords || []).forEach(nc => {
                    if (nc.type === '8D' && nc.status !== 'Kapatıldı' && nc.target_close_date) {
                        const dueDate = new Date(nc.target_close_date);
                        if (dueDate <= today) {
                            tasks.overdue8D.push({
                                ...nc,
                                daysOverdue: differenceInDays(today, dueDate),
                                nc_number: nc.nc_number || nc.id
                            });
                        }
                    }
                });
                (eqRecords || []).forEach(eq => {
                    (eq.equipment_calibrations || []).forEach(cal => {
                        if (cal.next_calibration_date) {
                            const dueDate = new Date(cal.next_calibration_date);
                            if (dueDate <= today) {
                                tasks.dueCalibrations.push({
                                    equipment: eq.name,
                                    dueDate: cal.next_calibration_date,
                                    daysOverdue: differenceInDays(today, dueDate)
                                });
                            }
                        }
                    });
                });
                return tasks;
            };

            const processAlerts = (ncRecords, eqRecords, docRecords, costRecords) => {
                const thirtyDaysAgo = addDays(new Date(), -30);
                const overdueNCs = (ncRecords || []).filter(nc => {
                    if (nc.status === 'Kapatıldı') return false;
                    const openingDate = new Date(nc.opening_date || nc.created_at);
                    return openingDate < thirtyDaysAgo;
                }).map(nc => ({
                    ...nc,
                    daysOverdue: differenceInDays(new Date(), new Date(nc.opening_date || nc.created_at)),
                    nc_number: nc.nc_number || nc.id
                })).sort((a, b) => b.daysOverdue - a.daysOverdue).slice(0, 10);

                const overdueCalibrations = [];
                (eqRecords || []).forEach(eq => {
                    (eq.equipment_calibrations || []).forEach(cal => {
                        if (cal.next_calibration_date && new Date() > parseISO(cal.next_calibration_date)) {
                            overdueCalibrations.push({
                                equipment: eq.name,
                                dueDate: cal.next_calibration_date,
                                daysOverdue: differenceInDays(new Date(), parseISO(cal.next_calibration_date))
                            });
                        }
                    });
                });

                const expiringDocs = (docRecords || [])
                    .filter(doc => {
                        if (!doc.valid_until) return false;
                        const validUntil = new Date(doc.valid_until);
                        const thirtyDaysFromNow = addDays(new Date(), 30);
                        return validUntil >= new Date() && validUntil <= thirtyDaysFromNow;
                    })
                    .map(doc => ({
                        ...doc,
                        daysRemaining: differenceInDays(new Date(doc.valid_until), new Date())
                    }))
                    .sort((a, b) => a.daysRemaining - b.daysRemaining)
                    .slice(0, 10);

                const costAnomalies = [];
                const today = new Date();
                const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                const firstDayOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                const lastDayOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
                const thisMonthCosts = (costRecords || []).filter(c => {
                    const costDate = new Date(c.cost_date);
                    return costDate >= firstDayOfMonth;
                });
                const lastMonthCosts = (costRecords || []).filter(c => {
                    const costDate = new Date(c.cost_date);
                    return costDate >= firstDayOfLastMonth && costDate <= lastDayOfLastMonth;
                });
                const thisMonthTotal = thisMonthCosts.reduce((sum, c) => sum + (c.amount || 0), 0);
                const lastMonthTotal = lastMonthCosts.reduce((sum, c) => sum + (c.amount || 0), 0);
                if (lastMonthTotal > 0 && thisMonthTotal > lastMonthTotal * 1.5) {
                    costAnomalies.push({
                        message: 'Bu ay maliyet anormal arttı',
                        increase: ((thisMonthTotal - lastMonthTotal) / lastMonthTotal * 100).toFixed(1),
                        thisMonth: thisMonthTotal,
                        lastMonth: lastMonthTotal
                    });
                }

                return { overdueNCs, overdueCalibrations, expiringDocs, costAnomalies };
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
                complaints: processComplaints(complaintRes.data),
                criticalNCs: processCriticalNCs(df8dRes.data, costRes.data),
                qualityWall: processQualityWall(df8dRes.data),
                rootCauseHeatmap: processRootCauseHeatmap(df8dRes.data),
                todayTasks: processTodayTasks(df8dRes.data, equipmentRes.data),
                alerts: processAlerts(df8dRes.data, equipmentRes.data, documentRes.data, costRes.data),
                kpis: kpiRes.data || [],
                qualityGoals: qualityGoalRes.data || [],
                benchmarks: benchmarkRes.data || [],
                risks: riskRes.data || [],
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