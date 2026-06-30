import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { EMPTY_UNIT_FORM, unitToForm } from './processFlowDraftUtils';

export default function ProcessFlowUnitDialog({
    open,
    onOpenChange,
    mode = 'create',
    unit = null,
    saving = false,
    onSubmit,
}) {
    const [form, setForm] = useState(EMPTY_UNIT_FORM);

    useEffect(() => {
        if (!open) return;
        setForm(mode === 'edit' && unit ? unitToForm(unit) : { ...EMPTY_UNIT_FORM });
    }, [open, mode, unit]);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit?.(form);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>{mode === 'edit' ? 'Birim Düzenle' : 'Yeni Birim'}</DialogTitle>
                        <DialogDescription>
                            {mode === 'edit'
                                ? 'Birim meta bilgilerini güncelleyin.'
                                : 'Sıfırdan yeni bir birim oluşturun; ardından süreç akışları ekleyebilirsiniz.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-3 py-4">
                        <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="pfd-unit-code">Kod *</Label>
                                <Input
                                    id="pfd-unit-code"
                                    value={form.code}
                                    onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                                    placeholder="ARG"
                                    maxLength={12}
                                    required
                                />
                            </div>
                            <div className="col-span-2 space-y-1.5">
                                <Label htmlFor="pfd-unit-name">Birim adı *</Label>
                                <Input
                                    id="pfd-unit-name"
                                    value={form.name}
                                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                    placeholder="Ar-Ge Direktörlüğü"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="pfd-unit-subtitle">Alt başlık</Label>
                            <Input
                                id="pfd-unit-subtitle"
                                value={form.subtitle}
                                onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
                                placeholder="Kısa açıklama"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="pfd-unit-owner">Süreç sahibi</Label>
                            <Input
                                id="pfd-unit-owner"
                                value={form.owner_role}
                                onChange={(e) => setForm((f) => ({ ...f, owner_role: e.target.value }))}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="pfd-unit-roles">Temel roller</Label>
                            <Input
                                id="pfd-unit-roles"
                                value={form.roles}
                                onChange={(e) => setForm((f) => ({ ...f, roles: e.target.value }))}
                                placeholder="Rol · Rol · Rol"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="pfd-unit-purpose">Amaç</Label>
                            <Textarea
                                id="pfd-unit-purpose"
                                rows={3}
                                value={form.purpose}
                                onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
                            />
                        </div>

                        <div className="flex items-start gap-2">
                            <Checkbox
                                id="pfd-unit-ideal"
                                checked={form.is_ideal_process}
                                onCheckedChange={(checked) => setForm((f) => ({ ...f, is_ideal_process: checked === true }))}
                            />
                            <Label htmlFor="pfd-unit-ideal" className="font-normal leading-snug cursor-pointer">
                                İdeal süreç (ayrı prosedür dokümante edilmemiş)
                            </Label>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                            İptal
                        </Button>
                        <Button type="submit" disabled={saving || !form.code.trim() || !form.name.trim()}>
                            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                            {mode === 'edit' ? 'Kaydet' : 'Oluştur'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
