import { differenceInMilliseconds, format, isValid, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';

const getSortedTimeline = (timelineEvents = []) => {
    return [...(timelineEvents || [])]
        .filter(event => event?.event_timestamp)
        .sort((a, b) => new Date(a.event_timestamp) - new Date(b.event_timestamp));
};

export const calculateVehicleTimelineStats = (timelineEvents = [], now = new Date()) => {
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

        // Kontrol süresi: yalnızca control_end ile kapanmış döngüler (KPI ile uyumlu).
        // Bitmemiş kontrolde bitiş olarak "şimdi" kullanılırsa ay/gün süren sahte süreler ortalamayı şişirir.
        if (currentEvent.event_type === 'control_start' && !nextEnd) {
            continue;
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
 * Her kontrol / yeniden işlem döngüsünü bitiş ayına göre gruplayıp o ay içindeki ortalama süreleri döndürür
 * (calculateVehicleTimelineStats ile aynı eşleştirme kuralları).
 */
export const calculateMonthlyAvgQualityAndRework = (vehicles = [], now = new Date()) => {
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
        const sortedEvents = getSortedTimeline(vehicle?.vehicle_timeline_events);
        if (sortedEvents.length === 0) return;

        const waitingEvent = sortedEvents.find((event) => event.event_type === 'waiting_for_shipping_info');
        const waitingForShippingStart = waitingEvent ? parseISO(waitingEvent.event_timestamp) : null;

        for (let i = 0; i < sortedEvents.length; i++) {
            const currentEvent = sortedEvents[i];
            const currentEventTime = parseISO(currentEvent.event_timestamp);

            if (!isValid(currentEventTime)) continue;
            if (waitingForShippingStart && currentEventTime >= waitingForShippingStart) continue;
            if (currentEvent.event_type !== 'control_start' && currentEvent.event_type !== 'rework_start') continue;

            const endEventType = currentEvent.event_type === 'control_start' ? 'control_end' : 'rework_end';
            const nextEnd = sortedEvents.slice(i + 1).find((event) => {
                if (event.event_type !== endEventType) return false;
                const endT = parseISO(event.event_timestamp);
                if (!isValid(endT)) return false;
                return !waitingForShippingStart || endT < waitingForShippingStart;
            });

            if (currentEvent.event_type === 'control_start' && !nextEnd) continue;

            const endTime = nextEnd
                ? parseISO(nextEnd.event_timestamp)
                : waitingForShippingStart || now;

            if (!isValid(endTime) || endTime <= currentEventTime) continue;

            const duration = differenceInMilliseconds(endTime, currentEventTime);
            const monthKey = format(endTime, 'yyyy-MM');
            bump(
                monthKey,
                currentEvent.event_type === 'control_start' ? 'control' : 'rework',
                duration
            );
        }
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
