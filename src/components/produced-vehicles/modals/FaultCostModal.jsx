import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Calculator, Save } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { cn } from '@/lib/utils';

const FaultCostModal = ({ isOpen, setIsOpen, vehicle, faults, onSuccess }) => {
    const { toast } = useToast();
    const { unitCostSettings, refreshData, qualityCosts } = useData();
    const [faultDurations, setFaultDurations] = useState({});
    const [qualityControlDurations, setQualityControlDurations] = useState({});
    const [loading, setLoading] = useState(false);
    const [calculations, setCalculations] = useState({});
    const [existingCostRecords, setExistingCostRecords] = useState([]);
    const [isEditMode, setIsEditMode] = useState(false);

    // Tüm hataları kullan (çözülen ve çözülmemiş)
    const allFaults = useMemo(() => {
        return faults || [];
    }, [faults]);

    // Her hata için birim maliyetini bul
    const getUnitCost = (departmentName) => {
        if (!departmentName || !unitCostSettings || unitCostSettings.length === 0) {
            return 0;
        }
        const unitSetting = unitCostSettings.find(u => u.unit_name === departmentName);
        return unitSetting ? parseFloat(unitSetting.cost_per_minute) || 0 : 0;
    };

    // Kalite kontrol birimi maliyetini bul
    const getQualityControlUnitCost = () => {
        const qualityUnitNames = ['Kalite Kontrol', 'Kalite', 'Kalite Kontrolü', 'Quality Control'];
        for (const name of qualityUnitNames) {
            const unitSetting = unitCostSettings?.find(u => u.unit_name === name);
            if (unitSetting) {
                return parseFloat(unitSetting.cost_per_minute) || 0;
            }
        }
        // Bulunamazsa varsayılan birim maliyetini kullan
        return unitCostSettings && unitCostSettings.length > 0 
            ? parseFloat(unitCostSettings[0].cost_per_minute) || 0 
            : 0;
    };

    // Hesaplamaları güncelle
    useEffect(() => {
        const newCalculations = {};
        let totalCost = 0;
        let totalFaultCount = 0;
        let totalDuration = 0;

        const qualityControlUnitCost = getQualityControlUnitCost();

        allFaults.forEach(fault => {
            const duration = parseFloat(faultDurations[fault.id]) || 0;
            const qualityDuration = parseFloat(qualityControlDurations[fault.id]) || 0;
            const departmentName = fault.department?.name || fault.department_name || 'Üretim';
            const unitCost = getUnitCost(departmentName);
            const faultCost = duration * unitCost;
            const qualityControlCost = qualityDuration * qualityControlUnitCost;
            const faultQuantity = fault.quantity || 1;
            const totalFaultCost = (faultCost + qualityControlCost) * faultQuantity;

            newCalculations[fault.id] = {
                duration,
                qualityDuration,
                unitCost,
                qualityControlUnitCost,
                faultCost,
                qualityControlCost,
                faultQuantity,
                totalFaultCost,
                departmentName
            };

            totalCost += totalFaultCost;
            totalFaultCount += faultQuantity;
            totalDuration += (duration + qualityDuration) * faultQuantity;
        });

        setCalculations(newCalculations);
    }, [faultDurations, qualityControlDurations, allFaults, unitCostSettings]);

    // Mevcut maliyet kayıtlarını kontrol et ve formu yükle
    useEffect(() => {
        if (!isOpen || !vehicle?.id) {
            setFaultDurations({});
            setQualityControlDurations({});
            setExistingCostRecords([]);
            setIsEditMode(false);
            return;
        }

        if (isOpen && vehicle?.id && qualityCosts) {
            const existing = qualityCosts.filter(cost => 
                cost.source_type === 'produced_vehicle_final_faults' && 
                cost.source_record_id === vehicle.id
            );
            setExistingCostRecords(existing);
            setIsEditMode(existing.length > 0);

            // Eğer mevcut kayıtlar varsa, süreleri yükle
            if (existing.length > 0) {
                const durations = {};
                const qualityDurations = {};
                
                existing.forEach(costRecord => {
                    // Açıklamadan hata açıklamasını eşleştir
                    const description = costRecord.description || '';
                    const faultMatch = allFaults.find(fault => 
                        description.includes(fault.description)
                    );
                    
                    if (faultMatch) {
                        durations[faultMatch.id] = costRecord.rework_duration || '';
                        qualityDurations[faultMatch.id] = costRecord.quality_control_duration || '';
                    }
                });

                setFaultDurations(durations);
                setQualityControlDurations(qualityDurations);
            } else {
                // Yeni kayıt modu
                const initialDurations = {};
                const initialQualityDurations = {};
                allFaults.forEach(fault => {
                    initialDurations[fault.id] = '';
                    initialQualityDurations[fault.id] = '';
                });
                setFaultDurations(initialDurations);
                setQualityControlDurations(initialQualityDurations);
            }
        }
    }, [isOpen, allFaults, vehicle?.id, qualityCosts]);

    const handleDurationChange = (faultId, value) => {
        setFaultDurations(prev => ({
            ...prev,
            [faultId]: value
        }));
    };

    const handleQualityControlDurationChange = (faultId, value) => {
        setQualityControlDurations(prev => ({
            ...prev,
            [faultId]: value
        }));
    };

    const handleSubmit = async () => {
        // Mükerrer kayıt kontrolü
        if (!isEditMode && existingCostRecords.length > 0) {
            toast({
                variant: 'destructive',
                title: 'Mükerrer Kayıt',
                description: 'Bu araç için zaten final hataları maliyet kaydı mevcut. Lütfen mevcut kaydı düzenleyin.'
            });
            return;
        }

        // Süre zorunluluğu kaldırıldı - kullanıcı isterse boş bırakabilir

        if (allFaults.length === 0) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Maliyet kaydı oluşturmak için en az bir hata olmalıdır.'
            });
            return;
        }

        setLoading(true);

        try {
            let totalAmount = 0;
            let totalQuantity = 0;

            const qualityControlUnitCost = getQualityControlUnitCost();
            const qualityControlUnitName = unitCostSettings?.find(u => 
                ['Kalite Kontrol', 'Kalite', 'Kalite Kontrolü', 'Quality Control'].includes(u.unit_name)
            )?.unit_name || 'Kalite Kontrol';

            // Düzenleme modu: Mevcut kayıtları güncelle
            if (isEditMode && existingCostRecords.length > 0) {
                // Her hata için mevcut kaydı bul ve güncelle
                for (const fault of allFaults) {
                    const duration = parseFloat(faultDurations[fault.id]) || 0;
                    const qualityDuration = parseFloat(qualityControlDurations[fault.id]) || 0;
                    const departmentName = fault.department?.name || fault.department_name || 'Üretim';
                    const unitCost = getUnitCost(departmentName);
                    const faultCost = duration * unitCost;
                    const qualityControlCost = qualityDuration * qualityControlUnitCost;
                    const faultQuantity = fault.quantity || 1;
                    const totalFaultCost = (faultCost + qualityControlCost) * faultQuantity;

                    // Bu hataya ait mevcut kaydı bul
                    const existingRecord = existingCostRecords.find(cost => {
                        const desc = cost.description || '';
                        return desc.includes(fault.description);
                    });

                    if (existingRecord) {
                        // Mevcut kaydı güncelle
                        const description = `Final Hataları Maliyeti - Üretilen Araç\n` +
                            `Araç: ${vehicle?.chassis_no || vehicle?.serial_no || 'Bilinmeyen'}\n` +
                            `Araç Tipi: ${vehicle?.vehicle_type || 'Bilinmeyen'}\n` +
                            `Müşteri: ${vehicle?.customer_name || 'Bilinmeyen'}\n` +
                            `\nHata Detayı:\n` +
                            `- ${fault.description} (${faultQuantity} adet)\n` +
                            `- İlgili Birim: ${departmentName}\n` +
                            `- Giderilme Süresi: ${duration} dakika\n` +
                            `- Kalite Kontrol Süresi: ${qualityDuration} dakika`;

                        const updateData = {
                            amount: totalFaultCost,
                            rework_duration: duration,
                            quality_control_duration: qualityDuration,
                            quantity: faultQuantity,
                            description: description,
                            affected_units: [
                                {
                                    unit: departmentName,
                                    duration: duration
                                },
                                {
                                    unit: qualityControlUnitName,
                                    duration: qualityDuration
                                }
                            ]
                        };

                        const { error: updateError } = await supabase
                            .from('quality_costs')
                            .update(updateData)
                            .eq('id', existingRecord.id);

                        if (updateError) {
                            console.error('❌ Kayıt güncellenemedi:', updateError);
                            throw updateError;
                        }

                        totalAmount += totalFaultCost;
                        totalQuantity += faultQuantity;
                    } else {
                        // Yeni kayıt oluştur (eğer hata için kayıt yoksa)
                        const description = `Final Hataları Maliyeti - Üretilen Araç\n` +
                            `Araç: ${vehicle?.chassis_no || vehicle?.serial_no || 'Bilinmeyen'}\n` +
                            `Araç Tipi: ${vehicle?.vehicle_type || 'Bilinmeyen'}\n` +
                            `Müşteri: ${vehicle?.customer_name || 'Bilinmeyen'}\n` +
                            `\nHata Detayı:\n` +
                            `- ${fault.description} (${faultQuantity} adet)\n` +
                            `- İlgili Birim: ${departmentName}\n` +
                            `- Giderilme Süresi: ${duration} dakika\n` +
                            `- Kalite Kontrol Süresi: ${qualityDuration} dakika`;

                        const costRecord = {
                            cost_type: 'Final Hataları Maliyeti',
                            unit: departmentName,
                            vehicle_type: vehicle?.vehicle_type || null,
                            part_code: null,
                            part_name: null,
                            amount: totalFaultCost,
                            cost_date: new Date().toISOString().slice(0, 10),
                            description: description,
                            rework_duration: duration,
                            quantity: faultQuantity,
                            affected_units: [
                                {
                                    unit: departmentName,
                                    duration: duration
                                },
                                {
                                    unit: qualityControlUnitName,
                                    duration: qualityDuration
                                }
                            ],
                            status: 'Aktif',
                            source_type: 'produced_vehicle_final_faults',
                            source_record_id: vehicle?.id,
                            quality_control_duration: qualityDuration
                        };

                        const { data: inserted, error: insertError } = await supabase
                            .from('quality_costs')
                            .insert([costRecord])
                            .select();

                        if (insertError) {
                            // Schema cache hatası kontrolü
                            if (insertError.message.includes('source_type') || insertError.message.includes('schema cache') || insertError.message.includes('column')) {
                                const { source_type, source_record_id, quality_control_duration, ...safeRecord } = costRecord;
                                safeRecord.description = safeRecord.description + `\n\n[Not: Schema cache güncellenmediği için source_type, source_record_id ve quality_control_duration kolonları kaydedilemedi.]`;
                                
                                const { error: retryError } = await supabase
                                    .from('quality_costs')
                                    .insert([safeRecord]);

                                if (retryError) {
                                    throw retryError;
                                }
                            } else {
                                throw insertError;
                            }
                        }

                        totalAmount += totalFaultCost;
                        totalQuantity += faultQuantity;
                    }
                }

                toast({
                    title: 'Başarılı!',
                    description: `Final hataları maliyet kayıtları güncellendi. Toplam: ${totalAmount.toFixed(2)} ₺`,
                    duration: 5000
                });
            } else {
                // Yeni kayıt modu
                const costRecords = [];

                // Her hata için ayrı maliyet kaydı oluştur
                for (const fault of allFaults) {
                    const duration = parseFloat(faultDurations[fault.id]) || 0;
                const qualityDuration = parseFloat(qualityControlDurations[fault.id]) || 0;
                const departmentName = fault.department?.name || fault.department_name || 'Üretim';
                const unitCost = getUnitCost(departmentName);
                const faultCost = duration * unitCost;
                const qualityControlCost = qualityDuration * qualityControlUnitCost;
                const faultQuantity = fault.quantity || 1;
                const totalFaultCost = (faultCost + qualityControlCost) * faultQuantity;

                // Sadece bu hatanın açıklamasını oluştur
                const description = `Final Hataları Maliyeti - Üretilen Araç\n` +
                    `Araç: ${vehicle?.chassis_no || vehicle?.serial_no || 'Bilinmeyen'}\n` +
                    `Araç Tipi: ${vehicle?.vehicle_type || 'Bilinmeyen'}\n` +
                    `Müşteri: ${vehicle?.customer_name || 'Bilinmeyen'}\n` +
                    `\nHata Detayı:\n` +
                    `- ${fault.description} (${faultQuantity} adet)\n` +
                    `- İlgili Birim: ${departmentName}\n` +
                    `- Giderilme Süresi: ${duration} dakika\n` +
                    `- Kalite Kontrol Süresi: ${qualityDuration} dakika`;

                const costRecord = {
                    cost_type: 'Final Hataları Maliyeti',
                    unit: departmentName,
                    vehicle_type: vehicle?.vehicle_type || null,
                    part_code: null,
                    part_name: null,
                    amount: totalFaultCost,
                    cost_date: new Date().toISOString().slice(0, 10),
                    description: description,
                    rework_duration: duration,
                    quantity: faultQuantity,
                    affected_units: [
                        {
                            unit: departmentName,
                            duration: duration
                        },
                        {
                            unit: qualityControlUnitName,
                            duration: qualityDuration
                        }
                    ],
                    status: 'Aktif',
                    source_type: 'produced_vehicle_final_faults',
                    source_record_id: vehicle?.id,
                    quality_control_duration: qualityDuration
                };

                costRecords.push(costRecord);
                totalAmount += totalFaultCost;
                totalQuantity += faultQuantity;
            }

            // Tüm kayıtları ekle
            let insertedCosts;
            let insertError;
            
            try {
                const result = await supabase
                    .from('quality_costs')
                    .insert(costRecords)
                    .select();
                
                insertedCosts = result.data;
                insertError = result.error;
            } catch (err) {
                insertError = err;
            }

            // Eğer schema cache hatası varsa, kolonları çıkar ve tekrar dene
            if (insertError && (insertError.message.includes('source_type') || insertError.message.includes('schema cache') || insertError.message.includes('column'))) {
                console.warn('⚠️ Schema cache hatası tespit edildi, kolonlar çıkarılıyor...');
                
                // Kolonları çıkararak güvenli kayıtlar oluştur
                const safeCostRecords = costRecords.map(record => {
                    const { source_type, source_record_id, quality_control_duration, ...safeRecord } = record;
                    // Açıklamaya bu bilgileri ekle
                    safeRecord.description = safeRecord.description + `\n\n[Not: Schema cache güncellenmediği için source_type, source_record_id ve quality_control_duration kolonları kaydedilemedi. Lütfen Supabase Dashboard'da SQL migration'ını çalıştırın.]`;
                    return safeRecord;
                });
                
                const { data: retryCosts, error: retryError } = await supabase
                    .from('quality_costs')
                    .insert(safeCostRecords)
                    .select();

                if (retryError) {
                    throw retryError;
                }

                insertedCosts = retryCosts;
                
                toast({
                    title: 'Uyarı',
                    description: 'Schema cache güncellenmediği için bazı kolonlar kaydedilmedi. Lütfen sayfayı yenileyin ve Supabase Dashboard\'da SQL migration\'ını çalıştırın.',
                    variant: 'destructive',
                    duration: 8000
                });
            } else if (insertError) {
                throw insertError;
            }

                toast({
                    title: 'Başarılı!',
                    description: `${insertedCosts.length} adet final hataları maliyet kaydı oluşturuldu. Toplam: ${totalAmount.toFixed(2)} ₺`,
                    duration: 5000
                });
            }

            if (refreshData) {
                refreshData();
            }

            if (onSuccess) {
                onSuccess();
            }

            setIsOpen(false);
        } catch (error) {
            console.error('❌ Final hataları maliyet kaydı oluşturulamadı:', error);
            toast({
                variant: 'destructive',
                title: 'Hata!',
                description: `Maliyet kaydı oluşturulamadı: ${error.message}`
            });
        } finally {
            setLoading(false);
        }
    };

    const totalCost = useMemo(() => {
        return Object.values(calculations).reduce((sum, calc) => sum + (calc.totalFaultCost || 0), 0);
    }, [calculations]);

    const totalQuantity = useMemo(() => {
        return allFaults.reduce((sum, fault) => sum + (fault.quantity || 1), 0);
    }, [allFaults]);

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
                <DialogHeader className="flex-shrink-0">
                    <DialogTitle className="flex items-center gap-2">
                        {isEditMode ? (
                            <>
                                <Calculator className="h-5 w-5 text-primary" />
                                Final Hataları Maliyet Kayıtlarını Düzenle
                            </>
                        ) : (
                            <>
                                <Calculator className="h-5 w-5 text-primary" />
                                Final Hataları için Maliyet Kaydı Oluştur
                            </>
                        )}
                    </DialogTitle>
                    <DialogDescription>
                        {isEditMode ? (
                            'Mevcut maliyet kayıtlarını düzenleyebilirsiniz. Süreleri güncelleyin, maliyetler otomatik olarak yeniden hesaplanacaktır.'
                        ) : (
                            'Her hata için giderilme süresini girin. Maliyet otomatik olarak hesaplanacak ve kaydedilecektir.'
                        )}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto min-h-0 pr-2">
                    <div className="space-y-4 py-4">
                        {allFaults.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <p>Hata bulunmuyor.</p>
                                <p className="text-sm mt-2">Maliyet kaydı oluşturmak için en az bir hata olmalıdır.</p>
                            </div>
                        ) : (
                            <>
                                {allFaults.map(fault => {
                                    const calc = calculations[fault.id] || {};
                                    const departmentName = fault.department?.name || fault.department_name || 'Üretim';
                                    const unitCost = getUnitCost(departmentName);

                                    return (
                                        <div key={fault.id} className={cn("p-4 border rounded-lg bg-card", fault.is_resolved && "opacity-75 border-green-300 bg-green-50/30")}>
                                            <div className="space-y-4">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Label className="text-sm font-semibold block">
                                                            {fault.description}
                                                        </Label>
                                                        {fault.is_resolved && (
                                                            <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">
                                                                Çözüldü
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground space-y-1">
                                                        <p>Birim: {departmentName}</p>
                                                        <p>Adet: {fault.quantity || 1}</p>
                                                        <p>Birim Maliyeti: {unitCost.toFixed(2)} ₺/dk</p>
                                                        <p>Kalite Kontrol Maliyeti: {calc.qualityControlUnitCost?.toFixed(2) || '0.00'} ₺/dk</p>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <Label htmlFor={`duration-${fault.id}`}>
                                                            Giderilme Süresi (dk)
                                                        </Label>
                                                        <Input
                                                            id={`duration-${fault.id}`}
                                                            type="number"
                                                            min="0"
                                                            step="0.5"
                                                            value={faultDurations[fault.id] || ''}
                                                            onChange={(e) => handleDurationChange(fault.id, e.target.value)}
                                                            placeholder="0"
                                                            className="mt-1"
                                                        />
                                                        {calc.faultCost > 0 && (
                                                            <p className="text-xs text-muted-foreground mt-1">
                                                                Birim Maliyeti: {calc.faultCost.toFixed(2)} ₺
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <Label htmlFor={`quality-duration-${fault.id}`}>
                                                            Kalite Kontrol Süresi (dk)
                                                        </Label>
                                                        <Input
                                                            id={`quality-duration-${fault.id}`}
                                                            type="number"
                                                            min="0"
                                                            step="0.5"
                                                            value={qualityControlDurations[fault.id] || ''}
                                                            onChange={(e) => handleQualityControlDurationChange(fault.id, e.target.value)}
                                                            placeholder="0"
                                                            className="mt-1"
                                                        />
                                                        {calc.qualityControlCost > 0 && (
                                                            <p className="text-xs text-muted-foreground mt-1">
                                                                Kalite Maliyeti: {calc.qualityControlCost.toFixed(2)} ₺
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                {calc.totalFaultCost > 0 && (
                                                    <div className="pt-2 border-t">
                                                        <p className="text-sm font-semibold">
                                                            Toplam Maliyet: {calc.totalFaultCost.toFixed(2)} ₺
                                                            <span className="text-xs text-muted-foreground ml-2">
                                                                ({calc.faultCost.toFixed(2)} ₺ birim + {calc.qualityControlCost.toFixed(2)} ₺ kalite) × {calc.faultQuantity} adet
                                                            </span>
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}

                                <div className="p-4 border-2 border-primary rounded-lg bg-primary/5">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-semibold">Toplam Hata Sayısı</p>
                                            <p className="text-2xl font-bold">{totalQuantity} adet</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-semibold">Toplam Maliyet</p>
                                            <p className="text-2xl font-bold text-primary">
                                                {totalCost.toFixed(2)} ₺
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <DialogFooter className="flex-shrink-0 border-t pt-4">
                    <Button variant="outline" onClick={() => setIsOpen(false)} disabled={loading}>
                        İptal
                    </Button>
                    <Button onClick={handleSubmit} disabled={loading || allFaults.length === 0}>
                        <Save className="mr-2 h-4 w-4" />
                        {loading 
                            ? (isEditMode ? 'Güncelleniyor...' : 'Kaydediliyor...') 
                            : (isEditMode 
                                ? `${allFaults.length} Hata için Maliyet Kayıtlarını Güncelle` 
                                : `${allFaults.length} Hata için Maliyet Kaydet`)
                        }
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default FaultCostModal;

