import React, { useState, useEffect, useMemo, useCallback } from 'react';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
    import { Badge } from '@/components/ui/badge';
    import { Input } from '@/components/ui/input';
    import { Loader2, Search, Save } from 'lucide-react';
    import { format } from 'date-fns';
    import { Button } from '@/components/ui/button';
    import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
    import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

    const ScoreInput = ({ participant, onSave }) => {
        const [score, setScore] = useState(participant.score ?? '');
        const [isOpen, setIsOpen] = useState(false);

        const handleSave = () => {
            onSave(participant.id, score);
            setIsOpen(false);
        };
        
        const handleKeyDown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSave();
            }
        }

        return (
            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <Button variant="link" className="p-0 h-auto">{participant.score ?? 'Not Gir'}</Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2">
                    <div className="flex items-center gap-2">
                        <Input
                            type="number"
                            value={score}
                            onChange={(e) => setScore(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="h-8"
                            max={100}
                            min={0}
                            autoFocus
                        />
                        <Button size="icon" className="h-8 w-8" onClick={handleSave}><Save className="h-4 w-4" /></Button>
                    </div>
                </PopoverContent>
            </Popover>
        );
    };

    const ExamResultsTab = () => {
        const [groupedResults, setGroupedResults] = useState({});
        const [loading, setLoading] = useState(true);
        const [searchTerm, setSearchTerm] = useState('');
        const { toast } = useToast();

        const fetchResults = useCallback(async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('training_participants')
                .select(`
                    id,
                    status,
                    score,
                    completed_at,
                    personnel:personnel_id (full_name),
                    training:training_id!inner(id, title, training_exams!inner(title, passing_score))
                `);

            if (error) {
                toast({
                    variant: 'destructive',
                    title: 'Hata!',
                    description: `Sınav sonuçları getirilirken bir hata oluştu: ${error.message}`,
                });
                 setGroupedResults({});
            } else {
                 const participantsWithExams = data.filter(p => p.training && Array.isArray(p.training.training_exams) && p.training.training_exams.length > 0);
                 
                 const grouped = participantsWithExams.reduce((acc, participant) => {
                    const trainingId = participant.training.id;
                    if (!acc[trainingId]) {
                        acc[trainingId] = {
                            trainingTitle: participant.training.title,
                            participants: []
                        };
                    }
                    acc[trainingId].participants.push(participant);
                    return acc;
                }, {});

                setGroupedResults(grouped);
            }
            setLoading(false);
        }, [toast]);

        useEffect(() => {
            fetchResults();
        }, [fetchResults]);

        const handleSaveScore = async (participantId, score) => {
            const numericScore = parseInt(score, 10);
            if (isNaN(numericScore) || numericScore < 0 || numericScore > 100) {
                toast({ variant: 'destructive', title: 'Geçersiz Not', description: 'Not 0 ile 100 arasında olmalıdır.' });
                return;
            }

            const { error } = await supabase
                .from('training_participants')
                .update({ score: numericScore, status: 'Tamamlandı', completed_at: new Date().toISOString() })
                .eq('id', participantId);

            if (error) {
                toast({ variant: 'destructive', title: 'Hata', description: `Not kaydedilemedi: ${error.message}` });
            } else {
                toast({ title: 'Başarılı', description: 'Not kaydedildi.' });
                fetchResults();
            }
        };

        const filteredGroupedResults = useMemo(() => {
            if (!searchTerm) {
                return groupedResults;
            }
            const lowercasedFilter = searchTerm.toLowerCase();
            const filtered = {};

            Object.keys(groupedResults).forEach(trainingId => {
                const group = groupedResults[trainingId];
                const matchingParticipants = group.participants.filter(p => 
                    p.personnel?.full_name?.toLowerCase().includes(lowercasedFilter) ||
                    p.training?.training_exams[0]?.title?.toLowerCase().includes(lowercasedFilter)
                );
                
                if (group.trainingTitle.toLowerCase().includes(lowercasedFilter) || matchingParticipants.length > 0) {
                    filtered[trainingId] = {
                        ...group,
                        participants: group.trainingTitle.toLowerCase().includes(lowercasedFilter) ? group.participants : matchingParticipants,
                    };
                }
            });

            return filtered;
        }, [groupedResults, searchTerm]);

        const getStatusBadge = (participant) => {
            if(participant.status === 'Tamamlandı') {
                const exam = participant.training?.training_exams[0];
                if (exam && (participant.score !== null && participant.score !== undefined)) {
                    if (participant.score >= exam.passing_score) {
                        return <Badge variant="success">Geçti</Badge>;
                    }
                    return <Badge variant="destructive">Kaldı</Badge>;
                }
            }
            return <Badge variant="outline">{participant.status}</Badge>;
        };

        if (loading) {
            return (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            );
        }

        return (
            <div className="p-4 bg-card rounded-lg shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">Sınav Sonuçları</h2>
                    <div className="search-box w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Eğitim veya katılımcı ara..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="search-input"
                        />
                    </div>
                </div>

                <Accordion type="multiple" className="w-full">
                    {Object.keys(filteredGroupedResults).length > 0 ? (
                        Object.keys(filteredGroupedResults).map(trainingId => {
                             const group = filteredGroupedResults[trainingId];
                             return (
                                <AccordionItem value={trainingId} key={trainingId}>
                                    <AccordionTrigger>
                                        <div className="flex items-center gap-4">
                                            <span className="font-semibold text-lg">{group.trainingTitle}</span>
                                            <Badge variant="secondary">{group.participants.length} Katılımcı</Badge>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="overflow-x-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Katılımcı</TableHead>
                                                        <TableHead>Sınav Adı</TableHead>
                                                        <TableHead>Puan</TableHead>
                                                        <TableHead>Geçme Notu</TableHead>
                                                        <TableHead>Durum</TableHead>
                                                        <TableHead>Tamamlanma Tarihi</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {group.participants.map(result => {
                                                        const exam = result.training?.training_exams[0];
                                                        return (
                                                            <TableRow key={result.id}>
                                                                <TableCell>{result.personnel?.full_name}</TableCell>
                                                                <TableCell>{exam?.title || 'N/A'}</TableCell>
                                                                <TableCell>
                                                                    <ScoreInput participant={result} onSave={handleSaveScore} />
                                                                </TableCell>
                                                                <TableCell>{exam?.passing_score || 'N/A'}</TableCell>
                                                                <TableCell>{getStatusBadge(result)}</TableCell>
                                                                <TableCell>{result.completed_at ? format(new Date(result.completed_at), 'dd.MM.yyyy') : '-'}</TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                             )
                        })
                    ) : (
                        <div className="text-center py-10 text-muted-foreground">
                            Değerlendirilecek sınav bulunamadı veya arama sonucuyla eşleşmedi.
                        </div>
                    )}
                </Accordion>
            </div>
        );
    };

    export default ExamResultsTab;