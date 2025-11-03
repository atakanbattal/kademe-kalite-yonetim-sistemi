import React, { useState, useEffect } from 'react';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
    import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
    import SupplierAuditTab from '@/components/supplier/SupplierAuditTab';


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
            status: 'Onaylı',
            alternative_to_supplier_id: null,
        };

        useEffect(() => {
            if (isOpen && (isEditMode || isNewAlternative) && supplier) {
                // Düzenleme veya alternatif oluşturma modu: mevcut kaydı yükle
                console.log('📝 Supplier Düzenleme/Alternatif modu: kayıt yükleniyor', supplier.id);
                const dataToSet = isEditMode ? {
                  ...initialData,
                  ...supplier,
                  contact_info: supplier.contact_info || { name: '', email: '', phone: '' }
                } : { ...initialData, ...supplier };
                setFormData(dataToSet);
            } else if (isOpen && !supplier) {
                // Yeni kayıt modu: form sıfırla
                console.log('✨ Supplier Yeni kayıt modu: form sıfırlanıyor');
                setFormData(initialData);
            }
            // NOT: Modal kapandığında (isOpen=false) hiçbir şey yapma - verileri koru!
        }, [isOpen, supplier, isEditMode, isNewAlternative]);
        
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
            
            const { data, error } = isEditMode
                ? await supabase.from('suppliers').update(dbData).eq('id', supplier.id).select().single()
                : await supabase.from('suppliers').insert(dbData).select().single();

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
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="details">Tedarikçi Bilgileri</TabsTrigger>
                            <TabsTrigger value="audits" disabled={!isEditMode}>Denetim Takibi</TabsTrigger>
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