import React, { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { ModernModalLayout } from '@/components/shared/ModernModalLayout';
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
import { AlertCircle, FileText, Hash, User, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

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

                // Kalite maliyeti kaydı artık otomatik oluşturulmuyor.
                // Kullanıcı Kalite Maliyetleri modülünden manuel olarak oluşturabilir.

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

    const rightPanel = (
        <div className="p-5 space-y-4">
            {/* Kayıt No Kartı */}
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-4 border border-primary/20 relative overflow-hidden">
                <div className="absolute -right-3 -bottom-3 opacity-[0.06] pointer-events-none"><FileText className="w-20 h-20" /></div>
                <div className="flex items-center gap-2 mb-2">
                    <Hash className="w-4 h-4 text-primary" />
                    <p className="text-[10px] font-medium text-primary uppercase tracking-widest">DF/8D No</p>
                </div>
                <p className="text-xl font-bold text-foreground font-mono tracking-wide">{formData?.nc_number || formData?.mdi_no || '-'}</p>
            </div>

            {/* Durum & Tip Badge */}
            <div className="flex items-center gap-2 flex-wrap">
                {formData?.type && (
                    <Badge variant="outline" className={`text-[10px] ${formData.type === '8D' ? 'border-red-300 text-red-700 bg-red-50' : 'border-blue-300 text-blue-700 bg-blue-50'}`}>
                        {formData.type}
                    </Badge>
                )}
                <Badge variant="outline" className="text-[10px]">{formData?.status || 'Açık'}</Badge>
                {formData?.priority && (
                    <Badge className={`text-[10px] ${
                        formData.priority === 'Kritik' ? 'bg-red-100 text-red-800' :
                        formData.priority === 'Yüksek' ? 'bg-orange-100 text-orange-800' :
                        formData.priority === 'Orta' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                    }`}>{formData.priority}</Badge>
                )}
            </div>

            <Separator className="my-1" />

            {/* Genel Bilgiler */}
            <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <FileText className="w-3 h-3" /> Genel Bilgiler
                </p>
                <div className="space-y-1.5 pl-1">
                    {[
                        { label: 'Başlık', value: formData?.title },
                        { label: 'Parça Kodu', value: formData?.part_code, highlight: 'text-primary font-mono' },
                        { label: 'Parça Adı', value: formData?.part_name },
                        { label: 'Araç Tipi', value: formData?.vehicle_type },
                    ].map(({ label, value, highlight }) => (
                        <div key={label} className="py-1">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
                            <p className={`text-xs font-semibold truncate ${highlight || 'text-foreground'}`}>
                                {value || <span className="text-muted-foreground/50 font-normal italic">Girilmedi</span>}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            <Separator className="my-1" />

            {/* Personel & Birim */}
            <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <User className="w-3 h-3" /> Personel & Birim
                </p>
                <div className="space-y-1.5 pl-1">
                    {[
                        { label: 'Sorumlu Birim', value: formData?.department },
                        { label: 'Sorumlu Kişi', value: formData?.responsible_person || (formData?.is_supplier_nc ? 'Tedarikçi' : null) },
                        { label: 'Talep Eden Birim', value: formData?.requesting_unit },
                        { label: 'Talep Eden Kişi', value: formData?.requesting_person },
                    ].map(({ label, value }) => (
                        <div key={label} className="py-1">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
                            <p className="text-xs font-semibold truncate text-foreground">
                                {value || <span className="text-muted-foreground/50 font-normal italic">Girilmedi</span>}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            <Separator className="my-1" />

            {/* Tarih */}
            <div className="flex items-start gap-2.5">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Açılış Tarihi</p>
                    <p className="text-xs font-semibold text-foreground">
                        {formData?.opening_date ? new Date(formData.opening_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
                    </p>
                </div>
            </div>

            {/* Açıklama Önizleme */}
            {formData?.description && (
                <>
                    <Separator className="my-1" />
                    <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                            <FileText className="w-3 h-3" /> Açıklama
                        </p>
                        <p className="text-[11px] text-foreground leading-relaxed line-clamp-4 bg-muted/30 rounded-lg p-2.5 border">
                            {formData.description}
                        </p>
                    </div>
                </>
            )}

            {/* Bilgi Notu */}
            <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-start gap-2 border border-blue-100 dark:border-blue-800">
                <AlertCircle className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-[10px] leading-relaxed text-blue-700 dark:text-blue-300">
                    Kayıt tamamlandıktan sonra 8D süreci ve analiz takibinde listelenecektir.
                </p>
            </div>
        </div>
    );

    return (
        <ModernModalLayout
            open={isOpen}
            onOpenChange={setIsOpen}
            title={isEditMode ? 'Uygunsuzluk Düzenle' : 'Yeni Uygunsuzluk Oluştur'}
            subtitle="8D / Uygunsuzluk Yönetimi"
            icon={<AlertCircle className="h-5 w-5 text-white" />}
            badge={isEditMode ? 'Düzenleme' : 'Yeni'}
            onCancel={() => setIsOpen(false)}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            submitLabel={isEditMode ? 'Değişiklikleri Kaydet' : 'Kaydet'}
            cancelLabel="İptal"
            formId="nc-form"
            footerDate={formData?.opening_date}
            rightPanel={rightPanel}
        >
                <form id="nc-form" onSubmit={handleSubmit} className="flex-grow flex flex-col overflow-hidden">
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
                </form>
        </ModernModalLayout>
    );
};

export default NCFormModal;