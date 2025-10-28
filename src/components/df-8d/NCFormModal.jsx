import React, { useState, useEffect } from 'react';
    import { useToast } from '@/components/ui/use-toast';
    import { Button } from '@/components/ui/button';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
    import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
    import EightDSteps from '@/components/df-8d/EightDSteps';
    import { useNCForm } from '@/hooks/useNCForm';
    import NCFormGeneral from '@/components/df-8d/NCFormGeneral';
    import { ScrollArea } from '@/components/ui/scroll-area';

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
            setIsSubmitting(true);
            
            let finalFormData = { ...formData };

            if (finalFormData.is_supplier_nc) {
                if (!finalFormData.supplier_id) {
                    toast({ variant: 'destructive', title: 'Hata!', description: 'Lütfen bir tedarikçi seçin.' });
                    setIsSubmitting(false);
                    return;
                }
                finalFormData.department = 'Tedarikçi';
                finalFormData.responsible_person = null;
            } else {
                 if (!finalFormData.department || !finalFormData.responsible_person) {
                    toast({ variant: 'destructive', title: 'Hata!', description: 'Lütfen sorumlu kişi ve ilgili birimi seçin.' });
                    setIsSubmitting(false);
                    return;
                }
                finalFormData.supplier_id = null;
            }

            const { data, error } = await onSave(finalFormData, files);
            
            if (error) {
                toast({ variant: 'destructive', title: 'Hata!', description: `Kayıt kaydedilemedi: ${error.message}` });
            } else {
                toast({ title: 'Başarılı!', description: `Kayıt başarıyla ${isEditMode ? 'güncellendi' : 'oluşturuldu'}.` });
                if(onSaveSuccess) onSaveSuccess(data);
                if (!isEditMode) clearDraft();
                setIsOpen(false);
            }
            setIsSubmitting(false);
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
                                        <EightDSteps 
                                            steps={formData.eight_d_steps || {}} 
                                            onStepsChange={(steps) => setFormData(prev => ({...prev, eight_d_steps: steps}))} 
                                        />
                                    </TabsContent>
                                )}
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