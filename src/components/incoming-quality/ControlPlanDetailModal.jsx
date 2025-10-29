import React, { useState, useEffect } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileDown, X } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useToast } from '@/components/ui/use-toast';

const ControlPlanDetailModal = ({
    isOpen,
    setIsOpen,
    plan,
    onDownloadPDF,
}) => {
    const { toast } = useToast();
    const [preparedBy, setPreparedBy] = useState('');
    const [controlledBy, setControlledBy] = useState('');
    const [createdBy, setCreatedBy] = useState('');

    useEffect(() => {
        if (plan) {
            console.log('📋 ControlPlanDetailModal opened with plan:', plan);
            console.log('📊 Plan items:', plan.items);
            console.log('📊 Items count:', plan.items ? plan.items.length : 0);
        }
    }, [plan, isOpen]);

    const handleGenerateReport = async () => {
        try {
            const enrichedData = {
                ...plan,
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

    if (!plan) return null;

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Kontrol Planı Detayları</DialogTitle>
                    <DialogDescription>
                        Plan No: {plan.part_code} • Tarih:{' '}
                        {format(
                            new Date(plan.updated_at || plan.created_at),
                            'dd MMMM yyyy',
                            { locale: tr }
                        )}
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="basic" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="basic">Temel Bilgiler</TabsTrigger>
                        <TabsTrigger value="sampling">Örnekleme Planı</TabsTrigger>
                        <TabsTrigger value="report">Rapor</TabsTrigger>
                    </TabsList>

                    {/* TAB 1: TEMEL BİLGİLER */}
                    <TabsContent value="basic" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Plan Bilgileri</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label className="text-gray-600">Parça Kodu</Label>
                                        <p className="font-medium">{plan.part_code || '-'}</p>
                                    </div>
                                    <div>
                                        <Label className="text-gray-600">Parça Adı</Label>
                                        <p className="font-medium">{plan.part_name || '-'}</p>
                                    </div>
                                    <div>
                                        <Label className="text-gray-600">Revizyon No</Label>
                                        <p className="font-medium">{plan.revision_number || 0}</p>
                                    </div>
                                    <div>
                                        <Label className="text-gray-600">Revizyon Tarihi</Label>
                                        <p className="font-medium">
                                            {format(
                                                new Date(plan.revision_date),
                                                'dd.MM.yyyy'
                                            )}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* TAB 2: ÖRNEKLEME PLANI */}
                    <TabsContent value="sampling" className="space-y-4">
                        {plan.items && plan.items.length > 0 ? (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Örnekleme Detayları</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm border-collapse">
                                            <thead>
                                                <tr className="bg-gray-100 border">
                                                    <th className="border p-2 text-left font-semibold">
                                                        Sıra
                                                    </th>
                                                    <th className="border p-2 text-left font-semibold">
                                                        Özellik / Karakteristik
                                                    </th>
                                                    <th className="border p-2 text-left font-semibold">
                                                        Tip
                                                    </th>
                                                    <th className="border p-2 text-left font-semibold">
                                                        Tolerans Sınıfı
                                                    </th>
                                                    <th className="border p-2 text-center font-semibold">
                                                        Yön
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {plan.items.map((item, idx) => (
                                                    <tr key={idx} className="border hover:bg-gray-50">
                                                        <td className="border p-2">{idx + 1}</td>
                                                        <td className="border p-2">
                                                            Nominal: {item.nominal_value || '-'} | Min: {item.min_value || '-'} | Max: {item.max_value || '-'}
                                                        </td>
                                                        <td className="border p-2">
                                                            {item.characteristic_type || '-'}
                                                        </td>
                                                        <td className="border p-2">
                                                            {item.tolerance_class || '-'}
                                                        </td>
                                                        <td className="border p-2 text-center">
                                                            {item.tolerance_direction || '±'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                        ) : (
                            <Card>
                                <CardContent className="pt-6">
                                    <p className="text-gray-500">Örnekleme detayı bulunamadı.</p>
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

export default ControlPlanDetailModal;
