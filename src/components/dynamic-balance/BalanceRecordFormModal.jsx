import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { calculateISO1940_1Uper, checkBalanceResult } from '@/lib/utils';
import { CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const BalanceRecordFormModal = ({ isOpen, setIsOpen, record, fanProducts, onSuccess }) => {
    const { toast } = useToast();
    const { user } = useAuth();
    const isEditMode = !!record;

    const [formData, setFormData] = useState({
        serial_number: '',
        product_id: '',
        fan_weight_kg: '',
        operating_rpm: '',
        correction_radius_mm: '180.0',
        balancing_grade: 'G6.3',
        test_date: new Date().toISOString().split('T')[0],
        test_operator: '',
        supplier_name: '',
        initial_left_weight_gr: '',
        initial_left_angle_deg: '',
        initial_right_weight_gr: '',
        initial_right_angle_deg: '',
        residual_left_weight_gr: '',
        residual_left_angle_deg: '',
        residual_right_weight_gr: '',
        residual_right_angle_deg: '',
        notes: ''
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [calculatedUper, setCalculatedUper] = useState(null);
    const [leftPlanePass, setLeftPlanePass] = useState(null);
    const [rightPlanePass, setRightPlanePass] = useState(null);

    // Form verilerini yükle
    useEffect(() => {
        if (isOpen) {
            if (isEditMode && record) {
                setFormData({
                    serial_number: record.serial_number || '',
                    product_id: record.product_id || '',
                    fan_weight_kg: record.fan_weight_kg || '',
                    operating_rpm: record.operating_rpm || '',
                    balancing_grade: record.balancing_grade || 'G6.3',
                    test_date: record.test_date || new Date().toISOString().split('T')[0],
                    test_operator: record.test_operator || '',
                    supplier_name: record.supplier_name || '',
                    initial_left_weight_gr: record.initial_left_weight_gr || '',
                    initial_left_angle_deg: record.initial_left_angle_deg || '',
                    initial_right_weight_gr: record.initial_right_weight_gr || '',
                    initial_right_angle_deg: record.initial_right_angle_deg || '',
                    residual_left_weight_gr: record.residual_left_weight_gr || '',
                    residual_left_angle_deg: record.residual_left_angle_deg || '',
                    residual_right_weight_gr: record.residual_right_weight_gr || '',
                    residual_right_angle_deg: record.residual_right_angle_deg || '',
                    notes: record.notes || ''
                });
            } else {
                // Yeni kayıt için varsayılan değerler
                setFormData({
                    serial_number: '',
                    product_id: '',
                    fan_weight_kg: '',
                    operating_rpm: '',
                    correction_radius_mm: '180.0',
                    balancing_grade: 'G6.3',
                    test_date: new Date().toISOString().split('T')[0],
                    test_operator: '',
                    supplier_name: '',
                    initial_left_weight_gr: '',
                    initial_left_angle_deg: '',
                    initial_right_weight_gr: '',
                    initial_right_angle_deg: '',
                    residual_left_weight_gr: '',
                    residual_left_angle_deg: '',
                    residual_right_weight_gr: '',
                    residual_right_angle_deg: '',
                    notes: ''
                });
            }
        }
    }, [isOpen, isEditMode, record]);

    // Ürün seçildiğinde ağırlık ve devir bilgilerini otomatik doldur
    useEffect(() => {
        if (formData.product_id && formData.product_id !== 'none' && fanProducts && fanProducts.length > 0) {
            const selectedProduct = fanProducts.find(p => p.id === formData.product_id);
            if (selectedProduct) {
                setFormData(prev => ({
                    ...prev,
                    fan_weight_kg: selectedProduct.fan_weight_kg || prev.fan_weight_kg,
                    operating_rpm: selectedProduct.operating_rpm || prev.operating_rpm,
                    balancing_grade: selectedProduct.default_balancing_grade || prev.balancing_grade
                }));
            }
        }
    }, [formData.product_id, fanProducts]);

    // ISO 1940-1 hesaplaması ve sonuç kontrolü
    useEffect(() => {
        if (formData.fan_weight_kg && formData.operating_rpm && formData.balancing_grade && formData.correction_radius_mm) {
            const uper = calculateISO1940_1Uper(
                formData.balancing_grade,
                parseFloat(formData.fan_weight_kg),
                parseInt(formData.operating_rpm),
                parseFloat(formData.correction_radius_mm)
            );
            setCalculatedUper(uper);

            // Sol düzlem kontrolü
            if (formData.residual_left_weight_gr) {
                const pass = checkBalanceResult(
                    parseFloat(formData.residual_left_weight_gr),
                    uper
                );
                setLeftPlanePass(pass);
            } else {
                setLeftPlanePass(null);
            }

            // Sağ düzlem kontrolü
            if (formData.residual_right_weight_gr) {
                const pass = checkBalanceResult(
                    parseFloat(formData.residual_right_weight_gr),
                    uper
                );
                setRightPlanePass(pass);
            } else {
                setRightPlanePass(null);
            }
        } else {
            setCalculatedUper(null);
            setLeftPlanePass(null);
            setRightPlanePass(null);
        }
    }, [formData.fan_weight_kg, formData.operating_rpm, formData.balancing_grade, formData.correction_radius_mm, formData.residual_left_weight_gr, formData.residual_right_weight_gr]);

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.serial_number || !formData.fan_weight_kg || !formData.operating_rpm) {
            toast({
                variant: "destructive",
                title: "Eksik Bilgi!",
                description: "Lütfen zorunlu alanları doldurun."
            });
            return;
        }

        setIsSubmitting(true);

        try {
            const recordData = {
                serial_number: formData.serial_number,
                product_id: (formData.product_id && formData.product_id !== 'none') ? formData.product_id : null,
                fan_weight_kg: parseFloat(formData.fan_weight_kg),
                operating_rpm: parseInt(formData.operating_rpm),
                correction_radius_mm: parseFloat(formData.correction_radius_mm),
                balancing_grade: formData.balancing_grade,
                test_date: formData.test_date,
                test_operator: formData.test_operator || null,
                supplier_name: formData.supplier_name || null,
                initial_left_weight_gr: formData.initial_left_weight_gr ? parseFloat(formData.initial_left_weight_gr) : null,
                initial_left_angle_deg: formData.initial_left_angle_deg ? parseFloat(formData.initial_left_angle_deg) : null,
                initial_right_weight_gr: formData.initial_right_weight_gr ? parseFloat(formData.initial_right_weight_gr) : null,
                initial_right_angle_deg: formData.initial_right_angle_deg ? parseFloat(formData.initial_right_angle_deg) : null,
                residual_left_weight_gr: formData.residual_left_weight_gr ? parseFloat(formData.residual_left_weight_gr) : null,
                residual_left_angle_deg: formData.residual_left_angle_deg ? parseFloat(formData.residual_left_angle_deg) : null,
                residual_right_weight_gr: formData.residual_right_weight_gr ? parseFloat(formData.residual_right_weight_gr) : null,
                residual_right_angle_deg: formData.residual_right_angle_deg ? parseFloat(formData.residual_right_angle_deg) : null,
                notes: formData.notes || null,
                created_by: user?.id || null
            };

            if (isEditMode) {
                const { error } = await supabase
                    .from('fan_balance_records')
                    .update(recordData)
                    .eq('id', record.id);

                if (error) throw error;

                toast({
                    title: "Başarılı!",
                    description: "Balans kaydı güncellendi."
                });
            } else {
                const { error } = await supabase
                    .from('fan_balance_records')
                    .insert([recordData]);

                if (error) throw error;

                toast({
                    title: "Başarılı!",
                    description: "Yeni balans kaydı oluşturuldu."
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

    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                <DialogHeader className="flex-shrink-0">
                    <DialogTitle>
                        {isEditMode ? 'Balans Kaydını Düzenle' : 'Yeni Balans Kaydı'}
                    </DialogTitle>
                    <DialogDescription>
                        ISO 1940-1 standardına göre dinamik balans kaydı oluşturun veya düzenleyin.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-4 space-y-6 py-4 min-h-0">
                    {/* Temel Bilgiler */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold">Temel Bilgiler</h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="serial_number">
                                    Fan Seri Numarası <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="serial_number"
                                    value={formData.serial_number}
                                    onChange={(e) => handleInputChange('serial_number', e.target.value)}
                                    placeholder="Örn: FAN-2024-001"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="product_id">Ürün Tanımı</Label>
                                <Select
                                    value={formData.product_id || undefined}
                                    onValueChange={(value) => handleInputChange('product_id', value === 'none' ? '' : value)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Ürün seçin (opsiyonel)" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Ürün seçilmedi</SelectItem>
                                        {fanProducts && fanProducts.length > 0 ? (
                                            fanProducts.map(product => (
                                                <SelectItem key={product.id} value={product.id}>
                                                    {product.product_code} - {product.product_name}
                                                </SelectItem>
                                            ))
                                        ) : null}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="test_date">Test Tarihi</Label>
                                <Input
                                    id="test_date"
                                    type="date"
                                    value={formData.test_date}
                                    onChange={(e) => handleInputChange('test_date', e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="supplier_name">Tedarikçi Adı</Label>
                                <Input
                                    id="supplier_name"
                                    value={formData.supplier_name}
                                    onChange={(e) => handleInputChange('supplier_name', e.target.value)}
                                    placeholder="Tedarikçi adı"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Parametreler */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold">Parametreler</h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="fan_weight_kg">
                                    Fan Ağırlığı (kg) <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="fan_weight_kg"
                                    type="number"
                                    step="0.001"
                                    value={formData.fan_weight_kg}
                                    onChange={(e) => handleInputChange('fan_weight_kg', e.target.value)}
                                    placeholder="Örn: 30"
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
                                    onChange={(e) => handleInputChange('operating_rpm', e.target.value)}
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
                                    onChange={(e) => handleInputChange('correction_radius_mm', e.target.value)}
                                    placeholder="Örn: 180"
                                    required
                                />
                                <p className="text-xs text-muted-foreground">
                                    Balans macunu/ağırlığının eklendiği mesafe (merkezden uzaklık)
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="balancing_grade">Kalite Sınıfı</Label>
                                <Select
                                    value={formData.balancing_grade}
                                    onValueChange={(value) => handleInputChange('balancing_grade', value)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="G2.5">G2.5</SelectItem>
                                        <SelectItem value="G6.3">G6.3</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Hesaplanan Uper Değeri */}
                        {calculatedUper !== null && (
                            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                                    Hesaplanan İzin Verilen Limit (Uper): <span className="font-bold">{calculatedUper.toFixed(3)} gr</span>
                                </p>
                                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                                    ISO 1940-1 formülü: (9550 × G × Ağırlık) / (Devir × Yarıçap) / 2
                                    <br />
                                    <span className="text-xs">Her düzlem için limit hesaplanır</span>
                                </p>
                            </div>
                        )}
                    </div>

                    {/* İlk Durum Ölçümleri */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold">İlk Durum (Initial / Düzeltme Öncesi)</h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* LINKS (Sol Düzlem) */}
                            <div className="space-y-4 p-4 border rounded-lg">
                                <h4 className="font-medium text-sm">LINKS (Sol Düzlem / Left Plane / 1. Yatak)</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="initial_left_weight_gr">Ağırlık (gr)</Label>
                                        <Input
                                            id="initial_left_weight_gr"
                                            type="number"
                                            step="0.001"
                                            value={formData.initial_left_weight_gr}
                                            onChange={(e) => handleInputChange('initial_left_weight_gr', e.target.value)}
                                            placeholder="0.000"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="initial_left_angle_deg">Açı (°)</Label>
                                        <Input
                                            id="initial_left_angle_deg"
                                            type="number"
                                            step="0.01"
                                            value={formData.initial_left_angle_deg}
                                            onChange={(e) => handleInputChange('initial_left_angle_deg', e.target.value)}
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* RECHTS (Sağ Düzlem) */}
                            <div className="space-y-4 p-4 border rounded-lg">
                                <h4 className="font-medium text-sm">RECHTS (Sağ Düzlem / Right Plane / 2. Yatak)</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="initial_right_weight_gr">Ağırlık (gr)</Label>
                                        <Input
                                            id="initial_right_weight_gr"
                                            type="number"
                                            step="0.001"
                                            value={formData.initial_right_weight_gr}
                                            onChange={(e) => handleInputChange('initial_right_weight_gr', e.target.value)}
                                            placeholder="0.000"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="initial_right_angle_deg">Açı (°)</Label>
                                        <Input
                                            id="initial_right_angle_deg"
                                            type="number"
                                            step="0.01"
                                            value={formData.initial_right_angle_deg}
                                            onChange={(e) => handleInputChange('initial_right_angle_deg', e.target.value)}
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Kalan Durum Ölçümleri */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold">Kalan Durum (Residual / Düzeltme Sonrası)</h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* LINKS (Sol Düzlem) */}
                            <div className="space-y-4 p-4 border rounded-lg">
                                <h4 className="font-medium text-sm">LINKS (Sol Düzlem / Left Plane / 1. Yatak)</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="residual_left_weight_gr">Kalan Ağırlık (gr)</Label>
                                        <div className="relative">
                                            <Input
                                                id="residual_left_weight_gr"
                                                type="number"
                                                step="0.001"
                                                value={formData.residual_left_weight_gr}
                                                onChange={(e) => handleInputChange('residual_left_weight_gr', e.target.value)}
                                                placeholder="0.000"
                                                className={cn(
                                                    leftPlanePass === true && "border-green-500 bg-green-50 dark:bg-green-900/20",
                                                    leftPlanePass === false && "border-red-500 bg-red-50 dark:bg-red-900/20"
                                                )}
                                            />
                                            {leftPlanePass !== null && (
                                                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                                    {leftPlanePass ? (
                                                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                                                    ) : (
                                                        <XCircle className="w-5 h-5 text-red-500" />
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        {leftPlanePass !== null && calculatedUper !== null && (
                                            <p className={cn(
                                                "text-xs",
                                                leftPlanePass ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                                            )}>
                                                {leftPlanePass ? '✓ PASS' : '✗ FAIL'} (Limit: {calculatedUper.toFixed(3)} gr)
                                            </p>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="residual_left_angle_deg">Kalan Açı (°)</Label>
                                        <Input
                                            id="residual_left_angle_deg"
                                            type="number"
                                            step="0.01"
                                            value={formData.residual_left_angle_deg}
                                            onChange={(e) => handleInputChange('residual_left_angle_deg', e.target.value)}
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* RECHTS (Sağ Düzlem) */}
                            <div className="space-y-4 p-4 border rounded-lg">
                                <h4 className="font-medium text-sm">RECHTS (Sağ Düzlem / Right Plane / 2. Yatak)</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="residual_right_weight_gr">Kalan Ağırlık (gr)</Label>
                                        <div className="relative">
                                            <Input
                                                id="residual_right_weight_gr"
                                                type="number"
                                                step="0.001"
                                                value={formData.residual_right_weight_gr}
                                                onChange={(e) => handleInputChange('residual_right_weight_gr', e.target.value)}
                                                placeholder="0.000"
                                                className={cn(
                                                    rightPlanePass === true && "border-green-500 bg-green-50 dark:bg-green-900/20",
                                                    rightPlanePass === false && "border-red-500 bg-red-50 dark:bg-red-900/20"
                                                )}
                                            />
                                            {rightPlanePass !== null && (
                                                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                                    {rightPlanePass ? (
                                                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                                                    ) : (
                                                        <XCircle className="w-5 h-5 text-red-500" />
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        {rightPlanePass !== null && calculatedUper !== null && (
                                            <p className={cn(
                                                "text-xs",
                                                rightPlanePass ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                                            )}>
                                                {rightPlanePass ? '✓ PASS' : '✗ FAIL'} (Limit: {calculatedUper.toFixed(3)} gr)
                                            </p>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="residual_right_angle_deg">Kalan Açı (°)</Label>
                                        <Input
                                            id="residual_right_angle_deg"
                                            type="number"
                                            step="0.01"
                                            value={formData.residual_right_angle_deg}
                                            onChange={(e) => handleInputChange('residual_right_angle_deg', e.target.value)}
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Notlar */}
                    <div className="space-y-2">
                        <Label htmlFor="notes">Notlar</Label>
                        <Textarea
                            id="notes"
                            value={formData.notes}
                            onChange={(e) => handleInputChange('notes', e.target.value)}
                            placeholder="Ek notlar..."
                            rows={3}
                        />
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

export default BalanceRecordFormModal;

