import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus } from 'lucide-react';
import CalibrationHistory from '@/components/equipment/CalibrationHistory';
import AssignmentHistory from '@/components/equipment/AssignmentHistory';
import CalibrationModal from '@/components/equipment/CalibrationModal';
import AssignModal from '@/components/equipment/AssignModal';
import PdfViewerModal from '@/components/document/PdfViewerModal';
import ScrapEquipmentModal from '@/components/equipment/ScrapEquipmentModal';

const EquipmentDetailModal = ({ isOpen, setIsOpen, equipment, onRefresh, refreshData }) => {
    // refreshData veya onRefresh kullanılabilir
    const handleRefresh = refreshData || onRefresh;
    const { toast } = useToast();
    const [isCalibrationModalOpen, setCalibrationModalOpen] = useState(false);
    const [isAssignModalOpen, setAssignModalOpen] = useState(false);
    const [isScrapModalOpen, setIsScrapModalOpen] = useState(false);
    const [personnelList, setPersonnelList] = useState([]);
    const [selectedCalibration, setSelectedCalibration] = useState(null);
    const [pdfViewerState, setPdfViewerState] = useState({ isOpen: false, url: null, title: '' });

    useEffect(() => {
        const fetchPersonnel = async () => {
            const { data, error } = await supabase.from('personnel').select('id, full_name').eq('is_active', true);
            if (error) console.error("Error fetching personnel:", error);
            else setPersonnelList(data);
        };
        if (isOpen) fetchPersonnel();
    }, [isOpen]);

    if (!equipment) return null;

    const getStatusVariant = (status) => {
        switch (status) {
            case 'Aktif': return 'success';
            case 'Zimmetli': return 'default';
            case 'Bakımda': return 'warning';
            case 'Kullanım Dışı': return 'destructive';
            case 'Hurdaya Ayrıldı': return 'destructive';
            default: return 'secondary';
        }
    };

    const handleEditCalibration = (calibration) => {
        setSelectedCalibration(calibration);
        setCalibrationModalOpen(true);
    };

    const handleNewCalibration = () => {
        setSelectedCalibration(null);
        setCalibrationModalOpen(true);
    };

    const handleDeleteCalibration = async (calibration) => {
        const { error } = await supabase.from('equipment_calibrations').delete().eq('id', calibration.id);
        if (error) {
            toast({ variant: 'destructive', title: 'Hata', description: `Kalibrasyon kaydı silinemedi: ${error.message}` });
        } else {
            if (calibration.certificate_path) {
                await supabase.storage.from('calibration_certificates').remove([calibration.certificate_path]);
            }
            toast({ title: 'Başarılı', description: 'Kalibrasyon kaydı silindi.' });
            if (handleRefresh) handleRefresh();
        }
    };

    const handleReturnAssignment = async (assignmentId) => {
        const { error } = await supabase.from('equipment_assignments').update({ is_active: false, return_date: new Date().toISOString() }).eq('id', assignmentId);
        if (error) {
            toast({ variant: 'destructive', title: 'Hata', description: `İade işlemi başarısız: ${error.message}` });
        } else {
            await supabase.from('equipments').update({ status: 'Aktif', location: equipment.responsible_unit }).eq('id', equipment.id);
            toast({ title: 'Başarılı', description: 'Ekipman iade alındı.' });
            if (handleRefresh) handleRefresh();
        }
    };

    const handleOpenPdfViewer = async (filePath, title) => {
        try {
            if (!filePath) {
                toast({ variant: "destructive", title: "Hata", description: "Dosya yolu bulunamadı." });
                return;
            }

            // Path formatını normalize et
            let normalizedPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;

            // Eğer path 'public/' ile başlıyorsa kaldır (Supabase Storage'da bucket adı kullanılır, public/ prefix'i gerekmez)
            if (normalizedPath.startsWith('public/')) {
                normalizedPath = normalizedPath.replace('public/', '');
            }

            // Path formatını analiz et ve equipment_id'yi çıkar
            // Olası formatlar:
            // 1. {equipment_id}/{uuid}-{filename} (yeni format)
            // 2. {equipment_id}-{uuid}-{serial_number}.pdf (eski format - public/ ile başlayabilir)
            // 3. {uuid}-{filename} (eski format - equipment_id yok)

            const pathParts = normalizedPath.split('/');
            let extractedEquipmentId = null;
            let fileName = normalizedPath;

            // UUID pattern (8-4-4-4-12 karakter)
            const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

            // Eğer path'te '/' varsa, ilk kısım equipment_id olabilir
            if (pathParts.length > 1) {
                const firstPart = pathParts[0];
                if (uuidPattern.test(firstPart)) {
                    extractedEquipmentId = firstPart;
                    fileName = pathParts.slice(1).join('/');
                }
            } else {
                // Path'te '/' yok, equipment_id path'in başında olabilir (eski format)
                // Örnek: 6d21d3ef-2c30-41aa-b0d3-376b8e4e4c9b-ab4535b8-1ff0-4497-ace8-f0a6a53ac916-219009.pdf
                // Bu path'te iki UUID var gibi görünüyor ama format standart değil
                // En iyi yaklaşım: Path'in tamamını dosya adı olarak kabul et ve equipment.id ile birleştir
                // Ama önce path'te UUID var mı kontrol et
                const parts = normalizedPath.split('-');
                if (parts.length >= 5) {
                    // İlk 5 parça bir UUID'nin başlangıcı olabilir
                    const potentialUuid = parts.slice(0, 5).join('-');
                    // Eğer bu bir UUID formatına uyuyorsa (tam UUID değil ama başlangıcı)
                    // Path'in geri kalanını dosya adı olarak al
                    if (parts.length > 5) {
                        // İlk UUID'yi equipment_id olarak kabul et (tam UUID olmasa bile)
                        extractedEquipmentId = potentialUuid;
                        fileName = parts.slice(5).join('-');
                    }
                }
            }

            // Olası path formatlarını dene (öncelik sırasına göre)
            const pathAttempts = [];

            // 1. Eğer path zaten equipment.id ile başlıyorsa, önce onu dene
            if (normalizedPath.startsWith(`${equipment.id}/`)) {
                pathAttempts.push(normalizedPath);
            }

            // 2. Çıkarılan equipment_id ile dene (path'ten parse edilen)
            if (extractedEquipmentId && fileName !== normalizedPath) {
                pathAttempts.push(`${extractedEquipmentId}/${fileName}`);
            }

            // 3. Mevcut equipment.id ile dene (en yaygın format)
            if (!normalizedPath.includes('/')) {
                // Path'te '/' yok, equipment.id ekle
                pathAttempts.push(`${equipment.id}/${normalizedPath}`);
            } else {
                // Path'te '/' var, sadece dosya adını al ve equipment.id ile birleştir
                const fileNameOnly = pathParts[pathParts.length - 1];
                pathAttempts.push(`${equipment.id}/${fileNameOnly}`);
                // Ayrıca path'in tamamını da dene (eğer equipment_id path'in başındaysa)
                if (pathParts[0] !== equipment.id) {
                    pathAttempts.push(`${equipment.id}/${normalizedPath}`);
                }
            }

            // 4. Çıkarılan equipment_id ile path'in tamamını dene (eğer parse edildiyse)
            if (extractedEquipmentId) {
                pathAttempts.push(`${extractedEquipmentId}/${normalizedPath}`);
            }

            // 5. Doğrudan path'i dene (eski formatlar için - son çare)
            pathAttempts.push(normalizedPath);

            // Tekrarları kaldır
            const uniquePathAttempts = [...new Set(pathAttempts)];

            let data = null;
            let error = null;
            let successfulPath = null;

            console.log('🔍 Kalibrasyon belgesi açılıyor:', {
                originalPath: filePath,
                normalizedPath,
                equipmentId: equipment.id,
                denenecekPathler: uniquePathAttempts
            });

            // Her path formatını dene
            for (const attemptPath of uniquePathAttempts) {
                const result = await supabase.storage.from('calibration_certificates').download(attemptPath);
                if (!result.error) {
                    data = result.data;
                    successfulPath = attemptPath;
                    error = null;
                    console.log('✅ Başarılı path bulundu:', attemptPath);
                    break;
                } else {
                    error = result.error;
                    console.log(`❌ Path denendi ama bulunamadı: ${attemptPath}`, result.error.message);
                }
            }

            if (error || !data) {
                console.error('❌ PDF download error - denenen pathler:', uniquePathAttempts);
                console.error('❌ Son hata:', error);
                toast({
                    variant: "destructive",
                    title: "Hata",
                    description: `PDF açılamadı: ${error?.message || 'Dosya bulunamadı'}. Path: ${filePath}`
                });
                return;
            }

            const blob = new Blob([data], { type: 'application/pdf' });
            const blobUrl = window.URL.createObjectURL(blob);

            setPdfViewerState({ isOpen: true, url: blobUrl, title: title || 'Kalibrasyon Sertifikası' });
        } catch (err) {
            toast({ variant: "destructive", title: "Hata", description: "PDF açılırken hata oluştu." });
            console.error('PDF view error:', err);
        }
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
                    <DialogHeader>
                        <div className="flex justify-between items-start">
                            <div>
                                <DialogTitle className="text-2xl">{equipment.name}</DialogTitle>
                                <DialogDescription>Seri No: {equipment.serial_number}</DialogDescription>
                            </div>
                            <Badge variant={getStatusVariant(equipment.status)} className="text-sm">{equipment.status}</Badge>
                        </div>
                    </DialogHeader>
                    <ScrollArea className="max-h-[60vh] p-1">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6 p-4 bg-muted/50 rounded-lg">
                            <div><p className="text-sm text-muted-foreground">Marka/Model</p><p className="font-semibold">{equipment.brand_model || '-'}</p></div>
                            <div><p className="text-sm text-muted-foreground">Sorumlu Birim</p><p className="font-semibold">{equipment.responsible_unit}</p></div>
                            <div><p className="text-sm text-muted-foreground">Konum</p><p className="font-semibold">{equipment.location || '-'}</p></div>
                            <div><p className="text-sm text-muted-foreground">Ölçüm Aralığı</p><p className="font-semibold">{equipment.measurement_range || '-'}</p></div>
                            <div><p className="text-sm text-muted-foreground">Ölçüm Belirsizliği</p><p className="font-semibold">{equipment.measurement_uncertainty || '-'}</p></div>
                            <div><p className="text-sm text-muted-foreground">Kalibrasyon Periyodu</p><p className="font-semibold">{equipment.calibration_frequency_months ? `${equipment.calibration_frequency_months} Ay` : '-'}</p></div>
                            {equipment.status === 'Hurdaya Ayrıldı' && equipment.scrap_date && (
                                <>
                                    <div><p className="text-sm text-muted-foreground">Hurdaya Ayırma Tarihi</p><p className="font-semibold text-destructive">{new Date(equipment.scrap_date).toLocaleDateString('tr-TR')}</p></div>
                                    <div className="col-span-2"><p className="text-sm text-muted-foreground">Hurdaya Ayırma Sebebi</p><p className="font-semibold">{equipment.scrap_reason || '-'}</p></div>
                                    {equipment.scrap_document_path && (
                                        <div className="col-span-full">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleOpenPdfViewer(equipment.scrap_document_path, 'Hurdaya Ayırma Tutanağı')}
                                            >
                                                Hurdaya Ayırma Tutanağını Görüntüle
                                            </Button>
                                        </div>
                                    )}
                                </>
                            )}
                            <div className="col-span-full"><p className="text-sm text-muted-foreground">Açıklama</p><p className="font-semibold">{equipment.description || '-'}</p></div>
                        </div>

                        <Tabs defaultValue="calibration" className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="calibration">Kalibrasyon Geçmişi</TabsTrigger>
                                <TabsTrigger value="assignment">Zimmet Geçmişi</TabsTrigger>
                            </TabsList>
                            <TabsContent value="calibration">
                                <div className="flex justify-end mb-2">
                                    <Button size="sm" onClick={handleNewCalibration}><Plus className="mr-2 h-4 w-4" /> Yeni Kalibrasyon</Button>
                                </div>
                                <CalibrationHistory
                                    calibrations={equipment.equipment_calibrations}
                                    onOpenPdfViewer={handleOpenPdfViewer}
                                    onEdit={handleEditCalibration}
                                    onDelete={handleDeleteCalibration}
                                    equipmentId={equipment.id}
                                />
                            </TabsContent>
                            <TabsContent value="assignment">
                                <div className="flex justify-end mb-2">
                                    <Button size="sm" onClick={() => setAssignModalOpen(true)}><Plus className="mr-2 h-4 w-4" /> Yeni Zimmet</Button>
                                </div>
                                <AssignmentHistory
                                    assignments={equipment.equipment_assignments}
                                    personnelList={personnelList}
                                    onReturn={handleReturnAssignment}
                                />
                            </TabsContent>
                        </Tabs>
                    </ScrollArea>
                    <DialogFooter className="p-4 border-t flex justify-between">
                        <div>
                            {equipment.status !== 'Hurdaya Ayrıldı' && (
                                <Button
                                    variant="destructive"
                                    onClick={() => setIsScrapModalOpen(true)}
                                >
                                    Hurdaya Ayır
                                </Button>
                            )}
                        </div>
                        <Button variant="outline" onClick={() => setIsOpen(false)}>Kapat</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {isCalibrationModalOpen && (
                <CalibrationModal
                    isOpen={isCalibrationModalOpen}
                    setIsOpen={setCalibrationModalOpen}
                    equipment={equipment}
                    existingCalibration={selectedCalibration}
                    refreshData={() => { setCalibrationModalOpen(false); if (handleRefresh) handleRefresh(); }}
                />
            )}

            {isAssignModalOpen && (
                <AssignModal
                    isOpen={isAssignModalOpen}
                    setIsOpen={setAssignModalOpen}
                    equipmentId={equipment.id}
                    personnelList={personnelList}
                    refreshData={() => { setAssignModalOpen(false); if (handleRefresh) handleRefresh(); }}
                />
            )}

            <PdfViewerModal
                isOpen={pdfViewerState.isOpen}
                setIsOpen={(isOpen) => setPdfViewerState(s => ({ ...s, isOpen }))}
                pdfUrl={pdfViewerState.url}
                title={pdfViewerState.title}
            />

            {isScrapModalOpen && (
                <ScrapEquipmentModal
                    isOpen={isScrapModalOpen}
                    setIsOpen={setIsScrapModalOpen}
                    equipment={equipment}
                    onSuccess={() => {
                        setIsScrapModalOpen(false);
                        if (handleRefresh) handleRefresh();
                    }}
                />
            )}
        </>
    );
};

export default EquipmentDetailModal;