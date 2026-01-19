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
import { generateVehicleSummaryReport } from '@/lib/pdfGenerator';
import { imageUrlToBase64, logoCache, preloadLogos, getLogoUrl } from '@/lib/reportUtils';

const VehicleReportModal = ({ isOpen, setIsOpen, vehicles, filters }) => {
    const { toast } = useToast();
    const [selectedStatus, setSelectedStatus] = useState('all');
    const [dateFilterType, setDateFilterType] = useState('all'); // 'all', 'preset', 'custom'
    const [datePreset, setDatePreset] = useState('all');
    const [dateFrom, setDateFrom] = useState(null);
    const [dateTo, setDateTo] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [filteredVehicles, setFilteredVehicles] = useState([]);

    // Mevcut durum seçenekleri (quality_inspections tablosundaki status field'ına göre)
    const statusOptions = [
        { value: 'Kaliteye Girdi', label: 'Kaliteye Girdi' },
        { value: 'Kontrol Başladı', label: 'Kontrol Başladı' },
        { value: 'Kontrol Bitti', label: 'Kontrol Bitti' },
        { value: 'Yeniden İşlemde', label: 'Yeniden İşlemde' },
        { value: 'Yeniden İşlem Bitti', label: 'Yeniden İşlem Bitti' },
        { value: 'Sevk Bilgisi Bekleniyor', label: 'Sevk Bilgisi Bekleniyor' },
        { value: 'Sevk Hazır', label: 'Sevk Hazır' },
        { value: 'Sevk Edildi', label: 'Sevk Edildi' },
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
            setSelectedStatus('all');
            setDateFilterType('all');
            setDatePreset('all');
            setDateFrom(null);
            setDateTo(null);
            setFilteredVehicles([]);
        }
    }, [isOpen]);

    const filterVehicles = async () => {
        setIsGenerating(true);
        try {
            // Supabase'den tüm araçları çek (pagination ile)
            let allVehicles = [];
            let from = 0;
            const pageSize = 1000;
            let hasMore = true;

            while (hasMore) {
                let query = supabase
                    .from('quality_inspections')
                    .select('*')
                    .range(from, from + pageSize - 1)
                    .order('created_at', { ascending: false });

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
                    query = query
                        .gte('created_at', fromDate.toISOString())
                        .lte('created_at', toDate.toISOString());
                }

                const { data, error } = await query;
                if (error) throw error;

                if (data && data.length > 0) {
                    allVehicles = [...allVehicles, ...data];
                    from += pageSize;
                    hasMore = data.length === pageSize;
                } else {
                    hasMore = false;
                }
            }

            // Durum filtresi uygula - mevcut status field'ına göre
            if (selectedStatus && selectedStatus !== 'all') {
                allVehicles = allVehicles.filter(v => v.status === selectedStatus);
            }

            setFilteredVehicles(allVehicles);
            toast({ title: 'Başarılı', description: `${allVehicles.length} araç bulundu.` });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Hata', description: `Filtreleme hatası: ${error.message}` });
        } finally {
            setIsGenerating(false);
        }
    };

    // Supabase 1000 kayıt limiti için paginated fetch
    const fetchAllPagesWithFilter = async (tableName, selectQuery, filterColumn, filterValues, orderColumn = null) => {
        let allData = [];
        const pageSize = 1000;
        let from = 0;
        let hasMore = true;
        
        while (hasMore) {
            let query = supabase
                .from(tableName)
                .select(selectQuery)
                .in(filterColumn, filterValues)
                .range(from, from + pageSize - 1);
            
            if (orderColumn) {
                query = query.order(orderColumn, { ascending: true });
            }
            
            const { data, error } = await query;
            
            if (error) throw error;
            
            if (data && data.length > 0) {
                allData = [...allData, ...data];
                from += pageSize;
                hasMore = data.length === pageSize;
            } else {
                hasMore = false;
            }
        }
        
        return allData;
    };

    const generateReport = async () => {
        if (filteredVehicles.length === 0) {
            toast({ variant: 'destructive', title: 'Hata', description: 'Rapor oluşturmak için önce filtreleme yapın.' });
            return;
        }

        setIsGenerating(true);
        try {
            // Logoları önceden yükle (cache'de yoksa)
            await preloadLogos();
            
            // Logo'yu base64'e çevir (cache'de yoksa) - önce yerel dosyadan çek (logo.png)
            const localLogoUrl = getLogoUrl('logo.png');
            const logoUrl = logoCache[localLogoUrl] 
                ? localLogoUrl
                : (logoCache[getLogoUrl('kademe-logo.png')] 
                    ? getLogoUrl('kademe-logo.png')
                    : 'https://horizons-cdn.hostinger.com/9e8dec00-2b85-4a8b-aa20-e0ad1becf709/74ae5781fdd1b81b90f4a685fee41c72.png');
            await imageUrlToBase64(logoUrl);
            
            const vehicleIds = filteredVehicles.map(v => v.id);
            
            // Paginated fetch ile tüm verileri çek
            const [timelineDataArr, faultsDataArr] = await Promise.all([
                fetchAllPagesWithFilter('vehicle_timeline_events', '*', 'inspection_id', vehicleIds, 'event_timestamp'),
                fetchAllPagesWithFilter('quality_inspection_faults', '*, department:production_departments(name), category:fault_categories(name)', 'inspection_id', vehicleIds)
            ]);

            console.log('🔍 VehicleReportModal - Toplam hata kaydı:', faultsDataArr.length);
            
            const timelineData = { data: timelineDataArr, error: null };
            const faultsData = { data: faultsDataArr, error: null };

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

            // Tek bir özet rapor oluştur
            await generateVehicleSummaryReport(filteredVehicles, timelineByVehicle, faultsByVehicle);

            toast({ 
                title: 'Başarılı', 
                description: `${filteredVehicles.length} araç için özet rapor oluşturuldu. Yazdırma penceresi açılıyor...` 
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
