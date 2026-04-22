import { format, parse } from 'date-fns';
import { tr } from 'date-fns/locale';

const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Tarih-saat gösterimi: YYYY-MM-DD tek başına UTC gece yarısı parse edilip TR saatinde 03:00 gibi
 * yanlış saat üretmesin diye yerel gün olarak yorumlanır.
 */
export function formatInspectionDateTime(value, pattern = "dd MMMM yyyy HH:mm") {
    if (value == null || value === '') return '-';
    try {
        const s = String(value).trim();
        if (ISO_DATE_ONLY.test(s)) {
            const d = parse(s, 'yyyy-MM-dd', new Date());
            if (Number.isNaN(d.getTime())) return '-';
            return format(d, pattern, { locale: tr });
        }
        const d = new Date(s);
        if (Number.isNaN(d.getTime())) return '-';
        return format(d, pattern, { locale: tr });
    } catch {
        return '-';
    }
}

/** Sadece gün (tarih alanlarında saat göstermemek için). */
export function formatInspectionDateOnly(value) {
    if (value == null || value === '') return '-';
    try {
        const s = String(value).trim();
        if (ISO_DATE_ONLY.test(s)) {
            const d = parse(s, 'yyyy-MM-dd', new Date());
            return Number.isNaN(d.getTime()) ? '-' : format(d, 'dd MMMM yyyy', { locale: tr });
        }
        const d = new Date(s);
        if (Number.isNaN(d.getTime())) return '-';
        return format(d, 'dd MMMM yyyy', { locale: tr });
    } catch {
        return '-';
    }
}
