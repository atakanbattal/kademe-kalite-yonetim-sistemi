import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Edit, Trash2, Search, FileText, Printer, Copy, History, Layers, Eye, Download, CheckSquare } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { sortControlFormSections } from '@/lib/controlFormSectionSort';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import TemplateEditorModal from '@/components/control-forms/TemplateEditorModal';
import BulkAddItemModal from '@/components/control-forms/BulkAddItemModal';
import RevisionHistoryModal from '@/components/control-forms/RevisionHistoryModal';
import { generateControlFormPdf } from '@/lib/controlFormPdfGenerator';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

const TemplatesTab = () => {
    const { toast } = useToast();
    const [templates, setTemplates] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const [editorOpen, setEditorOpen] = useState(false);
    const [selectedTemplateId, setSelectedTemplateId] = useState(null);

    const [bulkOpen, setBulkOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState(new Set());

    const [historyOpen, setHistoryOpen] = useState(false);
    const [historyTemplateId, setHistoryTemplateId] = useState(null);

    const [deleteConfirm, setDeleteConfirm] = useState(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const { data: vehicleCategory } = await supabase
                .from('product_categories')
                .select('id')
                .eq('category_code', 'VEHICLE_TYPES')
                .single();

            const productsQuery = supabase
                .from('products')
                .select('id, product_name, product_code, vehicle_model')
                .eq('is_active', true)
                .order('product_name');

            if (vehicleCategory?.id) {
                productsQuery.eq('category_id', vehicleCategory.id);
            }

            const [tplRes, prodRes] = await Promise.all([
                supabase
                    .from('control_form_templates')
                    .select('*')
                    .order('updated_at', { ascending: false }),
                productsQuery,
            ]);
            if (tplRes.error) throw tplRes.error;
            if (prodRes.error) throw prodRes.error;
            setTemplates(tplRes.data || []);
            setProducts(prodRes.data || []);
        } catch (err) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Veriler yüklenemedi: ' + err.message });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const productMap = useMemo(() => {
        const m = new Map();
        products.forEach((p) => m.set(p.id, p));
        return m;
    }, [products]);

    const filtered = useMemo(() => {
        const s = searchTerm.trim().toLocaleLowerCase('tr-TR');
        if (!s) return templates;
        return templates.filter(
            (t) =>
                (t.name || '').toLocaleLowerCase('tr-TR').includes(s) ||
                (t.document_no || '').toLocaleLowerCase('tr-TR').includes(s)
        );
    }, [templates, searchTerm]);

    const handleCreate = () => {
        setSelectedTemplateId(null);
        setEditorOpen(true);
    };

    const handleEdit = (id) => {
        setSelectedTemplateId(id);
        setEditorOpen(true);
    };

    const handleClone = async (t) => {
        try {
            const { data: origT, error: tErr } = await supabase
                .from('control_form_templates')
                .select('*, control_form_sections(*, control_form_items(*))')
                .eq('id', t.id)
                .single();
            if (tErr) throw tErr;

            const { data: newT, error: insErr } = await supabase
                .from('control_form_templates')
                .insert({
                    name: `${origT.name} (Kopya)`,
                    description: origT.description,
                    publish_date: new Date().toISOString().slice(0, 10),
                    revision_no: 0,
                    revision_date: new Date().toISOString().slice(0, 10),
                    references_text: origT.references_text,
                    product_ids: origT.product_ids || [],
                    header_fields: origT.header_fields || [],
                })
                .select()
                .single();
            if (insErr) throw insErr;

            const sections = sortControlFormSections(origT.control_form_sections);
            for (const s of sections) {
                const { data: newS, error: sErr } = await supabase
                    .from('control_form_sections')
                    .insert({
                        template_id: newT.id,
                        name: s.name,
                        description: s.description,
                        order_index: s.order_index,
                    })
                    .select()
                    .single();
                if (sErr) throw sErr;
                const items = (s.control_form_items || []).sort((a, b) => a.order_index - b.order_index);
                if (items.length > 0) {
                    const rows = items.map((i) => ({
                        section_id: newS.id,
                        text: i.text,
                        item_type: i.item_type,
                        reference_value: i.reference_value,
                        unit: i.unit,
                        measurement_equipment_id: i.measurement_equipment_id,
                        measurement_equipment_name: i.measurement_equipment_name,
                        is_required: i.is_required,
                        order_index: i.order_index,
                    }));
                    const { error: iErr } = await supabase.from('control_form_items').insert(rows);
                    if (iErr) throw iErr;
                }
            }

            toast({ title: 'Şablon kopyalandı', description: `${newT.document_no} oluşturuldu.` });
            fetchData();
        } catch (err) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Kopyalama başarısız: ' + err.message });
        }
    };

    const handleDelete = async () => {
        if (!deleteConfirm) return;
        try {
            const { error } = await supabase.from('control_form_templates').delete().eq('id', deleteConfirm);
            if (error) throw error;
            toast({ title: 'Silindi', description: 'Şablon silindi.' });
            setDeleteConfirm(null);
            fetchData();
        } catch (err) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Silinemedi: ' + err.message });
        }
    };

    const loadFullTemplate = async (templateId) => {
        const { data, error } = await supabase
            .from('control_form_templates')
            .select('*, control_form_sections(*, control_form_items(*))')
            .eq('id', templateId)
            .single();
        if (error) throw error;
        const sections = sortControlFormSections(data.control_form_sections)
            .map((s) => ({
                ...s,
                items: (s.control_form_items || []).sort((a, b) => a.order_index - b.order_index),
            }));
        return { ...data, sections };
    };

    const handlePrintBlank = async (t) => {
        try {
            const full = await loadFullTemplate(t.id);
            await generateControlFormPdf({ template: full, mode: 'blank', action: 'print' });
        } catch (err) {
            toast({ variant: 'destructive', title: 'Hata', description: 'PDF oluşturulamadı: ' + err.message });
        }
    };

    const handleDownloadBlank = async (t) => {
        try {
            const full = await loadFullTemplate(t.id);
            await generateControlFormPdf({ template: full, mode: 'blank', action: 'download' });
        } catch (err) {
            toast({ variant: 'destructive', title: 'Hata', description: 'PDF oluşturulamadı: ' + err.message });
        }
    };

    const toggleSelection = (id) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filtered.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(filtered.map((t) => t.id)));
    };

    const selectedTemplates = useMemo(
        () => templates.filter((t) => selectedIds.has(t.id)),
        [templates, selectedIds]
    );

    const openHistory = (id) => {
        setHistoryTemplateId(id);
        setHistoryOpen(true);
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1 max-w-md relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4 pointer-events-none z-10" />
                    <Input autoFormat={false}
                        placeholder="Form adı veya doküman no ile ara..."
                        style={{ paddingLeft: '2.5rem' }}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
                    {selectedIds.size > 0 && (
                        <Button variant="secondary" onClick={() => setBulkOpen(true)}>
                            <Layers className="w-4 h-4 mr-2" />
                            Seçili {selectedIds.size} Şablona Toplu Ekle
                        </Button>
                    )}
                    <Button onClick={handleCreate}>
                        <Plus className="w-4 h-4 mr-2" />
                        Yeni Şablon
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-10 text-muted-foreground">Yükleniyor...</div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-12 border border-dashed rounded-lg">
                    <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground mb-4">Henüz kontrol formu şablonu oluşturulmamış.</p>
                    <Button onClick={handleCreate}>
                        <Plus className="w-4 h-4 mr-2" />
                        İlk Şablonu Oluştur
                    </Button>
                </div>
            ) : (
                <div className="border rounded-lg overflow-hidden bg-card">
                    <table className="w-full text-sm">
                        <thead className="bg-muted">
                            <tr>
                                <th className="p-3 w-10">
                                    <Checkbox
                                        checked={selectedIds.size > 0 && selectedIds.size === filtered.length}
                                        onCheckedChange={toggleSelectAll}
                                    />
                                </th>
                                <th className="p-3 text-left">Form Adı</th>
                                <th className="p-3 text-left">Doküman No</th>
                                <th className="p-3 text-center">Rev.</th>
                                <th className="p-3 text-left">Rev. Tarihi</th>
                                <th className="p-3 text-left">Uygulanan Araçlar</th>
                                <th className="p-3 text-center">Durum</th>
                                <th className="p-3 text-right">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((t) => {
                                const prods = (t.product_ids || [])
                                    .map((id) => productMap.get(id))
                                    .filter(Boolean);
                                return (
                                    <tr key={t.id} className="border-t hover:bg-muted/30">
                                        <td className="p-3">
                                            <Checkbox
                                                checked={selectedIds.has(t.id)}
                                                onCheckedChange={() => toggleSelection(t.id)}
                                            />
                                        </td>
                                        <td className="p-3 font-medium">{t.name}</td>
                                        <td className="p-3 font-mono text-xs">{t.document_no}</td>
                                        <td className="p-3 text-center">
                                            <Badge variant="outline">{String(t.revision_no).padStart(2, '0')}</Badge>
                                        </td>
                                        <td className="p-3 text-xs text-muted-foreground">
                                            {t.revision_date
                                                ? format(new Date(t.revision_date), 'dd.MM.yyyy', { locale: tr })
                                                : '-'}
                                        </td>
                                        <td className="p-3">
                                            <div className="flex flex-wrap gap-1 max-w-xs">
                                                {prods.length === 0 && (
                                                    <span className="text-xs text-muted-foreground">—</span>
                                                )}
                                                {prods.slice(0, 3).map((p) => (
                                                    <Badge key={p.id} variant="secondary" className="text-[10px]">
                                                        {p.product_name}
                                                    </Badge>
                                                ))}
                                                {prods.length > 3 && (
                                                    <Badge variant="secondary" className="text-[10px]">
                                                        +{prods.length - 3}
                                                    </Badge>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-3 text-center">
                                            <Badge variant={t.is_active ? 'default' : 'secondary'}>
                                                {t.is_active ? 'Aktif' : 'Pasif'}
                                            </Badge>
                                        </td>
                                        <td className="p-3">
                                            <div className="flex justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    title="Düzenle"
                                                    onClick={() => handleEdit(t.id)}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    title="Boş Form PDF (Yazdır)"
                                                    onClick={() => handlePrintBlank(t)}
                                                >
                                                    <Printer className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    title="Boş Form PDF İndir"
                                                    onClick={() => handleDownloadBlank(t)}
                                                >
                                                    <Download className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    title="Revizyon Geçmişi"
                                                    onClick={() => openHistory(t.id)}
                                                >
                                                    <History className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    title="Kopyala"
                                                    onClick={() => handleClone(t)}
                                                >
                                                    <Copy className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    title="Sil"
                                                    onClick={() => setDeleteConfirm(t.id)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {editorOpen && (
                <TemplateEditorModal
                    open={editorOpen}
                    setOpen={setEditorOpen}
                    templateId={selectedTemplateId}
                    products={products}
                    onSaved={() => {
                        fetchData();
                    }}
                />
            )}

            {bulkOpen && (
                <BulkAddItemModal
                    open={bulkOpen}
                    setOpen={setBulkOpen}
                    selectedTemplates={selectedTemplates}
                    onDone={() => {
                        setBulkOpen(false);
                        setSelectedIds(new Set());
                        fetchData();
                    }}
                />
            )}

            {historyOpen && historyTemplateId && (
                <RevisionHistoryModal
                    open={historyOpen}
                    setOpen={setHistoryOpen}
                    templateId={historyTemplateId}
                />
            )}

            <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Şablonu Sil</AlertDialogTitle>
                        <AlertDialogDescription>
                            Bu şablonu ve tüm bölüm/maddelerini silmek istediğinizden emin misiniz? Bu işlem geri
                            alınamaz. Bu şablonla oluşturulmuş kontrol kayıtları varsa silme engellenecektir.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>İptal</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>Sil</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default TemplatesTab;
