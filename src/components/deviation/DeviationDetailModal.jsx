import React, { useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogClose, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { supabase } from '@/lib/customSupabaseClient';
import { Printer, Loader2, Hourglass, CheckCircle, XCircle, FileText, Truck, Download, Eye, Package, AlertTriangle, DollarSign, Link2, Hash, Calendar, Building2, User, Car, Droplets, Fan, MessageSquare, Ruler } from 'lucide-react';
import { openPrintableReport } from '@/lib/reportUtils';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { InfoCard } from '@/components/ui/InfoCard';
import { getSourceTypeLabel } from './sourceRecordUtils';

const DeviationDetailModal = ({ isOpen, setIsOpen, deviation }) => {
    const [isPrinting, setIsPrinting] = useState(false);

    if (!deviation) return null;

    const getStatusVariant = (status) => {
        switch (status) {
            case 'Onaylandı': return 'success';
            case 'Reddedildi': return 'destructive';
            case 'Onay Bekliyor': return 'warning';
            case 'Açık': return 'secondary';
            default: return 'outline';
        }
    };

    const getStatusBadgeVariant = (status) => {
        switch (status) {
            case 'Onaylandı': return 'success';
            case 'Reddedildi': return 'danger';
            case 'Onay Bekliyor': return 'warning';
            case 'Açık': return 'info';
            default: return 'default';
        }
    };

    const getApprovalStatusIcon = (status) => {
        switch (status) {
            case 'Onaylandı': return <CheckCircle className="w-5 h-5 text-green-500" />;
            case 'Reddedildi': return <XCircle className="w-5 h-5 text-red-500" />;
            case 'Beklemede': return <Hourglass className="w-5 h-5 text-yellow-500" />;
            default: return null;
        }
    };

    // Açıklamayı profesyonel formatta göstermek için formatlama fonksiyonu
    const formatDescription = (text) => {
        if (!text) return '-';
        
        // Önce literal \\n karakterlerini gerçek satır sonlarına çevir (veritabanından gelen)
        let processedText = text.replace(/\\n/g, '\n');
        
        // Tüm key isimleri (sıralı - uzundan kısaya, özel karakterler escape'li değil)
        const allKeyNames = [
            'Araç Seri Numarası',
            'Şikayet Açıklaması',
            'Düzeltme Açıklaması',
            'Sorumlu Departman',
            'Şikayet Tarihi',
            'Önem Seviyesi',
            'Hata Kategorisi',
            'Test Başlangıcı',
            'Test Operatörü',
            'Kalite Sınıfı',
            'Çalışma Devri',
            'Test Sonucu',
            'Kaçak Adedi',
            'Testi Yapan',
            'Ürünü Kaynatan',
            'Sızdırmazlık Parçası',
            'Test Süresi',
            'Fan Ağırlığı',
            'Araç Tipi',
            'Test Tarihi',
            'Genel Sonuç',
            'Araç Seri No',
            'Hata Açıklaması',
            'Hata Adedi',
            'Hata Tarihi',
            'Şikayet No',
            'Fikstür No',
            'Ürün/Parça',
            'Ürün Referansı',
            'Etkilenen Miktar',
            'Düzeltme Durumu',
            'Tespit Tarihi',
            'Ar-Ge Onayı',
            'Kaynak Birim',
            'Talep Eden Birim',
            'Talep Eden Kişi',
            'Maliyet Türü',
            'Birim/Tedarikçi',
            'Sol Düzlem Sonucu',
            'Sağ Düzlem Sonucu',
            'Ürün',
            'Müşteri',
            'Başlık',
            'Durum',
            'Departman',
            'Beklenen Değer (nominal)',
            'Şartlı Kabul Miktarı',
            'Gerçek Ölçülen Değer',
            'Toplam Ölçüm Sayısı',
            'Red Edilen Miktar',
            'Uygunsuz Ölçümler',
            'Tolerans Aralığı',
            'Beklenen Değer',
            'Uygun Ölçümler',
            'Teslimat No',
            'Parça Kodu',
            'Parça Adı',
            'Tedarikçi',
            'Ret Oranı',
            'Karar',
            'Sonuç',
        ];
        
        // Atlanacak başlıklar (gereksiz, zaten alt başlıklar var)
        const skipHeadings = [
            'Ölçüm Sonuçlari Ve Tespi̇tler',
            'Ölçüm Sonuçları Ve Tespitler',
            'ÖLÇÜM SONUÇLARI VE TESPİTLER',
        ];
        
        // Bölüm başlıkları (render edilecek)
        const sectionHeadings = [
            'Uygunsuz Bulunan Ölçümler',
            'Ölçüm Özeti̇',
            'Ölçüm Özeti',
            'ÖLÇÜM ÖZETİ',
            'TESPİT EDİLEN HATALAR',
            'Tespit Edilen Hatalar',
            'Hata Detayları',
            'UYGUNSUZLUK DETAYLARI',
            'Uygunsuzluk Detayları',
        ];
        
        // Tüm başlıklar (ayrıştırma için)
        const allHeadings = [...skipHeadings, ...sectionHeadings];
        
        // Bir sonraki key veya bölüm başlığının pozisyonunu bul
        const findNextKeyOrHeadingPosition = (str, startFrom = 0) => {
            let minPos = str.length;
            let foundType = null;
            let foundMatch = null;
            
            // Key:Value pattern'lerini kontrol et
            for (const keyName of allKeyNames) {
                const escapedKey = keyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`(${escapedKey})\\s*:`, 'i');
                const match = str.substring(startFrom).match(regex);
                if (match && match.index + startFrom < minPos) {
                    minPos = match.index + startFrom;
                    foundType = 'key';
                    foundMatch = keyName;
                }
            }
            
            // Tüm başlıkları kontrol et (skip dahil)
            for (const heading of allHeadings) {
                const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`(${escapedHeading})\\s*:?`, 'i');
                const match = str.substring(startFrom).match(regex);
                if (match && match.index + startFrom < minPos) {
                    minPos = match.index + startFrom;
                    foundType = 'heading';
                    foundMatch = heading;
                }
            }
            
            // Numaralı ölçüm (1. Minör Özellik...)
            const measurementRegex = /\d+\.\s+(Minör|Kritik|Majör)\s+Özellik\s*\([^)]+\)/i;
            const measurementMatch = str.substring(startFrom).match(measurementRegex);
            if (measurementMatch && measurementMatch.index + startFrom < minPos) {
                minPos = measurementMatch.index + startFrom;
                foundType = 'measurement';
                foundMatch = measurementMatch[0];
            }
            
            return { position: minPos, type: foundType, match: foundMatch };
        };
        
        // Metni token'lara ayır
        const tokenize = (inputText) => {
            const tokens = [];
            let remaining = inputText.trim();
            
            // Ana başlığı bul
            const mainHeadingMatch = remaining.match(/^(Girdi Kalite Kontrol Kaydı|Karantina Kaydı|(Kalite|Kalitesizlik) Maliyeti Kaydı|Sızdırmazlık Kontrol Kaydı|Dinamik Balans Kaydı|Araç Kalite Hatası|Müşteri Şikayeti|Fikstür Uygunsuzluğu)\s*\([^)]+\)/i);
            if (mainHeadingMatch) {
                tokens.push({ type: 'main-heading', content: mainHeadingMatch[0] });
                remaining = remaining.substring(mainHeadingMatch[0].length).trim();
            }
            
            let safetyCounter = 0;
            while (remaining.length > 0 && safetyCounter < 200) {
                safetyCounter++;
                let matched = false;
                
                // "Bu Parça İçin Sapma" cümlesini kontrol et
                const endMatch = remaining.match(/^(Bu\s+.+?\s+için\s+sapma\s+onayı\s+talep\s+edilmektedir\.?)/i);
                if (endMatch) {
                    tokens.push({ type: 'end-text', content: endMatch[1] });
                    remaining = remaining.substring(endMatch[0].length).trim();
                    continue;
                }
                
                // * ile başlayan maddeyi kontrol et
                const bulletMatch = remaining.match(/^\*\s+([^*]+?)(?=\s*\*\s+|\s*(?:Parça Kodu|Tedarikçi|Karar|Bu Parça|$))/i);
                if (bulletMatch) {
                    tokens.push({ type: 'bullet', content: bulletMatch[1].trim() });
                    remaining = remaining.substring(bulletMatch[0].length).trim();
                    continue;
                }
                
                // Skip başlıklarını kontrol et (atla, render etme)
                for (const heading of skipHeadings) {
                    const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const headingRegex = new RegExp(`^(${escapedHeading}):?\\s*`, 'i');
                    const headingMatch = remaining.match(headingRegex);
                    if (headingMatch) {
                        // Bu başlığı atla, token ekleme
                        remaining = remaining.substring(headingMatch[0].length).trim();
                        matched = true;
                        break;
                    }
                }
                if (matched) continue;
                
                // Bölüm başlığını kontrol et (render et)
                for (const heading of sectionHeadings) {
                    const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const headingRegex = new RegExp(`^(${escapedHeading}):?\\s*`, 'i');
                    const headingMatch = remaining.match(headingRegex);
                    if (headingMatch) {
                        tokens.push({ type: 'section-heading', content: headingMatch[1] });
                        remaining = remaining.substring(headingMatch[0].length).trim();
                        matched = true;
                        break;
                    }
                }
                if (matched) continue;
                
                // Numaralı ölçüm öğesini kontrol et (1. Minör Özellik...)
                const measurementMatch = remaining.match(/^(\d+\.\s+(Minör|Kritik|Majör)\s+Özellik\s*\([^)]+\)):?\s*/i);
                if (measurementMatch) {
                    tokens.push({ type: 'measurement-heading', content: measurementMatch[1] });
                    remaining = remaining.substring(measurementMatch[0].length).trim();
                    continue;
                }
                
                // Key:Value çiftini kontrol et
                for (const keyName of allKeyNames) {
                    const escapedKey = keyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const kvRegex = new RegExp(`^(${escapedKey}):\\s*`, 'i');
                    const kvMatch = remaining.match(kvRegex);
                    if (kvMatch) {
                        // Key bulundu, şimdi value'yu belirle (bir sonraki key/heading'e kadar)
                        const afterKey = remaining.substring(kvMatch[0].length);
                        const nextInfo = findNextKeyOrHeadingPosition(afterKey);
                        
                        // Value değerini al
                        let value;
                        if (nextInfo.position === 0) {
                            // Hemen ardından başka bir key/heading geliyor, value boş
                            value = '';
                        } else {
                            value = afterKey.substring(0, nextInfo.position).trim();
                        }
                        
                        // Value içinde herhangi bir heading varsa (skip dahil) ayır
                        let foundSectionInValue = false;
                        for (const heading of allHeadings) {
                            const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                            const headingInValueRegex = new RegExp(`^(.*?)\\s*(${escapedHeading}):?\\s*(.*)$`, 'i');
                            const headingInValueMatch = value.match(headingInValueRegex);
                            if (headingInValueMatch) {
                                value = headingInValueMatch[1].trim();
                                tokens.push({ type: 'key-value', key: keyName, value: value });
                                // Heading'i remaining'e geri ekle
                                remaining = headingInValueMatch[2] + (headingInValueMatch[3] ? ': ' + headingInValueMatch[3] : '') + ' ' + afterKey.substring(nextInfo.position).trim();
                                remaining = remaining.trim();
                                foundSectionInValue = true;
                                break;
                            }
                        }
                        
                        if (!foundSectionInValue) {
                            // "Bu Parça İçin Sapma" cümlesini value'dan ayır
                            const endSentenceMatch = value.match(/(.*?)\s*(Bu\s+.+?\s+için\s+sapma\s+onayı\s+talep\s+edilmektedir\.?)/i);
                            if (endSentenceMatch) {
                                value = endSentenceMatch[1].trim();
                                tokens.push({ type: 'key-value', key: keyName, value: value });
                                tokens.push({ type: 'end-text', content: endSentenceMatch[2] });
                                remaining = afterKey.substring(afterKey.indexOf(endSentenceMatch[2]) + endSentenceMatch[2].length).trim();
                            } else {
                                tokens.push({ type: 'key-value', key: keyName, value: value });
                                remaining = afterKey.substring(value.length).trim();
                            }
                        }
                        matched = true;
                        break;
                    }
                }
                if (matched) continue;
                
                // Diğer numaralı öğeler (1. Dış Cap...)
                const numberedMatch = remaining.match(/^(\d+\.\s+[^0-9\n][^\n]*?)(?=\s+\d+\.\s+[A-ZÇĞİÖŞÜa-zçğıöşü]|\s+Bu Parça|\s+(?:Parça Kodu|Tedarikçi|Karar):|$)/i);
                if (numberedMatch) {
                    tokens.push({ type: 'numbered-item', content: numberedMatch[1].trim() });
                    remaining = remaining.substring(numberedMatch[0].length).trim();
                    continue;
                }
                
                // Hiçbiri eşleşmediyse, bir sonraki bilinen pattern'e kadar olan kısmı al
                const nextInfo = findNextKeyOrHeadingPosition(remaining, 1);
                if (nextInfo.position > 1 && nextInfo.position < remaining.length) {
                    const textPart = remaining.substring(0, nextInfo.position).trim();
                    if (textPart) {
                        tokens.push({ type: 'text', content: textPart });
                    }
                    remaining = remaining.substring(nextInfo.position).trim();
                } else {
                    // Kalan tüm metni al
                    if (remaining.trim()) {
                        tokens.push({ type: 'text', content: remaining.trim() });
                    }
                    break;
                }
            }
            
            return tokens;
        };
        
        const parsedItems = tokenize(processedText);
        
        return parsedItems.map((item, idx) => {
            switch (item.type) {
                case 'main-heading':
                    return (
                        <div key={idx} className="text-base font-bold text-primary mb-3 pb-2 border-b border-primary/30">
                            {item.content}
                        </div>
                    );
                
                case 'section-heading':
                    return (
                        <div key={idx} className="text-sm font-bold text-foreground mt-4 mb-2 bg-muted/50 px-3 py-2 rounded-md uppercase">
                            {item.content}
                        </div>
                    );
                
                case 'measurement-heading':
                    return (
                        <div key={idx} className="mt-3 mb-1 bg-destructive/5 rounded-lg p-3 border-l-4 border-destructive/50">
                            <div className="text-sm font-semibold text-foreground">
                                {item.content}
                            </div>
                        </div>
                    );
                
                case 'key-value':
                    let value = item.value;
                    // N/A yerine daha anlamlı metin
                    if (value.toLowerCase() === 'n/a' || value.toLowerCase() === 'n/a adet') {
                        value = 'Belirtilmemiş';
                    }
                    
                    // Sonuç için Türkçe isimler ve renk
                    const isSonucKey = item.key.toLowerCase().includes('sonuç');
                    const isFailResult = isSonucKey && value.toLowerCase() === 'false';
                    const isPassResult = isSonucKey && value.toLowerCase() === 'true';
                    
                    // False/True değerlerini Türkçe'ye çevir
                    if (isFailResult) {
                        value = 'Uygunsuz';
                    } else if (isPassResult) {
                        value = 'Uygun';
                    }
                    
                    return (
                        <div key={idx} className="flex flex-wrap gap-2 text-sm py-1 pl-2">
                            <span className="font-medium text-muted-foreground min-w-[180px]">{item.key}:</span>
                            <span className={isFailResult ? 'text-destructive font-semibold' : 'text-foreground'}>
                                {value || '-'}
                            </span>
                        </div>
                    );
                
                case 'bullet':
                    return (
                        <div key={idx} className="text-sm text-foreground pl-4 py-1 flex items-start gap-2">
                            <span className="text-primary">•</span>
                            <span>{item.content}</span>
                        </div>
                    );
                
                case 'numbered-item':
                    return (
                        <div key={idx} className="text-sm text-foreground mt-2 pl-2 border-l-2 border-primary/50 py-1">
                            {item.content}
                        </div>
                    );
                
                case 'end-text':
                    return (
                        <div key={idx} className="text-sm font-medium text-primary mt-4 pt-2 border-t border-border">
                            {item.content}
                        </div>
                    );
                
                default:
                    return item.content ? (
                        <div key={idx} className="text-sm text-foreground py-1">
                            {item.content}
                        </div>
                    ) : null;
            }
        }).filter(Boolean);
    };

    const hasValue = (value) => value !== null && value !== undefined && value !== '';

    const getSourceTypeIcon = (sourceType) => {
        switch (sourceType) {
            case 'incoming_inspection':
                return Package;
            case 'quarantine':
                return AlertTriangle;
            case 'quality_cost':
                return DollarSign;
            case 'leak_test':
                return Droplets;
            case 'dynamic_balance':
                return Fan;
            case 'produced_vehicle_fault':
                return Car;
            case 'customer_complaint':
                return MessageSquare;
            case 'fixture_nonconformity':
                return Ruler;
            default:
                return Package;
        }
    };

    const getSourceInfoCards = (sourceType, details = {}) => {
        switch (sourceType) {
            case 'incoming_inspection':
                return [
                    { icon: Package, label: 'Parça Kodu', value: details.part_code },
                    { icon: Package, label: 'Miktar', value: details.quantity },
                    { icon: Building2, label: 'Tedarikçi', value: details.supplier, variant: 'warning' },
                    { icon: Hash, label: 'Kayıt No', value: details.record_no || details.inspection_number },
                ];
            case 'quarantine':
                return [
                    { icon: Hash, label: 'Lot No', value: details.lot_no || details.quarantine_number },
                    { icon: Package, label: 'Parça Kodu', value: details.part_code },
                    { icon: Package, label: 'Miktar', value: details.quantity },
                    { icon: Building2, label: 'Kaynak Birim', value: details.source_department },
                    { icon: Building2, label: 'Talep Eden Birim', value: details.requesting_department },
                ];
            case 'quality_cost':
                return [
                    { icon: Package, label: 'Parça Kodu', value: details.part_code },
                    { icon: DollarSign, label: 'Maliyet Türü', value: details.cost_type },
                    { icon: DollarSign, label: 'Tutar', value: hasValue(details.amount) ? `₺${details.amount}` : null, variant: 'warning' },
                    { icon: Building2, label: 'Birim/Tedarikçi', value: details.unit || details.supplier },
                ];
            case 'leak_test':
                return [
                    { icon: Hash, label: 'Kayıt No', value: details.record_number },
                    { icon: Car, label: 'Araç Tipi', value: details.vehicle_type_label },
                    { icon: Hash, label: 'Seri No', value: details.vehicle_serial_number },
                    { icon: Droplets, label: 'Sızdırmazlık Parçası', value: details.tank_type },
                    { icon: AlertTriangle, label: 'Test Sonucu', value: details.test_result === 'Kaçak Var' ? `${details.test_result} (${details.leak_count || 0})` : details.test_result },
                    { icon: User, label: 'Testi Yapan', value: details.tester_name },
                    { icon: User, label: 'Ürünü Kaynatan', value: details.welder_name },
                ];
            case 'dynamic_balance':
                return [
                    { icon: Hash, label: 'Seri No', value: details.serial_number },
                    { icon: Package, label: 'Ürün', value: details.product_name || details.product_code },
                    { icon: AlertTriangle, label: 'Genel Sonuç', value: details.overall_result },
                    { icon: Building2, label: 'Tedarikçi', value: details.supplier_name },
                    { icon: User, label: 'Operatör', value: details.test_operator },
                    { icon: Calendar, label: 'Test Tarihi', value: details.test_date ? format(new Date(details.test_date), 'dd.MM.yyyy', { locale: tr }) : null },
                ];
            case 'produced_vehicle_fault':
                return [
                    { icon: Car, label: 'Araç Tipi', value: details.vehicle_type },
                    { icon: Hash, label: 'Araç Seri No', value: details.vehicle_serial_number },
                    { icon: Hash, label: 'Şasi No', value: details.chassis_no },
                    { icon: Building2, label: 'Departman', value: details.department_name },
                    { icon: AlertTriangle, label: 'Kategori', value: details.category_name },
                    { icon: Package, label: 'Hata Adedi', value: details.fault_quantity },
                ];
            case 'customer_complaint':
                return [
                    { icon: Hash, label: 'Şikayet No', value: details.complaint_number },
                    { icon: Building2, label: 'Müşteri', value: details.customer_name },
                    { icon: FileText, label: 'Başlık', value: details.title },
                    { icon: Package, label: 'Ürün', value: details.product_name },
                    { icon: AlertTriangle, label: 'Önem', value: details.severity },
                    { icon: MessageSquare, label: 'Durum', value: details.status },
                ];
            case 'fixture_nonconformity':
                return [
                    { icon: Hash, label: 'Fikstür No', value: details.fixture_no },
                    { icon: Package, label: 'Parça Kodu', value: details.part_code },
                    { icon: Package, label: 'Parça Adı', value: details.part_name },
                    { icon: Building2, label: 'Sorumlu Departman', value: details.responsible_department },
                    { icon: AlertTriangle, label: 'Durum', value: details.correction_status },
                    { icon: Calendar, label: 'Tespit Tarihi', value: details.detection_date ? format(new Date(details.detection_date), 'dd.MM.yyyy', { locale: tr }) : null },
                ];
            default:
                return [];
        }
    };

    const handlePrint = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsPrinting(true);
        try {
            await openPrintableReport(deviation, 'deviation', true);
        } catch (error) {
            console.error("PDF generation failed:", error);
        } finally {
            setIsPrinting(false);
        }
    };

    // Dosya uzantısından MIME type belirle
    const getMimeTypeFromFileName = (fileName) => {
        const ext = fileName?.split('.').pop()?.toLowerCase();
        const mimeTypes = {
            'pdf': 'application/pdf',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xls': 'application/vnd.ms-excel',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'txt': 'text/plain'
        };
        return mimeTypes[ext] || 'application/octet-stream';
    };

    // Dosyayı tarayıcıda görüntüle (yeni sekmede aç)
    const handleViewAttachment = async (filePath, fileName) => {
        try {
            // Önce signed URL al
            const { data: urlData, error: urlError } = await supabase.storage
                .from('deviation_attachments')
                .createSignedUrl(filePath, 300);
            
            if (urlError) {
                console.error('Error getting signed URL:', urlError);
                return;
            }
            
            // Dosyayı fetch et
            const response = await fetch(urlData.signedUrl);
            const blob = await response.blob();
            
            // Doğru MIME type ile yeni Blob oluştur
            const correctMimeType = getMimeTypeFromFileName(fileName);
            const correctedBlob = new Blob([blob], { type: correctMimeType });
            
            // Blob URL oluştur ve aç
            const blobUrl = URL.createObjectURL(correctedBlob);
            window.open(blobUrl, '_blank');
            
            // Bellek temizliği için 1 dakika sonra URL'yi iptal et
            setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
        } catch (err) {
            console.error('Error viewing attachment:', err);
        }
    };

    // Dosyayı indir
    const handleDownloadAttachment = async (filePath, fileName) => {
        const { data, error } = await supabase.storage
            .from('deviation_attachments')
            .createSignedUrl(filePath, 300, {
                download: fileName || true // Dosya adını belirterek indirmeyi zorla
            });
        
        if (error) {
            console.error('Error getting signed URL:', error);
            return;
        }
        
        // İndirme başlat
        window.open(data.signedUrl, '_blank');
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-7xl w-[98vw] sm:w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
                <DialogHeader className="sr-only">
                    <DialogTitle>Sapma Detayı</DialogTitle>
                </DialogHeader>
                <header className="bg-gradient-to-r from-primary to-blue-700 px-6 py-5 flex items-center justify-between text-white shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/20 p-2.5 rounded-lg"><AlertTriangle className="h-5 w-5 text-white" /></div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight">Sapma Detayı</h1>
                            <p className="text-[11px] text-blue-100 uppercase tracking-[0.15em] font-medium">Sapma kaydına ait tüm bilgiler</p>
                        </div>
                        {deviation.status && (
                            <span className="px-3 py-1 bg-white/20 border border-white/30 text-white/90 text-[10px] font-bold rounded-full uppercase tracking-wider">{deviation.status}</span>
                        )}
                    </div>
                </header>
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-4 pb-6">
                    <div className="space-y-6">
                        {/* Önemli Bilgiler */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <InfoCard 
                                icon={Hash} 
                                label="Talep No" 
                                value={deviation.request_no} 
                                variant="primary"
                            />
                            <InfoCard 
                                icon={Calendar} 
                                label="Oluşturma Tarihi" 
                                value={deviation.created_at ? format(new Date(deviation.created_at), 'dd MMMM yyyy HH:mm', { locale: tr }) : '-'} 
                            />
                            <InfoCard 
                                icon={Car} 
                                label="Araç Tipi" 
                                value={deviation.vehicle_type || '-'} 
                                variant="warning"
                            />
                        </div>

                        {/* Kaynak Kayıt Bilgisi */}
                        {deviation.source_type && deviation.source_type !== 'manual' && (
                            <>
                                <Separator />
                                <div>
                                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                        <Link2 className="h-5 w-5 text-primary" />
                                        Kaynak Kayıt Bilgisi
                                    </h3>
                                    <Card className="border-2 border-primary">
                                        <CardContent className="p-4">
                                            <div className="flex items-start gap-3">
                                                {React.createElement(getSourceTypeIcon(deviation.source_type), {
                                                    className: 'h-5 w-5 text-primary mt-1'
                                                })}
                                                <div className="flex-1">
                                                    <Badge variant="outline" className="mb-3">
                                                        {getSourceTypeLabel(deviation.source_type)}
                                                    </Badge>
                                                    {deviation.source_record_details && (
                                                        <>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                                                                {getSourceInfoCards(deviation.source_type, deviation.source_record_details)
                                                                    .filter((item) => hasValue(item.value))
                                                                    .map((item) => (
                                                                        <InfoCard
                                                                            key={`${item.label}-${item.value}`}
                                                                            icon={item.icon}
                                                                            label={item.label}
                                                                            value={item.value}
                                                                            variant={item.variant}
                                                                        />
                                                                    ))}
                                                            </div>
                                                            {deviation.source_type === 'fixture_nonconformity' &&
                                                                Array.isArray(deviation.source_record_details.deviation_details) &&
                                                                deviation.source_record_details.deviation_details.length > 0 && (
                                                                <div className="mt-4 rounded-lg border bg-muted/30 p-3">
                                                                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                                                                        Uygunsuzluk Detayları
                                                                    </p>
                                                                    <div className="space-y-1 text-sm">
                                                                        {deviation.source_record_details.deviation_details.slice(0, 4).map((detail, index) => (
                                                                            <div key={`${detail.characteristic}-${index}`}>
                                                                                <strong>{detail.characteristic}:</strong> {detail.deviation}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            </>
                        )}

                        <Separator />

                        {/* Genel Bilgiler */}
                        <div>
                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <FileText className="h-5 w-5 text-primary" />
                                Genel Bilgiler
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {deviation.part_code && (
                                    <InfoCard icon={Package} label="Parça Kodu" value={deviation.part_code} />
                                )}
                                {deviation.source && (
                                    <InfoCard icon={AlertTriangle} label="Kaynak" value={deviation.source} variant="warning" />
                                )}
                                {deviation.requesting_unit && (
                                    <InfoCard icon={Building2} label="Talep Eden Birim" value={deviation.requesting_unit} />
                                )}
                                {deviation.requesting_person && (
                                    <InfoCard icon={User} label="Talep Eden Kişi" value={deviation.requesting_person} />
                                )}
                            </div>
                        </div>

                        <Separator />

                        {/* Açıklama */}
                        <div>
                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <FileText className="h-5 w-5 text-primary" />
                                Sapma Detayları
                            </h3>
                            <Card className="bg-muted/30">
                                <CardContent className="p-6">
                                    <div className="space-y-1">
                                        {formatDescription(deviation.description)}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <Separator />

                        {/* Detaylı Bilgiler */}
                        <Tabs defaultValue="approvals" className="w-full">
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="approvals">Onay Süreci</TabsTrigger>
                                <TabsTrigger value="vehicles">İlgili Araçlar</TabsTrigger>
                                <TabsTrigger value="attachments">Ekler</TabsTrigger>
                            </TabsList>
                            <TabsContent value="approvals" className="p-4">
                                <div className="space-y-4">
                                    {deviation.deviation_approvals && deviation.deviation_approvals.length > 0 ? (
                                        deviation.deviation_approvals.map(approval => (
                                            <Card key={approval.id} className="border-l-4 border-l-primary">
                                                <CardContent className="p-4">
                                                    <div className="flex items-start gap-4">
                                                        <div className="flex-shrink-0">{getApprovalStatusIcon(approval.status)}</div>
                                                        <div className="flex-grow">
                                                            <p className="font-semibold text-lg">{approval.approval_stage}</p>
                                                            <p className="text-sm text-muted-foreground mt-1">
                                                                <User className="w-4 h-4 inline mr-1" />
                                                                Onaylayan: {approval.approver_name || 'Bekleniyor'}
                                                            </p>
                                                            {approval.notes && (
                                                                <div className="mt-2 p-3 bg-muted/50 rounded-lg">
                                                                    <p className="text-sm italic">"{approval.notes}"</p>
                                                                </div>
                                                            )}
                                                            <p className="text-xs text-muted-foreground mt-2">
                                                                <Calendar className="w-3 h-3 inline mr-1" />
                                                                {format(new Date(approval.created_at), 'dd.MM.yyyy HH:mm', { locale: tr })}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))
                                    ) : (
                                        <Card>
                                            <CardContent className="p-6">
                                                <p className="text-center text-muted-foreground">Onay kaydı bulunamadı.</p>
                                            </CardContent>
                                        </Card>
                                    )}
                                </div>
                            </TabsContent>
                            <TabsContent value="vehicles" className="p-4">
                                <div className="space-y-3">
                                    {deviation.deviation_vehicles && deviation.deviation_vehicles.length > 0 ? (
                                        deviation.deviation_vehicles.map(vehicle => (
                                            <Card key={vehicle.id}>
                                                <CardContent className="p-4">
                                                    <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-3">
                                                        <div className="flex items-center gap-2">
                                                            <Truck className="w-5 h-5 text-primary" />
                                                            <span className="font-semibold">{deviation.vehicle_type || 'Bilinmiyor'}</span>
                                                        </div>
                                                        <p className="font-mono text-sm">{vehicle.chassis_no || vehicle.vehicle_serial_no}</p>
                                                        <p className="text-sm text-muted-foreground">{vehicle.customer_name}</p>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))
                                    ) : (
                                        <Card>
                                            <CardContent className="p-6">
                                                <p className="text-center text-muted-foreground">İlgili araç kaydı bulunamadı.</p>
                                            </CardContent>
                                        </Card>
                                    )}
                                </div>
                            </TabsContent>
                            <TabsContent value="attachments" className="p-4">
                                <div className="space-y-2">
                                    {deviation.deviation_attachments && deviation.deviation_attachments.length > 0 ? (
                                        deviation.deviation_attachments.map(att => (
                                            <Card key={att.id}>
                                                <CardContent className="p-4">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <FileText className="w-5 h-5 text-muted-foreground" />
                                                            <span className="text-sm font-medium">{att.file_name}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                title="Görüntüle"
                                                                onClick={() => handleViewAttachment(att.file_path, att.file_name)}
                                                            >
                                                                <Eye className="w-5 h-5" />
                                                            </Button>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                title="İndir"
                                                                onClick={() => handleDownloadAttachment(att.file_path, att.file_name)}
                                                            >
                                                                <Download className="w-5 h-5" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))
                                    ) : (
                                        <Card>
                                            <CardContent className="p-6">
                                                <p className="text-center text-muted-foreground">Ekli dosya bulunmuyor.</p>
                                            </CardContent>
                                        </Card>
                                    )}
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>

                <DialogFooter className="mt-6 shrink-0">
                    <Button type="button" variant="outline" onClick={handlePrint} disabled={isPrinting}>
                        {isPrinting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                        Yazdır / PDF
                    </Button>
                    <DialogClose asChild>
                        <Button type="button" variant="secondary" size="lg">Kapat</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default DeviationDetailModal;
