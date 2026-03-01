import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, AlertTriangle } from 'lucide-react';

const ScrapModal = ({ open, onOpenChange, fixture, onSave }) => {
    const [form, setForm] = useState({
        scrap_date: new Date().toISOString().split('T')[0],
        scrap_reason: '',
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) {
            setForm({
                scrap_date: new Date().toISOString().split('T')[0],
                scrap_reason: '',
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
            <DialogContent className="sm:max-w-xl w-[98vw] sm:w-[90vw] max-h-[95vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-red-600">
                        <AlertTriangle className="h-5 w-5" />
                        Hurdaya Ayır — <span className="font-mono">{fixture.fixture_no}</span>
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                        Bu işlem geri alınamaz. Fikstür <strong>Hurdaya Ayrılmış</strong> statüsüne geçecek ve artık kullanılamayacaktır.
                    </div>

                    <div className="space-y-1.5">
                        <Label>Hurdaya Ayırma Tarihi <span className="text-red-500">*</span></Label>
                        <Input type="date" value={form.scrap_date}
                            onChange={e => handleChange('scrap_date', e.target.value)} required />
                    </div>

                    <div className="space-y-1.5">
                        <Label>Hurdaya Ayırma Nedeni <span className="text-red-500">*</span></Label>
                        <Textarea
                            value={form.scrap_reason}
                            onChange={e => handleChange('scrap_reason', e.target.value)}
                            placeholder="Fikstürün neden hurdaya ayrıldığını açıklayın..."
                            rows={3}
                            required
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>İptal</Button>
                        <Button type="submit" variant="destructive" disabled={saving}>
                            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />İşleniyor</> : 'Hurdaya Ayır'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default ScrapModal;
