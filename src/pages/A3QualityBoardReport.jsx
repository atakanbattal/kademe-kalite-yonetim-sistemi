import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Loader2 } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, CartesianGrid,
    ComposedChart, Area, Line,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import useA3ReportData from '@/hooks/useA3ReportData';
import { useAuth } from '@/contexts/SupabaseAuthContext';

// ── Renk Paleti ───────────────────────────────────────────────────────────────
const C = {
    navy:   '#1e3a5f',
    blue:   '#2563eb',
    indigo: '#4f46e5',
    green:  '#15803d',
    red:    '#dc2626',
    orange: '#ea580c',
    yellow: '#b45309',
    purple: '#7c3aed',
    teal:   '#0f766e',
    rose:   '#be123c',
    gray:   '#4b5563',
    slate:  '#64748b',
    lime:   '#4d7c0f',
};

const CHART_COLORS = ['#2563eb','#15803d','#ea580c','#b45309','#7c3aed','#0f766e','#be123c','#1e3a5f','#64748b','#dc2626'];
const COST_COLORS  = { 'İç Hata Maliyetleri': '#dc2626', 'Dış Hata Maliyetleri': '#ea580c', 'Önleme Maliyetleri': '#15803d', 'Değerlendirme Maliyetleri': '#2563eb' };
const GRADE_COLORS = { A: '#15803d', B: '#2563eb', C: '#b45309', D: '#dc2626', 'N/A': '#64748b' };
const RESULT_COLORS = { Kabul: '#15803d', 'Şartlı Kabul': '#b45309', Ret: '#dc2626', Beklemede: '#64748b' };

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtCurrency = (n) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n || 0);
const fmtNum      = (n) => new Intl.NumberFormat('tr-TR').format(n || 0);
const safeText = (s) => (s && typeof s === 'string' ? s.normalize('NFC') : s) || '-';
const trunc = (s, len = 28) => {
    if (!s) return '-';
    const str = safeText(String(s));
    if (str.length <= len) return str;
    const cut = str.slice(0, len - 1);
    const lastSpace = cut.lastIndexOf(' ');
    if (lastSpace > len * 0.5) return cut.slice(0, lastSpace) + '…';
    return cut + '…';
};

// ── Temel Bileşenler ──────────────────────────────────────────────────────────
const KpiCard = ({ label, value, sub, color = C.navy, bg = '#f0f4ff', border }) => (
    <div className="report-kpi-card" style={{
        background: bg,
        borderLeft: `5px solid ${border || color}`,
        borderRadius: 5,
        padding: '12px 14px',
        minHeight: 88,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    }}>
        <div className="report-kpi-card-label" style={{ fontSize: 11, color: C.gray, fontWeight: 500, lineHeight: 1.35 }}>{label}</div>
        <div className="report-kpi-card-value" style={{ fontSize: 30, fontWeight: 800, color, lineHeight: 1.05, marginTop: 4 }}>{value}</div>
        {sub && <div className="report-kpi-card-sub" style={{ fontSize: 10, color: C.slate, marginTop: 3 }}>{sub}</div>}
    </div>
);

const SectionTitle = ({ children, color = C.navy }) => (
    <div style={{
        background: color,
        color: 'white',
        padding: '6px 12px',
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        borderRadius: '4px 4px 0 0',
    }}>
        {children}
    </div>
);

const Panel = ({ title, color = C.navy, children, style = {} }) => (
    <div className="report-panel" style={{ border: `1.5px solid ${color}40`, borderRadius: 5, overflow: 'hidden', background: 'white', ...style }}>
        <SectionTitle color={color}>{title}</SectionTitle>
        <div className="report-panel-body" style={{ padding: '10px 12px' }}>{children}</div>
    </div>
);

const StatRow = ({ label, value, color, bold }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
        <span style={{ fontSize: 10, color: C.gray }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: bold ? 800 : 700, color: color || C.navy }}>{value}</span>
    </div>
);

const MiniTable = ({ headers, rows, emptyMsg = 'Veri yok', fontSize = 10 }) => (
    <table className="report-mini-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize }}>
        <thead>
            <tr>
                {headers.map((h, i) => (
                    <th key={i} style={{
                        background: '#f1f5f9', border: '1px solid #e2e8f0',
                        padding: '4px 6px', textAlign: 'left', fontWeight: 700, color: '#374151',
                    }}>{h}</th>
                ))}
            </tr>
        </thead>
        <tbody>
            {rows.length === 0 ? (
                <tr><td colSpan={headers.length} style={{ textAlign: 'center', padding: 10, color: C.slate, fontSize: 10 }}>{emptyMsg}</td></tr>
            ) : rows.map((row, ri) => (
                <tr key={ri} style={{ background: ri % 2 === 0 ? 'white' : '#f8fafc' }}>
                    {row.map((cell, ci) => (
                        <td key={ci} style={{ border: '1px solid #e2e8f0', padding: '3px 6px', verticalAlign: 'top' }}>{cell}</td>
                    ))}
                </tr>
            ))}
        </tbody>
    </table>
);

const Row = ({ cols, gap = 10, mb = 14, className = '', children }) => (
    <div className={`report-row report-block ${className}`.trim()} style={{ display: 'grid', gridTemplateColumns: cols || `repeat(${React.Children.count(children)}, 1fr)`, gap, marginBottom: mb, alignItems: 'start' }}>
        {children}
    </div>
);

const PageHeader = ({ title, periodLabel, pageLabel }) => (
    <div className="report-section-header" style={{
        background:`linear-gradient(135deg,${C.navy} 0%,#2d5a9b 55%,#3b82f6 100%)`,
        color:'white', borderRadius:6, padding:'8px 16px', margin:'6px 0 10px',
        display:'flex', justifyContent:'space-between', alignItems:'center',
        pageBreakAfter:'avoid', breakAfter:'avoid-page',
    }}>
        <div style={{fontSize:16,fontWeight:800}}>{title}</div>
        <div style={{fontSize:12,opacity:0.85,textAlign:'right'}}>
            <div>Dönem: {periodLabel} · {format(new Date(),'dd.MM.yyyy')}</div>
            {pageLabel && <div style={{fontSize:11,marginTop:2}}>{pageLabel}</div>}
        </div>
    </div>
);

const SectionBlock = ({ children }) => (
    <div className="report-section-block report-block">
        {children}
    </div>
);

