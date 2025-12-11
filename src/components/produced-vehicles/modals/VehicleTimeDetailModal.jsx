import React, { useState, useEffect, useMemo, useCallback } from 'react';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
    import { Button } from '@/components/ui/button';
    import { ScrollArea } from '@/components/ui/scroll-area';
    import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
    import { PlusCircle, Trash2, Clock, Wrench, PackageCheck, Ship, Play, CheckCircle } from 'lucide-react';
    import { format, parseISO, differenceInMilliseconds } from 'date-fns';
    import { tr } from 'date-fns/locale';
    import { formatDuration } from '@/lib/formatDuration.js';
    import { useAuth } from '@/contexts/SupabaseAuthContext';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
    import { Input } from "@/components/ui/input";
    import { Label } from "@/components/ui/label";
    import { Skeleton } from '@/components/ui/skeleton';

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

    const formatToLocalDateTime = (date) => {
        if (!date) return '';
        try {
            const d = new Date(date);
            d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
            return d.toISOString().slice(0, 16);
        } catch (e) {
            return '';
        }
    };

    const AddEventForm = ({ onAddEvent, onCancel, isSubmitting }) => {
        const [eventType, setEventType] = useState('');
        const [eventTimestamp, setEventTimestamp] = useState(formatToLocalDateTime(new Date()));
        const [notes, setNotes] = useState('');

        const handleSubmit = () => {
            if (!eventType || !eventTimestamp) {
                alert('Lütfen işlem tipi ve tarih seçin.');
                return;
            }
            onAddEvent({ event_type: eventType, event_timestamp: new Date(eventTimestamp).toISOString(), notes });
        };

        return (
            <div className="p-4 border rounded-md bg-muted/50 space-y-4">
                <h4 className="font-semibold">Yeni İşlem Ekle</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="event-type">İşlem Tipi</Label>
                        <Select value={eventType} onValueChange={setEventType}>
                            <SelectTrigger id="event-type">
                                <SelectValue placeholder="İşlem tipi seçin..." />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(eventTypes).map(([key, { label }]) => (
                                    <SelectItem key={key} value={key}>{label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="event-timestamp">Tarih ve Saat</Label>
                        <Input id="event-timestamp" type="datetime-local" value={eventTimestamp} onChange={e => setEventTimestamp(e.target.value)} />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="event-notes">Not (Opsiyonel)</Label>
                    <Input id="event-notes" placeholder="İşlemle ilgili not..." value={notes} onChange={e => setNotes(e.target.value)} />
                </div>
                <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={onCancel} disabled={isSubmitting}>İptal</Button>
                    <Button size="sm" onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? 'Ekleniyor...' : 'Ekle'}
                    </Button>
                </div>
            </div>
        );
    };


    const VehicleTimeDetailModal = ({ isOpen, setIsOpen, vehicle, onUpdate }) => {
        const { toast } = useToast();
        const { user, profile } = useAuth();
        const [timeline, setTimeline] = useState([]);
        const [loading, setLoading] = useState(true);
        const [isAdding, setIsAdding] = useState(false);
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
                    .select('*, inspection:quality_inspections(*)')
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
            if (isOpen && vehicle?.id) {
                fetchTimeline();
            }
        }, [isOpen, vehicle, fetchTimeline]);
        
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
                            totalControlMillis += differenceInMilliseconds(waitingForShippingStart, currentEventTime);
                        } else {
                            totalControlMillis += differenceInMilliseconds(new Date(), currentEventTime);
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
                        } else {
                            totalReworkMillis += differenceInMilliseconds(new Date(), currentEventTime);
                        }
                    }
                }
            }
            
            const totalQualityMillis = totalControlMillis + totalReworkMillis;

            return {
                totalControlTime: formatDuration(totalControlMillis),
                totalReworkTime: formatDuration(totalReworkMillis),
                totalQualityTime: formatDuration(totalQualityMillis)
            };
        }, [timeline]);

        const handleAddEvent = async (newEvent) => {
            if (!profile) {
                toast({ variant: 'destructive', title: 'Hata', description: 'Kullanıcı profili bulunamadı.' });
                return;
            }
            setIsSubmitting(true);
            try {
                const { data: insertedData, error } = await supabase.from('vehicle_timeline_events').insert({
                    ...newEvent,
                    inspection_id: vehicle.id,
                    user_id: profile.id,
                }).select().single();

                if (error) throw error;
                
                toast({ title: 'Başarılı', description: 'Yeni işlem eklendi.' });
                setTimeline(prev => [...prev, insertedData].sort((a, b) => new Date(a.event_timestamp) - new Date(b.event_timestamp)));
                setIsAdding(false);
                if(onUpdate) onUpdate();
            } catch (error) {
                toast({ variant: 'destructive', title: 'Hata', description: `İşlem eklenemedi: ${error.message}` });
            } finally {
                setIsSubmitting(false);
            }
        };

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
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="text-2xl">{vehicle?.chassis_no} - Araç İşlem Geçmişi</DialogTitle>
                        <DialogDescription>Aracın kalite sürecindeki tüm adımlarını yönetin ve görüntüleyin.</DialogDescription>
                    </DialogHeader>

                    <div className="flex-grow py-4 space-y-6 overflow-y-auto">
                        {canManage && !isAdding && (
                            <Button onClick={() => setIsAdding(true)} size="sm" disabled={isSubmitting}>
                                <PlusCircle className="w-4 h-4 mr-2" /> Yeni İşlem Ekle
                            </Button>
                        )}
                        {isAdding && (
                            <AddEventForm onAddEvent={handleAddEvent} onCancel={() => setIsAdding(false)} isSubmitting={isSubmitting} />
                        )}

                        <ScrollArea className="h-[35vh] border rounded-md">
                            <Table>
                                <TableHeader className="sticky top-0 bg-secondary">
                                    <TableRow>
                                        <TableHead className="w-16">#</TableHead>
                                        <TableHead>İşlem Tipi</TableHead>
                                        <TableHead>Tarih-Saat</TableHead>
                                        <TableHead>Notlar</TableHead>
                                        <TableHead className="w-16 text-right"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        Array.from({ length: 3 }).map((_, i) => (
                                            <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                                        ))
                                    ) : timeline.length > 0 ? (
                                        timeline.map((event, index) => (
                                            <TableRow key={event.id}>
                                                <TableCell className="font-medium">{index + 1}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        {eventTypes[event.event_type]?.icon}
                                                        <span>{eventTypes[event.event_type]?.label || event.event_type}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>{format(parseISO(event.event_timestamp), 'dd.MM.yyyy HH:mm', { locale: tr })}</TableCell>
                                                <TableCell>{event.notes}</TableCell>
                                                <TableCell className="text-right">
                                                    {canManage && (
                                                        <Button variant="ghost" size="icon" onClick={() => handleDeleteEvent(event.id)} disabled={isSubmitting}>
                                                            <Trash2 className="h-4 w-4 text-red-500" />
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow><TableCell colSpan={5} className="text-center h-24">Henüz işlem kaydı yok.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </ScrollArea>

                         <div className="p-4 border rounded-lg bg-background">
                            <h4 className="font-semibold mb-3">Özet İstatistikler</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                <div className="flex flex-col">
                                    <span className="text-muted-foreground">Toplam Kontrol Süresi</span>
                                    <span className="font-bold text-lg">{summaryStats.totalControlTime}</span>
                                </div>
                                 <div className="flex flex-col">
                                    <span className="text-muted-foreground">Toplam Yeniden İşlem Süresi</span>
                                    <span className="font-bold text-lg">{summaryStats.totalReworkTime}</span>
                                </div>
                                 <div className="flex flex-col">
                                    <span className="text-muted-foreground">Kalitede Geçen Toplam Süre</span>
                                    <span className="font-bold text-lg">{summaryStats.totalQualityTime}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="mt-auto pt-4 border-t">
                        <Button variant="outline" onClick={() => setIsOpen(false)}>Kapat</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    };

    export default VehicleTimeDetailModal;