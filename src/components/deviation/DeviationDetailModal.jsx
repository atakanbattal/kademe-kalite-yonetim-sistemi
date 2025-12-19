import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { supabase } from '@/lib/customSupabaseClient';
import { Printer, Loader2, Hourglass, CheckCircle, XCircle, FileText, Truck, Download, Package, AlertTriangle, DollarSign, Link2, Hash, Calendar, Building2, User, Car } from 'lucide-react';
import { openPrintableReport } from '@/lib/reportUtils';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { InfoCard } from '@/components/ui/InfoCard';

const DeviationDetailModal = ({ isOpen, setIsOpen, deviation }) => {
    const [isPrinting, setIsPrinting] = useState(false);

    if (!deviation) return null;

    const getStatusVariant = (status) => {
        switch (status) {
            case 'Onaylandı': return 'success';
            case 'Reddedildi': return 'destructive';
            case 'Onay Bekliyor': return 'warning';
            case 'Açık': return 'secondary';
            default: return 'outline';
        }
    };

    const getStatusBadgeVariant = (status) => {
        switch (status) {
            case 'Onaylandı': return 'success';
            case 'Reddedildi': return 'danger';
            case 'Onay Bekliyor': return 'warning';
            case 'Açık': return 'info';
            default: return 'default';
        }
    };

    const getApprovalStatusIcon = (status) => {
        switch (status) {
            case 'Onaylandı': return <CheckCircle className="w-5 h-5 text-green-500" />;
            case 'Reddedildi': return <XCircle className="w-5 h-5 text-red-500" />;
            case 'Beklemede': return <Hourglass className="w-5 h-5 text-yellow-500" />;
            default: return null;
        }
    };

    // Açıklamayı profesyonel formatta göstermek için formatlama fonksiyonu
    const formatDescription = (text) => {
        if (!text) return '-';
        
        // Önce literal \n karakterlerini gerçek satır sonlarına çevir
        text = text.replace(/\\n/g, '\n');
        
        // Bilinen başlıkları kullanarak tek satırlık metni parçalara ayır
        const knownHeadings = [
            'Girdi Kalite Kontrol Kaydı',
            'Karantina Kaydı',
            'Kalitesizlik Maliyeti Kaydı',
            'Parça Kodu:',
            'Parça Adı:',
            'Red Edilen Miktar:',
            'Şartlı Kabul Miktarı:',
            'Tedarikçi:',
            'Karar:',
            'Teslimat No:',
            'Hata Detayları:',
            'Bu Parça İçin Sapma Onayı',
            'Bu Parça Için Sapma Onayı',
            'ÖLÇÜM SONUÇLARI',
            'Ölçüm Sonuçlari Ve Tespitler',
            'Ölçüm Sonuçları Ve Tespitler',
            'TESPİT EDİLEN HATALAR',
            'ÖLÇÜM ÖZETİ',
            'Ölçüm Özeti',
            'Uygunsuz Bulunan Ölçümler',
            'Beklenen Değer',
            'Tolerans Aralığı',
            'Gerçek Ölçülen Değer',
            'Sonuç:',
            'Ret Oranı',
            'Toplam Ölçüm Sayısı',
            'Uygun Ölçümler',
            'Uygunsuz Ölçümler',
        ];
        
        // Önce \n karakterlerini kontrol et
        let lines = text.split('\n').filter(line => line.trim() !== '');
        
        // Eğer tek satır ve bilinen başlıkları içeriyorsa, ayır
        if (lines.length === 1) {
            const singleLine = lines[0];
            const splits = [];
            
            // Başlıkları bul ve pozisyonlarını kaydet
            for (const heading of knownHeadings) {
                const regex = new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
                const matches = [...singleLine.matchAll(regex)];
                for (const match of matches) {
                    splits.push({
                        index: match.index,
                        heading: heading,
                    });
                }
            }
            
            // * ile başlayan maddeleri de bul
            const bulletRegex = /\s+\*\s+/g;
            const bulletMatches = [...singleLine.matchAll(bulletRegex)];
            for (const match of bulletMatches) {
                splits.push({
                    index: match.index,
                    heading: '*',
                });
            }
            
            // Pozisyonlara göre sırala
            splits.sort((a, b) => a.index - b.index);
            
            // Eğer başlık bulunduysa, metni ayır
            if (splits.length > 0) {
                const newLines = [];
                for (let i = 0; i < splits.length; i++) {
                    const start = splits[i].index;
                    const end = i < splits.length - 1 ? splits[i + 1].index : singleLine.length;
                    const line = singleLine.substring(start, end).trim();
                    if (line) {
                        newLines.push(line);
                    }
                }
                if (newLines.length > 0) {
                    lines = newLines;
                }
            }
        }
        
        return lines.map((line, idx) => {
            const trimmedLine = line.trim();
            
            // Ana başlık: "Girdi Kalite Kontrol Kaydı (25/12/077)"
            if (/^(Girdi Kalite Kontrol Kaydı|Karantina Kaydı|Kalitesizlik Maliyeti Kaydı)\s*\([^)]+\)/.test(trimmedLine)) {
                return (
                    <div key={idx} className="text-base font-bold text-primary mb-3 pb-2 border-b border-primary/30">
                        {trimmedLine}
                    </div>
                );
            }
            
            // Büyük bölüm başlıkları: "ÖLÇÜM SONUÇLARI VE TESPİTLER:", "TESPİT EDİLEN HATALAR:"
            if (/^[A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜ\s]+:/.test(trimmedLine)) {
                return (
                    <div key={idx} className="text-sm font-bold text-foreground mt-4 mb-2 uppercase">
                        {trimmedLine}
                    </div>
                );
            }
            
            // * ile başlayan maddeler
            if (/^\*\s+/.test(trimmedLine)) {
                return (
                    <div key={idx} className="text-sm text-foreground pl-4 py-1 flex items-start gap-2">
                        <span className="text-primary">•</span>
                        <span>{trimmedLine.substring(1).trim()}</span>
                    </div>
                );
            }
            
            // Numaralı liste öğeleri: "1. Minör Özellik (Ölçüm 1/1):" veya "1. Dış Cap..."
            if (/^\d+\.\s+[A-ZÇĞİÖŞÜa-zçğıöşü]/.test(trimmedLine)) {
                // Eğer içinde "Beklenen Değer", "Tolerans" gibi detaylar varsa, onları da ayır
                const detailParts = trimmedLine.split(/\s+(Beklenen Değer|Tolerans Aralığı|Gerçek Ölçülen Değer|Sonuç:)/i);
                if (detailParts.length > 1) {
                    // Ana başlık ve detayları ayır
                    const mainPart = detailParts[0].trim();
                    const details = [];
                    for (let i = 1; i < detailParts.length; i += 2) {
                        if (i + 1 < detailParts.length) {
                            details.push(`${detailParts[i]}${detailParts[i + 1]}`);
                        } else {
                            details.push(detailParts[i]);
                        }
                    }
                    return (
                        <div key={idx} className="mt-3 mb-1">
                            <div className="text-sm font-semibold text-foreground pl-2 border-l-2 border-primary/50">
                                {mainPart}
                            </div>
                            {details.map((detail, dIdx) => (
                                <div key={`${idx}-${dIdx}`} className="text-xs text-muted-foreground pl-6 py-0.5">
                                    {detail.trim()}
                                </div>
                            ))}
                        </div>
                    );
                }
                return (
                    <div key={idx} className="text-sm font-semibold text-foreground mt-3 mb-1 pl-2 border-l-2 border-primary/50">
                        {trimmedLine}
                    </div>
                );
            }
            
            // "Bu Parça İçin Sapma Onayı" gibi son cümleler
            if (/^Bu Parça/i.test(trimmedLine)) {
                return (
                    <div key={idx} className="text-sm font-medium text-primary mt-4 pt-2 border-t border-border">
                        {trimmedLine}
                    </div>
                );
            }
            
            // Key-value çiftleri: "Parça Kodu: 37-5000182657"
            const keyValueMatch = trimmedLine.match(/^([A-ZÇĞİÖŞÜa-zçğıöşü][A-ZÇĞİÖŞÜa-zçğıöşü\s/()]+):\s*(.+)$/);
            if (keyValueMatch) {
                const key = keyValueMatch[1].trim();
                let value = keyValueMatch[2].trim();
                
                // N/A yerine daha anlamlı metin
                if (value.toLowerCase() === 'n/a' || value.toLowerCase() === 'n/a adet') {
                    value = 'Belirtilmemiş';
                }
                
                return (
                    <div key={idx} className="flex flex-wrap gap-2 text-sm py-1">
                        <span className="font-medium text-muted-foreground min-w-[160px]">{key}:</span>
                        <span className="text-foreground">{value}</span>
                    </div>
                );
            }
            
            // Girintili detay satırları
            if (line.startsWith('   ') || line.startsWith('\t')) {
                return (
                    <div key={idx} className="text-sm text-muted-foreground pl-6 py-0.5">
                        {trimmedLine}
                    </div>
                );
            }
            
            // Normal paragraf
            return (
                <div key={idx} className="text-sm text-foreground py-1">
                    {trimmedLine}
                </div>
            );
        });
    };

    const handlePrint = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsPrinting(true);
        try {
            await openPrintableReport(deviation, 'deviation', true);
        } catch (error) {
            console.error("PDF generation failed:", error);
        } finally {
            setIsPrinting(false);
        }
    };

    const handleDownloadAttachment = async (filePath) => {
        const { data, error } = await supabase.storage.from('deviation_attachments').createSignedUrl(filePath, 60);
        if (error) {
            console.error('Error getting signed URL:', error);
            return;
        }
        window.open(data.signedUrl, '_blank');
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-4xl max-h-[90vh]">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <DialogTitle className="text-2xl font-bold text-primary flex items-center gap-2">
                                <AlertTriangle className="h-6 w-6" />
                                Sapma Detayı
                            </DialogTitle>
                            <DialogDescription className="mt-2">
                                Sapma kaydına ait tüm bilgiler aşağıda listelenmiştir.
                            </DialogDescription>
                        </div>
                        {deviation.status && (
                            <Badge variant="outline" className={`${
                                deviation.status === 'Onaylandı' ? 'bg-green-50 text-green-700 border-green-200' :
                                deviation.status === 'Reddedildi' ? 'bg-red-50 text-red-700 border-red-200' :
                                deviation.status === 'Onay Bekliyor' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                'bg-blue-50 text-blue-700 border-blue-200'
                            }`}>
                                {deviation.status === 'Onaylandı' && <CheckCircle className="h-3 w-3 mr-1" />}
                                {deviation.status === 'Reddedildi' && <XCircle className="h-3 w-3 mr-1" />}
                                {deviation.status === 'Onay Bekliyor' && <Hourglass className="h-3 w-3 mr-1" />}
                                {deviation.status}
                            </Badge>
                        )}
                    </div>
                </DialogHeader>
                
                <ScrollArea className="max-h-[65vh] pr-4 mt-4">
                    <div className="space-y-6">
                        {/* Önemli Bilgiler */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <InfoCard 
                                icon={Hash} 
                                label="Talep No" 
                                value={deviation.request_no} 
                                variant="primary"
                            />
                            <InfoCard 
                                icon={Calendar} 
                                label="Oluşturma Tarihi" 
                                value={deviation.created_at ? format(new Date(deviation.created_at), 'dd MMMM yyyy HH:mm', { locale: tr }) : '-'} 
                            />
                            <InfoCard 
                                icon={Car} 
                                label="Araç Tipi" 
                                value={deviation.vehicle_type || '-'} 
                                variant="warning"
                            />
                        </div>

                        {/* Kaynak Kayıt Bilgisi */}
                        {deviation.source_type && deviation.source_type !== 'manual' && (
                            <>
                                <Separator />
                                <div>
                                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                        <Link2 className="h-5 w-5 text-primary" />
                                        Kaynak Kayıt Bilgisi
                                    </h3>
                                    <Card className="border-2 border-primary">
                                        <CardContent className="p-4">
                                            <div className="flex items-start gap-3">
                                                {deviation.source_type === 'incoming_inspection' && (
                                                    <Package className="h-5 w-5 text-blue-500 mt-1" />
                                                )}
                                                {deviation.source_type === 'quarantine' && (
                                                    <AlertTriangle className="h-5 w-5 text-yellow-500 mt-1" />
                                                )}
                                                {deviation.source_type === 'quality_cost' && (
                                                    <DollarSign className="h-5 w-5 text-green-500 mt-1" />
                                                )}
                                                <div className="flex-1">
                                                    <Badge variant="outline" className="mb-3">
                                                        {deviation.source_type === 'incoming_inspection' && 'Girdi Kalite Kontrol'}
                                                        {deviation.source_type === 'quarantine' && 'Karantina'}
                                                        {deviation.source_type === 'quality_cost' && 'Kalitesizlik Maliyeti'}
                                                    </Badge>
                                                    {deviation.source_record_details && (
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                                                            {deviation.source_record_details.part_code && (
                                                                <InfoCard 
                                                                    icon={Package} 
                                                                    label="Parça Kodu" 
                                                                    value={deviation.source_record_details.part_code}
                                                                />
                                                            )}
                                                            {deviation.source_record_details.quantity && (
                                                                <InfoCard 
                                                                    icon={Package} 
                                                                    label="Miktar" 
                                                                    value={deviation.source_record_details.quantity}
                                                                />
                                                            )}
                                                            {deviation.source_record_details.supplier && (
                                                                <InfoCard 
                                                                    icon={Building2} 
                                                                    label="Tedarikçi" 
                                                                    value={deviation.source_record_details.supplier}
                                                                    variant="warning"
                                                                />
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            </>
                        )}

                        <Separator />

                        {/* Genel Bilgiler */}
                        <div>
                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <FileText className="h-5 w-5 text-primary" />
                                Genel Bilgiler
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {deviation.part_code && (
                                    <InfoCard icon={Package} label="Parça Kodu" value={deviation.part_code} />
                                )}
                                {deviation.source && (
                                    <InfoCard icon={AlertTriangle} label="Kaynak" value={deviation.source} variant="warning" />
                                )}
                                {deviation.requesting_unit && (
                                    <InfoCard icon={Building2} label="Talep Eden Birim" value={deviation.requesting_unit} />
                                )}
                                {deviation.requesting_person && (
                                    <InfoCard icon={User} label="Talep Eden Kişi" value={deviation.requesting_person} />
                                )}
                            </div>
                        </div>

                        <Separator />

                        {/* Açıklama */}
                        <div>
                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <FileText className="h-5 w-5 text-primary" />
                                Sapma Detayları
                            </h3>
                            <Card className="bg-muted/30">
                                <CardContent className="p-6">
                                    <div className="space-y-1">
                                        {formatDescription(deviation.description)}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <Separator />

                        {/* Detaylı Bilgiler */}
                        <Tabs defaultValue="approvals" className="w-full">
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="approvals">Onay Süreci</TabsTrigger>
                                <TabsTrigger value="vehicles">İlgili Araçlar</TabsTrigger>
                                <TabsTrigger value="attachments">Ekler</TabsTrigger>
                            </TabsList>
                            <TabsContent value="approvals" className="p-4">
                                <div className="space-y-4">
                                    {deviation.deviation_approvals && deviation.deviation_approvals.length > 0 ? (
                                        deviation.deviation_approvals.map(approval => (
                                            <Card key={approval.id} className="border-l-4 border-l-primary">
                                                <CardContent className="p-4">
                                                    <div className="flex items-start gap-4">
                                                        <div className="flex-shrink-0">{getApprovalStatusIcon(approval.status)}</div>
                                                        <div className="flex-grow">
                                                            <p className="font-semibold text-lg">{approval.approval_stage}</p>
                                                            <p className="text-sm text-muted-foreground mt-1">
                                                                <User className="w-4 h-4 inline mr-1" />
                                                                Onaylayan: {approval.approver_name || 'Bekleniyor'}
                                                            </p>
                                                            {approval.notes && (
                                                                <div className="mt-2 p-3 bg-muted/50 rounded-lg">
                                                                    <p className="text-sm italic">"{approval.notes}"</p>
                                                                </div>
                                                            )}
                                                            <p className="text-xs text-muted-foreground mt-2">
                                                                <Calendar className="w-3 h-3 inline mr-1" />
                                                                {format(new Date(approval.created_at), 'dd.MM.yyyy HH:mm', { locale: tr })}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))
                                    ) : (
                                        <Card>
                                            <CardContent className="p-6">
                                                <p className="text-center text-muted-foreground">Onay kaydı bulunamadı.</p>
                                            </CardContent>
                                        </Card>
                                    )}
                                </div>
                            </TabsContent>
                            <TabsContent value="vehicles" className="p-4">
                                <div className="space-y-3">
                                    {deviation.deviation_vehicles && deviation.deviation_vehicles.length > 0 ? (
                                        deviation.deviation_vehicles.map(vehicle => (
                                            <Card key={vehicle.id}>
                                                <CardContent className="p-4">
                                                    <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-3">
                                                        <div className="flex items-center gap-2">
                                                            <Truck className="w-5 h-5 text-primary" />
                                                            <span className="font-semibold">{deviation.vehicle_type || 'Bilinmiyor'}</span>
                                                        </div>
                                                        <p className="font-mono text-sm">{vehicle.chassis_no || vehicle.vehicle_serial_no}</p>
                                                        <p className="text-sm text-muted-foreground">{vehicle.customer_name}</p>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))
                                    ) : (
                                        <Card>
                                            <CardContent className="p-6">
                                                <p className="text-center text-muted-foreground">İlgili araç kaydı bulunamadı.</p>
                                            </CardContent>
                                        </Card>
                                    )}
                                </div>
                            </TabsContent>
                            <TabsContent value="attachments" className="p-4">
                                <div className="space-y-2">
                                    {deviation.deviation_attachments && deviation.deviation_attachments.length > 0 ? (
                                        deviation.deviation_attachments.map(att => (
                                            <Card key={att.id}>
                                                <CardContent className="p-4">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <FileText className="w-5 h-5 text-muted-foreground" />
                                                            <span className="text-sm font-medium">{att.file_name}</span>
                                                        </div>
                                                        <Button variant="ghost" size="icon" onClick={() => handleDownloadAttachment(att.file_path)}>
                                                            <Download className="w-5 h-5" />
                                                        </Button>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))
                                    ) : (
                                        <Card>
                                            <CardContent className="p-6">
                                                <p className="text-center text-muted-foreground">Ekli dosya bulunmuyor.</p>
                                            </CardContent>
                                        </Card>
                                    )}
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>
                </ScrollArea>

                <DialogFooter className="mt-6">
                    <Button type="button" variant="outline" onClick={handlePrint} disabled={isPrinting}>
                        {isPrinting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                        Yazdır / PDF
                    </Button>
                    <DialogClose asChild>
                        <Button type="button" variant="secondary" size="lg">Kapat</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default DeviationDetailModal;
