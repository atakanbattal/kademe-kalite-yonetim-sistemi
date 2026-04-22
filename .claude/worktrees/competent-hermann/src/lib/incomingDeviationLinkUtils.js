import { normalizeTurkishForSearch } from '@/lib/utils';

/** Parça kodu karşılaştırması için normalize */
export function normalizePartCode(code) {
    return normalizeTurkishForSearch(String(code || '').trim().replace(/\s+/g, ''));
}

export function inspectionDefectQuantitySum(inspection) {
    const defects = inspection?.defects;
    if (!Array.isArray(defects) || defects.length === 0) return null;
    let sum = 0;
    let any = false;
    for (const d of defects) {
        const q = Number(d.quantity);
        if (!Number.isNaN(q)) {
            sum += q;
            any = true;
        }
    }
    return any ? sum : null;
}

/** buildSourceRecordDescription ile üretilen metinden kayıt no çıkar */
export function extractIncomingRecordNoFromDescription(description) {
    if (!description) return null;
    const m1 = description.match(/Girdi Kalite Kontrol Kaydı\s*\(([^)]+)\)/i);
    if (m1) return m1[1].trim();
    const m2 = description.match(/Kayıt No:\s*([^\n\r]+)/i);
    if (m2) return m2[1].trim();
    return null;
}

export function parseRejectedQtyFromDescription(description) {
    if (!description) return null;
    const m = description.match(/Red Edilen Miktar:\s*(\d+)/i);
    if (m) return Number(m[1]);
    return null;
}

function daysApart(dateA, dateB) {
    const a = new Date(dateA);
    const b = new Date(dateB);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 9999;
    return Math.abs(a.getTime() - b.getTime()) / 86400000;
}

/** Sapma modülündeki incoming_inspection source_record_details ile uyumlu JSON */
export function buildIncomingInspectionSourceDetails(inspection) {
    const supplier = inspection?.supplier?.name || inspection?.supplier_name || '';
    return {
        source_type: 'incoming_inspection',
        part_code: inspection.part_code,
        part_name: inspection.part_name,
        quantity:
            inspection.quantity_rejected ||
            inspection.quantity_conditional ||
            inspection.quantity_received ||
            null,
        supplier,
        record_no: inspection.record_no,
        inspection_number: inspection.record_no,
        decision: inspection.decision,
        quantity_rejected: inspection.quantity_rejected,
        quantity_conditional: inspection.quantity_conditional,
        defects: inspection.defects || [],
        results: inspection.results || [],
        description: inspection.description,
        notes: inspection.notes,
        delivery_note_number: inspection.delivery_note_number,
        inspection_date: inspection.inspection_date,
        quantity_received: inspection.quantity_received,
        quantity_inspected: inspection.quantity_inspected,
    };
}

/**
 * Bu muayene kaydı ile sapma satırının eşleşme skoru (0–100+).
 * disqualify: true ise otomatik bağlama önerilmez.
 */
