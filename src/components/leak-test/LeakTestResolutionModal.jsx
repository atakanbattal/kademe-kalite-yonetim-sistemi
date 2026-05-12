import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    CalendarDays,
    CheckCircle2,
    Droplets,
    ShieldCheck,
    User as UserIcon,
} from 'lucide-react';

import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelectDialog } from '@/components/ui/searchable-select-dialog';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';

import {
    LEAK_RESOLUTION_STATUS,
    LEAK_RESOLUTION_STATUS_OPTIONS,
    LEAK_RESOLUTION_TYPE_OPTIONS,
    formatTestDate,
    getVehicleTypeLabel,
} from './utils';

const INITIAL_FORM = {
    resolution_status: '',
    resolution_type: '',
    resolution_notes: '',
    resolution_date: new Date().toISOString().split('T')[0],
    resolved_by_personnel_id: '',
    resolved_by_name: '',
};

const statusColorClass = (status) => {
    if (status === LEAK_RESOLUTION_STATUS.RESOLVED) return 'text-emerald-700 border-emerald-300 bg-emerald-50';
    if (status === LEAK_RESOLUTION_STATUS.IN_PROGRESS) return 'text-amber-700 border-amber-300 bg-amber-50';
    return 'text-red-700 border-red-300 bg-red-50';
};

