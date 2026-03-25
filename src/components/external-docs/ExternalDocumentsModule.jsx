import React, { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
    Plus, Search, FileDown, Eye, Trash2, Edit, Scale, BookMarked, Building2, Factory,
    FileText, X, GraduationCap,
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import PdfViewerModal from '@/components/document/PdfViewerModal';
import { normalizeTurkishForSearch, sanitizeFileName } from '@/lib/utils';
import { createTrainingPlanFromExternalDocument } from '@/lib/createTrainingFromExternalDocument';
import { v4 as uuidv4 } from 'uuid';
import { Checkbox } from '@/components/ui/checkbox';
import TrainingFormModal from '@/components/training/TrainingFormModal';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const BUCKET_NAME = 'documents';

const CATEGORY_CONFIG = [
    {
        value: 'yasal_mevzuat',
        label: 'Yasal Mevzuatlar',
        hint: 'Kanunlar, yönetmelikler ve tebliğler',
        icon: Scale,
    },
    {
        value: 'standartlar',
        label: 'Standartlar',
        hint: 'ISO 9001, ISO 14001, IATF 16949 vb. rehberler',
        icon: BookMarked,
    },
    {
        value: 'musteri_dokumanlari',
        label: 'Müşteri Dokümanları',
        hint: 'Şartnameler, teknik resimler, müşteri kılavuzları',
        icon: Building2,
    },
    {
        value: 'tedarikci_kataloglari',
        label: 'Tedarikçi Katalogları',
        hint: 'Kullanım kılavuzları, teknik veri sayfaları, MSDS',
        icon: Factory,
    },
];

const categoryLabel = (v) => CATEGORY_CONFIG.find((c) => c.value === v)?.label || v;

const customerDisplay = (c) => {
    if (!c) return '—';
    return c.name || c.customer_name || c.customer_code || '—';
};

const ValidityStatus = ({ validUntil }) => {
    if (!validUntil) {
        return <Badge variant="secondary">Süresiz</Badge>;
    }
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const expiryDate = new Date(validUntil);
        if (isNaN(expiryDate.getTime())) {
            return <Badge variant="secondary">Geçersiz Tarih</Badge>;
        }
        const diffDays = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) {
            return <Badge variant="destructive">Süresi doldu</Badge>;
        }
        if (diffDays <= 30) {
            return <Badge className="bg-yellow-500 text-white">{diffDays} gün kaldı</Badge>;
        }
        return <Badge className="bg-green-600 text-white">{diffDays} gün kaldı</Badge>;
    } catch {
        return <Badge variant="secondary">—</Badge>;
    }
};

const emptyForm = {
    category: 'yasal_mevzuat',
    title: '',
    description: '',
    reference_code: '',
    source_publisher: '',
    audit_standard_id: '',
    standard_title: '',
    customer_id: '',
    supplier_id: '',
    received_at: '',
    valid_until: '',
    training_required: false,
};

