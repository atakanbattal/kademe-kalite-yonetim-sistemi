import React, { useState, useEffect } from 'react';
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
import { supabase } from '@/lib/customSupabaseClient';

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
    const [enrichedRecord, setEnrichedRecord] = useState(record);

    // Enrich record with related data on modal open
    useEffect(() => {
        if (!isOpen || !record) return;
        
        const enrichData = async () => {
            try {
                const enriched = { ...record };
                
                // Fetch controlled_by user
                if (record.controlled_by_id) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('id, full_name')
                        .eq('id', record.controlled_by_id)
                        .single();
                    if (profile) enriched.controlled_by = profile;
                }
                
                // Fetch supplier
                if (record.supplier_id) {
                    const { data: supplier } = await supabase
                        .from('suppliers')
                        .select('id, name')
                        .eq('id', record.supplier_id)
                        .single();
                    if (supplier) enriched.supplier = supplier;
                }
                
                // Fetch controlled_inspection
                if (record.controlled_inspection_id) {
                    const { data: inspect } = await supabase
                        .from('incoming_inspections')
                        .select('id, record_no, part_code, part_name')
                        .eq('id', record.controlled_inspection_id)
                        .single();
                    if (inspect) enriched.controlled_inspection = inspect;
                }
                
                // Fetch source_inspection
                if (record.source_inspection_id) {
                    const { data: srcInspect } = await supabase
                        .from('incoming_inspections')
                        .select('id, record_no, part_code, part_name')
                        .eq('id', record.source_inspection_id)
                        .single();
                    if (srcInspect) enriched.source_inspection = srcInspect;
                }
                
                setEnrichedRecord(enriched);
            } catch (error) {
                console.error('Error enriching record:', error);
                setEnrichedRecord(record);
            }
        };
        
        enrichData();
    }, [isOpen, record]);

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
                ...enrichedRecord,
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

    if (!enrichedRecord) return null;

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Stok Risk Kontrolü Detayları</DialogTitle>
                    <DialogDescription>
                        Ürün: {enrichedRecord.part_code || '-'} • Tarih:{' '}
                        {format(
                            new Date(enrichedRecord.created_at),
                            'dd MMMM yyyy',
                            { locale: tr }
                        )}
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="basic" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="basic">Temel Bilgiler</TabsTrigger>
                        <TabsTrigger value="details">Kontrol Sonuçları</TabsTrigger>
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
                                        <Label className="text-gray-600">Parça Kodu</Label>
                                        <p className="font-medium">{enrichedRecord.part_code || '-'}</p>
                                    </div>
                                    <div>
                                        <Label className="text-gray-600">Parça Adı</Label>
                                        <p className="font-medium">{enrichedRecord.part_name || '-'}</p>
                                    </div>
                                    <div>
                                        <Label className="text-gray-600">Tedarikçi</Label>
                                        <p className="font-medium">{enrichedRecord.supplier?.name || '-'}</p>
                                    </div>
                                    <div>
                                        <Label className="text-gray-600">Karar</Label>
                                        <p className="font-medium">{enrichedRecord.decision || '-'}</p>
                                    </div>
                                    <div>
                                        <Label className="text-gray-600">Kontrol Tarihi</Label>
                                        <p className="font-medium">
                                            {format(
                                                new Date(enrichedRecord.created_at),
                                                'dd.MM.yyyy HH:mm'
                                            )}
                                        </p>
                                    </div>
                                    <div>
                                        <Label className="text-gray-600">Kontrol Eden</Label>
                                        <p className="font-medium">{enrichedRecord.controlled_by?.full_name || '-'}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* TAB 2: KONTROL SONUÇLARI */}
                    <TabsContent value="details" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Kontrol Sonuçları</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {enrichedRecord.results && Array.isArray(enrichedRecord.results) && enrichedRecord.results.length > 0 ? (
                                    <table className="w-full border-collapse border border-gray-300">
                                        <thead>
                                            <tr className="bg-gray-50">
                                                <th className="border p-2 text-left">Ölçüm Türü</th>
                                                <th className="border p-2 text-left">Değer</th>
                                                <th className="border p-2 text-left">Sonuç</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {enrichedRecord.results.map((result, index) => (
                                                <tr key={index}>
                                                    <td className="border p-2">{result.measurement_type || '-'}</td>
                                                    <td className="border p-2">{result.value || '-'}</td>
                                                    <td className="border p-2">{result.result || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <p className="text-muted-foreground">Kontrol sonucu kaydı bulunamadı.</p>
                                )}
                                {enrichedRecord.notes && (
                                    <div>
                                        <Label className="text-gray-600">Notlar</Label>
                                        <p className="font-medium whitespace-pre-wrap">
                                            {enrichedRecord.notes}
                                        </p>
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
