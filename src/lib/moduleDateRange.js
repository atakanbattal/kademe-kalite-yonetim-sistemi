import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

/** DateRangePicker çıktısını rapor ve filtrelerde kullanılacak etiket + ISO aralığına çevirir. */
export function resolveModuleDateRange(dateRange) {
    if (!dateRange?.from || !dateRange?.to) {
        return { label: 'Tüm Zamanlar', startDate: null, endDate: null, fromIso: null, toIso: null };
    }
    const from = dateRange.from;
    const to = dateRange.to;
    const toEnd = new Date(to);
    toEnd.setHours(23, 59, 59, 999);
    return {
        label: `${format(from, 'dd.MM.yyyy', { locale: tr })} - ${format(to, 'dd.MM.yyyy', { locale: tr })}`,
        startDate: from,
        endDate: toEnd,
        fromIso: format(from, 'yyyy-MM-dd'),
        toIso: format(to, 'yyyy-MM-dd'),
    };
}

export function isWithinModuleDateRange(dateValue, dateRange) {
    if (!dateRange?.from || !dateRange?.to || !dateValue) return true;
    const raw = String(dateValue);
    const d = new Date(raw.includes('T') ? raw : `${raw}T12:00:00`);
    if (Number.isNaN(d.getTime())) return true;
    const from = new Date(dateRange.from);
    from.setHours(0, 0, 0, 0);
    const to = new Date(dateRange.to);
    to.setHours(23, 59, 59, 999);
    return d >= from && d <= to;
}
