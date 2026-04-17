import React, { useState, useEffect, useMemo } from 'react';
import { Layers, Wrench, CheckSquare, Ruler, X, Check, ChevronsUpDown, Plus } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
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
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';

const BulkAddItemModal = ({ open, setOpen, selectedTemplates, onDone }) => {
    const { toast } = useToast();
    const [saving, setSaving] = useState(false);
    const [equipments, setEquipments] = useState([]);
    const [existingSections, setExistingSections] = useState([]);
    const [form, setForm] = useState({
        section_name: '',
        item_text: '',
        item_type: 'visual',
        reference_value: '',
        unit: '',
        measurement_equipment_id: null,
        measurement_equipment_name: '',
    });
    const [eqPopOpen, setEqPopOpen] = useState(false);
    const [eqQuery, setEqQuery] = useState('');
    const [sectionPopOpen, setSectionPopOpen] = useState(false);
    const [sectionQuery, setSectionQuery] = useState('');

    useEffect(() => {
        if (!open) return;
        setForm({
            section_name: '',
            item_text: '',
            item_type: 'visual',
            reference_value: '',
            unit: '',
            measurement_equipment_id: null,
            measurement_equipment_name: '',
        });
        setSectionQuery('');
        (async () => {
            const [eqRes, secRes] = await Promise.all([
                supabase
                    .from('equipments')
                    .select('id, name, brand_model, serial_number, category')
                    .neq('status', 'Hurda')
                    .order('name'),
                selectedTemplates?.length
                    ? supabase
                          .from('control_form_sections')
                          .select('name, template_id')
                          .in('template_id', selectedTemplates.map((t) => t.id))
                    : Promise.resolve({ data: [] }),
            ]);
            setEquipments(eqRes.data || []);
            const counts = new Map();
            (secRes.data || []).forEach((s) => {
                counts.set(s.name, (counts.get(s.name) || 0) + 1);
            });
            const arr = Array.from(counts.entries())
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'tr'));
            setExistingSections(arr);
        })();
    }, [open, selectedTemplates]);

    const filteredSections = useMemo(() => {
        const q = sectionQuery.trim().toLocaleLowerCase('tr-TR');
        if (!q) return existingSections;
        return existingSections.filter((s) => s.name.toLocaleLowerCase('tr-TR').includes(q));
    }, [existingSections, sectionQuery]);

    const totalTemplates = selectedTemplates?.length || 0;

    const filteredEq = equipments.filter((e) => {
        const q = eqQuery.trim().toLocaleLowerCase('tr-TR');
        if (!q) return true;
        return (
            (e.name || '').toLocaleLowerCase('tr-TR').includes(q) ||
            (e.brand_model || '').toLocaleLowerCase('tr-TR').includes(q)
        );
    }).slice(0, 100);

    const handleApply = async () => {
        if (!form.section_name.trim() || !form.item_text.trim()) {
            toast({
                variant: 'destructive',
                title: 'Eksik Bilgi',
                description: 'Bölüm adı ve madde metni zorunludur.',
            });
            return;
        }
        setSaving(true);
        try {
            const { data, error } = await supabase.rpc('bulk_add_item_to_templates', {
                p_template_ids: selectedTemplates.map((t) => t.id),
                p_section_name: form.section_name.trim(),
                p_item_text: form.item_text.trim(),
                p_item_type: form.item_type,
                p_reference_value: form.reference_value?.trim() || null,
                p_unit: form.unit?.trim() || null,
                p_measurement_equipment_id: form.measurement_equipment_id || null,
                p_measurement_equipment_name: form.measurement_equipment_name?.trim() || null,
            });
            if (error) throw error;
            toast({
                title: 'Başarılı',
                description: `${data} şablona madde eklendi ve revizyonlar arttırıldı.`,
            });
            onDone?.();
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Toplu ekleme başarısız: ' + err.message,
            });
        } finally {
            setSaving(false);
        }
    };

    const isMeasurement = form.item_type === 'measurement';

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="!inset-0 !translate-x-0 !translate-y-0 !w-full !h-full !max-w-none !max-h-none rounded-none flex flex-col p-0 gap-0">
                <DialogHeader className="px-6 py-4 border-b bg-background sticky top-0 z-10">
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Layers className="w-5 h-5 text-primary" />
                        Toplu Madde Ekleme
                    </DialogTitle>
                    <DialogDescription>
                        Aşağıdaki maddeyi seçili <strong>{totalTemplates} şablonun</strong> belirttiğiniz
                        bölümüne ekleyeceğiz. Mevcut bir bölümü seçebilir veya yeni bölüm adı yazabilirsiniz.
                        Bölüm her şablonda otomatik oluşur (yoksa) ve her şablonda yeni bir revizyon oluşturulur.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6">
                    <div className="max-w-4xl mx-auto space-y-4">
                    <div className="p-3 rounded-md border bg-muted/40">
                        <p className="text-xs font-medium mb-2">Uygulanacak şablonlar ({totalTemplates}):</p>
                        <div className="flex flex-wrap gap-1.5">
                            {selectedTemplates.map((t) => (
                                <Badge key={t.id} variant="secondary" className="text-[11px]">
                                    {t.name} <span className="opacity-60 ml-1">({t.document_no})</span>
                                </Badge>
                            ))}
                        </div>
                    </div>

                    <div>
                        <Label>Bölüm Adı (*)</Label>
                        <div className="flex gap-2">
                            <Popover open={sectionPopOpen} onOpenChange={setSectionPopOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        type="button"
                                        className="flex-1 justify-between font-normal"
                                    >
                                        <span className="truncate text-left">
                                            {form.section_name || 'Mevcut bölümlerden seç veya yeni yaz...'}
                                        </span>
                                        <ChevronsUpDown className="w-3.5 h-3.5 opacity-60 ml-2 shrink-0" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[520px] p-0" align="start">
                                    <div className="p-2 border-b">
                                        <Input
                                            placeholder="Bölüm ara veya yeni bölüm adı yaz..."
                                            value={sectionQuery}
                                            onChange={(e) => setSectionQuery(e.target.value)}
                                            autoFocus
                                        />
                                    </div>
                                    <div className="max-h-[320px] overflow-y-auto">
                                        {sectionQuery.trim() && !filteredSections.some((s) => s.name === sectionQuery.trim()) && (
                                            <button
                                                type="button"
                                                className="w-full text-left p-2.5 hover:bg-primary/5 border-b flex items-center gap-2"
                                                onClick={() => {
                                                    setForm({ ...form, section_name: sectionQuery.trim() });
                                                    setSectionPopOpen(false);
                                                }}
                                            >
                                                <Plus className="w-4 h-4 text-primary" />
                                                <span className="text-sm">
                                                    Yeni bölüm: <strong>{sectionQuery.trim()}</strong>
                                                </span>
                                            </button>
                                        )}
                                        {filteredSections.length === 0 && !sectionQuery.trim() ? (
                                            <p className="p-4 text-sm text-muted-foreground text-center">
                                                Seçili şablonlarda henüz bölüm yok. Yeni bölüm adı yazın.
                                            </p>
                                        ) : (
                                            filteredSections.map((s) => (
                                                <button
                                                    key={s.name}
                                                    type="button"
                                                    className="w-full text-left p-2.5 hover:bg-muted/60 border-b flex items-center justify-between"
                                                    onClick={() => {
                                                        setForm({ ...form, section_name: s.name });
                                                        setSectionPopOpen(false);
                                                    }}
                                                >
                                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                                        {form.section_name === s.name && (
                                                            <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                                                        )}
                                                        <span className="text-sm truncate">{s.name}</span>
                                                    </div>
                                                    <Badge variant="outline" className="text-[10px] ml-2 shrink-0">
                                                        {s.count}/{totalTemplates} şablonda
                                                    </Badge>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </PopoverContent>
                            </Popover>
                            {form.section_name && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setForm({ ...form, section_name: '' })}
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">
                            Var olan bölüm adını seçerseniz, o ismi taşıyan mevcut bölümlere madde eklenir.
                            Yeni bir isim yazarsanız, o bölüm şablonlarda otomatik oluşturulur.
                        </p>
                    </div>

                    <div>
                        <Label>Madde Metni (*)</Label>
                        <Input
                            placeholder="Ör: Arka kapak emniyet dayaması montaj kontrolü"
                            value={form.item_text}
                            onChange={(e) => setForm({ ...form, item_text: e.target.value })}
                        />
                    </div>

                    <div>
                        <Label>Madde Tipi</Label>
                        <Select
                            value={form.item_type}
                            onValueChange={(v) => setForm({ ...form, item_type: v })}
                        >
                            <SelectTrigger>
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
                        <>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label>Referans Değer</Label>
                                    <Input
                                        placeholder="Ör: 6 mm, Max 25 sn"
                                        value={form.reference_value}
                                        onChange={(e) =>
                                            setForm({ ...form, reference_value: e.target.value })
                                        }
                                    />
                                </div>
                                <div>
                                    <Label>Birim</Label>
                                    <Input
                                        placeholder="mm / bar / sn"
                                        value={form.unit}
                                        onChange={(e) => setForm({ ...form, unit: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <Label>Ölçüm Aleti</Label>
                                <div className="flex gap-1">
                                    <Popover open={eqPopOpen} onOpenChange={setEqPopOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className="flex-1 justify-start font-normal"
                                                size="sm"
                                            >
                                                <Wrench className="w-3.5 h-3.5 mr-2" />
                                                <span className="truncate">
                                                    {form.measurement_equipment_name || 'Cihaz seç veya yaz...'}
                                                </span>
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-96 p-0">
                                            <div className="p-2 border-b">
                                                <Input
                                                    placeholder="Cihaz ara..."
                                                    value={eqQuery}
                                                    onChange={(e) => setEqQuery(e.target.value)}
                                                    autoFocus
                                                />
                                            </div>
                                            <div className="max-h-64 overflow-y-auto">
                                                {filteredEq.length === 0 ? (
                                                    <p className="p-4 text-sm text-muted-foreground text-center">
                                                        Cihaz bulunamadı.
                                                    </p>
                                                ) : (
                                                    filteredEq.map((eq) => (
                                                        <button
                                                            key={eq.id}
                                                            type="button"
                                                            className="w-full text-left p-2 hover:bg-muted/60 border-b"
                                                            onClick={() => {
                                                                setForm({
                                                                    ...form,
                                                                    measurement_equipment_id: eq.id,
                                                                    measurement_equipment_name: `${eq.name}${
                                                                        eq.brand_model ? ' ' + eq.brand_model : ''
                                                                    }`,
                                                                });
                                                                setEqPopOpen(false);
                                                            }}
                                                        >
                                                            <p className="font-medium text-sm">{eq.name}</p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {eq.brand_model} {eq.category && `• ${eq.category}`}
                                                            </p>
                                                        </button>
                                                    ))
                                                )}
                                                <div className="p-2 border-t bg-muted/40">
                                                    <p className="text-xs text-muted-foreground mb-1">
                                                        Manuel cihaz adı:
                                                    </p>
                                                    <Input
                                                        placeholder="Ör: Ultrasonik kalınlık ölçer"
                                                        value={
                                                            form.measurement_equipment_id
                                                                ? ''
                                                                : form.measurement_equipment_name || ''
                                                        }
                                                        onChange={(e) =>
                                                            setForm({
                                                                ...form,
                                                                measurement_equipment_id: null,
                                                                measurement_equipment_name: e.target.value,
                                                            })
                                                        }
                                                    />
                                                </div>
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                    {(form.measurement_equipment_id || form.measurement_equipment_name) && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-9 w-9"
                                            onClick={() =>
                                                setForm({
                                                    ...form,
                                                    measurement_equipment_id: null,
                                                    measurement_equipment_name: '',
                                                })
                                            }
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                    </div>
                </div>

                <DialogFooter className="px-6 py-4 border-t bg-background sticky bottom-0 z-10">
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
                        İptal
                    </Button>
                    <Button onClick={handleApply} disabled={saving}>
                        <Layers className="w-4 h-4 mr-2" />
                        {saving ? 'Uygulanıyor...' : `${totalTemplates} Şablona Uygula`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default BulkAddItemModal;
