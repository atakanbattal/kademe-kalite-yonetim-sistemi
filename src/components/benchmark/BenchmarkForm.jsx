import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, Plus, Trash2 } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

const BenchmarkForm = ({ 
    isOpen, 
    onClose, 
    benchmark = null,
    categories,
    personnel,
    onSuccess 
}) => {
    const { toast } = useToast();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [departments, setDepartments] = useState([]);
    
    // Form state
    const [formData, setFormData] = useState({
        category_id: '',
        title: '',
        description: '',
        objective: '',
        scope: '',
        status: 'Taslak',
        priority: 'Normal',
        owner_id: '',
        department_id: '',
        team_members: [],
        start_date: '',
        target_completion_date: '',
        estimated_budget: '',
        currency: 'TRY',
        tags: [],
        notes: ''
    });

    const [tagInput, setTagInput] = useState('');

    useEffect(() => {
        fetchDepartments();
        
        if (benchmark) {
            setFormData({
                category_id: benchmark.category_id || '',
                title: benchmark.title || '',
                description: benchmark.description || '',
                objective: benchmark.objective || '',
                scope: benchmark.scope || '',
                status: benchmark.status || 'Taslak',
                priority: benchmark.priority || 'Normal',
                owner_id: benchmark.owner_id || '',
                department_id: benchmark.department_id || '',
                team_members: benchmark.team_members || [],
                start_date: benchmark.start_date || '',
                target_completion_date: benchmark.target_completion_date || '',
                estimated_budget: benchmark.estimated_budget || '',
                currency: benchmark.currency || 'TRY',
                tags: benchmark.tags || [],
                notes: benchmark.notes || ''
            });
        }
    }, [benchmark]);
    
    // Kategorileri kontrol et ve uyar
    useEffect(() => {
        console.log('📊 Kategoriler yüklendi:', categories);
        
        if (isOpen && categories.length === 0) {
            console.error('❌ Kategoriler boş!');
            toast({
                variant: 'destructive',
                title: 'Kategoriler Yüklenemedi',
                description: 'Lütfen Supabase SQL Editor\'de create-benchmark-module.sql dosyasını çalıştırın.'
            });
        } else if (isOpen && categories.length > 0) {
            console.log('✅ Kategoriler hazır:', categories.length);
        }
    }, [categories, isOpen, toast]);

    const fetchDepartments = async () => {
        try {
            const { data, error } = await supabase
                .from('cost_settings')
                .select('id, department_name')
                .order('department_name');

            if (error) throw error;
            setDepartments(data || []);
        } catch (error) {
            console.error('Departman yüklenirken hata:', error);
        }
    };

    const handleChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleAddTag = (e) => {
        if (e.key === 'Enter' && tagInput.trim()) {
            e.preventDefault();
            if (!formData.tags.includes(tagInput.trim())) {
                setFormData(prev => ({
                    ...prev,
                    tags: [...prev.tags, tagInput.trim()]
                }));
            }
            setTagInput('');
        }
    };

    const handleRemoveTag = (tagToRemove) => {
        setFormData(prev => ({
            ...prev,
            tags: prev.tags.filter(tag => tag !== tagToRemove)
        }));
    };

    const handleToggleTeamMember = (personId) => {
        setFormData(prev => {
            const isSelected = prev.team_members.includes(personId);
            return {
                ...prev,
                team_members: isSelected
                    ? prev.team_members.filter(id => id !== personId)
                    : [...prev.team_members, personId]
            };
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Validation
        if (!formData.category_id) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Kategori seçimi zorunludur.'
            });
            return;
        }

        if (!formData.title.trim()) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Başlık zorunludur.'
            });
            return;
        }

        if (!formData.description.trim()) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Açıklama zorunludur.'
            });
            return;
        }

        setLoading(true);

        try {
            const dataToSave = {
                ...formData,
                estimated_budget: formData.estimated_budget 
                    ? parseFloat(formData.estimated_budget) 
                    : null,
                created_by: user?.id
            };

            let result;

            if (benchmark?.id) {
                // Update existing
                const { data, error } = await supabase
                    .from('benchmarks')
                    .update(dataToSave)
                    .eq('id', benchmark.id)
                    .select()
                    .single();

                if (error) throw error;
                result = data;

                // Log activity
                await supabase.from('benchmark_activity_log').insert({
                    benchmark_id: benchmark.id,
                    activity_type: 'Güncellendi',
                    description: 'Benchmark kaydı güncellendi',
                    performed_by: user?.id
                });
            } else {
                // Generate benchmark number
                const { data: numberData, error: numberError } = await supabase
                    .rpc('generate_benchmark_number');

                if (numberError) throw numberError;

                dataToSave.benchmark_number = numberData;

                // Create new
                const { data, error } = await supabase
                    .from('benchmarks')
                    .insert(dataToSave)
                    .select()
                    .single();

                if (error) throw error;
                result = data;

                // Log activity
                await supabase.from('benchmark_activity_log').insert({
                    benchmark_id: result.id,
                    activity_type: 'Oluşturuldu',
                    description: 'Yeni benchmark kaydı oluşturuldu',
                    performed_by: user?.id
                });
            }

            toast({
                title: 'Başarılı',
                description: benchmark?.id 
                    ? 'Benchmark başarıyla güncellendi.' 
                    : 'Yeni benchmark başarıyla oluşturuldu.'
            });

            onSuccess(result);
        } catch (error) {
            console.error('Kaydetme hatası:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Benchmark kaydedilirken bir hata oluştu: ' + error.message
            });
        } finally {
            setLoading(false);
        }
    };

    const statuses = [
        'Taslak',
        'Devam Ediyor',
        'Analiz Aşamasında',
        'Onay Bekliyor',
        'Tamamlandı',
        'İptal'
    ];

    const priorities = ['Kritik', 'Yüksek', 'Normal', 'Düşük'];
    const currencies = ['TRY', 'USD', 'EUR'];

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle>
                        {benchmark?.id ? 'Benchmark Düzenle' : 'Yeni Benchmark Oluştur'}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit}>
                    <ScrollArea className="h-[calc(90vh-200px)] pr-4">
                        <Tabs defaultValue="basic" className="w-full">
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="basic">Temel Bilgiler</TabsTrigger>
                                <TabsTrigger value="details">Detaylar</TabsTrigger>
                                <TabsTrigger value="team">Ekip & Tarihler</TabsTrigger>
                            </TabsList>

                            {/* Temel Bilgiler */}
                            <TabsContent value="basic" className="space-y-4 mt-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="category_id">
                                            Kategori <span className="text-red-500">*</span>
                                        </Label>
                                        {categories.length === 0 ? (
                                            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                                <p className="text-sm text-yellow-800">
                                                    ⚠️ Kategoriler yüklenemedi. Lütfen veritabanında 
                                                    <code className="mx-1 px-2 py-1 bg-yellow-100 rounded">benchmark_categories</code> 
                                                    tablosunu kontrol edin.
                                                </p>
                                                <p className="text-xs text-yellow-700 mt-2">
                                                    SQL: <code>scripts/fix-benchmark-categories.sql</code> dosyasını çalıştırın.
                                                </p>
                                            </div>
                                        ) : (
                                            <Select
                                                value={formData.category_id}
                                                onValueChange={(value) => handleChange('category_id', value)}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Kategori seçin" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {categories.map((cat) => (
                                                        <SelectItem key={cat.id} value={cat.id}>
                                                            {cat.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="status">Durum</Label>
                                        <Select
                                            value={formData.status}
                                            onValueChange={(value) => handleChange('status', value)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {statuses.map((status) => (
                                                    <SelectItem key={status} value={status}>
                                                        {status}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="title">
                                        Başlık <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        id="title"
                                        value={formData.title}
                                        onChange={(e) => handleChange('title', e.target.value)}
                                        placeholder="Benchmark başlığı"
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="description">
                                        Açıklama <span className="text-red-500">*</span>
                                    </Label>
                                    <Textarea
                                        id="description"
                                        value={formData.description}
                                        onChange={(e) => handleChange('description', e.target.value)}
                                        placeholder="Benchmark detaylı açıklaması"
                                        rows={4}
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="priority">Öncelik</Label>
                                    <Select
                                        value={formData.priority}
                                        onValueChange={(value) => handleChange('priority', value)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {priorities.map((priority) => (
                                                <SelectItem key={priority} value={priority}>
                                                    {priority}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="tags">Etiketler</Label>
                                    <Input
                                        id="tags"
                                        value={tagInput}
                                        onChange={(e) => setTagInput(e.target.value)}
                                        onKeyDown={handleAddTag}
                                        placeholder="Etiket eklemek için yazın ve Enter'a basın"
                                    />
                                    {formData.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {formData.tags.map((tag, idx) => (
                                                <Badge
                                                    key={idx}
                                                    variant="secondary"
                                                    className="cursor-pointer"
                                                    onClick={() => handleRemoveTag(tag)}
                                                >
                                                    {tag}
                                                    <X className="ml-1 h-3 w-3" />
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </TabsContent>

                            {/* Detaylar */}
                            <TabsContent value="details" className="space-y-4 mt-4">
                                <div className="space-y-2">
                                    <Label htmlFor="objective">Benchmark Amacı</Label>
                                    <Textarea
                                        id="objective"
                                        value={formData.objective}
                                        onChange={(e) => handleChange('objective', e.target.value)}
                                        placeholder="Bu benchmark çalışmasının amacı nedir?"
                                        rows={3}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="scope">Kapsam</Label>
                                    <Textarea
                                        id="scope"
                                        value={formData.scope}
                                        onChange={(e) => handleChange('scope', e.target.value)}
                                        placeholder="Benchmark kapsamı ve sınırları"
                                        rows={3}
                                    />
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="department_id">İlgili Departman</Label>
                                        <Select
                                            value={formData.department_id}
                                            onValueChange={(value) => handleChange('department_id', value)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Departman seçin" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {departments.map((dept) => (
                                                    <SelectItem key={dept.id} value={dept.id}>
                                                        {dept.department_name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="estimated_budget">Tahmini Bütçe</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                id="estimated_budget"
                                                type="number"
                                                step="0.01"
                                                value={formData.estimated_budget}
                                                onChange={(e) => handleChange('estimated_budget', e.target.value)}
                                                placeholder="0.00"
                                                className="flex-1"
                                            />
                                            <Select
                                                value={formData.currency}
                                                onValueChange={(value) => handleChange('currency', value)}
                                            >
                                                <SelectTrigger className="w-24">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {currencies.map((curr) => (
                                                        <SelectItem key={curr} value={curr}>
                                                            {curr}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="notes">Notlar</Label>
                                    <Textarea
                                        id="notes"
                                        value={formData.notes}
                                        onChange={(e) => handleChange('notes', e.target.value)}
                                        placeholder="Ek notlar ve açıklamalar"
                                        rows={4}
                                    />
                                </div>
                            </TabsContent>

                            {/* Ekip & Tarihler */}
                            <TabsContent value="team" className="space-y-4 mt-4">
                                <div className="space-y-2">
                                    <Label htmlFor="owner_id">Benchmark Sorumlusu</Label>
                                    <Select
                                        value={formData.owner_id}
                                        onValueChange={(value) => handleChange('owner_id', value)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Sorumlu seçin" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {personnel.map((person) => (
                                                <SelectItem key={person.id} value={person.id}>
                                                    {person.name}
                                                    {person.department && ` - ${person.department}`}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Ekip Üyeleri</Label>
                                    <div className="border rounded-lg p-4 max-h-48 overflow-y-auto">
                                        {personnel.map((person) => (
                                            <div
                                                key={person.id}
                                                className="flex items-center space-x-2 py-2 hover:bg-muted/50 px-2 rounded cursor-pointer"
                                                onClick={() => handleToggleTeamMember(person.id)}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={formData.team_members.includes(person.id)}
                                                    onChange={() => handleToggleTeamMember(person.id)}
                                                    className="cursor-pointer"
                                                />
                                                <span className="text-sm">
                                                    {person.name}
                                                    {person.department && (
                                                        <span className="text-muted-foreground ml-1">
                                                            ({person.department})
                                                        </span>
                                                    )}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {formData.team_members.length} kişi seçildi
                                    </p>
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="start_date">Başlangıç Tarihi</Label>
                                        <Input
                                            id="start_date"
                                            type="date"
                                            value={formData.start_date}
                                            onChange={(e) => handleChange('start_date', e.target.value)}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="target_completion_date">
                                            Hedef Tamamlanma Tarihi
                                        </Label>
                                        <Input
                                            id="target_completion_date"
                                            type="date"
                                            value={formData.target_completion_date}
                                            onChange={(e) => handleChange('target_completion_date', e.target.value)}
                                        />
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </ScrollArea>

                    <DialogFooter className="mt-6">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            disabled={loading}
                        >
                            İptal
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Kaydediliyor...
                                </>
                            ) : (
                                <>
                                    <Save className="mr-2 h-4 w-4" />
                                    Kaydet
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default BenchmarkForm;