export function scoreDeviationForIncomingInspection(deviation, inspection) {
    const reasons = [];
    let score = 0;

    const dPart = normalizePartCode(deviation.part_code);
    const iPart = normalizePartCode(inspection.part_code);
    const recNo = String(inspection.record_no || '').trim();

    if (dPart && iPart) {
        if (dPart !== iPart) {
            return { score: 0, reasons: ['Parça kodu farklı'], disqualify: true };
        }
        score += 42;
        reasons.push('Parça kodu eşleşiyor');
    }

    const descRec = extractIncomingRecordNoFromDescription(deviation.description);
    const descNorm = normalizeTurkishForSearch(deviation.description || '');
    const recNorm = normalizeTurkishForSearch(recNo);

    if (recNo) {
        if (descRec) {
            const dr = normalizeTurkishForSearch(descRec);
            if (dr === recNorm) {
                score += 38;
                reasons.push('Kayıt numarası (başlık) eşleşiyor');
            } else if (dr.includes(recNorm) || recNorm.includes(dr)) {
                score += 22;
                reasons.push('Kayıt numarası kısmen eşleşiyor');
            }
        } else if (recNorm && descNorm.includes(recNorm)) {
            score += 28;
            reasons.push('Kayıt numarası açıklamada geçiyor');
        }
    }

    const inspDate = inspection.inspection_date;
    const devDate = deviation.record_date || deviation.created_at;
    const dist = daysApart(inspDate, devDate);
    if (dist <= 1) {
        score += 18;
        reasons.push('Tarih aynı gün veya çok yakın');
    } else if (dist <= 7) {
        score += 12;
        reasons.push('Tarih yakın (≤7 gün)');
    } else if (dist <= 45) {
        score += 5;
        reasons.push('Tarih makul aralıkta (≤45 gün)');
    }

    /* Entegrasyon öncesi sapmalar: kayıt no DB'de yok ama parça + tarih güçlü sinyal */
    if (dPart && iPart && dPart === iPart && dist <= 14) {
        score += 28;
        reasons.push('Parça kodu + tarih uyumu (legacy / kaynak seçilmeden oluşturulmuş sapmalar)');
    }

    const rejDesc = parseRejectedQtyFromDescription(deviation.description);
    const ir = Number(inspection.quantity_rejected) || 0;
    const ic = Number(inspection.quantity_conditional) || 0;
    const defectSum = inspectionDefectQuantitySum(inspection);

    if (rejDesc != null && (ir > 0 || ic > 0)) {
        if (rejDesc === ir || rejDesc === ic || rejDesc === ir + ic) {
            score += 14;
            reasons.push('Red / şartlı kabul miktarı eşleşiyor');
        } else if (Math.abs(rejDesc - ir) <= 1 || Math.abs(rejDesc - ic) <= 1) {
            score += 7;
            reasons.push('Miktar yakın');
        }
    }
    if (defectSum != null && rejDesc != null && Math.abs(defectSum - rejDesc) <= 1) {
        score += 10;
        reasons.push('Hata satırları toplamı ile miktar uyumlu');
    }

    const supplierName = inspection?.supplier?.name || inspection?.supplier_name;
    if (supplierName) {
        const sn = normalizeTurkishForSearch(supplierName);
        if (sn && descNorm.includes(sn)) {
            score += 8;
            reasons.push('Tedarikçi adı açıklamada geçiyor');
        }
    }

    const del = String(inspection.delivery_note_number || '').trim();
    if (del && descNorm.includes(normalizeTurkishForSearch(del))) {
        score += 6;
        reasons.push('İrsaliye no metinde geçiyor');
    }

    if (!dPart && !iPart && !recNo) {
        return {
            score: 0,
            reasons: ['Parça kodu ve kayıt no yok; eşleştirme yapılamaz'],
            disqualify: true,
        };
    }

    if (!dPart && !iPart) {
        if (score < 35) {
            return { score, reasons, disqualify: true };
        }
    }

    return { score, reasons, disqualify: false };
}

export const AUTO_LINK_MIN_SCORE = 78;
export const SUGGEST_MIN_SCORE = 52;

export function canAutoLinkDeviationToInspection(deviation, inspectionId) {
    if (!deviation?.id || !inspectionId) return false;
    if (deviation.source_record_id && deviation.source_record_id !== inspectionId) {
        return false;
    }
    return true;
}

/** Girdi muayenesi ile heuristik eşleştirmede kullanılacak sapma adayı mı? */
export function deviationEligibleForIncomingHeuristic(deviation, inspectionId) {
    if (!deviation?.id || !inspectionId) return false;
    if (deviation.source_record_id && deviation.source_record_id !== inspectionId) {
        return false;
    }
    const st = deviation.source_type || 'manual';
    if (st !== 'manual' && st !== 'incoming_inspection') {
        return false;
    }
    return true;
}

/**
 * Tek bir muayene için en iyi eşleşen sapmayı bulur (rozet veya otomatik bağlama).
 */
export function findBestHeuristicDeviationForInspection(inspection, deviationsList, { minScore = 52 } = {}) {
    let best = null;
    for (const d of deviationsList || []) {
        if (!deviationEligibleForIncomingHeuristic(d, inspection.id)) continue;
        const { score, disqualify } = scoreDeviationForIncomingInspection(d, inspection);
        if (disqualify || score < minScore) continue;
        if (!best || score > best.score) {
            best = { deviation: d, score };
        }
    }
    return best;
}
