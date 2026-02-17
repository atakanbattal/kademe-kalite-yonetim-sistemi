import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from 'recharts';
import { format, startOfToday, parseISO } from 'date-fns';
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

    const { 
        df8d, internalAudit, supplier, vehicleQuality, kaizen, qualityCost, 
        quarantine, deviation, equipment, document, complaints, criticalNCs, 
        qualityWall, rootCauseHeatmap, todayTasks, alerts, kpis, qualityGoals, 
        benchmarks, risks 
    } = data;
    const CHART_COLORS = ['#1F3A5F', '#4A6FA5', '#7B93DB', '#A2B5F2', '#CAD5FF'];
    const PIE_COLORS = { A: '#16a34a', B: '#2563eb', C: '#f59e0b', D: '#dc2626', 'N/A': '#6b7280' };

    return (
        <>
            <Helmet>
                <title>Kademe A.Ş. Kalite Yönetim Sistemi</title>
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
                        /* Print için renkleri koru */
                        * {
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                            color-adjust: exact !important;
                        }
                        
                        body { background-color: white !important; margin: 0; padding: 0; }
                        .report-container { margin: 0; padding: 15mm; box-shadow: none; border: none; max-width: 100%; }
                        @page { size: A4; margin: 15mm; }
                        .report-section { page-break-inside: avoid; break-inside: avoid; }
                        .section-title { page-break-after: avoid; break-after: avoid; }
                        .data-table { font-size: 8px; page-break-inside: auto; }
                        .data-table thead { display: table-header-group; }
                        .data-table tbody tr { page-break-inside: avoid; break-inside: avoid; }
                        .data-table th, .data-table td { padding: 4px 3px; }
                        .kpi-grid { grid-template-columns: repeat(4, 1fr); gap: 8px; }
                        .kpi-card { padding: 8px; page-break-inside: avoid; break-inside: avoid; }
                        .kpi-title { font-size: 10px; }
                        .kpi-value { font-size: 18px; }
                        .chart-container { height: 200px; page-break-inside: avoid; break-inside: avoid; }
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
                        <KpiCard title="Toplam Kalite Maliyeti" value={qualityCost.totalCost.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })} />
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

                <ReportSection title="Kalite Maliyetleri" className="page-break-before">
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

                {/* Müşteri Şikayetleri */}
                {complaints && complaints.total > 0 && (
                    <ReportSection title="Müşteri Şikayetleri" className="page-break-before">
                        <div className="kpi-grid">
                            <KpiCard title="Toplam Şikayet" value={complaints.total} />
                            <KpiCard title="SLA Gecikmiş" value={complaints.slaOverdue} />
                            <KpiCard title="Kritik Şikayet" value={complaints.bySeverity?.Kritik || 0} />
                            <KpiCard title="Yüksek Şikayet" value={complaints.bySeverity?.Yüksek || 0} />
                        </div>
                        {complaints.monthlyTrend && complaints.monthlyTrend.length > 0 && (
                            <div className="chart-container">
                                <ResponsiveContainer>
                                    <BarChart data={complaints.monthlyTrend}>
                                        <XAxis dataKey="name" fontSize={10} />
                                        <YAxis fontSize={10} />
                                        <Tooltip />
                                        <Bar dataKey="count" name="Şikayet Sayısı" fill={CHART_COLORS[2]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </ReportSection>
                )}

                {/* Kritik Uygunsuzluklar */}
                {(criticalNCs?.highRPN?.length > 0 || criticalNCs?.highCost?.length > 0 || criticalNCs?.recurring?.length > 0) && (
                    <ReportSection title="Kritik Uygunsuzluklar" className="page-break-before">
                        {criticalNCs.highRPN && criticalNCs.highRPN.length > 0 && (
                            <>
                                <h3 className="section-subtitle">RPN Yüksek Uygunsuzluklar (RPN ≥ 100)</h3>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th className="col-no">No</th>
                                            <th className="col-title">Başlık</th>
                                            <th className="col-dept">Birim</th>
                                            <th className="col-days">RPN</th>
                                            <th className="col-status">Durum</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {criticalNCs.highRPN.map((nc, idx) => (
                                            <tr key={idx}>
                                                <td className="col-no">{nc.nc_number || '-'}</td>
                                                <td className="col-title text-wrap">{nc.title || nc.nc_number || '-'}</td>
                                                <td className="col-dept">{nc.department || nc.requesting_unit || '-'}</td>
                                                <td className="col-days">{nc.rpn}</td>
                                                <td className="col-status">{nc.status || 'Açık'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </>
                        )}
                        {criticalNCs.highCost && criticalNCs.highCost.length > 0 && (
                            <>
                                <h3 className="section-subtitle" style={{marginTop: '20px'}}>Maliyeti Yüksek Uygunsuzluklar</h3>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th className="col-no">No</th>
                                            <th className="col-title">Başlık</th>
                                            <th className="col-dept">Birim</th>
                                            <th className="col-days">Maliyet (₺)</th>
                                            <th className="col-status">Durum</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {criticalNCs.highCost.map((nc, idx) => (
                                            <tr key={idx}>
                                                <td className="col-no">{nc.nc_number || '-'}</td>
                                                <td className="col-title text-wrap">{nc.title || nc.nc_number || '-'}</td>
                                                <td className="col-dept">{nc.department || nc.requesting_unit || '-'}</td>
                                                <td className="col-days">{nc.totalCost?.toLocaleString('tr-TR') || '0'}</td>
                                                <td className="col-status">{nc.status || 'Açık'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </>
                        )}
                        {criticalNCs.recurring && criticalNCs.recurring.length > 0 && (
                            <>
                                <h3 className="section-subtitle" style={{marginTop: '20px'}}>Tekrarlayan Uygunsuzluklar</h3>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th className="col-no">Parça Kodu</th>
                                            <th className="col-title">Başlık</th>
                                            <th className="col-dept">Tekrar Sayısı</th>
                                            <th className="col-status">Durum</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {criticalNCs.recurring.map((nc, idx) => (
                                            <tr key={idx}>
                                                <td className="col-no">{nc.part_code || '-'}</td>
                                                <td className="col-title text-wrap">{nc.title || nc.nc_number || '-'}</td>
                                                <td className="col-dept">{nc.count || 0}</td>
                                                <td className="col-status">{nc.status || 'Açık'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </>
                        )}
                    </ReportSection>
                )}

                {/* Kalite Duvarı */}
                {(qualityWall?.best?.length > 0 || qualityWall?.worst?.length > 0) && (
                    <ReportSection title="Kalite Duvarı" className="page-break-before">
                        <div className="grid-container">
                            <div>
                                <h3 className="section-subtitle">En İyi 3 Birim</h3>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th className="col-dept">Birim</th>
                                            <th className="col-days">Açık</th>
                                            <th className="col-days">Toplam</th>
                                            <th className="col-status">Kapatma Oranı</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {qualityWall.best.map((dept, idx) => {
                                            const closeRate = dept.totalNCs > 0 ? ((dept.closedNCs / dept.totalNCs) * 100).toFixed(1) : '0';
                                            return (
                                                <tr key={idx}>
                                                    <td className="col-dept">{dept.name}</td>
                                                    <td className="col-days">{dept.openNCs}</td>
                                                    <td className="col-days">{dept.totalNCs}</td>
                                                    <td className="col-status">{closeRate}%</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div>
                                <h3 className="section-subtitle">En Kötü 3 Birim</h3>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th className="col-dept">Birim</th>
                                            <th className="col-days">Açık</th>
                                            <th className="col-days">Toplam</th>
                                            <th className="col-status">Kapatma Oranı</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {qualityWall.worst.map((dept, idx) => {
                                            const closeRate = dept.totalNCs > 0 ? ((dept.closedNCs / dept.totalNCs) * 100).toFixed(1) : '0';
                                            return (
                                                <tr key={idx}>
                                                    <td className="col-dept">{dept.name}</td>
                                                    <td className="col-days">{dept.openNCs}</td>
                                                    <td className="col-days">{dept.totalNCs}</td>
                                                    <td className="col-status">{closeRate}%</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </ReportSection>
                )}

                {/* Kök Neden Isı Haritası */}
                {(rootCauseHeatmap?.byDepartment?.length > 0 || rootCauseHeatmap?.byRootCause?.length > 0) && (
                    <ReportSection title="Kök Neden Analizi" className="page-break-before">
                        <div className="grid-container">
                            {rootCauseHeatmap.byDepartment && rootCauseHeatmap.byDepartment.length > 0 && (
                                <div>
                                    <h3 className="section-subtitle">Birim Bazında Hata Yoğunluğu</h3>
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th className="col-dept">Birim</th>
                                                <th className="col-days">Hata Sayısı</th>
                                                <th className="col-status">Ort. Şiddet</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rootCauseHeatmap.byDepartment.slice(0, 10).map((dept, idx) => (
                                                <tr key={idx}>
                                                    <td className="col-dept">{dept.name}</td>
                                                    <td className="col-days">{dept.count}</td>
                                                    <td className="col-status">{dept.avgSeverity}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            {rootCauseHeatmap.byRootCause && rootCauseHeatmap.byRootCause.length > 0 && (
                                <div>
                                    <h3 className="section-subtitle">En Sık Tekrarlayan Kök Nedenler</h3>
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th className="col-title">Kök Neden</th>
                                                <th className="col-days">Tekrar Sayısı</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rootCauseHeatmap.byRootCause.slice(0, 10).map((rc, idx) => (
                                                <tr key={idx}>
                                                    <td className="col-title text-wrap">{rc.name}</td>
                                                    <td className="col-days">{rc.count}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </ReportSection>
                )}

                {/* Bugünün Görevleri */}
                {(todayTasks?.overdue8D?.length > 0 || todayTasks?.dueCalibrations?.length > 0) && (
                    <ReportSection title="Bugünün Kritik Görevleri" className="page-break-before">
                        {todayTasks.overdue8D && todayTasks.overdue8D.length > 0 && (
                            <>
                                <h3 className="section-subtitle">Geciken 8D Kayıtları</h3>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th className="col-no">No</th>
                                            <th className="col-title">Başlık</th>
                                            <th className="col-dept">Birim</th>
                                            <th className="col-days">Gecikme (Gün)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {todayTasks.overdue8D.map((task, idx) => (
                                            <tr key={idx}>
                                                <td className="col-no">{task.nc_number || '-'}</td>
                                                <td className="col-title text-wrap">{task.title || task.nc_number || '-'}</td>
                                                <td className="col-dept">{task.department || task.requesting_unit || '-'}</td>
                                                <td className="col-days">{task.daysOverdue || 0}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </>
                        )}
                        {todayTasks.dueCalibrations && todayTasks.dueCalibrations.length > 0 && (
                            <>
                                <h3 className="section-subtitle" style={{marginTop: '20px'}}>Geciken Kalibrasyonlar</h3>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th className="col-title">Cihaz Adı</th>
                                            <th className="col-dept">Son Kalibrasyon</th>
                                            <th className="col-days">Gecikme (Gün)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {todayTasks.dueCalibrations.map((cal, idx) => (
                                            <tr key={idx}>
                                                <td className="col-title">{cal.equipment || '-'}</td>
                                                <td className="col-dept">{cal.dueDate ? format(parseISO(cal.dueDate), 'dd.MM.yyyy') : '-'}</td>
                                                <td className="col-days">{cal.daysOverdue || 0}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </>
                        )}
                    </ReportSection>
                )}

                {/* Uyarılar */}
                {(alerts?.overdueNCs?.length > 0 || alerts?.overdueCalibrations?.length > 0 || alerts?.expiringDocs?.length > 0 || alerts?.costAnomalies?.length > 0) && (
                    <ReportSection title="Sistem Uyarıları" className="page-break-before">
                        {alerts.overdueNCs && alerts.overdueNCs.length > 0 && (
                            <>
                                <h3 className="section-subtitle">30+ Gün Geciken DF/8D</h3>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th className="col-no">No</th>
                                            <th className="col-title">Başlık</th>
                                            <th className="col-dept">Birim</th>
                                            <th className="col-days">Gecikme (Gün)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {alerts.overdueNCs.slice(0, 10).map((alert, idx) => (
                                            <tr key={idx}>
                                                <td className="col-no">{alert.nc_number || '-'}</td>
                                                <td className="col-title text-wrap">{alert.title || alert.nc_number || '-'}</td>
                                                <td className="col-dept">{alert.department || alert.requesting_unit || '-'}</td>
                                                <td className="col-days">{alert.daysOverdue || 0}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </>
                        )}
                        {alerts.expiringDocs && alerts.expiringDocs.length > 0 && (
                            <>
                                <h3 className="section-subtitle" style={{marginTop: '20px'}}>Süresi Dolmak Üzere Olan Dokümanlar</h3>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th className="col-title">Doküman Adı</th>
                                            <th className="col-dept">Geçerlilik Tarihi</th>
                                            <th className="col-days">Kalan Gün</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {alerts.expiringDocs.map((doc, idx) => (
                                            <tr key={idx}>
                                                <td className="col-title text-wrap">{doc.name || doc.title || '-'}</td>
                                                <td className="col-dept">{doc.valid_until ? format(parseISO(doc.valid_until), 'dd.MM.yyyy') : '-'}</td>
                                                <td className="col-days">{doc.daysRemaining || 0}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </>
                        )}
                        {alerts.costAnomalies && alerts.costAnomalies.length > 0 && (
                            <>
                                <h3 className="section-subtitle" style={{marginTop: '20px'}}>Maliyet Anomalileri</h3>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th className="col-title">Uyarı</th>
                                            <th className="col-dept">Artış Oranı</th>
                                            <th className="col-days">Bu Ay</th>
                                            <th className="col-status">Geçen Ay</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {alerts.costAnomalies.map((anomaly, idx) => (
                                            <tr key={idx}>
                                                <td className="col-title">{anomaly.message}</td>
                                                <td className="col-dept">%{anomaly.increase}</td>
                                                <td className="col-days">{anomaly.thisMonth?.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' }) || '-'}</td>
                                                <td className="col-status">{anomaly.lastMonth?.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' }) || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </>
                        )}
                    </ReportSection>
                )}

                {/* Kalite Hedefleri */}
                {qualityGoals && qualityGoals.length > 0 && (
                    <ReportSection title="Kalite Hedefleri ve Gerçekleşenler" className="page-break-before">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th className="col-title">Hedef Adı</th>
                                    <th className="col-dept">Hedef</th>
                                    <th className="col-days">Gerçekleşen</th>
                                    <th className="col-status">Başarı %</th>
                                    <th className="col-status">Durum</th>
                                </tr>
                            </thead>
                            <tbody>
                                {qualityGoals.map((goal, idx) => {
                                    // Basit hesaplama (gerçek hesaplama QualityGoalsPanel'de yapılıyor)
                                    const actual = 0; // Bu kısım daha detaylı hesaplanabilir
                                    const target = goal.target_value || 0;
                                    const progress = target > 0 ? Math.min((actual / target * 100), 100) : 0;
                                    const status = progress >= 100 ? 'Başarılı' : progress >= 75 ? 'Risk' : 'Başarısız';
                                    return (
                                        <tr key={idx}>
                                            <td className="col-title text-wrap">{goal.goal_name || goal.name || '-'}</td>
                                            <td className="col-dept">{target}</td>
                                            <td className="col-days">{actual}</td>
                                            <td className="col-status">{progress.toFixed(1)}%</td>
                                            <td className="col-status">{status}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </ReportSection>
                )}

                {/* Risk Bazlı Göstergeler */}
                {risks && risks.length > 0 && (
                    <ReportSection title="Risk Bazlı Göstergeler (ISO 9001:2015 Madde 6.1)" className="page-break-before">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th className="col-title">Risk Tipi</th>
                                    <th className="col-dept">Risk Adı</th>
                                    <th className="col-days">Olasılık</th>
                                    <th className="col-days">Etki</th>
                                    <th className="col-status">Risk Skoru</th>
                                    <th className="col-status">Risk Seviyesi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {risks.map((risk, idx) => {
                                    const riskLevel = risk.risk_score >= 20 ? 'KRİTİK' : risk.risk_score >= 10 ? 'YÜKSEK' : risk.risk_score >= 5 ? 'ORTA' : 'DÜŞÜK';
                                    return (
                                        <tr key={idx}>
                                            <td className="col-title">{risk.risk_type || '-'}</td>
                                            <td className="col-dept text-wrap">{risk.risk_name || '-'}</td>
                                            <td className="col-days">{risk.probability || '-'}/5</td>
                                            <td className="col-days">{risk.impact || '-'}/5</td>
                                            <td className="col-status">{risk.risk_score || '-'}</td>
                                            <td className="col-status">{riskLevel}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </ReportSection>
                )}
            </div>
        </>
    );
};

export default PrintableDashboardReport;