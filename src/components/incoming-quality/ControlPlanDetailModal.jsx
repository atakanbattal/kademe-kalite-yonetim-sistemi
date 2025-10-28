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
import { FileDown, CheckCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useToast } from '@/components/ui/use-toast';

const ControlPlanDetailModal = ({
    isOpen,
    setIsOpen,
    record,
    onDownloadPDF,
}) => {
    const { toast } = useToast();
    const [preparedBy, setPreparedBy] = useState('');
    const [controlledBy, setControlledBy] = useState('');
    const [createdBy, setCreatedBy] = useState('');

    const handleGenerateReport = async () => {
        try {
            const enrichedData = {
                ...record,
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
                    <DialogTitle>Kontrol Planı - Detay Görünümü</DialogTitle>
                </DialogHeader>

                <Tabs defaultValue="main" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="main">Temel Bilgiler</TabsTrigger>
                        <TabsTrigger value="sampling">Örnekleme Planı</TabsTrigger>
                        <TabsTrigger value="report">Rapor</TabsTrigger>
                    </TabsList>

                    {/* TAB 1: TEMEL BİLGİLER */}
                    <TabsContent value="main" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Parça Bilgileri</CardTitle>
                            </CardHeader>
                            <CardContent className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-xs font-semibold text-muted-foreground">Parça Kodu</Label>
                                    <p className="font-medium">{record.part_code || '-'}</p>
                                </div>
                                <div>
                                    <Label className="text-xs font-semibold text-muted-foreground">Parça Adı</Label>
                                    <p className="font-medium">{record.part_name || '-'}</p>
                                </div>
                                <div>
                                    <Label className="text-xs font-semibold text-muted-foreground">Revizyon</Label>
                                    <p className="font-medium">{record.revision || '-'}</p>
                                </div>
                                <div>
                                    <Label className="text-xs font-semibold text-muted-foreground">Geçerli Mi?</Label>
                                    <p className="font-medium">
                                        {record.is_current ? (
                                            <Badge className="bg-green-500">✓ Güncel</Badge>
                                        ) : (
                                            <Badge variant="secondary">Eski Versiyon</Badge>
                                        )}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Muayene Türü & Örnekleme</CardTitle>
                            </CardHeader>
                            <CardContent className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-xs font-semibold text-muted-foreground">Muayene Türü</Label>
                                    <p className="font-medium">{record.inspection_type || '-'}</p>
                                </div>
                                <div>
                                    <Label className="text-xs font-semibold text-muted-foreground">Örnekleme Seviyesi</Label>
                                    <p className="font-medium">{record.sampling_level || '-'}</p>
                                </div>
                                <div>
                                    <Label className="text-xs font-semibold text-muted-foreground">Örnek Boyutu</Label>
                                    <p className="font-medium">{record.sample_size ? `${record.sample_size} Adet` : '-'}</p>
                                </div>
                                <div>
                                    <Label className="text-xs font-semibold text-muted-foreground">Kabul Kriteri (AQL)</Label>
                                    <p className="font-medium">{record.aql || '-'}</p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Ek Bilgiler</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div>
                                    <Label className="text-xs font-semibold text-muted-foreground">Açıklama</Label>
                                    <p className="text-sm whitespace-pre-wrap">{record.description || 'Açıklama bulunmamaktadır.'}</p>
                                </div>
                                <div>
                                    <Label className="text-xs font-semibold text-muted-foreground">Oluşturulma Tarihi</Label>
                                    <p className="font-medium">{record.created_at ? format(new Date(record.created_at), 'dd.MM.yyyy HH:mm', { locale: tr }) : '-'}</p>
                                </div>
                                <div>
                                    <Label className="text-xs font-semibold text-muted-foreground">Son Güncellenme</Label>
                                    <p className="font-medium">{record.updated_at ? format(new Date(record.updated_at), 'dd.MM.yyyy HH:mm', { locale: tr }) : '-'}</p>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* TAB 2: ÖRNEKLEME PLANI */}
                    <TabsContent value="sampling" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Örnekleme Plan Detayları</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs border border-gray-300">
                                        <tbody>
                                            <tr className="border-b">
                                                <td className="p-2 font-semibold bg-gray-100 border-r w-1/2">Özellik</td>
                                                <td className="p-2 bg-gray-100">Değer</td>
                                            </tr>
                                            <tr className="border-b">
                                                <td className="p-2 font-semibold border-r">Muayene Türü</td>
                                                <td className="p-2">{record.inspection_type || '-'}</td>
                                            </tr>
                                            <tr className="border-b">
                                                <td className="p-2 font-semibold border-r">Örnekleme Seviyesi</td>
                                                <td className="p-2">{record.sampling_level || '-'}</td>
                                            </tr>
                                            <tr className="border-b">
                                                <td className="p-2 font-semibold border-r">Örnek Boyutu</td>
                                                <td className="p-2">{record.sample_size ? `${record.sample_size} Adet` : '-'}</td>
                                            </tr>
                                            <tr className="border-b">
                                                <td className="p-2 font-semibold border-r">AQL (Kabul Kriteri)</td>
                                                <td className="p-2">{record.aql || '-'}</td>
                                            </tr>
                                            <tr className="border-b">
                                                <td className="p-2 font-semibold border-r">Geçerli Durum</td>
                                                <td className="p-2">{record.is_current ? 'Evet (Güncel)' : 'Hayır (Eski Versiyon)'}</td>
                                            </tr>
                                            <tr>
                                                <td className="p-2 font-semibold border-r">Revizyon</td>
                                                <td className="p-2">{record.revision || '-'}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>

                        {record.description && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Plan Açıklaması</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm whitespace-pre-wrap bg-gray-50 p-3 rounded border border-gray-200">
                                        {record.description}
                                    </p>
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

export default ControlPlanDetailModal;
