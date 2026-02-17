import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { DollarSign, Calendar, Building2, Car, Package, User, AlertTriangle, Clock, Users, FileText, Paperclip, Truck, TrendingDown, LayoutGrid, ZoomIn } from 'lucide-react';
import { InfoCard } from '@/components/ui/InfoCard';
import { openPrintableReport } from '@/lib/reportUtils';
import QualityCostDocumentsTab from '@/components/quality-cost/QualityCostDocumentsTab';
import { supabase } from '@/lib/customSupabaseClient';

const formatCurrency = (value) => {
    if (typeof value !== 'number') return '-';
    return value.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
}

export const CostViewModal = ({ isOpen, setOpen, cost, selectedLineItem, onRefresh }) => {
    const [documents, setDocuments] = useState([]);
    const [showFullView, setShowFullView] = useState(false);

    // Modal/cost değiştiğinde toggle'ı sıfırla
    useEffect(() => {
        if (!isOpen) setShowFullView(false);
    }, [isOpen, cost?.id, selectedLineItem]);

    // Dokümanları yükle (PDF rapor için)
    useEffect(() => {
        if (!cost?.id || !isOpen) return;
        const fetchDocs = async () => {
            const { data } = await supabase
                .from('quality_cost_documents')
                .select('*')
                .eq('quality_cost_id', cost.id);
            if (data) {
                const docsWithUrls = await Promise.all(data.map(async (doc) => {
                    // quality_costs bucket private - createSignedUrl kullan (getPublicUrl 404 verir)
                    const { data: urlData, error } = await supabase.storage.from('quality_costs').createSignedUrl(doc.file_path, 3600);
                    return { ...doc, url: (!error && urlData?.signedUrl) ? urlData.signedUrl : '#' };
                }));
                setDocuments(docsWithUrls);
            }
        };
        fetchDocs();
    }, [cost?.id, isOpen]);

    if (!cost) return null;

    const lineItems = cost.cost_line_items && Array.isArray(cost.cost_line_items) ? cost.cost_line_items : [];
    const sharedCostItems = cost.shared_costs && Array.isArray(cost.shared_costs) ? cost.shared_costs : [];
    const indirectCostItems = cost.indirect_costs && Array.isArray(cost.indirect_costs) ? cost.indirect_costs : [];
    const hasLineItems = lineItems.length > 0;
    const isUnitView = !!selectedLineItem && !showFullView;
    const totalAmount = parseFloat(cost.amount) || 0;

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
                <DialogHeader className="sr-only"><DialogTitle>Maliyet Kaydı Detayı</DialogTitle></DialogHeader>
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
                        {isUnitView && selectedLineItem && (
                            <span className="ml-2 px-3 py-1 bg-amber-500/80 text-white text-[10px] font-bold rounded-full">
                                {selectedLineItem.responsible_type === 'supplier'
                                    ? (selectedLineItem.responsible_supplier_name || cost.supplier?.name || 'Tedarikçi')
                                    : (selectedLineItem.responsible_unit || 'Birim')}
                            </span>
                        )}
                    </div>
                    {selectedLineItem && hasLineItems && (
                        <Button
                            variant="secondary"
                            size="sm"
                            className="shrink-0 h-8 text-white bg-white/20 hover:bg-white/30 border border-white/30"
                            onClick={() => setShowFullView(prev => !prev)}
                        >
                            {isUnitView ? (
                                <><LayoutGrid className="h-4 w-4 mr-2" />Tümünü Göster</>
                            ) : (
                                <><ZoomIn className="h-4 w-4 mr-2" />Birime Dön</>
                            )}
                        </Button>
                    )}
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
                                label={isUnitView ? "Birim Tutarı" : "Toplam Tutar"} 
                                value={formatCurrency(isUnitView ? (parseFloat(selectedLineItem?.amount) || 0) : cost.amount)} 
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

                        {/* Birim Dağılımı Özeti - toplu görünümde ve kalem varsa */}
                        {!isUnitView && hasLineItems && totalAmount > 0 && (
                            <Card className="bg-muted/30 border-primary/20">
                                <CardContent className="p-4">
                                    <p className="text-sm font-medium text-muted-foreground mb-3">Birim Dağılımı</p>
                                    <div className="flex flex-wrap gap-2">
                                        {lineItems.map((li, idx) => {
                                            const amt = parseFloat(li.amount) || 0;
                                            const pct = ((amt / totalAmount) * 100).toFixed(1);
                                            const unitLabel = li.responsible_type === 'supplier'
                                                ? (li.responsible_supplier_name || cost.supplier?.name || 'Tedarikçi')
                                                : (li.responsible_unit || '-');
                                            return (
                                                <Badge key={idx} variant="secondary" className="py-2 px-3 text-sm">
                                                    {unitLabel}: {formatCurrency(amt)} (%{pct})
                                                </Badge>
                                            );
                                        })}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Tedarikçi Bilgisi - sadece tüm kayıt görünümünde veya lineItem tedarikçi ise */}
                        {!isUnitView && cost.is_supplier_nc && (
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

                        {/* Genel Bilgiler - birim görünümünde sadece o birime ait veriler */}
                        <div>
                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <Package className="h-5 w-5 text-primary" />
                                {isUnitView ? 'Birim Bilgileri' : 'Genel Bilgiler'}
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {isUnitView ? (
                                    <>
                                        <InfoCard icon={Building2} label="Birim (Kaynak)" value={selectedLineItem.responsible_type === 'supplier' ? (selectedLineItem.responsible_supplier_name || cost.supplier?.name || 'Tedarikçi') : (selectedLineItem.responsible_unit || '-')} />
                                        {cost.vehicle_type && <InfoCard icon={Car} label="Araç Türü" value={cost.vehicle_type} />}
                                        {(selectedLineItem.part_code || selectedLineItem.part_name) && (
                                            <InfoCard icon={Package} label="Parça" value={[selectedLineItem.part_code, selectedLineItem.part_name].filter(Boolean).join(' - ')} />
                                        )}
                                        {cost.customer_name && cost.cost_type === 'Dış Hata Maliyeti' && (
                                            <InfoCard icon={User} label="Müşteri Adı" value={cost.customer_name} />
                                        )}
                                        {selectedLineItem.quantity && <InfoCard icon={Package} label="Miktar" value={`${selectedLineItem.quantity} ${selectedLineItem.measurement_unit || ''}`.trim()} />}
                                    </>
                                ) : (
                                    <>
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
                                        ) : !hasLineItems && cost.unit ? (
                                            <InfoCard icon={Building2} label="Birim (Kaynak)" value={cost.unit} />
                                        ) : null}
                                        {cost.vehicle_type && <InfoCard icon={Car} label="Araç Türü" value={cost.vehicle_type} />}
                                        {!hasLineItems && cost.part_code && <InfoCard icon={Package} label="Parça Kodu" value={cost.part_code} />}
                                        {!hasLineItems && cost.part_name && <InfoCard icon={Package} label="Parça Adı" value={cost.part_name} />}
                                        {cost.customer_name && cost.cost_type === 'Dış Hata Maliyeti' && (
                                            <InfoCard icon={User} label="Müşteri Adı" value={cost.customer_name} />
                                        )}
                                        {!hasLineItems && cost.quantity && <InfoCard icon={Package} label="Miktar" value={cost.quantity} />}
                                        {!hasLineItems && cost.measurement_unit && <InfoCard icon={Package} label="Ölçü Birimi" value={cost.measurement_unit} />}
                                        {cost.scrap_weight && <InfoCard icon={Package} label="Hurda Ağırlığı (kg)" value={cost.scrap_weight} />}
                                    </>
                                )}
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

                        {/* Maliyet Kalemleri - birim görünümünde sadece seçili kalem */}
                        {(hasLineItems || isUnitView) && (
                            <>
                                <Separator />
                                <div>
                                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                        <Package className="h-5 w-5 text-primary" />
                                        {isUnitView ? 'Maliyet Kalemi' : `Maliyet Kalemleri (${lineItems.length} kalem)`}
                                        {cost.invoice_number && <Badge variant="outline" className="ml-2">Fatura: {cost.invoice_number}</Badge>}
                                    </h3>
                                    <div className="space-y-3">
                                        {(isUnitView ? [selectedLineItem] : lineItems).filter(Boolean).map((li, idx) => {
                                            const itemAmount = parseFloat(li.amount) || 0;
                                            const pct = totalAmount > 0 ? ((itemAmount / totalAmount) * 100).toFixed(1) : '0';
                                            return (
                                            <Card key={idx} className="border-l-4 border-l-primary">
                                                <CardContent className="p-4">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant="secondary" className="text-xs">#{idx + 1}</Badge>
                                                            <span className="font-semibold text-sm">{li.part_code || '-'} {li.part_name ? `- ${li.part_name}` : ''}</span>
                                                            {!isUnitView && totalAmount > 0 && (
                                                                <Badge variant="outline" className="text-[10px]">%{pct}</Badge>
                                                            )}
                                                        </div>
                                                        <span className="font-bold text-primary">{formatCurrency(itemAmount)}</span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                                        {li.cost_subtype && <Badge variant="outline">{li.cost_subtype}</Badge>}
                                                        {li.responsible_type === 'supplier' ? (
                                                            <Badge variant="default" className="bg-amber-500">{li.responsible_supplier_name || li.responsible_unit || cost.supplier?.name || '-'}</Badge>
                                                        ) : (
                                                            li.responsible_unit && <Badge variant="secondary">{li.responsible_unit}</Badge>
                                                        )}
                                                        {li.quantity && <span>Miktar: {li.quantity} {li.measurement_unit || ''}</span>}
                                                    </div>
                                                    {li.description && <p className="text-xs text-muted-foreground mt-2 italic">{li.description}</p>}
                                                </CardContent>
                                            </Card>
                                        );
                                        })}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Ortak Maliyetler - birim görünümünde gösterme (ortak maliyetler tüm kalemlere ait) */}
                        {!isUnitView && sharedCostItems.length > 0 && (
                            <>
                                <Separator />
                                <div>
                                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                        <Truck className="h-5 w-5 text-amber-600" />
                                        Ortak Maliyetler (Nakliye / Konaklama)
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {sharedCostItems.map((sc, idx) => (
                                            <Card key={idx} className="border-l-4 border-l-amber-500">
                                                <CardContent className="p-4">
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-semibold text-sm">{sc.category || '-'}</span>
                                                        <span className="font-bold text-amber-600">{formatCurrency(parseFloat(sc.amount) || 0)}</span>
                                                    </div>
                                                    {sc.description && <p className="text-xs text-muted-foreground mt-1">{sc.description}</p>}
                                                    {sc.measurement_unit && <span className="text-xs text-muted-foreground">{sc.measurement_value} {sc.measurement_unit}</span>}
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Dolaylı Maliyetler - birim görünümünde gösterme */}
                        {!isUnitView && indirectCostItems.length > 0 && (
                            <>
                                <Separator />
                                <div>
                                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                        <TrendingDown className="h-5 w-5 text-purple-600" />
                                        Dolaylı Maliyetler
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {indirectCostItems.map((ic, idx) => (
                                            <Card key={idx} className="border-l-4 border-l-purple-500">
                                                <CardContent className="p-4">
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-semibold text-sm">{ic.category || '-'}</span>
                                                        <span className="font-bold text-purple-600">{formatCurrency(parseFloat(ic.amount) || 0)}</span>
                                                    </div>
                                                    {ic.description && <p className="text-xs text-muted-foreground mt-1">{ic.description}</p>}
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}

                        <Separator />

                        {/* Açıklama - birim görünümünde sadece o kaleme ait açıklama */}
                        <div>
                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-primary" />
                                {cost.cost_type === 'Final Hataları Maliyeti' ? 'Hata Açıklaması' : 'Açıklama'}
                            </h3>
                            {(isUnitView ? (selectedLineItem?.description || cost.description) : cost.description) ? (
                                <Card>
                                    <CardContent className="p-6">
                                        {!isUnitView && cost.cost_type === 'Final Hataları Maliyeti' ? (
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
                                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{isUnitView ? (selectedLineItem?.description || cost.description) : cost.description}</p>
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
                        <Button type="button" variant="outline" size="sm" onClick={() => openPrintableReport({ id: cost.id, ...cost, _documents: documents }, 'quality_cost_detail', true)}>
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
