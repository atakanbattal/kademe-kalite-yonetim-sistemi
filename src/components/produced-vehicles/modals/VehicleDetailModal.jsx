import React, { useState, useEffect, useMemo, useCallback } from 'react';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
    import { Button } from '@/components/ui/button';
    import { Badge } from '@/components/ui/badge';
    import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
    import { ScrollArea } from '@/components/ui/scroll-area';
    import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
    import { Skeleton } from '@/components/ui/skeleton';
    import { Card, CardContent } from '@/components/ui/card';
    import { Separator } from '@/components/ui/separator';
    import { InfoCard } from '@/components/ui/InfoCard';
    import { format, parseISO, differenceInMilliseconds } from 'date-fns';
    import { tr } from 'date-fns/locale';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { formatDuration } from '@/lib/formatDuration.js';
    import { Clock, Wrench, PackageCheck, Ship, Play, CheckCircle, Trash2, FileText, Car, Hash, Calendar, User, Building2, Tag, AlertTriangle } from 'lucide-react';
    import { differenceInDays } from 'date-fns';
    import { useAuth } from '@/contexts/SupabaseAuthContext';
    import { generateVehicleReport } from '@/lib/pdfGenerator';

    const eventTypes = {
      quality_entry: { label: 'Kaliteye Giriş', icon: <Play className="h-4 w-4 text-blue-500" /> },
      control_start: { label: 'Kontrol Başladı', icon: <Clock className="h-4 w-4 text-yellow-500" /> },
      control_end: { label: 'Kontrol Bitti', icon: <CheckCircle className="h-4 w-4 text-green-500" /> },
      rework_start: { label: 'Yeniden İşlem Başladı', icon: <Wrench className="h-4 w-4 text-orange-500" /> },
      rework_end: { label: 'Yeniden İşlem Bitti', icon: <Wrench className="h-4 w-4 text-red-500" /> },
      waiting_for_shipping_info: { label: 'Sevk Bilgisi Bekleniyor', icon: <Clock className="h-4 w-4 text-orange-500" /> },
      ready_to_ship: { label: 'Sevke Hazır', icon: <PackageCheck className="h-4 w-4 text-purple-500" /> },
      shipped: { label: 'Sevk Edildi', icon: <Ship className="h-4 w-4 text-gray-500" /> },
    };

    const TimelineTab = ({ vehicle, onUpdate }) => {
        const { toast } = useToast();
        const { user, profile } = useAuth();
        const [timeline, setTimeline] = useState([]);
        const [loading, setLoading] = useState(true);
        const [isSubmitting, setIsSubmitting] = useState(false);

        const hasSpecialAccess = () => {
            const userEmail = user?.email?.toLowerCase();
            const userRole = profile?.role;
            const specialQualityEmails = [
              'atakan.battal@kademe.com.tr',
              'yunus.senel@kademe.com.tr',
              'safa.bagci@kademe.com.tr',
              'ramazan.boztilki@kademe.com.tr'
            ].map(email => email.toLowerCase());
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
            let waitingForShippingStart = null;

            if (timeline.length > 0) {
                // "Sevk Bilgisi Bekleniyor" durumunun başlangıcını bul
                const waitingEvent = timeline.find(e => e.event_type === 'waiting_for_shipping_info');
                if (waitingEvent) {
                    waitingForShippingStart = parseISO(waitingEvent.event_timestamp);
                }

                for (let i = 0; i < timeline.length; i++) {
                    const currentEvent = timeline[i];
                    const currentEventTime = parseISO(currentEvent.event_timestamp);
                    
                    // "Sevk Bilgisi Bekleniyor" durumundan sonraki süreleri sayma
                    if (waitingForShippingStart && currentEventTime >= waitingForShippingStart) {
                        continue;
                    }

                    if (currentEvent.event_type === 'control_start') {
                        const nextEnd = timeline.slice(i + 1).find(e => {
                            const endTime = parseISO(e.event_timestamp);
                            // Eğer bitiş "Sevk Bilgisi Bekleniyor" durumundan sonraysa, o ana kadar say
                            if (waitingForShippingStart && endTime >= waitingForShippingStart) {
                                return false;
                            }
                            return e.event_type === 'control_end';
                        });
                        if (nextEnd) {
                            const endTime = waitingForShippingStart && parseISO(nextEnd.event_timestamp) > waitingForShippingStart 
                                ? waitingForShippingStart 
                                : parseISO(nextEnd.event_timestamp);
                            totalControlMillis += differenceInMilliseconds(endTime, currentEventTime);
                        } else if (waitingForShippingStart) {
                            // Bitiş yok ama "Sevk Bilgisi Bekleniyor" durumu var, o ana kadar say
                            totalControlMillis += differenceInMilliseconds(waitingForShippingStart, currentEventTime);
                        }
                    } else if (currentEvent.event_type === 'rework_start') {
                        const nextEnd = timeline.slice(i + 1).find(e => {
                            const endTime = parseISO(e.event_timestamp);
                            if (waitingForShippingStart && endTime >= waitingForShippingStart) {
                                return false;
                            }
                            return e.event_type === 'rework_end';
                        });
                        if (nextEnd) {
                            const endTime = waitingForShippingStart && parseISO(nextEnd.event_timestamp) > waitingForShippingStart 
                                ? waitingForShippingStart 
                                : parseISO(nextEnd.event_timestamp);
                            totalReworkMillis += differenceInMilliseconds(endTime, currentEventTime);
                        } else if (waitingForShippingStart) {
                            totalReworkMillis += differenceInMilliseconds(waitingForShippingStart, currentEventTime);
                        }
                    }
                }
            }
            
            // Kalitede geçen toplam süre sadece kontrol başladı-bitti arasındaki sürelerdir
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
                <Card>
                    <CardContent className="p-6">
                        <h4 className="font-semibold mb-4 flex items-center gap-2">
                            <Clock className="h-5 w-5 text-primary" />
                            Özet İstatistikler
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <InfoCard icon={Clock} label="Toplam Kontrol Süresi" value={summaryStats.totalControlTime} variant="info" />
                            <InfoCard icon={Wrench} label="Toplam Yeniden İşlem Süresi" value={summaryStats.totalReworkTime} variant="warning" />
                            <InfoCard icon={CheckCircle} label="Kalitede Geçen Toplam Süre" value={summaryStats.totalQualityTime} variant="success" />
                        </div>
                    </CardContent>
                </Card>
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
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                    <DialogHeader className="flex-shrink-0">
                        <div className="flex items-center justify-between">
                            <div>
                                <DialogTitle className="text-2xl font-bold text-primary flex items-center gap-2">
                                    <Car className="h-6 w-6" />
                                    Üretilen Araç Detayı
                                </DialogTitle>
                                <DialogDescription className="mt-2">
                                    Araç kaydına ait tüm bilgiler aşağıda listelenmiştir.
                                </DialogDescription>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={generateReport}
                            >
                                <FileText className="w-4 h-4 mr-2" />
                                Rapor Al
                            </Button>
                        </div>
                    </DialogHeader>
                    
                    <ScrollArea className="flex-1 min-h-0 pr-4 -mr-4 mt-4">
                        <Tabs defaultValue="details" className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="details">Temel Bilgiler</TabsTrigger>
                                <TabsTrigger value="history">İşlem Geçmişi</TabsTrigger>
                            </TabsList>
                            <TabsContent value="details" className="space-y-6 mt-6">
                                {/* Önemli Bilgiler */}
                                <div>
                                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                        <Car className="h-5 w-5 text-primary" />
                                        Önemli Bilgiler
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <InfoCard 
                                            icon={Hash} 
                                            label="Şasi Numarası" 
                                            value={vehicle.chassis_no} 
                                            variant="primary"
                                        />
                                        <InfoCard 
                                            icon={Hash} 
                                            label="Seri Numarası" 
                                            value={vehicle.serial_no} 
                                        />
                                        <InfoCard 
                                            icon={Car} 
                                            label="Araç Tipi" 
                                            value={vehicle.vehicle_type} 
                                            variant="warning"
                                        />
                                    </div>
                                </div>

                                <Separator />

                                {/* Genel Bilgiler */}
                                <div>
                                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                        <FileText className="h-5 w-5 text-primary" />
                                        Genel Bilgiler
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <InfoCard icon={User} label="Müşteri" value={vehicle.customer_name} />
                                        <InfoCard 
                                            icon={CheckCircle} 
                                            label="Durum" 
                                            value={vehicle.status}
                                            variant={vehicle.status === 'Sevk Edildi' ? 'success' : 'default'}
                                        />
                                        {vehicle.vehicle_brand && (
                                            <InfoCard 
                                                icon={Tag} 
                                                label="Marka" 
                                                value={vehicle.vehicle_brand}
                                                variant="primary"
                                            />
                                        )}
                                        {vehicle.dmo_status && (
                                            <InfoCard 
                                                icon={Building2} 
                                                label="DMO Durumu" 
                                                value={vehicle.dmo_status}
                                                variant="info"
                                            />
                                        )}
                                        <InfoCard 
                                            icon={Calendar} 
                                            label="Oluşturulma Tarihi" 
                                            value={format(parseISO(vehicle.created_at), 'dd.MM.yyyy HH:mm', { locale: tr })} 
                                        />
                                        <InfoCard 
                                            icon={Calendar} 
                                            label="Son Güncelleme" 
                                            value={format(parseISO(vehicle.updated_at), 'dd.MM.yyyy HH:mm', { locale: tr })} 
                                        />
                                        {vehicle.delivery_due_date && (
                                            <>
                                                <InfoCard 
                                                    icon={Calendar} 
                                                    label="Termin Tarihi" 
                                                    value={format(parseISO(vehicle.delivery_due_date), 'dd.MM.yyyy', { locale: tr })}
                                                    variant="warning"
                                                />
                                                <InfoCard 
                                                    icon={vehicle.status !== 'Sevk Edildi' && differenceInDays(parseISO(vehicle.delivery_due_date), new Date()) < 0 ? AlertTriangle : Clock} 
                                                    label="Sevke Kalan Gün" 
                                                    value={
                                                        vehicle.status === 'Sevk Edildi' 
                                                            ? 'Sevk Edildi' 
                                                            : differenceInDays(parseISO(vehicle.delivery_due_date), new Date()) < 0 
                                                                ? `${Math.abs(differenceInDays(parseISO(vehicle.delivery_due_date), new Date()))} gün geçti!`
                                                                : `${differenceInDays(parseISO(vehicle.delivery_due_date), new Date())} gün`
                                                    }
                                                    variant={
                                                        vehicle.status === 'Sevk Edildi' 
                                                            ? 'success' 
                                                            : differenceInDays(parseISO(vehicle.delivery_due_date), new Date()) < 0 
                                                                ? 'danger'
                                                                : differenceInDays(parseISO(vehicle.delivery_due_date), new Date()) <= 3
                                                                    ? 'warning'
                                                                    : 'info'
                                                    }
                                                />
                                            </>
                                        )}
                                    </div>
                                </div>

                                <Separator />

                                {/* Notlar */}
                                <div>
                                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                        <FileText className="h-5 w-5 text-primary" />
                                        Notlar
                                    </h3>
                                    <Card>
                                        <CardContent className="p-6">
                                            {vehicle.notes ? (
                                                <p className="text-sm leading-relaxed whitespace-pre-wrap">{vehicle.notes}</p>
                                            ) : (
                                                <p className="text-sm text-muted-foreground italic">Bu araç için henüz not eklenmemiş.</p>
                                            )}
                                        </CardContent>
                                    </Card>
                                </div>
                            </TabsContent>
                            <TabsContent value="history" className="mt-6">
                                <TimelineTab vehicle={vehicle} onUpdate={onUpdate} />
                            </TabsContent>
                        </Tabs>
                    </ScrollArea>

                    <DialogFooter className="flex-shrink-0 mt-4 pt-4 border-t">
                        <DialogClose asChild>
                            <Button type="button" variant="secondary" size="lg">Kapat</Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    };

    export default VehicleDetailModal;