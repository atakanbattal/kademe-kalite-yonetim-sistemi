/**
 * Produced Vehicles modülünden kalitesizlik maliyeti hesaplama yardımcı fonksiyonları
 */

import { supabase } from '@/lib/customSupabaseClient';

/**
 * Araç için kontrol süresini hesaplar (dakika cinsinden)
 * @param {Array} timelineEvents - vehicle_timeline_events array'i
 * @returns {number} - Toplam kontrol süresi (dakika)
 */
export const calculateInspectionDuration = (timelineEvents = []) => {
    if (!timelineEvents || timelineEvents.length === 0) return 0;
    
    let totalMillis = 0;
    const sortedEvents = [...timelineEvents].sort((a, b) => 
        new Date(a.event_timestamp) - new Date(b.event_timestamp)
    );
    
    for (let i = 0; i < sortedEvents.length; i++) {
        if (sortedEvents[i].event_type === 'control_start') {
            const endEvent = sortedEvents.slice(i + 1).find(e => e.event_type === 'control_end');
            if (endEvent) {
                const startTime = new Date(sortedEvents[i].event_timestamp);
                const endTime = new Date(endEvent.event_timestamp);
                totalMillis += (endTime - startTime);
            }
        }
    }
    
    return Math.round(totalMillis / 60000); // Dakika cinsinden
};

/**
 * Araç için rework süresini hesaplar (dakika cinsinden)
 * @param {Array} timelineEvents - vehicle_timeline_events array'i
 * @returns {number} - Toplam rework süresi (dakika)
 */
export const calculateReworkDuration = (timelineEvents = []) => {
    if (!timelineEvents || timelineEvents.length === 0) return 0;
    
    let totalMillis = 0;
    const sortedEvents = [...timelineEvents].sort((a, b) => 
        new Date(a.event_timestamp) - new Date(b.event_timestamp)
    );
    
    for (let i = 0; i < sortedEvents.length; i++) {
        if (sortedEvents[i].event_type === 'rework_start') {
            const endEvent = sortedEvents.slice(i + 1).find(e => e.event_type === 'rework_end');
            if (endEvent) {
                const startTime = new Date(sortedEvents[i].event_timestamp);
                const endTime = new Date(endEvent.event_timestamp);
                totalMillis += (endTime - startTime);
            }
        }
    }
    
    return Math.round(totalMillis / 60000); // Dakika cinsinden
};

/**
 * Birim maliyetlerinden kontrol maliyetini hesaplar
 * @param {number} durationMinutes - Kontrol süresi (dakika)
 * @param {string} qualityUnit - Kalite kontrol birimi adı
 * @param {Array} unitCostSettings - Birim maliyet ayarları
 * @returns {number} - Kontrol maliyeti (TL)
 */
export const calculateInspectionCost = (durationMinutes, qualityUnit, unitCostSettings = []) => {
    if (!durationMinutes || durationMinutes <= 0 || !qualityUnit) return 0;
    
    const unitSetting = unitCostSettings.find(u => u.unit_name === qualityUnit);
    if (!unitSetting || !unitSetting.cost_per_minute) return 0;
    
    return durationMinutes * parseFloat(unitSetting.cost_per_minute);
};

/**
 * Birim maliyetlerinden rework maliyetini hesaplar
 * @param {number} durationMinutes - Rework süresi (dakika)
 * @param {string} reworkUnit - Rework yapan birim adı
 * @param {Array} unitCostSettings - Birim maliyet ayarları
 * @returns {number} - Rework maliyeti (TL)
 */
export const calculateReworkCostFromDuration = (durationMinutes, reworkUnit, unitCostSettings = []) => {
    if (!durationMinutes || durationMinutes <= 0 || !reworkUnit) return 0;
    
    const unitSetting = unitCostSettings.find(u => u.unit_name === reworkUnit);
    if (!unitSetting || !unitSetting.cost_per_minute) return 0;
    
    return durationMinutes * parseFloat(unitSetting.cost_per_minute);
};

/**
 * Araç için toplam kalitesizlik maliyetini hesaplar
 * @param {Object} vehicle - Araç objesi (quality_inspections tablosundan)
 * @param {Array} unitCostSettings - Birim maliyet ayarları
 * @param {string} qualityUnit - Kalite kontrol birimi adı (varsayılan: 'Kalite Kontrol')
 * @returns {Object} - { inspectionCost, reworkCost, totalCost, inspectionDuration, reworkDuration }
 */
