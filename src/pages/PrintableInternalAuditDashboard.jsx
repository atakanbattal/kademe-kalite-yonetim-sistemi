import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, Legend } from 'recharts';
import { format, startOfToday, addDays } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useData } from '@/contexts/DataContext';

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
    const { session } = useAuth();
    const { audits, auditFindings, loading: dataLoading } = useData();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!session) {
            navigate('/login');
        }
    }, [session, navigate]);

    useEffect(() => {
        if (!dataLoading) {
            setLoading(false);
        }
    }, [dataLoading]);

    useEffect(() => {
        if (!loading) {
            setTimeout(() => window.print(), 1500);
        }
    }, [loading]);

    const analytics = useMemo(() => {
        // Tüm zamanlar için analiz
        const totalAudits = audits.length;
        const totalFindings = auditFindings.length;
        const closedFindings = auditFindings.filter(f => f.non_conformity?.status === 'Kapatıldı').length;
        const openFindings = auditFindings.filter(f => !f.non_conformity || f.non_conformity.status !== 'Kapatıldı');
        
        const departmentFindings = {};
        openFindings.forEach(finding => {
            const audit = audits.find(a => a.id === finding.audit_id);
            const deptName = audit?.department?.unit_name || 'Belirtilmemiş';
            departmentFindings[deptName] = (departmentFindings[deptName] || 0) + 1;
        });

        const chartData = Object.entries(departmentFindings)
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
            const auditDate = new Date(audit.audit_date);
            const monthDiff = (now.getFullYear() - auditDate.getFullYear()) * 12 + (now.getMonth() - auditDate.getMonth());
            if (monthDiff >= 0 && monthDiff < 12) {
                const key = format(auditDate, 'MMM yy', { locale: tr });
                if (monthlyAudits[key] !== undefined) {
                    monthlyAudits[key]++;
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

        return {
            totalAudits,
            totalFindings,
            closedFindings,
            openFindingsCount: openFindings.length,
            departmentChartData: chartData,
            monthlyChartData,
            statusChartData
        };
    }, [audits, auditFindings]);

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
                <title>İç Tetkik Genel Raporu - {format(startOfToday(), 'dd.MM.yyyy')}</title>
            </Helmet>
            <div className="report-container">
                <style>{`
                    @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');
                    body { font-family: 'Roboto', sans-serif; background-color: #f0f2f5; color: #333; margin: 0; padding: 0; }
                    .report-container { max-width: 1000px; margin: 20px auto; background: white; padding: 40px; box-shadow: 0 0 15px rgba(0,0,0,0.1); }
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
                    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
                    @media print {
                        body { background-color: white; }
                        .report-container { margin: 0; padding: 20px; box-shadow: none; border: none; max-width: 100%; }
                        @page { size: A4; margin: 15mm; }
                        .report-section { page-break-inside: avoid; }
                    }
                `}</style>

                <header className="report-header">
                    <h1>İç Tetkik Yönetimi Genel Raporu</h1>
                    <p>Oluşturma Tarihi: {format(startOfToday(), 'dd MMMM yyyy', { locale: tr })}</p>
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
                            title="Bekleyen Bulgu" 
                            value={analytics.totalFindings - analytics.closedFindings} 
                            subtext="İşlem bekliyor"
                        />
                    </div>
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

