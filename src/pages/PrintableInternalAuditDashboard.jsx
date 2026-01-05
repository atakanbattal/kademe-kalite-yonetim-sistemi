import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, Legend } from 'recharts';
import { format, startOfToday, addDays, startOfMonth, endOfMonth, parseISO, isValid } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';

const ReportSection = ({ title, children, className = '' }) => (
    <section className={`report-section ${className}`}>
        <h2 className="section-title">{title}</h2>
        {children}
    </section>
);

const KpiCard = ({ title, value, subtext }) => (
    <div className="kpi-card">
        <h3 className="kpi-title">{title}</h3>
        <p className="kpi-value">{value}</p>
        {subtext && <p className="kpi-subtext">{subtext}</p>}
    </div>
);

const PrintableInternalAuditDashboard = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { session } = useAuth();
    const [loading, setLoading] = useState(true);
    const [audits, setAudits] = useState([]);
    const [auditFindings, setAuditFindings] = useState([]);
    const [nonConformities, setNonConformities] = useState([]);
    
    // URL parametrelerinden tarih filtresini al
    const filterMonth = searchParams.get('month'); // YYYY-MM formatında
    const filterYear = searchParams.get('year'); // YYYY formatında

    useEffect(() => {
        if (!session) {
            navigate('/login');
        }
    }, [session, navigate]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Tarih filtresi için query oluştur
                let auditsQuery = supabase
                    .from('audits')
                    .select(`
                        *,
                        department:cost_settings(id, unit_name),
                        audit_standard:audit_standards!audit_standard_id(id, code, name)
                    `);
                
                // Ay filtresi varsa uygula
                if (filterMonth) {
                    const monthStart = startOfMonth(parseISO(`${filterMonth}-01`));
                    const monthEnd = endOfMonth(parseISO(`${filterMonth}-01`));
                    auditsQuery = auditsQuery
                        .gte('audit_date', format(monthStart, 'yyyy-MM-dd'))
                        .lte('audit_date', format(monthEnd, 'yyyy-MM-dd'));
                } else if (filterYear) {
                    // Sadece yıl filtresi varsa
                    const yearStart = startOfMonth(parseISO(`${filterYear}-01-01`));
                    const yearEnd = endOfMonth(parseISO(`${filterYear}-12-01`));
                    auditsQuery = auditsQuery
                        .gte('audit_date', format(yearStart, 'yyyy-MM-dd'))
                        .lte('audit_date', format(yearEnd, 'yyyy-MM-dd'));
                }
                
                const { data: auditsData, error: auditsError } = await auditsQuery
                    .order('audit_date', { ascending: false });

                if (auditsError) throw auditsError;

                // Tüm bulguları çek (non_conformity ile)
                // Önce audit ID'lerini al
                const auditIds = auditsData?.map(a => a.id) || [];
                
                let findingsQuery = supabase
                    .from('audit_findings')
                    .select(`
                        *,
                        audit:audits(id, report_number, title, audit_date, department:cost_settings(unit_name), audit_standard:audit_standards!audit_standard_id(code, name)),
                        non_conformity:non_conformities!source_finding_id(id, nc_number, status, type, created_at, due_at, due_date, closed_at)
                    `);
                
                // Filtrelenmiş audit'lere ait bulguları al
                if (auditIds.length > 0) {
                    findingsQuery = findingsQuery.in('audit_id', auditIds);
                } else if (filterMonth || filterYear) {
                    // Eğer filtre var ama audit yoksa boş array döndür
                    findingsQuery = findingsQuery.eq('audit_id', '00000000-0000-0000-0000-000000000000'); // Geçersiz ID ile boş sonuç
                }
                
                const { data: findingsData, error: findingsError } = await findingsQuery
                    .order('created_at', { ascending: false });

                if (findingsError) throw findingsError;

                // Tüm uygunsuzlukları çek (DF'ler dahil)
                const { data: ncData, error: ncError } = await supabase
                    .from('non_conformities')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (ncError) throw ncError;

                setAudits(auditsData || []);
                setAuditFindings(findingsData || []);
                setNonConformities(ncData || []);
                setLoading(false);
            } catch (error) {
                console.error('Veri yükleme hatası:', error);
                setLoading(false);
            }
        };

        fetchData();
    }, [filterMonth, filterYear]);

    useEffect(() => {
        if (!loading) {
            setTimeout(() => window.print(), 1500);
        }
    }, [loading]);

    const analytics = useMemo(() => {
        if (!audits.length && !auditFindings.length) {
            return {
                totalAudits: 0,
                totalFindings: 0,
                closedFindings: 0,
                openFindingsCount: 0,
                departmentChartData: [],
                monthlyChartData: [],
                statusChartData: [],
                auditTypesData: [],
                auditsByDepartment: [],
                dfData: [],
                findingsDetails: []
            };
        }

        // Temel istatistikler
        const totalAudits = audits.length;
        const totalFindings = auditFindings.length;
        const closedFindings = auditFindings.filter(f => {
            const nc = Array.isArray(f.non_conformity) ? f.non_conformity[0] : f.non_conformity;
            return nc?.status === 'Kapatıldı';
        }).length;
        const openFindings = auditFindings.filter(f => {
            const nc = Array.isArray(f.non_conformity) ? f.non_conformity[0] : f.non_conformity;
            return !nc || nc.status !== 'Kapatıldı';
        });
        
        // Birimlere göre açık uygunsuzluk dağılımı
        const departmentFindings = {};
        openFindings.forEach(finding => {
            const audit = Array.isArray(finding.audit) ? finding.audit[0] : finding.audit;
            const deptName = audit?.department?.unit_name || 'Belirtilmemiş';
            departmentFindings[deptName] = (departmentFindings[deptName] || 0) + 1;
        });

        const departmentChartData = Object.entries(departmentFindings)
            .map(([name, value]) => ({ name, 'Açık Uygunsuzluk': value }))
            .sort((a, b) => b['Açık Uygunsuzluk'] - a['Açık Uygunsuzluk']);

        // Son 12 ay tetkik dağılımı
        const monthlyAudits = {};
        const now = new Date();
        for (let i = 11; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = format(date, 'MMM yy', { locale: tr });
            monthlyAudits[key] = 0;
        }

        audits.forEach(audit => {
            if (audit.audit_date) {
                const auditDate = new Date(audit.audit_date);
                const monthDiff = (now.getFullYear() - auditDate.getFullYear()) * 12 + (now.getMonth() - auditDate.getMonth());
                if (monthDiff >= 0 && monthDiff < 12) {
                    const key = format(auditDate, 'MMM yy', { locale: tr });
                    if (monthlyAudits[key] !== undefined) {
                        monthlyAudits[key]++;
                    }
                }
            }
        });

        const monthlyChartData = Object.entries(monthlyAudits).map(([name, count]) => ({
            name,
            'Tetkik Sayısı': count
        }));

        // Durum bazlı istatistikler
        const statusCounts = audits.reduce((acc, audit) => {
            const status = audit.status || 'Belirtilmemiş';
            acc[status] = (acc[status] || 0) + 1;
            return acc;
        }, {});

        const statusChartData = Object.entries(statusCounts)
            .map(([name, value]) => ({ name, 'Adet': value }))
            .sort((a, b) => b.Adet - a.Adet);

        // Tetkik türlerine göre analiz (audit_standard)
        const auditTypesMap = {};
        audits.forEach(audit => {
            const standard = audit.audit_standard;
            const typeKey = standard ? `${standard.code} - ${standard.name}` : 'Belirtilmemiş';
            if (!auditTypesMap[typeKey]) {
                auditTypesMap[typeKey] = { count: 0, findings: 0, openFindings: 0 };
            }
            auditTypesMap[typeKey].count++;
            
            const findingsForAudit = auditFindings.filter(f => {
                const auditRef = Array.isArray(f.audit) ? f.audit[0] : f.audit;
                return auditRef?.id === audit.id;
            });
            auditTypesMap[typeKey].findings += findingsForAudit.length;
            auditTypesMap[typeKey].openFindings += findingsForAudit.filter(f => {
                const nc = Array.isArray(f.non_conformity) ? f.non_conformity[0] : f.non_conformity;
                return !nc || nc.status !== 'Kapatıldı';
            }).length;
        });

        const auditTypesData = Object.entries(auditTypesMap)
            .map(([name, data]) => ({
                name,
                count: data.count,
                findings: data.findings,
                openFindings: data.openFindings
            }))
            .sort((a, b) => b.count - a.count);

        // Birimlere göre tetkik analizi
        const departmentAuditsMap = {};
        audits.forEach(audit => {
            const deptName = audit.department?.unit_name || 'Belirtilmemiş';
            if (!departmentAuditsMap[deptName]) {
                departmentAuditsMap[deptName] = {
                    audits: [],
                    totalFindings: 0,
                    openFindings: 0,
                    closedFindings: 0
                };
            }
            departmentAuditsMap[deptName].audits.push(audit);
            
            const findingsForAudit = auditFindings.filter(f => {
                const auditRef = Array.isArray(f.audit) ? f.audit[0] : f.audit;
                return auditRef?.id === audit.id;
            });
            departmentAuditsMap[deptName].totalFindings += findingsForAudit.length;
            departmentAuditsMap[deptName].openFindings += findingsForAudit.filter(f => {
                const nc = Array.isArray(f.non_conformity) ? f.non_conformity[0] : f.non_conformity;
                return !nc || nc.status !== 'Kapatıldı';
            }).length;
            departmentAuditsMap[deptName].closedFindings += findingsForAudit.filter(f => {
                const nc = Array.isArray(f.non_conformity) ? f.non_conformity[0] : f.non_conformity;
                return nc?.status === 'Kapatıldı';
            }).length;
        });

        const auditsByDepartment = Object.entries(departmentAuditsMap)
            .map(([name, data]) => ({
                name,
                auditCount: data.audits.length,
                totalFindings: data.totalFindings,
                openFindings: data.openFindings,
                closedFindings: data.closedFindings
            }))
            .sort((a, b) => b.auditCount - a.auditCount);

        // DF (Düzeltici Faaliyet) analizi
        const dfFromAudits = nonConformities.filter(nc => 
            nc.type === 'DF' && nc.source_type === 'audit_finding'
        );

        const dfData = dfFromAudits.map(df => {
            const finding = auditFindings.find(f => {
                const nc = Array.isArray(f.non_conformity) ? f.non_conformity[0] : f.non_conformity;
                return nc?.id === df.id;
            });
            const audit = finding ? (Array.isArray(finding.audit) ? finding.audit[0] : finding.audit) : null;
            
            return {
                ncNumber: df.nc_number || '-',
                status: df.status || '-',
                department: audit?.department?.unit_name || 'Belirtilmemiş',
                auditReportNumber: audit?.report_number || '-',
                createdDate: df.created_at ? format(new Date(df.created_at), 'dd.MM.yyyy', { locale: tr }) : '-',
                dueDate: df.due_at || df.due_date ? format(new Date(df.due_at || df.due_date), 'dd.MM.yyyy', { locale: tr }) : '-',
                closedDate: df.closed_at ? format(new Date(df.closed_at), 'dd.MM.yyyy', { locale: tr }) : '-'
            };
        }).sort((a, b) => {
            const dateA = a.createdDate === '-' ? new Date(0) : new Date(a.createdDate.split('.').reverse().join('-'));
            const dateB = b.createdDate === '-' ? new Date(0) : new Date(b.createdDate.split('.').reverse().join('-'));
            return dateB - dateA;
        });

        // Detaylı bulgu listesi
        const findingsDetails = auditFindings.map(finding => {
            const audit = Array.isArray(finding.audit) ? finding.audit[0] : finding.audit;
            const nc = Array.isArray(finding.non_conformity) ? finding.non_conformity[0] : finding.non_conformity;
            
            return {
                findingDescription: finding.description || '-',
                auditReportNumber: audit?.report_number || '-',
                auditTitle: audit?.title || '-',
                auditDate: audit?.audit_date ? format(new Date(audit.audit_date), 'dd.MM.yyyy', { locale: tr }) : '-',
                department: audit?.department?.unit_name || 'Belirtilmemiş',
                auditStandard: audit?.audit_standard ? `${audit.audit_standard.code} - ${audit.audit_standard.name}` : '-',
                ncNumber: nc?.nc_number || '-',
                ncStatus: nc?.status || 'Uygunsuzluk Oluşturulmadı',
                ncType: nc?.type || '-',
                ncCreatedDate: nc?.created_at ? format(new Date(nc.created_at), 'dd.MM.yyyy', { locale: tr }) : '-',
                ncDueDate: nc?.due_at || nc?.due_date ? format(new Date(nc.due_at || nc.due_date), 'dd.MM.yyyy', { locale: tr }) : '-',
                ncClosedDate: nc?.closed_at ? format(new Date(nc.closed_at), 'dd.MM.yyyy', { locale: tr }) : '-'
            };
        }).sort((a, b) => {
            const dateA = a.auditDate === '-' ? new Date(0) : new Date(a.auditDate.split('.').reverse().join('-'));
            const dateB = b.auditDate === '-' ? new Date(0) : new Date(b.auditDate.split('.').reverse().join('-'));
            return dateB - dateA;
        });

        return {
            totalAudits,
            totalFindings,
            closedFindings,
            openFindingsCount: openFindings.length,
            departmentChartData,
            monthlyChartData,
            statusChartData,
            auditTypesData,
            auditsByDepartment,
            dfData,
            findingsDetails
        };
    }, [audits, auditFindings, nonConformities]);

    const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6366f1'];

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100 text-gray-700">
                <Loader2 className="w-12 h-12 animate-spin mr-4" />
                <span className="text-xl font-semibold">İç Tetkik Raporu oluşturuluyor, lütfen bekleyin...</span>
            </div>
        );
    }

    return (
        <>
            <Helmet>
                <title>İç Tetkik Detaylı Genel Raporu - {format(startOfToday(), 'dd.MM.yyyy')}</title>
            </Helmet>
            <div className="report-container">
                <style>{`
                    @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');
                    body { font-family: 'Roboto', sans-serif; background-color: #f0f2f5; color: #333; margin: 0; padding: 0; }
                    .report-container { max-width: 1200px; margin: 20px auto; background: white; padding: 40px; box-shadow: 0 0 15px rgba(0,0,0,0.1); }
                    .report-header { text-align: center; margin-bottom: 40px; border-bottom: 3px solid #1F3A5F; padding-bottom: 20px; }
                    .report-header h1 { font-size: 32px; color: #1F3A5F; margin: 0; font-weight: 700; }
                    .report-header p { font-size: 16px; color: #666; margin-top: 10px; }
                    .report-section { margin-bottom: 50px; page-break-inside: avoid; }
                    .section-title { font-size: 22px; font-weight: 700; color: #1F3A5F; border-bottom: 2px solid #e0e0e0; padding-bottom: 10px; margin-bottom: 25px; }
                    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
                    .kpi-card { padding: 20px; border: 1px solid #e0e0e0; border-left: 5px solid #1F3A5F; border-radius: 8px; background: #f9fafb; }
                    .kpi-title { font-size: 14px; color: #666; margin-bottom: 8px; font-weight: 500; }
                    .kpi-value { font-size: 32px; font-weight: 700; color: #1F3A5F; line-height: 1; }
                    .kpi-subtext { font-size: 12px; color: #888; margin-top: 8px; }
                    .chart-container { height: 350px; margin-top: 20px; }
                    .chart-small { height: 280px; margin-top: 20px; }
                    .data-table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 11px; table-layout: fixed; }
                    .data-table th { background-color: #1F3A5F; color: white; padding: 10px 6px; text-align: left; font-weight: 600; border: 1px solid #ddd; font-size: 10px; }
                    .data-table td { padding: 8px 6px; border: 1px solid #ddd; word-wrap: break-word; word-break: break-word; overflow-wrap: break-word; hyphens: auto; }
                    .data-table tr:nth-child(even) { background-color: #f9fafb; }
                    .data-table tr:hover { background-color: #f0f2f5; }
                    .data-table .text-wrap { word-wrap: break-word; word-break: break-word; overflow-wrap: break-word; white-space: normal; }
                    .status-badge { padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; display: inline-block; }
                    .status-open { background-color: #fee2e2; color: #991b1b; }
                    .status-closed { background-color: #d1fae5; color: #065f46; }
                    .status-planned { background-color: #dbeafe; color: #1e40af; }
                    .status-in-progress { background-color: #fef3c7; color: #92400e; }
                    .status-completed { background-color: #d1fae5; color: #065f46; }
                    @media print {
                        body { background-color: white; }
                        .report-container { margin: 0; padding: 20px; box-shadow: none; border: none; max-width: 100%; }
                        @page { size: A4 portrait; margin: 15mm; }
                        .report-section { page-break-inside: avoid; }
                        .data-table { font-size: 9px; }
                        .data-table th, .data-table td { padding: 5px 3px; }
                        .chart-container { height: 300px; }
                        .chart-small { height: 250px; }
                    }
                `}</style>

                <header className="report-header">
                    <h1>İç Tetkik Yönetimi Detaylı Genel Raporu</h1>
                    <p>Oluşturma Tarihi: {format(startOfToday(), 'dd MMMM yyyy', { locale: tr })}</p>
                    {filterMonth && (
                        <p style={{ fontSize: '14px', color: '#1F3A5F', marginTop: '5px', fontWeight: 600 }}>
                            Filtre: {format(parseISO(`${filterMonth}-01`), 'MMMM yyyy', { locale: tr })}
                        </p>
                    )}
                    {filterYear && !filterMonth && (
                        <p style={{ fontSize: '14px', color: '#1F3A5F', marginTop: '5px', fontWeight: 600 }}>
                            Filtre: {filterYear} Yılı
                        </p>
                    )}
                    {!filterMonth && !filterYear && (
                        <p style={{ fontSize: '14px', color: '#888', marginTop: '5px' }}>
                            Tüm Zamanlar
                        </p>
                    )}
                    <p style={{ fontSize: '14px', color: '#888', marginTop: '5px' }}>
                        Kademe A.Ş. Kalite Yönetim Sistemi
                    </p>
                </header>

                <ReportSection title="Genel İstatistikler">
                    <div className="kpi-grid">
                        <KpiCard 
                            title="Toplam Tetkik Sayısı" 
                            value={analytics.totalAudits} 
                            subtext="Tüm zamanlar"
                        />
                        <KpiCard 
                            title="Toplam Bulgu Sayısı" 
                            value={analytics.totalFindings} 
                            subtext="Tüm bulgular"
                        />
                        <KpiCard 
                            title="Açık Uygunsuzluk" 
                            value={analytics.openFindingsCount} 
                            subtext={`${analytics.totalFindings} toplam bulgu`}
                        />
                        <KpiCard 
                            title="Kapatılan Uygunsuzluk" 
                            value={analytics.closedFindings} 
                            subtext={`%${analytics.totalFindings > 0 ? Math.round((analytics.closedFindings / analytics.totalFindings) * 100) : 0} tamamlanma`}
                        />
                        <KpiCard 
                            title="DF Sayısı" 
                            value={analytics.dfData.length} 
                            subtext="Düzeltici Faaliyet"
                        />
                    </div>
                </ReportSection>

                <ReportSection title="Tetkik Türlerine Göre Analiz">
                    {analytics.auditTypesData.length > 0 ? (
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '35%' }}>Tetkik Türü</th>
                                    <th style={{ width: '13%', textAlign: 'center' }}>Tetkik Sayısı</th>
                                    <th style={{ width: '13%', textAlign: 'center' }}>Toplam Bulgu</th>
                                    <th style={{ width: '13%', textAlign: 'center' }}>Açık Bulgu</th>
                                    <th style={{ width: '13%', textAlign: 'center' }}>Kapatılan Bulgu</th>
                                    <th style={{ width: '13%', textAlign: 'center' }}>Tamamlanma %</th>
                                </tr>
                            </thead>
                            <tbody>
                                {analytics.auditTypesData.map((item, idx) => {
                                    const completionRate = item.findings > 0 
                                        ? Math.round(((item.findings - item.openFindings) / item.findings) * 100) 
                                        : 0;
                                    return (
                                        <tr key={idx}>
                                            <td style={{ fontWeight: 600, fontSize: '10px' }}>{item.name}</td>
                                            <td style={{ textAlign: 'center' }}>{item.count}</td>
                                            <td style={{ textAlign: 'center' }}>{item.findings}</td>
                                            <td style={{ textAlign: 'center', color: '#dc2626', fontWeight: 600 }}>{item.openFindings}</td>
                                            <td style={{ textAlign: 'center', color: '#059669', fontWeight: 600 }}>{item.findings - item.openFindings}</td>
                                            <td style={{ textAlign: 'center', fontWeight: 600 }}>{completionRate}%</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    ) : (
                        <p style={{ textAlign: 'center', color: '#888', padding: '40px' }}>
                            Tetkik türü verisi bulunmuyor.
                        </p>
                    )}
                </ReportSection>

                <ReportSection title="Birimlere Göre Tetkik Analizi">
                    {analytics.auditsByDepartment.length > 0 ? (
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '30%' }}>Birim</th>
                                    <th style={{ width: '15%', textAlign: 'center' }}>Tetkik Sayısı</th>
                                    <th style={{ width: '15%', textAlign: 'center' }}>Toplam Bulgu</th>
                                    <th style={{ width: '15%', textAlign: 'center' }}>Açık Bulgu</th>
                                    <th style={{ width: '15%', textAlign: 'center' }}>Kapatılan Bulgu</th>
                                    <th style={{ width: '10%', textAlign: 'center' }}>Tamamlanma %</th>
                                </tr>
                            </thead>
                            <tbody>
                                {analytics.auditsByDepartment.map((item, idx) => {
                                    const completionRate = item.totalFindings > 0 
                                        ? Math.round((item.closedFindings / item.totalFindings) * 100) 
                                        : 0;
                                    return (
                                        <tr key={idx}>
                                            <td style={{ fontWeight: 600 }}>{item.name}</td>
                                            <td style={{ textAlign: 'center' }}>{item.auditCount}</td>
                                            <td style={{ textAlign: 'center' }}>{item.totalFindings}</td>
                                            <td style={{ textAlign: 'center', color: '#dc2626', fontWeight: 600 }}>{item.openFindings}</td>
                                            <td style={{ textAlign: 'center', color: '#059669', fontWeight: 600 }}>{item.closedFindings}</td>
                                            <td style={{ textAlign: 'center', fontWeight: 600 }}>{completionRate}%</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    ) : (
                        <p style={{ textAlign: 'center', color: '#888', padding: '40px' }}>
                            Birim verisi bulunmuyor.
                        </p>
                    )}
                </ReportSection>

                <ReportSection title="DF (Düzeltici Faaliyet) Detayları">
                    {analytics.dfData.length > 0 ? (
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '10%' }}>DF No</th>
                                    <th style={{ width: '12%' }}>Durum</th>
                                    <th style={{ width: '15%' }}>Birim</th>
                                    <th style={{ width: '13%' }}>Tetkik Rapor No</th>
                                    <th style={{ width: '12%' }}>Açılış Tarihi</th>
                                    <th style={{ width: '12%' }}>Termin Tarihi</th>
                                    <th style={{ width: '12%' }}>Kapanış Tarihi</th>
                                    <th style={{ width: '14%' }}>Gecikme Durumu</th>
                                </tr>
                            </thead>
                            <tbody>
                                {analytics.dfData.map((item, idx) => {
                                    const statusClass = item.status === 'Kapatıldı' ? 'status-closed' : 
                                                      item.status === 'Açık' ? 'status-open' : 'status-planned';
                                    const isOverdue = item.status === 'Açık' && item.dueDate !== '-' && 
                                                      new Date(item.dueDate.split('.').reverse().join('-')) < new Date();
                                    return (
                                        <tr key={idx}>
                                            <td style={{ fontWeight: 600, fontSize: '10px' }}>{item.ncNumber}</td>
                                            <td>
                                                <span className={`status-badge ${statusClass}`}>
                                                    {item.status}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: '10px' }}>{item.department}</td>
                                            <td style={{ fontSize: '10px' }}>{item.auditReportNumber}</td>
                                            <td>{item.createdDate}</td>
                                            <td style={{ color: isOverdue ? '#dc2626' : 'inherit', fontWeight: isOverdue ? 600 : 'normal' }}>{item.dueDate}</td>
                                            <td>{item.closedDate}</td>
                                            <td style={{ color: isOverdue ? '#dc2626' : '#059669', fontWeight: 600, fontSize: '10px' }}>
                                                {isOverdue ? 'Gecikmiş' : item.status === 'Kapatıldı' ? 'Tamamlandı' : 'Beklemede'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    ) : (
                        <p style={{ textAlign: 'center', color: '#888', padding: '40px' }}>
                            DF kaydı bulunmuyor.
                        </p>
                    )}
                </ReportSection>

                <ReportSection title="Detaylı Bulgu Listesi">
                    {analytics.findingsDetails.length > 0 ? (
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '9%' }}>Tetkik Rapor No</th>
                                    <th style={{ width: '10%' }}>Tetkik Başlığı</th>
                                    <th style={{ width: '8%' }}>Tetkik Tarihi</th>
                                    <th style={{ width: '10%' }}>Birim</th>
                                    <th style={{ width: '13%' }}>Tetkik Türü</th>
                                    <th style={{ width: '18%' }}>Bulgu Açıklaması</th>
                                    <th style={{ width: '8%' }}>Uygunsuzluk No</th>
                                    <th style={{ width: '8%' }}>Durum</th>
                                    <th style={{ width: '6%' }}>Tip</th>
                                    <th style={{ width: '10%' }}>Açılış/Kapanış</th>
                                </tr>
                            </thead>
                            <tbody>
                                {analytics.findingsDetails.map((item, idx) => {
                                    const statusClass = item.ncStatus === 'Kapatıldı' ? 'status-closed' : 
                                                      item.ncStatus === 'Açık' ? 'status-open' : 'status-planned';
                                    const dateInfo = item.ncStatus === 'Kapatıldı' && item.ncClosedDate !== '-' 
                                        ? `Kapanış: ${item.ncClosedDate}`
                                        : item.ncStatus === 'Açık' && item.ncCreatedDate !== '-'
                                        ? `Açılış: ${item.ncCreatedDate}`
                                        : '-';
                                    return (
                                        <tr key={idx}>
                                            <td style={{ fontWeight: 600, fontSize: '10px' }}>{item.auditReportNumber}</td>
                                            <td style={{ fontSize: '9px' }}>{item.auditTitle}</td>
                                            <td style={{ fontSize: '9px' }}>{item.auditDate}</td>
                                            <td style={{ fontSize: '9px' }}>{item.department}</td>
                                            <td style={{ fontSize: '9px' }}>{item.auditStandard}</td>
                                            <td style={{ fontSize: '9px' }} className="text-wrap">{item.findingDescription}</td>
                                            <td style={{ fontWeight: 600, fontSize: '10px' }}>{item.ncNumber}</td>
                                            <td>
                                                <span className={`status-badge ${statusClass}`} style={{ fontSize: '9px' }}>
                                                    {item.ncStatus}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: '9px' }}>{item.ncType}</td>
                                            <td style={{ fontSize: '9px' }}>{dateInfo}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    ) : (
                        <p style={{ textAlign: 'center', color: '#888', padding: '40px' }}>
                            Bulgu verisi bulunmuyor.
                        </p>
                    )}
                </ReportSection>

                <ReportSection title="Birimlere Göre Açık Uygunsuzluk Dağılımı">
                    {analytics.departmentChartData.length > 0 ? (
                        <div className="chart-container">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={analytics.departmentChartData} margin={{ top: 20, right: 30, left: 40, bottom: 80 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                                    <XAxis 
                                        dataKey="name" 
                                        angle={-45} 
                                        textAnchor="end" 
                                        height={100}
                                        interval={0}
                                        tick={{ fontSize: 11 }}
                                    />
                                    <YAxis tick={{ fontSize: 12 }} />
                                    <Tooltip 
                                        contentStyle={{ 
                                            backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                                            border: '1px solid #ccc',
                                            borderRadius: '8px',
                                            padding: '10px'
                                        }} 
                                    />
                                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                    <Bar dataKey="Açık Uygunsuzluk" fill="#ef4444" radius={[8, 8, 0, 0]}>
                                        {analytics.departmentChartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <p style={{ textAlign: 'center', color: '#888', padding: '40px' }}>
                            Açık uygunsuzluk bulunmuyor.
                        </p>
                    )}
                </ReportSection>

                <ReportSection title="Son 12 Ay Tetkik Trendi">
                    <div className="chart-container">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={analytics.monthlyChartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                                <XAxis 
                                    dataKey="name" 
                                    angle={-45} 
                                    textAnchor="end" 
                                    height={80}
                                    tick={{ fontSize: 11 }}
                                />
                                <YAxis tick={{ fontSize: 12 }} />
                                <Tooltip 
                                    contentStyle={{ 
                                        backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                                        border: '1px solid #ccc',
                                        borderRadius: '8px',
                                        padding: '10px'
                                    }} 
                                />
                                <Legend wrapperStyle={{ paddingTop: '15px' }} />
                                <Bar dataKey="Tetkik Sayısı" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </ReportSection>

                <ReportSection title="Tetkik Durum Dağılımı">
                    {analytics.statusChartData.length > 0 ? (
                        <div className="chart-small">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={analytics.statusChartData} layout="horizontal" margin={{ top: 20, right: 30, left: 100, bottom: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                                    <XAxis type="number" tick={{ fontSize: 12 }} />
                                    <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                                    <Tooltip 
                                        contentStyle={{ 
                                            backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                                            border: '1px solid #ccc',
                                            borderRadius: '8px',
                                            padding: '10px'
                                        }} 
                                    />
                                    <Bar dataKey="Adet" fill="#8b5cf6" radius={[0, 8, 8, 0]}>
                                        {analytics.statusChartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <p style={{ textAlign: 'center', color: '#888', padding: '40px' }}>
                            Durum verisi bulunmuyor.
                        </p>
                    )}
                </ReportSection>

                <footer style={{ 
                    marginTop: '60px', 
                    paddingTop: '20px', 
                    borderTop: '2px solid #e0e0e0',
                    textAlign: 'center',
                    color: '#888',
                    fontSize: '12px'
                }}>
                    <p>Bu rapor Kademe Kalite Yönetim Sistemi tarafından otomatik olarak oluşturulmuştur.</p>
                    <p>© {new Date().getFullYear()} Kademe A.Ş. - Tüm hakları saklıdır.</p>
                </footer>
            </div>
        </>
    );
};

export default PrintableInternalAuditDashboard;
