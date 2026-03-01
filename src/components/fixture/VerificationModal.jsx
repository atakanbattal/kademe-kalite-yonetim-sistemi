import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Trash2, CheckCircle2, XCircle } from 'lucide-react';

const emptyMeasurement = () => ({
    characteristic: '',
    nominal: '',
    min_limit: '',
    max_limit: '',
    measured_value: '',
    is_conformant: null,
});

const VerificationModal = ({ open, onOpenChange, fixture, onSave }) => {
    const [form, setForm] = useState({
        verification_type: 'Periyodik',
        verification_date: new Date().toISOString().split('T')[0],
        sample_count: 1,
        verified_by: '',
        notes: '',
    });
    const [measurements, setMeasurements] = useState([emptyMeasurement()]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open && fixture) {
            setForm({
                verification_type: fixture.status === 'Devreye Alma Bekleniyor' ? 'Devreye Alma' : 'Periyodik',
                verification_date: new Date().toISOString().split('T')[0],
                sample_count: fixture.sample_count_required || 1,
                verified_by: '',
                notes: '',
            });
            setMeasurements([emptyMeasurement()]);
        }
    }, [open, fixture]);

    const handleFormChange = (key, value) => {
        setForm(prev => ({ ...prev, [key]: value }));
    };

    const handleMeasurementChange = (idx, key, value) => {
        setMeasurements(prev => {
            const updated = [...prev];
            updated[idx] = { ...updated[idx], [key]: value };

            // Auto-evaluate conformity when measured value changes
            if (key === 'measured_value' || key === 'min_limit' || key === 'max_limit') {
                const m = updated[idx];
                const measured = parseFloat(m.measured_value);
                const minL = parseFloat(m.min_limit);
                const maxL = parseFloat(m.max_limit);
                if (!isNaN(measured) && !isNaN(minL) && !isNaN(maxL)) {
                    updated[idx].is_conformant = measured >= minL && measured <= maxL;
                } else {
                    updated[idx].is_conformant = null;
                }
            }
            return updated;
        });
    };

    const addMeasurement = () => setMeasurements(prev => [...prev, emptyMeasurement()]);
    const removeMeasurement = (idx) => {
        if (measurements.length > 1) {
            setMeasurements(prev => prev.filter((_, i) => i !== idx));
        }
    };

    const overallResult = measurements.every(m => m.is_conformant === true)
        ? 'Uygun'
        : measurements.some(m => m.is_conformant === false)
            ? 'Uygunsuz'
            : null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const result = overallResult || 'Uygun';
            await onSave({
                ...form,
                measurements,
                result,
            });
        } finally {
            setSaving(false);
        }
    };

    if (!fixture) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        Doğrulama Yap — <span className="font-mono text-primary">{fixture.fixture_no}</span>
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Form Başlık Alanları */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                            <Label>Doğrulama Tipi</Label>
                            <Select value={form.verification_type} onValueChange={v => handleFormChange('verification_type', v)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Devreye Alma">Devreye Alma</SelectItem>
                                    <SelectItem value="Periyodik">Periyodik</SelectItem>
                                    <SelectItem value="Revizyon Sonrası">Revizyon Sonrası</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Doğrulama Tarihi</Label>
                            <Input type="date" value={form.verification_date}
                                onChange={e => handleFormChange('verification_date', e.target.value)} required />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Numune Sayısı</Label>
                            <Input type="number" min={1} value={form.sample_count}
                                onChange={e => handleFormChange('sample_count', parseInt(e.target.value))} required />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label>Doğrulayanı Yapan Kişi</Label>
                        <Input value={form.verified_by} onChange={e => handleFormChange('verified_by', e.target.value)}
                            placeholder="İsim / sicil no" />
                    </div>

                    {/* Ölçüm Tablosu */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-base font-semibold">Ölçüm Sonuçları</Label>
                            {overallResult && (
                                <Badge variant="outline" className={overallResult === 'Uygun'
                                    ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                    : 'bg-red-100 text-red-700 border-red-200'}>
                                    Genel Sonuç: {overallResult}
                                </Badge>
                            )}
                        </div>
                        <div className="border border-border rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/40">
                                    <tr>
                                        <th className="text-left p-2.5 font-medium text-muted-foreground">Özellik</th>
                                        <th className="text-center p-2.5 font-medium text-muted-foreground">Nominal</th>
                                        <th className="text-center p-2.5 font-medium text-muted-foreground">Alt Limit</th>
                                        <th className="text-center p-2.5 font-medium text-muted-foreground">Üst Limit</th>
                                        <th className="text-center p-2.5 font-medium text-muted-foreground">Ölçülen</th>
                                        <th className="text-center p-2.5 font-medium text-muted-foreground">Sonuç</th>
                                        <th className="p-2.5"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {measurements.map((m, idx) => (
                                        <tr key={idx} className={`border-t border-border ${m.is_conformant === false ? 'bg-red-50' : ''}`}>
                                            <td className="p-2">
                                                <Input className="h-8 text-xs" placeholder="Ör: Çap, Mesafe"
                                                    value={m.characteristic}
                                                    onChange={e => handleMeasurementChange(idx, 'characteristic', e.target.value)} />
                                            </td>
                                            <td className="p-2">
                                                <Input className="h-8 text-xs text-center" placeholder="25.00"
                                                    value={m.nominal}
                                                    onChange={e => handleMeasurementChange(idx, 'nominal', e.target.value)} />
                                            </td>
                                            <td className="p-2">
                                                <Input className="h-8 text-xs text-center" placeholder="24.95"
                                                    value={m.min_limit}
                                                    onChange={e => handleMeasurementChange(idx, 'min_limit', e.target.value)} />
                                            </td>
                                            <td className="p-2">
                                                <Input className="h-8 text-xs text-center" placeholder="25.05"
                                                    value={m.max_limit}
                                                    onChange={e => handleMeasurementChange(idx, 'max_limit', e.target.value)} />
                                            </td>
                                            <td className="p-2">
                                                <Input className="h-8 text-xs text-center font-medium" placeholder="25.01"
                                                    value={m.measured_value}
                                                    onChange={e => handleMeasurementChange(idx, 'measured_value', e.target.value)} />
                                            </td>
                                            <td className="p-2 text-center">
                                                {m.is_conformant === true && <CheckCircle2 className="h-4 w-4 text-emerald-600 mx-auto" />}
                                                {m.is_conformant === false && <XCircle className="h-4 w-4 text-red-600 mx-auto" />}
                                                {m.is_conformant === null && <span className="text-muted-foreground">—</span>}
                                            </td>
                                            <td className="p-2">
                                                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-500"
                                                    onClick={() => removeMeasurement(idx)} disabled={measurements.length === 1}>
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <Button type="button" variant="ghost" size="sm" onClick={addMeasurement} className="text-primary">
                            <Plus className="h-4 w-4 mr-1" />Satır Ekle
                        </Button>
                    </div>

                    <div className="space-y-1.5">
                        <Label>Notlar</Label>
                        <Textarea value={form.notes} onChange={e => handleFormChange('notes', e.target.value)}
                            placeholder="Opsiyonel notlar..." rows={2} />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                            İptal
                        </Button>
                        <Button type="submit" disabled={saving}>
                            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Kaydediliyor</> : 'Doğrulamayı Kaydet'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default VerificationModal;
