import React, { useState, useEffect, useMemo, useCallback } from 'react';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { Label } from '@/components/ui/label';
    import { Loader2, Search, Award, PlusCircle } from 'lucide-react';
    import { format } from 'date-fns';
    import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
    import { Badge } from '@/components/ui/badge';
    import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

    const ManualCertificateModal = ({ onCertificateGenerated }) => {
        const [isOpen, setIsOpen] = useState(false);
        const [personnelList, setPersonnelList] = useState([]);
        const [trainingList, setTrainingList] = useState([]);
        const [selectedPersonnel, setSelectedPersonnel] = useState('');
        const [selectedTraining, setSelectedTraining] = useState('');
        const [certificateType, setCertificateType] = useState('success'); // 'success' veya 'participation'
        const [isSubmitting, setIsSubmitting] = useState(false);
        const { toast } = useToast();

        useEffect(() => {
            if (isOpen) {
                const fetchInitialData = async () => {
                    const { data: personnelData, error: personnelError } = await supabase.from('personnel').select('id, full_name').order('full_name');
                    if (personnelError) console.error(personnelError);
                    else setPersonnelList(personnelData);

                    const { data: trainingData, error: trainingError } = await supabase.from('trainings').select('id, title').order('title');
                    if (trainingError) console.error(trainingData);
                    else setTrainingList(trainingData);
                };
                fetchInitialData();
            }
        }, [isOpen]);

        const handleGenerate = async () => {
            if (!selectedPersonnel || !selectedTraining) {
                toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Lütfen personel ve eğitim seçimi yapın.' });
                return;
            }

            setIsSubmitting(true);
            try {
                const { data: existingParticipant, error: fetchError } = await supabase
                    .from('training_participants')
                    .select('id')
                    .eq('training_id', selectedTraining)
                    .eq('personnel_id', selectedPersonnel)
                    .maybeSingle();

                if (fetchError && fetchError.code !== 'PGRST116') {
                     throw fetchError;
                }

                let participantId;

                if (existingParticipant) {
                    const { data: updatedData, error: updateError } = await supabase
                        .from('training_participants')
                        .update({ status: 'Tamamlandı', completed_at: new Date().toISOString(), score: 100 })
                        .eq('id', existingParticipant.id)
                        .select('id')
                        .single();
                    if (updateError) throw updateError;
                    participantId = updatedData.id;
                    toast({ title: 'Kayıt Güncellendi', description: 'Mevcut katılımcı kaydı sertifika için güncellendi.' });
                } else {
                    const { data: newParticipant, error: insertError } = await supabase
                        .from('training_participants')
                        .insert({
                            training_id: selectedTraining,
                            personnel_id: selectedPersonnel,
                            status: 'Tamamlandı',
                            completed_at: new Date().toISOString(),
                            score: 100
                        })
                        .select('id')
                        .single();
                    if (insertError) throw insertError;
                    participantId = newParticipant.id;
                    toast({ title: 'Kayıt Oluşturuldu', description: 'Yeni sertifika kaydı başarıyla oluşturuldu.' });
                }
                
                const { data: personnelData } = await supabase.from('personnel').select('full_name').eq('id', selectedPersonnel).single();
                const { data: trainingData } = await supabase.from('trainings').select('title, instructor').eq('id', selectedTraining).single();

                const params = new URLSearchParams({
                    personnelName: personnelData?.full_name || 'İsim Bulunamadı',
                    trainingTitle: trainingData?.title || 'Eğitim Bulunamadı',
                    trainingInstructor: trainingData?.instructor || '',
                    score: '100',
                    completedAt: new Date().toISOString(),
                    certificateType: certificateType, // 'success' veya 'participation'
                });

                const url = `/print/report/certificate/${participantId}?${params.toString()}`;
                window.open(url, '_blank');
                onCertificateGenerated();
                setIsOpen(false);

            } catch (error) {
                toast({ variant: 'destructive', title: 'Hata', description: `Sertifika kaydı oluşturulurken hata: ${error.message}` });
            } finally {
                setIsSubmitting(false);
            }
        };

        return (
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogTrigger asChild>
                    <Button>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Manuel Sertifika Oluştur
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Manuel Sertifika Oluştur</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="personnel" className="text-right">Personel</Label>
                            <Select onValueChange={setSelectedPersonnel} value={selectedPersonnel}>
                                <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="Personel seçin..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {personnelList.map(p => (
                                        <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="training" className="text-right">Eğitim</Label>
                             <Select onValueChange={setSelectedTraining} value={selectedTraining}>
                                <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="Eğitim seçin..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {trainingList.map(t => (
                                        <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="certificateType" className="text-right">Sertifika Türü</Label>
                            <Select onValueChange={setCertificateType} value={certificateType}>
                                <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="Sertifika türü seçin..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="success">Başarı Sertifikası</SelectItem>
                                    <SelectItem value="participation">Katılım Sertifikası</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleGenerate} disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Sertifika Oluştur
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    };

    const CertificateTab = () => {
        const [groupedParticipants, setGroupedParticipants] = useState({});
        const [loading, setLoading] = useState(true);
        const [searchTerm, setSearchTerm] = useState('');
        const { toast } = useToast();

        const fetchEligibleParticipants = useCallback(async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('training_participants')
                .select(`
                    id,
                    score,
                    completed_at,
                    status,
                    personnel_id,
                    training_id,
                    personnel:personnel_id (id, full_name),
                    training:training_id (id, title, training_exams(passing_score), instructor)
                `)
                .eq('status', 'Tamamlandı')
                .order('completed_at', { ascending: false });

            if (error) {
                toast({ variant: 'destructive', title: 'Hata!', description: `Sertifika verileri getirilirken bir hata oluştu: ${error.message}` });
                setGroupedParticipants({});
            } else {
                const eligible = data.filter(p => {
                    const exam = p.training?.training_exams?.[0];
                    return !exam || (p.score != null && p.score >= exam.passing_score);
                });

                const grouped = eligible.reduce((acc, p) => {
                    const trainingId = p.training?.id;
                    if (!trainingId) return acc;
                    if (!acc[trainingId]) {
                        acc[trainingId] = {
                            title: p.training.title,
                            participants: []
                        };
                    }
                    acc[trainingId].participants.push(p);
                    return acc;
                }, {});

                setGroupedParticipants(grouped);
            }
            setLoading(false);
        }, [toast]);

        useEffect(() => {
            fetchEligibleParticipants();
        }, [fetchEligibleParticipants]);

        const handleGenerateCertificate = async (participant, certType = 'success') => {
            if (!participant?.personnel_id || !participant.training_id) {
                toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Katılımcı veya eğitim bilgisi bulunamadı.' });
                return;
            }

            const { data: personnelData, error: pError } = await supabase
                .from('personnel')
                .select('full_name')
                .eq('id', participant.personnel_id)
                .single();
            
            const { data: trainingData, error: tError } = await supabase
                .from('trainings')
                .select('title, instructor')
                .eq('id', participant.training_id)
                .single();

            if (pError || tError) {
                toast({ variant: 'destructive', title: 'Veri Alınamadı', description: 'Gerekli bilgiler çekilemedi.' });
                return;
            }
            
            const params = new URLSearchParams({
                personnelName: personnelData?.full_name || 'İsim Bulunamadı',
                trainingTitle: trainingData?.title || 'Eğitim Bulunamadı',
                trainingInstructor: trainingData?.instructor || '',
                score: participant.score || '',
                completedAt: participant.completed_at || '',
                status: participant.status || '',
                certificateType: certType || 'success'
            });
            
            window.open(`/print/report/certificate/${participant.id}?${params.toString()}&autoprint=true`, '_blank');
        };

        const filteredGroupedData = useMemo(() => {
            if (!searchTerm) return groupedParticipants;
            const lowercasedFilter = searchTerm.toLowerCase();
            const filtered = {};

            Object.keys(groupedParticipants).forEach(trainingId => {
                const group = groupedParticipants[trainingId];
                const matchingParticipants = group.participants.filter(p =>
                    p.personnel?.full_name?.toLowerCase().includes(lowercasedFilter)
                );

                if (group.title.toLowerCase().includes(lowercasedFilter) || matchingParticipants.length > 0) {
                    filtered[trainingId] = {
                        ...group,
                        participants: group.title.toLowerCase().includes(lowercasedFilter) ? group.participants : matchingParticipants,
                    };
                }
            });
            return filtered;
        }, [groupedParticipants, searchTerm]);
        
        if (loading) {
            return (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            );
        }

        return (
            <div className="p-4 bg-card rounded-lg shadow-sm">
                <div className="flex justify-between items-center mb-4 gap-4 flex-wrap">
                    <h2 className="text-xl font-bold">Sertifika Yönetimi</h2>
                    <div className="flex items-center gap-2 flex-grow sm:flex-grow-0">
                        <div className="relative w-full max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Eğitim veya katılımcı ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
                        </div>
                        <ManualCertificateModal onCertificateGenerated={fetchEligibleParticipants} />
                    </div>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                    Sınavı olan eğitimlerden başarıyla geçen veya sınavsız eğitimleri tamamlayan katılımcılar eğitim bazında gruplanmıştır.
                </p>

                <Accordion type="multiple" className="w-full">
                    {Object.keys(filteredGroupedData).length > 0 ? (
                        Object.keys(filteredGroupedData).map(trainingId => {
                            const group = filteredGroupedData[trainingId];
                            return (
                                <AccordionItem value={trainingId} key={trainingId}>
                                    <AccordionTrigger>
                                        <div className="flex items-center gap-4">
                                            <span className="font-semibold text-lg">{group.title}</span>
                                            <Badge variant="secondary">{group.participants.length} Sertifika</Badge>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="overflow-x-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Katılımcı</TableHead>
                                                        <TableHead>Tamamlanma Tarihi</TableHead>
                                                        <TableHead className="text-right z-20 border-l border-border shadow-[2px_0_4px_rgba(0,0,0,0.1)]">İşlemler</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {group.participants.map(p => (
                                                        <TableRow key={p.id}>
                                                            <TableCell>{p.personnel?.full_name}</TableCell>
                                                            <TableCell>{p.completed_at ? format(new Date(p.completed_at), 'dd.MM.yyyy') : '-'}</TableCell>
                                                            <TableCell className="text-right">
                                                                <div className="flex items-center justify-end gap-2">
                                                                    <Button 
                                                                        variant="outline" 
                                                                        size="sm" 
                                                                        onClick={() => handleGenerateCertificate(p, 'success')}
                                                                        title="Başarı Sertifikası"
                                                                    >
                                                                        <Award className="mr-2 h-4 w-4" />
                                                                        Başarı
                                                                    </Button>
                                                                    <Button 
                                                                        variant="outline" 
                                                                        size="sm" 
                                                                        onClick={() => handleGenerateCertificate(p, 'participation')}
                                                                        title="Katılım Sertifikası"
                                                                    >
                                                                        <Award className="mr-2 h-4 w-4" />
                                                                        Katılım
                                                                    </Button>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            )
                        })
                    ) : (
                        <div className="text-center py-10 text-muted-foreground">
                            Sertifika almaya hak kazanan katılımcı bulunamadı.
                        </div>
                    )}
                </Accordion>
            </div>
        );
    };

    export default CertificateTab;