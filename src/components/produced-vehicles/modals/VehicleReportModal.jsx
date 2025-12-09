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
import { format, subDays, subMonths, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { tr } from 'date-fns/locale';
import { generateVehicleReport } from '@/lib/pdfGenerator';

const VehicleReportModal = ({ isOpen, setIsOpen, vehicles, filters }) => {
    const { toast } = useToast();
    const [selectedStatus, setSelectedStatus] = useState('');
    const [dateFilterType, setDateFilterType] = useState('all'); // 'all', 'preset', 'custom'
    const [datePreset, setDatePreset] = useState('all');
    const [dateFrom, setDateFrom] = useState(null);
    const [dateTo, setDateTo] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [filteredVehicles, setFilteredVehicles] = useState([]);

    // Aralık bazlı durum seçenekleri
    const statusOptions = [
        { value: 'Kalite Kontrolde', label: 'Kalite Kontrolde', eventTypes: ['control_start'], checkEnd: 'control_end' },
        { value: 'Yeniden İşlemde', label: 'Yeniden İşlemde', eventTypes: ['rework_start'], checkEnd: 'rework_end' },
        { value: 'Sevk Bilgisi Bekleniyor', label: 'Sevk Bilgisi Bekleniyor', eventTypes: ['waiting_for_shipping_info'] },
        { value: 'Sevke Hazır', label: 'Sevke Hazır', eventTypes: ['ready_to_ship'] },
        { value: 'Sevk Edildi', label: 'Sevk Edildi', eventTypes: ['shipped'] },
        { value: 'Kaliteye Giriş', label: 'Kaliteye Giriş', eventTypes: ['quality_entry'] },
    ];

    const datePresets = [
        { value: 'all', label: 'Tüm Zamanlar' },
        { value: 'thisMonth', label: 'Bu Ay' },
        { value: 'lastMonth', label: 'Geçen Ay' },
        { value: 'last3Months', label: 'Son 3 Ay' },
        { value: 'last6Months', label: 'Son 6 Ay' },
        { value: 'thisYear', label: 'Bu Yıl' },
        { value: 'custom', label: 'Özel Tarih Aralığı' },
    ];

    const getDateRangeFromPreset = (preset) => {
        const now = new Date();
        switch (preset) {
            case 'all':
                return null;
            case 'thisMonth':
                return { from: startOfMonth(now), to: endOfMonth(now) };
            case 'lastMonth':
                const lastMonth = subMonths(now, 1);
                return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
            case 'last3Months':
                return { from: subMonths(now, 3), to: now };
            case 'last6Months':
                return { from: subMonths(now, 6), to: now };
            case 'thisYear':
                return { from: startOfYear(now), to: endOfYear(now) };
            default:
                return null;
        }
    };

    useEffect(() => {
        if (isOpen) {
            setSelectedStatus('');
            setDateFilterType('all');
            setDatePreset('all');
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

            // Tarih filtresi
            let dateRange = null;
            if (dateFilterType === 'preset' && datePreset !== 'all') {
                dateRange = getDateRangeFromPreset(datePreset);
            } else if (dateFilterType === 'custom' && dateFrom && dateTo) {
                dateRange = { from: dateFrom, to: dateTo };
            }

            if (dateRange) {
                const fromDate = new Date(dateRange.from);
                fromDate.setHours(0, 0, 0, 0);
                const toDate = new Date(dateRange.to);
                toDate.setHours(23, 59, 59, 999);

                filtered = filtered.filter(v => {
                    const createdAt = new Date(v.created_at);
                    return createdAt >= fromDate && createdAt <= toDate;
                });
            }

            // Durum filtresi
            if (selectedStatus) {
                const statusOption = statusOptions.find(opt => opt.value === selectedStatus);
                if (statusOption) {
                    // Timeline eventlerini al
                    const { data: timelineEvents, error } = await supabase
                        .from('vehicle_timeline_events')
                        .select('inspection_id, event_type, event_timestamp')
                        .in('event_type', statusOption.eventTypes)
                        .order('event_timestamp', { ascending: false });

                    if (error) throw error;

                    const vehicleIds = new Set();
                    
                    if (statusOption.checkEnd) {
                        // Aralık kontrolü: Başlangıç var ama bitiş yok
                        timelineEvents.forEach(event => {
                            if (statusOption.eventTypes.includes(event.event_type)) {
                                // Bu araç için bitiş eventi var mı kontrol et
                                const hasEnd = timelineEvents.some(e => 
                                    e.inspection_id === event.inspection_id && 
                                    e.event_type === statusOption.checkEnd &&
                                    new Date(e.event_timestamp) > new Date(event.event_timestamp)
                                );
                                if (!hasEnd) {
                                    vehicleIds.add(event.inspection_id);
                                }
                            }
                        });
                    } else {
                        // Tekil event: Sadece bu evente sahip araçlar
                        timelineEvents.forEach(event => {
                            vehicleIds.add(event.inspection_id);
                        });
                    }

                    filtered = filtered.filter(v => vehicleIds.has(v.id));
                }
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

            for (const vehicle of filteredVehicles) {
                const timeline = timelineByVehicle[vehicle.id] || [];
                const faults = faultsByVehicle[vehicle.id] || [];
                
                generateVehicleReport(vehicle, timeline, faults);
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
                        Durum ve tarih filtrelerini birlikte kullanarak rapor alabilirsiniz.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <div className="space-y-2">
                        <Label>Durum Seçin (Opsiyonel)</Label>
                        <Select value={selectedStatus || 'all'} onValueChange={(value) => setSelectedStatus(value === 'all' ? '' : value)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Durum seçin (boş bırakabilirsiniz)..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tüm Durumlar</SelectItem>
                                {statusOptions.map(option => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Tarih Filtresi</Label>
                        <Select value={dateFilterType} onValueChange={(value) => {
                            setDateFilterType(value);
                            if (value === 'preset') {
                                setDatePreset('all');
                            } else if (value === 'custom') {
                                setDateFrom(null);
                                setDateTo(null);
                            }
                        }}>
                            <SelectTrigger>
                                <SelectValue placeholder="Tarih filtresi seçin..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tüm Zamanlar</SelectItem>
                                <SelectItem value="preset">Hızlı Filtreler</SelectItem>
                                <SelectItem value="custom">Özel Tarih Aralığı</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {dateFilterType === 'preset' && (
                        <div className="space-y-2">
                            <Label>Hızlı Tarih Filtresi</Label>
                            <Select value={datePreset} onValueChange={setDatePreset}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Tarih filtresi seçin..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {datePresets.map(preset => (
                                        <SelectItem key={preset.value} value={preset.value}>
                                            {preset.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {dateFilterType === 'custom' && (
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
                        disabled={isGenerating || (dateFilterType === 'custom' && (!dateFrom || !dateTo))}
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
