import React, { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useData } from '@/contexts/DataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { SearchableSelectDialog } from '@/components/ui/searchable-select-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const ANALYSIS_TYPES = ['5N1K', 'Balık Kılçığı', '5 Neden', 'FMEA', 'Diğer'];

const FISHBONE_CATEGORIES = [
    { key: 'fishbone_method', label: 'İnsan (Man)', icon: '👤' },
    { key: 'fishbone_machine', label: 'Makine (Machine)', icon: '⚙️' },
    { key: 'fishbone_material', label: 'Malzeme (Material)', icon: '📦' },
    { key: 'fishbone_measurement', label: 'Ölçüm (Measurement)', icon: '📏' },
    { key: 'fishbone_environment', label: 'Çevre (Environment)', icon: '🌍' },
    { key: 'fishbone_management', label: 'Yönetim (Management)', icon: '📋' }
];

const AnalysisFormModal = ({ open, setOpen, complaintId, existingAnalysis, onSuccess }) => {
    const { toast } = useToast();
    const { user } = useAuth();
    const { personnel } = useData();
    const isEditMode = !!existingAnalysis;

    const [analysisType, setAnalysisType] = useState('5N1K');
    const [formData, setFormData] = useState({});
    const [fishboneData, setFishboneData] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isEditMode) {
            setAnalysisType(existingAnalysis.analysis_type || '5N1K');
            setFormData(existingAnalysis);
            
            // Balık kılçığı verilerini yükle
            const fbData = {};
            FISHBONE_CATEGORIES.forEach(cat => {
                const data = existingAnalysis[cat.key];
                if (data) {
                    if (Array.isArray(data)) {
                        fbData[cat.key] = data;
                    } else if (data.items && Array.isArray(data.items)) {
                        fbData[cat.key] = data.items;
                    } else if (typeof data === 'string') {
                        fbData[cat.key] = [data];
                    } else {
                        fbData[cat.key] = [];
                    }
                } else {
                    fbData[cat.key] = [];
                }
            });
            setFishboneData(fbData);
        } else {
            setFormData({
                analysis_type: '5N1K',
                analyzed_by: user?.id || '',
                analysis_date: new Date().toISOString().split('T')[0]
            });
            
            // Balık kılçığı için boş array'ler
            const fbData = {};
            FISHBONE_CATEGORIES.forEach(cat => {
                fbData[cat.key] = [];
            });
            setFishboneData(fbData);
        }
    }, [existingAnalysis, isEditMode, open]);

    const handleChange = (e) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleSelectChange = (id, value) => {
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    // Balık kılçığı için item ekle/çıkar
    const addFishboneItem = (category) => {
        setFishboneData(prev => ({
            ...prev,
            [category]: [...(prev[category] || []), '']
        }));
    };

    const removeFishboneItem = (category, index) => {
        setFishboneData(prev => ({
            ...prev,
            [category]: prev[category].filter((_, i) => i !== index)
        }));
    };

    const updateFishboneItem = (category, index, value) => {
        setFishboneData(prev => ({
            ...prev,
            [category]: prev[category].map((item, i) => i === index ? value : item)
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        setIsSubmitting(true);

        try {
            const {
                id, created_at, updated_at, analyzed_by: analyzedByObj,
                ...dataToSubmit
            } = formData;

            dataToSubmit.complaint_id = complaintId;
            dataToSubmit.analysis_type = analysisType;

            // Balık kılçığı verisini kaydet
            if (analysisType === 'Balık Kılçığı') {
                FISHBONE_CATEGORIES.forEach(cat => {
                    const items = fishboneData[cat.key]?.filter(item => item && item.trim() !== '');
                    dataToSubmit[cat.key] = items && items.length > 0 ? { items } : null;
                });
            }

            // Boş string değerleri null'a çevir
            Object.keys(dataToSubmit).forEach(key => {
                if (dataToSubmit[key] === '') {
                    dataToSubmit[key] = null;
                }
            });

            let result;
            if (isEditMode) {
                result = await supabase
                    .from('complaint_analyses')
                    .update(dataToSubmit)
                    .eq('id', existingAnalysis.id)
                    .select()
                    .single();
            } else {
                result = await supabase
                    .from('complaint_analyses')
                    .insert([dataToSubmit])
                    .select()
                    .single();
            }

            if (result.error) {
                throw result.error;
            }

            toast({
                title: 'Başarılı!',
                description: `Analiz başarıyla ${isEditMode ? 'güncellendi' : 'oluşturuldu'}.`
            });

            onSuccess();
        } catch (error) {
            console.error('Analysis save error:', error);
            toast({
                variant: 'destructive',
                title: 'Hata!',
                description: `Analiz ${isEditMode ? 'güncellenemedi' : 'oluşturulamadı'}: ${error.message}`
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const personnelOptions = personnel
        .filter(p => p.is_active)
        .map(p => ({
            value: p.id,
            label: p.full_name
        }));

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-5xl max-h-[95vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {isEditMode ? 'Analiz Düzenle' : 'Yeni Kök Neden Analizi'}
                    </DialogTitle>
                    <DialogDescription>
                        Şikayet için kök neden analizi yapın
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6 py-4">
                    {/* Genel Bilgiler */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="analysis_type">
                                Analiz Tipi <span className="text-red-500">*</span>
                            </Label>
                            <Select
                                value={analysisType}
                                onValueChange={setAnalysisType}
                                disabled={isEditMode}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {ANALYSIS_TYPES.map(type => (
                                        <SelectItem key={type} value={type}>
                                            {type}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label htmlFor="analysis_date">Analiz Tarihi</Label>
                            <Input
                                id="analysis_date"
                                type="date"
                                value={formData.analysis_date || ''}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    {/* Analiz İçeriği */}
                    <Tabs value={analysisType} className="w-full">
                        <TabsList className="hidden" />

                        {/* 5N1K */}
                        <TabsContent value="5N1K" className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">5N1K Analizi</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div>
                                        <Label htmlFor="what_ne">Ne oldu?</Label>
                                        <Textarea
                                            id="what_ne"
                                            value={formData.what_ne || ''}
                                            onChange={handleChange}
                                            rows={2}
                                            placeholder="Problem nedir?"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="where_nerede">Nerede oldu?</Label>
                                        <Textarea
                                            id="where_nerede"
                                            value={formData.where_nerede || ''}
                                            onChange={handleChange}
                                            rows={2}
                                            placeholder="Hangi lokasyonda/süreçte?"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="when_ne_zaman">Ne zaman oldu?</Label>
                                        <Textarea
                                            id="when_ne_zaman"
                                            value={formData.when_ne_zaman || ''}
                                            onChange={handleChange}
                                            rows={2}
                                            placeholder="Hangi tarih/zaman diliminde?"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="who_kim">Kim tespit etti / sorumlu?</Label>
                                        <Textarea
                                            id="who_kim"
                                            value={formData.who_kim || ''}
                                            onChange={handleChange}
                                            rows={2}
                                            placeholder="Hangi kişi/ekip?"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="why_neden">Neden oldu?</Label>
                                        <Textarea
                                            id="why_neden"
                                            value={formData.why_neden || ''}
                                            onChange={handleChange}
                                            rows={3}
                                            placeholder="Sorunun nedenleri..."
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="how_nasil">Nasıl tespit edildi / çözüldü?</Label>
                                        <Textarea
                                            id="how_nasil"
                                            value={formData.how_nasil || ''}
                                            onChange={handleChange}
                                            rows={3}
                                            placeholder="Tespit ve çözüm yöntemi..."
                                        />
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* Balık Kılçığı */}
                        <TabsContent value="Balık Kılçığı" className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Balık Kılçığı (Ishikawa) Analizi</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {FISHBONE_CATEGORIES.map(cat => (
                                            <div key={cat.key} className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <Label className="flex items-center gap-2">
                                                        <span>{cat.icon}</span>
                                                        {cat.label}
                                                    </Label>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => addFishboneItem(cat.key)}
                                                    >
                                                        <Plus className="w-3 h-3" />
                                                    </Button>
                                                </div>
                                                <div className="space-y-2">
                                                    {(fishboneData[cat.key] || []).map((item, idx) => (
                                                        <div key={idx} className="flex items-center gap-2">
                                                            <Input
                                                                value={item}
                                                                onChange={(e) => updateFishboneItem(cat.key, idx, e.target.value)}
                                                                placeholder="Neden girin..."
                                                            />
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => removeFishboneItem(cat.key, idx)}
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </Button>
                                                        </div>
                                                    ))}
                                                    {(!fishboneData[cat.key] || fishboneData[cat.key].length === 0) && (
                                                        <div className="text-sm text-muted-foreground text-center py-2">
                                                            Neden ekleyin
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* 5 Neden */}
                        <TabsContent value="5 Neden" className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">5 Neden (5 Why) Analizi</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {[1, 2, 3, 4, 5].map(num => (
                                        <div key={num} className="flex items-start gap-3">
                                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary">
                                                {num}
                                            </div>
                                            <div className="flex-1">
                                                <Label htmlFor={`why_${num}`}>Neden {num}?</Label>
                                                <Textarea
                                                    id={`why_${num}`}
                                                    value={formData[`why_${num}`] || ''}
                                                    onChange={handleChange}
                                                    rows={2}
                                                    placeholder={`${num}. neden nedir?`}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                    <div className="mt-4 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg">
                                        <Label htmlFor="root_cause" className="text-red-700 dark:text-red-400">
                                            Kök Neden
                                        </Label>
                                        <Textarea
                                            id="root_cause"
                                            value={formData.root_cause || ''}
                                            onChange={handleChange}
                                            rows={3}
                                            placeholder="Tespit edilen kök neden..."
                                            className="mt-2"
                                        />
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* FMEA & Diğer */}
                        {(analysisType === 'FMEA' || analysisType === 'Diğer') && (
                            <TabsContent value={analysisType} className="space-y-4">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg">{analysisType} Analizi</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-sm text-muted-foreground mb-4">
                                            Analiz detaylarını özet ve aksiyonlar bölümüne girebilirsiniz.
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        )}
                    </Tabs>

                    {/* Özet ve Aksiyonlar */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Özet ve Aksiyonlar</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label htmlFor="analysis_summary">Analiz Özeti</Label>
                                <Textarea
                                    id="analysis_summary"
                                    value={formData.analysis_summary || ''}
                                    onChange={handleChange}
                                    rows={3}
                                    placeholder="Analizin genel özeti..."
                                />
                            </div>
                            <div>
                                <Label htmlFor="immediate_action">Anlık Aksiyon</Label>
                                <Textarea
                                    id="immediate_action"
                                    value={formData.immediate_action || ''}
                                    onChange={handleChange}
                                    rows={3}
                                    placeholder="Hemen alınması gereken aksiyonlar..."
                                />
                            </div>
                            <div>
                                <Label htmlFor="preventive_action">Önleyici Aksiyon</Label>
                                <Textarea
                                    id="preventive_action"
                                    value={formData.preventive_action || ''}
                                    onChange={handleChange}
                                    rows={3}
                                    placeholder="Tekrarını önlemek için alınacak aksiyonlar..."
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOpen(false)}
                            disabled={isSubmitting}
                        >
                            İptal
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default AnalysisFormModal;

