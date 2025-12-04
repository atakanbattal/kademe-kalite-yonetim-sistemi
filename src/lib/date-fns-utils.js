import { differenceInMilliseconds } from 'date-fns';

export const formatTimeInStatus = (vehicle) => {
    if (!vehicle) return 'Geçersiz Veri';

    let start, end;
    const now = new Date();

    // Specific rules for status calculation
    switch (vehicle.status) {
        case 'Sevk Edilmeye Hazır':
        case 'Onaylandı': // 'Onaylandı' is the same as 'Sevk Edilmeye Hazır'
            start = vehicle.approved_at;
            end = vehicle.shipped_at || now; // 'shipped_at' is equivalent to 'closed_at' for this status
            if (!start) return 'Onaylanma tarihi eksik';
            break;

        case 'Sevk Edildi':
            start = vehicle.approved_at;
            end = vehicle.shipped_at;
            if (!start || !end) return 'Geçersiz Zaman';
            break;

        case 'Yeniden İşlem':
            const activeReworkCycle = vehicle.quality_inspection_cycles
                ?.filter(c => c.rework_start_at && !c.rework_end_at)
                .sort((a, b) => new Date(b.rework_start_at) - new Date(a.rework_start_at))[0];
            
            start = activeReworkCycle?.rework_start_at || vehicle.status_entered_at;
            end = now;
            break;

        default: // For all other statuses
            start = vehicle.status_entered_at;
            end = now;
            break;
    }
    
    // Fallback if primary start time is missing
    if (!start) {
        start = vehicle.created_at;
    }

    if (!start) {
        console.error("Başlangıç zamanı belirlenemedi:", vehicle);
        return 'Başlangıç Zamanı Yok';
    }
    
    const startDate = new Date(start);
    const endDate = new Date(end || now);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        console.error("Geçersiz zaman hesaplama tarihi", { start, end, vehicle });
        return 'Geçersiz Zaman';
    }

    const diffMs = differenceInMilliseconds(endDate, startDate);

    if (diffMs < 0) {
        return '0:00 saat';
    }

    const totalHours = diffMs / (1000 * 60 * 60);

    if (totalHours < 24) {
        const totalMinutes = Math.floor(diffMs / (1000 * 60));
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return `${hours}:${String(minutes).padStart(2, '0')} saat`;
    } else {
        return `${totalHours.toFixed(1)} saat`;
    }
};