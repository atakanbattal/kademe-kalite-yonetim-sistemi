import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    FileDown,
    X,
    AlertCircle,
    CheckCircle,
    Eye,
} from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';

const IncomingInspectionDetailModal = ({
    isOpen,
    setIsOpen,
    inspection,
    onDownloadPDF,
}) => {
    const { toast } = useToast();
    const [preparedBy, setPreparedBy] = useState('');
    const [createdBy, setCreatedBy] = useState('');

    const getDecisionBadge = (decision) => {
        switch (decision) {
            case 'Kabul':
                return <Badge className="bg-green-500">✓ Kabul</Badge>;
            case 'Şartlı Kabul':
                return (
                    <Badge className="bg-yellow-500">⚠ Şartlı Kabul</Badge>
                );
            case 'Ret':
                return <Badge className="bg-red-500">✕ Ret</Badge>;
            default:
                return <Badge variant="secondary">Beklemede</Badge>;
        }
    };

    const handleGenerateReport = async () => {
        try {
            const enrichedData = {
                ...inspection,
                prepared_by: preparedBy || '',
                created_by: createdBy || '',
            };
            onDownloadPDF(enrichedData);
            toast({
                title: 'Başarılı',
                description: 'Rapor oluşturuldu!',
            });
            // Modal'ı kapat
            setIsOpen(false);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Rapor oluşturulamadı!',
            });
        }
    };

    if (!inspection) return null;

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Eye className="h-5 w-5" />
                        Muayene Kaydı Detayları
                    </DialogTitle>
                    <DialogDescription>
                        Kayıt No: {inspection.record_no} • Tarih:{' '}
                        {format(
                            new Date(inspection.inspection_date),
                            'dd MMMM yyyy',
                            { locale: tr }
                        )}
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="main" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="main">Temel Bilgiler</TabsTrigger>
                        <TabsTrigger value="details">Muayene Detayları</TabsTrigger>
                        <TabsTrigger value="report">Rapor</TabsTrigger>
                    </TabsList>

                    {/* TAB 1: TEMEL BİLGİLER */}
                    <TabsContent value="main" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">
                                    Tedarikçi Bilgileri
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-xs font-semibold text-muted-foreground">
                                        Tedarikçi Adı
                                    </Label>
                                    <p className="font-medium">
                                        {inspection.supplier_name || '-'}
                                    </p>
                                </div>
                                <div>
                                    <Label className="text-xs font-semibold text-muted-foreground">
                                        Teslimat Belgesi No
                                    </Label>
                                    <p className="font-medium">
                                        {inspection.delivery_note_number || '-'}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">
                                    Parça Bilgileri
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-xs font-semibold text-muted-foreground">
                                        Parça Adı
                                    </Label>
                                    <p className="font-medium">
                                        {inspection.part_name || '-'}
                                    </p>
                                </div>
                                <div>
                                    <Label className="text-xs font-semibold text-muted-foreground">
                                        Parça Kodu
                                    </Label>
                                    <p className="font-medium">
                                        {inspection.part_code || '-'}
                                    </p>
                                </div>
                                <div>
                                    <Label className="text-xs font-semibold text-muted-foreground">
                                        Gelen Miktar
                                    </Label>
                                    <p className="font-medium">
                                        {inspection.quantity_received}{' '}
                                        {inspection.unit}
                                    </p>
                                </div>
                                <div>
                                    <Label className="text-xs font-semibold text-muted-foreground">
                                        Kabul Tarihi
                                    </Label>
                                    <p className="font-medium">
                                        {format(
                                            new Date(
                                                inspection.inspection_date
                                            ),
                                            'dd.MM.yyyy'
                                        )}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">
                                    Muayene Sonucu
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label className="text-sm font-semibold">
                                        Karar
                                    </Label>
                                    {getDecisionBadge(inspection.decision)}
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <Label className="text-xs text-green-600 font-semibold">
                                            Kabul Edilen
                                        </Label>
                                        <p className="text-lg font-bold">
                                            {inspection.quantity_accepted || 0}{' '}
                                            {inspection.unit}
                                        </p>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-yellow-600 font-semibold">
                                            Şartlı Kabul
                                        </Label>
                                        <p className="text-lg font-bold">
                                            {inspection.quantity_conditional ||
                                                0}{' '}
                                            {inspection.unit}
                                        </p>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-red-600 font-semibold">
                                            Reddedilen
                                        </Label>
                                        <p className="text-lg font-bold">
                                            {inspection.quantity_rejected || 0}{' '}
                                            {inspection.unit}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* TAB 2: MUAYENE DETAYLARı */}
                    <TabsContent value="details" className="space-y-4">
                        {inspection.defects &&
                        inspection.defects.length > 0 ? (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">
                                        Tespit Edilen Kusurlar
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        {inspection.defects.map(
                                            (defect, idx) => (
                                                <div
                                                    key={idx}
                                                    className="flex items-start gap-2 p-2 bg-red-50 rounded border border-red-200"
                                                >
                                                    <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                                                    <div className="flex-1">
                                                        <p className="font-medium text-sm">
                                                            {defect.defect_type}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {defect.description}
                                                        </p>
                                                    </div>
                                                </div>
                                            )
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ) : (
                            <Card>
                                <CardContent className="pt-6">
                                    <div className="flex items-center gap-2 text-green-600">
                                        <CheckCircle className="h-5 w-5" />
                                        <p className="font-medium">
                                            Kusur tespit edilmemiştir.
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {inspection.results &&
                        inspection.results.length > 0 ? (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">
                                        Muayene Sonuçları (Detaylı Ölçümler)
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs border border-gray-300">
                                            <thead>
                                                <tr className="bg-gray-100 border-b">
                                                    <th className="text-left p-2 border-r">
                                                        Özellik
                                                    </th>
                                                    <th className="text-left p-2 border-r">
                                                        Yöntem
                                                    </th>
                                                    <th className="text-center p-2 border-r">
                                                        Ölçüm No
                                                    </th>
                                                    <th className="text-center p-2 border-r">
                                                        Nominal
                                                    </th>
                                                    <th className="text-center p-2 border-r">
                                                        Min
                                                    </th>
                                                    <th className="text-center p-2 border-r">
                                                        Mak
                                                    </th>
                                                    <th className="text-center p-2 border-r">
                                                        Ölçülen
                                                    </th>
                                                    <th className="text-center p-2">
                                                        Sonuç
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {inspection.results.map(
                                                    (result, idx) => (
                                                        <tr
                                                            key={idx}
                                                            className="border-b hover:bg-gray-50"
                                                        >
                                                            <td className="p-2 border-r font-semibold">
                                                                {
                                                                    result.feature
                                                                }
                                                            </td>
                                                            <td className="p-2 border-r text-xs">
                                                                {
                                                                    result.measurement_method ||
                                                                    '-'
                                                                }
                                                            </td>
                                                            <td className="p-2 border-r text-center font-bold">
                                                                {
                                                                    result.measurement_number ||
                                                                    '-'
                                                                }
                                                                /
                                                                {
                                                                    result.total_measurements ||
                                                                    '-'
                                                                }
                                                            </td>
                                                            <td className="p-2 border-r text-center">
                                                                {
                                                                    result.nominal_value ||
                                                                    '-'
                                                                }
                                                            </td>
                                                            <td className="p-2 border-r text-center">
                                                                {
                                                                    result.min_value ||
                                                                    '-'
                                                                }
                                                            </td>
                                                            <td className="p-2 border-r text-center">
                                                                {
                                                                    result.max_value ||
                                                                    '-'
                                                                }
                                                            </td>
                                                            <td className="p-2 border-r text-center font-bold">
                                                                {
                                                                    result.actual_value ||
                                                                    '-'
                                                                }
                                                            </td>
                                                            <td className="p-2 text-center font-bold">
                                                                <span
                                                                    className={`px-2 py-1 rounded ${
                                                                        result.result
                                                                            ? 'bg-green-100 text-green-800'
                                                                            : 'bg-red-100 text-red-800'
                                                                    }`}
                                                                >
                                                                    {result.result
                                                                        ? '✓ OK'
                                                                        : '✗ NOK'}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    )
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                        ) : null}
                    </TabsContent>

                    {/* TAB 3: RAPOR */}
                    <TabsContent value="report" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">
                                    İmza Bilgileri
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <Label className="text-sm font-semibold">
                                        Hazırlayan (Ad Soyad)
                                    </Label>
                                    <Input
                                        placeholder="İmzalayan adını girin..."
                                        value={preparedBy}
                                        onChange={(e) =>
                                            setPreparedBy(e.target.value)
                                        }
                                        className="mt-1"
                                    />
                                </div>
                                <div>
                                    <Label className="text-sm font-semibold">
                                        Oluşturan (Ad Soyad)
                                    </Label>
                                    <Input
                                        placeholder="İmzalayan adını girin..."
                                        value={createdBy}
                                        onChange={(e) =>
                                            setCreatedBy(e.target.value)
                                        }
                                        className="mt-1"
                                    />
                                </div>
                                <div className="bg-blue-50 border border-blue-200 rounded p-3">
                                    <p className="text-xs text-blue-700">
                                        💡 Bu isimler PDF raporunda imzalayan
                                        kişiler olarak gösterilecektir.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">
                                    Kontrol Listesi
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <div className="flex items-center gap-2">
                                    {inspection.supplier_name ? (
                                        <CheckCircle className="h-5 w-5 text-green-600" />
                                    ) : (
                                        <AlertCircle className="h-5 w-5 text-red-600" />
                                    )}
                                    <span className="text-sm">
                                        Tedarikçi Bilgisi
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {inspection.part_name ? (
                                        <CheckCircle className="h-5 w-5 text-green-600" />
                                    ) : (
                                        <AlertCircle className="h-5 w-5 text-red-600" />
                                    )}
                                    <span className="text-sm">
                                        Parça Bilgisi
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {inspection.decision &&
                                    inspection.decision !==
                                        'Beklemede' ? (
                                        <CheckCircle className="h-5 w-5 text-green-600" />
                                    ) : (
                                        <AlertCircle className="h-5 w-5 text-yellow-600" />
                                    )}
                                    <span className="text-sm">Karar</span>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

                <DialogFooter className="gap-2">
                    <Button
                        variant="outline"
                        onClick={() => setIsOpen(false)}
                    >
                        Kapat
                    </Button>
                    <Button
                        onClick={handleGenerateReport}
                        className="gap-2"
                    >
                        <FileDown className="h-4 w-4" />
                        Rapor Oluştur & İndir
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default IncomingInspectionDetailModal;
