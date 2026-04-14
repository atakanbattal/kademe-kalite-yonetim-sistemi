/**
 * Kare / madde işaretlerini (■ ▪ ◼ vb.) metinden kaldırır; satır başındaki fazla boşlukları sadeleştirir.
 */
export function stripSquareBullets(text) {
  if (text == null || typeof text !== 'string') return text;
  return text
    .replace(/^[\s\uFEFF]*■[\s\uFEFF]*/gm, '')
    .replace(/[\u25A0\u25AA\u25FE\u25AB\u2588■]/g, '');
}
