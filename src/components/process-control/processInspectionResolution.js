export const RESOLUTION_STATUS = {
    OPEN: 'Açık',
    IN_PROGRESS: 'Çözümleniyor',
    RESOLVED: 'Çözüldü',
};

export const RESOLUTION_STATUS_OPTIONS = [
    { value: RESOLUTION_STATUS.OPEN, label: 'Açık', description: 'Henüz çözüm aksiyonu alınmadı' },
    { value: RESOLUTION_STATUS.IN_PROGRESS, label: 'Çözümleniyor', description: 'Aksiyon başlatıldı, kapatılmadı' },
    { value: RESOLUTION_STATUS.RESOLVED, label: 'Çözüldü', description: 'Sorun giderildi, parçalar uygun hale getirildi' },
];

export const RESOLUTION_TYPE_OPTIONS = [
    {
        value: 'Yeniden İşleme',
        label: 'Yeniden İşleme (Rework)',
        description: 'Parça üzerinde tashih / düzeltme yapıldı',
    },
    {
        value: 'Değiştirme',
        label: 'Değiştirme (Replacement)',
        description: 'Hatalı parça kaldırılıp yenisi kullanıldı',
    },
    {
        value: 'Sapma ile Kabul',
        label: 'Sapma ile Kabul',
        description: 'Sapma onayı ile kullanıma alındı',
    },
    {
        value: 'Hurda',
        label: 'Hurda',
        description: 'Parça imha edildi / hurdaya ayrıldı',
    },
    {
        value: 'Tedarikçiye İade',
        label: 'Tedarikçiye İade',
        description: 'Hatalı parça tedarikçiye geri gönderildi',
    },
    {
        value: 'Yeni Ölçüm / Doğrulama',
        label: 'Yeni Ölçüm / Doğrulama',
        description: 'Ölçüm tekrar yapıldı, değerler uygun bulundu',
    },
    {
        value: 'Diğer',
        label: 'Diğer',
        description: 'Serbest açıklama ile belirtilecek aksiyon',
    },
];

export const hasRejection = (inspection) => {
    if (!inspection) return false;
    if (inspection.decision === 'Ret') return true;
    if ((Number(inspection.quantity_rejected) || 0) > 0) return true;
    return false;
};

export const isResolved = (inspection) =>
    inspection?.resolution_status === RESOLUTION_STATUS.RESOLVED;

export const getEffectiveDecisionState = (inspection) => {
    const decision = inspection?.decision || 'Beklemede';

    if (decision !== 'Ret') {
        return { key: decision, label: decision };
    }

    const status = inspection?.resolution_status;

    if (status === RESOLUTION_STATUS.RESOLVED) {
        return { key: 'Ret (Çözüldü)', label: 'Ret · Çözüldü' };
    }

    if (status === RESOLUTION_STATUS.IN_PROGRESS) {
        return { key: 'Ret (Çözümleniyor)', label: 'Ret · Çözümleniyor' };
    }

    return { key: 'Ret', label: 'Ret' };
};

export const buildResolutionPayload = ({
    status,
    type,
    notes,
    personnelId,
    personnelName,
    date,
}) => {
    const hasAny =
        Boolean(status) || Boolean(type) || Boolean(notes) || Boolean(personnelId) || Boolean(date);

    if (!hasAny) {
        return {
            resolution_status: null,
            resolution_type: null,
            resolution_notes: null,
            resolution_date: null,
            resolved_by_personnel_id: null,
            resolved_by_name: null,
            resolved_at: null,
        };
    }

    return {
        resolution_status: status || null,
        resolution_type: type || null,
        resolution_notes: notes || null,
        resolution_date: date || null,
        resolved_by_personnel_id: personnelId || null,
        resolved_by_name: personnelName || null,
        resolved_at:
            status === RESOLUTION_STATUS.RESOLVED
                ? date || new Date().toISOString()
                : null,
    };
};
