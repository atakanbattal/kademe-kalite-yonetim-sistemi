/**
 * FMEA: RPN ve Öncelik (AP) — AIAG-VDA tarzı basitleştirilmiş kurallar.
 * Tam standart matrisi yerine S/O/D ve RPN birleşimi ile tutarlı sınıflandırma.
 */

export function computeRpn(s, o, d) {
  if (s == null || o == null || d == null) return null;
  const a = Number(s);
  const b = Number(o);
  const c = Number(d);
  if ([a, b, c].some((n) => Number.isNaN(n))) return null;
  return Math.round(a * b * c);
}

/**
 * @returns {'HIGH'|'MEDIUM'|'LOW'|null}
 */
export function computeApLevel(s, o, d) {
  if (s == null || o == null || d == null) return null;
  const S = Number(s);
  const O = Number(o);
  const D = Number(d);
  if ([S, O, D].some((n) => Number.isNaN(n))) return null;

  const rpn = S * O * D;

  if (S >= 9) return 'HIGH';
  if (S >= 7 && O >= 7) return 'HIGH';
  if (S >= 7 && D >= 7) return 'HIGH';
  if (rpn >= 125) return 'HIGH';

  if (S >= 7 || O >= 7 || D >= 7) return 'MEDIUM';
  if (rpn >= 64) return 'MEDIUM';

  return 'LOW';
}

export const AP_LABEL_TR = {
  HIGH: 'Yüksek',
  MEDIUM: 'Orta',
  LOW: 'Düşük',
};

export function apBadgeClass(ap) {
  if (ap === 'HIGH') return 'bg-[#e74c3c] text-white border-transparent';
  if (ap === 'MEDIUM') return 'bg-[#f39c12] text-white border-transparent';
  if (ap === 'LOW') return 'bg-[#27ae60] text-white border-transparent';
  return 'bg-muted text-muted-foreground';
}
