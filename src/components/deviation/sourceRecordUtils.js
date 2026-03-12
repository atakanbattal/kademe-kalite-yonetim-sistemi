const SOURCE_TYPE_META = {
    incoming_inspection: {
        label: 'Girdi Kalite Kontrol',
        deviationType: 'Girdi Kontrolü',
    },
    quarantine: {
        label: 'Karantina',
        deviationType: 'Girdi Kontrolü',
    },
    quality_cost: {
        label: 'Kalite Maliyeti',
        deviationType: 'Girdi Kontrolü',
    },
    leak_test: {
        label: 'Sızdırmazlık Kontrol',
        deviationType: 'Üretim',
    },
    dynamic_balance: {
        label: 'Dinamik Balans',
        deviationType: 'Üretim',
    },
    produced_vehicle_fault: {
        label: 'Araç Kalite Hatası',
        deviationType: 'Üretim',
    },
    customer_complaint: {
        label: 'Müşteri Şikayeti',
        deviationType: 'Üretim',
    },
    fixture_nonconformity: {
        label: 'Fikstür Uygunsuzluğu',
        deviationType: 'Üretim',
    },
    manual: {
        label: 'Manuel',
        deviationType: null,
    },
};

const formatCurrencyValue = (value) =>
    new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Number(value) || 0);

const formatDateValue = (value, options = {}) => {
    if (!value) return '-';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleDateString('tr-TR', options);
};

