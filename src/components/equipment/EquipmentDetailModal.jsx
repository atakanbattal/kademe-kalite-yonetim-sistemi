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

    const EquipmentDetailModal = ({ isOpen, setIsOpen, equipment, onRefresh }) => {
        const { toast } = useToast();
        const [isCalibrationModalOpen, setCalibrationModalOpen] = useState(false);
        const [isAssignModalOpen, setAssignModalOpen] = useState(false);
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
                onRefresh();
            }
        };

        const handleReturnAssignment = async (assignmentId) => {
            const { error } = await supabase.from('equipment_assignments').update({ is_active: false, return_date: new Date().toISOString() }).eq('id', assignmentId);
            if (error) {
                toast({ variant: 'destructive', title: 'Hata', description: `İade işlemi başarısız: ${error.message}` });
            } else {
                await supabase.from('equipments').update({ status: 'Aktif', location: equipment.responsible_unit }).eq('id', equipment.id);
                toast({ title: 'Başarılı', description: 'Ekipman iade alındı.' });
                onRefresh();
            }
        };

        const handleOpenPdfViewer = async (filePath, title) => {
            try {
                const { data, error } = await supabase.storage.from('calibration_certificates').download(filePath);
                if (error) {
                    toast({ variant: "destructive", title: "Hata", description: `PDF açılamadı: ${error.message}` });
                    return;
                }
                
                const blob = new Blob([data], { type: 'application/pdf' });
                const blobUrl = window.URL.createObjectURL(blob);
                
                setPdfViewerState({ isOpen: true, url: blobUrl, title });
            } catch (err) {
                toast({ variant: "destructive", title: "Hata", description: "PDF açılırken hata oluştu." });
                console.error('PDF view error:', err);
            }
        };

        return (
            <>
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogContent className="sm:max-w-4xl">
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
                        <DialogFooter className="p-4 border-t">
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
                        refreshData={() => { setCalibrationModalOpen(false); onRefresh(); }}
                    />
                )}

                {isAssignModalOpen && (
                    <AssignModal
                        isOpen={isAssignModalOpen}
                        setIsOpen={setAssignModalOpen}
                        equipmentId={equipment.id}
                        personnelList={personnelList}
                        refreshData={() => { setAssignModalOpen(false); onRefresh(); }}
                    />
                )}

                <PdfViewerModal 
                    isOpen={pdfViewerState.isOpen}
                    setIsOpen={(isOpen) => setPdfViewerState(s => ({...s, isOpen}))}
                    pdfUrl={pdfViewerState.url}
                    title={pdfViewerState.title}
                />
            </>
        );
    };

    export default EquipmentDetailModal;