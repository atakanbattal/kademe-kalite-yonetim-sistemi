import React, { useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Loader2 } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
    PieChart, Pie, Cell, CartesianGrid,
    ComposedChart, Line, Area,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import useA3ReportData from '@/hooks/useA3ReportData';
import { useAuth } from '@/contexts/SupabaseAuthContext';

/* ─── Renkler ───────────────────────────────────────────────────────────────── */
const C = {
    navy: '#7f1d1d', blue: '#dc2626', indigo: '#4f46e5', green: '#15803d',
    red: '#dc2626', orange: '#ea580c', yellow: '#b45309', purple: '#7c3aed',
    teal: '#0f766e', rose: '#be123c', gray: '#4b5563', slate: '#64748b', lime: '#4d7c0f',
};
const CHART_COLORS = ['#dc2626','#15803d','#ea580c','#b45309','#7c3aed','#0f766e','#be123c','#7f1d1d','#64748b','#991b1b','#0369a1','#a21caf'];
const COST_COLORS = { 'İç Hata Maliyetleri': '#dc2626', 'Dış Hata Maliyetleri': '#ea580c', 'Önleme Maliyetleri': '#15803d', 'Değerlendirme Maliyetleri': '#b91c1c' };
const RESULT_COLORS = { Kabul: '#15803d', 'Şartlı Kabul': '#b45309', Ret: '#dc2626', Beklemede: '#64748b' };

/* ─── Yardımcılar ───────────────────────────────────────────────────────────── */
const fmtCurrency = (n) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n || 0);
const fmtNum = (n) => new Intl.NumberFormat('tr-TR').format(n || 0);
const fmtPct = (n, d = 0) => `%${Number.isFinite(Number(n)) ? Number(n).toFixed(d) : '0'}`;
const trunc = (s, _len) => String(s ?? '');

/* ═══ BİLEŞENLER ═══ */
const Slide = ({ children, title, subtitle, slideNum, totalSlides }) => (
    <div className="ep-slide" style={{ width: '100%', minHeight: '100vh', background: 'white', display: 'flex', flexDirection: 'column', padding: '32px 52px 24px', pageBreakAfter: 'always', breakAfter: 'page' }}>
        {title && (
            <div className="ep-slide-head" style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 6, height: 36, borderRadius: 3, background: `linear-gradient(180deg, ${C.blue} 0%, ${C.navy} 100%)` }} />
                    <div>
                        <div style={{ fontSize: 26, fontWeight: 800, color: C.navy, letterSpacing: -0.4 }}>{title}</div>
                        {subtitle && <div style={{ fontSize: 12, color: C.slate, marginTop: 3 }}>{subtitle}</div>}
                    </div>
                </div>
                <div style={{ height: 2, background: `linear-gradient(90deg, ${C.blue}40 0%, transparent 60%)`, marginTop: 12, borderRadius: 2 }} />
            </div>
        )}
        <div className="ep-slide-body" style={{ flex: 1 }}>{children}</div>
        <div className="ep-slide-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1.5px solid ${C.navy}12`, paddingTop: 8, marginTop: 12 }}>
            <div style={{ fontSize: 9, color: C.slate, fontWeight: 500 }}>KADEME A.Ş. — Kalite Yönetim Sistemi — İcra Kurulu Sunumu</div>
            <div style={{ fontSize: 9, color: C.slate, fontWeight: 700 }}>{slideNum} / {totalSlides}</div>
        </div>
    </div>
);

