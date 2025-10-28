import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileDown, X } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useToast } from '@/components/ui/use-toast';

const InkrDetailModal = ({
    isOpen,
    setIsOpen,
    inkr,
    onDownloadPDF,
}) => {
    const { toast } = useToast();
    const [preparedBy, setPreparedBy] = useState('');
    const [controlledBy, setControlledBy] = useState('');
    const [createdBy, setCreatedBy] = useState('');

    const handleGenerateReport = async () => {
        try {
            const enrichedData = {
                ...inkr,
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

    if (!inkr) return null;

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>INKR Detayları</DialogTitle>
                    <DialogDescription>
                        INKR No: {inkr.inkr_number} • Tarih:{' '}
                        {format(
                            new Date(inkr.report_date || inkr.created_at),
                            'dd MMMM yyyy',
                            { locale: tr }
                        )}
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="basic" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="basic">Temel Bilgiler</TabsTrigger>
                        <TabsTrigger value="details">Muayene Sonuçları</TabsTrigger>
                        <TabsTrigger value="report">Rapor</TabsTrigger>
                    </TabsList>

                    {/* TAB 1: TEMEL BİLGİLER */}
                    <TabsContent value="basic" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>INKR Bilgileri</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label className="text-gray-600">INKR Numarası</Label>
                                        <p className="font-medium">{inkr.inkr_number || '-'}</p>
                                    </div>
                                    <div>
                                        <Label className="text-gray-600">Ürün Adı</Label>
                                        <p className="font-medium">{inkr.part_name || '-'}</p>
                                    </div>
                                    <div>
                                        <Label className="text-gray-600">Ürün Kodu</Label>
                                        <p className="font-medium">{inkr.part_code || '-'}</p>
                                    </div>
                                    <div>
                                        <Label className="text-gray-600">Tedarikçi</Label>
                                        <p className="font-medium">{inkr.supplier_name || '-'}</p>
                                    </div>
                                    <div>
                                        <Label className="text-gray-600">Rapor Tarihi</Label>
                                        <p className="font-medium">
                                            {format(
                                                new Date(inkr.report_date || inkr.created_at),
                                                'dd.MM.yyyy'
                                            )}
                                        </p>
                                    </div>
                                    <div>
                                        <Label className="text-gray-600">Durum</Label>
                                        <p className="font-medium">{inkr.status || 'Aktif'}</p>
                                    </div>
                                </div>
                                {inkr.notes && (
                                    <div>
                                        <Label className="text-gray-600">Notlar</Label>
                                        <p className="font-medium whitespace-pre-wrap">
                                            {inkr.notes}
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* TAB 2: MUAYENE SONUÇLARI */}
                    <TabsContent value="details" className="space-y-4">
                        {inkr.test_results && inkr.test_results.length > 0 ? (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Test Sonuçları</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        {inkr.test_results.map((result, idx) => (
                                            <div
                                                key={idx}
                                                className="border rounded p-3 bg-gray-50"
                                            >
                                                <p className="font-semibold">
                                                    {result.test_name || `Test ${idx + 1}`}
                                                </p>
                                                <p className="text-sm text-gray-600">
                                                    Sonuç: {result.result || '-'}
                                                </p>
                                                {result.description && (
                                                    <p className="text-sm">
                                                        Açıklama: {result.description}
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        ) : (
                            <Card>
                                <CardContent className="pt-6">
                                    <p className="text-gray-500">Test sonucu bulunamadı.</p>
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>

                    {/* TAB 3: RAPOR */}
                    <TabsContent value="report" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Rapor Bilgileri</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <Label htmlFor="preparedBy">Hazırlayan</Label>
                                    <Input
                                        id="preparedBy"
                                        placeholder="Ad Soyad"
                                        value={preparedBy}
                                        onChange={(e) => setPreparedBy(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="controlledBy">Kontrol Eden</Label>
                                    <Input
                                        id="controlledBy"
                                        placeholder="Ad Soyad"
                                        value={controlledBy}
                                        onChange={(e) => setControlledBy(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="createdBy">Onaylayan</Label>
                                    <Input
                                        id="createdBy"
                                        placeholder="Ad Soyad"
                                        value={createdBy}
                                        onChange={(e) => setCreatedBy(e.target.value)}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        <div className="flex gap-2 justify-end">
                            <Button variant="outline" onClick={() => setIsOpen(false)}>
                                <X className="mr-2 h-4 w-4" /> Kapat
                            </Button>
                            <Button
                                onClick={handleGenerateReport}
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                <FileDown className="mr-2 h-4 w-4" /> Rapor Al
                            </Button>
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
};

export default InkrDetailModal;