export const calculateVehicleQualityCost = (vehicle, unitCostSettings = [], qualityUnit = 'Kalite Kontrol') => {
    const timelineEvents = vehicle.vehicle_timeline_events || [];
    const faults = vehicle.quality_inspection_faults || [];
    
    // Sadece çözülmemiş hatalar varsa maliyet hesapla
    const unresolvedFaults = faults.filter(f => !f.is_resolved);
    if (unresolvedFaults.length === 0) {
        return {
            inspectionCost: 0,
            reworkCost: 0,
            totalCost: 0,
            inspectionDuration: 0,
            reworkDuration: 0,
            faultCount: 0
        };
    }
    
    // Süreleri hesapla
    const inspectionDuration = calculateInspectionDuration(timelineEvents);
    const reworkDuration = calculateReworkDuration(timelineEvents);
    
    // Maliyetleri hesapla
    const inspectionCost = calculateInspectionCost(inspectionDuration, qualityUnit, unitCostSettings);
    
    // Rework maliyeti için birim belirleme (hataların çoğunun olduğu birim veya varsayılan birim)
    const faultUnits = unresolvedFaults.map(f => f.department?.name || f.department_name).filter(Boolean);
    const mostCommonUnit = faultUnits.length > 0 
        ? faultUnits.reduce((a, b, _, arr) => arr.filter(v => v === a).length >= arr.filter(v => v === b).length ? a : b)
        : 'Üretim';
    
    const reworkCost = calculateReworkCostFromDuration(reworkDuration, mostCommonUnit, unitCostSettings);
    
    const totalCost = inspectionCost + reworkCost;
    const faultCount = unresolvedFaults.reduce((sum, f) => sum + (f.quantity || 1), 0);
    
    return {
        inspectionCost,
        reworkCost,
        totalCost,
        inspectionDuration,
        reworkDuration,
        faultCount,
        qualityUnit,
        reworkUnit: mostCommonUnit
    };
};

/**
 * Araç için kalitesizlik maliyeti kaydı oluşturur
 * @param {Object} vehicle - Araç objesi
 * @param {Array} unitCostSettings - Birim maliyet ayarları
 * @param {string} qualityUnit - Kalite kontrol birimi adı
 * @returns {Promise<Object>} - Oluşturulan maliyet kaydı
 */
export const createVehicleQualityCostRecord = async (vehicle, unitCostSettings = [], qualityUnit = 'Kalite Kontrol') => {
    const costData = calculateVehicleQualityCost(vehicle, unitCostSettings, qualityUnit);
    
    // Eğer maliyet yoksa kayıt oluşturma
    if (costData.totalCost <= 0) {
        return null;
    }
    
    const faults = vehicle.quality_inspection_faults || [];
    const unresolvedFaults = faults.filter(f => !f.is_resolved);
    
    // Açıklama oluştur
    const faultDescriptions = unresolvedFaults.map(f => 
        `- ${f.description} (${f.quantity || 1} adet)`
    ).join('\n');
    
    const description = `Üretilen Araç Kalitesizlik Maliyeti\n` +
        `Araç: ${vehicle.chassis_no || vehicle.serial_no || 'Bilinmeyen'}\n` +
        `Araç Tipi: ${vehicle.vehicle_type || 'Bilinmeyen'}\n` +
        `Müşteri: ${vehicle.customer_name || 'Bilinmeyen'}\n` +
        `\nTespit Edilen Hatalar:\n${faultDescriptions}\n` +
        `\nKontrol Süresi: ${costData.inspectionDuration} dakika\n` +
        `Rework Süresi: ${costData.reworkDuration} dakika\n` +
        `Toplam Hata Sayısı: ${costData.faultCount} adet`;
    
    // Etkilenen birimler array'i oluştur
    const affectedUnits = [];
    if (costData.inspectionDuration > 0) {
        affectedUnits.push({
            unit: costData.qualityUnit,
            duration: costData.inspectionDuration
        });
    }
    if (costData.reworkDuration > 0) {
        affectedUnits.push({
            unit: costData.reworkUnit,
            duration: costData.reworkDuration
        });
    }
    
    // Quality cost kaydı oluştur
    const costRecord = {
        cost_type: 'Yeniden İşlem Maliyeti',
        unit: costData.reworkUnit || 'Üretim',
        vehicle_type: vehicle.vehicle_type || null,
        part_code: null,
        part_name: null,
        amount: costData.totalCost,
        cost_date: new Date().toISOString().slice(0, 10),
        description: description,
        rework_duration: costData.reworkDuration,
        quantity: costData.faultCount,
        affected_units: affectedUnits.length > 0 ? affectedUnits : null,
        status: 'Aktif',
        // Kaynak bilgisi için yeni alanlar (eğer varsa)
        source_type: 'produced_vehicle',
        source_record_id: vehicle.id,
        // Kontrol süresi için yeni alan (eğer varsa)
        quality_control_duration: costData.inspectionDuration
    };
    
    const { data, error } = await supabase
        .from('quality_costs')
        .insert([costRecord])
        .select()
        .single();
    
    if (error) {
        console.error('❌ Kalitesizlik maliyeti kaydı oluşturulamadı:', error);
        throw error;
    }
    
    return data;
};

