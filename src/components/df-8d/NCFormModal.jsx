import React, { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EightDStepsEnhanced from '@/components/df-8d/EightDStepsEnhanced';
import { useNCForm } from '@/hooks/useNCForm';
import NCFormGeneral from '@/components/df-8d/NCFormGeneral';
import { ScrollArea } from '@/components/ui/scroll-area';
import FiveN1KTemplate from '@/components/df-8d/analysis-templates/FiveN1KTemplate';
import IshikawaTemplate from '@/components/df-8d/analysis-templates/IshikawaTemplate';
import FiveWhyTemplate from '@/components/df-8d/analysis-templates/FiveWhyTemplate';
import FTATemplate from '@/components/df-8d/analysis-templates/FTATemplate';
import { supabase } from '@/lib/customSupabaseClient';

const NCFormModal = ({ isOpen, setIsOpen, onSave, onSaveSuccess, record: initialRecord }) => {
    const { toast } = useToast();
    const { formData, setFormData, files, handleInputChange, handleOpeningDateChange, handleSelectChange, handlePersonnelChange, personnel, getRootProps, getInputProps, isDragActive, removeFile, initializeForm, clearDraft } = useNCForm();

    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            initializeForm(initialRecord);
        }
    }, [isOpen, initialRecord, initializeForm]);

    const isEditMode = !!(formData && formData.id);

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Personnel listesi kontrolü
        if (personnel.length === 0 && !formData.is_supplier_nc) {
            toast({
                variant: 'destructive',
                title: 'Hata!',
                description: 'Personel listesi henüz yüklenmedi. Lütfen birkaç saniye bekleyip tekrar deneyin.'
            });
            return;
        }

        setIsSubmitting(true);

        let finalFormData = { ...formData };

        if (finalFormData.is_supplier_nc) {
            if (!finalFormData.supplier_id) {
                toast({
                    variant: 'destructive',
                    title: 'Hata!',
                    description: 'Lütfen bir tedarikçi seçin.'
                });
                setIsSubmitting(false);
                return;
            }
            finalFormData.department = 'Tedarikçi';
            finalFormData.responsible_person = null;
        } else {
            if (!finalFormData.department || !finalFormData.responsible_person) {
                toast({
                    variant: 'destructive',
                    title: 'Hata!',
                    description: 'Lütfen sorumlu kişi ve ilgili birimi seçin. Personel listesi yüklenmediyse lütfen bekleyin.'
                });
                setIsSubmitting(false);
                return;
            }
            finalFormData.supplier_id = null;
        }

        try {
            const { data, error } = await onSave(finalFormData, files);

            if (error) {
                console.error('❌ NC save error:', error);
                toast({
                    variant: 'destructive',
                    title: 'Hata!',
                    description: `Kayıt kaydedilemedi: ${error.message || 'Bilinmeyen hata'}`,
                    duration: 5000,
                });
            } else if (data) {
                // Tekrarlayan problem kontrolü
                if (data.is_major) {
                    toast({
                        variant: 'destructive',
                        title: '⚠️ Major Uygunsuzluk Tespit Edildi!',
                        description: 'Bu problem tekrarlayan bir problem olarak işaretlendi. Detaylı analiz yapılması önerilir.',
                        duration: 5000,
                    });
                } else {
                    toast({
                        title: 'Başarılı!',
                        description: `Kayıt başarıyla ${isEditMode ? 'güncellendi' : 'oluşturuldu'}.`,
                        duration: 3000,
                    });
                }

                // --- OTOMASYON: Maliyet Kaydı Oluşturma ---
                if (finalFormData.status === 'Kapatıldı') {
                    if (window.confirm('Uygunsuzluk kapatıldı. İlgili Kalitesizlik Maliyeti kaydını oluşturmak ister misiniz?')) {
                        try {
                            const costPayload = {
                                cost_date: new Date().toISOString().slice(0, 10),
                                cost_type: finalFormData.is_supplier_nc ? 'Tedarikçi Hata Maliyeti' : 'İç Hata',
                                unit: finalFormData.department || finalFormData.requesting_unit || 'Genel',
                                amount: 0,
                                description: `OTOMATİK - ${data.nc_number || data.mdi_no || 'NC'}: ${data.title}`,
                                source_type: 'nc_automation',
                                is_supplier_nc: !!finalFormData.is_supplier_nc,
                                supplier_id: finalFormData.supplier_id || null,
                                status: 'Aktif',
                                vehicle_type: 'Diğer', // Varsayılan
                            };

                            const { error: costError } = await supabase.from('quality_costs').insert([costPayload]);
                            if (costError) throw costError;

                            toast({ title: 'Bilgi', description: 'Maliyet kaydı taslağı oluşturuldu. Lütfen Kalitesizlik Maliyetleri modülünden detayları giriniz.' });
                        } catch (error) {
                            console.error('Auto cost creation failed', error);
                            toast({ variant: 'destructive', title: 'Hata', description: 'Otomatik maliyet kaydı oluşturulamadı.' });
                        }
                    }
                }
                // --- OTOMASYON SONU ---

                if (onSaveSuccess) onSaveSuccess(data);
                if (!isEditMode) clearDraft();
                setIsOpen(false);
            } else {
                toast({
                    variant: 'destructive',
                    title: 'Hata!',
                    description: 'Kayıt kaydedilemedi: Veri alınamadı.'
                });
            }
        } catch (err) {
            console.error('❌ handleSubmit error:', err);
            toast({
                variant: 'destructive',
                title: 'Hata!',
                description: `Beklenmeyen bir hata oluştu: ${err.message || 'Lütfen tekrar deneyin.'}`,
                duration: 5000,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-4xl h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="text-foreground">{isEditMode ? 'Uygunsuzluk Düzenle' : 'Yeni Uygunsuzluk Oluştur'}</DialogTitle>
                    <DialogDescription className="text-muted-foreground">{isEditMode ? (formData.nc_number || formData.mdi_no) : `Yeni bir uygunsuzluk kaydı oluşturun.`}</DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="flex-grow flex flex-col overflow-hidden">
                    <ScrollArea className="flex-grow pr-6">
                        <Tabs defaultValue="general" className="w-full py-4">
                            <TabsList>
                                <TabsTrigger value="general">Genel Bilgiler</TabsTrigger>
                                {formData.type === '8D' && <TabsTrigger value="8d_steps">8D Adımları</TabsTrigger>}
                                <TabsTrigger value="analysis">Kök Neden Analizi</TabsTrigger>
                            </TabsList>
                            <TabsContent value="general" className="mt-4">
                                <NCFormGeneral
                                    formData={formData}
                                    setFormData={setFormData}
                                    handleInputChange={handleInputChange}
                                    handleSelectChange={handleSelectChange}
                                    handleOpeningDateChange={handleOpeningDateChange}
                                    handlePersonnelChange={handlePersonnelChange}
                                    personnel={personnel}
                                    getRootProps={getRootProps}
                                    getInputProps={getInputProps}
                                    isDragActive={isDragActive}
                                    files={files}
                                    removeFile={removeFile}
                                    record={initialRecord}
                                />
                            </TabsContent>
                            {formData.type === '8D' && (
                                <TabsContent value="8d_steps" className="mt-4">
                                    <EightDStepsEnhanced
                                        steps={formData.eight_d_steps || {}}
                                        progress={formData.eight_d_progress || null}
                                        onStepsChange={(steps) => setFormData(prev => ({ ...prev, eight_d_steps: steps }))}
                                        onProgressChange={(progress) => setFormData(prev => ({ ...prev, eight_d_progress: progress }))}
                                        isEditMode={isEditMode}
                                        ncId={formData.id || null}
                                    />
                                </TabsContent>
                            )}
                            <TabsContent value="analysis" className="mt-4 space-y-4">
                                <Tabs defaultValue="5n1k" className="w-full">
                                    <TabsList>
                                        <TabsTrigger value="5n1k">5N1K Analizi</TabsTrigger>
                                        <TabsTrigger value="ishikawa">Ishikawa (Balık Kılçığı)</TabsTrigger>
                                        <TabsTrigger value="5why">5 Neden Analizi</TabsTrigger>
                                        <TabsTrigger value="fta">FTA (Hata Ağacı)</TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="5n1k" className="mt-4">
                                        <FiveN1KTemplate
                                            analysisData={formData.five_n1k_analysis || {}}
                                            onAnalysisChange={(data) => setFormData(prev => ({ ...prev, five_n1k_analysis: data }))}
                                        />
                                    </TabsContent>
                                    <TabsContent value="ishikawa" className="mt-4">
                                        <IshikawaTemplate
                                            analysisData={formData.ishikawa_analysis || {}}
                                            onAnalysisChange={(data) => setFormData(prev => ({ ...prev, ishikawa_analysis: data }))}
                                        />
                                    </TabsContent>
                                    <TabsContent value="5why" className="mt-4">
                                        <FiveWhyTemplate
                                            analysisData={formData.five_why_analysis || {}}
                                            onAnalysisChange={(data) => setFormData(prev => ({ ...prev, five_why_analysis: data }))}
                                        />
                                    </TabsContent>
                                    <TabsContent value="fta" className="mt-4">
                                        <FTATemplate
                                            analysisData={formData.fta_analysis || {}}
                                            onAnalysisChange={(data) => setFormData(prev => ({ ...prev, fta_analysis: data }))}
                                        />
                                    </TabsContent>
                                </Tabs>
                            </TabsContent>
                        </Tabs>
                    </ScrollArea>

                    <DialogFooter className="pt-4 border-t">
                        <Button type="button" onClick={() => setIsOpen(false)} variant="outline">İptal</Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Kaydediliyor...' : (isEditMode ? 'Değişiklikleri Kaydet' : 'Kaydet')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default NCFormModal;