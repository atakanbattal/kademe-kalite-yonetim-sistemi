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
import { useData } from '@/contexts/DataContext';

const ControlPlanDetailModal = ({
    isOpen,
    setIsOpen,
    plan,
    onDownloadPDF,
}) => {
    const { toast } = useToast();
    const { characteristics, equipment, standards } = useData();
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

    // Karakteristik ve ekipman bilgilerini al
    const getCharacteristicName = (id) => {
        const char = characteristics?.find(c => c.value === id);
        return char ? char.label : id || '-';
    };

    const getEquipmentName = (id) => {
        const eq = equipment?.find(e => e.value === id);
        return eq ? eq.label : id || '-';
    };

    const getStandardName = (item) => {
        if (item.standard_class) {
            return item.standard_class;
        }
        if (item.standard_id) {
            const std = standards?.find(s => s.value === item.standard_id);
            return std ? std.label : item.standard_id;
        }
        return '-';
    };

    const handleGenerateReport = () => {
        // Process control modülündeki gibi senkron çalış
        try {
            if (!plan || !plan.id) {
                toast({
                    variant: 'destructive',
                    title: 'Hata',
                    description: 'Geçerli bir kontrol planı bulunamadı!',
                });
                return;
            }
            
            const enrichedData = {
                ...plan,
                prepared_by: preparedBy || '',
                controlled_by: controlledBy || '',
                created_by: createdBy || '',
            };
            
            console.log('📄 Rapor oluşturuluyor:', enrichedData);
            
            // onDownloadPDF fonksiyonunu çağır (senkron)
            onDownloadPDF(enrichedData);
            
            toast({
                title: 'Başarılı',
                description: 'Rapor oluşturuldu!',
            });
            setIsOpen(false);
        } catch (error) {
            console.error('Rapor oluşturma hatası:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: `Rapor oluşturulamadı: ${error.message}`,
            });
        }
    };

    if (!plan) return null;

    // Güvenli tarih formatı
    const formatSafeDate = (dateStr, formatStr = 'dd.MM.yyyy') => {
        if (!dateStr) return '-';
        try {
            return format(new Date(dateStr), formatStr, { locale: tr });
        } catch {
            return '-';
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Kontrol Planı Detayları</DialogTitle>
                    <DialogDescription>
                        Plan: {plan.part_code} • Tarih: {formatSafeDate(plan.updated_at || plan.created_at, 'dd MMMM yyyy')}
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="basic" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="basic">Temel Bilgiler</TabsTrigger>
                        <TabsTrigger value="measurements">Ölçüm Noktaları</TabsTrigger>
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
                                        <p className="font-medium">Rev.{plan.revision_number || 0}</p>
                                    </div>
                                    <div>
                                        <Label className="text-gray-600">Revizyon Tarihi</Label>
                                        <p className="font-medium">{formatSafeDate(plan.revision_date)}</p>
                                    </div>
                                    <div>
                                        <Label className="text-gray-600">Karakteristik Sayısı</Label>
                                        <p className="font-medium">{(plan.items || []).length} adet</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* TAB 2: ÖLÇÜM NOKTALARI */}
                    <TabsContent value="measurements" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Ölçülmesi Gereken Noktalar ve Ölçüler</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {plan.items && plan.items.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm border-collapse">
                                            <thead>
                                                <tr className="bg-muted">
                                                    <th className="border p-2 text-left">#</th>
                                                    <th className="border p-2 text-left">Karakteristik</th>
                                                    <th className="border p-2 text-left">Ölçüm Ekipmanı</th>
                                                    <th className="border p-2 text-left">Standart</th>
                                                    <th className="border p-2 text-center">Nominal</th>
                                                    <th className="border p-2 text-center">Min</th>
                                                    <th className="border p-2 text-center">Max</th>
                                                    <th className="border p-2 text-center">Yön</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {plan.items.map((item, idx) => (
                                                    <tr key={item.id || idx} className="hover:bg-muted/50">
                                                        <td className="border p-2 font-medium">{idx + 1}</td>
                                                        <td className="border p-2">
                                                            <div>
                                                                <div className="font-medium">{getCharacteristicName(item.characteristic_id)}</div>
                                                                {item.characteristic_type && (
                                                                    <Badge variant="outline" className="mt-1 text-xs">
                                                                        {item.characteristic_type}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="border p-2">{getEquipmentName(item.equipment_id)}</td>
                                                        <td className="border p-2">
                                                            <div>
                                                                <div>{getStandardName(item)}</div>
                                                                {item.tolerance_class && (
                                                                    <Badge variant="secondary" className="mt-1 text-xs">
                                                                        {item.tolerance_class}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="border p-2 text-center font-medium bg-blue-50">
                                                            {item.nominal_value || '-'}
                                                        </td>
                                                        <td className="border p-2 text-center bg-yellow-50">
                                                            {item.min_value || '-'}
                                                        </td>
                                                        <td className="border p-2 text-center bg-yellow-50">
                                                            {item.max_value || '-'}
                                                        </td>
                                                        <td className="border p-2 text-center">
                                                            <Badge variant="outline">{item.tolerance_direction || '±'}</Badge>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <p className="text-muted-foreground text-center py-8">Ölçüm noktası bulunamadı.</p>
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
                                <div className="space-y-3">
                                    <div>
                                        <Label>Hazırlayan</Label>
                                        <Input
                                            value={preparedBy}
                                            onChange={(e) => setPreparedBy(e.target.value)}
                                            placeholder="Hazırlayan kişinin adı"
                                        />
                                    </div>
                                    <div>
                                        <Label>Kontrol Eden</Label>
                                        <Input
                                            value={controlledBy}
                                            onChange={(e) => setControlledBy(e.target.value)}
                                            placeholder="Kontrol eden kişinin adı"
                                        />
                                    </div>
                                    <div>
                                        <Label>Onaylayan</Label>
                                        <Input
                                            value={createdBy}
                                            onChange={(e) => setCreatedBy(e.target.value)}
                                            placeholder="Onaylayan kişinin adı"
                                        />
                                    </div>
                                </div>
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                    <p className="text-sm text-blue-800">
                                        💡 Bu isimler PDF raporunda imzalayan kişiler olarak görünecektir.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>
                        Kapat
                    </Button>
                    <Button onClick={handleGenerateReport}>
                        <FileDown className="w-4 h-4 mr-2" />
                        Rapor Oluştur & İndir
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ControlPlanDetailModal;
