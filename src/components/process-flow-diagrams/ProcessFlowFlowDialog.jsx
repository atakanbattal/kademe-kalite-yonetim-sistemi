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

const EMPTY_FLOW_FORM = {
    title: '',
    intro: '',
    withDefaultSteps: false,
};

export default function ProcessFlowFlowDialog({
    open,
    onOpenChange,
    mode = 'create',
    flow = null,
    unitName = '',
    saving = false,
    onSubmit,
}) {
    const [form, setForm] = useState(EMPTY_FLOW_FORM);

    useEffect(() => {
        if (!open) return;
        if (mode === 'edit' && flow) {
            setForm({
                title: flow.title || '',
                intro: flow.intro || '',
                withDefaultSteps: false,
            });
        } else {
            setForm({ ...EMPTY_FLOW_FORM });
        }
    }, [open, mode, flow]);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit?.(form);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>{mode === 'edit' ? 'Süreç Düzenle' : 'Yeni Süreç'}</DialogTitle>
                        <DialogDescription>
                            {mode === 'edit'
                                ? 'Süreç başlığı ve giriş metnini güncelleyin.'
                                : `${unitName ? `${unitName} birimine ` : ''}yeni bir süreç akışı ekleyin.`}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-3 py-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="pfd-flow-title">Süreç adı *</Label>
                            <Input
                                id="pfd-flow-title"
                                value={form.title}
                                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                                placeholder="A) Tasarım ve geliştirme süreci"
                                required
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="pfd-flow-intro">Giriş metni</Label>
                            <Textarea
                                id="pfd-flow-intro"
                                rows={3}
                                value={form.intro}
                                onChange={(e) => setForm((f) => ({ ...f, intro: e.target.value }))}
                                placeholder="Sürecin kapsamı ve amacı (opsiyonel)"
                            />
                        </div>

                        {mode === 'create' ? (
                            <div className="flex items-start gap-2">
                                <Checkbox
                                    id="pfd-flow-template"
                                    checked={form.withDefaultSteps}
                                    onCheckedChange={(checked) => setForm((f) => ({ ...f, withDefaultSteps: checked === true }))}
                                />
                                <Label htmlFor="pfd-flow-template" className="font-normal leading-snug cursor-pointer">
                                    Şablon adımlarla başla (Başlangıç → İşlem → Bitiş)
                                </Label>
                            </div>
                        ) : null}

                        {mode === 'create' && !form.withDefaultSteps ? (
                            <p className="text-xs text-muted-foreground rounded-md bg-muted/50 px-3 py-2">
                                Boş akış oluşturulur; düzenleme modunda <strong>İlk adımı ekle</strong> ile sıfırdan adımları tanımlayabilirsiniz.
                            </p>
                        ) : null}
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                            İptal
                        </Button>
                        <Button type="submit" disabled={saving || !form.title.trim()}>
                            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                            {mode === 'edit' ? 'Kaydet' : 'Oluştur'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
