import React, { useState, useEffect, useMemo, useCallback } from 'react';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
    import { Button } from '@/components/ui/button';
    import { Badge } from '@/components/ui/badge';
    import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
    import { ScrollArea } from '@/components/ui/scroll-area';
    import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
    import { Skeleton } from '@/components/ui/skeleton';
    import { format, parseISO, differenceInMilliseconds } from 'date-fns';
    import { tr } from 'date-fns/locale';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { formatDuration } from '@/lib/formatDuration.js';
    import { Clock, Wrench, PackageCheck, Ship, Play, CheckCircle, Trash2, FileText } from 'lucide-react';
    import { useAuth } from '@/contexts/SupabaseAuthContext';
    import { generateVehicleReport } from '@/lib/pdfGenerator';

    const eventTypes = {
      quality_entry: { label: 'Kaliteye Giriş', icon: <Play className="h-4 w-4 text-blue-500" /> },
      control_start: { label: 'Kontrol Başladı', icon: <Clock className="h-4 w-4 text-yellow-500" /> },
      control_end: { label: 'Kontrol Bitti', icon: <CheckCircle className="h-4 w-4 text-green-500" /> },
      rework_start: { label: 'Yeniden İşlem Başladı', icon: <Wrench className="h-4 w-4 text-orange-500" /> },
      rework_end: { label: 'Yeniden İşlem Bitti', icon: <Wrench className="h-4 w-4 text-red-500" /> },
      ready_to_ship: { label: 'Sevke Hazır', icon: <PackageCheck className="h-4 w-4 text-purple-500" /> },
      shipped: { label: 'Sevk Edildi', icon: <Ship className="h-4 w-4 text-gray-500" /> },
    };

    const DetailItem = ({ label, value }) => (
        <div className="flex flex-col">
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="font-semibold">{value || '-'}</span>
        </div>
    );

    const TimelineTab = ({ vehicle, onUpdate }) => {
        const { toast } = useToast();
        const { user, profile } = useAuth();
        const [timeline, setTimeline] = useState([]);
        const [loading, setLoading] = useState(true);
        const [isSubmitting, setIsSubmitting] = useState(false);

        const hasSpecialAccess = () => {
            const userEmail = user?.email;
            const userRole = profile?.role;
            const specialQualityEmails = [
              'atakan.battal@kademe.com.tr',
              'yunus.senel@kademe.com.tr',
              'safa.bagci@kademe.com.tr'
            ];
            return userRole === 'admin' || specialQualityEmails.includes(userEmail);
        };
        const canManage = hasSpecialAccess();

        const fetchTimeline = useCallback(async () => {
            if (!vehicle?.id) return;
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('vehicle_timeline_events')
                    .select('*')
                    .eq('inspection_id', vehicle.id)
                    .order('event_timestamp', { ascending: true });
                if (error) throw error;
                setTimeline(data || []);
            } catch (error) {
                toast({ variant: 'destructive', title: 'Hata', description: `Zaman çizelgesi verileri alınamadı: ${error.message}` });
                setTimeline([]);
            } finally {
                setLoading(false);
            }
        }, [vehicle, toast]);

        useEffect(() => {
            if (vehicle?.id) {
                fetchTimeline();
            }
        }, [vehicle, fetchTimeline]);

        const summaryStats = useMemo(() => {
            let totalControlMillis = 0;
            let totalReworkMillis = 0;

            if (timeline.length > 0) {
                for (let i = 0; i < timeline.length; i++) {
                    const currentEvent = timeline[i];
                    if (currentEvent.event_type === 'control_start') {
                        const nextEnd = timeline.slice(i + 1).find(e => e.event_type === 'control_end');
                        if (nextEnd) {
                            totalControlMillis += differenceInMilliseconds(parseISO(nextEnd.event_timestamp), parseISO(currentEvent.event_timestamp));
                        }
                    } else if (currentEvent.event_type === 'rework_start') {
                        const nextEnd = timeline.slice(i + 1).find(e => e.event_type === 'rework_end');
                        if (nextEnd) {
                            totalReworkMillis += differenceInMilliseconds(parseISO(nextEnd.event_timestamp), parseISO(currentEvent.event_timestamp));
                        }
                    }
                }
            }
            
            // Kalitede geçen toplam süre sadece kontrol başladı-bitti arasındaki sürelerdir
            // Yeniden işlem süresi dahil edilmez
            const totalQualityMillis = totalControlMillis;

            return {
                totalControlTime: formatDuration(totalControlMillis),
                totalReworkTime: formatDuration(totalReworkMillis),
                totalQualityTime: formatDuration(totalQualityMillis)
            };
        }, [timeline]);

        const handleDeleteEvent = async (eventId) => {
            if (!window.confirm('Bu işlemi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz ve aracın durumunu etkileyebilir.')) return;
            setIsSubmitting(true);
            try {
                const { error } = await supabase.from('vehicle_timeline_events').delete().eq('id', eventId);
                if (error) throw error;
                toast({ title: 'Başarılı', description: 'İşlem silindi.' });
                setTimeline(prev => prev.filter(event => event.id !== eventId));
                if(onUpdate) onUpdate();
            } catch (error) {
                toast({ variant: 'destructive', title: 'Hata', description: `İşlem silinemedi: ${error.message}` });
            } finally {
                setIsSubmitting(false);
            }
        };

        return (
            <div className="space-y-4">
                <ScrollArea className="h-64 border rounded-md">
                    <Table>
                        <TableHeader className="sticky top-0 bg-secondary">
                            <TableRow>
                                <TableHead>İşlem Tipi</TableHead>
                                <TableHead>Tarih-Saat</TableHead>
                                <TableHead>Notlar</TableHead>
                                {canManage && <TableHead className="w-16 text-right"></TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <TableRow key={i}><TableCell colSpan={canManage ? 4 : 3}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                                ))
                            ) : timeline.length > 0 ? (
                                timeline.map((event) => (
                                    <TableRow key={event.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {eventTypes[event.event_type]?.icon}
                                                <span>{eventTypes[event.event_type]?.label || event.event_type}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>{format(parseISO(event.event_timestamp), 'dd.MM.yyyy HH:mm', { locale: tr })}</TableCell>
                                        <TableCell>{event.notes}</TableCell>
                                        {canManage && (
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => handleDeleteEvent(event.id)} disabled={isSubmitting}>
                                                    <Trash2 className="h-4 w-4 text-red-500" />
                                                </Button>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow><TableCell colSpan={canManage ? 4 : 3} className="text-center h-24">Henüz işlem kaydı yok.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </ScrollArea>
                <div className="p-4 border rounded-lg bg-background">
                    <h4 className="font-semibold mb-3">Özet İstatistikler</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <DetailItem label="Toplam Kontrol Süresi" value={summaryStats.totalControlTime} />
                        <DetailItem label="Toplam Yeniden İşlem Süresi" value={summaryStats.totalReworkTime} />
                        <DetailItem label="Kalitede Geçen Toplam Süre" value={summaryStats.totalQualityTime} />
                    </div>
                </div>
            </div>
        );
    };

    const VehicleDetailModal = ({ isOpen, setIsOpen, vehicle, onUpdate }) => {
        const { toast } = useToast();
        const [faults, setFaults] = useState([]);
        const [timeline, setTimeline] = useState([]);
        const [loadingFaults, setLoadingFaults] = useState(false);

        useEffect(() => {
            const fetchData = async () => {
                if (!vehicle?.id) return;
                setLoadingFaults(true);
                try {
                    // Hataları al (doğru tablo: quality_inspection_faults)
                    const { data: faultsData, error: faultsError } = await supabase
                        .from('quality_inspection_faults')
                        .select(`
                            *,
                            department:production_departments(id, name),
                            category:fault_categories(id, name)
                        `)
                        .eq('inspection_id', vehicle.id)
                        .order('fault_date', { ascending: false });
                    
                    if (faultsError) {
                        console.error('Fault fetch error:', faultsError);
                        throw faultsError;
                    }
                    
                    console.log('✅ Hatalar yüklendi:', faultsData);
                    setFaults(faultsData || []);

                    // Timeline verilerini al
                    const { data: timelineData, error: timelineError } = await supabase
                        .from('vehicle_timeline_events')
                        .select('*')
                        .eq('inspection_id', vehicle.id)
                        .order('event_timestamp', { ascending: true });
                    
                    if (timelineError) {
                        console.error('Timeline fetch error:', timelineError);
                        throw timelineError;
                    }
                    
                    console.log('✅ Timeline yüklendi:', timelineData);
                    setTimeline(timelineData || []);
                } catch (error) {
                    console.error('❌ Veri yükleme hatası:', error);
                    toast({
                        variant: 'destructive',
                        title: 'Hata',
                        description: 'Araç verileri yüklenirken hata oluştu.'
                    });
                } finally {
                    setLoadingFaults(false);
                }
            };

            if (isOpen && vehicle?.id) {
                fetchData();
            }
        }, [isOpen, vehicle?.id, toast]);

        const generateReport = () => {
            if (!vehicle) return;
            
            try {
                generateVehicleReport(vehicle, timeline, faults);
                
                toast({
                    title: 'Rapor Oluşturuluyor',
                    description: 'Yazdırma penceresi açılıyor...'
                });
            } catch (error) {
                console.error('Error generating report:', error);
                toast({
                    variant: 'destructive',
                    title: 'Hata',
                    description: 'Rapor oluşturulurken bir hata oluştu.'
                });
            }
        };

        if (!vehicle) return null;

        return (
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <DialogTitle className="text-2xl">{vehicle.chassis_no}</DialogTitle>
                                <DialogDescription>Araç Detayları ve İşlem Geçmişi</DialogDescription>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={generateReport}
                                className="ml-4"
                            >
                                <FileText className="w-4 h-4 mr-2" />
                                Rapor Al
                            </Button>
                        </div>
                    </DialogHeader>
                    
                    <Tabs defaultValue="details" className="w-full mt-4">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="details">Temel Bilgiler</TabsTrigger>
                            <TabsTrigger value="history">İşlem Geçmişi</TabsTrigger>
                        </TabsList>
                        <TabsContent value="details" className="py-4">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                                <DetailItem label="Şasi Numarası" value={vehicle.chassis_no} />
                                <DetailItem label="Seri Numarası" value={vehicle.serial_no} />
                                <DetailItem label="Araç Tipi" value={vehicle.vehicle_type} />
                                <DetailItem label="Müşteri" value={vehicle.customer_name} />
                                <DetailItem label="Durum" value={<Badge variant="outline">{vehicle.status}</Badge>} />
                                <DetailItem label="DMO Durumu" value={vehicle.dmo_status ? <Badge variant="secondary">{vehicle.dmo_status}</Badge> : '-'} />
                                <DetailItem label="Oluşturulma Tarihi" value={format(parseISO(vehicle.created_at), 'dd.MM.yyyy HH:mm', { locale: tr })} />
                                <DetailItem label="Son Güncelleme" value={format(parseISO(vehicle.updated_at), 'dd.MM.yyyy HH:mm', { locale: tr })} />
                            </div>
                            <div className="mt-6">
                                <h4 className="font-semibold mb-2">Notlar</h4>
                                <p className="text-sm text-muted-foreground p-3 bg-muted rounded-md min-h-[60px]">
                                    {vehicle.notes || 'Bu araç için not bulunmamaktadır.'}
                                </p>
                            </div>
                        </TabsContent>
                        <TabsContent value="history" className="py-4">
                            <TimelineTab vehicle={vehicle} onUpdate={onUpdate} />
                        </TabsContent>
                    </Tabs>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsOpen(false)}>Kapat</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    };

    export default VehicleDetailModal;