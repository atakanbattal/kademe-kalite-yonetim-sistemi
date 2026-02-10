import React from 'react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { useNCForm } from '@/hooks/useNCForm';
import NCFormGeneral from '@/components/df-8d/NCFormGeneral';
import EightDSteps from '@/components/df-8d/EightDSteps';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, CheckCircle } from 'lucide-react';

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
                <header className="bg-gradient-to-r from-primary to-blue-700 px-6 py-5 flex items-center justify-between text-white shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/20 p-2.5 rounded-lg"><AlertTriangle className="h-5 w-5 text-white" /></div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight">{isEditMode ? 'Uygunsuzluk Kaydını Düzenle' : 'Yeni Uygunsuzluk Kaydı'}</h1>
                            <p className="text-[11px] text-blue-100 uppercase tracking-[0.15em] font-medium">{isEditMode ? 'Mevcut kaydı güncelleyin' : 'Yeni DF/8D kaydı oluşturun'}</p>
                        </div>
                        {formData.type && (
                            <span className="px-3 py-1 bg-white/20 border border-white/30 text-white/90 text-[10px] font-bold rounded-full uppercase tracking-wider">{formData.type}</span>
                        )}
                    </div>
                </header>
                <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <div className="flex flex-1 min-h-0 overflow-hidden">
                        <div className="flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden border-r border-border py-4 px-6">
                    <ScrollArea className="h-full pr-4">
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
                        </div>
                        <div className="w-[320px] min-w-[280px] shrink-0 min-h-0 overflow-y-auto bg-muted/30 py-4 px-4">
                            <div className="space-y-3">
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b pb-2">Özet</h3>
                                <div className="text-xs space-y-2">
                                    <p><span className="text-muted-foreground">Tip:</span> {formData.type || '-'}</p>
                                    <p><span className="text-muted-foreground">Birim:</span> {formData.department || '-'}</p>
                                    <p><span className="text-muted-foreground">Sorumlu:</span> {personnel?.find(p => p.id === formData.responsible_person_id)?.full_name || '-'}</p>
                                    {formData.type === '8D' && <p><span className="text-muted-foreground">8D Adımları</span> girildi</p>}
                                </div>
                            </div>
                        </div>
                    </div>
                    <footer className="bg-background px-6 py-4 border-t border-border flex items-center justify-end gap-3 shrink-0">
                        <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>İptal</Button>
                        <Button type="submit" disabled={isSubmitting} className="font-bold">
                            <CheckCircle className="w-4 h-4 mr-2" />
                            {isSubmitting ? 'Kaydediliyor...' : (isEditMode ? 'Değişiklikleri Kaydet' : 'Kaydet')}
                        </Button>
                    </footer>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default NCFormModal;