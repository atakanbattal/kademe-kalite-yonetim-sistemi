import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, differenceInDays } from 'date-fns';
import { tr } from 'date-fns/locale';
import { supabase } from '@/lib/customSupabaseClient';
import { Printer, ExternalLink, BrainCircuit, Fish, HelpCircle, Sigma, Loader2, File as FileIcon } from 'lucide-react';

const KaizenDetailModal = ({ isOpen, setIsOpen, kaizen, onDownloadPDF }) => {
    const [activeTab, setActiveTab] = useState("general");
    const [isPrinting, setIsPrinting] = useState(false);

    if (!kaizen) return null;

    const getStatusVariant = (status) => {
        switch (status) {
            case 'Onaylandı': case 'Standartlaştırıldı': case 'Kapandı': return 'success';
            case 'Reddedildi': return 'destructive';
            case 'İncelemede': case 'Uygulamada': return 'warning';
            default: return 'secondary';
        }
    };

    const InfoItem = ({ label, value, className = '' }) => (
        <div className={`bg-muted/50 p-3 rounded-lg ${className}`}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-sm font-semibold">{value || '-'}</p>
        </div>
    );
    
    const AnalysisItem = ({ label, value }) => (
      <div className="py-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-sm pl-2 border-l-2 border-primary ml-1 mt-1">{value || '-'}</p>
      </div>
    );

    const getFileUrl = (fileObject) => {
        if (!fileObject || !fileObject.path) return null;
        const { data } = supabase.storage.from('kaizen_attachments').getPublicUrl(fileObject.path);
        return data?.publicUrl;
    };
    
    const formatArrayToString = (value) => {
        if (Array.isArray(value)) {
            return value.join(', ');
        }
        if (typeof value === 'string') {
            try {
                const parsed = JSON.parse(value);
                if (Array.isArray(parsed)) return parsed.join(', ');
            } catch (e) {
                return value;
            }
        }
        return value || '-';
    };

    const analysis_5n1k = kaizen.analysis_5n1k || {};
    const analysis_5_whys = kaizen.analysis_5_whys || {};
    const analysis_fishbone = kaizen.analysis_fishbone || {};
    
    const teamMemberNames = kaizen.team_members_profiles?.map(p => p.full_name).join(', ') || '-';

    const duration = kaizen.start_date && kaizen.end_date ? `${differenceInDays(new Date(kaizen.end_date), new Date(kaizen.start_date))} gün` : '-';

    const handlePrint = async () => {
        setIsPrinting(true);
        try {
            await onDownloadPDF(kaizen, 'kaizen');
        } catch (error) {
            console.error("PDF generation failed:", error);
        } finally {
            setIsPrinting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-5xl">
                <DialogHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <DialogTitle className="text-2xl">{kaizen.title}</DialogTitle>
                            <DialogDescription>Kaizen No: {kaizen.kaizen_no}</DialogDescription>
                        </div>
                        <Badge variant={getStatusVariant(kaizen.status)} className="text-sm">{kaizen.status}</Badge>
                    </div>
                </DialogHeader>
                <ScrollArea className="max-h-[70vh] p-1">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="grid w-full grid-cols-4">
                            <TabsTrigger value="general">Genel Bilgiler</TabsTrigger>
                            <TabsTrigger value="analysis">Kök Neden Analizi</TabsTrigger>
                            <TabsTrigger value="solution">Çözüm & Kanıtlar</TabsTrigger>
                            <TabsTrigger value="cost">Maliyet</TabsTrigger>
                        </TabsList>
                        <div className="p-4">
                            <TabsContent value="general">
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <InfoItem label="Öneri Sahibi" value={kaizen.proposer?.full_name} />
                                        <InfoItem label="Sorumlu Kişi" value={kaizen.responsible_person?.full_name} />
                                        <InfoItem label="Departman" value={kaizen.department?.unit_name} />
                                        <InfoItem label="Öncelik" value={kaizen.priority} />
                                        <InfoItem label="Başlangıç Tarihi" value={kaizen.start_date ? format(new Date(kaizen.start_date), 'dd.MM.yyyy') : '-'} />
                                        <InfoItem label="Bitiş Tarihi" value={kaizen.end_date ? format(new Date(kaizen.end_date), 'dd.MM.yyyy') : '-'} />
                                        <InfoItem label="Süre" value={duration} />
                                        <InfoItem label="Kaizen Konuları" value={formatArrayToString(kaizen.kaizen_topic)} />
                                        <InfoItem label="Kaizen Ekibi" value={teamMemberNames} className="col-span-2 md:col-span-4" />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold mb-2">Problem Tanımı</h4>
                                        <p className="text-sm p-3 bg-muted/50 rounded-lg whitespace-pre-wrap">{kaizen.description || '-'}</p>
                                    </div>
                                </div>
                            </TabsContent>
                            <TabsContent value="analysis">
                                <div className="space-y-6">
                                    <div className="p-4 border rounded-lg">
                                        <h4 className="font-semibold flex items-center gap-2 mb-2"><HelpCircle className="w-5 h-5 text-primary" />5N1K - Problemin Tanımı</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                                            <AnalysisItem label="Ne?" value={analysis_5n1k.what} />
                                            <AnalysisItem label="Nerede?" value={analysis_5n1k.where} />
                                            <AnalysisItem label="Ne Zaman?" value={analysis_5n1k.when} />
                                            <AnalysisItem label="Kim?" value={analysis_5n1k.who} />
                                            <AnalysisItem label="Nasıl?" value={analysis_5n1k.how} />
                                            <AnalysisItem label="Neden Önemli?" value={analysis_5n1k.why} />
                                        </div>
                                    </div>
                                    <div className="p-4 border rounded-lg">
                                      <h4 className="font-semibold flex items-center gap-2 mb-2"><BrainCircuit className="w-5 h-5 text-primary" />5 Neden Analizi</h4>
                                      <div className="space-y-2">
                                        <AnalysisItem label="1. Neden?" value={analysis_5_whys.answer1} />
                                        <AnalysisItem label="2. Neden?" value={analysis_5_whys.answer2} />
                                        <AnalysisItem label="3. Neden?" value={analysis_5_whys.answer3} />
                                        <AnalysisItem label="4. Neden?" value={analysis_5_whys.answer4} />
                                        <AnalysisItem label="5. Neden? (Kök Neden)" value={analysis_5_whys.answer5} />
                                      </div>
                                    </div>
                                    <div className="p-4 border rounded-lg">
                                        <h4 className="font-semibold flex items-center gap-2 mb-2"><Fish className="w-5 h-5 text-primary" />Balık Kılçığı Analizi</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                                            <AnalysisItem label="İnsan" value={analysis_fishbone.man} />
                                            <AnalysisItem label="Makine" value={analysis_fishbone.machine} />
                                            <AnalysisItem label="Metot" value={analysis_fishbone.method} />
                                            <AnalysisItem label="Malzeme" value={analysis_fishbone.material} />
                                            <AnalysisItem label="Çevre" value={analysis_fishbone.environment} />
                                            <AnalysisItem label="Ölçüm" value={analysis_fishbone.measurement} />
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>
                            <TabsContent value="solution">
                                <div className="space-y-6">
                                     <div>
                                        <h4 className="font-semibold mb-2 flex items-center gap-2"><Sigma className="w-5 h-5 text-primary" />Uygulanan Çözüm</h4>
                                        <p className="text-sm p-3 bg-muted/50 rounded-lg whitespace-pre-wrap">{kaizen.solution_description || '-'}</p>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <h4 className="font-semibold">Öncesi</h4>
                                            {kaizen.attachments_before?.length > 0 ? (
                                                kaizen.attachments_before.map((file, i) => (
                                                    <a key={i} href={getFileUrl(file)} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                                                        <FileIcon className="w-4 h-4" /> {file.name} <ExternalLink className="w-3 h-3 text-muted-foreground" />
                                                    </a>
                                                ))
                                            ) : <p className="text-sm text-muted-foreground">Görsel/doküman yok.</p>}
                                        </div>
                                        <div className="space-y-2">
                                            <h4 className="font-semibold">Sonrası</h4>
                                            {kaizen.attachments_after?.length > 0 ? (
                                                kaizen.attachments_after.map((file, i) => (
                                                    <a key={i} href={getFileUrl(file)} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                                                        <FileIcon className="w-4 h-4" /> {file.name} <ExternalLink className="w-3 h-3 text-muted-foreground" />
                                                    </a>
                                                ))
                                            ) : <p className="text-sm text-muted-foreground">Görsel/doküman yok.</p>}
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>
                             <TabsContent value="cost">
                                <div className="space-y-6">
                                    <div>
                                        <h4 className="font-semibold mb-2 text-primary">Maliyet & Verimlilik Analizi</h4>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                            <InfoItem label="Aylık Kazanç" value={(kaizen.total_monthly_gain || 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })} className="bg-green-50 text-green-800" />
                                            <InfoItem label="Yıllık Kazanç" value={(kaizen.total_yearly_gain || 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })} className="bg-blue-50 text-blue-800" />
                                            <InfoItem label="İşçilik Tasarrufu (dk/adet)" value={`${kaizen.labor_time_saving_minutes || 0} dk`} />
                                            <InfoItem label="Parça Maliyeti" value={(kaizen.part_cost || 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })} />
                                            <InfoItem label="Hatalı Parça (Önce)" value={`${kaizen.defective_parts_before || 0}`} />
                                            <InfoItem label="Hatalı Parça (Sonra)" value={`${kaizen.defective_parts_after || 0}`} />
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <h4 className="font-semibold mb-2 text-primary">İSG & Çevre Etkileri</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <InfoItem label="İSG Etkileri" value={formatArrayToString(kaizen.isg_effect)} />
                                            <InfoItem label="Çevresel Etkiler" value={formatArrayToString(kaizen.environmental_effect)} />
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>
                        </div>
                    </Tabs>
                </ScrollArea>
                <DialogFooter className="p-4 border-t">
                    <Button variant="outline" onClick={handlePrint} disabled={isPrinting}>
                        {isPrinting ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Yazdırılıyor...</>
                        ) : (
                            <><Printer className="mr-2 h-4 w-4" /> Yazdır / PDF</>
                        )}
                    </Button>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>Kapat</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default KaizenDetailModal;