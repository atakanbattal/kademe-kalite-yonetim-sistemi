import React, { useState, useEffect, useMemo, useCallback } from 'react';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
    import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
    import { MoreHorizontal, PlusCircle, Search, PlayCircle, CheckCircle, XCircle } from 'lucide-react';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/customSupabaseClient';
    import { Badge } from '@/components/ui/badge';
    import TrainingFormModal from '@/components/training/TrainingFormModal';
    import {
      AlertDialog,
      AlertDialogAction,
      AlertDialogCancel,
      AlertDialogContent,
      AlertDialogDescription,
      AlertDialogFooter,
      AlertDialogHeader,
      AlertDialogTitle,
    } from "@/components/ui/alert-dialog";
    import { format } from 'date-fns';
    import { tr } from 'date-fns/locale';
    import { useLocation } from 'react-router-dom';

    const TrainingPlansTab = () => {
        const { toast } = useToast();
        const location = useLocation();
        const [trainings, setTrainings] = useState([]);
        const [loading, setLoading] = useState(true);
        const [searchTerm, setSearchTerm] = useState('');
        const [isModalOpen, setIsModalOpen] = useState(false);
        const [selectedTraining, setSelectedTraining] = useState(null);
        const [isAlertOpen, setIsAlertOpen] = useState(false);
        const [trainingToDelete, setTrainingToDelete] = useState(null);
        const [polyvalenceData, setPolyvalenceData] = useState(null);

        const fetchTrainings = useCallback(async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('trainings')
                .select('*, training_participants(count)')
                .order('created_at', { ascending: false });

            if (error) {
                toast({ variant: 'destructive', title: 'Hata', description: 'Eğitimler getirilirken bir hata oluştu.' });
            } else {
                setTrainings(data);
            }
            setLoading(false);
        }, [toast]);

        useEffect(() => {
            fetchTrainings();
        }, [fetchTrainings]);

        // Polivalans modülünden gelen durumu kontrol et
        useEffect(() => {
            if (location.state?.autoOpenModal && location.state?.fromPolyvalence) {
                const polyData = {
                    selectedPersonnel: location.state.selectedPersonnel || [],
                    selectedSkillId: location.state.selectedSkillId || null
                };
                
                setPolyvalenceData(polyData);
                setSelectedTraining(null);
                setIsModalOpen(true);
                
                // State'i temizle (bir kere kullanıldıktan sonra)
                // replaceState yerine navigate ile temizle
                window.history.replaceState(null, '');
            }
        }, [location.state]);

        const filteredTrainings = useMemo(() => {
            return trainings.filter(training =>
                training.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (training.instructor && training.instructor.toLowerCase().includes(searchTerm.toLowerCase()))
            );
        }, [trainings, searchTerm]);

        const handleAddTraining = () => {
            setSelectedTraining(null);
            setPolyvalenceData(null);
            setIsModalOpen(true);
        };

        const handleEditTraining = (training) => {
            setSelectedTraining(training);
            setPolyvalenceData(null);
            setIsModalOpen(true);
        };

        const confirmDeleteTraining = (training) => {
            setTrainingToDelete(training);
            setIsAlertOpen(true);
        };

        const handleDeleteTraining = async () => {
            if (!trainingToDelete) return;

            const { error } = await supabase.from('trainings').delete().eq('id', trainingToDelete.id);

            if (error) {
                toast({ variant: 'destructive', title: 'Hata', description: 'Eğitim silinirken bir hata oluştu.' });
            } else {
                toast({ title: 'Başarılı', description: 'Eğitim başarıyla silindi.' });
                fetchTrainings();
            }
            setIsAlertOpen(false);
            setTrainingToDelete(null);
        };

        const handleUpdateStatus = async (trainingId, status) => {
            const { error } = await supabase.from('trainings').update({ status }).eq('id', trainingId);
            if (error) {
                toast({ variant: 'destructive', title: 'Hata', description: `Eğitim durumu güncellenemedi: ${error.message}` });
            } else {
                toast({ title: 'Başarılı', description: 'Eğitim durumu güncellendi.' });
                fetchTrainings();
            }
        };

        const handleSave = () => {
            setIsModalOpen(false);
            setPolyvalenceData(null);
            fetchTrainings();
        };
        
        const getStatusBadge = (status) => {
            switch (status) {
                case 'Tamamlandı': return <Badge variant="success">Tamamlandı</Badge>;
                case 'Aktif': return <Badge variant="default">Aktif</Badge>;
                case 'Planlandı': return <Badge variant="outline">Planlandı</Badge>;
                case 'İptal': return <Badge variant="destructive">İptal</Badge>;
                default: return <Badge variant="secondary">{status}</Badge>;
            }
        };

        return (
            <div>
                <div className="flex justify-between items-center mb-4">
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Eğitim veya eğitmen ara..."
                            className="pl-8"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button onClick={handleAddTraining}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Yeni Eğitim Planı
                    </Button>
                </div>

                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Eğitim Kodu</TableHead>
                                <TableHead>Eğitim Başlığı</TableHead>
                                <TableHead>Eğitmen</TableHead>
                                <TableHead>Katılımcı Sayısı</TableHead>
                                <TableHead>Planlanan Tarih</TableHead>
                                <TableHead>Durum</TableHead>
                                <TableHead className="text-right z-20 border-l border-border shadow-[2px_0_4px_rgba(0,0,0,0.1)]">İşlemler</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan="7" className="text-center">Yükleniyor...</TableCell>
                                </TableRow>
                            ) : filteredTrainings.length > 0 ? (
                                filteredTrainings.map((training) => (
                                    <TableRow key={training.id}>
                                        <TableCell>{training.training_code}</TableCell>
                                        <TableCell className="font-medium">{training.title}</TableCell>
                                        <TableCell>{training.instructor || '-'}</TableCell>
                                        <TableCell>{training.training_participants[0]?.count || 0}</TableCell>
                                        <TableCell>{training.start_date ? format(new Date(training.start_date), 'dd MMMM yyyy', { locale: tr }) : '-'}</TableCell>
                                        <TableCell>{getStatusBadge(training.status)}</TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                                        <span className="sr-only">Menü aç</span>
                                                        <MoreHorizontal className="h-4 w-4 flex-shrink-0 text-foreground" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => handleEditTraining(training)}>Görüntüle / Düzenle</DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    {training.status === 'Planlandı' && (
                                                        <DropdownMenuItem onClick={() => handleUpdateStatus(training.id, 'Aktif')}>
                                                            <PlayCircle className="mr-2 h-4 w-4" />
                                                            Eğitimi Başlat
                                                        </DropdownMenuItem>
                                                    )}
                                                     {training.status === 'Aktif' && (
                                                        <DropdownMenuItem onClick={() => handleUpdateStatus(training.id, 'Tamamlandı')}>
                                                            <CheckCircle className="mr-2 h-4 w-4" />
                                                            Eğitimi Tamamla
                                                        </DropdownMenuItem>
                                                    )}
                                                    {training.status !== 'İptal' && training.status !== 'Tamamlandı' && (
                                                        <DropdownMenuItem onClick={() => handleUpdateStatus(training.id, 'İptal')}>
                                                            <XCircle className="mr-2 h-4 w-4" />
                                                            Eğitimi İptal Et
                                                        </DropdownMenuItem>
                                                    )}
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onClick={() => confirmDeleteTraining(training)} className="text-destructive">Sil</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan="7" className="text-center">Kayıt bulunamadı.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
                <TrainingFormModal
                    isOpen={isModalOpen}
                    setIsOpen={(open) => {
                        setIsModalOpen(open);
                        if (!open) setPolyvalenceData(null);
                    }}
                    training={selectedTraining}
                    onSave={handleSave}
                    polyvalenceData={polyvalenceData}
                />
                <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Bu eylem geri alınamaz. Bu, eğitimi ve ilişkili tüm verileri kalıcı olarak silecektir.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>İptal</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteTraining}>Sil</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        );
    };

    export default TrainingPlansTab;