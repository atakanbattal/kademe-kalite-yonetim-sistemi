import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from 'recharts';
import { format, startOfToday } from 'date-fns';
import useReportData from '@/hooks/useReportData';
import { useAuth } from '@/contexts/SupabaseAuthContext';

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

const PrintableDashboardReport = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { session } = useAuth();
    const period = searchParams.get('period') || 'last12months';
    const { data, loading, error, periodLabel } = useReportData(period);

    useEffect(() => {
        if (!session) {
            navigate('/login');
        }
    }, [session, navigate]);

    useEffect(() => {
        if (!loading && !error && data) {
            setTimeout(() => window.print(), 2000);
        }
    }, [loading, error, data]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100 text-gray-700">
                <Loader2 className="w-12 h-12 animate-spin mr-4" />
                <span className="text-xl font-semibold">Yönetici Raporu oluşturuluyor, lütfen bekleyin...</span>
            </div>
        );
    }

    if (error || !data) {
        return <div className="text-center p-8 text-red-600 font-semibold">{error || 'Rapor verileri yüklenemedi.'}</div>;
    }

    const { df8d, internalAudit, supplier, vehicleQuality, kaizen, qualityCost, quarantine, deviation, equipment, document } = data;
    const CHART_COLORS = ['#1F3A5F', '#4A6FA5', '#7B93DB', '#A2B5F2', '#CAD5FF'];
    const PIE_COLORS = { A: '#16a34a', B: '#2563eb', C: '#f59e0b', D: '#dc2626', 'N/A': '#6b7280' };

    return (
        <>
            <Helmet>
                <title>Yönetici Özet Raporu - {periodLabel}</title>
            </Helmet>
            <div className="report-container">
                <style>{`
                    @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');
                    body { font-family: 'Roboto', sans-serif; background-color: #f0f2f5; color: #333; }
                    .report-container { max-width: 1000px; margin: 20px auto; background: white; padding: 40px; box-shadow: 0 0 15px rgba(0,0,0,0.1); }
                    .report-header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #1F3A5F; padding-bottom: 20px; }
                    .report-header h1 { font-size: 28px; color: #1F3A5F; margin: 0; }
                    .report-header p { font-size: 16px; color: #666; margin-top: 5px; }
                    .report-section { margin-bottom: 40px; page-break-inside: avoid; }
                    .section-title { font-size: 22px; font-weight: 700; color: #1F3A5F; border-bottom: 1px solid #ccc; padding-bottom: 10px; margin-bottom: 20px; }
                    .grid-container { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
                    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 20px; }
                    .kpi-card { padding: 15px; border: 1px solid #e0e0e0; border-left: 5px solid #1F3A5F; border-radius: 5px; }
                    .kpi-title { font-size: 14px; color: #666; margin-bottom: 5px; }
                    .kpi-value { font-size: 24px; font-weight: 700; color: #1F3A5F; }
                    .kpi-subtext { font-size: 12px; color: #888; margin-top: 5px; }
                    .chart-container { height: 300px; margin-top: 20px; }
                    .data-table { width: 100%; border-collapse: collapse; font-size: 12px; }
                    .data-table th, .data-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    .data-table th { background-color: #f2f2f2; font-weight: bold; }
                    .data-table tr:nth-child(even) { background-color: #f9f9f9; }
                    .page-break-before { page-break-before: always; }
                    @media print {
                        body { background-color: white; }
                        .report-container { margin: 0; padding: 0; box-shadow: none; border: none; }
                        @page { size: A4; margin: 20mm; }
                    }
                `}</style>

                <header className="report-header">
                    <h1>Yönetici Özet Raporu</h1>
                    <p>Dönem: {periodLabel} | Oluşturma Tarihi: {format(startOfToday(), 'dd.MM.yyyy')}</p>
                </header>

                <ReportSection title="Yönetici Özeti">
                    <div className="kpi-grid">
                        <KpiCard title="Açık DF/8D" value={df8d.openCount} />
                        <KpiCard title="Ort. Kapatma Süresi" value={`${df8d.avgClosureDays} gün`} />
                        <KpiCard title="Toplam Kalitesizlik Maliyeti" value={qualityCost.totalCost.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })} />
                        <KpiCard title="Tedarikçi Sınıfı (A/B)" value={`${supplier.gradeDistribution.A || 0} / ${supplier.gradeDistribution.B || 0}`} />
                        <KpiCard title="Karantinadaki Kalem" value={quarantine.inQuarantineCount} />
                        <KpiCard title="Geciken Kalibrasyon" value={equipment.overdueCalibrations} />
                        <KpiCard title="Toplam Kaizen Tasarrufu" value={kaizen.totalSavings.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })} />
                        <KpiCard title="Açık Sapma Talepleri" value={deviation.openCount} />
                    </div>
                </ReportSection>

                <ReportSection title="DF & 8D Yönetimi">
                    <div className="grid-container">
                        <div className="chart-container">
                            <ResponsiveContainer>
                                <BarChart data={df8d.monthlyTrend}>
                                    <XAxis dataKey="name" fontSize={10} />
                                    <YAxis fontSize={10} />
                                    <Tooltip />
                                    <Legend wrapperStyle={{fontSize: '12px'}} />
                                    <Bar dataKey="opened" name="Açılan" fill={CHART_COLORS[0]} />
                                    <Bar dataKey="closed" name="Kapatılan" fill={CHART_COLORS[1]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="chart-container">
                            <ResponsiveContainer>
                                <BarChart data={df8d.departmentDistribution} layout="vertical">
                                    <XAxis type="number" hide />
                                    <YAxis type="category" dataKey="name" width={80} fontSize={10} interval={0} />
                                    <Tooltip />
                                    <Bar dataKey="count" name="Uygunsuzluk Sayısı" fill={CHART_COLORS[0]}>
                                        {df8d.departmentDistribution.map((entry, index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </ReportSection>

                <ReportSection title="Tedarikçi Kalite Yönetimi">
                    <div className="grid-container">
                        <div className="chart-container">
                            <ResponsiveContainer>
                                <PieChart>
                                    <Pie data={Object.entries(supplier.gradeDistribution).map(([name, value]) => ({ name, value }))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                        {Object.keys(supplier.gradeDistribution).map((key, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[key] || '#ccc'} />)}
                                    </Pie>
                                    <Tooltip />
                                    <Legend wrapperStyle={{fontSize: '12px'}} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="chart-container">
                            <ResponsiveContainer>
                                <BarChart data={supplier.topSuppliersWithNCs}>
                                    <XAxis dataKey="name" fontSize={10} />
                                    <YAxis fontSize={10} />
                                    <Tooltip />
                                    <Bar dataKey="count" name="Uygunsuzluk Sayısı" fill={CHART_COLORS[0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </ReportSection>

                <ReportSection title="Kalitesizlik Maliyetleri" className="page-break-before">
                    <div className="chart-container">
                        <ResponsiveContainer>
                            <LineChart data={qualityCost.monthlyTrend}>
                                <XAxis dataKey="name" fontSize={10} />
                                <YAxis fontSize={10} tickFormatter={(val) => `${(val/1000).toFixed(0)}k`} />
                                <Tooltip formatter={(val) => val.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })} />
                                <Legend wrapperStyle={{fontSize: '12px'}} />
                                <Line type="monotone" dataKey="totalCost" name="Toplam Maliyet" stroke={CHART_COLORS[0]} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </ReportSection>

                <ReportSection title="Ekler: Geciken Kayıtlar" className="page-break-before">
                    <h3 className="section-subtitle">Geciken DF/8D Kayıtları</h3>
                    <table className="data-table">
                        <thead><tr><th>No</th><th>Başlık</th><th>Sorumlu Birim</th><th>Gecikme (Gün)</th></tr></thead>
                        <tbody>
                            {df8d.overdueRecords.length > 0 ? df8d.overdueRecords.map(r => (
                                <tr key={r.id}><td>{r.nc_number}</td><td>{r.title}</td><td>{r.department}</td><td>{r.delay_days}</td></tr>
                            )) : <tr><td colSpan="4">Geciken kayıt bulunmuyor.</td></tr>}
                        </tbody>
                    </table>
                </ReportSection>
            </div>
        </>
    );
};

export default PrintableDashboardReport;