import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { FileDown, Loader2, FileText, LayoutDashboard, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

const REPORT_TYPES = [
    {
        id: 'a3',
        label: 'A3 Kalite Panosu Raporu',
        description: 'Tüm modülleri kapsayan, kalite panolarına asılmak üzere tasarlanmış yatay A3 format rapor. KPI kartları, pie chart ve bar chartları ile tüm veriler tek sayfada.',
        icon: LayoutDashboard,
        badge: 'ÖNERİLEN',
        badgeColor: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        url: (period) => `/print/a3-quality-board?period=${period}`,
        color: 'border-emerald-500 bg-emerald-50',
        iconColor: 'text-emerald-600',
    },
    {
        id: 'executive',
        label: 'Yönetici Özet Raporu (A4)',
        description: 'Üst yönetim için hazırlanmış, detaylı tablolar ve analizler içeren A4 dikey format rapor.',
        icon: FileText,
        badge: null,
        url: (period) => `/print/dashboard-report?period=${period}`,
        color: 'border-slate-300 bg-slate-50',
        iconColor: 'text-slate-500',
    },
];

const PERIODS = [
    { value: 'last1month', label: 'Son 1 Ay' },
    { value: 'last3months', label: 'Son 3 Ay' },
    { value: 'last6months', label: 'Son 6 Ay' },
    { value: 'thisYear', label: 'Bu Yıl' },
    { value: 'last12months', label: 'Son 12 Ay' },
];

const ReportGenerationModalEnhanced = ({ isOpen, setIsOpen }) => {
    const [selectedType, setSelectedType] = useState('a3');
    const [period, setPeriod] = useState('last3months');
    const [isGenerating, setIsGenerating] = useState(false);

    const handleGenerate = () => {
        const report = REPORT_TYPES.find(r => r.id === selectedType);
        if (!report) return;

        setIsGenerating(true);
        const url = report.url(period);
        window.open(url, '_blank');

        setTimeout(() => {
            setIsGenerating(false);
            setIsOpen(false);
        }, 800);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileDown className="w-5 h-5 text-primary" />
                        Kalite Panosu Raporu Al
                    </DialogTitle>
                    <DialogDescription>
                        Kalite panolarınıza asacağınız rapor türünü ve dönemini seçin.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Rapor Türü Seçimi */}
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold">Rapor Türü</Label>
                        <div className="space-y-2">
                            {REPORT_TYPES.map((report) => {
                                const Icon = report.icon;
                                const isSelected = selectedType === report.id;
                                return (
                                    <button
                                        key={report.id}
                                        onClick={() => setSelectedType(report.id)}
                                        className={cn(
                                            'w-full text-left p-3 rounded-lg border-2 transition-all duration-200',
                                            isSelected
                                                ? 'border-primary bg-primary/5 shadow-sm'
                                                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                        )}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={cn(
                                                'mt-0.5 p-1.5 rounded-md',
                                                isSelected ? 'bg-primary/10' : 'bg-slate-100'
                                            )}>
                                                <Icon className={cn('w-4 h-4', isSelected ? 'text-primary' : report.iconColor)} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-medium text-sm">{report.label}</span>
                                                    {report.badge && (
                                                        <span className={cn(
                                                            'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border',
                                                            report.badgeColor
                                                        )}>
                                                            <Star className="w-2.5 h-2.5 mr-0.5" />
                                                            {report.badge}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                                                    {report.description}
                                                </p>
                                            </div>
                                            <div className={cn(
                                                'w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center',
                                                isSelected ? 'border-primary bg-primary' : 'border-slate-300'
                                            )}>
                                                {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Dönem Seçimi */}
                    <div className="space-y-1.5">
                        <Label className="text-sm font-semibold">Rapor Dönemi</Label>
                        <Select value={period} onValueChange={setPeriod}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {PERIODS.map(p => (
                                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                            Seçilen dönem için tüm modül verileri raporlanır.
                        </p>
                    </div>

                    {/* A3 Bilgi Kutusu */}
                    {selectedType === 'a3' && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-800 space-y-1">
                            <div className="font-semibold flex items-center gap-1">
                                <LayoutDashboard className="w-3.5 h-3.5" />
                                A3 Yatay Rapor İçeriği
                            </div>
                            <ul className="list-disc list-inside space-y-0.5 text-emerald-700 pl-1">
                                <li>10 adet KPI kartı (DF/8D, Maliyet, Karantina, Araç Kalite...)</li>
                                <li>Birim bazlı uygunsuzluk dağılımı (bar chart)</li>
                                <li>Kalite maliyeti dağılımı ve aylık trend (pie + line chart)</li>
                                <li>Girdi kalite kontrol özeti ve tedarikçi performansı</li>
                                <li>Üretilen araç hata kategorileri ve aylık trend</li>
                                <li>Müşteri şikayetleri ve kalite duvarı tablosu</li>
                                <li>Geciken kayıtlar, karantina, kalibrasyon uyarıları</li>
                            </ul>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isGenerating}>
                        İptal
                    </Button>
                    <Button onClick={handleGenerate} disabled={isGenerating} className="gap-2">
                        {isGenerating ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Açılıyor...
                            </>
                        ) : (
                            <>
                                <FileDown className="w-4 h-4" />
                                Rapor Oluştur
                            </>
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ReportGenerationModalEnhanced;
