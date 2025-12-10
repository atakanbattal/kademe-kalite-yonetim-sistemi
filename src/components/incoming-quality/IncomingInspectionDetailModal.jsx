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
    onOpenStockRiskModal,
    onOpenNCForm,
    onOpenNCView,
}) => {
    const { toast } = useToast();
    const [preparedBy, setPreparedBy] = useState('');
    const [controlledBy, setControlledBy] = useState('');
    const [createdBy, setCreatedBy] = useState('');
    const [enrichedInspection, setEnrichedInspection] = useState(inspection);
    const [riskyStockData, setRiskyStockData] = useState(null);
    const [checkingRiskyStock, setCheckingRiskyStock] = useState(false);
    const [isCreatingNC, setIsCreatingNC] = useState(false);
    const [linkedNonConformities, setLinkedNonConformities] = useState([]);
    const [loadingNCs, setLoadingNCs] = useState(false);
    const [hasStockRiskControl, setHasStockRiskControl] = useState(false);
    const [stockRiskControlInfo, setStockRiskControlInfo] = useState(null);

        // Check for risky stock when modal opens or inspection data changes
    useEffect(() => {
        if (!isOpen || !enrichedInspection || !enrichedInspection.part_code) {
            setRiskyStockData(null);
            setHasStockRiskControl(false);
            return;
        }
        
        // Stok risk kontrolü başlatılmış mı kontrol et
        const checkStockRiskControl = async () => {
            if (!enrichedInspection?.id) return;
            
            const { data: stockControls, error } = await supabase
                .from('stock_risk_controls')
                .select('id, status, created_at, decision')
                .eq('source_inspection_id', enrichedInspection.id)
                .limit(1);
            
            if (!error && stockControls && stockControls.length > 0) {
                setHasStockRiskControl(true);
                setStockRiskControlInfo(stockControls[0]);
            } else {
                setHasStockRiskControl(false);
                setStockRiskControlInfo(null);
            }
        };

        checkStockRiskControl();
        
        console.log('🔍 Risk kontrolü yapılıyor - Karar:', enrichedInspection.decision);
        
        // Sadece Ret veya Şartlı Kabul durumunda risk kontrolü yap
        if (enrichedInspection.decision !== 'Ret' && enrichedInspection.decision !== 'Şartlı Kabul') {
            console.log('⚠️ Karar Ret veya Şartlı Kabul değil, risk kontrolü yapılmıyor');
            setRiskyStockData(null);
            return;
        }
        
        const checkRiskyStock = async () => {
            setCheckingRiskyStock(true);
            try {
                console.log('📊 Önceki kabul edilen kayıtlar aranıyor:', enrichedInspection.part_code);
                // Bu part_code'dan daha önce kabul edilen kayıtları kontrol et
                const { data: previousAccepted, error } = await supabase
                    .from('incoming_inspections')
                    .select('id, record_no, inspection_date, supplier:suppliers(name), quantity_accepted')
                    .eq('part_code', enrichedInspection.part_code)
                    .eq('decision', 'Kabul')
                    .neq('id', enrichedInspection.id)
                    .order('inspection_date', { ascending: false });
                
                if (error) {
                    console.error('❌ Risky stock check error:', error);
                    setRiskyStockData(null);
                } else if (previousAccepted && previousAccepted.length > 0) {
                    console.log('✅ Riskli stok bulundu! Kayıt sayısı:', previousAccepted.length);
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
                    console.log('ℹ️ Önceden kabul edilmiş kayıt bulunamadı');
                    setRiskyStockData(null);
                }
            } catch (err) {
                console.error('❌ Risky stock check exception:', err);
                setRiskyStockData(null);
            } finally {
                setCheckingRiskyStock(false);
            }
        };
        
        checkRiskyStock();
    }, [isOpen, enrichedInspection]);

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

    // İlişkili uygunsuzlukları fetch et
    useEffect(() => {
        const fetchLinkedNonConformities = async () => {
            if (!isOpen || !enrichedInspection?.id) {
                setLinkedNonConformities([]);
                return;
            }

            setLoadingNCs(true);
            try {
                // Bu muayene kaydına bağlı tüm uygunsuzlukları çek
                const { data, error } = await supabase
                    .from('non_conformities')
                    .select('id, nc_number, type, title, status, created_at, responsible_person')
                    .eq('source_inspection_id', enrichedInspection.id)
                    .order('created_at', { ascending: false });

                if (error) {
                    console.error('Uygunsuzluklar yüklenirken hata:', error);
                    setLinkedNonConformities([]);
                } else {
                    setLinkedNonConformities(data || []);
                    console.log(`✅ ${data?.length || 0} ilişkili uygunsuzluk bulundu`);
                }
            } catch (err) {
                console.error('Uygunsuzluk fetch hatası:', err);
                setLinkedNonConformities([]);
            } finally {
                setLoadingNCs(false);
            }
        };

        fetchLinkedNonConformities();
    }, [isOpen, enrichedInspection?.id]);

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

    const handleStartStockControl = async () => {
        if (!riskyStockData || !riskyStockData.previous_items || riskyStockData.previous_items.length === 0) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Kontrol edilecek önceki kayıt bulunamadı.',
            });
            return;
        }

        try {
            // Riskli stokları tam veriyle yeniden fetch et
            const recordNumbers = riskyStockData.previous_items.map(item => item.record_no);
            const { data: fullRiskyStock, error } = await supabase
                .from('incoming_inspections')
                .select('*, supplier:suppliers!left(id, name)')
                .in('record_no', recordNumbers);

            if (error) throw error;

            // StockRiskModal'ı aç - Form modal ile aynı yapı
            if (onOpenStockRiskModal) {
                onOpenStockRiskModal(enrichedInspection, fullRiskyStock);
                toast({
                    title: 'Stok Risk Kontrolü Başlatılıyor',
                    description: `${fullRiskyStock.length} adet riskli stok kaydı için kontrol başlatılıyor. Kontrol sonuçlarını kaydedebilirsiniz.`,
                    duration: 4000
                });
                setIsOpen(false); // Bu modalı kapat
            } else {
                toast({
                    variant: 'destructive',
                    title: 'Hata',
                    description: 'Stok kontrol modalı açılamadı.',
                });
            }

        } catch (error) {
            console.error('Stok kontrol başlatma hatası:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: `Stok kontrolü başlatılamadı: ${error.message}`,
            });
        }
    };

    const generateNCDescription = async () => {
        if (!enrichedInspection) return '';

        let description = `GİRDİ KALİTE KONTROLÜ - UYGUNSUZLUK TESPİTİ\n\n`;
        description += `MUAYENE BİLGİLERİ:\n`;
        description += `Kayıt No: ${enrichedInspection.record_no || 'Belirtilmemiş'}\n`;
        description += `Muayene Tarihi: ${enrichedInspection.inspection_date ? format(new Date(enrichedInspection.inspection_date), 'dd.MM.yyyy', { locale: tr }) : 'Belirtilmemiş'}\n`;
        description += `Tedarikçi: ${enrichedInspection.supplier_name || 'Belirtilmemiş'}\n`;
        description += `Parça Adı: ${enrichedInspection.part_name || 'Belirtilmemiş'}\n`;
        description += `Parça Kodu: ${enrichedInspection.part_code || 'Belirtilmemiş'}\n`;
        description += `Gelen Miktar: ${enrichedInspection.quantity_received || 0} adet\n`;
        description += `Kontrol Edilen Miktar: ${enrichedInspection.quantity_inspected || enrichedInspection.quantity_received || 0} adet\n`;
        description += `Nihai Karar: ${enrichedInspection.decision || 'Belirtilmemiş'}\n\n`;

        // Kontrol planını fetch et - nominal/min/max değerlerini almak için
        let controlPlanItems = [];
        try {
            const { data: controlPlan } = await supabase
                .from('incoming_control_plans')
                .select('items')
                .eq('part_code', enrichedInspection.part_code)
                .single();
            
            if (controlPlan && controlPlan.items) {
                controlPlanItems = controlPlan.items;
                console.log('📋 Kontrol planı bulundu:', controlPlanItems.length, 'özellik');
            }
        } catch (error) {
            console.warn('⚠️ Kontrol planı alınamadı:', error);
        }

        // Ölçüm sonuçlarını detaylı göster
        if (enrichedInspection.results && enrichedInspection.results.length > 0) {
            description += `ÖLÇÜM SONUÇLARI VE TESPİTLER:\n\n`;
            
            // Her result'un tüm değerlerini kabul et - sadece OK olmayanları al
            const failedResults = enrichedInspection.results.filter(r => {
                // Eğer result boolean ise: true/false
                if (typeof r.result === 'boolean') {
                    return !r.result; // false = NOK
                }
                // Eğer result string ise:
                const resultStr = (r.result || '').toString().trim().toUpperCase();
                // OK veya boş değilse failed sayılır
                return resultStr !== 'OK' && resultStr !== '';
            });
            
            console.log(`✅ ${failedResults.length} uygunsuz ölçüm bulundu (${enrichedInspection.results.length} toplam)`);
            console.log('📊 İlk 5 result:', enrichedInspection.results.slice(0, 5).map((r, i) => ({
                index: i + 1,
                name: r.characteristic_name,
                measured: r.measured_value,
                nominal: r.nominal_value,
                min: r.min_value,
                max: r.max_value,
                result: r.result
            })));
            
            if (failedResults.length > 0) {
                description += `UYGUNSUZ BULUNAN ÖLÇÜMLER:\n`;
                failedResults.forEach((result, idx) => {
                    // Kontrol planından nominal/min/max değerlerini al
                    const planItem = controlPlanItems.find(item => item.id === result.control_plan_item_id);
                    
                    const nominal = planItem?.nominal_value ?? result.nominal_value ?? null;
                    const min = planItem?.min_value ?? result.min_value ?? null;
                    const max = planItem?.max_value ?? result.max_value ?? null;
                    
                    // actual_value öncelikli kontrol (veritabanında actual_value olarak kaydediliyor)
                    // measured_value veya actual_value kontrolü (0 geçerli bir ölçüm!)
                    const measuredValue = (result.actual_value !== null && 
                                          result.actual_value !== undefined && 
                                          String(result.actual_value).trim() !== '') 
                                        ? result.actual_value 
                                        : (result.measured_value !== null && 
                                           result.measured_value !== undefined && 
                                           String(result.measured_value).trim() !== '' 
                                           ? result.measured_value 
                                           : null);
                    
                    console.log(`🔍 Ölçüm ${idx + 1} - raw actual_value:`, result.actual_value, 'raw measured_value:', result.measured_value, 'parsed:', measuredValue);
                    
                    description += `\n${idx + 1}. ${result.characteristic_name || 'Özellik'}`;
                    if (result.measurement_number && result.total_measurements) {
                        description += ` (Ölçüm ${result.measurement_number}/${result.total_measurements})`;
                    }
                    description += `:\n`;
                    
                    // Beklenen değer ve tolerans bilgileri
                    if (nominal !== null || min !== null || max !== null) {
                        description += `   Beklenen Değer (Nominal): ${nominal !== null ? nominal + ' mm' : '-'}\n`;
                        description += `   Tolerans Aralığı: ${min !== null ? min : '-'} mm ~ ${max !== null ? max : '-'} mm\n`;
                    }
                    
                    // Gerçek ölçülen değer
                    if (measuredValue !== null && measuredValue !== '') {
                        description += `   Gerçek Ölçülen Değer: ${measuredValue} mm\n`;
                    
                        // Hatalı değer kontrolü ve sapma analizi
                        const measuredNum = parseFloat(String(measuredValue).replace(',', '.'));
                        const isOutOfTolerance = (min !== null && measuredNum < parseFloat(min)) || 
                                                (max !== null && measuredNum > parseFloat(max));
                        
                        if (isOutOfTolerance) {
                            description += `   ⚠ HATALI DEĞER: Tolerans dışında!\n`;
                            
                            if (nominal !== null && !isNaN(measuredNum) && !isNaN(parseFloat(nominal))) {
                        const nominalNum = parseFloat(nominal);
                        const deviation = measuredNum - nominalNum;
                                description += `   → Nominal Değerden Sapma: ${deviation > 0 ? '+' : ''}${deviation.toFixed(3)} mm\n`;
                            }
                        
                            // Tolerans dışına çıkma detayları
                        if (min !== null && measuredNum < parseFloat(min)) {
                            const underTolerance = parseFloat(min) - measuredNum;
                                description += `   → Alt Tolerans Aşımı: ${min} mm'den ${underTolerance.toFixed(3)} mm küçük (${((underTolerance / parseFloat(min)) * 100).toFixed(2)}%)\n`;
                        }
                        if (max !== null && measuredNum > parseFloat(max)) {
                            const overTolerance = measuredNum - parseFloat(max);
                                description += `   → Üst Tolerans Aşımı: ${max} mm'den ${overTolerance.toFixed(3)} mm büyük (${((overTolerance / parseFloat(max)) * 100).toFixed(2)}%)\n`;
                        }
                        } else if (nominal !== null && !isNaN(measuredNum) && !isNaN(parseFloat(nominal))) {
                            // Tolerans içinde ama nominal değerden sapma var
                            const nominalNum = parseFloat(nominal);
                            const deviation = measuredNum - nominalNum;
                            if (Math.abs(deviation) > 0.001) { // 0.001 mm'den büyük sapma varsa göster
                                description += `   → Nominal Değerden Sapma: ${deviation > 0 ? '+' : ''}${deviation.toFixed(3)} mm (Tolerans içinde)\n`;
                        }
                    }
                    } else {
                        description += `   Gerçek Ölçülen Değer: Ölçülmemiş\n`;
                    }
                    
                    // Sonuç durumu
                    const resultDisplay = typeof result.result === 'boolean' ? (result.result ? 'OK' : 'NOK') : result.result;
                    description += `   Sonuç: ${resultDisplay}\n`;
                });
            }

            // Tüm sonuçların özeti
            const totalResults = enrichedInspection.results.length;
            const okCount = enrichedInspection.results.filter(r => r.result === 'OK' || r.result === 'Kabul').length;
            const nokCount = totalResults - okCount;
            
            description += `\n\nÖLÇÜM ÖZETİ:\n`;
            description += `Toplam Ölçüm Sayısı: ${totalResults}\n`;
            description += `Uygun Ölçümler: ${okCount}\n`;
            description += `Uygunsuz Ölçümler: ${nokCount}\n`;
            description += `Ret Oranı: ${((nokCount / totalResults) * 100).toFixed(1)}%\n`;
        }

        // Ret/Şartlı Kabul nedenleri
        if (enrichedInspection.decision === 'Ret') {
            description += `\n\nRET NEDENİ:\n`;
            if (enrichedInspection.rejection_reason) {
                description += `${enrichedInspection.rejection_reason}\n`;
            }
            if (enrichedInspection.quantity_rejected > 0) {
                description += `${enrichedInspection.quantity_rejected} adet ürün kalite standartlarını karşılamadığı için reddedilmiştir.\n`;
            }
        } else if (enrichedInspection.decision === 'Şartlı Kabul') {
            description += `\n\nŞARTLI KABUL NEDENİ:\n`;
            if (enrichedInspection.conditional_acceptance_reason) {
                description += `${enrichedInspection.conditional_acceptance_reason}\n`;
            }
        }

        // Notlar varsa ekle
        if (enrichedInspection.notes) {
            description += `\n\nEK NOTLAR:\n${enrichedInspection.notes}\n`;
        }

        description += `\n\nBu uygunsuzluk kaydı Girdi Kalite Kontrol Modülünden otomatik olarak oluşturulmuştur.`;
        
        return description;
    };

    const handleCreateNonConformity = async (ncType) => {
        if (!onOpenNCForm) {
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: 'Uygunsuzluk form modalı açılamadı.',
            });
            return;
        }

        setIsCreatingNC(true);

        try {
            // Uygunsuzluk açıklamasını oluştur (async fonksiyon - await gerekiyor)
            const ncDescription = await generateNCDescription();
            const ncTitle = `Girdi Kalite - ${enrichedInspection.supplier_name || 'Tedarikçi'} - ${enrichedInspection.part_name || enrichedInspection.part_code}`;

            // Tedarikçi varsa, önce supplier_non_conformities'e kayıt oluştur
            let supplierNCId = null;
            if (enrichedInspection.supplier_id) {
                const supplierNCData = {
                    supplier_id: enrichedInspection.supplier_id,
                    title: ncTitle,
                    description: ncDescription,
                    status: 'Açık',
                    cost_impact: 0,
                };
                
                console.log('🔍 Tedarikçi uygunsuzluğu oluşturuluyor:', supplierNCData);
                
                const { data: supplierNC, error: supplierNCError } = await supabase
                    .from('supplier_non_conformities')
                    .insert(supplierNCData)
                    .select()
                    .single();

                if (supplierNCError) {
                    console.error('❌ Tedarikçi uygunsuzluğu oluşturulamadı:', supplierNCError);
                    console.error('❌ Hata detayı:', JSON.stringify(supplierNCError, null, 2));
                    toast({
                        variant: 'destructive',
                        title: 'Hata',
                        description: `Tedarikçi uygunsuzluğu oluşturulamadı: ${supplierNCError.message}`,
                    });
                    setIsCreatingNC(false);
                    return; // İşlemi durdur
                } else {
                    supplierNCId = supplierNC.id;
                    console.log('✅ Tedarikçi uygunsuzluğu oluşturuldu:', supplierNCId);
                }
            }

            // DF veya 8D form modalını aç - ncType ile diğer parametreleri birleştir
            onOpenNCForm({
                type: ncType, // DF veya 8D
                source: 'incoming_inspection',
                source_inspection_id: enrichedInspection.id,
                source_supplier_nc_id: supplierNCId, // Tedarikçi uygunsuzluğu ile link
                title: ncTitle,
                description: ncDescription,
                supplier_id: enrichedInspection.supplier_id || null,
                supplier_name: enrichedInspection.supplier_name || null,
                part_code: enrichedInspection.part_code || null,
                part_name: enrichedInspection.part_name || null,
                is_supplier_nc: !!enrichedInspection.supplier_id, // Tedarikçi uygunsuzluğu flag'i
            });

            // Uygunsuzlukları yeniden fetch et (modal açık kalacak)
            // useEffect otomatik olarak tekrar çalışacak çünkü yeni kayıt oluşturuldu
            setTimeout(async () => {
                try {
                    const { data, error } = await supabase
                        .from('non_conformities')
                        .select('id, nc_number, type, title, status, created_at, responsible_person_id')
                        .eq('source_inspection_id', enrichedInspection.id)
                        .order('created_at', { ascending: false });

                    if (!error && data) {
                        setLinkedNonConformities(data);
                        console.log(`✅ Uygunsuzluklar güncellendi: ${data.length} kayıt`);
                    }
                } catch (err) {
                    console.error('Uygunsuzluk yenileme hatası:', err);
                }
            }, 1000); // 1 saniye bekle (database'in güncellenmesi için)

            toast({
                title: 'Başarılı',
                description: supplierNCId 
                    ? `${ncType} uygunsuzluk formu ve tedarikçi uygunsuzluğu oluşturuldu.`
                    : `${ncType} uygunsuzluk formu hazırlandı.`,
            });

        } catch (error) {
            console.error('Uygunsuzluk oluşturma hatası:', error);
            toast({
                variant: 'destructive',
                title: 'Hata',
                description: `Uygunsuzluk formu oluşturulamadı: ${error.message}`,
            });
        } finally {
            setIsCreatingNC(false);
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
                        {/* STOK KONTROL UYARISI - Sadece Ret veya Şartlı Kabul durumunda göster */}
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
                                    <div className="pt-3 border-t border-red-200">
                                        {hasStockRiskControl ? (
                                            <div className="bg-blue-50 border border-blue-200 rounded p-3">
                                                <div className="flex items-center gap-2 text-blue-700">
                                                    <CheckCircle className="h-4 w-4" />
                                                    <span className="font-semibold">Stok Risk Kontrolü Başlatıldı</span>
                                                </div>
                                                {stockRiskControlInfo && (
                                                    <div className="text-sm text-blue-600 mt-2">
                                                        Durum: <strong>{stockRiskControlInfo.status || 'Beklemede'}</strong>
                                                        {stockRiskControlInfo.decision && (
                                                            <> | Karar: <strong>{stockRiskControlInfo.decision}</strong></>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <Button
                                                onClick={handleStartStockControl}
                                                disabled={!onOpenStockRiskModal}
                                                className="w-full bg-orange-600 hover:bg-orange-700"
                                            >
                                                <AlertCircle className="h-4 w-4 mr-2" />
                                                Stok Kontrol Başlat
                                            </Button>
                                        )}
                                    </div>
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
                        
                        {/* UYGUNSUZLUK OLUŞTURMA BUTONU - Sadece Ret veya Şartlı Kabul durumunda göster */}
                        {(enrichedInspection.decision === 'Ret' || enrichedInspection.decision === 'Şartlı Kabul') && (
                            <Card className="border-orange-200 bg-orange-50">
                                <CardHeader>
                                    <CardTitle className="text-orange-700 flex items-center gap-2">
                                        <AlertCircle className="h-5 w-5" />
                                        UYGUNSUZLUK YÖNETİMİ
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {/* İlişkili Uygunsuzluklar Listesi */}
                                    {loadingNCs ? (
                                        <div className="text-sm text-gray-500 text-center py-2">
                                            Uygunsuzluklar yükleniyor...
                                        </div>
                                    ) : linkedNonConformities.length > 0 ? (
                                        <div className="space-y-2">
                                            <div className="text-sm font-medium text-gray-700">
                                                İlişkili Uygunsuzluklar ({linkedNonConformities.length}):
                                            </div>
                                            {linkedNonConformities.map((nc) => (
                                                <div
                                                    key={nc.id}
                                                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                                                >
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <Badge className={nc.type === 'DF' ? 'bg-blue-600' : 'bg-purple-600'}>
                                                                {nc.type}
                                                            </Badge>
                                                            <span className="font-medium text-sm">
                                                                {nc.nc_number || 'NC-' + nc.id.slice(0, 8)}
                                                            </span>
                                                            <Badge variant={
                                                                nc.status === 'Kapalı' ? 'success' : 
                                                                nc.status === 'Açık' ? 'destructive' : 
                                                                'secondary'
                                                            }>
                                                                {nc.status}
                                                            </Badge>
                                                        </div>
                                                        <div className="text-xs text-gray-500 mt-1">
                                                            {nc.title}
                                                        </div>
                                                        {nc.created_at && (
                                                            <div className="text-xs text-gray-400 mt-1">
                                                                Oluşturulma: {format(new Date(nc.created_at), 'dd.MM.yyyy HH:mm', { locale: tr })}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => {
                                                            if (onOpenNCView) {
                                                                onOpenNCView(nc);
                                                            }
                                                        }}
                                                        className="ml-2"
                                                    >
                                                        <Eye className="h-4 w-4 mr-1" />
                                                        Görüntüle
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : null}

                                    {/* Yeni Uygunsuzluk Oluştur Butonları - Sadece henüz uygunsuzluk yoksa göster */}
                                    {linkedNonConformities.length === 0 && (
                                        <div className="flex gap-2">
                                            <Button
                                                onClick={() => handleCreateNonConformity('DF')}
                                                disabled={isCreatingNC || !onOpenNCForm}
                                                className="flex-1 bg-blue-600 hover:bg-blue-700"
                                            >
                                                <FileDown className="h-4 w-4 mr-2" />
                                                DF Uygunsuzluk Oluştur
                                            </Button>
                                            <Button
                                                onClick={() => handleCreateNonConformity('8D')}
                                                disabled={isCreatingNC || !onOpenNCForm}
                                                className="flex-1 bg-purple-600 hover:bg-purple-700"
                                            >
                                                <FileDown className="h-4 w-4 mr-2" />
                                                8D Uygunsuzluk Oluştur
                                            </Button>
                                        </div>
                                    )}

                                    {/* Ek Uygunsuzluk Oluştur Butonu - Zaten uygunsuzluk varsa küçük buton */}
                                    {linkedNonConformities.length > 0 && (
                                        <div className="pt-2 border-t">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleCreateNonConformity('DF')}
                                                disabled={isCreatingNC || !onOpenNCForm}
                                                className="w-full"
                                            >
                                                <FileDown className="h-3 w-3 mr-2" />
                                                Yeni Uygunsuzluk Ekle
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}
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
