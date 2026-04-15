/**
 * FMEA uygulama ayarları ve kontrol planı gözden geçirme kuralları.
 */

export const DEFAULT_FMEA_APP_SETTINGS = {
  rpn_action_threshold: 100,
  rpn_after_action_threshold: null,
  alert_on_ap_high: true,
  alert_on_ap_medium: false,
};

export function mergeFmeaSettings(row) {
  if (!row || typeof row !== 'object') return { ...DEFAULT_FMEA_APP_SETTINGS };
  return {
    ...DEFAULT_FMEA_APP_SETTINGS,
    rpn_action_threshold:
      row.rpn_action_threshold != null ? Number(row.rpn_action_threshold) : DEFAULT_FMEA_APP_SETTINGS.rpn_action_threshold,
    rpn_after_action_threshold:
      row.rpn_after_action_threshold != null ? Number(row.rpn_after_action_threshold) : null,
    alert_on_ap_high: row.alert_on_ap_high !== false,
    alert_on_ap_medium: row.alert_on_ap_medium === true,
  };
}

function effectiveRpnAfterThreshold(s) {
  const a = s.rpn_after_action_threshold;
  if (a != null && !Number.isNaN(Number(a))) return Number(a);
  return Number(s.rpn_action_threshold) || DEFAULT_FMEA_APP_SETTINGS.rpn_action_threshold;
}

/** Satır neden KP gözden geçirmesi gerektiriyor? */
export function getCpReviewReasons(line, settings) {
  const s = mergeFmeaSettings(settings);
  const reasons = [];
  const thr = Number(s.rpn_action_threshold) || 100;
  const thrAfter = effectiveRpnAfterThreshold(s);

  const note = (line.cp_integration_note || '').trim();
  if (note) reasons.push({ code: 'cp_note', label: 'KP / ölçü notu dolu' });

  if (line.is_active === false) return reasons;

  if (line.rpn != null && line.rpn >= thr) {
    reasons.push({ code: 'rpn', label: `RPN ≥ ${thr}` });
  }
  if (line.rpn_after != null && line.rpn_after >= thrAfter) {
    reasons.push({ code: 'rpn_after', label: `RPN′ ≥ ${thrAfter}` });
  }
  if (s.alert_on_ap_high && line.ap_level === 'HIGH') {
    reasons.push({ code: 'ap_high', label: 'Öncelik yüksek (önce)' });
  }
  if (s.alert_on_ap_medium && line.ap_level === 'MEDIUM') {
    reasons.push({ code: 'ap_medium', label: 'Öncelik orta (önce)' });
  }
  if (s.alert_on_ap_high && line.ap_after === 'HIGH') {
    reasons.push({ code: 'ap_high_after', label: 'Öncelik yüksek (sonra)' });
  }

  const seen = new Set();
  return reasons.filter((r) => {
    const k = r.code + r.label;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function lineNeedsCpReview(line, settings) {
  return getCpReviewReasons(line, settings).length > 0;
}

export function normalizePartCode(v) {
  return String(v ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

/** Takip kaydı için tetikleyici türü (DB check ile uyumlu) */
export function inferTriggerTypeForFollowup(line, settings) {
  const reasons = getCpReviewReasons(line, settings);
  const codes = reasons.map((r) => r.code);
  if (codes.includes('cp_note')) return 'cp_note';
  if (codes.includes('rpn')) return 'rpn_threshold';
  if (codes.includes('rpn_after')) return 'rpn_after_threshold';
  if (codes.some((c) => c.startsWith('ap_high'))) return 'ap_high';
  if (codes.includes('ap_medium')) return 'ap_medium';
  return 'manual';
}
