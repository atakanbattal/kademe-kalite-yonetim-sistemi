import React, { useMemo } from 'react'; // React importu eklendi
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { AlertCircle, Target, TrendingUp, History, Package } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// Drill-down modal bileşeni
const CostDrillDownModal = ({ isOpen, onClose, data, allCosts }) => {
    if (!data) return null;

    // Seçilen veri noktasıyla ilgili maliyetleri filtrele
    const relatedCosts = useMemo(() => {
        // Eğer data bir array ise (örn: bir bar segmenti), direkt kullan
        if (Array.isArray(data.payload)) return data.payload;
        // Eğer data tek bir obje ise ve children/related gibi bir field varsa
        if (data.relatedCosts) return data.relatedCosts;

        // Genel filtreleme (örnek senaryo: Belirli bir aydaki X maliyet türü)
        // Bu mantık CostAnalytics'ten gelen verinin yapısına göre özelleştirilmeli
        return [];
    }, [data]);

    // İlgili parçanın geçmiş trend analizi
    const partTrend = useMemo(() => {
        if (!data.part_code) return [];
        return allCosts
            .filter(c => c.part_code === data.part_code)
            .sort((a, b) => new Date(a.cost_date) - new Date(b.cost_date))
            .slice(-6); // Son 6 kayıt
    }, [data.part_code, allCosts]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Target className="w-6 h-6 text-primary" />
                        Detaylı Maliyet Analizi
                    </DialogTitle>
                    <DialogDescription>
                        {data.cost_type} - {data.part_name || 'Genel Analiz'}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    {/* Sol Kolon: Temel Bilgiler */}
                    <div className="space-y-4">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Maliyet Detayı</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold mb-1">
                                    {data.amount?.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                                </div>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    <Badge variant="outline">{data.unit}</Badge>
                                    <Badge variant="secondary">{format(new Date(data.cost_date || new Date()), 'dd MMMM yyyy', { locale: tr })}</Badge>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                                    <AlertCircle className="w-4 h-4" />
                                    İlişkili Uygunsuzluklar
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ScrollArea className="h-[200px]">
                                    {/* Burada NC (Non-Conformity) verileri listelenecek */}
                                    {/* Şimdilik mock veri veya varsa relatedCosts üzerinden */}
                                    <div className="space-y-2">
                                        <div className="p-2 border rounded-md text-sm">
                                            <p className="font-semibold">Sistem Entegrasyonu Bekleniyor</p>
                                            <p className="text-muted-foreground text-xs">Bu maliyet kalemiyle ilişkili doğrudan bir 8D/DF kaydı bulunamadı.</p>
                                        </div>
                                    </div>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Sağ Kolon: Trend ve Analiz */}
                    <div className="space-y-4">
                        <Card className="h-full">
                            <CardHeader className="pb-2">
                                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                                    <History className="w-4 h-4" />
                                    Geçmiş Hata Trendi
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[250px]">
                                    {partTrend.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={partTrend}>
                                                <XAxis dataKey="cost_date" tickFormatter={(d) => format(new Date(d), 'dd/MM')} fontSize={10} />
                                                <YAxis fontSize={10} />
                                                <Tooltip />
                                                <Bar dataKey="amount" fill="#8884d8" name="Tutar" radius={[4, 4, 0, 0]}>
                                                    {partTrend.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={index === partTrend.length - 1 ? '#ef4444' : '#94a3b8'} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                                            Yeterli geçmiş veri yok.
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {data.description && (
                    <div className="mt-4">
                        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                            <Package className="w-4 h-4" /> Açıklama / Kök Neden
                        </h4>
                        <div className="p-3 bg-muted/50 rounded-lg text-sm">
                            {data.description}
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default CostDrillDownModal;
