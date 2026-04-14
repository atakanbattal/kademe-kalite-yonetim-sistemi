import React, { useState, useEffect, useMemo, useCallback } from 'react';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
    import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
    import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
    import ListTableShell from '@/components/ui/ListTableShell';
    import { MoreVertical, PlusCircle, Search, PlayCircle, CheckCircle, XCircle, FileText, Eye, Edit } from 'lucide-react';
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
    import { openPrintableReport } from '@/lib/reportUtils';

    const TrainingPlansTab = ({ pendingOpenTrainingId, onPendingOpenConsumed }) => {
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
                .order('start_date', { ascending: true, nullsFirst: false })
                .order('training_code', { ascending: true });

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

        // Dış kaynaklı doküman modülünden: planı aç
        useEffect(() => {
            if (!pendingOpenTrainingId) return undefined;
            let cancelled = false;
            (async () => {
                try {
                    const { data, error } = await supabase
                        .from('trainings')
                        .select('*')
                        .eq('id', pendingOpenTrainingId)
                        .single();
                    if (cancelled) return;
                    if (error || !data) {
                        toast({
                            variant: 'destructive',
                            title: 'Eğitim bulunamadı',
                            description: error?.message || 'Kayıt yüklenemedi.',
                        });
                    } else {
                        setPolyvalenceData(null);
                        setSelectedTraining(data);
                        setIsModalOpen(true);
                    }
                } finally {
                    onPendingOpenConsumed?.();
                }
            })();
            return () => {
                cancelled = true;
            };
        }, [pendingOpenTrainingId, onPendingOpenConsumed, toast]);

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
            const q = searchTerm.trim().toLowerCase();
            return trainings.filter((training) => {
                if (!q) return true;
                return (
                    (training.title && training.title.toLowerCase().includes(q)) ||
                    (training.instructor && training.instructor.toLowerCase().includes(q)) ||
                    (training.training_code && String(training.training_code).toLowerCase().includes(q))
                );
            });
        }, [trainings, searchTerm]);

        /** Sunucu sırası yeterli olmasa bile planlanan tarihe göre gösterim */
        const displayedTrainings = useMemo(() => {
            const list = [...filteredTrainings];
            const ts = (d) => {
                if (!d) return null;
                const t = new Date(d).getTime();
                return Number.isNaN(t) ? null : t;
            };
            list.sort((a, b) => {
                const ta = ts(a.start_date);
                const tb = ts(b.start_date);
                if (ta == null && tb == null) {
                    return String(a.training_code || '').localeCompare(String(b.training_code || ''), 'tr');
                }
                if (ta == null) return 1;
                if (tb == null) return -1;
                if (ta !== tb) return ta - tb;
                return String(a.training_code || '').localeCompare(String(b.training_code || ''), 'tr');
            });
            return list;
        }, [filteredTrainings]);

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
            <TooltipProvider delayDuration={200}>
            <div>
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-4">
                    <div className="search-box w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Eğitim, kod veya eğitmen ara..."
                            className="search-input"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 justify-end">
                        <Button onClick={handleAddTraining}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Yeni Eğitim Planı
                        </Button>
                    </div>
                </div>

                <ListTableShell noInner>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Eğitim Kodu</TableHead>
                                <TableHead>Eğitim Başlığı</TableHead>
                                <TableHead>Eğitmen</TableHead>
                                <TableHead>Katılımcı Sayısı</TableHead>
                                <TableHead>Planlanan Tarih</TableHead>
                                <TableHead>Durum</TableHead>
                                <TableHead className="text-right">İşlemler</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan="7" className="text-center">Yükleniyor...</TableCell>
                                </TableRow>
                            ) : displayedTrainings.length > 0 ? (
                                displayedTrainings.map((training) => (
                                    <TableRow key={training.id}>
                                        <TableCell>{training.training_code}</TableCell>
                                        <TableCell className="font-medium">{training.title}</TableCell>
                                        <TableCell>{training.instructor || '-'}</TableCell>
                                        <TableCell>{training.training_participants[0]?.count || 0}</TableCell>
                                        <TableCell>{training.start_date ? format(new Date(training.start_date), 'dd MMMM yyyy', { locale: tr }) : '-'}</TableCell>
                                        <TableCell>{getStatusBadge(training.status)}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="inline-flex items-center justify-end gap-0.5">
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => handleEditTraining(training)} aria-label="Görüntüle">
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="bottom">Görüntüle</TooltipContent>
                                                </Tooltip>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" aria-label="Diğer işlemler">
                                                        <MoreVertical className="h-4 w-4 shrink-0" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-52">
                                                    <DropdownMenuItem className="text-sm" onClick={() => handleEditTraining(training)}>
                                                        <Edit className="mr-2 h-4 w-4 shrink-0" /> Düzenle
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        className="text-sm"
                                                        onClick={() => openPrintableReport({ id: training.id }, 'training_record', false)}
                                                    >
                                                        <FileText className="mr-2 h-4 w-4 shrink-0" />
                                                        Rapor oluştur
                                                    </DropdownMenuItem>
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
                                                    <DropdownMenuItem onClick={() => confirmDeleteTraining(training)} className="text-sm text-destructive focus:text-destructive focus:bg-destructive/10">Sil</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                            </div>
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
                </ListTableShell>
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
            </TooltipProvider>
        );
    };

    export default TrainingPlansTab;