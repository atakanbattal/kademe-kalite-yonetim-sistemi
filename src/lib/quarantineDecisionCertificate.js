/** Karantina karar tutanağı PDF metinleri (ürüne özel ifadeler) */
export const QUARANTINE_DECISION_TYPES = [
    'Serbest Bırak',
    'Sapma Onayı',
    'Yeniden İşlem',
    'Hurda',
    'İade',
    'Onay Bekliyor',
];

export function getQuarantineDecisionCertificateStatement(decision) {
    const map = {
        'Serbest Bırak':
            'Bu ürünün olduğu gibi kullanılmasına (serbest bırakılmasına) karar verilmiştir.',
        'Sapma Onayı': 'Bu ürünün sapma kapsamında kullanılmasına karar verilmiştir.',
        'Yeniden İşlem': 'Bu ürünün yeniden işleme alınmasına karar verilmiştir.',
        Hurda: 'Bu ürünün hurdaya ayrılmasına karar verilmiştir.',
        İade: 'Bu ürünün iade edilmesine karar verilmiştir.',
        'Onay Bekliyor': 'Bu ürün için onay süreci yürütülmektedir.',
    };
    if (decision && map[decision]) return map[decision];
    return decision
        ? `Bu karantina kaydı için «${decision}» kararına ilişkin tutanaktır.`
        : 'Karar metni seçilmedi.';
}
