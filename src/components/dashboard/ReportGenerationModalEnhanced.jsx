import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FileDown, Loader2, CalendarIcon, FileText, FileSpreadsheet } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const ReportGenerationModalEnhanced = ({ isOpen, setIsOpen }) => {
    const [reportType, setReportType] = useState('executive'); // 'executive', 'detailed'
    const [format, setFormat] = useState('pdf'); // 'pdf', 'xls'
    const [period, setPeriod] = useState('custom'); // 'last3months', 'last6months', 'last12months', 'thisYear', 'custom'
    const [dateFrom, setDateFrom] = useState(null);
    const [dateTo, setDateTo] = useState(null);
    const [selectedModules, setSelectedModules] = useState({
        kpi: true,
        df: true,
        cost: true,
        quarantine: true,
        supplier: true,
        trends: true
    });
    const [isGenerating, setIsGenerating] = useState(false);

    const handleModuleToggle = (module) => {
        setSelectedModules(prev => ({
            ...prev,
            [module]: !prev[module]
        }));
    };

    const handleGenerateReport = () => {
        setIsGenerating(true);
        
        // Parametreleri hazırla
        const params = new URLSearchParams();
        params.append('type', reportType);
        params.append('format', format);
        params.append('period', period);
        
        if (period === 'custom' && dateFrom && dateTo) {
            params.append('from', format(dateFrom, 'yyyy-MM-dd'));
            params.append('to', format(dateTo, 'yyyy-MM-dd'));
        }
        
        // Seçili modülleri ekle
        Object.entries(selectedModules).forEach(([module, selected]) => {
            if (selected) {
                params.append('modules', module);
            }
        });

        // Rapor URL'i
        const reportUrl = `/print/dashboard-report?${params.toString()}`;
        window.open(reportUrl, '_blank');
        
        setTimeout(() => {
            setIsGenerating(false);
            setIsOpen(false);
        }, 1000);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
                <DialogHeader>
                    <DialogTitle>Özelleştirilmiş Rapor Oluştur</DialogTitle>
                    <DialogDescription>
                        Dinamik filtreleme, tarih aralığı ve rapor şablonu seçimi ile profesyonel raporlar oluşturun.
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="settings" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="settings">Rapor Ayarları</TabsTrigger>
                        <TabsTrigger value="modules">Modül Seçimi</TabsTrigger>
                    </TabsList>

                    <TabsContent value="settings" className="space-y-4">
                        {/* Rapor Tipi */}
                        <div>
                            <Label>Rapor Tipi</Label>
                            <Select value={reportType} onValueChange={setReportType}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="executive">
                                        <div className="flex items-center gap-2">
                                            <FileText className="h-4 w-4" />
                                            Üst Yönetim Raporu (Özet)
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="detailed">
                                        <div className="flex items-center gap-2">
                                            <FileText className="h-4 w-4" />
                                            Detay Rapor
                                        </div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Format */}
                        <div>
                            <Label>Rapor Formatı</Label>
                            <Select value={format} onValueChange={setFormat}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="pdf">
                                        <div className="flex items-center gap-2">
                                            <FileText className="h-4 w-4" />
                                            PDF
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="xls">
                                        <div className="flex items-center gap-2">
                                            <FileSpreadsheet className="h-4 w-4" />
                                            Excel (XLS)
                                        </div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Tarih Aralığı */}
                        <div>
                            <Label>Tarih Aralığı</Label>
                            <Select value={period} onValueChange={setPeriod}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="last3months">Son 3 Ay</SelectItem>
                                    <SelectItem value="last6months">Son 6 Ay</SelectItem>
                                    <SelectItem value="last12months">Son 12 Ay</SelectItem>
                                    <SelectItem value="thisYear">Bu Yıl</SelectItem>
                                    <SelectItem value="custom">Özel Tarih Aralığı</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Özel Tarih Seçimi */}
                        {period === 'custom' && (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Başlangıç Tarihi</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className={cn(
                                                    "w-full justify-start text-left font-normal",
                                                    !dateFrom && "text-muted-foreground"
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {dateFrom ? format(dateFrom, 'dd MMM yyyy', { locale: tr }) : 'Tarih seçin'}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <Calendar
                                                selected={dateFrom}
                                                onSelect={setDateFrom}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div>
                                    <Label>Bitiş Tarihi</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className={cn(
                                                    "w-full justify-start text-left font-normal",
                                                    !dateTo && "text-muted-foreground"
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {dateTo ? format(dateTo, 'dd MMM yyyy', { locale: tr }) : 'Tarih seçin'}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <Calendar
                                                selected={dateTo}
                                                onSelect={setDateTo}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="modules" className="space-y-4">
                        <div>
                            <Label>Rapora Dahil Edilecek Modüller</Label>
                            <div className="grid grid-cols-2 gap-3 mt-2">
                                {Object.entries({
                                    kpi: 'KPI Verileri',
                                    df: 'DF/8D Analizi',
                                    cost: 'Kalite Maliyetleri',
                                    quarantine: 'Karantina Kayıtları',
                                    supplier: 'Tedarikçi Performansı',
                                    trends: 'Trend Analizleri'
                                }).map(([key, label]) => (
                                    <div key={key} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={key}
                                            checked={selectedModules[key]}
                                            onCheckedChange={() => handleModuleToggle(key)}
                                        />
                                        <label
                                            htmlFor={key}
                                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                        >
                                            {label}
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isGenerating}>
                        İptal
                    </Button>
                    <Button onClick={handleGenerateReport} disabled={isGenerating || (period === 'custom' && (!dateFrom || !dateTo))}>
                        {isGenerating ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Oluşturuluyor...
                            </>
                        ) : (
                            <>
                                <FileDown className="mr-2 h-4 w-4" />
                                Rapor Oluştur
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ReportGenerationModalEnhanced;

