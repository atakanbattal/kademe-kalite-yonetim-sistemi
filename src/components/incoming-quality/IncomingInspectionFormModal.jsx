
import React, { useState, useEffect, useCallback, useMemo } from 'react';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { ScrollArea } from '@/components/ui/scroll-area';
    import { X, Plus, Trash2, AlertCircle, AlertTriangle, FileText, ExternalLink, HelpCircle } from 'lucide-react';
    import { useDropzone } from 'react-dropzone';
    import { sanitizeFileName } from '@/lib/utils';
    import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
    import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
    import { v4 as uuidv4 } from 'uuid';
    import { format, subMonths, formatDistanceToNow } from 'date-fns';
    import { tr } from 'date-fns/locale';
    import { useData } from '@/contexts/DataContext';
    import RiskyStockAlert from './RiskyStockAlert';

    const INITIAL_FORM_STATE = {
        inspection_date: new Date().toISOString().split('T')[0],
        supplier_id: '',
        delivery_note_number: '',
        part_name: '',
        part_code: '',
        quantity_received: 0,
        unit: 'Adet',
        decision: 'Beklemede',
        quantity_accepted: 0,
        quantity_conditional: 0,
        quantity_rejected: 0,
        attachments: [],
    };

    /**
     * Karakteristik özelliğe göre gerekli ölçüm sayısını hesaplar
     * - Emniyet: %100 (her parça)
     * - Kritik: ~%33 (her 3 parçada 1)
     * - Fonksiyonel: ~%20 (her 5 parçada 1)
     * - Minör: 1/parti (her zaman sadece 1 ölçüm)
     */
    const calculateMeasurementCount = (characteristicType, incomingQuantity) => {
        const quantity = Number(incomingQuantity) || 0;
        if (quantity === 0) return 0;
        
        const type = String(characteristicType).toLowerCase();
        
        let count;
        if (type.includes('emniyet')) {
            // Emniyet: Her parça ölçülür (100%)
            count = quantity;
        } else if (type.includes('kritik')) {
            // Kritik: Her 3 parçada 1 ölçüm (yaklaşık %33)
            count = Math.ceil(quantity / 3);
        } else if (type.includes('fonksiyonel')) {
            // Fonksiyonel: Her 5 parçada 1 ölçüm (yaklaşık %20)
            count = Math.ceil(quantity / 5);
        } else if (type.includes('minör') || type.includes('minor')) {
            // Minör: 1/parti - Her zaman sadece 1 ölçüm (miktar ne olursa olsun)
            count = 1;
        } else {
            // Varsayılan: En az 1 ölçüm
            count = 1;
        }

        return count;
    };

    const InspectionResultRow = ({ item, index, onResultChange, isViewMode }) => {
        const hasTolerance = item.min_value !== null && item.max_value !== null;

        const handleActualValueChange = (value) => {
            let result = null;
            const normalizedValue = String(value).replace(',', '.');

            if (hasTolerance) {
                const actual = parseFloat(normalizedValue);
                if (!isNaN(actual)) {
                    const min = parseFloat(String(item.min_value).replace(',', '.'));
                    const max = parseFloat(String(item.max_value).replace(',', '.'));
                     if (!isNaN(min) && !isNaN(max)) {
                        result = actual >= min && actual <= max;
                    }
                }
            } else {
                const lowerCaseValue = normalizedValue.trim().toLowerCase();
                if (lowerCaseValue === 'ok' || lowerCaseValue === 'uygun') {
                    result = true;
                } else if (lowerCaseValue !== '') {
                    result = false;
                }
            }
            onResultChange(index, 'measured_value', value, result);
        };

        return (
            <tr className="border-b">
                <td className="p-2 align-middle">{item.characteristic_name}</td>
                <td className="p-2 align-middle">{item.measurement_method}</td>
                <td className="p-2 align-middle text-center">{item.measurement_number}/{item.total_measurements}</td>
                <td className="p-2 align-middle text-center">{item.nominal_value || '-'}</td>
                {hasTolerance && <td className="p-2 align-middle text-center">{item.min_value || '-'}</td>}
                {hasTolerance && <td className="p-2 align-middle text-center">{item.max_value || '-'}</td>}
                <td className="p-2 align-middle">
                    <Input
                        type="text"
                        inputMode={hasTolerance ? "decimal" : "text"}
                        placeholder={hasTolerance ? "Değer girin" : "OK/NOK"}
                        value={item.measured_value || ''}
                        onChange={(e) => handleActualValueChange(e.target.value)}
                        disabled={isViewMode}
                        className={item.result === false ? 'border-destructive focus-visible:ring-destructive' : ''}
                    />
                </td>
                <td className="p-2 align-middle text-center">
                    <div className={`p-2 rounded-md font-medium text-sm ${item.result === true ? 'bg-green-100 text-green-700' : item.result === false ? 'bg-red-100 text-red-700' : 'bg-muted'}`}>
                        {item.result === true ? 'UYGUN' : item.result === false ? 'UYGUN DEĞİL' : 'Bekliyor'}
                    </div>
                </td>
            </tr>
        );
    };

    const IncomingInspectionFormModal = ({ isOpen, setIsOpen, existingInspection, refreshData, isViewMode, onOpenStockRiskModal }) => {
        const { toast } = useToast();
        const { suppliers, characteristics, equipment } = useData();
        const [formData, setFormData] = useState(INITIAL_FORM_STATE);
        const [controlPlan, setControlPlan] = useState(null);
        const [inkrReport, setInkrReport] = useState(null);
        const [results, setResults] = useState([]);
        const [defects, setDefects] = useState([]);
        const [newAttachments, setNewAttachments] = useState([]);
        const [existingAttachments, setExistingAttachments] = useState([]);
        const [isSubmitting, setIsSubmitting] = useState(false);
        const [warnings, setWarnings] = useState({ inkr: null, plan: null });
        const [partHistory, setPartHistory] = useState([]);
        const [measurementSummary, setMeasurementSummary] = useState([]);
        const [riskyStockData, setRiskyStockData] = useState(null);
        const [showRiskyStockAlert, setShowRiskyStockAlert] = useState(false);
        const [checkingRiskyStock, setCheckingRiskyStock] = useState(false);

        const resetForm = useCallback(() => {
            setFormData(INITIAL_FORM_STATE);
            setControlPlan(null);
            setInkrReport(null);
            setResults([]);
            setDefects([]);
            setNewAttachments([]);
            setExistingAttachments([]);
            setWarnings({ inkr: null, plan: null });
            setPartHistory([]);
            setMeasurementSummary([]);
            setRiskyStockData(null);
setShowRiskyStockAlert(false);
            setCheckingRiskyStock(false);
        }, []);

        // Load existing inspection data when modal opens
        // ÖNEMLİ: Sadece existingInspection değiştiğinde çalış, isOpen her değişiminde değil
        useEffect(() => {
            if (!isOpen) {
                // Modal kapandığında hiçbir şey yapma - veriler korunmalı
                return;
            }
            
            if (existingInspection) {
                // Düzenleme modu: Mevcut kayıt verilerini yükle
                console.log('📝 Düzenleme modu: Kayıt yükleniyor...', existingInspection.id);
                setFormData({
                    inspection_date: existingInspection.inspection_date || new Date().toISOString().split('T')[0],
                    supplier_id: existingInspection.supplier_id || '',
                    delivery_note_number: existingInspection.delivery_note_number || '',
                    part_name: existingInspection.part_name || '',
                    part_code: existingInspection.part_code || '',
                    quantity_received: existingInspection.quantity_received || 0,
                    unit: existingInspection.unit || 'Adet',
                    decision: existingInspection.decision || 'Beklemede',
                    quantity_accepted: existingInspection.quantity_accepted || 0,
                    quantity_conditional: existingInspection.quantity_conditional || 0,
                    quantity_rejected: existingInspection.quantity_rejected || 0,
                    attachments: existingInspection.attachments || [],
                });
                
                // Load measurement results
                if (existingInspection.results && Array.isArray(existingInspection.results)) {
                    setResults(existingInspection.results);
                    console.log('✅ Ölçüm sonuçları yüklendi:', existingInspection.results.length);
                }
                
                // Load defects
                if (existingInspection.defects && Array.isArray(existingInspection.defects)) {
                    setDefects(existingInspection.defects);
                    console.log('✅ Hatalar yüklendi:', existingInspection.defects.length);
                }
                
                // Load existing attachments
                if (existingInspection.attachments && Array.isArray(existingInspection.attachments)) {
                    setExistingAttachments(existingInspection.attachments);
                    console.log('✅ Ekler yüklendi:', existingInspection.attachments.length);
                }
            } else if (isOpen) {
                // Yeni kayıt modu: Sadece modal YENİ açıldığında formu sıfırla
                console.log('➕ Yeni kayıt modu: Form sıfırlanıyor...');
                resetForm();
            }
        }, [existingInspection, isOpen, resetForm]);

        const quantityTotal = useMemo(() => {
            return (Number(formData.quantity_accepted) || 0) + (Number(formData.quantity_conditional) || 0) + (Number(formData.quantity_rejected) || 0);
        }, [formData.quantity_accepted, formData.quantity_conditional, formData.quantity_rejected]);

        const isQuantityMismatch = useMemo(() => {
            const received = Number(formData.quantity_received) || 0;
            return received > 0 && quantityTotal !== received;
        }, [quantityTotal, formData.quantity_received]);
        
        // ÖNEMLİ: Kontrol planından ölçüm sonuçları oluştur
        // ANCAK düzenleme modunda mevcut ölçüm değerlerini KORUMAK çok önemli!
        useEffect(() => {
            const generateResultsFromPlan = () => {
                const incomingQuantity = Number(formData.quantity_received) || 0;

                if (!controlPlan || !controlPlan.items || controlPlan.items.length === 0 || incomingQuantity <= 0) {
                    // Kontrol planı yoksa ve düzenleme modunda DEĞİLSEK temizle
                    if (!existingInspection) {
                        setResults([]);
                        setMeasurementSummary([]);
                    }
                    return;
                }

                // DÜZENLEME MODU: Mevcut results ile kontrol planı SYNC kontrolü
                if (existingInspection && results.length > 0) {
                    // KRİTİK: Kontrol planındaki beklenen toplam ölçüm sayısını hesapla
                    let expectedResultCount = 0;
                    controlPlan.items.forEach((item) => {
                        const characteristic = characteristics.find(c => c.value === item.characteristic_id);
                        if (characteristic) {
                            const characteristicType = item.characteristic_type || characteristic.type;
                            if (characteristicType) {
                                expectedResultCount += calculateMeasurementCount(characteristicType, incomingQuantity);
                            }
                        }
                    });
                    
                    // ESKİ KAYITLARDA UYUMSUZLUK: Results sayısı kontrol planı ile eşleşmiyor
                    if (results.length !== expectedResultCount) {
                        console.warn(`🔄 ESKİ KAYIT TESPİT EDİLDİ (sayı uyumsuz)! Results: ${results.length}, Beklenen: ${expectedResultCount}`);
                        console.warn('🔄 Results yeniden oluşturuluyor - eski format güncellenecek');
                        // Results'ı YENİDEN oluştur - aşağıdaki "YENİ KAYIT" koduna düşecek
                    } else {
                        // Sayı UYUMLU ama nominal/min/max değerleri ESKİ FORMATTA olabilir!
                        // Her result item'ın nominal/min/max değerlerini kontrol planı ile SYNC et
                        console.log('⚠️ Düzenleme modu: Sayı uyumlu, nominal/min/max değerleri kontrol ediliyor...');
                        
                        let needsSync = false;
                        let resultIndex = 0;
                        
                        for (const planItem of controlPlan.items) {
                            const characteristic = characteristics.find(c => c.value === planItem.characteristic_id);
                            if (!characteristic) continue;
                            
                            const characteristicType = planItem.characteristic_type || characteristic.type;
                            if (!characteristicType) continue;
                            
                            const count = calculateMeasurementCount(characteristicType, incomingQuantity);
                            
                            // Bu karakteristik için tüm ölçümleri kontrol et
                            for (let i = 0; i < count; i++) {
                                const result = results[resultIndex];
                                if (!result) break;
                                
                                // Nominal/min/max değerleri kontrol planı ile UYUMLU MU?
                                const nominalMatch = result.nominal_value == planItem.nominal_value; // == kullan (tip kontrolü yapma)
                                const minMatch = result.min_value == planItem.min_value;
                                const maxMatch = result.max_value == planItem.max_value;
                                
                                if (!nominalMatch || !minMatch || !maxMatch) {
                                    console.warn(`🔄 Result ${resultIndex + 1} SYNC'den düştü:`, {
                                        result: { nominal: result.nominal_value, min: result.min_value, max: result.max_value },
                                        plan: { nominal: planItem.nominal_value, min: planItem.min_value, max: planItem.max_value }
                                    });
                                    needsSync = true;
                                    break;
                                }
                                
                                resultIndex++;
                            }
                            
                            if (needsSync) break;
                        }
                        
                        if (needsSync) {
                            console.warn('🔄 ESKİ KAYIT TESPİT EDİLDİ (nominal/min/max uyumsuz)! Results SYNC edilecek...');
                            // Results'ı YENİDEN oluştur ama measured_value ve result değerlerini KORU
                            // Aşağıdaki "YENİ KAYIT" koduna düşecek ama measured_value'ları koruyacağız
                        } else {
                            console.log('✅ Düzenleme modu: Tüm değerler SYNC, mevcut results korunuyor:', results.length);
                            // Sadece summary'yi güncelle, results'a dokunma
                            const summary = [];
                            controlPlan.items.forEach((item) => {
                                const characteristic = characteristics.find(c => c.value === item.characteristic_id);
                                if (!characteristic) return;
                                
                                const characteristicType = item.characteristic_type || characteristic.type;
                                if (!characteristicType) return;
                                
                                const count = calculateMeasurementCount(characteristicType, incomingQuantity);
                                summary.push({
                                    name: characteristic.label,
                                    type: characteristicType,
                                    count: count,
                                    method: equipment.find(e => e.value === item.equipment_id)?.label || 'Bilinmiyor',
                                    nominal: item.nominal_value,
                                    tolerance: item.min_value !== null ? `${item.min_value} - ${item.max_value}` : 'Yok'
                                });
                            });
                            setMeasurementSummary(summary);
                            return; // Mevcut results'ı değiştirme!
                        }
                    }
                }

                // YENİ KAYIT MODU veya ESKİ KAYIT SYNC: Ölçüm sonuçları oluştur
                const isOldRecordSync = existingInspection && results.length > 0;
                console.log(isOldRecordSync ? '🔄 ESKİ KAYIT SYNC: Ölçüm sonuçları yeniden oluşturuluyor (measured_value korunacak)...' : '➕ YENİ KAYIT: Ölçüm sonuçları oluşturuluyor...');
                console.log('📋 Kontrol Planı Items Sayısı:', controlPlan.items?.length || 0);
                
                if (!controlPlan.items || controlPlan.items.length === 0) {
                    console.error('❌ Kontrol planında hiç item yok!');
                    setResults([]);
                    setMeasurementSummary([]);
                    return;
                }
                
                const newResults = [];
                const summary = [];
                let totalGeneratedResults = 0;
                let oldResultIndex = 0; // Eski results dizisindeki index

                controlPlan.items.forEach((item, index) => {
                    console.log(`🔍 Item ${index + 1}/${controlPlan.items.length} işleniyor:`, {
                        characteristic_id: item.characteristic_id,
                        nominal: item.nominal_value,
                        min: item.min_value,
                        max: item.max_value
                    });
                    
                    const characteristic = characteristics.find(c => c.value === item.characteristic_id);
                    if (!characteristic) {
                        console.warn('⚠️ Karakteristik bulunamadı:', item.characteristic_id);
                        return;
                    }

                    let characteristicType = item.characteristic_type;
                    if (!characteristicType) {
                        characteristicType = characteristic.type;
                        if (!characteristicType) {
                            console.warn('⚠️ Karakteristik tipi bulunamadı');
                            return;
                        }
                    }
                    
                    const count = calculateMeasurementCount(characteristicType, incomingQuantity);
                    console.log(`✅ ${count} ölçüm oluşturulacak - Karakteristik: ${characteristic.label}`);
                    
                    summary.push({
                        name: characteristic.label,
                        type: characteristicType,
                        count: count,
                        method: equipment.find(e => e.value === item.equipment_id)?.label || 'Bilinmiyor',
                        nominal: item.nominal_value,
                        tolerance: item.min_value !== null && item.min_value !== undefined ? `${item.min_value} - ${item.max_value}` : 'Yok'
                    });

                    for (let i = 1; i <= count; i++) {
                        // ESKİ KAYIT SYNC: measured_value ve result değerlerini ESKİ results'tan al
                        const oldResult = isOldRecordSync && oldResultIndex < results.length ? results[oldResultIndex] : null;
                        
                        const resultItem = {
                            id: oldResult?.id || uuidv4(),
                            control_plan_item_id: item.id,
                            characteristic_name: characteristic.label,
                            characteristic_type: characteristicType,
                            measurement_method: equipment.find(e => e.value === item.equipment_id)?.label || 'Bilinmiyor',
                            measurement_number: i,
                            total_measurements: count,
                            // KRİTİK: Nominal, min, max değerlerini KESİNLİKLE GÜNCEL kontrol planından al
                            nominal_value: item.nominal_value !== undefined && item.nominal_value !== null ? item.nominal_value : '',
                            min_value: item.min_value !== undefined && item.min_value !== null ? item.min_value : null,
                            max_value: item.max_value !== undefined && item.max_value !== null ? item.max_value : null,
                            // ESKİ KAYIT ise measured_value ve result'ı KORU
                            measured_value: oldResult?.measured_value || '',
                            result: oldResult?.result || null,
                        };
                        
                        if (i === 1) {
                            console.log(`   📝 İlk ölçüm oluşturuldu:`, {
                                nominal: resultItem.nominal_value,
                                min: resultItem.min_value,
                                max: resultItem.max_value,
                                measured_value: resultItem.measured_value,
                                result: resultItem.result,
                                isOldValue: !!oldResult
                            });
                        }
                        
                        newResults.push(resultItem);
                        oldResultIndex++;
                    }
                    totalGeneratedResults += count;
                });
                
                console.log(`✅ TOPLAM ${newResults.length} ölçüm sonucu oluşturuldu`);
                console.log('📊 İlk ölçüm sonucu:', newResults[0]);
                console.log('📊 Son ölçüm sonucu:', newResults[newResults.length - 1]);
                
                setResults(newResults);
                setMeasurementSummary(summary);
            };

            generateResultsFromPlan();
        }, [formData.quantity_received, controlPlan, characteristics, equipment, existingInspection, results.length]);

        const handlePartCodeChange = useCallback(async (partCode) => {
            const trimmedPartCode = partCode?.trim();
            setFormData(prev => ({ ...prev, part_code: trimmedPartCode, part_name: '' }));
            setWarnings({ inkr: null, plan: null });
            setControlPlan(null);
            setResults([]);
            setPartHistory([]);

            if (!trimmedPartCode) return;
            
            try {
                const planPromise = supabase.from('incoming_control_plans').select('*').eq('part_code', trimmedPartCode).order('revision_number', { ascending: false }).limit(1).maybeSingle();
                const inkrPromise = supabase.from('inkr_reports').select('id').eq('part_code', trimmedPartCode).maybeSingle();
                const historyPromise = supabase.from('incoming_inspections')
                    .select('delivery_note_number, inspection_date, decision, quantity_rejected, quantity_conditional, suppliers!left(*)')
                    .eq('part_code', trimmedPartCode)
                    .in('decision', ['Ret', 'Şartlı Kabul'])
                    .gte('inspection_date', format(subMonths(new Date(), 12), 'yyyy-MM-dd'))
                    .order('inspection_date', { ascending: false })
                    .limit(5);

                const [planRes, inkrRes, historyRes] = await Promise.all([planPromise, inkrPromise, historyPromise]);

                if (planRes.error) throw planRes.error;
                if (inkrRes.error) throw inkrRes.error;
                if (historyRes.error) throw historyRes.error;

                setPartHistory(historyRes.data || []);
                
                // KRİTİK: Kontrol planını log'layarak kontrol et
                if (planRes.data) {
                    console.log('🔍 Kontrol Planı Çekildi:', planRes.data);
                    console.log('📊 Kontrol Planı Items:', planRes.data.items);
                    if (planRes.data.items && planRes.data.items.length > 0) {
                        console.log(`✅ TOPLAM ${planRes.data.items.length} KARAKTERISTIK BULUNDU`);
                        planRes.data.items.forEach((item, idx) => {
                            console.log(`📦 Item ${idx + 1}:`, {
                                characteristic_id: item.characteristic_id,
                                nominal: item.nominal_value,
                                min: item.min_value,
                                max: item.max_value,
                                // Standart alanları artık kullanılmıyor
                                STANDART_KULLANILMIYOR: '(standard_id, tolerance_class, standard_class)'
                            });
                        });
                    } else {
                        console.warn('⚠️ Kontrol planında hiç karakteristik YOK!');
                    }
                }
                
                setControlPlan(planRes.data);
                setInkrReport(inkrRes.data);

                if (planRes.data) {
                    setFormData(prev => ({ ...prev, part_name: planRes.data.part_name }));
                } else {
                    setWarnings(prev => ({ ...prev, plan: 'Bu parça için bir Kontrol Planı hazırlanmalı.' }));
                }

                if (!inkrRes.data) {
                    setWarnings(prev => ({ ...prev, inkr: 'Bu parça için bir İlk Numune Kontrol Raporu (INKR) bulunamadı.' }));
                }
                
            } catch(error) {
                 toast({ variant: 'destructive', title: 'Hata', description: `Veri çekilirken hata: ${error.message}` });
            }
        }, [toast]);
        
        useEffect(() => {
            const initializeForm = async () => {
                resetForm();
                if (existingInspection) {
                    const { supplier, defects: existingDefects, attachments: existingAttachmentsData, results: existingResultsData, ...rest } = existingInspection;
                    
                    setFormData({
                        ...INITIAL_FORM_STATE,
                        ...rest,
                        quantity_received: Number(rest.quantity_received) || 0,
                        quantity_accepted: Number(rest.quantity_accepted) || 0,
                        quantity_conditional: Number(rest.quantity_conditional) || 0,
                        quantity_rejected: Number(rest.quantity_rejected) || 0,
                        supplier_id: rest.supplier_id || '',
                        inspection_date: new Date(rest.inspection_date).toISOString().split('T')[0],
                    });

                    if (rest.part_code) {
                        await handlePartCodeChange(rest.part_code);
                    }
                    
                    setDefects(existingDefects || []);
                    if (existingResultsData && existingResultsData.length > 0) {
                         setResults(existingResultsData.map(r => ({
                            ...r,
                            id: uuidv4(),
                            characteristic_name: r.feature,
                            measured_value: r.actual_value,
                        })));
                    }
                    setExistingAttachments(existingAttachmentsData || []);
                    
                } else {
                    setFormData(INITIAL_FORM_STATE);
                }
            };
            if (isOpen) initializeForm();
        }, [isOpen, existingInspection, resetForm, handlePartCodeChange]);

        const handleRiskyStockCheck = async () => {
            const hasRejectedOrConditional = 
                (formData.quantity_rejected && parseInt(formData.quantity_rejected, 10) > 0) ||
                (formData.quantity_conditional && parseInt(formData.quantity_conditional, 10) > 0);

            if (!hasRejectedOrConditional) {
                setShowRiskyStockAlert(false);
                setRiskyStockData(null);
                return;
            }

            if (!formData.part_code) return;

            setCheckingRiskyStock(true);

            try {
                // Mevcut kaydın muayene tarihini al
                const currentInspectionDate = formData.inspection_date 
                    ? format(new Date(formData.inspection_date), 'yyyy-MM-dd')
                    : format(new Date(), 'yyyy-MM-dd');
                
                let query = supabase
                    .from('incoming_inspections')
                    .select('*, supplier:suppliers!left(id, name)')
                    .eq('part_code', formData.part_code)
                    .in('decision', ['Kabul', 'Kabul Edildi'])
                    .gt('quantity_accepted', 0)
                    .lte('inspection_date', currentInspectionDate) // Sadece mevcut kayıt tarihi ve öncesi
                    .order('inspection_date', { ascending: false })
                    .limit(10);
                
                if (formData.id) {
                    query = query.neq('id', formData.id);
                }

                const { data: inspections, error } = await query;
                
                if (error) throw error;
                
                const hasRiskyStock = inspections && inspections.length > 0;
                
                if (hasRiskyStock) {
                    setRiskyStockData(inspections);
                    setShowRiskyStockAlert(true);
                } else {
                    setRiskyStockData(null);
                    setShowRiskyStockAlert(false);
                }

            } catch (error) {
                console.error("Riskli stok kontrol hatası:", error);
                toast({ variant: "destructive", title: "Hata", description: `Riskli stok kontrolü başarısız oldu: ${error.message}` });
            } finally {
                setCheckingRiskyStock(false);
            }
        };

        useEffect(() => {
            const timer = setTimeout(() => {
                handleRiskyStockCheck();
            }, 800);

            return () => clearTimeout(timer);
        }, [formData.quantity_rejected, formData.quantity_conditional, formData.part_code]);


        useEffect(() => {
            const { quantity_accepted, quantity_conditional, quantity_rejected, quantity_received } = formData;
            const qtyAccepted = Number(quantity_accepted) || 0;
            const qtyConditional = Number(quantity_conditional) || 0;
            const qtyRejected = Number(quantity_rejected) || 0;
            const qtyReceivedNum = Number(quantity_received) || 0;

            let newDecision = 'Beklemede';
            if (qtyReceivedNum > 0 && quantityTotal === qtyReceivedNum) {
                if (qtyRejected > 0) newDecision = 'Ret';
                else if (qtyConditional > 0) newDecision = 'Şartlı Kabul';
                else if (qtyAccepted === qtyReceivedNum) newDecision = 'Kabul';
            }
            
            setFormData(prev => ({...prev, decision: newDecision }));
        }, [formData.quantity_accepted, formData.quantity_conditional, formData.quantity_rejected, formData.quantity_received, quantityTotal]);

        // Measurement values are auto-generated server-side for accepted items

        const handleResultChange = (index, field, value, resultStatus) => {
            const newResults = [...results];
            const currentResult = { ...newResults[index], [field]: value };
            if(resultStatus !== undefined) currentResult.result = resultStatus;
            newResults[index] = currentResult;
            setResults(newResults);
        };
        
        const handleInputChange = (e) => {
            const { name, value, type } = e.target;
            setFormData(prev => ({ 
                ...prev, 
                [name]: type === 'number' ? Number(value) : value 
            }));
        };
        const handleSelectChange = (name, value) => setFormData(prev => ({ ...prev, [name]: value }));
        const handleDefectChange = (index, field, value) => { const newDefects = [...defects]; newDefects[index][field] = value; setDefects(newDefects); };
        const addDefect = () => setDefects([...defects, { defect_description: '', quantity: 1 }]);
        const removeDefect = (index) => setDefects(defects.filter((_, i) => i !== index));
        const onDrop = useCallback((acceptedFiles) => setNewAttachments(prev => [...prev, ...acceptedFiles]), []);
        const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, disabled: isViewMode });
        const removeNewAttachment = (index) => setNewAttachments(prev => prev.filter((_, i) => i !== index));
        const removeExistingAttachment = async (attachmentId, filePath) => {
            const { error: deleteError } = await supabase.storage.from('incoming_control').remove([filePath]);
            if (deleteError) { toast({ variant: "destructive", title: "Hata", description: `Dosya silinemedi: ${deleteError.message}` }); return; }
            const { error } = await supabase.from('incoming_inspection_attachments').delete().eq('id', attachmentId);
            if (error) { toast({ variant: "destructive", title: "Hata", description: "Veritabanından dosya kaydı silinemedi." }); } 
            else { setExistingAttachments(prev => prev.filter(att => att.id !== attachmentId)); toast({ title: "Başarılı", description: "Ek silindi." });}
        };

        const handleSubmit = async (e) => {
            e.preventDefault();
            if (isViewMode) return;
            if (isQuantityMismatch) { toast({ variant: 'destructive', title: 'Hata', description: 'Miktar toplamı, gelen miktar ile eşleşmiyor.' }); return; }
            setIsSubmitting(true);
            
            const { id, ...dataToSubmit } = formData;
            if (!dataToSubmit.supplier_id) dataToSubmit.supplier_id = null;
            dataToSubmit.part_name = dataToSubmit.part_name || dataToSubmit.part_code;
            const fieldsToDelete = ['created_at', 'updated_at', 'record_no', 'is_first_sample', 'non_conformity', 'supplier', 'defects', 'results', 'attachments'];
            fieldsToDelete.forEach(field => delete dataToSubmit[field]);

            // Undefined key'leri ve geçersiz kolonları temizle
            const cleanedData = {};
            for (const key in dataToSubmit) {
                if (dataToSubmit[key] !== undefined && key !== 'undefined') {
                    cleanedData[key] = dataToSubmit[key];
                }
            }

            let error, inspectionRecord;
            if (existingInspection) {
                const { data, error: updateError } = await supabase.from('incoming_inspections').update(cleanedData).eq('id', existingInspection.id).select().single();
                error = updateError;
                inspectionRecord = data;
            } else {
                 const { data, error: insertError } = await supabase.from('incoming_inspections').insert(cleanedData).select().single();
                error = insertError;
                inspectionRecord = data;
            }

            if (error || !inspectionRecord) { toast({ variant: 'destructive', title: 'Hata', description: `Kayıt başarısız: ${error?.message}` }); setIsSubmitting(false); return; }
            const inspectionId = inspectionRecord.id;
            
            await supabase.from('incoming_inspection_results').delete().eq('inspection_id', inspectionId);
            const validResults = results.filter(r => r.measured_value !== '' && r.measured_value !== null);
            if (validResults.length > 0) {
                const resultsToInsert = validResults.map(r => ({
                    inspection_id: inspectionId,
                    feature: r.characteristic_name,
                    measurement_method: r.measurement_method,
                    measurement_number: r.measurement_number || null,
                    total_measurements: r.total_measurements || null,
                    nominal_value: r.nominal_value,
                    min_value: r.min_value,
                    max_value: r.max_value,
                    actual_value: String(r.measured_value),
                    result: r.result,
                    characteristic_type: r.characteristic_type,
                }));
                const { error: resultsError } = await supabase.from('incoming_inspection_results').insert(resultsToInsert);
                if (resultsError) { console.error("Error inserting results:", resultsError); toast({ variant: 'destructive', title: 'Hata', description: `Ölçüm sonuçları kaydedilemedi: ${resultsError.message}` }); }
            }
            
            await supabase.from('incoming_inspection_defects').delete().eq('inspection_id', inspectionId);
            const validDefects = defects.filter(d => d.defect_description);
            if (validDefects.length > 0) {
                 const defectsToInsert = validDefects.map(d => ({
                    inspection_id: inspectionId,
                    defect_description: d.defect_description,
                    quantity: d.quantity,
                    part_code: dataToSubmit.part_code,
                    part_name: dataToSubmit.part_name,
                }));
                await supabase.from('incoming_inspection_defects').insert(defectsToInsert);
            }

            if (newAttachments.length > 0) {
                const attachmentPromises = newAttachments.map(async (file) => {
                    const fileName = sanitizeFileName(file.name);
                    const filePath = `inspections/${inspectionId}/${uuidv4()}-${fileName}`;
                    const { error: uploadError } = await supabase.storage.from('incoming_control').upload(filePath, file);
                    if (uploadError) throw new Error(`Dosya yüklenemedi: ${uploadError.message}`);
                    return { inspection_id: inspectionId, file_path: filePath, file_name: fileName };
                });
                try {
                    const attachmentsToInsert = await Promise.all(attachmentPromises);
                    await supabase.from('incoming_inspection_attachments').insert(attachmentsToInsert);
                } catch (uploadError) { toast({ variant: 'destructive', title: 'Hata', description: uploadError.message }); setIsSubmitting(false); return; }
            }

            toast({ title: 'Başarılı', description: 'Girdi kontrol kaydı başarıyla kaydedildi.' });
            refreshData();
            setIsOpen(false);
            setIsSubmitting(false);
        };

        const title = isViewMode ? 'Girdi Kontrol Kaydını Görüntüle' : (existingInspection ? 'Girdi Kontrol Kaydını Düzenle' : 'Yeni Girdi Kontrol Kaydı');
        
        return (
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-5xl xl:max-w-7xl max-h-[90vh]">
                    <DialogHeader>
                        <DialogTitle>{title}</DialogTitle>
                        <DialogDescription>Tedarikçiden gelen malzemeler için kontrol sonuçlarını girin.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit}>
                        <ScrollArea className="max-h-[65vh] pr-4 mt-4">
                            <div className="space-y-6">
                    <div className="space-y-2">
                        {warnings.plan && <Alert variant="warning"><AlertTriangle className="h-4 w-4" /><AlertTitle>Uyarı</AlertTitle><AlertDescription>{warnings.plan}</AlertDescription></Alert>}
                        {warnings.inkr && <Alert variant="warning"><AlertTriangle className="h-4 w-4" /><AlertTitle>Uyarı</AlertTitle><AlertDescription>{warnings.inkr}</AlertDescription></Alert>}
                        {partHistory.length > 0 && <Alert variant="warning"><AlertTriangle className="h-4 w-4" /><AlertTitle>DIKKAT: Bu parça daha önce sorun yaşamıştır!</AlertTitle><AlertDescription><ul className="list-disc pl-5 mt-2 space-y-1">{partHistory.map((item, index) => <li key={index} className="text-xs">{(item.suppliers && item.suppliers.name) || 'Bilinmeyen Tedarikçi'} - İrsaliye: {item.delivery_note_number || '-'} - Tarih: {format(new Date(item.inspection_date), 'dd.MM.yyyy')} ({formatDistanceToNow(new Date(item.inspection_date), { addSuffix: true, locale: tr })}) - Karar: <span className="font-bold">{item.decision}</span> - Etkilenen Miktar: {item.quantity_rejected + item.quantity_conditional}</li>)}</ul></AlertDescription></Alert>}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 items-start">
                        <div><Label>Kontrol Tarihi</Label><Input type="date" name="inspection_date" value={formData.inspection_date} onChange={handleInputChange} required disabled={isViewMode} /></div>
                        <div><Label>Tedarikçi</Label><Select name="supplier_id" value={formData.supplier_id || ''} onValueChange={(v) => handleSelectChange('supplier_id', v)} disabled={isViewMode}><SelectTrigger><SelectValue placeholder="Tedarikçi Seçin" /></SelectTrigger><SelectContent>{(suppliers || []).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
                        <div><Label>İrsaliye No</Label><Input name="delivery_note_number" value={formData.delivery_note_number || ''} onChange={handleInputChange} placeholder="İrsaliye No" disabled={isViewMode} /></div>
                        <div><Label>Parça Kodu</Label><Input name="part_code" value={formData.part_code || ''} onChange={(e) => handlePartCodeChange(e.target.value)} placeholder="Parça Kodu Girin..." required disabled={isViewMode || !!existingInspection} /></div>
                        <div className="md:col-span-2"><Label>Parça Adı</Label><Input name="part_name" value={formData.part_name} onChange={handleInputChange} placeholder="Parça Adı" required disabled={isViewMode || !!controlPlan}/></div>
                        <div className="flex items-end gap-2">
                            <div className="flex-grow"><Label>Gelen Miktar</Label><Input type="number" name="quantity_received" value={formData.quantity_received} onChange={handleInputChange} placeholder="Miktar" required disabled={isViewMode} /></div>
                            <div className="w-24"><Label>Birim</Label><Select name="unit" value={formData.unit} onValueChange={(v) => handleSelectChange('unit', v)} disabled={isViewMode}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Adet">Adet</SelectItem><SelectItem value="Kg">Kg</SelectItem><SelectItem value="Metre">Metre</SelectItem></SelectContent></Select></div>
                        </div>
                    </div>
                    {measurementSummary.length > 0 && (
                        <div className="p-4 border rounded-lg bg-muted/50">
                            <p className="text-sm font-semibold mb-2">Bu kayıt için toplam {results.length} ölçüm satırı oluşturulacak:</p>
                            <ul className="text-xs space-y-1">
                                {measurementSummary.map((s, i) => (
                                    <li key={i}>- <strong>{s.type} ({s.name}):</strong> {s.count} ölçüm <span className="text-muted-foreground">(Yöntem: {s.method} | Nominal: {s.nominal} | Tol: {s.tolerance})</span></li>
                                ))}
                            </ul>
                        </div>
                    )}
                    <div className="space-y-4 pt-4"><h3 className="font-semibold text-lg border-b pb-2">Miktar Dağılımı ve Karar</h3>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
                            <div><Label htmlFor="quantity_accepted">Kabul Edilen</Label><Input type="number" id="quantity_accepted" name="quantity_accepted" value={formData.quantity_accepted} onChange={handleInputChange} disabled={isViewMode} /></div>
                            <div><Label htmlFor="quantity_conditional">Şartlı Kabul</Label><Input type="number" id="quantity_conditional" name="quantity_conditional" value={formData.quantity_conditional} onChange={handleInputChange} disabled={isViewMode} /></div>
                            <div><Label htmlFor="quantity_rejected">Ret Edilen</Label><Input type="number" id="quantity_rejected" name="quantity_rejected" value={formData.quantity_rejected} onChange={handleInputChange} disabled={isViewMode} /></div>
                            <div className="flex flex-col"><Label>Nihai Karar</Label><div className="mt-2 flex items-center gap-2"><span className={`font-bold text-lg ${formData.decision === 'Kabul' ? 'text-green-600' : formData.decision === 'Ret' ? 'text-red-600' : formData.decision === 'Şartlı Kabul' ? 'text-yellow-600' : 'text-muted-foreground'}`}>{formData.decision}</span><TooltipProvider><Tooltip><TooltipTrigger asChild><HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" /></TooltipTrigger><TooltipContent><p>Karar, girilen miktarlara göre otomatik hesaplanır.</p></TooltipContent></Tooltip></TooltipProvider></div></div>
                        </div>
                        {isQuantityMismatch && !isViewMode && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Miktar Uyuşmazlığı!</AlertTitle><AlertDescription>Kabul, ret ve şartlı kabul miktarlarının toplamı ({quantityTotal}), gelen miktardan ({Number(formData.quantity_received) || 0}) farklıdır.</AlertDescription></Alert>}
                    </div>

                    {checkingRiskyStock && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 my-4 flex items-center gap-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent" />
                            <span className="text-sm text-blue-700 font-medium">Riskli stok kontrolü yapılıyor...</span>
                        </div>
                    )}
                    {showRiskyStockAlert && riskyStockData && (
                        <RiskyStockAlert
                            data={{
                                has_risky_stock: true,
                                total_quantity: riskyStockData.reduce((sum, item) => sum + item.quantity_accepted, 0),
                                inspections: riskyStockData,
                                part_code: formData.part_code,
                            }}
                            onViewStock={() => {
                                onOpenStockRiskModal(formData, riskyStockData);
                                toast({
                                    title: 'Stok Risk Kontrolü Başlatılıyor',
                                    description: `${riskyStockData.length} adet riskli stok kaydı için kontrol başlatılıyor. Kontrol sonuçlarını kaydedebilirsiniz.`,
                                    duration: 4000
                                });
                                setIsOpen(false);
                            }}
                            onClose={() => {
                                setShowRiskyStockAlert(false);
                            }}
                        />
                    )}

                    <div className="space-y-4 pt-4"><h3 className="font-semibold text-lg border-b pb-2">Kontrol Sonuçları</h3>{results && results.length > 0 ? (<div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b"><th className="p-2 text-left">Özellik</th><th className="p-2 text-left">Yöntem</th><th className="p-2 text-center">Ölçüm No</th><th className="p-2 text-center">Nominal</th>{results.some(r => r.min_value !== null) && <th className="p-2 text-center">Min</th>}{results.some(r => r.max_value !== null) && <th className="p-2 text-center">Max</th>}<th className="p-2 text-center w-40">Ölçülen Değer</th><th className="p-2 text-center w-32">Sonuç</th></tr></thead><tbody>{results.map((res, index) => (<InspectionResultRow key={res.id || index} item={res} index={index} onResultChange={handleResultChange} isViewMode={isViewMode} />))}</tbody></table></div>) : <p className="text-muted-foreground text-sm py-4 text-center">Kontrol edilecek özellik bulunamadı.</p>}</div>
                    <div className="space-y-4"><h3 className="font-semibold text-lg border-b pb-2">Tespit Edilen Hatalar</h3>{defects.map((defect, index) => (<div key={defect.id || index} className="flex items-center gap-2"><Input placeholder="Hata açıklaması" value={defect.defect_description} onChange={(e) => handleDefectChange(index, 'defect_description', e.target.value)} disabled={isViewMode} /><Input type="number" placeholder="Miktar" value={defect.quantity} onChange={(e) => handleDefectChange(index, 'quantity', e.target.value)} className="w-32" disabled={isViewMode} />{!isViewMode && <Button type="button" variant="destructive" size="icon" onClick={() => removeDefect(index)}><Trash2 className="h-4 w-4" /></Button>}</div>))}{!isViewMode && <Button type="button" variant="outline" onClick={addDefect}><Plus className="h-4 w-4 mr-2" /> Hata Ekle</Button>}</div>
                    <div className="space-y-4"><h3 className="font-semibold text-lg border-b pb-2">Sertifika ve Ekler</h3>{!isViewMode && <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${isDragActive ? 'border-primary bg-primary/10' : 'border-input hover:border-primary/50'} cursor-pointer`}><input {...getInputProps()} /><p className="text-muted-foreground">Dosyaları buraya sürükleyin veya seçmek için tıklayın.</p></div>}<ul className="space-y-2">{existingAttachments.map(att => <li key={att.id} className="flex items-center justify-between text-sm bg-muted/50 p-2 rounded-md"><a href={supabase.storage.from('incoming_control').getPublicUrl(att.file_path).data.publicUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline"><FileText className="h-4 w-4" /><span>{att.file_name}</span><ExternalLink className="h-3 w-3" /></a>{!isViewMode && <Button type="button" variant="ghost" size="icon" onClick={() => removeExistingAttachment(att.id, att.file_path)}><X className="h-4 w-4 text-destructive" /></Button>}</li>)}{newAttachments.map((file, index) => <li key={index} className="flex items-center justify-between text-sm bg-muted/50 p-2 rounded-md"><span>{file.name}</span>{!isViewMode && <Button type="button" variant="ghost" size="icon" onClick={() => removeNewAttachment(index)}><X className="h-4 w-4" /></Button>}</li>)}</ul></div>
                            </div>
                        </ScrollArea>
                        <DialogFooter className="pt-6 border-t mt-4">
                            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Kapat</Button>
                            {!isViewMode && (
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
                                </Button>
                            )}
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        );
    };

    export default IncomingInspectionFormModal;
