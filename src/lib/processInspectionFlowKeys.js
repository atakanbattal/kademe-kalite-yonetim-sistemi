/**
 * Proses muayenesi kaynaklı çapraz-modül akışları için paylaşılan sessionStorage anahtarları.
 * Bir modül "Sapma Talebi", "Hurda Maliyeti" veya "Tedarikçiye İade" başlatıldığında
 * ilgili hedef modül (Deviation / QualityCost / Nonconformity) bu anahtarı okuyup
 * formu ön-doldurulmuş olarak açar ve tamamlandığında kaynak process_inspection kaydının
 * çözüm (resolution) durumunu otomatik olarak "Çözüldü" yapar.
 */
export const PROCESS_INSPECTION_DEVIATION_FLOW_KEY = 'kademe_qms_process_inspection_deviation_flow';
export const PROCESS_INSPECTION_SCRAP_COST_FLOW_KEY = 'kademe_qms_process_inspection_scrap_cost_flow';

export const readProcessInspectionFlow = (key) => {
    try {
        const raw = sessionStorage.getItem(key);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        sessionStorage.removeItem(key);
        return null;
    }
};

export const writeProcessInspectionFlow = (key, payload) => {
    try {
        sessionStorage.setItem(key, JSON.stringify(payload));
    } catch (err) {
        console.error('Flow payload yazılamadı:', err);
    }
};

export const clearProcessInspectionFlow = (key) => {
    try {
        sessionStorage.removeItem(key);
    } catch {
        /* sessionStorage kullanılamıyor olabilir */
    }
};