const formatDateTimeValue = (dateValue, timeValue) => {
    if (!dateValue && !timeValue) return '-';

    if (dateValue && timeValue) {
        const fullDate = new Date(`${dateValue}T${timeValue}`);
        if (!Number.isNaN(fullDate.getTime())) {
            return fullDate.toLocaleString('tr-TR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        }
    }

    const datePart = dateValue ? formatDateValue(dateValue) : '';
    return [datePart, timeValue].filter(Boolean).join(' ');
};

export const DEVIATION_SOURCE_MODULE_OPTIONS = Object.values(SOURCE_TYPE_META)
    .filter((meta) => meta.label !== 'Manuel')
    .map((meta) => meta.label);

export const getSourceTypeMeta = (sourceType) =>
    SOURCE_TYPE_META[sourceType] || {
        label: sourceType || 'Kaynak Kayıt',
        deviationType: null,
    };

export const getSourceTypeLabel = (sourceType) => getSourceTypeMeta(sourceType).label;

export const getSourceTypeDefaultDeviationType = (sourceType) =>
    getSourceTypeMeta(sourceType).deviationType;

export const buildSourceRecordDescription = (record, sourceDetails = {}) => {
    const details = sourceDetails || {};
    const sourceType = record?._source_type || details.source_type;

    if (!sourceType) return '';

    let detailedDescription = '';

    let defectsToUse = details.defects || [];
    if ((!defectsToUse || defectsToUse.length === 0) && record?.defects?.length > 0) {
        defectsToUse = record.defects;
    }

    let resultsToUse = details.results || [];
    if ((!resultsToUse || resultsToUse.length === 0) && record?.results?.length > 0) {
        resultsToUse = record.results;
    }

    if (sourceType === 'incoming_inspection') {
        detailedDescription = `Girdi Kalite Kontrol Kaydı (${details.record_no || details.inspection_number || '-'})\n\n`;
        detailedDescription += `Parça Kodu: ${details.part_code || 'Belirtilmemiş'}\n`;
        if (details.part_name) {
            detailedDescription += `Parça Adı: ${details.part_name}\n`;
        }

        const rejectedQty = details.quantity_rejected || details.quantity;
        if (rejectedQty && rejectedQty !== 0 && String(rejectedQty).toLowerCase() !== 'n/a') {
            detailedDescription += `Red Edilen Miktar: ${rejectedQty} adet\n`;
        }
        if (details.quantity_conditional && details.quantity_conditional !== 0) {
            detailedDescription += `Şartlı Kabul Miktarı: ${details.quantity_conditional} adet\n`;
        }

        detailedDescription += `Tedarikçi: ${details.supplier || 'Belirtilmemiş'}\n`;
        detailedDescription += `Karar: ${details.decision || '-'}\n`;
        if (details.delivery_note_number) {
            detailedDescription += `Teslimat No: ${details.delivery_note_number}\n`;
        }

        if (resultsToUse.length > 0) {
            detailedDescription += `\n`;

            const failedResults = resultsToUse.filter((result) => {
                if (typeof result.result === 'boolean') {
                    return !result.result;
                }
                const resultStr = (result.result || '').toString().trim().toUpperCase();
                return resultStr !== 'OK' && resultStr !== '';
            });

            if (failedResults.length > 0) {
                detailedDescription += `UYGUNSUZ BULUNAN ÖLÇÜMLER:\n`;
                failedResults.forEach((result, idx) => {
                    const nominal = result.nominal_value ?? null;
                    const min = result.min_value ?? null;
                    const max = result.max_value ?? null;

                    let measuredValue = null;
                    if (result.actual_value !== null && result.actual_value !== undefined) {
                        const actualValueStr = String(result.actual_value).trim();
                        if (actualValueStr && actualValueStr !== 'null' && actualValueStr !== 'undefined') {
                            measuredValue = result.actual_value;
                        }
                    }
                    if (measuredValue === null && result.measured_value !== null && result.measured_value !== undefined) {
                        const measuredValueStr = String(result.measured_value).trim();
                        if (measuredValueStr && measuredValueStr !== 'null' && measuredValueStr !== 'undefined') {
                            measuredValue = result.measured_value;
                        }
                    }

                    detailedDescription += `\n${idx + 1}. ${result.characteristic_name || result.feature || 'Özellik'}`;
                    if (result.measurement_number && result.total_measurements) {
                        detailedDescription += ` (Ölçüm ${result.measurement_number}/${result.total_measurements})`;
                    }
                    detailedDescription += `:\n`;

                    if (nominal !== null || min !== null || max !== null) {
                        detailedDescription += `   Beklenen Değer (Nominal): ${nominal !== null ? `${nominal} mm` : '-'}\n`;
                        detailedDescription += `   Tolerans Aralığı: ${min !== null ? min : '-'} mm ~ ${max !== null ? max : '-'} mm\n`;
                    }

                    if (measuredValue !== null && measuredValue !== '') {
                        detailedDescription += `   Gerçek Ölçülen Değer: ${measuredValue} mm\n`;

                        const measuredNum = parseFloat(String(measuredValue).replace(',', '.'));
                        const isOutOfTolerance =
                            (min !== null && measuredNum < parseFloat(min)) ||
                            (max !== null && measuredNum > parseFloat(max));

                        if (isOutOfTolerance) {
                            detailedDescription += `   HATALI DEĞER: Tolerans dışında\n`;

                            if (nominal !== null && !Number.isNaN(measuredNum) && !Number.isNaN(parseFloat(nominal))) {
                                const nominalNum = parseFloat(nominal);
                                const deviation = measuredNum - nominalNum;
                                detailedDescription += `   Nominal Değerden Sapma: ${deviation > 0 ? '+' : ''}${deviation.toFixed(3)} mm\n`;
                            }

                            if (min !== null && measuredNum < parseFloat(min)) {
                                const underTolerance = parseFloat(min) - measuredNum;
                                detailedDescription += `   Alt Tolerans Aşımı: ${min} mm'den ${underTolerance.toFixed(3)} mm küçük\n`;
                            }
                            if (max !== null && measuredNum > parseFloat(max)) {
                                const overTolerance = measuredNum - parseFloat(max);
                                detailedDescription += `   Üst Tolerans Aşımı: ${max} mm'den ${overTolerance.toFixed(3)} mm büyük\n`;
                            }
                        } else if (nominal !== null && !Number.isNaN(measuredNum) && !Number.isNaN(parseFloat(nominal))) {
                            const nominalNum = parseFloat(nominal);
                            const deviation = measuredNum - nominalNum;
                            if (Math.abs(deviation) > 0.001) {
                                detailedDescription += `   Nominal Değerden Sapma: ${deviation > 0 ? '+' : ''}${deviation.toFixed(3)} mm (Tolerans içinde)\n`;
                            }
                        }
                    } else {
                        detailedDescription += `   Gerçek Ölçülen Değer: Ölçülmemiş\n`;
                    }

                    const resultDisplay =
                        typeof result.result === 'boolean'
                            ? (result.result ? 'OK' : 'NOK')
                            : result.result;
                    detailedDescription += `   Sonuç: ${resultDisplay}\n`;
                });
            }

            const totalResults = resultsToUse.length;
            const okCount = resultsToUse.filter((result) => result.result === 'OK' || result.result === 'Kabul').length;
            const nokCount = totalResults - okCount;

            detailedDescription += `\n\nÖLÇÜM ÖZETİ:\n`;
            detailedDescription += `Toplam Ölçüm Sayısı: ${totalResults}\n`;
            detailedDescription += `Uygun Ölçümler: ${okCount}\n`;
            detailedDescription += `Uygunsuz Ölçümler: ${nokCount}\n`;
            if (totalResults > 0) {
                detailedDescription += `Ret Oranı: ${((nokCount / totalResults) * 100).toFixed(1)}%\n`;
            }
        }

        if (defectsToUse.length > 0) {
            detailedDescription += `\n\nTESPİT EDİLEN HATALAR:\n`;
            defectsToUse.forEach((defect, idx) => {
                const defectDesc = defect.defect_description || defect.description || 'Belirtilmemiş';
                const defectQty = defect.quantity || defect.qty || '-';
                detailedDescription += `${idx + 1}. ${defectDesc} (Miktar: ${defectQty} adet)\n`;
            });
        }

        if (details.description) {
            detailedDescription += `\n\nAçıklama: ${details.description}\n`;
        }
        if (details.notes) {
            detailedDescription += `Notlar: ${details.notes}\n`;
        }
        detailedDescription += `\n\nBu parça için sapma onayı talep edilmektedir.`;
        return detailedDescription;
    }

    if (sourceType === 'quarantine') {
        detailedDescription = `Karantina Kaydı (${details.lot_no || details.quarantine_number || 'N/A'})\n\n`;
        detailedDescription += `Parça Kodu: ${details.part_code || 'Belirtilmemiş'}\n`;
        if (details.part_name) {
            detailedDescription += `Parça Adı: ${details.part_name}\n`;
        }
        detailedDescription += `Miktar: ${details.quantity || 'N/A'} adet\n`;
        if (details.source_department) {
            detailedDescription += `Kaynak Birim: ${details.source_department}\n`;
        }
        if (details.requesting_department) {
            detailedDescription += `Talep Eden Birim: ${details.requesting_department}\n`;
        }
        if (details.requesting_person_name) {
            detailedDescription += `Talep Eden Kişi: ${details.requesting_person_name}\n`;
        }
        if (details.description) {
            detailedDescription += `\nSebep/Açıklama: ${details.description}\n`;
        }
        if (details.decision) {
            detailedDescription += `Karar: ${details.decision}\n`;
        }
        detailedDescription += `\nKarantinadaki bu parça için sapma onayı talep edilmektedir.`;
        return detailedDescription;
    }

    if (sourceType === 'quality_cost') {
        detailedDescription = `Kalite Maliyeti Kaydı\n\n`;
        detailedDescription += `Parça Kodu: ${details.part_code || 'Belirtilmemiş'}\n`;
        detailedDescription += `Maliyet Türü: ${details.cost_type || 'N/A'}\n`;
        detailedDescription += `Tutar: ${formatCurrencyValue(details.amount)}\n`;
        detailedDescription += `Birim/Tedarikçi: ${details.unit || details.supplier || 'Belirtilmemiş'}\n`;
        detailedDescription += `\nBu maliyet kaydı için sapma onayı talep edilmektedir.`;
        return detailedDescription;
    }

    if (sourceType === 'leak_test') {
        detailedDescription = `Sızdırmazlık Kontrol Kaydı (${details.record_number || '-'})\n\n`;
        detailedDescription += `Araç Tipi: ${details.vehicle_type_label || 'Belirtilmemiş'}\n`;
        if (details.vehicle_serial_number) {
            detailedDescription += `Araç Seri Numarası: ${details.vehicle_serial_number}\n`;
        }
        detailedDescription += `Tank Tipi: ${details.tank_type || '-'}\n`;
        detailedDescription += `Test Başlangıcı: ${formatDateTimeValue(details.test_date, details.test_start_time)}\n`;
        detailedDescription += `Test Süresi: ${details.test_duration_minutes || 0} dk\n`;
        detailedDescription += `Test Sonucu: ${details.test_result || '-'}\n`;
        if (details.test_result === 'Kaçak Var' || Number(details.leak_count) > 0) {
            detailedDescription += `Kaçak Adedi: ${details.leak_count || 0}\n`;
        }
        if (details.tester_name) {
            detailedDescription += `Testi Yapan: ${details.tester_name}\n`;
        }
        if (details.welder_name) {
            detailedDescription += `Ürünü Kaynatan: ${details.welder_name}\n`;
        }
        if (details.notes) {
            detailedDescription += `\nNotlar: ${details.notes}\n`;
        }
        detailedDescription += `\nBu sızdırmazlık kaydı için sapma onayı talep edilmektedir.`;
        return detailedDescription;
    }

    if (sourceType === 'dynamic_balance') {
        detailedDescription = `Dinamik Balans Kaydı (${details.serial_number || '-'})\n\n`;
        detailedDescription += `Ürün: ${details.product_name || details.product_code || 'Belirtilmemiş'}\n`;
        if (details.product_code) {
            detailedDescription += `Ürün Referansı: ${details.product_code}\n`;
        }
        if (details.supplier_name) {
            detailedDescription += `Tedarikçi: ${details.supplier_name}\n`;
        }
        if (details.test_operator) {
            detailedDescription += `Test Operatörü: ${details.test_operator}\n`;
        }
        detailedDescription += `Test Tarihi: ${formatDateValue(details.test_date)}\n`;
        if (details.fan_weight_kg) {
            detailedDescription += `Fan Ağırlığı: ${details.fan_weight_kg} kg\n`;
        }
        if (details.operating_rpm) {
            detailedDescription += `Çalışma Devri: ${details.operating_rpm} RPM\n`;
        }
        if (details.balancing_grade) {
            detailedDescription += `Kalite Sınıfı: ${details.balancing_grade}\n`;
        }
        detailedDescription += `Sol Düzlem Sonucu: ${details.left_plane_result || '-'}\n`;
        detailedDescription += `Sağ Düzlem Sonucu: ${details.right_plane_result || '-'}\n`;
        detailedDescription += `Genel Sonuç: ${details.overall_result || '-'}\n`;
        if (details.notes) {
            detailedDescription += `\nNotlar: ${details.notes}\n`;
        }
        detailedDescription += `\nBu dinamik balans kaydı için sapma onayı talep edilmektedir.`;
        return detailedDescription;
    }

    if (sourceType === 'produced_vehicle_fault') {
        detailedDescription = `Araç Kalite Hatası (${details.vehicle_serial_number || details.chassis_no || '-'})\n\n`;
        detailedDescription += `Araç Tipi: ${details.vehicle_type || 'Belirtilmemiş'}\n`;
        if (details.vehicle_serial_number) {
            detailedDescription += `Araç Seri Numarası: ${details.vehicle_serial_number}\n`;
        }
        if (details.chassis_no) {
            detailedDescription += `Şasi Numarası: ${details.chassis_no}\n`;
        }
        if (details.customer_name) {
            detailedDescription += `Müşteri: ${details.customer_name}\n`;
        }
        if (details.department_name) {
            detailedDescription += `Departman: ${details.department_name}\n`;
        }
        if (details.category_name) {
            detailedDescription += `Hata Kategorisi: ${details.category_name}\n`;
        }
        detailedDescription += `Hata Açıklaması: ${details.fault_description || 'Belirtilmemiş'}\n`;
        detailedDescription += `Hata Adedi: ${details.fault_quantity || 1}\n`;
        detailedDescription += `Hata Tarihi: ${formatDateValue(details.fault_date || details.created_at)}\n`;
        detailedDescription += `Ar-Ge Onayı: ${details.arge_approved ? 'Var' : 'Yok'}\n`;
        detailedDescription += `\nBu araç kalite hatası için sapma onayı talep edilmektedir.`;
        return detailedDescription;
    }

    if (sourceType === 'customer_complaint') {
        detailedDescription = `Müşteri Şikayeti (${details.complaint_number || '-'})\n\n`;
        detailedDescription += `Müşteri: ${details.customer_name || 'Belirtilmemiş'}\n`;
        detailedDescription += `Başlık: ${details.title || 'Belirtilmemiş'}\n`;
        if (details.product_name) {
            detailedDescription += `Ürün/Parça: ${details.product_name}\n`;
        }
        if (details.quantity_affected) {
            detailedDescription += `Etkilenen Miktar: ${details.quantity_affected}\n`;
        }
        detailedDescription += `Şikayet Tarihi: ${formatDateValue(details.complaint_date)}\n`;
        detailedDescription += `Önem Seviyesi: ${details.severity || '-'}\n`;
        detailedDescription += `Durum: ${details.status || '-'}\n`;
        if (details.description) {
            detailedDescription += `\nŞikayet Açıklaması: ${details.description}\n`;
        }
        detailedDescription += `\nBu müşteri şikayeti için sapma onayı talep edilmektedir.`;
        return detailedDescription;
    }

    if (sourceType === 'fixture_nonconformity') {
        detailedDescription = `Fikstür Uygunsuzluğu (${details.fixture_no || '-'})\n\n`;
        detailedDescription += `Parça Kodu: ${details.part_code || 'Belirtilmemiş'}\n`;
        detailedDescription += `Parça Adı: ${details.part_name || 'Belirtilmemiş'}\n`;
        if (details.responsible_department) {
            detailedDescription += `Sorumlu Departman: ${details.responsible_department}\n`;
        }
        detailedDescription += `Tespit Tarihi: ${formatDateValue(details.detection_date)}\n`;
        detailedDescription += `Düzeltme Durumu: ${details.correction_status || '-'}\n`;

        if (Array.isArray(details.deviation_details) && details.deviation_details.length > 0) {
            detailedDescription += `\nUYGUNSUZLUK DETAYLARI:\n`;
            details.deviation_details.forEach((item, index) => {
                detailedDescription += `${index + 1}. ${item.characteristic || 'Karakteristik'}: ${item.deviation || '-'}\n`;
            });
        }

        if (details.correction_description) {
            detailedDescription += `\nDüzeltme Açıklaması: ${details.correction_description}\n`;
        }
        detailedDescription += `\nBu fikstür uygunsuzluğu için sapma onayı talep edilmektedir.`;
        return detailedDescription;
    }

    return detailedDescription;
};
