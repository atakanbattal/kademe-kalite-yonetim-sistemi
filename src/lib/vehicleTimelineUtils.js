import { differenceInMilliseconds, format, isValid, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';

const getSortedTimeline = (timelineEvents = []) => {
    return [...(timelineEvents || [])]
        .filter(event => event?.event_timestamp)
        .sort((a, b) => new Date(a.event_timestamp) - new Date(b.event_timestamp));
};

export const calculateVehicleTimelineStats = (
    timelineEvents = [],
    now = new Date(),
    { vehicleStatus } = {}
) => {
    const sortedEvents = getSortedTimeline(timelineEvents);
    if (sortedEvents.length === 0) {
        return {
            totalControlMillis: 0,
            totalReworkMillis: 0,
            totalQualityMillis: 0,
            controlCycleCount: 0,
            reworkCycleCount: 0,
        };
    }

    const waitingEvent = sortedEvents.find(event => event.event_type === 'waiting_for_shipping_info');
    const waitingForShippingStart = waitingEvent ? parseISO(waitingEvent.event_timestamp) : null;

    let totalControlMillis = 0;
    let totalReworkMillis = 0;
    let controlCycleCount = 0;
    let reworkCycleCount = 0;

    for (let i = 0; i < sortedEvents.length; i++) {
        const currentEvent = sortedEvents[i];
        const currentEventTime = parseISO(currentEvent.event_timestamp);

        if (!isValid(currentEventTime)) {
            continue;
        }

        if (waitingForShippingStart && currentEventTime >= waitingForShippingStart) {
            continue;
        }

        if (currentEvent.event_type !== 'control_start' && currentEvent.event_type !== 'rework_start') {
            continue;
        }

        const endEventType = currentEvent.event_type === 'control_start' ? 'control_end' : 'rework_end';
        const nextEnd = sortedEvents.slice(i + 1).find(event => {
            if (event.event_type !== endEventType) {
                return false;
            }

            const endTime = parseISO(event.event_timestamp);
            if (!isValid(endTime)) {
                return false;
            }

            return !waitingForShippingStart || endTime < waitingForShippingStart;
        });

        // Kontrol: yalnızca control_end ile kapanmış döngüler.
        if (currentEvent.event_type === 'control_start' && !nextEnd) {
            continue;
        }

        // Yeniden işlem: sevk edilmiş araçlarda eksik rework_end + "şimdi" = yüzlerce gün sahte süre.
        // Yalnızca kapanmış döngü, sevk bekleme sınırı veya hâlâ "Yeniden İşlemde" olan açık iş sayılır.
        if (currentEvent.event_type === 'rework_start' && !nextEnd) {
            if (!waitingForShippingStart && vehicleStatus !== 'Yeniden İşlemde') {
                continue;
            }
        }

        const endTime = nextEnd
            ? parseISO(nextEnd.event_timestamp)
            : waitingForShippingStart || now;

        if (!isValid(endTime) || endTime <= currentEventTime) {
            continue;
        }

        const duration = differenceInMilliseconds(endTime, currentEventTime);
        if (currentEvent.event_type === 'control_start') {
            totalControlMillis += duration;
            controlCycleCount += 1;
        } else {
            totalReworkMillis += duration;
            reworkCycleCount += 1;
        }
    }

    return {
        totalControlMillis,
        totalReworkMillis,
        totalQualityMillis: totalControlMillis + totalReworkMillis,
        controlCycleCount,
        reworkCycleCount,
    };
};

/**
 * Bir aracın zaman çizelgesinden YALNIZCA kapanmış (bitiş olayı bulunan) kontrol / yeniden işlem
 * döngülerini çıkarır. Kart, grafik ve PDF hep bu tek kaynağı kullanır → değerler her yerde aynıdır.
 */
const extractClosedTimelineCycles = (timelineEvents = []) => {
    const sortedEvents = getSortedTimeline(timelineEvents);
    if (sortedEvents.length === 0) return [];

    const waitingEvent = sortedEvents.find((event) => event.event_type === 'waiting_for_shipping_info');
    const waitingForShippingStart = waitingEvent ? parseISO(waitingEvent.event_timestamp) : null;

    const cycles = [];
    for (let i = 0; i < sortedEvents.length; i++) {
        const currentEvent = sortedEvents[i];
        const startTime = parseISO(currentEvent.event_timestamp);

        if (!isValid(startTime)) continue;
        if (waitingForShippingStart && startTime >= waitingForShippingStart) continue;
        if (currentEvent.event_type !== 'control_start' && currentEvent.event_type !== 'rework_start') continue;

        const endEventType = currentEvent.event_type === 'control_start' ? 'control_end' : 'rework_end';
        const nextEnd = sortedEvents.slice(i + 1).find((event) => {
            if (event.event_type !== endEventType) return false;
            const endT = parseISO(event.event_timestamp);
            if (!isValid(endT)) return false;
            return !waitingForShippingStart || endT < waitingForShippingStart;
        });

        if (!nextEnd) continue;

        const endTime = parseISO(nextEnd.event_timestamp);
        if (!isValid(endTime) || endTime <= startTime) continue;

        cycles.push({
            kind: currentEvent.event_type === 'control_start' ? 'control' : 'rework',
            durationMs: differenceInMilliseconds(endTime, startTime),
            endDate: endTime,
        });
    }
    return cycles;
};

/**
 * Her kapanmış kontrol / yeniden işlem döngüsünü bitiş ayına göre gruplayıp ortalama süreleri döndürür.
 */
export const calculateMonthlyAvgQualityAndRework = (vehicles = []) => {
    const monthAgg = new Map();

    const bump = (monthKey, kind, durationMs) => {
        if (!monthKey || typeof durationMs !== 'number' || durationMs <= 0) return;
        const b = monthAgg.get(monthKey) || { cSum: 0, cN: 0, rSum: 0, rN: 0 };
        if (kind === 'control') {
            b.cSum += durationMs;
            b.cN += 1;
        } else {
            b.rSum += durationMs;
            b.rN += 1;
        }
        monthAgg.set(monthKey, b);
    };

    (vehicles || []).forEach((vehicle) => {
        extractClosedTimelineCycles(vehicle?.vehicle_timeline_events).forEach((cycle) => {
            bump(format(cycle.endDate, 'yyyy-MM'), cycle.kind, cycle.durationMs);
        });
    });

    const sortedKeys = Array.from(monthAgg.keys()).sort();
    return sortedKeys.map((key) => {
        const b = monthAgg.get(key);
        const ortKaliteMs = b.cN > 0 ? b.cSum / b.cN : null;
        const ortYenidenIslemMs = b.rN > 0 ? b.rSum / b.rN : null;
        return {
            monthKey: key,
            monthLabel: format(parseISO(`${key}-01`), 'LLLL yyyy', { locale: tr }),
            monthShort: format(parseISO(`${key}-01`), 'MMM yyyy', { locale: tr }),
            ortKaliteDk: ortKaliteMs != null ? ortKaliteMs / 60000 : null,
            ortYenidenIslemDk: ortYenidenIslemMs != null ? ortYenidenIslemMs / 60000 : null,
            ortKaliteMs,
            ortYenidenIslemMs,
            kaliteDonguSayisi: b.cN,
            yenidenIslemDonguSayisi: b.rN,
        };
    });
};

/** Yönetici özet raporu: son N dolu ay (modül panosuyla aynı yöntem). */
export const EXECUTIVE_REPORT_MONTHLY_DURATION_MONTHS = 12;

/**
 * Kart ortalamaları: aylık özetteki KAPANMIŞ döngülerin toplamı.
 * Aynı döngü kümesini kullandığı için kart = grafiğin ağırlıklı ortalamasıdır.
 */
export const aggregateFleetTimelineDurations = (vehicles = []) => {
    let totalControlMillis = 0;
    let controlCount = 0;
    let totalReworkMillis = 0;
    let reworkCount = 0;

    (vehicles || []).forEach((vehicle) => {
        extractClosedTimelineCycles(vehicle?.vehicle_timeline_events).forEach((cycle) => {
            if (cycle.kind === 'control') {
                totalControlMillis += cycle.durationMs;
                controlCount += 1;
            } else {
                totalReworkMillis += cycle.durationMs;
                reworkCount += 1;
            }
        });
    });

    return {
        totalControlMillis,
        controlCount,
        totalReworkMillis,
        reworkCount,
    };
};