// ── Ana Bileşen ───────────────────────────────────────────────────────────────
const A3QualityBoardReport = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { session } = useAuth();
    const period = searchParams.get('period') || 'last3months';
    const shouldAutoPrint = searchParams.get('autoprint') === 'true';
    const { data, loading, error, periodLabel } = useA3ReportData(period);

    useEffect(() => { if (!session) navigate('/login'); }, [session, navigate]);
    useEffect(() => {
        if (!shouldAutoPrint || loading || error || !data) return;

        const timer = setTimeout(() => window.print(), 900);
        return () => clearTimeout(timer);
    }, [shouldAutoPrint, loading, error, data]);

    if (loading) return (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#f0f4ff', gap:16 }}>
            <Loader2 style={{ width:56, height:56, color: C.navy, animation:'spin 1s linear infinite' }} />
            <div style={{ fontSize:20, fontWeight:700, color: C.navy }}>Kalite Panosu Raporu hazırlanıyor…</div>
            <div style={{ fontSize:13, color: C.slate }}>Tüm modüller yükleniyor, lütfen bekleyin.</div>
            <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
        </div>
    );

    if (error || !data) return (
        <div style={{ textAlign:'center', padding:60, color: C.red, fontSize:16, fontWeight:600 }}>
            {error || 'Rapor verileri yüklenemedi.'}
        </div>
    );

    const { kpis, ncByDept, ncByType, ncMonthly, costByType, costByUnit, costMonthly, qualityActivities,
            incoming, suppliers, vehicles, complaints, deviations, nonconformityModule, fixtureTracking,
            qualityWall, openNC, openNCTotal, openNCGeciken, activeQuarantine, overdueCalibrations,
            costBurden, governance } = data;

    const hasSupplySection = (
        kpis.totalIncoming > 0 ||
        suppliers.gradeDistribution.length > 0 ||
        suppliers.topSuppliersNC.length > 0 ||
        incoming.topRejectedSuppliers.length > 0 ||
        (qualityActivities?.supplierAuditDetails?.length || 0) > 0 ||
        ncByType.length > 0 ||
        deviations.byStatus.length > 0 ||
        (deviations.byUnit?.length || 0) > 0
    );

    const hasNonconformitySection = Boolean(
        nonconformityModule && (
            nonconformityModule.total > 0 ||
            (nonconformityModule.suggestedItems?.length || 0) > 0 ||
            (nonconformityModule.recentRecords?.length || 0) > 0
        )
    );

    const hasFixtureSection = Boolean(
        fixtureTracking && (
            fixtureTracking.total > 0 ||
            (fixtureTracking.urgentItems?.length || 0) > 0 ||
            (fixtureTracking.recentVerifications?.length || 0) > 0 ||
            (fixtureTracking.recentNonconformities?.length || 0) > 0
        )
    );

    const hasNcFixtureSection = hasNonconformitySection || hasFixtureSection;

    const hasVehicleComplaintSection = (
        vehicles.faultByCategory.length > 0 ||
        vehicles.monthly.length > 0 ||
        vehicles.topFaultyVehicles.length > 0 ||
        complaints.byStatus.length > 0 ||
        complaints.monthly.length > 0
    );

    const hasTopCostTrainingSection = (
        vehicles.faultByCategory.length > 0 ||
        vehicles.topFaultyVehicles.length > 0 ||
        (vehicles.faultCostByVehicleType?.length || 0) > 0 ||
        costMonthly.length > 0 ||
        costByUnit.length > 0 ||
        (qualityActivities?.trainingDetails?.length || 0) > 0 ||
        (qualityActivities?.totalTrainings || 0) > 0
    );

    const hasGovernanceSection = (
        (costBurden?.byCategory?.length || 0) > 0 ||
        (costBurden?.topDrivers?.length || 0) > 0 ||
        (governance?.kpiWatch?.length || 0) > 0 ||
        (governance?.summary?.length || 0) > 0 ||
        (governance?.overdueTasks?.length || 0) > 0 ||
        (governance?.expiringDocs?.length || 0) > 0 ||
        (overdueCalibrations?.length || 0) > 0
    );

    // Tüm SAYFA CSS
    const css = `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body{font-family:'Inter','Segoe UI',system-ui,sans-serif;background:#e8eef7;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
        .wrap{background:white;}
        .wrap text,.wrap tspan{font-family:inherit;}
        @media screen{
            .wrap{max-width:1200px;margin:24px auto;padding:24px;box-shadow:0 6px 24px rgba(0,0,0,.15);border-radius:8px;}
        }
        @media print{
            body{background:white!important;}
            .wrap{padding:8mm;margin:0;max-width:100%;}
            @page{size:A3 landscape;margin:7mm;}
            .report-panel,.wrap .report-panel{page-break-inside:avoid;break-inside:avoid;}
            .report-mini-table tr{page-break-inside:avoid;break-inside:avoid;}
            .report-row{page-break-inside:auto;break-inside:auto;gap:8px!important;margin-bottom:10px!important;}
            .report-section-header{page-break-after:avoid;break-after:avoid-page;}
            .report-section-block{page-break-inside:avoid;break-inside:avoid-page;}
            .report-page-hero{padding:10px 14px!important;margin-bottom:10px!important;}
            .report-kpi-card{min-height:72px!important;padding:9px 10px!important;}
            .report-kpi-card-label{font-size:10px!important;}
            .report-kpi-card-value{font-size:22px!important;}
            .report-kpi-card-sub{font-size:9px!important;}
            .report-panel-body{padding:8px 10px!important;}
            .report-section-header{padding:7px 12px!important;margin:4px 0 8px!important;}
        }
    `;

    return (
        <>
            <Helmet><title>Kalite Panosu – {periodLabel}</title></Helmet>
            <style>{css}</style>
            <div className="wrap" lang="tr">

                {/* ══════════════════════════════════════════════════════════ */}
                {/* BAŞLIK                                                     */}
                {/* ══════════════════════════════════════════════════════════ */}
                <div className="report-block report-page-hero" style={{
                    background: `linear-gradient(135deg,${C.navy} 0%,#2d5a9b 55%,#3b82f6 100%)`,
                    color:'white', borderRadius:6, padding:'14px 20px', marginBottom:14,
                    display:'flex', justifyContent:'space-between', alignItems:'center',
                }}>
                    <div>
                        <div style={{ fontSize:24, fontWeight:900, letterSpacing:0.6 }}>KALİTE YÖNETİM SİSTEMİ — PERFORMANS ÖZETİ</div>
                        <div style={{ fontSize:12, opacity:0.85, marginTop:3 }}>Kademe A.Ş. · Tüm Modüller · Özet Performans Göstergesi</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                        <div style={{ fontSize:15, fontWeight:800 }}>Dönem: {periodLabel}</div>
                        <div style={{ fontSize:11, opacity:0.85 }}>Oluşturma: {format(new Date(),'dd MMMM yyyy HH:mm',{locale:tr})}</div>
                        <div style={{ fontSize:10, opacity:0.7, marginTop:2 }}>Toplam Personel: {data.meta?.totalPersonnel || 0} kişi</div>
                    </div>
                </div>

                {/* ══════════════════════════════════════════════════════════ */}
                {/* KPI SATIRLARI (2 × 5)                                     */}
                {/* ══════════════════════════════════════════════════════════ */}
                <Row cols="repeat(5,1fr)" gap={8} mb={8}>
                    <KpiCard label="Açık DF Kaydı"    value={kpis.openDF}  color={C.red}    bg="#fef2f2" sub={`Toplam ${kpis.totalNc} NC kaydı`} />
                    <KpiCard label="Açık 8D Kaydı"    value={kpis.open8D}  color={C.orange}  bg="#fff7ed" sub={`${kpis.closedNc} kapatıldı`} />
                    <KpiCard label="Ort. Kapatma Süresi" value={`${kpis.avgClosureDays} gün`} color={kpis.avgClosureDays > 30 ? C.red : C.teal} bg={kpis.avgClosureDays > 30 ? '#fef2f2' : '#f0fdfa'} sub="DF/8D ortalama" />
                    <KpiCard label="Dönem Kalite Maliyeti" value={fmtCurrency(kpis.totalCost)} color={C.red}   bg="#fef2f2" sub="Toplam maliyet" />
                    <KpiCard label="Karantinadaki Ürün"   value={kpis.inQuarantine} color={C.purple} bg="#f5f3ff" sub={`Toplam ${kpis.totalQuarantine} kayıt`} />
                </Row>
                <Row cols="repeat(4,1fr)" gap={8} mb={14}>
                    <KpiCard label="Müşteri Şikayeti"  value={kpis.openComplaints} color={C.rose}  bg="#fff1f2" sub={`${kpis.slaOverdue} SLA gecikmiş`} />
                    <KpiCard label="Girdi Red Oranı"   value={`%${kpis.incomingRejectionRate}`} color={kpis.incomingRejectionRate > 5 ? C.red : C.green} bg={kpis.incomingRejectionRate > 5 ? '#fef2f2':'#f0fdf4'} sub={`${kpis.rejectedIncoming}/${kpis.totalIncoming} kontrol`} />
                    <KpiCard label="Araç Geçiş Oranı"  value={`%${kpis.vehiclePassRate}`} color={parseFloat(kpis.vehiclePassRate) > 90 ? C.green : C.orange} bg={parseFloat(kpis.vehiclePassRate) > 90 ? '#f0fdf4':'#fff7ed'} sub={`${kpis.passedVehicles}/${kpis.totalVehicles} araç`} />
                    <KpiCard label="Onaylı Firma" value={kpis.activeSuppliers} color={C.blue}  bg="#eff6ff" sub={`${kpis.totalSupplierNC} Ted. NC`} />
                </Row>

                {/* ══════════════════════════════════════════════════════════ */}
                {/* SATIR A: Birim NC Dağılımı | Maliyet Dağılımı (2 sütun) */}
                {/* ══════════════════════════════════════════════════════════ */}
                <Row cols="1fr 1fr" gap={12} mb={14}>
                    {/* Birim bazlı NC — Talep eden birimlere göre */}
                    <Panel title="Birim Bazlı Uygunsuzluk Dağılımı" color={C.red}>
                        <div style={{fontSize:9,color:C.slate,marginBottom:6}}>Açıldığı birime göre dağılım</div>
                        {ncByDept.length === 0
                            ? <div style={{textAlign:'center',color:C.slate,padding:30,fontSize:11}}>Bu dönemde uygunsuzluk kaydı yok.</div>
                            : <div style={{width:'100%',minHeight:320,display:'flex',flexDirection:'column'}}>
                                <ResponsiveContainer width="100%" height={320}>
                                    <BarChart data={ncByDept} margin={{top:12,right:16,left:8,bottom:12}} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={true} vertical={false}/>
                                        <XAxis type="number" fontSize={11} tick={{fill:'#374151'}}/>
                                        <YAxis type="category" dataKey="name" width={110} fontSize={10} tick={{fill:'#374151'}} interval={0} tickFormatter={v=>trunc(safeText(v),18)}/>
                                        <Tooltip contentStyle={{fontSize:11}}/>
                                        <Legend wrapperStyle={{fontSize:11,paddingTop:8}}/>
                                        <Bar dataKey="acik"   name="Açık"   fill={C.red}   stackId="a" radius={[0,2,2,0]}/>
                                        <Bar dataKey="kapali" name="Kapalı" fill={C.green} stackId="a" radius={[0,2,2,0]}/>
                                    </BarChart>
                                </ResponsiveContainer>
                              </div>
                        }
                    </Panel>

                    {/* Maliyet Dağılımı + Birim Bazlı Maliyet */}
                    <Panel title="Kalite Maliyeti Dağılımı" color={C.orange}>
                        {costByType.length === 0
                            ? <div style={{textAlign:'center',color:C.slate,padding:30,fontSize:11}}>Maliyet kaydı yok.</div>
                            : <>
                                <ResponsiveContainer width="100%" height={180}>
                                    <PieChart>
                                        <Pie data={costByType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75}
                                            label={({percent})=>`%${(percent*100).toFixed(0)}`} fontSize={11}>
                                            {costByType.map((e,i) => <Cell key={i} fill={COST_COLORS[e.name] || CHART_COLORS[i%CHART_COLORS.length]}/>)}
                                        </Pie>
                                        <Tooltip formatter={v=>fmtCurrency(v)} contentStyle={{fontSize:11}}/>
                                    </PieChart>
                                </ResponsiveContainer>
                                {costByType.map((c,i)=>(
                                    <StatRow key={i} label={trunc(safeText(c.name),24)} value={fmtCurrency(c.value)} color={COST_COLORS[c.name]||CHART_COLORS[i]}/>
                                ))}
                                <div style={{marginTop:6,paddingTop:6,borderTop:`2px solid ${C.orange}40`}}>
                                    <StatRow label="TOPLAM MALİYET" value={fmtCurrency(kpis.totalCost)} color={C.red} bold/>
                                </div>
                                {costByUnit && costByUnit.length > 0 && (
                                    <>
                                        <div style={{fontSize:11,fontWeight:700,color:C.orange,margin:'12px 0 6px'}}>Birim Bazlı Kalitesizlik Maliyetleri</div>
                                        <MiniTable headers={['Birim','Maliyet']} rows={costByUnit.slice(0,10).map(c=>[trunc(safeText(c.name),24),fmtCurrency(c.value)])} fontSize={10}/>
                                    </>
                                )}
                              </>
                        }
                    </Panel>
                </Row>

                {/* SATIR A2: NC Trend */}
                <Row cols="1fr" gap={12} mb={14}>
                    <Panel title="Uygunsuzluk Aylık Trendi" color={C.indigo}>
                        {ncMonthly.length === 0
                            ? <div style={{textAlign:'center',color:C.slate,padding:30,fontSize:11}}>Trend verisi yok.</div>
                            : <ResponsiveContainer width="100%" height={220}>
                                <ComposedChart data={ncMonthly} margin={{top:4,right:8,left:-15,bottom:30}}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                                    <XAxis dataKey="name" fontSize={9.5} angle={-30} textAnchor="end" height={35} tick={{fill:'#374151'}}/>
                                    <YAxis fontSize={10} tick={{fill:'#374151'}}/>
                                    <Tooltip contentStyle={{fontSize:11}}/>
                                    <Legend wrapperStyle={{fontSize:10,paddingTop:4}}/>
                                    <Bar dataKey="acilan"  name="Açılan"  fill={C.red}   radius={[2,2,0,0]} opacity={0.85}/>
                                    <Bar dataKey="kapilan" name="Kapılan" fill={C.green} radius={[2,2,0,0]} opacity={0.85}/>
                                    <Line type="monotone" dataKey="acilan" stroke={C.red} dot={{r:3}} strokeWidth={2} legendType="none"/>
                                </ComposedChart>
                            </ResponsiveContainer>
                        }
                        <div style={{marginTop:8}}>
                            <StatRow label="Toplam NC" value={kpis.totalNc} color={C.red}/>
                            <StatRow label="Kapatılan" value={kpis.closedNc} color={C.green}/>
                            <StatRow label="Kapatma Oranı" value={kpis.totalNc > 0 ? `%${((kpis.closedNc/kpis.totalNc)*100).toFixed(0)}` : '%0'} color={C.blue} bold/>
                        </div>
                    </Panel>
                </Row>

                {/* ══════════════════════════════════════════════════════════ */}
                {/* SATIR B: Kalite Duvarı | Açık NC (2 sütun — Açık NC geniş alan) */}
                <Row cols="1fr 1.4fr" gap={12} mb={14}>
                    <Panel title="Kalite Duvarı — Birim Performansları" color={C.green}>
                        <div style={{fontSize:9,color:C.slate,marginBottom:6}}>Talep açıp sisteme katkıda bulunan birimler</div>
                        <MiniTable
                            headers={['Talep Eden Birim','Açık','Kapalı','Toplam']}
                            rows={qualityWall.map(d=>[
                                <span style={{fontSize:10,fontWeight:500}}>{trunc(safeText(d.name),20)}</span>,
                                <span style={{fontWeight:800,color:d.acik>5?C.red:C.orange}}>{d.acik}</span>,
                                <span style={{fontWeight:800,color:C.green}}>{d.kapali}</span>,
                                <span style={{fontWeight:600}}>{d.toplam}</span>,
                            ])}
                            emptyMsg="Bu dönemde uygunsuzluk kaydı yok"
                            fontSize={11}
                        />
                    </Panel>

                    <Panel title="Açık Uygunsuzluklar" color={C.red}>
                        <div style={{fontSize:9,color:C.slate,marginBottom:6}}>Birimleri ilgilendiren açık DF/8D kayıtları</div>
                        {openNC.length === 0
                            ? <div style={{textAlign:'center',padding:20,color:C.green,fontWeight:700,fontSize:12}}>Açık uygunsuzluk yok</div>
                            : <MiniTable
                                headers={['DF/8D No','MDI No','Başlık','Birim','Gecikme']}
                                rows={openNC.map(nc=>[
                                    <span style={{fontSize:10,fontWeight:700,whiteSpace:'nowrap'}}>{nc.type!=='MDI'?(safeText(nc.nc_number)||'-'):'—'}</span>,
                                    <span style={{fontSize:10,fontWeight:700,whiteSpace:'nowrap'}}>{nc.type==='MDI'?(safeText(nc.mdi_no)||'-'):'—'}</span>,
                                    <span style={{fontSize:10}}>{trunc(safeText(nc.title||nc.nc_number||nc.mdi_no),28)}</span>,
                                    <span style={{fontSize:10}}>{trunc(safeText(nc.department||nc.requesting_unit||'-'),18)}</span>,
                                    <span style={{fontWeight:800,color:nc.gecikme?C.red:C.slate,fontSize:10}}>{nc.gecikme?`${nc.gecikme} gün`:'—'}</span>,
                                ])}
                                emptyMsg="Açık uygunsuzluk yok"
                                fontSize={10}
                              />
                        }
                        <div style={{marginTop:8}}>
                            <StatRow label="Toplam Açık" value={openNCTotal ?? openNC.length} color={(openNCTotal ?? 0)>0?C.red:C.green} bold/>
                            <StatRow label="Geciken" value={openNCGeciken ?? openNC.filter(n=>n.gecikme).length} color={(openNCGeciken ?? 0)>0?C.red:C.green}/>
                        </div>
                    </Panel>
                </Row>

                {/* SATIR B2: Karantina | İç Tetkik (2 sütun) */}
                <Row cols="1fr 1fr" gap={12} mb={14}>
                    <Panel title="Aktif Karantina Kayıtları" color={C.purple}>
                        {activeQuarantine.length === 0
                            ? <div style={{textAlign:'center',padding:20,color:C.green,fontWeight:700,fontSize:12}}>Karantinada ürün yok</div>
                            : <MiniTable
                                headers={['Parça / Parça Kodu','Miktar (Adet)','Tarih','Neden']}
                                rows={activeQuarantine.map(q=>[
                                    <span style={{fontSize:11,fontWeight:500}}>{trunc(safeText(q.part_name||q.part_code||'-'),30)}</span>,
                                    <span style={{fontWeight:700,color:C.purple,fontSize:11}}>{q.quantity!=null?fmtNum(q.quantity):'-'}</span>,
                                    <span style={{fontSize:10}}>{q.quarantine_date?format(new Date(q.quarantine_date),'dd.MM.yyyy'):'-'}</span>,
                                    <span style={{fontSize:10}}>{trunc(safeText(q.reason||'-'),28)}</span>,
                                ])}
                                emptyMsg="Karantinada ürün yok"
                                fontSize={11}
                              />
                        }
                        <div style={{marginTop:8}}>
                            <StatRow label="Toplam Aktif Karantina Kaydı" value={kpis.inQuarantine} color={kpis.inQuarantine>0?C.red:C.green} bold/>
                        </div>
                    </Panel>
                    <Panel title="İç Tetkik Özeti" color={C.yellow}>
                        <div style={{marginBottom:8}}>
                            <StatRow label="Tamamlanan Tetkik" value={qualityActivities?.completedInternalAudits ?? 0} color={C.yellow} bold/>
                        </div>
                        {qualityActivities?.auditFindingsByDept && qualityActivities.auditFindingsByDept.length > 0 && (
                            <>
                                <div style={{fontSize:10,fontWeight:700,color:C.navy,marginBottom:6}}>Tetkik Bulgusu Açılan Birimler</div>
                                <MiniTable
                                    headers={['Birim','Bulgular']}
                                    rows={qualityActivities.auditFindingsByDept.map(d=>[
                                        <span style={{fontSize:10}}>{trunc(safeText(d.name),22)}</span>,
                                        <span style={{fontWeight:700,color:C.red,fontSize:10}}>{d.value}</span>,
                                    ])}
                                    fontSize={10}
                                />
                            </>
                        )}
                        {(!qualityActivities?.auditFindingsByDept || qualityActivities.auditFindingsByDept.length === 0) && (
                            <div style={{textAlign:'center',color:C.slate,fontSize:11,padding:16}}>Dönemde tetkik bulgusu yok.</div>
                        )}
                    </Panel>
                </Row>

                {hasSupplySection && (
                <>
                <SectionBlock>
                <PageHeader
                    title="GİRDİ KALİTE · TEDARİKÇİ · SAPMA"
                    periodLabel={periodLabel}
                />

                {/* ══════════════════════════════════════════════════════════ */}
                {/* SATIR C: Girdi Kontrol | Tedarikçi (2 sütun) */}
                <Row cols="1fr 1fr" gap={12} mb={14}>
                    {/* Girdi Kalite Kontrol Özeti */}
                    <Panel title="Girdi Kalite Kontrol Özeti" color={C.teal}>
                        <div style={{marginBottom:8}}>
                            {qualityActivities && (
                                <StatRow label="Kontrol Planları" value={`${qualityActivities.totalControlPlans ?? 0} (Girdi: ${qualityActivities.totalIncomingControlPlans ?? 0}, Proses: ${qualityActivities.totalProcessControlPlans ?? 0})`} color={C.navy}/>
                            )}
                            <StatRow label="Toplam Kontrol Sayısı" value={fmtNum(kpis.totalIncoming)} color={C.blue} bold/>
                            <StatRow label="Toplam Parça Kontrol Edilen" value={fmtNum(kpis.totalPartsInspected ?? 0)} color={C.teal} bold/>
                            <StatRow label="Toplam Parça Red Edilen" value={fmtNum(kpis.totalPartsRejected ?? 0)} color={C.red}/>
                            <StatRow label="Kabul"        value={fmtNum(kpis.acceptedIncoming)}    color={C.green}/>
                            <StatRow label="Şartlı Kabul" value={fmtNum(kpis.conditionalIncoming)} color={C.yellow}/>
                            <StatRow label="Ret"          value={fmtNum(kpis.rejectedIncoming)}    color={C.red}/>
                            <StatRow label="Beklemede"    value={fmtNum(kpis.pendingIncoming)}     color={C.slate}/>
                            <StatRow label="Red Oranı"    value={`%${kpis.incomingRejectionRate}`} color={parseFloat(kpis.incomingRejectionRate)>5?C.red:C.green} bold/>
                        </div>
                        {/* Sonuç pie */}
                        {kpis.totalIncoming > 0 && (
                            <ResponsiveContainer width="100%" height={200}>
                                <PieChart>
                                    <Pie
                                        data={[
                                            {name:'Kabul',        value:kpis.acceptedIncoming},
                                            {name:'Şartlı Kabul', value:kpis.conditionalIncoming},
                                            {name:'Ret',          value:kpis.rejectedIncoming},
                                            {name:'Beklemede',    value:kpis.pendingIncoming},
                                        ].filter(d=>d.value>0)}
                                        dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                                        label={({name,percent})=>`${name} %${(percent*100).toFixed(0)}`} fontSize={11}
                                    >
                                        {['Kabul','Şartlı Kabul','Ret','Beklemede'].map((k,i)=>(
                                            <Cell key={i} fill={RESULT_COLORS[k] || CHART_COLORS[i]}/>
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{fontSize:10}}/>
                                    <Legend wrapperStyle={{fontSize:9}}/>
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                        {/* Aylık trend */}
                        {incoming.monthly.length > 0 && (
                            <ResponsiveContainer width="100%" height={90} style={{marginTop:6}}>
                                <BarChart data={incoming.monthly} margin={{top:2,right:4,left:-20,bottom:15}}>
                                    <XAxis dataKey="name" fontSize={8.5} angle={-25} textAnchor="end" height={22} tick={{fill:'#374151'}}/>
                                    <YAxis fontSize={9} tick={{fill:'#374151'}}/>
                                    <Tooltip contentStyle={{fontSize:10}}/>
                                    <Legend wrapperStyle={{fontSize:9}}/>
                                    <Bar dataKey="kontrol" name="Kontrol" fill={C.teal}  radius={[2,2,0,0]}/>
                                    <Bar dataKey="red"     name="Red"     fill={C.red}   radius={[2,2,0,0]}/>
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </Panel>

                    {/* Tedarikçi Değerlendirme Özeti */}
                    <Panel title="Tedarikçi Değerlendirme Özeti" color={C.blue}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginBottom: 12 }}>
                            <KpiCard label="Onaylı Tedarikçi" value={fmtNum(kpis.activeSuppliers)} color={C.blue} sub="Kayıtlı firma" />
                            <KpiCard label="A+B Sınıfı" value={fmtNum(suppliers.gradeABCount ?? 0)} color={C.green} sub="İyi performans" />
                            <KpiCard label="NC Açılan Tedarikçi" value={fmtNum(suppliers.suppliersWithNCCount ?? 0)} color={C.orange} sub={`${kpis.totalSupplierNC} NC (${kpis.openSupplierNC} açık)`} />
                            <KpiCard label="Tamamlanan Denetim" value={fmtNum(qualityActivities?.supplierAuditsCompleted ?? 0)} color={C.purple} sub="Tedarikçi denetimi" />
                            <KpiCard label="Girdi Red" value={fmtNum(kpis.rejectedIncoming ?? 0)} color={C.red} sub={`${suppliers.suppliersWithRejectionCount ?? 0} tedarikçi/parça`} />
                        </div>
                        {suppliers.gradeDistribution.length > 0 && (
                            <>
                                <div style={{ fontSize: 10, fontWeight: 700, color: C.blue, marginBottom: 6 }}>Sınıf Dağılımı</div>
                                <ResponsiveContainer width="100%" height={100}>
                                    <BarChart data={suppliers.gradeDistribution} layout="vertical" margin={{ top: 4, right: 12, left: 28, bottom: 4 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={true} vertical={false} />
                                        <XAxis type="number" fontSize={10} tick={{ fill: '#374151' }} />
                                        <YAxis type="category" dataKey="name" width={24} fontSize={10} tick={{ fill: '#374151' }} interval={0} />
                                        <Bar dataKey="value" name="Adet" radius={[0, 2, 2, 0]}>
                                            {suppliers.gradeDistribution.map((e, i) => (
                                                <Cell key={i} fill={GRADE_COLORS[e.name] || CHART_COLORS[i]} />
                                            ))}
                                        </Bar>
                                        <Tooltip contentStyle={{ fontSize: 10 }} formatter={(v) => [v, 'Adet']} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </>
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: (suppliers.topSuppliersNC.length > 0 && incoming.topRejectedSuppliers.length > 0) ? '1fr 1fr' : '1fr', gap: 12, marginTop: 10 }}>
                            {suppliers.topSuppliersNC.length > 0 && (
                                <div>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: C.orange, marginBottom: 4 }}>En Fazla NC Alan Tedarikçiler</div>
                                    <MiniTable
                                        headers={['Tedarikçi', 'Toplam NC', 'Açık']}
                                        rows={suppliers.topSuppliersNC.slice(0, 5).map((s) => [
                                            trunc(safeText(s.name), 20),
                                            <span style={{ fontWeight: 700, color: C.orange, fontSize: 10 }}>{s.count}</span>,
                                            <span style={{ fontWeight: 700, color: C.red, fontSize: 10 }}>{s.open}</span>,
                                        ])}
                                        fontSize={10}
                                    />
                                </div>
                            )}
                            {incoming.topRejectedSuppliers.length > 0 && (
                                <div>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: C.red, marginBottom: 4 }}>Girdi Kontrol — En Çok Red Alan</div>
                                    <MiniTable
                                        headers={['Tedarikçi / Parça', 'Red Sayısı']}
                                        rows={incoming.topRejectedSuppliers.slice(0, 5).map((s) => [
                                            trunc(safeText(s.name), 22),
                                            <span style={{ fontWeight: 700, color: C.red, fontSize: 10 }}>{s.count}</span>,
                                        ])}
                                        fontSize={10}
                                    />
                                </div>
                            )}
                        </div>
                        {qualityActivities?.supplierAuditDetails && qualityActivities.supplierAuditDetails.length > 0 && (
                            <div style={{ marginTop: 10 }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: C.purple, marginBottom: 4 }}>Tamamlanan Tedarikçi Denetimleri ({qualityActivities.supplierAuditsCompleted ?? 0})</div>
                                <MiniTable
                                    headers={['Denetlenen', 'Tarih', 'Puan']}
                                    rows={qualityActivities.supplierAuditDetails.map((d) => [
                                        <span style={{ fontSize: 10 }}>{trunc(safeText(d.supplierName), 24)}</span>,
                                        <span style={{ fontSize: 10 }}>{d.date ? format(new Date(d.date), 'dd.MM.yyyy', { locale: tr }) : '—'}</span>,
                                        <span style={{ fontWeight: 700, color: C.purple }}>{d.score != null ? d.score : '—'}</span>,
                                    ])}
                                    fontSize={10}
                                />
                            </div>
                        )}
                        {suppliers.topSuppliersNC.length === 0 && incoming.topRejectedSuppliers.length === 0 && suppliers.gradeDistribution.length === 0 && (!qualityActivities?.supplierAuditDetails || qualityActivities.supplierAuditDetails.length === 0) && (
                            <div style={{ textAlign: 'center', color: C.slate, fontSize: 11, padding: 20 }}>Tedarikçi değerlendirme verisi bulunamadı.</div>
                        )}
                    </Panel>

                </Row>
                </SectionBlock>

                {/* SATIR C2: NC Tip + Sapma (2 sütun) */}
                <Row cols="1fr 1fr" gap={12} mb={14}>
                    <Panel title="NC Tip Dağılımı" color={C.indigo}>
                        {ncByType.length === 0
                            ? <div style={{textAlign:'center',color:C.slate,fontSize:11,padding:20}}>Veri yok</div>
                            : <>
                                <ResponsiveContainer width="100%" height={220}>
                                    <BarChart data={ncByType} margin={{top:12,right:16,left:8,bottom:8}} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={true} vertical={false}/>
                                        <XAxis type="number" fontSize={11} tick={{fill:'#374151'}}/>
                                        <YAxis type="category" dataKey="name" width={60} fontSize={11} tick={{fill:'#374151'}} interval={0}/>
                                        <Tooltip contentStyle={{fontSize:11}}/>
                                        <Legend wrapperStyle={{fontSize:11}}/>
                                        <Bar dataKey="acik" name="Açık" fill={C.red} stackId="a" radius={[0,2,2,0]}/>
                                        <Bar dataKey="kapali" name="Kapalı" fill={C.green} stackId="a" radius={[0,2,2,0]}/>
                                    </BarChart>
                                </ResponsiveContainer>
                                <div style={{display:'flex',gap:16,flexWrap:'wrap',marginTop:8}}>
                                    {ncByType.map((t,i)=>(
                                        <div key={i} style={{background:'#f8fafc',padding:'6px 12px',borderRadius:6,borderLeft:`4px solid ${CHART_COLORS[i]}`}}>
                                            <span style={{fontWeight:700,fontSize:11}}>{t.name}</span>
                                            <span style={{fontSize:10,color:C.slate,marginLeft:6}}>Açık: {t.acik} · Kapalı: {t.kapali}</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        }
                    </Panel>
                    <Panel title="Sapma Talepleri" color={C.indigo}>
                        <StatRow label="Toplam Sapma" value={kpis.totalDeviations} color={C.yellow} bold/>
                        <StatRow label="Açık Sapmalar" value={kpis.openDeviations} color={C.red}/>
                        {deviations.byStatus.map((s,i)=>(
                            <StatRow key={i} label={trunc(safeText(s.name),20)} value={s.value} color={CHART_COLORS[i%CHART_COLORS.length]}/>
                        ))}
                        {deviations.byUnit && deviations.byUnit.length > 0 && (
                            <>
                                <div style={{fontSize:11,fontWeight:700,color:C.teal,margin:'12px 0 6px'}}>Sapma Talep Eden Birimler</div>
                                <MiniTable headers={['Birim','Adet']} rows={deviations.byUnit.map(s=>[trunc(safeText(s.name),24),s.value])} fontSize={10}/>
                            </>
                        )}
                    </Panel>
                </Row>
                </>
                )}

                {hasNcFixtureSection && (
                    <>
                    <SectionBlock>
                        <PageHeader
                            title="UYGUNSUZLUK · FİKSTÜR"
                            periodLabel={periodLabel}
                        />
                        {hasNonconformitySection ? (
                            <Row cols="repeat(6,1fr)" gap={8} mb={14}>
                                <KpiCard label="Toplam Kayıt" value={fmtNum(nonconformityModule.total)} color={C.teal} bg="#f0fdfa" />
                                <KpiCard label="Açık Kayıt" value={fmtNum(nonconformityModule.open)} color={nonconformityModule.open > 0 ? C.red : C.green} bg={nonconformityModule.open > 0 ? '#fef2f2' : '#f0fdf4'} />
                                <KpiCard label="DF Önerildi" value={fmtNum(nonconformityModule.dfSuggested)} color={C.indigo} bg="#eef2ff" />
                                <KpiCard label="8D Önerildi" value={fmtNum(nonconformityModule.eightDSuggested)} color={C.purple} bg="#f5f3ff" />
                                <KpiCard label="Dönüştürülen" value={fmtNum(nonconformityModule.converted)} color={C.green} bg="#f0fdf4" />
                                <KpiCard label="Kritik Açık" value={fmtNum(nonconformityModule.critical)} color={C.red} bg="#fef2f2" sub={`Toplam adet ${fmtNum(nonconformityModule.totalQuantity)}`} />
                            </Row>
                        ) : hasFixtureSection ? (
                            <Row cols="repeat(4,1fr)" gap={8} mb={14}>
                                <KpiCard label="Toplam Fikstür" value={fmtNum(fixtureTracking.total)} color={C.navy} bg="#eff6ff" />
                                <KpiCard label="Kritik Fikstür" value={fmtNum(fixtureTracking.critical)} color={C.orange} bg="#fff7ed" />
                                <KpiCard label="Vadesi Geçmiş" value={fmtNum(fixtureTracking.overdue)} color={fixtureTracking.overdue > 0 ? C.red : C.green} bg={fixtureTracking.overdue > 0 ? '#fef2f2' : '#f0fdf4'} />
                                <KpiCard label="Uygunsuz Fikstür" value={fmtNum(fixtureTracking.nonconformant)} color={fixtureTracking.nonconformant > 0 ? C.red : C.green} bg={fixtureTracking.nonconformant > 0 ? '#fef2f2' : '#f0fdf4'} />
                            </Row>
                        ) : null}
                    </SectionBlock>

                    {hasNonconformitySection && (
                        <>
                            <Row cols="1fr" gap={12} mb={14}>
                                <Panel title="Uygunsuzluk Modülü Özeti" color={C.teal}>
                                    <div style={{fontSize:11,fontWeight:700,color:C.teal,marginBottom:6}}>DF ve 8D Önerilen Maddeler</div>
                                    <MiniTable
                                        headers={['Öneri','Kayıt No','Parça','Açıklama','Alan','Ciddiyet','Adet','Sorumlu']}
                                        rows={(nonconformityModule.suggestedItems || []).map((item) => [
                                            <span style={{
                                                display:'inline-flex',
                                                alignItems:'center',
                                                justifyContent:'center',
                                                minWidth:34,
                                                padding:'2px 8px',
                                                borderRadius:999,
                                                fontSize:10,
                                                fontWeight:800,
                                                color:'white',
                                                background:item.type === '8D' ? C.purple : C.indigo,
                                            }}>{item.type}</span>,
                                            <span style={{fontSize:10,fontWeight:700,fontFamily:'monospace'}}>{item.recordNumber}</span>,
                                            <span style={{fontSize:10}}>
                                                <strong>{trunc(safeText(item.partCode),16)}</strong>
                                                {item.partName && item.partName !== '—' && <span style={{display:'block',color:C.slate}}>{trunc(safeText(item.partName),24)}</span>}
                                            </span>,
                                            <span style={{fontSize:10,lineHeight:1.35}}>{trunc(safeText(item.description),44)}</span>,
                                            <span style={{fontSize:10}}>{trunc(safeText(item.area),16)}</span>,
                                            <span style={{fontSize:10,fontWeight:700,color:item.severity === 'Kritik' ? C.red : item.severity === 'Yüksek' ? C.orange : C.gray}}>{item.severity}</span>,
                                            <span style={{fontSize:10,fontWeight:700}}>{fmtNum(item.quantity)}</span>,
                                            <span style={{fontSize:10}}>{trunc(safeText(item.responsible),18)}</span>,
                                        ])}
                                        emptyMsg="Bu dönemde önerilmiş DF / 8D kaydı yok."
                                        fontSize={10}
                                    />

                                    <div style={{display:'grid',gridTemplateColumns:'0.95fr 0.95fr 1.1fr',gap:12,marginTop:12}}>
                                        <div style={{display:'grid',gridTemplateRows:'auto auto',gap:12}}>
                                            <div>
                                                <div style={{fontSize:11,fontWeight:700,color:C.teal,marginBottom:6}}>Durum Dağılımı</div>
                                                <MiniTable
                                                    headers={['Durum','Adet']}
                                                    rows={(nonconformityModule.byStatus || []).map((item, index) => [
                                                        <span style={{fontSize:10,fontWeight:600,color:CHART_COLORS[index % CHART_COLORS.length]}}>{trunc(safeText(item.name),22)}</span>,
                                                        <span style={{fontSize:10,fontWeight:700}}>{fmtNum(item.value)}</span>,
                                                    ])}
                                                    emptyMsg="Durum verisi yok."
                                                    fontSize={10}
                                                />
                                            </div>
                                            <div>
                                                <div style={{fontSize:11,fontWeight:700,color:C.orange,marginBottom:6}}>Ciddiyet Dağılımı</div>
                                                <MiniTable
                                                    headers={['Ciddiyet','Adet']}
                                                    rows={(nonconformityModule.bySeverity || []).map((item) => [
                                                        <span style={{fontSize:10,fontWeight:600}}>{trunc(safeText(item.name),20)}</span>,
                                                        <span style={{fontSize:10,fontWeight:700,color:item.name === 'Kritik' ? C.red : item.name === 'Yüksek' ? C.orange : C.gray}}>{fmtNum(item.value)}</span>,
                                                    ])}
                                                    emptyMsg="Ciddiyet verisi yok."
                                                    fontSize={10}
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <div style={{fontSize:11,fontWeight:700,color:C.orange,marginBottom:6}}>En Çok Tekrarlayan Kategoriler / Parçalar</div>
                                            <MiniTable
                                                headers={['Tür','Kod / Açıklama','Adet']}
                                                rows={[
                                                    ...((nonconformityModule.topCategories || []).slice(0, 4).map((item) => [
                                                        'Kategori',
                                                        <span style={{fontSize:10}}>{trunc(safeText(item.name),24)}</span>,
                                                        <span style={{fontSize:10,fontWeight:700,color:C.orange}}>{fmtNum(item.value)}</span>,
                                                    ])),
                                                    ...((nonconformityModule.topParts || []).slice(0, 4).map((item) => [
                                                        'Parça',
                                                        <span style={{fontSize:10}}>{trunc(safeText(item.name),24)}</span>,
                                                        <span style={{fontSize:10,fontWeight:700,color:C.red}}>{fmtNum(item.count)}</span>,
                                                    ])),
                                                ]}
                                                emptyMsg="Kategori / parça özeti yok."
                                                fontSize={10}
                                            />
                                        </div>

                                        <div>
                                            <div style={{fontSize:11,fontWeight:700,color:C.red,marginBottom:6}}>Sorumlu Yük Dağılımı</div>
                                            <MiniTable
                                                headers={['Sorumlu','Açık','Toplam','Kapanış %']}
                                                rows={(nonconformityModule.responsibleLoad || []).map((item) => [
                                                    <span style={{fontSize:10}}>{trunc(safeText(item.name),20)}</span>,
                                                    <span style={{fontSize:10,fontWeight:700,color:item.open > 0 ? C.red : C.green}}>{fmtNum(item.open)}</span>,
                                                    <span style={{fontSize:10,fontWeight:700}}>{fmtNum(item.total)}</span>,
                                                    <span style={{fontSize:10,fontWeight:700,color:item.closeRate >= 70 ? C.green : item.closeRate >= 40 ? C.orange : C.red}}>%{fmtNum(item.closeRate)}</span>,
                                                ])}
                                                emptyMsg="Sorumlu dağılımı yok."
                                                fontSize={10}
                                            />
                                        </div>
                                    </div>
                                </Panel>
                            </Row>

                            <Row cols="1fr" gap={12} mb={14}>
                                <Panel title="Uygunsuzluk Modülü — Son Kayıtlar" color={C.teal}>
                                    {(!nonconformityModule.recentRecords || nonconformityModule.recentRecords.length === 0)
                                        ? <div style={{textAlign:'center',color:C.slate,padding:30,fontSize:11}}>Bu dönemde uygunsuzluk kaydı yok.</div>
                                        : <MiniTable
                                            headers={['Tarih','Kayıt No','Parça','Açıklama','Kategori','Alan','Ciddiyet','Durum','Sorumlu','Adet']}
                                            rows={nonconformityModule.recentRecords.map((r) => [
                                                r.tarih ? format(parseISO(r.tarih),'dd.MM.yyyy',{locale:tr}) : '—',
                                                <span style={{fontSize:10,fontWeight:700,fontFamily:'monospace'}}>{r.kayitNo || '—'}</span>,
                                                <span style={{fontSize:10}}>
                                                    <strong>{trunc(safeText(r.parca),18)}</strong>
                                                    {r.parcaAdi && r.parcaAdi !== '—' && <span style={{display:'block',color:C.slate}}>{trunc(safeText(r.parcaAdi),28)}</span>}
                                                </span>,
                                                <span style={{fontSize:10,lineHeight:1.35}}>{trunc(safeText(r.aciklama),64)}</span>,
                                                <span style={{fontSize:10}}>{trunc(safeText(r.kategori),18)}</span>,
                                                <span style={{fontSize:10}}>{trunc(safeText(r.alan),18)}</span>,
                                                <span style={{fontSize:10,fontWeight:700,color:r.onem === 'Kritik' ? C.red : r.onem === 'Yüksek' ? C.orange : C.gray}}>{r.onem}</span>,
                                                <span style={{fontSize:10,fontWeight:700}}>{trunc(safeText(r.durum),16)}</span>,
                                                <span style={{fontSize:10}}>{trunc(safeText(r.sorumlu),18)}</span>,
                                                <span style={{fontSize:10,fontWeight:700}}>{fmtNum(r.adet)}</span>,
                                            ])}
                                            emptyMsg="Kayıt yok"
                                            fontSize={10}
                                        />
                                    }
                                </Panel>
                            </Row>
                        </>
                    )}

                {hasFixtureSection && (
                    <Row cols="1fr" gap={12} mb={14}>
                        <Panel title="Fikstür Takip — Üretimin Görmesi Gerekenler" color={C.orange}>
                            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:12}}>
                                <KpiCard label="Toplam Fikstür" value={fmtNum(fixtureTracking.total)} color={C.navy} bg="#eff6ff" />
                                <KpiCard label="Kritik Fikstür" value={fmtNum(fixtureTracking.critical)} color={C.orange} bg="#fff7ed" />
                                <KpiCard label="Vadesi Geçmiş" value={fmtNum(fixtureTracking.overdue)} color={fixtureTracking.overdue > 0 ? C.red : C.green} bg={fixtureTracking.overdue > 0 ? '#fef2f2' : '#f0fdf4'} />
                                <KpiCard label="Uygunsuz Fikstür" value={fmtNum(fixtureTracking.nonconformant)} color={fixtureTracking.nonconformant > 0 ? C.red : C.green} bg={fixtureTracking.nonconformant > 0 ? '#fef2f2' : '#f0fdf4'} />
                                <KpiCard label="Revizyon Bekliyor" value={fmtNum(fixtureTracking.revisionPending)} color={C.purple} bg="#f5f3ff" />
                                <KpiCard label="Açık Düzeltme Aksiyonu" value={fmtNum(fixtureTracking.openCorrectiveActions)} color={fixtureTracking.openCorrectiveActions > 0 ? C.red : C.green} bg={fixtureTracking.openCorrectiveActions > 0 ? '#fef2f2' : '#f0fdf4'} />
                                <KpiCard label="Dönem Doğrulama" value={fmtNum(fixtureTracking.verificationsInPeriod)} color={C.teal} bg="#f0fdfa" sub={`${fmtNum(fixtureTracking.failedInPeriod)} uygunsuz sonuç`} />
                                <KpiCard label="Doğrulama Başarı %" value={fixtureTracking.verificationPassRate == null ? '—' : `%${fixtureTracking.verificationPassRate}`} color={fixtureTracking.verificationPassRate == null ? C.gray : fixtureTracking.verificationPassRate >= 90 ? C.green : fixtureTracking.verificationPassRate >= 75 ? C.orange : C.red} bg={fixtureTracking.verificationPassRate == null ? '#f8fafc' : fixtureTracking.verificationPassRate >= 90 ? '#f0fdf4' : '#fff7ed'} sub={`${fmtNum(fixtureTracking.pendingActivation)} devreye alma bekliyor`} />
                            </div>

                            <div style={{display:'grid',gridTemplateColumns:'1.1fr 0.9fr',gap:12}}>
                                <div>
                                    <div style={{fontSize:11,fontWeight:700,color:C.red,marginBottom:6}}>Kritik / Acil Takip Listesi</div>
                                    <MiniTable
                                        headers={['Fikstür','Parça','Sınıf','Durum','Uyarı','Sonraki Doğrulama']}
                                        rows={(fixtureTracking.urgentItems || []).map((item) => [
                                            <span style={{fontSize:10,fontWeight:700,fontFamily:'monospace'}}>{item.fixtureNo}</span>,
                                            <span style={{fontSize:10}}>
                                                <strong>{trunc(safeText(item.partCode),18)}</strong>
                                                {item.partName && item.partName !== '—' && <span style={{display:'block',color:C.slate}}>{trunc(safeText(item.partName),24)}</span>}
                                            </span>,
                                            <span style={{fontSize:10,fontWeight:700,color:item.class === 'Kritik' ? C.orange : C.gray}}>{item.class}</span>,
                                            <span style={{fontSize:10,fontWeight:700,color:item.status === 'Uygunsuz' ? C.red : item.status === 'Revizyon Beklemede' ? C.purple : C.blue}}>{item.status}</span>,
                                            <span style={{fontSize:10,lineHeight:1.35}}>{trunc(safeText(item.alert),42)}</span>,
                                            <span style={{fontSize:10}}>
                                                {item.nextVerificationDate ? format(parseISO(item.nextVerificationDate), 'dd.MM.yyyy', { locale: tr }) : '—'}
                                            </span>,
                                        ])}
                                        emptyMsg="Üretimi etkileyecek kritik fikstür uyarısı yok."
                                        fontSize={10}
                                    />
                                </div>

                                <div style={{display:'grid',gridTemplateRows:'auto auto auto',gap:12}}>
                                    <div>
                                        <div style={{fontSize:11,fontWeight:700,color:C.teal,marginBottom:6}}>Son Doğrulamalar</div>
                                        <MiniTable
                                            headers={['Fikstür','Tarih','Sonuç','Numune']}
                                            rows={(fixtureTracking.recentVerifications || []).map((item) => [
                                                <span style={{fontSize:10,fontWeight:700,fontFamily:'monospace'}}>{item.fixtureNo}</span>,
                                                <span style={{fontSize:10}}>{item.verificationDate ? format(parseISO(item.verificationDate), 'dd.MM.yy', { locale: tr }) : '—'}</span>,
                                                <span style={{fontSize:10,fontWeight:700,color:item.result === 'Uygun' ? C.green : C.red}}>{item.result}</span>,
                                                <span style={{fontSize:10}}>{fmtNum(item.sampleCount)}</span>,
                                            ])}
                                            emptyMsg="Son doğrulama kaydı yok."
                                            fontSize={10}
                                        />
                                    </div>

                                    <div>
                                        <div style={{fontSize:11,fontWeight:700,color:C.red,marginBottom:6}}>Açık Fikstür Uygunsuzlukları</div>
                                        <MiniTable
                                            headers={['Fikstür','Tarih','Durum']}
                                            rows={(fixtureTracking.recentNonconformities || []).map((item) => [
                                                <span style={{fontSize:10,fontWeight:700,fontFamily:'monospace'}}>{item.fixtureNo}</span>,
                                                <span style={{fontSize:10}}>{item.detectionDate ? format(parseISO(item.detectionDate), 'dd.MM.yy', { locale: tr }) : '—'}</span>,
                                                <span style={{fontSize:10,fontWeight:700,color:item.status === 'İşlemde' ? C.blue : C.red}}>{item.status}</span>,
                                            ])}
                                            emptyMsg="Açık fikstür uygunsuzluğu yok."
                                            fontSize={10}
                                        />
                                    </div>

                                    <div>
                                        <div style={{fontSize:11,fontWeight:700,color:C.orange,marginBottom:6}}>Sorumlu Bölümler</div>
                                        <MiniTable
                                            headers={['Bölüm','Fikstür']}
                                            rows={(fixtureTracking.byDepartment || []).map((item) => [
                                                <span style={{fontSize:10}}>{trunc(safeText(item.name),24)}</span>,
                                                <span style={{fontSize:10,fontWeight:700,color:C.orange}}>{fmtNum(item.value)}</span>,
                                            ])}
                                            emptyMsg="Bölüm dağılımı yok."
                                            fontSize={10}
                                        />
                                    </div>
                                </div>
                            </div>
                        </Panel>
                    </Row>
                )}
                    </>
                )}

                {hasVehicleComplaintSection && (
                <>
                <SectionBlock>
                <PageHeader
                    title="ÜRETİLEN ARAÇLAR · ŞİKAYETLER"
                    periodLabel={periodLabel}
                />

                {/* SATIR D: Üretilen Araçlarda Hata Kategorileri — geniş alan */}
                <Row cols="1fr" gap={12} mb={14}>
                    <Panel title="Üretilen Araçlarda Hata Kategorileri" color={C.purple}>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 200px',gap:16,alignItems:'start'}}>
                            <div>
                                {vehicles.faultByCategory.length === 0
                                    ? <div style={{textAlign:'center',color:C.slate,padding:40,fontSize:12}}>Bu dönemde kayıtlı araç hatası yok.</div>
                                    : <ResponsiveContainer width="100%" height={320}>
                                        <BarChart data={vehicles.faultByCategory} layout="vertical" margin={{top:8,right:20,left:8,bottom:8}}>
                                            <XAxis type="number" fontSize={11} tick={{fill:'#374151'}}/>
                                            <YAxis type="category" dataKey="name" width={120} fontSize={11} tick={{fill:'#374151'}} interval={0} tickFormatter={v=>trunc(safeText(v),20)}/>
                                            <Tooltip contentStyle={{fontSize:11}}/>
                                            <Bar dataKey="count" name="Hata Adedi" radius={[0,3,3,0]}>
                                                {vehicles.faultByCategory.map((_,i)=>(
                                                    <Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]}/>
                                                ))}
                                            </Bar>
                                        </BarChart>
                                      </ResponsiveContainer>
                                }
                            </div>
                            <div>
                                <StatRow label="Toplam Araç" value={fmtNum(kpis.totalVehicles)} color={C.purple} bold/>
                                <StatRow label="Kabul" value={fmtNum(kpis.passedVehicles)} color={C.green}/>
                                <StatRow label="Red" value={fmtNum(kpis.failedVehicles)} color={C.red}/>
                                <StatRow label="Toplam Hata" value={fmtNum(kpis.totalVehicleFaults)} color={C.orange}/>
                                <StatRow label="Geçiş %" value={`%${kpis.vehiclePassRate}`} color={parseFloat(kpis.vehiclePassRate)>90?C.green:C.orange} bold/>
                                {qualityActivities && (
                                    <>
                                        <StatRow label="Ort. Kontrol Süresi" value={qualityActivities.avgControlTimeFormatted ?? '—'} color={C.blue}/>
                                        <StatRow label="Ort. Yeniden İşlem Süresi" value={qualityActivities.avgReworkTimeFormatted ?? '—'} color={C.teal}/>
                                    </>
                                )}
                                <div style={{marginTop:12,fontSize:11,fontWeight:700,color:C.purple}}>Kategori Özeti</div>
                                {vehicles.faultByCategory.slice(0,8).map((f,i)=>(
                                    <div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:11,padding:'4px 0',borderBottom:'1px dotted #e2e8f0'}}>
                                        <span>{trunc(safeText(f.name),18)}</span>
                                        <b style={{color:CHART_COLORS[i]}}>{f.count}</b>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </Panel>
                </Row>
                </SectionBlock>

                {/* SATIR D2: Araç Trend | Müşteri Şikayet (2 sütun) */}
                <Row cols="1fr 1fr" gap={12} mb={14}>
                    <Panel title="Araç Kalite Aylık Trendi" color={C.teal}>
                        {vehicles.monthly.length === 0
                            ? <div style={{textAlign:'center',color:C.slate,padding:30,fontSize:11}}>Araç kalite verisi yok.</div>
                            : <ResponsiveContainer width="100%" height={260}>
                                <ComposedChart data={vehicles.monthly} margin={{top:4,right:8,left:-10,bottom:30}}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                                    <XAxis dataKey="name" fontSize={9.5} angle={-30} textAnchor="end" height={35} tick={{fill:'#374151'}}/>
                                    <YAxis fontSize={10} tick={{fill:'#374151'}}/>
                                    <Tooltip contentStyle={{fontSize:11}}/>
                                    <Legend wrapperStyle={{fontSize:10,paddingTop:4}}/>
                                    <Bar dataKey="toplam" name="Toplam" fill={C.blue}  radius={[2,2,0,0]} opacity={0.75}/>
                                    <Bar dataKey="gecti"  name="Kabul"  fill={C.green} radius={[2,2,0,0]}/>
                                    <Line type="monotone" dataKey="gecti" stroke={C.green} dot={{r:3}} strokeWidth={2} legendType="none"/>
                                </ComposedChart>
                              </ResponsiveContainer>
                        }
                    </Panel>

                    {/* Müşteri Şikayetleri */}
                    <Panel title="Müşteri Şikayetleri" color={C.rose}>
                        <div style={{marginBottom:6}}>
                            <StatRow label="Toplam Şikayet" value={kpis.totalComplaints} color={C.rose} bold/>
                            <StatRow label="Açık" value={kpis.openComplaints} color={C.red}/>
                            <StatRow label="SLA Gecikmiş" value={kpis.slaOverdue} color={kpis.slaOverdue>0?C.red:C.green}/>
                        </div>
                        {complaints.byStatus.map((s,i)=>(
                            <StatRow key={i} label={trunc(safeText(s.name),22)} value={s.value} color={CHART_COLORS[i%CHART_COLORS.length]}/>
                        ))}
                        {complaints.monthly.length > 0
                            ? <ResponsiveContainer width="100%" height={110} style={{marginTop:10}}>
                                <BarChart data={complaints.monthly} margin={{top:4,right:4,left:-15,bottom:25}}>
                                    <XAxis dataKey="name" fontSize={9} angle={-30} textAnchor="end" height={30} tick={{fill:'#374151'}}/>
                                    <YAxis fontSize={9.5} tick={{fill:'#374151'}}/>
                                    <Tooltip contentStyle={{fontSize:10}}/>
                                    <Bar dataKey="sayi" name="Şikayet" fill={C.rose} radius={[2,2,0,0]}/>
                                </BarChart>
                              </ResponsiveContainer>
                            : <div style={{textAlign:'center',color:C.slate,padding:16,fontSize:11}}>Bu dönemde şikayet yok.</div>
                        }
                    </Panel>
                </Row>
                </>
                )}

                {hasTopCostTrainingSection && (
                <>
                <SectionBlock>
                <PageHeader
                    title="ARAÇ TOP 10 · MALİYET TRENDİ · EĞİTİM"
                    periodLabel={periodLabel}
                />

                <Row cols="1fr 1fr" gap={12} mb={14}>
                    <Panel title="Araç Hataları — Top 10 Kategori" color={C.purple}>
                        <MiniTable
                            headers={['Kategori', 'Hata Adedi', 'Etkilenen Araç']}
                            rows={vehicles.faultByCategory.slice(0, 10).map((fault, index) => [
                                <span style={{ fontSize: 10, fontWeight: 600, color: CHART_COLORS[index % CHART_COLORS.length] }}>
                                    {trunc(safeText(fault.name), 26)}
                                </span>,
                                <span style={{ fontWeight: 800, color: C.purple }}>{fmtNum(fault.count)}</span>,
                                <span style={{ fontSize: 10 }}>{fmtNum(fault.aracSayisi)}</span>,
                            ])}
                            emptyMsg="Top 10 araç hatası oluşmadı."
                            fontSize={10}
                        />
                        {vehicles.faultCostByVehicleType?.length > 0 && (
                            <>
                                <div style={{ fontSize: 11, fontWeight: 700, color: C.purple, margin: '12px 0 6px' }}>Araç Tipine Yansıyan Maliyet</div>
                                <MiniTable
                                    headers={['Araç Tipi', 'Maliyet']}
                                    rows={vehicles.faultCostByVehicleType.slice(0, 5).map((item) => [
                                        trunc(safeText(item.name), 24),
                                        <span style={{ fontWeight: 700, color: C.orange }}>{fmtCurrency(item.value)}</span>,
                                    ])}
                                    fontSize={10}
                                />
                            </>
                        )}
                    </Panel>

                    <Panel title="En Fazla Hata Görülen Araçlar" color={C.rose}>
                        <MiniTable
                            headers={['Şasi', 'Seri No', 'Araç Tipi', 'Toplam', 'Açık']}
                            rows={vehicles.topFaultyVehicles.map((vehicle) => [
                                <span style={{ fontSize: 10, fontFamily: 'monospace' }}>{trunc(safeText(vehicle.chassisNo), 14)}</span>,
                                <span style={{ fontSize: 10, fontFamily: 'monospace' }}>{trunc(safeText(vehicle.serialNo), 12)}</span>,
                                <span style={{ fontSize: 10 }}>{trunc(safeText(vehicle.vehicleType), 18)}</span>,
                                <span style={{ fontWeight: 800, color: C.rose }}>{fmtNum(vehicle.totalFaults)}</span>,
                                <span style={{ fontWeight: 700, color: vehicle.activeFaults > 0 ? C.red : C.green }}>{fmtNum(vehicle.activeFaults)}</span>,
                            ])}
                            emptyMsg="Hatalı araç bulunmadı."
                            fontSize={10}
                        />
                    </Panel>
                </Row>
                </SectionBlock>

                {/* SATIR E: Kalite Maliyeti Aylık Trendi (tam genişlik) + Birim Bazlı Maliyet */}
                <Row cols="1fr" gap={12} mb={14}>
                    <Panel title="Kalite Maliyeti Aylık Trendi" color={C.orange}>
                        {costMonthly.length === 0
                            ? <div style={{textAlign:'center',color:C.slate,padding:40,fontSize:11}}>Bu dönemde maliyet kaydı yok.</div>
                            : <ResponsiveContainer width="100%" height={260}>
                                <ComposedChart data={costMonthly} margin={{top:4,right:12,left:15,bottom:30}}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                                    <XAxis dataKey="name" fontSize={11} angle={-25} textAnchor="end" height={35} tick={{fill:'#374151'}}/>
                                    <YAxis fontSize={11} tick={{fill:'#374151'}} tickFormatter={v=>`${Math.round(v/1000)}k`}/>
                                    <Tooltip formatter={v=>fmtCurrency(v)} contentStyle={{fontSize:11}}/>
                                    <Area type="monotone" dataKey="toplam" fill="#fff3e0" stroke={C.orange} strokeWidth={2} name="Maliyet"/>
                                    <Line type="monotone" dataKey="toplam" stroke={C.orange} dot={{r:4,fill:C.orange}} strokeWidth={2.5} legendType="none"/>
                                </ComposedChart>
                              </ResponsiveContainer>
                        }
                        <div style={{marginTop:8,display:'flex',gap:16,flexWrap:'wrap'}}>
                            {costMonthly.slice(-4).map((m,i)=>(
                                <div key={i} style={{textAlign:'center',flex:1,minWidth:80,background:'#fff7ed',borderRadius:4,padding:'8px 6px'}}>
                                    <div style={{fontSize:11,color:C.slate}}>{m.name}</div>
                                    <div style={{fontSize:14,fontWeight:800,color:C.orange}}>{fmtCurrency(m.toplam)}</div>
                                </div>
                            ))}
                        </div>
                        {costByUnit && costByUnit.length > 0 && (
                            <>
                                <div style={{fontSize:12,fontWeight:700,color:C.orange,margin:'16px 0 8px',paddingTop:12,borderTop:'2px solid rgba(234,88,12,0.3)'}}>Birimlerin Sebep Olduğu Kalitesizlik Maliyetleri</div>
                                <MiniTable headers={['Birim','Maliyet']} rows={costByUnit.map(c=>[c.name,fmtCurrency(c.value)])} fontSize={11}/>
                            </>
                        )}
                    </Panel>
                </Row>

                {/* SATIR F: Eğitim Faaliyetleri — tam genişlik (sonda) */}
                <Row cols="1fr" gap={12} mb={14}>
                    <Panel title="Eğitim Faaliyetleri" color={C.teal}>
                        <div style={{display:'flex',gap:24,flexWrap:'wrap',marginBottom:12}}>
                            <StatRow label="Toplam Eğitim" value={qualityActivities?.totalTrainings ?? 0} color={C.teal} bold/>
                            <StatRow label="Tamamlanan" value={qualityActivities?.completedTrainings ?? 0} color={C.green}/>
                            <StatRow label="Planlanan" value={qualityActivities?.plannedTrainings ?? 0} color={C.orange}/>
                        </div>
                        {qualityActivities?.trainingDetails && qualityActivities.trainingDetails.length > 0 ? (
                            <MiniTable
                                headers={['Eğitim Adı','Başlangıç','Bitiş','Eğitmen','Süre (saat)','Katılımcı','Durum']}
                                rows={qualityActivities.trainingDetails.slice(0, 12).map((d) => [
                                    <span style={{fontSize:11}}>{trunc(safeText(d.title),30)}</span>,
                                    <span style={{fontSize:9}}>{d.startDate ? format(new Date(d.startDate),'dd.MM.yyyy',{locale:tr}) : '—'}</span>,
                                    <span style={{fontSize:9}}>{d.endDate ? format(new Date(d.endDate),'dd.MM.yyyy',{locale:tr}) : '—'}</span>,
                                    <span style={{fontSize:10}}>{trunc(safeText(d.instructor),18)}</span>,
                                    <span style={{fontSize:10}}>{d.durationHours != null ? d.durationHours : '—'}</span>,
                                    <span style={{fontWeight:600,color:C.teal}}>{d.participantsCount ?? 0}</span>,
                                    <span style={{fontSize:10,color:d.status==='Tamamlandı'?C.green:C.orange}}>{d.status}</span>,
                                ])}
                                fontSize={10}
                            />
                        ) : (
                            <div style={{textAlign:'center',color:C.slate,fontSize:11,padding:24}}>Dönemde eğitim kaydı yok.</div>
                        )}
                    </Panel>
                </Row>
                </>
                )}

                {hasGovernanceSection && (
                <>
                <SectionBlock>
                <PageHeader
                    title="KALİTESİZLİK YÜKÜ · KPI ALARMLARI · YÖNETİŞİM"
                    periodLabel={periodLabel}
                />

                <Row cols="repeat(5,1fr)" gap={8} mb={14}>
                    <KpiCard
                        label="Toplam COPQ"
                        value={fmtCurrency(costBurden?.totalCopq)}
                        color={C.red}
                        bg="#fef2f2"
                        sub="İç + dış hata + değerlendirme + önleme"
                    />
                    <KpiCard
                        label="Araç Başı COPQ"
                        value={fmtCurrency(costBurden?.costPerVehicle)}
                        color={C.orange}
                        bg="#fff7ed"
                        sub={`${fmtNum(kpis.totalVehicles)} araç üzerinden`}
                    />
                    <KpiCard
                        label="Dolaylı Gider"
                        value={fmtCurrency(costBurden?.byComponent?.find((item) => item.name === 'Dolaylı Giderler')?.value)}
                        color={C.blue}
                        bg="#eff6ff"
                        sub="İşletmeye yayılan ek yük"
                    />
                    <KpiCard
                        label="Ortak Gider"
                        value={fmtCurrency(costBurden?.byComponent?.find((item) => item.name === 'Ortak Giderler')?.value)}
                        color={C.teal}
                        bg="#f0fdfa"
                        sub="Paylaştırılan destek maliyetleri"
                    />
                    <KpiCard
                        label="En Büyük Yük Kaynağı"
                        value={fmtCurrency(costBurden?.topSource?.value)}
                        color={C.purple}
                        bg="#f5f3ff"
                        sub={costBurden?.topSource?.name || 'Kaynak yok'}
                    />
                </Row>
                </SectionBlock>

                <Row cols="1.1fr 0.9fr" gap={12} mb={14}>
                    <Panel title="Kalitesizlik Yük Dağılımı" color={C.orange}>
                        {costBurden?.byCategory?.length > 0 ? (
                            <>
                                <ResponsiveContainer width="100%" height={220}>
                                    <BarChart data={costBurden.byCategory} margin={{ top: 8, right: 10, left: 8, bottom: 8 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                        <XAxis dataKey="name" fontSize={10} tick={{ fill: '#374151' }} />
                                        <YAxis fontSize={10} tick={{ fill: '#374151' }} tickFormatter={(value) => `${Math.round(value / 1000)}k`} />
                                        <Tooltip formatter={(value) => fmtCurrency(value)} contentStyle={{ fontSize: 11 }} />
                                        <Bar dataKey="value" name="Tutar" radius={[4, 4, 0, 0]}>
                                            {costBurden.byCategory.map((item, index) => (
                                                <Cell key={item.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10 }}>
                                    <div>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: C.orange, marginBottom: 6 }}>Yük Bileşenleri</div>
                                        <MiniTable
                                            headers={['Bileşen', 'Tutar']}
                                            rows={(costBurden.byComponent || []).map((item) => [
                                                trunc(safeText(item.name), 20),
                                                <span style={{ fontWeight: 700, color: C.orange }}>{fmtCurrency(item.value)}</span>,
                                            ])}
                                            fontSize={10}
                                        />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: C.red, marginBottom: 6 }}>En Büyük Kaynaklar</div>
                                        <MiniTable
                                            headers={['Kaynak', 'Kayıt', 'Tutar']}
                                            rows={(costBurden.bySource || []).slice(0, 6).map((item) => [
                                                trunc(safeText(item.name), 20),
                                                <span style={{ fontSize: 10 }}>{fmtNum(item.count)}</span>,
                                                <span style={{ fontWeight: 700, color: C.red }}>{fmtCurrency(item.value)}</span>,
                                            ])}
                                            fontSize={10}
                                        />
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div style={{ textAlign: 'center', color: C.slate, padding: 30, fontSize: 11 }}>Kalitesizlik yük verisi yok.</div>
                        )}
                    </Panel>

                    <Panel title="Top 10 Maliyet Sürücüsü" color={C.red}>
                        <MiniTable
                            headers={['Kalem / Parça', 'Tür', 'Sahip', 'Tutar']}
                            rows={(costBurden?.topDrivers || []).map((item) => [
                                <span style={{ fontSize: 10, fontWeight: 600 }}>{trunc(safeText(item.label), 22)}</span>,
                                <span style={{ fontSize: 10 }}>{trunc(safeText(item.costType), 16)}</span>,
                                <span style={{ fontSize: 10 }}>{trunc(safeText(item.owner), 16)}</span>,
                                <span style={{ fontWeight: 800, color: C.red }}>{fmtCurrency(item.amount)}</span>,
                            ])}
                            emptyMsg="Top 10 maliyet sürücüsü oluşmadı."
                            fontSize={10}
                        />
                    </Panel>
                </Row>
                </>
                )}

                <Row cols="1fr 1fr" gap={12} mb={14}>
                    <Panel title="Kalite Hedefleri ve KPI Alarm Listesi" color={C.blue}>
                        <MiniTable
                            headers={['KPI', 'Gerçekleşen', 'Hedef', 'Durum']}
                            rows={(governance?.kpiWatch || []).map((item) => [
                                <span style={{ fontSize: 10, fontWeight: 600 }}>{trunc(safeText(item.name), 26)}</span>,
                                <span style={{ fontSize: 10 }}>{fmtNum(item.current)}{item.unit || ''}</span>,
                                <span style={{ fontSize: 10 }}>{fmtNum(item.target)}{item.unit || ''}</span>,
                                <span style={{ fontWeight: 700, color: item.status === 'Alarm' ? C.red : item.status === 'Risk' ? C.orange : C.green }}>
                                    {item.status}
                                </span>,
                            ])}
                            emptyMsg="KPI alarm verisi bulunmadı."
                            fontSize={10}
                        />
                        {complaints?.analysesByType?.length > 0 && (
                            <>
                                <div style={{ fontSize: 11, fontWeight: 700, color: C.blue, margin: '12px 0 6px' }}>Şikayet Analiz Dağılımı</div>
                                <MiniTable
                                    headers={['Analiz Tipi', 'Adet']}
                                    rows={complaints.analysesByType.map((item) => [
                                        trunc(safeText(item.name), 18),
                                        <span style={{ fontWeight: 700, color: C.blue }}>{fmtNum(item.value)}</span>,
                                    ])}
                                    fontSize={10}
                                />
                            </>
                        )}
                    </Panel>

                    <Panel title="Operasyonel Kalite Yükü ve Uyarılar" color={C.rose}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 10 }}>
                            {(governance?.summary || []).map((item) => (
                                <div key={item.label} style={{
                                    background: item.severity === 'bad' ? '#fef2f2' : item.severity === 'warning' ? '#fff7ed' : '#f0fdf4',
                                    borderRadius: 6,
                                    padding: '8px 10px',
                                    borderLeft: `4px solid ${item.severity === 'bad' ? C.red : item.severity === 'warning' ? C.orange : C.green}`,
                                }}>
                                    <div style={{ fontSize: 9, color: C.slate, lineHeight: 1.3 }}>{item.label}</div>
                                    <div style={{ fontSize: 16, fontWeight: 800, marginTop: 4 }}>{fmtNum(item.value)}</div>
                                </div>
                            ))}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: C.red, marginBottom: 6 }}>Geciken Görevler</div>
                                <MiniTable
                                    headers={['Görev', 'Proje', 'Gün']}
                                    rows={(governance?.overdueTasks || []).slice(0, 5).map((task) => [
                                        trunc(safeText(task.title), 24),
                                        trunc(safeText(task.project), 14),
                                        <span style={{ fontWeight: 700, color: C.red }}>{fmtNum(task.daysOverdue)}</span>,
                                    ])}
                                    emptyMsg="Geciken görev yok."
                                    fontSize={10}
                                />
                            </div>
                            <div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: C.purple, marginBottom: 6 }}>Doküman / Kalibrasyon Uyarıları</div>
                                <MiniTable
                                    headers={['Uyarı', 'Referans', 'Kalan / Gün']}
                                    rows={[
                                        ...(governance?.expiringDocs || []).slice(0, 3).map((doc) => [
                                            'Doküman',
                                            trunc(safeText(doc.ad), 18),
                                            <span style={{ fontWeight: 700, color: C.orange }}>{fmtNum(doc.daysRemaining)} gün</span>,
                                        ]),
                                        ...(overdueCalibrations || []).slice(0, 3).map((item) => [
                                            'Kalibrasyon',
                                            trunc(safeText(item.cihaz), 18),
                                            <span style={{ fontWeight: 700, color: C.red }}>{fmtNum(item.gecikme)} gün</span>,
                                        ]),
                                    ]}
                                    emptyMsg="Aktif kalite uyarısı yok."
                                    fontSize={10}
                                />
                            </div>
                        </div>

                        <div style={{ marginTop: 12 }}>
                            <StatRow label="Şikayet Aksiyonu / Tamamlanan" value={`${fmtNum(governance?.complaintActions?.completed)} / ${fmtNum(governance?.complaintActions?.total)}`} color={C.blue} />
                            <StatRow label="Geciken Şikayet Aksiyonu" value={fmtNum(governance?.complaintActions?.overdue)} color={(governance?.complaintActions?.overdue || 0) > 0 ? C.red : C.green} />
                            <StatRow label="Tahmini Aksiyon Maliyeti" value={fmtCurrency(governance?.complaintActions?.estimatedCost)} color={C.orange} />
                            <StatRow label="Gerçekleşen Aksiyon Maliyeti" value={fmtCurrency(governance?.complaintActions?.actualCost)} color={C.rose} bold />
                        </div>
                    </Panel>
                </Row>

                {/* ══════════════════════════════════════════════════════════ */}
                {/* FOOTER                                                    */}
                {/* ══════════════════════════════════════════════════════════ */}
                <div className="report-block" style={{
                    background:`linear-gradient(135deg,${C.navy}15,${C.blue}15)`,
                    border:`1.5px solid ${C.navy}30`, borderRadius:5,
                    padding:'8px 16px', display:'flex', justifyContent:'space-between', alignItems:'center',
                }}>
                    <div style={{fontSize:10,color:C.gray}}>
                        <strong>Kademe A.Ş.</strong> — Kalite Yönetim Sistemi | Otomatik oluşturulmuştur.
                    </div>
                    <div style={{fontSize:10,color:C.gray}}>
                        Dönem: <strong>{periodLabel}</strong> &nbsp;|&nbsp;
                        Tarih: <strong>{format(new Date(),'dd.MM.yyyy HH:mm',{locale:tr})}</strong> &nbsp;|&nbsp;
                        Format: <strong>A3 Yatay</strong>
                    </div>
                    <div style={{display:'flex',gap:16}}>
                        {[
                            {l:'Açık DF/8D',v:`${kpis.openDF+kpis.open8D}`},
                            {l:'Toplam Maliyet',v:fmtCurrency(kpis.totalCost)},
                            {l:'Araç Geçiş',v:`%${kpis.vehiclePassRate}`},
                            {l:'Personel',v:data.meta?.totalPersonnel||0},
                        ].map((x,i)=>(
                            <div key={i} style={{textAlign:'center'}}>
                                <div style={{fontSize:9,color:C.slate}}>{x.l}</div>
                                <div style={{fontSize:11,fontWeight:800,color:C.navy}}>{x.v}</div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </>
    );
};

export default A3QualityBoardReport;
