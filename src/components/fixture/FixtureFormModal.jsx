import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';

const defaultForm = {
    fixture_no: '',
    part_code: '',
    part_name: '',
    criticality_class: 'Standart',
    criticality_reason: '',
    responsible_department: '',
    activation_date: '',
    notes: '',
};


const FixtureFormModal = ({ open, onOpenChange, fixture, onSave }) => {
    const [form, setForm] = useState(defaultForm);
    const [saving, setSaving] = useState(false);
    const [units, setUnits] = useState([]);
    const isEdit = !!fixture;

    // Ayarlar'daki birimleri çek
    useEffect(() => {
        const fetchUnits = async () => {
            const { data } = await supabase
                .from('cost_settings')
                .select('id, unit_name')
                .order('unit_name', { ascending: true });
            if (data) setUnits(data);
        };
        fetchUnits();
    }, []);

    useEffect(() => {
        if (fixture) {
            setForm({
                fixture_no: fixture.fixture_no || '',
                part_code: fixture.part_code || '',
                part_name: fixture.part_name || '',
                criticality_class: fixture.criticality_class || 'Standart',
                criticality_reason: fixture.criticality_reason || '',
                responsible_department: fixture.responsible_department || '',
                activation_date: fixture.activation_date || '',
                notes: fixture.notes || '',
            });
        } else {
            setForm(defaultForm);
        }
    }, [fixture, open]);

    const handleChange = (key, value) => {
        setForm(prev => ({ ...prev, [key]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await onSave(form, isEdit ? fixture.id : null);
        } finally {
            setSaving(false);
        }
    };

    const verPeriod = form.criticality_class === 'Kritik' ? '1 ay' : '3 ay';
    const sampleCount = form.criticality_class === 'Kritik' ? 5 : 3;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{isEdit ? 'Fikstür Düzenle' : 'Yeni Fikstür Ekle'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Fikstür No */}
                        <div className="space-y-1.5">
                            <Label htmlFor="fixture_no">Fikstür No <span className="text-red-500">*</span></Label>
                            <Input
                                id="fixture_no"
                                value={form.fixture_no}
                                onChange={e => handleChange('fixture_no', e.target.value)}
                                placeholder="FX-001"
                                required
                                disabled={isEdit}
                            />
                        </div>
                        {/* Parça Kodu */}
                        <div className="space-y-1.5">
                            <Label htmlFor="part_code">Parça Kodu <span className="text-red-500">*</span></Label>
                            <Input
                                id="part_code"
                                value={form.part_code}
                                onChange={e => handleChange('part_code', e.target.value)}
                                placeholder="PRC-2024-001"
                                required
                            />
                        </div>
                        {/* Parça Adı */}
                        <div className="space-y-1.5">
                            <Label htmlFor="part_name">Parça Adı</Label>
                            <Input
                                id="part_name"
                                value={form.part_name}
                                onChange={e => handleChange('part_name', e.target.value)}
                                placeholder="Parça açıklaması"
                            />
                        </div>
                        {/* Kritiklik Sınıfı */}
                        <div className="space-y-1.5">
                            <Label>Kritiklik Sınıfı <span className="text-red-500">*</span></Label>
                            <Select value={form.criticality_class} onValueChange={v => handleChange('criticality_class', v)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Kritik">Kritik</SelectItem>
                                    <SelectItem value="Standart">Standart</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                Doğrulama periyodu: <strong>{verPeriod}</strong> · Numune sayısı: <strong>{sampleCount} adet</strong>
                            </p>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Sorumlu Bölüm</Label>
                            <Select value={form.responsible_department} onValueChange={v => handleChange('responsible_department', v)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Birim seçin" />
                                </SelectTrigger>
                                <SelectContent>
                                    {units.length === 0 ? (
                                        <SelectItem value="__loading__" disabled>Yükleniyor...</SelectItem>
                                    ) : (
                                        units.map(u => (
                                            <SelectItem key={u.id} value={u.unit_name}>{u.unit_name}</SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                        {/* Devreye Alma Tarihi */}
                        <div className="space-y-1.5">
                            <Label htmlFor="activation_date">Devreye Alma Tarihi</Label>
                            <Input
                                id="activation_date"
                                type="date"
                                value={form.activation_date}
                                onChange={e => handleChange('activation_date', e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Kritiklik Nedeni */}
                    <div className="space-y-1.5">
                        <Label htmlFor="criticality_reason">Kritiklik Sınıfı Belirleme Nedeni (AR-GE/ÜR-GE)</Label>
                        <Textarea
                            id="criticality_reason"
                            value={form.criticality_reason}
                            onChange={e => handleChange('criticality_reason', e.target.value)}
                            placeholder="Kritiklik sınıfının belirlenmesine yönelik teknik gerekçe..."
                            rows={2}
                        />
                    </div>

                    {/* Notlar */}
                    <div className="space-y-1.5">
                        <Label htmlFor="notes">Notlar</Label>
                        <Textarea
                            id="notes"
                            value={form.notes}
                            onChange={e => handleChange('notes', e.target.value)}
                            placeholder="Opsiyonel notlar..."
                            rows={2}
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                            İptal
                        </Button>
                        <Button type="submit" disabled={saving}>
                            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Kaydediliyor</> : isEdit ? 'Güncelle' : 'Ekle'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default FixtureFormModal;
