import React, { useState, useEffect, useMemo, useCallback } from 'react';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
    import { Badge } from '@/components/ui/badge';
    import { Input } from '@/components/ui/input';
    import { Loader2, Search } from 'lucide-react';
    import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
    import { Button } from '@/components/ui/button';
    import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

    const AttendanceStatusSelector = ({ participant, onUpdate }) => {
        const statuses = ['Katıldı', 'Katılmadı', 'Mazeretli', 'Kayıtlı'];
        
        const getStatusBadge = (status) => {
            switch (status) {
                case 'Katıldı': return <Badge variant="success">Katıldı</Badge>;
                case 'Katılmadı': return <Badge variant="destructive">Katılmadı</Badge>;
                case 'Mazeretli': return <Badge variant="warning">Mazeretli</Badge>;
                case 'Kayıtlı': return <Badge variant="outline">Kayıtlı</Badge>;
                case 'Tamamlandı': return <Badge variant="default">Tamamlandı</Badge>;
                default: return <Badge variant="secondary">{status}</Badge>;
            }
        };

        return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="p-0 h-auto">{getStatusBadge(participant.status)}</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    {statuses.map(status => (
                        <DropdownMenuItem key={status} onSelect={() => onUpdate(participant.id, status)}>
                            {status}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        );
    };

    const AttendanceTab = () => {
        const [groupedParticipants, setGroupedParticipants] = useState({});
        const [loading, setLoading] = useState(true);
        const [searchTerm, setSearchTerm] = useState('');
        const { toast } = useToast();

        const fetchData = useCallback(async () => {
            setLoading(true);
            const { data: participantsData, error: participantsError } = await supabase
                .from('training_participants')
                .select(`
                    id,
                    status,
                    personnel:personnel_id (full_name),
                    training:training_id (id, title, scheduled_date)
                `);

            if (participantsError) {
                toast({
                    variant: 'destructive',
                    title: 'Hata!',
                    description: `Veriler getirilirken bir hata oluştu: ${participantsError.message}`,
                });
                setGroupedParticipants({});
            } else {
                 const grouped = participantsData.reduce((acc, participant) => {
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
                setGroupedParticipants(grouped);
            }
            setLoading(false);
        }, [toast]);

        useEffect(() => {
            fetchData();
        }, [fetchData]);

        const handleUpdateStatus = async (participantId, status) => {
            const { error } = await supabase.from('training_participants').update({ status }).eq('id', participantId);
            if (error) {
                toast({ variant: 'destructive', title: 'Hata', description: 'Durum güncellenemedi.' });
            } else {
                toast({ title: 'Başarılı', description: 'Katılım durumu güncellendi.' });
                fetchData();
            }
        };

        const filteredGroupedParticipants = useMemo(() => {
            if (!searchTerm) {
                return groupedParticipants;
            }
            const lowercasedFilter = searchTerm.toLowerCase();
            const filtered = {};

            Object.keys(groupedParticipants).forEach(trainingId => {
                const group = groupedParticipants[trainingId];
                const matchingParticipants = group.participants.filter(p => 
                    p.personnel?.full_name?.toLowerCase().includes(lowercasedFilter)
                );
                
                if (group.trainingTitle.toLowerCase().includes(lowercasedFilter) || matchingParticipants.length > 0) {
                    filtered[trainingId] = {
                        ...group,
                        participants: group.trainingTitle.toLowerCase().includes(lowercasedFilter) ? group.participants : matchingParticipants,
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
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">Katılım Takibi</h2>
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
                    {Object.keys(filteredGroupedParticipants).length > 0 ? (
                        Object.keys(filteredGroupedParticipants).map(trainingId => {
                             const group = filteredGroupedParticipants[trainingId];
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
                                                        <TableHead>Katılım Durumu</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {group.participants.map(p => (
                                                        <TableRow key={p.id}>
                                                            <TableCell>{p.personnel?.full_name}</TableCell>
                                                            <TableCell>
                                                                <AttendanceStatusSelector participant={p} onUpdate={handleUpdateStatus} />
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
                            Kayıt bulunamadı veya arama sonucuyla eşleşmedi.
                        </div>
                    )}
                </Accordion>
            </div>
        );
    };

    export default AttendanceTab;