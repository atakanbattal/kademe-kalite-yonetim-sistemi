import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Loader2 } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, CartesianGrid,
    ComposedChart, Area, Line,
} from 'recharts';
import { format } from 'date-fns';
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
    <div style={{
        background: bg,
        borderLeft: `5px solid ${border || color}`,
        borderRadius: 5,
        padding: '12px 14px',
        minHeight: 88,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    }}>
        <div style={{ fontSize: 11, color: C.gray, fontWeight: 500, lineHeight: 1.35 }}>{label}</div>
        <div style={{ fontSize: 30, fontWeight: 800, color, lineHeight: 1.05, marginTop: 4 }}>{value}</div>
        {sub && <div style={{ fontSize: 10, color: C.slate, marginTop: 3 }}>{sub}</div>}
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
    <div style={{ border: `1.5px solid ${color}40`, borderRadius: 5, overflow: 'hidden', background: 'white', ...style }}>
        <SectionTitle color={color}>{title}</SectionTitle>
        <div style={{ padding: '10px 12px' }}>{children}</div>
    </div>
);

const StatRow = ({ label, value, color, bold }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
        <span style={{ fontSize: 10, color: C.gray }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: bold ? 800 : 700, color: color || C.navy }}>{value}</span>
    </div>
);

const MiniTable = ({ headers, rows, emptyMsg = 'Veri yok', fontSize = 10 }) => (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize }}>
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

const PageBreak = () => <div style={{ pageBreakBefore: 'always', breakBefore: 'page', height: 0 }} />;

const Row = ({ cols, gap = 10, mb = 14, children }) => (
    <div style={{ display: 'grid', gridTemplateColumns: cols || `repeat(${React.Children.count(children)}, 1fr)`, gap, marginBottom: mb }}>
        {children}
    </div>
);

// ── Ana Bileşen ───────────────────────────────────────────────────────────────
const A3QualityBoardReport = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { session } = useAuth();
    const period = searchParams.get('period') || 'last3months';
    const { data, loading, error, periodLabel } = useA3ReportData(period);

    useEffect(() => { if (!session) navigate('/login'); }, [session, navigate]);
    useEffect(() => {
        if (!loading && !error && data) setTimeout(() => window.print(), 2500);
    }, [loading, error, data]);

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
            incoming, suppliers, vehicles, complaints, kaizen, deviations,
            qualityWall, openNC, openNCTotal, openNCGeciken, activeQuarantine, overdueCalibrations, personnelByDept } = data;

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
                <div style={{
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

                {/* ══════════════════════════════ SAYFA 2 ══════════════════════════════════ */}
                <PageBreak/>

                {/* Sayfa 2 başlığı */}
                <div style={{
                    background:`linear-gradient(135deg,${C.navy} 0%,#2d5a9b 55%,#3b82f6 100%)`,
                    color:'white', borderRadius:6, padding:'10px 20px', marginBottom:14,
                    display:'flex', justifyContent:'space-between', alignItems:'center',
                }}>
                    <div style={{fontSize:18,fontWeight:800}}>KALİTE PANOSU — SAYFA 2 / GİRDİ KALİTE · ARAÇ KALİTE · TEDARİKÇİ</div>
                    <div style={{fontSize:12,opacity:0.85}}>Dönem: {periodLabel} · {format(new Date(),'dd.MM.yyyy')}</div>
                </div>

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

                {/* ══════════════════════════════ SAYFA 3 ══════════════════════════════════ */}
                <PageBreak/>

                {/* Sayfa 3 başlığı */}
                <div style={{
                    background:`linear-gradient(135deg,${C.navy} 0%,#2d5a9b 55%,#3b82f6 100%)`,
                    color:'white', borderRadius:6, padding:'10px 20px', marginBottom:14,
                    display:'flex', justifyContent:'space-between', alignItems:'center',
                }}>
                    <div style={{fontSize:18,fontWeight:800}}>KALİTE PANOSU — SAYFA 3 / MALİYET TRENDİ · GENEL ÖZET</div>
                    <div style={{fontSize:12,opacity:0.85}}>Dönem: {periodLabel} · {format(new Date(),'dd.MM.yyyy')}</div>
                </div>

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

                {/* ══════════════════════════════════════════════════════════ */}
                {/* FOOTER                                                    */}
                {/* ══════════════════════════════════════════════════════════ */}
                <div style={{
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
