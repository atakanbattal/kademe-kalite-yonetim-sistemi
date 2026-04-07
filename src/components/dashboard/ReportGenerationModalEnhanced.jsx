import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { FileDown, Loader2, FileText, LayoutDashboard, Star, Presentation } from 'lucide-react';
import { cn } from '@/lib/utils';

const REPORT_TYPES = [
    {
        id: 'a3',
        path: '/print/a3-quality-board',
        label: 'A3 Kalite Panosu Raporu',
        description: 'Tüm modülleri kapsayan, kalite panolarına asılmak üzere tasarlanmış çok sayfalı yatay A3 format rapor. Uygunsuzluk yönetimi, fikstür takibi, maliyet yükü, top 10 hatalar ve üretim için kritik uyarıları düzenli sayfa kırılımlarıyla sunar.',
        icon: LayoutDashboard,
        badge: 'ÖNERİLEN',
        badgeColor: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        color: 'border-emerald-500 bg-emerald-50',
        iconColor: 'text-emerald-600',
    },
    {
        id: 'presentation',
        path: '/print/executive-presentation',
        label: 'İcra Kurulu Sunumu',
        description: 'İcra kurulu toplantıları için hazırlanmış, grafikler ve KPI kartları ile güçlendirilmiş sunum. DF/8D sorumlu ve talep birim tabloları, girdi/tedarikçi kırılımları ve birleştirilmiş sapma bölümü içerir; tamamlayıcı veri çekimi ile dönem kayıtlarını kapsar.',
        icon: Presentation,
        badge: 'YENİ',
        badgeColor: 'bg-blue-100 text-blue-700 border-blue-200',
        color: 'border-blue-500 bg-blue-50',
        iconColor: 'text-blue-600',
    },
    {
        id: 'executive',
        path: '/print/dashboard-report',
        label: 'Yönetici Özet Raporu (A4)',
        description: 'Üst yönetim için hazırlanmış, detaylı tablolar ve analizler içeren A4 dikey format rapor.',
        icon: FileText,
        badge: null,
        color: 'border-slate-300 bg-slate-50',
        iconColor: 'text-slate-500',
    },
];

const buildPeriodQuery = (period, year, month) => {
    if (period === 'month' && year != null && month != null) {
        return `period=month&year=${year}&month=${month}`;
    }
    return `period=${encodeURIComponent(period)}`;
};

const PERIODS = [
    { value: 'last1month', label: 'Son 1 Ay' },
    { value: 'last3months', label: 'Son 3 Ay' },
    { value: 'last6months', label: 'Son 6 Ay' },
    { value: 'thisYear', label: 'Bu Yıl' },
    { value: 'last12months', label: 'Son 12 Ay' },
    { value: 'month', label: 'Takvim ayı (yıl + ay)' },
];

