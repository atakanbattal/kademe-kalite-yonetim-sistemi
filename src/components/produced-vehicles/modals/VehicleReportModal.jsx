import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { generateVehicleReport } from '@/lib/pdfGenerator';

const VehicleReportModal = ({ isOpen, setIsOpen, vehicles, filters }) => {
    const { toast } = useToast();
    const [reportType, setReportType] = useState('status'); // 'status', 'date', 'all'
    const [selectedStatus, setSelectedStatus] = useState('');
    const [selectedEventType, setSelectedEventType] = useState('');
    const [dateFrom, setDateFrom] = useState(null);
    const [dateTo, setDateTo] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [filteredVehicles, setFilteredVehicles] = useState([]);

    const statusOptions = [
        { value: 'Kaliteye Giriş', label: 'Kaliteye Giriş' },
        { value: 'Kontrol Başladı', label: 'Kontrol Başladı' },
        { value: 'Kontrol Bitti', label: 'Kontrol Bitti' },
        { value: 'Yeniden İşlem Başladı', label: 'Yeniden İşlem Başladı' },
        { value: 'Yeniden İşlem Bitti', label: 'Yeniden İşlem Bitti' },
        { value: 'Sevke Hazır', label: 'Sevke Hazır' },
        { value: 'Sevk Edildi', label: 'Sevk Edildi' }
    ];

    const eventTypeMap = {
        'Kaliteye Giriş': 'quality_entry',
        'Kontrol Başladı': 'control_start',
        'Kontrol Bitti': 'control_end',
        'Yeniden İşlem Başladı': 'rework_start',
        'Yeniden İşlem Bitti': 'rework_end',
        'Sevke Hazır': 'ready_to_ship',
        'Sevk Edildi': 'shipped'
    };

    useEffect(() => {
        if (isOpen) {
            setReportType('status');
            setSelectedStatus('');
            setSelectedEventType('');
            setDateFrom(null);
            setDateTo(null);
            setFilteredVehicles([]);
        }
    }, [isOpen]);

    const filterVehicles = async () => {
        if (!vehicles || vehicles.length === 0) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Filtrelenecek araç bulunamadı.' });
            return;
        }

        setIsGenerating(true);
        try {
            let filtered = [...vehicles];

            if (reportType === 'status' && selectedStatus) {
                const eventType = eventTypeMap[selectedStatus];
                if (eventType) {
                    // Bu duruma sahip araçları bul
                    const { data: timelineEvents, error } = await supabase
                        .from('vehicle_timeline_events')
                        .select('inspection_id, event_timestamp')
                        .eq('event_type', eventType)
                        .order('event_timestamp', { ascending: false });

                    if (error) throw error;

                    const vehicleIds = new Set(timelineEvents.map(e => e.inspection_id));
                    filtered = filtered.filter(v => vehicleIds.has(v.id));
                }
            } else if (reportType === 'date' && dateFrom && dateTo) {
                // Tarih aralığına göre filtrele
                const fromDate = new Date(dateFrom);
                fromDate.setHours(0, 0, 0, 0);
                const toDate = new Date(dateTo);
                toDate.setHours(23, 59, 59, 999);

                filtered = filtered.filter(v => {
                    const createdAt = new Date(v.created_at);
                    return createdAt >= fromDate && createdAt <= toDate;
                });
            } else if (reportType === 'all') {
                // Tüm araçlar
                filtered = vehicles;
            }

            setFilteredVehicles(filtered);
            toast({ title: 'Başarılı', description: `${filtered.length} araç bulundu.` });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Hata', description: `Filtreleme hatası: ${error.message}` });
        } finally {
            setIsGenerating(false);
        }
    };

    const generateReport = async () => {
        if (filteredVehicles.length === 0) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Rapor oluşturmak için önce filtreleme yapın.' });
            return;
        }

        setIsGenerating(true);
        try {
            // Her araç için timeline ve faults verilerini al
            const vehicleIds = filteredVehicles.map(v => v.id);
            
            const [timelineData, faultsData] = await Promise.all([
                supabase
                    .from('vehicle_timeline_events')
                    .select('*')
                    .in('inspection_id', vehicleIds)
                    .order('event_timestamp', { ascending: true }),
                supabase
                    .from('quality_inspection_faults')
                    .select('*, department:production_departments(name), category:fault_categories(name)')
                    .in('inspection_id', vehicleIds)
            ]);

            if (timelineData.error) throw timelineData.error;
            if (faultsData.error) throw faultsData.error;

            // Araç bazında grupla
            const timelineByVehicle = {};
            timelineData.data.forEach(event => {
                if (!timelineByVehicle[event.inspection_id]) {
                    timelineByVehicle[event.inspection_id] = [];
                }
                timelineByVehicle[event.inspection_id].push(event);
            });

            const faultsByVehicle = {};
            faultsData.data.forEach(fault => {
                if (!faultsByVehicle[fault.inspection_id]) {
                    faultsByVehicle[fault.inspection_id] = [];
                }
                faultsByVehicle[fault.inspection_id].push(fault);
            });

            // Her araç için rapor oluştur
            for (const vehicle of filteredVehicles) {
                const timeline = timelineByVehicle[vehicle.id] || [];
                const faults = faultsByVehicle[vehicle.id] || [];
                
                generateVehicleReport(vehicle, timeline, faults);
                
                // Her rapor arasında kısa bir gecikme (tarayıcı pencerelerinin çakışmaması için)
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            toast({ 
                title: 'Başarılı', 
                description: `${filteredVehicles.length} araç için rapor oluşturuldu. Yazdırma pencereleri açılıyor...` 
            });
            setIsOpen(false);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Hata', description: `Rapor oluşturma hatası: ${error.message}` });
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        Araç İşlemleri Raporu
                    </DialogTitle>
                    <DialogDescription>
                        Hangi durumdaki veya tarih aralığındaki araçlar için rapor almak istediğinizi seçin.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <div className="space-y-2">
                        <Label>Rapor Tipi</Label>
                        <Select value={reportType} onValueChange={(value) => {
                            setReportType(value);
                            setSelectedStatus('');
                            setDateFrom(null);
                            setDateTo(null);
                            setFilteredVehicles([]);
                        }}>
                            <SelectTrigger>
                                <SelectValue placeholder="Rapor tipi seçin..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="status">Durum Bazlı</SelectItem>
                                <SelectItem value="date">Tarih Aralığı</SelectItem>
                                <SelectItem value="all">Tüm Araçlar</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {reportType === 'status' && (
                        <div className="space-y-2">
                            <Label>Durum Seçin</Label>
                            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Durum seçin..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {statusOptions.map(option => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {reportType === 'date' && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Başlangıç Tarihi</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="w-full justify-start text-left font-normal"
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {dateFrom ? format(dateFrom, 'dd.MM.yyyy', { locale: tr }) : 'Tarih seçin'}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar
                                            mode="single"
                                            selected={dateFrom}
                                            onSelect={setDateFrom}
                                            locale={tr}
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className="space-y-2">
                                <Label>Bitiş Tarihi</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="w-full justify-start text-left font-normal"
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {dateTo ? format(dateTo, 'dd.MM.yyyy', { locale: tr }) : 'Tarih seçin'}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar
                                            mode="single"
                                            selected={dateTo}
                                            onSelect={setDateTo}
                                            locale={tr}
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>
                    )}

                    {filteredVehicles.length > 0 && (
                        <div className="p-4 bg-muted rounded-md">
                            <p className="text-sm font-medium">
                                {filteredVehicles.length} araç bulundu
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isGenerating}>
                        İptal
                    </Button>
                    <Button 
                        onClick={filterVehicles} 
                        disabled={isGenerating || (reportType === 'status' && !selectedStatus) || (reportType === 'date' && (!dateFrom || !dateTo))}
                        variant="secondary"
                    >
                        {isGenerating ? 'Filtreleniyor...' : 'Filtrele'}
                    </Button>
                    <Button 
                        onClick={generateReport} 
                        disabled={isGenerating || filteredVehicles.length === 0}
                    >
                        {isGenerating ? 'Rapor Oluşturuluyor...' : 'Rapor Al'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default VehicleReportModal;

