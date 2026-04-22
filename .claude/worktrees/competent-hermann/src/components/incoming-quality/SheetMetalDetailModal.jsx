import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileDown, ExternalLink, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';

const SheetMetalDetailModal = ({
    isOpen,
    setIsOpen,
    record,
    onDownloadPDF,
}) => {
    const { toast } = useToast();
    const [preparedBy, setPreparedBy] = useState('');
    const [controlledBy, setControlledBy] = useState('');
    const [createdBy, setCreatedBy] = useState('');
    const [signedUrls, setSignedUrls] = useState({});

    // Sertifika signed URL'lerini oluştur
    useEffect(() => {
        const generateSignedUrls = async () => {
            if (!record || !record.sheet_metal_items) return;
            
            const urls = {};
            for (const item of record.sheet_metal_items) {
                if (item.certificates && Array.isArray(item.certificates)) {
                    for (const cert of item.certificates) {
                        const certPath = typeof cert === 'string' ? cert : cert.path;
                        if (certPath && !urls[certPath]) {
                            try {
                                const { data, error } = await supabase.storage
                                    .from('incoming_control')
                                    .createSignedUrl(certPath, 3600);
                                
                                if (!error && data?.signedUrl) {
                                    urls[certPath] = data.signedUrl;
                                }
                            } catch (err) {
                                console.error('Sertifika URL oluşturma hatası:', err);
                            }
                        }
                    }
                }
            }
            setSignedUrls(urls);
        };

        if (isOpen && record) {
            generateSignedUrls();
        }
    }, [isOpen, record]);

    const getDecisionBadge = (decision) => {
        switch (decision) {
            case 'Kabul':
            case 'Kabul Edildi':
                return <Badge className="bg-green-500">✓ Kabul</Badge>;
            case 'Ret':
                return <Badge className="bg-red-500">✕ Ret</Badge>;
            default:
                return <Badge variant="secondary">Beklemede</Badge>;
        }
    };

    const handleGenerateReport = async () => {
        try {
            const enrichedData = {
                ...record,
                sheet_metal_items: record.sheet_metal_items || [],
                prepared_by: preparedBy || '',
                controlled_by: controlledBy || '',
                created_by: createdBy || '',
            };
            onDownloadPDF(enrichedData);
            toast({
                title: 'Başarılı',
                description: 'Rapor oluşturuldu!',
            });
            setIsOpen(false);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Rapor oluşturulamadı!',
            });
        }
    };

    if (!record) return null;

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
                <DialogHeader className="sr-only"><DialogTitle>Sac Malzeme - Detay Görünümü</DialogTitle></DialogHeader>
                <header className="bg-gradient-to-r from-primary to-blue-700 px-6 py-5 flex items-center justify-between text-white shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/20 p-2.5 rounded-lg"><FileText className="h-5 w-5 text-white" /></div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight">Sac Malzeme - Detay Görünümü</h1>
                            <p className="text-[11px] text-blue-100 uppercase tracking-[0.15em] font-medium">{record.delivery_note_number || '-'} • {record.entry_date ? format(new Date(record.entry_date), 'dd MMMM yyyy', { locale: tr }) : '-'}</p>
                        </div>
                        <span className="px-3 py-1 bg-white/20 border border-white/30 text-white/90 text-[10px] font-bold rounded-full uppercase tracking-wider">Detay</span>
                    </div>
                </header>
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-4 pb-6">
                <Tabs defaultValue="main" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="main">Temel Bilgiler</TabsTrigger>
                        <TabsTrigger value="details">Detaylı Ölçümler</TabsTrigger>
                        <TabsTrigger value="report">Rapor</TabsTrigger>
                    </TabsList>

                    {/* TAB 1: TEMEL BİLGİLER */}
                    <TabsContent value="main" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Giriş Bilgileri</CardTitle>
                            </CardHeader>
                            <CardContent className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-xs font-semibold text-muted-foreground">Tedarikçi</Label>
                                    <p className="font-medium">{record.supplier?.name || record.supplier_name || '-'}</p>
                                </div>
                                <div>
                                    <Label className="text-xs font-semibold text-muted-foreground">Teslimat Belgesi (İrsaliye No)</Label>
                                    <p className="font-medium">{record.delivery_note_number || '-'}</p>
                                </div>
                                <div>
                                    <Label className="text-xs font-semibold text-muted-foreground">Giriş Tarihi</Label>
                                    <p className="font-medium">{record.entry_date ? format(new Date(record.entry_date), 'dd.MM.yyyy') : '-'}</p>
                                </div>
                                <div>
                                    <Label className="text-xs font-semibold text-muted-foreground">Toplam Kalem Sayısı</Label>
                                    <p className="font-medium">{record.sheet_metal_items?.length || 0} Adet</p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Kalem Detayları Notu</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="bg-blue-50 border border-blue-200 rounded p-3">
                                    <p className="text-sm text-blue-900">
                                        ℹ️ Bu giriş {record.sheet_metal_items?.length || 0} adet kalem içermektedir. 
                                        Tüm kalem detaylarını "Detaylı Ölçümler" sekmesinde görebilirsiniz.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* TAB 2: DETAYLI ÖLÇÜMLER */}
                    <TabsContent value="details" className="space-y-4">
                        {record.sheet_metal_items && record.sheet_metal_items.length > 0 ? (
                            record.sheet_metal_items.map((item, idx) => (
                                <div key={item.id || idx} className="space-y-4">
                                    <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
                                        <h4 className="font-semibold text-sm text-blue-900">Kalem {idx + 1}</h4>
                                    </div>

                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-base">Malzeme Özellikleri</CardTitle>
                                        </CardHeader>
                                        <CardContent className="grid grid-cols-2 gap-4">
                                            <div>
                                                <Label className="text-xs font-semibold text-muted-foreground">Uzunluk (mm)</Label>
                                                <p className="font-medium">{item.uzunluk || '-'}</p>
                                            </div>
                                            <div>
                                                <Label className="text-xs font-semibold text-muted-foreground">Genişlik (mm)</Label>
                                                <p className="font-medium">{item.genislik || '-'}</p>
                                            </div>
                                            <div>
                                                <Label className="text-xs font-semibold text-muted-foreground">Kalınlık (mm)</Label>
                                                <p className="font-medium">{item.kalinlik || '-'}</p>
                                            </div>
                                            <div>
                                                <Label className="text-xs font-semibold text-muted-foreground">Kalite</Label>
                                                <p className="font-medium">{item.material_quality || '-'}</p>
                                            </div>
                                            <div>
                                                <Label className="text-xs font-semibold text-muted-foreground">Standart</Label>
                                                <p className="font-medium">{item.malzeme_standarti || '-'}</p>
                                            </div>
                                            <div>
                                                <Label className="text-xs font-semibold text-muted-foreground">Ağırlık (kg)</Label>
                                                <p className="font-medium">{item.weight || '-'}</p>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-base">Lot & Referans Bilgileri</CardTitle>
                                        </CardHeader>
                                        <CardContent className="grid grid-cols-2 gap-4">
                                            <div>
                                                <Label className="text-xs font-semibold text-muted-foreground">Lot No</Label>
                                                <p className="font-medium">{item.lot_number || '-'}</p>
                                            </div>
                                            <div>
                                                <Label className="text-xs font-semibold text-muted-foreground">Heat No (Şarj)</Label>
                                                <p className="font-medium">{item.heat_number || '-'}</p>
                                            </div>
                                            <div>
                                                <Label className="text-xs font-semibold text-muted-foreground">Coil No (Bobin)</Label>
                                                <p className="font-medium">{item.coil_no || '-'}</p>
                                            </div>
                                            <div>
                                                <Label className="text-xs font-semibold text-muted-foreground">Sertifika Türü</Label>
                                                <p className="font-medium">{item.sertifika_turu || '-'}</p>
                                            </div>
                                            <div>
                                                <Label className="text-xs font-semibold text-muted-foreground">Miktar</Label>
                                                <p className="font-medium">{item.quantity || '-'}</p>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-base">Test Sonuçları</CardTitle>
                                        </CardHeader>
                                        <CardContent className="grid grid-cols-2 gap-4">
                                            <div>
                                                <Label className="text-xs font-semibold text-muted-foreground">Sertlik (HRB/HRC)</Label>
                                                <p className="font-medium">{item.hardness || '-'}</p>
                                            </div>
                                            <div>
                                                <Label className="text-xs font-semibold text-muted-foreground">Karar</Label>
                                                <p className="font-medium">{getDecisionBadge(item.decision)}</p>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {item.certificates && item.certificates.length > 0 && (
                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="text-base">Sertifika Bilgileri</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="flex flex-wrap gap-2">
                                                    {item.certificates.map((cert, cidx) => {
                                                        const certPath = typeof cert === 'string' ? cert : cert.path;
                                                        const signedUrl = certPath ? signedUrls[certPath] : null;
                                                        
                                                        return signedUrl ? (
                                                            <a
                                                                key={cidx}
                                                                href={signedUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors font-medium text-sm"
                                                            >
                                                                <FileText className="h-4 w-4" />
                                                                Sertifika Görüntüle {item.certificates.length > 1 ? `(${cidx + 1})` : ''}
                                                                <ExternalLink className="h-3 w-3" />
                                                            </a>
                                                        ) : (
                                                            <Button key={cidx} disabled variant="outline" className="inline-flex items-center gap-2">
                                                                <FileText className="h-4 w-4" />
                                                                Yükleniyor...
                                                            </Button>
                                                        );
                                                    })}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )}
                                    {idx < (record.sheet_metal_items.length - 1) && <hr className="my-6" />}
                                </div>
                            ))
                        ) : (
                            <Card>
                                <CardContent className="p-4 text-center text-muted-foreground">
                                    Kalem bilgisi bulunamadı
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>

                    {/* TAB 3: RAPOR */}
                    <TabsContent value="report" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">İmza Bilgileri</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div>
                                    <Label className="text-sm font-semibold">Hazırlayan (Ad Soyad)</Label>
                                    <Input
                                        placeholder="Hazırlayan adını girin..."
                                        value={preparedBy}
                                        onChange={(e) => setPreparedBy(e.target.value)}
                                        className="mt-1"
                                    />
                                </div>
                                <div>
                                    <Label className="text-sm font-semibold">Kontrol Eden (Ad Soyad)</Label>
                                    <Input
                                        placeholder="Kontrol eden adını girin..."
                                        value={controlledBy}
                                        onChange={(e) => setControlledBy(e.target.value)}
                                        className="mt-1"
                                    />
                                </div>
                                <div>
                                    <Label className="text-sm font-semibold">Onaylayan (Ad Soyad)</Label>
                                    <Input
                                        placeholder="Onaylayan adını girin..."
                                        value={createdBy}
                                        onChange={(e) => setCreatedBy(e.target.value)}
                                        className="mt-1"
                                    />
                                </div>
                                <div className="bg-blue-50 border border-blue-200 rounded p-3">
                                    <p className="text-xs text-blue-700">
                                        💡 Bu isimler PDF raporunda imzalayan kişiler olarak gösterilecektir.
                                        Boş bırakırsanız ıslak imza için PDF'te boş gelir.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
                </div>

                <DialogFooter className="gap-2 shrink-0">
                    <Button variant="outline" onClick={() => setIsOpen(false)}>
                        Kapat
                    </Button>
                    <Button onClick={handleGenerateReport} className="gap-2">
                        <FileDown className="h-4 w-4" />
                        Rapor Oluştur & İndir
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default SheetMetalDetailModal;