const ReportGenerationModalEnhanced = ({ isOpen, setIsOpen }) => {
    const [selectedType, setSelectedType] = useState('a3');
    const [period, setPeriod] = useState('last3months');
    const now = new Date();
    const [calendarYear, setCalendarYear] = useState(now.getFullYear());
    const [calendarMonth, setCalendarMonth] = useState(now.getMonth() + 1);
    const [isGenerating, setIsGenerating] = useState(false);

    const yearOptions = Array.from({ length: 8 }, (_, i) => now.getFullYear() - 5 + i);

    const handleGenerate = () => {
        const report = REPORT_TYPES.find(r => r.id === selectedType);
        if (!report) return;

        setIsGenerating(true);
        const q = buildPeriodQuery(period, calendarYear, calendarMonth);
        const url = `${report.path}?${q}`;
        window.open(url, '_blank');

        setTimeout(() => {
            setIsGenerating(false);
            setIsOpen(false);
        }, 800);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col p-0">
                <DialogHeader className="px-6 pt-6 pb-3 shrink-0">
                    <DialogTitle className="flex items-center gap-2">
                        <FileDown className="w-5 h-5 text-primary" />
                        Kalite Panosu Raporu Al
                    </DialogTitle>
                    <DialogDescription>
                        Kalite panolarınıza asacağınız rapor türünü ve dönemini seçin.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-6 py-2">
                    <div className="space-y-4">
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
                        {period === 'month' && (
                            <div className="flex gap-2 pt-2">
                                <div className="flex-1 space-y-1">
                                    <Label className="text-xs text-muted-foreground">Yıl</Label>
                                    <Select value={String(calendarYear)} onValueChange={(v) => setCalendarYear(Number(v))}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {yearOptions.map((y) => (
                                                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex-1 space-y-1">
                                    <Label className="text-xs text-muted-foreground">Ay</Label>
                                    <Select value={String(calendarMonth)} onValueChange={(v) => setCalendarMonth(Number(v))}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                                                <SelectItem key={m} value={String(m)}>{m}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* A3 Bilgi Kutusu */}
                    {selectedType === 'a3' && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-800 space-y-1">
                            <div className="font-semibold flex items-center gap-1">
                                <LayoutDashboard className="w-3.5 h-3.5" />
                                A3 Yatay Rapor İçeriği
                            </div>
                            <ul className="list-disc list-inside space-y-0.5 text-emerald-700 pl-1">
                                <li className="font-medium">PDF / yazdır: Kağıt <strong>A3 Yatay</strong>, kenar boşluğu <strong>yok veya minimum</strong> (sayfa kırılımları buna göre ayarlanır).</li>
                                <li>8 adet KPI kartı (DF/8D, Maliyet, Karantina, Araç Kalite...)</li>
                                <li>Birim bazlı uygunsuzluk dağılımı (bar chart)</li>
                                <li>COPQ kategori kartları (İç/Dış Hata, Değerlendirme, Önleme)</li>
                                <li>Kalite maliyeti dağılımı, birim bazlı maliyet ve aylık trend</li>
                                <li>Girdi kalite kontrol özeti ve tedarikçi performansı</li>
                                <li>DF/8D önerilen ve açılan maddeler (optimize edilmiş tablo)</li>
                                <li>Fikstür takip özeti, kritik fikstür uyarıları</li>
                                <li>Üretilen araç hata kategorileri, top 10 ve en problemli araçlar</li>
                                <li>Müşteri şikayetleri, KPI alarm listesi ve kalite duvarı</li>
                                <li>Geciken kayıtlar, doküman ve kalibrasyon uyarıları</li>
                            </ul>
                        </div>
                    )}
                    {selectedType === 'presentation' && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 space-y-1">
                            <div className="font-semibold flex items-center gap-1">
                                <Presentation className="w-3.5 h-3.5" />
                                İcra Kurulu Sunum İçeriği (23 slayt)
                            </div>
                            <ul className="list-disc list-inside space-y-0.5 text-blue-700 pl-1">
                                <li className="font-medium">PDF / yazdır: Kağıt <strong>A3 Yatay</strong>, kenar boşluğu <strong>yok veya minimum</strong>, ölçek <strong>%100</strong>.</li>
                                <li>Kapak slaytı (Kademe A.Ş., başlık, dönem ve kısa tanıtım metni — KPI özeti kapakta yok)</li>
                                <li>KPI özeti (14 gösterge — tüm modüllerden)</li>
                                <li>COPQ maliyet analizi (kategori kartları + pie chart + aylık trend)</li>
                                <li>Maliyet detay (birim bazlı, kaynak, top sürücüler, yük bileşenleri)</li>
                                <li>Birim uygunsuzluk dağılımı (tam sayfa bar chart)</li>
                                <li>NC trend & kalite duvarı (chart + birim performans + NC tip)</li>
                                <li>DF/8D modülü (KPI + önerilen/açılan maddeler + geciken kayıtlar)</li>
                                <li>Kök neden pareto (tam genişlik tablo)</li>
                                <li>Sorumlu iş yükü ve son modül kayıtları</li>
                                <li>Müşteri bazlı COPQ; sapma talepleri detay ve özet slaytları</li>
                                <li>Araç kalite — KPI, kontrol/yeniden işlem süresi aylık trend (dk), hata kategorileri</li>
                                <li>Araç üretim/hata trendi, proses ve COPQ detayı (dikey düzen)</li>
                                <li>Girdi kalite: pasta, aylık trend, ret listesi (alt alta)</li>
                                <li>Tedarikçi: NC, PPM, denetim (tam genişlik tablolar)</li>
                                <li>Müşteri şikayetleri (trend ve dağılımlar alt alta)</li>
                                <li>Kaizen; sapma özeti (ayrı slaytlar)</li>
                                <li>Karantina & stok risk kontrol</li>
                                <li>Proses kalite (süreç muayenesi, sızdırmazlık, dinamik balans — tam veri çekimi)</li>
                                <li>Fikstür takibi</li>
                                <li>İNKR (girdi kalite)</li>
                                <li>İç tetkik & eğitim faaliyetleri</li>
                                <li>KPI alarmları & yönetim (doküman, kalibrasyon, personel)</li>
                                <li>Kapanış özet slaytı</li>
                            </ul>
                        </div>
                    )}
                    </div>
                </div>

                <div className="flex justify-end gap-2 px-6 py-4 border-t bg-background shrink-0">
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
