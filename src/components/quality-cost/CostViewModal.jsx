import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { DollarSign, Calendar, Building2, Car, Package, User, AlertTriangle, Clock, Users, FileText, Paperclip } from 'lucide-react';
import { InfoCard } from '@/components/ui/InfoCard';
import { openPrintableReport } from '@/lib/reportUtils';
import QualityCostDocumentsTab from '@/components/quality-cost/QualityCostDocumentsTab';

const formatCurrency = (value) => {
    if (typeof value !== 'number') return '-';
    return value.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
}

export const CostViewModal = ({ isOpen, setOpen, cost, onRefresh }) => {
    if (!cost) return null;

    // Ana süre: rework_duration ve unit alanlarından oluşuyor
    const mainReworkCost = cost.rework_duration && cost.unit 
        ? `${cost.unit}: ${cost.rework_duration} dk` 
        : cost.rework_duration 
            ? `(Ana: ${cost.rework_duration} dk)` 
            : '';
    
    // Etkilenen birimler: Ana birim dışındaki diğer birimler (örneğin Kalite Kontrol)
    const affectedUnitsCosts = cost.affected_units && Array.isArray(cost.affected_units) && cost.affected_units.length > 0
        ? cost.affected_units
            .filter(au => au.unit !== cost.unit) // Ana birimi filtrele (zaten mainReworkCost'te gösteriliyor)
            .map(au => `${au.unit}: ${au.duration} dk`)
            .join(', ')
        : '';
    
    const reworkDetails = [mainReworkCost, affectedUnitsCosts].filter(Boolean).join(' | ');

    return (
        <Dialog open={isOpen} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
                <header className="bg-gradient-to-r from-primary to-blue-700 px-6 py-5 flex items-center justify-between text-white shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/20 p-2.5 rounded-lg"><DollarSign className="h-5 w-5 text-white" /></div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight">Maliyet Kaydı Detayı</h1>
                            <p className="text-[11px] text-blue-100 uppercase tracking-[0.15em] font-medium">Kalite Maliyeti Takibi</p>
                        </div>
                        <span className="ml-2 px-3 py-1 bg-white/20 border border-white/30 text-white/90 text-[10px] font-bold rounded-full uppercase tracking-wider">
                            {cost.cost_type || 'Detay'}
                        </span>
                    </div>
                </header>
                
                <Tabs defaultValue="info" className="flex-1 overflow-hidden flex flex-col px-6">
                    <TabsList className="inline-flex gap-1 p-1 h-auto mt-4 shrink-0">
                        <TabsTrigger value="info" className="text-xs">Bilgiler</TabsTrigger>
                        <TabsTrigger value="documents" className="text-xs flex items-center gap-1.5">
                            <Paperclip className="h-3.5 w-3.5" />
                            Dokümanlar
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent value="info" className="mt-4 flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-6 pr-2">
                    <div className="space-y-6 pr-4">
                        {/* Önemli Bilgiler - Üst Kart */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <InfoCard 
                                icon={DollarSign} 
                                label="Toplam Tutar" 
                                value={formatCurrency(cost.amount)} 
                                variant="primary"
                            />
                            <InfoCard 
                                icon={Calendar} 
                                label="Tarih" 
                                value={new Date(cost.cost_date).toLocaleDateString('tr-TR', { 
                                    day: '2-digit', 
                                    month: 'long', 
                                    year: 'numeric' 
                                })} 
                            />
                            <InfoCard 
                                icon={AlertTriangle} 
                                label="Maliyet Türü" 
                                value={cost.cost_type} 
                                variant="warning"
                            />
                        </div>

                        {/* Tedarikçi Bilgisi */}
                        {cost.is_supplier_nc && (
                            <Card className="bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-3">
                                        <Building2 className="h-5 w-5 text-orange-600" />
                                        <div>
                                            <p className="text-xs font-medium text-muted-foreground">Tedarikçi Kaynaklı</p>
                                            <Badge variant="default" className="bg-orange-500 mt-1">
                                                {cost.supplier?.name || 'Tedarikçi Bilgisi Yok'}
                                            </Badge>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        <Separator />

                        {/* Genel Bilgiler */}
                        <div>
                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <Package className="h-5 w-5 text-primary" />
                                Genel Bilgiler
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {cost.cost_allocations && cost.cost_allocations.length > 0 ? (
                                    <div className="md:col-span-2">
                                        <p className="text-sm font-medium text-muted-foreground mb-2">Maliyet Dağılımı</p>
                                        <div className="flex flex-wrap gap-2">
                                            {cost.cost_allocations.map((a, i) => (
                                                <Badge key={i} variant="secondary" className="py-2 px-3 text-sm">
                                                    {a.unit}: %{parseFloat(a.percentage).toFixed(1)} = {formatCurrency(a.amount)}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <InfoCard icon={Building2} label="Birim (Kaynak)" value={cost.unit} />
                                )}
                                {cost.vehicle_type && <InfoCard icon={Car} label="Araç Türü" value={cost.vehicle_type} />}
                                {cost.part_code && <InfoCard icon={Package} label="Parça Kodu" value={cost.part_code} />}
                                {cost.part_name && <InfoCard icon={Package} label="Parça Adı" value={cost.part_name} />}
                                {cost.responsible_personnel?.full_name && (
                                    <InfoCard icon={User} label="Sorumlu Personel" value={cost.responsible_personnel.full_name} />
                                )}
                                {cost.quantity && <InfoCard icon={Package} label="Miktar" value={cost.quantity} />}
                                {cost.measurement_unit && <InfoCard icon={Package} label="Ölçü Birimi" value={cost.measurement_unit} />}
                                {cost.scrap_weight && <InfoCard icon={Package} label="Hurda Ağırlığı (kg)" value={cost.scrap_weight} />}
                            </div>
                        </div>

                        {/* Yeniden İşlem Maliyeti Detayları */}
                        {cost.cost_type === 'Yeniden İşlem Maliyeti' && reworkDetails && (
                            <>
                                <Separator />
                                <div>
                                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                        <Clock className="h-5 w-5 text-primary" />
                                        İşlem Süreleri
                                    </h3>
                                    <Card>
                                        <CardContent className="p-4">
                                            <p className="text-sm">{reworkDetails}</p>
                                        </CardContent>
                                    </Card>
                                </div>
                            </>
                        )}

                        {/* Final Hataları Maliyeti Detayları */}
                        {cost.cost_type === 'Final Hataları Maliyeti' && (
                            <>
                                <Separator />
                                <div>
                                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                        <Clock className="h-5 w-5 text-primary" />
                                        Süre Detayları
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {cost.rework_duration && (
                                            <InfoCard 
                                                icon={Clock} 
                                                label="Giderilme Süresi" 
                                                value={`${cost.rework_duration} dakika`}
                                                variant="success"
                                            />
                                        )}
                                        {cost.quality_control_duration && (
                                            <InfoCard 
                                                icon={Clock} 
                                                label="Kalite Kontrol Süresi" 
                                                value={`${cost.quality_control_duration} dakika`}
                                                variant="warning"
                                            />
                                        )}
                                    </div>
                                    
                                    {cost.affected_units && Array.isArray(cost.affected_units) && cost.affected_units.length > 0 && (
                                        <Card className="mt-4">
                                            <CardContent className="p-4">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <Users className="h-5 w-5 text-primary" />
                                                    <h4 className="font-semibold">Etkilenen Birimler</h4>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {/* Ana birim zaten yukarıda gösteriliyor, burada sadece diğer birimleri göster */}
                                                    {cost.affected_units
                                                        .filter(au => au.unit !== cost.unit) // Ana birimi filtrele
                                                        .map((au, idx) => (
                                                        <Badge key={idx} variant="outline" className="text-sm py-2 px-3">
                                                            <Building2 className="h-3 w-3 mr-1" />
                                                            {au.unit}: {au.duration} dk
                                                        </Badge>
                                                    ))}
                                                    {/* Eğer tüm birimler ana birimse, hiçbir şey gösterme */}
                                                    {cost.affected_units.every(au => au.unit === cost.unit) && (
                                                        <p className="text-sm text-muted-foreground">Ana birim yukarıda gösteriliyor.</p>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )}
                                </div>
                            </>
                        )}

                        <Separator />

                        {/* Açıklama */}
                        <div>
                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-primary" />
                                {cost.cost_type === 'Final Hataları Maliyeti' ? 'Hata Açıklaması' : 'Açıklama'}
                            </h3>
                            {cost.description ? (
                                <Card>
                                    <CardContent className="p-6">
                                        {cost.cost_type === 'Final Hataları Maliyeti' ? (
                                            <div className="space-y-4">
                                                {cost.description.split('\n').map((line, idx) => {
                                                    // Boş satırları atla
                                                    if (!line.trim()) return null;
                                                    
                                                    // Başlık satırları
                                                    if (line.includes('Final Hataları Maliyeti')) {
                                                        return (
                                                            <div key={idx} className="mb-4 pb-3 border-b border-primary/20">
                                                                <p className="font-bold text-xl text-primary">{line}</p>
                                                            </div>
                                                        );
                                                    }
                                                    
                                                    // Araç bilgileri
                                                    if (line.includes('Araç:') || line.includes('Araç Tipi:') || line.includes('Müşteri:')) {
                                                        const [label, value] = line.split(':').map(s => s.trim());
                                                        return (
                                                            <div key={idx} className="flex items-center gap-3">
                                                                <Badge variant="outline" className="w-32 justify-center">{label}</Badge>
                                                                <span className="text-sm font-medium flex-1">{value}</span>
                                                            </div>
                                                        );
                                                    }
                                                    
                                                    // Hata Detayı başlığı
                                                    if (line.includes('Hata Detayı:')) {
                                                        return (
                                                            <div key={idx} className="mt-6 mb-3">
                                                                <p className="font-semibold text-primary text-lg">{line}</p>
                                                            </div>
                                                        );
                                                    }
                                                    
                                                    // Hata açıklaması (başında - olan)
                                                    if (line.trim().startsWith('-')) {
                                                        return (
                                                            <div key={idx} className="flex items-start gap-3 pl-4 py-2 bg-muted/30 rounded-lg">
                                                                <span className="text-primary mt-1 text-lg">•</span>
                                                                <span className="text-sm leading-relaxed flex-1 font-medium">{line.replace(/^-/, '').trim()}</span>
                                                            </div>
                                                        );
                                                    }
                                                    
                                                    // İlgili Birim, Giderilme Süresi, Kalite Kontrol Süresi
                                                    if (line.includes('İlgili Birim:') || line.includes('Giderilme Süresi:') || line.includes('Kalite Kontrol Süresi:')) {
                                                        const [label, value] = line.split(':').map(s => s.trim());
                                                        return (
                                                            <div key={idx} className="flex items-center gap-3">
                                                                <Badge variant="secondary" className="w-40 justify-center">{label}</Badge>
                                                                <span className="text-sm font-semibold text-primary">{value}</span>
                                                            </div>
                                                        );
                                                    }
                                                    
                                                    // Diğer satırlar
                                                    return (
                                                        <p key={idx} className="text-sm text-muted-foreground">{line}</p>
                                                    );
                                                }).filter(Boolean)}
                                            </div>
                                        ) : (
                                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{cost.description}</p>
                                        )}
                                    </CardContent>
                                </Card>
                            ) : (
                                <Card>
                                    <CardContent className="p-6">
                                        <p className="text-muted-foreground text-center">Açıklama bulunmuyor</p>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </div>
                    </TabsContent>
                    <TabsContent value="documents" className="mt-4 flex-1 overflow-y-auto pb-4">
                        <QualityCostDocumentsTab qualityCostId={cost.id} onRefresh={onRefresh} />
                    </TabsContent>
                </Tabs>

                <footer className="bg-background px-6 py-4 border-t border-border flex items-center justify-between shrink-0">
                    <div className="flex items-center text-muted-foreground">
                        <span className="text-[11px] font-medium">{new Date(cost.cost_date).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button type="button" variant="outline" size="sm" onClick={() => openPrintableReport({ id: cost.id, ...cost }, 'quality_cost_detail', true)}>
                            <FileText className="w-4 h-4 mr-2" />
                            PDF Rapor Al
                        </Button>
                        <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)}>Kapat</Button>
                    </div>
                </footer>
            </DialogContent>
        </Dialog>
    );
};
