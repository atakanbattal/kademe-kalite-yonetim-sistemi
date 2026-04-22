import { differenceInMilliseconds, isValid, parseISO } from 'date-fns';

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