const KpiCard = ({ label, value, color = C.navy, sub, large }) => (
    <div className="ep-kpi-card" style={{ background: 'white', borderRadius: 12, padding: large ? '20px 22px' : '14px 16px', border: `1.5px solid ${color}15`, borderLeft: `5px solid ${color}`, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
        <div style={{ fontSize: large ? 11 : 10, color: C.gray, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
        <div style={{ fontSize: large ? 32 : 24, fontWeight: 900, color, lineHeight: 1.1, marginTop: large ? 5 : 3 }}>{value}</div>
        {sub && <div style={{ fontSize: large ? 11 : 9, color: C.slate, marginTop: large ? 5 : 3 }}>{sub}</div>}
    </div>
);

const SL = ({ children, color = C.navy }) => (
    <div className="ep-sl" style={{ fontSize: 13, fontWeight: 700, color, marginBottom: 10, paddingBottom: 4, borderBottom: `2px solid ${color}20`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 4, height: 16, borderRadius: 2, background: color }} />{children}
    </div>
);

const DT = ({ headers, rows, fontSize = 12, emptyMsg = 'Veri yok', colWidths }) => (
    <table className="ep-table" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize, borderRadius: 8, overflow: 'hidden', border: `1px solid ${C.navy}12`, tableLayout: 'fixed' }}>
        {colWidths && (
            <colgroup>
                {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
            </colgroup>
        )}
        <thead><tr>{headers.map((h, i) => <th key={i} style={{ background: `linear-gradient(135deg, ${C.navy}, #b91c1c)`, color: 'white', padding: '9px 12px', textAlign: 'left', fontWeight: 700, fontSize: Math.max(10, fontSize - 1), wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{h}</th>)}</tr></thead>
        <tbody>{rows.length === 0
            ? <tr className="ep-tr"><td colSpan={headers.length} style={{ textAlign: 'center', padding: 22, color: C.slate, fontStyle: 'italic' }}>{emptyMsg}</td></tr>
            : rows.map((row, ri) => <tr key={ri} className="ep-tr" style={{ background: ri % 2 === 0 ? 'white' : '#f8fafc' }}>{row.map((cell, ci) => <td key={ci} style={{ padding: '8px 12px', verticalAlign: 'top', borderBottom: `1px solid ${C.navy}08`, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{cell}</td>)}</tr>)
        }</tbody>
    </table>
);

/** Tablo ve blokları yan yana sıkıştırmadan tam genişlik dikey dizim */
const VStack = ({ children, gap = 28 }) => (
    <div className="ep-vstack" style={{ display: 'flex', flexDirection: 'column', gap, width: '100%' }}>{children}</div>
);

/* ═══ ANA BİLEŞEN ═══ */
const ExecutivePresentation = () => {
    const wrapRef = useRef(null);
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { session } = useAuth();
    const period = searchParams.get('period') || 'last3months';
    const yearParam = searchParams.get('year');
    const monthParam = searchParams.get('month');
    const { data, loading, error, periodLabel } = useA3ReportData(period, {
        executiveReport: true,
        calendarYear: yearParam != null && yearParam !== '' ? Number(yearParam) : undefined,
        calendarMonth: monthParam != null && monthParam !== '' ? Number(monthParam) : undefined,
    });

    useEffect(() => { if (!session) navigate('/login'); }, [session, navigate]);

    if (loading) return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#fef2f2', gap: 16 }}>
            <Loader2 style={{ width: 56, height: 56, color: C.navy, animation: 'spin 1s linear infinite' }} />
            <div style={{ fontSize: 20, fontWeight: 700, color: C.navy }}>İcra Kurulu Sunumu hazırlanıyor…</div>
            <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
        </div>
    );

    if (error || !data) return <div style={{ textAlign: 'center', padding: 60, color: C.red, fontSize: 16, fontWeight: 600 }}>{error || 'Sunum verileri yüklenemedi.'}</div>;

    const { kpis, ncByDept, ncByType, ncMonthly, costByType, costMonthly, costByUnit, costBurden,
            incoming, suppliers, vehicles, complaints, nonconformityModule, governance,
            deviations, kaizen, fixtureTracking, qualityActivities,
            df8dResponsiblePerformance, df8dRequesterContribution,
            openNC, activeQuarantine, overdueCalibrations,
            stockRisk, inkrIncoming, executiveProcessQuality } = data;

    const epq = executiveProcessQuality;
    const hasProcInspRows = (epq?.processInspections?.total ?? 0) > 0 || (epq?.processInspections?.recent?.length ?? 0) > 0;
    const hasLeakRows = (epq?.leakTest?.total ?? 0) > 0;
    const hasLeakByResult = (epq?.leakTest?.byResult?.length ?? 0) > 0;
    const hasLeakRecent = (epq?.leakTest?.recent?.length ?? 0) > 0;
    const hasBalRows = (epq?.dynamicBalance?.total ?? 0) > 0 || (epq?.dynamicBalance?.recent?.length ?? 0) > 0;

    const govCompl = governance?.complaintActions || {};
    const hasComplaintContent =
        (kpis.totalComplaints ?? 0) > 0 ||
        (kpis.openComplaints ?? 0) > 0 ||
        (kpis.slaOverdue ?? 0) > 0 ||
        (complaints.monthly || []).some((m) => (m.sayi ?? 0) > 0) ||
        (complaints.byStatus || []).some((s) => (s.value ?? 0) > 0) ||
        (complaints.analysesByType || []).some((a) => (a.value ?? 0) > 0) ||
        (govCompl.total ?? 0) > 0 ||
        (govCompl.completed ?? 0) > 0 ||
        (govCompl.overdue ?? 0) > 0 ||
        (govCompl.estimatedCost ?? 0) > 0 ||
        (govCompl.actualCost ?? 0) > 0;

    const hasKaizenContent =
        (kpis.totalKaizen ?? 0) > 0 ||
        (kpis.completedKaizen ?? 0) > 0 ||
        (kpis.activeKaizen ?? 0) > 0 ||
        (kpis.kaizenSavings ?? 0) > 0 ||
        (kaizen?.byDept || []).length > 0 ||
        (kaizen?.byStatus || []).length > 0;

    const hasFinalFaultCostTrend = (vehicles.finalFaultCostMonthly || []).some((m) => (m.toplam ?? 0) > 0);

    /** Orijinal şablondaki slayt no (2–22) → şikayet/kaizen çıkarıldıktan sonra footer’da gösterilecek sıra */
    const slideNo = (original) => {
        let n = original;
        if (original >= 15 && !hasComplaintContent) n -= 1;
        if (original >= 16 && !hasKaizenContent) n -= 1;
        return n;
    };
    const T = 23 - (!hasComplaintContent ? 1 : 0) - (!hasKaizenContent ? 1 : 0);

    const css = `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body{font-family:'Inter','Segoe UI',system-ui,sans-serif;background:#7f1d1d;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
        .ep-wrap{background:white;} .ep-wrap text,.ep-wrap tspan{font-family:inherit;}
        @media screen{.ep-wrap{max-width:1400px;margin:0 auto;}.ep-slide{box-shadow:0 6px 32px rgba(0,0,0,.22);margin-bottom:32px;border-radius:6px;overflow:hidden;}}
        @media print{
            html,body{height:auto!important;min-height:0!important;background:white!important;}
            .ep-wrap{margin:0!important;padding:0!important;max-width:100%!important;}
            @page{size:420mm 297mm;margin:8mm;}
            .ep-slide{
                min-height:0!important;height:auto!important;
                page-break-after:always;break-after:page;
                border-radius:0!important;box-shadow:none!important;
                padding:10mm 12mm!important;
                overflow:visible!important;
            }
            .ep-slide:last-child{page-break-after:auto;break-after:auto;}
            table.ep-table{
                width:100%!important;border-collapse:collapse!important;
                page-break-inside:auto;break-inside:auto;
                -webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;
            }
            table.ep-table thead{display:table-header-group;}
            table.ep-table thead tr{break-inside:avoid;page-break-inside:avoid;}
            table.ep-table tbody tr.ep-tr,
            table.ep-table tbody tr{
                break-inside:avoid!important;page-break-inside:avoid!important;
            }
            table.ep-table th,table.ep-table td{
                break-inside:avoid!important;page-break-inside:avoid!important;
            }
            .ep-kpi-card{break-inside:avoid;page-break-inside:avoid;}
            .ep-sl{break-after:avoid;page-break-after:avoid;}
            .ep-vstack{min-height:0;}
            .ep-slide-head{break-after:avoid;page-break-after:avoid;}
            .ep-slide-footer{break-inside:avoid;page-break-inside:avoid;margin-top:auto!important;}
            .recharts-responsive-container,.recharts-wrapper{break-inside:avoid;page-break-inside:avoid;}
            .recharts-wrapper svg{overflow:visible!important;}
        }
    `;

    return (
        <>
            <Helmet><title>İcra Kurulu Sunumu – {periodLabel}</title></Helmet>
            <style>{css}</style>
            <div ref={wrapRef} className="ep-wrap" lang="tr">

                {/* ═══ 1 — KAPAK ═══ */}
                <div className="ep-slide ep-cover" style={{ width:'100%',minHeight:'100vh',background:`linear-gradient(135deg,${C.navy} 0%,#991b1b 40%,#dc2626 100%)`,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:'white',textAlign:'center',padding:'60px 80px',pageBreakAfter:'always',breakAfter:'page' }}>
                    <div style={{fontSize:13,fontWeight:500,opacity:.55,letterSpacing:5,textTransform:'uppercase',marginBottom:24}}>KADEME A.Ş.</div>
                    <div style={{fontSize:48,fontWeight:900,letterSpacing:-1,lineHeight:1.1,marginBottom:8}}>Kalite Yönetim Sistemi</div>
                    <div style={{fontSize:22,fontWeight:600,opacity:.85,marginBottom:40}}>İcra Kurulu Performans Raporu</div>
                    <div style={{background:'rgba(255,255,255,.12)',borderRadius:16,padding:'20px 52px',backdropFilter:'blur(8px)',marginBottom:36}}>
                        <div style={{fontSize:20,fontWeight:700}}>Dönem: {periodLabel}</div>
                        <div style={{fontSize:13,opacity:.7,marginTop:6}}>{format(new Date(),'dd MMMM yyyy, EEEE',{locale:tr})}</div>
                    </div>
                    <div style={{width:72,height:2,background:'rgba(255,255,255,.35)',borderRadius:2,marginBottom:28}} aria-hidden />
                    <p style={{maxWidth:560,margin:0,fontSize:15,fontWeight:500,opacity:.88,lineHeight:1.65,letterSpacing:.2}}>
                        Kurumsal kalite stratejisi ve yönetim gözden geçirmesi kapsamında hazırlanmıştır.
                    </p>
                    <p style={{maxWidth:520,margin:'14px 0 0',fontSize:13,opacity:.62,lineHeight:1.55}}>
                        Performans göstergeleri ve modül özetleri izleyen slaytlarda sunulmaktadır.
                    </p>
                </div>

                {/* ═══ 2 — KPI ÖZETİ ═══ */}
                <Slide title="Kalite Performans Göstergeleri (KPI)" subtitle="Tüm modüllerden dönem özet göstergeleri" slideNum={slideNo(2)} totalSlides={T}>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:16}}>
                        <KpiCard large label="Açık DF" value={kpis.openDF} color={C.red} sub={`Toplam ${fmtNum(kpis.totalNc)} NC`} />
                        <KpiCard large label="Açık 8D" value={kpis.open8D} color={C.orange} sub={`${fmtNum(kpis.closedNc)} kapatıldı`} />
                        <KpiCard large label="Ort. Kapatma Süresi" value={`${kpis.avgClosureDays} gün`} color={kpis.avgClosureDays>30?C.red:C.teal} sub="DF/8D ortalama" />
                        <KpiCard large label="Dönem COPQ" value={fmtCurrency(kpis.totalCost)} color={C.red} sub={`Araç başı ${fmtCurrency(costBurden?.costPerVehicle)}`} />
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:12,marginBottom:12}}>
                        <KpiCard label="Karantina" value={kpis.inQuarantine} color={C.purple} sub={`${fmtNum(activeQuarantine?.length||0)} kayıt`} />
                        <KpiCard label="Açık Şikayet" value={kpis.openComplaints} color={C.rose} sub={`${kpis.slaOverdue} SLA gecikmiş`} />
                        <KpiCard label="Girdi Ret Oranı" value={fmtPct(kpis.incomingRejectionRate,1)} color={kpis.incomingRejectionRate>5?C.red:C.green} sub={`${fmtNum(kpis.rejectedIncoming)}/${fmtNum(kpis.totalIncoming)}`} />
                        <KpiCard label="Araç Geçiş Oranı" value={fmtPct(kpis.vehiclePassRate,1)} color={parseFloat(kpis.vehiclePassRate)>90?C.green:C.orange} sub={`${fmtNum(kpis.passedVehicles)}/${fmtNum(kpis.totalVehicles)}`} />
                        <KpiCard label="Tedarikçi PPM" value={fmtNum(kpis.supplierOverallPPM)} color={C.red} sub={`${fmtNum(suppliers.totalDefectiveParts)} hatalı`} />
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
                        <KpiCard label="Kaizen" value={`${fmtNum(kpis.completedKaizen)}/${fmtNum(kpis.totalKaizen)}`} color={C.teal} sub={`${fmtNum(kpis.activeKaizen)} devam eden`} />
                        <KpiCard label="Sapma Talebi" value={fmtNum(kpis.totalDeviations)} color={C.indigo} sub={`${fmtNum(kpis.openDeviations)} açık`} />
                        <KpiCard label="İç Tetkik" value={`${fmtNum(kpis.completedAudits)}/${fmtNum(kpis.totalAudits)}`} color={C.yellow} sub={`${kpis.openAuditFindings} açık bulgu`} />
                        <KpiCard label="Fikstür" value={`${fmtNum(fixtureTracking?.active||0)} aktif`} color={C.blue} sub={`${fixtureTracking?.overdue||0} gecikmiş doğrulama`} />
                    </div>
                </Slide>

                {/* ═══ 3 — COPQ MALİYET ═══ */}
                <Slide title="Kalitesizlik Maliyet Analizi (COPQ)" subtitle="İç hata, dış hata, değerlendirme ve önleme maliyet kategorileri" slideNum={slideNo(3)} totalSlides={T}>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:18}}>
                        {[
                            {label:'İç Hata Maliyetleri',key:'İç Hata',color:C.red,desc:'Fabrika içi hata maliyetleri'},
                            {label:'Dış Hata Maliyetleri',key:'Dış Hata',color:C.orange,desc:'Müşteride tespit edilen maliyetler'},
                            {label:'Değerlendirme Maliyetleri',key:'Değerlendirme',color:C.blue,desc:'Kontrol, test ve muayene'},
                            {label:'Önleme Maliyetleri',key:'Önleme',color:C.green,desc:'Eğitim ve kalite planlama'},
                        ].map(cat=>{const val=costBurden?.byCategory?.find(c=>c.name===cat.key)?.value||0;return <KpiCard key={cat.key} large label={cat.label} value={fmtCurrency(val)} color={cat.color} sub={`${kpis.totalCost>0?((val/kpis.totalCost)*100).toFixed(1):'0'}% · ${cat.desc}`}/>;
                        })}
                    </div>
                    <VStack gap={26}>
                        <div>
                            <SL color={C.orange}>Maliyet türleri dağılımı</SL>
                            {costByType.length>0?(
                                <div style={{ maxWidth: 520 }}><ResponsiveContainer width="100%" height={300}><PieChart><Pie data={costByType.slice(0,8)} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={110} stroke="#fff" strokeWidth={3} paddingAngle={2}>{costByType.slice(0,8).map((e,i)=><Cell key={i} fill={COST_COLORS[e.name]||CHART_COLORS[i%CHART_COLORS.length]}/>)}</Pie><Tooltip formatter={v=>fmtCurrency(v)} contentStyle={{fontSize:12,borderRadius:8}}/><Legend wrapperStyle={{fontSize:11}}/></PieChart></ResponsiveContainer></div>
                            ):<div style={{textAlign:'center',color:C.slate,padding:40}}>Maliyet verisi yok</div>}
                        </div>
                        <div>
                            <SL color={C.red}>Aylık kalite maliyeti trendi</SL>
                            {costMonthly.length>0?(
                                <ResponsiveContainer width="100%" height={300}><ComposedChart data={costMonthly} margin={{top:8,right:16,left:16,bottom:28}}><CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/><XAxis dataKey="name" fontSize={11} angle={-25} textAnchor="end" height={36} tick={{fill:'#374151'}}/><YAxis fontSize={11} tick={{fill:'#374151'}} tickFormatter={v=>`${Math.round(v/1000)}k`}/><Tooltip formatter={v=>fmtCurrency(v)} contentStyle={{fontSize:12,borderRadius:8}}/><Area type="monotone" dataKey="toplam" fill={`${C.orange}18`} stroke={C.orange} strokeWidth={2} name="Maliyet"/><Bar dataKey="toplam" fill={C.orange} radius={[4,4,0,0]} opacity={0.4} name="Tutar"/><Line type="monotone" dataKey="toplam" stroke={C.red} dot={{r:4,fill:C.red}} strokeWidth={2.5} legendType="none"/></ComposedChart></ResponsiveContainer>
                            ):<div style={{textAlign:'center',color:C.slate,padding:40}}>Trend verisi yok</div>}
                        </div>
                    </VStack>
                </Slide>

                {/* ═══ 4 — MALİYET DETAY ═══ */}
                <Slide title="Maliyet Detay Analizi" subtitle="Birim bazlı COPQ; kaynak dağılımı; öne çıkan maliyet kalemleri ve yük bileşenleri" slideNum={slideNo(4)} totalSlides={T}>
                    <VStack gap={24}>
                        <div>
                            <SL color={C.orange}>Birim bazlı kalitesizlik maliyetleri</SL>
                            <DT headers={['Birim','Maliyet','Hata','Hata başına']} rows={(costByUnit||[]).slice(0,12).map(c=>[<span style={{fontWeight:600}}>{trunc(c.name,36)}</span>,<span style={{fontWeight:700,color:C.orange}}>{fmtCurrency(c.value)}</span>,<span style={{fontWeight:700,color:C.red}}>{fmtNum(c.issueCount||0)}</span>,<span style={{fontWeight:600}}>{c.costPerIssue!=null?fmtCurrency(c.costPerIssue):'—'}</span>])} fontSize={12}/>
                        </div>
                        {costBurden?.bySource?.length>0&&<div><SL color={C.red}>Maliyet kaynağı dağılımı</SL><DT headers={['Kaynak','Kayıt','Tutar']} rows={costBurden.bySource.slice(0,12).map(s=>[<span style={{fontWeight:600}}>{trunc(s.name,36)}</span>,<span style={{fontWeight:600}}>{fmtNum(s.count)}</span>,<span style={{fontWeight:700,color:C.red}}>{fmtCurrency(s.value)}</span>])} fontSize={12}/></div>}
                        <div>
                            <SL color={C.red}>Öne çıkan maliyet kalemleri</SL>
                            <DT headers={['#','Kalem','Tür','Sahip','Tutar']} colWidths={['5%','32%','18%','26%','19%']} rows={(costBurden?.topDrivers||[]).slice(0,12).map((d,i)=>[<span style={{fontWeight:800,color:C.navy}}>{i+1}</span>,<span style={{fontWeight:600}}>{trunc(d.label,36)}</span>,<span style={{fontSize:11,color:C.slate}}>{trunc(d.costType,22)}</span>,<span style={{fontSize:11}}>{trunc(d.owner,28)}</span>,<span style={{fontWeight:800,color:C.red}}>{fmtCurrency(d.amount)}</span>])} fontSize={12}/>
                        </div>
                        {costBurden?.byComponent?.length>0&&<div><SL color={C.indigo}>Yük bileşenleri</SL><DT headers={['Bileşen','Tutar']} rows={costBurden.byComponent.map(item=>[<span style={{fontWeight:600}}>{item.name}</span>,<span style={{fontWeight:700,color:C.indigo}}>{fmtCurrency(item.value)}</span>])} fontSize={12}/></div>}
                    </VStack>
                </Slide>

                {/* ═══ 5 — BİRİM UYGUNSUZLUK DAĞILIMI (tam sayfa grafik) ═══ */}
                <Slide title="Birim Bazlı Uygunsuzluk Dağılımı" subtitle="Açıldığı birime göre NC/DF/8D kayıt dağılımı" slideNum={slideNo(5)} totalSlides={T}>
                    {ncByDept.length>0?(
                        <ResponsiveContainer width="100%" height={Math.max(380,Math.min(600,(ncByDept?.length||0)*36+60))}>
                            <BarChart data={ncByDept} layout="vertical" margin={{top:8,right:32,left:16,bottom:8}}><CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/><XAxis type="number" fontSize={12} tick={{fill:'#374151'}}/><YAxis type="category" dataKey="name" width={Math.max(120,Math.min(220,Math.max(...(ncByDept||[]).map(d=>(d.name||'').length*6.5),120)))} fontSize={11} interval={0} tick={{fill:'#374151'}}/><Tooltip contentStyle={{fontSize:12,borderRadius:8}}/><Legend wrapperStyle={{fontSize:12,paddingTop:8}}/><Bar dataKey="acik" name="Açık" fill={C.red} stackId="a" radius={[0,3,3,0]}/><Bar dataKey="kapali" name="Kapalı" fill={C.green} stackId="a" radius={[0,3,3,0]}/></BarChart>
                        </ResponsiveContainer>
                    ):<div style={{textAlign:'center',color:C.slate,padding:80,fontSize:14}}>Bu dönemde uygunsuzluk kaydı yok.</div>}
                </Slide>

                {/* ═══ 6 — NC TREND + KALİTE DUVARI ═══ */}
                <Slide title="Uygunsuzluk Trendi ve DF/8D Birim Performansı" subtitle="Aylık açılan/kapanan NC; sorumlu ve talep eden birim tabloları (DF modülü ile uyumlu); tip dağılımı" slideNum={slideNo(6)} totalSlides={T}>
                    <VStack gap={22}>
                        <div>
                            <SL color={C.indigo}>Aylık uygunsuzluk trendi</SL>
                            {ncMonthly.length>0?(
                                <ResponsiveContainer width="100%" height={260}><ComposedChart data={ncMonthly} margin={{top:8,right:16,left:8,bottom:28}}><CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/><XAxis dataKey="name" fontSize={11} angle={-20} textAnchor="end" height={32} tick={{fill:'#374151'}}/><YAxis fontSize={11} tick={{fill:'#374151'}}/><Tooltip contentStyle={{fontSize:12,borderRadius:8}}/><Legend wrapperStyle={{fontSize:11,paddingTop:4}}/><Bar dataKey="acilan" name="Açılan" fill={C.red} radius={[3,3,0,0]} opacity={.85}/><Bar dataKey="kapilan" name="Kapılan" fill={C.green} radius={[3,3,0,0]} opacity={.85}/><Line type="monotone" dataKey="acilan" stroke={C.red} dot={{r:4,fill:C.red}} strokeWidth={2.5} legendType="none"/></ComposedChart></ResponsiveContainer>
                            ):<div style={{textAlign:'center',color:C.slate,padding:30}}>Trend verisi yok</div>}
                        </div>
                        <div>
                            <SL color={C.green}>Sorumlu birim — performans (dönem DF/8D/MDI)</SL>
                            <DT headers={['Sorumlu birim','Toplam','Açık','İşlemde','Kapalı','Ret','Geciken','Ort. kapanma (gün)','Kapanma %']} colWidths={['22%','8%','8%','8%','8%','6%','8%','20%','12%']} rows={(df8dResponsiblePerformance||[]).slice(0,12).map(d=>[<span style={{fontWeight:600}}>{trunc(d.unit,28)}</span>,<span style={{fontWeight:600}}>{fmtNum(d.total)}</span>,<span style={{fontWeight:700,color:C.red}}>{fmtNum(d.open)}</span>,<span style={{fontWeight:700,color:'#b91c1c'}}>{fmtNum(d.inProgress)}</span>,<span style={{fontWeight:700,color:C.green}}>{fmtNum(d.closed)}</span>,<span style={{color:C.slate}}>{fmtNum(d.rejected)}</span>,<span style={{fontWeight:800,color:d.overdue>0?C.red:C.slate}}>{fmtNum(d.overdue)}</span>,<span>{d.avgClosureTime}</span>,<span style={{fontWeight:700}}>{d.closurePct}{d.closurePct==='—'?'':'%'}</span>])} fontSize={11}/>
                        </div>
                        <div>
                            <SL color={C.teal}>Talep eden birim — katkı ve tür dağılımı</SL>
                            <DT headers={['Talep eden birim','Toplam','Açık','Kapalı','DF','8D','MDI','Katkı %']} colWidths={['28%','9%','9%','9%','9%','9%','9%','18%']} rows={(df8dRequesterContribution||[]).filter(r=>r.total>0).slice(0,12).map(r=>[<span style={{fontWeight:600}}>{trunc(r.unit,28)}</span>,<span style={{fontWeight:600}}>{fmtNum(r.total)}</span>,<span style={{fontWeight:700,color:C.red}}>{fmtNum(r.open)}</span>,<span style={{fontWeight:700,color:C.green}}>{fmtNum(r.closed)}</span>,<span>{fmtNum(r.DF)}</span>,<span>{fmtNum(r['8D'])}</span>,<span>{fmtNum(r.MDI)}</span>,<span style={{fontWeight:700}}>{r.contribution}</span>])} fontSize={11}/>
                        </div>
                        <div>
                            <SL color={C.indigo}>NC tip dağılımı</SL>
                            <DT headers={['Tür','Açık','Kapalı','Toplam']} rows={(ncByType||[]).map((t,i)=>[<span style={{fontWeight:700,color:CHART_COLORS[i%CHART_COLORS.length]}}>{t.name}</span>,<span style={{fontWeight:700,color:C.red}}>{t.acik}</span>,<span style={{fontWeight:700,color:C.green}}>{t.kapali}</span>,<span style={{fontWeight:600}}>{t.acik+t.kapali}</span>])} fontSize={12}/>
                            <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12,maxWidth:480,marginTop:14}}>
                                <KpiCard label="Kapatma oranı" value={kpis.totalNc>0?`%${((kpis.closedNc/kpis.totalNc)*100).toFixed(0)}`:'%0'} color={C.blue}/>
                                <KpiCard label="Toplam NC" value={fmtNum(kpis.totalNc)} color={C.red}/>
                            </div>
                        </div>
                    </VStack>
                </Slide>

                {/* ═══ 7 — DF/8D DETAY ═══ */}
                <Slide title="DF/8D Uygunsuzluk Modülü Detayı" subtitle="Modül KPI’ları; önerilen ve açılan maddeler; geciken kayıtlar ve kategori / ciddiyet özeti" slideNum={slideNo(7)} totalSlides={T}>
                    {nonconformityModule&&<>
                        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:16}}>
                            <KpiCard large label="Toplam Kayıt" value={fmtNum(nonconformityModule.total)} color={C.teal} sub={`${fmtNum(nonconformityModule.totalQuantity)} adet`}/>
                            <KpiCard large label="Açık / Kritik" value={`${fmtNum(nonconformityModule.open)} / ${fmtNum(nonconformityModule.critical)}`} color={C.red}/>
                            <KpiCard large label="DF Önerildi / 8D Önerildi" value={`${fmtNum(nonconformityModule.dfSuggested)} / ${fmtNum(nonconformityModule.eightDSuggested)}`} color={C.indigo}/>
                            <KpiCard large label="Dönüştürülen / Kapatılan" value={`${fmtNum(nonconformityModule.converted)} / ${fmtNum(nonconformityModule.closed)}`} color={C.green}/>
                        </div>
                        <VStack gap={28}>
                            <div>
                                <SL color={C.teal}>DF/8D Önerilen ve Açılan Maddeler</SL>
                                <DT headers={['Tür','Kayıt No','Parça','Ciddiyet','Adet']} rows={[...(nonconformityModule.suggestedItems||[]),...(nonconformityModule.openedItems||[])].slice(0,12).map(item=>[<span style={{fontWeight:800,color:item.type==='8D'?C.purple:C.green,background:item.type==='8D'?`${C.purple}15`:`${C.green}15`,padding:'2px 8px',borderRadius:12,fontSize:11}}>{item.type}</span>,<span style={{fontSize:11,fontFamily:'monospace',fontWeight:700}}>{trunc(item.recordNumber,18)}</span>,<span style={{fontSize:11}}>{trunc(item.partCode,28)}</span>,<span style={{fontWeight:700,color:item.severity==='Kritik'?C.red:item.severity==='Yüksek'?C.orange:C.gray}}>{trunc(item.severity,12)}</span>,<span style={{fontWeight:700}}>{fmtNum(item.quantity)}</span>])} fontSize={12}/>
                            </div>
                            <div>
                                <SL color={C.red}>Geciken DF/8D Kayıtları</SL>
                                <DT headers={['Kayıt','Birim','Gecikme']} rows={(data.overdueNC||[]).slice(0,10).map(nc=>[<span style={{fontWeight:600}}>{trunc(nc.title||nc.nc_number||nc.mdi_no,40)}</span>,<span style={{fontSize:11}}>{trunc(nc.department||nc.requesting_unit,28)}</span>,<span style={{fontWeight:800,color:C.red}}>{fmtNum(nc.gecikme)} gün</span>])}/>
                            </div>
                            {nonconformityModule.topCategories?.length>0&&<div><SL color={C.navy}>En Çok Tekrarlayan Kategoriler</SL><DT headers={['Kategori','Adet']} rows={nonconformityModule.topCategories.slice(0,8).map((c,i)=>[<span style={{fontWeight:600,color:CHART_COLORS[i%CHART_COLORS.length]}}>{trunc(c.name,40)}</span>,<span style={{fontWeight:700}}>{fmtNum(c.value)}</span>])} fontSize={12}/></div>}
                            {nonconformityModule.bySeverity?.length>0&&<div><SL color={C.rose}>Ciddiyet Dağılımı</SL><DT headers={['Ciddiyet','Adet']} rows={nonconformityModule.bySeverity.map((s,i)=>[<span style={{fontWeight:700,color:s.name==='Kritik'?C.red:s.name==='Yüksek'?C.orange:CHART_COLORS[i%CHART_COLORS.length]}}>{s.name}</span>,<span style={{fontWeight:700}}>{fmtNum(s.value)}</span>])} fontSize={12}/></div>}
                            {nonconformityModule.topParts?.length>0&&<div><SL color={C.purple}>En Çok Hata Alan Parçalar</SL><DT headers={['Parça','Adet','Ciddiyet']} rows={nonconformityModule.topParts.slice(0,8).map(p=>[<span style={{fontWeight:600,fontSize:11}}>{trunc(p.name,36)}</span>,<span style={{fontWeight:700}}>{fmtNum(p.count)}</span>,<span style={{fontSize:11,color:p.severity==='Kritik'?C.red:C.gray}}>{p.severity}</span>])} fontSize={12}/></div>}
                        </VStack>
                    </>}
                </Slide>

                {/* ═══ 8 — SORUMLU YÜK & KAYITLAR ═══ */}
                <Slide title="Sorumlu İş Yükü ve Modül Kayıtları" subtitle="Uygunsuzluk modülünde sorumlu bazında açık/kapalı yük; dönem içi son kayıtlar" slideNum={slideNo(8)} totalSlides={T}>
                    <VStack gap={24}>
                        <div>
                            <SL color={C.teal}>Sorumlu bazında iş yükü</SL>
                            {(nonconformityModule?.responsibleLoad || []).length > 0 ? (
                                <DT
                                    headers={['Sorumlu', 'Toplam', 'Açık', 'Kapalı', 'Kritik', 'Kapatma %']}
                                    rows={(nonconformityModule.responsibleLoad || []).slice(0, 16).map((r) => [
                                        <span style={{ fontWeight: 600, fontSize: 11 }}>{trunc(r.name, 32)}</span>,
                                        <span>{fmtNum(r.total)}</span>,
                                        <span style={{ fontWeight: 700, color: r.open > 0 ? C.red : C.green }}>{fmtNum(r.open)}</span>,
                                        <span style={{ fontWeight: 700, color: C.green }}>{fmtNum(r.closed)}</span>,
                                        <span style={{ fontWeight: 700, color: r.critical > 0 ? C.rose : C.gray }}>{fmtNum(r.critical)}</span>,
                                        <span style={{ fontWeight: 700 }}>{fmtNum(r.closeRate)}%</span>,
                                    ])}
                                    fontSize={12}
                                />
                            ) : (
                                <div style={{ color: C.slate, padding: 24, textAlign: 'center' }}>Sorumlu ataması bulunmuyor.</div>
                            )}
                        </div>
                        {nonconformityModule?.recentRecords?.length > 0 && (
                            <div>
                                <SL color={C.navy}>Dönem içi son modül kayıtları</SL>
                                <DT
                                    headers={['Kayıt', 'Parça', 'Durum', 'Önem']}
                                    rows={(nonconformityModule.recentRecords || []).slice(0, 12).map((r) => [
                                        <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700 }}>{trunc(r.kayitNo, 18)}</span>,
                                        <span style={{ fontSize: 11 }}>{trunc(r.parca, 36)}</span>,
                                        <span style={{ fontSize: 11 }}>{trunc(r.durum, 16)}</span>,
                                        <span style={{ fontSize: 11, fontWeight: 700 }}>{trunc(r.onem, 12)}</span>,
                                    ])}
                                    fontSize={12}
                                />
                            </div>
                        )}
                    </VStack>
                </Slide>

                {/* ═══ 10 — MÜŞTERİ MALİYET ═══ */}
                <Slide title="Müşteri Bazlı Kalite Maliyeti (COPQ)" subtitle="Dönem içinde müşteri adına izlenen kalite maliyeti kırılımı" slideNum={slideNo(9)} totalSlides={T}>
                    <VStack gap={16}>
                        <SL color={C.orange}>Müşteri bazında tutar (en fazla 14 satır)</SL>
                        {(costBurden?.byCustomer || []).length > 0 ? (
                            <DT
                                headers={['Müşteri', 'Tutar']}
                                rows={(costBurden.byCustomer || []).slice(0, 14).map((c) => [
                                    <span style={{ fontWeight: 600, fontSize: 11 }}>{trunc(c.name, 48)}</span>,
                                    <span style={{ fontWeight: 800, color: C.orange }}>{fmtCurrency(c.value)}</span>,
                                ])}
                                fontSize={12}
                            />
                        ) : (
                            <div style={{ color: C.slate, padding: 20 }}>Müşteri adına izlenen kalite maliyeti yok.</div>
                        )}
                        <div style={{ fontSize: 12, color: C.gray, lineHeight: 1.55 }}>
                            Şikayet trendi ve aksiyon maliyetleri &quot;Müşteri Şikayetleri&quot; slaytında özetlenir.
                        </div>
                    </VStack>
                </Slide>

                {/* ═══ 10 — SAPMA TALEPLERİ (özet + detay) ═══ */}
                <Slide title="Sapma Talepleri" subtitle="Özet KPI; durum ve birim dağılımı; dönem içi sapma kayıtları" slideNum={slideNo(10)} totalSlides={T}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 18, maxWidth: 560 }}>
                        <KpiCard large label="Toplam sapma" value={fmtNum(kpis.totalDeviations)} color={C.indigo} />
                        <KpiCard large label="Açık sapma" value={fmtNum(kpis.openDeviations)} color={kpis.openDeviations > 0 ? C.red : C.green} />
                    </div>
                    <VStack gap={18}>
                        {deviations?.byStatus?.length > 0 && (
                            <div>
                                <SL color={C.indigo}>Durum dağılımı</SL>
                                <DT headers={['Durum', 'Adet']} rows={deviations.byStatus.map((s, i) => [<span style={{ fontWeight: 600, color: CHART_COLORS[i % CHART_COLORS.length] }}>{s.name}</span>, <span style={{ fontWeight: 700 }}>{fmtNum(s.value)}</span>])} fontSize={12} />
                            </div>
                        )}
                        {deviations?.byUnit?.length > 0 && (
                            <div>
                                <SL color={C.indigo}>Talep eden birimler</SL>
                                <DT headers={['Birim', 'Adet']} rows={deviations.byUnit.slice(0, 20).map((s) => [<span style={{ fontWeight: 600 }}>{trunc(s.name, 40)}</span>, <span style={{ fontWeight: 700 }}>{fmtNum(s.value)}</span>])} fontSize={12} />
                            </div>
                        )}
                        <div>
                            <SL color={C.indigo}>Sapma talepleri — detay</SL>
                            {(deviations?.details || []).length > 0 ? (
                                <DT
                                    headers={['Talep no', 'Parça', 'Kaynak · Birim', 'Durum']}
                                    colWidths={['12%','22%','48%','18%']}
                                    rows={(deviations.details || []).slice(0, 18).map((d) => [
                                        <span style={{ fontSize: 11, fontWeight: 700 }}>{trunc(d.requestNo, 16)}</span>,
                                        <span style={{ fontSize: 11 }}>{trunc(d.partCode, 18)}</span>,
                                        <span style={{ fontSize: 11 }}><span style={{ fontWeight: 600 }}>{trunc(d.source, 14)}</span><span style={{ color: '#64748b' }}> / {trunc(d.unit, 14)}</span></span>,
                                        <span style={{ fontSize: 11, fontWeight: 700 }}>{trunc(d.status, 14)}</span>,
                                    ])}
                                    fontSize={12}
                                />
                            ) : (
                                <div style={{ color: C.slate, padding: 20 }}>Bu dönemde listelenecek sapma detayı yok.</div>
                            )}
                        </div>
                    </VStack>
                </Slide>

                {/* ═══ 11 — ARAÇ KALİTE (KPI + süre trendi + hatalar) ═══ */}
                <Slide title="Üretilen Araç Kalite Performansı" subtitle="Geçiş, DPU; ortalama kontrol ve yeniden işlem (saat); aylık süre trendi; hata kategorileri" slideNum={slideNo(11)} totalSlides={T}>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:16}}>
                        <KpiCard large label="Toplam Araç" value={fmtNum(kpis.totalVehicles)} color={C.purple}/>
                        <KpiCard large label="Geçiş Oranı" value={fmtPct(kpis.vehiclePassRate,1)} color={parseFloat(kpis.vehiclePassRate)>90?C.green:C.orange} sub={`${fmtNum(kpis.passedVehicles)} geçti · ${fmtNum(kpis.failedVehicles)} kaldı`}/>
                        <KpiCard large label="DPU" value={vehicles.dpu?.toFixed(2)||'0.00'} color={vehicles.dpu>1?C.red:C.green} sub="Araç başına hata"/>
                        <KpiCard large label="Toplam Hata" value={fmtNum(kpis.totalVehicleFaults)} color={C.red} sub={`Tekrar eden %${vehicles.recurringFaultRate??0}`}/>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20}}>
                        <KpiCard label="Dönem ort. kontrol süresi" value={qualityActivities?.avgControlHr != null ? `${qualityActivities.avgControlHr} sa` : '—'} color={C.blue} sub={`${fmtNum(qualityActivities?.vehiclesWithControl||0)} araçta timeline · ${qualityActivities?.avgControlTimeFormatted ?? ''}`}/>
                        <KpiCard label="Dönem ort. yeniden işlem" value={qualityActivities?.avgReworkHr != null ? `${qualityActivities.avgReworkHr} sa` : '—'} color={C.orange} sub={`${fmtNum(qualityActivities?.vehiclesWithRework||0)} araçta timeline · ${qualityActivities?.avgReworkTimeFormatted ?? ''}`}/>
                        <KpiCard label="En İyi Ay (DPU)" value={vehicles.bestMonth?.name||'—'} color={C.green} sub={vehicles.bestMonth?`DPU ${vehicles.bestMonth.dpu} · %${vehicles.bestMonth.passRate} geçiş`:''}/>
                        <KpiCard label="En Kötü Ay (DPU)" value={vehicles.worstMonth?.name||'—'} color={C.red} sub={vehicles.worstMonth?`DPU ${vehicles.worstMonth.dpu} · %${vehicles.worstMonth.passRate} geçiş`:''}/>
                    </div>
                    {qualityActivities?.controlReworkMonthly?.length > 0 ? (
                        <div style={{ marginBottom: 20 }}>
                            <SL color={C.blue}>Kontrol ve yeniden işlem süresi — aylık ortalama (saat)</SL>
                            <div style={{ fontSize: 11, color: C.slate, marginBottom: 8 }}>Son 12 ay (dönemden bağımsız): üretilen araç kayıt tarihine göre aylık gruplanır; yalnızca ilgili ayda timeline verisi olan araçlar ortalamaya girer.</div>
                            <ResponsiveContainer width="100%" height={280}>
                                <ComposedChart data={qualityActivities.controlReworkMonthly} margin={{ top: 8, right: 24, left: 8, bottom: 28 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="name" fontSize={11} angle={-22} textAnchor="end" height={44} tick={{ fill: '#374151' }} />
                                    <YAxis fontSize={11} tick={{ fill: '#374151' }} label={{ value: 'Saat', angle: -90, position: 'insideLeft', fill: C.slate, fontSize: 11 }} />
                                    <Tooltip formatter={(v, name) => [`${v} sa`, name]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                                    <Legend wrapperStyle={{ fontSize: 11 }} />
                                    <Line type="monotone" dataKey="avgControlHr" name="Ort. kontrol süresi" stroke={C.blue} strokeWidth={2.5} dot={{ r: 4 }} />
                                    <Line type="monotone" dataKey="avgReworkHr" name="Ort. yeniden işlem süresi" stroke={C.orange} strokeWidth={2.5} dot={{ r: 4 }} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div style={{ marginBottom: 16, fontSize: 12, color: C.slate }}>Son 12 ay için araç timeline üzerinden kontrol / yeniden işlem süresi hesaplanamadı.</div>
                    )}
                    <SL color={C.purple}>Hata kategorileri (üst 10)</SL>
                    {vehicles.faultByCategory?.length>0?(
                        <ResponsiveContainer width="100%" height={Math.min(300,vehicles.faultByCategory.length*28+40)}>
                            <BarChart data={vehicles.faultByCategory.slice(0,10)} layout="vertical" margin={{top:4,right:24,left:8,bottom:4}}><CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/><XAxis type="number" fontSize={10}/><YAxis type="category" dataKey="name" width={180} fontSize={10} interval={0}/><Tooltip contentStyle={{fontSize:11,borderRadius:8}}/><Bar dataKey="count" name="Hata" fill={C.purple} radius={[0,4,4,0]}>{vehicles.faultByCategory.slice(0,10).map((_,i)=><Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]}/>)}</Bar></BarChart>
                        </ResponsiveContainer>
                    ):<div style={{textAlign:'center',color:C.slate,padding:30}}>Hata verisi yok</div>}
                </Slide>

                {/* ═══ 12 — ARAÇ TREND & DETAY ═══ */}
                <Slide title="Üretilen Araç — Üretim ve Hata Trendi" subtitle={`Dönemde kaliteye giren toplam araç: ${fmtNum(kpis.totalVehicles)}; proses bazında kontrol (timeline) veya dönem toplamı referansı`} slideNum={slideNo(12)} totalSlides={T}>
                    <VStack gap={22}>
                        <div>
                            <SL color={C.purple}>Aylık üretim ve hata trendi</SL>
                            {vehicles.monthly?.length>0?(
                                <ResponsiveContainer width="100%" height={260}><ComposedChart data={vehicles.monthly} margin={{top:8,right:40,left:8,bottom:28}}><CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/><XAxis dataKey="name" fontSize={11} angle={-20} textAnchor="end" height={32}/><YAxis yAxisId="left" fontSize={11}/><YAxis yAxisId="right" orientation="right" fontSize={11} domain={[0,'auto']}/><Tooltip contentStyle={{fontSize:11,borderRadius:8}}/><Legend wrapperStyle={{fontSize:10}}/><Bar dataKey="gecti" name="Geçti" fill={C.green} stackId="a" radius={[3,3,0,0]} yAxisId="left"/><Bar dataKey="kaldi" name="Kaldı" fill={C.red} stackId="a" radius={[3,3,0,0]} yAxisId="left"/><Line type="monotone" dataKey="dpu" name="DPU" stroke={C.purple} dot={{r:3}} strokeWidth={2} yAxisId="right"/></ComposedChart></ResponsiveContainer>
                            ):<div style={{textAlign:'center',color:C.slate,padding:30}}>Trend verisi yok</div>}
                        </div>
                        {vehicles.byProcess?.length>0&&<div><SL color={C.navy}>Proses bazlı hata dağılımı</SL><div style={{fontSize:10,color:C.slate,marginBottom:8}}>Kontrole giren (proses): timeline&apos;da control_start ile birim varsa o sayı; yoksa dönem toplam araç. Hatalı araç: en az bir hata kaydı olan araç sayısı.</div><DT headers={['Proses','Kontrole giren','Hata adedi','Hatalı araç']} rows={vehicles.byProcess.slice(0,10).map(p=>[<span style={{fontWeight:600}}>{trunc(p.name,30)}</span>,<span style={{fontWeight:700,color:C.navy}}>{fmtNum(p.vehiclesThroughProcess)}</span>,<span style={{fontWeight:700,color:C.red}}>{fmtNum(p.count)}</span>,<span style={{fontWeight:700}}>{fmtNum(p.vehicleCount)}</span>])} fontSize={11}/></div>}
                        <div>
                            <SL color={C.rose}>En çok hata görülen araçlar</SL>
                            <DT headers={['Şasi no','Müşteri','Tip','Toplam hata','Açık hata']} rows={vehicles.topFaultyVehicles.slice(0,12).map(v=>[<span style={{fontSize:11,fontFamily:'monospace',fontWeight:700}}>{trunc(v.chassisNo,18)}</span>,<span style={{fontSize:11}}>{trunc(v.customerName,28)}</span>,<span style={{fontSize:11}}>{trunc(v.vehicleType,16)}</span>,<span style={{fontWeight:800,color:C.rose}}>{v.totalFaults}</span>,<span style={{fontWeight:700,color:v.activeFaults>0?C.red:C.green}}>{v.activeFaults}</span>])} fontSize={12}/>
                        </div>
                        {vehicles.faultCostByVehicleType?.length>0&&<div><SL color={C.orange}>Araç tipine yansıyan maliyet (kalite giderleri)</SL><DT headers={['Araç tipi','Maliyet']} rows={vehicles.faultCostByVehicleType.slice(0,8).map(item=>[<span style={{fontWeight:600}}>{trunc(item.name,36)}</span>,<span style={{fontWeight:700,color:C.orange}}>{fmtCurrency(item.value)}</span>])} fontSize={12}/></div>}
                        {vehicles.copqByVehicleType?.length>0&&<div><SL color={C.indigo}>COPQ — araç tipi özeti</SL><DT headers={['Tip','Araç sayısı','Hata','DPU','Maliyet','Araç başı']} rows={vehicles.copqByVehicleType.slice(0,8).map(item=>[<span style={{fontWeight:600,fontSize:11}}>{trunc(item.name,20)}</span>,<span style={{fontSize:11}}>{fmtNum(item.vehicleCount)}</span>,<span style={{fontSize:11}}>{fmtNum(item.faultCount)}</span>,<span style={{fontSize:11,fontWeight:700,color:item.dpu>1?C.red:C.green}}>{item.dpu}</span>,<span style={{fontSize:11,fontWeight:700,color:C.orange}}>{fmtCurrency(item.cost)}</span>,<span style={{fontSize:11}}>{fmtCurrency(item.costPerVehicle)}</span>])} fontSize={12}/></div>}
                    </VStack>
                    {hasFinalFaultCostTrend && vehicles.finalFaultCostMonthly?.length > 0 && (
                        <div style={{ marginTop: 20 }}>
                            <SL color={C.orange}>Final hataları maliyeti — aylık trend (son 12 ay)</SL>
                            <ResponsiveContainer width="100%" height={200}>
                                <ComposedChart data={vehicles.finalFaultCostMonthly} margin={{ top: 8, right: 16, left: 16, bottom: 24 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="name" fontSize={11} angle={-20} textAnchor="end" height={28} />
                                    <YAxis fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                                    <Tooltip formatter={(v) => fmtCurrency(v)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                                    <Area type="monotone" dataKey="toplam" fill={`${C.orange}18`} stroke={C.orange} strokeWidth={2} name="Maliyet" />
                                    <Line type="monotone" dataKey="toplam" stroke={C.red} dot={{ r: 3 }} strokeWidth={2} legendType="none" />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </Slide>

                {/* ═══ 13 — GİRDİ KALİTE ═══ */}
                <Slide title="Girdi Kalite Kontrol Performansı" subtitle="Parça ve muayene özeti; tedarikçi bazlı gelen ve ret miktarları" slideNum={slideNo(13)} totalSlides={T}>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:16}}>
                        <KpiCard large label="Toplam Kontrol" value={fmtNum(kpis.totalIncoming)} color={C.teal} sub={`${fmtNum(kpis.totalPartsInspected??0)} parça kontrol`}/>
                        <KpiCard large label="Kabul / Ş.Kabul" value={`${fmtNum(kpis.acceptedIncoming)} / ${fmtNum(kpis.conditionalIncoming)}`} color={C.green}/>
                        <KpiCard large label="Ret" value={fmtNum(kpis.rejectedIncoming)} color={C.red} sub={`${fmtNum(kpis.totalPartsRejected??0)} parça ret`}/>
                        <KpiCard large label="Ret Oranı" value={fmtPct(kpis.incomingRejectionRate,1)} color={kpis.incomingRejectionRate>5?C.red:C.green}/>
                    </div>
                    <VStack gap={24}>
                        <div>
                            <SL color={C.teal}>Sonuç dağılımı (pasta)</SL>
                            {kpis.totalIncoming>0?(<div style={{ maxWidth: 420 }}><ResponsiveContainer width="100%" height={240}><PieChart><Pie data={[{name:'Kabul',value:kpis.acceptedIncoming},{name:'Şartlı Kabul',value:kpis.conditionalIncoming},{name:'Ret',value:kpis.rejectedIncoming},{name:'Beklemede',value:kpis.pendingIncoming}].filter(d=>d.value>0)} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} stroke="#fff" strokeWidth={2} paddingAngle={2}>{['Kabul','Şartlı Kabul','Ret','Beklemede'].map((k,i)=><Cell key={i} fill={RESULT_COLORS[k]||CHART_COLORS[i]}/>)}</Pie><Tooltip contentStyle={{fontSize:12,borderRadius:8}}/></PieChart></ResponsiveContainer></div>):<div style={{color:C.slate,padding:20}}>—</div>}
                        </div>
                        <div>
                            <SL color={C.teal}>Aylık kontrol ve ret</SL>
                            {incoming.monthly?.length>0?(<ResponsiveContainer width="100%" height={260}><BarChart data={incoming.monthly} margin={{top:8,right:8,left:8,bottom:28}}><CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/><XAxis dataKey="name" fontSize={11} angle={-20} textAnchor="end" height={32}/><YAxis fontSize={11}/><Tooltip contentStyle={{fontSize:11,borderRadius:8}}/><Legend wrapperStyle={{fontSize:10}}/><Bar dataKey="kontrol" name="Kontrol" fill={C.teal} radius={[2,2,0,0]}/><Bar dataKey="red" name="Ret" fill={C.red} radius={[2,2,0,0]}/></BarChart></ResponsiveContainer>):<div style={{color:C.slate}}>Trend yok</div>}
                        </div>
                        <div>
                            <SL color={C.red}>En çok ret alan tedarikçi / kayıt</SL>
                            <DT headers={['Tedarikçi / kayıt','Ret sayısı']} rows={(incoming.topRejectedSuppliers||[]).slice(0,14).map(s=>[<span style={{fontWeight:600}}>{trunc(s.name,48)}</span>,<span style={{fontWeight:800,color:C.red}}>{s.count}</span>])} fontSize={12}/>
                        </div>
                        {incoming?.supplierBreakdown?.length > 0 && (
                            <div>
                                <SL color={C.teal}>Tedarikçi bazlı muayene ve parça özeti</SL>
                                <DT
                                    headers={['Tedarikçi', 'Muayene', 'Gelen miktar', 'Ret miktar', 'Kabul', 'Ş.Kabul', 'Ret']}
                                    colWidths={['28%','12%','12%','12%','12%','12%','12%']}
                                    rows={incoming.supplierBreakdown.slice(0, 16).map((r) => [
                                        <span style={{ fontWeight: 600 }}>{trunc(r.name, 36)}</span>,
                                        <span>{fmtNum(r.inspections)}</span>,
                                        <span>{fmtNum(r.qtyReceived)}</span>,
                                        <span style={{ fontWeight: 700, color: C.red }}>{fmtNum(r.qtyRejected)}</span>,
                                        <span>{fmtNum(r.acceptedCount)}</span>,
                                        <span>{fmtNum(r.conditionalCount)}</span>,
                                        <span style={{ fontWeight: 700 }}>{fmtNum(r.rejectedCount)}</span>,
                                    ])}
                                    fontSize={11}
                                />
                            </div>
                        )}
                    </VStack>
                </Slide>

                {/* ═══ 14 — TEDARİKÇİ ═══ */}
                <Slide title="Tedarikçi Performans Değerlendirmesi" subtitle="Sınıf dağılımı, PPM, NC; pasif / kısıtlı tedarikçiler ve dönem denetimleri" slideNum={slideNo(14)} totalSlides={T}>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:16}}>
                        <KpiCard large label="Onaylı Tedarikçi" value={fmtNum(suppliers.approvedCount??0)} color={C.blue} sub={`${fmtNum(suppliers.alternativeCount??0)} alternatif`}/>
                        <KpiCard large label="A+B Sınıfı" value={fmtNum(suppliers.gradeABCount??0)} color={C.green} sub={`${fmtNum(suppliers.evaluatedCount??0)} değerlendirilen`}/>
                        <KpiCard large label="Genel PPM" value={fmtNum(suppliers.overallPPM??0)} color={C.red} sub={`${fmtNum(suppliers.totalDefectiveParts)}/${fmtNum(suppliers.totalInspectedParts)}`}/>
                        <KpiCard large label="Tamamlanan Denetim" value={fmtNum(qualityActivities?.supplierAuditsCompleted??0)} color={C.purple}/>
                    </div>
                    <VStack gap={22}>
                        <div>
                            <SL color={C.orange}>En çok tedarikçi uygunsuzluğu (NC) olan firmalar</SL>
                            <DT headers={['Tedarikçi','Toplam NC','Açık']} rows={(suppliers.topSuppliersNC||[]).slice(0,12).map(s=>[<span style={{fontWeight:600}}>{trunc(s.name,40)}</span>,<span style={{fontWeight:700,color:C.orange}}>{s.count}</span>,<span style={{fontWeight:700,color:C.red}}>{s.open}</span>])} fontSize={12}/>
                        </div>
                        <div>
                            <SL color={C.red}>Tedarikçi bazlı PPM</SL>
                            <DT headers={['Tedarikçi','PPM','Kontrol adedi','Hatalı adet']} rows={(suppliers.ppmBySupplier||[]).slice(0,12).map(item=>[<span style={{fontWeight:600}}>{trunc(item.name,32)}</span>,<span style={{fontWeight:700,color:item.ppm>50000?C.red:item.ppm>10000?C.orange:C.green}}>{fmtNum(item.ppm)}</span>,<span>{fmtNum(item.inspected)}</span>,<span style={{fontWeight:700}}>{fmtNum(item.defective)}</span>])} fontSize={12}/>
                        </div>
                        {qualityActivities?.supplierAuditDetails?.length>0&&<div><SL color={C.purple}>Dönem içi tamamlanan tedarikçi denetimleri</SL><DT headers={['Tedarikçi','Tarih','Puan']} rows={qualityActivities.supplierAuditDetails.slice(0,12).map(d=>[<span style={{fontWeight:600}}>{trunc(d.supplierName,36)}</span>,<span style={{fontSize:11}}>{d.date?format(parseISO(d.date),'dd.MM.yyyy',{locale:tr}):'—'}</span>,<span style={{fontWeight:700,color:C.purple}}>{d.score!=null?d.score:'—'}</span>])} fontSize={12}/></div>}
                        {suppliers?.restrictedList?.length > 0 && (
                            <div>
                                <SL color={C.red}>Pasif / kısıtlı tedarikçi durumu (Kısıtlı, askıya alınmış, değerlendirilmemiş vb.)</SL>
                                <DT
                                    headers={['Tedarikçi', 'Durum', 'Şehir']}
                                    rows={suppliers.restrictedList.slice(0, 18).map((s) => [
                                        <span style={{ fontWeight: 600 }}>{trunc(s.name, 40)}</span>,
                                        <span style={{ fontWeight: 700, color: C.red }}>{trunc(s.status, 20)}</span>,
                                        <span style={{ fontSize: 11 }}>{trunc(s.city, 20)}</span>,
                                    ])}
                                    fontSize={11}
                                />
                            </div>
                        )}
                    </VStack>
                    {suppliers.gradeDistribution?.length>0&&<div style={{marginTop:18}}><SL color={C.blue}>Tedarikçi sınıf dağılımı</SL>
                        <ResponsiveContainer width="100%" height={120}><BarChart data={suppliers.gradeDistribution} layout="vertical" margin={{top:4,right:16,left:32,bottom:4}}><CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/><XAxis type="number" fontSize={10}/><YAxis type="category" dataKey="name" width={24} fontSize={11} interval={0}/><Tooltip contentStyle={{fontSize:10,borderRadius:8}}/><Bar dataKey="value" name="Adet" radius={[0,4,4,0]}>{suppliers.gradeDistribution.map((e,i)=><Cell key={i} fill={{A:'#15803d',B:'#b91c1c',C:'#b45309',D:'#dc2626','N/A':'#64748b'}[e.name]||CHART_COLORS[i]}/>)}</Bar></BarChart></ResponsiveContainer>
                    </div>}
                </Slide>

                {hasComplaintContent && (
                    <Slide title="Müşteri Şikayetleri ve Aksiyonlar" subtitle="Aylık şikayet trendi; durum ve analiz tipi dağılımı; aksiyon maliyetleri" slideNum={slideNo(15)} totalSlides={T}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                            <KpiCard large label="Toplam Şikayet" value={fmtNum(kpis.totalComplaints)} color={C.rose} />
                            <KpiCard large label="Açık" value={fmtNum(kpis.openComplaints)} color={C.red} sub={`${kpis.slaOverdue} SLA gecikmiş`} />
                            <KpiCard large label="Aksiyon Tamamlanan" value={`${fmtNum(governance?.complaintActions?.completed)}/${fmtNum(governance?.complaintActions?.total)}`} color={C.blue} />
                            <KpiCard large label="Geciken Aksiyon" value={fmtNum(governance?.complaintActions?.overdue)} color={(governance?.complaintActions?.overdue || 0) > 0 ? C.red : C.green} />
                        </div>
                        <VStack gap={22}>
                            <div>
                                {complaints.monthly?.length > 0 ? (
                                    <>
                                        <SL color={C.rose}>Aylık şikayet trendi</SL>
                                        <ResponsiveContainer width="100%" height={280}>
                                            <ComposedChart data={complaints.monthly} margin={{ top: 8, right: 16, left: 8, bottom: 32 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                                <XAxis dataKey="name" fontSize={11} angle={-20} textAnchor="end" height={34} tick={{ fill: '#374151' }} />
                                                <YAxis fontSize={11} tick={{ fill: '#374151' }} />
                                                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                                                <Bar dataKey="sayi" name="Şikayet" fill={C.rose} radius={[4, 4, 0, 0]} opacity={0.75} />
                                                <Line type="monotone" dataKey="sayi" stroke={C.red} dot={{ r: 4, fill: C.red }} strokeWidth={2.5} legendType="none" />
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                    </>
                                ) : (
                                    <div style={{ textAlign: 'center', color: C.slate, padding: 40 }}>Şikayet verisi yok</div>
                                )}
                            </div>
                            {complaints.byStatus?.length > 0 && (
                                <div>
                                    <SL color={C.rose}>Durum dağılımı</SL>
                                    <DT headers={['Durum', 'Adet']} rows={complaints.byStatus.map((s, i) => [<span style={{ fontWeight: 600, color: CHART_COLORS[i % CHART_COLORS.length] }}>{s.name}</span>, <span style={{ fontWeight: 700 }}>{fmtNum(s.value)}</span>])} fontSize={12} />
                                </div>
                            )}
                            {complaints.analysesByType?.length > 0 && (
                                <div>
                                    <SL color={C.blue}>Analiz tipi dağılımı</SL>
                                    <DT headers={['Analiz tipi', 'Adet']} rows={complaints.analysesByType.map((item) => [trunc(item.name, 40), <span style={{ fontWeight: 700, color: C.blue }}>{fmtNum(item.value)}</span>])} fontSize={12} />
                                </div>
                            )}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 560 }}>
                                <KpiCard label="Tahmini aksiyon maliyeti" value={fmtCurrency(governance?.complaintActions?.estimatedCost)} color={C.orange} />
                                <KpiCard label="Gerçekleşen maliyet" value={fmtCurrency(governance?.complaintActions?.actualCost)} color={C.rose} />
                            </div>
                        </VStack>
                    </Slide>
                )}

                {hasKaizenContent && (
                    <Slide title="Kaizen İyileştirmeleri" subtitle="Durum ve departman kırılımı; yıllık kazanç özeti" slideNum={slideNo(16)} totalSlides={T}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
                            <KpiCard large label="Toplam Kaizen" value={fmtNum(kpis.totalKaizen)} color={C.teal} />
                            <KpiCard large label="Tamamlanan" value={fmtNum(kpis.completedKaizen)} color={C.green} />
                            <KpiCard large label="Devam Eden" value={fmtNum(kpis.activeKaizen)} color={C.orange} />
                            <KpiCard large label="Yıllık Kazanç" value={fmtCurrency(kpis.kaizenSavings)} color={C.lime} />
                        </div>
                        <VStack gap={20}>
                            {kaizen?.byDept?.length > 0 && (
                                <div>
                                    <SL color={C.teal}>Departman bazlı Kaizen</SL>
                                    <DT headers={['Departman', 'Tamamlanan', 'Devam eden']} rows={kaizen.byDept.slice(0, 12).map((d) => [<span style={{ fontWeight: 600 }}>{trunc(d.name, 36)}</span>, <span style={{ fontWeight: 700, color: C.green }}>{d.tamamlanan}</span>, <span style={{ fontWeight: 700, color: C.orange }}>{d.devamEden}</span>])} fontSize={12} />
                                </div>
                            )}
                            {kaizen?.byStatus?.length > 0 && (
                                <div>
                                    <SL color={C.teal}>Kaizen durum dağılımı</SL>
                                    <DT headers={['Durum', 'Adet']} rows={kaizen.byStatus.map((s, i) => [<span style={{ fontWeight: 600, color: CHART_COLORS[i % CHART_COLORS.length] }}>{s.name}</span>, <span style={{ fontWeight: 700 }}>{fmtNum(s.value)}</span>])} fontSize={12} />
                                </div>
                            )}
                        </VStack>
                    </Slide>
                )}

                {/* ═══ 17 — KARANTİNA & STOK RİSK ═══ */}
                <Slide title="Karantina ve Stok Risk Kontrolü" subtitle="Aktif karantina satırları; dönem içi stok risk kayıtları ve durum özeti" slideNum={slideNo(17)} totalSlides={T}>
                    <VStack gap={24}>
                        <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12,maxWidth:560}}>
                            <KpiCard large label="Karantinadaki ürün (kayıt)" value={fmtNum(kpis.inQuarantine)} color={kpis.inQuarantine>0?C.red:C.green}/>
                            <KpiCard large label="En uzun bekleme" value={activeQuarantine?.length>0?`${Math.max(...activeQuarantine.map(q=>q.quarantine_duration_days||0))} gün`:'—'} color={C.orange}/>
                        </div>
                        <div>
                            <SL color={C.purple}>Aktif karantina kayıtları</SL>
                            <DT headers={['Parça / kod','Miktar','Süre','Neden']} rows={(activeQuarantine||[]).slice(0,14).map(q=>[<span style={{fontWeight:600}}>{trunc(q.part_code||q.part_name,36)}</span>,<span style={{fontWeight:700,color:C.purple}}>{q.quantity!=null?fmtNum(q.quantity):'—'}</span>,<span style={{fontWeight:700,color:(q.quarantine_duration_days||0)>=15?C.red:C.orange}}>{q.quarantine_duration_days!=null?`${q.quarantine_duration_days} gün`:'—'}</span>,<span style={{fontSize:11,whiteSpace:'pre-wrap'}}>{String(q.report_reason || '—')}</span>])} fontSize={12}/>
                        </div>
                        <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12,maxWidth:560}}>
                            <KpiCard large label="Stok risk (dönem kayıt)" value={fmtNum(stockRisk?.totalInPeriod??0)} color={C.yellow}/>
                            <KpiCard large label="Açık stok risk" value={fmtNum(stockRisk?.openCount??0)} color={(stockRisk?.openCount||0)>0?C.red:C.green}/>
                        </div>
                        {stockRisk?.byStatus?.length>0&&<div><SL color={C.yellow}>Stok risk durumu</SL><DT headers={['Durum','Adet']} rows={stockRisk.byStatus.map((s,i)=>[<span style={{fontWeight:600,color:CHART_COLORS[i%CHART_COLORS.length]}}>{s.name}</span>,<span style={{fontWeight:700}}>{fmtNum(s.value)}</span>])} fontSize={12}/></div>}
                        {stockRisk?.recent?.length>0&&<div><SL color={C.yellow}>Son stok risk kayıtları</SL><DT headers={['Parça','Tedarikçi','Durum','Karar']} rows={stockRisk.recent.slice(0,12).map(s=>[<span style={{fontSize:11}}>{trunc(s.partCode,24)}</span>,<span style={{fontSize:11}}>{trunc(s.supplier,24)}</span>,<span style={{fontSize:11,fontWeight:600}}>{trunc(s.status,16)}</span>,<span style={{fontSize:11}}>{trunc(s.decision,16)}</span>])} fontSize={12}/></div>}
                    </VStack>
                </Slide>

                {/* ═══ 18 — FİKSTÜR TAKİBİ ═══ */}
                <Slide title="Fikstür Takibi" subtitle="Doğrulama özeti, kritik uyarılar ve departman dağılımı" slideNum={slideNo(18)} totalSlides={T}>
                    <VStack gap={22}>
                        <SL color={C.blue}>Fikstür takip özeti</SL>
                        {fixtureTracking ? <>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 12 }}>
                                <KpiCard label="Toplam" value={fmtNum(fixtureTracking.total)} color={C.blue}/>
                                <KpiCard label="Aktif" value={fmtNum(fixtureTracking.active)} color={C.green}/>
                                <KpiCard label="Kritik" value={fmtNum(fixtureTracking.critical)} color={C.red}/>
                                <KpiCard label="Uygunsuz" value={fmtNum(fixtureTracking.nonconformant)} color={fixtureTracking.nonconformant > 0 ? C.red : C.green}/>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
                                <KpiCard label="Gecikmiş doğrulama" value={fmtNum(fixtureTracking.overdue)} color={fixtureTracking.overdue > 0 ? C.red : C.green}/>
                                <KpiCard label="30 gün içinde" value={fmtNum(fixtureTracking.dueSoon)} color={fixtureTracking.dueSoon > 0 ? C.orange : C.green}/>
                                <KpiCard label="Dönem doğrulama" value={fmtNum(fixtureTracking.verificationsInPeriod)} color={C.teal}/>
                                <KpiCard label="Geçme oranı" value={fixtureTracking.verificationPassRate != null ? `%${fixtureTracking.verificationPassRate}` : '—'} color={C.green}/>
                            </div>
                            {fixtureTracking.urgentItems?.length > 0 && <><SL color={C.red}>Kritik fikstür uyarıları</SL><DT headers={['No', 'Parça', 'Durum', 'Uyarı']} rows={fixtureTracking.urgentItems.slice(0, 12).map(item => [<span style={{ fontSize: 11, fontWeight: 700 }}>{item.fixtureNo}</span>, <span style={{ fontSize: 11 }}>{trunc(item.partCode, 24)}</span>, <span style={{ fontSize: 11, fontWeight: 600 }}>{trunc(item.status, 14)}</span>, <span style={{ fontSize: 11, color: C.red }}>{trunc(item.alert, 48)}</span>])} fontSize={12}/></>}
                            {fixtureTracking.byDepartment?.length > 0 && <div style={{ marginTop: 12 }}><SL color={C.blue}>Departman dağılımı</SL><DT headers={['Departman', 'Adet']} rows={fixtureTracking.byDepartment.slice(0, 12).map(d => [<span style={{ fontWeight: 600 }}>{trunc(d.name, 36)}</span>, <span style={{ fontWeight: 700, color: C.blue }}>{fmtNum(d.value)}</span>])} fontSize={12}/></div>}
                        </> : <div style={{ color: C.slate, padding: 20 }}>Fikstür verisi yok</div>}
                    </VStack>
                </Slide>

                {/* ═══ 19 — PROSES KALİTE (SÜREÇ / SIZDIRMA / BALANS) ═══ */}
                <Slide title="Proses Kalite: Kontrol Planı, Sızdırmazlık, Dinamik Balans" subtitle="process-control, leak-test ve dynamic-balance modüllerinden dönem özeti (tam veri çekimi)" slideNum={slideNo(19)} totalSlides={T}>
                    <VStack gap={20}>
                        {executiveProcessQuality ? (
                            <>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                                    <KpiCard large label="Proses muayene (dönem)" value={fmtNum(executiveProcessQuality.processInspections?.total ?? 0)} color={C.navy} />
                                    <KpiCard large label="Sızdırmazlık başarı oranı" value={executiveProcessQuality.leakTest?.successRatePct != null ? `%${executiveProcessQuality.leakTest.successRatePct}` : '—'} color={C.teal} sub={`${fmtNum(executiveProcessQuality.leakTest?.total ?? 0)} test · Kabul ${fmtNum(executiveProcessQuality.leakTest?.acceptedCount ?? 0)} · Kaçak ${fmtNum(executiveProcessQuality.leakTest?.failCount ?? 0)}`} />
                                    <KpiCard large label="Dinamik balans" value={fmtNum(executiveProcessQuality.dynamicBalance?.total ?? 0)} color={C.indigo} sub={`Uygun ${fmtNum(executiveProcessQuality.dynamicBalance?.passCount ?? 0)} · Uygun değil ${fmtNum(executiveProcessQuality.dynamicBalance?.failCount ?? 0)}`} />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, maxWidth: 720 }}>
                                    <KpiCard label="Aktif proses kontrol planı" value={fmtNum(executiveProcessQuality.processControlPlans?.activeCount ?? 0)} color={C.blue} />
                                    <KpiCard label="Proses İNKR (dönem)" value={fmtNum(executiveProcessQuality.processInkr?.total ?? 0)} color={C.purple} />
                                </div>
                                {hasProcInspRows && (
                                    <div>
                                        <SL color={C.navy}>Proses muayenesi — son kayıtlar</SL>
                                        <DT headers={['Kayıt', 'Tarih', 'Parça', 'Karar']} rows={(executiveProcessQuality.processInspections?.recent || []).map((r) => [
                                            <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700 }}>{trunc(r.recordNo, 14)}</span>,
                                            <span style={{ fontSize: 11 }}>{r.date ? format(parseISO(r.date), 'dd.MM.yyyy', { locale: tr }) : '—'}</span>,
                                            <span style={{ fontSize: 11 }}>{trunc(r.part, 28)}</span>,
                                            <span style={{ fontSize: 11, fontWeight: 600 }}>{trunc(r.decision, 14)}</span>,
                                        ])} fontSize={11} emptyMsg="Bu dönemde proses muayenesi yok" />
                                    </div>
                                )}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 18 }}>
                                    <div>
                                        {hasLeakByResult && (
                                            <>
                                                <SL color={C.teal}>Sızdırmazlık — sonuç dağılımı</SL>
                                                <DT headers={['Sonuç', 'Adet']} rows={(executiveProcessQuality.leakTest.byResult || []).map((x) => [<span style={{ fontWeight: 600 }}>{trunc(x.name, 24)}</span>, <span style={{ fontWeight: 700 }}>{fmtNum(x.value)}</span>])} fontSize={11} />
                                            </>
                                        )}
                                        {hasLeakRecent && (
                                            <>
                                                <SL color={C.teal}><span style={{ marginTop: hasLeakByResult ? 10 : 0, display: 'block' }}>Sızdırmazlık — son testler</span></SL>
                                                <DT headers={['Kayıt', 'Tarih', 'Sonuç', 'Parça']} rows={(executiveProcessQuality.leakTest?.recent || []).map((r) => [
                                                    <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{trunc(r.recordNo, 12)}</span>,
                                                    <span style={{ fontSize: 11 }}>{r.date ? format(parseISO(r.date), 'dd.MM.yyyy', { locale: tr }) : '—'}</span>,
                                                    <span style={{ fontSize: 11, fontWeight: 700 }}>{trunc(r.result, 12)}</span>,
                                                    <span style={{ fontSize: 11 }}>{trunc(r.part, 20)}</span>,
                                                ])} fontSize={11} emptyMsg="Kayıt yok" />
                                            </>
                                        )}
                                        {!hasLeakByResult && !hasLeakRecent && !hasLeakRows && (
                                            <div style={{ color: C.slate, fontSize: 12, padding: 12, textAlign: 'center' }}>Bu dönemde sızdırmazlık testi yok</div>
                                        )}
                                    </div>
                                    <div>
                                        {hasBalRows ? (
                                            <>
                                                <SL color={C.indigo}>Dinamik balans — özet</SL>
                                                <DT headers={['Seri no', 'Tarih', 'Ürün', 'Uygun']} rows={(executiveProcessQuality.dynamicBalance?.recent || []).map((r) => [
                                                    <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{trunc(r.serial, 16)}</span>,
                                                    <span style={{ fontSize: 11 }}>{r.date ? format(parseISO(r.date), 'dd.MM.yyyy', { locale: tr }) : '—'}</span>,
                                                    <span style={{ fontSize: 11 }}>{trunc(r.product, 22)}</span>,
                                                    <span style={{ fontWeight: 800, color: r.pass ? C.green : C.red }}>{r.pass ? 'Evet' : 'Hayır'}</span>,
                                                ])} fontSize={11} emptyMsg="Kayıt yok" />
                                            </>
                                        ) : (
                                            <div style={{ color: C.slate, fontSize: 12, padding: 12, textAlign: 'center' }}>Bu dönemde dinamik balans kaydı yok</div>
                                        )}
                                    </div>
                                </div>
                                {(executiveProcessQuality.processInkr?.recent || []).length > 0 && (
                                    <div>
                                        <SL color={C.purple}>Proses İNKR — özet</SL>
                                        <DT headers={['Kayıt', 'Parça', 'Durum']} rows={(executiveProcessQuality.processInkr.recent || []).map((r) => [
                                            <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{trunc(r.recordNo, 14)}</span>,
                                            <span style={{ fontSize: 11 }}>{trunc(r.part, 28)}</span>,
                                            <span style={{ fontSize: 11 }}>{trunc(r.status, 16)}</span>,
                                        ])} fontSize={11} />
                                    </div>
                                )}
                            </>
                        ) : (
                            <div style={{ color: C.slate, padding: 24, textAlign: 'center' }}>Proses kalite modül verileri yüklenemedi.</div>
                        )}
                    </VStack>
                </Slide>

                {/* ═══ 20 — İNKR ═══ */}
                <Slide title="INKR (Girdi Kalite)" subtitle="Dönem İNKR raporları ve durum özeti — fikstür takibinden bağımsız süreç" slideNum={slideNo(20)} totalSlides={T}>
                    <VStack gap={22}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, maxWidth: 480, marginBottom: 12 }}>
                            <KpiCard large label="İNKR rapor (dönem)" value={fmtNum(inkrIncoming?.totalInPeriod ?? 0)} color={C.lime}/>
                            <KpiCard large label="Onay bekleyen" value={fmtNum(inkrIncoming?.pendingCount ?? 0)} color={(inkrIncoming?.pendingCount || 0) > 0 ? C.orange : C.green}/>
                        </div>
                        {inkrIncoming?.byStatus?.length > 0 && <><SL color={C.lime}>İNKR durum</SL><DT headers={['Durum', 'Adet']} rows={inkrIncoming.byStatus.map((s, i) => [<span style={{ fontWeight: 600, color: CHART_COLORS[i % CHART_COLORS.length] }}>{s.name}</span>, <span style={{ fontWeight: 700 }}>{fmtNum(s.value)}</span>])} fontSize={12}/></>}
                        {inkrIncoming?.recent?.length > 0 && <div style={{ marginTop: 14 }}><SL color={C.lime}>Son İNKR kayıtları</SL><DT headers={['Parça', 'Tedarikçi', 'Durum']} rows={inkrIncoming.recent.slice(0, 14).map(r => [<span style={{ fontSize: 11 }}>{trunc(r.partCode, 24)}</span>, <span style={{ fontSize: 11 }}>{trunc(r.supplier, 24)}</span>, <span style={{ fontSize: 11, fontWeight: 600 }}>{trunc(r.status, 18)}</span>])} fontSize={12}/></div>}
                    </VStack>
                </Slide>

                {/* ═══ 21 — İÇ TETKİK & EĞİTİM ═══ */}
                <Slide title="İç Tetkik ve Eğitim Faaliyetleri" subtitle="Tetkik ve bulgu özeti; girdi ve proses kontrol planı sayıları; dönem eğitimleri" slideNum={slideNo(21)} totalSlides={T}>
                    <VStack gap={22}>
                        <div>
                            <SL color={C.yellow}>İç tetkik</SL>
                            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>
                                <KpiCard label="Toplam tetkik" value={fmtNum(kpis.totalAudits)} color={C.yellow}/>
                                <KpiCard label="Tamamlanan" value={fmtNum(kpis.completedAudits)} color={C.green}/>
                                <KpiCard label="Açık bulgu" value={fmtNum(kpis.openAuditFindings)} color={kpis.openAuditFindings>0?C.red:C.green}/>
                                <KpiCard label="Kontrol planı (G/P)" value={fmtNum(qualityActivities?.totalControlPlans??0)} color={C.navy} sub={`G:${fmtNum(qualityActivities?.totalIncomingControlPlans??0)} · P:${fmtNum(qualityActivities?.totalProcessControlPlans??0)}`}/>
                            </div>
                            {qualityActivities?.auditFindingsByDept?.length>0&&<><SL color={C.yellow}>Bulgu adedi — birim</SL><DT headers={['Birim','Bulgu']} rows={qualityActivities.auditFindingsByDept.slice(0,12).map(d=>[<span style={{fontWeight:600}}>{trunc(d.name,40)}</span>,<span style={{fontWeight:700,color:C.red}}>{d.value}</span>])} fontSize={12}/></>}
                        </div>
                        <div>
                            <SL color={C.teal}>Eğitimler</SL>
                            <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12,maxWidth:520,marginBottom:12}}>
                                <KpiCard large label="Toplam eğitim (dönem)" value={fmtNum(qualityActivities?.totalTrainings??0)} color={C.teal}/>
                                <KpiCard large label="Tamamlanan" value={fmtNum(qualityActivities?.completedTrainings??0)} color={C.green} sub={`${fmtNum(qualityActivities?.plannedTrainings??0)} planlanan`}/>
                            </div>
                            {qualityActivities?.trainingDetails?.length>0&&<DT headers={['Eğitim','Eğitmen','Katılımcı','Süre','Durum']} rows={qualityActivities.trainingDetails.slice(0,12).map(d=>[<span style={{fontSize:11}}>{trunc(d.title,28)}</span>,<span style={{fontSize:11}}>{trunc(d.instructor,20)}</span>,<span style={{fontWeight:700,color:C.teal}}>{d.participantsCount??0}</span>,<span style={{fontSize:11}}>{d.durationHours!=null?`${d.durationHours} sa`:'—'}</span>,<span style={{fontSize:11,color:d.status==='Tamamlandı'?C.green:C.orange}}>{trunc(d.status,14)}</span>])} fontSize={12}/>}
                        </div>
                    </VStack>
                </Slide>

                {/* ═══ 22 — KPI ALARMLARI & YÖNETİŞİM ═══ */}
                <Slide title="KPI Alarmları ve Yönetim" subtitle="Özet uyarılar; KPI hedef takibi; doküman ve kalibrasyon" slideNum={slideNo(22)} totalSlides={T}>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10,marginBottom:18}}>
                        {(governance?.summary||[]).map((item)=>(
                            <div key={item.label} style={{background:item.severity==='bad'?'#fef2f2':item.severity==='warning'?'#fff7ed':'#f0fdf4',borderRadius:10,padding:'12px 16px',borderLeft:`5px solid ${item.severity==='bad'?C.red:item.severity==='warning'?C.orange:C.green}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                                <div style={{fontSize:12,color:C.gray,fontWeight:500}}>{item.label}</div>
                                <div style={{fontSize:24,fontWeight:800,color:item.severity==='bad'?C.red:item.severity==='warning'?C.orange:C.green}}>{fmtNum(item.value)}</div>
                            </div>
                        ))}
                    </div>
                    <VStack gap={22}>
                        <div>
                            <SL color={C.blue}>KPI hedef takibi</SL>
                            <DT headers={['KPI','Gerçekleşen','Hedef','Durum']} rows={(governance?.kpiWatch||[]).map(item=>[<span style={{fontWeight:600}}>{trunc(item.name,36)}</span>,<span>{fmtNum(item.current)}{item.unit}</span>,<span>{fmtNum(item.target)}{item.unit}</span>,<span style={{fontWeight:700,color:item.status==='Alarm'?C.red:item.status==='Risk'?C.orange:C.green}}>{item.status}</span>])} fontSize={12}/>
                        </div>
                        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
                            <KpiCard label="Süresi yaklaşan doküman" value={fmtNum(kpis.expiringDocCount)} color={kpis.expiringDocCount>0?C.orange:C.green}/>
                            <KpiCard label="Süresi geçmiş doküman" value={fmtNum(kpis.expiredDocCount)} color={kpis.expiredDocCount>0?C.red:C.green}/>
                            <KpiCard label="Geciken kalibrasyon" value={fmtNum(kpis.overdueCalCount)} color={kpis.overdueCalCount>0?C.red:C.green}/>
                        </div>
                        {overdueCalibrations?.length>0&&<div><SL color={C.red}>Geciken kalibrasyonlar</SL><DT headers={['Cihaz','Gecikme']} rows={overdueCalibrations.slice(0,8).map(c=>[<span style={{fontWeight:600,fontSize:11}}>{trunc(c.cihaz,40)}</span>,<span style={{fontWeight:800,color:C.red,fontSize:11}}>{fmtNum(c.gecikme)} gün</span>])} fontSize={12}/></div>}
                    </VStack>
                </Slide>

                {/* ═══ 23 — KAPANIŞ ═══ */}
                <div className="ep-slide" style={{width:'100%',minHeight:'100vh',background:`linear-gradient(135deg,${C.navy} 0%,#991b1b 40%,#dc2626 100%)`,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:'white',textAlign:'center',padding:'60px 80px',pageBreakAfter:'avoid'}}>
                    <div style={{fontSize:13,fontWeight:500,opacity:.5,letterSpacing:5,textTransform:'uppercase',marginBottom:24}}>KADEME A.Ş.</div>
                    <div style={{fontSize:40,fontWeight:900,marginBottom:36}}>Dönem Performans Özeti</div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:24,background:'rgba(255,255,255,.1)',borderRadius:16,padding:'24px 44px',marginBottom:24,width:'100%',maxWidth:880}}>
                        {[{l:'Açık DF/8D',v:kpis.openDF+kpis.open8D,c:kpis.openDF+kpis.open8D>0?'#fca5a5':'#86efac'},{l:'COPQ',v:fmtCurrency(kpis.totalCost),c:'#fdba74'},{l:'Araç Geçiş',v:fmtPct(kpis.vehiclePassRate,1),c:parseFloat(kpis.vehiclePassRate)>90?'#86efac':'#fdba74'},{l:'Girdi Ret',v:fmtPct(kpis.incomingRejectionRate,1),c:kpis.incomingRejectionRate>5?'#fca5a5':'#86efac'}].map((x,i)=><div key={i}><div style={{fontSize:10,opacity:.6,textTransform:'uppercase',letterSpacing:1.5}}>{x.l}</div><div style={{fontSize:26,fontWeight:800,marginTop:6,color:x.c}}>{x.v}</div></div>)}
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:16,background:'rgba(255,255,255,.06)',borderRadius:12,padding:'16px 36px',marginBottom:36,width:'100%',maxWidth:880}}>
                        {[{l:'Şikayet',v:`${kpis.openComplaints} açık`},{l:'Karantina',v:kpis.inQuarantine},{l:'Kaizen',v:`${kpis.completedKaizen}/${kpis.totalKaizen}`},{l:'PPM',v:fmtNum(kpis.supplierOverallPPM)},{l:'Fikstür',v:`${fixtureTracking?.active||0} aktif`},{l:'Sapma',v:`${kpis.openDeviations}/${kpis.totalDeviations} açık`}].map((x,i)=><div key={i}><div style={{fontSize:9,opacity:.5,textTransform:'uppercase',letterSpacing:1}}>{x.l}</div><div style={{fontSize:16,fontWeight:700,marginTop:4,opacity:.9}}>{x.v}</div></div>)}
                    </div>
                    <div style={{fontSize:9,opacity:.45,marginTop:8}}>{T} / {T}</div>
                    <div style={{fontSize:16,opacity:.8,fontWeight:500}}>Dönem: {periodLabel} · {format(new Date(),'dd MMMM yyyy',{locale:tr})}</div>
                    <div style={{fontSize:11,opacity:.4,marginTop:10}}>Otomatik oluşturulmuştur — Kalite Yönetim Sistemi</div>
                </div>

            </div>
        </>
    );
};

export default ExecutivePresentation;
