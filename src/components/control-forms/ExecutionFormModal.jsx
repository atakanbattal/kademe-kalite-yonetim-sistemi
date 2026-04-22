import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Save, Check, X, FileCheck2, Printer } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { generateControlFormPdf } from '@/lib/controlFormPdfGenerator';
import { sortControlFormSections } from '@/lib/controlFormSectionSort';

const ExecutionFormModal = ({ open, setOpen, executionId, onSaved }) => {
    const { toast } = useToast();
    const { user } = useAuth();
    const isEdit = !!executionId;

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const [templates, setTemplates] = useState([]);
    const [products, setProducts] = useState([]);
    const [template, setTemplate] = useState(null);
    const [activeTab, setActiveTab] = useState('info');

    const [execution, setExecution] = useState({
        id: null,
        template_id: '',
        template_revision_no: 0,
        product_id: null,
        product_name: '',
        serial_number: '',
        chassis_no: '',
        customer: '',
        inspection_date: new Date().toISOString().slice(0, 10),
        shipment_date: null,
        header_data: {},
        result: null,
        result_date: null,
        inspector_name: '',
        inspector_notes: '',
        missing_items: '',
    });

    // results: { [item_id]: { result, measured_value, notes } }
    const [results, setResults] = useState({});

    const loadTemplates = useCallback(async () => {
        const { data, error } = await supabase
            .from('control_form_templates')
            .select('id, document_no, name, revision_no, product_ids')
            .eq('is_active', true)
            .order('name');
        if (!error) setTemplates(data || []);
    }, []);

    const loadProducts = useCallback(async () => {
        const { data: vehicleCategory } = await supabase
            .from('product_categories')
            .select('id')
            .eq('category_code', 'VEHICLE_TYPES')
            .single();

        let query = supabase
            .from('products')
            .select('id, product_name, product_code, vehicle_model')
            .eq('is_active', true)
            .order('product_name');

        if (vehicleCategory?.id) {
            query = query.eq('category_id', vehicleCategory.id);
        }

        const { data, error } = await query;
        if (!error) setProducts(data || []);
    }, []);

    const loadFullTemplate = useCallback(async (templateId) => {
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
    }, []);

    const loadExecution = useCallback(async () => {
        if (!isEdit) return;
        setLoading(true);
        try {
            const { data: exec, error } = await supabase
                .from('control_form_executions')
                .select('*')
                .eq('id', executionId)
                .single();
            if (error) throw error;

            setExecution({
                id: exec.id,
                template_id: exec.template_id,
                template_revision_no: exec.template_revision_no,
                product_id: exec.product_id,
                product_name: exec.product_name || '',
                serial_number: exec.serial_number || '',
                chassis_no: exec.chassis_no || '',
                customer: exec.customer || '',
                inspection_date: exec.inspection_date,
                shipment_date: exec.shipment_date,
                header_data: exec.header_data || {},
                result: exec.result,
                result_date: exec.result_date,
                inspector_name: exec.inspector_name || '',
                inspector_notes: exec.inspector_notes || '',
                missing_items: exec.missing_items || '',
            });

            const tpl = await loadFullTemplate(exec.template_id);
            setTemplate(tpl);

            const { data: rows, error: rErr } = await supabase
                .from('control_form_execution_results')
                .select('*')
                .eq('execution_id', executionId);
            if (rErr) throw rErr;

            const map = {};
            (rows || []).forEach((r) => {
                if (r.item_id) {
                    map[r.item_id] = {
                        result: r.result,
                        measured_value: r.measured_value || '',
                        notes: r.notes || '',
                    };
                }
            });
            setResults(map);
        } catch (err) {
            toast({ variant: 'destructive', title: 'Hata', description: err.message });
        } finally {
            setLoading(false);
        }
    }, [isEdit, executionId, toast, loadFullTemplate]);

    useEffect(() => {
        if (!open) return;
        loadTemplates();
        loadProducts();
        if (isEdit) loadExecution();
        else {
            setExecution({
                id: null,
                template_id: '',
                template_revision_no: 0,
                product_id: null,
                product_name: '',
                serial_number: '',
                chassis_no: '',
                customer: '',
                inspection_date: new Date().toISOString().slice(0, 10),
                shipment_date: null,
                header_data: {},
                result: null,
                result_date: null,
                inspector_name: '',
                inspector_notes: '',
                missing_items: '',
            });
            setTemplate(null);
            setResults({});
            setActiveTab('info');
        }
    }, [open, isEdit, loadTemplates, loadProducts, loadExecution]);

    const handleTemplateChange = async (templateId) => {
        try {
            setLoading(true);
            const tpl = await loadFullTemplate(templateId);
            setTemplate(tpl);
            setExecution((e) => ({
                ...e,
                template_id: templateId,
                template_revision_no: tpl.revision_no || 0,
            }));
            setResults({});
        } catch (err) {
            toast({ variant: 'destructive', title: 'Hata', description: err.message });
        } finally {
            setLoading(false);
        }
    };

    const handleProductChange = (productId) => {
        const p = products.find((x) => x.id === productId);
        setExecution((e) => ({
            ...e,
            product_id: productId,
            product_name: p?.product_name || '',
        }));
    };

    const updateResult = (itemId, patch) => {
        setResults((r) => ({ ...r, [itemId]: { ...(r[itemId] || {}), ...patch } }));
    };

    const totalCounts = useMemo(() => {
        if (!template) return { total: 0, accept: 0, reject: 0, pending: 0 };
        let total = 0;
        let accept = 0;
        let reject = 0;
        template.sections.forEach((s) =>
            s.items.forEach((i) => {
                total++;
                const r = results[i.id];
                if (r?.result === 'accept') accept++;
                else if (r?.result === 'reject') reject++;
            })
        );
        return { total, accept, reject, pending: total - accept - reject };
    }, [template, results]);

    const handleSave = async (alsoPrint = false) => {
        if (!execution.template_id) {
            toast({ variant: 'destructive', title: 'Eksik', description: 'Şablon seçin.' });
            return;
        }
        setSaving(true);
        try {
            let execIdLocal = execution.id;
            const payload = {
                template_id: execution.template_id,
                template_revision_no: execution.template_revision_no,
                product_id: execution.product_id || null,
                product_name: execution.product_name || null,
                serial_number: execution.serial_number || null,
                chassis_no: execution.chassis_no || null,
                customer: execution.customer || null,
                inspection_date: execution.inspection_date,
                shipment_date: execution.shipment_date || null,
                header_data: execution.header_data || {},
                result: execution.result || null,
                result_date: execution.result_date || null,
                inspector_name: execution.inspector_name || null,
                inspector_notes: execution.inspector_notes || null,
                missing_items: execution.missing_items || null,
            };

            if (isEdit) {
                const { error } = await supabase
                    .from('control_form_executions')
                    .update(payload)
                    .eq('id', execIdLocal);
                if (error) throw error;
            } else {
                const { data, error } = await supabase
                    .from('control_form_executions')
                    .insert({ ...payload, created_by: user?.id || null })
                    .select()
                    .single();
                if (error) throw error;
                execIdLocal = data.id;
            }

            // Eski sonuçları sil, yenilerini yaz
            await supabase.from('control_form_execution_results').delete().eq('execution_id', execIdLocal);

            if (template) {
                const rows = [];
                template.sections.forEach((s, sIdx) => {
                    s.items.forEach((i, iIdx) => {
                        const r = results[i.id] || {};
                        rows.push({
                            execution_id: execIdLocal,
                            item_id: i.id,
                            section_name: s.name,
                            item_text: i.text,
                            item_type: i.item_type,
                            reference_value: i.reference_value || null,
                            measured_value: r.measured_value || null,
                            result: r.result || null,
                            notes: r.notes || null,
                            order_index: sIdx * 1000 + iIdx,
                        });
                    });
                });
                if (rows.length > 0) {
                    const { error } = await supabase.from('control_form_execution_results').insert(rows);
                    if (error) throw error;
                }
            }

            toast({ title: 'Kaydedildi', description: 'Kontrol kaydı başarıyla kaydedildi.' });
            onSaved?.();

            if (alsoPrint && template) {
                await generateControlFormPdf({
                    template,
                    execution: { ...execution, id: execIdLocal },
                    results,
                    mode: 'filled',
                    action: 'print',
                });
            }

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
                        <FileCheck2 className="w-5 h-5 text-primary" />
                        {isEdit ? 'Kontrol Kaydını Düzenle' : 'Yeni Kontrol Kaydı'}
                    </DialogTitle>
                    <DialogDescription>
                        Kontrol formunu doldurun. Her madde için Kabul/Ret seçin, ölçüm maddelerinde ölçülen değeri
                        girin. PDF çıktısı alabilirsiniz.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList>
                            <TabsTrigger value="info">Genel Bilgiler</TabsTrigger>
                            <TabsTrigger value="fill" disabled={!template}>
                                Kontrol Maddeleri
                                {template && (
                                    <Badge variant="secondary" className="ml-2">
                                        {totalCounts.total}
                                    </Badge>
                                )}
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="info" className="mt-5 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <Label>Kontrol Formu Şablonu (*)</Label>
                                    <Select
                                        value={execution.template_id || ''}
                                        onValueChange={handleTemplateChange}
                                        disabled={isEdit}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Şablon seç..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {templates.map((t) => (
                                                <SelectItem key={t.id} value={t.id}>
                                                    {t.name} ({t.document_no} - Rev{' '}
                                                    {String(t.revision_no).padStart(2, '0')})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {template && (
                                        <p className="text-[11px] text-muted-foreground mt-1">
                                            Rev {String(template.revision_no).padStart(2, '0')} •{' '}
                                            {template.document_no}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <Label>Ürün / Araç Tipi</Label>
                                    <Select
                                        value={execution.product_id || ''}
                                        onValueChange={handleProductChange}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Ürün seç..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {products.map((p) => (
                                                <SelectItem key={p.id} value={p.id}>
                                                    {p.product_name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                    <Label>Seri Numarası</Label>
                                    <Input autoFormat={false}
                                        value={execution.serial_number || ''}
                                        onChange={(e) =>
                                            setExecution((x) => ({ ...x, serial_number: e.target.value }))
                                        }
                                    />
                                </div>
                                <div>
                                    <Label>Şase No</Label>
                                    <Input autoFormat={false}
                                        value={execution.chassis_no || ''}
                                        onChange={(e) =>
                                            setExecution((x) => ({ ...x, chassis_no: e.target.value }))
                                        }
                                    />
                                </div>
                                <div>
                                    <Label>Müşteri / Kurum</Label>
                                    <Input autoFormat={false}
                                        value={execution.customer || ''}
                                        onChange={(e) =>
                                            setExecution((x) => ({ ...x, customer: e.target.value }))
                                        }
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <Label>Kontrol Tarihi</Label>
                                    <Input autoFormat={false}
                                        type="date"
                                        value={execution.inspection_date || ''}
                                        onChange={(e) =>
                                            setExecution((x) => ({ ...x, inspection_date: e.target.value }))
                                        }
                                    />
                                </div>
                                <div>
                                    <Label>Sevk Tarihi</Label>
                                    <Input autoFormat={false}
                                        type="date"
                                        value={execution.shipment_date || ''}
                                        onChange={(e) =>
                                            setExecution((x) => ({ ...x, shipment_date: e.target.value || null }))
                                        }
                                    />
                                </div>
                            </div>

                            {Array.isArray(template?.header_fields) && template.header_fields.length > 0 && (
                                <div className="space-y-3 pt-2 border-t">
                                    <p className="text-sm font-semibold">Şablona Özel Başlık Alanları</p>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        {template.header_fields.map((f) => (
                                            <div key={f.key}>
                                                <Label>{f.label}</Label>
                                                <Input autoFormat={false}
                                                    value={execution.header_data?.[f.key] || ''}
                                                    onChange={(e) =>
                                                        setExecution((x) => ({
                                                            ...x,
                                                            header_data: {
                                                                ...(x.header_data || {}),
                                                                [f.key]: e.target.value,
                                                            },
                                                        }))
                                                    }
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-3 pt-2 border-t">
                                <p className="text-sm font-semibold">Kontrol Eden & Notlar</p>
                                <div>
                                    <Label>Kontrol Eden</Label>
                                    <Input autoFormat={false}
                                        value={execution.inspector_name || ''}
                                        onChange={(e) =>
                                            setExecution((x) => ({ ...x, inspector_name: e.target.value }))
                                        }
                                        placeholder="İsim Soyisim"
                                    />
                                </div>
                                <div>
                                    <Label>Eksikler / Genel Notlar</Label>
                                    <Textarea
                                        rows={3}
                                        value={execution.missing_items || ''}
                                        onChange={(e) =>
                                            setExecution((x) => ({ ...x, missing_items: e.target.value }))
                                        }
                                        placeholder="PDF'de Eksikler alanına yansır."
                                    />
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="fill" className="mt-5 space-y-4">
                            {!template ? (
                                <p className="text-center py-10 text-muted-foreground">Önce şablon seçin.</p>
                            ) : (
                                <>
                                    <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg border text-sm">
                                        <span>Toplam: {totalCounts.total}</span>
                                        <span className="text-green-700">Kabul: {totalCounts.accept}</span>
                                        <span className="text-red-700">Ret: {totalCounts.reject}</span>
                                        <span className="text-muted-foreground">Bekleyen: {totalCounts.pending}</span>
                                        <div className="flex gap-1 ml-auto">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    const all = {};
                                                    template.sections.forEach((s) =>
                                                        s.items.forEach((i) => {
                                                            all[i.id] = { ...(results[i.id] || {}), result: 'accept' };
                                                        })
                                                    );
                                                    setResults(all);
                                                }}
                                            >
                                                Tümüne Kabul
                                            </Button>
                                        </div>
                                    </div>

                                    {template.sections.map((s) => (
                                        <div key={s.id} className="border rounded-md overflow-hidden">
                                            <div className="px-3 py-2 bg-blue-50 border-b font-semibold text-sm text-blue-900">
                                                {s.name}
                                            </div>
                                            <div className="divide-y">
                                                {s.items.map((item, idx) => {
                                                    const r = results[item.id] || {};
                                                    const isMeas = item.item_type === 'measurement';
                                                    return (
                                                        <div
                                                            key={item.id}
                                                            className="p-3 flex gap-3 items-start hover:bg-muted/20"
                                                        >
                                                            <span className="text-xs font-mono text-muted-foreground pt-1 w-6 text-right">
                                                                {idx + 1}.
                                                            </span>
                                                            <div className="flex-1">
                                                                <p className="text-sm font-medium">{item.text}</p>
                                                                {isMeas && (
                                                                    <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                                                                        {item.measurement_equipment_name && (
                                                                            <span>
                                                                                🔧 {item.measurement_equipment_name}
                                                                            </span>
                                                                        )}
                                                                        {item.reference_value && (
                                                                            <span>
                                                                                📏 Ref:{' '}
                                                                                <strong>
                                                                                    {item.reference_value}
                                                                                    {item.unit
                                                                                        ? ` ${item.unit}`
                                                                                        : ''}
                                                                                </strong>
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                                <div className="flex gap-2 mt-2 flex-wrap items-center">
                                                                    {isMeas && (
                                                                        <Input autoFormat={false}
                                                                            className="w-36 h-8 text-xs"
                                                                            placeholder="Ölçülen"
                                                                            value={r.measured_value || ''}
                                                                            onChange={(e) =>
                                                                                updateResult(item.id, {
                                                                                    measured_value: e.target.value,
                                                                                })
                                                                            }
                                                                        />
                                                                    )}
                                                                    <Input autoFormat={false}
                                                                        className="flex-1 min-w-[120px] h-8 text-xs"
                                                                        placeholder="Açıklama (ops.)"
                                                                        value={r.notes || ''}
                                                                        onChange={(e) =>
                                                                            updateResult(item.id, {
                                                                                notes: e.target.value,
                                                                            })
                                                                        }
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-1">
                                                                <Button
                                                                    variant={
                                                                        r.result === 'accept' ? 'default' : 'outline'
                                                                    }
                                                                    size="sm"
                                                                    className={
                                                                        r.result === 'accept'
                                                                            ? 'bg-green-600 hover:bg-green-700 border-green-700'
                                                                            : ''
                                                                    }
                                                                    onClick={() =>
                                                                        updateResult(item.id, {
                                                                            result:
                                                                                r.result === 'accept'
                                                                                    ? null
                                                                                    : 'accept',
                                                                        })
                                                                    }
                                                                >
                                                                    <Check className="w-3.5 h-3.5 mr-1" /> Kabul
                                                                </Button>
                                                                <Button
                                                                    variant={
                                                                        r.result === 'reject' ? 'default' : 'outline'
                                                                    }
                                                                    size="sm"
                                                                    className={
                                                                        r.result === 'reject'
                                                                            ? 'bg-red-600 hover:bg-red-700'
                                                                            : ''
                                                                    }
                                                                    onClick={() =>
                                                                        updateResult(item.id, {
                                                                            result:
                                                                                r.result === 'reject'
                                                                                    ? null
                                                                                    : 'reject',
                                                                        })
                                                                    }
                                                                >
                                                                    <X className="w-3.5 h-3.5 mr-1" /> Ret
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </>
                            )}
                        </TabsContent>

                    </Tabs>
                </div>

                <DialogFooter className="flex-shrink-0 px-6 py-3 border-t bg-background">
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
                        İptal
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={() => handleSave(true)}
                        disabled={saving || loading || !execution.template_id}
                    >
                        <Printer className="w-4 h-4 mr-2" />
                        {saving ? 'Kaydediliyor...' : 'Kaydet + PDF Yazdır'}
                    </Button>
                    <Button onClick={() => handleSave(false)} disabled={saving || loading || !execution.template_id}>
                        <Save className="w-4 h-4 mr-2" />
                        Kaydet
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ExecutionFormModal;
