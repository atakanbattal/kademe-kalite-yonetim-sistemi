import React from 'react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useNCForm } from '@/hooks/useNCForm';
import NCFormGeneral from '@/components/df-8d/NCFormGeneral';
import EightDSteps from '@/components/df-8d/EightDSteps';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from '@/components/ui/scroll-area';

const NCFormModal = ({ isOpen, setIsOpen, record, onSave, onSaveSuccess }) => {
    const { toast } = useToast();
    const {
        formData, setFormData, files, handleInputChange, handleOpeningDateChange,
        handleSelectChange, handlePersonnelChange, personnel, departments,
        getRootProps, getInputProps, isDragActive, removeFile
    } = useNCForm();
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const isEditMode = !!(formData && formData.id && !formData.source_cost_id && !formData.source_quarantine_id && !formData.source_supplier_nc_id && !formData.source_inspection_id && !formData.source_finding_id && !formData.source_inspection_fault_id);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.type || !formData.title || !formData.description) {
            toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Lütfen zorunlu alanları doldurun.' });
            return;
        }
        setIsSubmitting(true);
        const { data: savedRecord, error } = await onSave(formData, files);
        if (error) {
            toast({ variant: 'destructive', title: 'Hata!', description: `Kayıt kaydedilemedi: ${error.message}` });
        } else {
            toast({ title: 'Başarılı!', description: `Kayıt başarıyla ${isEditMode ? 'güncellendi' : 'oluşturuldu'}.` });
            setIsOpen(false);
            if (onSaveSuccess) {
                onSaveSuccess(savedRecord);
            }
        }
        setIsSubmitting(false);
    };

    if (!isOpen) {
        return null;
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
                <DialogHeader>
                    <DialogTitle className="text-foreground">{isEditMode ? 'Uygunsuzluk Kaydını Düzenle' : 'Yeni Uygunsuzluk Kaydı'}</DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        {isEditMode ? 'Mevcut kaydın detaylarını güncelleyin.' : 'Yeni bir uygunsuzluk kaydı oluşturun.'}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="flex-grow flex flex-col overflow-hidden">
                    <ScrollArea className="flex-grow pr-6">
                        <div className="py-4">
                            <Tabs defaultValue="general" className="w-full">
                                <TabsList>
                                    <TabsTrigger value="general">Genel Bilgiler</TabsTrigger>
                                    {formData.type === '8D' && <TabsTrigger value="8d_steps">8D Adımları</TabsTrigger>}
                                </TabsList>
                                <TabsContent value="general" className="mt-4">
                                    <NCFormGeneral
                                        formData={formData}
                                        handleInputChange={handleInputChange}
                                        handleOpeningDateChange={handleOpeningDateChange}
                                        handleSelectChange={handleSelectChange}
                                        handlePersonnelChange={handlePersonnelChange}
                                        personnel={personnel}
                                        departments={departments}
                                        getRootProps={getRootProps}
                                        getInputProps={getInputProps}
                                        isDragActive={isDragActive}
                                        files={files}
                                        removeFile={removeFile}
                                        isEditMode={isEditMode}
                                        record={record}
                                    />
                                </TabsContent>
                                {formData.type === '8D' && (
                                    <TabsContent value="8d_steps" className="mt-4">
                                        <EightDSteps steps={formData.eight_d_steps || {}} onStepsChange={(steps) => setFormData(prev => ({...prev, eight_d_steps: steps}))} />
                                    </TabsContent>
                                )}
                            </Tabs>
                        </div>
                    </ScrollArea>
                    <DialogFooter className="mt-auto pt-4 border-t">
                        <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>İptal</Button>
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