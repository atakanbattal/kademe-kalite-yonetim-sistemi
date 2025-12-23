
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';

const StockRiskControlModal = ({ isOpen, setIsOpen, stockRiskData, refreshData }) => {
    const { toast } = useToast();
    const { user } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [controlResults, setControlResults] = useState([]);
    
    const { sourceInspection, riskyStock } = stockRiskData || {};

    useEffect(() => {
        if (isOpen && riskyStock) {
            setControlResults(riskyStock.map(item => ({
                controlled_inspection_id: item.id,
                part_code: item.part_code,
                part_name: sourceInspection.part_name,
                supplier_id: item.supplier?.id || null,
                stock_status: 'Stokta', // Stokta, Stokta Yok, Kullanılmış
                results: [{
                    measurement_type: 'Görsel Kontrol',
                    result: null, // Uygun / Uygun Değil
                    value: '',
                    notes: ''
                }],
                overall_decision: 'Beklemede'
            })));
        }
    }, [isOpen, riskyStock, sourceInspection]);

    const handleResultChange = (index, resultIndex, field, value) => {
        const newControlResults = [...controlResults];
        newControlResults[index].results[resultIndex][field] = value;
        setControlResults(newControlResults);
    };

    const handleOverallDecisionChange = (index, value) => {
        const newControlResults = [...controlResults];
        newControlResults[index].overall_decision = value;
        setControlResults(newControlResults);
    };

    const handleStockStatusChange = (index, value) => {
        const newControlResults = [...controlResults];
        newControlResults[index].stock_status = value;
        // Eğer stokta yoksa veya kullanılmışsa, karar otomatik olarak "Kontrol Edilemedi" olmalı
        if (value === 'Stokta Yok' || value === 'Kullanılmış') {
            newControlResults[index].overall_decision = 'Kontrol Edilemedi';
        } else if (newControlResults[index].overall_decision === 'Kontrol Edilemedi') {
            // Eğer stokta ise ve karar "Kontrol Edilemedi" ise, "Beklemede" yap
            newControlResults[index].overall_decision = 'Beklemede';
        }
        setControlResults(newControlResults);
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        
        const recordsToInsert = controlResults.map(item => ({
            source_inspection_id: sourceInspection.id,
            controlled_inspection_id: item.controlled_inspection_id,
            part_code: sourceInspection.part_code,
            part_name: sourceInspection.part_name,
            supplier_id: item.supplier_id,
            stock_status: item.stock_status || 'Stokta',
            results: item.results,
            decision: item.overall_decision,
            controlled_by_id: user.id,
            status: 'Beklemede'
        }));

        const { error } = await supabase.from('stock_risk_controls').insert(recordsToInsert);

        if (error) {
            toast({ variant: 'destructive', title: 'Hata', description: `Stok risk kontrolü başlatılamadı: ${error.message}` });
        } else {
            toast({ 
                title: 'Stok Risk Kontrolü Başlatıldı', 
                description: `${controlResults.length} adet stok risk kontrol kaydı oluşturuldu. Kontrolleri tamamlamak için "Stok Risk Kontrolleri" sekmesinden devam edebilirsiniz.`,
                duration: 5000
            });
            refreshData();
            setIsOpen(false);
        }

        setIsSubmitting(false);
    };

    if (!sourceInspection) return null;

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Potansiyel Riskli Stok Kontrolü</DialogTitle>
                    <DialogDescription>
                        Kaynak GKK: {sourceInspection.record_no} - {sourceInspection.part_name} ({sourceInspection.part_code}) <br/>
                        Aşağıdaki 'Kabul' edilmiş partiler için kontrol gerçekleştirin.
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="h-[60vh] p-4">
                    <div className="space-y-6">
                        {controlResults.map((control, index) => {
                             const inspectionItem = riskyStock.find(i => i.id === control.controlled_inspection_id);
                             if (!inspectionItem) return null;
                             return (
                            <div key={control.controlled_inspection_id} className="p-4 border rounded-lg">
                                <h3 className="font-semibold">Kontrol Edilen Parti</h3>
                                <div className="grid grid-cols-4 gap-2 text-sm text-muted-foreground mb-4">
                                     <span>Tedarikçi: {inspectionItem.supplier?.name || 'Bilinmeyen'}</span>
                                     <span>İrsaliye: {inspectionItem.delivery_note_number}</span>
                                     <span>Miktar: {inspectionItem.quantity_received}</span>
                                     <span>Tarih: {format(new Date(inspectionItem.inspection_date), 'dd.MM.yyyy')}</span>
                                </div>
                                
                                <div className="mb-4">
                                    <Label>Stok Durumu</Label>
                                    <Select value={control.stock_status || 'Stokta'} onValueChange={(v) => handleStockStatusChange(index, v)}>
                                        <SelectTrigger className="w-[200px]"><SelectValue/></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Stokta">Stokta</SelectItem>
                                            <SelectItem value="Stokta Yok">Stokta Yok</SelectItem>
                                            <SelectItem value="Kullanılmış">Kullanılmış</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                
                                {control.results.map((res, resIndex) => (
                                    <div key={resIndex} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end mb-2">
                                        <div>
                                            <Label>Muayene Türü</Label>
                                            <Select 
                                                value={res.measurement_type} 
                                                onValueChange={(v) => handleResultChange(index, resIndex, 'measurement_type', v)}
                                                disabled={control.stock_status === 'Stokta Yok' || control.stock_status === 'Kullanılmış'}
                                            >
                                                <SelectTrigger><SelectValue/></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Görsel Kontrol">Görsel Kontrol</SelectItem>
                                                    <SelectItem value="Boyutsal Ölçüm">Boyutsal Ölçüm</SelectItem>
                                                    <SelectItem value="Laboratuvar Testi">Laboratuvar Testi</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                         <div>
                                            <Label>Sonuç</Label>
                                            <Select 
                                                value={res.result || ''} 
                                                onValueChange={(v) => handleResultChange(index, resIndex, 'result', v)}
                                                disabled={control.stock_status === 'Stokta Yok' || control.stock_status === 'Kullanılmış'}
                                            >
                                                <SelectTrigger><SelectValue placeholder="Sonuç seçin..."/></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Uygun">Uygun</SelectItem>
                                                    <SelectItem value="Uygun Değil">Uygun Değil</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <Label>Ölçüm Değeri</Label>
                                            <Input 
                                                value={res.value} 
                                                onChange={(e) => handleResultChange(index, resIndex, 'value', e.target.value)} 
                                                placeholder="Sayısal veri (opsiyonel)"
                                                disabled={control.stock_status === 'Stokta Yok' || control.stock_status === 'Kullanılmış'}
                                            />
                                        </div>
                                        <div className="md:col-span-4">
                                             <Label>Gözlemler</Label>
                                            <Textarea 
                                                value={res.notes} 
                                                onChange={(e) => handleResultChange(index, resIndex, 'notes', e.target.value)} 
                                                placeholder="Gözlemlerinizi yazın..."
                                                disabled={control.stock_status === 'Stokta Yok' || control.stock_status === 'Kullanılmış'}
                                            />
                                        </div>
                                    </div>
                                ))}

                                <div className="mt-4">
                                    <Label>Genel Karar</Label>
                                    <Select 
                                        value={control.overall_decision} 
                                        onValueChange={(v) => handleOverallDecisionChange(index, v)}
                                        disabled={control.stock_status === 'Stokta Yok' || control.stock_status === 'Kullanılmış'}
                                    >
                                        <SelectTrigger className="w-[200px]">
                                            <SelectValue/>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Beklemede">Beklemede</SelectItem>
                                            <SelectItem value="Uygun">Uygun</SelectItem>
                                            <SelectItem value="Uygun Değil">Uygun Değil</SelectItem>
                                            <SelectItem value="Revizyon Gerekli">Revizyon Gerekli</SelectItem>
                                            <SelectItem value="Kontrol Edilemedi">Kontrol Edilemedi</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {(control.stock_status === 'Stokta Yok' || control.stock_status === 'Kullanılmış') && (
                                        <p className="text-sm text-muted-foreground mt-1">
                                            Stokta olmadığı için kontrol yapılamadı. Karar otomatik olarak "Kontrol Edilemedi" olarak ayarlandı.
                                        </p>
                                    )}
                                </div>
                            </div>
                        )})}
                    </div>
                </ScrollArea>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>İptal</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? 'Kaydediliyor...' : 'Kontrol Sonuçlarını Kaydet'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default StockRiskControlModal;
