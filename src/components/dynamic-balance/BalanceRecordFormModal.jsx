import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ModernModalLayout } from '@/components/shared/ModernModalLayout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { calculateISO1940_1Uper, checkBalanceResult } from '@/lib/utils';
import { CheckCircle2, XCircle, Scale, FileDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const BalanceRecordFormModal = ({ isOpen, setIsOpen, record, fanProducts, onSuccess, isViewMode, onDownloadPDF }) => {
    const { toast } = useToast();
    const { user } = useAuth();
    const isEditMode = !!record && !isViewMode;

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

    // Ürün seçildiğinde ağırlık, devir, dengeleme yarıçapı ve kalite sınıfı bilgilerini otomatik doldur
    useEffect(() => {
        if (formData.product_id && formData.product_id !== 'none' && fanProducts && fanProducts.length > 0) {
            const selectedProduct = fanProducts.find(p => p.id === formData.product_id);
            if (selectedProduct) {
                setFormData(prev => ({
                    ...prev,
                    fan_weight_kg: selectedProduct.fan_weight_kg || prev.fan_weight_kg,
                    operating_rpm: selectedProduct.operating_rpm || prev.operating_rpm,
                    correction_radius_mm: selectedProduct.correction_radius_mm ? selectedProduct.correction_radius_mm.toString() : prev.correction_radius_mm,
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

    const productName = fanProducts?.find(p => p.id === formData.product_id) ? `${fanProducts.find(p => p.id === formData.product_id).product_code} - ${fanProducts.find(p => p.id === formData.product_id).product_name}` : '-';
    const rightPanel = (
        <div className="p-6 space-y-5">
            <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Balans Özeti</h2>
            <div className="bg-background rounded-xl p-5 shadow-sm border border-border relative overflow-hidden">
                <div className="absolute -right-3 -bottom-3 opacity-[0.04] pointer-events-none"><Scale className="w-20 h-20" /></div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-1">Seri No</p>
                <p className="text-lg font-bold text-foreground">{formData.serial_number || '-'}</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{productName}</p>
            </div>
            <div className="space-y-2.5">
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Test Tarihi:</span><span className="font-semibold text-foreground">{formData.test_date ? new Date(formData.test_date).toLocaleDateString('tr-TR') : '-'}</span></div>
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Kalite Sınıfı:</span><span className="font-semibold text-foreground">{formData.balancing_grade || '-'}</span></div>
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Ağırlık:</span><span className="font-semibold text-foreground">{formData.fan_weight_kg ? `${formData.fan_weight_kg} kg` : '-'}</span></div>
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Devir:</span><span className="font-semibold text-foreground">{formData.operating_rpm ? `${formData.operating_rpm} RPM` : '-'}</span></div>
                {calculatedUper !== null && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Uper:</span><span className="font-semibold text-foreground">{calculatedUper.toFixed(3)} gr</span></div>}
            </div>
        </div>
    );

    return (
        <ModernModalLayout
            open={isOpen}
            onOpenChange={setIsOpen}
            title={isViewMode ? 'Balans Kaydını Görüntüle' : (isEditMode ? 'Balans Kaydını Düzenle' : 'Yeni Balans Kaydı')}
            subtitle="Dinamik Balans / ISO 1940-1"
            icon={<Scale className="h-5 w-5 text-white" />}
            badge={isViewMode ? null : (isEditMode ? 'Düzenleme' : 'Yeni')}
            onCancel={() => setIsOpen(false)}
            onSubmit={isViewMode ? () => setIsOpen(false) : handleSubmit}
            isSubmitting={isSubmitting}
            submitLabel={isViewMode ? 'Kapat' : (isEditMode ? 'Güncelle' : 'Kaydet')}
            cancelLabel="İptal"
            formId={isViewMode ? undefined : 'balance-form'}
            footerDate={formData.test_date}
            rightPanel={!isViewMode ? rightPanel : undefined}
            footerExtra={isViewMode && onDownloadPDF && record ? (
                <Button type="button" variant="outline" size="sm" onClick={() => onDownloadPDF(record)} className="gap-2">
                    <FileDown className="h-4 w-4" />
                    PDF İndir
                </Button>
            ) : null}
        >
                <form id="balance-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-4 space-y-6 py-4 min-h-0">
                    <fieldset disabled={isViewMode} className="border-0 p-0 m-0 min-w-0">
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

                    </fieldset>
                </form>
        </ModernModalLayout>
    );
};

export default BalanceRecordFormModal;

