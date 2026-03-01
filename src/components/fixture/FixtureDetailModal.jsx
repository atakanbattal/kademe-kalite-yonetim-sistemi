import React from 'react';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Ruler, CheckCircle2, XCircle, AlertTriangle, RotateCcw, Calendar, User, Building2, Clock } from 'lucide-react';

// ─── Durum renk konfig ───────────────────────────────────────────────────────
const statusConfig = {
    'Aktif': { bg: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30' },
    'Devreye Alma Bekleniyor': { bg: 'bg-blue-500/20 text-blue-200 border-blue-400/30' },
    'Uygunsuz': { bg: 'bg-red-500/20 text-red-200 border-red-400/30' },
    'Revizyon Beklemede': { bg: 'bg-purple-500/20 text-purple-200 border-purple-400/30' },
    'Hurdaya Ayrılmış': { bg: 'bg-gray-500/20 text-gray-300 border-gray-400/30' },
};

const badgeColor = {
    'Aktif': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'Devreye Alma Bekleniyor': 'bg-blue-100 text-blue-700 border-blue-200',
    'Uygunsuz': 'bg-red-100 text-red-700 border-red-200',
    'Revizyon Beklemede': 'bg-purple-100 text-purple-700 border-purple-200',
    'Hurdaya Ayrılmış': 'bg-gray-100 text-gray-600 border-gray-200',
};

const critBadge = {
    'Kritik': 'bg-orange-100 text-orange-700 border-orange-200',
    'Standart': 'bg-slate-100 text-slate-600 border-slate-200',
};

// ─── Yardımcı bileşenler ─────────────────────────────────────────────────────
const InfoCard = ({ icon: Icon, label, value, accent }) => (
    <div className={`rounded-xl border p-4 space-y-1 ${accent || 'bg-muted/30 border-border'}`}>
        <div className="flex items-center gap-2 text-muted-foreground">
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
        </div>
        <p className="text-sm font-semibold text-foreground leading-tight">{value || '—'}</p>
    </div>
);

const SectionTitle = ({ children }) => (
    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 mt-5 first:mt-0">{children}</p>
);

// ─── Doğrulama Geçmişi ───────────────────────────────────────────────────────
const VerificationHistory = ({ verifications = [] }) => {
    if (verifications.length === 0) return (
        <div className="text-center py-12 text-muted-foreground">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-2 opacity-20" />
            <p className="text-sm">Doğrulama kaydı bulunmuyor</p>
        </div>
    );
    const sorted = [...verifications].sort((a, b) => new Date(b.verification_date) - new Date(a.verification_date));
    return (
        <div className="space-y-3">
            {sorted.map(v => (
                <div key={v.id} className={`rounded-xl border p-4 space-y-3 ${v.result === 'Uygun' ? 'border-emerald-200 bg-emerald-50/50' : 'border-red-200 bg-red-50/50'}`}>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                            {v.result === 'Uygun'
                                ? <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                                : <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                            }
                            <span className="font-semibold text-sm">{v.verification_type}</span>
                            <Badge variant="outline" className={`text-xs ${v.result === 'Uygun' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                                {v.result}
                            </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(v.verification_date).toLocaleDateString('tr-TR')}
                            </span>
                            {v.verified_by && (
                                <span className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {v.verified_by}
                                </span>
                            )}
                            <span>{v.sample_count} numune</span>
                        </div>
                    </div>

                    {v.measurements && v.measurements.length > 0 && (
                        <div className="overflow-x-auto rounded-lg border border-border bg-background">
                            <table className="text-xs w-full">
                                <thead>
                                    <tr className="bg-muted/40 border-b border-border">
                                        {['Özellik', 'Nominal', 'Alt Limit', 'Üst Limit', 'Ölçülen', 'Sonuç'].map(h => (
                                            <th key={h} className="text-center px-3 py-2 font-semibold text-muted-foreground">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {v.measurements.map((m, i) => (
                                        <tr key={i} className={`border-b border-border last:border-0 ${m.is_conformant === false ? 'bg-red-50' : ''}`}>
                                            <td className="px-3 py-2 font-medium">{m.characteristic || '—'}</td>
                                            <td className="text-center px-3 py-2">{m.nominal || '—'}</td>
                                            <td className="text-center px-3 py-2">{m.min_limit || '—'}</td>
                                            <td className="text-center px-3 py-2">{m.max_limit || '—'}</td>
                                            <td className="text-center px-3 py-2 font-bold">{m.measured_value || '—'}</td>
                                            <td className="text-center px-3 py-2">
                                                {m.is_conformant === true && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mx-auto" />}
                                                {m.is_conformant === false && <XCircle className="h-3.5 w-3.5 text-red-600 mx-auto" />}
                                                {m.is_conformant === null && <span className="text-muted-foreground">—</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {v.notes && <p className="text-xs text-muted-foreground italic">📝 {v.notes}</p>}
                </div>
            ))}
        </div>
    );
};

// ─── Revizyon Geçmişi ─────────────────────────────────────────────────────────
const RevisionHistory = ({ revisions = [] }) => {
    if (revisions.length === 0) return (
        <div className="text-center py-12 text-muted-foreground">
            <RotateCcw className="h-10 w-10 mx-auto mb-2 opacity-20" />
            <p className="text-sm">Revizyon kaydı bulunmuyor</p>
        </div>
    );
    const sorted = [...revisions].sort((a, b) => (b.revision_no || 0) - (a.revision_no || 0));
    const statusCls = { 'Beklemede': 'bg-yellow-100 text-yellow-700 border-yellow-200', 'Onaylandı': 'bg-emerald-100 text-emerald-700 border-emerald-200', 'Reddedildi': 'bg-red-100 text-red-700 border-red-200' };
    return (
        <div className="space-y-3">
            {sorted.map(r => (
                <div key={r.id} className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                            <span className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                                {r.revision_no || '?'}
                            </span>
                            <span className="font-semibold text-sm">Revizyon {r.revision_no}</span>
                            <Badge variant="outline" className={`text-xs ${statusCls[r.approval_status] || ''}`}>
                                {r.approval_status}
                            </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(r.revision_date).toLocaleDateString('tr-TR')}</span>
                            {r.approved_by && <span className="flex items-center gap-1"><User className="h-3 w-3" />{r.approved_by}</span>}
                        </div>
                    </div>
                    <p className="text-sm text-foreground">{r.description}</p>
                </div>
            ))}
        </div>
    );
};

// ─── Uygunsuzluk Geçmişi ─────────────────────────────────────────────────────
const NonconformityHistory = ({ nonconformities = [] }) => {
    if (nonconformities.length === 0) return (
        <div className="text-center py-12 text-muted-foreground">
            <AlertTriangle className="h-10 w-10 mx-auto mb-2 opacity-20" />
            <p className="text-sm">Uygunsuzluk kaydı bulunmuyor</p>
        </div>
    );
    const sorted = [...nonconformities].sort((a, b) => new Date(b.detection_date) - new Date(a.detection_date));
    const statusCls = { 'Beklemede': 'bg-yellow-100 text-yellow-700 border-yellow-200', 'İşlemde': 'bg-blue-100 text-blue-700 border-blue-200', 'Tamamlandı': 'bg-emerald-100 text-emerald-700 border-emerald-200', 'Hurdaya Ayrıldı': 'bg-gray-100 text-gray-600 border-gray-200' };
    return (
        <div className="space-y-3">
            {sorted.map(nc => (
                <div key={nc.id} className="rounded-xl border border-red-200 bg-red-50/40 p-4 space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <Badge variant="outline" className={`text-xs ${statusCls[nc.correction_status] || ''}`}>{nc.correction_status}</Badge>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />{new Date(nc.detection_date).toLocaleDateString('tr-TR')}
                        </span>
                    </div>

                    {nc.deviation_details && nc.deviation_details.length > 0 && (
                        <div className="space-y-1">
                            {nc.deviation_details.map((d, i) => (
                                <div key={i} className="text-xs bg-white/70 rounded-lg px-3 py-2 border border-red-100">
                                    <span className="font-semibold text-red-700">{d.characteristic}:</span>
                                    <span className="ml-1 text-foreground">{d.deviation}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {nc.correction_description && (
                        <div className="text-xs bg-white/70 rounded-lg px-3 py-2 border border-emerald-100">
                            <span className="font-semibold text-emerald-700">Düzeltme: </span>
                            {nc.correction_description}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

// ─── ANA MODAL ────────────────────────────────────────────────────────────────
const FixtureDetailModal = ({ open, onOpenChange, fixture }) => {
    if (!fixture) return null;

    const statusBadge = statusConfig[fixture.status] || { bg: 'bg-white/20 text-white/80 border-white/30' };
    const vCount = fixture.fixture_verifications?.length || 0;
    const revCount = fixture.fixture_revisions?.length || 0;
    const ncCount = fixture.fixture_nonconformities?.length || 0;

    const fmt = (d) => d ? new Date(d).toLocaleDateString('tr-TR') : '—';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdueVerification = fixture.status === 'Aktif' && fixture.next_verification_date && new Date(fixture.next_verification_date) < today;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">

                {/* ── GRADIENT HEADER ── */}
                <header className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-5 flex items-start justify-between shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/10 p-2.5 rounded-xl border border-white/20">
                            <Ruler className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-lg font-bold text-white tracking-tight font-mono">{fixture.fixture_no}</h1>
                                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${statusBadge.bg}`}>
                                    {fixture.status}
                                </span>
                                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${fixture.criticality_class === 'Kritik'
                                    ? 'bg-orange-500/25 text-orange-200 border-orange-400/40'
                                    : 'bg-slate-500/25 text-slate-300 border-slate-400/40'
                                    }`}>
                                    {fixture.criticality_class}
                                </span>
                            </div>
                            <p className="text-xs text-slate-300 mt-0.5">{fixture.part_code}{fixture.part_name ? ` · ${fixture.part_name}` : ''}</p>
                        </div>
                    </div>

                    {/* Hızlı istatistik */}
                    <div className="hidden sm:flex items-center gap-4 text-center">
                        {[
                            { label: 'Doğrulama', val: vCount },
                            { label: 'Revizyon', val: revCount },
                            { label: 'Uygunsuzluk', val: ncCount, warn: ncCount > 0 },
                        ].map(s => (
                            <div key={s.label} className="text-right">
                                <p className={`text-xl font-bold ${s.warn ? 'text-red-300' : 'text-white'}`}>{s.val}</p>
                                <p className="text-[10px] text-slate-400">{s.label}</p>
                            </div>
                        ))}
                    </div>
                </header>

                {/* ── BODY ── */}
                <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-1">

                    {/* Vadesi Geçmiş Uyarısı */}
                    {overdueVerification && (
                        <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 mb-4">
                            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                            <span>Bu fikstürün periyodik doğrulama vadesi <strong>{fmt(fixture.next_verification_date)}</strong> tarihinde geçti.</span>
                        </div>
                    )}

                    {/* Info Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
                        <InfoCard icon={Building2} label="Sorumlu Bölüm" value={fixture.responsible_department} />
                        <InfoCard icon={Calendar} label="Devreye Alma" value={fmt(fixture.activation_date)} />
                        <InfoCard icon={Clock} label="Son Doğrulama" value={fmt(fixture.last_verification_date)} />
                        <InfoCard
                            icon={Clock}
                            label="Sonraki Doğrulama"
                            value={fmt(fixture.next_verification_date)}
                            accent={overdueVerification ? 'bg-red-50 border-red-200' : undefined}
                        />
                        <InfoCard icon={Ruler} label="Doğrulama Periyodu" value={`${fixture.verification_period_months} ay`} />
                        <InfoCard icon={Ruler} label="Gerekli Numune" value={`${fixture.sample_count_required} adet`} />
                        {fixture.status === 'Hurdaya Ayrılmış' && (
                            <InfoCard icon={AlertTriangle} label="Hurdaya Ayırma" value={fmt(fixture.scrap_date)} accent="bg-red-50 border-red-200" />
                        )}
                    </div>

                    {fixture.criticality_reason && (
                        <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 text-sm mb-4">
                            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Kritiklik Nedeni · </span>
                            {fixture.criticality_reason}
                        </div>
                    )}

                    {fixture.scrap_reason && fixture.status === 'Hurdaya Ayrılmış' && (
                        <div className="rounded-xl border border-red-200 bg-red-50/60 px-4 py-3 text-sm mb-4">
                            <span className="text-xs font-bold uppercase tracking-wider text-red-600">Hurdaya Ayırma Nedeni · </span>
                            {fixture.scrap_reason}
                        </div>
                    )}

                    {fixture.notes && (
                        <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 text-sm mb-4">
                            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notlar · </span>
                            {fixture.notes}
                        </div>
                    )}

                    {/* Geçmiş Sekmeleri */}
                    <Tabs defaultValue="verifications" className="mt-2">
                        <TabsList className="grid grid-cols-3 w-full">
                            <TabsTrigger value="verifications">
                                Doğrulamalar
                                {vCount > 0 && <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/15 px-1 text-[10px] font-bold text-primary">{vCount}</span>}
                            </TabsTrigger>
                            <TabsTrigger value="revisions">
                                Revizyonlar
                                {revCount > 0 && <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/15 px-1 text-[10px] font-bold text-primary">{revCount}</span>}
                            </TabsTrigger>
                            <TabsTrigger value="nonconformities">
                                Uygunsuzluklar
                                {ncCount > 0 && <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500/15 px-1 text-[10px] font-bold text-red-600">{ncCount}</span>}
                            </TabsTrigger>
                        </TabsList>
                        <div className="mt-4">
                            <TabsContent value="verifications">
                                <VerificationHistory verifications={fixture.fixture_verifications} />
                            </TabsContent>
                            <TabsContent value="revisions">
                                <RevisionHistory revisions={fixture.fixture_revisions} />
                            </TabsContent>
                            <TabsContent value="nonconformities">
                                <NonconformityHistory nonconformities={fixture.fixture_nonconformities} />
                            </TabsContent>
                        </div>
                    </Tabs>
                </div>

                {/* ── FOOTER ── */}
                <DialogFooter className="px-6 py-4 border-t border-border shrink-0 bg-muted/20">
                    <div className="flex items-center justify-between w-full">
                        <p className="text-xs text-muted-foreground">
                            Oluşturulma: {fmt(fixture.created_at)}
                        </p>
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Kapat</Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default FixtureDetailModal;
