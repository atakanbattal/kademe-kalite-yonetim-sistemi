import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
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

const StockRiskDetailModal = ({
    isOpen,
    setIsOpen,
    record,
    onDownloadPDF,
}) => {
    const { toast } = useToast();
    const [preparedBy, setPreparedBy] = useState('');
    const [controlledBy, setControlledBy] = useState('');
    const [createdBy, setCreatedBy] = useState('');

    const getRiskBadge = (riskLevel) => {
        switch (riskLevel?.toLowerCase()) {
            case 'yüksek':
                return <span className="px-2 py-1 bg-red-100 text-red-800 rounded">🔴 Yüksek</span>;
            case 'orta':
                return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded">🟡 Orta</span>;
            case 'düşük':
                return <span className="px-2 py-1 bg-green-100 text-green-800 rounded">🟢 Düşük</span>;
            default:
                return <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded">Tanımsız</span>;
        }
    };

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
                    <DialogTitle>Stok Risk Kontrolü Detayları</DialogTitle>
                    <DialogDescription>
                        Kontrol No: {record.control_number} • Tarih:{' '}
                        {format(
                            new Date(record.control_date || record.created_at),
                            'dd MMMM yyyy',
                            { locale: tr }
                        )}
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="basic" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="basic">Temel Bilgiler</TabsTrigger>
                        <TabsTrigger value="details">Risk Detayları</TabsTrigger>
                        <TabsTrigger value="report">Rapor</TabsTrigger>
                    </TabsList>

                    {/* TAB 1: TEMEL BİLGİLER */}
                    <TabsContent value="basic" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Kontrol Bilgileri</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label className="text-gray-600">Kontrol Numarası</Label>
                                        <p className="font-medium">{record.control_number || '-'}</p>
                                    </div>
                                    <div>
                                        <Label className="text-gray-600">Ürün / Lot</Label>
                                        <p className="font-medium">{record.product_lot || '-'}</p>
                                    </div>
                                    <div>
                                        <Label className="text-gray-600">Risk Türü</Label>
                                        <p className="font-medium">{record.risk_type || '-'}</p>
                                    </div>
                                    <div>
                                        <Label className="text-gray-600">Risk Seviyesi</Label>
                                        <div>{getRiskBadge(record.risk_level)}</div>
                                    </div>
                                    <div>
                                        <Label className="text-gray-600">Tespit Tarihi</Label>
                                        <p className="font-medium">
                                            {format(
                                                new Date(record.control_date || record.created_at),
                                                'dd.MM.yyyy'
                                            )}
                                        </p>
                                    </div>
                                    <div>
                                        <Label className="text-gray-600">Durum</Label>
                                        <p className="font-medium">{record.status || 'Açık'}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* TAB 2: RİSK DETAYLARI */}
                    <TabsContent value="details" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Risk ve İşlemler</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {record.risk_description && (
                                    <div>
                                        <Label className="text-gray-600">Risk Açıklaması</Label>
                                        <p className="font-medium whitespace-pre-wrap">
                                            {record.risk_description}
                                        </p>
                                    </div>
                                )}
                                {record.actions_taken && (
                                    <div>
                                        <Label className="text-gray-600">Alınan İşlemler</Label>
                                        <p className="font-medium whitespace-pre-wrap">
                                            {record.actions_taken}
                                        </p>
                                    </div>
                                )}
                                {record.responsible_person && (
                                    <div>
                                        <Label className="text-gray-600">Sorumlu Personel</Label>
                                        <p className="font-medium">{record.responsible_person}</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
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

export default StockRiskDetailModal;
