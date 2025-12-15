import React, { useState, useEffect, useCallback } from 'react';
import { Trash2, Plus, Edit, Search, Package } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Combobox } from '@/components/ui/combobox';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const ProductFormModal = ({ open, setOpen, onSuccess, existingProduct, categories }) => {
    const { toast } = useToast();
    const isEditMode = !!existingProduct;
    const [formData, setFormData] = useState({
        product_code: '',
        product_name: '',
        category_id: null,
        description: '',
        part_number: '',
        drawing_number: '',
        revision: '',
        vehicle_model: '',
        vehicle_year: null,
        specifications: {},
        is_active: true
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [specKey, setSpecKey] = useState('');
    const [specValue, setSpecValue] = useState('');

    useEffect(() => {
        const vehicleCategoryId = categories.find(c => c.category_code === 'VEHICLE_TYPES')?.id;
        
        if (isEditMode && existingProduct) {
            setFormData({
                ...existingProduct,
                specifications: existingProduct.specifications || {}
            });
        } else {
            setFormData({
                product_code: '',
                product_name: '',
                category_id: vehicleCategoryId || null,
                description: '',
                part_number: '',
                drawing_number: '',
                revision: '',
                vehicle_model: '',
                vehicle_year: null,
                specifications: {},
                is_active: true
            });
        }
    }, [existingProduct, isEditMode, open, categories]);

    const handleChange = (e) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleSpecAdd = () => {
        if (specKey && specValue) {
            setFormData(prev => ({
                ...prev,
                specifications: {
                    ...prev.specifications,
                    [specKey]: specValue
                }
            }));
            setSpecKey('');
            setSpecValue('');
        }
    };

    const handleSpecRemove = (key) => {
        setFormData(prev => {
            const newSpecs = { ...prev.specifications };
            delete newSpecs[key];
            return { ...prev, specifications: newSpecs };
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.product_code || !formData.product_name || !formData.category_id) {
            toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Lütfen ürün kodu, adı ve kategorisini girin.' });
            return;
        }

        setIsSubmitting(true);

        // FormData'dan gereksiz alanları temizle ve undefined değerleri null'a çevir
        const { id, created_at, updated_at, product_categories, ...rest } = formData;
        
        // Sadece geçerli alanları ekle ve undefined değerleri temizle
        const dataToSubmit = {
            product_code: formData.product_code,
            product_name: formData.product_name,
            category_id: formData.category_id,
            is_active: formData.is_active !== undefined ? formData.is_active : true,
            updated_at: new Date().toISOString()
        };
        
        // Opsiyonel alanları ekle (sadece dolu olanlar)
        if (formData.description && formData.description.trim()) {
            dataToSubmit.description = formData.description.trim();
        }
        
        if (formData.part_number && formData.part_number.trim()) {
            dataToSubmit.part_number = formData.part_number.trim();
        }
        
        if (formData.drawing_number && formData.drawing_number.trim()) {
            dataToSubmit.drawing_number = formData.drawing_number.trim();
        }
        
        if (formData.revision && formData.revision.trim()) {
            dataToSubmit.revision = formData.revision.trim();
        }
        
        if (formData.vehicle_model && formData.vehicle_model.trim()) {
            dataToSubmit.vehicle_model = formData.vehicle_model.trim();
        }
        
        if (formData.vehicle_year !== null && formData.vehicle_year !== undefined && formData.vehicle_year !== '') {
            dataToSubmit.vehicle_year = parseInt(formData.vehicle_year);
        }
        
        // Specifications - boş değilse ekle
        if (formData.specifications && typeof formData.specifications === 'object' && Object.keys(formData.specifications).length > 0) {
            dataToSubmit.specifications = formData.specifications;
        }

        let error;
        if (isEditMode) {
            const { error: updateError } = await supabase.from('products').update(dataToSubmit).eq('id', existingProduct.id);
            error = updateError;
        } else {
            const { error: insertError } = await supabase.from('products').insert([dataToSubmit]);
            error = insertError;
        }

        if (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: `Ürün ${isEditMode ? 'güncellenemedi' : 'eklenemedi'}: ${error.message}` });
        } else {
            toast({ title: 'Başarılı!', description: `Ürün başarıyla ${isEditMode ? 'güncellendi' : 'eklendi'}.` });
            onSuccess();
            setOpen(false);
        }
        setIsSubmitting(false);
    };

    const categoryOptions = categories.map(cat => ({
        value: cat.id,
        label: cat.category_name
    }));

    const selectedCategory = categories.find(c => c.id === formData.category_id);
    const isVehicleType = selectedCategory?.category_code === 'VEHICLE_TYPES';
    const isPart = selectedCategory?.category_code === 'PARTS';

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{isEditMode ? 'Araç Tipi Düzenle' : 'Yeni Araç Tipi Ekle'}</DialogTitle>
                    <DialogDescription>
                        Araç tipi kaydı oluşturun. Tüm modüller buradan veri çekecek.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Ürün Kodu (*)</Label>
                                <Input
                                    id="product_code"
                                    value={formData.product_code}
                                    onChange={handleChange}
                                    required
                                    placeholder="Örn: FTH-240, PAR-001"
                                />
                            </div>
                            <div>
                                <Label>Ürün Adı (*)</Label>
                                <Input
                                    id="product_name"
                                    value={formData.product_name}
                                    onChange={handleChange}
                                    required
                                    placeholder="Ürün adı"
                                />
                            </div>
                        </div>
                        <div>
                            <Label>Kategori (*)</Label>
                            <Input
                                value="Araç Tipleri"
                                disabled
                                className="bg-muted"
                            />
                        </div>
                        {isPart && (
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <Label>Parça Numarası</Label>
                                    <Input
                                        id="part_number"
                                        value={formData.part_number || ''}
                                        onChange={handleChange}
                                        placeholder="Parça no"
                                    />
                                </div>
                                <div>
                                    <Label>Teknik Resim No</Label>
                                    <Input
                                        id="drawing_number"
                                        value={formData.drawing_number || ''}
                                        onChange={handleChange}
                                        placeholder="Resim no"
                                    />
                                </div>
                                <div>
                                    <Label>Revizyon</Label>
                                    <Input
                                        id="revision"
                                        value={formData.revision || ''}
                                        onChange={handleChange}
                                        placeholder="Rev."
                                    />
                                </div>
                            </div>
                        )}
                        {isVehicleType && (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Model</Label>
                                    <Input
                                        id="vehicle_model"
                                        value={formData.vehicle_model || ''}
                                        onChange={handleChange}
                                        placeholder="Model"
                                    />
                                </div>
                                <div>
                                    <Label>Yıl</Label>
                                    <Input
                                        id="vehicle_year"
                                        type="number"
                                        value={formData.vehicle_year || ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, vehicle_year: e.target.value ? parseInt(e.target.value) : null }))}
                                        placeholder="Yıl"
                                    />
                                </div>
                            </div>
                        )}
                        <div>
                            <Label>Açıklama</Label>
                            <Textarea
                                id="description"
                                value={formData.description || ''}
                                onChange={handleChange}
                                rows={3}
                                placeholder="Ürün açıklaması"
                            />
                        </div>
                        <div>
                            <Label>Özellikler (JSON)</Label>
                            <div className="space-y-2">
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Özellik adı (örn: Ağırlık)"
                                        value={specKey}
                                        onChange={(e) => setSpecKey(e.target.value)}
                                    />
                                    <Input
                                        placeholder="Değer (örn: 500kg)"
                                        value={specValue}
                                        onChange={(e) => setSpecValue(e.target.value)}
                                    />
                                    <Button type="button" onClick={handleSpecAdd}>Ekle</Button>
                                </div>
                                {Object.keys(formData.specifications || {}).length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {Object.entries(formData.specifications).map(([key, value]) => (
                                            <Badge key={key} variant="secondary" className="flex items-center gap-1">
                                                {key}: {value}
                                                <button
                                                    type="button"
                                                    onClick={() => handleSpecRemove(key)}
                                                    className="ml-1 hover:text-destructive"
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </button>
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>İptal</Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

const ProductManager = () => {
    const { toast } = useToast();
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [deleteConfirm, setDeleteConfirm] = useState(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // Sadece VEHICLE_TYPES kategorisindeki ürünleri çek
            const { data: vehicleCategory } = await supabase
                .from('product_categories')
                .select('id')
                .eq('category_code', 'VEHICLE_TYPES')
                .single();

            if (!vehicleCategory) {
                throw new Error('VEHICLE_TYPES kategorisi bulunamadı');
            }

            const [productsRes, categoriesRes] = await Promise.all([
                supabase.from('products')
                    .select('*, product_categories(category_code, category_name)')
                    .eq('category_id', vehicleCategory.id)
                    .order('product_name'),
                supabase.from('product_categories')
                    .select('*')
                    .eq('category_code', 'VEHICLE_TYPES')
                    .order('order_index')
            ]);

            if (productsRes.error) throw productsRes.error;
            if (categoriesRes.error) throw categoriesRes.error;

            setProducts(productsRes.data || []);
            setCategories(categoriesRes.data || []);
        } catch (err) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Veriler yüklenemedi: ' + err.message });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const filteredProducts = products.filter(product => {
        const matchesSearch = !searchTerm || 
            product.product_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            product.product_name?.toLowerCase().includes(searchTerm.toLowerCase());
        
        return matchesSearch;
    });

    const handleDelete = async (id) => {
        try {
            const { error } = await supabase.from('products').delete().eq('id', id);
            if (error) throw error;
            toast({ title: 'Başarılı', description: 'Araç tipi silindi.' });
            fetchData();
        } catch (err) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Araç tipi silinemedi: ' + err.message });
        }
        setDeleteConfirm(null);
    };

    return (
        <div className="space-y-4">
            <ProductFormModal
                open={isFormOpen}
                setOpen={setIsFormOpen}
                onSuccess={fetchData}
                existingProduct={selectedProduct}
                categories={categories}
            />

            <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Ürünü Sil</AlertDialogTitle>
                        <AlertDialogDescription>
                            Bu ürünü silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>İptal</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(deleteConfirm)}>Sil</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <div className="flex justify-between items-center">
                <div className="flex gap-4 flex-1">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Araç tipi kodu veya adı ile ara..."
                            className="pl-10"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                <Button onClick={() => {
                    setSelectedProduct(null);
                    setIsFormOpen(true);
                }}>
                    <Plus className="w-4 h-4 mr-2" /> Yeni Araç Tipi
                </Button>
            </div>

            {loading ? (
                <div className="text-center py-10 text-muted-foreground">Yükleniyor...</div>
            ) : (
                <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-muted">
                            <tr>
                                <th className="p-3 text-left">Ürün Kodu</th>
                                <th className="p-3 text-left">Ürün Adı</th>
                                <th className="p-3 text-left">Kategori</th>
                                <th className="p-3 text-left">Parça No</th>
                                <th className="p-3 text-left">Durum</th>
                                <th className="p-3 text-right">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredProducts.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="p-8 text-center text-muted-foreground">
                                        Ürün bulunamadı.
                                    </td>
                                </tr>
                            ) : (
                                filteredProducts.map((product) => (
                                    <tr key={product.id} className="border-t hover:bg-muted/50">
                                        <td className="p-3 font-medium">{product.product_code}</td>
                                        <td className="p-3">{product.product_name}</td>
                                        <td className="p-3">
                                            <Badge variant="outline">
                                                {product.product_categories?.category_name || '-'}
                                            </Badge>
                                        </td>
                                        <td className="p-3">{product.part_number || '-'}</td>
                                        <td className="p-3">
                                            <Badge variant={product.is_active ? 'default' : 'secondary'}>
                                                {product.is_active ? 'Aktif' : 'Pasif'}
                                            </Badge>
                                        </td>
                                        <td className="p-3 text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => {
                                                        setSelectedProduct(product);
                                                        setIsFormOpen(true);
                                                    }}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => setDeleteConfirm(product.id)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default ProductManager;

