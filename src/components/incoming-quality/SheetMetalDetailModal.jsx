import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileDown } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useToast } from '@/components/ui/use-toast';

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
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Sac Malzeme - Detay Görünümü</DialogTitle>
                </DialogHeader>

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
                                <CardTitle className="text-base">Tedarikçi & Teslimat</CardTitle>
                            </CardHeader>
                            <CardContent className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-xs font-semibold text-muted-foreground">Tedarikçi</Label>
                                    <p className="font-medium">{record.supplier?.name || record.supplier_name || '-'}</p>
                                </div>
                                <div>
                                    <Label className="text-xs font-semibold text-muted-foreground">Teslimat Belgesi</Label>
                                    <p className="font-medium">{record.delivery_note_number || '-'}</p>
                                </div>
                                <div>
                                    <Label className="text-xs font-semibold text-muted-foreground">Giriş Tarihi</Label>
                                    <p className="font-medium">{record.entry_date ? format(new Date(record.entry_date), 'dd.MM.yyyy') : '-'}</p>
                                </div>
                                <div>
                                    <Label className="text-xs font-semibold text-muted-foreground">Karar</Label>
                                    <p className="font-medium">{getDecisionBadge(record.decision)}</p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Malzeme Özellikleri</CardTitle>
                            </CardHeader>
                            <CardContent className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-xs font-semibold text-muted-foreground">Uzunluk</Label>
                                    <p className="font-medium">{record.uzunluk || '-'} mm</p>
                                </div>
                                <div>
                                    <Label className="text-xs font-semibold text-muted-foreground">Genişlik</Label>
                                    <p className="font-medium">{record.genislik || '-'} mm</p>
                                </div>
                                <div>
                                    <Label className="text-xs font-semibold text-muted-foreground">Kalınlık</Label>
                                    <p className="font-medium">{record.kalinlik || '-'} mm</p>
                                </div>
                                <div>
                                    <Label className="text-xs font-semibold text-muted-foreground">Ağırlık</Label>
                                    <p className="font-medium">{record.weight || '-'} kg</p>
                                </div>
                                <div>
                                    <Label className="text-xs font-semibold text-muted-foreground">Malzeme Kalitesi</Label>
                                    <p className="font-medium">{record.material_quality || '-'}</p>
                                </div>
                                <div>
                                    <Label className="text-xs font-semibold text-muted-foreground">Malzeme Standardı</Label>
                                    <p className="font-medium">{record.malzeme_standarti || '-'}</p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Lot & Referans Bilgileri</CardTitle>
                            </CardHeader>
                            <CardContent className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-xs font-semibold text-muted-foreground">Lot Numarası</Label>
                                    <p className="font-medium">{record.lot_number || '-'}</p>
                                </div>
                                <div>
                                    <Label className="text-xs font-semibold text-muted-foreground">Heat Numarası</Label>
                                    <p className="font-medium">{record.heat_number || '-'}</p>
                                </div>
                                <div>
                                    <Label className="text-xs font-semibold text-muted-foreground">Coil No</Label>
                                    <p className="font-medium">{record.coil_no || '-'}</p>
                                </div>
                                <div>
                                    <Label className="text-xs font-semibold text-muted-foreground">Miktar</Label>
                                    <p className="font-medium">{record.quantity || '-'}</p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Test Sonuçları</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div>
                                    <Label className="text-xs font-semibold text-muted-foreground">Sertlik (Hardness)</Label>
                                    <p className="font-medium">{record.hardness || 'Belirtilmemiş'}</p>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* TAB 2: DETAYLI ÖLÇÜMLER */}
                    <TabsContent value="details" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Sertifika Bilgileri</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {record.certificates && record.certificates.length > 0 ? (
                                    <div className="space-y-2">
                                        {record.certificates.map((cert, idx) => (
                                            <div key={idx} className="p-2 border rounded bg-gray-50">
                                                <p className="text-sm font-semibold">Sertifika {idx + 1}</p>
                                                <p className="text-xs text-gray-600">Yol: {cert.path || '-'}</p>
                                                <p className="text-xs text-gray-600">Tür: {cert.sertifika_turu || '-'}</p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500">Sertifika bilgisi bulunamadı.</p>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Detaylı Boyutlar Tablosu</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs border border-gray-300">
                                        <tbody>
                                            <tr className="border-b">
                                                <td className="p-2 font-semibold bg-gray-100 border-r">Özellık</td>
                                                <td className="p-2 bg-gray-100">Değer</td>
                                            </tr>
                                            <tr className="border-b">
                                                <td className="p-2 font-semibold border-r">Uzunluk (mm)</td>
                                                <td className="p-2">{record.uzunluk || '-'}</td>
                                            </tr>
                                            <tr className="border-b">
                                                <td className="p-2 font-semibold border-r">Genişlik (mm)</td>
                                                <td className="p-2">{record.genislik || '-'}</td>
                                            </tr>
                                            <tr className="border-b">
                                                <td className="p-2 font-semibold border-r">Kalınlık (mm)</td>
                                                <td className="p-2">{record.kalinlik || '-'}</td>
                                            </tr>
                                            <tr className="border-b">
                                                <td className="p-2 font-semibold border-r">Ağırlık (kg)</td>
                                                <td className="p-2">{record.weight || '-'}</td>
                                            </tr>
                                            <tr className="border-b">
                                                <td className="p-2 font-semibold border-r">Sertlik</td>
                                                <td className="p-2">{record.hardness || '-'}</td>
                                            </tr>
                                            <tr className="border-b">
                                                <td className="p-2 font-semibold border-r">Malzeme Kalitesi</td>
                                                <td className="p-2">{record.material_quality || '-'}</td>
                                            </tr>
                                            <tr>
                                                <td className="p-2 font-semibold border-r">Malzeme Standardı</td>
                                                <td className="p-2">{record.malzeme_standarti || '-'}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
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

                <DialogFooter className="gap-2">
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
