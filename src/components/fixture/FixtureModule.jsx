import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Filter, RefreshCcw, X, Wrench, FileDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import FixtureDashboard from './FixtureDashboard';
import FixtureList from './FixtureList';
import FixtureFormModal from './FixtureFormModal';
import FixtureDetailModal from './FixtureDetailModal';
import VerificationModal from './VerificationModal';
import RevisionModal from './RevisionModal';
import ScrapModal from './ScrapModal';
import { getFixtureVerificationRules } from '@/lib/fixtureRules';
import { openPrintableReport } from '@/lib/reportUtils';

// =====================================================
// YARDIMCI: Sonraki Doğrulama Tarihini Hesapla
// =====================================================
const calcNextVerificationDate = (fromDate, periodMonths) => {
    const d = new Date(fromDate);
    d.setMonth(d.getMonth() + periodMonths);
    return d.toISOString().split('T')[0];
};

const resolveFixtureReferenceDate = (currentFixture, formData) =>
    currentFixture?.last_verification_date ||
    formData.activation_date ||
    currentFixture?.activation_date ||
    null;

const isMissingFixtureImageColumnError = (error) =>
    error?.code === 'PGRST204' &&
    typeof error?.message === 'string' &&
    error.message.includes('image_paths');

// =====================================================
// ANA MODÜL
// =====================================================
const FixtureModule = () => {
    const { toast } = useToast();

    // Veri
    const [allFixtures, setAllFixtures] = useState([]);
    const [loading, setLoading] = useState(false);
    const [supportsFixtureImages, setSupportsFixtureImages] = useState(true);
    const [exportingPdf, setExportingPdf] = useState(false);

    // Filtreler & Arama
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({
        status: 'all',
        criticality_class: 'all',
    });
    const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });

    // Modal Durumları
    const [formModal, setFormModal] = useState({ open: false, fixture: null });
    const [detailModal, setDetailModal] = useState({ open: false, fixture: null });
    const [verifyModal, setVerifyModal] = useState({ open: false, fixture: null });
    const [reviseModal, setReviseModal] = useState({ open: false, fixture: null });
    const [scrapModal, setScrapModal] = useState({ open: false, fixture: null });

    // =====================================================
    // VERİ ÇEKME
    // =====================================================
    const fetchFixtures = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('fixtures')
                .select(`
                    *,
                    fixture_verifications(id, verification_date, verification_type, result, sample_count, verified_by, measurements, notes, created_at),
                    fixture_revisions(id, revision_date, revision_no, description, approved_by, approval_status, created_at),
                    fixture_nonconformities(id, detection_date, deviation_details, correction_status, correction_date, correction_description, created_at)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setAllFixtures(data || []);
        } catch (err) {
            toast({ title: 'Hata', description: 'Fikstür verileri yüklenemedi.', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchFixtures();
    }, [fetchFixtures]);

    useEffect(() => {
        const checkFixtureImageSupport = async () => {
            const { error } = await supabase
                .from('fixtures')
                .select('image_paths')
                .limit(1);

            if (isMissingFixtureImageColumnError(error)) {
                setSupportsFixtureImages(false);
                return;
            }

            if (!error) {
                setSupportsFixtureImages(true);
            }
        };

        checkFixtureImageSupport();
    }, []);

    // =====================================================
    // FİLTRELEME & SIRALAMA
    // =====================================================
    const filteredFixtures = useMemo(() => {
        let result = allFixtures;

        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            result = result.filter(f =>
                f.fixture_no?.toLowerCase().includes(term) ||
                f.part_code?.toLowerCase().includes(term) ||
                f.part_name?.toLowerCase().includes(term)
            );
        }

        if (filters.status !== 'all') {
            result = result.filter(f => f.status === filters.status);
        }

        if (filters.criticality_class !== 'all') {
            result = result.filter(f => f.criticality_class === filters.criticality_class);
        }

        if (sortConfig.key) {
            result = [...result].sort((a, b) => {
                const aVal = a[sortConfig.key] ?? '';
                const bVal = b[sortConfig.key] ?? '';
                const cmp = String(aVal).localeCompare(String(bVal), 'tr');
                return sortConfig.direction === 'asc' ? cmp : -cmp;
            });
        }

        return result;
    }, [allFixtures, searchTerm, filters, sortConfig]);

    const handleSort = (key) => {
        setSortConfig(prev =>
            prev.key === key
                ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
                : { key, direction: 'asc' }
        );
    };

    const clearFilters = () => {
        setSearchTerm('');
        setFilters({ status: 'all', criticality_class: 'all' });
    };

    const hasActiveFilters = searchTerm || filters.status !== 'all' || filters.criticality_class !== 'all';

    const handleExportFixtureList = async () => {
        if (filteredFixtures.length === 0) {
            toast({
                title: 'Liste boş',
                description: 'PDF almak için önce listede en az bir fikstür olmalı.',
                variant: 'destructive',
            });
            return;
        }

        setExportingPdf(true);
        try {
            const statusCounts = filteredFixtures.reduce((acc, fixture) => {
                const key = fixture.status || 'Bilinmiyor';
                acc[key] = (acc[key] || 0) + 1;
                return acc;
            }, {});

            const criticalityCounts = filteredFixtures.reduce((acc, fixture) => {
                const key = fixture.criticality_class || 'Bilinmiyor';
                acc[key] = (acc[key] || 0) + 1;
                return acc;
            }, {});

            const filterInfo = [
                searchTerm?.trim() ? `Arama: ${searchTerm.trim()}` : null,
                filters.status !== 'all' ? `Durum: ${filters.status}` : null,
                filters.criticality_class !== 'all' ? `Sınıf: ${filters.criticality_class}` : null,
            ].filter(Boolean).join(' | ') || 'Tüm fikstürler';

            const reportData = {
                id: `fixture-list-${Date.now()}`,
                title: 'Fikstür Liste Raporu',
                filterInfo,
                statusCounts,
                criticalityCounts,
                items: filteredFixtures.map((fixture) => ({
                    id: fixture.id,
                    fixture_no: fixture.fixture_no || '-',
                    part_code: fixture.part_code || '-',
                    part_name: fixture.part_name || '',
                    responsible_department: fixture.responsible_department || '-',
                    criticality_class: fixture.criticality_class || '-',
                    status: fixture.status || '-',
                    last_verification_date: fixture.last_verification_date || null,
                    next_verification_date: fixture.next_verification_date || null,
                    image_paths: Array.isArray(fixture.image_paths) ? fixture.image_paths : [],
                })),
            };

            await openPrintableReport(reportData, 'fixture_list', true);

            toast({
                title: 'PDF hazır',
                description: `${filteredFixtures.length} fikstür için rapor hazırlandı.`,
            });
        } catch (error) {
            toast({
                title: 'PDF oluşturulamadı',
                description: error?.message || "Fikstür liste PDF'i oluşturulurken bir hata oluştu.",
                variant: 'destructive',
            });
        } finally {
            setExportingPdf(false);
        }
    };

    // =====================================================
    // FIKSTÜR KAYDET (Yeni / Güncelle)
    // =====================================================
    const handleSaveFixture = async (formData, fixtureId) => {
        const { verificationPeriodMonths: verPeriod, sampleCountRequired: sampleCount } = getFixtureVerificationRules(formData.criticality_class);
        const currentFixture = fixtureId
            ? allFixtures.find((fixture) => fixture.id === fixtureId) || formModal.fixture
            : null;
        const referenceDate = resolveFixtureReferenceDate(currentFixture, formData);

        const payload = {
            fixture_no: formData.fixture_no,
            part_code: formData.part_code,
            part_name: formData.part_name || null,
            criticality_class: formData.criticality_class,
            criticality_reason: formData.criticality_reason || null,
            responsible_department: formData.responsible_department || null,
            activation_date: formData.activation_date || null,
            notes: formData.notes || null,
            verification_period_months: verPeriod,
            sample_count_required: sampleCount,
            next_verification_date: referenceDate
                ? calcNextVerificationDate(referenceDate, verPeriod)
                : (currentFixture?.next_verification_date || null),
        };

        if (supportsFixtureImages) {
            payload.image_paths = Array.isArray(formData.image_paths) && formData.image_paths.length > 0 ? formData.image_paths : [];
        }

        try {
            let error;
            if (fixtureId) {
                // Güncelleme
                ({ error } = await supabase.from('fixtures').update(payload).eq('id', fixtureId));
            } else {
                // Yeni kayıt
                payload.status = 'Devreye Alma Bekleniyor';
                ({ error } = await supabase.from('fixtures').insert([payload]));
            }

            if (error) throw error;

            toast({
                title: fixtureId ? 'Güncellendi' : 'Eklendi',
                description: `${payload.fixture_no} başarıyla ${fixtureId ? 'güncellendi' : 'eklendi'}.`,
            });
            setFormModal({ open: false, fixture: null });
            fetchFixtures();
        } catch (err) {
            if (isMissingFixtureImageColumnError(err)) {
                setSupportsFixtureImages(false);
                toast({
                    title: 'Görsel alanı hazır değil',
                    description: '`image_paths` migrationı veritabanına uygulanmadığı için fikstür görselleri henüz kaydedilemiyor.',
                    variant: 'destructive',
                });
                throw err;
            }

            toast({ title: 'Hata', description: err.message || 'Kayıt başarısız.', variant: 'destructive' });
            throw err;
        }
    };

    // =====================================================
    // DOĞRULAMA KAYDET
    // =====================================================
    const handleSaveVerification = async (verData) => {
        const fixture = verifyModal.fixture;
        if (!fixture) return;
        const fixtureRules = getFixtureVerificationRules(fixture.criticality_class);

        try {
            // 1. Doğrulamayı kaydet
            const { error: verError } = await supabase.from('fixture_verifications').insert([{
                fixture_id: fixture.id,
                verification_type: verData.verification_type,
                verification_date: verData.verification_date,
                sample_count: verData.sample_count,
                measurements: verData.measurements,
                result: verData.result,
                verified_by: verData.verified_by || null,
                notes: verData.notes || null,
            }]);
            if (verError) throw verError;

            // 2. Fikstür durumunu güncelle
            const nextVerDate = calcNextVerificationDate(verData.verification_date, fixtureRules.verificationPeriodMonths);
            const newStatus = verData.result === 'Uygun' ? 'Aktif' : 'Uygunsuz';

            const { error: updateError } = await supabase.from('fixtures').update({
                status: newStatus,
                last_verification_date: verData.verification_date,
                next_verification_date: nextVerDate,
                verification_period_months: fixtureRules.verificationPeriodMonths,
                sample_count_required: fixtureRules.sampleCountRequired,
            }).eq('id', fixture.id);
            if (updateError) throw updateError;

            // 3. Uygunsuzsa uygunsuzluk kaydı oluştur
            if (verData.result === 'Uygunsuz') {
                const deviations = verData.measurements
                    .filter(m => m.is_conformant === false)
                    .map(m => ({
                        characteristic: m.characteristic,
                        nominal: m.nominal,
                        measured_value: m.measured_value,
                        deviation: `Min: ${m.min_limit} / Maks: ${m.max_limit} | Ölçülen: ${m.measured_value}`,
                    }));

                await supabase.from('fixture_nonconformities').insert([{
                    fixture_id: fixture.id,
                    detection_date: verData.verification_date,
                    deviation_details: deviations,
                    correction_status: 'Beklemede',
                }]);
            }

            toast({
                title: 'Doğrulama Kaydedildi',
                description: `Sonuç: ${verData.result} · Durum: ${newStatus}`,
                variant: verData.result === 'Uygun' ? 'default' : 'destructive',
            });
            setVerifyModal({ open: false, fixture: null });
            fetchFixtures();
        } catch (err) {
            toast({ title: 'Hata', description: err.message, variant: 'destructive' });
            throw err;
        }
    };

    // =====================================================
    // REVİZYON KAYDET
    // =====================================================
    const handleSaveRevision = async (revData) => {
        const fixture = reviseModal.fixture;
        if (!fixture) return;

        try {
            // Revizyon no hesapla
            const existingRevisions = fixture.fixture_revisions || [];
            const revNo = existingRevisions.length + 1;

            const { error: revError } = await supabase.from('fixture_revisions').insert([{
                fixture_id: fixture.id,
                revision_date: revData.revision_date,
                revision_no: revNo,
                description: revData.description,
                approved_by: revData.approved_by || null,
                approval_status: revData.approval_status,
            }]);
            if (revError) throw revError;

            // Durumu Revizyon Beklemede'ye al
            const { error: updateError } = await supabase.from('fixtures').update({
                status: 'Revizyon Beklemede',
            }).eq('id', fixture.id);
            if (updateError) throw updateError;

            toast({ title: 'Revizyon Kaydedildi', description: `${fixture.fixture_no} → Revizyon Beklemede` });
            setReviseModal({ open: false, fixture: null });
            fetchFixtures();
        } catch (err) {
            toast({ title: 'Hata', description: err.message, variant: 'destructive' });
            throw err;
        }
    };

    // =====================================================
    // HURDAYA AYIR
    // =====================================================
    const handleScrap = async (scrapData) => {
        const fixture = scrapModal.fixture;
        if (!fixture) return;

        try {
            const { error } = await supabase.from('fixtures').update({
                status: 'Hurdaya Ayrılmış',
                scrap_date: scrapData.scrap_date,
                scrap_reason: scrapData.scrap_reason,
            }).eq('id', fixture.id);
            if (error) throw error;

            toast({ title: 'Hurdaya Ayrıldı', description: `${fixture.fixture_no} hurdaya ayrıldı.` });
            setScrapModal({ open: false, fixture: null });
            fetchFixtures();
        } catch (err) {
            toast({ title: 'Hata', description: err.message, variant: 'destructive' });
            throw err;
        }
    };

    // =====================================================
    // RENDER
    // =====================================================
    return (
        <div className="p-4 sm:p-6 space-y-6">
            {/* Sayfa Başlığı */}
            <motion.div
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Wrench className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-foreground">Fikstür Takip Modülü</h2>
                        <p className="text-sm text-muted-foreground">
                            {allFixtures.length} fikstür kayıtlı · {filteredFixtures.length} gösteriliyor
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={fetchFixtures} disabled={loading} title="Yenile">
                        <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button variant="outline" onClick={handleExportFixtureList} disabled={loading || exportingPdf || filteredFixtures.length === 0}>
                        {exportingPdf ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                PDF Hazırlanıyor
                            </>
                        ) : (
                            <>
                                <FileDown className="mr-2 h-4 w-4" />
                                Liste Al
                            </>
                        )}
                    </Button>
                    <Button onClick={() => setFormModal({ open: true, fixture: null })}>
                        <Plus className="mr-2 h-4 w-4" />Yeni Fikstür Ekle
                    </Button>
                </div>
            </motion.div>

            {/* Dashboard */}
            <FixtureDashboard fixtures={allFixtures} loading={loading} />

            {/* Filtreler */}
            <div className="card p-4 space-y-3">
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                            style={{ paddingLeft: '2.25rem' }}
                            placeholder="Fikstür no, parça kodu veya adı ara..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2">
                        <Select value={filters.status} onValueChange={v => setFilters(p => ({ ...p, status: v }))}>
                            <SelectTrigger className="w-[180px]">
                                <Filter className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                                <SelectValue placeholder="Durum" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tüm Durumlar</SelectItem>
                                <SelectItem value="Aktif">Aktif</SelectItem>
                                <SelectItem value="Devreye Alma Bekleniyor">Devreye Alma Bekleniyor</SelectItem>
                                <SelectItem value="Uygunsuz">Uygunsuz</SelectItem>
                                <SelectItem value="Revizyon Beklemede">Revizyon Beklemede</SelectItem>
                                <SelectItem value="Hurdaya Ayrılmış">Hurdaya Ayrılmış</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={filters.criticality_class} onValueChange={v => setFilters(p => ({ ...p, criticality_class: v }))}>
                            <SelectTrigger className="w-[140px]">
                                <SelectValue placeholder="Sınıf" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tüm Sınıflar</SelectItem>
                                <SelectItem value="Kritik">Kritik</SelectItem>
                                <SelectItem value="Standart">Standart</SelectItem>
                            </SelectContent>
                        </Select>
                        {hasActiveFilters && (
                            <Button variant="ghost" size="icon" onClick={clearFilters} title="Filtreleri Temizle">
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Liste */}
            <div className="card overflow-hidden">
                <FixtureList
                    fixtures={filteredFixtures}
                    onView={(f) => setDetailModal({ open: true, fixture: f })}
                    onEdit={(f) => setFormModal({ open: true, fixture: f })}
                    onVerify={(f) => setVerifyModal({ open: true, fixture: f })}
                    onRevise={(f) => setReviseModal({ open: true, fixture: f })}
                    onScrap={(f) => setScrapModal({ open: true, fixture: f })}
                    sortConfig={sortConfig}
                    onSort={handleSort}
                />
            </div>

            {/* Modaller */}
            <FixtureFormModal
                open={formModal.open}
                onOpenChange={(open) => setFormModal(p => ({ ...p, open }))}
                fixture={formModal.fixture}
                onSave={handleSaveFixture}
                supportsImageUpload={supportsFixtureImages}
            />
            <FixtureDetailModal
                open={detailModal.open}
                onOpenChange={(open) => setDetailModal(p => ({ ...p, open }))}
                fixture={detailModal.fixture}
            />
            <VerificationModal
                open={verifyModal.open}
                onOpenChange={(open) => setVerifyModal(p => ({ ...p, open }))}
                fixture={verifyModal.fixture}
                onSave={handleSaveVerification}
            />
            <RevisionModal
                open={reviseModal.open}
                onOpenChange={(open) => setReviseModal(p => ({ ...p, open }))}
                fixture={reviseModal.fixture}
                onSave={handleSaveRevision}
            />
            <ScrapModal
                open={scrapModal.open}
                onOpenChange={(open) => setScrapModal(p => ({ ...p, open }))}
                fixture={scrapModal.fixture}
                onSave={handleScrap}
            />
        </div>
    );
};

export default FixtureModule;