const LeakTestResolutionModal = ({ isOpen, setIsOpen, record, onResolved }) => {
    const { toast } = useToast();

    const [form, setForm] = useState(INITIAL_FORM);
    const [personnel, setPersonnel] = useState([]);
    const [setupLoading, setSetupLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    /* ── veri yükleme ─────────────────────────────────────────── */
    useEffect(() => {
        if (!isOpen) return;

        // Mevcut resolution verilerini forma doldur
        setForm({
            resolution_status: record?.resolution_status || '',
            resolution_type: record?.resolution_type || '',
            resolution_notes: record?.resolution_notes || '',
            resolution_date: record?.resolution_date || new Date().toISOString().split('T')[0],
            resolved_by_personnel_id: record?.resolved_by_personnel_id || '',
            resolved_by_name: record?.resolved_by_name || '',
        });
    }, [isOpen, record]);

    useEffect(() => {
        if (!isOpen) return;
        setSetupLoading(true);
        supabase
            .from('personnel')
            .select('id, full_name, department')
            .eq('is_active', true)
            .order('full_name')
            .then(({ data }) => {
                setPersonnel(data || []);
                setSetupLoading(false);
            });
    }, [isOpen]);

    const personnelOptions = useMemo(
        () => personnel.map((p) => ({
            value: p.id,
            label: p.department ? `${p.full_name} • ${p.department}` : p.full_name,
        })),
        [personnel]
    );

    /* ── güncelleme kaydet ────────────────────────────────────── */
    const handleSave = useCallback(async () => {
        if (!form.resolution_status) {
            toast({ variant: 'destructive', title: 'Eksik bilgi', description: 'Lütfen çözüm durumunu seçin.' });
            return;
        }
        if (!record?.id) return;

        setIsSaving(true);
        try {
            const payload = {
                resolution_status: form.resolution_status,
                resolution_type: form.resolution_type || null,
                resolution_notes: form.resolution_notes?.trim() || null,
                resolution_date: form.resolution_date || null,
                resolved_by_personnel_id: form.resolved_by_personnel_id || null,
                resolved_by_name: form.resolved_by_name?.trim() || null,
                resolved_at:
                    form.resolution_status === LEAK_RESOLUTION_STATUS.RESOLVED
                        ? (form.resolution_date || new Date().toISOString())
                        : null,
                updated_at: new Date().toISOString(),
            };

            const { error } = await supabase
                .from('leak_test_records')
                .update(payload)
                .eq('id', record.id);

            if (error) throw error;

            toast({
                title: 'Güncellendi',
                description: `${record.record_number} kaydının çözüm durumu "${form.resolution_status}" olarak kaydedildi.`,
            });
            setIsOpen(false);
            onResolved?.();
        } catch (err) {
            toast({ variant: 'destructive', title: 'Hata', description: err.message });
        } finally {
            setIsSaving(false);
        }
    }, [form, record, setIsOpen, onResolved, toast]);

    if (!record) return null;

    const currentStatus = form.resolution_status;

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Droplets className="w-5 h-5 text-primary" />
                        Kaçak Çözüm Takibi
                    </DialogTitle>
                    <DialogDescription>
                        Kaçak kaydının çözüm durumunu ve aksiyon bilgilerini girin.
                    </DialogDescription>
                </DialogHeader>

                {/* Kayıt özet kartı */}
                <div className="rounded-xl border border-red-200 bg-red-50/40 p-3 space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold">{record.record_number}</span>
                        <Badge variant="destructive" className="text-xs">{record.leak_count || 0} Kaçak</Badge>
                        {currentStatus && (
                            <Badge variant="outline" className={`text-xs ${statusColorClass(currentStatus)}`}>
                                {currentStatus}
                            </Badge>
                        )}
                    </div>
                    <p className="text-muted-foreground text-xs">
                        {getVehicleTypeLabel(record)} · {record.tank_type} · {formatTestDate(record.test_date)}
                    </p>
                </div>

                {/* Form */}
                <div className="space-y-4">
                    {/* Çözüm durumu */}
                    <div className="space-y-1.5">
                        <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                            Çözüm Durumu <span className="text-destructive">*</span>
                        </Label>
                        <div className="grid grid-cols-3 gap-2">
                            {LEAK_RESOLUTION_STATUS_OPTIONS.map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setForm((f) => ({ ...f, resolution_status: opt.value }))}
                                    className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                                        form.resolution_status === opt.value
                                            ? opt.value === LEAK_RESOLUTION_STATUS.RESOLVED
                                                ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-300'
                                                : opt.value === LEAK_RESOLUTION_STATUS.IN_PROGRESS
                                                    ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-300'
                                                    : 'border-red-400 bg-red-50 ring-2 ring-red-300'
                                            : 'border-border bg-background hover:bg-muted/40'
                                    }`}
                                >
                                    <p className={`text-xs font-semibold ${
                                        form.resolution_status === opt.value
                                            ? opt.value === LEAK_RESOLUTION_STATUS.RESOLVED ? 'text-emerald-800'
                                                : opt.value === LEAK_RESOLUTION_STATUS.IN_PROGRESS ? 'text-amber-800'
                                                    : 'text-red-800'
                                            : 'text-foreground'
                                    }`}>{opt.label}</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{opt.description}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Aksiyon tipi */}
                    <div className="space-y-1.5">
                        <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Aksiyon Tipi</Label>
                        <Select
                            value={form.resolution_type || ''}
                            onValueChange={(v) => setForm((f) => ({ ...f, resolution_type: v }))}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Yapılan aksiyon..." />
                            </SelectTrigger>
                            <SelectContent>
                                {LEAK_RESOLUTION_TYPE_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                        <p className="font-medium text-sm">{opt.label}</p>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        {/* Çözüm tarihi */}
                        <div className="space-y-1.5">
                            <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Çözüm Tarihi</Label>
                            <div className="relative">
                                <CalendarDays className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground h-full w-4" />
                                <Input
                                    type="date"
                                    value={form.resolution_date || ''}
                                    onChange={(e) => setForm((f) => ({ ...f, resolution_date: e.target.value }))}
                                    className="pl-9"
                                    autoFormat={false}
                                />
                            </div>
                        </div>

                        {/* Çözümleyen personel */}
                        <div className="space-y-1.5">
                            <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Çözümleyen Personel</Label>
                            <SearchableSelectDialog
                                options={personnelOptions}
                                value={form.resolved_by_personnel_id}
                                onChange={(id) => {
                                    const p = personnel.find((x) => x.id === id);
                                    setForm((f) => ({
                                        ...f,
                                        resolved_by_personnel_id: id || '',
                                        resolved_by_name: p?.full_name || '',
                                    }));
                                }}
                                triggerPlaceholder={setupLoading ? 'Yükleniyor...' : 'Personel seçin...'}
                                dialogTitle="Personel Seç"
                                searchPlaceholder="Personel ara..."
                                notFoundText="Bulunamadı."
                            />
                        </div>
                    </div>

                    {/* Not */}
                    <div className="space-y-1.5">
                        <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Çözüm Notu</Label>
                        <Textarea
                            rows={3}
                            value={form.resolution_notes || ''}
                            onChange={(e) => setForm((f) => ({ ...f, resolution_notes: e.target.value }))}
                            placeholder="Yapılan işlem, gözlem ve sonuç hakkında not..."
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSaving}>
                        İptal
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={isSaving || !form.resolution_status}
                        className={
                            form.resolution_status === LEAK_RESOLUTION_STATUS.RESOLVED
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                : ''
                        }
                    >
                        {form.resolution_status === LEAK_RESOLUTION_STATUS.RESOLVED && (
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                        )}
                        {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default LeakTestResolutionModal;
