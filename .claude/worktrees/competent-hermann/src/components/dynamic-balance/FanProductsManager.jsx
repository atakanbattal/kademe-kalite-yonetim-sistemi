import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit, Trash2, Search, Package } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';

const FanProductFormModal = ({ isOpen, setIsOpen, product, onSuccess }) => {
    const { toast } = useToast();
    const isEditMode = !!product;
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        product_code: '',
        product_name: '',
        fan_weight_kg: '',
        operating_rpm: '',
        correction_radius_mm: '180.0',
        default_balancing_grade: 'G6.3',
        description: ''
    });

    // Ağırlık ve devir bilgilerine göre otomatik kalite sınıfı seçimi
    // NOT: ISO 1940-1'e göre fanlar genellikle G6.3 sınıfına girer
    // Otomatik seçim sadece öneri amaçlıdır, kullanıcı manuel olarak değiştirebilir
    const calculateBalancingGrade = (weight, rpm) => {
        if (!weight || !rpm || weight === '' || rpm === '') {
            return 'G6.3'; // Varsayılan: Fanlar için standart
        }

        const weightNum = parseFloat(weight);
        const rpmNum = parseInt(rpm);

        if (isNaN(weightNum) || isNaN(rpmNum) || weightNum <= 0 || rpmNum <= 0) {
            return 'G6.3'; // Varsayılan: Fanlar için standart
        }

        // ISO 1940-1 standardına göre kalite sınıfı seçimi:
        // G2.5: Yüksek hassasiyet gerektiren uygulamalar (türbinler, hassas motorlar)
        // G6.3: Genel endüstriyel uygulamalar (fanlar, pompalar - STANDART)
        
        // Çok özel durumlar için G2.5 önerisi:
        // - Çok yüksek devir (>8000 RPM) VE çok küçük ağırlık (<0.3 kg)
        if (rpmNum > 8000 && weightNum < 0.3) {
            return 'G2.5';
        }

        // Diğer tüm durumlarda G6.3 (fanlar için standart)
        // Kullanıcı gerekirse manuel olarak G2.5 seçebilir
        return 'G6.3';
    };

    useEffect(() => {
        if (isOpen) {
            if (isEditMode && product) {
                setFormData({
                    product_code: product.product_code || '',
                    product_name: product.product_name || '',
                    fan_weight_kg: product.fan_weight_kg || '',
                    operating_rpm: product.operating_rpm || '',
                    correction_radius_mm: product.correction_radius_mm ? product.correction_radius_mm.toString() : '180.0',
                    default_balancing_grade: product.default_balancing_grade || 'G6.3',
                    description: product.description || ''
                });
            } else {
                setFormData({
                    product_code: '',
                    product_name: '',
                    fan_weight_kg: '',
                    operating_rpm: '',
                    correction_radius_mm: '180.0',
                    default_balancing_grade: 'G6.3',
                    description: ''
                });
            }
        }
    }, [isOpen, isEditMode, product]);

    // Ağırlık veya devir değiştiğinde kalite sınıfını otomatik güncelle
    useEffect(() => {
        if (isOpen && !isEditMode && (formData.fan_weight_kg || formData.operating_rpm)) {
            const calculatedGrade = calculateBalancingGrade(formData.fan_weight_kg, formData.operating_rpm);
            setFormData(prev => ({
                ...prev,
                default_balancing_grade: calculatedGrade
            }));
        }
    }, [formData.fan_weight_kg, formData.operating_rpm, isOpen, isEditMode]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.product_code || !formData.product_name || !formData.fan_weight_kg || !formData.operating_rpm || !formData.correction_radius_mm) {
            toast({
                variant: "destructive",
                title: "Eksik Bilgi!",
                description: "Lütfen zorunlu alanları doldurun."
            });
            return;
        }

        setIsSubmitting(true);

        try {
            const productData = {
                product_code: formData.product_code.trim(),
                product_name: formData.product_name.trim(),
                fan_weight_kg: parseFloat(formData.fan_weight_kg),
                operating_rpm: parseInt(formData.operating_rpm),
                correction_radius_mm: parseFloat(formData.correction_radius_mm),
                default_balancing_grade: formData.default_balancing_grade,
                description: formData.description.trim() || null,
                is_active: true
            };

            if (isEditMode) {
                const { error } = await supabase
                    .from('fan_products')
                    .update(productData)
                    .eq('id', product.id);

                if (error) throw error;

                toast({
                    title: "Başarılı!",
                    description: "Ürün tanımı güncellendi."
                });
            } else {
                const { error } = await supabase
                    .from('fan_products')
                    .insert([productData]);

                if (error) throw error;

                toast({
                    title: "Başarılı!",
                    description: "Yeni ürün tanımı oluşturuldu."
                });
            }

            setIsOpen(false);
            if (onSuccess) onSuccess();
        } catch (error) {
            console.error('Kayıt hatası:', error);
            toast({
                variant: "destructive",
                title: "Hata!",
                description: error.message || "Kayıt işlemi sırasında bir hata oluştu."
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
                <DialogHeader>
                    <DialogTitle>
                        {isEditMode ? 'Ürün Tanımını Düzenle' : 'Yeni Ürün Tanımı'}
                    </DialogTitle>
                    <DialogDescription>
                        Fan ürün tanımı oluşturun veya düzenleyin. Bu bilgiler yeni kayıt oluştururken otomatik olarak kullanılacaktır.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="product_code">
                                Ürün Kodu <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="product_code"
                                value={formData.product_code}
                                onChange={(e) => setFormData(prev => ({ ...prev, product_code: e.target.value }))}
                                placeholder="Örn: FAN-VAC-001"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="product_name">
                                Ürün Adı <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="product_name"
                                value={formData.product_name}
                                onChange={(e) => setFormData(prev => ({ ...prev, product_name: e.target.value }))}
                                placeholder="Örn: Vakumlu Süpürge Fanı"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="fan_weight_kg">
                                Fan Ağırlığı (kg) <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="fan_weight_kg"
                                type="number"
                                step="0.001"
                                value={formData.fan_weight_kg}
                                onChange={(e) => setFormData(prev => ({ ...prev, fan_weight_kg: e.target.value }))}
                                placeholder="Örn: 2.5"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="operating_rpm">
                                Çalışma Devri (RPM) <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="operating_rpm"
                                type="number"
                                value={formData.operating_rpm}
                                onChange={(e) => setFormData(prev => ({ ...prev, operating_rpm: e.target.value }))}
                                placeholder="Örn: 3000"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="correction_radius_mm">
                                Dengeleme Yarıçapı (mm) <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="correction_radius_mm"
                                type="number"
                                step="0.01"
                                value={formData.correction_radius_mm}
                                onChange={(e) => setFormData(prev => ({ ...prev, correction_radius_mm: e.target.value }))}
                                placeholder="Örn: 180"
                                required
                            />
                            <p className="text-xs text-muted-foreground">
                                Balans macunu/ağırlığının eklendiği mesafe (merkezden uzaklık)
                            </p>
                        </div>

                        <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="default_balancing_grade">Varsayılan Kalite Sınıfı</Label>
                            <Select
                                value={formData.default_balancing_grade}
                                onValueChange={(value) => setFormData(prev => ({ ...prev, default_balancing_grade: value }))}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="G2.5">G2.5</SelectItem>
                                    <SelectItem value="G6.3">G6.3</SelectItem>
                                </SelectContent>
                            </Select>
                            {!isEditMode && formData.fan_weight_kg && formData.operating_rpm && (
                                <p className="text-xs text-muted-foreground mt-1">
                                    <strong>Not:</strong> Kalite sınıfı varsayılan olarak G6.3 seçilmiştir (fanlar için standart). 
                                    Gerekirse manuel olarak G2.5 seçebilirsiniz.
                                </p>
                            )}
                        </div>

                        <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="description">Açıklama</Label>
                            <Textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Ürün hakkında ek bilgiler..."
                                rows={3}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                            İptal
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Kaydediliyor...' : isEditMode ? 'Güncelle' : 'Kaydet'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

const FanProductsManager = () => {
    const { toast } = useToast();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isFormModalOpen, setFormModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [productToDelete, setProductToDelete] = useState(null);

    const fetchProducts = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('fan_products')
                .select('*')
                .eq('is_active', true)
                .order('product_code', { ascending: true });

            if (error) throw error;

            setProducts(data || []);
        } catch (error) {
            console.error('Ürün çekme hatası:', error);
            toast({
                variant: "destructive",
                title: "Hata!",
                description: "Ürünler yüklenirken bir hata oluştu: " + error.message
            });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    const handleAddNew = () => {
        setSelectedProduct(null);
        setFormModalOpen(true);
    };

    const handleEdit = (product) => {
        setSelectedProduct(product);
        setFormModalOpen(true);
    };

    const handleDeleteClick = (product) => {
        setProductToDelete(product);
        setDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!productToDelete) return;

        try {
            // Gerçek silme işlemi (hard delete)
            const { error } = await supabase
                .from('fan_products')
                .delete()
                .eq('id', productToDelete.id);

            if (error) throw error;

            toast({
                title: "Başarılı!",
                description: "Ürün tanımı kalıcı olarak silindi."
            });

            setDeleteDialogOpen(false);
            setProductToDelete(null);
            fetchProducts();
        } catch (error) {
            console.error('Silme hatası:', error);
            toast({
                variant: "destructive",
                title: "Hata!",
                description: error.message || "Ürün silinirken bir hata oluştu."
            });
        }
    };

    const filteredProducts = products.filter(product => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
            product.product_code?.toLowerCase().includes(term) ||
            product.product_name?.toLowerCase().includes(term) ||
            product.description?.toLowerCase().includes(term)
        );
    });

    if (loading) {
        return <div className="text-center py-10 text-muted-foreground">Yükleniyor...</div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Fan Ürün Tanımları</h2>
                    <p className="text-muted-foreground mt-1">
                        Fan ürünlerinin ağırlık, devir ve kalite sınıfı bilgilerini tanımlayın.
                    </p>
                </div>
                <Button onClick={handleAddNew}>
                    <Plus className="w-4 h-4 mr-2" /> Yeni Ürün Tanımı
                </Button>
            </div>

            {/* Arama */}
            <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                        placeholder="Ürün kodu, adı veya açıklama ile ara..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="!pl-10"
                    />
                </div>
            </div>

            {/* Ürün Listesi */}
            <div className="overflow-x-auto">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Ürün Kodu</th>
                            <th>Ürün Adı</th>
                            <th>Ağırlık (kg)</th>
                            <th>Devir (RPM)</th>
                            <th>Kalite Sınıfı</th>
                            <th>İşlemler</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredProducts.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="text-center py-10 text-muted-foreground">
                                    {searchTerm ? 'Arama kriterlerine uygun ürün bulunamadı.' : 'Henüz ürün tanımı bulunmamaktadır.'}
                                </td>
                            </tr>
                        ) : (
                            filteredProducts.map((product, index) => (
                                <motion.tr
                                    key={product.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="hover:bg-secondary/50"
                                >
                                    <td className="font-medium">{product.product_code}</td>
                                    <td>{product.product_name}</td>
                                    <td>{product.fan_weight_kg ? product.fan_weight_kg.toFixed(3) : '-'}</td>
                                    <td>{product.operating_rpm || '-'}</td>
                                    <td>
                                        <Badge variant="outline">{product.default_balancing_grade}</Badge>
                                    </td>
                                    <td>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleEdit(product)}
                                            >
                                                <Edit className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDeleteClick(product)}
                                                className="text-destructive hover:text-destructive"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </td>
                                </motion.tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Form Modal */}
            <FanProductFormModal
                isOpen={isFormModalOpen}
                setIsOpen={setFormModalOpen}
                product={selectedProduct}
                onSuccess={fetchProducts}
            />

            {/* Silme Onay Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Ürün Tanımını Silmek İstediğinize Emin misiniz?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Bu işlem geri alınamaz. "{productToDelete?.product_code} - {productToDelete?.product_name}" ürün tanımı kalıcı olarak silinecektir.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>İptal</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Sil
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default FanProductsManager;

