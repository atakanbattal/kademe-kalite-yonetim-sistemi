import React, { useState, useEffect, useRef, useMemo } from 'react';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { useData } from '@/contexts/DataContext';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
    import { format } from 'date-fns';

    const AUDIT_FORM_KEYS = ['title', 'department_id', 'audit_date', 'audit_standard_id'];
    const LEGACY_AUDITOR_VALUE = '__keep__';

    const normalizePersonName = (s) =>
        (s || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ');
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    const buildAuditPayload = (raw) => {
        const out = {};
        for (const key of AUDIT_FORM_KEYS) {
            let v = raw[key];
            if (v === undefined) continue;
            if ((key === 'department_id' || key === 'audit_standard_id') && v !== '' && v != null && !UUID_RE.test(String(v))) continue;
            out[key] = v;
        }
        return out;
    };

    const AuditPlanModal = ({ isOpen, setIsOpen, refreshAudits, auditToEdit }) => {
        const { toast } = useToast();
        const { standards: globalStandards, unitCostSettings: globalDepartments, personnel: globalPersonnel } = useData();

        const activePersonnel = useMemo(() => {
            const list = globalPersonnel || [];
            return list
                .filter((p) => p && p.id && p.is_active !== false)
                .slice()
                .sort((a, b) => String(a.full_name || '').localeCompare(String(b.full_name || ''), 'tr'));
        }, [globalPersonnel]);
        
        const [formData, setFormData] = useState({
            title: '',
            department_id: '',
            audit_date: '',
            auditor_personnel_id: '',
            audit_standard_id: '',
        });
        const [departments, setDepartments] = useState([]);
        const [auditStandards, setAuditStandards] = useState([]);
        const [isSubmitting, setIsSubmitting] = useState(false);
        const isEditMode = !!auditToEdit;
        const prevOpenRef = useRef(false);

        // Liste verilerini bağlamdan senkronize et (modal açıkken formu sıfırlama)
        useEffect(() => {
            if (!isOpen) return;
            const deptList = globalDepartments || [];
            setDepartments(deptList.filter((d) => d && d.id).map((d) => ({ id: d.id, unit_name: d.unit_name })));
            const standardsList = globalStandards || [];
            setAuditStandards(standardsList.filter((s) => s && s.id).map((s) => ({ id: s.id, code: s.code, name: s.name })));
        }, [isOpen, globalDepartments, globalStandards]);

        // Sadece modal açıldığında formu başlat (global veri yenilenince seçimler kaybolmasın)
        useEffect(() => {
            if (!isOpen) {
                prevOpenRef.current = false;
                return;
            }
            const justOpened = !prevOpenRef.current;
            prevOpenRef.current = true;
            if (!justOpened) return;

            const standardsList = globalStandards || [];
            if (isEditMode && auditToEdit) {
                const savedName = (auditToEdit.auditor_name || '').trim();
                const normSaved = normalizePersonName(savedName);
                const match = activePersonnel.find((p) => normalizePersonName(p.full_name) === normSaved);
                setFormData({
                    title: auditToEdit.title || '',
                    department_id: auditToEdit.department_id || '',
                    audit_date: auditToEdit.audit_date ? format(new Date(auditToEdit.audit_date), 'yyyy-MM-dd') : '',
                    auditor_personnel_id: match?.id || (savedName ? LEGACY_AUDITOR_VALUE : ''),
                    audit_standard_id: auditToEdit.audit_standard_id || auditToEdit.audit_standard?.id || '',
                });
            } else {
                const defaultStandard = standardsList.find((s) => s.code === '9001');
                const firstId = standardsList[0]?.id;
                setFormData({
                    title: '',
                    department_id: '',
                    audit_date: '',
                    auditor_personnel_id: '',
                    audit_standard_id: defaultStandard?.id || firstId || '',
                });
            }
        }, [isOpen, isEditMode, auditToEdit, globalStandards, activePersonnel]);

        // Personel listesi geç gelirse: kayıtlı tetkikçi adı ile eşleşeni otomatik seç (sadece boş / liste dışı iken)
        useEffect(() => {
            if (!isOpen || !isEditMode || !auditToEdit?.auditor_name || activePersonnel.length === 0) return;
            const savedName = (auditToEdit.auditor_name || '').trim();
            const match = activePersonnel.find(
                (p) => normalizePersonName(p.full_name) === normalizePersonName(savedName)
            );
            if (!match?.id) return;
            setFormData((prev) => {
                if (prev.auditor_personnel_id === match.id) return prev;
                if (prev.auditor_personnel_id === LEGACY_AUDITOR_VALUE || prev.auditor_personnel_id === '') {
                    return { ...prev, auditor_personnel_id: match.id };
                }
                return prev;
            });
        }, [isOpen, isEditMode, auditToEdit?.id, auditToEdit?.auditor_name, activePersonnel]);


        const handleInputChange = (e) => {
            const { id, value } = e.target;
            if (!id || typeof id !== 'string') return;
            setFormData((prev) => ({ ...prev, [id]: value }));
        };

        const handleSelectChange = (field, value) => {
            if (!field || typeof field !== 'string' || !AUDIT_FORM_KEYS.includes(field)) return;
            if (value === undefined) return;
            setFormData((prev) => ({ ...prev, [field]: value }));
        };

        const handleAuditorSelect = (value) => {
            if (value === undefined) return;
            setFormData((prev) => ({ ...prev, auditor_personnel_id: value }));
        };

        const resolveAuditorName = () => {
            const sel = formData.auditor_personnel_id;
            if (sel === LEGACY_AUDITOR_VALUE) {
                return (auditToEdit?.auditor_name || '').trim();
            }
            if (sel && UUID_RE.test(String(sel))) {
                const p = activePersonnel.find((x) => x.id === sel);
                return (p?.full_name || '').trim();
            }
            return '';
        };

        const handleSubmit = async (e) => {
            e.preventDefault();
            setIsSubmitting(true);

            const auditPayload = buildAuditPayload(formData);
            const auditorName = resolveAuditorName();
            if (!auditorName) {
                toast({ variant: 'destructive', title: 'Eksik bilgi', description: 'Tetkikçi olarak personel listesinden bir kişi seçin.' });
                setIsSubmitting(false);
                return;
            }
            auditPayload.auditor_name = auditorName;

            if (!auditPayload.title?.trim()) {
                toast({ variant: 'destructive', title: 'Eksik bilgi', description: 'Tetkik başlığı zorunludur.' });
                setIsSubmitting(false);
                return;
            }
            if (!auditPayload.department_id || !UUID_RE.test(String(auditPayload.department_id))) {
                toast({ variant: 'destructive', title: 'Eksik bilgi', description: 'Geçerli bir birim seçin.' });
                setIsSubmitting(false);
                return;
            }
            if (!auditPayload.audit_standard_id || !UUID_RE.test(String(auditPayload.audit_standard_id))) {
                toast({ variant: 'destructive', title: 'Eksik bilgi', description: 'Geçerli bir tetkik standardı seçin.' });
                setIsSubmitting(false);
                return;
            }

            let result;
            if (isEditMode) {
                // Düzenleme modunda - trigger otomatik olarak rapor numarasını güncelleyecek
                const { error } = await supabase.from('audits').update(auditPayload).eq('id', auditToEdit.id);
                result = { error };
            } else {
                // Yeni kayıt - report_number trigger tarafından otomatik oluşturulacak
                const { error } = await supabase.from('audits').insert({ ...auditPayload, status: 'Planlandı' });
                result = { error };
            }

            if (result.error) {
                toast({ variant: 'destructive', title: 'Hata!', description: `Tetkik planı ${isEditMode ? 'güncellenemedi' : 'oluşturulamadı'}: ${result.error.message}` });
            } else {
                toast({ title: 'Başarılı!', description: `Tetkik planı başarıyla ${isEditMode ? 'güncellendi' : 'oluşturuldu'}.` });
                refreshAudits();
                setIsOpen(false);
            }
            setIsSubmitting(false);
        };

        return (
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader className="pb-4">
                        <DialogTitle className="text-xl">{isEditMode ? 'Tetkik Planını Düzenle' : 'Yeni Tetkik Planı Oluştur'}</DialogTitle>
                        <DialogDescription className="text-base">{isEditMode ? 'Mevcut tetkik planını güncelleyin.' : 'Yeni bir iç tetkik planlayın.'}</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-5 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="audit_standard_id" className="text-sm font-medium">İç Tetkik Standartı <span className="text-red-500">*</span></Label>
                            <Select value={formData.audit_standard_id} onValueChange={(v) => handleSelectChange('audit_standard_id', v)} required>
                                <SelectTrigger className="h-11">
                                    <SelectValue placeholder={auditStandards.length === 0 ? "Standartlar yükleniyor..." : "Standart seçin..."} />
                                </SelectTrigger>
                                <SelectContent>
                                    {auditStandards.length > 0 ? (
                                        auditStandards.filter((s) => s.id && UUID_RE.test(String(s.id))).map((standard) => (
                                            <SelectItem key={standard.id} value={String(standard.id)}>
                                                {standard.code} - {standard.name}
                                            </SelectItem>
                                        ))
                                    ) : (
                                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                            {auditStandards.length === 0 ? "Standart bulunamadı. Lütfen ayarlardan standart ekleyin." : "Standartlar yükleniyor..."}
                                        </div>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="title" className="text-sm font-medium">Tetkik Başlığı</Label>
                            <Input id="title" value={formData.title} onChange={handleInputChange} required className="h-11" placeholder="Örn: 2025 Yılı Kalite Yönetim Sistemi Tetkiki" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="department_id" className="text-sm font-medium">Denetlenecek Birim <span className="text-red-500">*</span></Label>
                            <Select value={formData.department_id} onValueChange={(v) => handleSelectChange('department_id', v)} required>
                                <SelectTrigger className="h-11"><SelectValue placeholder="Birim seçin..." /></SelectTrigger>
                                <SelectContent>
                                    {departments.filter((dept) => dept.id && UUID_RE.test(String(dept.id))).map((dept) => (
                                        <SelectItem key={dept.id} value={String(dept.id)}>
                                            {dept.unit_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <div className="space-y-2">
                                <Label htmlFor="audit_date" className="text-sm font-medium">Tetkik Tarihi</Label>
                                <Input id="audit_date" type="date" value={formData.audit_date} onChange={handleInputChange} required className="h-11" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="auditor_personnel_id" className="text-sm font-medium">
                                    Tetkikçi (Denetçi) <span className="text-red-500">*</span>
                                </Label>
                                <Select
                                    value={formData.auditor_personnel_id || undefined}
                                    onValueChange={handleAuditorSelect}
                                    required
                                    disabled={activePersonnel.length === 0}
                                >
                                    <SelectTrigger id="auditor_personnel_id" className="h-11">
                                        <SelectValue
                                            placeholder={
                                                activePersonnel.length === 0
                                                    ? 'Personel listesi yükleniyor...'
                                                    : 'Personelden tetkikçi seçin...'
                                            }
                                        />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {isEditMode &&
                                            formData.auditor_personnel_id === LEGACY_AUDITOR_VALUE &&
                                            auditToEdit?.auditor_name && (
                                                <SelectItem value={LEGACY_AUDITOR_VALUE}>
                                                    {auditToEdit.auditor_name} (kayıtlı — listede eşleşme yok)
                                                </SelectItem>
                                            )}
                                        {activePersonnel
                                            .filter((p) => p.id && UUID_RE.test(String(p.id)))
                                            .map((p) => (
                                                <SelectItem key={p.id} value={String(p.id)}>
                                                    {p.full_name}
                                                    {p.unit?.unit_name ? ` — ${p.unit.unit_name}` : p.department ? ` — ${p.department}` : ''}
                                                </SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    Tetkikçi, Personel modülündeki aktif kayıtlardan seçilir; adı tetkik kaydına yazılır.
                                </p>
                            </div>
                        </div>
                        <DialogFooter className="pt-4 gap-2 sm:gap-0">
                            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>İptal</Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? 'Kaydediliyor...' : (isEditMode ? 'Değişiklikleri Kaydet' : 'Planı Kaydet')}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        );
    };

    export default AuditPlanModal;