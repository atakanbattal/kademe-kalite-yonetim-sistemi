import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

const RevisionModal = ({ open, onOpenChange, fixture, onSave }) => {
    const [form, setForm] = useState({
        revision_date: new Date().toISOString().split('T')[0],
        description: '',
        approved_by: '',
        approval_status: 'Beklemede',
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) {
            setForm({
                revision_date: new Date().toISOString().split('T')[0],
                description: '',
                approved_by: '',
                approval_status: 'Beklemede',
            });
        }
    }, [open]);

    const handleChange = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await onSave(form);
        } finally {
            setSaving(false);
        }
    };

    if (!fixture) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        Revizyon Kaydet — <span className="font-mono text-primary">{fixture.fixture_no}</span>
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label>Revizyon Tarihi <span className="text-red-500">*</span></Label>
                            <Input type="date" value={form.revision_date}
                                onChange={e => handleChange('revision_date', e.target.value)} required />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Onay Durumu</Label>
                            <Select value={form.approval_status} onValueChange={v => handleChange('approval_status', v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Beklemede">Beklemede</SelectItem>
                                    <SelectItem value="Onaylandı">Onaylandı</SelectItem>
                                    <SelectItem value="Reddedildi">Reddedildi</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label>Revizyon Açıklaması <span className="text-red-500">*</span></Label>
                        <Textarea
                            value={form.description}
                            onChange={e => handleChange('description', e.target.value)}
                            placeholder="Revizyon kapsamı ve ölçüleri etkileyen değişiklikleri açıklayın..."
                            rows={3}
                            required
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label>Onaylayan (AR-GE/ÜR-GE)</Label>
                        <Input
                            value={form.approved_by}
                            onChange={e => handleChange('approved_by', e.target.value)}
                            placeholder="Onaylayan kişi adı"
                        />
                    </div>

                    <p className="text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded-md p-3">
                        ⚠️ Revizyon kaydedildiğinde fikstür durumu <strong>"Revizyon Beklemede"</strong> olarak güncellenecektir.
                        Fikstürü tekrar aktive etmek için revizyon sonrası doğrulama yapılması gerekmektedir.
                    </p>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>İptal</Button>
                        <Button type="submit" disabled={saving}>
                            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Kaydediliyor</> : 'Revizyonu Kaydet'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default RevisionModal;
