import React, { useState, useEffect } from 'react';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Textarea } from '@/components/ui/textarea';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
    import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
    import { Badge } from '@/components/ui/badge';
    import SupplierAuditTab from '@/components/supplier/SupplierAuditTab';
    import SupplierPPMDisplay from '@/components/supplier/SupplierPPMDisplay';
    import SupplierOTDDisplay from '@/components/supplier/SupplierOTDDisplay';
    import SupplierEvaluationDisplay from '@/components/supplier/SupplierEvaluationDisplay';


    const SupplierFormModal = ({ isOpen, setIsOpen, supplier, refreshSuppliers, allSuppliers, isNewAlternative = false }) => {
        const { toast } = useToast();
        const isEditMode = !!supplier && !isNewAlternative;
        const [formData, setFormData] = useState({});
        const [isSubmitting, setIsSubmitting] = useState(false);
        
        const initialData = {
            name: '',
            product_group: '',
            contact_info: { name: '', email: '', phone: '' },
            risk_class: 'Orta',
            status: 'Değerlendirilmemiş',
            alternative_to_supplier_id: null,
            supplier_grade: null,
            grade_reason: '',
        };
        
        const supplierGradeOptions = [
            { value: 'A', label: 'A Sınıfı - Stratejik İş Ortağı', color: 'bg-green-500' },
            { value: 'B', label: 'B Sınıfı - Güvenilir Tedarikçi', color: 'bg-blue-500' },
            { value: 'C', label: 'C Sınıfı - İzlemeye Alınacak', color: 'bg-yellow-500' },
            { value: 'D', label: 'D Sınıfı - İş Birliği Sonlandırılacak', color: 'bg-red-500' },
        ];

        useEffect(() => {
            if (isOpen) {
                const dataToSet = isEditMode ? {
                  ...initialData,
                  ...supplier,
                  contact_info: supplier.contact_info || { name: '', email: '', phone: '' }
                } : (isNewAlternative ? { ...initialData, ...supplier } : initialData);
                setFormData(dataToSet);
            }
        }, [supplier, isEditMode, isOpen, isNewAlternative]);
        
        const handleInputChange = (e) => {
            const { id, value } = e.target;
            setFormData(prev => ({ ...prev, [id]: value }));
        };

        const handleContactChange = (e) => {
            const { id, value } = e.target;
            setFormData(prev => ({ ...prev, contact_info: { ...prev.contact_info, [id]: value } }));
        };

        const handleSelectChange = (id, value) => {
            if (value === "null") {
              value = null;
            }
            setFormData(prev => ({ ...prev, [id]: value }));
        };

        const handleSubmit = async (e) => {
            e.preventDefault();
            
            if (formData.status === 'Alternatif' && !formData.alternative_to_supplier_id) {
                toast({
                    variant: "destructive",
                    title: "Ana Tedarikçi Eksik",
                    description: "Lütfen alternatif statüsü için bir ana tedarikçi seçin.",
                });
                return;
            }

            setIsSubmitting(true);
            
            const { 
                alternative_supplier,
                supplier_certificates,
                supplier_non_conformities,
                supplier_scores,
                supplier_audits,
                supplier_audit_plans,
                ...dbData 
            } = formData;
            
            // Undefined key'leri ve geçersiz kolonları temizle
            const cleanedData = {};
            for (const key in dbData) {
                if (dbData[key] !== undefined && key !== 'undefined') {
                    cleanedData[key] = dbData[key];
                }
            }
            
            // Manuel sınıf değiştirilmişse tarih güncelle
            if (cleanedData.supplier_grade && cleanedData.supplier_grade !== supplier?.supplier_grade) {
                cleanedData.grade_updated_at = new Date().toISOString();
            }
            // Sınıf kaldırılmışsa tarihi de temizle
            if (cleanedData.supplier_grade === null) {
                cleanedData.grade_updated_at = null;
            }
            
            const { data, error } = isEditMode
                ? await supabase.from('suppliers').update(cleanedData).eq('id', supplier.id).select().single()
                : await supabase.from('suppliers').insert(cleanedData).select().single();

            if (error) {
                toast({ variant: 'destructive', title: 'Hata!', description: `Tedarikçi ${isEditMode ? 'güncellenemedi' : 'oluşturulamadı'}: ${error.message}` });
            } else {
                toast({ title: 'Başarılı!', description: `Tedarikçi başarıyla ${isEditMode ? 'güncellendi' : 'oluşturuldu'}.` });
                refreshSuppliers();
                setIsOpen(false);
            }
            setIsSubmitting(false);
        };

        return (
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>{isEditMode ? 'Tedarikçi Bilgilerini Düzenle' : (isNewAlternative ? 'Yeni Alternatif Tedarikçi Ekle' : 'Yeni Tedarikçi Ekle')}</DialogTitle>
                        <DialogDescription>Tedarikçi ile ilgili tüm bilgileri yönetin.</DialogDescription>
                    </DialogHeader>
                    
                    <Tabs defaultValue="details" className="w-full">
                        <TabsList className="grid w-full grid-cols-4">
                            <TabsTrigger value="details">Tedarikçi Bilgileri</TabsTrigger>
                            <TabsTrigger value="audits" disabled={!isEditMode}>Denetim Takibi</TabsTrigger>
                            <TabsTrigger value="performance" disabled={!isEditMode}>PPM/OTD</TabsTrigger>
                            <TabsTrigger value="evaluation" disabled={!isEditMode}>Değerlendirme</TabsTrigger>
                        </TabsList>
                        <TabsContent value="details" className="mt-4">
                            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 max-h-[60vh] overflow-y-auto pr-2">
                                <div className="md:col-span-2">
                                    <Label htmlFor="name">Firma Adı <span className="text-red-500">*</span></Label>
                                    <Input id="name" value={formData.name || ''} onChange={handleInputChange} required />
                                </div>
                                <div>
                                    <Label htmlFor="product_group">Ürün Grubu</Label>
                                    <Input id="product_group" value={formData.product_group || ''} onChange={handleInputChange} />
                                </div>
                                 <div>
                                    <Label htmlFor="status">Statü <span className="text-red-500">*</span></Label>
                                    <Select value={formData.status || ''} onValueChange={(v) => handleSelectChange('status', v)} required>
                                        <SelectTrigger><SelectValue placeholder="Statü seçin..." /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Değerlendirilmemiş">Değerlendirilmemiş</SelectItem>
                                            <SelectItem value="Onaylı">Onaylı</SelectItem>
                                            <SelectItem value="Askıya Alınmış">Askıya Alınmış</SelectItem>
                                            <SelectItem value="Red">Red</SelectItem>
                                            <SelectItem value="Alternatif">Alternatif</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                 <div>
                                    <Label htmlFor="risk_class">Risk Sınıfı</Label>
                                    <Select value={formData.risk_class || ''} onValueChange={(v) => handleSelectChange('risk_class', v)}>
                                         <SelectTrigger><SelectValue placeholder="Risk sınıfı seçin..." /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Yüksek">Yüksek</SelectItem>
                                            <SelectItem value="Orta">Orta</SelectItem>
                                            <SelectItem value="Düşük">Düşük</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {(formData.status === 'Alternatif' || isNewAlternative) && (
                                    <div>
                                        <Label htmlFor="alternative_to_supplier_id">Alternatifi Olduğu Tedarikçi <span className="text-red-500">*</span></Label>
                                        <Select value={formData.alternative_to_supplier_id || ''} onValueChange={(v) => handleSelectChange('alternative_to_supplier_id', v)}>
                                            <SelectTrigger><SelectValue placeholder="Ana tedarikçiyi seçin..." /></SelectTrigger>
                                            <SelectContent>
                                                {allSuppliers.filter(s => s.status === 'Onaylı' && s.id !== supplier?.id).map(s => (
                                                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                {/* Manuel Tedarikçi Sınıfı Belirleme Bölümü */}
                                <div className="md:col-span-2 pt-4 border-t mt-2">
                                    <h4 className="font-semibold mb-2 text-foreground flex items-center gap-2">
                                        Manuel Tedarikçi Sınıfı Belirleme
                                        <span className="text-xs font-normal text-muted-foreground">(Denetim dışı değerlendirme)</span>
                                    </h4>
                                    <p className="text-xs text-muted-foreground mb-3">
                                        Denetim yapmadan doğrudan tedarikçi sınıfını belirleyebilirsiniz. Bu değerlendirme otomatik hesaplamayı geçersiz kılar.
                                    </p>
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div>
                                            <Label htmlFor="supplier_grade">Tedarikçi Sınıfı</Label>
                                            <Select value={formData.supplier_grade || ''} onValueChange={(v) => handleSelectChange('supplier_grade', v === 'none' ? null : v)}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Sınıf seçin (opsiyonel)..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">— Otomatik Değerlendirme —</SelectItem>
                                                    {supplierGradeOptions.map(opt => (
                                                        <SelectItem key={opt.value} value={opt.value}>
                                                            <div className="flex items-center gap-2">
                                                                <Badge className={`${opt.color} text-white`}>{opt.value}</Badge>
                                                                <span>{opt.label.split(' - ')[1]}</span>
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <Label htmlFor="grade_reason">Açıklama / Gerekçe</Label>
                                            <Textarea 
                                                id="grade_reason" 
                                                value={formData.grade_reason || ''} 
                                                onChange={(e) => setFormData(prev => ({ ...prev, grade_reason: e.target.value }))}
                                                placeholder="Sınıf belirleme gerekçesini yazın..."
                                                rows={2}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="md:col-span-2 pt-4 border-t mt-2">
                                    <h4 className="font-semibold mb-2 text-foreground">İletişim Bilgileri</h4>
                                     <div className="grid md:grid-cols-3 gap-4">
                                        <div><Label htmlFor="name">İlgili Kişi</Label><Input id="name" value={formData.contact_info?.name || ''} onChange={handleContactChange} /></div>
                                        <div><Label htmlFor="email">E-posta</Label><Input id="email" type="email" value={formData.contact_info?.email || ''} onChange={handleContactChange} /></div>
                                        <div><Label htmlFor="phone">Telefon</Label><Input id="phone" value={formData.contact_info?.phone || ''} onChange={handleContactChange} /></div>
                                     </div>
                                </div>
                            </form>
                        </TabsContent>
                        <TabsContent value="audits" className="mt-4 max-h-[60vh] overflow-y-auto pr-2">
                             {isEditMode && <SupplierAuditTab supplier={formData} refreshData={refreshSuppliers} />}
                        </TabsContent>
                        <TabsContent value="performance" className="mt-4 space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                            {isEditMode && formData.id && (
                                <>
                                    <SupplierPPMDisplay supplierId={formData.id} supplierName={formData.name} />
                                    <SupplierOTDDisplay supplierId={formData.id} supplierName={formData.name} />
                                </>
                            )}
                        </TabsContent>
                        <TabsContent value="evaluation" className="mt-4 max-h-[70vh] overflow-y-auto pr-2">
                            {isEditMode && formData.id && (
                                <SupplierEvaluationDisplay supplierId={formData.id} supplierName={formData.name} />
                            )}
                        </TabsContent>
                    </Tabs>
                    
                    <DialogFooter className="mt-4 pt-4 border-t">
                        <Button onClick={() => setIsOpen(false)} variant="outline">İptal</Button>
                        <Button onClick={handleSubmit} disabled={isSubmitting}>
                            {isSubmitting ? 'Kaydediliyor...' : (isEditMode ? 'Değişiklikleri Kaydet' : 'Tedarikçi Ekle')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    };

    export default SupplierFormModal;