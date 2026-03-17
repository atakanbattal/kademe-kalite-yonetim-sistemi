import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

import { normalizeTurkishForSearch } from '@/lib/utils';

export const LEGACY_TANK_TYPE_OPTIONS = [
    'Yağ Tankı',
    'Su Tankı',
    'Mazot Tankı',
    'Fıskiye',
];

export const TANK_TYPE_OPTIONS = [
    ...LEGACY_TANK_TYPE_OPTIONS,
    'Kriko',
    'Yağlama Haznesi',
    'Yağlama Profili',
];

export const TEST_RESULT_OPTIONS = ['Kabul', 'Kaçak Var'];

export const buildVehicleTypeLabel = (product) => {
    if (!product) return '-';
    const name = product.product_name?.trim();
    return name || '-';
};

export const getVehicleTypeLabel = (record) => {
    if (!record) return '-';
    return record.vehicle_type_label || buildVehicleTypeLabel(record.vehicle_type);
};

export const getPersonnelName = (record, relationKey, snapshotKey) => {
    if (!record) return '-';
    return record?.[relationKey]?.full_name || record?.[snapshotKey] || '-';
};

export const formatTestDate = (dateValue) => {
    if (!dateValue) return '-';

    const parsedDate = new Date(`${dateValue}T00:00:00`);
    if (Number.isNaN(parsedDate.getTime())) return dateValue;

    return format(parsedDate, 'dd.MM.yyyy', { locale: tr });
};

export const formatTestDateTime = (dateValue, timeValue) => {
    if (!dateValue) return '-';

    const normalizedTime = String(timeValue || '00:00').slice(0, 5);
    const isoValue = `${dateValue}T${normalizedTime}:00`;
    const parsedDate = new Date(isoValue);

    if (Number.isNaN(parsedDate.getTime())) {
        return [dateValue, normalizedTime].filter(Boolean).join(' ');
    }

    return timeValue
        ? format(parsedDate, 'dd.MM.yyyy HH:mm', { locale: tr })
        : format(parsedDate, 'dd.MM.yyyy', { locale: tr });
};

export const formatDuration = (minutesValue) => {
    const minutes = Number(minutesValue);
    if (!Number.isFinite(minutes) || minutes <= 0) return '-';

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours === 0) return `${remainingMinutes} dk`;
    if (remainingMinutes === 0) return `${hours} sa`;

    return `${hours} sa ${remainingMinutes} dk`;
};

export const calculateEndTime = (startTime, durationMinutes) => {
    if (!startTime) return '-';

    const [hours, minutes] = String(startTime).split(':').map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return '-';

    const totalMinutes = (hours * 60) + minutes + (Number(durationMinutes) || 0);
    const normalizedMinutes = ((totalMinutes % 1440) + 1440) % 1440;
    const endHours = Math.floor(normalizedMinutes / 60);
    const endMinutes = normalizedMinutes % 60;

    return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
};

export const isGeneralScrapProduct = (product) => {
    const normalized = normalizeTurkishForSearch(`${product?.product_code || ''} ${product?.product_name || ''}`);
    return normalized.includes('genel hurda');
};
