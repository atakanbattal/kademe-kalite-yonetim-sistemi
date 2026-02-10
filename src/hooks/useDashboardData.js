import { useState, useEffect, useCallback, useMemo } from 'react';
import { useData } from '@/contexts/DataContext';

const useDashboardData = () => {
    const { 
        nonConformities,
        qualityCosts,
        quarantineRecords,
        deviations,
        audits,
        documents,
        equipments,
        loading,
        refreshData
    } = useData();

    const [data, setData] = useState({
        kpiData: [],
        nonconformityData: [],
        costData: [],
        recentDocs: [],
        pendingApprovals: [],
        upcomingCalibrations: [],
        expiringDocs: [],
        completedAudits: [],
    });
    const [error, setError] = useState(null);

    const processData = useCallback(() => {
        try {
            const today = new Date();
            const thirtyDaysFromNow = new Date();
            thirtyDaysFromNow.setDate(today.getDate() + 30);
            const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

            const totalMonthlyCost = (qualityCosts || [])
                .filter(c => new Date(c.cost_date) >= firstDayOfMonth)
                .reduce((sum, item) => sum + (item.amount || 0), 0);

            const kpiData = [
                { title: 'Açık DF Sayısı', value: (nonConformities || []).filter(d => d.type === 'DF' && d.status !== 'Kapatıldı').length, module: 'df-8d' },
                { title: 'Açık 8D Sayısı', value: (nonConformities || []).filter(d => d.type === '8D' && d.status !== 'Kapatıldı').length, module: 'df-8d' },
                { title: 'Karantinadaki Ürünler', value: (quarantineRecords || []).filter(q => q.status === 'Karantinada').length, module: 'quarantine' },
                { title: 'Bu Ayki Maliyet', value: `${totalMonthlyCost.toLocaleString('tr-TR')} ₺`, module: 'quality-cost' },
            ];

            // İlgili Birim (department) = talep edilen / sorumlu birim. Talep eden (requesting_unit) DEĞİL.
            const nonconformityByDept = (nonConformities || []).reduce((acc, nc) => {
                const dept = nc.department || nc.responsible_unit || 'Belirtilmemiş';
                if (!acc[dept]) {
                    acc[dept] = { value: 0, records: [] };
                }
                acc[dept].value++;
                acc[dept].records.push({ ...nc, module: 'df-8d' });
                return acc;
            }, {});

            const costByType = (qualityCosts || []).reduce((acc, cost) => {
                const type = cost.cost_type || 'Belirtilmemiş';
                if (!acc[type]) {
                    acc[type] = { value: 0, records: [] };
                }
                acc[type].value += cost.amount || 0;
                acc[type].records.push({ ...cost, module: 'quality-cost' });
                return acc;
            }, {});
            
            const pendingApprovals = (deviations || [])
                .filter(d => d.status === 'Onay Bekliyor')
                .slice(0, 5)
                .map(d => ({
                    id: d.id,
                    name: d.request_no,
                    user: d.requesting_person,
                    date: d.created_at || d.updated_at,
                    module: 'deviation'
                }));

            const upcomingCalibrations = (equipments || [])
                .flatMap(e => (e.equipment_calibrations || [])
                    .filter(c => c.next_calibration_date && new Date(c.next_calibration_date) >= today && new Date(c.next_calibration_date) <= thirtyDaysFromNow)
                    .map(c => ({
                        id: c.id,
                        name: e.name,
                        user: null,
                        date: c.next_calibration_date,
                        module: 'equipment'
                    }))
                )
                .sort((a, b) => new Date(a.date) - new Date(b.date))
                .slice(0, 5);

            const expiringDocs = (documents || [])
                .filter(d => d.valid_until && new Date(d.valid_until) >= today && new Date(d.valid_until) <= thirtyDaysFromNow)
                .sort((a, b) => new Date(a.valid_until) - new Date(b.valid_until))
                .slice(0, 5)
                .map(d => ({
                    id: d.id,
                    name: d.name,
                    user: null,
                    date: d.valid_until,
                    module: 'document'
                }));

            const completedAudits = (audits || [])
                .filter(a => a.status === 'Tamamlandı' && new Date(a.audit_date) >= firstDayOfMonth)
                .sort((a, b) => new Date(b.audit_date) - new Date(a.audit_date))
                .slice(0, 5)
                .map(a => ({
                    id: a.id,
                    name: a.report_number,
                    user: null,
                    date: a.audit_date,
                    module: 'internal-audit'
                }));

            const recentDocs = (documents || [])
                .sort((a, b) => new Date(b.publish_date) - new Date(a.publish_date))
                .slice(0, 5)
                .map(d => ({ ...d, name: d.name, date: d.publish_date, module: 'document' }));

            setData({
                kpiData,
                nonconformityData: Object.entries(nonconformityByDept).map(([name, data]) => ({ name, value: data.value, records: data.records })),
                costData: Object.entries(costByType).map(([name, data]) => ({ name, value: data.value, records: data.records })),
                recentDocs,
                pendingApprovals,
                upcomingCalibrations,
                expiringDocs,
                completedAudits,
            });
            setError(null);
        } catch (e) {
            console.error("Dashboard veri işleme hatası:", e);
            setError("Dashboard verileri işlenirken bir hata oluştu.");
        }

    }, [nonConformities, qualityCosts, quarantineRecords, deviations, audits, documents, equipments]);

    useEffect(() => {
        if(!loading) {
            processData();
        }
    }, [loading, nonConformities, qualityCosts, quarantineRecords, deviations, audits, documents, equipments, processData]);

    const refreshDashboard = useCallback(() => {
        refreshData();
        processData();
    }, [refreshData, processData]);

    return { ...data, loading, error, refreshDashboard };
};

export default useDashboardData;