import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useFileUpload } from '@/hooks/useFileUpload';
import FileUploader from '@/components/shared/FileUploader';
import { getFixtureVerificationRules } from '@/lib/fixtureRules';

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


const FixtureFormModal = ({ open, onOpenChange, fixture, onSave, supportsImageUpload = true }) => {
    const [form, setForm] = useState(defaultForm);
    const [saving, setSaving] = useState(false);
    const [units, setUnits] = useState([]);
    const [existingImagePaths, setExistingImagePaths] = useState([]);
    const isEdit = !!fixture;
    const {
        files,
        uploading,
        uploadProgress,
        errors,
        isDragActive,
        getRootProps,
        getInputProps,
        removeFile,
        clearFiles,
        uploadFiles,
        deleteFile,
    } = useFileUpload({
        bucket: 'incoming_control',
        folder: 'fixture-images',
        maxFiles: 8,
        maxSize: 10 * 1024 * 1024,
        acceptedTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
    });

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
            setExistingImagePaths(fixture.image_paths || []);
        } else {
            setForm(defaultForm);
            setExistingImagePaths([]);
        }
        clearFiles();
    }, [fixture, open]);

    const handleChange = (key, value) => {
        setForm(prev => ({ ...prev, [key]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        let uploadedImagePaths = [];
        const removedImagePaths = supportsImageUpload
            ? (fixture?.image_paths || []).filter(path => !existingImagePaths.includes(path))
            : [];

        try {
            if (supportsImageUpload && files.length > 0) {
                const fixtureFolder = (form.fixture_no || 'taslak').replace(/[^a-zA-Z0-9-_]/g, '-');
                const uploadResult = await uploadFiles(`fixture-images/${fixtureFolder}`);
                uploadedImagePaths = uploadResult.paths || [];

                if (uploadResult.errors?.length > 0) {
                    throw new Error(uploadResult.errors[0]?.error || 'Fikstür görselleri yüklenemedi.');
                }
            }

            await onSave({
                ...form,
                ...(supportsImageUpload ? { image_paths: [...existingImagePaths, ...uploadedImagePaths] } : {}),
            }, isEdit ? fixture.id : null);

            if (removedImagePaths.length > 0) {
                await Promise.all(removedImagePaths.map(path => deleteFile(path)));
            }
            clearFiles();
        } catch (error) {
            if (uploadedImagePaths.length > 0) {
                await Promise.all(uploadedImagePaths.map(path => deleteFile(path)));
            }
        } finally {
            setSaving(false);
        }
    };

    const { verificationPeriodMonths, sampleCountRequired } = getFixtureVerificationRules(form.criticality_class);
    const verPeriod = `${verificationPeriodMonths} ay`;
    const sampleCount = sampleCountRequired;

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
                                autoFormat={false}
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
                                autoFormat={false}
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
                                autoFormat={false}
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

                    <div className="space-y-3">
                        <div className="space-y-1.5">
                            <Label>Fikstür Görselleri</Label>
                            {!supportsImageUpload && (
                                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                    <div className="flex items-start gap-2">
                                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                        <span>
                                            Fikstür görselleri için gerekli `image_paths` kolonu veritabanında henüz yok. Migration uygulandığında bu alan aktif olacaktır.
                                        </span>
                                    </div>
                                </div>
                            )}
                            <FileUploader
                                getRootProps={getRootProps}
                                getInputProps={getInputProps}
                                isDragActive={isDragActive}
                                files={files}
                                onRemoveFile={removeFile}
                                uploading={uploading}
                                uploadProgress={uploadProgress}
                                errors={errors}
                                disabled={saving || !supportsImageUpload}
                                label={supportsImageUpload ? 'Görselleri sürükleyin veya seçmek için tıklayın' : 'Görsel yükleme migration sonrası aktif olacak'}
                                hint="PNG, JPG, WEBP - Maks. 10 MB"
                                compact
                            />
                        </div>

                        {existingImagePaths.length > 0 && (
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Kayıtlı Görseller</Label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {existingImagePaths.map((path) => {
                                        const imageUrl = supabase.storage.from('incoming_control').getPublicUrl(path).data.publicUrl;
                                        return (
                                            <div key={path} className="relative rounded-lg overflow-hidden border bg-muted/20">
                                                <img
                                                    src={imageUrl}
                                                    alt="Fikstür görseli"
                                                    className="h-28 w-full object-cover"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="destructive"
                                                    size="icon"
                                                    className="absolute top-2 right-2 h-7 w-7"
                                                    onClick={() => setExistingImagePaths(prev => prev.filter(item => item !== path))}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
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
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving || uploading}>
                            İptal
                        </Button>
                        <Button type="submit" disabled={saving || uploading}>
                            {saving || uploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Kaydediliyor</> : isEdit ? 'Güncelle' : 'Ekle'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default FixtureFormModal;