const ExternalDocumentsModule = () => {
    const { toast } = useToast();
    const { user } = useAuth();
    const { externalDocuments, customers, suppliers, standards, loading, refreshData } = useData();

    const [searchTerm, setSearchTerm] = useState('');
    const deferredSearch = useDeferredValue(searchTerm);
    const [activeTab, setActiveTab] = useState('all');

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [file, setFile] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    const [pdfState, setPdfState] = useState({ isOpen: false, url: null, title: '' });

    const [trainingModalOpen, setTrainingModalOpen] = useState(false);
    const [trainingForModal, setTrainingForModal] = useState(null);

    const openLinkedTrainingModal = useCallback(
        async (trainingId) => {
            if (!trainingId) return;
            const { data, error } = await supabase.from('trainings').select('*').eq('id', trainingId).maybeSingle();
            if (error || !data) {
                toast({
                    variant: 'destructive',
                    title: 'Eğitim yüklenemedi',
                    description: error?.message || 'Kayıt bulunamadı.',
                });
                return;
            }
            setTrainingForModal(data);
            setTrainingModalOpen(true);
        },
        [toast]
    );

    const handleTrainingModalSave = useCallback(() => {
        refreshData();
        setTrainingModalOpen(false);
        setTrainingForModal(null);
    }, [refreshData]);

    const handleTrainingModalOpenChange = useCallback((open) => {
        setTrainingModalOpen(open);
        if (!open) setTrainingForModal(null);
    }, []);

    const normalizedSearch = useMemo(
        () => normalizeTurkishForSearch(deferredSearch.trim().toLowerCase()),
        [deferredSearch]
    );

    const customerOptions = useMemo(
        () =>
            (customers || []).map((c) => ({
                value: c.id,
                label: customerDisplay(c),
            })),
        [customers]
    );

    const supplierOptions = useMemo(
        () =>
            (suppliers || []).map((s) => ({
                value: s.id,
                label: s.name || s.id,
            })),
        [suppliers]
    );

    const standardOptions = useMemo(() => {
        const base = (standards || []).map((s) => ({
            value: s.value || s.id,
            label: s.label || s.name || s.code || String(s.value),
        }));
        return base.filter((o) => o.value);
    }, [standards]);

    const filteredRows = useMemo(() => {
        const list = Array.isArray(externalDocuments) ? externalDocuments : [];
        let rows = list;
        if (activeTab !== 'all') {
            rows = rows.filter((r) => r.category === activeTab);
        }
        if (!normalizedSearch) return rows;
        return rows.filter((r) => {
            const parts = [
                r.title,
                r.description,
                r.reference_code,
                r.source_publisher,
                r.standard_title,
                customerDisplay(r.customer),
                r.supplier?.name,
                r.audit_standard?.name,
                r.audit_standard?.code,
                categoryLabel(r.category),
            ]
                .filter(Boolean)
                .join(' ');
            return normalizeTurkishForSearch(parts.toLowerCase()).includes(normalizedSearch);
        });
    }, [externalDocuments, activeTab, normalizedSearch]);

    const openCreate = () => {
        setEditing(null);
        setFile(null);
        setForm({
            ...emptyForm,
            category: activeTab === 'all' ? 'yasal_mevzuat' : activeTab,
        });
        setDialogOpen(true);
    };

    const openEdit = (row) => {
        setEditing(row);
        setFile(null);
        setForm({
            category: row.category,
            title: row.title || '',
            description: row.description || '',
            reference_code: row.reference_code || '',
            source_publisher: row.source_publisher || '',
            audit_standard_id: row.audit_standard_id || '',
            standard_title: row.standard_title || '',
            customer_id: row.customer_id || '',
            supplier_id: row.supplier_id || '',
            received_at: row.received_at || '',
            valid_until: row.valid_until || '',
            training_required: !!row.training_required,
        });
        setDialogOpen(true);
    };

    const onDrop = useCallback((accepted) => {
        if (accepted?.[0]) setFile(accepted[0]);
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        maxFiles: 1,
        accept: {
            'application/pdf': ['.pdf'],
            'image/*': ['.png', '.jpg', '.jpeg', '.webp'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
        },
    });

    const validateForm = () => {
        if (!form.title?.trim()) {
            toast({ variant: 'destructive', title: 'Eksik bilgi', description: 'Başlık zorunludur.' });
            return false;
        }
        if (form.category === 'musteri_dokumanlari' && !form.customer_id) {
            toast({ variant: 'destructive', title: 'Eksik bilgi', description: 'Müşteri seçiniz.' });
            return false;
        }
        if (form.category === 'tedarikci_kataloglari' && !form.supplier_id) {
            toast({ variant: 'destructive', title: 'Eksik bilgi', description: 'Tedarikçi seçiniz.' });
            return false;
        }
        if (form.category === 'standartlar' && !form.audit_standard_id && !form.standard_title?.trim()) {
            toast({
                variant: 'destructive',
                title: 'Eksik bilgi',
                description: 'Sistemdeki standartlardan seçin veya standart adını yazın.',
            });
            return false;
        }
        if (form.training_required && editing && !file && !editing?.file_path) {
            toast({
                variant: 'destructive',
                title: 'Dosya gerekli',
                description: 'Eğitim planı için önce bir dosya yükleyin.',
            });
            return false;
        }
        if (!editing && !file) {
            toast({ variant: 'destructive', title: 'Dosya gerekli', description: 'Lütfen bir dosya yükleyin.' });
            return false;
        }
        return true;
    };

    const buildStoragePath = (id, f) => {
        const safe = sanitizeFileName(f.name);
        return `external-documents/${id}/${Date.now()}-${safe}`;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;
        setSubmitting(true);
        try {
            const id = editing?.id || uuidv4();
            let filePath = editing?.file_path;
            let fileName = editing?.file_name;
            let mimeType = editing?.mime_type;
            let fileSize = editing?.file_size;

            if (file) {
                const newPath = buildStoragePath(id, file);
                if (editing?.file_path) {
                    await supabase.storage.from(BUCKET_NAME).remove([editing.file_path]);
                }
                const { error: upErr } = await supabase.storage.from(BUCKET_NAME).upload(newPath, file, {
                    upsert: true,
                });
                if (upErr) throw upErr;
                filePath = newPath;
                fileName = file.name;
                mimeType = file.type;
                fileSize = file.size;
            }

            if (!filePath) {
                throw new Error('Dosya yolu oluşturulamadı');
            }

            const payload = {
                category: form.category,
                title: form.title.trim(),
                description: form.description?.trim() || null,
                reference_code: form.reference_code?.trim() || null,
                source_publisher: form.source_publisher?.trim() || null,
                audit_standard_id: form.audit_standard_id || null,
                standard_title: form.standard_title?.trim() || null,
                customer_id: form.customer_id || null,
                supplier_id: form.supplier_id || null,
                received_at: form.received_at || null,
                valid_until: form.valid_until || null,
                file_path: filePath,
                file_name: fileName,
                mime_type: mimeType,
                file_size: fileSize,
                user_id: user?.id || null,
                training_required: !!form.training_required,
                training_id: editing?.training_id || null,
            };

            const recordId = editing?.id || id;

            if (editing) {
                const { error } = await supabase.from('external_documents').update(payload).eq('id', editing.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('external_documents').insert({ ...payload, id });
                if (error) throw error;
            }

            let createdTraining = null;
            const shouldCreateTraining =
                !!form.training_required &&
                !!filePath &&
                !editing?.training_id;

            if (shouldCreateTraining) {
                const snapshot = {
                    title: form.title.trim(),
                    category: form.category,
                    description: form.description?.trim(),
                    reference_code: form.reference_code?.trim(),
                    source_publisher: form.source_publisher?.trim(),
                    standard_title: form.standard_title?.trim(),
                    audit_standard: standards.find((s) => (s.value || s.id) === form.audit_standard_id),
                    customer: customers.find((c) => c.id === form.customer_id),
                    supplier: suppliers.find((s) => s.id === form.supplier_id),
                    received_at: form.received_at,
                    valid_until: form.valid_until,
                };
                try {
                    createdTraining = await createTrainingPlanFromExternalDocument({
                        externalDocumentId: recordId,
                        snapshot,
                        filePath,
                        fileName,
                        mimeType,
                    });
                } catch (trainErr) {
                    console.error(trainErr);
                    await supabase
                        .from('external_documents')
                        .update({ training_required: false, training_id: null })
                        .eq('id', recordId);
                    toast({
                        variant: 'destructive',
                        title: 'Eğitim planı oluşturulamadı',
                        description: trainErr.message || 'Dış kayıt saklandı; eğitim adımı atlandı.',
                    });
                    setDialogOpen(false);
                    refreshData();
                    return;
                }
            }

            if (createdTraining) {
                toast({
                    title: 'Tamamlandı',
                    description: 'Eğitim planı ve doküman kopyası oluşturuldu. Eğitim planı penceresi açılıyor.',
                });
                setDialogOpen(false);
                refreshData();
                setTrainingForModal(createdTraining);
                setTrainingModalOpen(true);
            } else {
                toast({
                    title: editing ? 'Güncellendi' : 'Kaydedildi',
                    description: editing ? 'Kayıt güncellendi.' : 'Dış kaynaklı doküman eklendi.',
                });
                setDialogOpen(false);
                refreshData();
            }
        } catch (err) {
            console.error(err);
            toast({ variant: 'destructive', title: 'Hata', description: err.message || 'İşlem başarısız.' });
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (row) => {
        try {
            if (row.file_path) {
                await supabase.storage.from(BUCKET_NAME).remove([row.file_path]);
            }
            const { error } = await supabase.from('external_documents').delete().eq('id', row.id);
            if (error) throw error;
            toast({ title: 'Silindi', description: 'Kayıt kaldırıldı.' });
            refreshData();
        } catch (err) {
            toast({ variant: 'destructive', title: 'Hata', description: err.message });
        }
    };

    const handleView = async (row) => {
        if (!row.file_path) {
            toast({ variant: 'destructive', title: 'Dosya yok', description: 'Bu kayıtta dosya bulunamadı.' });
            return;
        }
        try {
            const { data, error } = await supabase.storage.from(BUCKET_NAME).download(row.file_path);
            if (error) throw error;
            const mime = row.mime_type || data.type || 'application/octet-stream';
            const blob = new Blob([data], { type: mime });
            const isPdf = mime.includes('pdf');
            const isImage = mime.startsWith('image/');
            if (!isPdf && !isImage) {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = row.file_name || 'belge';
                a.click();
                window.URL.revokeObjectURL(url);
                toast({ title: 'İndirme', description: 'Bu dosya türü önizlenemiyor; indirme başlatıldı.' });
                return;
            }
            const blobUrl = window.URL.createObjectURL(blob);
            setPdfState({ isOpen: true, url: blobUrl, title: row.title });
        } catch (err) {
            toast({ variant: 'destructive', title: 'Hata', description: err.message });
        }
    };

    const handleDownload = async (row) => {
        if (!row.file_path) return;
        try {
            const { data, error } = await supabase.storage.from(BUCKET_NAME).download(row.file_path);
            if (error) throw error;
            const blob = new Blob([data]);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = row.file_name || sanitizeFileName(row.title) || 'belge';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            toast({ variant: 'destructive', title: 'Hata', description: err.message });
        }
    };

    const sourceSummary = (row) => {
        switch (row.category) {
            case 'yasal_mevzuat':
                return [row.reference_code, row.source_publisher].filter(Boolean).join(' · ') || '—';
            case 'standartlar':
                if (row.audit_standard) {
                    return [row.audit_standard.code, row.audit_standard.name].filter(Boolean).join(' — ');
                }
                return row.standard_title || '—';
            case 'musteri_dokumanlari':
                return customerDisplay(row.customer);
            case 'tedarikci_kataloglari':
                return row.supplier?.name || '—';
            default:
                return '—';
        }
    };

    const closePdf = (open) => {
        if (!open && pdfState.url) {
            window.URL.revokeObjectURL(pdfState.url);
            setPdfState({ isOpen: false, url: null, title: '' });
        } else {
            setPdfState((s) => ({ ...s, isOpen: open }));
        }
    };

    return (
        <div className="space-y-6">
            <PdfViewerModal
                isOpen={pdfState.isOpen}
                setIsOpen={closePdf}
                pdfUrl={pdfState.url}
                title={pdfState.title}
            />

            <TrainingFormModal
                isOpen={trainingModalOpen}
                setIsOpen={handleTrainingModalOpenChange}
                training={trainingForModal}
                onSave={handleTrainingModalSave}
            />

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editing ? 'Dış Dokümanı Düzenle' : 'Dış Kaynaklı Doküman Ekle'}</DialogTitle>
                        <DialogDescription>
                            Kategoriye göre kaynak alanları doldurun; müşteri ve tedarikçi için arama yaparak seçim
                            yapabilirsiniz.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Kategori</Label>
                                <Select
                                    value={form.category}
                                    onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CATEGORY_CONFIG.map((c) => (
                                            <SelectItem key={c.value} value={c.value}>
                                                {c.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    {CATEGORY_CONFIG.find((c) => c.value === form.category)?.hint}
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label>Başlık *</Label>
                                <Input
                                    value={form.title}
                                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                                    placeholder="Doküman adı"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Açıklama</Label>
                            <Textarea
                                value={form.description}
                                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                                rows={2}
                                placeholder="İsteğe bağlı notlar"
                            />
                        </div>

                        {form.category === 'yasal_mevzuat' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Referans / Numara</Label>
                                    <Input
                                        value={form.reference_code}
                                        onChange={(e) => setForm((f) => ({ ...f, reference_code: e.target.value }))}
                                        placeholder="Kanun / yönetmelik / tebliğ no"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Yayımlayan kurum</Label>
                                    <Input
                                        value={form.source_publisher}
                                        onChange={(e) => setForm((f) => ({ ...f, source_publisher: e.target.value }))}
                                        placeholder="Örn: Resmî Gazete, Bakanlık"
                                    />
                                </div>
                            </div>
                        )}

                        {form.category === 'standartlar' && (
                            <div className="space-y-4 rounded-lg border border-border p-4 bg-muted/30">
                                <div className="space-y-2">
                                    <Label>Tetkik standartlarından seç</Label>
                                    <Combobox
                                        options={standardOptions}
                                        value={form.audit_standard_id}
                                        onChange={(v) => setForm((f) => ({ ...f, audit_standard_id: v || '' }))}
                                        placeholder="Standart ara ve seç..."
                                        searchPlaceholder="ISO, IATF..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Veya standart / rehber adı</Label>
                                    <Input
                                        value={form.standard_title}
                                        onChange={(e) => setForm((f) => ({ ...f, standard_title: e.target.value }))}
                                        placeholder="Listede yoksa buraya yazın"
                                    />
                                </div>
                            </div>
                        )}

                        {form.category === 'musteri_dokumanlari' && (
                            <div className="space-y-2">
                                <Label>Müşteri *</Label>
                                <Combobox
                                    options={customerOptions}
                                    value={form.customer_id}
                                    onChange={(v) => setForm((f) => ({ ...f, customer_id: v || '' }))}
                                    placeholder="Müşteri ara..."
                                    searchPlaceholder="Ünvan veya kod..."
                                />
                            </div>
                        )}

                        {form.category === 'tedarikci_kataloglari' && (
                            <div className="space-y-2">
                                <Label>Tedarikçi *</Label>
                                <Combobox
                                    options={supplierOptions}
                                    value={form.supplier_id}
                                    onChange={(v) => setForm((f) => ({ ...f, supplier_id: v || '' }))}
                                    placeholder="Tedarikçi ara..."
                                    searchPlaceholder="Firma adı..."
                                />
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Alınma / yayın tarihi</Label>
                                <Input
                                    type="date"
                                    value={form.received_at}
                                    onChange={(e) => setForm((f) => ({ ...f, received_at: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Geçerlilik bitişi</Label>
                                <Input
                                    type="date"
                                    value={form.valid_until}
                                    onChange={(e) => setForm((f) => ({ ...f, valid_until: e.target.value }))}
                                />
                            </div>
                        </div>

                        <div className="flex items-start gap-3 rounded-lg border border-border p-4 bg-muted/20">
                            <Checkbox
                                id="training_required"
                                checked={!!form.training_required}
                                onCheckedChange={(v) => setForm((f) => ({ ...f, training_required: !!v }))}
                            />
                            <div className="space-y-1 min-w-0">
                                <Label htmlFor="training_required" className="cursor-pointer font-medium leading-none">
                                    Bu doküman için eğitim gerekli
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    İşaretlenirse kayıt sonrası «Planlandı» durumunda bir eğitim planı oluşturulur; dosya eğitim
                                    modülündeki dokümanlara kopyalanır ve eğitim formu otomatik açılır (katılımcıları siz
                                    seçersiniz).
                                </p>
                                {!!editing?.training_id && (
                                    <p className="text-xs text-amber-700 dark:text-amber-400 pt-1">
                                        Bu kayıt zaten bir eğitim planına bağlı. Yeni plan oluşturulmaz; eğitime gitmek için
                                        listedeki eğitim bağlantısını kullanın.
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>{editing ? 'Yeni dosya (isteğe bağlı)' : 'Dosya *'}</Label>
                            <div
                                {...getRootProps()}
                                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                                    isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
                                }`}
                            >
                                <input {...getInputProps()} />
                                {file ? (
                                    <div className="flex items-center justify-center gap-2 text-sm">
                                        <FileText className="w-4 h-4" />
                                        <span className="truncate">{file.name}</span>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setFile(null);
                                            }}
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        Sürükleyip bırakın veya tıklayın (PDF, görsel, Office)
                                    </p>
                                )}
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                                İptal
                            </Button>
                            <Button type="submit" disabled={submitting}>
                                {submitting ? 'Kaydediliyor...' : editing ? 'Güncelle' : 'Kaydet'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-4">
                <Button onClick={openCreate} className="shrink-0">
                    <Plus className="w-4 h-4 mr-2" />
                    Yeni kayıt
                </Button>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="flex flex-wrap h-auto gap-1 p-1">
                    <TabsTrigger value="all" className="text-xs sm:text-sm">
                        Tümü
                    </TabsTrigger>
                    {CATEGORY_CONFIG.map((c) => {
                        const Icon = c.icon;
                        return (
                            <TabsTrigger key={c.value} value={c.value} className="text-xs sm:text-sm gap-1">
                                <Icon className="w-3.5 h-3.5 hidden sm:inline" />
                                {c.label}
                            </TabsTrigger>
                        );
                    })}
                </TabsList>
            </Tabs>

            <div className="dashboard-widget">
                <div className="flex flex-col sm:flex-row gap-4 mb-4">
                    <div className="search-box flex-1 sm:max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Başlık, referans, müşteri, tedarikçi, standart ara..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="bg-card border rounded-lg overflow-hidden shadow-sm">
                    <Table className="min-w-[720px]">
                        <TableHeader>
                            <TableRow className="bg-muted/50 hover:bg-muted/50">
                                <TableHead>Başlık</TableHead>
                                <TableHead>Kategori</TableHead>
                                <TableHead>Kaynak / ilişki</TableHead>
                                <TableHead>Alınma</TableHead>
                                <TableHead>Geçerlilik</TableHead>
                                <TableHead>Eğitim</TableHead>
                                <TableHead className="text-right">İşlemler</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                        Yükleniyor...
                                    </TableCell>
                                </TableRow>
                            ) : filteredRows.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                        Kayıt bulunmuyor.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredRows.map((row) => (
                                    <TableRow key={row.id} className="hover:bg-muted/30 transition-colors">
                                        <TableCell className="font-medium max-w-[220px]">
                                            <div className="truncate">{row.title}</div>
                                            {row.file_name && (
                                                <div className="text-xs text-muted-foreground truncate">
                                                    {row.file_name}
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{categoryLabel(row.category)}</Badge>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-sm max-w-[240px]">
                                            <div className="truncate">{sourceSummary(row)}</div>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                                            {row.received_at
                                                ? format(new Date(row.received_at), 'dd.MM.yyyy', { locale: tr })
                                                : '—'}
                                        </TableCell>
                                        <TableCell>
                                            <ValidityStatus validUntil={row.valid_until} />
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            {row.training_required || row.training_id ? (
                                                row.training ? (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="gap-1 h-8 max-w-full"
                                                        title="Eğitim planını aç"
                                                        onClick={() => openLinkedTrainingModal(row.training.id)}
                                                    >
                                                        <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                                                        <span className="truncate">
                                                            {row.training.training_code || 'Plan'}
                                                        </span>
                                                    </Button>
                                                ) : (
                                                    <Badge variant="secondary" className="text-xs">
                                                        İşleniyor…
                                                    </Badge>
                                                )
                                            ) : (
                                                <span className="text-muted-foreground">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex flex-wrap items-center gap-1 justify-end">
                                                <Button variant="ghost" size="sm" onClick={() => handleView(row)}>
                                                    <Eye className="w-4 h-4 mr-1" />
                                                    Görüntüle
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => handleDownload(row)}>
                                                    <FileDown className="w-4 h-4 mr-1" />
                                                    İndir
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => openEdit(row)}>
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="text-destructive">
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Kaydı silinsin mi?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Bu işlem dosyayı ve kaydı kalıcı olarak kaldırır.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>İptal</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDelete(row)}>
                                                                Sil
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
};

export default ExternalDocumentsModule;
