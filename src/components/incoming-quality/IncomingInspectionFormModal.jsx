
import React, { useState, useEffect, useCallback, useMemo } from 'react';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Plus, Trash2, AlertCircle, AlertTriangle, FileText, ExternalLink, HelpCircle, ClipboardCheck } from 'lucide-react';
    import { useDropzone } from 'react-dropzone';
    import { sanitizeFileName } from '@/lib/utils';
import { copyIncomingInspectionFilesToInkr } from '@/lib/incomingInkrAttachmentSync';
    import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
    import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
    import { v4 as uuidv4 } from 'uuid';
    import { format, subMonths, formatDistanceToNow } from 'date-fns';
    import { tr } from 'date-fns/locale';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import RiskyStockAlert from './RiskyStockAlert';

    const INITIAL_FORM_STATE = {
        inspection_date: new Date().toISOString().split('T')[0],
        supplier_id: '',
        delivery_note_number: '',
        part_name: '',
        part_code: '',
        production_batch: '',
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
            const measuredStr = String(value).trim().toUpperCase();

            // Toleranslı satırlarda da OK/RET vb. açık kelimeleri önce yorumla (min/max olsa bile)
            const isExplicitFail = ['RET', 'UYGUNSUZ', 'NOK', 'NG', 'HATALI', 'RED'].some(
                (failText) => measuredStr === failText || measuredStr.startsWith(`${failText} `)
            );
            const isExplicitPass = ['OK', 'UYGUN', 'KABUL', 'PASS', 'GEÇER', 'GECER', 'VAR', 'EVET'].some(
                (okText) => measuredStr === okText || measuredStr.startsWith(`${okText} `)
            );

            if (isExplicitFail) {
                result = false;
            } else if (isExplicitPass) {
                result = true;
            } else if (hasTolerance) {
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
                        placeholder={hasTolerance ? "Değer veya OK/RET" : "OK/NOK/RET"}
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
        const { user } = useAuth();
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
        const [openNCsForBatch, setOpenNCsForBatch] = useState([]);
        const [checkingOpenNCs, setCheckingOpenNCs] = useState(false);

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
                    production_batch: existingInspection.production_batch || '',
                    quantity_received: existingInspection.quantity_received || 0,
                    unit: existingInspection.unit || 'Adet',
                    decision: existingInspection.decision || 'Beklemede',
                    quantity_accepted: existingInspection.quantity_accepted || 0,
                    quantity_conditional: existingInspection.quantity_conditional || 0,
                    quantity_rejected: existingInspection.quantity_rejected || 0,
                    attachments: existingInspection.attachments || [],
                });
                
                // Load measurement results - veritabanı ve kod arasındaki alan adı farklılıklarını düzelt
                if (existingInspection.results && Array.isArray(existingInspection.results)) {
                    // Veritabanı alanlarını kod alanlarına dönüştür:
                    // feature -> characteristic_name (eski kayıtlarda characteristic_name null olabilir)
                    // actual_value -> measured_value (eski kayıtlarda measured_value null olabilir)
                    const normalizedResults = existingInspection.results.map(r => ({
                        ...r,
                        characteristic_name: r.characteristic_name || r.feature || '',
                        measured_value: r.measured_value || r.actual_value || '',
                    }));
                    setResults(normalizedResults);
                    console.log('✅ Ölçüm sonuçları yüklendi:', normalizedResults.length);
                    if (normalizedResults.length > 0) {
                        console.log('📊 İlk sonuç örneği:', {
                            characteristic_name: normalizedResults[0].characteristic_name,
                            measured_value: normalizedResults[0].measured_value,
                            control_plan_item_id: normalizedResults[0].control_plan_item_id,
                        });
                    }
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

                // KRİTİK FIX: Eski ölçümleri iki farklı Map'e koy
                // 1. control_plan_item_id + measurement_number ile (yeni kayıtlar için)
                // 2. nominal + min + max + characteristic_name + measurement_number ile (eski kayıtlar için fallback)
                const oldResultsByPlanItemId = new Map();
                const oldResultsByValues = new Map();
                
                // REVİZYON TARİHİ KONTROLÜ: Kayıt tarihi kontrol planı revize tarihinden önce mi?
                // Eğer öyleyse, sadece mevcut ölçümleri olan karakteristikleri göster
                let isRecordBeforeRevision = false;
                if (isOldRecordSync && controlPlan.revision_date) {
                    const inspectionDate = new Date(existingInspection?.inspection_date || existingInspection?.created_at);
                    const revisionDate = new Date(controlPlan.revision_date);
                    isRecordBeforeRevision = inspectionDate < revisionDate;
                    
                    if (isRecordBeforeRevision) {
                        console.log('📅 KAYIT REVİZYON ÖNCESİ:', {
                            inspection_date: inspectionDate.toISOString(),
                            revision_date: revisionDate.toISOString(),
                            message: 'Sadece mevcut ölçümleri olan karakteristikler gösterilecek'
                        });
                    }
                }
                
                if (isOldRecordSync) {
                    results.forEach(r => {
                        // Yeni kayıtlar için: control_plan_item_id + measurement_number
                        if (r.control_plan_item_id) {
                            const key1 = `${r.control_plan_item_id}_${r.measurement_number}`;
                            oldResultsByPlanItemId.set(key1, r);
                        }
                        
                        // ESKİ KAYITLAR İÇİN FALLBACK: nominal + min + max + characteristic_name + measurement_number
                        // Bu sayede control_plan_item_id olmayan eski kayıtlar da doğru eşleşir
                        const key2 = `${r.nominal_value || ''}_${r.min_value || ''}_${r.max_value || ''}_${r.characteristic_name || ''}_${r.measurement_number}`;
                        oldResultsByValues.set(key2, r);
                    });
                    console.log('🗺️ Eski ölçümler Map\'lere yüklendi:', {
                        byPlanItemId: oldResultsByPlanItemId.size,
                        byValues: oldResultsByValues.size,
                        total: results.length
                    });
                }

                controlPlan.items.forEach((item, index) => {
                    console.log(`🔍 Item ${index + 1}/${controlPlan.items.length} işleniyor:`, {
                        control_plan_item_id: item.id,
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

                    // REVİZYON ÖNCESİ KAYIT KONTROLÜ: Bu karakteristik için ölçüm var mı kontrol et
                    // Eğer kayıt revizyon öncesinden ve bu karakteristik için ölçüm yoksa, atla
                    let hasAnyMeasurement = false;
                    if (isRecordBeforeRevision) {
                        for (let checkI = 1; checkI <= count; checkI++) {
                            const checkKey1 = `${item.id}_${checkI}`;
                            const checkKey2 = `${item.nominal_value || ''}_${item.min_value || ''}_${item.max_value || ''}_${characteristic.label || ''}_${checkI}`;
                            if (oldResultsByPlanItemId.has(checkKey1) || oldResultsByValues.has(checkKey2)) {
                                hasAnyMeasurement = true;
                                break;
                            }
                        }
                        
                        if (!hasAnyMeasurement) {
                            console.log(`   ⏭️ REVİZYON ÖNCESİ: "${characteristic.label}" karakteristiği için ölçüm yok, atlanıyor...`);
                            // Summary'den de çıkar - bu karakteristik gösterilmeyecek
                            summary.pop(); // Son eklenen summary item'ı çıkar
                            return; // Bu karakteristiği atla
                        }
                    }
                    
                    for (let i = 1; i <= count; i++) {
                        // KRİTİK FIX: Önce control_plan_item_id ile eşleştir, bulunamazsa fallback kullan
                        const mapKey1 = `${item.id}_${i}`;
                        let oldResult = isOldRecordSync ? oldResultsByPlanItemId.get(mapKey1) : null;
                        
                        // FALLBACK: control_plan_item_id ile eşleşme bulunamazsa, değerler ile eşleştir
                        if (!oldResult && isOldRecordSync) {
                            const mapKey2 = `${item.nominal_value || ''}_${item.min_value || ''}_${item.max_value || ''}_${characteristic.label || ''}_${i}`;
                            oldResult = oldResultsByValues.get(mapKey2);
                            if (oldResult && i === 1) {
                                console.log(`   🔄 FALLBACK eşleştirme kullanıldı: key=${mapKey2}`);
                            }
                        }
                        
                        if (isOldRecordSync && i === 1) {
                            console.log(`   🔍 Eski ölçüm aranıyor: key=${mapKey1}, bulundu=${!!oldResult}`);
                        }
                        
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
                                control_plan_item_id: item.id,
                                nominal: resultItem.nominal_value,
                                min: resultItem.min_value,
                                max: resultItem.max_value,
                                measured_value: resultItem.measured_value,
                                result: resultItem.result,
                                isOldValue: !!oldResult
                            });
                        }
                        
                        newResults.push(resultItem);
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

        // Aynı part_code ve production_batch için açık DF kontrolü
        useEffect(() => {
            const checkOpenNCsForBatch = async () => {
                // part_code ve supplier_id olmadan kontrol yapamayız
                if (!formData.part_code || !formData.supplier_id) {
                    setOpenNCsForBatch([]);
                    return;
                }

                setCheckingOpenNCs(true);
                try {
                    const params = {
                        p_part_code: formData.part_code,
                        p_production_batch: formData.production_batch || '',
                        p_supplier_id: formData.supplier_id
                    };
                    
                    console.log('Açık DF kontrolü başlatılıyor:', params);
                    
                    // production_batch boş olsa bile kontrol yap (NULL kayıtlar için)
                    const { data, error } = await supabase.rpc('check_open_nc_for_production_batch', params);

                    if (error) {
                        console.error('Açık DF kontrolü hatası:', error);
                        setOpenNCsForBatch([]);
                        return;
                    }

                    console.log('Açık DF kontrolü sonucu:', data);
                    setOpenNCsForBatch(data || []);
                } catch (error) {
                    console.error('Açık DF kontrolü hatası:', error);
                    setOpenNCsForBatch([]);
                } finally {
                    setCheckingOpenNCs(false);
                }
            };

            const timer = setTimeout(() => {
                checkOpenNCsForBatch();
            }, 500);

            return () => clearTimeout(timer);
        }, [formData.part_code, formData.production_batch, formData.supplier_id]);


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
                    characteristic_name: r.characteristic_name,
                    measurement_method: r.measurement_method,
                    measurement_number: r.measurement_number || null,
                    total_measurements: r.total_measurements || null,
                    nominal_value: r.nominal_value,
                    min_value: r.min_value,
                    max_value: r.max_value,
                    actual_value: String(r.measured_value),
                    measured_value: String(r.measured_value),
                    result: r.result,
                    characteristic_type: r.characteristic_type,
                    // KRİTİK: control_plan_item_id kaydet - bu sayede sonraki düzenlemelerde doğru eşleşme yapılır
                    control_plan_item_id: r.control_plan_item_id || null,
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

                    const partCodeForInkr = String(dataToSubmit.part_code || inspectionRecord.part_code || '').trim();
                    if (partCodeForInkr) {
                        const { data: inkrRow, error: inkrLookupError } = await supabase
                            .from('inkr_reports')
                            .select('id')
                            .eq('part_code', partCodeForInkr)
                            .order('created_at', { ascending: false })
                            .limit(1)
                            .maybeSingle();
                        if (!inkrLookupError && inkrRow?.id) {
                            const filesForInkr = newAttachments.map((file, idx) => ({
                                file,
                                file_name: attachmentsToInsert[idx]?.file_name || file.name,
                            }));
                            const { errors: inkrSyncErrors } = await copyIncomingInspectionFilesToInkr(supabase, {
                                inkrReportId: inkrRow.id,
                                files: filesForInkr,
                            });
                            if (inkrSyncErrors.length > 0) {
                                toast({
                                    variant: 'destructive',
                                    title: 'INKR eşlemesi kısmen başarısız',
                                    description: inkrSyncErrors.slice(0, 3).join(' · '),
                                });
                            }
                        }
                    }
                } catch (uploadError) { toast({ variant: 'destructive', title: 'Hata', description: uploadError.message }); setIsSubmitting(false); return; }
            }

            // Otomatik stok risk kontrolü kaydı oluştur
            // Eğer Ret veya Şartlı Kabul ise VE riskli stok varsa otomatik kayıt oluştur
            if (formData.decision === 'Ret' || formData.decision === 'Şartlı Kabul') {
                try {
                    // Daha önce bu kayıt için stok risk kontrolü oluşturulmuş mu kontrol et
                    const { data: existingControls } = await supabase
                        .from('stock_risk_controls')
                        .select('id')
                        .eq('source_inspection_id', inspectionId)
                        .limit(1);

                    // Eğer daha önce oluşturulmamışsa kontrol et ve oluştur
                    if (!existingControls || existingControls.length === 0) {
                        // Riskli stok kontrolü yap - kayıt kaydedilirken riskyStockData state'i güncel olmayabilir
                        const hasRejectedOrConditional = 
                            (formData.quantity_rejected && parseInt(formData.quantity_rejected, 10) > 0) ||
                            (formData.quantity_conditional && parseInt(formData.quantity_conditional, 10) > 0);

                        if (hasRejectedOrConditional && formData.part_code) {
                            // Mevcut kaydın muayene tarihini al
                            const currentInspectionDate = formData.inspection_date 
                                ? format(new Date(formData.inspection_date), 'yyyy-MM-dd')
                                : format(new Date(), 'yyyy-MM-dd');
                            
                            // Riskli stokları kontrol et
                            const { data: riskyStockInspections, error: riskyStockError } = await supabase
                                .from('incoming_inspections')
                                .select('*, supplier:suppliers!left(id, name)')
                                .eq('part_code', formData.part_code)
                                .in('decision', ['Kabul', 'Kabul Edildi'])
                                .gt('quantity_accepted', 0)
                                .lte('inspection_date', currentInspectionDate)
                                .neq('id', inspectionId)
                                .order('inspection_date', { ascending: false })
                                .limit(10);

                            if (!riskyStockError && riskyStockInspections && riskyStockInspections.length > 0) {
                                // Riskli stok bulundu, otomatik kayıt oluştur
                                const recordsToInsert = riskyStockInspections.map(item => ({
                                    source_inspection_id: inspectionId,
                                    controlled_inspection_id: item.id,
                                    part_code: formData.part_code,
                                    part_name: formData.part_name,
                                    supplier_id: item.supplier?.id || item.supplier_id || null,
                                    results: [{
                                        measurement_type: 'Görsel Kontrol',
                                        result: null,
                                        value: '',
                                        notes: ''
                                    }],
                                    decision: 'Beklemede',
                                    controlled_by_id: user?.id || null,
                                    status: 'Beklemede'
                                }));

                                const { error: stockRiskError } = await supabase.from('stock_risk_controls').insert(recordsToInsert);

                                if (stockRiskError) {
                                    console.error('Stok risk kontrolü otomatik oluşturma hatası:', stockRiskError);
                                    toast({
                                        variant: 'default',
                                        title: 'Kayıt Başarılı',
                                        description: `Girdi kontrol kaydı kaydedildi. Stok risk kontrolü otomatik oluşturulamadı: ${stockRiskError.message}`,
                                        duration: 5000
                                    });
                                } else {
                                    toast({
                                        title: 'Başarılı',
                                        description: `Girdi kontrol kaydı kaydedildi. ${recordsToInsert.length} adet stok risk kontrol kaydı otomatik olarak oluşturuldu.`,
                                        duration: 5000
                                    });
                                }
                            } else {
                                // Riskli stok bulunamadı
                                toast({ title: 'Başarılı', description: 'Girdi kontrol kaydı başarıyla kaydedildi.' });
                            }
                        } else {
                            // Ret/Şartlı kabul yok veya parça kodu yok
                            toast({ title: 'Başarılı', description: 'Girdi kontrol kaydı başarıyla kaydedildi.' });
                        }
                    } else {
                        // Zaten oluşturulmuşsa normal mesaj göster
                        toast({ title: 'Başarılı', description: 'Girdi kontrol kaydı başarıyla kaydedildi.' });
                    }
                } catch (error) {
                    console.error('Stok risk kontrolü oluşturma hatası:', error);
                    // Hata olsa bile ana kayıt başarılı olduğu için normal mesaj göster
                    toast({ title: 'Başarılı', description: 'Girdi kontrol kaydı başarıyla kaydedildi.' });
                }
            } else {
                toast({ title: 'Başarılı', description: 'Girdi kontrol kaydı başarıyla kaydedildi.' });
            }

            // Eğer karar "Kabul" ise ve aynı part_code + production_batch için açık DF varsa otomatik kapat
            if (formData.decision === 'Kabul' && openNCsForBatch.length > 0) {
                try {
                    const ncIdsToClose = openNCsForBatch.map(nc => nc.nc_id);
                    const closingNote = formData.production_batch 
                        ? `Aynı üretim partisinden (${formData.production_batch}) gelen ürünler hatasız kabul edildiği için otomatik olarak kapatıldı. Girdi Kontrol Kaydı: ${inspectionRecord.record_no || inspectionId}`
                        : `Aynı parça kodundan gelen ürünler hatasız kabul edildiği için otomatik olarak kapatıldı. Girdi Kontrol Kaydı: ${inspectionRecord.record_no || inspectionId}`;
                    
                    const { error: closeError } = await supabase
                        .from('non_conformities')
                        .update({
                            status: 'Kapatıldı',
                            closed_at: new Date().toISOString(),
                            closing_notes: closingNote
                        })
                        .in('id', ncIdsToClose);

                    if (closeError) {
                        console.error('Uygunsuzluk kapatma hatası:', closeError);
                        toast({
                            variant: 'default',
                            title: 'Kayıt Başarılı',
                            description: `Girdi kontrol kaydı kaydedildi. Ancak uygunsuzluklar kapatılamadı: ${closeError.message}`,
                            duration: 5000
                        });
                    } else {
                        toast({
                            title: 'Başarılı',
                            description: `Girdi kontrol kaydı kaydedildi ve ${openNCsForBatch.length} adet açık uygunsuzluk otomatik olarak kapatıldı.`,
                            duration: 5000
                        });
                    }
                } catch (error) {
                    console.error('Uygunsuzluk kapatma hatası:', error);
                    toast({
                        variant: 'default',
                        title: 'Kayıt Başarılı',
                        description: `Girdi kontrol kaydı kaydedildi. Ancak uygunsuzluklar kapatılamadı: ${error.message}`,
                        duration: 5000
                    });
                }
            }

            refreshData();
            setIsOpen(false);
            setIsSubmitting(false);
        };

        const title = isViewMode ? 'Girdi Kontrol Kaydını Görüntüle' : (existingInspection ? 'Girdi Kontrol Kaydını Düzenle' : 'Yeni Girdi Kontrol Kaydı');
        const badge = isViewMode ? 'Görüntüleme' : (existingInspection ? 'Düzenleme' : 'Yeni');
        const supplierName = (suppliers || []).find(s => s.id === formData.supplier_id)?.name || '-';
        
        return (
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
                    <DialogHeader className="sr-only"><DialogTitle>{title}</DialogTitle></DialogHeader>
                    <header className="bg-gradient-to-r from-primary to-blue-700 px-6 py-5 flex items-center justify-between text-white shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="bg-white/20 p-2.5 rounded-lg"><ClipboardCheck className="h-5 w-5 text-white" /></div>
                            <div>
                                <h1 className="text-lg font-bold tracking-tight">{title}</h1>
                                <p className="text-[11px] text-blue-100 uppercase tracking-[0.15em] font-medium">Girdi Kalite Kontrol</p>
                            </div>
                            <span className="px-3 py-1 bg-white/20 border border-white/30 text-white/90 text-[10px] font-bold rounded-full uppercase tracking-wider">{badge}</span>
                        </div>
                    </header>
                    <div className="flex flex-1 min-h-0 overflow-hidden">
                    <form id="incoming-inspection-form" onSubmit={handleSubmit} className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
                        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-4 border-r border-border">
                            <div className="space-y-6">
                    <div className="space-y-2">
                        {warnings.plan && <Alert variant="warning"><AlertTriangle className="h-4 w-4" /><AlertTitle>Uyarı</AlertTitle><AlertDescription>{warnings.plan}</AlertDescription></Alert>}
                        {warnings.inkr && <Alert variant="warning"><AlertTriangle className="h-4 w-4" /><AlertTitle>Uyarı</AlertTitle><AlertDescription>{warnings.inkr}</AlertDescription></Alert>}
                        {partHistory.length > 0 && <Alert variant="warning"><AlertTriangle className="h-4 w-4" /><AlertTitle>DIKKAT: Bu parça daha önce sorun yaşamıştır!</AlertTitle><AlertDescription><ul className="list-disc pl-5 mt-2 space-y-1">{partHistory.map((item, index) => <li key={index} className="text-xs">{(item.suppliers && item.suppliers.name) || 'Bilinmeyen Tedarikçi'} - İrsaliye: {item.delivery_note_number || '-'} - Tarih: {format(new Date(item.inspection_date), 'dd.MM.yyyy')} ({formatDistanceToNow(new Date(item.inspection_date), { addSuffix: true, locale: tr })}) - Karar: <span className="font-bold">{item.decision}</span> - Etkilenen Miktar: {item.quantity_rejected + item.quantity_conditional}</li>)}</ul></AlertDescription></Alert>}
                        {checkingOpenNCs && formData.part_code && formData.supplier_id && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent" />
                                <span className="text-sm text-blue-700 font-medium">Açık uygunsuzluk kontrolü yapılıyor...</span>
                            </div>
                        )}
                        {openNCsForBatch && openNCsForBatch.length > 0 && (
                            <Alert variant="destructive" className="mt-4">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>
                                    {formData.production_batch 
                                        ? 'UYARI: Bu üretim partisi için açık DF/8D uygunsuzluğu bulunmaktadır!'
                                        : 'UYARI: Bu parça için açık DF/8D uygunsuzluğu bulunmaktadır!'}
                                </AlertTitle>
                                <AlertDescription className="mt-2">
                                    <p className="font-semibold mb-2">Açık Uygunsuzluklar ({openNCsForBatch.length} adet):</p>
                                    <ul className="list-disc pl-5 space-y-1">
                                        {openNCsForBatch.map((nc) => (
                                            <li key={nc.nc_id || nc.id} className="text-sm">
                                                <strong>{nc.nc_number || 'DF/8D'}</strong>: {nc.title || 'Başlıksız'} 
                                                {nc.production_batch && nc.production_batch !== '' && (
                                                    <span className="text-muted-foreground ml-2">
                                                        (Parti: {nc.production_batch})
                                                    </span>
                                                )}
                                                {nc.opening_date && (
                                                    <span className="text-muted-foreground ml-2">
                                                        (Açılış: {format(new Date(nc.opening_date), 'dd.MM.yyyy')})
                                                    </span>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                    <p className="mt-2 text-sm font-medium">
                                        {formData.production_batch 
                                            ? 'Bu üretim partisinden gelen ürünler hatasız kabul edilirse, ilgili uygunsuzluklar otomatik olarak kapatılacaktır.'
                                            : 'Üretim partisi bilgisi girilirse, aynı partiden gelen ürünler hatasız kabul edildiğinde ilgili uygunsuzluklar otomatik kapatılacaktır.'}
                                    </p>
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 items-start">
                        <div><Label>Kontrol Tarihi</Label><Input type="date" name="inspection_date" value={formData.inspection_date} onChange={handleInputChange} required disabled={isViewMode} /></div>
                        <div><Label>Tedarikçi</Label><Select name="supplier_id" value={formData.supplier_id || ''} onValueChange={(v) => handleSelectChange('supplier_id', v)} disabled={isViewMode}><SelectTrigger><SelectValue placeholder="Tedarikçi Seçin" /></SelectTrigger><SelectContent>{(suppliers || []).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
                        <div><Label>İrsaliye No</Label><Input name="delivery_note_number" value={formData.delivery_note_number || ''} onChange={handleInputChange} placeholder="İrsaliye No" disabled={isViewMode} /></div>
                        <div><Label>Parça Kodu</Label><Input name="part_code" value={formData.part_code || ''} onChange={(e) => handlePartCodeChange(e.target.value)} placeholder="Parça Kodu Girin..." required disabled={isViewMode || !!existingInspection} /></div>
                        <div className="md:col-span-2"><Label>Parça Adı</Label><Input name="part_name" value={formData.part_name} onChange={handleInputChange} placeholder="Parça Adı" required disabled={isViewMode || !!controlPlan}/></div>
                        <div><Label>Üretim Partisi/Lot No</Label><Input name="production_batch" value={formData.production_batch || ''} onChange={handleInputChange} placeholder="Üretim partisi/lot numarası" disabled={isViewMode} /></div>
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
                        </div>
                    </form>
                    <aside className="w-[320px] min-w-[280px] shrink-0 min-h-0 overflow-y-auto bg-muted/30 py-4 px-6">
                        <h3 className="text-sm font-semibold text-foreground mb-3">Özet</h3>
                        <div className="space-y-3">
                            <div className="bg-background rounded-xl p-4 shadow-sm border border-border">
                                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-1">Parça</p>
                                <p className="font-bold text-foreground truncate">{formData.part_name || formData.part_code || '-'}</p>
                                {formData.part_code && <p className="text-xs text-muted-foreground mt-0.5">{formData.part_code}</p>}
                            </div>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between"><span className="text-muted-foreground">Tedarikçi:</span><span className="font-semibold text-foreground truncate ml-2">{supplierName}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Tarih:</span><span className="font-semibold text-foreground">{formData.inspection_date ? format(new Date(formData.inspection_date), 'dd.MM.yyyy') : '-'}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Miktar:</span><span className="font-semibold text-foreground">{formData.quantity_received || 0} {formData.unit || 'Adet'}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Karar:</span><span className={`font-bold ${formData.decision === 'Kabul' ? 'text-green-600' : formData.decision === 'Ret' ? 'text-red-600' : formData.decision === 'Şartlı Kabul' ? 'text-amber-600' : 'text-muted-foreground'}`}>{formData.decision}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Ölçüm:</span><span className="font-semibold text-foreground">{results.length} satır</span></div>
                            </div>
                        </div>
                    </aside>
                    </div>
                    <footer className="flex shrink-0 justify-end gap-2 px-6 py-4 border-t border-border bg-muted/20">
                        <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Kapat</Button>
                        {!isViewMode && (
                            <Button form="incoming-inspection-form" type="submit" disabled={isSubmitting}>
                                {isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
                            </Button>
                        )}
                    </footer>
                </DialogContent>
            </Dialog>
        );
    };

    export default IncomingInspectionFormModal;
