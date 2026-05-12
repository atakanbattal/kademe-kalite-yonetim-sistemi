/**
 * "Kaliteye Verilen Araçlar" modülünde araç başına özet metrikleri üreten yardımcılar.
 *
 * Kalite ekranı genelinde tutarlı sayım sağlamak için tek bir kaynak olarak kullanılır.
 * Timeline event'leri her aracın kalite geçmişini (kaliteye girişler, kontrol/yeniden işlem döngüleri,
 * Ar-Ge gönderimleri) içerir. Bu fonksiyonlar bu olaylar üzerinden tutarlı özet üretir.
 */
import { isValid, parseISO, startOfWeek, endOfWeek, format, isAfter } from 'date-fns';
import { tr } from 'date-fns/locale';

const safeParseDate = (value) => {
    if (!value) return null;
    if (value instanceof Date) return isValid(value) ? value : null;
    const parsed = parseISO(value);
    return isValid(parsed) ? parsed : null;
};

const sortedTimeline = (vehicle) => {
    const events = vehicle?.vehicle_timeline_events || [];
    return [...events]
        .filter((e) => e?.event_timestamp)
        .sort((a, b) => new Date(a.event_timestamp) - new Date(b.event_timestamp));
};

/**
 * Aracın kalite sürecine ilk girdiği zaman.
 * Öncelik sırası:
 *  1) vehicle_timeline_events içindeki en eski "quality_entry"
 *  2) inspections.quality_entry_at
 *  3) inspections.created_at
 */
export function getFirstQualityEntryDate(vehicle) {
    const events = sortedTimeline(vehicle);
    const firstEntryEvent = events.find((e) => e.event_type === 'quality_entry');
    if (firstEntryEvent) {
        const d = safeParseDate(firstEntryEvent.event_timestamp);
        if (d) return d;
    }
    const fromColumn = safeParseDate(vehicle?.quality_entry_at);
    if (fromColumn) return fromColumn;
    return safeParseDate(vehicle?.created_at);
}

/**
 * Araç hayatı boyunca kaç defa yeniden işleme alındığı.
 * rework_start sayısı = döngü sayısı (devam edenler dahil).
 */
export function getReworkCount(vehicle) {
    const events = sortedTimeline(vehicle);
    return events.filter((e) => e.event_type === 'rework_start').length;
}

/**
 * Aracın aktif yeniden işlem durumunda olup olmadığı (rework_start var, rework_end yok).
 */
export function hasOpenRework(vehicle) {
    const events = sortedTimeline(vehicle);
    const lastReworkStart = [...events]
        .reverse()
        .find((e) => e.event_type === 'rework_start');
    if (!lastReworkStart) return false;
    const reworkEndAfter = events.find(
        (e) => e.event_type === 'rework_end' &&
            new Date(e.event_timestamp) > new Date(lastReworkStart.event_timestamp)
    );
    return !reworkEndAfter;
}

/**
 * Kontrol döngü sayısı: control_start sayısı (devam edenler dahil).
 */
export function getControlCycleCount(vehicle) {
    const events = sortedTimeline(vehicle);
    return events.filter((e) => e.event_type === 'control_start').length;
}

/**
 * Araç bazlı tek aramada hazır özet metrikler.
 */
export function buildVehicleQualitySummary(vehicle) {
    return {
        firstQualityEntry: getFirstQualityEntryDate(vehicle),
        reworkCount: getReworkCount(vehicle),
        controlCycleCount: getControlCycleCount(vehicle),
        hasOpenRework: hasOpenRework(vehicle),
    };
}

/**
 * Verilen araç listesini haftalık (Pazartesi başlangıçlı) gruplara böler.
 * İlk kaliteye giriş zamanına göre gruplandırma yapar.
 *
 * @param {Array} vehicles - kalite kayıtları
 * @param {Object} options
 * @param {Date} [options.referenceDate]   - sadece bu tarihten önceki haftaları üret (varsayılan: bugün)
 * @returns {Array} - haftalık özet listesi (eski → yeni sıralı)
 */
export function buildWeeklyQualityIntake(vehicles = [], { referenceDate } = {}) {
    const map = new Map();
    const today = referenceDate ? new Date(referenceDate) : new Date();

    vehicles.forEach((vehicle) => {
        const firstEntry = getFirstQualityEntryDate(vehicle);
        if (!firstEntry) return;
        if (isAfter(firstEntry, today)) return; // gelecekteki kayıtları atla

        const weekStart = startOfWeek(firstEntry, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(firstEntry, { weekStartsOn: 1 });
        const key = format(weekStart, 'yyyy-MM-dd');

        if (!map.has(key)) {
            map.set(key, {
                weekKey: key,
                weekStart,
                weekEnd,
                weekLabel: `${format(weekStart, 'd MMM', { locale: tr })} - ${format(weekEnd, 'd MMM', { locale: tr })}`,
                shortLabel: format(weekStart, 'd MMM', { locale: tr }),
                count: 0,
                cleanCount: 0,
                faultyCount: 0,
                reworkedCount: 0,
                totalFaults: 0,
                totalRework: 0,
                vehicles: [],
            });
        }
        const row = map.get(key);
        row.count += 1;
        row.vehicles.push(vehicle.id);

        const faults = vehicle.quality_inspection_faults || [];
        const faultQty = faults.reduce((sum, f) => sum + (Number(f.quantity) || 1), 0);
        row.totalFaults += faultQty;
        if (faults.length > 0) {
            row.faultyCount += 1;
        } else {
            row.cleanCount += 1;
        }
        const reworkCount = getReworkCount(vehicle);
        row.totalRework += reworkCount;
        if (reworkCount > 0) row.reworkedCount += 1;
    });

    return Array.from(map.values())
        .sort((a, b) => a.weekStart - b.weekStart)
        .map((row) => ({
            ...row,
            ftq: row.count > 0 ? Math.round((row.cleanCount / row.count) * 1000) / 10 : 0,
            reworkRate: row.count > 0 ? Math.round((row.reworkedCount / row.count) * 1000) / 10 : 0,
            avgRework: row.count > 0 ? Math.round((row.totalRework / row.count) * 100) / 100 : 0,
        }));
}
