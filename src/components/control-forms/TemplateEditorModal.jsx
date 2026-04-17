import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Plus,
    Trash2,
    ArrowUp,
    ArrowDown,
    Save,
    Ruler,
    CheckSquare,
    Tag,
    X,
    ChevronDown,
    ChevronRight,
    Wrench,
    FileText,
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const DEFAULT_HEADER_FIELDS = [
    { key: 'marka', label: 'Markası' },
    { key: 'tipi', label: 'Tipi' },
    { key: 'modeli', label: 'Modeli' },
    { key: 'imal_yili', label: 'İmal Yılı' },
    { key: 'motor_no', label: 'Motor No' },
    { key: 'sps_no', label: 'SPS No' },
    { key: 'emisyon_sinifi', label: 'Emisyon Sınıfı' },
    { key: 'kapasite', label: 'Kapasite' },
];

const TemplateEditorModal = ({ open, setOpen, templateId, products, onSaved }) => {
    const { toast } = useToast();
    const isEdit = !!templateId;
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const [template, setTemplate] = useState({
        id: null,
        document_no: '',
        name: '',
        description: '',
        publish_date: new Date().toISOString().slice(0, 10),
        revision_no: 0,
        revision_date: new Date().toISOString().slice(0, 10),
        references_text: '',
        product_ids: [],
        header_fields: DEFAULT_HEADER_FIELDS,
        is_active: true,
    });
    const [sections, setSections] = useState([]); // [{id, name, order_index, items: [...]}]
    const [expandedSections, setExpandedSections] = useState(new Set());
    const [equipments, setEquipments] = useState([]);
    const [origSnapshot, setOrigSnapshot] = useState(null);

    // Dialog active inner-tab
    const [activeTab, setActiveTab] = useState('sections');

    const loadEquipments = useCallback(async () => {
        const { data, error } = await supabase
            .from('equipments')
            .select('id, name, brand_model, serial_number, category, measurement_range')
            .neq('status', 'Hurda')
            .order('name');
        if (error) {
            console.warn('Equipments load error:', error);
            return;
        }
        setEquipments(data || []);
    }, []);

    const loadTemplate = useCallback(async () => {
        if (!isEdit) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('control_form_templates')
                .select('*, control_form_sections(*, control_form_items(*))')
                .eq('id', templateId)
                .single();
            if (error) throw error;

            setTemplate({
                id: data.id,
                document_no: data.document_no || '',
                name: data.name || '',
                description: data.description || '',
                publish_date: data.publish_date,
                revision_no: data.revision_no || 0,
                revision_date: data.revision_date,
                references_text: data.references_text || '',
                product_ids: data.product_ids || [],
                header_fields:
                    Array.isArray(data.header_fields) && data.header_fields.length > 0
                        ? data.header_fields
                        : DEFAULT_HEADER_FIELDS,
                is_active: data.is_active,
            });
            const secs = (data.control_form_sections || [])
                .sort((a, b) => a.order_index - b.order_index)
                .map((s) => ({
                    id: s.id,
                    name: s.name,
                    description: s.description || '',
                    order_index: s.order_index,
                    items: (s.control_form_items || [])
                        .sort((a, b) => a.order_index - b.order_index)
                        .map((i) => ({
                            id: i.id,
                            text: i.text,
                            item_type: i.item_type,
                            reference_value: i.reference_value || '',
                            unit: i.unit || '',
                            measurement_equipment_id: i.measurement_equipment_id || null,
                            measurement_equipment_name: i.measurement_equipment_name || '',
                            is_required: !!i.is_required,
                            order_index: i.order_index,
                            _existing: true,
                        })),
                    _existing: true,
                }));
            setSections(secs);
            setExpandedSections(new Set(secs.map((s) => s.id)));
            setOrigSnapshot(JSON.stringify({ template: data, sections: secs }));
        } catch (err) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Şablon yüklenemedi: ' + err.message });
        } finally {
            setLoading(false);
        }
    }, [isEdit, templateId, toast]);

    useEffect(() => {
        if (!open) return;
        loadEquipments();
        if (isEdit) {
            loadTemplate();
        } else {
            setTemplate((t) => ({
                ...t,
                id: null,
                document_no: '',
                name: '',
                description: '',
                publish_date: new Date().toISOString().slice(0, 10),
                revision_no: 0,
                revision_date: new Date().toISOString().slice(0, 10),
                references_text: '',
                product_ids: [],
                header_fields: DEFAULT_HEADER_FIELDS,
                is_active: true,
            }));
            setSections([]);
            setExpandedSections(new Set());
            setOrigSnapshot(null);
        }
    }, [open, isEdit, loadTemplate, loadEquipments]);

    const toggleExpand = (idOrKey) => {
        setExpandedSections((prev) => {
            const n = new Set(prev);
            if (n.has(idOrKey)) n.delete(idOrKey);
            else n.add(idOrKey);
            return n;
        });
    };

    // ---------------- Sections ----------------
    const addSection = () => {
        const tempId = `new_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        setSections((prev) => [
            ...prev,
            {
                id: tempId,
                name: '',
                description: '',
                order_index: prev.length,
                items: [],
                _new: true,
            },
        ]);
        setExpandedSections((prev) => new Set([...prev, tempId]));
    };

    const updateSection = (sectionId, patch) => {
        setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, ...patch } : s)));
    };

    const deleteSection = (sectionId) => {
        setSections((prev) => prev.filter((s) => s.id !== sectionId));
    };

    const moveSection = (sectionId, direction) => {
        setSections((prev) => {
            const idx = prev.findIndex((s) => s.id === sectionId);
            if (idx < 0) return prev;
            const newIdx = direction === 'up' ? idx - 1 : idx + 1;
            if (newIdx < 0 || newIdx >= prev.length) return prev;
            const copy = [...prev];
            const [moved] = copy.splice(idx, 1);
            copy.splice(newIdx, 0, moved);
            return copy.map((s, i) => ({ ...s, order_index: i }));
        });
    };

    // ---------------- Items ----------------
    const addItem = (sectionId) => {
        setSections((prev) =>
            prev.map((s) => {
                if (s.id !== sectionId) return s;
                const tempId = `new_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
                return {
                    ...s,
                    items: [
                        ...s.items,
                        {
                            id: tempId,
                            text: '',
                            item_type: 'visual',
                            reference_value: '',
                            unit: '',
                            measurement_equipment_id: null,
                            measurement_equipment_name: '',
                            is_required: true,
                            order_index: s.items.length,
                            _new: true,
                        },
                    ],
                };
            })
        );
    };

    const updateItem = (sectionId, itemId, patch) => {
        setSections((prev) =>
            prev.map((s) => {
                if (s.id !== sectionId) return s;
                return {
                    ...s,
                    items: s.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)),
                };
            })
        );
    };

    const deleteItem = (sectionId, itemId) => {
        setSections((prev) =>
            prev.map((s) => {
                if (s.id !== sectionId) return s;
                return { ...s, items: s.items.filter((i) => i.id !== itemId) };
            })
        );
    };

    const moveItem = (sectionId, itemId, direction) => {
        setSections((prev) =>
            prev.map((s) => {
                if (s.id !== sectionId) return s;
                const idx = s.items.findIndex((i) => i.id === itemId);
                if (idx < 0) return s;
                const newIdx = direction === 'up' ? idx - 1 : idx + 1;
                if (newIdx < 0 || newIdx >= s.items.length) return s;
                const copy = [...s.items];
                const [moved] = copy.splice(idx, 1);
                copy.splice(newIdx, 0, moved);
                return { ...s, items: copy.map((it, i) => ({ ...it, order_index: i })) };
            })
        );
    };

    // ---------------- Products multi select ----------------
    const toggleProduct = (productId) => {
        setTemplate((t) => {
            const curr = new Set(t.product_ids || []);
            if (curr.has(productId)) curr.delete(productId);
            else curr.add(productId);
            return { ...t, product_ids: Array.from(curr) };
        });
    };

    const selectedProducts = useMemo(
        () => products.filter((p) => (template.product_ids || []).includes(p.id)),
        [products, template.product_ids]
    );

    // ---------------- Header fields ----------------
    const updateHeaderField = (index, patch) => {
        setTemplate((t) => {
            const copy = [...(t.header_fields || [])];
            copy[index] = { ...copy[index], ...patch };
            return { ...t, header_fields: copy };
        });
    };

    const addHeaderField = () => {
        setTemplate((t) => ({
            ...t,
            header_fields: [
                ...(t.header_fields || []),
                { key: `field_${Date.now()}`, label: '' },
            ],
        }));
    };

    const deleteHeaderField = (index) => {
        setTemplate((t) => {
            const copy = [...(t.header_fields || [])];
            copy.splice(index, 1);
            return { ...t, header_fields: copy };
        });
    };

    // ---------------- Save ----------------
    const validate = () => {
        if (!template.name?.trim()) return 'Form adı gerekli.';
        for (const s of sections) {
            if (!s.name?.trim()) return 'Tüm bölümlerin adı olmalıdır.';
            for (const i of s.items) {
                if (!i.text?.trim()) return `"${s.name}" bölümünde boş madde var.`;
                if (i.item_type === 'measurement' && !i.reference_value?.trim() && !i.measurement_equipment_id) {
                    return `"${i.text}" ölçüm maddesi için en az bir referans değer veya ölçüm cihazı belirtilmelidir.`;
                }
            }
        }
        return null;
    };

    const handleSave = async () => {
        const err = validate();
        if (err) {
            toast({ variant: 'destructive', title: 'Doğrulama hatası', description: err });
            return;
        }
        setSaving(true);
        try {
            let templateIdLocal = template.id;
            if (isEdit) {
                const { error: upErr } = await supabase
                    .from('control_form_templates')
                    .update({
                        name: template.name,
                        description: template.description || null,
                        publish_date: template.publish_date,
                        references_text: template.references_text || null,
                        product_ids: template.product_ids || [],
                        header_fields: template.header_fields || [],
                        is_active: template.is_active,
                    })
                    .eq('id', templateIdLocal);
                if (upErr) throw upErr;
            } else {
                const { data, error: insErr } = await supabase
                    .from('control_form_templates')
                    .insert({
                        name: template.name,
                        description: template.description || null,
                        publish_date: template.publish_date,
                        references_text: template.references_text || null,
                        product_ids: template.product_ids || [],
                        header_fields: template.header_fields || [],
                        is_active: template.is_active,
                    })
                    .select()
                    .single();
                if (insErr) throw insErr;
                templateIdLocal = data.id;
            }

            // Sections: Delete-all & recreate strategy (daha basit ve güvenilir)
            // Önce mevcut sections'ı sil (cascade items)
            if (isEdit) {
                const { error: delErr } = await supabase
                    .from('control_form_sections')
                    .delete()
                    .eq('template_id', templateIdLocal);
                if (delErr) throw delErr;
            }

            // Sections ekle
            for (let sIdx = 0; sIdx < sections.length; sIdx++) {
                const s = sections[sIdx];
                const { data: newSection, error: sErr } = await supabase
                    .from('control_form_sections')
                    .insert({
                        template_id: templateIdLocal,
                        name: s.name.trim(),
                        description: s.description || null,
                        order_index: sIdx,
                    })
                    .select()
                    .single();
                if (sErr) throw sErr;

                if (s.items.length > 0) {
                    const rows = s.items.map((i, iIdx) => ({
                        section_id: newSection.id,
                        text: i.text.trim(),
                        item_type: i.item_type,
                        reference_value: i.reference_value?.trim() || null,
                        unit: i.unit?.trim() || null,
                        measurement_equipment_id: i.measurement_equipment_id || null,
                        measurement_equipment_name: i.measurement_equipment_name || null,
                        is_required: !!i.is_required,
                        order_index: iIdx,
                    }));
                    const { error: iErr } = await supabase.from('control_form_items').insert(rows);
                    if (iErr) throw iErr;
                }
            }

            // Revizyon ekle (sadece edit modunda)
            if (isEdit) {
                const { error: rErr } = await supabase.rpc('bump_control_form_template_revision', {
                    p_template_id: templateIdLocal,
                    p_changes_summary: 'Şablon güncellendi',
                });
                if (rErr) {
                    console.warn('Revision bump error:', rErr);
                }
            }

            toast({
                title: 'Kaydedildi',
                description: isEdit ? 'Şablon güncellendi, yeni revizyon oluşturuldu.' : 'Yeni şablon oluşturuldu.',
            });
            onSaved?.();
            setOpen(false);
        } catch (err) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Kaydedilemedi: ' + err.message });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="!inset-0 !translate-x-0 !translate-y-0 !w-full !h-full !max-w-none !max-h-none rounded-none flex flex-col p-0 gap-0 overflow-hidden">
                <DialogHeader className="flex-shrink-0 px-6 pt-5 pb-3 border-b bg-gradient-to-r from-slate-50 to-blue-50/50 dark:from-slate-900 dark:to-blue-950/30">
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-primary" />
                        {isEdit ? 'Şablonu Düzenle' : 'Yeni Kontrol Formu Şablonu'}
                    </DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? 'Değişikliklerden sonra otomatik yeni revizyon oluşturulur. Dokuman No sabit kalır, revizyon no artar.'
                            : 'Şablonu kaydettiğinizde otomatik doküman no (KAL-FR-YYYY-XXXX) atanır.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
                    {loading ? (
                        <div className="text-center py-10 text-muted-foreground">Yükleniyor...</div>
                    ) : (
                        <Tabs value={activeTab} onValueChange={setActiveTab}>
                            <TabsList>
                                <TabsTrigger value="sections">Bölümler & Maddeler</TabsTrigger>
                                <TabsTrigger value="info">Genel Bilgiler</TabsTrigger>
                                <TabsTrigger value="products">Uygulanan Araçlar</TabsTrigger>
                                <TabsTrigger value="header">Başlık Alanları</TabsTrigger>
                            </TabsList>

                            <TabsContent value="info" className="mt-5 space-y-4">
                                {isEdit && (
                                    <div className="grid grid-cols-4 gap-3 p-3 bg-muted/40 rounded-lg border">
                                        <div>
                                            <Label className="text-xs">Doküman No</Label>
                                            <p className="font-mono font-semibold">{template.document_no}</p>
                                        </div>
                                        <div>
                                            <Label className="text-xs">Yayın Tarihi</Label>
                                            <p className="text-sm">{template.publish_date}</p>
                                        </div>
                                        <div>
                                            <Label className="text-xs">Revizyon No</Label>
                                            <p className="text-sm">
                                                <Badge>{String(template.revision_no).padStart(2, '0')}</Badge>
                                            </p>
                                        </div>
                                        <div>
                                            <Label className="text-xs">Rev. Tarihi</Label>
                                            <p className="text-sm">{template.revision_date}</p>
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <Label>Form Adı (*)</Label>
                                    <Input
                                        value={template.name}
                                        onChange={(e) => setTemplate((t) => ({ ...t, name: e.target.value }))}
                                        placeholder="Ör: HSÇK Son Kontrol Formu"
                                    />
                                </div>
                                <div>
                                    <Label>Açıklama</Label>
                                    <Textarea
                                        rows={2}
                                        value={template.description || ''}
                                        onChange={(e) => setTemplate((t) => ({ ...t, description: e.target.value }))}
                                        placeholder="Formun amacı ve kapsamı..."
                                    />
                                </div>
                                <div>
                                    <Label>Referanslar</Label>
                                    <Textarea
                                        rows={2}
                                        value={template.references_text || ''}
                                        onChange={(e) =>
                                            setTemplate((t) => ({ ...t, references_text: e.target.value }))
                                        }
                                        placeholder="Ör: 98/37 AT Makina Emniyeti, TS EN 13019/Ocak 2003..."
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <Label>Yayın Tarihi</Label>
                                        <Input
                                            type="date"
                                            value={template.publish_date || ''}
                                            onChange={(e) =>
                                                setTemplate((t) => ({ ...t, publish_date: e.target.value }))
                                            }
                                        />
                                    </div>
                                    <div className="flex items-end gap-2">
                                        <Checkbox
                                            id="is_active"
                                            checked={template.is_active}
                                            onCheckedChange={(v) =>
                                                setTemplate((t) => ({ ...t, is_active: !!v }))
                                            }
                                        />
                                        <Label htmlFor="is_active">Aktif (kullanıma açık)</Label>
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="products" className="mt-5 space-y-3">
                                <p className="text-sm text-muted-foreground">
                                    Bu şablonu aşağıda seçtiğiniz{' '}
                                    <strong>birden fazla araç/ürüne</strong> aynı anda uygulayabilirsiniz. Bir araç
                                    için madde eklediğinizde, tüm bağlı ürünler için de geçerli olur — tek noktadan
                                    güncelleme!
                                </p>
                                <div className="flex flex-wrap gap-2 min-h-10 p-3 border rounded-md bg-muted/30">
                                    {selectedProducts.length === 0 ? (
                                        <span className="text-sm text-muted-foreground">Henüz ürün seçilmedi.</span>
                                    ) : (
                                        selectedProducts.map((p) => (
                                            <Badge key={p.id} variant="secondary" className="gap-1">
                                                {p.product_name}
                                                <button
                                                    type="button"
                                                    onClick={() => toggleProduct(p.id)}
                                                    className="ml-1 hover:text-destructive"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </Badge>
                                        ))
                                    )}
                                </div>
                                <div className="border rounded-md max-h-72 overflow-y-auto">
                                    {products.length === 0 ? (
                                        <p className="p-4 text-sm text-muted-foreground text-center">
                                            Önce Ayarlar → Ürünler altında araç tipi eklemelisiniz.
                                        </p>
                                    ) : (
                                        products.map((p) => (
                                            <div
                                                key={p.id}
                                                className="flex items-center gap-3 p-2 hover:bg-muted/40 border-b last:border-b-0"
                                            >
                                                <Checkbox
                                                    checked={(template.product_ids || []).includes(p.id)}
                                                    onCheckedChange={() => toggleProduct(p.id)}
                                                />
                                                <div className="flex-1">
                                                    <p className="font-medium text-sm">{p.product_name}</p>
                                                    {p.vehicle_model && (
                                                        <p className="text-xs text-muted-foreground">
                                                            {p.vehicle_model}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </TabsContent>

                            <TabsContent value="header" className="mt-5 space-y-3">
                                <p className="text-sm text-muted-foreground">
                                    Her doldurulmuş formda gösterilecek üst bilgi alanları (Markası, Şase No, Motor
                                    No vb). Varsayılan alanlara ek olarak özel alan ekleyebilirsiniz.
                                </p>
                                <div className="space-y-2">
                                    {(template.header_fields || []).map((f, idx) => (
                                        <div key={idx} className="flex gap-2 items-center">
                                            <Input
                                                className="flex-1"
                                                placeholder="Etiket (ör: Şase No)"
                                                value={f.label || ''}
                                                onChange={(e) =>
                                                    updateHeaderField(idx, { label: e.target.value })
                                                }
                                            />
                                            <Input
                                                className="flex-1 font-mono text-xs"
                                                placeholder="anahtar (ör: sase_no)"
                                                value={f.key || ''}
                                                onChange={(e) => updateHeaderField(idx, { key: e.target.value })}
                                            />
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => deleteHeaderField(idx)}
                                            >
                                                <Trash2 className="w-4 h-4 text-destructive" />
                                            </Button>
                                        </div>
                                    ))}
                                    <Button variant="outline" size="sm" onClick={addHeaderField}>
                                        <Plus className="w-3.5 h-3.5 mr-1" /> Alan Ekle
                                    </Button>
                                </div>
                            </TabsContent>

                            <TabsContent value="sections" className="mt-5 space-y-3">
                                <div className="flex justify-between items-center">
                                    <p className="text-sm text-muted-foreground">
                                        Bölümler (kategoriler) oluşturun ve altlarına kontrol maddelerini ekleyin.
                                        Ölçüm tipi maddelere ölçüm aleti ve referans değer belirleyebilirsiniz.
                                    </p>
                                    <Button size="sm" onClick={addSection}>
                                        <Plus className="w-4 h-4 mr-1" /> Yeni Bölüm
                                    </Button>
                                </div>

                                {sections.length === 0 ? (
                                    <div className="text-center py-10 border border-dashed rounded-md text-muted-foreground">
                                        Henüz bölüm yok. "Yeni Bölüm" ile başlayın.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {sections.map((s, sIdx) => (
                                            <SectionCard
                                                key={s.id}
                                                section={s}
                                                index={sIdx}
                                                total={sections.length}
                                                expanded={expandedSections.has(s.id)}
                                                toggleExpand={() => toggleExpand(s.id)}
                                                updateSection={updateSection}
                                                deleteSection={deleteSection}
                                                moveSection={moveSection}
                                                addItem={addItem}
                                                updateItem={updateItem}
                                                deleteItem={deleteItem}
                                                moveItem={moveItem}
                                                equipments={equipments}
                                            />
                                        ))}
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>
                    )}
                </div>

                <DialogFooter className="flex-shrink-0 px-6 py-3 border-t bg-background">
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
                        İptal
                    </Button>
                    <Button onClick={handleSave} disabled={saving || loading}>
                        <Save className="w-4 h-4 mr-2" />
                        {saving ? 'Kaydediliyor...' : isEdit ? 'Güncelle & Revizyon Oluştur' : 'Şablonu Kaydet'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const SectionCard = ({
    section,
    index,
    total,
    expanded,
    toggleExpand,
    updateSection,
    deleteSection,
    moveSection,
    addItem,
    updateItem,
    deleteItem,
    moveItem,
    equipments,
}) => {
    return (
        <div className="border rounded-lg overflow-hidden bg-card">
            <div className="flex items-center gap-2 p-3 bg-muted/40 border-b">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleExpand}>
                    {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </Button>
                <span className="text-xs font-semibold text-muted-foreground w-6">#{index + 1}</span>
                <Input
                    className="flex-1 font-semibold"
                    placeholder="Bölüm adı (örn: HSÇK Mekanik Çalışma Kontrolleri)"
                    value={section.name}
                    onChange={(e) => updateSection(section.id, { name: e.target.value })}
                />
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={index === 0}
                        onClick={() => moveSection(section.id, 'up')}
                    >
                        <ArrowUp className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={index === total - 1}
                        onClick={() => moveSection(section.id, 'down')}
                    >
                        <ArrowDown className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => deleteSection(section.id)}
                    >
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                </div>
            </div>
            {expanded && (
                <div className="p-3 space-y-2">
                    {section.items.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">Henüz madde eklenmemiş.</p>
                    ) : (
                        section.items.map((item, iIdx) => (
                            <ItemRow
                                key={item.id}
                                item={item}
                                index={iIdx}
                                total={section.items.length}
                                updateItem={(patch) => updateItem(section.id, item.id, patch)}
                                deleteItem={() => deleteItem(section.id, item.id)}
                                moveItem={(d) => moveItem(section.id, item.id, d)}
                                equipments={equipments}
                            />
                        ))
                    )}
                    <div className="pt-1">
                        <Button variant="outline" size="sm" onClick={() => addItem(section.id)}>
                            <Plus className="w-3.5 h-3.5 mr-1" /> Madde Ekle
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

const ItemRow = ({ item, index, total, updateItem, deleteItem, moveItem, equipments }) => {
    const isMeasurement = item.item_type === 'measurement';
    return (
        <div className="border rounded-md p-2.5 bg-background hover:bg-muted/20">
            <div className="flex gap-2 items-start">
                <span className="text-xs font-semibold text-muted-foreground pt-2 w-6 text-center">{index + 1}</span>
                <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                        <Input
                            className="flex-1"
                            placeholder="Kontrol maddesi metni..."
                            value={item.text}
                            onChange={(e) => updateItem({ text: e.target.value })}
                        />
                        <Select
                            value={item.item_type}
                            onValueChange={(v) =>
                                updateItem({
                                    item_type: v,
                                    ...(v === 'visual'
                                        ? { reference_value: '', unit: '', measurement_equipment_id: null, measurement_equipment_name: '' }
                                        : {}),
                                })
                            }
                        >
                            <SelectTrigger className="w-40">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="visual">
                                    <div className="flex items-center gap-2">
                                        <CheckSquare className="w-3.5 h-3.5" />
                                        <span>Görsel (Kabul/Ret)</span>
                                    </div>
                                </SelectItem>
                                <SelectItem value="measurement">
                                    <div className="flex items-center gap-2">
                                        <Ruler className="w-3.5 h-3.5" />
                                        <span>Ölçüm (Referans + Cihaz)</span>
                                    </div>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {isMeasurement && (
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 pl-1">
                            <div className="md:col-span-5">
                                <Label className="text-[11px]">Ölçüm Aleti</Label>
                                <EquipmentPicker
                                    equipmentId={item.measurement_equipment_id}
                                    equipmentName={item.measurement_equipment_name}
                                    equipments={equipments}
                                    onSelect={(eq) =>
                                        updateItem({
                                            measurement_equipment_id: eq?.id || null,
                                            measurement_equipment_name: eq
                                                ? `${eq.name}${eq.brand_model ? ' ' + eq.brand_model : ''}`
                                                : '',
                                        })
                                    }
                                    onClear={() =>
                                        updateItem({
                                            measurement_equipment_id: null,
                                            measurement_equipment_name: '',
                                        })
                                    }
                                    onManualChange={(v) => updateItem({ measurement_equipment_name: v })}
                                />
                            </div>
                            <div className="md:col-span-4">
                                <Label className="text-[11px]">Referans Değer</Label>
                                <Input
                                    placeholder="Ör: 6 mm, Max 25 sn, 180 bar"
                                    value={item.reference_value || ''}
                                    onChange={(e) => updateItem({ reference_value: e.target.value })}
                                />
                            </div>
                            <div className="md:col-span-3">
                                <Label className="text-[11px]">Birim (ops.)</Label>
                                <Input
                                    placeholder="mm / bar / sn"
                                    value={item.unit || ''}
                                    onChange={(e) => updateItem({ unit: e.target.value })}
                                />
                            </div>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-1 pt-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={index === 0}
                        onClick={() => moveItem('up')}
                    >
                        <ArrowUp className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={index === total - 1}
                        onClick={() => moveItem('down')}
                    >
                        <ArrowDown className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={deleteItem}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                </div>
            </div>
        </div>
    );
};

const EquipmentPicker = ({ equipmentId, equipmentName, equipments, onSelect, onClear, onManualChange }) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');

    const filtered = useMemo(() => {
        const q = query.trim().toLocaleLowerCase('tr-TR');
        if (!q) return equipments.slice(0, 100);
        return equipments
            .filter(
                (e) =>
                    (e.name || '').toLocaleLowerCase('tr-TR').includes(q) ||
                    (e.brand_model || '').toLocaleLowerCase('tr-TR').includes(q) ||
                    (e.category || '').toLocaleLowerCase('tr-TR').includes(q)
            )
            .slice(0, 100);
    }, [query, equipments]);

    return (
        <div className="flex gap-1">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button variant="outline" className="flex-1 justify-start font-normal" size="sm">
                        <Wrench className="w-3.5 h-3.5 mr-1.5" />
                        <span className="truncate">{equipmentName || 'Cihaz seç veya ara...'}</span>
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-96 p-0">
                    <div className="p-2 border-b">
                        <Input
                            placeholder="Cihaz ara..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                        {filtered.length === 0 ? (
                            <p className="p-4 text-sm text-muted-foreground text-center">Cihaz bulunamadı.</p>
                        ) : (
                            filtered.map((eq) => (
                                <button
                                    key={eq.id}
                                    type="button"
                                    className="w-full text-left p-2 hover:bg-muted/60 border-b last:border-b-0"
                                    onClick={() => {
                                        onSelect(eq);
                                        setOpen(false);
                                    }}
                                >
                                    <p className="font-medium text-sm">{eq.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {eq.brand_model && <span>{eq.brand_model}</span>}
                                        {eq.serial_number && <span> • SN: {eq.serial_number}</span>}
                                        {eq.category && <span> • {eq.category}</span>}
                                    </p>
                                </button>
                            ))
                        )}
                        <div className="p-2 border-t bg-muted/40">
                            <p className="text-xs text-muted-foreground mb-1">
                                Listeden değilse serbest metin girebilirsiniz:
                            </p>
                            <Input
                                placeholder="Manuel cihaz adı"
                                value={equipmentId ? '' : equipmentName || ''}
                                onChange={(e) => {
                                    if (equipmentId) {
                                        onClear();
                                    }
                                    onManualChange(e.target.value);
                                }}
                                onKeyDown={(e) => e.key === 'Enter' && setOpen(false)}
                            />
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
            {(equipmentId || equipmentName) && (
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={onClear}>
                    <X className="w-3.5 h-3.5" />
                </Button>
            )}
        </div>
    );
};

export default TemplateEditorModal;
