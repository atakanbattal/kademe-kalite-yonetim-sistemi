import React, { useState, useEffect } from 'react';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Textarea } from '@/components/ui/textarea';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { Dialog, DialogContent } from '@/components/ui/dialog';
    import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
    import { Badge } from '@/components/ui/badge';
    import SupplierAuditTab from '@/components/supplier/SupplierAuditTab';
    import SupplierPPMDisplay from '@/components/supplier/SupplierPPMDisplay';
    import SupplierOTDDisplay from '@/components/supplier/SupplierOTDDisplay';
    import SupplierEvaluationDisplay from '@/components/supplier/SupplierEvaluationDisplay';
    import { Building2, CheckCircle, Shield } from 'lucide-react';

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

        const selectedAlternativeName = formData.alternative_to_supplier_id
            ? allSuppliers?.find(s => s.id === formData.alternative_to_supplier_id)?.name || '-'
            : '-';

        const rightPanel = (
            <div className="p-6 space-y-5 w-80 shrink-0 bg-muted/30 border-l border-border overflow-y-auto">
                <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Tedarikçi Özeti</h2>
                <div className="bg-background rounded-xl p-5 shadow-sm border border-border relative overflow-hidden">
                    <div className="absolute -right-3 -bottom-3 opacity-[0.04] pointer-events-none"><Building2 className="w-20 h-20" /></div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-1">Firma</p>
                    <p className="text-lg font-bold text-foreground truncate">{formData.name || '-'}</p>
                    {formData.product_group && <p className="text-xs text-muted-foreground mt-0.5">{formData.product_group}</p>}
                </div>
                <div className="space-y-3">
                    <div className="flex justify-between text-xs font-medium">
                        <span className="text-muted-foreground">Statü</span>
                        <span className="font-semibold text-foreground">{formData.status || '-'}</span>
                    </div>
                    <div className="flex justify-between text-xs font-medium">
                        <span className="text-muted-foreground">Risk Sınıfı</span>
                        <span className="font-semibold text-foreground">{formData.risk_class || '-'}</span>
                    </div>
                    {formData.supplier_grade && (
                        <div className="flex justify-between text-xs font-medium">
                            <span className="text-muted-foreground">Sınıf</span>
                            <Badge className={`${supplierGradeOptions.find(o => o.value === formData.supplier_grade)?.color || 'bg-gray-500'} text-white text-[10px]`}>{formData.supplier_grade}</Badge>
                        </div>
                    )}
                </div>
                <div className="pt-4 border-t border-border space-y-2.5">
                    <div className="flex justify-between text-xs"><span className="text-muted-foreground">İlgili Kişi:</span><span className="font-semibold text-foreground truncate ml-2">{formData.contact_info?.name || '-'}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-muted-foreground">E-posta:</span><span className="font-semibold text-foreground truncate ml-2">{formData.contact_info?.email || '-'}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-muted-foreground">Telefon:</span><span className="font-semibold text-foreground truncate ml-2">{formData.contact_info?.phone || '-'}</span></div>
                    {formData.status === 'Alternatif' && (
                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">Ana Tedarikçi:</span><span className="font-semibold text-foreground truncate ml-2">{selectedAlternativeName}</span></div>
                    )}
                </div>
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-start gap-2.5 border border-blue-100 dark:border-blue-800">
                    <Shield className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                    <p className="text-[11px] leading-relaxed text-blue-700 dark:text-blue-300">
                        Tedarikçi kaydedildikten sonra denetim ve performans takibinde listelenecektir.
                    </p>
                </div>
            </div>
        );

        return (
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
                    <header className="bg-gradient-to-r from-primary to-blue-700 px-6 py-5 flex items-center justify-between text-white shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="bg-white/20 p-2.5 rounded-lg"><Building2 className="h-5 w-5 text-white" /></div>
                            <div>
                                <h1 className="text-lg font-bold tracking-tight">{isEditMode ? 'Tedarikçi Bilgilerini Düzenle' : (isNewAlternative ? 'Yeni Alternatif Tedarikçi' : 'Yeni Tedarikçi Ekle')}</h1>
                                <p className="text-[11px] text-blue-100 uppercase tracking-[0.15em] font-medium">Tedarikçi Yönetimi</p>
                            </div>
                            {(isEditMode || isNewAlternative) && (
                                <span className="ml-2 px-3 py-1 bg-amber-400/20 border border-amber-400/30 text-amber-100 text-[10px] font-bold rounded-full uppercase tracking-wider">
                                    {isEditMode ? 'Düzenleme' : 'Alternatif'}
                                </span>
                            )}
                            {!isEditMode && !isNewAlternative && (
                                <span className="ml-2 px-3 py-1 bg-green-400/20 border border-green-400/30 text-green-100 text-[10px] font-bold rounded-full uppercase tracking-wider">Yeni</span>
                            )}
                        </div>
                    </header>
                    
                    <div className="flex flex-1 min-h-0 overflow-hidden">
                        <div className="flex-1 min-h-0 overflow-hidden flex flex-col min-w-0">
                    <Tabs defaultValue="details" className="w-full flex-1 overflow-hidden flex flex-col">
                        <TabsList className="inline-flex gap-1 p-1 h-auto mx-6 mt-4 shrink-0">
                            <TabsTrigger value="details" className="text-xs">Tedarikçi Bilgileri</TabsTrigger>
                            <TabsTrigger value="audits" disabled={!isEditMode} className="text-xs">Denetim Takibi</TabsTrigger>
                            <TabsTrigger value="performance" disabled={!isEditMode} className="text-xs">PPM/OTD</TabsTrigger>
                            <TabsTrigger value="evaluation" disabled={!isEditMode} className="text-xs">Değerlendirme</TabsTrigger>
                        </TabsList>
                        <TabsContent value="details" className="mt-4 flex-1 min-h-0 overflow-y-auto px-6 pb-4">
                            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 pr-2">
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
                        <TabsContent value="audits" className="mt-4 flex-1 overflow-y-auto px-6 pb-4">
                             {isEditMode && <SupplierAuditTab supplier={formData} refreshData={refreshSuppliers} />}
                        </TabsContent>
                        <TabsContent value="performance" className="mt-4 flex-1 overflow-y-auto px-6 pb-4 space-y-4">
                            {isEditMode && formData.id && (
                                <>
                                    <SupplierPPMDisplay supplierId={formData.id} supplierName={formData.name} />
                                    <SupplierOTDDisplay supplierId={formData.id} supplierName={formData.name} />
                                </>
                            )}
                        </TabsContent>
                        <TabsContent value="evaluation" className="mt-4 flex-1 overflow-y-auto px-6 pb-4">
                            {isEditMode && formData.id && (
                                <SupplierEvaluationDisplay supplierId={formData.id} supplierName={formData.name} />
                            )}
                        </TabsContent>
                    </Tabs>
                        </div>
                        {rightPanel}
                    </div>
                    
                    <footer className="bg-background px-6 py-4 border-t border-border flex items-center justify-between shrink-0">
                        <div className="flex items-center text-muted-foreground">
                            <span className="text-[11px] font-medium">{formData.name || 'Tedarikçi bilgileri'}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button type="button" variant="ghost" onClick={() => setIsOpen(false)} className="text-sm font-semibold">İptal Et</Button>
                            <Button type="button" onClick={handleSubmit} disabled={isSubmitting} className="text-sm font-bold shadow-lg shadow-primary/20">
                                <CheckCircle className="w-4 h-4 mr-2" />
                                {isSubmitting ? 'Kaydediliyor...' : (isEditMode ? 'Değişiklikleri Kaydet' : 'Tedarikçi Ekle')}
                            </Button>
                        </div>
                    </footer>
                </DialogContent>
            </Dialog>
        );
    };

    export default SupplierFormModal;