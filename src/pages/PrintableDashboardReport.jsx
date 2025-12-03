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
                    * { box-sizing: border-box; }
                    body { font-family: 'Roboto', sans-serif; background-color: #f0f2f5; color: #333; margin: 0; padding: 0; }
                    .report-container { max-width: 100%; margin: 0 auto; background: white; padding: 20px; }
                    .report-header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #1F3A5F; padding-bottom: 15px; }
                    .report-header h1 { font-size: 24px; color: #1F3A5F; margin: 0; font-weight: 700; }
                    .report-header p { font-size: 13px; color: #666; margin-top: 5px; }
                    .report-section { margin-bottom: 30px; page-break-inside: avoid; }
                    .section-title { font-size: 18px; font-weight: 700; color: #1F3A5F; border-bottom: 1px solid #ccc; padding-bottom: 8px; margin-bottom: 15px; }
                    .section-subtitle { font-size: 14px; font-weight: 600; color: #555; margin-bottom: 10px; margin-top: 15px; }
                    .grid-container { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; }
                    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
                    .kpi-card { padding: 12px; border: 1px solid #e0e0e0; border-left: 4px solid #1F3A5F; border-radius: 4px; min-height: 80px; }
                    .kpi-title { font-size: 11px; color: #666; margin-bottom: 5px; line-height: 1.3; }
                    .kpi-value { font-size: 20px; font-weight: 700; color: #1F3A5F; line-height: 1.2; }
                    .kpi-subtext { font-size: 10px; color: #888; margin-top: 3px; }
                    .chart-container { height: 250px; margin-top: 15px; page-break-inside: avoid; }
                    .data-table { width: 100%; border-collapse: collapse; font-size: 10px; table-layout: fixed; word-wrap: break-word; }
                    .data-table th, .data-table td { border: 1px solid #ddd; padding: 6px 4px; text-align: left; vertical-align: top; }
                    .data-table th { background-color: #f2f2f2; font-weight: bold; font-size: 10px; }
                    .data-table td { font-size: 9px; line-height: 1.3; }
                    .data-table tr:nth-child(even) { background-color: #f9f9f9; }
                    .data-table .col-no { width: 8%; }
                    .data-table .col-title { width: 50%; word-break: break-word; }
                    .data-table .col-dept { width: 22%; }
                    .data-table .col-days { width: 10%; text-align: center; }
                    .data-table .col-status { width: 10%; text-align: center; }
                    .page-break-before { page-break-before: always; }
                    .text-truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
                    .text-wrap { word-wrap: break-word; word-break: break-word; white-space: normal; }
                    @media print {
                        body { background-color: white; margin: 0; padding: 0; }
                        .report-container { margin: 0; padding: 15mm; box-shadow: none; border: none; max-width: 100%; }
                        @page { size: A4; margin: 15mm; }
                        .report-section { page-break-inside: avoid; }
                        .data-table { font-size: 8px; }
                        .data-table th, .data-table td { padding: 4px 3px; }
                        .kpi-grid { grid-template-columns: repeat(4, 1fr); gap: 8px; }
                        .kpi-card { padding: 8px; }
                        .kpi-title { font-size: 10px; }
                        .kpi-value { font-size: 18px; }
                        .chart-container { height: 200px; page-break-inside: avoid; }
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
                        <thead>
                            <tr>
                                <th className="col-no">No</th>
                                <th className="col-title">Başlık</th>
                                <th className="col-dept">Sorumlu Birim</th>
                                <th className="col-days">Gecikme (Gün)</th>
                                <th className="col-status">Durum</th>
                            </tr>
                        </thead>
                        <tbody>
                            {df8d.overdueRecords && df8d.overdueRecords.length > 0 ? df8d.overdueRecords.map((r, idx) => {
                                const title = r.title || r.nc_number || '-';
                                const truncatedTitle = title.length > 60 ? title.substring(0, 57) + '...' : title;
                                return (
                                    <tr key={r.id || idx}>
                                        <td className="col-no">{r.nc_number || '-'}</td>
                                        <td className="col-title text-wrap" title={title}>{truncatedTitle}</td>
                                        <td className="col-dept">{r.department || r.requesting_unit || 'Belirtilmemiş'}</td>
                                        <td className="col-days">{r.delay_days || r.daysOverdue || '-'}</td>
                                        <td className="col-status">{r.status || 'Açık'}</td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan="5" style={{textAlign: 'center', padding: '15px', color: '#888'}}>
                                        Geciken kayıt bulunmuyor.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                    
                    {df8d.overdueRecords && df8d.overdueRecords.length > 0 && (
                        <div style={{marginTop: '15px', fontSize: '10px', color: '#666'}}>
                            <strong>Toplam Geciken Kayıt:</strong> {df8d.overdueRecords.length} | 
                            <strong> Ortalama Gecikme:</strong> {Math.round(df8d.overdueRecords.reduce((sum, r) => sum + (r.delay_days || r.daysOverdue || 0), 0) / df8d.overdueRecords.length)} gün
                        </div>
                    )}
                </ReportSection>

                <ReportSection title="Detaylı İstatistikler">
                    <div className="grid-container">
                        <div>
                            <h3 className="section-subtitle">Birim Bazında Dağılım</h3>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th className="col-dept">Birim</th>
                                        <th className="col-days">Açık DF</th>
                                        <th className="col-days">Kapatılan</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {df8d.departmentDistribution && df8d.departmentDistribution.length > 0 ? (
                                        df8d.departmentDistribution.slice(0, 10).map((dept, idx) => (
                                            <tr key={idx}>
                                                <td className="col-dept">{dept.name || '-'}</td>
                                                <td className="col-days">{dept.count || 0}</td>
                                                <td className="col-days">{dept.closed || 0}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr><td colSpan="3" style={{textAlign: 'center', padding: '10px'}}>Veri bulunamadı.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div>
                            <h3 className="section-subtitle">Aylık Trend Özeti</h3>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th className="col-dept">Ay</th>
                                        <th className="col-days">Açılan</th>
                                        <th className="col-days">Kapatılan</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {df8d.monthlyTrend && df8d.monthlyTrend.length > 0 ? (
                                        df8d.monthlyTrend.slice(-6).map((month, idx) => (
                                            <tr key={idx}>
                                                <td className="col-dept">{month.name || '-'}</td>
                                                <td className="col-days">{month.opened || 0}</td>
                                                <td className="col-days">{month.closed || 0}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr><td colSpan="3" style={{textAlign: 'center', padding: '10px'}}>Veri bulunamadı.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </ReportSection>
            </div>
        </>
    );
};

export default PrintableDashboardReport;