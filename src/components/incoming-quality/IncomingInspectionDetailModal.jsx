import React, { useState, useEffect } from 'react';
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
    const [controlledBy, setControlledBy] = useState('');
    const [createdBy, setCreatedBy] = useState('');
    const [enrichedInspection, setEnrichedInspection] = useState(inspection);
    const [riskyStockData, setRiskyStockData] = useState(null);
    const [checkingRiskyStock, setCheckingRiskyStock] = useState(false);

    // Check for risky stock when modal opens
    useEffect(() => {
        if (!isOpen || !inspection || !inspection.part_code) return;
        
        const checkRiskyStock = async () => {
            setCheckingRiskyStock(true);
            try {
                // Bu part_code'dan daha önce kabul edilen kayıtları kontrol et
                const { data: previousAccepted, error } = await supabase
                    .from('incoming_inspections')
                    .select('id, record_no, inspection_date, supplier:suppliers(name), quantity_accepted')
                    .eq('part_code', inspection.part_code)
                    .eq('decision', 'Kabul')
                    .neq('id', inspection.id)
                    .order('inspection_date', { ascending: false });
                
                if (error) {
                    console.error('Risky stock check error:', error);
                    setRiskyStockData(null);
                } else if (previousAccepted && previousAccepted.length > 0) {
                    // Stok riski bulundu
                    const totalQuantity = previousAccepted.reduce((sum, item) => sum + (item.quantity_accepted || 0), 0);
                    setRiskyStockData({
                        previous_count: totalQuantity,
                        previous_items: previousAccepted.map(item => ({
                            record_no: item.record_no,
                            supplier_name: item.supplier?.name || 'Bilinmeyen',
                            inspection_date: item.inspection_date,
                            quantity_accepted: item.quantity_accepted
                        }))
                    });
                } else {
                    setRiskyStockData(null);
                }
            } catch (err) {
                console.error('Risky stock check exception:', err);
                setRiskyStockData(null);
            } finally {
                setCheckingRiskyStock(false);
            }
        };
        
        checkRiskyStock();
    }, [isOpen, inspection]);

    // Ölçüm numaralarını kontrol planından regenerate et
    React.useEffect(() => {
        const enrichResults = async () => {
            if (!inspection || !inspection.results) {
                setEnrichedInspection(inspection);
                return;
            }

            // Eğer measurement_number veya total_measurements NULL ise kontrol planını çek
            const hasNullMeasurements = inspection.results.some(
                r => !r.measurement_number || !r.total_measurements
            );

            if (!hasNullMeasurements) {
                setEnrichedInspection(inspection);
                return;
            }

            try {
                // Kontrol planını çek
                const { data: controlPlan } = await supabase
                    .from('incoming_control_plans')
                    .select('*')
                    .eq('part_code', inspection.part_code)
                    .single();

                if (!controlPlan || !controlPlan.items) {
                    setEnrichedInspection(inspection);
                    return;
                }

                // Results'ı kontrol planından regenerate et
                const enrichedResults = inspection.results.map(r => {
                    if (r.measurement_number && r.total_measurements) {
                        return r; // Zaten var
                    }

                    // Kontrol planı item'ından oku
                    const planItem = controlPlan.items?.find(
                        item => item.id === r.control_plan_item_id
                    );

                    if (!planItem) return r;

                    // Gelen miktar sayısı kadar ölçüm
                    const incomingQuantity = inspection.quantity_received || 1;
                    const samplingSize = planItem.sample_size || incomingQuantity;

                    return {
                        ...r,
                        measurement_number: r.measurement_number || 1,
                        total_measurements: r.total_measurements || samplingSize,
                    };
                });

                setEnrichedInspection({
                    ...inspection,
                    results: enrichedResults,
                });
            } catch (error) {
                console.error('Error enriching results:', error);
                setEnrichedInspection(inspection);
            }
        };

        enrichResults();
    }, [inspection]);

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
                ...enrichedInspection,
                prepared_by: preparedBy || '',
                controlled_by: controlledBy || '',
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

    if (!enrichedInspection) return null;

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Eye className="h-5 w-5" />
                        Muayene Kaydı Detayları
                    </DialogTitle>
                    <DialogDescription>
                        Kayıt No: {enrichedInspection.record_no} • Tarih:{' '}
                        {format(
                            new Date(enrichedInspection.inspection_date),
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
                                        {enrichedInspection.supplier?.name || enrichedInspection.supplier_name || '-'}
                                    </p>
                                </div>
                                <div>
                                    <Label className="text-xs font-semibold text-muted-foreground">
                                        İrsaliye Numarası
                                    </Label>
                                    <p className="font-medium">
                                        {enrichedInspection.delivery_note_number || '-'}
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
                                        {enrichedInspection.part_name || '-'}
                                    </p>
                                </div>
                                <div>
                                    <Label className="text-xs font-semibold text-muted-foreground">
                                        Parça Kodu
                                    </Label>
                                    <p className="font-medium">
                                        {enrichedInspection.part_code || '-'}
                                    </p>
                                </div>
                                <div>
                                    <Label className="text-xs font-semibold text-muted-foreground">
                                        Gelen Miktar
                                    </Label>
                                    <p className="font-medium">
                                        {enrichedInspection.quantity_received}{' '}
                                        {enrichedInspection.unit}
                                    </p>
                                </div>
                                <div>
                                    <Label className="text-xs font-semibold text-muted-foreground">
                                        Kabul Tarihi
                                    </Label>
                                    <p className="font-medium">
                                        {format(
                                            new Date(
                                                enrichedInspection.inspection_date
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
                                    {getDecisionBadge(enrichedInspection.decision)}
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <Label className="text-xs text-green-600 font-semibold">
                                            Kabul Edilen
                                        </Label>
                                        <p className="text-lg font-bold">
                                            {enrichedInspection.quantity_accepted || 0}{' '}
                                            {enrichedInspection.unit}
                                        </p>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-yellow-600 font-semibold">
                                            Şartlı Kabul
                                        </Label>
                                        <p className="text-lg font-bold">
                                            {enrichedInspection.quantity_conditional ||
                                                0}{' '}
                                            {enrichedInspection.unit}
                                        </p>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-red-600 font-semibold">
                                            Reddedilen
                                        </Label>
                                        <p className="text-lg font-bold">
                                            {enrichedInspection.quantity_rejected || 0}{' '}
                                            {enrichedInspection.unit}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* TAB 2: MUAYENE DETAYLARı */}
                    <TabsContent value="details" className="space-y-4">
                        {enrichedInspection.defects &&
                        enrichedInspection.defects.length > 0 ? (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Tespit Edilen Hatalar</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        {enrichedInspection.defects.map(
                                            (defect, idx) => (
                                                <div key={idx} className="flex justify-between items-center p-2 bg-muted rounded">
                                                    <div>
                                                        <div className="font-semibold">{defect.defect_type}</div>
                                                        <div className="text-sm text-muted-foreground">{defect.description}</div>
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

                        {enrichedInspection.results &&
                        enrichedInspection.results.length > 0 ? (
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
                                                {enrichedInspection.results.map(
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
                                        Kontrol Eden (Ad Soyad)
                                    </Label>
                                    <Input
                                        placeholder="Kontrol eden adını girin..."
                                        value={controlledBy}
                                        onChange={(e) =>
                                            setControlledBy(e.target.value)
                                        }
                                        className="mt-1"
                                    />
                                </div>
                                <div>
                                    <Label className="text-sm font-semibold">
                                        Onaylayan (Ad Soyad)
                                    </Label>
                                    <Input
                                        placeholder="Onaylayan adını girin..."
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
                                        kişiler olarak gösterilecektir. Boş bırakırsanız
                                        ıslak imza için PDF'te boş gelir.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                        {/* STOK KONTROL UYARISI */}
                        {riskyStockData && (
                            <Card className="border-red-200 bg-red-50">
                                <CardHeader>
                                    <CardTitle className="text-red-700 flex items-center gap-2">
                                        <AlertCircle className="h-5 w-5" />
                                        DIKKAT - POTANSİYEL RİSKLİ STOK KONTROLÜ GEREKLİ!
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <p className="text-red-700 font-semibold">
                                        Bu parça kodundan ({enrichedInspection.part_code}) daha önce {riskyStockData.previous_count || 0} adet stok bulunuyor!
                                    </p>
                                    <div className="bg-white border border-red-200 rounded p-3 max-h-[200px] overflow-y-auto">
                                        <h4 className="font-semibold text-sm mb-2 text-red-700">Önceki Kabul Edilen Partiler:</h4>
                                        <ul className="space-y-1 text-xs">
                                            {riskyStockData.previous_items?.map((item, idx) => (
                                                <li key={idx} className="text-gray-700">
                                                    • Kayıt No: <strong>{item.record_no}</strong> | 
                                                    Tedarikçi: <strong>{item.supplier_name || 'Bilinmeyen'}</strong> | 
                                                    Tarih: <strong>{format(new Date(item.inspection_date), 'dd.MM.yyyy')}</strong> | 
                                                    Miktar: <strong>{item.quantity_accepted} adet</strong>
                                                </li>
                                            )) || []}
                                        </ul>
                                    </div>
                                    <p className="text-yellow-700 text-sm italic">
                                        💡 Tavsiye: Eski stokların kontrol edilip tüketilmesini veya yönetilmesini dikkate alın.
                                    </p>
                                </CardContent>
                            </Card>
                        )}

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">
                                    Kontrol Listesi
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <div className="flex items-center gap-2">
                                    {enrichedInspection.supplier_name ? (
                                        <CheckCircle className="h-5 w-5 text-green-600" />
                                    ) : (
                                        <AlertCircle className="h-5 w-5 text-red-600" />
                                    )}
                                    <span className="text-sm">
                                        Tedarikçi Bilgisi
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {enrichedInspection.part_name ? (
                                        <CheckCircle className="h-5 w-5 text-green-600" />
                                    ) : (
                                        <AlertCircle className="h-5 w-5 text-red-600" />
                                    )}
                                    <span className="text-sm">
                                        Parça Bilgisi
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {enrichedInspection.decision &&
                                    enrichedInspection.decision !==
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
