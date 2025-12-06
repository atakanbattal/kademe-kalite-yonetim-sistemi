import React, { useState, useEffect, useMemo } from 'react';
import { X, Save, Loader2, Plus, Trash2, Upload, File, Search, UserPlus } from 'lucide-react';
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
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';

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
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    
    // Personel arama için state'ler
    const [ownerSearchOpen, setOwnerSearchOpen] = useState(false);
    const [ownerSearchValue, setOwnerSearchValue] = useState('');
    const [teamSearchValue, setTeamSearchValue] = useState('');
    
    // Alternatifler için state
    const [alternatives, setAlternatives] = useState([]);
    const [newAlternative, setNewAlternative] = useState(null);
    
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
            // Önce cost_settings'den dene (unit_name kolonu kullanılıyor)
            const { data: costDepts, error: costError } = await supabase
                .from('cost_settings')
                .select('id, unit_name')
                .order('unit_name');

            if (costError) console.warn('cost_settings hatası:', costError);
            
            const formattedCostDepts = (costDepts || []).map(d => ({
                id: d.id,
                name: d.unit_name
            }));

            // Eğer cost_settings boşsa, boş liste kullan (personnel'den çekme)
            if (!formattedCostDepts || formattedCostDepts.length === 0) {
                console.log('⚠️ cost_settings boş - departman seçimi devre dışı');
                setDepartments([]);
            } else {
                console.log('✅ cost_settings\'den departmanlar yüklendi:', formattedCostDepts);
                setDepartments(formattedCostDepts);
            }
        } catch (error) {
            console.error('Departman yüklenirken hata:', error);
            setDepartments([]);
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

    const handleFileSelect = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        // Dosya boyutu kontrolü (10MB)
        const maxSize = 10 * 1024 * 1024;
        const oversizedFiles = files.filter(f => f.size > maxSize);
        
        if (oversizedFiles.length > 0) {
            toast({
                variant: 'destructive',
                title: 'Dosya Çok Büyük',
                description: `Maksimum dosya boyutu 10MB. Lütfen daha küçük dosyalar seçin.`
            });
            return;
        }

        setUploading(true);
        const newFiles = [];

        try {
            for (const file of files) {
                // Dosya metadata'sını kaydet
                newFiles.push({
                    file: file,
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    uploaded: false
                });
            }
            
            setUploadedFiles(prev => [...prev, ...newFiles]);
            
            toast({
                title: 'Dosyalar Hazır',
                description: `${files.length} dosya benchmark'a eklenmeye hazır. Formu kaydettiğinizde yüklenecek.`
            });
        } catch (error) {
            console.error('Dosya hazırlama hatası:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Dosyalar hazırlanırken bir hata oluştu.'
            });
        } finally {
            setUploading(false);
        }
    };

    const handleRemoveFile = (index) => {
        setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    };

    // Filtrelenmiş personel listeleri
    const filteredPersonnelForTeam = useMemo(() => {
        if (!teamSearchValue) return personnel;
        const search = teamSearchValue.toLowerCase();
        return personnel.filter(p => 
            p.full_name?.toLowerCase().includes(search) ||
            p.department?.toLowerCase().includes(search)
        );
    }, [personnel, teamSearchValue]);

    const selectedOwner = useMemo(() => {
        return personnel.find(p => p.id === formData.owner_id);
    }, [personnel, formData.owner_id]);

    const selectedTeamMembers = useMemo(() => {
        return personnel.filter(p => formData.team_members.includes(p.id));
    }, [personnel, formData.team_members]);

    const handleRemoveTeamMember = (personId) => {
        setFormData(prev => ({
            ...prev,
            team_members: prev.team_members.filter(id => id !== personId)
        }));
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
            // UUID alanlarını temizle - boş string'leri null'a çevir
            const cleanOwnerId = formData.owner_id && formData.owner_id.trim() !== '' ? formData.owner_id : null;
            const cleanDepartmentId = formData.department_id && 
                                     formData.department_id.trim() !== '' &&
                                     !formData.department_id.startsWith('dept_') 
                                     ? formData.department_id 
                                     : null;
            
            const dataToSave = {
                ...formData,
                owner_id: cleanOwnerId,
                department_id: cleanDepartmentId,
                team_members: formData.team_members && formData.team_members.length > 0 ? formData.team_members : null,
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

            // Alternatifleri kaydet (eğer varsa)
            if (alternatives.length > 0 && result?.id) {
                console.log(`📦 ${alternatives.length} alternatif kaydediliyor...`);
                
                for (const alt of alternatives) {
                    try {
                        const parseDecimal = (val) => val && val !== '' ? parseFloat(val) : null;
                        const parseIntValue = (val) => val && val !== '' ? parseInt(val) : null;

                        const { error: altError } = await supabase
                            .from('benchmark_items')
                            .insert({
                                benchmark_id: result.id,
                                item_name: alt.item_name,
                                item_code: alt.item_code || null,
                                description: alt.description || null,
                                manufacturer: alt.manufacturer || null,
                                model_number: alt.model_number || null,
                                unit_price: parseDecimal(alt.unit_price),
                                currency: alt.currency || 'TRY',
                                minimum_order_quantity: parseIntValue(alt.minimum_order_quantity),
                                lead_time_days: parseIntValue(alt.lead_time_days),
                                payment_terms: alt.payment_terms || null,
                                total_cost_of_ownership: parseDecimal(alt.total_cost_of_ownership),
                                roi_percentage: parseDecimal(alt.roi_percentage),
                                quality_score: parseDecimal(alt.quality_score),
                                performance_score: parseDecimal(alt.performance_score),
                                reliability_score: parseDecimal(alt.reliability_score),
                                after_sales_service_score: parseDecimal(alt.after_sales_service_score),
                                warranty_period_months: parseIntValue(alt.warranty_period_months),
                                support_availability: alt.support_availability || null,
                                technical_support_score: parseDecimal(alt.technical_support_score),
                                delivery_time_days: parseIntValue(alt.delivery_time_days),
                                implementation_time_days: parseIntValue(alt.implementation_time_days),
                                training_required_hours: parseIntValue(alt.training_required_hours),
                                maintenance_cost: parseDecimal(alt.maintenance_cost),
                                maintenance_frequency_months: parseIntValue(alt.maintenance_frequency_months),
                                energy_efficiency_score: parseDecimal(alt.energy_efficiency_score),
                                environmental_impact_score: parseDecimal(alt.environmental_impact_score),
                                ease_of_use_score: parseDecimal(alt.ease_of_use_score),
                                documentation_quality_score: parseDecimal(alt.documentation_quality_score),
                                scalability_score: parseDecimal(alt.scalability_score),
                                compatibility_score: parseDecimal(alt.compatibility_score),
                                innovation_score: parseDecimal(alt.innovation_score),
                                market_reputation_score: parseDecimal(alt.market_reputation_score),
                                customer_references_count: parseIntValue(alt.customer_references_count),
                                risk_level: alt.risk_level || null
                            });

                        if (altError) throw altError;
                        console.log(`✅ Alternatif kaydedildi: ${alt.item_name}`);
                    } catch (altError) {
                        console.error(`❌ Alternatif kaydetme hatası (${alt.item_name}):`, altError);
                        toast({
                            variant: 'destructive',
                            title: 'Alternatif Kaydetme Hatası',
                            description: `${alt.item_name} kaydedilemedi: ${altError.message}`
                        });
                    }
                }
            }

            // Alternatifleri kaydet (eğer varsa)
            if (alternatives.length > 0 && result?.id) {
                console.log(`📦 ${alternatives.length} alternatif kaydediliyor...`);
                
                for (const alt of alternatives) {
                    try {
                        const parseDecimal = (val) => val && val !== '' ? parseFloat(val) : null;
                        const parseIntValue = (val) => val && val !== '' ? parseInt(val) : null;

                        const { error: altError } = await supabase
                            .from('benchmark_items')
                            .insert({
                                benchmark_id: result.id,
                                item_name: alt.item_name,
                                item_code: alt.item_code || null,
                                description: alt.description || null,
                                manufacturer: alt.manufacturer || null,
                                model_number: alt.model_number || null,
                                unit_price: parseDecimal(alt.unit_price),
                                currency: alt.currency || 'TRY',
                                minimum_order_quantity: parseIntValue(alt.minimum_order_quantity),
                                lead_time_days: parseIntValue(alt.lead_time_days),
                                payment_terms: alt.payment_terms || null,
                                total_cost_of_ownership: parseDecimal(alt.total_cost_of_ownership),
                                roi_percentage: parseDecimal(alt.roi_percentage),
                                quality_score: parseDecimal(alt.quality_score),
                                performance_score: parseDecimal(alt.performance_score),
                                reliability_score: parseDecimal(alt.reliability_score),
                                after_sales_service_score: parseDecimal(alt.after_sales_service_score),
                                warranty_period_months: parseIntValue(alt.warranty_period_months),
                                support_availability: alt.support_availability || null,
                                technical_support_score: parseDecimal(alt.technical_support_score),
                                delivery_time_days: parseIntValue(alt.delivery_time_days),
                                implementation_time_days: parseIntValue(alt.implementation_time_days),
                                training_required_hours: parseIntValue(alt.training_required_hours),
                                maintenance_cost: parseDecimal(alt.maintenance_cost),
                                maintenance_frequency_months: parseIntValue(alt.maintenance_frequency_months),
                                energy_efficiency_score: parseDecimal(alt.energy_efficiency_score),
                                environmental_impact_score: parseDecimal(alt.environmental_impact_score),
                                ease_of_use_score: parseDecimal(alt.ease_of_use_score),
                                documentation_quality_score: parseDecimal(alt.documentation_quality_score),
                                scalability_score: parseDecimal(alt.scalability_score),
                                compatibility_score: parseDecimal(alt.compatibility_score),
                                innovation_score: parseDecimal(alt.innovation_score),
                                market_reputation_score: parseDecimal(alt.market_reputation_score),
                                customer_references_count: parseIntValue(alt.customer_references_count),
                                risk_level: alt.risk_level || null
                            });

                        if (altError) throw altError;
                        console.log(`✅ Alternatif kaydedildi: ${alt.item_name}`);
                    } catch (altError) {
                        console.error(`❌ Alternatif kaydetme hatası (${alt.item_name}):`, altError);
                        toast({
                            variant: 'destructive',
                            title: 'Alternatif Kaydetme Hatası',
                            description: `${alt.item_name} kaydedilemedi: ${altError.message}`
                        });
                    }
                }
            }

            // Dosyaları yükle
            if (uploadedFiles.length > 0) {
                console.log(`📤 ${uploadedFiles.length} dosya yükleniyor...`);
                
                for (const fileData of uploadedFiles) {
                    try {
                        const fileExt = fileData.name.split('.').pop();
                        const fileName = `${result.id}/${Date.now()}_${fileData.name}`;
                        const filePath = `benchmark-documents/${fileName}`;

                        // Dosyayı storage'a yükle
                        const { error: uploadError } = await supabase.storage
                            .from('documents')
                            .upload(filePath, fileData.file, {
                                cacheControl: '3600',
                                upsert: false
                            });

                        if (uploadError) throw uploadError;

                        // Public URL al
                        const { data: { publicUrl } } = supabase.storage
                            .from('documents')
                            .getPublicUrl(filePath);

                        // Metadata kaydet
                        const { error: metaError } = await supabase
                            .from('benchmark_documents')
                            .insert({
                                benchmark_id: result.id,
                                document_title: fileData.name,
                                title: fileData.name, // Alternatif alan
                                file_path: filePath,
                                file_url: publicUrl,
                                file_name: fileData.name,
                                file_type: fileData.type || 'application/octet-stream',
                                file_size: fileData.size,
                                uploaded_by: user?.id
                            });

                        if (metaError) throw metaError;
                        
                        console.log(`✅ Dosya yüklendi: ${fileData.name}`);
                    } catch (fileError) {
                        console.error(`❌ Dosya yükleme hatası (${fileData.name}):`, fileError);
                        toast({
                            variant: 'destructive',
                            title: 'Dosya Yükleme Hatası',
                            description: `${fileData.name} yüklenemedi: ${fileError.message}`
                        });
                    }
                }
                
                // Activity log
                await supabase.from('benchmark_activity_log').insert({
                    benchmark_id: result.id,
                    activity_type: 'Doküman Eklendi',
                    description: `${uploadedFiles.length} dosya yüklendi`,
                    performed_by: user?.id
                });
            }

            toast({
                title: 'Başarılı',
                description: benchmark?.id 
                    ? 'Benchmark başarıyla güncellendi.' 
                    : `Yeni benchmark oluşturuldu${alternatives.length > 0 ? ` ve ${alternatives.length} alternatif eklendi` : ''}${uploadedFiles.length > 0 ? ` ve ${uploadedFiles.length} dosya yüklendi` : ''}.`
            });

            // Formu temizle
            setUploadedFiles([]);
            setAlternatives([]);
            setNewAlternative(null);
            
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
                            <TabsList className="grid w-full grid-cols-4">
                                <TabsTrigger value="basic">Temel Bilgiler</TabsTrigger>
                                <TabsTrigger value="details">Detaylar</TabsTrigger>
                                <TabsTrigger value="team">Ekip & Tarihler</TabsTrigger>
                                <TabsTrigger value="alternatives">Alternatifler</TabsTrigger>
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
                                                <SelectValue placeholder="Birim/Departman seçin" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {departments.length === 0 ? (
                                                    <div className="p-3 text-sm text-muted-foreground">
                                                        <p className="font-medium mb-1">ℹ️ Birim listesi boş</p>
                                                        <p className="text-xs">cost_settings tablosunda birim/departman tanımlı değil.</p>
                                                    </div>
                                                ) : (
                                                    departments.map((dept) => (
                                                        <SelectItem key={dept.id} value={dept.id}>
                                                            {dept.name}
                                                        </SelectItem>
                                                    ))
                                                )}
                                            </SelectContent>
                                        </Select>
                                        {departments.length === 0 && (
                                            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                                                <span>ℹ️</span>
                                                <span>Departman listesi boş. cost_settings tablosuna departman eklerseniz burada görünür.</span>
                                            </p>
                                        )}
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
                                    {personnel.length === 0 ? (
                                        <div className="border rounded-lg p-4 text-center text-sm text-muted-foreground">
                                            <p className="font-medium mb-1">⚠️ Personel bulunamadı</p>
                                            <p className="text-xs">Lütfen personnel tablosuna personel ekleyin.</p>
                                        </div>
                                    ) : (
                                        <>
                                            <Popover open={ownerSearchOpen} onOpenChange={setOwnerSearchOpen}>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        role="combobox"
                                                        aria-expanded={ownerSearchOpen}
                                                        className="w-full justify-between"
                                                    >
                                                        {selectedOwner ? (
                                                            <span className="flex items-center gap-2">
                                                                <UserPlus className="h-4 w-4 text-muted-foreground" />
                                                                {selectedOwner.full_name}
                                                                {selectedOwner.department && (
                                                                    <span className="text-muted-foreground text-sm">
                                                                        ({selectedOwner.department})
                                                                    </span>
                                                                )}
                                                            </span>
                                                        ) : (
                                                            <span className="text-muted-foreground">Sorumlu ara ve seç...</span>
                                                        )}
                                                        <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[400px] p-0">
                                                    <Command>
                                                        <CommandInput 
                                                            placeholder="İsim veya departman ara..." 
                                                            value={ownerSearchValue}
                                                            onValueChange={setOwnerSearchValue}
                                                        />
                                                        <CommandList>
                                                            <CommandEmpty>Sonuç bulunamadı.</CommandEmpty>
                                                            <CommandGroup>
                                                                {personnel
                                                                    .filter(p => {
                                                                        if (!ownerSearchValue) return true;
                                                                        const search = ownerSearchValue.toLowerCase();
                                                                        return p.full_name?.toLowerCase().includes(search) ||
                                                                               p.department?.toLowerCase().includes(search);
                                                                    })
                                                                    .map((person) => (
                                                                        <CommandItem
                                                                            key={person.id}
                                                                            value={person.full_name}
                                                                            onSelect={() => {
                                                                                handleChange('owner_id', person.id);
                                                                                setOwnerSearchOpen(false);
                                                                                setOwnerSearchValue('');
                                                                            }}
                                                                        >
                                                                            <div className="flex flex-col">
                                                                                <span className="font-medium">{person.full_name}</span>
                                                                                {person.department && (
                                                                                    <span className="text-xs text-muted-foreground">
                                                                                        {person.department}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </CommandItem>
                                                                    ))}
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                            {selectedOwner && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleChange('owner_id', '')}
                                                    className="mt-1"
                                                >
                                                    <X className="h-3 w-3 mr-1" />
                                                    Temizle
                                                </Button>
                                            )}
                                        </>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label>Ekip Üyeleri</Label>
                                    {personnel.length === 0 ? (
                                        <div className="border rounded-lg p-4 text-center text-sm text-muted-foreground">
                                            <p className="font-medium mb-1">⚠️ Personel bulunamadı</p>
                                            <p className="text-xs">Lütfen önce personnel tablosuna personel ekleyin.</p>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Arama Input'u */}
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    placeholder="İsim veya departman ara..."
                                                    value={teamSearchValue}
                                                    onChange={(e) => setTeamSearchValue(e.target.value)}
                                                    className="pl-9"
                                                />
                                            </div>

                                            {/* Seçili Ekip Üyeleri */}
                                            {selectedTeamMembers.length > 0 && (
                                                <div className="space-y-2">
                                                    <p className="text-sm font-medium text-muted-foreground">
                                                        Seçili Üyeler ({selectedTeamMembers.length}):
                                                    </p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {selectedTeamMembers.map((person) => (
                                                            <Badge
                                                                key={person.id}
                                                                variant="secondary"
                                                                className="pl-3 pr-1 py-1 flex items-center gap-1"
                                                            >
                                                                <span className="text-sm">
                                                                    {person.full_name}
                                                                    {person.department && (
                                                                        <span className="text-xs text-muted-foreground ml-1">
                                                                            ({person.department})
                                                                        </span>
                                                                    )}
                                                                </span>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-4 w-4 p-0 hover:bg-transparent"
                                                                    onClick={() => handleRemoveTeamMember(person.id)}
                                                                >
                                                                    <X className="h-3 w-3" />
                                                                </Button>
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Personel Listesi */}
                                            <ScrollArea className="border rounded-lg h-48">
                                                <div className="p-2 space-y-1">
                                                    {filteredPersonnelForTeam.length === 0 ? (
                                                        <div className="p-4 text-center text-sm text-muted-foreground">
                                                            <p>Sonuç bulunamadı.</p>
                                                            <p className="text-xs mt-1">Farklı bir arama terimi deneyin.</p>
                                                        </div>
                                                    ) : (
                                                        filteredPersonnelForTeam.map((person) => {
                                                            const isSelected = formData.team_members.includes(person.id);
                                                            return (
                                                                <div
                                                                    key={person.id}
                                                                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                                                                        isSelected 
                                                                            ? 'bg-primary/10 border border-primary/20' 
                                                                            : 'hover:bg-muted/50'
                                                                    }`}
                                                                    onClick={() => handleToggleTeamMember(person.id)}
                                                                >
                                                                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                                                                        isSelected 
                                                                            ? 'bg-primary border-primary' 
                                                                            : 'border-muted-foreground'
                                                                    }`}>
                                                                        {isSelected && (
                                                                            <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                                            </svg>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex-1">
                                                                        <p className="text-sm font-medium">{person.full_name}</p>
                                                                        {person.department && (
                                                                            <p className="text-xs text-muted-foreground">{person.department}</p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })
                                                    )}
                                                </div>
                                            </ScrollArea>

                                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                <span>
                                                    {filteredPersonnelForTeam.length} personel gösteriliyor
                                                </span>
                                                {formData.team_members.length > 0 && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleChange('team_members', [])}
                                                        className="h-7"
                                                    >
                                                        <X className="h-3 w-3 mr-1" />
                                                        Tümünü Temizle
                                                    </Button>
                                                )}
                                            </div>
                                        </>
                                    )}
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

                                {/* Dosya Yükleme Bölümü */}
                                <div className="space-y-2">
                                    <Label>Dokümanlar</Label>
                                    <div className="border-2 border-dashed rounded-lg p-6 text-center">
                                        <input
                                            type="file"
                                            id="file-upload"
                                            className="hidden"
                                            multiple
                                            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif"
                                            onChange={handleFileSelect}
                                            disabled={uploading}
                                        />
                                        <label
                                            htmlFor="file-upload"
                                            className="cursor-pointer flex flex-col items-center gap-2"
                                        >
                                            <Upload className="h-8 w-8 text-muted-foreground" />
                                            <p className="text-sm text-muted-foreground">
                                                {uploading ? 'Dosyalar hazırlanıyor...' : 'Dosya seçmek için tıklayın'}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                PDF, Word, Excel, PowerPoint, Resim (Max 10MB)
                                            </p>
                                        </label>
                                    </div>
                                    
                                    {uploadedFiles.length > 0 && (
                                        <div className="space-y-2 mt-3">
                                            <p className="text-sm font-medium">{uploadedFiles.length} dosya seçildi:</p>
                                            {uploadedFiles.map((file, index) => (
                                                <div
                                                    key={index}
                                                    className="flex items-center justify-between p-2 bg-muted rounded-lg"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <File className="h-4 w-4 text-muted-foreground" />
                                                        <div>
                                                            <p className="text-sm font-medium">{file.name}</p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {(file.size / 1024).toFixed(2)} KB
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleRemoveFile(index)}
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </TabsContent>

                            {/* Alternatifler Sekmesi */}
                            <TabsContent value="alternatives" className="space-y-4 mt-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-lg font-semibold">Karşılaştırılacak Alternatifler</h3>
                                    <Button 
                                        type="button"
                                        size="sm" 
                                        onClick={() => setNewAlternative({
                                            item_name: '',
                                            item_code: '',
                                            description: '',
                                            manufacturer: '',
                                            model_number: '',
                                            unit_price: '',
                                            currency: 'TRY',
                                            total_cost_of_ownership: '',
                                            roi_percentage: '',
                                            quality_score: '',
                                            performance_score: '',
                                            reliability_score: '',
                                            after_sales_service_score: '',
                                            warranty_period_months: '',
                                            support_availability: '',
                                            technical_support_score: '',
                                            delivery_time_days: '',
                                            implementation_time_days: '',
                                            training_required_hours: '',
                                            maintenance_cost: '',
                                            maintenance_frequency_months: '',
                                            energy_efficiency_score: '',
                                            environmental_impact_score: '',
                                            ease_of_use_score: '',
                                            documentation_quality_score: '',
                                            scalability_score: '',
                                            compatibility_score: '',
                                            innovation_score: '',
                                            market_reputation_score: '',
                                            customer_references_count: '',
                                            risk_level: ''
                                        })}
                                    >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Alternatif Ekle
                                    </Button>
                                </div>

                                {newAlternative && (
                                    <div className="p-4 border-2 border-primary rounded-lg bg-muted/30">
                                        <div className="space-y-4">
                                            <div className="grid gap-3 md:grid-cols-2">
                                                <div>
                                                    <Label>Alternatif Adı *</Label>
                                                    <Input
                                                        value={newAlternative.item_name}
                                                        onChange={(e) => setNewAlternative({...newAlternative, item_name: e.target.value})}
                                                        placeholder="Örn: Alternatif A"
                                                    />
                                                </div>
                                                <div>
                                                    <Label>Kod</Label>
                                                    <Input
                                                        value={newAlternative.item_code}
                                                        onChange={(e) => setNewAlternative({...newAlternative, item_code: e.target.value})}
                                                        placeholder="Ürün/Parça kodu"
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid gap-3 md:grid-cols-2">
                                                <div>
                                                    <Label>Üretici</Label>
                                                    <Input
                                                        value={newAlternative.manufacturer}
                                                        onChange={(e) => setNewAlternative({...newAlternative, manufacturer: e.target.value})}
                                                    />
                                                </div>
                                                <div>
                                                    <Label>Model/Seri No</Label>
                                                    <Input
                                                        value={newAlternative.model_number}
                                                        onChange={(e) => setNewAlternative({...newAlternative, model_number: e.target.value})}
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <Label>Açıklama</Label>
                                                <Textarea
                                                    value={newAlternative.description}
                                                    onChange={(e) => setNewAlternative({...newAlternative, description: e.target.value})}
                                                    rows={2}
                                                />
                                            </div>
                                            
                                            {/* Hızlı Kriter Girişi */}
                                            <div className="grid gap-3 md:grid-cols-4 pt-2 border-t">
                                                <div>
                                                    <Label>Birim Fiyat</Label>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        value={newAlternative.unit_price}
                                                        onChange={(e) => setNewAlternative({...newAlternative, unit_price: e.target.value})}
                                                    />
                                                </div>
                                                <div>
                                                    <Label>TCO</Label>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        value={newAlternative.total_cost_of_ownership}
                                                        onChange={(e) => setNewAlternative({...newAlternative, total_cost_of_ownership: e.target.value})}
                                                    />
                                                </div>
                                                <div>
                                                    <Label>ROI %</Label>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        value={newAlternative.roi_percentage}
                                                        onChange={(e) => setNewAlternative({...newAlternative, roi_percentage: e.target.value})}
                                                    />
                                                </div>
                                                <div>
                                                    <Label>Kalite Skoru (0-100)</Label>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        max="100"
                                                        value={newAlternative.quality_score}
                                                        onChange={(e) => setNewAlternative({...newAlternative, quality_score: e.target.value})}
                                                    />
                                                </div>
                                            </div>
                                            
                                            <div className="grid gap-3 md:grid-cols-4">
                                                <div>
                                                    <Label>Performans (0-100)</Label>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        max="100"
                                                        value={newAlternative.performance_score}
                                                        onChange={(e) => setNewAlternative({...newAlternative, performance_score: e.target.value})}
                                                    />
                                                </div>
                                                <div>
                                                    <Label>Teslimat Süresi (gün)</Label>
                                                    <Input
                                                        type="number"
                                                        value={newAlternative.delivery_time_days}
                                                        onChange={(e) => setNewAlternative({...newAlternative, delivery_time_days: e.target.value})}
                                                    />
                                                </div>
                                                <div>
                                                    <Label>Satış Sonrası (0-100)</Label>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        max="100"
                                                        value={newAlternative.after_sales_service_score}
                                                        onChange={(e) => setNewAlternative({...newAlternative, after_sales_service_score: e.target.value})}
                                                    />
                                                </div>
                                                <div>
                                                    <Label>Risk Seviyesi</Label>
                                                    <Select
                                                        value={newAlternative.risk_level}
                                                        onValueChange={(value) => setNewAlternative({...newAlternative, risk_level: value})}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Seçin" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="Düşük">Düşük</SelectItem>
                                                            <SelectItem value="Orta">Orta</SelectItem>
                                                            <SelectItem value="Yüksek">Yüksek</SelectItem>
                                                            <SelectItem value="Kritik">Kritik</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>

                                            <div className="flex gap-2 pt-2 border-t">
                                                <Button 
                                                    type="button"
                                                    size="sm" 
                                                    onClick={() => {
                                                        if (!newAlternative.item_name.trim()) {
                                                            toast({
                                                                variant: 'destructive',
                                                                title: 'Hata',
                                                                description: 'Alternatif adı zorunludur.'
                                                            });
                                                            return;
                                                        }
                                                        setAlternatives([...alternatives, {...newAlternative}]);
                                                        setNewAlternative(null);
                                                        toast({
                                                            title: 'Başarılı',
                                                            description: 'Alternatif eklendi. Benchmark kaydedildiğinde kaydedilecek.'
                                                        });
                                                    }}
                                                >
                                                    <Plus className="mr-2 h-4 w-4" />
                                                    Ekle
                                                </Button>
                                                <Button 
                                                    type="button"
                                                    size="sm" 
                                                    variant="outline" 
                                                    onClick={() => setNewAlternative(null)}
                                                >
                                                    İptal
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {alternatives.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-sm font-medium">Eklenen Alternatifler ({alternatives.length}):</p>
                                        {alternatives.map((alt, idx) => (
                                            <div key={idx} className="p-3 border rounded-lg flex items-center justify-between">
                                                <div>
                                                    <p className="font-medium">{alt.item_name}</p>
                                                    {alt.unit_price && (
                                                        <p className="text-sm text-muted-foreground">
                                                            Fiyat: {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: alt.currency || 'TRY' }).format(alt.unit_price)}
                                                        </p>
                                                    )}
                                                </div>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => setAlternatives(alternatives.filter((_, i) => i !== idx))}
                                                >
                                                    <Trash2 className="h-4 w-4 text-red-500" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {alternatives.length === 0 && !newAlternative && (
                                    <div className="p-4 bg-muted rounded-lg text-center text-sm text-muted-foreground">
                                        Henüz alternatif eklenmedi. "+ Alternatif Ekle" butonuna tıklayarak alternatif ekleyebilirsiniz.
                                    </div>
                                )}
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

